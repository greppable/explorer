"use client";

import { useEffect, useState } from "react";
import type { VersionHeader } from "@/lib/types";

interface StalenessIndicatorProps {
  filePath: string;
  version?: VersionHeader;
}

type StalenessState = "fresh" | "stale" | "unknown" | "loading";

export function StalenessIndicator({ filePath, version }: StalenessIndicatorProps) {
  const [state, setState] = useState<StalenessState>("unknown");

  useEffect(() => {
    if (!version?.sourceHash) {
      setState("unknown");
      return;
    }

    setState("loading");
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/staleness/${encodedPath}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.fresh === true) setState("fresh");
        else if (data.fresh === false) setState("stale");
        else setState("unknown");
      })
      .catch(() => setState("unknown"));
  }, [filePath, version?.sourceHash]);

  if (state === "unknown" || state === "loading") return null;

  const dotColor = state === "fresh" ? "bg-green-400" : "bg-amber-400";
  const label = state === "fresh" ? "fresh" : "stale";

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title={`Source ${label}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
