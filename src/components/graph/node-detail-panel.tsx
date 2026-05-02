"use client";

import { ArrowRight, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GdlGraphNode } from "@/lib/graph/types";

const HIGH_TYPES = new Set(["schema", "api", "code", "memory"]);

interface NodeDetailPanelProps {
  node: GdlGraphNode;
  connectedNodes: GdlGraphNode[];
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
  onOpenInExplorer?: (filePath: string, line?: number) => void;
}

export function NodeDetailPanel({
  node,
  connectedNodes,
  onClose,
  onNavigateToNode,
  onOpenInExplorer,
}: NodeDetailPanelProps) {
  const isPrimary = HIGH_TYPES.has(node.type);

  const displayFields = Object.entries(node.metadata).filter(
    ([key]) => !["sourceFile", "lineNumber", "recordType"].includes(key),
  );

  return (
    <div className="flex h-full flex-col border-l border-border/20 bg-card/50 animate-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border/20 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isPrimary ? "bg-primary/50" : "bg-muted-foreground/40",
              )}
            />
            <span
              className={cn(
                "text-[9px] font-semibold uppercase tracking-[0.06em]",
                isPrimary ? "text-primary/50" : "text-muted-foreground/40",
              )}
            >
              {node.type}
            </span>
          </div>
          <h3 className="mt-1 text-[13px] font-semibold leading-snug text-foreground">
            {node.label}
          </h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-muted-foreground/30 transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Source info */}
        {(node.metadata["sourceFile"] || node.metadata["lineNumber"] || node.metadata["path"]) && (
          (() => {
            const sourceFile = node.metadata["sourceFile"] || node.metadata["path"];
            const lineRaw = node.metadata["lineNumber"];
            const line = lineRaw ? Number.parseInt(lineRaw, 10) : undefined;
            const canOpen = Boolean(onOpenInExplorer && sourceFile);
            const Body = (
              <p className="text-[11px] font-mono text-foreground/60 break-all leading-relaxed">
                {sourceFile}
                {line !== undefined && !Number.isNaN(line) && (
                  <span className="text-primary/50">:{line}</span>
                )}
              </p>
            );
            return (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/35">
                  Source
                </h4>
                {canOpen ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenInExplorer!(
                        sourceFile!,
                        line !== undefined && !Number.isNaN(line) ? line : undefined,
                      )
                    }
                    className="group flex w-full items-start justify-between gap-2 rounded-lg border border-border/20 bg-muted/10 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                    title="Open in Explorer"
                  >
                    {Body}
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary/70" />
                  </button>
                ) : (
                  <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2">{Body}</div>
                )}
              </div>
            );
          })()
        )}

        {/* Fields */}
        {displayFields.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/35">
              Properties
            </h4>
            <dl className="space-y-2.5">
              {displayFields.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-[10px] font-medium text-muted-foreground/40">{key}</dt>
                  <dd className="mt-0.5 text-[11px] leading-relaxed text-foreground/75 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Connected nodes */}
        {connectedNodes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/35">
              Connected
              <span className="ml-1.5 text-[9px] text-muted-foreground/25">{connectedNodes.length}</span>
            </h4>
            <div className="space-y-0.5">
              {connectedNodes.map((connected) => {
                const connIsPrimary = HIGH_TYPES.has(connected.type);
                const connSource = connected.metadata["sourceFile"] || connected.metadata["path"];
                const canOpenConn = Boolean(onOpenInExplorer && connSource);
                return (
                  <div
                    key={connected.id}
                    className="group flex w-full items-center gap-1 rounded-lg pl-2 pr-1 py-0.5 transition-colors hover:bg-muted/20"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigateToNode(connected.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                      title="Focus in graph"
                    >
                      <div
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          connIsPrimary ? "bg-primary/40" : "bg-muted-foreground/30",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/70">
                        {connected.label}
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-all duration-150 group-hover:text-muted-foreground/30 group-hover:translate-x-0.5" />
                    </button>
                    {canOpenConn && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenInExplorer!(connSource!);
                        }}
                        className="shrink-0 rounded p-1 text-muted-foreground/25 transition-colors hover:bg-primary/10 hover:text-primary/70"
                        title={`Open ${connSource} in Explorer`}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
