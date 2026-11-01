import { api } from "../api/client";
import type { AppEntry, WindowEntry } from "../api/types";
import { NATIVE } from "../native/NativeApp";

/** Apps whose own UI embeds fine and needs no separate login: shown at their own
 *  tailnet address (same site as NODE, so their cookies stay first-party). */
const FRAME_OWN = new Set(["openjarvis", "paperclip", "searxng", "llama-swap"]);

/** Everything opens INSIDE the NODE app: web apps in an in-app frame, desktop
 *  programs as a live view of their window. Never a new tab. */
export type AppViewTarget =
  | { kind: "web"; url: string; title: string }
  | { kind: "window"; address: string; title: string }
  | { kind: "native"; slug: string; title: string };

export function showAppView(t: AppViewTarget): void {
  window.dispatchEvent(new CustomEvent<AppViewTarget>("node:app-view", { detail: t }));
}

export async function openWindowView(w: WindowEntry): Promise<void> {
  await api.post("/api/windows/focus", { address: w.address }).catch(() => {});
  showAppView({ kind: "window", address: w.address, title: w.title || w.class });
}

export async function openApp(a: AppEntry, toast?: (m: string, k?: "ok" | "error" | "info") => void): Promise<void> {
  // Apps with a login, or that refuse to be framed, open as a real page so
  // cookies are first-party (iOS Safari drops them inside cross-origin frames).
  const slug = a.id.replace(/^web:/, "");
  if (a.provider === "web" && NATIVE[slug]) return showAppView({ kind: "native", slug, title: a.name });
  if (a.provider === "web" && FRAME_OWN.has(slug) && a.url) return showAppView({ kind: "web", url: slug === "llama-swap" ? a.url.replace(/\/?$/, "/ui/") : a.url, title: a.name });
  if (a.provider === "web" && a.openIn === "tab" && a.url) {
    if (!window.open(a.url, "_blank", "noopener")) window.location.href = a.url;
    return;
  }
  const web = a.frameUrl ?? a.url;
  if (web && a.provider === "web") return showAppView({ kind: "web", url: web, title: a.name });
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
