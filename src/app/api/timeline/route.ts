import { NextResponse } from "next/server";
import { buildTimeline } from "@/lib/timeline/aggregator";
import { GDL_ROOT } from "@/lib/config";

export async function GET() {
  try {
    const payload = await buildTimeline(GDL_ROOT);
    return NextResponse.json(payload);
  } catch (err: unknown) {
    console.error("Failed to build timeline:", err);
    return NextResponse.json(
      { error: "Failed to build timeline" },
      { status: 500 },
    );
  }
}
