"use client";

import { useEffect, useState, useMemo } from "react";
import { FlowchartViewer } from "./flowchart-viewer";
import { SequenceViewer } from "./sequence-viewer";
import { ContextPanel, hasContextContent } from "./context-panel";
import { applyScenario, applyView } from "@/lib/parsers/gdld-scenarios";
import type { FileEntry } from "@/lib/types";
import type { GdldModel } from "@/lib/parsers/gdld-parser";
import { StalenessIndicator } from "@/components/staleness-indicator";
import { getProfileViolations } from "@/lib/gdld-profile-violations";
import { getErrorMessage } from "@/lib/utils";

interface GdldViewerProps {
  file: FileEntry;
  onEntitySelect?: (entity: string) => void;
}

export function GdldViewer({ file, onEntitySelect }: GdldViewerProps) {
  const [model, setModel] = useState<GdldModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(true);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setModel(null);
    setError(null);
    setActiveScenario(null);
    setActiveView(null);
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/gdld/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load diagram");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setModel(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(getErrorMessage(error));
      });
    return () => { cancelled = true; };
  }, [file.path]);

  const effectiveModel = useMemo(() => {
    if (!model) return null;
    let result = model;
    if (activeScenario) result = applyScenario(result, activeScenario);
    if (activeView) result = applyView(result, activeView);
    return result;
  }, [model, activeScenario, activeView]);

  const profileViolations = useMemo(() => model ? getProfileViolations(model) : [], [model]);

  if (error) {
    return <div className="p-4 text-red-500 text-sm">{error}</div>;
  }
  if (!model || !effectiveModel) {
    return <div className="p-4 text-sm text-muted-foreground">Loading diagram...</div>;
  }

  const hasContext = hasContextContent(effectiveModel.context, {
    deployEnvs: effectiveModel.deployEnvs,
    deployNodes: effectiveModel.deployNodes,
    deployInstances: effectiveModel.deployInstances,
    infraNodes: effectiveModel.infraNodes,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2 text-xs">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">{model.diagram.type}</span>
        {model.diagram.profile && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-600">{model.diagram.profile}</span>
        )}
        {model.diagram.version && (
          <span className="text-[10px] font-mono text-muted-foreground/50">v{model.diagram.version}</span>
        )}
        {model.version && (
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {model.version.source}{model.version.generated ? ` · ${model.version.generated}` : ""}
          </span>
        )}
        <StalenessIndicator filePath={file.path} version={model.version} />
        {model.scenarios.length > 0 && (
          <select
            className="text-xs border border-border/50 rounded-md px-1 py-0.5 bg-background font-mono text-foreground"
            value={activeScenario || ""}
            onChange={(e) => setActiveScenario(e.target.value || null)}
          >
            <option value="">Base</option>
            {model.scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.id}</option>
            ))}
          </select>
        )}
        {model.views.length > 0 && (
          <select
            className="text-xs border border-border/50 rounded-md px-1 py-0.5 bg-background font-mono text-foreground"
            value={activeView || ""}
            onChange={(e) => setActiveView(e.target.value || null)}
          >
            <option value="">All</option>
            {model.views.map((v) => (
              <option key={v.id} value={v.id}>{v.id}</option>
            ))}
          </select>
        )}
        {model.diagram.purpose && (
          <span className="text-muted-foreground text-[10px] truncate">{model.diagram.purpose}</span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {effectiveModel.nodes.length} nodes · {effectiveModel.edges.length} edges
        </span>
        {hasContext && (
          <button
            onClick={() => setShowContext(!showContext)}
            className={`px-2 py-0.5 rounded text-xs ${showContext ? "bg-accent" : "hover:bg-accent"}`}
          >
            Context
          </button>
        )}
      </div>

      {/* Profile violation hint */}
      {profileViolations.length > 0 && (
        <div className="px-3 py-1.5 border-b border-amber-400/20 bg-amber-400/5 text-[10px] text-amber-600 font-mono">
          Profile &apos;{model.diagram.profile}&apos; — {profileViolations.length} unexpected: {profileViolations.join(", ")}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Diagram area */}
        <div className="flex-1 min-w-0">
          {effectiveModel.nodes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full text-sm text-muted-foreground">
              No nodes match the current filter
            </div>
          ) : effectiveModel.diagram.type === "sequence" ? (
            <SequenceViewer model={effectiveModel} />
          ) : (
            <FlowchartViewer
              model={effectiveModel}
              onNodeSelect={onEntitySelect}
            />
          )}
        </div>

        {/* Context sidebar */}
        {hasContext && showContext && (
          <div className="w-56 border-l border-border/50 flex-shrink-0">
            <ContextPanel
              context={effectiveModel.context}
              deployEnvs={effectiveModel.deployEnvs}
              deployNodes={effectiveModel.deployNodes}
              deployInstances={effectiveModel.deployInstances}
              infraNodes={effectiveModel.infraNodes}
            />
          </div>
        )}
      </div>
    </div>
  );
}
