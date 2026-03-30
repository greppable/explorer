export type GdlFormat = "gdl" | "gdls" | "gdld" | "gdlm" | "gdlc" | "gdlu" | "gdla";

export const GDL_EXTENSIONS: Record<string, GdlFormat> = {
  ".gdl": "gdl",
  ".gdls": "gdls",
  ".gdld": "gdld",
  ".gdlm": "gdlm",
  ".gdlc": "gdlc",
  ".gdlu": "gdlu",
  ".gdla": "gdla",
};

export interface VersionHeader {
  spec: string;        // "gdlc", "gdls", etc.
  version: string;     // "0.1.0"
  generated: string;   // ISO date
  source: string;      // "tree-sitter", "agent", "db-introspect", "manual"
  sourceHash?: string; // truncated SHA-256
  sourcePath?: string; // path to source file (for staleness comparison)
}

export interface FileEntry {
  path: string;         // relative to repo root
  absolutePath: string;
  format: GdlFormat;
  name: string;         // filename without extension
  size: number;         // bytes
  isEnrichment?: boolean;        // true for .enrich.* files
  skeletonPath?: string;         // for enrichment files: path to skeleton
  enrichmentPath?: string;       // for skeleton files: path to enrichment overlay
}

export interface FileTree {
  files: FileEntry[];
  byFormat: Record<GdlFormat, FileEntry[]>;
  stats: {
    totalFiles: number;
    byFormat: Record<GdlFormat, number>;
  };
}
