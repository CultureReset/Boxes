import { platformConfig, isConnected } from "./config.js";

/**
 * The client for the platform API.
 *
 * This is the only file on the box that knows the platform's URL shape. The
 * daemon modules above it ask for bookings or a menu; they never build a path.
 *
 * The box holds no database credential and issues no SQL. If this file cannot
 * reach the platform, the box keeps working on local data and says so.
 */

export class PlatformError extends Error {
  constructor(public status: number, message: string, public path: string) {
    super(message);
  }
}

export class NotConnected extends Error {
  constructor() {
    super("This box is not connected to a business yet.");
  }
}

const TIMEOUT_MS = 15_000;

async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE", p: string, body?: unknown): Promise<T> {
  if (!(await isConnected())) throw new NotConnected();
  const { baseUrl, token } = await platformConfig();
  const url = `${baseUrl.replace(/\/$/, "")}${p}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      const err = data && typeof data === "object" && "error" in data ? String((data as Record<string, unknown>).error) : "";
      const msg = err || `HTTP ${res.status}`;
      throw new PlatformError(res.status, msg, p);
    }
    return data as T;
  } catch (e) {
    if (e instanceof PlatformError || e instanceof NotConnected) throw e;
    const msg = (e as Error).name === "AbortError" ? "the platform did not answer in time" : (e as Error).message;
    throw new PlatformError(0, msg, p);
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export const platform = {
  get: <T>(p: string) => call<T>("GET", p),
  post: <T>(p: string, body?: unknown) => call<T>("POST", p, body),
  patch: <T>(p: string, body?: unknown) => call<T>("PATCH", p, body),
  del: <T>(p: string) => call<T>("DELETE", p),
};

/** Query-string helper so callers never hand-build one. */
export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}
