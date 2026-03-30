import type { GdlFormat, FileEntry } from "../types";
import type { EntityOccurrence } from "../parsers";
import type { CrossReference } from "../indexer";
import type { GdlGraphNode, GdlGraphEdge, GraphData, GraphNodeType } from "./types";

/** Map GDL format to graph node type */
function formatToNodeType(format: GdlFormat): GraphNodeType {
  switch (format) {
    case "gdls": return "schema";
    case "gdlc": return "code";
    case "gdld": return "diagram";
    case "gdlm": return "memory";
    case "gdla": return "api";
    case "gdlu": return "document";
    case "gdl":  return "data";
  }
}

/** Determine the primary node type from an entity's occurrences */
function primaryType(occurrences: EntityOccurrence[]): GraphNodeType {
  // Count occurrences per format, pick the most common
  const counts = new Map<GdlFormat, number>();
  for (const occ of occurrences) {
    counts.set(occ.format, (counts.get(occ.format) ?? 0) + 1);
  }
  let bestFormat: GdlFormat = occurrences[0]!.format;
  let bestCount = 0;
  for (const [fmt, count] of counts) {
    if (count > bestCount) { bestFormat = fmt; bestCount = count; }
  }
  return formatToNodeType(bestFormat);
}

/** Create a stable node ID */
function entityNodeId(entity: string): string {
  return `entity:${entity}`;
}

function fileNodeId(path: string): string {
  return `file:${path}`;
}

export function buildGraphFromIndex(
  files: Pick<FileEntry, "path" | "format" | "name">[],
  entities: Record<string, CrossReference>,
): GraphData {
  const nodesMap = new Map<string, GdlGraphNode>();
  const edges: GdlGraphEdge[] = [];
  const seenEdges = new Set<string>();

  function addNode(node: GdlGraphNode): void {
    if (!nodesMap.has(node.id)) nodesMap.set(node.id, node);
  }

  function addEdge(edge: GdlGraphEdge): void {
    const key = `${edge.source}→${edge.target}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      edges.push(edge);
    }
  }

  // Create file nodes
  for (const file of files) {
    addNode({
      id: fileNodeId(file.path),
      label: file.name,
      type: "document",
      metadata: { path: file.path, format: file.format },
    });
  }

  // Create entity nodes and edges
  for (const [name, crossRef] of Object.entries(entities)) {
    const occs = crossRef.occurrences;
    if (occs.length === 0) continue;

    const nodeType = primaryType(occs);
    const id = entityNodeId(name);

    // Collect metadata from first occurrence
    const primaryOcc = occs[0]!;
    addNode({
      id,
      label: name,
      type: nodeType,
      metadata: {
        role: primaryOcc.role,
        format: primaryOcc.format,
        sourceFile: primaryOcc.file,
        occurrenceCount: String(occs.length),
      },
    });

    // Edge: entity → file (for each file it appears in)
    const entityFiles = new Set(occs.map(o => o.file));
    for (const filePath of entityFiles) {
      addEdge({
        source: id,
        target: fileNodeId(filePath),
        label: "in",
        type: "containment",
      });
    }

    // Cross-layer edges: if entity appears in 2+ formats
    const formats = [...new Set(occs.map(o => o.format))];
    if (formats.length >= 2) {
      // Create edges between the entity and each additional format's file
      // This visually shows cross-layer connections
      for (let i = 0; i < formats.length; i++) {
        for (let j = i + 1; j < formats.length; j++) {
          const fileA = occs.find(o => o.format === formats[i])!.file;
          const fileB = occs.find(o => o.format === formats[j])!.file;
          if (fileA !== fileB) {
            addEdge({
              source: fileNodeId(fileA),
              target: fileNodeId(fileB),
              label: `${formats[i]}↔${formats[j]}`,
              type: "cross-layer",
            });
          }
        }
      }
    }
  }

  // Build relationship edges from source→target patterns
  // Find entities with relationship_source role and link to entities with relationship_target
  // that appear on the same line/context
  const relationshipSources = new Map<string, Set<string>>(); // file → entity names
  const relationshipTargets = new Map<string, Set<string>>(); // file → entity names
  for (const [name, crossRef] of Object.entries(entities)) {
    for (const occ of crossRef.occurrences) {
      if (occ.role === "relationship_source") {
        if (!relationshipSources.has(occ.file)) relationshipSources.set(occ.file, new Set());
        relationshipSources.get(occ.file)!.add(name);
      }
      if (occ.role === "relationship_target") {
        if (!relationshipTargets.has(occ.file)) relationshipTargets.set(occ.file, new Set());
        relationshipTargets.get(occ.file)!.add(name);
      }
    }
  }

  // Link sources to targets within same file
  for (const [file, sources] of relationshipSources) {
    const targets = relationshipTargets.get(file);
    if (!targets) continue;
    for (const src of sources) {
      for (const tgt of targets) {
        if (src !== tgt) {
          addEdge({
            source: entityNodeId(src),
            target: entityNodeId(tgt),
            label: "relates",
            type: "relationship",
          });
        }
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: edges.filter(e => nodesMap.has(e.source) && nodesMap.has(e.target)),
    stats: {
      fileCount: files.length,
      entityCount: Object.keys(entities).length,
      crossRefCount: Object.values(entities).filter(
        cr => new Set(cr.occurrences.map(o => o.format)).size >= 2
      ).length,
    },
  };
}
