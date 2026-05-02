import { getField, parseVersionHeader } from "./shared";

export interface GdlmMemory {
  id: string;
  agent: string;
  subject: string;
  detail: string;
  ts: string;
  tags: string[];
  confidence: string;
  relates: string;
  type: string;
  /** Anchor concept this memory belongs to (per @memory `anchor:` field). */
  anchor: string;
  line: number;
  raw: string;
}

export interface GdlmAnchor {
  concept: string;
  scope: string[];
  line: number;
  raw: string;
}

export interface GdlmFile {
  memories: GdlmMemory[];
  anchors: GdlmAnchor[];
  subjects: string[];
  agents: string[];
  concepts: string[];
  version?: import("../types").VersionHeader;
}

export function parseGdlm(content: string): GdlmFile {
  const memories: GdlmMemory[] = [];
  const anchors: GdlmAnchor[] = [];
  const subjectSet = new Set<string>();
  const agentSet = new Set<string>();
  const conceptSet = new Set<string>();

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("@memory")) {
      const id = getField(line, "id") || "";
      const agent = getField(line, "agent") || "";
      const subject = getField(line, "subject") || "";
      const detail = getField(line, "detail") || "";
      const ts = getField(line, "ts") || "";
      const tagsRaw = getField(line, "tags") || "";
      const confidence = getField(line, "confidence") || "";
      const relates = getField(line, "relates") || "";
      const type = getField(line, "type") || "";
      const anchor = getField(line, "anchor") || "";

      if (subject) subjectSet.add(subject);
      if (agent) agentSet.add(agent);

      const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()) : [];

      memories.push({
        id, agent, subject, detail, ts, tags,
        confidence, relates, type, anchor, line: i + 1, raw: line,
      });
    } else if (line.startsWith("@anchor")) {
      const concept = getField(line, "concept") || "";
      const scopeRaw = getField(line, "scope") || "";
      const scope = scopeRaw ? scopeRaw.split(",").map((s) => s.trim()) : [];

      if (concept) conceptSet.add(concept);

      anchors.push({ concept, scope, line: i + 1, raw: line });
    }
  }

  const version = parseVersionHeader(content) || undefined;

  return {
    memories,
    anchors,
    subjects: [...subjectSet],
    agents: [...agentSet],
    concepts: [...conceptSet],
    version,
  };
}
