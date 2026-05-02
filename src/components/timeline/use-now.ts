"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to the wall clock, refreshing once per minute. Hydration-safe:
 * returns null on the server and during the first client render, then
 * settles to the real time on commit.
 */

const listeners = new Set<() => void>();
let cachedNow: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureInterval(): void {
  if (intervalId !== null) return;
  cachedNow = Date.now();
  intervalId = setInterval(() => {
    cachedNow = Date.now();
    for (const cb of listeners) cb();
  }, 60_000);
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  ensureInterval();
  // Notify the new subscriber once so it picks up cachedNow on next render
  callback();
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
      cachedNow = null;
    }
  };
}

function getSnapshot(): number | null {
  return cachedNow;
}

function getServerSnapshot(): number | null {
  return null;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
