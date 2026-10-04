import qrcode from "qrcode-generator";
import { bus } from "../events.js";
import { HttpError } from "../router.js";
import { env } from "./env.js";
import { call, CloudError, dropBusinessToken } from "./cloud.js";
import { saveCreds, clearCreds } from "./creds.js";

/**
 * Pairing is this computer's sign-in: the TV device flow (plan §11) in front
 * of gcr-api-clean's enrolment (routes/nodes.js).
 *
 *   1. POST /api/nodes/pair/start { name } → a short user_code to show (and,
 *      when gcr-api-clean has NODE_PAIR_URL, verification_uri_complete for the
 *      QR) and a device_code this computer keeps to itself.
 *   2. The owner, signed in to Play-user, confirms the code there
 *      (POST /api/nodes/pair, owner session). The computer never picks its business.
 *   3. POST /api/nodes/pair/poll { device_code } until it answers once with
 *      this computer's node token.
 */

export interface PairingView {
  phase: "idle" | "waiting" | "paired" | "expired" | "error";
  userCode?: string;
  link?: string | null;
  expiresAt?: string;
  message?: string;
}

interface Pending {
  deviceCode: string;
  view: PairingView;
  interval: number;
}

let pending: Pending | null = null;
let view: PairingView = { phase: "idle" };
let timer: NodeJS.Timeout | null = null;

function set(next: PairingView) {
  view = next;
  bus.emit("nextgent", { pairing: view.phase });
}

export function pairingView(): PairingView {
  return view;
}

export async function startPairing(): Promise<PairingView> {
  const e = env();
  if (!e.gcrUrl) throw new HttpError(503, "Set NEXTGENT_GCR_API_URL so this computer can pair.");
  stop();
  try {
    const d = (await call(`${e.gcrUrl}/api`, "/nodes/pair/start", { method: "POST", body: { name: e.computerName } })) as {
      device_code: string;
      user_code: string;
      expires_in: number;
      interval?: number;
      verification_uri_complete?: string;
    };
    const next: PairingView = {
      phase: "waiting",
      userCode: d.user_code,
      link: d.verification_uri_complete ?? null,
      expiresAt: new Date(Date.now() + d.expires_in * 1000).toISOString(),
    };
    pending = { deviceCode: d.device_code, view: next, interval: Math.max(1, d.interval ?? 5) };
    set(next);
    schedule();
  } catch (err) {
    set({ phase: "error", message: err instanceof CloudError ? (err.offline ? "No internet connection. Check the network and try again." : err.message) : (err as Error).message });
  }
  return view;
}

function schedule() {
  if (!pending) return;
  timer = setTimeout(() => void poll().catch((err) => set({ phase: "error", message: (err as Error).message })), pending.interval * 1000);
  timer.unref();
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
}

async function poll(): Promise<void> {
  const p = pending;
  if (!p) return;
  if (p.view.expiresAt && Date.parse(p.view.expiresAt) < Date.now()) {
    stop();
    set({ phase: "expired", message: "The code expired. Show a new one." });
    return;
  }
  try {
    const r = (await call(`${env().gcrUrl}/api`, "/nodes/pair/poll", { method: "POST", body: { device_code: p.deviceCode } })) as {
      status?: string;
      token?: string;
      node?: { id: string; name: string | null } | null;
    };
    if (r?.status === "approved" && r.token) {
      // Handed over exactly once: keep it before anything else can fail.
      await saveCreds({ nodeToken: r.token, node: r.node ?? undefined, pairedAt: new Date().toISOString() });
      stop();
      set({ phase: "paired" });
      return;
    }
  } catch (err) {
    if (err instanceof CloudError && err.status === 410) {
      stop();
      set({ phase: "expired", message: "The code expired. Show a new one." });
      return;
    }
    if (!(err instanceof CloudError && err.offline)) throw err;
  }
  schedule();
}

/**
 * Forget the pairing on this computer. Unlinking it from the business is the
 * owner's, in the owner app (plan §11: "the owner can unlink the computer from the app").
 */
export async function forgetPairing(): Promise<void> {
  stop();
  dropBusinessToken();
  await clearCreds();
  set({ phase: "idle" });
}

/** The QR as SVG, drawn here so the shell needs no library. */
export function qrSvg(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}
