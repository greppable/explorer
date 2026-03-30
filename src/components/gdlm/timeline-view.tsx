"use client";

import { useMemo, useState } from "react";
import type { GdlmMemory, GdlmAnchor } from "@/lib/parsers/gdlm-parser";

interface TimelineViewProps {
  memories: GdlmMemory[];
  anchors: GdlmAnchor[];
  onSubjectSelect?: (subject: string) => void;
  onEntitySelect?: (entity: string) => void;
}

export function TimelineView({ memories, anchors, onSubjectSelect, onEntitySelect }: TimelineViewProps) {
  const [tagFilter, setTagFilter] = useState("");

  const sorted = useMemo(() => {
    let filtered = [...memories].sort((a, b) => a.ts.localeCompare(b.ts));
    if (tagFilter) {
      const lower = tagFilter.toLowerCase();
      filtered = filtered.filter((m) =>
        m.tags.some((t) => t.toLowerCase().includes(lower)) ||
        m.subject.toLowerCase().includes(lower)
      );
    }
    return filtered;
  }, [memories, tagFilter]);

  // Group by date
  const byDate = useMemo(() => {
    const groups = new Map<string, GdlmMemory[]>();
    for (const mem of sorted) {
      const date = mem.ts ? mem.ts.split("T")[0] : "unknown";
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(mem);
    }
    return groups;
  }, [sorted]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 border-b border-border/50">
        <input
          placeholder="Filter by tag or subject..."
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="h-7 w-full text-xs px-2.5 rounded-md border border-border/50 bg-background font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto">
        <div className="p-3 space-y-4">
          {anchors.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Concept Anchors
              </div>
              <div className="space-y-1.5 ml-3 border-l-2 border-teal-300 dark:border-teal-700 pl-3">
                {anchors.map((anchor) => (
                  <div
                    key={anchor.concept}
                    className="border border-border/40 rounded-md p-2.5 text-xs bg-card/50"
                  >
                    <div className="font-mono font-semibold mb-0.5">{anchor.concept}</div>
                    <div className="flex gap-1 flex-wrap">
                      {anchor.scope.map((keyword) => (
                        <span key={keyword} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {[...byDate.entries()].map(([date, mems]) => (
            <div key={date}>
              <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                {date}
              </div>
              <div className="space-y-1.5 ml-3 border-l-2 border-primary/20 pl-3">
                {mems.map((mem) => (
                  <div
                    key={`${mem.id}-${mem.ts}`}
                    className="border border-border/40 rounded-md p-2.5 text-xs bg-card/50 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => {
                          onSubjectSelect?.(mem.subject);
                          onEntitySelect?.(mem.subject);
                        }}
                        className="font-mono font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {mem.subject}
                      </button>
                      {mem.type && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary">{mem.type}</span>
                      )}
                      <span className="ml-auto text-muted-foreground/50 text-[10px]">
                        {mem.ts?.split("T")[1]?.substring(0, 5) || ""}
                      </span>
                    </div>
                    <div className="text-foreground/80">{mem.detail}</div>
                    {mem.tags.length > 0 && (
                      <div className="mt-1.5 flex gap-1 flex-wrap">
                        {mem.tags.map((tag) => (
                          <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
