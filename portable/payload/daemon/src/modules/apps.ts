import { launchDetached } from "../exec.js";
import { isDemo } from "./status.js";
import { HttpError } from "../router.js";
import type { AppEntry } from "../types.js";
import { split, type AppProvider } from "./providers/types.js";
import { linuxProvider, refreshLinuxApps } from "./providers/linux.js";
import { webProvider, openUrlAsApp } from "./providers/webapps.js";
import { androidProvider } from "./providers/android.js";
import { activeWorld } from "./worlds.js";

/**
 * The app registry. Providers are interchangeable: add or remove one here and
 * every screen (Home, Apps, search, Continue row) follows without changes.
 */
export const PROVIDERS: AppProvider[] = [linuxProvider, webProvider, androidProvider];

function provider(id: string): AppProvider {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new HttpError(404, `Unknown app provider: ${id}`);
  return p;
}

/** Apps visible in the active world. `all` bypasses the world's allowlist (for the world editor). */
export async function listApps(all = false): Promise<AppEntry[]> {
  const lists = await Promise.all(PROVIDERS.map((p) => p.list().catch(() => [] as AppEntry[])));
  const flat = lists.flat();
  if (all) return flat;
  const w = await activeWorld();
  if (!w.apps) return flat;
  const allow = new Set(w.apps);
  return flat.filter((a) => allow.has(a.id) || allow.has(a.provider + ":*"));
}

export async function providersInfo() {
  return Promise.all(PROVIDERS.map(async (p) => ({ id: p.id, name: p.name, description: p.description, ...(await p.available()) })));
}

export async function launchApp(id: string): Promise<{ ok: boolean; message: string }> {
  const { provider: pid, localId } = split(id);
  return provider(pid).launch(localId);
}

export async function removeApp(id: string): Promise<{ ok: boolean; message: string; jobId?: string }> {
  const { provider: pid, localId } = split(id);
  const p = provider(pid);
  if (!p.remove) return { ok: false, message: `${p.name} can't be removed from here` };
  return p.remove(localId);
}

export async function appIdForWindow(cls: string, title: string): Promise<string | undefined> {
  for (const p of PROVIDERS) {
    const local = await p.matchWindow?.(cls, title);
    if (local) return `${p.id}:${local}`;
  }
  return undefined;
}

export async function launchWebapp(url: string): Promise<boolean> {
  return openUrlAsApp(url);
}

export async function openPath(target: string): Promise<boolean> {
  if (await isDemo()) return true;
  return launchDetached("xdg-open", [target]);
}

export async function refreshAppsCache(): Promise<void> {
  await refreshLinuxApps();
}
