import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { resolveSafePath } from "@/lib/config";
import { parseGdld } from "@/lib/parsers/gdld-parser";

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
    const model = parseGdld(content);
    return NextResponse.json(model);
  } catch {
    return NextResponse.json({ error: "Failed to parse GDLD file" }, { status: 422 });
  }
}
