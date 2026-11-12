/**
 * Keep in sync with daemon/src/native-open.ts.
 * One launch rule for every NODE tile. No per-app special cases.
 */
export type LaunchAction = "native" | "frame" | "tab" | "window";

export interface LaunchPlan {
  action: LaunchAction;
  nativeId?: string;
  url?: string;
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
