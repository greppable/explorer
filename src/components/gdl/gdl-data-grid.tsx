"use client";

import { useEffect, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { FileEntry } from "@/lib/types";
import type { GdlFile, GdlRecord } from "@/lib/parsers/gdl-parser";
import { getErrorMessage } from "@/lib/utils";

interface GdlDataGridProps {
  file: FileEntry;
  onEntitySelect?: (entity: string) => void;
}

export function GdlDataGrid({ file, onEntitySelect }: GdlDataGridProps) {
  const [data, setData] = useState<GdlFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setSelectedType("");
    setFilter("");
    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/gdl/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((parsed: GdlFile) => {
        if (!cancelled) {
          setData(parsed);
          if (parsed.recordTypes.length > 0) {
            setSelectedType(parsed.recordTypes[0]);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(getErrorMessage(error));
      });
    return () => { cancelled = true; };
  }, [file.path]);

  // Filter records by selected type
  const records = useMemo(() => {
    if (!data || !selectedType) return [];
    return data.records.filter((r) => r.type === selectedType);
  }, [data, selectedType]);

  // Discover columns from records of this type
  const fieldNames = useMemo(() => {
    const fieldSet = new Set<string>();
    for (const record of records) {
      for (const key of Object.keys(record.fields)) {
        fieldSet.add(key);
      }
    }
    return [...fieldSet];
  }, [records]);

  // Build table columns
  const columns = useMemo<ColumnDef<GdlRecord>[]>(() => {
    return fieldNames.map((field) => ({
      accessorFn: (row: GdlRecord) => row.fields[field] ?? "",
      id: field,
      header: field,
      cell: ({ getValue }: { getValue: () => unknown }) => {
        const value = getValue() as string;
        // Make id fields clickable
        if (field === "id" && value && onEntitySelect) {
          return (
            <button
              onClick={() => onEntitySelect(value)}
              className="text-primary hover:underline font-mono"
            >
              {value}
            </button>
          );
        }
        return <span className="font-mono text-foreground/80">{value}</span>;
      },
    }));
  }, [fieldNames, onEntitySelect]);

  // Apply text filter
  const filteredRecords = useMemo(() => {
    if (!filter) return records;
    // Support field:value syntax
    const colonIdx = filter.indexOf(":");
    if (colonIdx !== -1) {
      const filterField = filter.substring(0, colonIdx);
      const filterValue = filter.substring(colonIdx + 1).toLowerCase();
      return records.filter((r) =>
        (r.fields[filterField] ?? "").toLowerCase().includes(filterValue)
      );
    }
    // General text search across all fields
    const lower = filter.toLowerCase();
    return records.filter((r) =>
      Object.values(r.fields).some((v) => v.toLowerCase().includes(lower))
    );
  }, [records, filter]);

  const table = useReactTable({
    data: filteredRecords,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (error) {
    return <div className="p-4 text-red-500 text-sm">{error}</div>;
  }
  if (!data) {
    return <div className="p-4 text-sm text-muted-foreground">Loading data...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
        {data.recordTypes.length > 1 ? (
          <select
            className="text-xs border border-border/50 rounded-md px-2 py-1 bg-background font-mono text-foreground"
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setSorting([]); }}
          >
            {data.recordTypes.map((t) => (
              <option key={t} value={t}>@{t}</option>
            ))}
          </select>
        ) : (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">@{selectedType}</span>
        )}
        <input
          placeholder="Filter... (field:value or text)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-7 text-xs max-w-xs px-2.5 rounded-md border border-border/50 bg-background font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""} · {fieldNames.length} field{fieldNames.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background border-b border-border/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-muted/50 select-none text-muted-foreground uppercase tracking-wider text-[10px]"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                    {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border/30 hover:bg-primary/5 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
