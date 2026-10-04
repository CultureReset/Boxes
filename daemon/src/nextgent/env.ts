import os from "node:os";

/**
 * Where this computer's cloud lives. Every address and name comes from the
 * environment (documented in .env.example and module.manifest.json); nothing
 * here knows a hostname, a business or a brand.
 *
 *   NEXTGENT_PAPERCLIP_URL   Paperclip: the account, agents, approvals, store, activity
 *                            (used once the account link is decided; see creds.ts)
 *   NEXTGENT_GCR_API_URL     gcr-api-clean: the business's data and the computer pairing
 *   NEXTGENT_ANDROID_URL     nextgent-platform's androidd on this computer (read only from here)
 *   NEXTGENT_ANDROID_TOKEN   the token androidd demands, when it demands one
 *   NEXTGENT_DEVICE_ID       androidd's id for the agent phone
 *   NEXTGENT_EVENTS_SECTION  the gcr-api-clean business section that holds events
 *   NEXTGENT_BRAND_NAME      the product name shown on screen (empty: the business's name)
 *   NEXTGENT_COMPUTER_NAME   the name this computer pairs under (default: its hostname)
 *   NEXTGENT_HTTP_TIMEOUT_MS how long one cloud call may take
 *   NEXTGENT_LOCAL_ANDROID   "1" turns Boxes' own adb provider back on (off: nextgent-platform owns the phone)
 */
const trim = (v: string | undefined) => (v ?? "").trim().replace(/\/+$/, "");

export function env() {
  return {
    paperclipUrl: trim(process.env.NEXTGENT_PAPERCLIP_URL),
    gcrUrl: trim(process.env.NEXTGENT_GCR_API_URL),
    androidUrl: trim(process.env.NEXTGENT_ANDROID_URL),
    androidToken: (process.env.NEXTGENT_ANDROID_TOKEN ?? "").trim(),
    deviceId: (process.env.NEXTGENT_DEVICE_ID ?? "").trim(),
    eventsSection: (process.env.NEXTGENT_EVENTS_SECTION ?? "").trim(),
    brand: (process.env.NEXTGENT_BRAND_NAME ?? "").trim(),
    computerName: (process.env.NEXTGENT_COMPUTER_NAME ?? "").trim() || os.hostname(),
    timeoutMs: Number(process.env.NEXTGENT_HTTP_TIMEOUT_MS) > 0 ? Number(process.env.NEXTGENT_HTTP_TIMEOUT_MS) : 15_000,
  };
}

/** Boxes' own Android control. Off unless asked for: nextgent-platform alone drives the phone. */
export function localAndroidEnabled(): boolean {
  return process.env.NEXTGENT_LOCAL_ANDROID === "1";
}
