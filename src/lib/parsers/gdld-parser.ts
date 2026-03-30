import { getField, getRecordType, parseVersionHeader } from "./shared";
import type { VersionHeader } from "../types";

// --- Type definitions ---

export type DiagramType = string; // "flow" | "sequence" | "deployment" | "pattern" | "concept" | "state" | "decision" | ...
export type NodeShape = "box" | "diamond" | "stadium" | "circle" | "hexagon" | "database" | "subroutine";
export type NodeStatus = "active" | "deprecated" | "planned";
export type EdgeStyle = "solid" | "dashed" | "dotted" | "thick";
export type MessageType = "request" | "response" | "async" | "self";
export type BlockType = "opt" | "alt" | "loop" | "par";

export interface DiagramMeta {
  id: string;
  type: DiagramType;
  purpose: string;
  direction: string;
  profile?: string;
  version?: string;
}

export interface GdldNode {
  id: string;
  label: string;
  shape: NodeShape;
  group: string | null;
  status: NodeStatus | null;
  role?: string;
  pattern?: string;
  tags: string[];
  line: number;
}

export interface GdldEdge {
  from: string;
  to: string;
  label: string | null;
  style: EdgeStyle;
  status: NodeStatus | null;
  type?: string;
  tags?: string[];
  bidirectional: boolean;
  line: number;
}

export interface GdldGroup {
  id: string;
  label: string;
  parent: string | null;
  line: number;
}

export interface Participant {
  id: string;
  label: string;
  role: string | null;
  line: number;
}

export interface SequenceElement {
  type: "msg" | "block" | "endblock" | "else" | "and" | "seq-note";
  from?: string;
  to?: string;
  label?: string;
  msgType?: MessageType;
  activate?: boolean;
  deactivate?: boolean;
  blockType?: BlockType;
  blockId?: string;
  over?: string;
  text?: string;
  line: number;
}

export interface ContextData {
  useWhen: { condition: string; threshold?: string; detail?: string }[];
  useNot: { condition: string; reason?: string }[];
  components: { name: string; file?: string; does?: string }[];
  config: { param: string; value: string; note?: string }[];
  gotchas: { issue: string; detail?: string; fix?: string; severity?: string }[];
  recovery: { issue: string; means?: string; fix?: string; severity?: string }[];
  entries: { useCase: string; command?: string; endpoint?: string }[];
  decisions: { id: string; title: string; status: string; reason?: string }[];
  notes: { context: string; text: string }[];
  patterns: { name: string; file?: string; for?: string }[];
}

export interface Scenario {
  id: string;
  inherits?: string;
  line: number;
}

export interface View {
  id: string;
  filter?: string;
  includes?: string;
  excludes?: string;
  level?: string;
  scenario?: string;
  line: number;
}

export interface Override {
  scenario: string;
  target: string;
  field: string;
  value: string;
  line: number;
}

export interface Exclude {
  scenario: string;
  target: string;
  line: number;
}

export interface GdldInclude {
  file: string;
  prefix: string | null;
  records: string | null;
  line: number;
}

export interface DeployEnv {
  id: string;
  label: string;
  provider?: string;
  line: number;
}

export interface DeployNode {
  id: string;
  label: string;
  env: string;
  parent: string | null;
  technology?: string;
  tags?: string[];
  line: number;
}

export interface DeployInstance {
  component: string;
  node: string;
  instances: string | null;
  config?: string;
  line: number;
}

export interface InfraNode {
  id: string;
  label: string;
  node: string;
  technology?: string;
  tags?: string[];
  line: number;
}

export interface GdldModel {
  diagram: DiagramMeta;
  version?: VersionHeader;
  nodes: GdldNode[];
  edges: GdldEdge[];
  groups: GdldGroup[];
  participants: Participant[];
  sequenceElements: SequenceElement[];
  context: ContextData;
  scenarios: Scenario[];
  views: View[];
  overrides: Override[];
  excludes: Exclude[];
  includes: GdldInclude[];
  deployEnvs: DeployEnv[];
  deployNodes: DeployNode[];
  deployInstances: DeployInstance[];
  infraNodes: InfraNode[];
}

// --- Parser ---

export function parseGdld(content: string): GdldModel {
  const model: GdldModel = {
    diagram: { id: "", type: "flow", purpose: "", direction: "TD" },
    nodes: [],
    edges: [],
    groups: [],
    participants: [],
    sequenceElements: [],
    context: {
      useWhen: [], useNot: [], components: [], config: [],
      gotchas: [], recovery: [], entries: [], decisions: [],
      notes: [], patterns: [],
    },
    scenarios: [],
    views: [],
    overrides: [],
    excludes: [],
    includes: [],
    deployEnvs: [],
    deployNodes: [],
    deployInstances: [],
    infraNodes: [],
  };

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    if (!line.startsWith("@")) continue;

    const lineNum = i + 1;
    const recordType = getRecordType(line);

    switch (recordType) {
      case "diagram":
        model.diagram = {
          id: getField(line, "id") || "",
          type: (getField(line, "type") || "flow") as DiagramType,
          purpose: getField(line, "purpose") || "",
          direction: getField(line, "direction") || "TD",
          profile: getField(line, "profile") || undefined,
          version: getField(line, "version") || undefined,
        };
        break;
      case "node":
        model.nodes.push({
          id: getField(line, "id") || "",
          label: getField(line, "label") || getField(line, "id") || "",
          shape: (getField(line, "shape") || "box") as NodeShape,
          group: getField(line, "group") || null,
          status: (getField(line, "status") as NodeStatus) || null,
          role: getField(line, "role") || undefined,
          pattern: getField(line, "pattern") || undefined,
          tags: getField(line, "tags")?.split(",").map((t) => t.trim()) || [],
          line: lineNum,
        });
        break;
      case "edge":
        model.edges.push({
          from: getField(line, "from") || "",
          to: getField(line, "to") || "",
          label: getField(line, "label") || null,
          style: (getField(line, "style") || "solid") as EdgeStyle,
          status: (getField(line, "status") as NodeStatus) || null,
          type: getField(line, "type") || undefined,
          tags: getField(line, "tags")?.split(",").map((t) => t.trim()) || undefined,
          bidirectional: getField(line, "bidirectional") === "true",
          line: lineNum,
        });
        break;
      case "group":
        model.groups.push({
          id: getField(line, "id") || "",
          label: getField(line, "label") || getField(line, "id") || "",
          parent: getField(line, "parent") || null,
          line: lineNum,
        });
        break;
      case "participant":
        model.participants.push({
          id: getField(line, "id") || "",
          label: getField(line, "label") || getField(line, "id") || "",
          role: getField(line, "role") || null,
          line: lineNum,
        });
        break;
      case "msg":
        model.sequenceElements.push({
          type: "msg",
          from: getField(line, "from") || "",
          to: getField(line, "to") || "",
          label: getField(line, "label") || "",
          msgType: (getField(line, "type") as MessageType) || "request",
          activate: getField(line, "activate") === "true",
          deactivate: getField(line, "deactivate") === "true",
          line: lineNum,
        });
        break;
      case "block":
        model.sequenceElements.push({
          type: "block",
          blockType: (getField(line, "type") as BlockType) || "opt",
          label: getField(line, "label") || "",
          blockId: getField(line, "id") || undefined,
          line: lineNum,
        });
        break;
      case "endblock":
        model.sequenceElements.push({ type: "endblock", line: lineNum });
        break;
      case "else":
        model.sequenceElements.push({
          type: "else",
          label: getField(line, "label") || "",
          blockId: getField(line, "block") || undefined,
          line: lineNum,
        });
        break;
      case "and":
        model.sequenceElements.push({
          type: "and",
          label: getField(line, "label") || "",
          blockId: getField(line, "block") || undefined,
          line: lineNum,
        });
        break;
      case "seq-note":
        model.sequenceElements.push({
          type: "seq-note",
          over: getField(line, "over") || "",
          text: getField(line, "text") || "",
          line: lineNum,
        });
        break;
      case "use-when":
        model.context.useWhen.push({
          condition: getField(line, "condition") || "",
          threshold: getField(line, "threshold") || undefined,
          detail: getField(line, "detail") || undefined,
        });
        break;
      case "use-not":
        model.context.useNot.push({
          condition: getField(line, "condition") || "",
          reason: getField(line, "reason") || undefined,
        });
        break;
      case "component":
        model.context.components.push({
          name: getField(line, "name") || "",
          file: getField(line, "file") || undefined,
          does: getField(line, "does") || undefined,
        });
        break;
      case "config":
        model.context.config.push({
          param: getField(line, "param") || "",
          value: getField(line, "value") || "",
          note: getField(line, "note") || undefined,
        });
        break;
      case "gotcha":
        model.context.gotchas.push({
          issue: getField(line, "issue") || "",
          detail: getField(line, "detail") || undefined,
          fix: getField(line, "fix") || undefined,
          severity: getField(line, "severity") || undefined,
        });
        break;
      case "recovery":
        model.context.recovery.push({
          issue: getField(line, "issue") || "",
          means: getField(line, "means") || undefined,
          fix: getField(line, "fix") || undefined,
          severity: getField(line, "severity") || undefined,
        });
        break;
      case "entry":
        model.context.entries.push({
          useCase: getField(line, "use-case") || "",
          command: getField(line, "command") || undefined,
          endpoint: getField(line, "endpoint") || undefined,
        });
        break;
      case "decision":
        model.context.decisions.push({
          id: getField(line, "id") || "",
          title: getField(line, "title") || "",
          status: getField(line, "status") || "",
          reason: getField(line, "reason") || undefined,
        });
        break;
      case "note":
        model.context.notes.push({
          context: getField(line, "context") || "",
          text: getField(line, "text") || "",
        });
        break;
      case "pattern":
        model.context.patterns.push({
          name: getField(line, "name") || "",
          file: getField(line, "file") || undefined,
          for: getField(line, "for") || undefined,
        });
        break;
      case "scenario":
        model.scenarios.push({
          id: getField(line, "id") || "",
          inherits: getField(line, "inherits") || undefined,
          line: lineNum,
        });
        break;
      case "view":
        model.views.push({
          id: getField(line, "id") || "",
          filter: getField(line, "filter") || undefined,
          includes: getField(line, "includes") || undefined,
          excludes: getField(line, "excludes") || undefined,
          level: getField(line, "level") || undefined,
          scenario: getField(line, "scenario") || undefined,
          line: lineNum,
        });
        break;
      case "override":
        model.overrides.push({
          scenario: getField(line, "scenario") || "",
          target: getField(line, "target") || "",
          field: getField(line, "field") || "",
          value: getField(line, "value") || "",
          line: lineNum,
        });
        break;
      case "exclude":
        model.excludes.push({
          scenario: getField(line, "scenario") || "",
          target: getField(line, "target") || "",
          line: lineNum,
        });
        break;
      case "include":
        model.includes.push({
          file: getField(line, "file") || "",
          prefix: getField(line, "prefix") || null,
          records: getField(line, "records") || null,
          line: lineNum,
        });
        break;
      case "deploy-env":
        model.deployEnvs.push({
          id: getField(line, "id") || "",
          label: getField(line, "label") || "",
          provider: getField(line, "provider") || undefined,
          line: lineNum,
        });
        break;
      case "deploy-node":
        model.deployNodes.push({
          id: getField(line, "id") || "",
          label: getField(line, "label") || "",
          env: getField(line, "env") || "",
          parent: getField(line, "parent") || null,
          technology: getField(line, "technology") || undefined,
          tags: getField(line, "tags")?.split(",").map((t) => t.trim()) || undefined,
          line: lineNum,
        });
        break;
      case "deploy-instance":
        model.deployInstances.push({
          component: getField(line, "component") || "",
          node: getField(line, "node") || "",
          instances: getField(line, "instances") || null,
          config: getField(line, "config") || undefined,
          line: lineNum,
        });
        break;
      case "infra-node":
        model.infraNodes.push({
          id: getField(line, "id") || "",
          label: getField(line, "label") || "",
          node: getField(line, "node") || "",
          technology: getField(line, "technology") || undefined,
          tags: getField(line, "tags")?.split(",").map((t) => t.trim()) || undefined,
          line: lineNum,
        });
        break;
    }
  }

  const versionHeader = parseVersionHeader(content);
  if (versionHeader) {
    model.version = versionHeader;
  }

  return model;
}
