"use client";

import { useEffect, useState } from "react";
import { KnowledgeGraph } from "./knowledge-graph";
import { TimelineView } from "./timeline-view";
import { MemoryDetail } from "./memory-detail";
import type { FileEntry } from "@/lib/types";
import type { GdlmFile } from "@/lib/parsers/gdlm-parser";
import { StalenessIndicator } from "@/components/staleness-indicator";
import { getErrorMessage } from "@/lib/utils";

interface GdlmViewerProps {
  file: FileEntry;
  onEntitySelect?: (entity: string) => void;
}

export function GdlmViewer({ file, onEntitySelect }: GdlmViewerProps) {
  const [data, setData] = useState<GdlmFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "timeline">("timeline");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setSelectedSubject(null);
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/gdlm/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load memory file");
        return res.json();
      })
      .then((parsed: GdlmFile) => {
        if (!cancelled) setData(parsed);
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(getErrorMessage(error));
      });
    return () => { cancelled = true; };
  }, [file.path]);

  if (error) return <div className="p-4 text-red-500 text-sm">{error}</div>;
  if (!data) return <div className="p-4 text-sm text-muted-foreground">Loading memories...</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2 text-xs">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">GDLM</span>
        {data.version && (
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {data.version.source}{data.version.generated ? ` · ${data.version.generated}` : ""}
          </span>
        )}
        <StalenessIndicator filePath={file.path} version={data.version} />
        <span className="text-muted-foreground font-mono text-[10px]">
          {data.memories.length} memor{data.memories.length !== 1 ? "ies" : "y"}
          {data.anchors.length > 0 && ` · ${data.anchors.length} anchor${data.anchors.length !== 1 ? "s" : ""}`}
          {` · ${data.subjects.length} subject${data.subjects.length !== 1 ? "s" : ""}`}
          {` · ${data.agents.length} agent${data.agents.length !== 1 ? "s" : ""}`}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-2 py-0.5 rounded text-xs ${viewMode === "timeline" ? "bg-accent" : "hover:bg-accent"}`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode("graph")}
            className={`px-2 py-0.5 rounded text-xs ${viewMode === "graph" ? "bg-accent" : "hover:bg-accent"}`}
          >
            Graph
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Main view — absolute inset gives ScrollArea a definite bounding box */}
        <div className="flex-1 min-w-0 relative">
          <div className="absolute inset-0">
            {viewMode === "graph" ? (
              <KnowledgeGraph
                data={data}
                onSubjectSelect={setSelectedSubject}
              />
            ) : (
              <TimelineView
                memories={data.memories}
                anchors={data.anchors}
                onSubjectSelect={setSelectedSubject}
                onEntitySelect={onEntitySelect}
              />
            )}
          </div>
        </div>

        {/* Subject detail sidebar */}
        {selectedSubject && (
          <div className="w-56 border-l border-border/50 flex-shrink-0 relative">
            <div className="absolute inset-0">
              <MemoryDetail
                subject={selectedSubject}
                memories={data.memories}
                onEntitySelect={onEntitySelect}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
