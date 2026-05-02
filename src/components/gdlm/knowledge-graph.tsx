"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  MarkerType,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Expand,
  GitFork,
  LayoutGrid,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GdlmFile } from "@/lib/parsers/gdlm-parser";
import { applyLayout, type LayoutMode } from "@/lib/graph/layout-utils";
import { BRAND } from "@/components/graph/constants";
import { MemoryNodeComponent, type MemoryNodeData } from "./memory-node";
import { AnchorNodeComponent, type AnchorNodeData } from "./anchor-node";

// Color of the eyebrow chip on the type-filter buttons. Matches the per-type
// accent inside MemoryNode so the legend reads as a key for the canvas.
const TYPE_COLORS: Record<string, string> = {
  observation: "hsl(152 38% 55%)",
  decision:    "hsl(45 65% 50%)",
  preference:  "hsl(200 40% 55%)",
  error:       "hsl(0 65% 55%)",
  fact:        "hsl(152 50% 36%)",
  task:        "hsl(30 50% 55%)",
  procedural:  "hsl(180 35% 48%)",
  summary:     "hsl(40 12% 55%)",
  anchor:      "hsl(165 50% 42%)",
  "":          "hsl(152 38% 55%)",
};

const TYPE_LABELS: Record<string, string> = {
  observation: "Observation",
  decision:    "Decision",
  preference:  "Preference",
  error:       "Error",
  fact:        "Fact",
  task:        "Task",
  procedural:  "Procedural",
  summary:     "Summary",
  anchor:      "Anchor",
};

const ANCHOR_PREFIX = "anchor:";

const nodeTypes = {
  memory: MemoryNodeComponent,
  anchor: AnchorNodeComponent,
};

type AnyNodeData = MemoryNodeData | AnchorNodeData;

interface KnowledgeGraphProps {
  data: GdlmFile;
  onSubjectSelect?: (subject: string) => void;
}

function KnowledgeGraphInner({ data, onSubjectSelect }: KnowledgeGraphProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("force");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [visibleTypesOverride, setVisibleTypesOverride] =
    useState<Set<string> | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AnyNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Active types derived from data — no setState in effect needed
  const activeTypes = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const mem of data.memories) {
      if (mem.type) s.add(mem.type);
      else s.add("observation");
    }
    if (data.anchors.length > 0) s.add("anchor");
    return s;
  }, [data]);

  const visibleTypes = visibleTypesOverride ?? activeTypes;

  const typeCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const mem of data.memories) {
      const t = mem.type || "observation";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    if (data.anchors.length > 0) counts.anchor = data.anchors.length;
    return counts;
  }, [data]);

  // Build raw graph from gdlm data (no positions yet — layout runs after)
  const rawGraph = useMemo(() => {
    const lowerQuery = debouncedQuery.trim().toLowerCase();

    function subjectMatchesQuery(subject: string): boolean {
      if (!lowerQuery) return true;
      if (subject.toLowerCase().includes(lowerQuery)) return true;
      return data.memories.some(
        (m) =>
          m.subject === subject &&
          (m.detail.toLowerCase().includes(lowerQuery) ||
            m.tags.some((t) => t.toLowerCase().includes(lowerQuery))),
      );
    }
    function anchorMatchesQuery(concept: string, scope: string[]): boolean {
      if (!lowerQuery) return true;
      if (concept.toLowerCase().includes(lowerQuery)) return true;
      return scope.some((s) => s.toLowerCase().includes(lowerQuery));
    }

    // Subject → primary memory type + count
    const subjectType = new Map<string, string>();
    const subjectCount = new Map<string, number>();
    for (const mem of data.memories) {
      const t = mem.type || "observation";
      if (!subjectType.has(mem.subject)) subjectType.set(mem.subject, t);
      subjectCount.set(mem.subject, (subjectCount.get(mem.subject) ?? 0) + 1);
    }

    const visibleNodes: Node<AnyNodeData>[] = [];
    const renderedIds = new Set<string>();

    // Memory subject nodes
    for (const subject of data.subjects) {
      const memType = subjectType.get(subject) || "observation";
      if (!visibleTypes.has(memType)) continue;
      if (!subjectMatchesQuery(subject)) continue;
      const id = subject;
      visibleNodes.push({
        id,
        type: "memory",
        position: { x: 0, y: 0 },
        data: {
          label: subject,
          nodeType: memType,
          memType,
          count: subjectCount.get(subject) ?? 1,
          selected: false,
        },
      });
      renderedIds.add(id);
    }

    // Anchor nodes
    if (visibleTypes.has("anchor")) {
      for (const anchor of data.anchors) {
        if (!anchor.concept) continue;
        if (!anchorMatchesQuery(anchor.concept, anchor.scope)) continue;
        const id = `${ANCHOR_PREFIX}${anchor.concept}`;
        visibleNodes.push({
          id,
          type: "anchor",
          position: { x: 0, y: 0 },
          data: {
            label: anchor.concept,
            nodeType: "anchor",
            scopeCount: anchor.scope.length,
            selected: false,
          },
        });
        renderedIds.add(id);
      }
    }

    // Anchor → subject edges (the visual linkage that was missing). Emit as
    // dashed faint hairlines so they read as "membership" rather than direct
    // causal pointers.
    const visibleEdges: Edge[] = [];
    const seenEdges = new Set<string>();
    for (const mem of data.memories) {
      if (!mem.anchor || !mem.subject) continue;
      const anchorId = `${ANCHOR_PREFIX}${mem.anchor}`;
      if (!renderedIds.has(anchorId) || !renderedIds.has(mem.subject)) continue;
      const key = `${anchorId}->${mem.subject}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      visibleEdges.push({
        id: `e-${key}`,
        source: anchorId,
        target: mem.subject,
        type: "default",
        animated: false,
        style: {
          stroke: BRAND.primary,
          strokeWidth: 1.2,
          strokeOpacity: 0.32,
          strokeDasharray: "4 4",
        },
      });
    }

    // Relates pointers (kind~ID) — solid edges with the kind as a label
    const memById = new Map(data.memories.map((m) => [m.id, m]));
    for (const mem of data.memories) {
      if (!mem.relates) continue;
      const parts = mem.relates.split("~");
      const relType = parts.length > 1 ? parts[0] : "relates";
      const targetId = parts.length > 1 ? parts[1] : parts[0];
      const targetSubject = memById.get(targetId)?.subject;
      if (!targetSubject || targetSubject === mem.subject) continue;
      if (!renderedIds.has(mem.subject) || !renderedIds.has(targetSubject)) continue;
      const key = `${mem.subject}->${targetSubject}-${relType}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      visibleEdges.push({
        id: `r-${key}`,
        source: mem.subject,
        target: targetSubject,
        label: relType,
        type: "default",
        animated: false,
        style: { stroke: BRAND.primary, strokeWidth: 1.5, strokeOpacity: 0.5 },
        labelStyle: { fontSize: 8, fill: BRAND.neutralMuted, fontWeight: 500 },
        labelBgStyle: { fill: "var(--background)", fillOpacity: 0.9 },
        labelBgPadding: [3, 2] as [number, number],
        labelBgBorderRadius: 3,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 10,
          height: 10,
          color: BRAND.primary,
        },
      });
    }

    return { nodes: visibleNodes, edges: visibleEdges };
  }, [data, debouncedQuery, visibleTypes]);

  // Re-layout whenever the raw graph or layout mode changes
  useEffect(() => {
    const layoutWidth = Math.max(1200, rawGraph.nodes.length * 28);
    const iterations =
      rawGraph.nodes.length > 200 ? 80 : rawGraph.nodes.length > 80 ? 120 : 180;
    const laidOut = applyLayout(layoutMode, rawGraph.nodes, rawGraph.edges, {
      width: layoutWidth,
      height: 900,
      iterations,
    });
    setNodes(laidOut);
    setEdges(rawGraph.edges);
  }, [rawGraph, layoutMode, setNodes, setEdges]);

  // Mark the selected node without re-running layout
  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        data: { ...node.data, selected: node.id === selectedNodeId },
      })),
    );
  }, [selectedNodeId, setNodes]);

  const handleLayoutChange = useCallback(
    (mode: LayoutMode) => {
      // The relayout effect above re-runs on layoutMode change; we just nudge
      // fitView once positions settle so the user sees the new arrangement.
      setLayoutMode(mode);
      setTimeout(() => fitView({ duration: 350, padding: 0.18 }), 80);
    },
    [fitView],
  );

  const onNodeClick: NodeMouseHandler<Node<AnyNodeData>> = useCallback(
    (_event, node) => {
      setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
      const subject = node.id.startsWith(ANCHOR_PREFIX)
        ? node.id.slice(ANCHOR_PREFIX.length)
        : node.id;
      onSubjectSelect?.(subject);
    },
    [onSubjectSelect],
  );

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const toggleType = (t: string) => {
    setVisibleTypesOverride((prev) => {
      const base = prev ?? activeTypes;
      const next = new Set(base);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const sortedTypes = [...activeTypes].sort();

  return (
    <div className="flex h-full w-full flex-col">
      {/* Toolbar — same composition as the main knowledge graph */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/30 bg-card/40 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects, tags…"
            className="h-7 w-48 rounded-lg border border-border/30 bg-background pl-8 pr-7 text-[11px] text-foreground placeholder:text-muted-foreground/35 transition-all focus:w-64 focus:border-primary/30 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/45 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-border/40" />

        <div className="flex flex-wrap items-center gap-1">
          {sortedTypes.map((type) => {
            const isActive = visibleTypes.has(type);
            const accent = TYPE_COLORS[type] || TYPE_COLORS[""];
            const count = typeCounts[type] ?? 0;
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
                  isActive
                    ? "bg-muted/40 text-foreground/80"
                    : "text-muted-foreground/30 hover:text-muted-foreground/60",
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: accent,
                    opacity: isActive ? 0.85 : 0.3,
                  }}
                />
                {TYPE_LABELS[type] || type}
                <span className="font-mono text-[9px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/30 p-0.5">
            <button
              type="button"
              onClick={() => handleLayoutChange("organized")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
                layoutMode === "organized"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70",
              )}
              title="Organised layout"
            >
              <LayoutGrid className="h-3 w-3" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange("force")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
                layoutMode === "force"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70",
              )}
              title="Force-directed layout"
            >
              <GitFork className="h-3 w-3" />
              Force
            </button>
          </div>

          <div className="h-4 w-px bg-border/30" />

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => void zoomOut({ duration: 200 })}
              className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => void zoomIn({ duration: 200 })}
              className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void fitView({ duration: 400, padding: 0.18 })}
            className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted/30 hover:text-foreground"
            title="Fit to view"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 min-h-0">
        <div className="absolute bottom-2 left-2 z-10 rounded-md bg-background/80 px-2 py-1 font-mono text-[10px] text-muted-foreground/45 backdrop-blur-sm">
          {nodes.length} nodes · {edges.length} edges
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.1}
          maxZoom={3}
          defaultEdgeOptions={{ type: "default" }}
          onlyRenderVisibleElements
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={0.8}
            color="var(--border)"
            style={{ opacity: 0.25 }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner {...props} />
    </ReactFlowProvider>
  );
}
