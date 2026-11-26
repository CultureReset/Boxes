/**
 * Keep in sync with daemon/src/native-open.ts.
 * One launch rule for every NODE tile. No per-app special cases.
 *
 *   1. Native tiles (nativeApp, or provider linux/android) launch the OS app.
 *   2. Every web tile is a top-level navigation to its Cloudflare hostname
 *      (the tile's `url`). No iframe, no framing. Returning to NODE (Back,
 *      or opening the NODE URL) reloads the shell with its header.
 */
export type LaunchAction = "native" | "navigate";

export interface LaunchPlan {
  action: LaunchAction;
  /** App id to launch when action is "native". */
  nativeId?: string;
  /** The tile's public Cloudflare hostname, opened as a top-level page. */
  url?: string;
  /** True only for native apps on a phone/remote shell (they can't see Plasma). */
  stream: boolean;
}

export interface LaunchApp {
  id?: string;
  provider?: string;
  openIn?: string;
  nativeApp?: string;
  url?: string;
}

export interface LaunchContext {
  localDesktop: boolean;
}

export function nativeLaunchId(a: LaunchApp): string | undefined {
  if (a.nativeApp && a.nativeApp !== a.id) return a.nativeApp;
  return undefined;
}

export function planLaunch(a: LaunchApp, ctx: LaunchContext): LaunchPlan {
  const nativeId = nativeLaunchId(a) ?? (a.provider && a.provider !== "web" && a.id ? a.id : undefined);
  if (nativeId) {
    return { action: "native", nativeId, stream: !ctx.localDesktop };
  }
  // Every web tile — whatever its old openIn ("frame", "tab", "window") —
  // is a plain top-level link to its own hostname. Never an iframe, never a
  // frame-proxy or Tailscale URL. NODE Home is one Back (or one visit) away.
  return { action: "navigate", url: a.url || undefined, stream: false };
}

/** href for a tile that opens as a top-level link, or undefined for native tiles. */
export function launchHref(a: LaunchApp): string | undefined {
  const plan = planLaunch(a, { localDesktop: false });
  return plan.action === "navigate" ? plan.url : undefined;
}
