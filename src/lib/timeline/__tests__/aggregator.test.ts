import { describe, it, expect } from "vitest";
import { buildTimeline } from "../aggregator";
import path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "../../../../tests/fixtures");

describe("buildTimeline", () => {
  it("aggregates dated events from gdlm + gdlu fixtures and detects phases", async () => {
    const result = await buildTimeline(FIXTURES_DIR);

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.phases.length).toBeGreaterThan(0);
    expect(result.summary.dateRange).not.toBeNull();
  });

  it("emits memory layer events from .gdlm @memory records", async () => {
    const result = await buildTimeline(FIXTURES_DIR);
    const memoryEvents = result.events.filter((e) => e.layer === "memory");

    expect(memoryEvents.length).toBeGreaterThan(0);
    // sample-memory.gdlm has subjects like "JWT authentication"
    const jwt = memoryEvents.find((e) => e.title.includes("JWT"));
    expect(jwt).toBeDefined();
    expect(jwt!.tags).toContain("auth");
    expect(jwt!.agent).toBe("dev");
  });

  it("emits document events from .gdlu @source records", async () => {
    const result = await buildTimeline(FIXTURES_DIR);
    const docs = result.events.filter((e) => e.layer === "document");
    expect(docs.length).toBeGreaterThan(0);
  });

  it("emits a file-level version event when @VERSION header is present", async () => {
    const result = await buildTimeline(FIXTURES_DIR);
    const versions = result.events.filter((e) => e.type === "generated");
    expect(versions.length).toBeGreaterThan(0);
    // sample-api.gdla has spec:gdla v:0.1.0 generated:2026-02-18
    const apiVersion = versions.find((e) => e.file.endsWith("sample-api.gdla"));
    expect(apiVersion).toBeDefined();
    expect(apiVersion!.layer).toBe("api");
  });

  it("returns events sorted by date", async () => {
    const { events } = await buildTimeline(FIXTURES_DIR);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].date >= events[i - 1].date).toBe(true);
    }
  });

  it("phase boundaries are non-overlapping and chronologically ordered", async () => {
    const { phases } = await buildTimeline(FIXTURES_DIR);
    for (let i = 1; i < phases.length; i++) {
      const prevEnd = new Date(phases[i - 1].endDate).getTime();
      const nextStart = new Date(phases[i].startDate).getTime();
      // Phases may be adjacent (agent-shift boundary) but never overlap
      expect(nextStart).toBeGreaterThanOrEqual(prevEnd);
    }
  });

  it("phase labels never repeat the same word twice", async () => {
    const { phases } = await buildTimeline(FIXTURES_DIR);
    for (const p of phases) {
      const parts = p.label.split(" · ");
      if (parts.length < 2) continue;
      const [a, b] = parts;
      expect(a.toLowerCase()).not.toBe(b.toLowerCase());
    }
  });
});
