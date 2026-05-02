"use client";

import { useMemo } from "react";
import type { GdlsDomain, GdlsTable } from "@/lib/parsers/gdls-parser";

interface SchemaTreeProps {
  domains: GdlsDomain[];
  tables: GdlsTable[];
  selectedTable: string | null;
  onTableSelect: (tableName: string) => void;
  crossLayerEntities?: Set<string>;
}

export function SchemaTree({
  domains,
  tables,
  selectedTable,
  onTableSelect,
  crossLayerEntities,
}: SchemaTreeProps) {
  // Group tables by domain
  const tablesByDomain = useMemo(() => {
    const map = new Map<string, GdlsTable[]>();
    for (const table of tables) {
      const domain = table.domain || "(ungrouped)";
      if (!map.has(domain)) {
        map.set(domain, []);
      }
      map.get(domain)!.push(table);
    }
    return map;
  }, [tables]);

  return (
    <div className="h-full overflow-auto">
      <div className="p-2 space-y-3">
        {domains.map((domain) => {
          const domainTables = tablesByDomain.get(domain.name) || [];
          return (
            <div key={domain.name}>
              <div className="px-1 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {domain.name}
                </span>
              </div>
              <div className="space-y-0.5">
                {domainTables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => onTableSelect(table.name)}
                    title={table.name}
                    className={`w-full text-left px-2.5 py-1 rounded-md text-xs font-mono transition-colors flex items-center gap-1.5 break-all ${
                      selectedTable === table.name
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-foreground/70 hover:bg-muted/50"
                    }`}
                  >
                    {table.name}
                    {crossLayerEntities?.has(table.name) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" title="Cross-layer refs" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
