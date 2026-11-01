import { spawn } from "node:child_process";
import { has, launchDetached, run } from "../../exec.js";
import { bus } from "../../events.js";
import { isDemo } from "../status.js";
import type { AppEntry } from "../../types.js";
import { qualify, type AppProvider } from "./types.js";

/**
 * Android provider: a phone or tablet plugged in over USB becomes part of NODE.
 *
 *   adb     lists devices and installed apps, and starts activities
 *   scrcpy  mirrors the screen (and, on scrcpy >= 3, runs one app in its own
 *           virtual display) as an ordinary window Hyprland shows full width
 *
 * Both are open source (Apache 2.0) and packaged on Arch as `android-tools`
 * and `scrcpy`. The phone must have USB debugging on and have authorised this
 * computer once; NODE surfaces that state instead of hiding it.
 */
export interface AndroidDevice {
  serial: string;
  model: string;
  state: "device" | "unauthorized" | "offline" | "no permissions";
  androidVersion?: string;
}

export interface AndroidStatus {
  available: boolean;
  reason?: string;
  scrcpy: boolean;
  scrcpyVersion?: string;
  devices: AndroidDevice[];
}

/** Friendly names for common packages; everything else is humanised from the package id. */
const KNOWN: Record<string, { name: string; color: string }> = {
  "com.facebook.katana": { name: "Facebook", color: "#1877f2" },
  "com.facebook.orca": { name: "Messenger", color: "#0084ff" },
  "com.instagram.android": { name: "Instagram", color: "#e1306c" },
  "com.whatsapp": { name: "WhatsApp", color: "#25d366" },
  "com.zhiliaoapp.musically": { name: "TikTok", color: "#010101" },
  "com.twitter.android": { name: "X", color: "#000000" },
  "com.google.android.youtube": { name: "YouTube", color: "#ff0000" },
  "com.google.android.gm": { name: "Gmail", color: "#ea4335" },
  "com.google.android.apps.maps": { name: "Google Maps", color: "#34a853" },
  "com.google.android.apps.photos": { name: "Google Photos", color: "#fbbc04" },
  "com.google.android.calendar": { name: "Google Calendar", color: "#4285f4" },
  "com.google.android.apps.docs": { name: "Google Drive", color: "#fbbc04" },
  "com.android.chrome": { name: "Chrome", color: "#4285f4" },
  "com.spotify.music": { name: "Spotify", color: "#1db954" },
  "com.netflix.mediaclient": { name: "Netflix", color: "#e50914" },
  "com.toasttab.pos": { name: "Toast POS", color: "#ff4c00" },
  "com.toasttab.toastgo": { name: "Toast Go", color: "#ff4c00" },
  "com.squareup": { name: "Square POS", color: "#111111" },
  "com.shopify.mobile": { name: "Shopify", color: "#5e8e3e" },
  "com.slack": { name: "Slack", color: "#4a154b" },
  "us.zoom.videomeetings": { name: "Zoom", color: "#2d8cff" },
  "com.microsoft.teams": { name: "Teams", color: "#6264a7" },
  "com.microsoft.office.outlook": { name: "Outlook", color: "#0078d4" },
  "com.canva.editor": { name: "Canva", color: "#00c4cc" },
  "com.amazon.mShop.android.shopping": { name: "Amazon", color: "#ff9900" },
  "com.ubercab": { name: "Uber", color: "#000000" },
  "com.doordash.driverapp": { name: "DoorDash Dasher", color: "#ff3008" },
  "com.dd.doordash": { name: "DoorDash", color: "#ff3008" },
  "com.android.settings": { name: "Android Settings", color: "#636e7b" },
  "com.android.camera2": { name: "Camera", color: "#8e8e93" },
  "com.google.android.GoogleCamera": { name: "Camera", color: "#8e8e93" },
  "com.android.vending": { name: "Play Store", color: "#01875f" },
};

const SYSTEM_NOISE = /^(com\.android\.(providers|systemui|server|inputmethod|bluetooth|nfc|phone|stk|cts|shell|traceur|printspooler|carrierdefaultapp|emergency|companiondevicemanager|storagemanager|dynsystem|wallpaper)|com\.google\.android\.(gms|gsf|ext|overlay|apps\.wellbeing|apps\.restore|configupdater|onetimeinitializer|partnersetup|printservice|syncadapters|tts|webview|feedback|as|permissioncontroller|providers|setupwizard|projection)|android$|com\.qualcomm|com\.samsung\.android\.(app\.settings|providers|server|systemui|incallui|wallpaper|dynamiclock|bixby|honeyboard)|com\.sec\.|org\.chromium\.webview)/;

function humanize(pkg: string): string {
  const last = pkg.split(".").filter((p) => !/^(android|app|apps|mobile|client|main)$/.test(p)).pop() ?? pkg;
  return last.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}

function colorFor(seed: string): string {
  const palette = ["#0a84ff", "#30d158", "#ff9f0a", "#ff453a", "#bf5af2", "#ff375f", "#64d2ff", "#5e5ce6", "#ffd60a", "#ac8e68"];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

const DEMO_DEVICE: AndroidDevice = { serial: "R5CT30ABCDE", model: "Pixel 9", state: "device", androidVersion: "16" };
const DEMO_PACKAGES = ["com.toasttab.pos", "com.facebook.katana", "com.instagram.android", "com.whatsapp", "com.google.android.gm", "com.google.android.apps.maps", "com.spotify.music", "com.squareup", "com.google.android.youtube", "com.slack"];

let scrcpyCache: { ok: boolean; version?: string } | null = null;
async function scrcpyInfo(): Promise<{ ok: boolean; version?: string }> {
  if (scrcpyCache) return scrcpyCache;
  if (!(await has("scrcpy"))) return (scrcpyCache = { ok: false });
  const r = await run("scrcpy", ["--version"]);
  const v = r.stdout.match(/scrcpy\s+v?(\d+\.\d+(?:\.\d+)?)/)?.[1];
  return (scrcpyCache = { ok: true, version: v });
}

export async function androidStatus(): Promise<AndroidStatus> {
  const demo = await isDemo();
  if (!(await has("adb"))) {
    return demo ? { available: true, scrcpy: true, scrcpyVersion: "3.3", devices: [DEMO_DEVICE] } : { available: false, reason: "Install android-tools and scrcpy from the App Store to connect a phone.", scrcpy: false, devices: [] };
  }
  const sc = await scrcpyInfo();
  const r = await run("adb", ["devices", "-l"], { timeout: 6000 });
  const devices: AndroidDevice[] = [];
  for (const line of r.stdout.split("\n").slice(1)) {
    const m = line.trim().match(/^(\S+)\s+(device|unauthorized|offline|no permissions)(.*)$/);
    if (!m) continue;
    const model = m[3].match(/model:(\S+)/)?.[1]?.replace(/_/g, " ") ?? "Android device";
    const dev: AndroidDevice = { serial: m[1], model, state: m[2] as AndroidDevice["state"] };
    if (dev.state === "device") dev.androidVersion = (await run("adb", ["-s", dev.serial, "shell", "getprop", "ro.build.version.release"])).stdout.trim() || undefined;
    devices.push(dev);
  }
  return { available: true, scrcpy: sc.ok, scrcpyVersion: sc.version, reason: sc.ok ? undefined : "Install scrcpy to see the phone's screen.", devices };
}

async function readyDevice(): Promise<AndroidDevice | null> {
  return (await androidStatus()).devices.find((d) => d.state === "device") ?? null;
}

async function listPackages(serial: string): Promise<string[]> {
  if (await isDemo()) return DEMO_PACKAGES;
  // Launchable activities only: apps that have a launcher icon on the phone.
  const r = await run("adb", ["-s", serial, "shell", "cmd", "package", "query-activities", "--brief", "-a", "android.intent.action.MAIN", "-c", "android.intent.category.LAUNCHER"], { timeout: 15000 });
  const pkgs = new Set<string>();
  for (const line of r.stdout.split("\n")) {
    const m = line.trim().match(/^([a-zA-Z0-9_.]+)\/\S+$/);
    if (m && !SYSTEM_NOISE.test(m[1])) pkgs.add(m[1]);
  }
  if (pkgs.size === 0) {
    const fallback = await run("adb", ["-s", serial, "shell", "pm", "list", "packages", "-3"], { timeout: 15000 });
    for (const line of fallback.stdout.split("\n")) {
      const m = line.trim().match(/^package:(\S+)$/);
      if (m) pkgs.add(m[1]);
    }
  }
  return [...pkgs];
}

const MIRROR_ID = "__screen";

async function entries(): Promise<AppEntry[]> {
  const dev = await readyDevice();
  if (!dev) return [];
  const apps: AppEntry[] = [
    { id: qualify("android", MIRROR_ID), provider: "android", name: "Phone screen", comment: `Mirror ${dev.model}`, exec: "scrcpy", icon: "", categories: ["Android"], source: "android", color: "#3ddc84", package: MIRROR_ID },
  ];
  for (const pkg of await listPackages(dev.serial)) {
    const known = KNOWN[pkg];
    apps.push({ id: qualify("android", pkg), provider: "android", name: known?.name ?? humanize(pkg), comment: `On ${dev.model}`, exec: pkg, icon: "", categories: ["Android"], source: "android", color: known?.color ?? colorFor(pkg), package: pkg });
  }
  return apps.sort((a, b) => (a.package === MIRROR_ID ? -1 : b.package === MIRROR_ID ? 1 : a.name.localeCompare(b.name)));
}

/** scrcpy window titles carry the package so the Continue row can map them back. */
function windowTitle(pkg: string): string {
  return pkg === MIRROR_ID ? "NODE Phone" : `NODE Android ${pkg}`;
}

async function launch(pkg: string): Promise<{ ok: boolean; message: string }> {
  const dev = await readyDevice();
  if (!dev) return { ok: false, message: "No phone connected" };
  if (await isDemo()) return { ok: true, message: pkg === MIRROR_ID ? `Would mirror ${dev.model}` : `Would open ${KNOWN[pkg]?.name ?? humanize(pkg)} on ${dev.model}` };
  const sc = await scrcpyInfo();
  const base = ["-s", dev.serial, "--window-title", windowTitle(pkg), "--stay-awake", "--audio-codec=opus"];
  if (pkg === MIRROR_ID) {
    if (!sc.ok) return { ok: false, message: "Install scrcpy to mirror the phone" };
    return launchDetached("scrcpy", base) ? { ok: true, message: `Mirroring ${dev.model}` } : { ok: false, message: "Could not start scrcpy" };
  }
  const major = Number(sc.version?.split(".")[0] ?? 0);
  if (sc.ok && major >= 3) {
    // scrcpy 3: run the app in its own virtual display sized for the TV, phone screen untouched.
    return launchDetached("scrcpy", [...base, "--new-display=1920x1080/240", `--start-app=${pkg}`, "--no-vd-system-decorations"]) ? { ok: true, message: `Opening on ${dev.model}` } : { ok: false, message: "Could not start scrcpy" };
  }
  // Older scrcpy or none: start the app on the phone, then mirror if we can.
  await run("adb", ["-s", dev.serial, "shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"], { timeout: 10000 });
  if (sc.ok) launchDetached("scrcpy", [...base, "--start-app=" + pkg]);
  return { ok: true, message: sc.ok ? `Opening on ${dev.model}` : `Opened on ${dev.model} (install scrcpy to see it here)` };
}

export const androidProvider: AppProvider = {
  id: "android",
  name: "Android phone",
  description: "Apps on a phone plugged in over USB",
  async available() {
    const s = await androidStatus();
    const ok = s.available && s.devices.some((d) => d.state === "device");
    return ok ? { ok } : { ok, reason: s.reason ?? (s.devices.length ? `Phone is ${s.devices[0].state}` : "No phone connected") };
  },
  list: entries,
  launch,
  async matchWindow(cls, title) {
    if (!/scrcpy/i.test(cls)) return undefined;
    if (title === "NODE Phone") return MIRROR_ID;
    return title.match(/^NODE Android (\S+)$/)?.[1] ?? MIRROR_ID;
  },
};

/** Push a live event whenever a phone is plugged in or unplugged. */
export async function watchAndroid(): Promise<void> {
  if (!(await has("adb"))) return;
  const connect = () => {
    const child = spawn("adb", ["track-devices"], { stdio: ["ignore", "pipe", "ignore"] });
    child.on("error", () => {});
    child.unref();
    let timer: NodeJS.Timeout | null = null;
    child.stdout.on("data", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        bus.emit("android", await androidStatus());
        bus.emit("apps", { provider: "android" });
      }, 800);
    });
    child.on("close", () => setTimeout(connect, 5000));
  };
  connect();
}
