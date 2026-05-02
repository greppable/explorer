"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Maximize2 } from "lucide-react";
import type { GraphNodeType } from "@/lib/graph/types";
import { BRAND, NODE_STYLES } from "./constants";

const NEUTRAL = "#64748b";

export type ClusterNodeData = {
  label: string;
  layer: GraphNodeType;
  /** Mirrors `layer` so the existing layout algorithm groups clusters by type */
  nodeType: GraphNodeType;
  entityCount: number;
  fileCount: number;
  selected?: boolean;
};

export function ClusterNodeComponent({ data }: NodeProps<Node<ClusterNodeData>>) {
  const intensity = NODE_STYLES[data.layer]?.intensity ?? "low";
  const accent = intensity === "low" ? NEUTRAL : BRAND.primary;
  const border = intensity === "high"
    ? `rgba(132,112,255,${data.selected ? 0.85 : 0.55})`
    : intensity === "medium"
      ? `rgba(132,112,255,${data.selected ? 0.7 : 0.4})`
      : `rgba(100,116,139,${data.selected ? 0.6 : 0.4})`;
  const bg = intensity === "low"
    ? data.selected ? "rgba(100,116,139,0.10)" : "rgba(100,116,139,0.04)"
    : data.selected ? "rgba(132,112,255,0.10)" : "rgba(132,112,255,0.05)";
  const shadow = data.selected
    ? `0 0 0 2px ${border}, 0 0 24px rgba(132,112,255,0.25)`
    : "0 1px 6px rgba(0,0,0,0.04)";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!invisible" />

      <div
        className="group rounded-2xl border-2 border-dashed px-4 py-3 transition-all duration-200 hover:scale-[1.03] cursor-pointer"
        style={{
          borderColor: border,
          backgroundColor: bg,
          boxShadow: shadow,
          minWidth: 160,
          maxWidth: 220,
        }}
        title="Click to expand"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: accent, opacity: data.selected ? 1 : 0.85 }}
            />
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: accent, opacity: 0.85 }}
            >
              {data.layer}
            </span>
          </div>
          <Maximize2
            className="h-3 w-3 shrink-0 opacity-30 transition-opacity group-hover:opacity-70"
            style={{ color: accent }}
          />
        </div>

        <div className="mt-1 text-[14px] font-semibold leading-snug text-foreground/90">
          {data.label}
        </div>

        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span>
            <span className="font-semibold text-foreground/70">{data.entityCount}</span> entit{data.entityCount === 1 ? "y" : "ies"}
          </span>
          {data.fileCount > 0 && (
            <span className="text-muted-foreground/40">·</span>
          )}
          {data.fileCount > 0 && (
            <span>
              <span className="font-semibold text-foreground/70">{data.fileCount}</span> file{data.fileCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </>
  );
}
