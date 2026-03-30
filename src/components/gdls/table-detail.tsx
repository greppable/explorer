"use client";

import { useMemo } from "react";
import type {
  GdlsTable,
  GdlsRelationship,
  GdlsEnum,
} from "@/lib/parsers/gdls-parser";

interface TableDetailProps {
  table: GdlsTable;
  relationships: GdlsRelationship[];
  enums: GdlsEnum[];
  onTableNavigate: (tableName: string) => void;
  onEntitySelect?: (entity: string) => void;
}

export function TableDetail({
  table,
  relationships,
  enums,
  onTableNavigate,
  onEntitySelect,
}: TableDetailProps) {
  // Outbound FKs: this table references others
  const outboundFks = useMemo(
    () => relationships.filter((r) => r.sourceTable === table.name && r.relType === "fk"),
    [relationships, table.name]
  );

  // Inbound FKs: other tables reference this one
  const inboundFks = useMemo(
    () => relationships.filter((r) => r.targetTable === table.name && r.relType === "fk"),
    [relationships, table.name]
  );

  // Equivalents: cross-system mappings involving this table
  const equivalents = useMemo(
    () => {
      const matchesTable = (t: string, name: string) =>
        t === name || t.endsWith(`:${name}`);
      return relationships.filter(
        (r) =>
          r.relType === "equivalent" &&
          (matchesTable(r.sourceTable, table.name) || matchesTable(r.targetTable, table.name))
      );
    },
    [relationships, table.name]
  );

  // Enums: constrained values for this table's columns
  const tableEnums = useMemo(
    () => enums.filter((e) => e.table === table.name),
    [enums, table.name]
  );

  // Feeds/derives: data flow relationships
  const dataFlows = useMemo(
    () =>
      relationships.filter(
        (r) =>
          (r.relType === "feeds" || r.relType === "derives") &&
          (r.sourceTable === table.name || r.targetTable === table.name)
      ),
    [relationships, table.name]
  );

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div>
          <h2
            className="text-lg font-mono font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => onEntitySelect?.(table.name)}
          >
            {table.name}
          </h2>
          {table.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{table.description}</p>
          )}
        </div>

        {/* Columns table */}
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Columns
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Name</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Type</th>
                <th className="text-center py-1.5 px-2 font-semibold text-muted-foreground w-8">N?</th>
                <th className="text-center py-1.5 px-2 font-semibold text-muted-foreground w-8">Key</th>
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name} className="border-b border-border/20 last:border-0">
                  <td className="py-1.5 px-2 font-mono text-foreground">{col.name}</td>
                  <td className="py-1.5 px-2 font-mono text-muted-foreground">{col.type}</td>
                  <td className="py-1.5 px-2 text-center text-muted-foreground">{col.nullable === "Y" ? "Y" : ""}</td>
                  <td className="py-1.5 px-2 text-center">
                    {col.key === "PK" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-mono font-semibold">PK</span>
                    )}
                    {col.key === "FK" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-border/50 text-muted-foreground font-mono">FK</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground">{col.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Enums */}
        {tableEnums.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Constrained Values
            </h3>
            <div className="space-y-2">
              {tableEnums.map((e) => (
                <div key={e.column} className="text-xs">
                  <span className="font-mono font-semibold">{e.column}</span>
                  {e.description && (
                    <span className="text-muted-foreground ml-2">&mdash; {e.description}</span>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {e.values.map((v) => (
                      <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border border-border/50 text-muted-foreground">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outbound FKs */}
        {outboundFks.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              References (outbound)
            </h3>
            <div className="space-y-1">
              {outboundFks.map((fk, i) => (
                <div key={`outfk-${fk.sourceColumn}-${fk.targetTable}-${i}`} className="text-xs">
                  <span className="font-mono text-muted-foreground">{fk.sourceColumn}</span>
                  <span className="mx-1">&rarr;</span>
                  <button
                    onClick={() => onTableNavigate(fk.targetTable)}
                    className="font-mono text-primary hover:underline"
                  >
                    {fk.targetTable}
                  </button>
                  <span className="text-muted-foreground">.{fk.targetColumn}</span>
                  {fk.description && (
                    <span className="text-muted-foreground ml-2">&mdash; {fk.description}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inbound FKs */}
        {inboundFks.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Referenced by (inbound)
            </h3>
            <div className="space-y-1">
              {inboundFks.map((fk, i) => (
                <div key={`infk-${fk.sourceTable}-${fk.sourceColumn}-${i}`} className="text-xs">
                  <span className="mx-1">&larr;</span>
                  <button
                    onClick={() => onTableNavigate(fk.sourceTable)}
                    className="font-mono text-primary hover:underline"
                  >
                    {fk.sourceTable}
                  </button>
                  <span className="text-muted-foreground">.{fk.sourceColumn}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equivalents */}
        {equivalents.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Equivalents
            </h3>
            <div className="space-y-1">
              {equivalents.map((eq, i) => (
                <div key={`eq-${eq.sourceTable}-${eq.targetTable}-${i}`} className="text-xs font-mono text-muted-foreground">
                  {eq.sourceTable} &harr; {eq.targetTable}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data flows */}
        {dataFlows.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Data Flows
            </h3>
            <div className="space-y-1">
              {dataFlows.map((df, i) => (
                <div key={`df-${df.sourceTable}-${df.targetTable}-${i}`} className="text-xs">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-border/50 text-muted-foreground mr-1">{df.relType}</span>
                  <button
                    onClick={() => onTableNavigate(
                      df.sourceTable === table.name ? df.targetTable : df.sourceTable
                    )}
                    className="font-mono text-primary hover:underline"
                  >
                    {df.sourceTable === table.name ? df.targetTable : df.sourceTable}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
