import { HttpError } from "../router.js";
import { env } from "./env.js";

/**
 * The agent phone, as this screen sees it.
 *
 * nextgent-platform's androidd is the only thing that controls the phone
 * (plan §10–11). Boxes reads its state and asks androidd to open its scrcpy
 * mirror window on the TV — the phone's screen, mirrored, shown here.
 * Nothing here taps, types, launches or sends: those go through
 * nextgent-platform's gate like any other action.
 */
async function androidd(path: string, init: RequestInit = {}): Promise<Response> {
  const e = env();
  if (!e.androidUrl || !e.deviceId) throw new HttpError(503, "The agent phone is not configured on this computer (NEXTGENT_ANDROID_URL, NEXTGENT_DEVICE_ID).");
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (e.androidToken) headers["X-Ghost-Token"] = e.androidToken;
  try {
    return await fetch(`${e.androidUrl}${path}`, { ...init, headers, signal: AbortSignal.timeout(e.timeoutMs) });
  } catch {
    throw new HttpError(503, "nextgent-platform's phone service is not answering on this computer.");
  }
}

const device = () => `/devices/${encodeURIComponent(env().deviceId)}`;

async function json(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export async function phoneStatus() {
  const e = env();
  if (!e.androidUrl || !e.deviceId) return { configured: false, service: false, devices: [], state: null };
  let service = false;
  try {
    service = (await androidd("/health")).ok;
  } catch {
    return { configured: true, service: false, devices: [], state: null };
  }
  const [devices, state] = await Promise.all([
    androidd("/devices").then(async (r) => (r.ok ? await json(r) : [])).catch(() => []),
    androidd(`${device()}/state`).then(async (r) => (r.ok ? await json(r) : { error: ((await json(r)) as { detail?: string } | null)?.detail ?? `androidd answered ${r.status}` })).catch((err: Error) => ({ error: err.message })),
  ]);
  return { configured: true, service, devices: Array.isArray(devices) ? devices : [], state };
}

/** Ask androidd to open its scrcpy mirror window (it owns the window and the phone). */
export async function phoneMirror() {
  const r = await androidd(`${device()}/scrcpy`, { method: "POST" });
  const body = await json(r);
  if (!r.ok) throw new HttpError(r.status === 503 ? 503 : 502, (body as { detail?: string } | null)?.detail ?? "Could not open the mirror.");
  return body;
}
