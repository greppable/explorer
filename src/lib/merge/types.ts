import type { VersionHeader } from "../types";

export interface MergeResult<T> {
  merged: T;
  provenance: MergeProvenance;
}

export interface MergeProvenance {
  skeletonPath: string;
  overlayPath: string;
  skeletonVersion?: VersionHeader;
  overlayVersion?: VersionHeader;
  fillCount: number;         // empty fields filled from overlay
  appendedRecords: number;   // overlay-only @R/@PATH records added
  orphans: OrphanEntry[];    // overlay records with no skeleton match
}

export interface OrphanEntry {
  type: string;    // "@T", "member"
  name: string;
  line: number;
}
