"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import cytoscape from "cytoscape";
import type { GdlmFile } from "@/lib/parsers/gdlm-parser";
import { ensureDagreRegistered } from "@/lib/cytoscape-setup";

ensureDagreRegistered();

// Border accent colors per type — harmonise with green primary theme
// Node fills come from resolved CSS vars (card color) at render time
const TYPE_BORDER_COLORS: Record<string, string> = {
  observation: "hsl(152 38% 55%)",   // green — aligned to chart-2/3
  decision:    "hsl(45 65% 50%)",    // warm amber — complementary
  preference:  "hsl(200 40% 55%)",   // cool teal-blue — analogous
  error:       "hsl(0 65% 55%)",     // from destructive palette
  fact:        "hsl(152 50% 36%)",   // theme primary green
  task:        "hsl(30 50% 55%)",    // warm neutral — earthy
  procedural:  "hsl(180 35% 48%)",   // teal — analogous to green
  summary:     "hsl(40 12% 55%)",    // warm gray — from muted palette
  anchor:      "hsl(165 40% 45%)",   // teal-green — between primary and teal
  "":          "hsl(152 38% 55%)",   // fallback to observation green
};

const TYPE_LABELS: Record<string, string> = {
  observation: "Observation",
  decision: "Decision",
  preference: "Preference",
  error: "Error",
  fact: "Fact",
  task: "Task",
  procedural: "Procedural",
  summary: "Summary",
  anchor: "Anchor",
};

function resolveColor(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return fallback;
  const el = document.createElement("div");
  el.style.color = raw;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  document.body.removeChild(el);
  return resolved;
}

interface KnowledgeGraphProps {
  data: GdlmFile;
  onSubjectSelect?: (subject: string) => void;
}

export function KnowledgeGraph({ data, onSubjectSelect }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  const buildElements = useCallback((): cytoscape.ElementDefinition[] => {
    const elements: cytoscape.ElementDefinition[] = [];

    // Count memories per subject and collect types
    const subjectCounts = new Map<string, number>();
    const subjectTypes = new Map<string, string>();
    for (const mem of data.memories) {
      subjectCounts.set(mem.subject, (subjectCounts.get(mem.subject) || 0) + 1);
      if (mem.type && !subjectTypes.has(mem.subject)) {
        subjectTypes.set(mem.subject, mem.type);
      }
    }

    // Add subject nodes
    for (const subject of data.subjects) {
      const count = subjectCounts.get(subject) || 1;
      const memType = subjectTypes.get(subject) || "";
      const borderColor = TYPE_BORDER_COLORS[memType] || TYPE_BORDER_COLORS[""];

      elements.push({
        data: {
          id: subject,
          label: `${subject}  (${count})`,
          borderColor,
          memType,
        },
        classes: "subject",
      });
    }

    // Add anchor nodes
    for (const anchor of data.anchors) {
      if (!anchor.concept) continue;
      elements.push({
        data: {
          id: `anchor-${anchor.concept}`,
          label: anchor.concept,
          borderColor: TYPE_BORDER_COLORS.anchor,
          memType: "anchor",
        },
        classes: "anchor",
      });
    }

    // Pre-build ID -> memory map for O(1) lookups
    const memById = new Map(data.memories.map((m) => [m.id, m]));

    // Add edges from relates field
    const edgeSet = new Set<string>();
    for (const mem of data.memories) {
      if (!mem.relates) continue;
      const parts = mem.relates.split("~");
      const relType = parts.length > 1 ? parts[0] : "relates";
      const targetId = parts.length > 1 ? parts[1] : parts[0];

      const targetSubject = memById.get(targetId)?.subject;

      if (targetSubject && targetSubject !== mem.subject) {
        const edgeKey = `${mem.subject}-${targetSubject}-${relType}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          elements.push({
            data: {
              id: edgeKey,
              source: mem.subject,
              target: targetSubject,
              label: relType,
            },
          });
        }
      }
    }

    return elements;
  }, [data]);

  // Collect active types for legend
  useEffect(() => {
    const types = new Set<string>();
    for (const mem of data.memories) {
      if (mem.type) types.add(mem.type);
    }
    if (data.anchors.length > 0) types.add("anchor");
    setActiveTypes(types);
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;

    const bg = resolveColor("--background", "#ffffff");
    const fg = resolveColor("--foreground", "#1a1a1a");
    const card = resolveColor("--card", "#ffffff");
    const border = resolveColor("--border", "#e5e5e5");
    const primary = resolveColor("--primary", "#0066cc");

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(),
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            "background-color": card,
            "border-width": 2,
            "border-color": "data(borderColor)",
            color: fg,
            "font-size": "10px",
            "font-family": "'JetBrains Mono', monospace",
            "text-wrap": "wrap",
            shape: "round-rectangle",
            width: "label",
            height: "label",
            padding: "8px",
            "transition-property": "opacity border-width border-color" as unknown as string,
            "transition-duration": 150,
          } as cytoscape.Css.Node,
        },
        {
          selector: "node.anchor",
          style: {
            "border-style": "dashed",
            "border-width": 2,
            shape: "round-rectangle",
          } as cytoscape.Css.Node,
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": border,
            "target-arrow-color": border,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "transition-property": "opacity line-color target-arrow-color" as unknown as string,
            "transition-duration": 150,
          } as cytoscape.Css.Edge,
        },
        {
          selector: "edge[label]",
          style: {
            label: "data(label)",
            "font-size": "9px",
            "font-family": "'JetBrains Mono', monospace",
            color: fg,
            "text-background-color": bg,
            "text-background-opacity": 1,
            "text-background-padding": "2px",
          } as cytoscape.Css.Edge,
        },
        {
          selector: "node:selected",
          style: {
            "border-color": primary,
            "border-width": 3,
          } as cytoscape.Css.Node,
        },
        {
          selector: "node.dimmed",
          style: {
            opacity: 0.15,
          } as cytoscape.Css.Node,
        },
        {
          selector: "edge.dimmed",
          style: {
            opacity: 0.08,
          } as cytoscape.Css.Edge,
        },
        {
          selector: "node.highlighted",
          style: {
            "border-width": 3,
            "border-color": primary,
          } as cytoscape.Css.Node,
        },
        {
          selector: "edge.highlighted",
          style: {
            width: 2.5,
            "line-color": primary,
            "target-arrow-color": primary,
          } as cytoscape.Css.Edge,
        },
      ],
      layout: {
        name: "dagre",
        rankDir: "TB",
        nodeSep: 60,
        rankSep: 60,
      } as cytoscape.LayoutOptions,
      minZoom: 0.1,
      maxZoom: 5,
    });

    // Hover highlighting
    cy.on("mouseover", "node", (evt) => {
      const node = evt.target;
      const neighborhood = node.neighborhood().add(node);
      cy.elements().not(neighborhood).addClass("dimmed");
      neighborhood.addClass("highlighted");
    });

    cy.on("mouseout", "node", () => {
      cy.elements().removeClass("dimmed highlighted");
    });

    cy.on("tap", "node", (evt) => {
      const nodeId = evt.target.id();
      onSubjectSelect?.(nodeId.replace(/^anchor-/, ""));
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [buildElements, onSubjectSelect]);

  const handleFit = () => cyRef.current?.fit(undefined, 30);
  const handleZoomIn = () => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const handleZoomOut = () => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  const legendTypes = [...activeTypes].sort();

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 rounded-md border border-border/50 bg-background/90 backdrop-blur-sm text-xs font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 rounded-md border border-border/50 bg-background/90 backdrop-blur-sm text-xs font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center"
          title="Zoom out"
        >
          &minus;
        </button>
        <button
          onClick={handleFit}
          className="w-7 h-7 rounded-md border border-border/50 bg-background/90 backdrop-blur-sm text-[9px] font-mono text-foreground hover:bg-accent transition-colors flex items-center justify-center"
          title="Fit to view"
        >
          FIT
        </button>
      </div>

      {/* Type legend */}
      {legendTypes.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 px-2.5 py-1.5 rounded-md border border-border/50 bg-background/90 backdrop-blur-sm">
          {legendTypes.map((type) => {
            const borderColor = TYPE_BORDER_COLORS[type] || TYPE_BORDER_COLORS[""];
            return (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm border-2 bg-card"
                  style={{ borderColor }}
                />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {TYPE_LABELS[type] || type}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
