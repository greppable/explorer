import { parseVersionHeader, splitPipeFields } from "./shared";

export interface GdlsDomain {
  name: string;
  description: string;
  line: number;
}

export interface GdlsColumn {
  name: string;
  type: string;
  nullable: string;
  key: string;
  description: string;
  line: number;
}

export interface GdlsTable {
  name: string;
  description: string;
  domain: string;
  columns: GdlsColumn[];
  line: number;
}

export interface GdlsRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  relType: string;
  description: string;
  line: number;
}

export interface GdlsPath {
  tables: string[];
  description: string;
  line: number;
}

export interface GdlsEnum {
  table: string;
  column: string;
  values: string[];
  description: string;
  line: number;
}

export interface GdlsMeta {
  tier: string;
  description: string;
  tableCount: number;
  line: number;
}

export interface GdlsDomainRef {
  name: string;
  path: string;
  description: string;
  tableCount: number;
  line: number;
}

export interface GdlsTableList {
  domain: string;
  tables: string[];
  line: number;
}

export interface GdlsFile {
  domains: GdlsDomain[];
  tables: GdlsTable[];
  relationships: GdlsRelationship[];
  paths: GdlsPath[];
  enums: GdlsEnum[];
  meta: GdlsMeta[];
  domainRefs: GdlsDomainRef[];
  tableLists: GdlsTableList[];
  version?: import("../types").VersionHeader;
}

export function parseGdls(content: string): GdlsFile {
  const domains: GdlsDomain[] = [];
  const tables: GdlsTable[] = [];
  const relationships: GdlsRelationship[] = [];
  const paths: GdlsPath[] = [];
  const enums: GdlsEnum[] = [];
  const meta: GdlsMeta[] = [];
  const domainRefs: GdlsDomainRef[] = [];
  const tableLists: GdlsTableList[] = [];
  let currentDomain = "";
  let currentTable: GdlsTable | null = null;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    if (line.startsWith("@D ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      currentDomain = parts[0].trim();
      domains.push({
        name: currentDomain,
        description: parts.slice(1).join("|").trim(),
        line: i + 1,
      });
      currentTable = null;
    } else if (line.startsWith("@T ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      currentTable = {
        name: parts[0].trim(),
        description: parts.slice(1).join("|").trim(),
        domain: currentDomain,
        columns: [],
        line: i + 1,
      };
      tables.push(currentTable);
    } else if (line.startsWith("@R ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      const arrow = parts[0];
      const [src, tgt] = arrow.split("->").map((s) => s.trim());
      const [srcTable, srcCol] = src.split(".");
      const [tgtTable, tgtCol] = tgt.split(".");
      relationships.push({
        sourceTable: srcTable,
        sourceColumn: srcCol,
        targetTable: tgtTable,
        targetColumn: tgtCol,
        relType: parts[1]?.trim() || "",
        description: parts.slice(2).join("|").trim(),
        line: i + 1,
      });
    } else if (line.startsWith("@PATH ")) {
      const rest = line.substring(6);
      const parts = splitPipeFields(rest);
      const pathTables = parts[0].split("->").map((t) => t.trim());
      paths.push({
        tables: pathTables,
        description: parts.slice(1).join("|").trim(),
        line: i + 1,
      });
    } else if (line.startsWith("@E ")) {
      const rest = line.substring(3);
      const parts = splitPipeFields(rest);
      const [table, column] = parts[0].split(".");
      if (!column) continue;
      const values = parts[1] ? parts[1].split(",").map((v) => v.trim()) : [];
      enums.push({
        table: table.trim(),
        column: column.trim(),
        values,
        description: parts.slice(2).join("|").trim(),
        line: i + 1,
      });
    } else if (line.startsWith("@META ")) {
      const rest = line.substring(6);
      const parts = splitPipeFields(rest);
      meta.push({
        tier: parts[0]?.trim() || "",
        description: parts[1]?.trim() || "",
        tableCount: parseInt(parts[2]?.trim() || "0", 10) || 0,
        line: i + 1,
      });
      currentTable = null;
    } else if (line.startsWith("@DOMAIN ")) {
      const rest = line.substring(8);
      const parts = splitPipeFields(rest);
      domainRefs.push({
        name: parts[0]?.trim() || "",
        path: parts[1]?.trim() || "",
        description: parts[2]?.trim() || "",
        tableCount: parseInt(parts[3]?.trim() || "0", 10) || 0,
        line: i + 1,
      });
      currentTable = null;
    } else if (line.startsWith("@TABLES ")) {
      const rest = line.substring(8);
      const parts = splitPipeFields(rest);
      const [domain, tableList] = [parts[0], parts[1]];
      tableLists.push({
        domain: domain?.trim() || "",
        tables: tableList ? tableList.split(",").map((t) => t.trim()) : [],
        line: i + 1,
      });
      currentTable = null;
    } else if (currentTable && !line.startsWith("@")) {
      // Column definition: NAME|TYPE|NULLABLE|KEY|DESCRIPTION
      const parts = splitPipeFields(line);
      if (parts.length >= 2) {
        currentTable.columns.push({
          name: parts[0].trim(),
          type: parts[1].trim(),
          nullable: parts[2]?.trim() || "",
          key: parts[3]?.trim() || "",
          description: parts.slice(4).join("|").trim(),
          line: i + 1,
        });
      }
    }
  }

  const version = parseVersionHeader(content) || undefined;

  return { domains, tables, relationships, paths, enums, meta, domainRefs, tableLists, version };
}
