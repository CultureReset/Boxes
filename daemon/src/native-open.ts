/**
 * One launch rule for every NODE tile. No per-app special cases.
 *
 *   1. If the tile names a native app (nativeApp, or provider is linux/android),
 *      launch that OS app: on the local Plasma kiosk, raise + maximize it and
 *      do not stream a JPEG copy into NODE; on a phone or remote shell, stream
 *      the window so the app is still visible.
 *   2. Otherwise, if a door-gated frame-proxy URL exists, open that as an
 *      in-NODE frame, on every display — including tiles marked "window" or
 *      "tab". A raw Chrome window or a top-level tab would drop the NODE
 *      header (Home, Agents, and every nav item). "tab" only meant "don't
 *      iframe the raw Cloudflare Access URL." Once you are already in NODE,
 *      the proxy is the full view and there is no Access wall.
 *   3. Otherwise, if the tile has only a raw URL, still open it as an in-NODE
 *      frame, never a top-level tab.
 *
 * Native-vs-frame is configuration (nativeApp on the tile), not a hardcoded
 * slug. The same functions decide for AppFlowy, n8n, CRM, Rakazo, Odoo, etc.
 */

export type LaunchAction = "native" | "frame" | "tab" | "window";

export interface LaunchPlan {
  action: LaunchAction;
  /** App id to launch when action is "native". */
  nativeId?: string;
  /** Door-gated frame URL, or last-resort tab URL. */
  url?: string;
  /** True only for native apps on a phone/remote shell (they can't see Plasma). */
  stream: boolean;
}

export interface LaunchApp {
  id?: string;
  provider?: string;
  openIn?: string;
  nativeApp?: string;
  frameUrl?: string;
  localFrameUrl?: string;
  url?: string;
}

export interface LaunchContext {
  localDesktop: boolean;
  hostname: string;
}

export function nativeLaunchId(a: LaunchApp): string | undefined {
  if (a.nativeApp && a.nativeApp !== a.id) return a.nativeApp;
  return undefined;
}

/** Prefer config/webapps.json over a stale saved world-store copy. */
export function effectiveOpenMode(configOpen?: string, savedOpen?: string): string | undefined {
  return configOpen ?? savedOpen;
}

/** Frame src: the door-gated proxy, never a raw Access URL. */
export function resolveFrameSrc(a: LaunchApp, hostname: string): string | undefined {
  if (nativeLaunchId(a) || a.openIn === "native") return undefined;
  if (a.provider && a.provider !== "web") return undefined;
  const loopback = hostname === "127.0.0.1" || hostname === "localhost";
  if (loopback && a.localFrameUrl) return a.localFrameUrl;
  return a.frameUrl || undefined;
}

export function planLaunch(a: LaunchApp, ctx: LaunchContext): LaunchPlan {
  const nativeId = nativeLaunchId(a) ?? (a.provider && a.provider !== "web" && a.id ? a.id : undefined);
  if (nativeId) {
    return { action: "native", nativeId, stream: !ctx.localDesktop };
  }
  const frame = resolveFrameSrc(a, ctx.hostname);
  // "window" and "tab" must not leave the NODE shell — the persistent header
  // (Home, Agents, and every nav item) has to stay on screen for every app.
  if (frame) {
    return { action: "frame", url: frame, stream: false };
  }
  if (a.url) {
    return { action: "frame", url: a.url, stream: false };
  }
  return { action: "frame", stream: false };
}
