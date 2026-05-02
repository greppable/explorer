"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type {
  TimelinePayload,
  TimelineEvent,
  TimelineLayer,
} from "@/lib/timeline/types";
import { LANE_STYLES } from "./constants";
import { formatDateLong, formatDateShort, formatRange, toMs } from "./timeline-utils";

interface TimelineStoryProps {
  data: TimelinePayload;
  visibleLayers: Set<TimelineLayer>;
  visibleAgents: Set<string>;
  query: string;
  dateFrom: string | null;
  dateTo: string | null;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  isDark: boolean;
}

interface ChapterEntry {
  phase: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    eventCount: number;
    dominantLayer: TimelineLayer;
  };
  days: Map<string, TimelineEvent[]>;
}

/**
 * Editorial longread rendering of the project chronicle.
 * - Resizable Contents sidebar (left)
 * - Reading area uses an asymmetric two-column grid: comfortable body column
 *   plus a narrower marginalia column on the right that surfaces day-level
 *   metadata (agents, top tags, micro rhythm), so the wide margin earns its
 *   keep instead of being empty space.
 */
export function TimelineStory({
  data,
  visibleLayers,
  visibleAgents,
  query,
  dateFrom,
  dateTo,
  selectedEventId,
  onSelectEvent,
  isDark,
}: TimelineStoryProps) {
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

  const grouped: ChapterEntry[] = useMemo(() => {
    const phaseMap = new Map<string, ChapterEntry>();
    const phasesByStart = [...data.phases].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    for (const evt of filtered) {
      const phase =
        phasesByStart.find(
          (p) => evt.date >= p.startDate && evt.date <= p.endDate,
        ) ?? phasesByStart[0];
      const key = phase?.id ?? "unbound";
      let entry = phaseMap.get(key);
      if (!entry) {
        entry = {
          phase: phase
            ? {
                id: phase.id,
                label: phase.label,
                startDate: phase.startDate,
                endDate: phase.endDate,
                eventCount: phase.eventCount,
                dominantLayer: phase.dominantLayer,
              }
            : {
                id: "unbound",
                label: "Unbound",
                startDate: evt.date,
                endDate: evt.date,
                eventCount: 0,
                dominantLayer: evt.layer,
              },
          days: new Map(),
        };
        phaseMap.set(key, entry);
      }
      const day = evt.date.split("T")[0];
      const list = entry.days.get(day) ?? [];
      list.push(evt);
      entry.days.set(day, list);
    }
    return [...phaseMap.values()].sort((a, b) =>
      a.phase.startDate.localeCompare(b.phase.startDate),
    );
  }, [filtered, data.phases]);

  // ── Scroll-spy ───────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const articleRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [observedActiveId, setObservedActiveId] = useState<string | null>(null);
  const activeChapterId =
    observedActiveId ??
    (grouped.length > 0 ? chapterDomId(grouped[0].phase.id) : null);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || grouped.length === 0) return;
    const refs = articleRefs.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setObservedActiveId(visible[0].target.id);
        }
      },
      { root, rootMargin: "-10% 0px -70% 0px", threshold: [0, 0.05] },
    );
    refs.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [grouped]);

  // ── Reading progress ─────────────────────────────────────────
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;
    const onScroll = () => {
      const max = root.scrollHeight - root.clientHeight;
      setScrollProgress(max > 0 ? root.scrollTop / max : 0);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [grouped]);

  const scrollToChapter = (id: string) => {
    const el = articleRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Empty state ─────────────────────────────────────────────
  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="space-y-2">
          <div className="font-serif text-2xl text-muted-foreground/60">
            Nothing in this chapter
          </div>
          <div className="text-[12px] text-muted-foreground/50">
            Try widening your filters or clearing the search.
          </div>
        </div>
      </div>
    );
  }

  // Count from the actual filtered/grouped events so the sidebar reflects what
  // the reader currently sees, not the unfiltered phase totals.
  const totalEvents = grouped.reduce(
    (sum, c) =>
      sum + [...c.days.values()].reduce((s, evts) => s + evts.length, 0),
    0,
  );

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Contents sidebar — resizable */}
      <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
        <ChapterNav
          chapters={grouped}
          activeId={activeChapterId}
          onSelect={scrollToChapter}
          isDark={isDark}
          totalEvents={totalEvents}
          scrollProgress={scrollProgress}
        />
      </ResizablePanel>

      <ResizableHandle />

      {/* Reading area */}
      <ResizablePanel defaultSize={82}>
        <div
          ref={scrollContainerRef}
          className="relative h-full overflow-y-auto bg-background"
        >
          {/* Subtle paper grain */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 25%, currentColor 0.5px, transparent 0.5px)",
              backgroundSize: "4px 4px",
            }}
          />

          <div className="mx-auto max-w-[1180px] px-12 pb-24 pt-16">
            {grouped.map((entry, phaseIdx) => (
              <ChapterArticle
                key={entry.phase.id}
                entry={entry}
                index={phaseIdx}
                isDark={isDark}
                selectedEventId={selectedEventId}
                onSelectEvent={onSelectEvent}
                articleRef={(el) => {
                  const id = chapterDomId(entry.phase.id);
                  if (el) articleRefs.current.set(id, el);
                  else articleRefs.current.delete(id);
                }}
              />
            ))}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function chapterDomId(phaseId: string): string {
  return `chapter-${phaseId}`;
}

// ─── Chapter article ──────────────────────────────────────────────────────

function ChapterArticle({
  entry,
  index,
  isDark,
  selectedEventId,
  onSelectEvent,
  articleRef,
}: {
  entry: ChapterEntry;
  index: number;
  isDark: boolean;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  articleRef: (el: HTMLElement | null) => void;
}) {
  const accent = isDark
    ? LANE_STYLES[entry.phase.dominantLayer].accentDark
    : LANE_STYLES[entry.phase.dominantLayer].accent;

  const days = [...entry.days.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <article
      id={chapterDomId(entry.phase.id)}
      ref={articleRef}
      className="mb-32 scroll-mt-4"
    >
      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="relative mb-14">
        {/* Watermark chapter number */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-2 -top-8 select-none font-serif text-[180px] leading-none text-foreground/[0.04]"
          style={{ fontFeatureSettings: "'lnum'" }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        <div className="relative">
          {/* Eyebrow */}
          <div className="mb-4 flex items-center gap-3">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{ color: accent }}
            >
              Chapter {String(index + 1).padStart(2, "0")}
            </span>
            <span className="h-px flex-1 max-w-32 bg-border/50" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/55">
              {LANE_STYLES[entry.phase.dominantLayer].label}
            </span>
          </div>

          {/* Title */}
          <h2
            className="font-serif text-[64px] leading-[0.95] tracking-[-0.02em] text-foreground/95"
            style={{ fontFeatureSettings: "'opsz' 72, 'kern' 1, 'liga' 1" }}
          >
            {entry.phase.label}
          </h2>

          {/* Meta line */}
          <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/65">
            <span>{formatRange(entry.phase.startDate, entry.phase.endDate)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>
              {entry.phase.eventCount}{" "}
              <span className="text-muted-foreground/45">
                {entry.phase.eventCount === 1 ? "entry" : "entries"}
              </span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span>
              {days.length}{" "}
              <span className="text-muted-foreground/45">
                {days.length === 1 ? "day" : "days"}
              </span>
            </span>
          </div>
        </div>

        {/* Hairline rule */}
        <div className="mt-10 h-px w-full bg-border/40" />
      </header>

      {/* ── Days ─────────────────────────────────────────────── */}
      <div className="space-y-16">
        {days.map(([day, events]) => (
          <DaySection
            key={day}
            day={day}
            events={events}
            isDark={isDark}
            selectedEventId={selectedEventId}
            onSelectEvent={onSelectEvent}
          />
        ))}
      </div>
    </article>
  );
}

// ─── Day section ──────────────────────────────────────────────────────────

function DaySection({
  day,
  events,
  isDark,
  selectedEventId,
  onSelectEvent,
}: {
  day: string;
  events: TimelineEvent[];
  isDark: boolean;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
}) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  // Aggregate margin metadata
  const agents = new Set<string>();
  const tagCounts = new Map<string, number>();
  for (const evt of sorted) {
    if (evt.agent) agents.add(evt.agent);
    for (const tag of evt.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // Hourly histogram for the rhythm sparkline (24 buckets)
  const hourly = new Array(24).fill(0);
  for (const evt of sorted) {
    const h = new Date(evt.date).getUTCHours();
    hourly[h] += 1;
  }
  const peak = Math.max(...hourly, 1);

  return (
    <section className="grid grid-cols-1 gap-x-16 gap-y-6 md:grid-cols-[minmax(0,1fr)_240px]">
      {/* ── Body column ─────────────────────────────────── */}
      <div className="min-w-0 space-y-3">
        <header className="mb-5 flex items-baseline gap-4">
          <h3 className="font-serif text-2xl text-foreground/90">
            {formatDateLong(day + "T00:00:00Z")}
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/45">
            {events.length} {events.length === 1 ? "moment" : "moments"}
          </span>
        </header>

        <div className="relative space-y-1 border-l border-border/30 pl-7">
          {sorted.map((evt) => (
            <Moment
              key={evt.id}
              event={evt}
              isSelected={evt.id === selectedEventId}
              onClick={() =>
                onSelectEvent(evt.id === selectedEventId ? null : evt.id)
              }
              isDark={isDark}
            />
          ))}
        </div>
      </div>

      {/* ── Margin column ──────────────────────────────── */}
      <aside className="hidden md:block">
        {/* Sticky so the marginalia tracks the day as the reader scrolls through it */}
        <div className="sticky top-12 space-y-5 pt-12">
          {/* Rhythm sparkline */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/55">
                Rhythm
              </span>
              <span className="font-mono text-[9.5px] tracking-wider text-muted-foreground/40">
                24h
              </span>
            </div>
            <svg width="100%" height="34" viewBox="0 0 240 34" preserveAspectRatio="none">
              {hourly.map((v, h) => {
                const w = 240 / 24;
                const x = h * w;
                const barH = (v / peak) * 30;
                const y = 32 - barH;
                return (
                  <rect
                    key={h}
                    x={x + 0.5}
                    y={y}
                    width={Math.max(w - 1, 1)}
                    height={barH || 0.5}
                    fill="currentColor"
                    fillOpacity={v > 0 ? 0.45 : 0.08}
                    className="text-foreground"
                  />
                );
              })}
              <line
                x1={0}
                x2={240}
                y1={32.5}
                y2={32.5}
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth="0.5"
                className="text-foreground"
              />
            </svg>
          </div>

          {/* Agents involved */}
          {agents.size > 0 && (
            <div>
              <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/55">
                Hands on deck
              </div>
              <div className="flex flex-wrap gap-1">
                {[...agents].sort().map((a) => (
                  <span
                    key={a}
                    className="rounded-sm border border-border/40 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/70"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top themes */}
          {topTags.length > 0 && (
            <div>
              <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/55">
                Themes
              </div>
              <div className="flex flex-wrap gap-1">
                {topTags.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[10px] tracking-wide text-muted-foreground/70"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}

// ─── Single moment ────────────────────────────────────────────────────────

function Moment({
  event,
  isSelected,
  onClick,
  isDark,
}: {
  event: TimelineEvent;
  isSelected: boolean;
  onClick: () => void;
  isDark: boolean;
}) {
  const style = LANE_STYLES[event.layer];
  const accent = isDark ? style.accentDark : style.accent;
  const time = event.date.split("T")[1]?.substring(0, 5) || "";
  const isPullQuote =
    event.type === "decision" && event.significance >= 0.85;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative -ml-7 flex w-full items-start gap-4 rounded-lg px-3 py-2.5 text-left transition-all",
        isSelected
          ? "bg-accent/40 ring-1 ring-primary/30"
          : "hover:bg-accent/15",
      )}
    >
      {/* Marker */}
      <div className="relative pt-2">
        <span
          className="block h-2 w-2 rounded-full ring-[3px] ring-background transition-transform group-hover:scale-125"
          style={{ background: accent }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span
            className="font-mono text-[9.5px] uppercase tracking-[0.16em]"
            style={{ color: accent }}
          >
            {style.label}
          </span>
          {event.type && event.type !== style.label.toLowerCase() && (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/55">
              {event.type}
            </span>
          )}
          {event.agent && (
            <span className="font-mono text-[9.5px] tracking-wide text-muted-foreground/45">
              · {event.agent}
            </span>
          )}
          <span className="ml-auto font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground/35">
            {time && time + " UTC"}
          </span>
        </div>

        {isPullQuote ? (
          <blockquote
            className="mt-1.5 border-l-[3px] pl-3 font-serif text-[19px] leading-snug text-foreground/95"
            style={{ borderColor: accent }}
          >
            “{event.title}”
          </blockquote>
        ) : (
          <div className="mt-1 font-serif text-[16.5px] leading-snug text-foreground/90">
            {event.title}
          </div>
        )}

        {event.detail && (
          <div className="mt-1.5 text-[13px] leading-relaxed text-foreground/65">
            {event.detail}
          </div>
        )}

        {(event.tags.length > 0 || event.entities.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-muted/45 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide text-muted-foreground/70"
              >
                {tag}
              </span>
            ))}
            {event.entities.slice(0, 3).map((ent) => (
              <span
                key={ent}
                className="rounded-sm border border-border/40 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide text-foreground/60"
              >
                ↳ {ent}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Chapter navigator (left rail) ────────────────────────────────────────

function ChapterNav({
  chapters,
  activeId,
  onSelect,
  isDark,
  totalEvents,
  scrollProgress,
}: {
  chapters: ChapterEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  isDark: boolean;
  totalEvents: number;
  scrollProgress: number;
}) {
  const activeIndex = chapters.findIndex(
    (c) => chapterDomId(c.phase.id) === activeId,
  );

  return (
    <aside className="relative flex h-full min-w-0 flex-col overflow-hidden border-r border-border/40 bg-card/30">
      {/* Reading progress bar at top */}
      <div className="relative h-0.5 w-full bg-border/30">
        <div
          className="h-full bg-primary/70 transition-[width] duration-150 ease-out"
          style={{ width: `${Math.round(scrollProgress * 100)}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <header className="mb-5 flex items-center gap-2">
          <BookOpen className="h-3 w-3 text-muted-foreground/55" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
            Contents
          </span>
        </header>

        <div className="mb-5 space-y-0.5 font-mono text-[10px] tracking-wide text-muted-foreground/55">
          <div>
            <span className="font-medium text-foreground/75">{chapters.length}</span> chapters
          </div>
          <div>
            <span className="font-medium text-foreground/75">{totalEvents}</span> entries
          </div>
        </div>

        <ol className="relative space-y-0.5">
          {/* Vertical thread */}
          <span
            aria-hidden
            className="absolute bottom-2 left-[7px] top-2 w-px bg-border/50"
          />

          {chapters.map((entry, idx) => {
            const id = chapterDomId(entry.phase.id);
            const isActive = id === activeId;
            const isPast = activeIndex >= 0 && idx < activeIndex;
            const accent = isDark
              ? LANE_STYLES[entry.phase.dominantLayer].accentDark
              : LANE_STYLES[entry.phase.dominantLayer].accent;
            return (
              <li key={id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className={cn(
                    "group relative w-full rounded-md py-2 pl-7 pr-2 text-left transition-colors",
                    isActive ? "bg-accent/40" : "hover:bg-accent/20",
                  )}
                >
                  {/* Marker dot on the thread */}
                  <span
                    aria-hidden
                    className="absolute left-[3px] top-3 block h-2 w-2 rounded-full ring-2 ring-card"
                    style={{
                      background: isActive || isPast ? accent : "transparent",
                      borderColor: accent,
                      borderWidth: isActive || isPast ? 0 : 1,
                      borderStyle: "solid",
                      outline: isActive ? `2px solid ${accent}` : "none",
                      outlineOffset: 1,
                    }}
                  />

                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "font-mono text-[9.5px] tracking-[0.12em]",
                        isActive
                          ? "text-foreground/80"
                          : "text-muted-foreground/45",
                      )}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "truncate font-serif text-[13px] leading-snug",
                        isActive
                          ? "text-foreground"
                          : "text-foreground/70 group-hover:text-foreground/90",
                      )}
                    >
                      {entry.phase.label}
                    </span>
                  </div>
                  <div className="mt-0.5 ml-[18px] flex items-baseline gap-2">
                    <span className="font-mono text-[9.5px] tracking-wide text-muted-foreground/45">
                      {formatDateShort(entry.phase.startDate)} – {formatDateShort(entry.phase.endDate)}
                    </span>
                    <span className="font-mono text-[9.5px] tracking-wide text-muted-foreground/35">
                      · {entry.phase.eventCount}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
