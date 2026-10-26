import { api } from "../api/client";
import type { AppEntry } from "../api/types";

/** Reachability of each web app's URL, checked by the daemon (true = answering). */
let health: Record<string, boolean> = {};
let webApps: AppEntry[] = [];
const refresh = () => {
  void api.get<Record<string, boolean>>("/api/webapps/health").then((h) => { health = h; }).catch(() => undefined);
  void api.get<AppEntry[]>("/api/apps").then((l) => { webApps = l.filter((a) => a.provider === "web" && a.url); }).catch(() => undefined);
};
refresh();
setInterval(refresh, 60_000);

/** Are we viewing NODE from another device (phone/laptop) rather than the box's own screen? */
export function isRemote(): boolean {
  return !["localhost", "127.0.0.1", "::1"].includes(location.hostname);
}

/**
 * Open an app. Web apps open right here in a new tab — synchronously inside the
 * tap, so iOS Safari doesn't block the popup. Native apps launch on the box.
 */
export function launchApp(a: AppEntry | undefined, id: string, toast: (m: string, k?: "ok" | "error" | "info") => void): void {
  // A desktop launcher for a local web app (e.g. Paperclip, Jarvis) opens its web twin on a phone.
  if (a && !a.url && isRemote()) {
    const n = a.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const twin = webApps.find((w) => { const m = w.name.toLowerCase().replace(/[^a-z0-9]/g, ""); return m === n || m.endsWith(n); });
    if (twin) a = twin;
  }
  if (a?.url && /^https?:/.test(a.url) && isRemote()) {
    if (health[a.id] === false) { toast(`${a.name} isn't running on NODE right now`, "error"); return; }
    const w = window.open(a.url, "_blank");
    if (w) { try { w.opener = null; } catch { /* cross-origin */ } }
    else location.href = a.url;
    return;
  }
  void api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id }).then((r) => toast(isRemote() && r.ok ? `${r.message} on the NODE screen` : r.message, r.ok ? "ok" : "error")).catch((e) => toast(e.message, "error"));
}
