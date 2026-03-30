import path from "path";

/**
 * Given a skeleton path, return the expected enrichment overlay path.
 * e.g., "parsers.gdlc" → "parsers.enrich.gdlc"
 * Works for any GDL extension: .gdlc, .gdls, .gdlu, etc.
 */
export function resolveOverlayPath(skeletonPath: string): string {
  const ext = path.extname(skeletonPath);
  const base = skeletonPath.substring(0, skeletonPath.length - ext.length);
  return `${base}.enrich${ext}`;
}
