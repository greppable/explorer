"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { colorWithAlpha } from "./node-utils";

// Border accent + tinted background per memory type. Mirrors the way the main
// knowledge graph's GdlNode derives its style — same rounded card, same accent
// dot + uppercase eyebrow — but the palette runs across the memory-specific
// taxonomy (observation, decision, error, ...) rather than the cross-format
// graph palette.
const TYPE_ACCENT: Record<string, string> = {
  observation: "hsl(152 38% 55%)",
  decision:    "hsl(45 65% 50%)",
  preference:  "hsl(200 40% 55%)",
  error:       "hsl(0 65% 55%)",
  fact:        "hsl(152 50% 36%)",
  task:        "hsl(30 50% 55%)",
  procedural:  "hsl(180 35% 48%)",
  summary:     "hsl(40 12% 55%)",
  "":          "hsl(152 38% 55%)",
};

const TYPE_LABELS: Record<string, string> = {
  observation: "OBSERVATION",
  decision:    "DECISION",
  preference:  "PREFERENCE",
  error:       "ERROR",
  fact:        "FACT",
  task:        "TASK",
  procedural:  "PROCEDURAL",
  summary:     "SUMMARY",
  "":          "MEMORY",
};

export type MemoryNodeData = {
  label: string;
  /** Mirrors the layout-utils contract — used for type-aware grouping. */
  nodeType: string;
  memType: string;
  count: number;
  selected?: boolean;
};

export function MemoryNodeComponent({ data }: NodeProps<Node<MemoryNodeData>>) {
  const accent = TYPE_ACCENT[data.memType] ?? TYPE_ACCENT[""];
  const label = TYPE_LABELS[data.memType] ?? TYPE_LABELS[""];
  const border = colorWithAlpha(accent, data.selected ? 0.85 : 0.45);
  const bg = colorWithAlpha(accent, data.selected ? 0.12 : 0.06);
  const shadow = data.selected
    ? `0 0 0 2px ${border}, 0 0 16px ${colorWithAlpha(accent, 0.25)}`
    : "0 1px 4px rgba(0,0,0,0.03)";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!invisible" />
      <div
        className="group rounded-xl border px-3 py-2 transition-all duration-200 hover:scale-[1.02]"
        style={{
          borderColor: border,
          backgroundColor: bg,
          boxShadow: shadow,
          minWidth: 130,
          maxWidth: 240,
        }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent, opacity: data.selected ? 1 : 0.75 }}
          />
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: accent, opacity: 0.85 }}
          >
            {label}
          </span>
          {data.count > 1 && (
            <span
              className="ml-auto rounded-sm px-1 py-0.5 text-[8.5px] font-mono tracking-wide"
              style={{ color: accent, backgroundColor: colorWithAlpha(accent, 0.1) }}
            >
              ×{data.count}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] font-medium leading-snug text-foreground/90 line-clamp-2">
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </>
  );
}
