import { has, run, stream } from "../../exec.js";
import { check, type FeatureStatus } from "../features.js";
import { createJob, appendLine, finishJob } from "../jobs.js";
import type { Job } from "../../types.js";

/**
 * Flathub as a software source.
 *
 * A fresh machine has almost nothing installed, so the store has to offer
 * something real rather than a list someone typed into the source code.
 * Flathub's public API (no key, no account) returns actual apps with actual
 * icons and descriptions, and flatpak installs them on any distribution.
 *
 * Installed flatpaks export their own .desktop files, so they show up as
 * ordinary apps through the linux provider with no extra work.
 */
const API = "https://flathub.org/api/v2";
const APP_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,254}$/;

export interface StoreApp {
  id: string;
  name: string;
  summary: string;
  developer?: string;
  icon?: string;
  source: "flathub";
  installed: boolean;
}

interface FlathubHit {
  app_id?: string;
  id?: string;
  name?: string;
  summary?: string;
  developer_name?: string;
  icon?: string;
}

function toApp(h: FlathubHit, installed: Set<string>): StoreApp | null {
  const id = h.app_id ?? h.id;
  if (!id || !APP_ID.test(id)) return null;
  return {
    id,
    name: h.name ?? id.split(".").pop() ?? id,
    summary: h.summary ?? "",
    developer: h.developer_name,
    icon: h.icon,
    source: "flathub",
    installed: installed.has(id),
  };
}

async function installedIds(): Promise<Set<string>> {
  if (!(await has("flatpak"))) return new Set();
  const r = await run("flatpak", ["list", "--app", "--columns=application"], { timeout: 8000 });
  return new Set(r.stdout.trim().split("\n").map((s) => s.trim()).filter(Boolean));
}

async function json<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

let popularCache: { at: number; apps: StoreApp[] } | null = null;

/** What the store shows before you type anything: Flathub's own popular list. */
export async function popular(): Promise<StoreApp[]> {
  const installed = await installedIds();
  if (popularCache && Date.now() - popularCache.at < 60 * 60_000) {
    return popularCache.apps.map((a) => ({ ...a, installed: installed.has(a.id) }));
  }
  const d = await json<{ hits: FlathubHit[] }>(`${API}/collection/popular?page=1&per_page=40`);
  if (!d?.hits) return [];
  const apps = d.hits.map((h) => toApp(h, installed)).filter((a): a is StoreApp => a !== null);
  popularCache = { at: Date.now(), apps };
  return apps;
}

export async function search(q: string): Promise<StoreApp[]> {
  const installed = await installedIds();
  const d = await json<{ hits: FlathubHit[] }>(`${API}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q.slice(0, 100) }),
  });
  if (!d?.hits) return [];
  return d.hits.slice(0, 40).map((h) => toApp(h, installed)).filter((a): a is StoreApp => a !== null);
}

/** Icon bytes proxied through the daemon so the shell never calls out itself. */
export async function icon(appId: string): Promise<{ body: Buffer; type: string } | null> {
  if (!APP_ID.test(appId)) return null;
  const d = await json<{ icon?: string }>(`${API}/appstream/${encodeURIComponent(appId)}`);
  const url = d?.icon;
  if (!url || !/^https:\/\/dl\.flathub\.org\//.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    return { body: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") ?? "image/png" };
  } catch {
    return null;
  }
}

export async function status(): Promise<FeatureStatus> {
  return check("flatpak");
}

/** Install as a background job, same as a pacman install. User-scoped, no root. */
export async function install(appId: string, remove = false): Promise<Job> {
  const f = await check("flatpak");
  if (!f.available) throw new Error(f.reason);
  const job = createJob(remove ? "remove" : "install", `${remove ? "Removing" : "Installing"} ${appId}`, { appId, source: "flathub" });
  void (async () => {
    const args = remove
      ? ["uninstall", "-y", "--noninteractive", appId]
      : ["install", "-y", "--noninteractive", "--user", "flathub", appId];
    const code = await stream("flatpak", args, (line) => appendLine(job, line));
    finishJob(job, code === 0);
  })();
  return job;
}

export function validId(appId: string): boolean {
  return APP_ID.test(appId);
}
