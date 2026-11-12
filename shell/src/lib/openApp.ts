import { api } from "../api/client";
import type { AppEntry, WindowEntry } from "../api/types";
import { planLaunch } from "./native-open";

export { launchHref } from "./native-open";

/** The decision is planLaunch(): a native OS window, or a top-level link.
 *  Web apps are never framed — they open as a full page on their own
 *  Cloudflare hostname. In the installed app they open in a separate browser
 *  view (Done returns to NODE); in a browser tab, Back brings the shell back.
 *  On the local Plasma kiosk, native apps raise as one maximized window and
 *  are never also streamed as a JPEG inside NODE. */
export type AppViewTarget =
  | { kind: "window"; address: string; title: string }
  | { kind: "native"; slug: string; title: string };

/** In-NODE pane, only for native window streams. Web apps never land here. */
export function showAppView(t: AppViewTarget): void {
  window.dispatchEvent(new CustomEvent<AppViewTarget>("node:app-view", { detail: t }));
}

/** Installed home-screen app (iOS/Android PWA): standalone or fullscreen, no browser Back. */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  const mm = (q: string) => typeof window.matchMedia === "function" && window.matchMedia(q).matches;
  return mm("(display-mode: standalone)") || mm("(display-mode: fullscreen)") || mm("(display-mode: minimal-ui)");
}

/**
 * Open a web app as a full page on its Cloudflare hostname. Never an iframe.
 * - Installed app (no Back button): open it in a separate browser view
 *   (iOS shows it with a "Done" button that returns to NODE), so leaving
 *   NODE can never strand the user. If the popup is refused, fall back to
 *   same-tab navigation.
 * - Normal browser tab: same tab; browser Back returns to NODE.
 */
export function openUrl(url: string): void {
  if (!url || url === "about:blank") return;
  if (isInstalledApp() && !isLocalDesktopShell()) {
    // No "noopener" feature string: per spec it makes window.open return null
    // even on success, which would double-navigate. Drop the opener instead.
    const w = window.open(url, "_blank");
    if (w) { try { w.opener = null; } catch { /* cross-origin already */ } return; }
  }
  window.location.assign(url);
}

export async function openWindowView(w: WindowEntry): Promise<void> {
  await api.post("/api/windows/focus", { address: w.address }).catch(() => {});
  showAppView({ kind: "window", address: w.address, title: w.title || w.class });
}

/** NODE TV kiosk on the local Plasma display (?tv=1, or the .tv class). */
export function isLocalDesktopShell(
  search: string = typeof window !== "undefined" ? window.location.search : "",
  tvClass: boolean = typeof document !== "undefined" && document.documentElement.classList.contains("tv"),
): boolean {
  const params = new URLSearchParams(search);
  if (params.has("tv")) return params.get("tv") !== "0";
  return tvClass;
}

async function raiseOnDesktop(w: WindowEntry): Promise<void> {
  await api.post("/api/windows/focus", { address: w.address }).catch(() => {});
  await api.post("/api/windows/maximize", { address: w.address }).catch(() => {});
}

export async function openApp(a: AppEntry, toast?: (m: string, k?: "ok" | "error" | "info") => void): Promise<void> {
  const plan = planLaunch(a, { localDesktop: isLocalDesktopShell() });

  // Every web tile is a top-level link to its Cloudflare hostname, on every
  // display. No iframe. Returning to NODE reloads the shell with its header.
  if (plan.action === "navigate") {
    if (plan.url) return openUrl(plan.url);
    toast?.(`${a.name} has no web address`, "error");
    return;
  }

  // Native: one OS window. Local desktop raises + maximizes and stops.
  // Phones and remote shells stream that window into NODE (they can't see Plasma).
  if (plan.action === "native" && plan.nativeId && plan.nativeId !== a.id) {
    const listed = await api.get<AppEntry[]>("/api/apps?all=1").catch(() => [] as AppEntry[]);
    const target = listed.find((x) => x.id === plan.nativeId);
    if (target) return openApp(target, toast);
    const [provider] = plan.nativeId.split(":");
    return openApp({
      id: plan.nativeId,
      provider: provider || "linux",
      name: a.name,
      comment: a.comment,
      exec: "",
      icon: a.icon,
      categories: a.categories,
      source: "user",
    }, toast);
  }

  const find = async () => (await api.get<WindowEntry[]>("/api/windows").catch(() => [] as WindowEntry[])).find((w) => w.appId === a.id);
  const reveal = async (w: WindowEntry) => {
    if (!plan.stream) return raiseOnDesktop(w);
    return openWindowView(w);
  };
  const existing = await find();
  if (existing) return reveal(existing);
  const r = await api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id: a.id }).catch((e: Error) => ({ ok: false, message: e.message }));
  if (!r.ok) { toast?.(r.message, "error"); return; }
  toast?.(`Opening ${a.name}…`, "info");
  for (let i = 0; i < 30; i++) {
    await new Promise((res) => setTimeout(res, 500));
    const w = await find();
    if (w) return reveal(w);
  }
  toast?.(`${a.name} started on the desktop, but its window didn't show up yet. Open it from Continue.`, "error");
}
