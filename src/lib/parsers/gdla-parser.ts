import { parseVersionHeader, splitPipeFields } from "./shared";

export interface GdlaDomain {
  name: string;
  description: string;
  version: string;
  baseUrl: string;
  line: number;
}

export interface GdlaSchemaField {
  name: string;
  type: string;
  required: string;
  format: string;
  description: string;
  line: number;
}

export interface GdlaSchema {
  name: string;
  description: string;
  fields: GdlaSchemaField[];
  line: number;
}

export interface GdlaParameter {
  name: string;
  location: string;
  type: string;
  required: string;
  description: string;
  line: number;
}

export interface GdlaEndpoint {
  method: string;
  path: string;
  description: string;
  responses: string;
  auth: string;
  params: GdlaParameter[];
  line: number;
}

export interface GdlaAuth {
  scheme: string;
  description: string;
  header: string;
  line: number;
}

export interface GdlaEnum {
  name: string;
  values: string[];
  line: number;
}

export interface GdlaRelationship {
  source: string;
  target: string;
  relType: string;
  via: string;
  line: number;
}

export interface GdlaPath {
  entities: string[];
  via: string;
  line: number;
}

export interface GdlaFile {
  domains: GdlaDomain[];
  schemas: GdlaSchema[];
  endpoints: GdlaEndpoint[];
  auth: GdlaAuth[];
  enums: GdlaEnum[];
  relationships: GdlaRelationship[];
  paths: GdlaPath[];
  version?: import("../types").VersionHeader;
}

export function parseGdla(content: string): GdlaFile {
  const domains: GdlaDomain[] = [];
  const schemas: GdlaSchema[] = [];
  const endpoints: GdlaEndpoint[] = [];
  const auth: GdlaAuth[] = [];
  const enums: GdlaEnum[] = [];
  const relationships: GdlaRelationship[] = [];
  const paths: GdlaPath[] = [];
  let currentSchema: GdlaSchema | null = null;
  let currentEndpoint: GdlaEndpoint | null = null;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    if (line.startsWith("@D ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      domains.push({
        name: parts[0]?.trim() || "",
        description: parts[1]?.trim() || "",
        version: parts[2]?.trim() || "",
        baseUrl: parts[3]?.trim() || "",
        line: i + 1,
      });
      currentSchema = null;
      currentEndpoint = null;
    } else if (line.startsWith("@S ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      currentSchema = {
        name: parts[0]?.trim() || "",
        description: parts.slice(1).join("|").trim(),
        fields: [],
        line: i + 1,
      };
      schemas.push(currentSchema);
      currentEndpoint = null;
    } else if (line.startsWith("@EP ")) {
      const rest = line.substring(4);
      const parts = splitPipeFields(rest);
      // First field is "METHOD /path" — split on first space
      const methodPath = parts[0] || "";
      const spaceIdx = methodPath.indexOf(" ");
      const method = spaceIdx === -1 ? methodPath.trim() : methodPath.substring(0, spaceIdx).trim();
      const epPath = spaceIdx === -1 ? "" : methodPath.substring(spaceIdx + 1).trim();
      currentEndpoint = {
        method,
        path: epPath,
        description: parts[1]?.trim() || "",
        responses: parts[2]?.trim() || "",
        auth: parts[3]?.trim() || "",
        params: [],
        line: i + 1,
      };
      endpoints.push(currentEndpoint);
      currentSchema = null;
    } else if (line.startsWith("@P ")) {
      if (!currentEndpoint) continue; // Orphan — ignore
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      currentEndpoint.params.push({
        name: parts[0]?.trim() || "",
        location: parts[1]?.trim() || "",
        type: parts[2]?.trim() || "",
        required: parts[3]?.trim() || "",
        description: parts.slice(4).join("|").trim(),
        line: i + 1,
      });
    } else if (line.startsWith("@AUTH ")) {
      const rest = line.substring(6);
      const parts = splitPipeFields(rest);
      auth.push({
        scheme: parts[0]?.trim() || "",
        description: parts[1]?.trim() || "",
        header: parts[2]?.trim() || "",
        line: i + 1,
      });
    } else if (line.startsWith("@ENUM ")) {
      const rest = line.substring(6);
      const parts = splitPipeFields(rest);
      const values = parts[1] ? parts[1].split(",").map((v) => v.trim()) : [];
      enums.push({
        name: parts[0]?.trim() || "",
        values,
        line: i + 1,
      });
    } else if (line.startsWith("@R ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      const arrow = parts[0] || "";
      const [src, tgt] = arrow.split("->").map((s) => s.trim());
      relationships.push({
        source: src || "",
        target: tgt || "",
        relType: parts[1]?.trim() || "",
        via: parts.slice(2).join("|").trim(),
        line: i + 1,
      });
    } else if (line.startsWith("@PATH ")) {
      const rest = line.substring(6);
      const parts = splitPipeFields(rest);
      const entities = (parts[0] || "").split("->").map((e) => e.trim());
      paths.push({
        entities,
        via: parts.slice(1).join("|").trim(),
        line: i + 1,
      });
    } else if (raw.startsWith(" ") && currentSchema && !line.startsWith("@")) {
      // Indented line: schema field bound to currentSchema
      const parts = splitPipeFields(line);
      if (parts.length >= 2) {
        currentSchema.fields.push({
          name: parts[0]?.trim() || "",
          type: parts[1]?.trim() || "",
          required: parts[2]?.trim() || "",
          format: parts[3]?.trim() || "",
          description: parts.slice(4).join("|").trim(),
          line: i + 1,
        });
      }
    }
  }

  const version = parseVersionHeader(content) || undefined;

  return { domains, schemas, endpoints, auth, enums, relationships, paths, version };
}
