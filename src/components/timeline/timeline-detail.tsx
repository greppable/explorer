"use client";

import { ExternalLink, X } from "lucide-react";
import type { TimelineEvent } from "@/lib/timeline/types";
import { LANE_STYLES } from "./constants";
import { formatDateTime } from "./timeline-utils";

interface TimelineDetailProps {
  event: TimelineEvent;
  related: TimelineEvent[];
  isDark: boolean;
  onClose: () => void;
  onSelectRelated: (id: string) => void;
  onOpenInExplorer?: (filePath: string, line?: number) => void;
}

export function TimelineDetail({
  event,
  related,
  isDark,
  onClose,
  onSelectRelated,
  onOpenInExplorer,
}: TimelineDetailProps) {
  const style = LANE_STYLES[event.layer];
  const accent = isDark ? style.accentDark : style.accent;

  return (
    <aside className="flex h-full flex-col border-l border-border/40 bg-card/40 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border/40 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: accent }}
            />
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: accent }}
            >
              {style.label}
            </span>
            {event.type && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
                · {event.type}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-serif text-xl leading-tight text-foreground/90">
            {event.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label="Close detail"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <dl className="space-y-3.5 text-[12px]">
          <Row label="When">{formatDateTime(event.date)}</Row>
          {event.agent && <Row label="Agent">{event.agent}</Row>}
          {event.confidence && <Row label="Confidence">{event.confidence}</Row>}
          {event.signal && <Row label="Signal">{event.signal}</Row>}
          {event.status && <Row label="Status">{event.status}</Row>}
          <Row label="Source">
            {onOpenInExplorer ? (
              <button
                type="button"
                onClick={() => onOpenInExplorer(event.file, event.line)}
                className="group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 -mx-1 text-left transition-colors hover:bg-primary/10"
                title="Open in Explorer"
              >
                <span className="font-mono text-[11px] text-foreground/85 group-hover:text-primary">
                  {event.file}
                  {event.line ? (
                    <span className="text-muted-foreground/60">:{event.line}</span>
                  ) : null}
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground/40 transition-colors group-hover:text-primary/70" />
              </button>
            ) : (
              <span className="font-mono text-[11px] text-muted-foreground/80">
                {event.file}
                {event.line ? `:${event.line}` : ""}
              </span>
            )}
          </Row>
        </dl>

        {event.detail && (
          <div className="mt-5 rounded-lg border border-border/40 bg-background/60 p-3">
            <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/55">
              Detail
            </div>
            <p className="font-serif text-[14px] leading-relaxed text-foreground/85">
              {event.detail}
            </p>
          </div>
        )}

        {event.tags.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/55">
              Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-sm bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/85"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {event.entities.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/55">
              Entities
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.entities.map((e) => (
                <span
                  key={e}
                  className="rounded-sm border border-border/40 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/70"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/55">
              Connected moments · {related.length}
            </div>
            <div className="space-y-1">
              {related.map((rel) => {
                const relStyle = LANE_STYLES[rel.layer];
                const relAccent = isDark ? relStyle.accentDark : relStyle.accent;
                return (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => onSelectRelated(rel.id)}
                    className="group flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent/30"
                  >
                    <span
                      className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: relAccent }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-foreground/85 group-hover:text-foreground">
                        {rel.title}
                      </div>
                      <div className="mt-0.5 font-mono text-[9.5px] tracking-wide text-muted-foreground/55">
                        {rel.date.split("T")[0]} · {relStyle.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/55">
        {label}
      </dt>
      <dd className="text-foreground/85">{children}</dd>
    </div>
  );
}
