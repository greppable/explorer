import type { GdlFormat } from "../types";

export type TimelineLayer =
  | "memory"
  | "document"
  | "schema"
  | "code"
  | "diagram"
  | "api"
  | "data"
  | "version";

export interface TimelineEvent {
  id: string;
  date: string;            // ISO 8601
  layer: TimelineLayer;
  format: GdlFormat;
  type: string;            // e.g. "decision", "observation", "contract", "generated"
  title: string;
  detail?: string;
  agent?: string;
  tags: string[];
  entities: string[];      // related entity names for cross-layer linking
  file: string;            // source file path
  line?: number;
  significance: number;    // 0..1, used for visual weight
  signal?: string;
  status?: string;
  confidence?: string;
  relates?: string;        // memory→memory pointer "kind~ID"
}

export interface TimelinePhase {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  eventCount: number;
  dominantLayer: TimelineLayer;
  themes: string[];        // top tag/type words
}

export interface TimelineSummary {
  totalEvents: number;
  layerCounts: Record<TimelineLayer, number>;
  agents: string[];
  dateRange: { start: string; end: string } | null;
}

export interface TimelinePayload {
  events: TimelineEvent[];
  phases: TimelinePhase[];
  summary: TimelineSummary;
}
