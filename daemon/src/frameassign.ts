import type { Frame } from "./frameproxy.js";

/**
 * Stable Tailscale serve ports for known slugs. New apps get the next free
 * port in this same *443 series. These numbers match the door-gated serve
 * mappings already used on the desktop (Twenty is 26443, etc.).
 */
export const PREFERRED_SERVE_PORTS: Record<string, number> = {
  openjarvis: 20443,
  "twenty-crm": 26443,
  paperclip: 30443,
  n8n: 25443,
  litellm: 23443,
  searxng: 29443,
  openclaw: 31443,
  "uptime-kuma": 27443,
  navidrome: 24443,
  crawl4ai: 32443,
  "llama-swap": 33443,
  supabase: 34443,
  notes: 35443,
  crm2: 36443,
  pos: 37443,
  tickets: 38443,
  kamra: 39443,
  rakazo: 40443,
  desktop: 41443,
};

const SERVE_FIRST = 20443;
const SERVE_LAST = 65443;
const SERVE_STEP = 1000;
const LOCAL_FIRST = 17801;
const LOCAL_LAST = 17999;

export function allocateServePort(used: Set<number>, slug?: string): number {
  const preferred = slug ? PREFERRED_SERVE_PORTS[slug] : undefined;
  if (preferred && !used.has(preferred)) return preferred;
  for (let p = SERVE_FIRST; p <= SERVE_LAST; p += SERVE_STEP) {
    if (!used.has(p)) return p;
  }
  throw new Error("no free frame servePort in 20443–65443");
}

export function allocateLocalPort(used: Set<number>): number {
  for (let p = LOCAL_FIRST; p <= LOCAL_LAST; p++) {
    if (!used.has(p)) return p;
  }
  throw new Error("no free frame localPort in 17801–17999");
}

export function usedServePorts(list: Frame[]): Set<number> {
  return new Set(list.map((f) => f.servePort).filter((p) => p > 0));
}

export function usedLocalPorts(list: Frame[]): Set<number> {
  return new Set(list.map((f) => f.localPort).filter((p) => p > 0));
}

/** Fill servePort on every entry that is missing one. Existing non-zero ports stay put. */
export function assignMissingServePorts(list: Frame[]): { list: Frame[]; changed: boolean } {
  const used = usedServePorts(list);
  let changed = false;
  const next = list.map((f) => {
    if (f.servePort) return f;
    const servePort = allocateServePort(used, f.slug);
    used.add(servePort);
    changed = true;
    return { ...f, servePort };
  });
  return { list: next, changed };
}

/**
 * Guarantee a frame (localPort + servePort + upstream) for a web app slug.
 * A brand-new app is appended; an existing row only gets a servePort if it
 * was 0. Public `url` values are used as upstream only when no local
 * upstream is already recorded — the iframe still points at the proxy, not
 * at the raw Cloudflare hostname.
 */
export function ensureFrameForApp(
  list: Frame[],
  slug: string,
  opts: { url?: string; upstream?: string; path?: string } = {},
): { list: Frame[]; frame: Frame; changed: boolean } {
  const existing = list.find((f) => f.slug === slug);
  if (existing) {
    const { list: next, changed } = assignMissingServePorts(list);
    return { list: next, frame: next.find((f) => f.slug === slug)!, changed };
  }
  const serveUsed = usedServePorts(list);
  const localUsed = usedLocalPorts(list);
  const frame: Frame = {
    slug,
    upstream: opts.upstream ?? opts.url ?? "http://127.0.0.1:80",
    localPort: allocateLocalPort(localUsed),
    servePort: allocateServePort(serveUsed, slug),
    path: opts.path ?? "/",
  };
  return { list: [...list, frame], frame, changed: true };
}

export function frameHost(): string {
  return process.env.NODEOS_FRAME_HOST ?? "steve-ms-7c02.tail1af4f2.ts.net";
}

/** Tailscale frame URL advertised to the shell. Never a raw Access hostname. */
export function frameUrlForFrame(f: Frame): string | undefined {
  if (!f.servePort) return undefined;
  if (process.env.NODEOS_FRAME_SAME_ORIGIN === "1") return `/frame/${f.slug}/`;
  const path = f.path || "/";
  return `https://${frameHost()}:${f.servePort}${path}`;
}

export function localFrameUrlForFrame(f: Frame): string | undefined {
  if (!f.localPort) return undefined;
  const path = f.path || "/";
  return `http://127.0.0.1:${f.localPort}${path}`;
}
