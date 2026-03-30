import { describe, it, expect } from "vitest";
import { parseGdlu } from "../gdlu-parser";
import fs from "fs";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");

describe("parseGdlu", () => {
  const content = fs.readFileSync(path.join(FIXTURES, "sample-unstructured.gdlu"), "utf-8");

  it("parses @source records", () => {
    const result = parseGdlu(content);
    expect(result.sources.length).toBe(6);
    expect(result.sources[0].id).toBe("U-001");
    expect(result.sources[0].format).toBe("pdf");
    expect(result.sources[0].type).toBe("contract");
    expect(result.sources[0].summary).toContain("Master service agreement");
  });

  it("parses @source optional fields", () => {
    const result = parseGdlu(content);
    const src = result.sources[0];
    expect(src.pages).toBe("42");
    expect(src.author).toBe("legal-team");
    expect(src.agent).toBe("doc-agent");
    expect(src.signal).toBe("high");
    expect(src.created).toBe("2024-03-15");
    expect(src.refs).toBe("gdls:GL_ACCOUNT");
  });

  it("parses comma-separated entities, topics, tags", () => {
    const result = parseGdlu(content);
    const src = result.sources[0];
    expect(src.entities).toEqual(["Acme Corp", "Beta LLC"]);
    expect(src.topics).toEqual(["MSA", "indemnification"]);
    expect(src.tags).toContain("legal");
    expect(src.tags).toContain("enterprise");
  });

  it("parses @section records with locators", () => {
    const result = parseGdlu(content);
    expect(result.sections.length).toBe(8);
    expect(result.sections[0].id).toBe("S-001");
    expect(result.sections[0].source).toBe("U-001");
    expect(result.sections[0].loc).toBe("p:1-3");
    expect(result.sections[0].title).toBe("Definitions");
  });

  it("handles escaped colons in time locators", () => {
    const result = parseGdlu(content);
    const sprint = result.sections.find((s) => s.id === "S-010");
    expect(sprint?.loc).toBe("t:00:00-08:30");
  });

  it("parses hierarchical sections with parent", () => {
    const result = parseGdlu(content);
    const child = result.sections.find((s) => s.id === "S-021");
    expect(child?.parent).toBe("S-020");
    expect(child?.title).toBe("Liability Cap");
    const topLevel = result.sections.find((s) => s.id === "S-020");
    expect(topLevel?.parent).toBe("");
  });

  it("parses @extract records with kind and key", () => {
    const result = parseGdlu(content);
    expect(result.extracts.length).toBe(11);
    const cap = result.extracts.find((e) => e.id === "X-001" && e.status !== "superseded");
    expect(cap?.kind).toBe("metric");
    expect(cap?.key).toBe("liability-cap");
    expect(cap?.value).toBe("$500,000");
    expect(cap?.confidence).toBe("high");
  });

  it("parses supersession fields", () => {
    const result = parseGdlu(content);
    const amended = result.extracts.find((e) => e.id === "X-020");
    expect(amended?.supersedes).toBe("X-001");
    expect(amended?.value).toBe("$750,000");
    const superseded = result.extracts.find((e) => e.id === "X-001" && e.status === "superseded");
    expect(superseded?.status).toBe("superseded");
  });

  it("handles escaped pipes in extract values", () => {
    const result = parseGdlu(content);
    const term = result.extracts.find((e) => e.id === "X-030");
    expect(term?.value).toContain("Provider | Client");
  });

  it("collects unique source IDs and extract kinds", () => {
    const result = parseGdlu(content);
    expect(result.sourceIds).toContain("U-001");
    expect(result.sourceIds).toContain("U-003");
    expect(result.kinds).toContain("metric");
    expect(result.kinds).toContain("decision");
    expect(result.kinds).toContain("action");
    expect(result.kinds).toContain("risk");
  });

  it("skips comments and blank lines", () => {
    const result = parseGdlu(content);
    const total = result.sources.length + result.sections.length + result.extracts.length;
    // Fixture has 25 records (6 sources + 8 sections + 11 extracts)
    expect(total).toBe(25);
  });

  it("parses source status field", () => {
    const result = parseGdlu(content);
    const stale = result.sources.find((s) => s.id === "U-006");
    expect(stale?.status).toBe("stale");
  });
});
