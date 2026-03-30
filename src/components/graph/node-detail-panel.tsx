"use client";

import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GdlGraphNode } from "@/lib/graph/types";

const HIGH_TYPES = new Set(["schema", "api", "code", "memory"]);

interface NodeDetailPanelProps {
  node: GdlGraphNode;
  connectedNodes: GdlGraphNode[];
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
}

export function NodeDetailPanel({
  node,
  connectedNodes,
  onClose,
  onNavigateToNode,
}: NodeDetailPanelProps) {
  const isPrimary = HIGH_TYPES.has(node.type);

  const displayFields = Object.entries(node.metadata).filter(
    ([key]) => !["sourceFile", "lineNumber", "recordType"].includes(key),
  );

  return (
    <div className="flex h-full w-80 flex-col border-l border-border/20 bg-card/50 animate-in slide-in-from-right-2 duration-200">
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
        {(node.metadata["sourceFile"] || node.metadata["lineNumber"]) && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/35">
              Source
            </h4>
            <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2">
              <p className="text-[11px] font-mono text-foreground/60 break-all leading-relaxed">
                {node.metadata["sourceFile"]}
                {node.metadata["lineNumber"] && (
                  <span className="text-primary/50">:{node.metadata["lineNumber"]}</span>
                )}
              </p>
            </div>
          </div>
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
                return (
                  <button
                    key={connected.id}
                    type="button"
                    onClick={() => onNavigateToNode(connected.id)}
                    className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all duration-150 hover:bg-muted/20"
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
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
