import { describe, it, expect } from "vitest";
import { splitPipeFields } from "../shared";

describe("splitPipeFields", () => {
  it("splits on unescaped pipes", () => {
    expect(splitPipeFields("a|b|c")).toEqual(["a", "b", "c"]);
  });

  it("handles escaped pipe as literal", () => {
    expect(splitPipeFields("a\\|b|c")).toEqual(["a|b", "c"]);
  });

  it("handles escaped backslash", () => {
    expect(splitPipeFields("a\\\\|b")).toEqual(["a\\", "b"]);
  });

  it("handles escaped colon", () => {
    expect(splitPipeFields("key\\:val|other")).toEqual(["key:val", "other"]);
  });

  it("handles multiple escapes in one field", () => {
    expect(splitPipeFields("a\\|b\\|c|d")).toEqual(["a|b|c", "d"]);
  });

  it("handles empty fields", () => {
    expect(splitPipeFields("a||c")).toEqual(["a", "", "c"]);
  });

  it("handles single field with no pipes", () => {
    expect(splitPipeFields("hello")).toEqual(["hello"]);
  });

  it("handles empty string", () => {
    expect(splitPipeFields("")).toEqual([""]);
  });

  it("handles trailing backslash (incomplete escape — backslash dropped)", () => {
    // Trailing backslash with no following character is treated as incomplete escape
    // and silently dropped. This matches existing splitFields behavior.
    expect(splitPipeFields("a\\")).toEqual(["a"]);
  });

  it("handles single backslash (incomplete escape)", () => {
    expect(splitPipeFields("\\")).toEqual([""]);
  });

  it("handles double-escaped backslash without pipe", () => {
    // Four backslashes in source = two in string = escaped backslash → literal "\"
    // Result: ["a\\b"] (single field, backslash preserved)
    expect(splitPipeFields("a\\\\b")).toEqual(["a\\b"]);
  });

  it("preserves backslash for unknown escape sequences", () => {
    // \n is not a known GDL escape → backslash preserved
    expect(splitPipeFields("a\\nb|c")).toEqual(["a\\nb", "c"]);
  });

  it("handles Unicode characters", () => {
    expect(splitPipeFields("name|desc \u{1F389}|other")).toEqual(["name", "desc \u{1F389}", "other"]);
  });
});
