import type { IncomingMessage, ServerResponse } from "node:http";

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

export type Handler = (ctx: Ctx) => Promise<unknown> | unknown;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** A very small router: exact paths and `:param` segments, JSON in and out. */
export class Router {
  private routes: Route[] = [];

  private add(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp(
      "^" +
        path.replace(/\/:([a-zA-Z0-9_]+)(\*)?/g, (_m, key: string, star: string | undefined) => {
          keys.push(key);
          return star ? "/(.+)" : "/([^/]+)";
        }) +
        "/?$",
    );
    this.routes.push({ method, pattern, keys, handler });
  }

  get(path: string, handler: Handler) {
    this.add("GET", path, handler);
  }
  post(path: string, handler: Handler) {
    this.add("POST", path, handler);
  }
  delete(path: string, handler: Handler) {
    this.add("DELETE", path, handler);
  }

  /** Returns true when a route handled the request. */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const m = route.pattern.exec(url.pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? "")));
      try {
        const body = req.method === "POST" ? await readJson(req) : undefined;
        const out = await route.handler({ req, res, params, query: url.searchParams, body });
        if (res.writableEnded || res.headersSent) return true; // handler streamed its own response
        sendJson(res, 200, out ?? { ok: true });
      } catch (err) {
        const status = err instanceof HttpError ? err.status : 500;
        const message = err instanceof Error ? err.message : String(err);
        if (!res.headersSent) sendJson(res, status, { error: message });
        else res.end();
      }
      return true;
    }
    return false;
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const type = req.headers["content-type"] ?? "";
  // Requiring a JSON content type forces a CORS preflight for any cross-origin
  // page, and we never answer preflights, so browsers on other origins are shut out.
  if (!type.includes("application/json")) throw new HttpError(415, "Expected application/json");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1024 * 1024) throw new HttpError(413, "Body too large");
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function str(v: unknown, name: string, opts: { optional?: boolean; max?: number } = {}): string {
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return "";
    throw new HttpError(400, `Missing ${name}`);
  }
  if (typeof v !== "string") throw new HttpError(400, `${name} must be a string`);
  if (v.length > (opts.max ?? 4096)) throw new HttpError(400, `${name} too long`);
  return v;
}

export function num(v: unknown, name: string, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `${name} must be a number`);
  return Math.min(max, Math.max(min, n));
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
