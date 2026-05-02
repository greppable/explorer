"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "./use-now";
import { useTheme } from "next-themes";
import type {
  TimelinePayload,
  TimelinePhase,
  TimelineLayer,
} from "@/lib/timeline/types";
import { LANE_ORDER, LANE_STYLES } from "./constants";
import {
  buildDensity,
  densityPath,
  formatDateLong,
  formatDateShort,
  makeScale,
  makeTicks,
  plotLane,
  toMs,
  zoomDomain,
  type PlottedEvent,
} from "./timeline-utils";

interface TimelineCanvasProps {
  data: TimelinePayload;
  visibleLayers: Set<TimelineLayer>;
  visibleAgents: Set<string>;
  query: string;
  dateFrom: string | null; // YYYY-MM-DD inclusive
  dateTo: string | null;   // YYYY-MM-DD inclusive
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onHoverEvent: (id: string | null) => void;
  hoveredEventId: string | null;
  showArcs: boolean;
  onZoomTo?: (from: string | null, to: string | null) => void;
}

const DENSITY_HEIGHT = 56;
const PHASE_LABEL_HEIGHT = 28;
const AXIS_HEIGHT = 26;
const LANE_HEIGHT_MIN = 64;
const LANE_LABEL_WIDTH = 140;
const PADDING_X = 32;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 24;

export function TimelineCanvas({
  data,
  visibleLayers,
  visibleAgents,
  query,
  dateFrom,
  dateTo,
  selectedEventId,
  onSelectEvent,
  onHoverEvent,
  hoveredEventId,
  showArcs,
  onZoomTo,
}: TimelineCanvasProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const now = useNow();

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 600 });

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.max(width, 480), height: Math.max(height, 320) });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Filtered events
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromMs = dateFrom ? Date.parse(`${dateFrom}T00:00:00Z`) : null;
    const toMsCutoff = dateTo ? Date.parse(`${dateTo}T23:59:59Z`) : null;
    return data.events.filter((evt) => {
      if (!visibleLayers.has(evt.layer)) return false;
      if (evt.agent && !visibleAgents.has(evt.agent)) return false;
      if (fromMs !== null && toMs(evt.date) < fromMs) return false;
      if (toMsCutoff !== null && toMs(evt.date) > toMsCutoff) return false;
      if (q) {
        const hay =
          evt.title.toLowerCase() +
          " " +
          (evt.detail ?? "").toLowerCase() +
          " " +
          evt.tags.join(" ").toLowerCase() +
          " " +
          evt.entities.join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.events, visibleLayers, visibleAgents, query, dateFrom, dateTo]);

  // Time domain — when a date range is set, zoom into that range; otherwise use
  // the full project span.
  const projectRange = data.summary.dateRange;
  const domain = useMemo(() => {
    if (dateFrom || dateTo) {
      const start = dateFrom
        ? Date.parse(`${dateFrom}T00:00:00Z`)
        : projectRange
          ? toMs(projectRange.start)
          : null;
      const end = dateTo
        ? Date.parse(`${dateTo}T23:59:59Z`)
        : projectRange
          ? toMs(projectRange.end)
          : null;
      if (start === null || end === null) return null;
      const pad = Math.max((end - start) * 0.04, 86_400_000);
      return { start: start - pad, end: end + pad };
    }
    if (!projectRange) return null;
    const start = toMs(projectRange.start);
    const end = toMs(projectRange.end);
    if (end === start) {
      return { start: start - 86_400_000, end: end + 86_400_000 };
    }
    const pad = (end - start) * 0.04;
    return { start: start - pad, end: end + pad };
  }, [projectRange, dateFrom, dateTo]);

  // Layout dimensions — only render lanes that have at least one event in the
  // overall dataset, so empty lanes don't waste vertical space.
  const lanesWithData = LANE_ORDER.filter(
    (l) => (data.summary.layerCounts[l] ?? 0) > 0,
  );
  const lanesToShow = lanesWithData.filter((l) => visibleLayers.has(l));
  // Lanes flex to absorb any leftover vertical space so the canvas always
  // fills its container — no awkward gap below the lanes. Density ribbon
  // stays a constant slim strip up top.
  const fixedHeightWithoutLanes =
    PADDING_TOP + DENSITY_HEIGHT + PHASE_LABEL_HEIGHT + AXIS_HEIGHT + PADDING_BOTTOM;
  const laneCount = Math.max(lanesToShow.length, 1);
  const laneHeight = Math.max(
    LANE_HEIGHT_MIN,
    (size.height - fixedHeightWithoutLanes) / laneCount,
  );
  const laneAreaHeight = laneHeight * lanesToShow.length;
  const totalHeight = fixedHeightWithoutLanes + laneAreaHeight;

  const innerWidth = Math.max(size.width - LANE_LABEL_WIDTH - PADDING_X * 2, 100);
  const chartLeft = LANE_LABEL_WIDTH + PADDING_X;
  const chartRight = chartLeft + innerWidth;
  const xScale = makeScale(domain?.start ?? 0, domain?.end ?? 1, chartLeft, chartRight);

  // Wheel-to-zoom on the chart area (anchored at the cursor's date)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !domain || !onZoomTo || !projectRange) return;
    const boundsStart = toMs(projectRange.start);
    const boundsEnd = toMs(projectRange.end);
    const handleWheel = (e: WheelEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      // Only intercept wheel inside the chart area
      if (x < chartLeft || x > chartRight) return;
      e.preventDefault();
      const cursorMs = domain.start + ((x - chartLeft) / (chartRight - chartLeft)) * (domain.end - domain.start);
      const factor = e.deltaY > 0 ? 1.18 : 0.85;
      const next = zoomDomain(domain.start, domain.end, cursorMs, factor, boundsStart, boundsEnd);
      if (next === null) {
        onZoomTo(null, null);
      } else {
        const fromIso = new Date(next.start).toISOString().split("T")[0];
        const toIso = new Date(next.end).toISOString().split("T")[0];
        onZoomTo(fromIso, toIso);
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [domain, projectRange, chartLeft, chartRight, onZoomTo]);

  // Density data
  const density = useMemo(() => {
    if (!domain) return [];
    const bins = Math.max(60, Math.min(180, Math.floor(innerWidth / 8)));
    return buildDensity(filtered, domain.start, domain.end, bins);
  }, [filtered, domain, innerWidth]);

  const densityPathD = useMemo(
    () => densityPath(density, innerWidth, DENSITY_HEIGHT - 4, DENSITY_HEIGHT - 4),
    [density, innerWidth],
  );

  // Axis ticks
  const ticks = useMemo(() => {
    if (!domain) return [] as number[];
    return makeTicks(domain.start, domain.end);
  }, [domain]);

  // Lane plots
  const lanePlots = useMemo(() => {
    const map = new Map<TimelineLayer, PlottedEvent[]>();
    if (!domain) return map;
    const laneStartY =
      PADDING_TOP + DENSITY_HEIGHT + PHASE_LABEL_HEIGHT + AXIS_HEIGHT;
    lanesToShow.forEach((layer, idx) => {
      const laneCenter = laneStartY + idx * laneHeight + laneHeight / 2;
      const halfHeight = laneHeight / 2 - 8;
      const laneEvents = filtered.filter((e) => e.layer === layer);
      map.set(layer, plotLane(laneEvents, xScale, laneCenter, halfHeight));
    });
    return map;
  }, [filtered, lanesToShow, xScale, domain, laneHeight]);

  // Lookup helpers
  const eventById = useMemo(() => {
    const map = new Map<string, PlottedEvent>();
    for (const plotted of lanePlots.values()) {
      for (const p of plotted) map.set(p.event.id, p);
    }
    return map;
  }, [lanePlots]);

  // Cross-layer connection arcs (between events sharing an entity)
  const arcs = useMemo(() => {
    if (!showArcs) return [] as { id: string; d: string; faded: boolean }[];
    const result: { id: string; d: string; faded: boolean }[] = [];
    const byEntity = new Map<string, PlottedEvent[]>();
    for (const plotted of lanePlots.values()) {
      for (const p of plotted) {
        for (const ent of p.event.entities) {
          if (!ent) continue;
          const list = byEntity.get(ent) ?? [];
          list.push(p);
          byEntity.set(ent, list);
        }
      }
    }
    let arcId = 0;
    for (const [, group] of byEntity) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => a.cx - b.cx);
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (a.event.layer === b.event.layer) continue;
        const midX = (a.cx + b.cx) / 2;
        const dx = b.cx - a.cx;
        const lift = Math.min(80, Math.max(20, dx * 0.18));
        const controlY = Math.min(a.cy, b.cy) - lift;
        const d = `M ${a.cx},${a.cy} Q ${midX},${controlY} ${b.cx},${b.cy}`;
        const isHot =
          hoveredEventId === a.event.id ||
          hoveredEventId === b.event.id ||
          selectedEventId === a.event.id ||
          selectedEventId === b.event.id;
        result.push({ id: `arc-${arcId++}`, d, faded: !isHot });
      }
    }
    return result;
  }, [lanePlots, showArcs, hoveredEventId, selectedEventId]);

  if (!domain) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="font-serif text-2xl text-muted-foreground/60">
          The chronicle is empty
        </div>
        <p className="max-w-md text-[12px] text-muted-foreground/50">
          No GDL events with timestamps were found. Add a few <code className="font-mono text-[11px]">@memory</code> records or a{" "}
          <code className="font-mono text-[11px]"># @VERSION generated:</code> header to start the story.
        </p>
      </div>
    );
  }

  // Phase rendering
  const laneStartY = PADDING_TOP + DENSITY_HEIGHT + PHASE_LABEL_HEIGHT + AXIS_HEIGHT;
  const laneAreaTop = laneStartY;
  const laneAreaBottom = laneStartY + laneAreaHeight;

  const gridStroke = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
  const axisStroke = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
  const axisText = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const phaseTint = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)";
  const densityFill = isDark ? "rgba(126,205,166,0.18)" : "rgba(40,128,84,0.14)";
  const densityStroke = isDark ? "rgba(126,205,166,0.55)" : "rgba(40,128,84,0.55)";

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 overflow-auto">
      <svg
        width={size.width}
        height={totalHeight}
        viewBox={`0 0 ${size.width} ${totalHeight}`}
        className="block"
        role="img"
        aria-label="Project timeline canvas"
      >
        <defs>
          <linearGradient id="timeline-density" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={densityFill} stopOpacity="1" />
            <stop offset="100%" stopColor={densityFill} stopOpacity="0.05" />
          </linearGradient>
          <pattern
            id="timeline-grain"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.4" fill={isDark ? "#fff" : "#000"} fillOpacity="0.025" />
          </pattern>
        </defs>

        {/* Subtle grain overlay */}
        <rect
          x={LANE_LABEL_WIDTH}
          y={PADDING_TOP}
          width={size.width - LANE_LABEL_WIDTH - PADDING_X}
          height={totalHeight - PADDING_TOP - PADDING_BOTTOM}
          fill="url(#timeline-grain)"
        />

        {/* Phase bands */}
        {data.phases.map((phase, i) => {
          if (i % 2 === 1) return null;
          const x1 = xScale(toMs(phase.startDate));
          const x2 = xScale(toMs(phase.endDate));
          const w = Math.max(x2 - x1, 4);
          return (
            <rect
              key={phase.id + "-band"}
              x={x1}
              y={laneAreaTop}
              width={w}
              height={laneAreaHeight}
              fill={phaseTint}
            />
          );
        })}

        {/* Density ribbon (top) */}
        <g transform={`translate(${LANE_LABEL_WIDTH + PADDING_X}, ${PADDING_TOP})`}>
          <path
            d={densityPathD}
            fill="url(#timeline-density)"
            stroke={densityStroke}
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </g>
        <text
          x={LANE_LABEL_WIDTH + 12}
          y={PADDING_TOP + DENSITY_HEIGHT - 8}
          fontFamily="JetBrains Mono, monospace"
          fontSize="9"
          fill={axisText}
          letterSpacing="0.08em"
        >
          INTENSITY
        </text>

        {/* Phase labels with serif type */}
        {data.phases.map((phase) => {
          const x1 = xScale(toMs(phase.startDate));
          const x2 = xScale(toMs(phase.endDate));
          const cx = (x1 + x2) / 2;
          const w = x2 - x1;
          if (w < 60) return null;
          return (
            <PhaseLabel
              key={phase.id + "-label"}
              phase={phase}
              cx={cx}
              y={PADDING_TOP + DENSITY_HEIGHT + 6}
              maxWidth={w}
              isDark={isDark}
            />
          );
        })}

        {/* Phase divider lines (vertical) */}
        {data.phases.slice(1).map((phase) => {
          const x = xScale(toMs(phase.startDate));
          return (
            <line
              key={phase.id + "-divider"}
              x1={x}
              x2={x}
              y1={laneAreaTop - 6}
              y2={laneAreaBottom}
              stroke={axisStroke}
              strokeWidth="0.75"
              strokeDasharray="2 4"
              strokeOpacity="0.6"
            />
          );
        })}

        {/* Time axis */}
        <line
          x1={LANE_LABEL_WIDTH + PADDING_X}
          x2={LANE_LABEL_WIDTH + PADDING_X + innerWidth}
          y1={laneAreaTop - 12}
          y2={laneAreaTop - 12}
          stroke={axisStroke}
          strokeWidth="0.75"
        />
        {ticks.map((t) => {
          const x = xScale(t);
          return (
            <g key={t}>
              <line
                x1={x}
                x2={x}
                y1={laneAreaTop - 12}
                y2={laneAreaTop - 8}
                stroke={axisStroke}
                strokeWidth="0.75"
              />
              <line
                x1={x}
                x2={x}
                y1={laneAreaTop}
                y2={laneAreaBottom}
                stroke={gridStroke}
                strokeWidth="0.6"
              />
              <text
                x={x}
                y={laneAreaTop - 16}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                fill={axisText}
              >
                {formatDateShort(new Date(t).toISOString())}
              </text>
            </g>
          );
        })}

        {/* Lane backgrounds + labels */}
        {lanesToShow.map((layer, idx) => {
          const style = LANE_STYLES[layer];
          const top = laneStartY + idx * laneHeight;
          const center = top + laneHeight / 2;
          const accent = isDark ? style.accentDark : style.accent;
          const count = lanePlots.get(layer)?.length ?? 0;
          return (
            <g key={layer}>
              {/* Lane separator */}
              <line
                x1={LANE_LABEL_WIDTH}
                x2={size.width - PADDING_X}
                y1={top}
                y2={top}
                stroke={gridStroke}
                strokeWidth="0.6"
              />
              {/* Lane center rule (thin) */}
              <line
                x1={LANE_LABEL_WIDTH + PADDING_X}
                x2={LANE_LABEL_WIDTH + PADDING_X + innerWidth}
                y1={center}
                y2={center}
                stroke={gridStroke}
                strokeWidth="0.5"
              />
              {/* Layer accent strip on left */}
              <rect
                x={LANE_LABEL_WIDTH - 4}
                y={top + 8}
                width="2"
                height={laneHeight - 16}
                rx="1"
                fill={accent}
                opacity={0.55}
              />
              {/* Lane label */}
              <text
                x={LANE_LABEL_WIDTH - 12}
                y={center - 4}
                textAnchor="end"
                fontFamily="Newsreader, Georgia, serif"
                fontSize="14"
                fill={isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.72)"}
              >
                {style.label}
              </text>
              <text
                x={LANE_LABEL_WIDTH - 12}
                y={center + 10}
                textAnchor="end"
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                fill={axisText}
                letterSpacing="0.08em"
              >
                {count.toString().padStart(2, "0")} · {layer.toUpperCase()}
              </text>
            </g>
          );
        })}
        {/* Bottom border */}
        <line
          x1={LANE_LABEL_WIDTH}
          x2={size.width - PADDING_X}
          y1={laneAreaBottom}
          y2={laneAreaBottom}
          stroke={gridStroke}
          strokeWidth="0.6"
        />

        {/* Cross-layer arcs (rendered behind events) */}
        <g style={{ pointerEvents: "none" }}>
          {arcs.map((arc) => (
            <path
              key={arc.id}
              d={arc.d}
              fill="none"
              stroke={isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)"}
              strokeWidth={arc.faded ? 0.7 : 1.6}
              strokeOpacity={arc.faded ? 0.32 : 0.9}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Today marker (if today falls in range) */}
        {(() => {
          if (now === null) return null;
          if (now < domain.start || now > domain.end) return null;
          const x = xScale(now);
          return (
            <g>
              <line
                x1={x}
                x2={x}
                y1={laneAreaTop - 8}
                y2={laneAreaBottom}
                stroke={isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)"}
                strokeWidth="0.85"
                strokeDasharray="3 3"
              />
              <text
                x={x + 4}
                y={laneAreaTop - 14}
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                fill={isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)"}
              >
                NOW
              </text>
            </g>
          );
        })()}

        {/* Event nodes */}
        {lanesToShow.map((layer) => {
          const style = LANE_STYLES[layer];
          const accent = isDark ? style.accentDark : style.accent;
          const plotted = lanePlots.get(layer) ?? [];
          return (
            <g key={"events-" + layer}>
              {plotted.map((p) => {
                const isSelected = p.event.id === selectedEventId;
                const isHovered = p.event.id === hoveredEventId;
                const baseOpacity = isSelected || isHovered ? 1 : 0.92;
                return (
                  <EventNode
                    key={p.event.id}
                    plotted={p}
                    accent={accent}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    isDark={isDark}
                    baseOpacity={baseOpacity}
                    onSelect={() => onSelectEvent(p.event.id === selectedEventId ? null : p.event.id)}
                    onHover={(id) => onHoverEvent(id)}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Hover tooltip (rendered last so it's on top) */}
        {(() => {
          const id = hoveredEventId ?? selectedEventId;
          if (!id) return null;
          const p = eventById.get(id);
          if (!p) return null;
          return (
            <HoverChip
              plotted={p}
              isDark={isDark}
              maxX={size.width - PADDING_X}
            />
          );
        })()}
      </svg>
    </div>
  );
}

interface EventNodeProps {
  plotted: PlottedEvent;
  accent: string;
  isSelected: boolean;
  isHovered: boolean;
  isDark: boolean;
  baseOpacity: number;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}

function EventNode({
  plotted,
  accent,
  isSelected,
  isHovered,
  isDark,
  baseOpacity,
  onSelect,
  onHover,
}: EventNodeProps) {
  const { cx, cy, r, event } = plotted;
  const ringR = r + (isSelected ? 6 : isHovered ? 4 : 0);
  const fillColor = isDark ? "#0c1310" : "#ffffff";
  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      onMouseEnter={() => onHover(event.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onSelect}
      style={{ cursor: "pointer" }}
    >
      {(isSelected || isHovered) && (
        <circle
          r={ringR}
          fill="none"
          stroke={accent}
          strokeWidth={isSelected ? 1.4 : 1}
          strokeOpacity={0.4}
        />
      )}
      <circle r={r} fill={accent} fillOpacity={baseOpacity} />
      <circle
        r={Math.max(r - 1.6, 1)}
        fill={fillColor}
        fillOpacity={isSelected ? 0 : 0.75}
      />
      {/* Outer hit area */}
      <circle r={Math.max(r + 6, 10)} fill="transparent" />
    </g>
  );
}

function HoverChip({
  plotted,
  isDark,
  maxX,
}: {
  plotted: PlottedEvent;
  isDark: boolean;
  maxX: number;
}) {
  const { cx, cy, event } = plotted;
  const padding = 10;
  const title = event.title.length > 60 ? event.title.slice(0, 58) + "…" : event.title;
  const subtitle = formatDateLong(event.date);
  // Estimate width: 7px per char (ish)
  const titleW = title.length * 6.4 + padding * 2;
  const subW = subtitle.length * 5.4 + padding * 2;
  const chipW = Math.max(titleW, subW, 140);
  const chipH = 38;
  let x = cx + 14;
  if (x + chipW > maxX) x = cx - chipW - 14;
  const y = cy - chipH / 2;
  const bg = isDark ? "rgba(20,28,24,0.96)" : "rgba(255,255,253,0.96)";
  const border = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x}
        y={y}
        width={chipW}
        height={chipH}
        rx={6}
        fill={bg}
        stroke={border}
        strokeWidth="0.75"
      />
      <text
        x={x + padding}
        y={y + 16}
        fontFamily="DM Sans, sans-serif"
        fontSize="11.5"
        fontWeight="500"
        fill={isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.92)"}
      >
        {title}
      </text>
      <text
        x={x + padding}
        y={y + 30}
        fontFamily="JetBrains Mono, monospace"
        fontSize="9"
        fill={isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)"}
        letterSpacing="0.04em"
      >
        {subtitle.toUpperCase()}
      </text>
    </g>
  );
}

function PhaseLabel({
  phase,
  cx,
  y,
  maxWidth,
  isDark,
}: {
  phase: TimelinePhase;
  cx: number;
  y: number;
  maxWidth: number;
  isDark: boolean;
}) {
  // Truncate label to fit
  const charBudget = Math.max(8, Math.floor(maxWidth / 7.2));
  const label = phase.label.length > charBudget ? phase.label.slice(0, charBudget - 1) + "…" : phase.label;
  return (
    <g>
      <text
        x={cx}
        y={y + 14}
        textAnchor="middle"
        fontFamily="Newsreader, Georgia, serif"
        fontSize="13"
        fontWeight="500"
        fill={isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.72)"}
      >
        {label}
      </text>
    </g>
  );
}

