"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import cytoscape from "cytoscape";
import type { GdldModel } from "@/lib/parsers/gdld-parser";
import { SHAPE_MAP, buildCytoscapeStyles } from "./cytoscape-styles";
import { ensureDagreRegistered } from "@/lib/cytoscape-setup";

ensureDagreRegistered();

interface FlowchartViewerProps {
  model: GdldModel;
  onNodeSelect?: (nodeId: string) => void;
}

export function FlowchartViewer({ model, onNodeSelect }: FlowchartViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const buildElements = useCallback((): cytoscape.ElementDefinition[] => {
    const elements: cytoscape.ElementDefinition[] = [];

    // Add groups as parent nodes
    for (const group of model.groups) {
      elements.push({
        data: {
          id: group.id,
          label: group.label,
          parent: group.parent || undefined,
        },
      });
    }

    // Add nodes
    for (const node of model.nodes) {
      const classes: string[] = [];
      if (node.shape === "subroutine") classes.push("subroutine");
      if (node.status === "deprecated") classes.push("deprecated");
      if (node.status === "planned") classes.push("planned");

      // Enrich label with metadata for visual display
      let label = node.label;
      const meta: string[] = [];
      if (node.role) meta.push(node.role);
      if (node.pattern) meta.push(node.pattern);
      if (node.tags.length > 0) meta.push(node.tags.join(", "));
      if (meta.length > 0) label += `\n[${meta.join(" · ")}]`;

      elements.push({
        data: {
          id: node.id,
          label,
          shape: SHAPE_MAP[node.shape] || "round-rectangle",
          parent: node.group || undefined,
        },
        classes: classes.join(" "),
      });
    }

    // Build set of all known node IDs (nodes + groups)
    const knownIds = new Set<string>();
    for (const node of model.nodes) knownIds.add(node.id);
    for (const group of model.groups) knownIds.add(group.id);

    // Add edges — skip dangling references
    for (let i = 0; i < model.edges.length; i++) {
      const edge = model.edges[i];
      if (!knownIds.has(edge.from) || !knownIds.has(edge.to)) continue;

      const classes: string[] = [];
      if (edge.bidirectional) classes.push("bidirectional");
      if (edge.style !== "solid") classes.push(edge.style);

      elements.push({
        data: {
          id: `${edge.from}-${edge.to}-${i}`,
          source: edge.from,
          target: edge.to,
          label: edge.label
            ? (edge.type ? `${edge.label} (${edge.type})` : edge.label)
            : (edge.type || ""),
        },
        classes: classes.join(" "),
      });
    }

    return elements;
  }, [model]);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(),
      style: buildCytoscapeStyles(),
      layout: {
        name: "dagre",
        rankDir: model.diagram.direction === "LR" ? "LR" : "TB",
        nodeSep: 60,
        rankSep: 60,
        edgeSep: 15,
      } as cytoscape.LayoutOptions,
      minZoom: 0.1,
      maxZoom: 5,
    });

    cy.on("tap", "node", (evt) => {
      const nodeId = evt.target.id();
      if (!evt.target.isParent() && onNodeSelect) {
        onNodeSelect(nodeId);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [buildElements, model.diagram.direction, onNodeSelect]);

  const { gotchas, recovery, decisions, useWhen, useNot } = model.context;
  const hasAnnotations = gotchas.length > 0 || recovery.length > 0 || decisions.length > 0;
  const hasScenarios = useWhen.length > 0 || useNot.length > 0;
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const annotationCount = gotchas.length + recovery.length + decisions.length;

  return (
    <div className="h-full flex flex-col">
      {/* Title header */}
      <div className="px-6 pt-5 pb-3">
        <p className="text-[11px] font-mono text-muted-foreground/40 tracking-wide">
          <span className="font-medium text-muted-foreground/50 uppercase">{model.diagram.type} diagram</span>
          {model.diagram.purpose && (
            <span> — {model.diagram.purpose}</span>
          )}
        </p>
      </div>

      {/* Cytoscape canvas */}
      <div ref={containerRef} className="flex-1 min-h-0" />

      {/* Annotation toggle + collapsible cards */}
      {hasAnnotations && (
        <div className="px-6 pb-3 pt-2">
          <button
            onClick={() => setAnnotationsOpen(!annotationsOpen)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1 text-[10px] font-mono text-muted-foreground/60 hover:bg-muted/50 transition-colors"
          >
            <span className={`transition-transform ${annotationsOpen ? "rotate-90" : ""}`}>&#9654;</span>
            {gotchas.length > 0 && <span className="text-red-400/70">&#9651; {gotchas.length} gotcha{gotchas.length !== 1 ? "s" : ""}</span>}
            {recovery.length > 0 && <span>&#9881; {recovery.length}</span>}
            {decisions.length > 0 && <span>&#9872; {decisions.length}</span>}
            <span>{annotationCount} annotation{annotationCount !== 1 ? "s" : ""}</span>
          </button>
          {annotationsOpen && (
            <div className="flex flex-wrap gap-3 mt-2">
              {gotchas.map((g, i) => (
                <div key={`g-${i}`} className="rounded-lg border border-dashed border-red-200/60 bg-red-50/30 px-3 py-2 max-w-xs">
                  <p className="text-[10px] font-mono font-medium text-red-400/70">&#9651; @gotcha</p>
                  <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{g.issue}{g.detail ? ` — ${g.detail}` : ""}</p>
                </div>
              ))}
              {recovery.map((r, i) => (
                <div key={`r-${i}`} className="rounded-lg border border-dashed border-border/40 bg-muted/20 px-3 py-2 max-w-xs">
                  <p className="text-[10px] font-mono font-medium text-muted-foreground/50">&#9881; @recovery</p>
                  <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{r.issue}{r.means ? ` — ${r.means}` : ""}</p>
                </div>
              ))}
              {decisions.map((d, i) => (
                <div key={`d-${i}`} className="rounded-lg border border-dashed border-border/40 bg-muted/20 px-3 py-2 max-w-xs">
                  <p className="text-[10px] font-mono font-medium text-muted-foreground/50">&#9872; @decision</p>
                  <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{d.title}{d.reason ? ` — ${d.reason}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scenario pills */}
      {hasScenarios && (
        <div className="px-6 pb-4 pt-1">
          <div className="flex flex-wrap gap-2">
            {useWhen.map((w, i) => (
              <span key={`w-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-green-200/50 bg-green-50/20 px-3 py-1 text-[10px] font-mono text-green-600/50">
                &#10003; {w.condition}
              </span>
            ))}
            {useNot.map((n, i) => (
              <span key={`n-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-red-200/50 bg-red-50/20 px-3 py-1 text-[10px] font-mono text-red-400/50">
                &#10007; {n.condition}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
