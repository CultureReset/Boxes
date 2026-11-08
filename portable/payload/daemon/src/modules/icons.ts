import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { HOME } from "../paths.js";

/**
 * Resolve a freedesktop icon name to a file on disk, preferring large PNGs
 * and SVGs from the themes Omarchy ships. The lookup walks every theme dir once
 * and caches the result for the daemon lifetime.
 */
const ICON_ROOTS = [
  path.join(HOME, ".local/share/icons"),
  path.join(HOME, ".icons"),
  "/usr/share/icons",
  "/usr/local/share/icons",
  "/var/lib/flatpak/exports/share/icons",
  "/usr/share/pixmaps",
];
const THEME_PRIORITY = ["Papirus-Dark", "Papirus", "Yaru", "Adwaita", "hicolor", "breeze-dark", "breeze"];
const SIZE_PRIORITY = ["scalable", "512x512", "256x256", "128x128", "96x96", "64x64", "48x48", "apps"];

const cache = new Map<string, string | null>();
let indexPromise: Promise<Map<string, string[]>> | null = null;

async function walk(dir: string, depth: number, out: Map<string, string[]>) {
  if (depth > 5) return;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, depth + 1, out);
    else if (/\.(png|svg)$/i.test(e.name)) {
      const key = e.name.replace(/\.(png|svg)$/i, "").toLowerCase();
      const list = out.get(key) ?? [];
      list.push(full);
      out.set(key, list);
    }
  }
}

function buildIndex(): Promise<Map<string, string[]>> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const out = new Map<string, string[]>();
      for (const root of ICON_ROOTS) await walk(root, 0, out);
      return out;
    })();
  }
  return indexPromise;
}

function score(file: string): number {
  let s = 0;
  const themeIdx = THEME_PRIORITY.findIndex((t) => file.includes(`/${t}/`));
  s += themeIdx >= 0 ? (THEME_PRIORITY.length - themeIdx) * 100 : 0;
  const sizeIdx = SIZE_PRIORITY.findIndex((sz) => file.includes(`/${sz}/`) || file.includes(`/${sz}@`));
  s += sizeIdx >= 0 ? (SIZE_PRIORITY.length - sizeIdx) * 10 : 0;
  if (file.endsWith(".svg")) s += 5;
  if (/\/(symbolic|cursors|emblems|status|actions|mimetypes|devices|places|categories)\//.test(file)) s -= 500;
  if (/-symbolic\.(svg|png)$/.test(file)) s -= 500;
  return s;
}

export async function resolveIcon(name: string): Promise<string | null> {
  if (!name) return null;
  if (name.startsWith("/")) {
    try {
      await stat(name);
      return name;
    } catch {
      return null;
    }
  }
  const key = name.replace(/\.(png|svg|xpm)$/i, "").toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  const index = await buildIndex();
  const candidates = index.get(key) ?? [];
  const best = candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
  cache.set(key, best);
  return best;
}

export async function readIcon(name: string): Promise<{ body: Buffer; type: string } | null> {
  const file = await resolveIcon(name);
  if (!file) return null;
  try {
    const body = await readFile(file);
    return { body, type: file.endsWith(".svg") ? "image/svg+xml" : "image/png" };
  } catch {
    return null;
  }
}
