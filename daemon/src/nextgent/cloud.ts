import { bus } from "../events.js";
import { HttpError } from "../router.js";
import { env } from "./env.js";
import { readCreds } from "./creds.js";

/**
 * The one way this computer reaches its cloud.
 *
 *   paperclip()  Paperclip, as the owner who approved this computer (board key)
 *   gcr()        gcr-api-clean, with a short-lived business token Paperclip
 *                signs for the company (CONTRACT §1) — the same token Play-user uses
 *
 * The shell never sees either credential; it asks the daemon, the daemon asks
 * the cloud. Which business a call is for comes from the token, never from
 * anything this computer sends.
 */
export class CloudError extends Error {
  constructor(message: string, public status: number, public body: unknown = null) {
    super(message);
  }
  /** The server does not have this route yet (or the service is not configured). */
  get notConnected(): boolean {
    const b = this.body as { error?: string; code?: string } | null;
    if (b && typeof b === "object" && (b.code === "not_configured" || b.code === "not_connected")) return true;
    if (this.status !== 404 && this.status !== 405 && this.status !== 501) return false;
    return !b || typeof b !== "object" || b.error === "API route not found";
  }
  get offline(): boolean {
    return this.status === 0;
  }
}

/* ── reachability, so the screen can say "offline" honestly ─────────────── */

const link = { online: null as boolean | null, lastOk: null as string | null, lastError: null as string | null };

function mark(ok: boolean, why?: string) {
  const was = link.online;
  link.online = ok;
  if (ok) link.lastOk = new Date().toISOString();
  else link.lastError = why ?? "unreachable";
  if (was !== ok) bus.emit("nextgent", { online: ok });
}

export function linkState() {
  return { ...link };
}

export async function call(base: string, path: string, opts: { method?: string; body?: unknown; token?: string; raw?: boolean } = {}): Promise<unknown> {
  if (!base) throw new CloudError("This computer is not configured to reach the cloud.", 503, { code: "box_not_configured" });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(env().timeoutMs),
    });
  } catch (err) {
    mark(false, (err as Error).message);
    throw new CloudError("Could not reach the cloud.", 0);
  }
  mark(true);
  if (res.status === 204) return null;
  const text = await res.text().catch(() => "");
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const b = data as { error?: unknown; message?: unknown } | null;
    const msg = b && typeof b === "object" && typeof (b.error ?? b.message) === "string" ? String(b.error ?? b.message) : `Request failed (${res.status})`;
    throw new CloudError(msg, res.status, data);
  }
  return data;
}

/* ── Paperclip, as the owner who paired this computer ───────────────────── */

export async function paperclip<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const c = await readCreds();
  if (!c.nodeToken) throw new CloudError("This computer is not paired yet.", 401, { code: "not_paired" });
  if (!c.account?.key) throw new CloudError("This computer is paired, but how it reaches the account is not decided yet.", 401, { code: "no_account" });
  return (await call(`${env().paperclipUrl}/api`, path, { method, body, token: c.account.key })) as T;
}

export async function companyId(): Promise<string> {
  const c = await readCreds();
  if (!c.nodeToken) throw new CloudError("This computer is not paired yet.", 401, { code: "not_paired" });
  if (!c.account?.companyId) throw new CloudError("This computer is paired, but how it reaches the account is not decided yet.", 401, { code: "no_account" });
  return c.account.companyId;
}

/* ── gcr-api-clean, with the company's business token ───────────────────── */

const RENEW_MARGIN_MS = 45_000;
let token: { company: string; value: string; expiresAt: number } | null = null;
let pending: Promise<string> | null = null;

/** CONTRACT §1: POST /api/companies/:companyId/business-token → { token, expiresAt }, renewed before it expires. */
export async function businessToken(force = false): Promise<string> {
  const id = await companyId();
  if (!force && token && token.company === id && token.expiresAt - RENEW_MARGIN_MS > Date.now()) return token.value;
  if (pending && !force) return pending;
  const work = paperclip<{ token?: string; expiresAt?: string }>("POST", `/companies/${encodeURIComponent(id)}/business-token`, {}).then((d) => {
    if (!d?.token) throw new CloudError("Paperclip did not return a business token.", 502);
    token = { company: id, value: d.token, expiresAt: Date.parse(d.expiresAt ?? "") || Date.now() + 60_000 };
    return d.token;
  });
  // Share `work` itself with concurrent callers. A promise chained off it
  // (work.finally(...)) rejects alongside it with nobody awaiting it, which
  // Node treats as an unhandled rejection and exits the daemon.
  pending = work;
  const clear = () => {
    if (pending === work) pending = null;
  };
  work.then(clear, clear);
  return work;
}

export function dropBusinessToken(): void {
  token = null;
}

export async function gcr<T = unknown>(method: string, path: string, body?: unknown, opts: { token?: string } = {}): Promise<T> {
  const base = env().gcrUrl ? `${env().gcrUrl}/api` : "";
  if (opts.token) return (await call(base, path, { method, body, token: opts.token })) as T;
  try {
    return (await call(base, path, { method, body, token: await businessToken() })) as T;
  } catch (err) {
    // A token can expire between issue and use: one fresh try before believing a 401.
    if (err instanceof CloudError && err.status === 401) return (await call(base, path, { method, body, token: await businessToken(true) })) as T;
    throw err;
  }
}

/* ── turning results into what a screen needs ───────────────────────────── */

export type SourceState = "ok" | "offline" | "not_connected" | "not_paired" | "no_account" | "not_configured" | "error";

export function stateOf(err: unknown): SourceState {
  if (!(err instanceof CloudError)) return "error";
  const code = (err.body as { code?: string } | null)?.code;
  if (code === "not_paired") return "not_paired";
  if (code === "no_account") return "no_account";
  if (code === "box_not_configured") return "not_configured";
  if (err.offline) return "offline";
  if (err.notConnected) return "not_connected";
  return "error";
}

export interface Settled<T> {
  state: SourceState;
  data: T | null;
  error?: string;
}

export async function settle<T>(work: () => Promise<T>): Promise<Settled<T>> {
  try {
    return { state: "ok", data: await work() };
  } catch (err) {
    return { state: stateOf(err), data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** For proxy routes: a cloud failure keeps its status and message. */
export async function relay<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof CloudError) {
      const state = stateOf(err);
      throw new HttpError(err.offline ? 503 : err.status || 502, state === "error" ? err.message : `${state}: ${err.message}`);
    }
    throw err;
  }
}

export const list = <T = Record<string, unknown>>(d: unknown, key: string): T[] =>
  Array.isArray(d) ? (d as T[]) : d && typeof d === "object" && Array.isArray((d as Record<string, unknown>)[key]) ? ((d as Record<string, unknown>)[key] as T[]) : [];
