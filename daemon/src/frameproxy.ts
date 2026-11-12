import http from "node:http";
import net from "node:net";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { requireDoor, isRemote, doorUser, stripDoorCookie } from "./doorauth.js";
import { cfAccessEmail } from "./cfaccess.js";
import { fileURLToPath } from "node:url";
import { assignMissingServePorts, ensureFrameForApp, frameUrlForFrame, localFrameUrlForFrame } from "./frameassign.js";

/**
 * Frame proxies: one loopback port per web app, fronted by `tailscale serve`
 * (tailnet only). They pass everything through (cookies, websockets) and only
 * remove the headers that stop the NODE app from showing the page inside its
 * own in-app view: X-Frame-Options, CORP, and CSP frame-ancestors.
 */
export interface Frame { slug: string; upstream: string; localPort: number; servePort: number; path: string;
  /** Trusted reverse-proxy login (e.g. Navidrome ReverseProxyUserHeader): header + user set by the proxy only. */
  remoteUserHeader?: string; remoteUser?: string;
  /** Source address for upstream connections (the app whitelists only this address). */
  localAddress?: string }

const DEFAULT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../config/frames.json");

function framesFile(): string {
  return process.env.NODEOS_FRAMES ?? DEFAULT_FILE;
}

export function frames(): Frame[] {
  try { return JSON.parse(readFileSync(framesFile(), "utf8")) as Frame[]; } catch { return []; }
}

function persistFrames(list: Frame[]): void {
  const file = framesFile();
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(list, null, 1) + "\n");
  renameSync(tmp, file);
}

const startedPorts = new Set<number>();
const servedPorts = new Set<number>();

/**
 * Best-effort tailnet-only `tailscale serve` for a frame proxy.
 * RETIRED by default (2026-11-12): tiles are top-level Cloudflare Access links,
 * and the frame-proxy Tailscale ports were an auth side door. Only runs when
 * NODEOS_FRAME_TAILSCALE=1. Missing binary or a failed apply must not take the daemon down.
 */
function applyServe(f: Frame): void {
  if (process.env.NODEOS_FRAME_TAILSCALE !== "1" || process.env.NODEOS_SKIP_SERVE === "1") return;
  if (!f.servePort || !f.localPort || servedPorts.has(f.servePort)) return;
  servedPorts.add(f.servePort);
  const child = spawn("tailscale", ["serve", "--bg", `--https=${f.servePort}`, `http://127.0.0.1:${f.localPort}`], { stdio: "ignore", detached: true });
  child.on("error", (e) => console.error(`tailscale serve ${f.slug} :${f.servePort}: ${(e as Error).message}`));
  child.unref();
}

/**
 * Systemic rule: every web tile gets a door-gated frame (localPort + servePort).
 * Missing servePort is auto-assigned and written back; a slug that is not in
 * frames.json yet gets a new row. The public Cloudflare URL is never the iframe src.
 */
export function ensureFrame(slug: string, opts: { url?: string; upstream?: string; path?: string } = {}): Frame {
  const { list, frame, changed } = ensureFrameForApp(frames(), slug, opts);
  if (changed) persistFrames(list);
  start(frame);
  applyServe(frame);
  return frames().find((x) => x.slug === slug) ?? frame;
}

/** Assign servePort on every existing frame that still has 0, persist, apply serve. */
export function ensureAllFrameServePorts(): Frame[] {
  const { list, changed } = assignMissingServePorts(frames());
  if (changed) persistFrames(list);
  return changed ? frames() : list;
}

export { frameUrlForFrame, localFrameUrlForFrame };

/** Origins allowed to embed these apps. Never '*'. Cloudflare Access front door + Tailscale door. */
const FRAME_ANCESTORS = (
  process.env.NODEOS_FRAME_ANCESTORS
  ?? "https://node.voicecommandapi.com https://steve-ms-7c02.tail1af4f2.ts.net https://steve-ms-7c02.tail1af4f2.ts.net:10000 https://steve-ms-7c02.tail1af4f2.ts.net:14443 http://127.0.0.1:7770 http://localhost:7770"
).trim();

function fixHeaders(h: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = { ...h };
  delete out["x-frame-options"];
  // n8n (and others) send CORP: same-origin, which can block a cross-origin
  // NODE iframe (shell on :14443, frame on :25443).
  delete out["cross-origin-resource-policy"];
  let sawCsp = false;
  for (const k of ["content-security-policy", "content-security-policy-report-only"]) {
    const v = out[k];
    if (!v) continue;
    sawCsp = true;
    const s = (Array.isArray(v) ? v.join(", ") : String(v)).split(";").map((d) => d.trim()).filter((d) => d && !/^frame-ancestors\b/i.test(d));
    s.push(`frame-ancestors 'self' ${FRAME_ANCESTORS}`);
    out[k] = s.join("; ");
  }
  // Apps that only sent X-Frame-Options need an explicit ancestors allow-list.
  if (!sawCsp) out["content-security-policy"] = `frame-ancestors 'self' ${FRAME_ANCESTORS}`;
  return out;
}

/**
 * Auto sign-in. LiteLLM's admin UI: log in server-side with the UI login from
 * LiteLLM's own env file and hand the browser the session cookie, so the phone
 * never sees a login page. Credentials stay on the desktop, never logged.
 */
async function liteLLMLogin(up: URL): Promise<string | null> {
  try {
    const env = readFileSync(process.env.NODEOS_LITELLM_ENV ?? path.join(process.env.HOME ?? "/home/steve", ".config/litellm/litellm.env"), "utf8");
    const get = (k: string) => env.match(new RegExp(`^${k}=["']?([^"'\n]+)`, "m"))?.[1] ?? "";
    const user = get("UI_USERNAME"), pass = get("UI_PASSWORD") || get("LITELLM_MASTER_KEY");
    if (!user || !pass) return null;
    const r = await fetch(`${up.origin}/login`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username: user, password: pass }) });
    const m = (r.headers.get("set-cookie") ?? "").match(/token=([^;]+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

const AUTO: Record<string, (req: http.IncomingMessage, res: http.ServerResponse, up: URL) => Promise<boolean>> = {
  litellm: async (req, res, up) => {
    const url = req.url ?? "/";
    const hasTok = /(?:^|;\s*)token=/.test(req.headers.cookie ?? "");
    const isUi = url === "/ui" || url.startsWith("/ui/") || url.startsWith("/ui?");
    const isLoginPage = /^\/(ui\/)?login|^\/fallback\/login/.test(url);
    if (req.method !== "GET" || !((isUi && !hasTok) || isLoginPage)) return false;
    const tok = await liteLLMLogin(up);
    if (!tok) return false;
    res.writeHead(302, { location: isLoginPage ? "/ui/" : url, "set-cookie": `token=${tok}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`, "cache-control": "no-store" });
    res.end();
    return true;
  },
};

function upstreamHeaders(f: Frame, h: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = { ...h };
  const c = stripDoorCookie(h.cookie); if (c) out.cookie = c; else delete out.cookie;
  if (f.remoteUserHeader) {
    delete out[f.remoteUserHeader.toLowerCase()]; // never trust a client-sent identity header
    if (f.remoteUser) out[f.remoteUserHeader.toLowerCase()] = f.remoteUser;
  }
  return out;
}

function start(f: Frame): void {
  if (!f.localPort || startedPorts.has(f.localPort)) return;
  startedPorts.add(f.localPort);
  const up = new URL(f.upstream);
  const port = Number(up.port || 80);
  const srv = http.createServer(async (req, res) => {
    if (!(await requireDoor(req, res, true))) return;
    if (AUTO[f.slug] && (await AUTO[f.slug](req, res, up))) return;
    const p = http.request({ host: up.hostname, port, method: req.method, path: req.url, headers: upstreamHeaders(f, req.headers), localAddress: f.localAddress }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.statusMessage, fixHeaders(r.headers));
      r.pipe(res);
    });
    p.on("error", (e) => { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" }); res.end(`${f.slug} is not reachable on the desktop: ${e.message}`); });
    req.pipe(p);
  });
  srv.on("upgrade", async (req, sock, head) => {
    const cfOk = Boolean(await cfAccessEmail(req)); // signed JWT only; strips spoofed cf-access-* headers
    if (isRemote(req) && !cfOk && !(await doorUser(req))) { sock.end("HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n"); return; }
    const u = net.connect({ port, host: up.hostname, localAddress: f.localAddress }, () => {
      const lines = [`${req.method} ${req.url} HTTP/1.1`];
      for (const [k, v] of Object.entries(upstreamHeaders(f, req.headers))) for (const x of Array.isArray(v) ? v : [v]) if (x !== undefined) lines.push(`${k}: ${x}`);
      u.write(lines.join("\r\n") + "\r\n\r\n");
      if (head?.length) u.write(head);
      u.pipe(sock); sock.pipe(u);
    });
    u.on("error", () => sock.destroy()); sock.on("error", () => u.destroy());
  });
  srv.on("error", (e) => console.error(`frame proxy ${f.slug} :${f.localPort}: ${e.message}`));
  srv.listen(f.localPort, "127.0.0.1");
}

export function startFrameProxies(): void {
  const list = ensureAllFrameServePorts();
  for (const f of list) {
    start(f);
    applyServe(f);
  }
}


/** Same-origin path under NODE: /frame/<slug>/... → loopback frame proxy (or upstream).
 *  Lets an iframe stay on NODE's origin. Asset-absolute apps (Vite at base `/`) still
 *  need the Tailscale :servePort URL; set NODEOS_FRAME_SAME_ORIGIN=1 only when the
 *  app is built with base `/frame/<slug>/`.
 */
export async function handleSameOriginFrame(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const raw = req.url ?? "/";
  const m = raw.match(/^\/frame\/([a-z0-9-]+)(\/.*)?(?:\?.*)?$/i);
  if (!m) return false;
  const slug = m[1];
  const f = frames().find((x) => x.slug === slug);
  if (!f) { res.writeHead(404, { "content-type": "text/plain" }); res.end(`unknown frame app: ${slug}`); return true; }
  if (!(await requireDoor(req, res, true))) return true;
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  const rest = (m[2] && m[2] !== "") ? m[2] : "/";
  const targetPath = rest + q;
  const up = new URL(f.upstream);
  const useLocal = Boolean(f.localPort);
  const host = useLocal ? "127.0.0.1" : up.hostname;
  const port = useLocal ? f.localPort : Number(up.port || 80);
  const p = http.request({ host, port, method: req.method, path: targetPath, headers: upstreamHeaders(f, req.headers), localAddress: useLocal ? undefined : f.localAddress }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.statusMessage, fixHeaders(r.headers));
    r.pipe(res);
  });
  p.on("error", (e) => { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" }); res.end(`${slug} is not reachable: ${e.message}`); });
  req.pipe(p);
  return true;
}
