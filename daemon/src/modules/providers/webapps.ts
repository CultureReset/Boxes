import { has, launchDetached } from "../../exec.js";
import { WorldStore } from "../worlds.js";
import { catalogEntries } from "../catalog.js";
import { bus } from "../../events.js";
import { isDemo } from "../status.js";
import { HttpError } from "../../router.js";
import type { AppEntry } from "../../types.js";
import { qualify, type AppProvider } from "./types.js";

/**
 * Web apps: any website run as its own chromeless window. This is how
 * business tools that only exist on the web (Toast, Google Business, social
 * accounts) become first-class tiles next to native apps.
 *
 * The catalog is a starting list; users add from it or type any URL. Nothing
 * here embeds third-party branding: tiles use a colour and an initial.
 */
export interface WebApp {
  slug: string;
  name: string;
  url: string;
  comment: string;
  color: string;
  category: string;
  added: boolean;
}

/** Only what you actually added. The catalog is a separate, read-only menu. */
const store = new WorldStore<WebApp[]>("webapps", () => []);

function windowClass(slug: string): string {
  return `nodeos-web-${slug}`;
}

function toEntry(w: WebApp): AppEntry {
  return { id: qualify("web", w.slug), provider: "web", name: w.name, comment: w.comment, exec: w.url, icon: "", categories: [w.category], source: "webapp", color: w.color, url: w.url };
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
    const slug = (input.name ?? host).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
    app = { slug: all.some((w) => w.slug === slug) ? `${slug}-${Date.now().toString(36)}` : slug, name: input.name?.trim() || host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()), url, comment: host, color: input.color ?? "#0a84ff", category: "Web", added: true };
    all.push(app);
  }
  app.added = true;
  await store.write(all);
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
  list: async () => (await catalog()).filter((w) => w.added).map(toEntry),
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
