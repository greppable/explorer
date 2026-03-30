import { describe, it, expect } from "vitest";
import { parseVersionHeader } from "../shared";

describe("parseVersionHeader", () => {
  it("parses a full @VERSION header with all fields", () => {
    const content = [
      "# @VERSION spec:gdlc v:0.1.0 generated:2026-02-15 source:tree-sitter source-hash:a1b2c3d source-path:src/lib/parsers/gdlc-parser.ts",
      "@D src/lib/parsers|Parser modules",
    ].join("\n");

    const header = parseVersionHeader(content);
    expect(header).not.toBeNull();
    expect(header!.spec).toBe("gdlc");
    expect(header!.version).toBe("0.1.0");
    expect(header!.generated).toBe("2026-02-15");
    expect(header!.source).toBe("tree-sitter");
    expect(header!.sourceHash).toBe("a1b2c3d");
    expect(header!.sourcePath).toBe("src/lib/parsers/gdlc-parser.ts");
  });

  it("parses header with missing optional fields", () => {
    const content = "# @VERSION spec:gdls v:0.2.0 generated:2026-01-01 source:db-introspect\n@D sales|";
    const header = parseVersionHeader(content);
    expect(header).not.toBeNull();
    expect(header!.spec).toBe("gdls");
    expect(header!.version).toBe("0.2.0");
    expect(header!.source).toBe("db-introspect");
    expect(header!.sourceHash).toBeUndefined();
    expect(header!.sourcePath).toBeUndefined();
  });

  it("returns null when no @VERSION line exists", () => {
    const content = "# Just a comment\n@D src/lib|Parser modules\n@T GdlParser|Parses GDL";
    expect(parseVersionHeader(content)).toBeNull();
  });

  it("takes the first @VERSION line when multiple exist", () => {
    const content = [
      "# @VERSION spec:gdlc v:0.1.0 generated:2026-02-15 source:tree-sitter",
      "# @VERSION spec:gdlc v:0.2.0 generated:2026-02-16 source:agent",
      "@D src/lib|",
    ].join("\n");

    const header = parseVersionHeader(content);
    expect(header).not.toBeNull();
    expect(header!.version).toBe("0.1.0");
    expect(header!.source).toBe("tree-sitter");
  });

  it("returns null when @VERSION line is missing spec field", () => {
    const content = "# @VERSION v:0.1.0 generated:2026-02-15";
    expect(parseVersionHeader(content)).toBeNull();
  });

  it("returns null when @VERSION line is missing version field", () => {
    const content = "# @VERSION spec:gdlc generated:2026-02-15";
    expect(parseVersionHeader(content)).toBeNull();
  });

  it("skips non-comment @VERSION (not a comment line)", () => {
    const content = "@VERSION spec:gdlc v:0.1.0 generated:2026-02-15 source:tree-sitter";
    expect(parseVersionHeader(content)).toBeNull();
  });

  it("handles @VERSION with source-hash but no source-path", () => {
    const content = "# @VERSION spec:gdlc v:0.1.0 generated:2026-02-15 source:tree-sitter source-hash:abc123";
    const header = parseVersionHeader(content);
    expect(header).not.toBeNull();
    expect(header!.sourceHash).toBe("abc123");
    expect(header!.sourcePath).toBeUndefined();
  });

  it("ignores @VERSION beyond first 10 lines", () => {
    const padding = Array(15).fill("# comment line").join("\n");
    const content = padding + "\n# @VERSION spec:gdlc v:1.0 source:test";
    expect(parseVersionHeader(content)).toBeNull();
  });

  it("handles empty content gracefully", () => {
    expect(parseVersionHeader("")).toBeNull();
  });

  it("finds @VERSION at line 10", () => {
    const padding = Array(9).fill("# comment line").join("\n");
    const content = padding + "\n# @VERSION spec:gdlc v:1.0 source:test";
    const result = parseVersionHeader(content);
    expect(result).not.toBeNull();
    expect(result!.version).toBe("1.0");
  });
});
