/**
 * One launch rule for every NODE tile. No per-app special cases.
 * Keep in sync with shell/src/lib/native-open.ts.
 *
 *   1. If the tile names a native app (nativeApp, or provider is linux/android),
 *      launch that OS app: on the local Plasma kiosk, raise + maximize it and
 *      do not stream a JPEG copy into NODE; on a phone or remote shell, stream
 *      the window so the app is still visible.
 *   2. Every other (web) tile is a plain top-level link to its own public
 *      Cloudflare hostname — the tile's `url`. It leaves NODE and loads as a
 *      normal full page: no iframe, no frame proxy, no Tailscale port. The
 *      old openIn values "frame", "tab" and "window" all mean this now.
 *      Back (or visiting the NODE URL again) loads the shell, header and all.
 *
 * Native-vs-web is configuration (nativeApp on the tile), not a hardcoded
 * slug. The same functions decide for AppFlowy, n8n, CRM, Rakazo, Odoo, etc.
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

/** Prefer config/webapps.json over a stale saved world-store copy. */
export function effectiveOpenMode(configOpen?: string, savedOpen?: string): string | undefined {
  return configOpen ?? savedOpen;
}
