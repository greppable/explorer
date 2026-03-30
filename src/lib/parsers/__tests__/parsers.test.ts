import { describe, it, expect } from "vitest";
import { getField, getRecordType } from "../shared";
import { parseGdl } from "../gdl-parser";
import { parseGdls } from "../gdls-parser";
import { parseGdlm } from "../gdlm-parser";
import { extractEntities } from "../index";
import { resolveSafePath } from "../../config";
import fs from "fs";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");
const CROSS_LAYER = path.join(FIXTURES, "cross-layer");

// --- Shared utilities ---
describe("shared", () => {
  it("getField extracts field value", () => {
    expect(getField("@node|id:GL_ACCOUNT|label:Test", "id")).toBe("GL_ACCOUNT");
  });

  it("getField returns null for missing field", () => {
    expect(getField("@node|id:X", "label")).toBeNull();
  });

  it("getRecordType extracts type", () => {
    expect(getRecordType("@memory|id:M-001")).toBe("memory");
  });

  it("handles escaped pipes", () => {
    expect(getField("@node|id:test|label:a\\|b", "label")).toBe("a|b");
  });
});

// --- GDL parser ---
describe("parseGdl", () => {
  it("extracts record types and fields", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdl"), "utf-8");
    const result = parseGdl(content);
    expect(result.recordTypes).toContain("account");
    expect(result.recordTypes).toContain("config");
    expect(result.records.length).toBe(2);
  });

  it("extracts fields from records", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdl"), "utf-8");
    const result = parseGdl(content);
    const account = result.records.find((r) => r.type === "account");
    expect(account?.fields.id).toBe("GL_ACCOUNT");
    expect(account?.fields.name).toBe("General Ledger Account");
  });
});

// --- GDLS parser ---
describe("parseGdls", () => {
  it("extracts domains and tables", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdls"), "utf-8");
    const result = parseGdls(content);
    expect(result.domains).toHaveLength(1);
    expect(result.domains[0].name).toBe("finance");
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe("GL_ACCOUNT");
  });

  it("extracts columns", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdls"), "utf-8");
    const result = parseGdls(content);
    expect(result.tables[0].columns).toHaveLength(2);
    expect(result.tables[0].columns[0].name).toBe("GL_ACCOUNT_ID");
    expect(result.tables[0].columns[0].type).toBe("INTEGER");
  });

  it("extracts relationships", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdls"), "utf-8");
    const result = parseGdls(content);
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].sourceTable).toBe("GL_JOURNAL");
    expect(result.relationships[0].targetTable).toBe("GL_ACCOUNT");
  });
});

// --- GDLM parser ---
describe("parseGdlm", () => {
  it("extracts memories with fields", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdlm"), "utf-8");
    const result = parseGdlm(content);
    expect(result.memories).toHaveLength(50);
    expect(result.memories[0].id).toBe("M-001");
    expect(result.memories[0].subject).toBe("GL_ACCOUNT");
  });

  it("extracts unique subjects", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdlm"), "utf-8");
    const result = parseGdlm(content);
    expect(result.subjects).toContain("GL_ACCOUNT");
    expect(result.subjects).toContain("GL_JOURNAL");
  });
});

// --- Entity extraction ---
describe("extractEntities", () => {
  it("extracts entities from GDL files", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdl"), "utf-8");
    const entities = extractEntities(content, "gdl", "finance.gdl");
    const ids = entities.map((e) => e.entity);
    expect(ids).toContain("GL_ACCOUNT");
  });

  it("extracts entities from GDLS files", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdls"), "utf-8");
    const entities = extractEntities(content, "gdls", "finance.gdls");
    const ids = entities.map((e) => e.entity);
    expect(ids).toContain("GL_ACCOUNT");
    expect(ids).toContain("finance");
    expect(ids).toContain("GL_JOURNAL");
  });

  it("extracts enum entities from GDLS files", () => {
    const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
    const entities = extractEntities(content, "gdls", "sample-schema.gdls");
    const enumEntities = entities.filter((e) => e.role === "enum");
    expect(enumEntities.length).toBeGreaterThanOrEqual(1);
    const glStatus = enumEntities.find((e) => e.entity === "GL_ACCOUNT");
    expect(glStatus).toBeDefined();
    expect(glStatus!.context).toContain("@E");
  });

  it("extracts entities from GDLM files", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdlm"), "utf-8");
    const entities = extractEntities(content, "gdlm", "finance.gdlm");
    const ids = entities.map((e) => e.entity);
    expect(ids).toContain("GL_ACCOUNT");
    expect(ids).toContain("GL_JOURNAL");
  });

  it("extracts entities from GDLD files", () => {
    const content = fs.readFileSync(path.join(CROSS_LAYER, "finance.gdld"), "utf-8");
    const entities = extractEntities(content, "gdld", "finance.gdld");
    const ids = entities.map((e) => e.entity);
    expect(ids).toContain("GL_ACCOUNT");
    expect(ids).toContain("GL_JOURNAL");
  });
});

// --- Path traversal guard ---
describe("resolveSafePath", () => {
  it("resolves normal relative paths", () => {
    const result = resolveSafePath("tests/fixtures/cross-layer/finance.gdl");
    expect(result).not.toBeNull();
    expect(result).toContain("finance.gdl");
  });

  it("rejects parent traversal", () => {
    expect(resolveSafePath("../../../etc/passwd")).toBeNull();
  });

  it("rejects traversal with intermediate segments", () => {
    expect(resolveSafePath("foo/../../../etc/passwd")).toBeNull();
  });

  it("resolves empty string to root", () => {
    const result = resolveSafePath("");
    expect(result).not.toBeNull();
  });
});
