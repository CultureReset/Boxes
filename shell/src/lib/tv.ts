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

/**
 * One window, one tab, on every display — TV, Plasma, and phone. Web apps
 * are top-level links to their Cloudflare hostname: leaving NODE for an app
 * is a normal same-tab navigation, and Back (or the NODE URL) loads the shell
 * with its header again. Nothing is framed.
 *
 * What is still stopped is a *new* window or tab (window.open, or a
 * target=_blank / _top / _parent link in the shell): on the kiosk that would
 * spawn a separate Chrome window with no way back to NODE. Those become a
 * same-tab navigation instead.
 */
let shellGuarded = false;
export function guardShellEscape(): void {
  if (shellGuarded) return;
  shellGuarded = true;

  const sameTab = (url: string) => {
    const href = String(url);
    if (!href || href === "about:blank") return;
    window.location.assign(href);
  };

  window.open = ((url?: string | URL, _target?: string, _features?: string) => {
    sameTab(url == null ? "" : String(url));
    return null;
  }) as typeof window.open;

  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a?.href) return;
      const target = (a.getAttribute("target") || "").toLowerCase();
      if (target !== "_blank" && target !== "_top" && target !== "_parent") return;
      e.preventDefault();
      e.stopPropagation();
      sameTab(a.href);
    },
    true,
  );

  document.addEventListener("fullscreenchange", () => {
    // An element going fullscreen inside the shell would cover the NODE
    // header. Exit it; the content stays in its pane.
    const el = document.fullscreenElement;
    if (el && el !== document.documentElement) {
      void document.exitFullscreen?.();
    }
  });
}

export function applyTv(on: boolean, scale = 1): void {
  document.documentElement.classList.toggle("tv", on);
  document.documentElement.style.setProperty("--ui-scale", String(scale));
  guardShellEscape();
}
