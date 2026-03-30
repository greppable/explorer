import { describe, it, expect } from "vitest";
import { parseGdlc } from "../gdlc-parser";
import fs from "fs";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");

describe("parseGdlc", () => {
  const content = fs.readFileSync(path.join(FIXTURES, "sample-code.gdlc"), "utf-8");

  it("parses @D package records", () => {
    const result = parseGdlc(content);
    expect(result.packages.length).toBe(2);
    expect(result.packages[0].name).toBe("src/lib/parsers");
    expect(result.packages[0].description).toBe("Parser modules for GDL format family");
  });

  it("parses @T module records", () => {
    const result = parseGdlc(content);
    expect(result.modules.length).toBe(4);
    expect(result.modules[0].name).toBe("GdlsParser");
    expect(result.modules[0].description).toBe("Parses GDLS schema files into structured types");
  });

  it("assigns modules to correct packages", () => {
    const result = parseGdlc(content);
    const viewer = result.modules.find((m) => m.name === "GdlsViewer");
    expect(viewer?.package).toBe("src/components");
  });

  it("parses member lines with 6 positional fields", () => {
    const result = parseGdlc(content);
    const parser = result.modules.find((m) => m.name === "GdlsParser");
    expect(parser?.members.length).toBeGreaterThanOrEqual(5);
    const parseFunc = parser?.members.find((m) => m.name === "parseGdlsFile");
    expect(parseFunc?.kind).toBe("function");
    expect(parseFunc?.visibility).toBe("public");
    expect(parseFunc?.returnType).toBe("GdlsFile");
    expect(parseFunc?.params).toBe("content: string");
    expect(parseFunc?.description).toBe("Main entry point for GDLS parsing");
  });

  it("parses members with empty fields", () => {
    const result = parseGdlc(content);
    const parser = result.modules.find((m) => m.name === "GdlsParser");
    const constant = parser?.members.find((m) => m.name === "TABLE_PATTERN");
    expect(constant?.kind).toBe("const");
    expect(constant?.params).toBe("");
    expect(constant?.description).toBe("Regex matching @T lines");
  });

  it("handles escaped pipes in member fields", () => {
    const result = parseGdlc(content);
    const gdlParser = result.modules.find((m) => m.name === "GdlParser");
    const getField = gdlParser?.members.find((m) => m.name === "getField");
    expect(getField?.returnType).toBe("string | null");
  });

  it("handles escaped pipe in member description", () => {
    const content = [
      "@D root|Root",
      "@T ModA|Module A",
      "init|fn|public|void||does A \\| B",
    ].join("\n");
    const result = parseGdlc(content);
    expect(result.modules[0].members[0].description).toBe("does A | B");
  });

  it("preserves member description containing unescaped pipes", () => {
    const content = [
      "@D root|Root",
      "@T ModA|Module A",
      "init|fn|public|void||does A | B",
    ].join("\n");
    const result = parseGdlc(content);
    expect(result.modules[0].members[0].description).toBe("does A | B");
  });

  it("parses @R relationship records", () => {
    const result = parseGdlc(content);
    expect(result.relationships.length).toBeGreaterThanOrEqual(8);
    const imports = result.relationships.filter((r) => r.relType === "imports");
    expect(imports.length).toBeGreaterThanOrEqual(1);
  });

  it("parses @R relationship types", () => {
    const result = parseGdlc(content);
    const types = new Set(result.relationships.map((r) => r.relType));
    expect(types).toContain("returns");
    expect(types).toContain("depends");
    expect(types).toContain("calls");
    expect(types).toContain("imports");
  });

  it("parses @PATH records with type", () => {
    const result = parseGdlc(content);
    expect(result.paths.length).toBe(2);
    expect(result.paths[0].pathType).toBe("callchain");
    expect(result.paths[0].entities.length).toBe(4);
    expect(result.paths[1].pathType).toBe("dataflow");
  });

  it("parses @E enum records", () => {
    const result = parseGdlc(content);
    expect(result.enums.length).toBeGreaterThanOrEqual(2);
    const nullable = result.enums.find((e) => e.member === "nullable");
    expect(nullable?.module).toBe("GdlsColumn");
    expect(nullable?.values).toEqual(["Y", "N"]);
  });

  it("skips comments and blank lines", () => {
    const result = parseGdlc(content);
    // Fixture has # comments and blank lines — they should not appear as members
    const allMembers = result.modules.flatMap((m) => m.members);
    const commentMembers = allMembers.filter((m) => m.name.startsWith("#") || m.name.startsWith("//"));
    expect(commentMembers.length).toBe(0);
  });

  it("handles escaped pipe in @D description", () => {
    const content = [
      "@D root|Root package \\| main",
      "@T ModA|Module A",
      "init|fn|public|void||setup",
    ].join("\n");
    const result = parseGdlc(content);
    expect(result.packages[0].description).toBe("Root package | main");
  });

  it("handles escaped pipe in @R description", () => {
    const content = [
      "@D root|Root",
      "@T ModA|Module A",
      "init|fn|public|void||setup",
      "@R ModA->ModB|uses|pipes \\| work here",
    ].join("\n");
    const result = parseGdlc(content);
    expect(result.relationships[0].description).toBe("pipes | work here");
  });

  it("handles escaped pipe in @PATH description", () => {
    const content = [
      "@D root|Root",
      "@T ModA|Module A",
      "init|fn|public|void||setup",
      "@PATH ModA -> ModB -> ModC|call|path with \\| pipe",
    ].join("\n");
    const result = parseGdlc(content);
    expect(result.paths[0].description).toBe("path with | pipe");
  });

  it("handles escaped pipe in @E description", () => {
    const content = [
      "@D root|Root",
      "@T ModA|Module A",
      "init|fn|public|void||setup",
      "@E ModA.Status|active,inactive|Status \\| enum desc",
    ].join("\n");
    const result = parseGdlc(content);
    expect(result.enums[0].description).toBe("Status | enum desc");
  });

  describe("@VERSION header", () => {
    it("parses @VERSION from GDLC file with version header", () => {
      const versionContent = [
        "# @VERSION spec:gdlc v:0.1.0 generated:2026-02-15 source:tree-sitter source-hash:a1b2c3d",
        "# @FORMAT NAME|KIND|VISIBILITY|RETURN|PARAMS|DESCRIPTION",
        "@D src/lib|Test package",
        "@T TestModule|A test module",
        "testFunc|function|public|void||Does things",
      ].join("\n");
      const result = parseGdlc(versionContent);
      expect(result.version).toBeDefined();
      expect(result.version!.spec).toBe("gdlc");
      expect(result.version!.version).toBe("0.1.0");
      expect(result.version!.source).toBe("tree-sitter");
      expect(result.version!.sourceHash).toBe("a1b2c3d");
    });

    it("returns undefined version when no @VERSION header", () => {
      const noVersionContent = "@D src/lib|Package\n@T Mod|Module";
      const result = parseGdlc(noVersionContent);
      expect(result.version).toBeUndefined();
    });

    it("parses @VERSION from merge fixtures", () => {
      const skeletonContent = fs.readFileSync(path.join(FIXTURES, "merge/parsers.gdlc"), "utf-8");
      const result = parseGdlc(skeletonContent);
      expect(result.version).toBeDefined();
      expect(result.version!.spec).toBe("gdlc");
      expect(result.version!.source).toBe("tree-sitter");
    });
  });
});
