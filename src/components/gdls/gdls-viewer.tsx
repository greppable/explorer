"use client";

import { useEffect, useState } from "react";
import { SchemaTree } from "./schema-tree";
import { TableDetail } from "./table-detail";
import { ErDiagram } from "./er-diagram";
import type { FileEntry } from "@/lib/types";
import type { GdlsFile } from "@/lib/parsers/gdls-parser";
import { StalenessIndicator } from "@/components/staleness-indicator";
import { getErrorMessage } from "@/lib/utils";

interface GdlsViewerProps {
  file: FileEntry;
  onEntitySelect?: (entity: string) => void;
}

export function GdlsViewer({ file, onEntitySelect }: GdlsViewerProps) {
  const [schema, setSchema] = useState<GdlsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "er">("tree");

  useEffect(() => {
    let cancelled = false;
    setSchema(null);
    setError(null);
    setSelectedTable(null);
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/gdls/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load schema");
        return res.json();
      })
      .then((parsed: GdlsFile) => {
        if (!cancelled) {
          setSchema(parsed);
          if (parsed.tables.length > 0) {
            setSelectedTable(parsed.tables[0].name);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(getErrorMessage(error));
      });
    return () => { cancelled = true; };
  }, [file.path]);

  if (error) return <div className="p-4 text-red-500 text-sm">{error}</div>;
  if (!schema) return <div className="p-4 text-sm text-muted-foreground">Loading schema...</div>;

  const isIndexFile = schema.domainRefs.length > 0 || schema.tableLists.length > 0;
  const selectedTableData = schema.tables.find((t) => t.name === selectedTable);

  // Build table count map from @TABLES records for index display
  const tableCountMap = new Map<string, number>();
  for (const tl of schema.tableLists) {
    tableCountMap.set(tl.domain, tl.tables.length);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2 text-xs">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">GDLS</span>
        {schema.version && (
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {schema.version.source}{schema.version.generated ? ` · ${schema.version.generated}` : ""}
          </span>
        )}
        <StalenessIndicator filePath={file.path} version={schema.version} />
        {isIndexFile ? (
          <span className="text-muted-foreground font-mono text-[10px]">
            {schema.meta.length > 0 && `${schema.meta[0].tier} · `}
            {schema.domainRefs.length} domain{schema.domainRefs.length !== 1 ? "s" : ""}
            {schema.tableLists.length > 0 && ` · ${schema.tableLists.reduce((sum, tl) => sum + tl.tables.length, 0)} tables`}
          </span>
        ) : (
          <span className="text-muted-foreground font-mono text-[10px]">
            {schema.domains.length} domain{schema.domains.length !== 1 ? "s" : ""} · {schema.tables.length} table{schema.tables.length !== 1 ? "s" : ""} · {schema.relationships.length} rel{schema.relationships.length !== 1 ? "s" : ""}
            {schema.enums.length > 0 ? ` · ${schema.enums.length} enum${schema.enums.length !== 1 ? "s" : ""}` : ""}
          </span>
        )}
        {!isIndexFile && (
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setViewMode("tree")}
              className={`px-2 py-0.5 rounded text-xs ${viewMode === "tree" ? "bg-accent" : "hover:bg-accent"}`}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode("er")}
              className={`px-2 py-0.5 rounded text-xs ${viewMode === "er" ? "bg-accent" : "hover:bg-accent"}`}
            >
              ER Diagram
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isIndexFile ? (
          <div className="p-4 space-y-3">
            {schema.meta.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {schema.meta[0].description}
                {schema.meta[0].tableCount > 0 && ` — ${schema.meta[0].tableCount} tables total`}
              </div>
            )}
            {schema.domainRefs.map((ref) => {
              const tableList = schema.tableLists.find((tl) => tl.domain === ref.name);
              return (
                <div key={ref.name} className="border border-border/40 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => onEntitySelect?.(ref.name)}
                      className="font-mono font-semibold text-sm hover:text-primary transition-colors"
                    >
                      {ref.name}
                    </button>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-border/50 text-muted-foreground">
                      {tableCountMap.get(ref.name) || ref.tableCount} tables
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">{ref.description}</div>
                  <div className="text-xs text-muted-foreground font-mono">{ref.path}</div>
                  {tableList && tableList.tables.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {tableList.tables.map((table) => (
                        <button
                          key={table}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground hover:bg-accent cursor-pointer"
                          onClick={() => onEntitySelect?.(table)}
                        >
                          {table}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : viewMode === "er" ? (
          <ErDiagram schema={schema} onEntitySelect={onEntitySelect} />
        ) : (
          <div className="flex h-full">
            {/* Schema tree (left) */}
            <div className="w-44 border-r border-border/50 flex-shrink-0">
              <SchemaTree
                domains={schema.domains}
                tables={schema.tables}
                selectedTable={selectedTable}
                onTableSelect={setSelectedTable}
              />
            </div>
            {/* Table detail (right) */}
            <div className="flex-1 min-w-0">
              {selectedTableData ? (
                <TableDetail
                  table={selectedTableData}
                  relationships={schema.relationships}
                  enums={schema.enums}
                  onTableNavigate={setSelectedTable}
                  onEntitySelect={onEntitySelect}
                />
              ) : (
                <div className="p-4 text-sm text-muted-foreground">
                  Select a table to view
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
