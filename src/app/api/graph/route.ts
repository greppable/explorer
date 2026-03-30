import { NextResponse } from "next/server";
import { buildIndex, type CrossReference } from "@/lib/indexer";
import { buildGraphFromIndex } from "@/lib/graph/graph-builder";
import { GDL_ROOT } from "@/lib/config";

export async function GET() {
  try {
    const index = await buildIndex(GDL_ROOT);

    // Convert Map to plain object for the graph builder
    const entities: Record<string, CrossReference> = {};
    for (const [key, value] of index.entities) {
      entities[key] = value;
    }

    const graph = buildGraphFromIndex(index.files, entities);

    return NextResponse.json(graph);
  } catch (err: unknown) {
    console.error("Failed to build graph:", err);
    return NextResponse.json(
      { error: "Failed to build graph" },
      { status: 500 }
    );
  }
}
