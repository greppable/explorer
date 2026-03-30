import type { GdlFormat } from "../types";
import { getField, getRecordType, splitPipeFields } from "./shared";

export { getField, getRecordType, parseVersionHeader, splitPipeFields } from "./shared";
export { parseGdl } from "./gdl-parser";
export { parseGdls } from "./gdls-parser";
export { parseGdlm } from "./gdlm-parser";
export { parseGdld } from "./gdld-parser";
export { parseGdlc } from "./gdlc-parser";
export { parseGdlu } from "./gdlu-parser";
export { parseGdla } from "./gdla-parser";
export type {
  GdldModel, GdldNode, GdldEdge, GdldGroup, DiagramType,
  Participant, SequenceElement, ContextData,
  GdldInclude, DeployEnv, DeployNode, DeployInstance, InfraNode,
} from "./gdld-parser";
export type {
  GdlcFile, GdlcModule, GdlcMember, GdlcRelationship, GdlcPath, GdlcPackage, GdlcEnum,
} from "./gdlc-parser";
export type {
  GdluFile, GdluSource, GdluSection, GdluExtract,
} from "./gdlu-parser";
export type {
  GdlmFile, GdlmMemory, GdlmAnchor,
} from "./gdlm-parser";
export type {
  GdlsMeta, GdlsDomainRef, GdlsTableList,
} from "./gdls-parser";
export type {
  GdlaFile, GdlaDomain, GdlaSchema, GdlaSchemaField, GdlaEndpoint,
  GdlaParameter, GdlaAuth, GdlaEnum, GdlaRelationship, GdlaPath,
} from "./gdla-parser";

export interface EntityOccurrence {
  entity: string;
  file: string;
  format: GdlFormat;
  line: number;
  context: string;
  role: string;
}

export function extractEntities(
  content: string,
  format: GdlFormat,
  filePath: string
): EntityOccurrence[] {
  const occurrences: EntityOccurrence[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || !line.startsWith("@")) continue;

    const lineNum = i + 1;

    switch (format) {
      case "gdl": {
        const id = getField(line, "id");
        if (id) occurrences.push({ entity: id, file: filePath, format, line: lineNum, context: line, role: "record_id" });
        const type = getRecordType(line);
        if (type) occurrences.push({ entity: type, file: filePath, format, line: lineNum, context: line, role: "record_type" });
        break;
      }
      case "gdls": {
        if (line.startsWith("@D ")) {
          const name = splitPipeFields(line.substring(3))[0].trim();
          if (name) occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "domain" });
        } else if (line.startsWith("@T ")) {
          const name = splitPipeFields(line.substring(3))[0].trim();
          if (name) occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "table_definition" });
        } else if (line.startsWith("@E ")) {
          const tableCol = splitPipeFields(line.substring(3))[0];
          const table = tableCol.split(".")[0];
          if (table) occurrences.push({ entity: table, file: filePath, format, line: lineNum, context: line, role: "enum" });
        } else if (line.startsWith("@R ")) {
          const arrow = splitPipeFields(line.substring(3))[0];
          const [src, tgt] = arrow.split("->").map((s) => s.trim());
          const srcTable = src.split(".")[0];
          const tgtTable = tgt.split(".")[0];
          if (srcTable) occurrences.push({ entity: srcTable, file: filePath, format, line: lineNum, context: line, role: "relationship_source" });
          if (tgtTable && tgtTable !== srcTable) occurrences.push({ entity: tgtTable, file: filePath, format, line: lineNum, context: line, role: "relationship_target" });
        } else if (line.startsWith("@DOMAIN ")) {
          const name = splitPipeFields(line.substring(8))[0].trim();
          if (name) occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "domain_ref" });
        } else if (line.startsWith("@TABLES ")) {
          const parts = splitPipeFields(line.substring(8));
          const [domain, tableList] = [parts[0], parts[1]];
          if (domain?.trim()) occurrences.push({ entity: domain.trim(), file: filePath, format, line: lineNum, context: line, role: "table_list_domain" });
          if (tableList) {
            for (const table of tableList.split(",").map((t) => t.trim())) {
              if (table) occurrences.push({ entity: table, file: filePath, format, line: lineNum, context: line, role: "table_list_entry" });
            }
          }
        } else if (line.startsWith("@META ")) {
          const tier = splitPipeFields(line.substring(6))[0].trim();
          if (tier) occurrences.push({ entity: tier, file: filePath, format, line: lineNum, context: line, role: "meta_tier" });
        }
        break;
      }
      case "gdld": {
        // Basic entity extraction for cross-referencing; full GDLD parser deferred to Phase 2
        const id = getField(line, "id");
        const name = getField(line, "name");
        const recordType = getRecordType(line);
        if (recordType === "node" && id) {
          occurrences.push({ entity: id, file: filePath, format, line: lineNum, context: line, role: "node" });
        } else if (recordType === "component" && name) {
          occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "component" });
        } else if (recordType === "group" && id) {
          occurrences.push({ entity: id, file: filePath, format, line: lineNum, context: line, role: "group" });
        } else if (recordType === "include") {
          const file = getField(line, "file");
          if (file) occurrences.push({ entity: file, file: filePath, format, line: lineNum, context: line, role: "include_file" });
        } else if (recordType === "deploy-env" && id) {
          occurrences.push({ entity: id, file: filePath, format, line: lineNum, context: line, role: "deploy_env" });
        } else if (recordType === "deploy-node" && id) {
          occurrences.push({ entity: id, file: filePath, format, line: lineNum, context: line, role: "deploy_node" });
        } else if (recordType === "deploy-instance") {
          const component = getField(line, "component");
          if (component) occurrences.push({ entity: component, file: filePath, format, line: lineNum, context: line, role: "deploy_instance" });
        } else if (recordType === "infra-node" && id) {
          occurrences.push({ entity: id, file: filePath, format, line: lineNum, context: line, role: "infra_node" });
        }
        break;
      }
      case "gdlm": {
        const recordType = getRecordType(line);
        if (recordType === "memory") {
          const subject = getField(line, "subject");
          if (subject) occurrences.push({ entity: subject, file: filePath, format, line: lineNum, context: line, role: "memory_subject" });
          const relates = getField(line, "relates");
          if (relates) occurrences.push({ entity: relates, file: filePath, format, line: lineNum, context: line, role: "memory_relation" });
        } else if (recordType === "anchor") {
          const concept = getField(line, "concept");
          if (concept) occurrences.push({ entity: concept, file: filePath, format, line: lineNum, context: line, role: "anchor_concept" });
          const scopeRaw = getField(line, "scope");
          if (scopeRaw) {
            for (const keyword of scopeRaw.split(",").map((s) => s.trim())) {
              if (keyword) occurrences.push({ entity: keyword, file: filePath, format, line: lineNum, context: line, role: "anchor_scope" });
            }
          }
        }
        break;
      }
      case "gdlc": {
        if (line.startsWith("@D ")) {
          const name = splitPipeFields(line.substring(3))[0].trim();
          if (name) occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "package" });
        } else if (line.startsWith("@T ")) {
          const name = splitPipeFields(line.substring(3))[0].trim();
          if (name) occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "module_definition" });
        } else if (line.startsWith("@R ")) {
          const arrow = splitPipeFields(line.substring(3))[0];
          const [src, tgt] = arrow.split("->").map((s) => s.trim());
          const srcModule = src.split(".")[0];
          const tgtModule = tgt.split(".")[0];
          if (srcModule) occurrences.push({ entity: srcModule, file: filePath, format, line: lineNum, context: line, role: "relationship_source" });
          if (tgtModule && tgtModule !== srcModule) occurrences.push({ entity: tgtModule, file: filePath, format, line: lineNum, context: line, role: "relationship_target" });
        } else if (line.startsWith("@PATH ")) {
          const rest = splitPipeFields(line.substring(6))[0];
          const entities = rest.split("->").map((e) => e.trim());
          for (const ent of entities) {
            if (ent) occurrences.push({ entity: ent, file: filePath, format, line: lineNum, context: line, role: "path_member" });
          }
        } else if (line.startsWith("@E ")) {
          const moduleMember = splitPipeFields(line.substring(3))[0];
          const mod = moduleMember.split(".")[0];
          if (mod) occurrences.push({ entity: mod, file: filePath, format, line: lineNum, context: line, role: "enum" });
        }
        break;
      }
      case "gdla": {
        if (line.startsWith("@D ")) {
          const name = splitPipeFields(line.substring(3))[0].trim();
          if (name) occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "api_domain" });
        } else if (line.startsWith("@S ")) {
          const name = splitPipeFields(line.substring(3))[0].trim();
          if (name) occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "schema_definition" });
        } else if (line.startsWith("@EP ")) {
          const methodPath = splitPipeFields(line.substring(4))[0].trim();
          if (methodPath) occurrences.push({ entity: methodPath, file: filePath, format, line: lineNum, context: line, role: "endpoint" });
        } else if (line.startsWith("@AUTH ")) {
          const scheme = splitPipeFields(line.substring(6))[0].trim();
          if (scheme) occurrences.push({ entity: scheme, file: filePath, format, line: lineNum, context: line, role: "auth_scheme" });
        } else if (line.startsWith("@ENUM ")) {
          const name = splitPipeFields(line.substring(6))[0].trim();
          if (name) occurrences.push({ entity: name, file: filePath, format, line: lineNum, context: line, role: "enum" });
        } else if (line.startsWith("@R ")) {
          const arrow = splitPipeFields(line.substring(3))[0];
          const [src, tgt] = arrow.split("->").map((s) => s.trim());
          if (src) occurrences.push({ entity: src, file: filePath, format, line: lineNum, context: line, role: "relationship_source" });
          if (tgt && tgt !== src) occurrences.push({ entity: tgt, file: filePath, format, line: lineNum, context: line, role: "relationship_target" });
        } else if (line.startsWith("@PATH ")) {
          const rest = splitPipeFields(line.substring(6))[0];
          const entities = rest.split("->").map((e) => e.trim());
          for (const ent of entities) {
            if (ent) occurrences.push({ entity: ent, file: filePath, format, line: lineNum, context: line, role: "path_member" });
          }
        }
        break;
      }
      case "gdlu": {
        const id = getField(line, "id");
        const recordType = getRecordType(line);
        if (recordType === "source" && id) {
          occurrences.push({ entity: id, file: filePath, format, line: lineNum, context: line, role: "source_document" });
          const type = getField(line, "type");
          if (type) occurrences.push({ entity: type, file: filePath, format, line: lineNum, context: line, role: "content_type" });
        } else if (recordType === "section" && id) {
          occurrences.push({ entity: id, file: filePath, format, line: lineNum, context: line, role: "section" });
        } else if (recordType === "extract") {
          const key = getField(line, "key");
          if (key) occurrences.push({ entity: key, file: filePath, format, line: lineNum, context: line, role: "extraction_key" });
          const kind = getField(line, "kind");
          if (kind) occurrences.push({ entity: kind, file: filePath, format, line: lineNum, context: line, role: "extraction_kind" });
        }
        break;
      }
    }
  }

  return occurrences;
}
