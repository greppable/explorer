import type { TimelineLayer } from "@/lib/timeline/types";

export const ALL_LAYERS: TimelineLayer[] = [
  "memory",
  "document",
  "schema",
  "code",
  "diagram",
  "api",
  "data",
  "version",
];

/**
 * Lane order top-to-bottom in the chronicle. Memory is the heart of the
 * project narrative, so it sits at the top.
 */
export const LANE_ORDER: TimelineLayer[] = [
  "memory",
  "document",
  "api",
  "schema",
  "code",
  "diagram",
  "data",
  "version",
];

export interface LaneStyle {
  label: string;
  glyph: string;
  hue: number;       // base HSL hue
  sat: number;       // saturation %
  accent: string;    // CSS color used for dots / arcs (light theme)
  accentDark: string;
}

export const LANE_STYLES: Record<TimelineLayer, LaneStyle> = {
  memory: {
    label: "Memory",
    glyph: "◆",
    hue: 152,
    sat: 50,
    accent: "hsl(152 50% 36%)",
    accentDark: "hsl(152 60% 58%)",
  },
  document: {
    label: "Documents",
    glyph: "❡",
    hue: 32,
    sat: 70,
    accent: "hsl(32 70% 48%)",
    accentDark: "hsl(36 80% 62%)",
  },
  api: {
    label: "API",
    glyph: "⌘",
    hue: 250,
    sat: 60,
    accent: "hsl(250 60% 58%)",
    accentDark: "hsl(252 70% 70%)",
  },
  schema: {
    label: "Schema",
    glyph: "▦",
    hue: 200,
    sat: 65,
    accent: "hsl(200 60% 42%)",
    accentDark: "hsl(202 70% 60%)",
  },
  code: {
    label: "Code",
    glyph: "{}",
    hue: 280,
    sat: 50,
    accent: "hsl(280 45% 50%)",
    accentDark: "hsl(282 55% 68%)",
  },
  diagram: {
    label: "Diagrams",
    glyph: "◇",
    hue: 188,
    sat: 60,
    accent: "hsl(188 55% 40%)",
    accentDark: "hsl(188 65% 60%)",
  },
  data: {
    label: "Data",
    glyph: "◈",
    hue: 16,
    sat: 70,
    accent: "hsl(16 70% 50%)",
    accentDark: "hsl(20 75% 64%)",
  },
  version: {
    label: "File Versions",
    glyph: "✦",
    hue: 0,
    sat: 0,
    accent: "hsl(40 8% 45%)",
    accentDark: "hsl(40 10% 65%)",
  },
};
