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

Point it at any repo with `.gdl*` files and get:
- **File browser** — all GDL files grouped by format
- **Format-specific rendering** — graphs, grids, schema trees, knowledge maps
- **Knowledge graph** — interactive entity graph with search, type filters, and force/grid layouts
- **Cross-layer linking** — click any entity to see where it appears across all layers

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

Toggle between **Explorer** and **Graph** in the toolbar:

- **Explorer** — file tree sidebar with format-specific viewers and cross-layer entity panel
- **Graph** — interactive knowledge graph showing all entities and their relationships across GDL layers, with search, type filters, and switchable grid/force layouts

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
