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
 * Keep every navigation inside the NODE shell, on every display — TV, Plasma,
 * and phone. A new OS window, a target=_blank / _top / _parent link, or a
 * top-level jump to an app origin (Paperclip, Twenty, n8n, …) leaves the
 * shell and drops the header. Intercept those and open the URL in the
 * in-NODE app view, which sits below the persistent TopBar.
 *
 * This runs for the shell's own document only. Cross-origin iframes are
 * stopped separately (sandbox without allow-popups / allow-top-navigation).
 */
let shellGuarded = false;
export function guardShellEscape(): void {
  if (shellGuarded) return;
  shellGuarded = true;

  const openInShell = (url: string, title?: string) => {
    const href = String(url);
    if (!href || href === "about:blank") return;
    window.dispatchEvent(
      new CustomEvent("node:app-view", { detail: { kind: "web", url: href, title: title || href } }),
    );
  };

  const leavesShell = (href: string): boolean => {
    try {
      return new URL(href, location.href).origin !== location.origin;
    } catch {
      return false;
    }
  };

  window.open = ((url?: string | URL, _target?: string, _features?: string) => {
    const href = url == null ? "" : String(url);
    openInShell(href);
    return window;
  }) as typeof window.open;

  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a?.href) return;
      const target = (a.getAttribute("target") || "").toLowerCase();
      const escapes = target === "_blank" || target === "_top" || target === "_parent";
      if (!escapes && !leavesShell(a.href)) return;
      e.preventDefault();
      e.stopPropagation();
      openInShell(a.href, a.textContent?.trim() || undefined);
    },
    true,
  );

  const nav = (window as Window & { navigation?: EventTarget & { addEventListener: typeof window.addEventListener } }).navigation;
  nav?.addEventListener("navigate", (event: Event) => {
    const e = event as Event & {
      destination?: { url?: string };
      canIntercept?: boolean;
      cancelable?: boolean;
      preventDefault: () => void;
      intercept?: (opts: { handler: () => Promise<void> }) => void;
    };
    const raw = e.destination?.url;
    if (!raw || !leavesShell(raw)) return;
    if (e.cancelable) e.preventDefault();
    const go = () => { openInShell(raw, new URL(raw, location.href).host); };
    if (e.canIntercept && e.intercept) {
      e.intercept({ handler: async () => { go(); } });
    } else {
      go();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    // An iframe with allow=fullscreen (or a same-document request) can cover
    // the NODE header. Exit it; the app stays in its pane.
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
