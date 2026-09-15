import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOME, OMARCHY_PATH } from "../paths.js";

/**
 * Web-app suggestions, read from real sources rather than a list typed into
 * the source code:
 *
 *   1. Omarchy's own `applications/*.desktop` web apps, if Omarchy is here.
 *   2. `config/webapps.json` in this repo, which is plain data you can edit.
 *
 * Neither is system state, and neither is required: the address box adds any
 * site. If both sources are empty the catalog is simply empty, which is the
 * honest answer.
 */
export interface CatalogEntry {
  slug: string;
  name: string;
  url: string;
  comment: string;
  color: string;
  category: string;
  source: "omarchy" | "file";
}

const here = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.resolve(here, "../../../config/webapps.json");

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Deterministic colour so a tile has an identity without shipping brand art. */
function colorFor(seed: string): string {
  const palette = ["#0a84ff", "#30d158", "#ff9f0a", "#ff453a", "#bf5af2", "#ff375f", "#64d2ff", "#5e5ce6", "#ffd60a", "#ac8e68"];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Parse the web apps Omarchy actually ships, wherever it is installed. */
async function fromOmarchy(): Promise<CatalogEntry[]> {
  const dirs = [path.join(OMARCHY_PATH, "applications"), path.join(HOME, ".local/share/applications")];
  const out = new Map<string, CatalogEntry>();
  for (const dir of dirs) {
    let files: string[];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".desktop"));
    } catch {
      continue;
    }
    for (const f of files) {
      let text: string;
      try {
        text = await readFile(path.join(dir, f), "utf8");
      } catch {
        continue;
      }
      const exec = text.match(/^Exec=(.*)$/m)?.[1] ?? "";
      const url = exec.match(/https?:\/\/[^\s"']+/)?.[0];
      // Only launchers that open a URL as an app window are web apps.
      if (!url || !/omarchy-launch-webapp|--app=/.test(exec)) continue;
      const name = text.match(/^Name=(.*)$/m)?.[1]?.trim() ?? f.replace(/\.desktop$/, "");
      const slug = slugify(name);
      if (!slug) continue;
      out.set(slug, { slug, name, url, comment: new URL(url).hostname.replace(/^www\./, ""), color: colorFor(name), category: "From Omarchy", source: "omarchy" });
    }
  }
  return [...out.values()];
}

async function fromFile(): Promise<CatalogEntry[]> {
  try {
    const raw = JSON.parse(await readFile(CONFIG_FILE, "utf8")) as Array<Partial<CatalogEntry>>;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e) => e && typeof e.name === "string" && typeof e.url === "string" && /^https?:\/\//.test(e.url))
      .map((e) => ({
        slug: e.slug && /^[a-z0-9-]+$/.test(e.slug) ? e.slug : slugify(e.name!),
        name: e.name!,
        url: e.url!,
        comment: e.comment ?? "",
        color: e.color ?? colorFor(e.name!),
        category: e.category ?? "Suggested",
        source: "file" as const,
      }));
  } catch {
    return [];
  }
}

let cache: { at: number; entries: CatalogEntry[] } | null = null;

export async function catalogEntries(): Promise<CatalogEntry[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.entries;
  const [omarchy, file] = await Promise.all([fromOmarchy(), fromFile()]);
  const seen = new Set(omarchy.map((e) => e.slug));
  const entries = [...omarchy, ...file.filter((e) => !seen.has(e.slug))];
  cache = { at: Date.now(), entries };
  return entries;
}
