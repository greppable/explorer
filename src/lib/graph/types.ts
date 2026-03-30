/**
 * Node type taxonomy for the knowledge graph.
 *
 * Maps GDL record roles to visual categories:
 * - schema:   gdls tables, domains, columns, enums
 * - code:     gdlc modules, packages, relationships
 * - diagram:  gdld nodes, components, groups, deploy/infra
 * - memory:   gdlm memories, anchors
 * - api:      gdla endpoints, schemas, auth
 * - document: gdlu sources, sections, extracts
 * - data:     gdl record types, record IDs
 */
export type GraphNodeType =
  | "schema"
  | "code"
  | "diagram"
  | "memory"
  | "api"
  | "document"
  | "data";

export interface GdlGraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  metadata: Record<string, string>;
}

export interface GdlGraphEdge {
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface GraphData {
  nodes: GdlGraphNode[];
  edges: GdlGraphEdge[];
  stats: {
    fileCount: number;
    entityCount: number;
    crossRefCount: number;
  };
}
