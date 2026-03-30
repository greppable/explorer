import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseGdlc } from "../../parsers/gdlc-parser";
import { mergeGdlc } from "../gdlc-merge";
import { resolveOverlayPath } from "../resolve-overlay";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures/merge");

describe("resolveOverlayPath", () => {
  it("converts skeleton path to enrichment overlay path", () => {
    expect(resolveOverlayPath("parsers.gdlc")).toBe("parsers.enrich.gdlc");
    expect(resolveOverlayPath("dir/schema.gdls")).toBe("dir/schema.enrich.gdls");
    expect(resolveOverlayPath("docs.gdlu")).toBe("docs.enrich.gdlu");
  });
});

describe("mergeGdlc", () => {
  const skeletonContent = fs.readFileSync(path.join(FIXTURES, "parsers.gdlc"), "utf-8");
  const overlayContent = fs.readFileSync(path.join(FIXTURES, "parsers.enrich.gdlc"), "utf-8");
  const skeleton = parseGdlc(skeletonContent);
  const overlay = parseGdlc(overlayContent);

  it("fills @D package description from overlay", () => {
    const { merged } = mergeGdlc(skeleton, overlay, "parsers.gdlc", "parsers.enrich.gdlc");
    const pkg = merged.packages.find((p) => p.name === "src/lib/parsers");
    expect(pkg?.description).toBe("Parser modules for GDL format family");
  });

  it("fills @T module description from overlay", () => {
    const { merged } = mergeGdlc(skeleton, overlay, "parsers.gdlc", "parsers.enrich.gdlc");
    const mod = merged.modules.find((m) => m.name === "GdlsParser");
    expect(mod?.description).toBe("Parses GDLS schema files into structured types");
  });

  it("fills member description from overlay", () => {
    const { merged } = mergeGdlc(skeleton, overlay, "parsers.gdlc", "parsers.enrich.gdlc");
    const mod = merged.modules.find((m) => m.name === "GdlsParser");
    const member = mod?.members.find((m) => m.name === "parseGdlsFile");
    expect(member?.description).toBe("Main entry point for GDLS parsing");
  });

  it("keeps member empty description when no overlay match", () => {
    const { merged } = mergeGdlc(skeleton, overlay, "parsers.gdlc", "parsers.enrich.gdlc");
    const mod = merged.modules.find((m) => m.name === "GdlsParser");
    const member = mod?.members.find((m) => m.name === "normalizeType");
    expect(member?.description).toBe("");
  });

  it("appends overlay-only @PATH records", () => {
    const { merged, provenance } = mergeGdlc(skeleton, overlay, "parsers.gdlc", "parsers.enrich.gdlc");
    const agentPath = merged.paths.find((p) => p.description === "Schema parse flow");
    expect(agentPath).toBeDefined();
    expect(provenance.appendedRecords).toBeGreaterThan(0);
  });

  it("appends overlay-only @R (calls) records", () => {
    const { merged } = mergeGdlc(skeleton, overlay, "parsers.gdlc", "parsers.enrich.gdlc");
    const callRel = merged.relationships.find(
      (r) => r.source === "GdlsParser.parseColumn" && r.target === "GdlsParser.normalizeType"
    );
    expect(callRel).toBeDefined();
    expect(callRel!.relType).toBe("calls");
  });

  it("preserves skeleton @R records", () => {
    const { merged } = mergeGdlc(skeleton, overlay, "parsers.gdlc", "parsers.enrich.gdlc");
    const returns = merged.relationships.find(
      (r) => r.source === "GdlsParser" && r.target === "GdlsFile" && r.relType === "returns"
    );
    expect(returns).toBeDefined();
  });

  it("detects orphaned @T in overlay", () => {
    const orphanContent = fs.readFileSync(path.join(FIXTURES, "orphan.enrich.gdlc"), "utf-8");
    const orphanOverlay = parseGdlc(orphanContent);
    const { provenance } = mergeGdlc(skeleton, orphanOverlay, "parsers.gdlc", "orphan.enrich.gdlc");
    const typeOrphan = provenance.orphans.find((o) => o.type === "@T" && o.name === "DeletedModule");
    expect(typeOrphan).toBeDefined();
  });

  it("detects orphaned member in overlay", () => {
    const orphanContent = fs.readFileSync(path.join(FIXTURES, "orphan.enrich.gdlc"), "utf-8");
    const orphanOverlay = parseGdlc(orphanContent);
    const { provenance } = mergeGdlc(skeleton, orphanOverlay, "parsers.gdlc", "orphan.enrich.gdlc");
    const memberOrphan = provenance.orphans.find((o) => o.type === "member" && o.name === "deletedFunction");
    expect(memberOrphan).toBeDefined();
  });

  it("returns skeleton unchanged when no overlay matches", () => {
    const emptyOverlay = parseGdlc("@D nonexistent|Nothing");
    const { merged, provenance } = mergeGdlc(skeleton, emptyOverlay, "parsers.gdlc", "empty.enrich.gdlc");
    expect(provenance.fillCount).toBe(0);
    expect(provenance.appendedRecords).toBe(0);
    expect(merged.packages.map((p) => p.description)).toEqual(skeleton.packages.map((p) => p.description));
  });

  it("tracks provenance metadata correctly", () => {
    const { provenance } = mergeGdlc(skeleton, overlay, "parsers.gdlc", "parsers.enrich.gdlc");
    expect(provenance.skeletonPath).toBe("parsers.gdlc");
    expect(provenance.overlayPath).toBe("parsers.enrich.gdlc");
    expect(provenance.fillCount).toBeGreaterThan(0);
    expect(provenance.skeletonVersion).toBeDefined();
    expect(provenance.overlayVersion).toBeDefined();
  });

  it("skeleton wins: non-empty skeleton descriptions are preserved over overlay", () => {
    // Create skeleton with non-empty descriptions at all levels
    // @D format: @D name|description
    // @T format: @T name|description (package is inherited from current @D)
    // member format: name|kind|vis|returnType|params|description
    const skeletonWithDesc = parseGdlc(
      "# @VERSION spec:gdlc v:0.1.0 generated:2026-02-15 source:tree-sitter\n" +
      "@D src/lib/parsers|Skeleton pkg desc\n" +
      "@T GdlsParser|Skeleton module desc\n" +
      "  parseGdlsFile|method|public|GdlsFile||Skeleton member desc"
    );
    const overlayWithDesc = parseGdlc(
      "@D src/lib/parsers|Overlay pkg desc\n" +
      "@T GdlsParser|Overlay module desc\n" +
      "  parseGdlsFile|method|public|GdlsFile||Overlay member desc"
    );
    const { merged, provenance } = mergeGdlc(
      skeletonWithDesc, overlayWithDesc, "test.gdlc", "test.enrich.gdlc"
    );
    // Skeleton descriptions must win — overlay should NOT overwrite
    expect(merged.packages[0].description).toBe("Skeleton pkg desc");
    expect(merged.modules[0].description).toBe("Skeleton module desc");
    expect(merged.modules[0].members[0].description).toBe("Skeleton member desc");
    expect(provenance.fillCount).toBe(0);
  });

  it("deduplicates @R records by source->target|relType key", () => {
    // Create skeleton with an existing @R record
    const skeletonWithRel = parseGdlc(
      "@D src/lib|Test pkg\n" +
      "@T ModA|src/lib|Module A\n" +
      "@R ModA->ModB|uses|Existing rel"
    );
    const overlayWithDupRel = parseGdlc(
      "@D src/lib|Test pkg\n" +
      "@T ModA|src/lib|Module A\n" +
      "@R ModA->ModB|uses|Duplicate rel from overlay\n" +
      "@R ModA->ModC|calls|New rel from overlay"
    );
    const { merged, provenance } = mergeGdlc(
      skeletonWithRel, overlayWithDupRel, "test.gdlc", "test.enrich.gdlc"
    );
    // Should have original + only the new one (not the duplicate)
    const modAtoModB = merged.relationships.filter(
      (r) => r.source === "ModA" && r.target === "ModB" && r.relType === "uses"
    );
    expect(modAtoModB).toHaveLength(1);
    expect(modAtoModB[0].description).toBe("Existing rel");
    // New rel should be appended
    const modAtoModC = merged.relationships.find(
      (r) => r.source === "ModA" && r.target === "ModC"
    );
    expect(modAtoModC).toBeDefined();
    expect(provenance.appendedRecords).toBe(1);
  });
});
