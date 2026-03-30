"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileEntry } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

interface RawViewerProps {
  file: FileEntry;
}

export function RawViewer({ file }: RawViewerProps) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);

    const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
    fetch(`/api/files/${encodedPath}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Failed to load file:", error);
          setContent(`Error: ${getErrorMessage(error)}`);
        }
      });

    return () => { cancelled = true; };
  }, [file.path]);

  if (content === null) return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;

  return (
    <ScrollArea className="h-full">
      <pre className="p-4 text-sm font-mono whitespace-pre-wrap">{content}</pre>
    </ScrollArea>
  );
}
