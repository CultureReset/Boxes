import { useEffect, useRef, useState, useCallback } from "react";

const BASE = "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  markReachable();
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("node:signed-out"));
    const msg = (data as { error?: string } | null)?.error ?? res.statusText;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

/* ---------- Server-sent events: one shared connection for the whole shell ---------- */
type Listener = (data: unknown) => void;
const listeners = new Map<string, Set<Listener>>();
let source: EventSource | null = null;
let connected = false;
const connListeners = new Set<(ok: boolean) => void>();

function ensureSource() {
  if (source) return;
  source = new EventSource(BASE + "/api/events");
  source.onopen = () => {
    connected = true;
    connListeners.forEach((l) => l(true));
  };
  source.onerror = () => {
    connected = false;
    connListeners.forEach((l) => l(false));
  };
  for (const type of listeners.keys()) bind(type);
}

function bind(type: string) {
  source?.addEventListener(type, (ev) => {
    let data: unknown = null;
    try {
      data = JSON.parse((ev as MessageEvent).data);
    } catch {
      /* ignore */
    }
    listeners.get(type)?.forEach((l) => l(data));
  });
}

export function subscribe(type: string, fn: Listener): () => void {
  let set = listeners.get(type);
  const isNew = !set;
  if (!set) {
    set = new Set();
    listeners.set(type, set);
  }
  set.add(fn);
  ensureSource();
  if (isNew) bind(type);
  return () => set!.delete(fn);
}

export function useEvent<T = unknown>(type: string, fn: (data: T) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe(type, (d) => ref.current(d as T)), [type]);
}

/* Reachability: the event stream can drop on mobile networks (iOS/5G/Funnel) even
 * while the door answers fine. "Offline" means the door's own public origin (same
 * origin, /health) truly can't be reached, not merely that the stream blipped. */
let lastReach = 0;
function markReachable() { lastReach = Date.now(); }
async function probeDoor(): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(BASE + "/health", { cache: "no-store", signal: ctl.signal });
    if (r.status < 500) markReachable();
    return r.status < 500;
  } catch { return false; } finally { clearTimeout(t); }
}

export function useConnected(): boolean {
  const [sse, setSse] = useState(connected);
  const [reach, setReach] = useState(true);
  useEffect(() => {
    ensureSource();
    connListeners.add(setSse);
    return () => {
      connListeners.delete(setSse);
    };
  }, []);
  useEffect(() => {
    if (sse) { setReach(true); return; }
    let alive = true, fails = 0;
    const tick = async () => {
      if (Date.now() - lastReach < 15000) { fails = 0; if (alive) setReach(true); return; }
      const ok = await probeDoor();
      fails = ok ? 0 : fails + 1;
      if (alive) setReach(fails < 2);   // two failed probes in a row = really offline
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [sse]);
  return sse || reach;
}

/**
 * Fetch JSON from the daemon and keep it fresh: re-fetches when any of the
 * named SSE events fire, and exposes `reload` for manual refreshes.
 */
export function useApi<T>(path: string | null, refreshOn: string[] = [], deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const gen = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const my = ++gen.current;
    try {
      const d = await api.get<T>(path);
      if (my === gen.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === gen.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (my === gen.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    setLoading(Boolean(path));
    void reload();
  }, [reload, path]);

  useEffect(() => {
    const offs = refreshOn.map((ev) => subscribe(ev, () => void reload()));
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, refreshOn.join("|")]);

  return { data, error, loading, reload, setData };
}
