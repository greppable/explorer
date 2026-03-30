import { describe, it, expect } from "vitest";
import { walkRepo } from "../walker";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../tests/fixtures");

describe("walkRepo", () => {
  it("finds GDL files in cross-layer fixtures", async () => {
    const tree = await walkRepo(path.join(FIXTURES, "cross-layer"));
    expect(tree.stats.totalFiles).toBe(7);
    expect(tree.stats.byFormat.gdl).toBe(1);
    expect(tree.stats.byFormat.gdls).toBe(1);
    expect(tree.stats.byFormat.gdld).toBe(1);
    expect(tree.stats.byFormat.gdlm).toBe(2);
    expect(tree.stats.byFormat.gdlu).toBe(1);
    expect(tree.stats.byFormat.gdla).toBe(1);
  });

  it("returns files grouped by format", async () => {
    const tree = await walkRepo(path.join(FIXTURES, "cross-layer"));
    expect(tree.byFormat.gdls).toHaveLength(1);
    expect(tree.byFormat.gdls[0].name).toBe("finance");
  });

  it("finds files recursively", async () => {
    const tree = await walkRepo(FIXTURES);
    // Should find cross-layer files nested in subdirectory
    const gdlmFiles = tree.byFormat.gdlm;
    expect(gdlmFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores non-GDL files", async () => {
    const tree = await walkRepo(FIXTURES);
    const allPaths = tree.files.map((f) => f.path);
    // Should not include .json, .jsonl, .md files
    expect(allPaths.every((p) => /\.(gdl|gdls|gdld|gdlm|gdlc|gdlu|gdla)$/.test(p))).toBe(true);
  });

  it("handles empty directories", async () => {
    const tree = await walkRepo("/tmp/nonexistent-gdl-dir-12345");
    expect(tree.stats.totalFiles).toBe(0);
  });
});

describe("walkRepo enrichment detection", () => {
  const MERGE_FIXTURES = path.join(FIXTURES, "merge");

  it("detects .enrich.gdlc files as enrichment with isEnrichment flag", async () => {
    const tree = await walkRepo(MERGE_FIXTURES);
    const enrichFiles = tree.files.filter((f) => f.isEnrichment);
    expect(enrichFiles.length).toBeGreaterThanOrEqual(1);
    // All enrichment files should have isEnrichment set
    for (const f of enrichFiles) {
      expect(f.isEnrichment).toBe(true);
    }
  });

  it("strips .enrich from name property of enrichment files", async () => {
    const tree = await walkRepo(MERGE_FIXTURES);
    const enrichFile = tree.files.find((f) => f.isEnrichment && f.path.includes("parsers.enrich"));
    expect(enrichFile).toBeDefined();
    expect(enrichFile!.name).toBe("parsers");
  });

  it("groups enrichment files under their base format", async () => {
    const tree = await walkRepo(MERGE_FIXTURES);
    // parsers.enrich.gdlc should be in the gdlc group
    const gdlcFiles = tree.byFormat.gdlc;
    const enrichInGdlc = gdlcFiles.filter((f) => f.isEnrichment);
    expect(enrichInGdlc.length).toBeGreaterThanOrEqual(1);
  });

  it("pairs enrichment files with skeleton files", async () => {
    const tree = await walkRepo(MERGE_FIXTURES);
    const skeleton = tree.files.find((f) => f.path === "parsers.gdlc");
    const enrichment = tree.files.find((f) => f.path === "parsers.enrich.gdlc");
    expect(skeleton).toBeDefined();
    expect(enrichment).toBeDefined();
    // Skeleton should reference its enrichment
    expect(skeleton!.enrichmentPath).toBe("parsers.enrich.gdlc");
    // Enrichment should reference its skeleton
    expect(enrichment!.skeletonPath).toBe("parsers.gdlc");
  });

  it("leaves standalone files without enrichment metadata", async () => {
    const tree = await walkRepo(MERGE_FIXTURES);
    const orphanEnrich = tree.files.find((f) => f.path === "orphan.enrich.gdlc");
    expect(orphanEnrich).toBeDefined();
    expect(orphanEnrich!.isEnrichment).toBe(true);
    // orphan.enrich.gdlc has no matching orphan.gdlc skeleton
    expect(orphanEnrich!.skeletonPath).toBeUndefined();
  });

  it("non-enrichment files have isEnrichment undefined", async () => {
    const tree = await walkRepo(MERGE_FIXTURES);
    const skeleton = tree.files.find((f) => f.path === "parsers.gdlc");
    expect(skeleton).toBeDefined();
    expect(skeleton!.isEnrichment).toBeUndefined();
  });
});
