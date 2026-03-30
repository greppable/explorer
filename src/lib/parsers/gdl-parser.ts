import { splitFields, unescapeValue, getRecordType } from "./shared";

export interface GdlRecord {
  type: string;
  fields: Record<string, string>;
  line: number;
  raw: string;
}

export interface GdlFile {
  records: GdlRecord[];
  recordTypes: string[];
  fieldNames: string[];
}

export function parseGdl(content: string): GdlFile {
  const records: GdlRecord[] = [];
  const typeSet = new Set<string>();
  const fieldSet = new Set<string>();

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || !line.startsWith("@")) continue;

    const type = getRecordType(line);
    typeSet.add(type);

    const fields: Record<string, string> = {};
    const fieldArray = splitFields(line);

    for (const field of fieldArray) {
      const colonIdx = field.indexOf(":");
      if (colonIdx !== -1) {
        const key = field.substring(0, colonIdx);
        const value = unescapeValue(field.substring(colonIdx + 1));
        fields[key] = value;
        fieldSet.add(key);
      }
    }

    records.push({ type, fields, line: i + 1, raw: line });
  }

  return {
    records,
    recordTypes: [...typeSet],
    fieldNames: [...fieldSet],
  };
}
