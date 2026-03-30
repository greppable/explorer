import { NextResponse } from "next/server";
import { buildIndex, type CrossReference } from "@/lib/indexer";
import { GDL_ROOT } from "@/lib/config";

export async function GET() {
  try {
    const index = await buildIndex(GDL_ROOT);

    // Convert Map to plain object for JSON serialization
    const entities: Record<string, CrossReference> = {};
    for (const [key, value] of index.entities) {
      entities[key] = value;
    }

    return NextResponse.json({
      files: index.files,
      entities,
      stats: index.stats,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to build index" },
      { status: 500 }
    );
  }
}
