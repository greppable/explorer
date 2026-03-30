import { parseVersionHeader, splitPipeFields } from "./shared";

export interface GdlcPackage {
  name: string;
  description: string;
  line: number;
}

export interface GdlcMember {
  name: string;
  kind: string;
  visibility: string;
  returnType: string;
  params: string;
  description: string;
  line: number;
}

export interface GdlcModule {
  name: string;
  description: string;
  package: string;
  members: GdlcMember[];
  line: number;
}

export interface GdlcRelationship {
  source: string;
  target: string;
  relType: string;
  description: string;
  line: number;
}

export interface GdlcPath {
  entities: string[];
  pathType: string;
  description: string;
  line: number;
}

export interface GdlcEnum {
  module: string;
  member: string;
  values: string[];
  description: string;
  line: number;
}

export interface GdlcFile {
  packages: GdlcPackage[];
  modules: GdlcModule[];
  relationships: GdlcRelationship[];
  paths: GdlcPath[];
  enums: GdlcEnum[];
  version?: import("../types").VersionHeader;
}

export function parseGdlc(content: string): GdlcFile {
  const packages: GdlcPackage[] = [];
  const modules: GdlcModule[] = [];
  const relationships: GdlcRelationship[] = [];
  const paths: GdlcPath[] = [];
  const enums: GdlcEnum[] = [];
  let currentPackage = "";
  let currentModule: GdlcModule | null = null;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    if (line.startsWith("@D ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      const name = parts[0].trim();
      const desc = parts.slice(1).join("|").trim();
      currentPackage = name;
      packages.push({ name, description: desc, line: i + 1 });
      currentModule = null;
    } else if (line.startsWith("@T ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      const name = parts[0].trim();
      const desc = parts.slice(1).join("|").trim();
      currentModule = {
        name,
        description: desc,
        package: currentPackage,
        members: [],
        line: i + 1,
      };
      modules.push(currentModule);
    } else if (line.startsWith("@R ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      const arrow = parts[0];
      const [src, tgt] = arrow.split("->").map((s) => s.trim());
      relationships.push({
        source: src,
        target: tgt,
        relType: parts[1]?.trim() || "",
        description: parts.slice(2).join("|").trim(),
        line: i + 1,
      });
    } else if (line.startsWith("@PATH ")) {
      const rest = line.substring(6);
      const parts = splitPipeFields(rest);
      const entities = parts[0].split("->").map((e) => e.trim());
      paths.push({
        entities,
        pathType: parts[1]?.trim() || "",
        description: parts.slice(2).join("|").trim(),
        line: i + 1,
      });
    } else if (line.startsWith("@E ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      const [mod, member] = parts[0].split(".");
      if (!member) continue;
      const values = parts[1] ? parts[1].split(",").map((v) => v.trim()) : [];
      enums.push({
        module: mod.trim(),
        member: member.trim(),
        values,
        description: parts.slice(2).join("|").trim(),
        line: i + 1,
      });
    } else if (currentModule && !line.startsWith("@")) {
      // Member line: NAME|KIND|VISIBILITY|RETURN|PARAMS|DESCRIPTION
      const fields = splitPipeFields(line);
      if (fields.length >= 2) {
        currentModule.members.push({
          name: fields[0]?.trim() || "",
          kind: fields[1]?.trim() || "",
          visibility: fields[2]?.trim() || "",
          returnType: fields[3]?.trim() || "",
          params: fields[4]?.trim() || "",
          description: fields.slice(5).join("|").trim(),
          line: i + 1,
        });
      }
    }
  }

  const version = parseVersionHeader(content) || undefined;

  return { packages, modules, relationships, paths, enums, version };
}
