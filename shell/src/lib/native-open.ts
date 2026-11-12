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
  if (frame && ctx.localDesktop && a.openIn === "window") {
    return { action: "window", url: frame, stream: false };
  }
  if (frame) {
    return { action: "frame", url: frame, stream: false };
  }
  if (a.url) {
    return { action: "tab", url: a.url, stream: false };
  }
  return { action: "tab", stream: false };
}
