#!/usr/bin/env node

import { spawn } from "child_process";
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");

// Parse args
const args = process.argv.slice(2);
const portFlag = args.find((a) => a.startsWith("--port="));
const portStr = portFlag ? portFlag.split("=")[1] : "4321";
const portNum = parseInt(portStr, 10);
if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
  console.error(`Error: Invalid port "${portStr}". Must be a number between 1 and 65535.`);
  process.exit(1);
}
const port = String(portNum);
const rootFlag = args.find((a) => a.startsWith("--root="));
const explicitRoot = rootFlag ? rootFlag.split("=")[1] : null;

const GDL_RE = /\.gdl[sacdmu]?$/;

// Check if a directory contains .gdl* files (top-level or one level deep)
function hasGdlFiles(dir) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    // Check top-level files
    if (entries.some((e) => e.isFile() && GDL_RE.test(e.name))) return true;
    // Check one level deep (subdirectories)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        try {
          const subEntries = readdirSync(path.join(dir, entry.name), { withFileTypes: true });
          if (subEntries.some((e) => e.isFile() && GDL_RE.test(e.name))) return true;
        } catch {
          // Skip unreadable subdirectories
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Auto-detect GDL_ROOT: walk up from cwd, stop at .git boundary or filesystem root
function detectGdlRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (hasGdlFiles(dir)) return dir;

    // Stop at git repo root (don't climb past project boundary)
    if (existsSync(path.join(dir, ".git"))) break;

    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

let gdlRoot;
if (explicitRoot) {
  const resolved = path.resolve(explicitRoot);
  if (!existsSync(resolved)) {
    console.error(`Error: --root path does not exist: ${resolved}`);
    process.exit(1);
  }
  if (!statSync(resolved).isDirectory()) {
    console.error(`Error: --root must be a directory, not a file: ${resolved}`);
    process.exit(1);
  }
  gdlRoot = resolved;
} else {
  gdlRoot = detectGdlRoot(process.cwd());
}

if (!gdlRoot) {
  console.error(
    "Error: No GDL files found in current directory or any parent (up to git root).\n" +
    "Run this from inside a project with .gdl* files, or use --root=/path/to/project"
  );
  process.exit(1);
}

console.log(`GDL Explorer`);
console.log(`  Root: ${gdlRoot}`);
console.log(`  Port: ${port}`);
console.log(`  URL:  http://127.0.0.1:${port}\n`);

// Use the local next binary directly (not npx — avoids nested npx resolution)
const nextBin = path.join(packageRoot, "node_modules", ".bin", "next");
const child = spawn(nextBin, ["dev", "--hostname", "127.0.0.1", "--port", port], {
  cwd: packageRoot,
  env: { ...process.env, GDL_ROOT: gdlRoot, PORT: port },
  stdio: "inherit",
  // On Windows, .bin shims are .cmd files — shell: true handles this
  shell: process.platform === "win32",
});

// Open browser after a short delay
let openTimeout = setTimeout(async () => {
  try {
    const open = (await import("open")).default;
    await open(`http://127.0.0.1:${port}`);
  } catch {
    console.log(`  Open http://127.0.0.1:${port} in your browser`);
  }
}, 3000);

child.on("exit", (code) => {
  clearTimeout(openTimeout);
  process.exit(code ?? 0);
});
process.on("SIGINT", () => { clearTimeout(openTimeout); child.kill("SIGINT"); });
process.on("SIGTERM", () => { clearTimeout(openTimeout); child.kill("SIGTERM"); });
