"use client";

import { useCallback, useState } from "react";
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
  const [viewMode, setViewMode] = useState<"explorer" | "graph">("explorer");
  const handleProjectName = useCallback((name: string) => setProjectName(name), []);

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
            <KnowledgeGraph onEntitySelect={setSelectedEntity} />
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={20} minSize={12} maxSize={40}>
              <div className="h-full flex flex-col bg-card/30">
                <div className="px-3 py-2.5 border-b border-border/50">
                  <p className="text-[10px] text-muted-foreground/60 font-mono">{projectName}</p>
                </div>
                <div className="flex-1 min-h-0">
                  <FileTreeSidebar
                    onFileSelect={setSelectedFile}
                    selectedFile={selectedFile}
                    onProjectName={handleProjectName}
                  />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={80}>
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
          </ResizablePanelGroup>
        )}

        {/* Cross-layer panel (hidden in graph mode — graph has its own detail panel) */}
        {viewMode === "explorer" && selectedEntity && (
          <div className="w-72 border-l border-border/50 flex-shrink-0">
            <CrossLayerPanel
              entity={selectedEntity}
              onFileSelect={(file) => setSelectedFile(file)}
              onClose={() => setSelectedEntity(null)}
            />
          </div>
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
