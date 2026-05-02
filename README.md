# greppable-explorer

[![Website](https://img.shields.io/badge/greppable.ai-8470FF?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHRleHQgeD0iMiIgeT0iMTMiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIj5nPC90ZXh0Pjwvc3ZnPg==&logoColor=white)](https://greppable.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GDL Spec](https://img.shields.io/badge/GDL-spec-blue.svg)](https://github.com/greppable/spec)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

Visual explorer for [GDL](https://github.com/greppable/spec) (Grep-native Data Language) projects. Built by [greppable.ai](https://greppable.ai).

### Knowledge Graph
![Knowledge Graph](docs/screenshots/graph.png)

### Schema Browser (GDLS)
![Schema Browser](docs/screenshots/schema.png)

### API Contracts (GDLA)
![API Contracts](docs/screenshots/api.png)

### Memory Timeline (GDLM)
![Memory Timeline](docs/screenshots/memory.png)

### Flowchart Diagrams (GDLD)
![Flowchart](docs/screenshots/flowchart.png)

### The Greppable Chronicle — Timeline

A unified timeline view that aggregates every dated GDL record across the project (memories, source documents, file version headers, dated diagrams) into one event stream. Phases are auto-detected from gap clustering plus agent-family shifts. Search, layer chips, agent filter, date-range presets and wheel-to-zoom apply to all views.

#### Panorama
Horizontal swim lanes per layer with phase bands, an intensity ribbon at the top, beeswarm-packed event nodes and faint cross-layer arcs that connect events sharing entities.

![Chronicle — Panorama](docs/screenshots/timeline-panorama.png)

#### Weave
Single-river layout where every event sits on one centerline. Bezier threads alternate above and below the line, weaving connections between events that share entities.

![Chronicle — Weave](docs/screenshots/timeline-weave.png)

#### Intensity
Full-pane stacked area chart of activity per layer over time. Each colored stream shows where the project's energy was going on any given day. Peak day is annotated; hover the chart for a per-layer breakdown.

![Chronicle — Intensity](docs/screenshots/timeline-intensity.png)

#### Story
Editorial longread layout (not pictured): resizable Contents sidebar with chapter scroll-spy; chapter heroes set in Newsreader serif; per-day marginalia with a 24-hour rhythm sparkline, agents on deck and top themes; pull-quote treatment for high-confidence decisions.

Point it at any repo with `.gdl*` files and get:
- **File browser** — all GDL files grouped by format, with an opt-in folder-path toggle for disambiguating same-name files
- **Format-specific rendering** — graphs, grids, schema trees, knowledge maps
- **Knowledge graph** — interactive entity graph with search, type filters, and force/grid layouts. **Adaptive scaling** — projects above 200 entities get a three-way **Recent / Clusters / All** toggle so the graph stays performant without losing detail
- **The Greppable Chronicle** — four-view timeline (Panorama / Weave / Intensity / Story) over every dated record across the project
- **Cross-layer linking** — click any entity to see where it appears across all layers
- **Cross-view jump** — source rows in any detail panel open the file in the Explorer
- **Resizable detail panels** across explorer, graph and timeline

## Quick Start

```bash
cd your-project-with-gdl-files
npx greppable-explorer
```

Opens at `http://127.0.0.1:4321`.

## Options

```bash
npx greppable-explorer --port=3000           # Custom port
npx greppable-explorer --root=/path/to/project  # Explicit project root
```

## Development

```bash
git clone https://github.com/greppable/greppable-explorer.git
cd greppable-explorer
npm install
GDL_ROOT=/path/to/project npm run dev
```

## Views

Toggle between **Explorer**, **Graph** and **Timeline** in the toolbar:

- **Explorer** — file tree sidebar with format-specific viewers and cross-layer entity panel
- **Graph** — interactive knowledge graph showing all entities and their relationships across GDL layers, with search, type filters, switchable grid/force layouts, and adaptive Recent / Clusters / All scaling for large projects
- **Timeline** — the Greppable Chronicle, with four sub-views (Panorama / Weave / Intensity / Story) over every dated record in the project

## Supported Formats

| Format | Extension | What it shows |
|--------|-----------|---------------|
| GDL | `.gdl` | Data grid with sortable columns |
| GDLS | `.gdls` | Schema tree with table/column browser |
| GDLC | `.gdlc` | Code structure with module dependencies |
| GDLA | `.gdla` | API contracts with endpoint details |
| GDLM | `.gdlm` | Knowledge graph with timeline view |
| GDLD | `.gdld` | Flowcharts and sequence diagrams (Cytoscape) |
| GDLU | `.gdlu` | Document index with section navigation |

## Notes

- First `npx` run downloads dependencies (~510MB). Subsequent runs use npm cache and are near-instant.
- Requires Node.js 18+.
- Binds to `127.0.0.1` only (localhost) — not exposed to network.

## License

[MIT](LICENSE)
