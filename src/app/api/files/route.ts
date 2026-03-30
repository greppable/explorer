import { NextResponse } from "next/server";
import { walkRepo } from "@/lib/walker";
import { GDL_ROOT, PROJECT_NAME } from "@/lib/config";

export async function GET() {
  try {
    const tree = await walkRepo(GDL_ROOT);
    return NextResponse.json({ ...tree, projectName: PROJECT_NAME });
  } catch {
    return NextResponse.json(
      { error: "Failed to walk repository" },
      { status: 500 }
    );
  }
}
