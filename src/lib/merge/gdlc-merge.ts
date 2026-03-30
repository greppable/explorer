import type { GdlcFile } from "../parsers/gdlc-parser";
import type { MergeResult, MergeProvenance, OrphanEntry } from "./types";

/**
 * Merge a skeleton GdlcFile with an enrichment overlay GdlcFile.
 * Follows the same semantics as scripts/gdlc-merge.sh:
 *
 * 1. Match packages by name → fill empty descriptions
 * 2. Match modules by name → fill empty descriptions
 * 3. Match members by name within same-named modules → fill empty descriptions
 * 4. Append overlay-only @PATH and @R records (not already in skeleton)
 * 5. Ignore overlay @E records (enums are deterministic, skeleton-only)
 * 6. Ignore overlay member lines with no skeleton match
 * 7. Detect orphaned @T modules in overlay → add to orphans
 *
 * Key rule: skeleton wins for non-empty fields.
 */
export function mergeGdlc(
  skeleton: GdlcFile,
  overlay: GdlcFile,
  skeletonPath: string,
  overlayPath: string
): MergeResult<GdlcFile> {
  let fillCount = 0;
  let appendedRecords = 0;
  const orphans: OrphanEntry[] = [];

  // Deep clone skeleton to avoid mutation
  const merged: GdlcFile = {
    packages: skeleton.packages.map((p) => ({ ...p })),
    modules: skeleton.modules.map((m) => ({
      ...m,
      members: m.members.map((mem) => ({ ...mem })),
    })),
    relationships: [...skeleton.relationships.map((r) => ({ ...r }))],
    paths: [...skeleton.paths.map((p) => ({ ...p }))],
    enums: [...skeleton.enums.map((e) => ({ ...e }))],
    version: skeleton.version,
  };

  // Build lookup maps from overlay
  const overlayPackageDescs = new Map<string, string>();
  for (const pkg of overlay.packages) {
    if (pkg.description) overlayPackageDescs.set(pkg.name, pkg.description);
  }

  const overlayModuleDescs = new Map<string, string>();
  const overlayModuleLines = new Map<string, number>();
  for (const mod of overlay.modules) {
    if (mod.description) overlayModuleDescs.set(mod.name, mod.description);
    overlayModuleLines.set(mod.name, mod.line);
  }

  // Build overlay member lookup: moduleName -> { memberName -> description }
  const overlayMemberDescs = new Map<string, Map<string, string>>();
  for (const mod of overlay.modules) {
    const memberMap = new Map<string, string>();
    for (const mem of mod.members) {
      if (mem.description) memberMap.set(mem.name, mem.description);
    }
    if (memberMap.size > 0) overlayMemberDescs.set(mod.name, memberMap);
  }

  // 1. Fill empty package descriptions
  for (const pkg of merged.packages) {
    if (!pkg.description) {
      const overlayDesc = overlayPackageDescs.get(pkg.name);
      if (overlayDesc) {
        pkg.description = overlayDesc;
        fillCount++;
      }
    }
  }

  // 2. Fill empty module descriptions
  const skeletonModuleNames = new Set(merged.modules.map((m) => m.name));
  for (const mod of merged.modules) {
    if (!mod.description) {
      const overlayDesc = overlayModuleDescs.get(mod.name);
      if (overlayDesc) {
        mod.description = overlayDesc;
        fillCount++;
      }
    }

    // 3. Fill empty member descriptions
    const memberDescs = overlayMemberDescs.get(mod.name);
    if (memberDescs) {
      for (const mem of mod.members) {
        if (!mem.description) {
          const overlayDesc = memberDescs.get(mem.name);
          if (overlayDesc) {
            mem.description = overlayDesc;
            fillCount++;
          }
        }
      }
    }
  }

  // 4. Append overlay-only @R records (not already in skeleton)
  const existingRelKeys = new Set(
    skeleton.relationships.map((r) => `${r.source}->${r.target}|${r.relType}`)
  );
  for (const rel of overlay.relationships) {
    const key = `${rel.source}->${rel.target}|${rel.relType}`;
    if (!existingRelKeys.has(key)) {
      merged.relationships.push({ ...rel });
      appendedRecords++;
    }
  }

  // 4. Append overlay-only @PATH records (not already in skeleton)
  const existingPathKeys = new Set(
    skeleton.paths.map((p) => p.entities.join("->"))
  );
  for (const pathRec of overlay.paths) {
    const key = pathRec.entities.join("->");
    if (!existingPathKeys.has(key)) {
      merged.paths.push({ ...pathRec });
      appendedRecords++;
    }
  }

  // 5. @E records: skeleton-only (ignore overlay enums)

  // 7. Detect orphaned @T modules (in overlay, not in skeleton)
  for (const mod of overlay.modules) {
    if (!skeletonModuleNames.has(mod.name)) {
      orphans.push({
        type: "@T",
        name: mod.name,
        line: mod.line,
      });
    }
  }

  // Detect orphaned members — check all overlay members against all skeleton members
  // (matches bash script behavior: member checked globally, not per-module)
  const allSkeletonMemberNames = new Set(
    skeleton.modules.flatMap((m) => m.members.map((mem) => mem.name))
  );
  for (const overlayMod of overlay.modules) {
    for (const mem of overlayMod.members) {
      if (!allSkeletonMemberNames.has(mem.name)) {
        orphans.push({
          type: "member",
          name: mem.name,
          line: mem.line,
        });
      }
    }
  }

  const provenance: MergeProvenance = {
    skeletonPath,
    overlayPath,
    skeletonVersion: skeleton.version,
    overlayVersion: overlay.version,
    fillCount,
    appendedRecords,
    orphans,
  };

  return { merged, provenance };
}
