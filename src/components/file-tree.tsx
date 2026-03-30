"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileTree, FileEntry, GdlFormat } from "@/lib/types";

const FORMAT_LABELS: Record<GdlFormat, string> = {
  gdl: "Data",
  gdls: "Schemas",
  gdld: "Diagrams",
  gdlm: "Memory",
  gdlc: "Code",
  gdlu: "Documents",
  gdla: "APIs",
};

const FORMAT_COLORS: Record<GdlFormat, string> = {
  gdl: "bg-blue-400",
  gdls: "bg-green-400",
  gdld: "bg-purple-400",
  gdlm: "bg-amber-400",
  gdlc: "bg-rose-400",
  gdlu: "bg-teal-400",
  gdla: "bg-orange-400",
};

interface FileTreeProps {
  onFileSelect: (file: FileEntry) => void;
  selectedFile: FileEntry | null;
  compact?: boolean;
  onProjectName?: (name: string) => void;
}

const FORMAT_ORDER: GdlFormat[] = ["gdld", "gdls", "gdla", "gdlc", "gdl", "gdlm", "gdlu"];

export function FileTreeSidebar({ onFileSelect, selectedFile, compact = false, onProjectName }: FileTreeProps) {
  const [tree, setTree] = useState<FileTree | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/files")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.projectName && onProjectName) {
          onProjectName(data.projectName);
        }
        setTree(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        console.error("Failed to load file tree:", error);
        setLoading(false);
      });
  }, [onProjectName]);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Indexing...</div>;
  if (!tree) return <div className="p-4 text-sm text-muted-foreground">No files found</div>;

  if (compact) {
    const allFiles = FORMAT_ORDER.flatMap((f) => (tree.byFormat[f] || []).filter((file) => !file.isEnrichment));
    return (
      <>
        {allFiles.map((file) => {
          const isSelected = selectedFile?.path === file.path;
          return (
            <button
              key={file.path}
              onClick={() => onFileSelect(file)}
              className={`flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono transition-colors whitespace-nowrap ${
                isSelected
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "text-foreground/70 hover:bg-muted/50 hover:text-foreground bg-muted/30"
              }`}
              title={file.path}
            >
              {file.name}<span className="text-muted-foreground/50">.{file.format}</span>
              {file.enrichmentPath && <span className="text-primary/40 ml-1">+enriched</span>}
            </button>
          );
        })}
      </>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {FORMAT_ORDER.map((format) => {
          const allFiles = tree.byFormat[format];
          const files = allFiles?.filter((f) => !f.isEnrichment);
          if (!files || files.length === 0) return null;
          return (
            <div key={format}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {FORMAT_LABELS[format]}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/50">
                  {files.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {files.map((file) => {
                  const isSelected = selectedFile?.path === file.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => onFileSelect(file)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                          : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                      }`}
                      title={file.path}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${
                        FORMAT_COLORS[format]
                      }`} />
                      {file.name}
                      <span className="text-muted-foreground/50">.{format}</span>
                      {file.enrichmentPath && <span className="text-primary/40 ml-1 text-[10px]">+enriched</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
