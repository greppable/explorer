"use client";

import { useEffect, useState, useMemo } from "react";
import type { FileEntry } from "@/lib/types";
import type { GdlcFile, GdlcModule } from "@/lib/parsers/gdlc-parser";
import type { MergeProvenance } from "@/lib/merge/types";
import { StalenessIndicator } from "@/components/staleness-indicator";
import { getErrorMessage } from "@/lib/utils";

interface GdlcFileWithProvenance extends GdlcFile {
  provenance?: MergeProvenance;
  mergeWarning?: string;
}

interface GdlcViewerProps {
  file: FileEntry;
  onEntitySelect?: (entity: string) => void;
}

export function GdlcViewer({ file, onEntitySelect }: GdlcViewerProps) {
  const [data, setData] = useState<GdlcFileWithProvenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setSelectedModule(null);
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/gdlc/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((parsed: GdlcFileWithProvenance) => {
        if (!cancelled) {
          setData(parsed);
          if (parsed.modules.length > 0) {
            setSelectedModule(parsed.modules[0].name);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(getErrorMessage(error));
      });
    return () => { cancelled = true; };
  }, [file.path]);

  if (error) return <div className="p-4 text-red-500 text-sm">{error}</div>;
  if (!data) return <div className="p-4 text-sm text-muted-foreground">Loading code map...</div>;

  const moduleData = data.modules.find((m) => m.name === selectedModule);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2 text-xs">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">GDLC</span>
        {data.version && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{data.version.source}</span>
        )}
        {data.provenance && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-green-400/10 text-green-600">skeleton + enrichment</span>
        )}
        {data.mergeWarning && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-400/10 text-amber-600" title={data.mergeWarning}>
            overlay error
          </span>
        )}
        {data.version?.generated && (
          <span className="text-[10px] font-mono text-muted-foreground/50">{data.version.generated}</span>
        )}
        <StalenessIndicator filePath={file.path} version={data.version} />
        <span className="text-muted-foreground font-mono text-[10px]">
          {data.packages.length} pkg{data.packages.length !== 1 ? "s" : ""} · {data.modules.length} module{data.modules.length !== 1 ? "s" : ""} · {data.relationships.length} rel{data.relationships.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-44 border-r border-border/50 flex-shrink-0 overflow-auto">
          <div className="p-2 space-y-3">
            {data.packages.map((pkg) => (
              <div key={pkg.name}>
                <div className="px-1 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{pkg.name.split("/").pop()}</span>
                </div>
                <div className="space-y-0.5">
                  {data.modules.filter((m) => m.package === pkg.name).map((mod) => (
                    <button
                      key={mod.name}
                      onClick={() => setSelectedModule(mod.name)}
                      className={`w-full text-left px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                        selectedModule === mod.name
                          ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                          : "text-foreground/70 hover:bg-muted/50"
                      }`}
                    >
                      {mod.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-auto">
          {moduleData ? (
            <ModuleDetail module={moduleData} data={data} onEntitySelect={onEntitySelect} onModuleNavigate={setSelectedModule} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Select a module</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleDetail({ module, data, onEntitySelect, onModuleNavigate }: {
  module: GdlcModule;
  data: GdlcFile;
  onEntitySelect?: (e: string) => void;
  onModuleNavigate: (name: string) => void;
}) {
  const outRels = useMemo(() =>
    data.relationships.filter((r) => r.source === module.name || r.source.startsWith(module.name + ".")),
    [data.relationships, module.name]
  );
  const inRels = useMemo(() =>
    data.relationships.filter((r) => r.target === module.name || r.target.startsWith(module.name + ".")),
    [data.relationships, module.name]
  );
  const moduleEnums = useMemo(() =>
    data.enums.filter((e) => e.module === module.name),
    [data.enums, module.name]
  );

  const visibilityColor = (v: string) => v === "public" ? "text-primary" : "text-muted-foreground/60";

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2
          className="text-base font-mono font-semibold cursor-pointer hover:text-primary transition-colors"
          onClick={() => onEntitySelect?.(module.name)}
        >
          {module.name}
        </h2>
        {module.description && <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>}
        <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">package: {module.package}</p>
      </div>

      {module.members.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Members</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Name</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Kind</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Vis</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Return</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {module.members.map((m, i) => (
                <tr key={`${m.name}-${i}`} className="border-b border-border/20 last:border-0">
                  <td className="py-1.5 px-2 font-mono text-foreground">{m.name}</td>
                  <td className="py-1.5 px-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{m.kind}</span>
                  </td>
                  <td className={`py-1.5 px-2 font-mono text-[10px] ${visibilityColor(m.visibility)}`}>{m.visibility}</td>
                  <td className="py-1.5 px-2 font-mono text-muted-foreground">{m.returnType}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {moduleEnums.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Enums</h3>
          <div className="space-y-2">
            {moduleEnums.map((e) => (
              <div key={`${e.module}.${e.member}`} className="border border-border/40 rounded-md p-2.5 text-xs">
                <div className="font-mono font-semibold text-foreground">{e.member}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {e.values.map((v) => (
                    <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground font-mono">{v}</span>
                  ))}
                </div>
                {e.description && <div className="text-muted-foreground mt-1">{e.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {outRels.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dependencies</h3>
          <div className="space-y-1">
            {outRels.map((r, i) => (
              <div key={`dep-${r.source}-${r.target}-${i}`} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">→</span>
                <button
                  className="font-mono text-foreground hover:text-primary transition-colors"
                  onClick={() => {
                    const targetModule = r.target.split(".")[0];
                    if (data.modules.some((m) => m.name === targetModule)) {
                      onModuleNavigate(targetModule);
                    }
                    onEntitySelect?.(r.target);
                  }}
                >
                  {r.target}
                </button>
                {r.relType && <span className="text-[10px] px-1 py-0.5 rounded-sm bg-muted text-muted-foreground">{r.relType}</span>}
                {r.description && <span className="text-muted-foreground/60">{r.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {inRels.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Used By</h3>
          <div className="space-y-1">
            {inRels.map((r, i) => (
              <div key={`usedby-${r.source}-${r.target}-${i}`} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">←</span>
                <button
                  className="font-mono text-foreground hover:text-primary transition-colors"
                  onClick={() => {
                    const sourceModule = r.source.split(".")[0];
                    if (data.modules.some((m) => m.name === sourceModule)) {
                      onModuleNavigate(sourceModule);
                    }
                    onEntitySelect?.(r.source);
                  }}
                >
                  {r.source}
                </button>
                {r.relType && <span className="text-[10px] px-1 py-0.5 rounded-sm bg-muted text-muted-foreground">{r.relType}</span>}
                {r.description && <span className="text-muted-foreground/60">{r.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
