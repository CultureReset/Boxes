import { readdir } from "node:fs/promises";
import path from "node:path";
import { has, run } from "../exec.js";
import { bus } from "../events.js";
import { HOME, OMARCHY_PATH } from "../paths.js";
import { themeName, backgroundPath } from "./status.js";

export async function listThemes(): Promise<{ name: string; active: boolean }[]> {
  const current = await themeName();
  const names = new Set<string>();
  for (const dir of [path.join(OMARCHY_PATH, "themes"), path.join(HOME, ".config/omarchy/themes")]) {
    try {
      for (const d of await readdir(dir)) names.add(d);
    } catch {
      /* no omarchy here */
    }
  }
  if (names.size === 0) ["tokyo-night", "catppuccin", "nord", "gruvbox", "everforest", "rose-pine", "kanagawa", "matte-black"].forEach((n) => names.add(n));
  const pretty = (n: string) => n.replace(/(^|-)([a-z])/g, (_m, sep, c) => `${sep === "-" ? " " : ""}${c.toUpperCase()}`);
  return [...names].sort().map((n) => ({ name: pretty(n), active: pretty(n) === current }));
}

export async function setTheme(name: string): Promise<{ ok: boolean; message: string }> {
  if (!(await has("omarchy-theme-set"))) return { ok: true, message: `Theme set to ${name} (demo)` };
  const r = await run("omarchy-theme-set", [name], { timeout: 30000 });
  bus.emit("theme", { theme: await themeName(), background: await backgroundPath() });
  return { ok: r.ok, message: r.ok ? `Theme set to ${name}` : r.stderr.trim() };
}

export async function listBackgrounds(): Promise<string[]> {
  const current = await themeName();
  const slug = current.toLowerCase().replace(/\s+/g, "-");
  const out: string[] = [];
  for (const dir of [path.join(OMARCHY_PATH, "themes", slug, "backgrounds"), path.join(HOME, ".config/omarchy/themes", slug, "backgrounds"), path.join(HOME, "Pictures/Wallpapers")]) {
    try {
      for (const f of await readdir(dir)) if (/\.(jpg|jpeg|png|webp)$/i.test(f)) out.push(path.join(dir, f));
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function nextBackground(): Promise<void> {
  if (await has("omarchy-theme-bg-next")) await run("omarchy-theme-bg-next");
  bus.emit("theme", { theme: await themeName(), background: await backgroundPath() });
}

export async function setBackground(file: string): Promise<void> {
  if (await has("omarchy-theme-bg-set")) await run("omarchy-theme-bg-set", [file]);
  bus.emit("theme", { theme: await themeName(), background: await backgroundPath() });
}
