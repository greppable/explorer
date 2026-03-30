"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { GraphNodeType } from "@/lib/graph/types";
import { BRAND, NODE_STYLES } from "./constants";

const BRAND_GLOW = "rgba(132,112,255,0.2)";
const NEUTRAL = "#64748b";

function getNodeStyle(type: string, selected?: boolean) {
  const style = NODE_STYLES[type] ?? { intensity: "low" };

  const border = style.intensity === "high"
    ? `rgba(132,112,255,${selected ? 0.8 : 0.45})`
    : style.intensity === "medium"
      ? `rgba(132,112,255,${selected ? 0.7 : 0.3})`
      : `rgba(100,116,139,${selected ? 0.5 : 0.3})`;

  const bg = style.intensity === "high"
    ? selected ? "rgba(132,112,255,0.12)" : "rgba(132,112,255,0.06)"
    : style.intensity === "medium"
      ? selected ? "rgba(132,112,255,0.10)" : "rgba(132,112,255,0.04)"
      : selected ? "rgba(100,116,139,0.10)" : "rgba(100,116,139,0.04)";

  const accentColor = style.intensity === "low" ? NEUTRAL : BRAND.primary;
  const shadow = selected
    ? `0 0 0 2px ${border}, 0 0 16px ${BRAND_GLOW}`
    : "0 1px 4px rgba(0,0,0,0.03)";

  return { border, bg, accentColor, shadow };
}

// ─── Node data type ─────────────────────────────────────────────────────

export type GdlNodeData = {
  label: string;
  nodeType: GraphNodeType;
  metadata: Record<string, string>;
  selected?: boolean;
};

// ─── Component ──────────────────────────────────────────────────────────

export function GdlNodeComponent({ data }: NodeProps<Node<GdlNodeData>>) {
  const style = getNodeStyle(data.nodeType, data.selected);

  return (
    <>
      <Handle type="target" position={Position.Top} className="!invisible" />

      <div
        className="group rounded-xl border px-3 py-2 transition-all duration-200 hover:scale-[1.02]"
        style={{
          borderColor: style.border,
          backgroundColor: style.bg,
          boxShadow: style.shadow,
          minWidth: 110,
          maxWidth: 220,
        }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: style.accentColor, opacity: data.selected ? 1 : 0.7 }}
          />
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: style.accentColor, opacity: 0.8 }}
          >
            {data.nodeType}
          </span>
        </div>

        <div className="mt-0.5 text-[11px] font-medium leading-snug text-foreground/85 line-clamp-2">
          {data.label}
        </div>

        {data.metadata?.detail && (
          <div className="mt-1 text-[9px] leading-relaxed text-muted-foreground/40 line-clamp-1">
            {data.metadata.detail}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </>
  );
}
