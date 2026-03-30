"use client";

import { useMemo } from "react";
import { FlowchartViewer } from "@/components/gdld/flowchart-viewer";
import type { GdldModel } from "@/lib/parsers/gdld-parser";
import type { GdlsFile } from "@/lib/parsers/gdls-parser";

interface ErDiagramProps {
  schema: GdlsFile;
  onEntitySelect?: (entity: string) => void;
}

export function ErDiagram({ schema, onEntitySelect }: ErDiagramProps) {
  const model = useMemo<GdldModel>(() => gdlsToGdldModel(schema), [schema]);

  return <FlowchartViewer model={model} onNodeSelect={onEntitySelect} />;
}

function gdlsToGdldModel(schema: GdlsFile): GdldModel {
  const tableNames = new Set(schema.tables.map((t) => t.name));
  return {
    diagram: {
      id: "er-diagram",
      type: "flow",
      purpose: "ER diagram (auto-generated from GDLS schema)",
      direction: "LR",
    },
    nodes: schema.tables.map((t) => ({
      id: t.name,
      label: t.name,
      shape: "box" as const,
      group: t.domain || null,
      status: null,
      tags: [],
      line: t.line,
    })),
    edges: schema.relationships
      .filter((r) => r.relType === "fk" || r.relType === "feeds" || r.relType === "derives")
      .filter((r) => !r.sourceTable.includes(":") && !r.targetTable.includes(":"))
      .filter((r) => tableNames.has(r.sourceTable) && tableNames.has(r.targetTable))
      .map((r) => ({
        from: r.sourceTable,
        to: r.targetTable,
        label: `${r.sourceColumn} (${r.relType})`,
        style: (r.relType === "fk" ? "solid" : "dashed") as "solid" | "dashed",
        status: null,
        bidirectional: false,
        line: r.line,
      })),
    groups: schema.domains.map((d) => ({
      id: d.name,
      label: d.name.charAt(0).toUpperCase() + d.name.slice(1),
      parent: null,
      line: d.line,
    })),
    participants: [],
    sequenceElements: [],
    context: {
      useWhen: [], useNot: [], components: [], config: [],
      gotchas: [], recovery: [], entries: [], decisions: [],
      notes: [], patterns: [],
    },
    scenarios: [],
    views: [],
    overrides: [],
    excludes: [],
    includes: [],
    deployEnvs: [],
    deployNodes: [],
    deployInstances: [],
    infraNodes: [],
  };
}
