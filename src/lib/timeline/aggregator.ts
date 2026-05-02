import fs from "fs/promises";
import { walkRepo } from "../walker";
import { getField, getRecordType, parseVersionHeader } from "../parsers/shared";
import type { GdlFormat } from "../types";
import type {
  TimelineEvent,
  TimelinePayload,
  TimelinePhase,
  TimelineLayer,
} from "./types";

const EMPTY_LAYER_COUNTS: Record<TimelineLayer, number> = {
  memory: 0,
  document: 0,
  schema: 0,
  code: 0,
  diagram: 0,
  api: 0,
  data: 0,
  version: 0,
};

const FORMAT_TO_LAYER: Record<GdlFormat, TimelineLayer> = {
  gdlm: "memory",
  gdlu: "document",
  gdls: "schema",
  gdlc: "code",
  gdld: "diagram",
  gdla: "api",
  gdl: "data",
};

const PHASE_GAP_DAYS = 7; // gap that triggers a new phase
const AGENT_WINDOW = 10; // events used to compute dominant agent on each side
const MIN_PHASE_EVENTS = 6; // don't split phases smaller than this

// Matches "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DDTHH:MM:SS.fff" with no timezone
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function safeIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  // Normalise to UTC: bare dates → midnight Z; naive datetimes → append Z.
  // Without this, V8's Date.parse interprets tz-naive ISO as local time, which
  // would shift fixture timestamps in any non-UTC environment.
  let candidate = cleaned;
  if (cleaned.length === 10) {
    candidate = `${cleaned}T00:00:00Z`;
  } else if (NAIVE_DATETIME.test(cleaned)) {
    candidate = `${cleaned}Z`;
  }
  const t = Date.parse(candidate);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

function splitTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function extractMemoryEvents(content: string, filePath: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("@memory")) continue;
    const ts = safeIso(getField(line, "ts"));
    if (!ts) continue;
    const id = getField(line, "id") || `mem-${i}`;
    const subject = getField(line, "subject") || "Untitled memory";
    const detail = getField(line, "detail") || undefined;
    const agent = getField(line, "agent") || undefined;
    const type = getField(line, "type") || "memory";
    const tags = splitTags(getField(line, "tags"));
    const confidence = getField(line, "confidence") || undefined;
    const relates = getField(line, "relates") || undefined;
    const anchor = getField(line, "anchor") || undefined;
    const entities: string[] = [];
    if (subject) entities.push(subject);
    if (anchor) entities.push(anchor);
    const sig = confidence === "high" ? 0.9 : confidence === "medium" ? 0.65 : 0.45;
    events.push({
      id: `${filePath}#${id}`,
      date: ts,
      layer: "memory",
      format: "gdlm",
      type,
      title: subject,
      detail,
      agent,
      tags,
      entities,
      file: filePath,
      line: i + 1,
      significance: sig,
      confidence,
      relates,
    });
  }
  return events;
}

function extractSourceEvents(content: string, filePath: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("@source")) continue;
    const ts = safeIso(getField(line, "ts") || getField(line, "created"));
    if (!ts) continue;
    const status = getField(line, "status") || undefined;
    // Skip explicitly stale sources — they're not part of the project narrative
    if (status === "stale") continue;
    const id = getField(line, "id") || `src-${i}`;
    const summary = getField(line, "summary") || getField(line, "path") || "Source";
    const type = getField(line, "type") || "source";
    const author = getField(line, "author") || undefined;
    const tags = splitTags(getField(line, "tags"));
    const topics = splitTags(getField(line, "topics"));
    const entityList = splitTags(getField(line, "entities"));
    const signal = getField(line, "signal") || undefined;
    const sig = signal === "high" ? 0.85 : signal === "medium" ? 0.6 : 0.4;
    events.push({
      id: `${filePath}#${id}`,
      date: ts,
      layer: "document",
      format: "gdlu",
      type,
      title: summary,
      detail: getField(line, "path") || undefined,
      agent: author,
      tags: [...tags, ...topics],
      entities: entityList,
      file: filePath,
      line: i + 1,
      significance: sig,
      signal,
      status,
    });
  }
  return events;
}

function extractFileVersionEvent(
  content: string,
  filePath: string,
  format: GdlFormat,
): TimelineEvent | null {
  const header = parseVersionHeader(content);
  if (!header || !header.generated) return null;
  const ts = safeIso(header.generated);
  if (!ts) return null;
  const layer = FORMAT_TO_LAYER[format];
  return {
    id: `${filePath}#__version`,
    date: ts,
    layer,
    format,
    type: "generated",
    title: filePath.split("/").pop() || filePath,
    detail: `${header.spec} v${header.version} via ${header.source || "unknown"}`,
    tags: [header.spec, header.source].filter(Boolean) as string[],
    entities: [],
    file: filePath,
    significance: 0.55,
  };
}

/**
 * Some @diagram / @section records carry a `created` field — treat as supporting
 * events. Skipped if no usable timestamp.
 */
function extractAuxEvents(
  content: string,
  filePath: string,
  format: GdlFormat,
): TimelineEvent[] {
  if (format !== "gdld" && format !== "gdlu") return [];
  const events: TimelineEvent[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("@")) continue;
    const recordType = getRecordType(line);
    if (recordType !== "diagram" && recordType !== "section") continue;
    const ts = safeIso(getField(line, "created") || getField(line, "ts"));
    if (!ts) continue;
    const id = getField(line, "id") || `${recordType}-${i}`;
    const title =
      getField(line, "title") ||
      getField(line, "purpose") ||
      getField(line, "label") ||
      recordType;
    events.push({
      id: `${filePath}#${id}`,
      date: ts,
      layer: FORMAT_TO_LAYER[format],
      format,
      type: recordType,
      title,
      detail: getField(line, "summary") || undefined,
      tags: splitTags(getField(line, "tags")),
      entities: [],
      file: filePath,
      line: i + 1,
      significance: 0.55,
    });
  }
  return events;
}

function dominantAgent(events: TimelineEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const evt of events) {
    if (!evt.agent) continue;
    counts.set(evt.agent, (counts.get(evt.agent) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [agent, count] of counts) {
    if (count > bestCount) {
      best = agent;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Group an agent name into a coarse "role family" so closely related agents
 * (e.g. build-agent-1 / build-agent-2) don't trigger spurious phase splits.
 * The family is the agent name with a trailing "-N" stripped.
 */
function agentFamily(agent: string | null): string | null {
  if (!agent) return null;
  return agent.replace(/-\d+$/, "");
}

function detectPhases(events: TimelineEvent[]): TimelinePhase[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const gapMs = PHASE_GAP_DAYS * 24 * 60 * 60 * 1000;

  // Pass 1 — boundaries where the calendar gap exceeds the phase threshold.
  const boundaries = new Set<number>([0, sorted.length]);
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date).getTime();
    const next = new Date(sorted[i].date).getTime();
    if (next - prev > gapMs) boundaries.add(i);
  }

  // Pass 2 — boundaries where the dominant agent family shifts. Slide a window
  // across the timeline; whenever the family changes between adjacent windows,
  // that's a phase boundary (subject to MIN_PHASE_EVENTS spacing).
  let lastBoundary = 0;
  for (let i = AGENT_WINDOW; i < sorted.length - AGENT_WINDOW; i++) {
    const prevWindow = sorted.slice(i - AGENT_WINDOW, i);
    const nextWindow = sorted.slice(i, i + AGENT_WINDOW);
    const prevFamily = agentFamily(dominantAgent(prevWindow));
    const nextFamily = agentFamily(dominantAgent(nextWindow));
    if (!prevFamily || !nextFamily || prevFamily === nextFamily) continue;
    if (i - lastBoundary < MIN_PHASE_EVENTS) continue;
    boundaries.add(i);
    lastBoundary = i;
  }
  const finalBoundaries = [...boundaries].sort((a, b) => a - b);

  const buckets: TimelineEvent[][] = [];
  for (let i = 0; i < finalBoundaries.length - 1; i++) {
    const slice = sorted.slice(finalBoundaries[i], finalBoundaries[i + 1]);
    if (slice.length > 0) buckets.push(slice);
  }
  if (buckets.length === 0) buckets.push(sorted);

  return buckets.map((bucket, idx) => {
    const layerCounts = new Map<TimelineLayer, number>();
    const themeCounts = new Map<string, number>();
    for (const evt of bucket) {
      layerCounts.set(evt.layer, (layerCounts.get(evt.layer) ?? 0) + 1);
      const themeSeed = [evt.type, ...evt.tags];
      for (const t of themeSeed) {
        if (!t) continue;
        const key = t.toLowerCase();
        themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1);
      }
    }
    let dominantLayer: TimelineLayer = bucket[0].layer;
    let dominantCount = 0;
    for (const [layer, count] of layerCounts) {
      if (count > dominantCount) {
        dominantCount = count;
        dominantLayer = layer;
      }
    }
    const themes = [...themeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([t]) => t);

    const start = bucket[0].date;
    const end = bucket[bucket.length - 1].date;
    const family = agentFamily(dominantAgent(bucket));
    const label = phaseLabel(idx, dominantLayer, themes, family);

    return {
      id: `phase-${idx + 1}`,
      startDate: start,
      endDate: end,
      label,
      eventCount: bucket.length,
      dominantLayer,
      themes,
    };
  });
}

function phaseLabel(
  index: number,
  dominant: TimelineLayer,
  themes: string[],
  agentFam: string | null,
): string {
  const layerWord = dominant.charAt(0).toUpperCase() + dominant.slice(1);
  const agentWord = agentFam
    ? agentFam
        .replace(/-agent$/, "")
        .split(/[-_]/)
        .map((p) => (p.length > 0 ? p[0].toUpperCase() + p.slice(1) : p))
        .join(" ")
    : null;

  // Pick the first theme that isn't redundant with what we'd already show
  const redundant = new Set([
    dominant.toLowerCase(),
    agentFam?.toLowerCase() ?? "",
    "memory",
    "observation",
  ]);
  const distinctTheme = themes.find((t) => !redundant.has(t.toLowerCase()));
  const titledTheme = distinctTheme
    ? distinctTheme.charAt(0).toUpperCase() + distinctTheme.slice(1)
    : null;

  // Avoid X · X labels regardless of which source produced the parts
  const compose = (a: string, b: string) =>
    a.toLowerCase() === b.toLowerCase() ? a : `${a} · ${b}`;

  if (agentWord && titledTheme) return compose(agentWord, titledTheme);
  if (agentWord) return compose(agentWord, layerWord);
  if (titledTheme) return compose(titledTheme, layerWord);
  return `Phase ${index + 1} · ${layerWord}`;
}

export async function buildTimeline(rootDir: string): Promise<TimelinePayload> {
  const tree = await walkRepo(rootDir);
  const allEvents: TimelineEvent[] = [];
  const agentSet = new Set<string>();

  for (const file of tree.files) {
    let content: string;
    try {
      content = await fs.readFile(file.absolutePath, "utf-8");
    } catch {
      continue;
    }

    const versionEvt = extractFileVersionEvent(content, file.path, file.format);
    if (versionEvt) allEvents.push(versionEvt);

    if (file.format === "gdlm") {
      for (const evt of extractMemoryEvents(content, file.path)) {
        allEvents.push(evt);
        if (evt.agent) agentSet.add(evt.agent);
      }
    }
    if (file.format === "gdlu") {
      for (const evt of extractSourceEvents(content, file.path)) {
        allEvents.push(evt);
        if (evt.agent) agentSet.add(evt.agent);
      }
    }
    for (const evt of extractAuxEvents(content, file.path, file.format)) {
      allEvents.push(evt);
    }
  }

  // De-duplicate by id (keep the most-detailed entry)
  const byId = new Map<string, TimelineEvent>();
  for (const evt of allEvents) {
    const existing = byId.get(evt.id);
    if (!existing) {
      byId.set(evt.id, evt);
    } else if ((evt.detail?.length ?? 0) > (existing.detail?.length ?? 0)) {
      byId.set(evt.id, evt);
    }
  }
  const events = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));

  const layerCounts: Record<TimelineLayer, number> = { ...EMPTY_LAYER_COUNTS };
  for (const evt of events) {
    layerCounts[evt.layer] += 1;
  }

  const phases = detectPhases(events);
  const dateRange =
    events.length > 0
      ? { start: events[0].date, end: events[events.length - 1].date }
      : null;

  return {
    events,
    phases,
    summary: {
      totalEvents: events.length,
      layerCounts,
      agents: [...agentSet].sort(),
      dateRange,
    },
  };
}
