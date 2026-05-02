import { describe, it, expect } from "vitest";
import { pickRecentSubgraph } from "../recent";
import type { GraphData } from "../types";
import type { TimelineEvent } from "../../timeline/types";

function entity(name: string, type: GraphData["nodes"][number]["type"]) {
  return { id: `entity:${name}`, label: name, type, metadata: {} };
}
function file(path: string, format: string) {
  return {
    id: `file:${path}`,
    label: path.split("/").pop() ?? path,
    type: "document" as const,
    metadata: { path, format },
  };
}
function evt(date: string, entities: string[], filePath: string): TimelineEvent {
  return {
    id: `evt:${date}:${entities[0] ?? "anon"}`,
    date,
    layer: "memory",
    format: "gdlm",
    type: "decision",
    title: "test",
    tags: [],
    entities,
    file: filePath,
    significance: 0.5,
  };
}

// Each entity lives in its own file so file-recency and entity-recency are
// independently testable.
const GRAPH: GraphData = {
  nodes: [
    entity("Alpha", "memory"),
    entity("Beta", "memory"),
    entity("Gamma", "memory"),
    entity("Stale", "schema"),
    file("alpha.gdlm", "gdlm"),
    file("beta.gdlm", "gdlm"),
    file("gamma.gdlm", "gdlm"),
    file("stale.gdls", "gdls"),
  ],
  edges: [
    { source: "entity:Alpha", target: "file:alpha.gdlm", label: "in" },
    { source: "entity:Beta", target: "file:beta.gdlm", label: "in" },
    { source: "entity:Gamma", target: "file:gamma.gdlm", label: "in" },
    { source: "entity:Stale", target: "file:stale.gdls", label: "in" },
    { source: "entity:Alpha", target: "entity:Beta", label: "relates" },
  ],
  stats: { fileCount: 4, entityCount: 4, crossRefCount: 0 },
};

describe("pickRecentSubgraph", () => {
  it("keeps the N most-recently-mentioned entities", () => {
    const events: TimelineEvent[] = [
      evt("2026-01-01T10:00:00Z", ["Alpha"], "alpha.gdlm"),
      evt("2026-04-01T10:00:00Z", ["Beta"], "beta.gdlm"),
      evt("2026-05-01T10:00:00Z", ["Gamma"], "gamma.gdlm"),
      // Stale never appears in events → score 0
    ];
    const result = pickRecentSubgraph(GRAPH, events, 2);
    const labels = result.nodes.filter((n) => n.id.startsWith("entity:")).map((n) => n.label).sort();
    expect(labels).toEqual(["Beta", "Gamma"]);
    expect(result.nodes.find((n) => n.label === "Stale")).toBeUndefined();
  });

  it("includes the file containing each visible entity", () => {
    const events: TimelineEvent[] = [
      evt("2026-05-01T10:00:00Z", ["Alpha"], "alpha.gdlm"),
    ];
    const result = pickRecentSubgraph(GRAPH, events, 1);
    expect(result.nodes.some((n) => n.id === "file:alpha.gdlm")).toBe(true);
  });

  it("returns the full graph when limit exceeds entity count", () => {
    const events: TimelineEvent[] = [
      evt("2026-05-01T10:00:00Z", ["Alpha", "Beta", "Gamma", "Stale"], "alpha.gdlm"),
    ];
    const result = pickRecentSubgraph(GRAPH, events, 100);
    expect(result.nodes.length).toBe(GRAPH.nodes.length);
    expect(result.edges.length).toBe(GRAPH.edges.length);
  });

  it("entities inherit their file's recency when not directly mentioned", () => {
    // No entity is mentioned by name; only the file is touched. The entity in
    // that file should still score above the entirely-untouched ones.
    const events: TimelineEvent[] = [
      evt("2026-05-01T10:00:00Z", [], "gamma.gdlm"),
    ];
    const result = pickRecentSubgraph(GRAPH, events, 1);
    const labels = result.nodes.filter((n) => n.id.startsWith("entity:")).map((n) => n.label);
    expect(labels).toEqual(["Gamma"]);
  });
});
