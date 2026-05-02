import { describe, it, expect } from "vitest";
import {
  CLUSTER_PREFIX,
  CLUSTER_THRESHOLD,
  buildClusters,
  expandClusters,
  shouldCluster,
} from "../clustering";
import type { GraphData } from "../types";

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

const SMALL_GRAPH: GraphData = {
  nodes: [
    entity("Customer", "schema"),
    entity("Order", "schema"),
    file("schema.gdls", "gdls"),
  ],
  edges: [
    { source: "entity:Customer", target: "file:schema.gdls", label: "in" },
    { source: "entity:Order", target: "file:schema.gdls", label: "in" },
  ],
  stats: { fileCount: 1, entityCount: 2, crossRefCount: 0 },
};

function bigGraph(): GraphData {
  const nodes: GraphData["nodes"] = [];
  for (let i = 0; i < 120; i++) nodes.push(entity(`s${i}`, "schema"));
  for (let i = 0; i < 90; i++) nodes.push(entity(`m${i}`, "memory"));
  nodes.push(file("schema.gdls", "gdls"));
  nodes.push(file("memory.gdlm", "gdlm"));
  const edges: GraphData["edges"] = [];
  for (let i = 0; i < 120; i++) {
    edges.push({ source: `entity:s${i}`, target: "file:schema.gdls", label: "in" });
  }
  for (let i = 0; i < 90; i++) {
    edges.push({ source: `entity:m${i}`, target: "file:memory.gdlm", label: "in" });
  }
  // 5 cross-layer edges between schema and memory entities
  for (let i = 0; i < 5; i++) {
    edges.push({ source: `entity:s${i}`, target: `entity:m${i}`, label: "relates" });
  }
  return { nodes, edges, stats: { fileCount: 2, entityCount: 210, crossRefCount: 5 } };
}

describe("shouldCluster", () => {
  it("returns false for a small graph", () => {
    expect(shouldCluster(SMALL_GRAPH)).toBe(false);
  });
  it("returns true once entity count meets the threshold", () => {
    expect(shouldCluster(bigGraph())).toBe(true);
    expect(CLUSTER_THRESHOLD).toBeGreaterThan(0);
  });
});

describe("buildClusters", () => {
  it("groups entities and files by their layer (files inherit their format's layer)", () => {
    const result = buildClusters(SMALL_GRAPH);
    const schemaCluster = result.clusters.find((c) => c.layer === "schema");
    expect(schemaCluster).toBeDefined();
    // 2 schema entities AND the .gdls file all live in the schema cluster
    expect(schemaCluster!.entityCount).toBe(2);
    expect(schemaCluster!.fileCount).toBe(1);
    // No standalone document cluster — the .gdls file is a schema file
    expect(result.clusters.find((c) => c.layer === "document")).toBeUndefined();
  });

  it("aggregates edges between clusters with weights", () => {
    const result = buildClusters(bigGraph());
    const schemaToMemory = result.clusterEdges.find(
      (e) =>
        (e.source.endsWith("schema") && e.target.endsWith("memory")) ||
        (e.source.endsWith("memory") && e.target.endsWith("schema")),
    );
    // 5 cross-layer entity edges + N file-to-cluster aggregations
    expect(schemaToMemory).toBeDefined();
    expect(schemaToMemory!.weight).toBeGreaterThanOrEqual(5);
  });

  it("populates membership for every clusterable node", () => {
    const result = buildClusters(SMALL_GRAPH);
    for (const node of SMALL_GRAPH.nodes) {
      expect(result.membership.get(node.id)).toBeDefined();
    }
  });
});

describe("expandClusters", () => {
  it("returns one supernode per cluster when nothing is expanded", () => {
    const clustered = buildClusters(bigGraph());
    const view = expandClusters(bigGraph(), clustered, new Set());
    const clusterNodes = view.nodes.filter((n) => n.id.startsWith(CLUSTER_PREFIX));
    const memberNodes = view.nodes.filter((n) => !n.id.startsWith(CLUSTER_PREFIX));
    expect(clusterNodes.length).toBe(clustered.clusters.length);
    expect(memberNodes.length).toBe(0);
  });

  it("replaces a cluster with its members when expanded", () => {
    const g = bigGraph();
    const clustered = buildClusters(g);
    const schemaClusterId = clustered.clusters.find((c) => c.layer === "schema")!.id;
    const view = expandClusters(g, clustered, new Set([schemaClusterId]));
    const hasSchemaCluster = view.nodes.some((n) => n.id === schemaClusterId);
    const schemaEntities = view.nodes.filter((n) => n.id.startsWith("entity:s"));
    expect(hasSchemaCluster).toBe(false);
    expect(schemaEntities.length).toBe(120);
  });

  it("emits aggregate edges between collapsed clusters", () => {
    const g = bigGraph();
    const clustered = buildClusters(g);
    const view = expandClusters(g, clustered, new Set());
    const aggregateEdges = view.edges.filter((e) => e.type === "cluster-aggregate");
    expect(aggregateEdges.length).toBeGreaterThan(0);
  });
});
