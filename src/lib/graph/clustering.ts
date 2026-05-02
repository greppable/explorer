import type { GdlGraphNode, GdlGraphEdge, GraphData, GraphNodeType } from "./types";

/**
 * Threshold (entity count) above which the graph defaults to clustered view.
 * Tuneable single source of truth — the only place the magic number lives.
 */
export const CLUSTER_THRESHOLD = 200;

export const CLUSTER_PREFIX = "cluster:";
const FILE_PREFIX = "file:";
const ENTITY_PREFIX = "entity:";

/** Cluster supernode produced by buildClusters. */
export interface ClusterNode {
  id: string;            // "cluster:<layer>"
  layer: GraphNodeType;  // schema, code, memory, ...
  label: string;         // Human label (e.g. "Schema")
  entityCount: number;
  fileCount: number;
  memberIds: Set<string>;  // ids of original nodes belonging to this cluster
}

/** Aggregated edge between two clusters. */
export interface ClusterEdge {
  source: string;   // cluster id
  target: string;   // cluster id
  weight: number;   // count of underlying edges aggregated
}

export interface ClusteredGraph {
  clusters: ClusterNode[];
  clusterEdges: ClusterEdge[];
  /** Node id → cluster id, for any clusterable node (entity or file). */
  membership: Map<string, string>;
}

const LAYER_LABELS: Record<GraphNodeType, string> = {
  schema: "Schema",
  api: "API",
  code: "Code",
  diagram: "Diagrams",
  memory: "Memory",
  data: "Data",
  document: "Documents",
};

/**
 * Map a graph node to its layer/format. Entity nodes carry the layer in
 * `node.type`. File nodes are typed as "document" but store the actual format
 * in `metadata.format` — use that so files cluster with their layer.
 */
function nodeLayer(node: GdlGraphNode): GraphNodeType {
  if (node.id.startsWith(FILE_PREFIX)) {
    const fmt = node.metadata?.["format"];
    if (fmt) return formatToLayer(fmt);
  }
  return node.type;
}

function formatToLayer(format: string): GraphNodeType {
  switch (format) {
    case "gdls": return "schema";
    case "gdlc": return "code";
    case "gdld": return "diagram";
    case "gdlm": return "memory";
    case "gdla": return "api";
    case "gdlu": return "document";
    case "gdl":  return "data";
    default:     return "document";
  }
}

/**
 * Decide whether a graph is large enough to merit clustering.
 * Counts entity nodes only — file nodes are infrastructure.
 */
export function shouldCluster(
  graph: GraphData,
  threshold: number = CLUSTER_THRESHOLD,
): boolean {
  let entityCount = 0;
  for (const n of graph.nodes) {
    if (n.id.startsWith(ENTITY_PREFIX)) entityCount += 1;
  }
  return entityCount >= threshold;
}

/**
 * Group all nodes by layer into supernodes and aggregate edges between them.
 * Pure function — no side effects, deterministic ordering.
 */
export function buildClusters(graph: GraphData): ClusteredGraph {
  // Bucket nodes by layer
  const bucket = new Map<GraphNodeType, GdlGraphNode[]>();
  for (const node of graph.nodes) {
    const layer = nodeLayer(node);
    const arr = bucket.get(layer) ?? [];
    arr.push(node);
    bucket.set(layer, arr);
  }

  const membership = new Map<string, string>();
  const clusters: ClusterNode[] = [];
  for (const [layer, members] of bucket) {
    const clusterId = `${CLUSTER_PREFIX}${layer}`;
    const memberIds = new Set<string>();
    let entityCount = 0;
    let fileCount = 0;
    for (const m of members) {
      memberIds.add(m.id);
      membership.set(m.id, clusterId);
      if (m.id.startsWith(ENTITY_PREFIX)) entityCount += 1;
      else if (m.id.startsWith(FILE_PREFIX)) fileCount += 1;
    }
    clusters.push({
      id: clusterId,
      layer,
      label: LAYER_LABELS[layer] ?? layer,
      entityCount,
      fileCount,
      memberIds,
    });
  }

  // Aggregate cross-cluster edges
  const edgeWeights = new Map<string, number>();
  for (const edge of graph.edges) {
    const srcCluster = membership.get(edge.source);
    const tgtCluster = membership.get(edge.target);
    if (!srcCluster || !tgtCluster || srcCluster === tgtCluster) continue;
    // Normalise direction so (A,B) and (B,A) collapse together
    const [a, b] = srcCluster < tgtCluster ? [srcCluster, tgtCluster] : [tgtCluster, srcCluster];
    const key = `${a}→${b}`;
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
  }
  const clusterEdges: ClusterEdge[] = [];
  for (const [key, weight] of edgeWeights) {
    const [source, target] = key.split("→");
    clusterEdges.push({ source, target, weight });
  }

  // Stable ordering: layer-priority for clusters, lexicographic for edges
  clusters.sort((a, b) => a.id.localeCompare(b.id));
  clusterEdges.sort((a, b) => (a.source + a.target).localeCompare(b.source + b.target));

  return { clusters, clusterEdges, membership };
}

/**
 * Compute the visible nodes/edges given a set of expanded clusters.
 * For each expanded cluster, swap the supernode for its constituent nodes;
 * recompute edges accordingly (between expanded entities, between expanded
 * entities and remaining clusters, and between remaining clusters).
 */
export function expandClusters(
  graph: GraphData,
  clustered: ClusteredGraph,
  expanded: Set<string>,
): { nodes: GdlGraphNode[]; edges: GdlGraphEdge[]; clusterPlacement: ClusterNode[] } {
  const { clusters, membership } = clustered;
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n] as const));

  const visibleNodes: GdlGraphNode[] = [];
  const expandedClusterIds = new Set<string>();

  // Walk clusters; expanded → emit member nodes, collapsed → emit one supernode
  for (const cluster of clusters) {
    if (expanded.has(cluster.id)) {
      expandedClusterIds.add(cluster.id);
      for (const memberId of cluster.memberIds) {
        const node = nodesById.get(memberId);
        if (node) visibleNodes.push(node);
      }
    } else {
      // Synthesise a cluster supernode using the GdlGraphNode shape so it
      // round-trips through the existing rendering pipeline.
      visibleNodes.push({
        id: cluster.id,
        label: cluster.label,
        type: cluster.layer,
        metadata: {
          isCluster: "true",
          layer: cluster.layer,
          entityCount: String(cluster.entityCount),
          fileCount: String(cluster.fileCount),
        },
      });
    }
  }

  // Build edges: rewrite each original edge so endpoints in collapsed clusters
  // are replaced by their cluster id. Drop self-loops on a cluster.
  const seenEdges = new Set<string>();
  const aggregatedWeights = new Map<string, number>();
  const visibleEdges: GdlGraphEdge[] = [];
  for (const edge of graph.edges) {
    const srcCluster = membership.get(edge.source);
    const tgtCluster = membership.get(edge.target);
    const srcVisible = srcCluster && expandedClusterIds.has(srcCluster) ? edge.source : srcCluster ?? edge.source;
    const tgtVisible = tgtCluster && expandedClusterIds.has(tgtCluster) ? edge.target : tgtCluster ?? edge.target;
    if (srcVisible === tgtVisible) continue;
    // Edges that touch an expanded entity get rendered individually
    const isAggregateCandidate =
      srcVisible.startsWith(CLUSTER_PREFIX) && tgtVisible.startsWith(CLUSTER_PREFIX);
    if (isAggregateCandidate) {
      const [a, b] = srcVisible < tgtVisible ? [srcVisible, tgtVisible] : [tgtVisible, srcVisible];
      const key = `agg:${a}→${b}`;
      aggregatedWeights.set(key, (aggregatedWeights.get(key) ?? 0) + 1);
    } else {
      const key = `${srcVisible}→${tgtVisible}→${edge.label ?? ""}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        visibleEdges.push({
          source: srcVisible,
          target: tgtVisible,
          label: edge.label,
          type: edge.type,
        });
      }
    }
  }
  for (const [key, weight] of aggregatedWeights) {
    const [, pair] = key.split("agg:");
    const [source, target] = pair.split("→");
    visibleEdges.push({
      source,
      target,
      label: weight > 1 ? String(weight) : undefined,
      type: "cluster-aggregate",
    });
  }

  return { nodes: visibleNodes, edges: visibleEdges, clusterPlacement: clusters };
}
