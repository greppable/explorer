"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Activity,
  BookOpen,
  Calendar,
  ChevronDown,
  GitBranch,
  Network,
  Search,
  Sparkles,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import { cn, getErrorMessage } from "@/lib/utils";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type {
  TimelineLayer,
  TimelinePayload,
  TimelineEvent,
} from "@/lib/timeline/types";
import { ALL_LAYERS, LANE_STYLES } from "./constants";
import { TimelineCanvas } from "./timeline-canvas";
import { TimelineStory } from "./timeline-story";
import { TimelineWeave } from "./timeline-weave";
import { TimelineIntensity } from "./timeline-intensity";
import { TimelineDetail } from "./timeline-detail";
import { formatDateLong } from "./timeline-utils";
import { useNow } from "./use-now";

type DatePreset = "7d" | "30d" | "90d" | "all";
const PRESET_DAYS: Record<Exclude<DatePreset, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

type ViewMode = "panorama" | "weave" | "intensity" | "story";

interface DateRange {
  from: string | null; // YYYY-MM-DD
  to: string | null;
}

interface ProjectTimelineProps {
  onEntitySelect?: (entity: string) => void;
  onOpenInExplorer?: (filePath: string, line?: number) => void;
}

export function ProjectTimeline({ onEntitySelect, onOpenInExplorer }: ProjectTimelineProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  type FetchState =
    | { status: "loading" }
    | { status: "ready"; payload: TimelinePayload }
    | { status: "error"; message: string };

  const [fetchState, setFetchState] = useState<FetchState>({ status: "loading" });

  const [viewMode, setViewMode] = useState<ViewMode>("panorama");
  const [visibleLayers, setVisibleLayers] = useState<Set<TimelineLayer>>(
    new Set(ALL_LAYERS),
  );
  const [visibleAgents, setVisibleAgents] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showArcs, setShowArcs] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [activePreset, setActivePreset] = useState<DatePreset | null>(null);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const agentsPopoverRef = useRef<HTMLDivElement>(null);
  const now = useNow();

  // Close agents popover when clicking outside
  useEffect(() => {
    if (!agentsOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        agentsPopoverRef.current &&
        !agentsPopoverRef.current.contains(e.target as Node)
      ) {
        setAgentsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [agentsOpen]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    fetch("/api/timeline")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((payload: TimelinePayload) => {
        if (cancelled) return;
        setFetchState({ status: "ready", payload });
        // Build the initial agent set from the actual event stream rather than
        // just summary.agents, so any future event type that carries an agent
        // field (currently only memory + source emit one) doesn't get silently
        // filtered because its agent isn't in the toggle set.
        const allAgents = new Set<string>();
        for (const evt of payload.events) {
          if (evt.agent) allAgents.add(evt.agent);
        }
        setVisibleAgents(allAgents);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchState({ status: "error", message: getErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = fetchState.status === "ready" ? fetchState.payload : null;
  const error = fetchState.status === "error" ? fetchState.message : null;
  const isLoading = fetchState.status === "loading";

  // Canonical list of agents for the filter UI. Derived from the event stream
  // rather than summary.agents so it stays in sync with the visibleAgents
  // initial state and any future event type that carries an agent field.
  const allAgents = useMemo<string[]>(() => {
    if (!data) return [];
    const s = new Set<string>();
    for (const evt of data.events) {
      if (evt.agent) s.add(evt.agent);
    }
    return [...s].sort();
  }, [data]);

  const selectedEvent: TimelineEvent | null = useMemo(() => {
    if (!data || !selectedEventId) return null;
    return data.events.find((e) => e.id === selectedEventId) ?? null;
  }, [data, selectedEventId]);

  const relatedEvents: TimelineEvent[] = useMemo(() => {
    if (!data || !selectedEvent) return [];
    const own = new Set(selectedEvent.entities);
    if (own.size === 0) return [];
    return data.events.filter((e) => {
      if (e.id === selectedEvent.id) return false;
      return e.entities.some((ent) => own.has(ent));
    });
  }, [data, selectedEvent]);

  // Bridge to global entity selection
  useEffect(() => {
    if (!selectedEvent || !onEntitySelect) return;
    const primary = selectedEvent.entities[0];
    if (primary) onEntitySelect(primary);
  }, [selectedEvent, onEntitySelect]);

  const toggleLayer = (layer: TimelineLayer) =>
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });

  const toggleAgent = (agent: string) =>
    setVisibleAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) next.delete(agent);
      else next.add(agent);
      return next;
    });

  const toggleAllLayers = () =>
    setVisibleLayers((prev) =>
      prev.size === ALL_LAYERS.length ? new Set() : new Set(ALL_LAYERS),
    );

  const applyPreset = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset === "all") {
      setDateRange({ from: null, to: null });
      return;
    }
    if (now === null) return;
    const days = PRESET_DAYS[preset];
    const today = new Date(now);
    const past = new Date(now - days * 24 * 60 * 60 * 1000);
    const toIso = (d: Date) => d.toISOString().split("T")[0];
    setDateRange({ from: toIso(past), to: toIso(today) });
  };

  const clearPresetAnd = (mutator: () => void) => {
    setActivePreset(null);
    mutator();
  };

  const handleZoomTo = (from: string | null, to: string | null) => {
    setActivePreset(null);
    setDateRange({ from, to });
  };

  // ─── Loading / error / empty ─────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border/20 border-t-primary/60" />
          <Calendar className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="font-serif text-base text-foreground/80">
            Composing the chronicle
          </p>
          <p className="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground/40">
            Reading every dated record across the project…
          </p>
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
          <p className="text-[13px] font-medium text-foreground/80">
            Could not load timeline
          </p>
          <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground/50">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/[0.04] ring-1 ring-primary/10">
          <Sparkles className="h-9 w-9 text-primary/25" />
        </div>
        <div className="max-w-sm text-center">
          <p className="font-serif text-xl text-foreground/85">
            Nothing has happened yet
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/55">
            Your timeline lights up the moment dated GDL records appear — start with{" "}
            <code className="font-mono text-[11px] text-foreground/70">
              .gdlm
            </code>{" "}
            memories or any file with a{" "}
            <code className="font-mono text-[11px] text-foreground/70">
              # @VERSION
            </code>{" "}
            header.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  const range = data.summary.dateRange;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Editorial header */}
      <header className="relative border-b border-border/40 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
                The Greppable Chronicle
              </span>
              <span className="h-px w-10 bg-border/60" />
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground/45">
                {data.summary.totalEvents} moments · {data.phases.length} chapters
              </span>
            </div>
            <h1 className="mt-1.5 font-serif text-3xl leading-tight text-foreground/90">
              {range
                ? `${formatDateLong(range.start)} — ${formatDateLong(range.end)}`
                : "An untimed work"}
            </h1>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-card/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("panorama")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                viewMode === "panorama"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              <Waypoints className="h-3 w-3" />
              Panorama
            </button>
            <button
              type="button"
              onClick={() => setViewMode("weave")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                viewMode === "weave"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              <Network className="h-3 w-3" />
              Weave
            </button>
            <button
              type="button"
              onClick={() => setViewMode("intensity")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                viewMode === "intensity"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              <Activity className="h-3 w-3" />
              Intensity
            </button>
            <button
              type="button"
              onClick={() => setViewMode("story")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                viewMode === "story"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              <BookOpen className="h-3 w-3" />
              Story
            </button>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border/40 bg-card/25 px-6 py-2.5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search moments, tags, entities…"
            className="h-7 w-56 rounded-lg border border-border/40 bg-background pl-8 pr-7 text-[11px] text-foreground placeholder:text-muted-foreground/35 transition-all focus:w-72 focus:border-primary/40 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/45 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-border/40" />

        {/* Layer chips */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={toggleAllLayers}
            className="rounded-md px-1.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground"
          >
            {visibleLayers.size === ALL_LAYERS.length ? "none" : "all"}
          </button>
          {ALL_LAYERS.map((layer) => {
            const style = LANE_STYLES[layer];
            const accent = isDark ? style.accentDark : style.accent;
            const isActive = visibleLayers.has(layer);
            const count = data.summary.layerCounts[layer] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={layer}
                type="button"
                onClick={() => toggleLayer(layer)}
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
                {style.label}
                <span className="font-mono text-[9px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Agents popover */}
        {allAgents.length > 0 && (
          <>
            <div className="h-4 w-px bg-border/40" />
            <div ref={agentsPopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setAgentsOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border border-border/40 px-2 py-1 text-[10px] font-medium transition-colors",
                  agentsOpen
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "text-foreground/70 hover:bg-muted/40",
                )}
                title="Filter by agent"
              >
                <Users className="h-3 w-3" />
                Agents
                <span className="font-mono text-[9.5px] opacity-60">
                  {visibleAgents.size}/{allAgents.length}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    agentsOpen && "rotate-180",
                  )}
                />
              </button>
              {agentsOpen && (
                <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-lg border border-border/50 bg-card p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted-foreground/55">
                      Filter by agent
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleAgents(new Set(allAgents))
                        }
                        className="font-mono text-[10px] text-muted-foreground/60 hover:text-foreground"
                      >
                        all
                      </button>
                      <span className="text-muted-foreground/30">·</span>
                      <button
                        type="button"
                        onClick={() => setVisibleAgents(new Set())}
                        className="font-mono text-[10px] text-muted-foreground/60 hover:text-foreground"
                      >
                        none
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {allAgents.map((agent) => {
                      const isActive = visibleAgents.has(agent);
                      return (
                        <button
                          key={agent}
                          type="button"
                          onClick={() => toggleAgent(agent)}
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wide transition-all",
                            isActive
                              ? "border-primary/40 bg-primary/5 text-primary"
                              : "border-border/40 text-muted-foreground/60 hover:text-foreground",
                          )}
                        >
                          {agent}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Date range presets */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/40 bg-background/60 p-0.5">
            {(["7d", "30d", "90d", "all"] as DatePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "rounded px-1.5 py-1 font-mono text-[10px] font-medium transition-colors",
                  activePreset === p
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/55 hover:text-foreground",
                )}
                title={p === "all" ? "Show all dates" : `Last ${PRESET_DAYS[p]} days`}
              >
                {p === "all" ? "All" : p}
              </button>
            ))}
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-background/60 px-2 py-0.5">
            <Calendar className="h-3 w-3 text-muted-foreground/45" />
            <input
              type="date"
              value={dateRange.from ?? ""}
              min={range?.start.split("T")[0]}
              max={dateRange.to ?? range?.end.split("T")[0]}
              onChange={(e) =>
                clearPresetAnd(() =>
                  setDateRange((prev) => ({ ...prev, from: e.target.value || null })),
                )
              }
              className="h-6 bg-transparent font-mono text-[10px] text-foreground/80 focus:outline-none"
              aria-label="From date"
            />
            <span className="font-mono text-[10px] text-muted-foreground/45">→</span>
            <input
              type="date"
              value={dateRange.to ?? ""}
              min={dateRange.from ?? range?.start.split("T")[0]}
              max={range?.end.split("T")[0]}
              onChange={(e) =>
                clearPresetAnd(() =>
                  setDateRange((prev) => ({ ...prev, to: e.target.value || null })),
                )
              }
              className="h-6 bg-transparent font-mono text-[10px] text-foreground/80 focus:outline-none"
              aria-label="To date"
            />
            {(dateRange.from || dateRange.to) && (
              <button
                type="button"
                onClick={() =>
                  clearPresetAnd(() => setDateRange({ from: null, to: null }))
                }
                className="rounded p-0.5 text-muted-foreground/45 hover:text-foreground"
                title="Clear date range"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {viewMode === "panorama" && (
            <button
              type="button"
              onClick={() => setShowArcs((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                showArcs
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/45 hover:text-foreground",
              )}
              title="Toggle cross-layer arcs"
            >
              <GitBranch className="h-3 w-3" />
              Arcs
            </button>
          )}
        </div>
      </div>

      {/* Body: canvas/weave/story + resizable detail.
          Key forces remount when the detail panel toggles in/out so
          react-resizable-panels honours the new defaultSize values
          (defaultSize is initial-only, not reactive). */}
      <div className="flex flex-1 min-h-0">
        <ResizablePanelGroup
          key={selectedEvent ? "split" : "full"}
          direction="horizontal"
        >
          <ResizablePanel defaultSize={selectedEvent ? 72 : 100} minSize={30}>
            <div className="flex h-full min-w-0 flex-col">
              {viewMode === "panorama" && (
                <TimelineCanvas
                  data={data}
                  visibleLayers={visibleLayers}
                  visibleAgents={visibleAgents}
                  query={debouncedQuery}
                  dateFrom={dateRange.from}
                  dateTo={dateRange.to}
                  selectedEventId={selectedEventId}
                  hoveredEventId={hoveredEventId}
                  onSelectEvent={setSelectedEventId}
                  onHoverEvent={setHoveredEventId}
                  showArcs={showArcs}
                  onZoomTo={handleZoomTo}
                />
              )}
              {viewMode === "weave" && (
                <TimelineWeave
                  data={data}
                  visibleLayers={visibleLayers}
                  visibleAgents={visibleAgents}
                  query={debouncedQuery}
                  dateFrom={dateRange.from}
                  dateTo={dateRange.to}
                  selectedEventId={selectedEventId}
                  hoveredEventId={hoveredEventId}
                  onSelectEvent={setSelectedEventId}
                  onHoverEvent={setHoveredEventId}
                  onZoomTo={handleZoomTo}
                />
              )}
              {viewMode === "intensity" && (
                <TimelineIntensity
                  data={data}
                  visibleLayers={visibleLayers}
                  visibleAgents={visibleAgents}
                  query={debouncedQuery}
                  dateFrom={dateRange.from}
                  dateTo={dateRange.to}
                  onZoomTo={handleZoomTo}
                />
              )}
              {viewMode === "story" && (
                <TimelineStory
                  data={data}
                  visibleLayers={visibleLayers}
                  visibleAgents={visibleAgents}
                  query={debouncedQuery}
                  dateFrom={dateRange.from}
                  dateTo={dateRange.to}
                  selectedEventId={selectedEventId}
                  onSelectEvent={setSelectedEventId}
                  isDark={isDark}
                />
              )}
            </div>
          </ResizablePanel>

          {selectedEvent && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={28} minSize={15} maxSize={50}>
                <TimelineDetail
                  event={selectedEvent}
                  related={relatedEvents}
                  isDark={isDark}
                  onClose={() => setSelectedEventId(null)}
                  onSelectRelated={(id) => setSelectedEventId(id)}
                  onOpenInExplorer={onOpenInExplorer}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
