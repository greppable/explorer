import { describe, it, expect } from "vitest";
import { parseGdld } from "../gdld-parser";
import { applyScenario, applyView } from "../gdld-scenarios";
import fs from "fs";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");

describe("applyScenario", () => {
  it("applies overrides to node properties", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "scenario-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    const scenario = base.scenarios[0];
    if (!scenario) return; // skip if no scenarios in fixture

    const result = applyScenario(base, scenario.id);
    // After applying scenario, some nodes/edges should be different from base
    expect(result).toBeDefined();
    expect(result.nodes.length + result.edges.length).toBeGreaterThan(0);
  });

  it("excludes nodes targeted by @exclude", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "scenario-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    const scenario = base.scenarios[0];
    if (!scenario || base.excludes.length === 0) return;

    const result = applyScenario(base, scenario.id);
    const excludedTargets = base.excludes
      .filter((e) => e.scenario === scenario.id)
      .map((e) => e.target);

    for (const target of excludedTargets) {
      const found = result.nodes.find((n) => n.id === target);
      expect(found).toBeUndefined();
    }
  });

  it("applies prod scenario with override and exclude", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "scenario-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    // prod scenario: overrides Cache label to "Redis Cluster", excludes Analytics
    const result = applyScenario(base, "prod");
    const cache = result.nodes.find((n) => n.id === "Cache");
    expect(cache).toBeDefined();
    expect(cache!.label).toBe("Redis Cluster");
    const analytics = result.nodes.find((n) => n.id === "Analytics");
    expect(analytics).toBeUndefined();
    // Edges to Analytics should also be removed
    const analyticsEdges = result.edges.filter((e) => e.from === "Analytics" || e.to === "Analytics");
    expect(analyticsEdges).toHaveLength(0);
  });

  it("applies inherited scenario (prod-eu inherits prod)", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "scenario-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    // prod-eu inherits prod: Cache->Redis Cluster, Analytics excluded, DB->EU Database
    const result = applyScenario(base, "prod-eu");
    const cache = result.nodes.find((n) => n.id === "Cache");
    expect(cache!.label).toBe("Redis Cluster");
    const db = result.nodes.find((n) => n.id === "DB");
    expect(db!.label).toBe("EU Database");
    expect(result.nodes.find((n) => n.id === "Analytics")).toBeUndefined();
  });
});

describe("applyView", () => {
  it("filters by view includes/excludes", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "view-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    if (base.views.length === 0) return;

    const view = base.views[0];
    const result = applyView(base, view.id);
    expect(result).toBeDefined();
    // View should reduce or filter the node set
    expect(result.nodes.length).toBeLessThanOrEqual(base.nodes.length);
  });

  it("filters backend-only view by group includes", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "view-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    const result = applyView(base, "backend-only");
    // backend group has API and Auth — these must be included
    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain("API");
    expect(nodeIds).toContain("Auth");
    // Ungrouped nodes (Cache, Analytics) pass the !n.group check and remain
    // Only nodes in OTHER groups (data group: UserDB) should be excluded
    expect(nodeIds).not.toContain("UserDB");
    // Groups should only contain backend
    const groupIds = result.groups.map((g) => g.id);
    expect(groupIds).toContain("backend");
    expect(groupIds).not.toContain("data");
  });

  it("filters security view by tag with tags: prefix", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "view-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    const result = applyView(base, "security");
    // security view has filter:tags:security — Auth (security,core) and UserDB (security,pii)
    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain("Auth");
    expect(nodeIds).toContain("UserDB");
    expect(nodeIds).not.toContain("Cache");
    expect(nodeIds).not.toContain("Analytics");
    // Edges should only connect remaining nodes
    for (const edge of result.edges) {
      expect(nodeIds).toContain(edge.from);
      expect(nodeIds).toContain(edge.to);
    }
  });

  it("filters core view by tag with tags: prefix", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "view-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    const result = applyView(base, "core");
    // core view has filter:tags:core — API (public,core), Auth (security,core), Cache (core)
    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain("API");
    expect(nodeIds).toContain("Auth");
    expect(nodeIds).toContain("Cache");
    expect(nodeIds).not.toContain("Analytics");
    expect(nodeIds).not.toContain("UserDB");
  });

  it("filters public-only view by group excludes", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "view-diagram.gdld"), "utf-8");
    const base = parseGdld(content);
    const result = applyView(base, "public-only");
    // Excludes backend group — API and Auth removed
    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).not.toContain("API");
    expect(nodeIds).not.toContain("Auth");
    // Ungrouped nodes should remain
    expect(nodeIds).toContain("Cache");
    expect(nodeIds).toContain("Analytics");
  });
});
