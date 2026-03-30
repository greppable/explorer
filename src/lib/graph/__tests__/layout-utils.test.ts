import { describe, it, expect } from "vitest";
import { applyLayout } from "../layout-utils";

function makeNode(id: string, type: string) {
  return { id, position: { x: 0, y: 0 }, data: { nodeType: type } };
}

describe("applyLayout", () => {
  it("returns empty array for empty input", () => {
    const result = applyLayout("organized", [], []);
    expect(result).toEqual([]);
  });

  it("centers a single node", () => {
    const nodes = [makeNode("a", "schema")];
    const result = applyLayout("organized", nodes, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.position.x).toBeGreaterThan(0);
  });

  it("groups nodes by type in organized mode", () => {
    const nodes = [
      makeNode("a", "schema"),
      makeNode("b", "schema"),
      makeNode("c", "code"),
    ];
    const result = applyLayout("organized", nodes, []);
    // Same-type nodes should have the same y position (same row)
    const aPos = result.find(n => n.id === "a")!.position;
    const bPos = result.find(n => n.id === "b")!.position;
    const cPos = result.find(n => n.id === "c")!.position;
    expect(aPos.y).toBe(bPos.y);
    expect(cPos.y).not.toBe(aPos.y);
  });

  it("separates nodes in force mode", () => {
    const nodes = [
      makeNode("a", "schema"),
      makeNode("b", "code"),
    ];
    const edges = [{ source: "a", target: "b" }];
    const result = applyLayout("force", nodes, edges, { iterations: 50 });
    const aPos = result.find(n => n.id === "a")!.position;
    const bPos = result.find(n => n.id === "b")!.position;
    // They should not be at the exact same position
    expect(aPos.x !== bPos.x || aPos.y !== bPos.y).toBe(true);
  });
});
