import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { resolveSafePath } from "@/lib/config";
import { parseGdlu } from "@/lib/parsers/gdlu-parser";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relativePath = segments.join("/");
  const absolutePath = resolveSafePath(relativePath);

  if (!absolutePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let content: string;
  try {
    content = await fs.readFile(absolutePath, "utf-8");
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const parsed = parseGdlu(content);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Failed to parse GDLU file" }, { status: 422 });
  }
}
