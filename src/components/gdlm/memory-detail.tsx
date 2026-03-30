"use client";

import { useMemo } from "react";
import type { GdlmMemory } from "@/lib/parsers/gdlm-parser";

interface MemoryDetailProps {
  subject: string;
  memories: GdlmMemory[];
  onEntitySelect?: (entity: string) => void;
}

export function MemoryDetail({ subject, memories, onEntitySelect }: MemoryDetailProps) {
  const sorted = useMemo(
    () =>
      [...memories]
        .filter((m) => m.subject === subject)
        .sort((a, b) => a.ts.localeCompare(b.ts)),
    [memories, subject]
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2
            className="font-mono text-xs font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => onEntitySelect?.(subject)}
          >
            {subject}
          </h2>
          <span className="text-[10px] font-mono text-muted-foreground">
            {sorted.length} memor{sorted.length !== 1 ? "ies" : "y"}
          </span>
        </div>

        {sorted.map((mem) => (
          <div key={`${mem.id}-${mem.ts}`} className="border border-border/40 rounded-md p-2 text-xs space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground/60">{formatTimestamp(mem.ts)}</span>
              {mem.type && (
                <span className="text-[10px] px-1 py-0.5 rounded-sm bg-primary/10 text-primary">{mem.type}</span>
              )}
            </div>
            <div className="text-foreground/80">{mem.detail}</div>
            {mem.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {mem.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground/50 flex-wrap">
              <span>agent: {mem.agent}</span>
              {mem.relates && <span>relates: {mem.relates}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return ts;
  }
}
