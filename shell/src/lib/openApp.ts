import { api } from "../api/client";
import type { AppEntry, WindowEntry } from "../api/types";
import { isLocalDesktopShell, resolveFrameSrc } from "./open-app-frame";
export { isLocalDesktopShell, resolveFrameSrc } from "./open-app-frame";

/** Everything opens INSIDE the NODE app: the REAL web app UI in a fullscreen
 *  frame (phone-launcher style), or a live view of a desktop window.
 *  Native rebuilt screens are only used when explicitly requested.
 *  On the local Plasma kiosk, tiles with openIn "window" (n8n) are an
 *  exception: they raise as one maximized Chrome --app window. */
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

export async function openApp(a: AppEntry, toast?: (m: string, k?: "ok" | "error" | "info") => void): Promise<void> {
  // Explicit new-tab apps (API-only, blocked framing, etc.)
  if (a.provider === "web" && a.openIn === "tab" && a.url) {
    if (!window.open(a.url, "_blank", "noopener")) window.location.href = a.url;
    return;
  }

  // Iframe only a door-gated frame proxy — never the raw Cloudflare Access URL
  // (Access sends X-Frame-Options: DENY and blanks the pane). If no proxy is
  // advertised, launch a real local window and stream it.
  const framed = resolveFrameSrc(a);
  if (framed) {
    // Desktop kiosk: maximized native Chrome window, not the phone-style iframe.
    if (isLocalDesktopShell() && a.openIn === "window") {
      const r = await api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id: a.id, desktopWindow: true }).catch((e: Error) => ({ ok: false, message: e.message }));
      if (!r.ok) { toast?.(r.message, "error"); return; }
      toast?.(`Opening ${a.name}…`, "info");
      return;
    }
    return showAppView({ kind: "web", url: framed, title: a.name });
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

