// simple-module.ts — basic exported functions and types
export interface ParseResult {
  success: boolean;
  data: string[];
}

export function parseFile(content: string): ParseResult {
  return { success: true, data: [] };
}

function normalizeInput(raw: string): string {
  return raw.trim();
}

export const MAX_SIZE: number = 1024;
