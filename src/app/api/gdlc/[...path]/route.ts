import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath } from "@/lib/config";
import { parseGdlc } from "@/lib/parsers/gdlc-parser";
import { resolveOverlayPath } from "@/lib/merge/resolve-overlay";
import { mergeGdlc } from "@/lib/merge/gdlc-merge";

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
    const parsed = parseGdlc(content);

    // If viewing an enrichment file directly, return standalone (no merge)
    if (path.basename(relativePath).includes(".enrich.")) {
      return NextResponse.json(parsed);
    }

    // Auto-discover enrichment overlay
    const overlayRelativePath = resolveOverlayPath(relativePath);
    const overlayAbsolutePath = resolveSafePath(overlayRelativePath);

    if (overlayAbsolutePath) {
      try {
        const overlayContent = await fs.readFile(overlayAbsolutePath, "utf-8");
        const overlayParsed = parseGdlc(overlayContent);
        const { merged, provenance } = mergeGdlc(parsed, overlayParsed, relativePath, overlayRelativePath);
        return NextResponse.json({ ...merged, provenance });
      } catch (error: unknown) {
        // Only swallow file-not-found; re-throw parse/merge errors so they surface
        if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
          // Overlay file doesn't exist — return skeleton unchanged
        } else {
          console.error("Enrichment overlay merge failed:", error);
          // Return skeleton with a warning so the UI can surface the issue
          return NextResponse.json({ ...parsed, mergeWarning: "Enrichment overlay found but failed to parse" });
        }
      }
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Failed to parse GDLC file" }, { status: 422 });
  }
}
