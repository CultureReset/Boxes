import { OK, type FeatureStatus } from "./features.js";

/**
 * The wire to the kernel.
 *
 * The shell renders; the kernel decides. Everything on this screen that is a
 * fact about the business — what needs the owner, what ran, what could not be
 * verified — comes from the kernel over HTTP. The daemon holds none of it and
 * never touches the kernel's database.
 *
 * Two halves of the machine written at different times, joined here. That is
 * why the handshake exists: the kernel declares what it is and where its
 * things are, this declares the range it was built against, and a pair that
 * does not fit refuses to start rather than half-working in front of the owner.
 *
 * NO PATH IS WRITTEN DOWN HERE. The handshake carries them, so a kernel can
 * move an endpoint, add a collection, or be replaced by a different
 * implementation entirely without this file being edited. A literal path in
 * this file would be a second place that has to agree with the kernel, and the
 * two would drift.
 */

const BASE = process.env.NODE_KERNEL_URL ?? "http://127.0.0.1:8765";
const TOKEN = process.env.NODE_KERNEL_TOKEN ?? "";
const TIMEOUT_MS = 8000;

/** The kernel interface this daemon was written against. */
export const REQUIRES = { interface: "next-gent.kernel", min: 1, max: 2 };

interface Interface {
  interface: string;
  major: number;
  minor: number;
  version: string;
  reads: Record<string, string>;
  actions: Record<string, { method: string; path: string }>;
  events?: { method: string; path: string; cursor: string };
  /** Null when the kernel offers no way to approve over HTTP. It should be. */
  approvals: unknown;
  approval_channel?: string;
}

interface Handshake {
  status: FeatureStatus;
  version?: string;
  provides?: number;
  declared?: Interface;
}

let handshake: Handshake | null = null;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? res.statusText);
  return data as T;
}

const unavailable = (reason: string): Handshake => ({
  status: { available: false, demo: false, reason },
});

/**
 * Read what the kernel says it is and decide whether to talk to it at all.
 * Cached after the first success; a failure is retried on the next call, so a
 * kernel that starts late is picked up without restarting the shell.
 */
export async function connect(): Promise<Handshake> {
  if (handshake?.status.available) return handshake;
  try {
    const d = await call<Interface>("/interface");
    if (d.interface !== REQUIRES.interface) {
      handshake = unavailable(
        `The kernel says it is "${d.interface}". This screen speaks "${REQUIRES.interface}".`,
      );
    } else if (d.major < REQUIRES.min || d.major >= REQUIRES.max) {
      // Refuse rather than proceed. A mismatched pair fails somewhere worse.
      handshake = {
        ...unavailable(
          `The kernel is version ${d.major} and this screen needs ${REQUIRES.min}. One of them needs updating.`,
        ),
        version: d.version,
        provides: d.major,
      };
    } else {
      handshake = { status: OK, version: d.version, provides: d.major, declared: d };
    }
  } catch (e) {
    handshake = unavailable(`Cannot reach the kernel at ${BASE}. ${(e as Error).message}`);
  }
  return handshake;
}

/** Nothing below runs unless the handshake passed. */
async function declared(): Promise<Interface> {
  const h = await connect();
  if (!h.status.available || !h.declared) throw new Error(h.status.reason ?? "kernel unavailable");
  return h.declared;
}

/** Read a collection the kernel said it has. An undeclared name is an error here,
 *  not a 404 from a guessed path. */
export async function read<T = unknown>(collection: string): Promise<T> {
  const d = await declared();
  const path = d.reads[collection];
  if (!path) {
    throw new Error(
      `This kernel does not offer "${collection}". It offers: ${Object.keys(d.reads).join(", ")}.`,
    );
  }
  return call<T>(path);
}

/** What the kernel offers, for a screen that wants to render what exists rather
 *  than a fixed set of tiles. */
export async function collections(): Promise<string[]> {
  return Object.keys((await declared()).reads);
}

/** Perform a declared action. `{id}` in the declared path is the only
 *  substitution; anything else the kernel wants goes in the body. */
export async function act<T = unknown>(action: string, body?: unknown, id?: string): Promise<T> {
  const d = await declared();
  const spec = d.actions[action];
  if (!spec) {
    throw new Error(
      `This kernel does not offer "${action}". It offers: ${Object.keys(d.actions).join(", ")}.`,
    );
  }
  if (spec.path.includes("{id}") && !id) throw new Error(`"${action}" needs an id`);
  const path = id ? spec.path.replace("{id}", encodeURIComponent(id)) : spec.path;
  return call<T>(path, {
    method: spec.method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Whether this kernel can be approved to over HTTP.
 *
 * It should not be. ASK is answered from the owner's phone over the real SIM,
 * and a screen that renders an approve button has replaced the thing the
 * product exists to do. The shell asks rather than assuming, so a kernel that
 * ever starts offering one is visible instead of silently trusted.
 */
export async function approvalChannel(): Promise<string> {
  const d = await declared();
  return d.approvals ? "http" : (d.approval_channel ?? "unknown");
}

/** Status for the screen: connected, or the plain sentence saying why not. */
export async function kernelStatus() {
  const h = await connect();
  return {
    url: BASE,
    requires: `${REQUIRES.interface} >=${REQUIRES.min} <${REQUIRES.max}`,
    provides: h.version ?? null,
    reads: h.declared ? Object.keys(h.declared.reads).length : 0,
    actions: h.declared ? Object.keys(h.declared.actions) : [],
    approvals: h.declared ? (h.declared.approvals ? "http" : h.declared.approval_channel) : null,
    ...h.status,
  };
}

/** Test seam: forget the cached handshake. */
export function reset() {
  handshake = null;
}
