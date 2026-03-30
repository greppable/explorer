"use client";

import { useEffect, useState } from "react";

interface IndexStats {
  fileCount: number;
  entityCount: number;
  crossRefCount: number;
}

export function StatusBar() {
  const [stats, setStats] = useState<IndexStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/index")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setStats(data.stats);
      })
      .catch((error: unknown) => console.error("Failed to load index stats:", error));

    return () => { cancelled = true; };
  }, []);

  if (!stats) return <div className="px-4 py-1 border-t text-xs text-muted-foreground">Indexing...</div>;

  return (
    <div className="px-4 py-1 border-t text-xs text-muted-foreground flex gap-4">
      <span>{stats.fileCount} files indexed</span>
      <span>{stats.entityCount} entities</span>
      <span>{stats.crossRefCount} cross-layer refs</span>
    </div>
  );
}
