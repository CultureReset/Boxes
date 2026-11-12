import { ensureFrame, frameUrlForFrame, localFrameUrlForFrame } from "../../frameproxy.js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { has, launchDetached } from "../../exec.js";
import { WorldStore } from "../worlds.js";
import { catalogEntries } from "../catalog.js";
import { bus } from "../../events.js";
import { isDemo } from "../status.js";
import { HttpError } from "../../router.js";
import { isCloudflareAccessUrl, ACCESS_URL_RULE } from "../../cloudflare-access-url.js";
import type { AppEntry } from "../../types.js";
import { qualify, type AppProvider } from "./types.js";
import { effectiveOpenMode } from "../../native-open.js";

/**
 * Web apps: any website run as its own chromeless window. This is how
 * business tools that only exist on the web (Toast, Google Business, social
 * accounts) become first-class tiles next to native apps.
 *
 * The catalog is a starting list; users add from it or type any URL. Nothing
 * here embeds third-party branding: tiles use a colour and an initial.
 */
export interface WebApp {
  open?: "tab" | "frame" | "native" | "window";
  nativeApp?: string;
  slug: string;
  parent?: string;
  includes?: string[];
  name: string;
  url: string;
  comment: string;
  color: string;
  category: string;
  icon?: string;
  added: boolean;
}

/** Only what you actually added. The catalog is a separate, read-only menu. */
const store = new WorldStore<WebApp[]>("webapps", () => []);

/** Per-app "open" / "url" from config/webapps.json (saved apps are copies, so read it live). */
function configEntry(slug: string): { open?: string; nativeApp?: string; url?: string; hidden?: boolean } | undefined {
  try {
    const list = JSON.parse(readFileSync(WEBAPPS_FILE, "utf8")) as { slug: string; open?: string; nativeApp?: string; url?: string; hidden?: boolean }[];
    return list.find((x) => x.slug === slug);
  } catch { return undefined; }
}

function openModeFromConfig(slug: string): string | undefined {
  return configEntry(slug)?.open;
}

function windowClass(slug: string): string {
  return `nodeos-web-${slug}`;
}


function openInFrom(w: WebApp): AppEntry["openIn"] {
  const open = effectiveOpenMode(openModeFromConfig(w.slug), w.open);
  if (open === "tab" || open === "native" || open === "window") return open;
  return undefined;
}

function toEntry(w: WebApp): AppEntry {
  // The tile is a top-level link to this URL (its Cloudflare hostname), so a
  // hostname changed in config/webapps.json wins over a stale saved copy.
  const url = configEntry(w.slug)?.url || w.url;
  const icon = w.icon ?? (existsSync(`${process.env.HOME}/.local/share/node-icons/${w.slug}.png`) ? `${process.env.HOME}/.local/share/node-icons/${w.slug}.png` : "");
  const base: AppEntry = {
    id: qualify("web", w.slug),
    provider: "web",
    name: w.name,
    comment: w.comment,
    exec: url,
    icon,
    categories: [w.category],
    source: "webapp",
    color: w.color,
    url,
    openIn: openInFrom(w),
    nativeApp: configEntry(w.slug)?.nativeApp ?? w.nativeApp,
    parent: w.parent ?? grouping(w.slug).parent,
    includes: w.includes ?? grouping(w.slug).includes,
  };
  // Native tiles launch a Linux app; do not allocate or touch a frame proxy.
  if (base.openIn === "native" && base.nativeApp) return base;
  const f = ensureFrame(w.slug, { url: w.url });
  return { ...base, frameUrl: frameUrlForFrame(f), localFrameUrl: localFrameUrlForFrame(f) };
}

/**
 * Everything offerable: what you added, plus suggestions read from Omarchy's
 * real web apps and config/webapps.json.
 */
export async function catalog(): Promise<WebApp[]> {
  const saved = await store.read();
  const known = new Set(saved.map((s) => s.slug));
  const suggestions = (await catalogEntries())
    .filter((c) => !known.has(c.slug))
    .map((c) => ({ slug: c.slug, name: c.name, url: c.url, comment: c.comment, color: c.color, category: c.category, added: false }));
  return [...saved, ...suggestions];
}

export async function addWebApp(input: { slug?: string; name?: string; url?: string; color?: string }): Promise<WebApp> {
  const all = await catalog();
  let app = input.slug ? all.find((w) => w.slug === input.slug) : undefined;
  if (!app) {
    if (!input.url) throw new HttpError(400, "url is required");
    const url = /^https?:\/\//.test(input.url) ? input.url : `https://${input.url}`;
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      throw new HttpError(400, "That doesn't look like a web address");
    }
    if (!isCloudflareAccessUrl(url)) throw new HttpError(400, ACCESS_URL_RULE);
    const slug = (input.name ?? host).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
    app = { slug: all.some((w) => w.slug === slug) ? `${slug}-${Date.now().toString(36)}` : slug, name: input.name?.trim() || host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()), url, comment: host, color: input.color ?? "#0a84ff", category: "Web", added: true };
    all.push(app);
  }
  app.added = true;
  await store.write(all);
  // Future app-store / catalog adds inherit a door-gated frame proxy automatically.
  ensureFrame(app.slug, { url: app.url });
  bus.emit("apps", { provider: "web" });
  return app;
}

export async function removeWebApp(slug: string): Promise<void> {
  const all = await catalog();
  const app = all.find((w) => w.slug === slug);
  if (!app) throw new HttpError(404, "Web app not found");
  // Removing just drops it from your list; suggestions reappear in the catalog.
  await store.write((await store.read()).filter((w) => w.slug !== slug));
  bus.emit("apps", { provider: "web" });
}

export async function openUrlAsApp(url: string, cls = "nodeos-web-window"): Promise<boolean> {
  if (await isDemo()) return true;
  const profile = `${process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`}/nodeos/web-profile`;
  for (const b of ["chromium", "google-chrome-stable", "brave", "helium", "microsoft-edge-stable"]) {
    if (await has(b)) {
      const args = [`--app=${url}`, `--class=${cls}`, `--user-data-dir=${profile}`, "--ozone-platform-hint=auto", "--no-first-run", "--no-default-browser-check"];
      return (await has("uwsm-app")) ? launchDetached("uwsm-app", ["--", b, ...args]) : launchDetached(b, args);
    }
  }
  if (await has("omarchy-launch-webapp")) return launchDetached("omarchy-launch-webapp", [url]);
  return launchDetached("xdg-open", [url]);
}

export const webProvider: AppProvider = {
  id: "web",
  name: "Web apps",
  description: "Websites that run in their own window",
  available: async () => ({ ok: true }),
  // `hidden: true` in config/webapps.json keeps a tile out of NODE (dead by design,
  // API-only, or its service is not running) even if an older saved copy exists.
  list: async () => (await catalog()).filter((w) => w.added && !configEntry(w.slug)?.hidden).map(toEntry),
  async launch(slug) {
    const app = (await catalog()).find((w) => w.slug === slug);
    if (!app) return { ok: false, message: "Web app not found" };
    const ok = await openUrlAsApp(app.url, windowClass(slug));
    return { ok, message: ok ? `Opening ${app.name}` : "No browser found" };
  },
  async remove(slug) {
    await removeWebApp(slug);
    return { ok: true, message: "Removed" };
  },
  async matchWindow(cls) {
    const m = cls.match(/^nodeos-web-(.+)$/);
    return m?.[1];
  },
};

/** Grouping (parent / includes) comes from config/webapps.json, so tiles saved
 *  before it existed pick it up too. OpenClaw lives under Paperclip. */
const WEBAPPS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../../config/webapps.json");
function grouping(slug: string): { parent?: string; includes?: string[] } {
  try {
    const w = (JSON.parse(readFileSync(WEBAPPS_FILE, "utf8")) as WebApp[]).find((x) => x.slug === slug);
    return { parent: w?.parent, includes: w?.includes };
  } catch { return {}; }
}
