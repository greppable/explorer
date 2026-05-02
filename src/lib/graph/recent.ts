import type { GraphData, GdlGraphNode, GdlGraphEdge } from "./types";
import type { TimelineEvent } from "../timeline/types";

/**
 * Default cap for "Recent" graph mode — sized so ReactFlow renders smoothly
 * (entities + their files + edges all fit comfortably under our perf ceiling).
 */
export const RECENT_LIMIT = 250;

const ENTITY_PREFIX = "entity:";
const FILE_PREFIX = "file:";

/**
 * Build a map from entity name to the most recent timestamp (ms) any timeline
 * event mentioned it. Entities never seen in the timeline are absent from
 * the map; callers should treat that as "oldest, lowest priority".
 */
export function entityLastSeenTimestamps(events: TimelineEvent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const evt of events) {
    const t = Date.parse(evt.date);
    if (Number.isNaN(t)) continue;
    for (const ent of evt.entities) {
      if (!ent) continue;
      const prev = map.get(ent) ?? 0;
      if (t > prev) map.set(ent, t);
    }
  }
  return map;
}

/**
 * Build a map from file path to the most recent timestamp (ms) any timeline
 * event referenced that file. Used as a fallback signal for entities that
 * aren't directly mentioned in the timeline.
 */
export function fileLastSeenTimestamps(events: TimelineEvent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const evt of events) {
    if (!evt.file) continue;
    const t = Date.parse(evt.date);
    if (Number.isNaN(t)) continue;
    const prev = map.get(evt.file) ?? 0;
    if (t > prev) map.set(evt.file, t);
  }
  return map;
}

/**
 * Score every entity in the graph by recency. Entity score = max(timestamp from
 * direct timeline mentions, timestamp of newest file the entity appears in).
 * Returns the top `limit` entities + every file that contains at least one of
 * them, plus all edges among them. The result is a valid GraphData subset.
 */
export function pickRecentSubgraph(
  graph: GraphData,
  events: TimelineEvent[],
  limit: number = RECENT_LIMIT,
): GraphData {
  if (graph.nodes.length === 0) return graph;

  const entityTs = entityLastSeenTimestamps(events);
  const fileTs = fileLastSeenTimestamps(events);

  // Build a quick "files for entity" index from the existing graph edges.
  // Edges between entity and file carry label "in" (containment).
  const filesForEntity = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (
      edge.source.startsWith(ENTITY_PREFIX) &&
      edge.target.startsWith(FILE_PREFIX)
    ) {
      const set = filesForEntity.get(edge.source) ?? new Set<string>();
      set.add(edge.target.slice(FILE_PREFIX.length));
      filesForEntity.set(edge.source, set);
    }
  }

  function scoreEntity(node: GdlGraphNode): number {
    let best = entityTs.get(node.label) ?? 0;
    const files = filesForEntity.get(node.id);
    if (files) {
      for (const f of files) {
        const t = fileTs.get(f) ?? 0;
        if (t > best) best = t;
      }
    }
    return best;
  }

  // Rank entities, take top `limit`. Tiebreak by label for determinism.
  const entityNodes = graph.nodes.filter((n) => n.id.startsWith(ENTITY_PREFIX));
  const scored = entityNodes
    .map((node) => ({ node, score: scoreEntity(node) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.node.label.localeCompare(b.node.label);
    });
  const visibleEntityIds = new Set(scored.slice(0, limit).map((s) => s.node.id));

  // Include any file that touches a visible entity (preserves the
  // entity-to-file structure that makes the graph "look cool")
  const visibleFileIds = new Set<string>();
  for (const edge of graph.edges) {
    if (visibleEntityIds.has(edge.source) && edge.target.startsWith(FILE_PREFIX)) {
      visibleFileIds.add(edge.target);
    }
    if (visibleEntityIds.has(edge.target) && edge.source.startsWith(FILE_PREFIX)) {
      visibleFileIds.add(edge.source);
    }
  }

  const visibleNodes: GdlGraphNode[] = graph.nodes.filter(
    (n) => visibleEntityIds.has(n.id) || visibleFileIds.has(n.id),
  );
  const allVisibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges: GdlGraphEdge[] = graph.edges.filter(
    (e) => allVisibleIds.has(e.source) && allVisibleIds.has(e.target),
  );

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    stats: {
      fileCount: graph.stats.fileCount,
      entityCount: visibleEntityIds.size,
      crossRefCount: graph.stats.crossRefCount,
    },
  };
}
