import os from "node:os";
import { readFile, readdir, readlink } from "node:fs/promises";
import path from "node:path";
import { has, run } from "../exec.js";
import { OMARCHY_STATE } from "../paths.js";
import type { Status } from "../types.js";
import { audioState } from "./audio.js";
import { networkState } from "./network.js";
import { bluetoothState } from "./bluetooth.js";
import { brightnessState } from "./display.js";
import { updatesCount } from "./packages.js";

async function battery(): Promise<Status["battery"]> {
  try {
    const entries = await readdir("/sys/class/power_supply");
    const bat = entries.find((e) => /^BAT/i.test(e));
    if (!bat) return { present: false, percent: 100, charging: false };
    const base = `/sys/class/power_supply/${bat}`;
    const percent = Number((await readFile(`${base}/capacity`, "utf8")).trim());
    const status = (await readFile(`${base}/status`, "utf8")).trim();
    return { present: true, percent, charging: status === "Charging" || status === "Full" };
  } catch {
    return null;
  }
}

async function fullName(): Promise<string> {
  try {
    const passwd = await readFile("/etc/passwd", "utf8");
    const line = passwd.split("\n").find((l) => l.startsWith(`${os.userInfo().username}:`));
    const gecos = line?.split(":")[4]?.split(",")[0]?.trim();
    if (gecos) return gecos;
  } catch {
    /* fall through */
  }
  const u = os.userInfo().username;
  return u.charAt(0).toUpperCase() + u.slice(1);
}

export async function themeName(): Promise<string> {
  try {
    const raw = (await readFile(path.join(OMARCHY_STATE, "current/theme.name"), "utf8")).trim();
    return raw.replace(/(^|-)([a-z])/g, (_m, sep, c) => `${sep === "-" ? " " : ""}${c.toUpperCase()}`);
  } catch {
    return "Tokyo Night";
  }
}

export async function backgroundPath(): Promise<string | null> {
  try {
    const link = path.join(OMARCHY_STATE, "current/background");
    const target = await readlink(link).catch(() => link);
    await readFile(target);
    return path.isAbsolute(target) ? target : path.resolve(path.dirname(link), target);
  } catch {
    return null;
  }
}

export async function capabilities(): Promise<Record<string, boolean>> {
  const names = ["hyprctl", "nmcli", "bluetoothctl", "wpctl", "brightnessctl", "pacman", "checkupdates", "omarchy-theme-set", "uwsm-app", "gtk-launch", "xdg-open", "systemctl", "notify-send", "claude", "codex", "opencode"];
  const out: Record<string, boolean> = {};
  await Promise.all(names.map(async (n) => (out[n] = await has(n))));
  return out;
}

let demoCache: boolean | null = null;
/**
 * Demo mode means no graphical session at all: use canned data.
 *
 * This used to test for `hyprctl` alone, which meant any box not running
 * Hyprland was stuck showing sample data forever — including boxes running
 * the X11 session this repo actually ships. box/image/.../cybercheck-session.sh
 * chooses X11 + openbox deliberately, and writes down why: Wayland has no
 * sanctioned way for one process to synthesise input into another's window.
 * So Hyprland cannot be the test for "is there a desktop here".
 *
 * Any of these means a real session, and real data:
 *   - hyprctl present        (Hyprland)
 *   - DISPLAY set            (X11 — the shipped session, and most desktops)
 *   - WAYLAND_DISPLAY set    (some other Wayland compositor)
 *
 * NODEOS_DEMO=1 still forces demo mode on, for showing the box off on a
 * machine that isn't one.
 */
export async function isDemo(): Promise<boolean> {
  if (demoCache !== null) return demoCache;
  if (process.env.NODEOS_DEMO === "1") return (demoCache = true);

  const session =
    !!process.env.DISPLAY ||
    !!process.env.WAYLAND_DISPLAY ||
    (await has("hyprctl"));

  demoCache = !session;
  return demoCache;
}

export async function status(): Promise<Status> {
  const [demo, bat, net, bt, audio, bright, updates, theme, bg, caps] = await Promise.all([
    isDemo(),
    battery(),
    networkState(),
    bluetoothState(),
    audioState(),
    brightnessState(),
    updatesCount(),
    themeName(),
    backgroundPath(),
    capabilities(),
  ]);
  const user = os.userInfo().username;
  return {
    demo,
    user: { name: user, fullName: await fullName(), hostname: os.hostname() },
    time: new Date().toISOString(),
    // A machine with no battery reports none. Only demo mode shows a fake one.
    battery: demo && !bat?.present ? { present: true, percent: 82, charging: false } : bat,
    network: net,
    bluetooth: bt,
    audio,
    brightness: bright,
    updates,
    theme,
    background: bg,
    uptimeSeconds: os.uptime(),
    capabilities: caps,
  };
}

export async function uname(): Promise<Record<string, string>> {
  const kernel = (await run("uname", ["-r"])).stdout.trim() || os.release();
  let distro = "Linux";
  try {
    const rel = await readFile("/etc/os-release", "utf8");
    distro = rel.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1] ?? distro;
  } catch {
    /* ignore */
  }
  const mem = `${Math.round(os.totalmem() / 1024 ** 3)} GB`;
  const cpu = os.cpus()[0]?.model?.replace(/\s+/g, " ").trim() ?? "Unknown CPU";
  return { kernel, distro, memory: mem, cpu, arch: os.arch(), hostname: os.hostname() };
}
