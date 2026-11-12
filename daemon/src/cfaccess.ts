import http from "node:http";
import { createPublicKey, createVerify, type KeyObject } from "node:crypto";

/**
 * Cloudflare Access identity, verified.
 *
 * A plain `cf-access-authenticated-user-email` header proves nothing: anyone
 * who can reach a NODE port by another path (Tailscale serve, LAN) can send it.
 * Only the signed `Cf-Access-Jwt-Assertion` that Cloudflare Access injects is
 * trusted: RS256 signature against the team's published certs, issuer = our
 * team, audience = our Access application, not expired, type "app", with an
 * email claim. Anything else is treated as "no Cloudflare identity" and the
 * cf-access-* headers are removed from the request so they never reach an app.
 *
 * The AUD tag and team domain are public (they appear in every Access login
 * redirect), so defaults live here; override with env if the Access app changes.
 */
export const CF_TEAM = (process.env.NODEOS_CF_ACCESS_TEAM ?? "autumn-bread-a4ec.cloudflareaccess.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
export const CF_AUDS = (process.env.NODEOS_CF_ACCESS_AUD ?? "a40e8536b602868b5bd9b243bdd659e703bf32223104dd320f68467f2657e221")
  .split(",").map((s) => s.trim()).filter(Boolean);

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string };
let keys = new Map<string, KeyObject>();
let keysAt = 0;
let lastFetch = 0;
let lastWarn = 0;

/** Test hook: install keys without the network. */
export function _setKeys(m: Map<string, KeyObject>): void { keys = m; keysAt = Date.now(); lastFetch = Date.now(); }

async function loadKeys(force = false): Promise<void> {
  const now = Date.now();
  if (!force && keys.size && now - keysAt < 3_600_000) return;
  if (now - lastFetch < 10_000) return; // do not hammer the certs endpoint on bad kids
  lastFetch = now;
  try {
    const r = await fetch(`https://${CF_TEAM}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return;
    const d = (await r.json()) as { keys?: Jwk[] };
    const m = new Map<string, KeyObject>();
    for (const k of d.keys ?? []) {
      if (k.kty !== "RSA" || !k.kid) continue;
      try { m.set(k.kid, createPublicKey({ key: { kty: "RSA", n: k.n, e: k.e }, format: "jwk" })); } catch { /* skip bad key */ }
    }
    if (m.size) { keys = m; keysAt = now; }
  } catch { /* network down: keep old keys, fail closed if none */ }
}

function b64urlJson(s: string): Record<string, unknown> | null {
  try { return JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as Record<string, unknown>; } catch { return null; }
}

/** Returns the verified email, or null. Never throws. */
export async function verifyCfJwt(token: string, now = Date.now()): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const hdr = b64urlJson(parts[0]);
  const claims = b64urlJson(parts[1]);
  if (!hdr || !claims || hdr.alg !== "RS256" || typeof hdr.kid !== "string") return null;
  await loadKeys();
  let key = keys.get(hdr.kid);
  if (!key) { await loadKeys(true); key = keys.get(hdr.kid); }
  if (!key) return null;
  const v = createVerify("RSA-SHA256");
  v.update(`${parts[0]}.${parts[1]}`);
  if (!v.verify(key, Buffer.from(parts[2], "base64url"))) return null;
  const sec = Math.floor(now / 1000);
  const skew = 60;
  if (typeof claims.exp !== "number" || claims.exp + skew < sec) return null;
  if (typeof claims.nbf === "number" && claims.nbf - skew > sec) return null;
  if (claims.iss !== `https://${CF_TEAM}`) return null;
  if (claims.type !== undefined && claims.type !== "app") return null;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.some((a) => typeof a === "string" && CF_AUDS.includes(a))) return null;
  const email = claims.email;
  return typeof email === "string" && email.includes("@") ? email : null;
}

function cookieJwt(req: http.IncomingMessage): string {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "CF_Authorization") return v.join("=");
  }
  return "";
}

/**
 * Verified Cloudflare Access email for this request, or null.
 * Side effect: on failure, strips every cf-access-* header so a spoofed
 * identity is never forwarded to an app; on success, pins the email header
 * to the verified claim.
 */
export async function cfAccessEmail(req: http.IncomingMessage): Promise<string | null> {
  const h = req.headers["cf-access-jwt-assertion"];
  const tok = (typeof h === "string" ? h : "") || cookieJwt(req);
  const email = tok ? await verifyCfJwt(tok) : null;
  if (!email) {
    if (tok && Date.now() - lastWarn > 60_000) { lastWarn = Date.now(); console.warn(`cfaccess: rejected a Cloudflare Access JWT for ${req.headers.host ?? "?"} (signature/iss/aud/exp/type check failed)`); }
    for (const k of Object.keys(req.headers)) if (k.startsWith("cf-access-")) delete req.headers[k];
    return null;
  }
  req.headers["cf-access-authenticated-user-email"] = email;
  return email;
}
