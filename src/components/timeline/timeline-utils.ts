import type { TimelineEvent } from "@/lib/timeline/types";

/** Linear scale: domain → range */
export function makeScale(
  domainStart: number,
  domainEnd: number,
  rangeStart: number,
  rangeEnd: number,
) {
  const domainSpan = domainEnd - domainStart || 1;
  const rangeSpan = rangeEnd - rangeStart;
  return (value: number) => rangeStart + ((value - domainStart) / domainSpan) * rangeSpan;
}

/** Inverse of makeScale: range → domain (used for cursor → date conversion) */
export function invertScale(
  domainStart: number,
  domainEnd: number,
  rangeStart: number,
  rangeEnd: number,
) {
  const domainSpan = domainEnd - domainStart || 1;
  const rangeSpan = rangeEnd - rangeStart || 1;
  return (x: number) => domainStart + ((x - rangeStart) / rangeSpan) * domainSpan;
}

/**
 * Apply a wheel-zoom transform: zoom factor `factor` (>1 = zoom out, <1 = zoom in)
 * anchored at `anchorMs` (date kept stationary). Clamps to [boundsStart, boundsEnd]
 * and enforces a minimum span of one day. If the result fully covers the project
 * bounds, returns null to signal "clear the filter entirely".
 */
const ONE_DAY_MS = 86_400_000;
export function zoomDomain(
  currentStart: number,
  currentEnd: number,
  anchorMs: number,
  factor: number,
  boundsStart: number,
  boundsEnd: number,
): { start: number; end: number } | null {
  let newStart = anchorMs - (anchorMs - currentStart) * factor;
  let newEnd = anchorMs + (currentEnd - anchorMs) * factor;
  newStart = Math.max(newStart, boundsStart);
  newEnd = Math.min(newEnd, boundsEnd);
  // Min span of one day
  if (newEnd - newStart < ONE_DAY_MS) {
    const center = (newStart + newEnd) / 2;
    newStart = Math.max(boundsStart, center - ONE_DAY_MS / 2);
    newEnd = Math.min(boundsEnd, newStart + ONE_DAY_MS);
  }
  // If we've zoomed all the way out, signal to clear the filter
  if (newStart <= boundsStart + 1 && newEnd >= boundsEnd - 1) return null;
  return { start: newStart, end: newEnd };
}

export function toMs(iso: string): number {
  return new Date(iso).getTime();
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDateLong(iso)} · ${hours}:${minutes} UTC`;
}

export function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth && start.getUTCDate() === end.getUTCDate()) {
    return formatDateLong(startIso);
  }
  if (sameMonth) {
    return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCDate()} – ${MONTH_NAMES[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  return `${formatDateLong(startIso)} → ${formatDateLong(endIso)}`;
}

/**
 * Generate a sensible set of axis tick positions for the given time domain.
 * Picks a unit (day/week/month/quarter/year) based on the span.
 */
export function makeTicks(startMs: number, endMs: number, targetCount = 8): number[] {
  const span = endMs - startMs;
  if (span <= 0) return [startMs];
  const day = 24 * 60 * 60 * 1000;
  const candidates = [
    day,
    2 * day,
    7 * day,
    14 * day,
    30 * day,
    60 * day,
    90 * day,
    180 * day,
    365 * day,
  ];
  let step = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (span / c <= targetCount * 1.5) {
      step = c;
      break;
    }
  }
  // Snap start to UTC midnight
  const startDate = new Date(startMs);
  startDate.setUTCHours(0, 0, 0, 0);
  const ticks: number[] = [];
  for (let t = startDate.getTime(); t <= endMs; t += step) {
    if (t >= startMs) ticks.push(t);
  }
  if (ticks[ticks.length - 1] < endMs - step / 2) ticks.push(endMs);
  return ticks;
}

/**
 * Bucket events into N daily-ish bins for the density ribbon.
 * Returns counts per bin.
 */
export function buildDensity(
  events: TimelineEvent[],
  startMs: number,
  endMs: number,
  bins: number,
): number[] {
  const counts = new Array(bins).fill(0);
  if (events.length === 0 || endMs <= startMs) return counts;
  const span = endMs - startMs;
  for (const evt of events) {
    const t = toMs(evt.date);
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(((t - startMs) / span) * bins)));
    counts[bin] += 1;
  }
  return counts;
}

/**
 * Smooth area-chart path for the density ribbon (Catmull-Rom-ish).
 * Returns an SVG path string.
 */
export function densityPath(
  counts: number[],
  width: number,
  height: number,
  baseline: number,
): string {
  if (counts.length === 0 || width <= 0 || height <= 0) return "";
  const peak = Math.max(...counts, 1);
  const stepX = width / Math.max(counts.length - 1, 1);
  const points = counts.map((c, i) => {
    const x = i * stepX;
    const y = baseline - (c / peak) * height;
    return [x, y] as const;
  });
  let d = `M ${points[0][0]},${baseline} L ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  d += ` L ${points[points.length - 1][0]},${baseline} Z`;
  return d;
}

/**
 * Resolve cluster collisions on a single horizontal lane: events that overlap
 * in screen-x get nudged vertically (like beeswarm) within the lane's vertical bounds.
 */
export interface PlottedEvent {
  event: TimelineEvent;
  cx: number;
  cy: number;
  r: number;
}

export function plotLane(
  events: TimelineEvent[],
  xScale: (ms: number) => number,
  laneCenterY: number,
  laneHalfHeight: number,
  baseRadius = 4.5,
): PlottedEvent[] {
  const placed: PlottedEvent[] = [];
  const sorted = [...events].sort((a, b) => toMs(a.date) - toMs(b.date));
  for (const evt of sorted) {
    const cx = xScale(toMs(evt.date));
    const r = baseRadius + evt.significance * 4;
    let cy = laneCenterY;
    let attempt = 0;
    const offsetStep = r * 1.4;
    while (
      placed.some(
        (p) =>
          Math.abs(p.cx - cx) < (p.r + r) * 1.05 &&
          Math.abs(p.cy - cy) < (p.r + r) * 1.05,
      ) &&
      attempt < 12
    ) {
      attempt += 1;
      const sign = attempt % 2 === 0 ? -1 : 1;
      const magnitude = Math.ceil(attempt / 2) * offsetStep;
      cy = laneCenterY + sign * magnitude;
      if (Math.abs(cy - laneCenterY) > laneHalfHeight) break;
    }
    placed.push({ event: evt, cx, cy, r });
  }
  return placed;
}
