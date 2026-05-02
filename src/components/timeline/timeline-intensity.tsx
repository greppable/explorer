"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type {
  TimelinePayload,
  TimelinePhase,
  TimelineLayer,
} from "@/lib/timeline/types";
import { LANE_ORDER, LANE_STYLES } from "./constants";
import {
  formatDateLong,
  formatDateShort,
  makeScale,
  makeTicks,
  toMs,
  zoomDomain,
} from "./timeline-utils";
import { useNow } from "./use-now";

interface TimelineIntensityProps {
  data: TimelinePayload;
  visibleLayers: Set<TimelineLayer>;
  visibleAgents: Set<string>;
  query: string;
  dateFrom: string | null;
  dateTo: string | null;
  onZoomTo?: (from: string | null, to: string | null) => void;
}

const PADDING_X = 48;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 56;
const PHASE_LABEL_HEIGHT = 28;
const AXIS_HEIGHT = 28;
const LEGEND_HEIGHT = 32;
const MIN_CHART_HEIGHT = 480;

/**
 * Bucket events into N daily-aligned bins keyed by layer.
 * Returns counts[bin][layer] = count.
 */
function buildLayerDensity(
  events: TimelinePayload["events"],
  layers: TimelineLayer[],
  startMs: number,
  endMs: number,
  bins: number,
): { perBin: Map<TimelineLayer, number>[]; binMs: number[] } {
  const perBin: Map<TimelineLayer, number>[] = Array.from(
    { length: bins },
    () => new Map<TimelineLayer, number>(),
  );
  const binMs: number[] = Array.from(
    { length: bins },
    (_, i) => startMs + ((i + 0.5) / bins) * (endMs - startMs),
  );
  if (events.length === 0 || endMs <= startMs) return { perBin, binMs };
  const span = endMs - startMs;
  const layerSet = new Set(layers);
  for (const evt of events) {
    if (!layerSet.has(evt.layer)) continue;
    const t = toMs(evt.date);
    if (t < startMs || t > endMs) continue;
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(((t - startMs) / span) * bins)));
    const m = perBin[bin];
    m.set(evt.layer, (m.get(evt.layer) ?? 0) + 1);
  }
  return { perBin, binMs };
}

/**
 * Build a smooth stacked-area path for a single layer in the stack.
 * top[i] / bottom[i] give the layer's upper and lower y-coordinates at bin i.
 */
function stackedAreaPath(
  bottom: number[],
  top: number[],
  xPositions: number[],
): string {
  if (xPositions.length === 0) return "";
  let d = `M ${xPositions[0]},${bottom[0]} L ${xPositions[0]},${top[0]}`;
  for (let i = 1; i < xPositions.length; i++) {
    const cx = (xPositions[i - 1] + xPositions[i]) / 2;
    d += ` C ${cx},${top[i - 1]} ${cx},${top[i]} ${xPositions[i]},${top[i]}`;
  }
  // Bottom traversed in reverse
  for (let i = xPositions.length - 1; i > 0; i--) {
    const cx = (xPositions[i - 1] + xPositions[i]) / 2;
    d += ` C ${cx},${bottom[i]} ${cx},${bottom[i - 1]} ${xPositions[i - 1]},${bottom[i - 1]}`;
  }
  d += " Z";
  return d;
}

export function TimelineIntensity({
  data,
  visibleLayers,
  visibleAgents,
  query,
  dateFrom,
  dateTo,
  onZoomTo,
}: TimelineIntensityProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const now = useNow();

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 600 });
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.max(width, 480), height: Math.max(height, MIN_CHART_HEIGHT) });
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
          evt.tags.join(" ").toLowerCase();
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

  const stackOrder: TimelineLayer[] = LANE_ORDER.filter((l) =>
    visibleLayers.has(l) && (data.summary.layerCounts[l] ?? 0) > 0,
  );

  const innerWidth = Math.max(size.width - PADDING_X * 2, 100);
  const chartHeight =
    size.height - PADDING_TOP - PADDING_BOTTOM - PHASE_LABEL_HEIGHT - AXIS_HEIGHT - LEGEND_HEIGHT;
  const chartTop = PADDING_TOP + LEGEND_HEIGHT + PHASE_LABEL_HEIGHT;
  const chartBottom = chartTop + chartHeight;
  const chartLeft = PADDING_X;
  const chartRight = PADDING_X + innerWidth;

  // Wheel-to-zoom on the chart area (anchored at the cursor's date)
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

  const xScale = makeScale(
    domain?.start ?? 0,
    domain?.end ?? 1,
    PADDING_X,
    PADDING_X + innerWidth,
  );

  const bins = Math.max(60, Math.min(220, Math.floor(innerWidth / 8)));
  const { perBin, binMs } = useMemo(() => {
    if (!domain) return { perBin: [] as Map<TimelineLayer, number>[], binMs: [] as number[] };
    return buildLayerDensity(filtered, stackOrder, domain.start, domain.end, bins);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, stackOrder.join(","), domain, bins]);

  // Build cumulative stack heights per bin, and find the max stack
  const stackedHeights: Map<TimelineLayer, { lower: number; upper: number }[]> = useMemo(() => {
    const m = new Map<TimelineLayer, { lower: number; upper: number }[]>();
    for (const layer of stackOrder) m.set(layer, []);
    let maxStack = 0;
    for (let i = 0; i < perBin.length; i++) {
      let cum = 0;
      for (const layer of stackOrder) {
        const c = perBin[i].get(layer) ?? 0;
        const lower = cum;
        const upper = cum + c;
        m.get(layer)!.push({ lower, upper });
        cum = upper;
      }
      if (cum > maxStack) maxStack = cum;
    }
    // Convert counts to y coordinates
    const peak = Math.max(maxStack, 1);
    const yFor = (v: number) => chartBottom - (v / peak) * (chartHeight - 8);
    for (const [, arr] of m) {
      for (const e of arr) {
        e.lower = yFor(e.lower);
        e.upper = yFor(e.upper);
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perBin, stackOrder.join(","), chartHeight, chartBottom]);

  const xPositions = binMs.map((t) => xScale(t));

  // Find peak intensity bin for annotation
  const peakBin = useMemo(() => {
    let bestIdx = 0;
    let bestCount = 0;
    for (let i = 0; i < perBin.length; i++) {
      let total = 0;
      for (const c of perBin[i].values()) total += c;
      if (total > bestCount) {
        bestCount = total;
        bestIdx = i;
      }
    }
    return { idx: bestIdx, count: bestCount };
  }, [perBin]);

  // Hover bin
  const hoverBin = useMemo(() => {
    if (hoverX === null || xPositions.length === 0) return null;
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < xPositions.length; i++) {
      const d = Math.abs(xPositions[i] - hoverX);
      if (d < bestDist) {
        bestDist = d;
        bestI = i;
      }
    }
    return bestI;
  }, [hoverX, xPositions]);

  if (!domain) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="font-serif text-2xl text-muted-foreground/60">
            No intensity to chart
          </div>
        </div>
      </div>
    );
  }

  const ticks = makeTicks(domain.start, domain.end);
  const gridStroke = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const axisStroke = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
  const axisText = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const phaseTint = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)";

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="block cursor-crosshair"
        role="img"
        aria-label="Intensity focus chart"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          setHoverX(e.clientX - rect.left);
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          <pattern
            id="intensity-grain"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.4" fill={isDark ? "#fff" : "#000"} fillOpacity="0.025" />
          </pattern>
        </defs>

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
              y={chartTop}
              width={w}
              height={chartHeight}
              fill={phaseTint}
            />
          );
        })}

        {/* Subtle grain */}
        <rect
          x={PADDING_X}
          y={chartTop}
          width={innerWidth}
          height={chartHeight}
          fill="url(#intensity-grain)"
        />

        {/* Phase labels at top */}
        {data.phases.map((phase) => (
          <PhaseLabel
            key={phase.id + "-label"}
            phase={phase}
            xScale={xScale}
            y={PADDING_TOP + LEGEND_HEIGHT + 4}
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
              y1={chartTop - 6}
              y2={chartBottom}
              stroke={axisStroke}
              strokeWidth="0.75"
              strokeDasharray="2 4"
              strokeOpacity="0.5"
            />
          );
        })}

        {/* Y-axis hint label */}
        <text
          x={PADDING_X - 8}
          y={chartTop + 8}
          textAnchor="end"
          fontFamily="JetBrains Mono, monospace"
          fontSize="9"
          fill={axisText}
          letterSpacing="0.08em"
        >
          PEAK
        </text>
        <text
          x={PADDING_X - 8}
          y={chartBottom - 2}
          textAnchor="end"
          fontFamily="JetBrains Mono, monospace"
          fontSize="9"
          fill={axisText}
          letterSpacing="0.08em"
        >
          0
        </text>

        {/* Stacked area streams */}
        <g>
          {stackOrder.map((layer) => {
            const arr = stackedHeights.get(layer) ?? [];
            if (arr.length === 0) return null;
            const upper = arr.map((p) => p.upper);
            const lower = arr.map((p) => p.lower);
            const d = stackedAreaPath(lower, upper, xPositions);
            const accent = isDark
              ? LANE_STYLES[layer].accentDark
              : LANE_STYLES[layer].accent;
            return (
              <path
                key={"stream-" + layer}
                d={d}
                fill={accent}
                fillOpacity={0.55}
                stroke={accent}
                strokeWidth="0.6"
                strokeOpacity="0.9"
              />
            );
          })}
        </g>

        {/* Time axis at bottom */}
        <line
          x1={PADDING_X}
          x2={PADDING_X + innerWidth}
          y1={chartBottom}
          y2={chartBottom}
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
                y1={chartBottom}
                y2={chartBottom + 4}
                stroke={axisStroke}
                strokeWidth="0.75"
              />
              <line
                x1={x}
                x2={x}
                y1={chartTop}
                y2={chartBottom}
                stroke={gridStroke}
                strokeWidth="0.5"
              />
              <text
                x={x}
                y={chartBottom + 16}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize="10"
                fill={axisText}
              >
                {formatDateShort(new Date(t).toISOString())}
              </text>
            </g>
          );
        })}

        {/* "Now" marker */}
        {now !== null && now >= domain.start && now <= domain.end && (
          <g>
            <line
              x1={xScale(now)}
              x2={xScale(now)}
              y1={chartTop}
              y2={chartBottom}
              stroke={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              strokeWidth="0.85"
              strokeDasharray="3 3"
            />
            <text
              x={xScale(now) + 4}
              y={chartTop + 12}
              fontFamily="JetBrains Mono, monospace"
              fontSize="9"
              fill={isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)"}
            >
              NOW
            </text>
          </g>
        )}

        {/* Peak annotation */}
        {peakBin.count > 0 && (
          <g>
            <line
              x1={xPositions[peakBin.idx]}
              x2={xPositions[peakBin.idx]}
              y1={chartTop - 4}
              y2={chartBottom}
              stroke={isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)"}
              strokeWidth="0.8"
              strokeDasharray="1 3"
            />
            <text
              x={xPositions[peakBin.idx] + 6}
              y={chartTop + 6}
              fontFamily="Newsreader, Georgia, serif"
              fontSize="11"
              fill={isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.72)"}
            >
              peak — {formatDateShort(new Date(binMs[peakBin.idx]).toISOString())} · {peakBin.count} {peakBin.count === 1 ? "moment" : "moments"}
            </text>
          </g>
        )}

        {/* Hover indicator + tooltip */}
        {hoverBin !== null && (() => {
          const x = xPositions[hoverBin];
          const counts = perBin[hoverBin];
          const total = [...counts.values()].reduce((a, b) => a + b, 0);
          if (total === 0) return null;
          const dateLabel = formatDateLong(new Date(binMs[hoverBin]).toISOString());
          // Tooltip
          const lines: { layer: TimelineLayer; count: number }[] = [];
          for (const layer of stackOrder) {
            const c = counts.get(layer) ?? 0;
            if (c > 0) lines.push({ layer, count: c });
          }
          const tooltipW = 200;
          const tooltipH = 24 + lines.length * 14;
          let tx = x + 12;
          if (tx + tooltipW > size.width - PADDING_X) tx = x - tooltipW - 12;
          const ty = chartTop + 8;
          const bg = isDark ? "rgba(20,28,24,0.96)" : "rgba(255,255,253,0.96)";
          const border = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";
          return (
            <g style={{ pointerEvents: "none" }}>
              <line
                x1={x}
                x2={x}
                y1={chartTop}
                y2={chartBottom}
                stroke={isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)"}
                strokeWidth="0.85"
              />
              <rect
                x={tx}
                y={ty}
                width={tooltipW}
                height={tooltipH}
                rx={6}
                fill={bg}
                stroke={border}
                strokeWidth="0.75"
              />
              <text
                x={tx + 10}
                y={ty + 14}
                fontFamily="DM Sans, sans-serif"
                fontSize="11"
                fontWeight="500"
                fill={isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.9)"}
              >
                {dateLabel} · {total} {total === 1 ? "moment" : "moments"}
              </text>
              {lines.map((l, i) => {
                const accent = isDark
                  ? LANE_STYLES[l.layer].accentDark
                  : LANE_STYLES[l.layer].accent;
                return (
                  <g key={l.layer}>
                    <circle cx={tx + 14} cy={ty + 24 + i * 14 + 4} r={3} fill={accent} />
                    <text
                      x={tx + 22}
                      y={ty + 24 + i * 14 + 8}
                      fontFamily="DM Sans, sans-serif"
                      fontSize="11"
                      fill={isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.78)"}
                    >
                      {LANE_STYLES[l.layer].label}
                    </text>
                    <text
                      x={tx + tooltipW - 10}
                      y={ty + 24 + i * 14 + 8}
                      textAnchor="end"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="10.5"
                      fill={isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)"}
                    >
                      {l.count}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Legend at top */}
        <g transform={`translate(${PADDING_X}, ${PADDING_TOP + 10})`}>
          {stackOrder.map((layer, idx) => {
            const accent = isDark
              ? LANE_STYLES[layer].accentDark
              : LANE_STYLES[layer].accent;
            const x = idx * 110;
            return (
              <g key={layer} transform={`translate(${x}, 0)`}>
                <rect width={14} height={10} y={-2} rx={2} fill={accent} fillOpacity={0.55} />
                <text
                  x={20}
                  y={8}
                  fontFamily="DM Sans, sans-serif"
                  fontSize="11"
                  fill={isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.72)"}
                >
                  {LANE_STYLES[layer].label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function PhaseLabel({
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
