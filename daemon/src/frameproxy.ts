import http from "node:http";
import net from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { requireDoor, isRemote, doorUser, stripDoorCookie } from "./doorauth.js";
import { fileURLToPath } from "node:url";

/**
 * Frame proxies: one loopback port per web app, fronted by `tailscale serve`
 * (tailnet only). They pass everything through (cookies, websockets) and only
 * remove the headers that stop the NODE app from showing the page inside its
 * own in-app view: X-Frame-Options and CSP frame-ancestors.
 */
export interface Frame { slug: string; upstream: string; localPort: number; servePort: number; path: string;
  /** Trusted reverse-proxy login (e.g. Navidrome ReverseProxyUserHeader): header + user set by the proxy only. */
  remoteUserHeader?: string; remoteUser?: string;
  /** Source address for upstream connections (the app whitelists only this address). */
  localAddress?: string }

const FILE = process.env.NODEOS_FRAMES ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../../config/frames.json");

export function frames(): Frame[] {
  try { return JSON.parse(readFileSync(FILE, "utf8")) as Frame[]; } catch { return []; }
}

const NODE_ORIGIN = process.env.NODEOS_PUBLIC_ORIGIN ?? "https://steve-ms-7c02.tail1af4f2.ts.net:14443";

function fixHeaders(h: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = { ...h };
  delete out["x-frame-options"];
  for (const k of ["content-security-policy", "content-security-policy-report-only"]) {
    const v = out[k];
    if (!v) continue;
    const s = (Array.isArray(v) ? v.join(", ") : String(v)).split(";").map((d) => d.trim()).filter((d) => d && !/^frame-ancestors\b/i.test(d));
    s.push(`frame-ancestors 'self' ${NODE_ORIGIN}`);
    out[k] = s.join("; ");
  }
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
    if (isRemote(req) && !(await doorUser(req))) { sock.end("HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n"); return; }
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
  for (const f of frames()) start(f);
}
