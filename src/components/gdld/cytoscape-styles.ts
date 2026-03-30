export const SHAPE_MAP: Record<string, string> = {
  box: "round-rectangle",
  diamond: "diamond",
  stadium: "round-rectangle",
  circle: "ellipse",
  hexagon: "hexagon",
  database: "barrel",
  subroutine: "round-rectangle",
};

/**
 * Build Cytoscape styles — clean neutral warm-grey aesthetic.
 * Uses CSS custom properties for light/dark theme awareness.
 *
 * NOTE: Cytoscape does NOT support rgba(). Use hex/rgb colors
 * and control transparency via *-opacity properties.
 */
// Cache resolved CSS colors to avoid DOM thrash (one temp element per build)
function resolveColors(): { bg: string; fg: string; muted: string } {
  const style = getComputedStyle(document.documentElement);
  const resolve = (varName: string, fallback: string): string => {
    const raw = style.getPropertyValue(varName).trim();
    return raw || fallback;
  };
  // Use a single temp element to resolve all colors
  const el = document.createElement("div");
  document.body.appendChild(el);
  const toRgb = (val: string): string => {
    el.style.color = val;
    return getComputedStyle(el).color;
  };
  const bg = toRgb(resolve("--background", "#ffffff"));
  const fg = toRgb(resolve("--foreground", "#1a1a1a"));
  const muted = toRgb(resolve("--muted", "#f5f5f5"));
  document.body.removeChild(el);
  return { bg, fg, muted };
}

export function buildCytoscapeStyles(): Array<{ selector: string; style: Record<string, unknown> }> {
  const { bg, fg, muted } = resolveColors();

  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-valign": "center",
        "text-halign": "center",
        "background-color": bg,
        "border-width": 1,
        "border-color": "#d4d4d4",
        "border-opacity": 0.6,
        color: fg,
        "font-size": "12px",
        "font-family": "ui-monospace, 'JetBrains Mono', monospace",
        padding: "16px",
        width: "label",
        height: "label",
        shape: "data(shape)",
        "text-wrap": "wrap",
        "text-max-width": "160px",
      },
    },
    {
      selector: "node.subroutine",
      style: { "border-width": 2 },
    },
    {
      selector: "node.deprecated",
      style: {
        opacity: 0.4,
        "border-style": "dashed",
      },
    },
    {
      selector: "node.planned",
      style: {
        "border-style": "dashed",
        "background-color": muted,
      },
    },
    {
      selector: ":parent",
      style: {
        "text-valign": "top",
        "text-halign": "left",
        "background-color": "#e8e8e8",
        "background-opacity": 0.25,
        "border-width": 1,
        "border-style": "dashed",
        "border-color": "#c0c0c0",
        "border-opacity": 0.4,
        padding: "30px",
        "font-size": "11px",
        "font-weight": "500",
        "text-margin-y": -6,
        "text-margin-x": 8,
        color: "#7a9b7e",
      },
    },
    {
      selector: "edge",
      style: {
        width: 1,
        "line-color": "#c0c0c0",
        "line-opacity": 0.6,
        "target-arrow-color": "#c0c0c0",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.7,
        "curve-style": "bezier",
        "text-background-opacity": 0,
      },
    },
    {
      selector: "edge[label]",
      style: {
        label: "data(label)",
        "font-size": "9px",
        "font-family": "ui-monospace, 'JetBrains Mono', monospace",
        color: "#999999",
        "text-background-color": bg,
        "text-background-opacity": 0.85,
        "text-background-padding": "3px",
      },
    },
    {
      selector: "edge.bidirectional",
      style: {
        "source-arrow-shape": "triangle",
        "source-arrow-color": "#c0c0c0",
      },
    },
    {
      selector: "edge.dashed",
      style: { "line-style": "dashed" },
    },
    {
      selector: "edge.dotted",
      style: { "line-style": "dotted" },
    },
    {
      selector: "edge.thick",
      style: { width: 2 },
    },
    {
      selector: "node:selected",
      style: {
        "border-color": "#999999",
        "border-width": 2,
        "border-opacity": 1,
      },
    },
    {
      selector: "node:active",
      style: {
        "overlay-opacity": 0.03,
      },
    },
  ];
}
