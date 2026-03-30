import fs from "fs";
import path from "path";

function getGdlRoot(): string {
  const envRoot = process.env.GDL_ROOT;
  if (envRoot) {
    if (!path.isAbsolute(envRoot)) {
      const resolved = path.resolve(envRoot);
      console.warn(`GDL_ROOT is relative ("${envRoot}"), resolved to: ${resolved}`);
      return path.normalize(resolved);
    }
    return path.normalize(envRoot);
  }
  // Fallback: use cwd (for `npm run dev` without GDL_ROOT set)
  console.warn("GDL_ROOT not set, using current working directory:", process.cwd(),
    "\nSet GDL_ROOT=/path/to/project or use: npx greppable-explorer --root=/path/to/project");
  return path.normalize(process.cwd());
}

// GDL_ROOT env var, or fallback to cwd
export const GDL_ROOT = getGdlRoot();

// Project name derived from GDL_ROOT directory name
export const PROJECT_NAME = path.basename(GDL_ROOT);

// Only allow indexing within GDL_ROOT — no path traversal
export function resolveSafePath(relativePath: string): string | null {
  const normalizedRoot = path.normalize(GDL_ROOT);
  const resolved = path.resolve(normalizedRoot, relativePath);
  const relative = path.relative(normalizedRoot, resolved);

  // If relative path starts with ".." or is absolute, it escapes the root
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  // Resolve symlinks to prevent symlink-based traversal
  try {
    const real = fs.realpathSync(resolved);
    const realRoot = fs.realpathSync(normalizedRoot);
    const realRelative = path.relative(realRoot, real);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      return null;
    }
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // File doesn't exist yet (e.g., new file) — allow if logical path is safe
    } else {
      // Permission denied, symlink loop, etc. — reject for safety
      return null;
    }
  }

  return resolved;
}
