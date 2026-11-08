/**
 * TV mode: the 10-foot layout. Bigger type, big focus rings, D-pad first.
 * On by choice (Settings → Display) or automatically on a large screen with
 * no pointer, which is what a TV or an HDMI-connected box reports.
 */
export function detectTv(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.has("tv")) return params.get("tv") !== "0";
  const noPointer = window.matchMedia("(hover: none) and (pointer: none), (hover: none) and (pointer: coarse) and (min-width: 1280px)").matches;
  return noPointer && window.innerWidth >= 1280;
}

export function applyTv(on: boolean, scale = 1): void {
  document.documentElement.classList.toggle("tv", on);
  document.documentElement.style.setProperty("--ui-scale", String(on ? Math.max(scale, 1.2) : scale));
}
