"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { FileEntry, GdlFormat } from "@/lib/types";

interface Occurrence {
  entity: string;
  file: string;
  format: GdlFormat;
  line: number;
  context: string;
  role: string;
}

interface CrossLayerPanelProps {
  entity: string | null;
  onFileSelect: (file: FileEntry, line?: number) => void;
  onClose: () => void;
}

const FORMAT_LABELS: Record<GdlFormat, string> = {
  gdl: "GDL Data",
  gdls: "GDLS Schema",
  gdld: "GDLD Diagram",
  gdlm: "GDLM Memory",
  gdlc: "GDLC Code",
  gdlu: "GDLU Documents",
  gdla: "GDLA API",
};

export function CrossLayerPanel({ entity, onFileSelect, onClose }: CrossLayerPanelProps) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entity) return;
    let cancelled = false;
    setLoading(true);

    fetch("/api/index")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const crossRef = data.entities?.[entity];
          setOccurrences(crossRef?.occurrences || []);
          setFiles(data.files || []);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Failed to load cross-references:", error);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [entity]);

  function resolveFileEntry(occ: Occurrence): FileEntry {
    const found = files.find((f) => f.path === occ.file);
    if (found) return found;
    return { path: occ.file, absolutePath: "", format: occ.format, name: "", size: 0 };
  }

  if (!entity) return null;

  // Group by format
  const byFormat = occurrences.reduce<Partial<Record<GdlFormat, Occurrence[]>>>(
    (acc, occ) => {
      if (!acc[occ.format]) acc[occ.format] = [];
      acc[occ.format]!.push(occ);
      return acc;
    },
    {}
  );

  const formats = new Set(occurrences.map((o) => o.format));

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <div>
          <h2 className="font-mono text-sm font-semibold">{entity}</h2>
          <p className="text-xs text-muted-foreground">
            {formats.size} layer{formats.size !== 1 ? "s" : ""} &middot; {occurrences.length} occurrence{occurrences.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
          &times;
        </button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="p-3 space-y-4">
            {(["gdls", "gdla", "gdld", "gdlm", "gdlc", "gdl", "gdlu"] as GdlFormat[]).map((format) => {
              const items = byFormat[format];
              if (!items || items.length === 0) return null;
              return (
                <div key={format}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">{format.toUpperCase()}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {FORMAT_LABELS[format]}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.map((occ, i) => (
                      <button
                        key={`${occ.file}-${occ.line}-${i}`}
                        onClick={() => {
                          onFileSelect(resolveFileEntry(occ), occ.line);
                        }}
                        className="w-full text-left p-2 rounded text-xs hover:bg-accent"
                      >
                        <div className="font-mono truncate text-muted-foreground">{occ.file}:{occ.line}</div>
                        <div className="font-mono truncate mt-0.5">{occ.context}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
