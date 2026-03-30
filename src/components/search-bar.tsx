"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EntityResult {
  entity: string;
  occurrences: { format: string }[];
}

interface SearchBarProps {
  onEntitySelect: (entity: string) => void;
}

export function SearchBar({ onEntitySelect }: SearchBarProps) {
  const [entities, setEntities] = useState<Record<string, EntityResult>>({});
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/index")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setEntities(data.entities || {});
      })
      .catch((error: unknown) => console.error("Failed to load index:", error));

    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return [];
    const lower = search.toLowerCase();
    return Object.values(entities)
      .filter((e) => e.entity.toLowerCase().includes(lower))
      .slice(0, 20);
  }, [search, entities]);

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(e.target.value.length > 0);
        }}
        placeholder="Search entities..."
        className="h-8 w-56 rounded-lg border border-border/30 bg-background pl-8 pr-8 text-[11px] text-foreground placeholder:text-muted-foreground/30 transition-all duration-200 focus:w-72 focus:border-primary/30 focus:outline-none"
      />
      {search && (
        <button
          type="button"
          onClick={() => { setSearch(""); setOpen(false); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {open && search && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border/30 bg-background shadow-lg">
          {filtered.map((e) => {
            const formats = [...new Set(e.occurrences.map((o) => o.format))];
            return (
              <button
                key={e.entity}
                type="button"
                onClick={() => {
                  onEntitySelect(e.entity);
                  setSearch("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors hover:bg-accent/50"
              >
                <span className="font-mono text-foreground/85 truncate">{e.entity}</span>
                <span className="ml-auto flex shrink-0 gap-1">
                  {formats.map((f) => (
                    <Badge key={f} variant="outline" className="text-[9px] px-1.5 py-0">
                      {f}
                    </Badge>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {open && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border/30 bg-background px-3 py-3 text-center text-[11px] text-muted-foreground/40 shadow-lg">
          No entities found
        </div>
      )}
    </div>
  );
}
