"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Minimize2,
  Maximize2,
  Search,
  Minus,
  Plus,
  X,
  Network,
  Expand,
  LayoutGrid,
  GitFork,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphData } from "@/lib/graph/types";
import { applyLayout, type LayoutMode } from "@/lib/graph/layout-utils";
import { GdlNodeComponent, type GdlNodeData } from "./gdl-node";
import { NodeDetailPanel } from "./node-detail-panel";
import { BRAND, ALL_NODE_TYPES, NODE_STYLES } from "./constants";

const nodeTypes = { gdlNode: GdlNodeComponent };

// Common edge labels that are noise — hide them
const HIDDEN_LABELS = new Set(["in", "containment"]);

// ─── Inner component ────────────────────────────────────────────────────

interface KnowledgeGraphInnerProps {
  onEntitySelect?: (entity: string) => void;
}

function KnowledgeGraphInner({ onEntitySelect }: KnowledgeGraphInnerProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(ALL_NODE_TYPES));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("organized");
  const layoutModeRef = useRef<LayoutMode>("organized");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GdlNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const edgesRef = useRef<Edge[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Debounce search to avoid re-layout on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Fetch graph data
  useEffect(() => {
    let cancelled = false;

    async function fetchGraph() {
      try {
        const res = await fetch("/api/graph");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `Failed to fetch (${res.status})`);
        }
        const data: GraphData = await res.json();
        if (!cancelled) setGraphData(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load graph");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchGraph();
    return () => { cancelled = true; };
  }, []);

  // Build React Flow nodes/edges from graph data with filtering
  useEffect(() => {
    if (!graphData) return;

    const lowerQuery = debouncedSearch.toLowerCase();

    const filteredNodes = graphData.nodes.filter((node) => {
      if (!activeFilters.has(node.type)) return false;
      if (lowerQuery) {
        return (
          node.label.toLowerCase().includes(lowerQuery) ||
          node.type.toLowerCase().includes(lowerQuery) ||
          Object.values(node.metadata).some((v) => v.toLowerCase().includes(lowerQuery))
        );
      }
      return true;
    });

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    const filteredEdges = graphData.edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
    );

    const rfNodes: Node<GdlNodeData>[] = filteredNodes.map((node) => ({
      id: node.id,
      type: "gdlNode",
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        nodeType: node.type,
        metadata: node.metadata,
        selected: false,
      },
    }));

    const rfEdges: Edge[] = filteredEdges.map((edge, i) => ({
      id: `e-${edge.source}-${edge.target}-${i}`,
      source: edge.source,
      target: edge.target,
      label: HIDDEN_LABELS.has(edge.label ?? "") ? undefined : edge.label,
      type: "default",
      animated: false,
      style: { stroke: BRAND.primary, strokeWidth: 1.5, strokeOpacity: 0.45 },
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
    }));

    // Scale layout width with node count so the grid spreads wide
    const layoutWidth = Math.max(1800, rfNodes.length * 16);
    // Cap iterations for large graphs to avoid blocking the main thread
    const iterations = rfNodes.length > 200 ? 60 : rfNodes.length > 100 ? 100 : 150;

    const laidOutNodes = applyLayout(layoutModeRef.current, rfNodes, rfEdges, {
      width: layoutWidth,
      height: 1200,
      iterations,
    });

    edgesRef.current = rfEdges;
    setNodes(laidOutNodes);
    setEdges(rfEdges);
  }, [graphData, debouncedSearch, activeFilters, setNodes, setEdges]);

  // Update selected state on nodes without re-running layout
  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        data: { ...node.data, selected: node.id === selectedNodeId },
      })),
    );
  }, [selectedNodeId, setNodes]);

  const onNodeClick: NodeMouseHandler<Node<GdlNodeData>> = useCallback(
    (_event, node) => {
      setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
      // Bridge to explorer entity selection
      if (onEntitySelect && node.id.startsWith("entity:")) {
        onEntitySelect(node.id.substring(7));
      }
    },
    [onEntitySelect],
  );

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const selectedGdlNode = useMemo(() => {
    if (!selectedNodeId || !graphData) return null;
    return graphData.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, graphData]);

  const connectedNodes = useMemo(() => {
    if (!selectedNodeId || !graphData) return [];
    const connectedIds = new Set<string>();
    for (const edge of graphData.edges) {
      if (edge.source === selectedNodeId) connectedIds.add(edge.target);
      if (edge.target === selectedNodeId) connectedIds.add(edge.source);
    }
    return graphData.nodes.filter((n) => connectedIds.has(n.id));
  }, [selectedNodeId, graphData]);

  const toggleFilter = useCallback((type: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleLayoutChange = useCallback((mode: LayoutMode) => {
    layoutModeRef.current = mode;
    setLayoutMode(mode);
    setNodes((currentNodes) => {
      const layoutWidth = Math.max(1800, currentNodes.length * 16);
      const iterations = currentNodes.length > 200 ? 60 : currentNodes.length > 100 ? 100 : 150;
      return applyLayout(mode, currentNodes, edgesRef.current, {
        width: layoutWidth,
        height: 1200,
        iterations,
      });
    });
    setTimeout(() => fitView({ duration: 400, padding: 0.15 }), 100);
  }, [fitView, setNodes]);

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      void fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 });
    },
    [fitView],
  );

  const typeCounts = useMemo(() => {
    if (!graphData) return {};
    const counts: Record<string, number> = {};
    for (const node of graphData.nodes) {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
    }
    return counts;
  }, [graphData]);

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border/20 border-t-primary/60" />
          <Network className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-medium text-foreground/80">Loading knowledge graph</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/40">Building graph from GDL index...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/5 ring-1 ring-destructive/10">
          <X className="h-5 w-5 text-destructive/60" />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-medium text-foreground/80">Unable to load graph</p>
          <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground/50">{error}</p>
        </div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/[0.04] ring-1 ring-primary/10">
            <Network className="h-9 w-9 text-primary/25" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-[14px] font-medium text-foreground/80">No knowledge graph yet</p>
          <p className="mt-1.5 max-w-xs text-[12px] leading-relaxed text-muted-foreground/40">
            No GDL files found in the project. Add .gdl, .gdls, .gdlc, or other GDL files to see the knowledge graph.
          </p>
        </div>
      </div>
    );
  }

  // ─── Graph view ───────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={cn("flex h-full flex-col", isFullscreen && "bg-background")}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border/30 bg-card/50 px-4 py-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="h-7 w-48 rounded-lg border border-border/30 bg-background pl-8 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground/30 transition-all duration-200 focus:w-64 focus:border-primary/30 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-border/30" />

        {/* Type filter chips */}
        <div className="flex items-center gap-1">
          {ALL_NODE_TYPES.map((type) => {
            const isActive = activeFilters.has(type);
            const count = typeCounts[type] ?? 0;
            const isHighIntensity = NODE_STYLES[type]?.intensity === "high" || NODE_STYLES[type]?.intensity === "medium";

            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleFilter(type)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150",
                  isActive
                    ? isHighIntensity
                      ? "bg-primary/[0.06] text-primary/70"
                      : "bg-muted/40 text-muted-foreground/70"
                    : "text-muted-foreground/25 hover:text-muted-foreground/50",
                )}
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-opacity",
                    isHighIntensity ? "bg-primary" : "bg-muted-foreground",
                  )}
                  style={{ opacity: isActive ? 0.5 : 0.2 }}
                />
                {type}
                {count > 0 && isActive && (
                  <span className="text-[9px] opacity-50">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/35">
            {nodes.length} nodes · {edges.length} edges
          </span>

          <div className="h-4 w-px bg-border/30" />

          {/* Layout toggle */}
          <div className="flex items-center rounded-lg border border-border/30 p-0.5">
            <button
              type="button"
              onClick={() => handleLayoutChange("organized")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150",
                layoutMode === "organized"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70",
              )}
              title="Organized layout"
            >
              <LayoutGrid className="h-3 w-3" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange("force")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150",
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

          {/* Zoom controls */}
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
            onClick={() => void fitView({ duration: 400, padding: 0.15 })}
            className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted/30 hover:text-foreground"
            title="Fit to view"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted/30 hover:text-foreground"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* React Flow canvas */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.05}
            maxZoom={2.5}
            defaultEdgeOptions={{ type: "default" }}
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

        {selectedGdlNode && (
          <NodeDetailPanel
            node={selectedGdlNode}
            connectedNodes={connectedNodes}
            onClose={() => setSelectedNodeId(null)}
            onNavigateToNode={handleNavigateToNode}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main export (wraps with ReactFlowProvider) ─────────────────────────

interface KnowledgeGraphProps {
  onEntitySelect?: (entity: string) => void;
}

export function KnowledgeGraph({ onEntitySelect }: KnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner onEntitySelect={onEntitySelect} />
    </ReactFlowProvider>
  );
}
