import { describe, it, expect } from "vitest";
import { parseGdls } from "../gdls-parser";
import fs from "fs";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");

describe("parseGdls extended", () => {
  it("parses relationship types", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
    const result = parseGdls(content);
    const fks = result.relationships.filter((r) => r.relType === "fk");
    expect(fks.length).toBeGreaterThanOrEqual(3);
  });

  it("parses cross-system equivalents", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
    const result = parseGdls(content);
    const equivs = result.relationships.filter((r) => r.relType === "equivalent");
    expect(equivs.length).toBeGreaterThanOrEqual(1);
    expect(equivs[0].sourceTable).toContain(":");
  });

  it("parses @PATH records", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
    const result = parseGdls(content);
    expect(result.paths.length).toBeGreaterThanOrEqual(1);
    expect(result.paths[0].tables.length).toBeGreaterThanOrEqual(2);
  });

  it("parses multiple domains", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "bridge-schema.gdls"), "utf-8");
    const result = parseGdls(content);
    expect(result.domains.length).toBe(2);
    expect(result.domains.map((d) => d.name)).toContain("receivables");
  });

  it("assigns tables to correct domains", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "bridge-schema.gdls"), "utf-8");
    const result = parseGdls(content);
    const arReceipt = result.tables.find((t) => t.name === "AR_RECEIPT");
    expect(arReceipt?.domain).toBe("receivables");
  });

  it("parses feeds relationship type", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "bridge-schema.gdls"), "utf-8");
    const result = parseGdls(content);
    const feeds = result.relationships.filter((r) => r.relType === "feeds");
    expect(feeds.length).toBeGreaterThanOrEqual(1);
  });

  it("parses @E enum records with description", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
    const result = parseGdls(content);
    expect(result.enums.length).toBeGreaterThanOrEqual(1);
    const glStatus = result.enums.find((e) => e.column === "GL_STATUS");
    expect(glStatus).toBeDefined();
    expect(glStatus!.table).toBe("GL_ACCOUNT");
    expect(glStatus!.values).toEqual(["ACTIVE", "INACTIVE", "SUSPENDED"]);
    expect(glStatus!.description).toBe("Account lifecycle status");
  });

  it("parses @E enum records without description", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
    const result = parseGdls(content);
    const entryType = result.enums.find((e) => e.column === "ENTRY_TYPE");
    expect(entryType).toBeDefined();
    expect(entryType!.table).toBe("GL_JOURNAL");
    expect(entryType!.values).toEqual(["MANUAL", "AUTO", "REVERSAL"]);
    expect(entryType!.description).toBe("");
  });
});
