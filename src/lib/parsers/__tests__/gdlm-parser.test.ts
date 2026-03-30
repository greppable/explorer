import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseGdlm } from "../gdlm-parser";
import { extractEntities } from "../index";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");
const CROSS_LAYER = path.join(FIXTURES, "cross-layer");

describe("parseGdlm", () => {
  describe("@memory records", () => {
    it("parses memory records from fixture", () => {
      const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdlm"), "utf-8");
      const result = parseGdlm(content);
      expect(result.memories).toHaveLength(50);
      expect(result.memories[0].id).toBe("M-001");
      expect(result.memories[0].agent).toBe("schema-agent");
      expect(result.memories[0].subject).toBe("GL_ACCOUNT");
      expect(result.memories[0].detail).toBe("Account table has 13 columns including account_id, name, type, currency");
      expect(result.memories[0].ts).toBe("2026-01-15T09:00:00Z");
      expect(result.memories[0].tags).toEqual(["schema", "discovery"]);
    });

    it("parses comma-separated tags", () => {
      const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdlm"), "utf-8");
      const result = parseGdlm(content);
      expect(result.memories[1].tags).toEqual(["schema", "GL_ACCOUNT"]);
    });

    it("parses type and confidence fields", () => {
      const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdlm"), "utf-8");
      const result = parseGdlm(content);
      expect(result.memories[0].type).toBe("observation");
      expect(result.memories[0].confidence).toBe("high");
      expect(result.memories[3].type).toBe("decision");
    });

    it("collects unique subjects", () => {
      const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdlm"), "utf-8");
      const result = parseGdlm(content);
      expect(result.subjects).toContain("GL_ACCOUNT");
      expect(result.subjects).toContain("GL_JOURNAL");
      expect(result.subjects.length).toBeGreaterThanOrEqual(2);
    });

    it("collects unique agents", () => {
      const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdlm"), "utf-8");
      const result = parseGdlm(content);
      expect(result.agents).toContain("schema-agent");
      expect(result.agents).toContain("analyst");
      expect(result.agents).toContain("reconciler");
      expect(result.agents).toHaveLength(3);
    });

    it("skips comment lines", () => {
      const content = "# comment\n@memory|id:M-001|agent:a|subject:s|detail:d|ts:2026-01-01T00:00:00Z";
      const result = parseGdlm(content);
      expect(result.memories).toHaveLength(1);
    });

    it("skips blank lines", () => {
      const content = "\n\n@memory|id:M-001|agent:a|subject:s|detail:d|ts:2026-01-01T00:00:00Z\n\n";
      const result = parseGdlm(content);
      expect(result.memories).toHaveLength(1);
    });
  });

  describe("@anchor records", () => {
    it("parses anchor records from fixture", () => {
      const content = fs.readFileSync(path.join(CROSS_LAYER, "anchors.gdlm"), "utf-8");
      const result = parseGdlm(content);
      expect(result.anchors).toHaveLength(3);
    });

    it("extracts concept field", () => {
      const content = "@anchor|concept:data-pipeline|scope:etl,sync,transform";
      const result = parseGdlm(content);
      expect(result.anchors[0].concept).toBe("data-pipeline");
    });

    it("extracts scope as array", () => {
      const content = "@anchor|concept:data-pipeline|scope:etl,sync,transform";
      const result = parseGdlm(content);
      expect(result.anchors[0].scope).toEqual(["etl", "sync", "transform"]);
    });

    it("tracks line numbers", () => {
      const content = "# comment\n@anchor|concept:test|scope:a,b";
      const result = parseGdlm(content);
      expect(result.anchors[0].line).toBe(2);
    });

    it("preserves raw line", () => {
      const line = "@anchor|concept:test|scope:a,b";
      const result = parseGdlm(line);
      expect(result.anchors[0].raw).toBe(line);
    });

    it("collects unique concepts", () => {
      const content = fs.readFileSync(path.join(CROSS_LAYER, "anchors.gdlm"), "utf-8");
      const result = parseGdlm(content);
      expect(result.concepts).toContain("data-pipeline");
      expect(result.concepts).toContain("auth-security");
      expect(result.concepts).toContain("customer-data");
      expect(result.concepts).toHaveLength(3);
    });
  });

  describe("mixed files", () => {
    it("parses both @memory and @anchor records in same file", () => {
      const content = [
        "@anchor|concept:schema|scope:table,column,fk",
        "@memory|id:M-001|agent:test|subject:GL|detail:test|ts:2026-01-01T00:00:00Z",
      ].join("\n");
      const result = parseGdlm(content);
      expect(result.anchors).toHaveLength(1);
      expect(result.memories).toHaveLength(1);
    });

    it("returns empty arrays for file with only comments", () => {
      const content = "# just comments\n# nothing here";
      const result = parseGdlm(content);
      expect(result.memories).toHaveLength(0);
      expect(result.anchors).toHaveLength(0);
    });
  });
});

describe("extractEntities for GDLM", () => {
  it("extracts anchor concept as entity", () => {
    const content = "@anchor|concept:data-pipeline|scope:etl,sync";
    const entities = extractEntities(content, "gdlm", "test.gdlm");
    const concepts = entities.filter((e) => e.role === "anchor_concept");
    expect(concepts).toHaveLength(1);
    expect(concepts[0].entity).toBe("data-pipeline");
  });

  it("extracts anchor scope keywords as entities", () => {
    const content = "@anchor|concept:data-pipeline|scope:etl,sync";
    const entities = extractEntities(content, "gdlm", "test.gdlm");
    const keywords = entities.filter((e) => e.role === "anchor_scope");
    expect(keywords).toHaveLength(2);
    expect(keywords.map((e) => e.entity)).toContain("etl");
    expect(keywords.map((e) => e.entity)).toContain("sync");
  });
});
