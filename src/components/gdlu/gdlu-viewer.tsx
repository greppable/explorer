"use client";

import { useEffect, useState, useMemo } from "react";
import type { FileEntry } from "@/lib/types";
import type { GdluFile, GdluSource, GdluSection, GdluExtract } from "@/lib/parsers/gdlu-parser";
import { StalenessIndicator } from "@/components/staleness-indicator";
import { getErrorMessage } from "@/lib/utils";

interface GdluViewerProps {
  file: FileEntry;
  onEntitySelect?: (entity: string) => void;
}

export function GdluViewer({ file, onEntitySelect }: GdluViewerProps) {
  const [data, setData] = useState<GdluFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setSelectedSource(null);
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/gdlu/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((parsed: GdluFile) => {
        if (!cancelled) {
          setData(parsed);
          if (parsed.sources.length > 0) {
            setSelectedSource(parsed.sources[0].id);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(getErrorMessage(error));
      });
    return () => { cancelled = true; };
  }, [file.path]);

  const source = useMemo(() => data?.sources.find((s) => s.id === selectedSource), [data, selectedSource]);
  const sections = useMemo(() => data?.sections.filter((s) => s.source === selectedSource) ?? [], [data, selectedSource]);
  const extracts = useMemo(() => data?.extracts.filter((e) => e.source === selectedSource) ?? [], [data, selectedSource]);

  if (error) return <div className="p-4 text-red-500 text-sm">{error}</div>;
  if (!data) return <div className="p-4 text-sm text-muted-foreground">Loading document index...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2 text-xs">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">GDLU</span>
        {data.version && (
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {data.version.source}{data.version.generated ? ` · ${data.version.generated}` : ""}
          </span>
        )}
        <StalenessIndicator filePath={file.path} version={data.version} />
        <span className="text-muted-foreground font-mono text-[10px]">
          {data.sources.length} source{data.sources.length !== 1 ? "s" : ""} · {data.sections.length} section{data.sections.length !== 1 ? "s" : ""} · {data.extracts.length} extract{data.extracts.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Source list */}
        <div className="w-64 border-r border-border/50 flex-shrink-0 overflow-auto">
          <div className="p-2 space-y-1">
            {data.sources.map((src) => (
              <button
                key={src.id}
                onClick={() => setSelectedSource(src.id)}
                className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors ${
                  selectedSource === src.id
                    ? "bg-primary/10 ring-1 ring-primary/20"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="font-mono text-foreground/80 text-[10px]">{src.id}</div>
                <div className="text-muted-foreground line-clamp-2 mt-0.5">{src.summary || src.path}</div>
                <div className="flex gap-1.5 mt-1">
                  {src.type && <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{src.type}</span>}
                  {src.signal && (
                    <span className={`text-[9px] px-1 py-0.5 rounded ${
                      src.signal === "high" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/60"
                    }`}>{src.signal}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Source detail */}
        <div className="flex-1 min-w-0 overflow-auto">
          {source ? (
            <SourceDetail source={source} sections={sections} extracts={extracts} onEntitySelect={onEntitySelect} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Select a source</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceDetail({ source, sections, extracts, onEntitySelect }: {
  source: GdluSource;
  sections: GdluSection[];
  extracts: GdluExtract[];
  onEntitySelect?: (e: string) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div>
        <h2
          className="text-base font-mono font-semibold cursor-pointer hover:text-primary transition-colors"
          onClick={() => onEntitySelect?.(source.id)}
        >
          {source.id}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{source.summary}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{source.format}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{source.type}</span>
          {source.pages && <span className="text-[10px] font-mono text-muted-foreground/50">{source.pages} pages</span>}
          {source.author && <span className="text-[10px] font-mono text-muted-foreground/50">by {source.author}</span>}
        </div>
        {source.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {source.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border border-border/50 text-muted-foreground">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Sections */}
      {sections.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sections</h3>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <div key={`${s.id}-${i}`} className="border border-border/40 rounded-md p-2.5 text-xs">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-foreground font-semibold">{s.title || s.id}</span>
                  {s.loc && <span className="text-[10px] font-mono text-muted-foreground/50">{s.loc}</span>}
                </div>
                {s.summary && <div className="text-muted-foreground">{s.summary}</div>}
                {s.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {s.tags.map((t) => <span key={t} className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracts */}
      {extracts.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Extracts</h3>
          <div className="space-y-2">
            {extracts.map((e, i) => (
              <div key={`${e.id}-${i}`} className="border border-border/40 rounded-md p-2.5 text-xs">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-mono">{e.kind}</span>
                  <span className="font-mono font-semibold text-foreground">{e.key}</span>
                  {e.confidence && (
                    <span className={`text-[10px] ml-auto px-1 py-0.5 rounded ${
                      e.confidence === "high" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/60"
                    }`}>{e.confidence}</span>
                  )}
                </div>
                <div className="text-foreground/80">{e.value}</div>
                {e.context && <div className="text-muted-foreground/60 mt-0.5">{e.context}</div>}
                {e.status === "superseded" && <div className="text-destructive/60 mt-0.5 text-[10px]">superseded</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
