import { has, launchDetached, run } from "./exec.js";
import { frames, frameUrlForFrame, localFrameUrlForFrame } from "./frameproxy.js";
import { isDemo } from "./modules/status.js";

/**
 * Open a door-gated web tile as a maximized chromeless Chrome window on the
 * physical Plasma display. The NODE daemon unit often has DISPLAY=:10 (xrdp);
 * the TV / kiosk is :0 unless NODEOS_UI_DISPLAY says otherwise.
 *
 * Never opens the public Cloudflare Access URL — that sends X-Frame-Options
 * DENY and is the wrong target for a local window anyway. Prefer the HTTPS
 * Tailscale frame URL so apps that set Secure cookies (n8n) can keep a session.
 */

const BROWSERS = [
  "google-chrome-stable",
  "google-chrome",
  "chromium",
  "brave",
  "helium",
  "microsoft-edge-stable",
  "/opt/google/chrome/chrome",
];

/** Display for native UI on the physical seat. Never fall back to the daemon's :10. */
export function uiSeatDisplay(): string {
  const forced = process.env.NODEOS_UI_DISPLAY?.trim();
  return forced || ":0";
}

/**
 * URL for a maximized desktop window. HTTPS frameUrl first (Secure cookies),
 * then the loopback door proxy. Never the public Access `url`.
 */
export function desktopFrameUrl(a: { frameUrl?: string; localFrameUrl?: string; url?: string }): string | undefined {
  if (a.frameUrl) return a.frameUrl;
  if (a.localFrameUrl) return a.localFrameUrl;
  return undefined;
}

export function windowClassForSlug(slug: string): string {
  return `nodeos-web-${slug}`;
}

function profileDir(slug: string): string {
  const root = process.env.XDG_STATE_HOME ?? `${process.env.HOME ?? "/home/steve"}/.local/state`;
  return `${root}/nodeos/web-profile-${slug}`;
}

async function maximizeByClass(display: string, cls: string): Promise<void> {
  if (!(await has("wmctrl"))) return;
  const env: NodeJS.ProcessEnv = { ...process.env, DISPLAY: display };
  for (let i = 0; i < 40; i++) {
    const r = await run("wmctrl", ["-lx"], { env, timeout: 3000 });
    const line = r.stdout.split("\n").find((l) => l.toLowerCase().includes(cls.toLowerCase()));
    const id = line?.match(/^(0x[0-9a-f]+)\s+/i)?.[1];
    if (id) {
      await run("wmctrl", ["-ia", id], { env, timeout: 3000 });
      await run("wmctrl", ["-i", "-r", id, "-b", "remove,below"], { env, timeout: 3000 });
      await run("wmctrl", ["-i", "-r", id, "-b", "add,maximized_vert,maximized_horz"], { env, timeout: 3000 });
      return;
    }
    await new Promise((res) => setTimeout(res, 250));
  }
}

async function browserBin(): Promise<string | undefined> {
  for (const b of BROWSERS) {
    if (b.startsWith("/")) {
      if (await fileExists(b)) return b;
    } else if (await has(b)) return b;
  }
  return undefined;
}

async function fileExists(p: string): Promise<boolean> {
  const { access, constants } = await import("node:fs/promises");
  try {
    await access(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Launch (or raise) a maximized --app window on the Plasma seat for this web slug. */
export async function launchDesktopFrameWindow(slug: string): Promise<{ ok: boolean; message: string; url?: string }> {
  const f = frames().find((x) => x.slug === slug);
  const url = desktopFrameUrl({
    frameUrl: f ? frameUrlForFrame(f) : undefined,
    localFrameUrl: f ? localFrameUrlForFrame(f) : undefined,
  });
  if (!url) return { ok: false, message: `No frame proxy for ${slug}` };
  if (await isDemo()) return { ok: true, message: `Opening ${slug}`, url };

  const display = uiSeatDisplay();
  const cls = windowClassForSlug(slug);
  const bin = await browserBin();
  if (!bin) return { ok: false, message: "No browser found" };

  const args = [
    `--app=${url}`,
    `--class=${cls}`,
    `--user-data-dir=${profileDir(slug)}`,
    "--ozone-platform=x11",
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized",
    "--window-position=0,0",
  ];
  const env: NodeJS.ProcessEnv = { ...process.env, DISPLAY: display };
  const ok = launchDetached(bin, args, undefined, env);
  if (ok) void maximizeByClass(display, cls);
  return { ok, message: ok ? `Opening ${slug}` : "Failed to launch the browser", url };
}
