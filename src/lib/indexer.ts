import fs from "fs/promises";
import { walkRepo } from "./walker";
import { extractEntities, type EntityOccurrence } from "./parsers";
import type { FileEntry } from "./types";

export interface CrossReference {
  entity: string;
  occurrences: EntityOccurrence[];
}

export interface ProjectIndex {
  files: FileEntry[];
  entities: Map<string, CrossReference>;
  stats: {
    fileCount: number;
    entityCount: number;
    crossRefCount: number;
  };
}

export async function buildIndex(rootDir: string): Promise<ProjectIndex> {
  const tree = await walkRepo(rootDir);
  const entityMap = new Map<string, CrossReference>();

  for (const file of tree.files) {
    try {
      const content = await fs.readFile(file.absolutePath, "utf-8");
      const occurrences = extractEntities(content, file.format, file.path);

      for (const occ of occurrences) {
        let crossRef = entityMap.get(occ.entity);
        if (!crossRef) {
          crossRef = { entity: occ.entity, occurrences: [] };
          entityMap.set(occ.entity, crossRef);
        }
        crossRef.occurrences.push(occ);
      }
    } catch {
      // Skip unreadable files (permission denied, deleted after walk, etc.)
    }
  }

  // Count entities that appear in 2+ distinct formats
  let crossRefCount = 0;
  for (const [, crossRef] of entityMap) {
    const formats = new Set(crossRef.occurrences.map((o) => o.format));
    if (formats.size >= 2) crossRefCount++;
  }

  return {
    files: tree.files,
    entities: entityMap,
    stats: {
      fileCount: tree.files.length,
      entityCount: entityMap.size,
      crossRefCount,
    },
  };
}
