import { api } from "../api/client";
import type { AppEntry, WindowEntry } from "../api/types";

/** Everything opens INSIDE the NODE app: the REAL web app UI in a fullscreen
 *  frame (phone-launcher style), or a live view of a desktop window.
 *  Native rebuilt screens are only used when explicitly requested. */
export type AppViewTarget =
  | { kind: "web"; url: string; title: string }
  | { kind: "window"; address: string; title: string }
  | { kind: "native"; slug: string; title: string };

export function showAppView(t: AppViewTarget): void {
  // Keep web targets as real iframes (frame-proxy / same-origin / Access URL).
  // Auto-rewriting to native summary widgets blanked OpenJarvis on the phone.
  window.dispatchEvent(new CustomEvent<AppViewTarget>("node:app-view", { detail: t }));
}

export async function openWindowView(w: WindowEntry): Promise<void> {
  await api.post("/api/windows/focus", { address: w.address }).catch(() => {});
  showAppView({ kind: "window", address: w.address, title: w.title || w.class });
}


/** Pick a frame URL that shares a host with the current shell, so the door cookie is first-party. */
function resolveWebUrl(a: AppEntry): string | undefined {
  const host = window.location.hostname;
  const loop = host === "127.0.0.1" || host === "localhost";
  if (loop && a.localFrameUrl) return a.localFrameUrl;
  return a.frameUrl ?? a.url;
}

export async function openApp(a: AppEntry, toast?: (m: string, k?: "ok" | "error" | "info") => void): Promise<void> {
  // Explicit new-tab apps (API-only, blocked framing, etc.)
  if (a.provider === "web" && a.openIn === "tab" && a.url) {
    if (!window.open(a.url, "_blank", "noopener")) window.location.href = a.url;
    return;
  }

  // Prefer the REAL full web app inside NODE (fullscreen iframe).
  // On loopback, use the local frame-proxy port so door_session (host-only on
  // 127.0.0.1) is sent; the Tailscale :servePort URL is a different host and
  // was returning "Sign in to NODE first."
  const web = resolveWebUrl(a);
  if (web && a.provider === "web") {
    return showAppView({ kind: "web", url: web, title: a.name });
  }

  // Desktop / phone program: reuse its window if it is already open.
  const find = async () => (await api.get<WindowEntry[]>("/api/windows").catch(() => [] as WindowEntry[])).find((w) => w.appId === a.id);
  const existing = await find();
  if (existing) return openWindowView(existing);
  const r = await api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id: a.id }).catch((e: Error) => ({ ok: false, message: e.message }));
  if (!r.ok) { toast?.(r.message, "error"); return; }
  toast?.(`Opening ${a.name}…`, "info");
  for (let i = 0; i < 30; i++) {
    await new Promise((res) => setTimeout(res, 500));
    const w = await find();
    if (w) return openWindowView(w);
  }
  toast?.(`${a.name} started on the desktop, but its window didn't show up yet. Open it from Continue.`, "error");
}
