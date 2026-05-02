"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type {
  TimelinePayload,
  TimelinePhase,
  TimelineLayer,
  TimelineEvent,
} from "@/lib/timeline/types";
import { LANE_STYLES } from "./constants";
import {
  formatDateLong,
  formatDateShort,
  makeScale,
  makeTicks,
  toMs,
  zoomDomain,
} from "./timeline-utils";
import { useNow } from "./use-now";

interface TimelineWeaveProps {
  data: TimelinePayload;
  visibleLayers: Set<TimelineLayer>;
  visibleAgents: Set<string>;
  query: string;
  dateFrom: string | null;
  dateTo: string | null;
  selectedEventId: string | null;
  hoveredEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onHoverEvent: (id: string | null) => void;
  onZoomTo?: (from: string | null, to: string | null) => void;
}

const PADDING_X = 40;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 32;
const PHASE_LABEL_HEIGHT = 28;
const AXIS_HEIGHT = 28;
const RIVER_HEIGHT_MIN = 460; // tall single lane (grows to fill container)
const LEGEND_HEIGHT = 36;

interface PlottedNode {
  event: TimelineEvent;
  cx: number;
  cy: number;
  r: number;
  color: string;
}

/**
 * Pack nodes vertically (beeswarm) within a horizontal river so they don't
 * overlap. Uses a relaxed first-fit approach: try the centerline, then nudge
 * symmetrically up/down until clear or out of bounds.
 */
function packRiver(
  events: TimelineEvent[],
  xScale: (ms: number) => number,
  centerY: number,
  halfHeight: number,
  baseRadius: number,
  layerColor: (l: TimelineLayer) => string,
): PlottedNode[] {
  const placed: PlottedNode[] = [];
  const sorted = [...events].sort((a, b) => toMs(a.date) - toMs(b.date));
  for (const evt of sorted) {
    const cx = xScale(toMs(evt.date));
    const r = baseRadius + evt.significance * 4.5;
    const offsetStep = r * 1.35;
    let cy = centerY;
    let attempt = 0;
    while (
      placed.some(
        (p) =>
          Math.abs(p.cx - cx) < (p.r + r) * 1.05 &&
          Math.abs(p.cy - cy) < (p.r + r) * 1.05,
      ) &&
      attempt < 32
    ) {
      attempt += 1;
      const sign = attempt % 2 === 0 ? -1 : 1;
      const magnitude = Math.ceil(attempt / 2) * offsetStep;
      cy = centerY + sign * magnitude;
      if (Math.abs(cy - centerY) > halfHeight) {
        // Wrap back toward center with a smaller offset
        cy = centerY + sign * (magnitude % halfHeight);
      }
    }
    placed.push({ event: evt, cx, cy, r, color: layerColor(evt.layer) });
  }
  return placed;
}

export function TimelineWeave({
  data,
  visibleLayers,
  visibleAgents,
  query,
  dateFrom,
  dateTo,
  selectedEventId,
  hoveredEventId,
  onSelectEvent,
  onHoverEvent,
  onZoomTo,
}: TimelineWeaveProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const now = useNow();

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 600 });

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromMs = dateFrom ? Date.parse(`${dateFrom}T00:00:00Z`) : null;
    const toMsCutoff = dateTo ? Date.parse(`${dateTo}T23:59:59Z`) : null;
    return data.events.filter((evt) => {
      if (!visibleLayers.has(evt.layer)) return false;
      if (evt.agent && !visibleAgents.has(evt.agent)) return false;
      const t = toMs(evt.date);
      if (fromMs !== null && t < fromMs) return false;
      if (toMsCutoff !== null && t > toMsCutoff) return false;
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
    if (end === start) return { start: start - 86_400_000, end: end + 86_400_000 };
    const pad = (end - start) * 0.04;
    return { start: start - pad, end: end + pad };
  }, [projectRange, dateFrom, dateTo]);

  const innerWidth = Math.max(size.width - PADDING_X * 2, 100);
  const chartLeft = PADDING_X;
  const chartRight = PADDING_X + innerWidth;
  const xScale = makeScale(domain?.start ?? 0, domain?.end ?? 1, chartLeft, chartRight);

  // Wheel-to-zoom on the chart area
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !domain || !onZoomTo || !projectRange) return;
    const boundsStart = toMs(projectRange.start);
    const boundsEnd = toMs(projectRange.end);
    const handleWheel = (e: WheelEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
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

  // River grows to fill container so the canvas never leaves a gap below
  const fixedHeightWithoutRiver =
    PADDING_TOP + PHASE_LABEL_HEIGHT + AXIS_HEIGHT + LEGEND_HEIGHT + PADDING_BOTTOM;
  const riverHeight = Math.max(
    RIVER_HEIGHT_MIN,
    size.height - fixedHeightWithoutRiver,
  );
  const totalHeight = fixedHeightWithoutRiver + riverHeight;

  const riverTop = PADDING_TOP + PHASE_LABEL_HEIGHT + AXIS_HEIGHT;
  const riverCenter = riverTop + riverHeight / 2;
  const riverHalf = riverHeight / 2 - 24;

  const layerColor = (layer: TimelineLayer): string => {
    const style = LANE_STYLES[layer];
    return isDark ? style.accentDark : style.accent;
  };

  // Pack all events into a single river. layerColor is a stable derivation of
  // isDark; xScale rebuilds whenever domain or innerWidth changes; both are
  // listed for completeness so a vertical resize (which moves riverCenter and
  // riverHalf) actually re-packs the dots instead of leaving stale positions.
  const placed = useMemo(() => {
    if (!domain) return [];
    return packRiver(filtered, xScale, riverCenter, riverHalf, 4.5, layerColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layerColor reads from isDark
  }, [filtered, domain, xScale, riverCenter, riverHalf, isDark]);

  const eventById = useMemo(() => {
    const m = new Map<string, PlottedNode>();
    for (const p of placed) m.set(p.event.id, p);
    return m;
  }, [placed]);

  // Connection threads between events that share an entity
  type Thread = {
    id: string;
    a: PlottedNode;
    b: PlottedNode;
    intensity: number; // emphasized when an endpoint is hovered/selected
  };

  const threads: Thread[] = useMemo(() => {
    const result: Thread[] = [];
    const byEntity = new Map<string, PlottedNode[]>();
    for (const p of placed) {
      for (const ent of p.event.entities) {
        if (!ent) continue;
        const list = byEntity.get(ent) ?? [];
        list.push(p);
        byEntity.set(ent, list);
      }
    }
    let id = 0;
    for (const [, group] of byEntity) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => a.cx - b.cx);
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const isHot =
          hoveredEventId === a.event.id ||
          hoveredEventId === b.event.id ||
          selectedEventId === a.event.id ||
          selectedEventId === b.event.id;
        result.push({ id: `t-${id++}`, a, b, intensity: isHot ? 1 : 0.18 });
      }
    }
    return result;
  }, [placed, hoveredEventId, selectedEventId]);

  // Highlighted set (hover/select expands to all connected nodes)
  const highlighted: Set<string> = useMemo(() => {
    const id = hoveredEventId ?? selectedEventId;
    if (!id) return new Set();
    const seed = eventById.get(id);
    if (!seed) return new Set();
    const set = new Set<string>([id]);
    const myEntities = new Set(seed.event.entities);
    for (const p of placed) {
      if (p.event.id === id) continue;
      if (p.event.entities.some((e) => myEntities.has(e))) set.add(p.event.id);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredEventId, selectedEventId, placed]);

  if (!domain) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="font-serif text-2xl text-muted-foreground/60">
            Nothing to weave yet
          </div>
        </div>
      </div>
    );
  }

  const ticks = makeTicks(domain.start, domain.end);
  const gridStroke = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
  const axisStroke = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
  const axisText = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const phaseTint = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)";

  const riverBottom = riverTop + riverHeight;
  const legendY = riverBottom + 14;

  // Layers represented in current view (for legend)
  const presentLayers: TimelineLayer[] = [];
  for (const p of placed) {
    if (!presentLayers.includes(p.event.layer)) presentLayers.push(p.event.layer);
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 overflow-auto">
      <svg
        width={size.width}
        height={totalHeight}
        viewBox={`0 0 ${size.width} ${totalHeight}`}
        className="block"
        role="img"
        aria-label="Project weave canvas"
      >
        <defs>
          <pattern
            id="weave-grain"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.4" fill={isDark ? "#fff" : "#000"} fillOpacity="0.025" />
          </pattern>
          <radialGradient id="weave-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={isDark ? "#fff" : "#000"} stopOpacity="0.08" />
            <stop offset="100%" stopColor={isDark ? "#fff" : "#000"} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Phase tint bands */}
        {data.phases.map((phase, i) => {
          if (i % 2 === 1) return null;
          const x1 = xScale(toMs(phase.startDate));
          const x2 = xScale(toMs(phase.endDate));
          const w = Math.max(x2 - x1, 4);
          return (
            <rect
              key={phase.id + "-band"}
              x={x1}
              y={riverTop}
              width={w}
              height={riverHeight}
              fill={phaseTint}
            />
          );
        })}

        {/* Subtle grain overlay */}
        <rect
          x={PADDING_X}
          y={riverTop}
          width={innerWidth}
          height={riverHeight}
          fill="url(#weave-grain)"
        />

        {/* Phase labels */}
        {data.phases.map((phase) => (
          <PhaseLabelTop
            key={phase.id + "-label"}
            phase={phase}
            xScale={xScale}
            y={PADDING_TOP + 6}
            isDark={isDark}
          />
        ))}

        {/* Phase divider lines */}
        {data.phases.slice(1).map((phase) => {
          const x = xScale(toMs(phase.startDate));
          return (
            <line
              key={phase.id + "-divider"}
              x1={x}
              x2={x}
              y1={riverTop - 8}
              y2={riverBottom}
              stroke={axisStroke}
              strokeWidth="0.75"
              strokeDasharray="2 4"
              strokeOpacity="0.6"
            />
          );
        })}

        {/* Axis */}
        <line
          x1={PADDING_X}
          x2={PADDING_X + innerWidth}
          y1={riverTop - 12}
          y2={riverTop - 12}
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
                y1={riverTop - 12}
                y2={riverTop - 8}
                stroke={axisStroke}
                strokeWidth="0.75"
              />
              <line
                x1={x}
                x2={x}
                y1={riverTop}
                y2={riverBottom}
                stroke={gridStroke}
                strokeWidth="0.5"
              />
              <text
                x={x}
                y={riverTop - 16}
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

        {/* Centerline (the "river") */}
        <line
          x1={PADDING_X}
          x2={PADDING_X + innerWidth}
          y1={riverCenter}
          y2={riverCenter}
          stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
          strokeWidth="1"
        />

        {/* Connection threads (rendered behind nodes) */}
        <g style={{ pointerEvents: "none" }}>
          {threads.map((t) => {
            const isHot = t.intensity >= 1;
            const dx = t.b.cx - t.a.cx;
            const lift = Math.min(120, Math.max(20, dx * 0.18));
            // Curve direction: alternate above/below so the weave looks woven
            const direction = (t.a.cy + t.b.cy) / 2 < riverCenter ? -1 : 1;
            const controlY = (t.a.cy + t.b.cy) / 2 + direction * lift;
            const midX = (t.a.cx + t.b.cx) / 2;
            const d = `M ${t.a.cx},${t.a.cy} Q ${midX},${controlY} ${t.b.cx},${t.b.cy}`;
            // Color the thread by the more "intense" of the two endpoints' layers
            const sigA = t.a.event.significance;
            const sigB = t.b.event.significance;
            const dom = sigA >= sigB ? t.a : t.b;
            const stroke = isHot
              ? dom.color
              : isDark
                ? "rgba(255,255,255,0.55)"
                : "rgba(0,0,0,0.45)";
            return (
              <path
                key={t.id}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={isHot ? 1.6 : 0.8}
                strokeOpacity={isHot ? 0.9 : 0.28}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* "Now" marker */}
        {now !== null && now >= domain.start && now <= domain.end && (
          <g>
            <line
              x1={xScale(now)}
              x2={xScale(now)}
              y1={riverTop - 8}
              y2={riverBottom}
              stroke={isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)"}
              strokeWidth="0.85"
              strokeDasharray="3 3"
            />
            <text
              x={xScale(now) + 4}
              y={riverTop - 14}
              fontFamily="JetBrains Mono, monospace"
              fontSize="9"
              fill={isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)"}
            >
              NOW
            </text>
          </g>
        )}

        {/* Nodes */}
        <g>
          {placed.map((p) => {
            const isSelected = p.event.id === selectedEventId;
            const isHovered = p.event.id === hoveredEventId;
            const isLit = highlighted.has(p.event.id);
            const dimmed = highlighted.size > 0 && !isLit;
            const r = p.r + (isSelected ? 3 : isHovered ? 2 : 0);
            const fillCenter = isDark ? "#0c1310" : "#ffffff";
            return (
              <g
                key={p.event.id}
                transform={`translate(${p.cx}, ${p.cy})`}
                onMouseEnter={() => onHoverEvent(p.event.id)}
                onMouseLeave={() => onHoverEvent(null)}
                onClick={() =>
                  onSelectEvent(p.event.id === selectedEventId ? null : p.event.id)
                }
                style={{ cursor: "pointer", opacity: dimmed ? 0.25 : 1 }}
              >
                {(isSelected || isHovered) && (
                  <circle
                    r={r + 5}
                    fill="url(#weave-glow)"
                  />
                )}
                <circle r={r} fill={p.color} fillOpacity={0.95} />
                <circle r={Math.max(r - 1.6, 1)} fill={fillCenter} fillOpacity={isSelected ? 0 : 0.7} />
                <circle r={Math.max(r + 6, 10)} fill="transparent" />
              </g>
            );
          })}
        </g>

        {/* Legend (below river) */}
        <g transform={`translate(${PADDING_X}, ${legendY})`}>
          <text
            x={0}
            y={6}
            fontFamily="JetBrains Mono, monospace"
            fontSize="9"
            fill={axisText}
            letterSpacing="0.08em"
          >
            LAYERS
          </text>
          {presentLayers.map((layer, idx) => {
            const style = LANE_STYLES[layer];
            const accent = isDark ? style.accentDark : style.accent;
            const x = 70 + idx * 96;
            return (
              <g key={layer} transform={`translate(${x}, 0)`}>
                <circle cx={4} cy={2} r={4} fill={accent} fillOpacity="0.95" />
                <text
                  x={14}
                  y={6}
                  fontFamily="DM Sans, sans-serif"
                  fontSize="11"
                  fill={isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.72)"}
                >
                  {style.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Hover chip */}
        {(() => {
          const id = hoveredEventId ?? selectedEventId;
          if (!id) return null;
          const p = eventById.get(id);
          if (!p) return null;
          return <HoverChip plotted={p} isDark={isDark} maxX={size.width - PADDING_X} />;
        })()}
      </svg>
    </div>
  );
}

function HoverChip({
  plotted,
  isDark,
  maxX,
}: {
  plotted: PlottedNode;
  isDark: boolean;
  maxX: number;
}) {
  const { cx, cy, event } = plotted;
  const padding = 10;
  const title = event.title.length > 60 ? event.title.slice(0, 58) + "…" : event.title;
  const subtitle = formatDateLong(event.date);
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

function PhaseLabelTop({
  phase,
  xScale,
  y,
  isDark,
}: {
  phase: TimelinePhase;
  xScale: (ms: number) => number;
  y: number;
  isDark: boolean;
}) {
  const x1 = xScale(toMs(phase.startDate));
  const x2 = xScale(toMs(phase.endDate));
  const cx = (x1 + x2) / 2;
  const w = x2 - x1;
  if (w < 60) return null;
  const charBudget = Math.max(8, Math.floor(w / 7.2));
  const label = phase.label.length > charBudget ? phase.label.slice(0, charBudget - 1) + "…" : phase.label;
  return (
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
  );
}
