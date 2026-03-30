"use client";

import { useEffect, useState } from "react";
import type { FileEntry } from "@/lib/types";
import type { GdlaFile, GdlaEndpoint } from "@/lib/parsers/gdla-parser";
import { getErrorMessage } from "@/lib/utils";

interface GdlaViewerProps {
  file: FileEntry;
  onEntitySelect?: (entity: string) => void;
}

export function GdlaViewer({ file, onEntitySelect }: GdlaViewerProps) {
  const [data, setData] = useState<GdlaFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setSelectedEndpoint(null);
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/gdla/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((parsed: GdlaFile) => {
        if (!cancelled) {
          setData(parsed);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(getErrorMessage(error));
      });
    return () => { cancelled = true; };
  }, [file.path]);

  if (error) return <div className="p-4 text-red-500 text-sm">{error}</div>;
  if (!data) return <div className="p-4 text-sm text-muted-foreground">Loading API contract...</div>;

  const methodColor = (m: string) => {
    switch (m) {
      case "GET": case "QUERY": return "text-green-600 bg-green-400/10";
      case "POST": case "MUTATION": return "text-blue-600 bg-blue-400/10";
      case "PUT": case "PATCH": return "text-amber-600 bg-amber-400/10";
      case "DELETE": return "text-red-600 bg-red-400/10";
      case "SUBSCRIPTION": return "text-purple-600 bg-purple-400/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const selectedEp = data.endpoints.find(
    (e) => `${e.method} ${e.path}` === selectedEndpoint
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2 text-xs">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">GDLA</span>
        {data.version && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{data.version.source}</span>
        )}
        {data.version?.generated && (
          <span className="text-[10px] font-mono text-muted-foreground/50">{data.version.generated}</span>
        )}
        <span className="text-muted-foreground font-mono text-[10px]">
          {data.endpoints.length} endpoint{data.endpoints.length !== 1 ? "s" : ""} · {data.schemas.length} schema{data.schemas.length !== 1 ? "s" : ""} · {data.auth.length} auth
        </span>
      </div>

      {/* Domain header */}
      {data.domains.length > 0 && (
        <div className="px-4 py-3 border-b border-border/30 bg-card/20">
          <h2
            className="text-sm font-mono font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => onEntitySelect?.(data.domains[0].name)}
          >
            {data.domains[0].name}
          </h2>
          {data.domains[0].description && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.domains[0].description}</p>
          )}
          <div className="flex gap-3 mt-1">
            {data.domains[0].version && (
              <span className="text-[10px] font-mono text-muted-foreground/60">v{data.domains[0].version}</span>
            )}
            {data.domains[0].baseUrl && (
              <span className="text-[10px] font-mono text-muted-foreground/60">{data.domains[0].baseUrl}</span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar: endpoints list */}
        <div className="w-56 border-r border-border/50 flex-shrink-0 overflow-auto">
          <div className="p-2 space-y-0.5">
            {data.endpoints.map((ep) => {
              const key = `${ep.method} ${ep.path}`;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedEndpoint(key)}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-mono transition-colors flex items-center gap-1.5 ${
                    selectedEndpoint === key
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "text-foreground/70 hover:bg-muted/50"
                  }`}
                >
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${methodColor(ep.method)}`}>
                    {ep.method}
                  </span>
                  <span className="truncate">{ep.path}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-auto">
          {selectedEp ? (
            <EndpointDetail endpoint={selectedEp} data={data} onEntitySelect={onEntitySelect} />
          ) : (
            <OverviewPanel data={data} onEntitySelect={onEntitySelect} />
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewPanel({ data, onEntitySelect }: { data: GdlaFile; onEntitySelect?: (e: string) => void }) {
  return (
    <div className="p-4 space-y-5">
      {/* Schemas */}
      {data.schemas.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Schemas</h3>
          <div className="space-y-3">
            {data.schemas.map((schema) => (
              <div key={schema.name} className="border border-border/40 rounded-md p-3">
                <h4
                  className="text-xs font-mono font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => onEntitySelect?.(schema.name)}
                >
                  {schema.name}
                </h4>
                {schema.description && <p className="text-[10px] text-muted-foreground mt-0.5">{schema.description}</p>}
                {schema.fields.length > 0 && (
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-1 px-1.5 font-semibold text-muted-foreground">Field</th>
                        <th className="text-left py-1 px-1.5 font-semibold text-muted-foreground">Type</th>
                        <th className="text-left py-1 px-1.5 font-semibold text-muted-foreground">Req</th>
                        <th className="text-left py-1 px-1.5 font-semibold text-muted-foreground">Format</th>
                        <th className="text-left py-1 px-1.5 font-semibold text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schema.fields.map((f, i) => (
                        <tr key={`${f.name}-${i}`} className="border-b border-border/20 last:border-0">
                          <td className="py-1 px-1.5 font-mono">{f.name}</td>
                          <td className="py-1 px-1.5 font-mono text-muted-foreground">{f.type}</td>
                          <td className="py-1 px-1.5">
                            {f.required && <span className="text-[9px] px-1 py-0.5 rounded-sm bg-red-400/10 text-red-600">{f.required}</span>}
                          </td>
                          <td className="py-1 px-1.5 font-mono text-muted-foreground/60">{f.format}</td>
                          <td className="py-1 px-1.5 text-muted-foreground">{f.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auth */}
      {data.auth.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Authentication</h3>
          <div className="space-y-1">
            {data.auth.map((a) => (
              <div key={a.scheme} className="flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold">{a.scheme}</span>
                {a.description && <span className="text-muted-foreground">{a.description}</span>}
                {a.header && <span className="text-[10px] px-1 py-0.5 rounded-sm bg-muted text-muted-foreground font-mono">{a.header}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enums */}
      {data.enums.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Enums</h3>
          <div className="space-y-2">
            {data.enums.map((e) => (
              <div key={e.name} className="border border-border/40 rounded-md p-2.5 text-xs">
                <div className="font-mono font-semibold">{e.name}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {e.values.map((v) => (
                    <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground font-mono">{v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      {data.relationships.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Relationships</h3>
          <div className="space-y-1">
            {data.relationships.map((r, i) => (
              <div key={`rel-${r.source}-${r.target}-${r.relType}-${i}`} className="flex items-center gap-2 text-xs">
                <button className="font-mono hover:text-primary transition-colors" onClick={() => onEntitySelect?.(r.source)}>{r.source}</button>
                <span className="text-muted-foreground">→</span>
                <button className="font-mono hover:text-primary transition-colors" onClick={() => onEntitySelect?.(r.target)}>{r.target}</button>
                {r.relType && <span className="text-[10px] px-1 py-0.5 rounded-sm bg-muted text-muted-foreground">{r.relType}</span>}
                {r.via && <span className="text-muted-foreground/60">{r.via}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paths */}
      {data.paths.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Traversal Paths</h3>
          <div className="space-y-1">
            {data.paths.map((p, i) => (
              <div key={`path-${p.entities.join("-")}-${i}`} className="text-xs">
                <span className="font-mono">{p.entities.join(" → ")}</span>
                {p.via && <span className="text-muted-foreground/60 ml-2">{p.via}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EndpointDetail({ endpoint, data, onEntitySelect }: {
  endpoint: GdlaEndpoint;
  data: GdlaFile;
  onEntitySelect?: (e: string) => void;
}) {
  const methodColor = (m: string) => {
    switch (m) {
      case "GET": case "QUERY": return "text-green-600 bg-green-400/10";
      case "POST": case "MUTATION": return "text-blue-600 bg-blue-400/10";
      case "PUT": case "PATCH": return "text-amber-600 bg-amber-400/10";
      case "DELETE": return "text-red-600 bg-red-400/10";
      case "SUBSCRIPTION": return "text-purple-600 bg-purple-400/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${methodColor(endpoint.method)}`}>
            {endpoint.method}
          </span>
          <h2 className="text-sm font-mono font-semibold">{endpoint.path}</h2>
        </div>
        {endpoint.description && <p className="text-xs text-muted-foreground mt-1">{endpoint.description}</p>}
      </div>

      {endpoint.responses && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Responses</h3>
          <div className="flex flex-wrap gap-1.5">
            {endpoint.responses.split(",").map((r) => {
              const [code, type] = r.split(":");
              return (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted font-mono">
                  <span className="text-muted-foreground">{code}:</span>
                  {type && (
                    <button
                      className="text-foreground hover:text-primary transition-colors ml-0.5"
                      onClick={() => {
                        const cleanType = type.replace(/\[\]$/, "");
                        if (data.schemas.some((s) => s.name === cleanType)) {
                          onEntitySelect?.(cleanType);
                        }
                      }}
                    >
                      {type}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {endpoint.auth && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Authentication</h3>
          <span className="text-xs font-mono">{endpoint.auth}</span>
        </div>
      )}

      {endpoint.params.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Parameters</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Name</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">In</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Type</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Req</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {endpoint.params.map((p, i) => (
                <tr key={`${p.name}-${i}`} className="border-b border-border/20 last:border-0">
                  <td className="py-1.5 px-2 font-mono">{p.name}</td>
                  <td className="py-1.5 px-2">
                    <span className="text-[10px] px-1 py-0.5 rounded-sm bg-muted text-muted-foreground">{p.location}</span>
                  </td>
                  <td className="py-1.5 px-2 font-mono text-muted-foreground">{p.type}</td>
                  <td className="py-1.5 px-2">
                    {p.required && <span className="text-[9px] px-1 py-0.5 rounded-sm bg-red-400/10 text-red-600">{p.required}</span>}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
