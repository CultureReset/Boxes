import { readdirSync } from "node:fs";
import { run } from "./exec.js";

/** X displays this user can open, e.g. ":0", ":10.0". */
export function listXDisplays(): string[] {
  const override = process.env.NODEOS_UI_DISPLAY?.trim();
  if (override) return [override];
  let files: string[] = [];
  try {
    files = readdirSync("/tmp/.X11-unix");
  } catch {
    const fallback = process.env.DISPLAY?.trim();
    return fallback ? [fallback] : [];
  }
  const out: string[] = [];
  for (const f of files) {
    const m = /^X(\d+)$/.exec(f);
    if (m) out.push(`:${m[1]}`);
  }
  out.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return out;
}

export interface ScreenSize {
  display: string;
  width: number;
  height: number;
}

export async function screenSize(display: string): Promise<ScreenSize | null> {
  const r = await run("xdpyinfo", ["-display", display], { timeout: 3000, env: displayEnv(display) });
  const m = r.stdout.match(/dimensions:\s+(\d+)x(\d+)/);
  if (!m) return null;
  return { display, width: Number(m[1]), height: Number(m[2]) };
}

/** Env for a child that must talk to a specific X display. */
export function displayEnv(display: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, DISPLAY: display };
  if (process.env.XAUTHORITY) env.XAUTHORITY = process.env.XAUTHORITY;
  return env;
}

/**
 * The display NODE's desktop / TV kiosk actually sits on.
 * Prefers a landscape screen, then :0 (the physical seat), and ignores a
 * portrait xrdp session (e.g. :10 at 816x1544) that made in-app window
 * streams look like a mobile layout.
 */
let cached: { at: number; display: string } | null = null;

export async function uiDisplay(): Promise<string> {
  if (cached && Date.now() - cached.at < 15_000) return cached.display;
  const forced = process.env.NODEOS_UI_DISPLAY?.trim();
  if (forced) {
    cached = { at: Date.now(), display: forced };
    return forced;
  }
  const names = listXDisplays();
  const screens: ScreenSize[] = [];
  for (const name of names) {
    const s = await screenSize(name);
    if (s) screens.push(s);
  }
  const landscape = screens.filter((s) => s.width >= 1280 && s.width >= s.height);
  const pick =
    landscape.find((s) => s.display === ":0" || s.display.startsWith(":0.")) ??
    landscape[0] ??
    screens.find((s) => s.display === ":0" || s.display.startsWith(":0.")) ??
    screens[0];
  const display = pick?.display ?? process.env.DISPLAY?.trim() ?? ":0";
  cached = { at: Date.now(), display };
  return display;
}

export async function uiScreen(): Promise<ScreenSize> {
  const display = await uiDisplay();
  return (await screenSize(display)) ?? { display, width: 1920, height: 1080 };
}
