import type { GraphNodeType } from "@/lib/graph/types";

// ─── Brand palette ──────────────────────────────────────────────────────

export const BRAND = {
  primary: "#8470FF",
  primaryMuted: "rgba(132,112,255,0.5)",
  neutralMuted: "rgba(100,116,139,0.4)",
};

// ─── Node type config ───────────────────────────────────────────────────

export const ALL_NODE_TYPES: GraphNodeType[] = [
  "schema", "api", "code", "diagram", "memory", "data", "document",
];

export const NODE_STYLES: Record<string, { intensity: "high" | "medium" | "low" }> = {
  schema:   { intensity: "high" },
  api:      { intensity: "high" },
  code:     { intensity: "high" },
  memory:   { intensity: "high" },
  diagram:  { intensity: "medium" },
  data:     { intensity: "medium" },
  document: { intensity: "low" },
};
