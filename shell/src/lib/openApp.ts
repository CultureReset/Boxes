import { api } from "../api/client";
import type { AppEntry, WindowEntry } from "../api/types";
import { planLaunch, resolveFrameSrc as resolveFrameSrcFor, type LaunchApp } from "./native-open";

/** Everything opens the same way: one view, ready to use.
 *  The decision is planLaunch() — native OS window, door-gated frame, or tab.
 *  On the local Plasma kiosk, native apps raise as one maximized window and
 *  are never also streamed as a JPEG inside NODE. */
export type AppViewTarget =
  | { kind: "web"; url: string; title: string }
  | { kind: "window"; address: string; title: string }
  | { kind: "native"; slug: string; title: string };

export function showAppView(t: AppViewTarget): void {
  // Keep web targets as real iframes (frame-proxy / same-origin).
  // Auto-rewriting to native summary widgets blanked OpenJarvis on the phone.
  window.dispatchEvent(new CustomEvent<AppViewTarget>("node:app-view", { detail: t }));
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

function currentHostname(): string {
  return typeof window !== "undefined" ? window.location.hostname : "";
}

/** Frame src for the in-app iframe. Returns undefined when the tile must not be iframed. */
export function resolveFrameSrc(a: LaunchApp): string | undefined {
  return resolveFrameSrcFor(a, currentHostname());
}

export async function openApp(a: AppEntry, toast?: (m: string, k?: "ok" | "error" | "info") => void): Promise<void> {
  const plan = planLaunch(a, { localDesktop: isLocalDesktopShell(), hostname: currentHostname() });

  // Desktop kiosk + openIn "window": maximized native Chrome, not an in-NODE iframe.
  if (plan.action === "window") {
    const r = await api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id: a.id, desktopWindow: true }).catch((e: Error) => ({ ok: false, message: e.message }));
    if (!r.ok) { toast?.(r.message, "error"); return; }
    toast?.(`Opening ${a.name}…`, "info");
    return;
  }

  if (plan.action === "frame" && plan.url) {
    return showAppView({ kind: "web", url: plan.url, title: a.name });
  }

  if (plan.action === "tab" && plan.url) {
    if (!window.open(plan.url, "_blank", "noopener")) window.location.href = plan.url;
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
