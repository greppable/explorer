import { describe, it, expect } from "vitest";
import { buildIndex } from "../indexer";
import path from "path";

const CROSS_LAYER = path.resolve(__dirname, "../../../tests/fixtures/cross-layer");

describe("buildIndex", () => {
  it("finds entities across multiple layers", async () => {
    const index = await buildIndex(CROSS_LAYER);
    const glAccount = index.entities.get("GL_ACCOUNT");
    expect(glAccount).toBeDefined();
    expect(glAccount!.occurrences.length).toBeGreaterThanOrEqual(5);
  });

  it("tracks which formats each entity appears in", async () => {
    const index = await buildIndex(CROSS_LAYER);
    const glAccount = index.entities.get("GL_ACCOUNT");
    const formats = new Set(glAccount!.occurrences.map((o) => o.format));
    expect(formats.has("gdl")).toBe(true);
    expect(formats.has("gdls")).toBe(true);
    expect(formats.has("gdld")).toBe(true);
    expect(formats.has("gdlm")).toBe(true);
    expect(formats.has("gdlu")).toBe(true);
  });

  it("computes cross-ref count (entities in 2+ formats)", async () => {
    const index = await buildIndex(CROSS_LAYER);
    expect(index.stats.crossRefCount).toBeGreaterThanOrEqual(1);
  });

  it("includes file entries", async () => {
    const index = await buildIndex(CROSS_LAYER);
    expect(index.files).toHaveLength(7);
  });
});
