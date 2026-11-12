/**
 * Permanent rule (Matt, 2026-11-11): EVERY service-facing tile or link must
 * go through Cloudflare Access. No Tailscale URLs, raw IPs, or plain http.
 *
 * New app workflow:
 *   1) Create the Cloudflare hostname, DNS, and Access policy
 *   2) Commit the URL to GitHub
 *   3) Apply live
 *
 * Allowed hostnames are https://*.voicecommandapi.com (and the apex).
 * Tailscale (*.ts.net and 100.64.0.0/10) is a LAN fallback only, never a tile URL.
 */

export const ACCESS_HOST_SUFFIX = ".voicecommandapi.com";
export const ACCESS_URL_RULE =
  "Every service-facing tile or link must use a Cloudflare Access URL (https://*.voicecommandapi.com). Create the hostname, DNS, and Access first, then commit to GitHub, then apply. Tailscale, raw IPs, and http:// are not allowed.";

const TS_HOST = /\.ts\.net$/i;

function ipv4ToInt(host: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

/** Tailscale CGNAT (100.64.0.0/10) plus any other raw IP — never a public tile. */
export function isForbiddenHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (TS_HOST.test(h)) return true;
  const n = ipv4ToInt(h);
  if (n === null) return false;
  // 100.64.0.0/10 (Tailscale), 10/8, 127/8, 192.168/16, 172.16/12, link-local 169.254/16
  if ((n >>> 22) === (0x64400000 >>> 22)) return true; // 100.64/10
  if ((n >>> 24) === 10 || (n >>> 24) === 127) return true;
  if ((n >>> 16) === 0xc0a8 || (n >>> 16) === 0xa9fe) return true;
  if ((n >>> 20) === (0xac100000 >>> 20)) return true;
  return true; // any other raw IP is also forbidden as a tile URL
}

export function isCloudflareAccessUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (isForbiddenHost(host)) return false;
    return host === "voicecommandapi.com" || host.endsWith(ACCESS_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export function accessUrlError(url: string): string | null {
  return isCloudflareAccessUrl(url) ? null : ACCESS_URL_RULE;
}
