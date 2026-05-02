"use client";

import { useCallback, useState } from "react";
import { FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileTreeSidebar } from "@/components/file-tree";
import { RawViewer } from "@/components/raw-viewer";
import { GdldViewer } from "@/components/gdld/gdld-viewer";
import { GdlDataGrid } from "@/components/gdl/gdl-data-grid";
import { GdlsViewer } from "@/components/gdls/gdls-viewer";
import { GdlmViewer } from "@/components/gdlm/gdlm-viewer";
import { GdlcViewer } from "@/components/gdlc/gdlc-viewer";
import { GdluViewer } from "@/components/gdlu/gdlu-viewer";
import { GdlaViewer } from "@/components/gdla/gdla-viewer";
import { SearchBar } from "@/components/search-bar";
import { StatusBar } from "@/components/status-bar";
import { CrossLayerPanel } from "@/components/cross-layer-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { FileEntry } from "@/lib/types";
import { KnowledgeGraph } from "@/components/graph/knowledge-graph";
import { ProjectTimeline } from "@/components/timeline/project-timeline";

function FileViewer({
  file,
  onEntitySelect,
}: {
  file: FileEntry;
  onEntitySelect: (entity: string) => void;
}) {
  switch (file.format) {
    case "gdld":
      return <GdldViewer file={file} onEntitySelect={onEntitySelect} />;
    case "gdls":
      return <GdlsViewer file={file} onEntitySelect={onEntitySelect} />;
    case "gdl":
      return <GdlDataGrid file={file} onEntitySelect={onEntitySelect} />;
    case "gdlm":
      return <GdlmViewer file={file} onEntitySelect={onEntitySelect} />;
    case "gdlc":
      return <GdlcViewer file={file} onEntitySelect={onEntitySelect} />;
    case "gdlu":
      return <GdluViewer file={file} onEntitySelect={onEntitySelect} />;
    case "gdla":
      return <GdlaViewer file={file} onEntitySelect={onEntitySelect} />;
    default:
      return <RawViewer file={file} />;
  }
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <div className="text-4xl opacity-20">◇</div>
        <div className="text-sm text-muted-foreground">Select a file to explore</div>
        <div className="text-[10px] text-muted-foreground/50 font-mono max-w-xs">
          Click any file in the sidebar to view its parsed contents with format-specific visualisations.
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [viewMode, setViewMode] = useState<"explorer" | "graph" | "timeline">("explorer");
  const [showPaths, setShowPaths] = useState(false);
  const handleProjectName = useCallback((name: string) => setProjectName(name), []);

  const handleOpenInExplorer = useCallback(
    async (filePath: string, line?: number) => {
      // line is accepted so callers (timeline detail, graph node detail) can
      // pass through a source line without it being silently dropped. File
      // viewers don't yet support scroll-to-line; void-discard keeps the
      // contract honest until they do.
      void line;
      try {
        const res = await fetch("/api/files");
        if (!res.ok) return;
        const data = (await res.json()) as { files: FileEntry[] };
        const file = data.files?.find((f) => f.path === filePath);
        if (file) {
          setSelectedFile(file);
          setViewMode("explorer");
        }
      } catch {
        // Best-effort navigation; silently ignore lookup failures
      }
    },
    [],
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-12 flex-shrink-0 border-b border-border/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium text-primary tracking-tight">
            greppable<span className="text-muted-foreground font-normal">.ai</span>
          </span>
          <span className="text-border hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => setViewMode("explorer")}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                viewMode === "explorer"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Explorer
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                viewMode === "graph"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                viewMode === "timeline"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Timeline
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {viewMode === "explorer" && (
            <div className="hidden sm:block max-w-md">
              <SearchBar onEntitySelect={setSelectedEntity} />
            </div>
          )}
          <ThemeToggle className="h-8 w-8" />
        </div>
      </div>

      {/* Desktop: resizable panels */}
      <div className="flex-1 min-h-0 hidden sm:flex">
        {viewMode === "graph" ? (
          <div className="flex-1 min-w-0">
            <KnowledgeGraph
              onEntitySelect={setSelectedEntity}
              onOpenInExplorer={handleOpenInExplorer}
            />
          </div>
        ) : viewMode === "timeline" ? (
          <div className="flex-1 min-w-0">
            <ProjectTimeline
              onEntitySelect={setSelectedEntity}
              onOpenInExplorer={handleOpenInExplorer}
            />
          </div>
        ) : (
          <ResizablePanelGroup
            key={selectedEntity ? "split" : "full"}
            direction="horizontal"
          >
            <ResizablePanel defaultSize={20} minSize={12} maxSize={40}>
              <div className="h-full flex flex-col bg-card/30">
                <div className="px-3 py-1.5 border-b border-border/50 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground/60 font-mono truncate">{projectName}</p>
                  <button
                    type="button"
                    onClick={() => setShowPaths((v) => !v)}
                    className={cn(
                      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                      showPaths
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground/45 hover:text-foreground hover:bg-muted/40",
                    )}
                    title={showPaths ? "Hide folder paths" : "Show folder paths"}
                  >
                    <FolderTree className="h-3 w-3" />
                    paths
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <FileTreeSidebar
                    onFileSelect={setSelectedFile}
                    selectedFile={selectedFile}
                    onProjectName={handleProjectName}
                    showPaths={showPaths}
                  />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={selectedEntity ? 60 : 80} minSize={30}>
              <div className="h-full flex flex-col min-w-0 bg-background">
                {selectedFile ? (
                  <>
                    <div className="px-3 py-1.5 border-b border-border/50 text-[10px] font-mono text-muted-foreground/60">
                      {selectedFile.name}.{selectedFile.format}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <FileViewer file={selectedFile} onEntitySelect={setSelectedEntity} />
                    </div>
                  </>
                ) : (
                  <EmptyState />
                )}
              </div>
            </ResizablePanel>
            {selectedEntity && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={20} minSize={14} maxSize={40}>
                  <CrossLayerPanel
                    entity={selectedEntity}
                    onFileSelect={(file) => setSelectedFile(file)}
                    onClose={() => setSelectedEntity(null)}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>

      {/* Mobile: compact chips + viewer */}
      <div className="flex-1 min-h-0 flex flex-col sm:hidden">
        <div className="border-b border-border/50 bg-card/30 overflow-x-auto flex-shrink-0">
          <div className="flex items-center gap-1 px-2 py-2 min-w-max">
            <FileTreeSidebar
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
              compact
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col bg-background">
          {selectedFile ? (
            <>
              <div className="px-3 py-1.5 border-b border-border/50 text-[10px] font-mono text-muted-foreground/60">
                {selectedFile.name}.{selectedFile.format}
              </div>
              <div className="flex-1 overflow-hidden">
                <FileViewer file={selectedFile} onEntitySelect={setSelectedEntity} />
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
