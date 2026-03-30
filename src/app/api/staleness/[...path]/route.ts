import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import crypto from "crypto";
import { resolveSafePath } from "@/lib/config";
import { parseVersionHeader } from "@/lib/parsers/shared";

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

  const version = parseVersionHeader(content);
  if (!version || !version.sourceHash || !version.sourcePath) {
    return NextResponse.json({ fresh: null });
  }

  // Guard against trivially short or non-hex hashes
  if (version.sourceHash.length < 7 || !/^[0-9a-f]+$/i.test(version.sourceHash)) {
    return NextResponse.json({ fresh: null });
  }

  const sourceAbsPath = resolveSafePath(version.sourcePath);
  if (!sourceAbsPath) {
    return NextResponse.json({ fresh: null });
  }

  let sourceContent: string;
  try {
    sourceContent = await fs.readFile(sourceAbsPath, "utf-8");
  } catch {
    return NextResponse.json({ fresh: null });
  }

  const fullHash = crypto.createHash("sha256").update(sourceContent).digest("hex");
  const currentHash = fullHash.substring(0, version.sourceHash.length);

  return NextResponse.json({
    fresh: currentHash === version.sourceHash.toLowerCase(),
    generatedDate: version.generated,
    sourceHash: version.sourceHash,
    currentHash,
  });
}
