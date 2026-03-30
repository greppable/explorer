// Ported from scripts/gdld-viewer/gdld-parser.js — format-agnostic utilities

import type { VersionHeader } from "../types";

/** Scans only the first 10 lines to avoid false matches deep in file content. */
export function parseVersionHeader(content: string): VersionHeader | null {
  const lines = content.split("\n");
  const scanLimit = Math.min(lines.length, 10);
  for (let i = 0; i < scanLimit; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith("# @VERSION ")) continue;

    const rest = trimmed.substring("# @VERSION ".length);
    const pairs: Record<string, string> = {};
    for (const token of rest.split(/\s+/)) {
      const colonIdx = token.indexOf(":");
      if (colonIdx === -1) continue;
      const key = token.substring(0, colonIdx);
      const value = token.substring(colonIdx + 1);
      if (key && value) pairs[key] = value;
    }

    if (!pairs["spec"] || !pairs["v"]) return null;

    return {
      spec: pairs["spec"],
      version: pairs["v"],
      generated: pairs["generated"] || "",
      source: pairs["source"] || "",
      sourceHash: pairs["source-hash"] || undefined,
      sourcePath: pairs["source-path"] || undefined,
    };
  }
  return null;
}

export function getField(record: string, key: string): string | null {
  const fields = splitFields(record);
  for (const field of fields) {
    const colonIdx = field.indexOf(":");
    if (colonIdx === -1) continue;
    const fieldKey = field.substring(0, colonIdx);
    if (fieldKey === key) {
      return unescapeValue(field.substring(colonIdx + 1));
    }
  }
  return null;
}

export function getRecordType(record: string): string {
  const pipeIdx = record.indexOf("|");
  const raw = pipeIdx === -1 ? record : record.substring(0, pipeIdx);
  return raw.startsWith("@") ? raw.substring(1) : raw;
}

/** Escape-aware split on pipe delimiter. Unescapes \| \: \\ sequences;
 *  preserves backslash for unknown escapes (e.g. \n → \n).
 *  Returns all fields (no prefix skipping). */
export function splitPipeFields(text: string): string[] {
  const fields: string[] = [];
  let current = "";
  let escaped = false;

  for (const ch of text) {
    if (escaped) {
      if (ch === "|" || ch === ":" || ch === "\\") {
        current += ch;
      } else {
        current += "\\" + ch; // Preserve backslash for unknown escapes
      }
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === "|") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  // Trailing backslash (escaped=true at end) is treated as incomplete escape
  // and silently dropped. Matches splitMemberFields behavior.
  fields.push(current);
  return fields;
}

export function splitFields(record: string): string[] {
  return splitPipeFields(record).slice(1);
}

export function unescapeValue(value: string): string {
  return value
    .replace(/\\\|/g, "|")
    .replace(/\\:/g, ":")
    .replace(/\\\\/g, "\\");
}
