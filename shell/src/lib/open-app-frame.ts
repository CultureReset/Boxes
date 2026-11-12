import type { AppEntry } from "../api/types";

/** NODE TV kiosk on the local Plasma display (?tv=1, or the .tv class). */
export function isLocalDesktopShell(
  search: string = typeof window !== "undefined" ? window.location.search : "",
  tvClass: boolean = typeof document !== "undefined" && document.documentElement.classList.contains("tv"),
): boolean {
  const params = new URLSearchParams(search);
  if (params.has("tv")) return params.get("tv") !== "0";
  return tvClass;
}

/** Frame src for the in-app iframe. Returns undefined when the tile must not be iframed. */
export function resolveFrameSrc(a: AppEntry): string | undefined {
  if (a.provider !== "web") return undefined;
  if (a.openIn === "tab") return undefined;
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const loopback = host === "127.0.0.1" || host === "localhost";
  if (loopback && a.localFrameUrl) return a.localFrameUrl;
  return a.frameUrl;
}
