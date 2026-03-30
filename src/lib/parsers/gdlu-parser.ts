import { getField, parseVersionHeader } from "./shared";

export interface GdluSource {
  id: string;
  path: string;
  format: string;
  type: string;
  summary: string;
  ts: string;
  agent: string;
  status: string;
  signal: string;
  pages: string;
  duration: string;
  author: string;
  created: string;
  entities: string[];
  topics: string[];
  tags: string[];
  refs: string;
  line: number;
  raw: string;
}

export interface GdluSection {
  source: string;
  id: string;
  loc: string;
  title: string;
  summary: string;
  parent: string;
  entities: string[];
  topics: string[];
  tags: string[];
  line: number;
  raw: string;
}

export interface GdluExtract {
  source: string;
  id: string;
  kind: string;
  key: string;
  value: string;
  section: string;
  confidence: string;
  context: string;
  supersedes: string;
  status: string;
  line: number;
  raw: string;
}

export interface GdluFile {
  sources: GdluSource[];
  sections: GdluSection[];
  extracts: GdluExtract[];
  sourceIds: string[];
  kinds: string[];
  version?: import("../types").VersionHeader;
}

function splitCommas(raw: string): string[] {
  return raw ? raw.split(",").map((s) => s.trim()) : [];
}

export function parseGdlu(content: string): GdluFile {
  const sources: GdluSource[] = [];
  const sections: GdluSection[] = [];
  const extracts: GdluExtract[] = [];
  const sourceIdSet = new Set<string>();
  const kindSet = new Set<string>();

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    if (line.startsWith("@source")) {
      const id = getField(line, "id") || "";
      if (id) sourceIdSet.add(id);
      sources.push({
        id,
        path: getField(line, "path") || "",
        format: getField(line, "format") || "",
        type: getField(line, "type") || "",
        summary: getField(line, "summary") || "",
        ts: getField(line, "ts") || "",
        agent: getField(line, "agent") || "",
        status: getField(line, "status") || "",
        signal: getField(line, "signal") || "",
        pages: getField(line, "pages") || "",
        duration: getField(line, "duration") || "",
        author: getField(line, "author") || "",
        created: getField(line, "created") || "",
        entities: splitCommas(getField(line, "entities") || ""),
        topics: splitCommas(getField(line, "topics") || ""),
        tags: splitCommas(getField(line, "tags") || ""),
        refs: getField(line, "refs") || "",
        line: i + 1,
        raw: line,
      });
    } else if (line.startsWith("@section")) {
      sections.push({
        source: getField(line, "source") || "",
        id: getField(line, "id") || "",
        loc: getField(line, "loc") || "",
        title: getField(line, "title") || "",
        summary: getField(line, "summary") || "",
        parent: getField(line, "parent") || "",
        entities: splitCommas(getField(line, "entities") || ""),
        topics: splitCommas(getField(line, "topics") || ""),
        tags: splitCommas(getField(line, "tags") || ""),
        line: i + 1,
        raw: line,
      });
    } else if (line.startsWith("@extract")) {
      const kind = getField(line, "kind") || "";
      if (kind) kindSet.add(kind);
      extracts.push({
        source: getField(line, "source") || "",
        id: getField(line, "id") || "",
        kind,
        key: getField(line, "key") || "",
        value: getField(line, "value") || "",
        section: getField(line, "section") || "",
        confidence: getField(line, "confidence") || "",
        context: getField(line, "context") || "",
        supersedes: getField(line, "supersedes") || "",
        status: getField(line, "status") || "",
        line: i + 1,
        raw: line,
      });
    }
  }

  const version = parseVersionHeader(content) || undefined;

  return {
    sources,
    sections,
    extracts,
    sourceIds: [...sourceIdSet],
    kinds: [...kindSet],
    version,
  };
}
