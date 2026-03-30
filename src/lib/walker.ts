import fs from "fs/promises";
import path from "path";
import { GDL_EXTENSIONS, type FileEntry, type FileTree, type GdlFormat } from "./types";

const MAX_DEPTH = 50;

export async function walkRepo(rootDir: string): Promise<FileTree> {
  const files: FileEntry[] = [];
  const visitedInodes = new Set<string>();

  try {
    await collectFiles(rootDir, rootDir, files, 0, visitedInodes);
  } catch (error) {
    // Silently return empty for missing directories; surface other errors
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  // Pair enrichment files with skeletons
  const byPath = new Map<string, FileEntry>();
  for (const file of files) {
    byPath.set(file.path, file);
  }
  for (const file of files) {
    if (file.isEnrichment) {
      // Derive skeleton path: dir/name.enrich.ext -> dir/name.ext
      const dir = path.dirname(file.path);
      const ext = path.extname(file.path);
      const skeletonFilename = file.name + ext;
      const skeletonPath = dir === "." ? skeletonFilename : path.join(dir, skeletonFilename);
      const skeleton = byPath.get(skeletonPath);
      if (skeleton) {
        file.skeletonPath = skeleton.path;
        skeleton.enrichmentPath = file.path;
      }
    }
  }

  const byFormat: Record<GdlFormat, FileEntry[]> = {
    gdl: [],
    gdls: [],
    gdld: [],
    gdlm: [],
    gdlc: [],
    gdlu: [],
    gdla: [],
  };

  for (const file of files) {
    byFormat[file.format].push(file);
  }

  return {
    files,
    byFormat,
    stats: {
      totalFiles: files.length,
      byFormat: {
        gdl: byFormat.gdl.length,
        gdls: byFormat.gdls.length,
        gdld: byFormat.gdld.length,
        gdlm: byFormat.gdlm.length,
        gdlc: byFormat.gdlc.length,
        gdlu: byFormat.gdlu.length,
        gdla: byFormat.gdla.length,
      },
    },
  };
}

async function collectFiles(
  dir: string,
  rootDir: string,
  result: FileEntry[],
  depth: number,
  visitedInodes: Set<string>
): Promise<void> {
  if (depth > MAX_DEPTH) return;

  // Track visited directories by inode to prevent symlink cycles
  let dirStat;
  try {
    dirStat = await fs.stat(dir);
  } catch {
    return; // Skip inaccessible directories
  }
  const inodeKey = `${dirStat.dev}:${dirStat.ino}`;
  if (visitedInodes.has(inodeKey)) return;
  visitedInodes.add(inodeKey);

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // Skip unreadable directories
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip common non-project directories
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }
      await collectFiles(fullPath, rootDir, result, depth + 1, visitedInodes);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      const format = GDL_EXTENSIONS[ext];
      if (format) {
        try {
          const stat = await fs.stat(fullPath);
          const nameWithoutExt = path.basename(entry.name, ext);
          const isEnrichment = nameWithoutExt.endsWith(".enrich");
          const name = isEnrichment
            ? nameWithoutExt.substring(0, nameWithoutExt.length - ".enrich".length)
            : nameWithoutExt;
          result.push({
            path: path.relative(rootDir, fullPath),
            absolutePath: fullPath,
            format,
            name,
            size: stat.size,
            isEnrichment: isEnrichment || undefined,
          });
        } catch {
          // Skip files we can't stat (deleted, permission denied)
        }
      }
    }
  }
}
