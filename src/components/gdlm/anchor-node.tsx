"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Anchor } from "lucide-react";
import { colorWithAlpha } from "./node-utils";

const ACCENT = "hsl(165 50% 42%)";

export type AnchorNodeData = {
  label: string;
  /** Mirrors the layout-utils contract — used for type-aware grouping. */
  nodeType: "anchor";
  scopeCount: number;
  selected?: boolean;
};

export function AnchorNodeComponent({ data }: NodeProps<Node<AnchorNodeData>>) {
  const border = colorWithAlpha(ACCENT, data.selected ? 0.95 : 0.65);
  const bg = colorWithAlpha(ACCENT, data.selected ? 0.14 : 0.08);
  const shadow = data.selected
    ? `0 0 0 2px ${border}, 0 0 20px ${colorWithAlpha(ACCENT, 0.28)}`
    : "0 1px 6px rgba(0,0,0,0.04)";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!invisible" />
      <div
        // Distinct from MemoryNode: dashed border, slightly larger padding,
        // anchor icon in the eyebrow. Same rounded-xl card shape so it sits
        // visually next to subjects without breaking the layout grid.
        className="group rounded-xl border-2 border-dashed px-3.5 py-2.5 transition-all duration-200 hover:scale-[1.02]"
        style={{
          borderColor: border,
          backgroundColor: bg,
          boxShadow: shadow,
          minWidth: 140,
          maxWidth: 240,
        }}
      >
        <div className="flex items-center gap-1.5">
          <Anchor
            className="h-3 w-3 shrink-0"
            style={{ color: ACCENT, opacity: data.selected ? 1 : 0.85 }}
          />
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: ACCENT }}
          >
            ANCHOR
          </span>
          {data.scopeCount > 0 && (
            <span
              className="ml-auto rounded-sm px-1 py-0.5 text-[8.5px] font-mono tracking-wide"
              style={{ color: ACCENT, backgroundColor: colorWithAlpha(ACCENT, 0.1) }}
            >
              {data.scopeCount}
            </span>
          )}
        </div>
        <div className="mt-1 text-[12px] font-semibold leading-snug text-foreground/95 line-clamp-2">
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </>
  );
}
