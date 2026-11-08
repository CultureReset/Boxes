/**
 * Spatial (D-pad) navigation, the way smart TVs move focus.
 *
 * Arrow keys, a TV remote, a game pad or a phone's D-pad move focus to the
 * geometrically nearest control in that direction. Enter activates, Back
 * (Escape / Backspace outside a text field / BrowserBack) closes a sheet or
 * goes back. It works on every native focusable element, so screens need no
 * special markup, and modals automatically trap navigation inside themselves.
 */
const SELECTOR = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Dir = "up" | "down" | "left" | "right";

function visible(el: HTMLElement): boolean {
  if (el.closest("[hidden], [aria-hidden='true']")) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && cs.pointerEvents !== "none";
}

/** The topmost modal layer, or the page. Navigation never escapes it. */
function scope(): HTMLElement {
  const layers = document.querySelectorAll<HTMLElement>(".backdrop, .menu, .popover");
  return (layers[layers.length - 1] as HTMLElement | undefined) ?? document.body;
}

function candidates(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(SELECTOR)].filter(visible);
}

function center(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Score candidates like a TV: strongly prefer the axis of travel, punish sideways drift. */
function pick(from: HTMLElement, dir: Dir, list: HTMLElement[]): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ac = center(a);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === from || from.contains(el) || el.contains(from)) continue;
    const b = el.getBoundingClientRect();
    const bc = center(b);
    let primary: number;
    let secondary: number;
    let overlap: number;
    switch (dir) {
      case "left":
        primary = a.left - b.right;
        secondary = Math.abs(bc.y - ac.y);
        overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        break;
      case "right":
        primary = b.left - a.right;
        secondary = Math.abs(bc.y - ac.y);
        overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        break;
      case "up":
        primary = a.top - b.bottom;
        secondary = Math.abs(bc.x - ac.x);
        overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        break;
      default:
        primary = b.top - a.bottom;
        secondary = Math.abs(bc.x - ac.x);
        overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    }
    if (primary < -Math.min(a.width, a.height) * 0.5) continue; // behind us
    const aligned = overlap > 0;
    const score = Math.max(0, primary) * 1 + secondary * (aligned ? 0.6 : 2.4) + (aligned ? 0 : 200);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function isTextField(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "TEXTAREA" || (tag === "INPUT" && !/^(checkbox|radio|range|button|submit)$/.test((el as HTMLInputElement).type)) || (el as HTMLElement).isContentEditable;
}

export function focusFirst(root: HTMLElement = scope()): void {
  const preferred = root.querySelector<HTMLElement>(".main " + SELECTOR.split(", ").join(", .main ")) ?? candidates(root)[0];
  preferred?.focus({ preventScroll: false });
}

export function initSpatialNavigation(opts: { onBack: () => boolean }): () => void {
  const onKey = (e: KeyboardEvent) => {
    const active = document.activeElement as HTMLElement | null;
    const dirs: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    const dir = dirs[e.key];

    // Back: remote "Back" button arrives as Escape, Backspace, BrowserBack or GoBack.
    if (e.key === "Escape" || e.key === "BrowserBack" || e.key === "GoBack" || (e.key === "Backspace" && !isTextField(active))) {
      if (opts.onBack()) e.preventDefault();
      return;
    }
    if (!dir) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // Inside a text field, left/right edit text; up/down still navigate.
    if (isTextField(active) && (dir === "left" || dir === "right")) return;
    if (active?.tagName === "SELECT" || (active as HTMLInputElement | null)?.type === "range") return;

    const root = scope();
    const list = candidates(root);
    if (list.length === 0) return;
    e.preventDefault();
    if (!active || active === document.body || !root.contains(active)) {
      focusFirst(root);
      return;
    }
    const next = pick(active, dir, list);
    if (next) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
