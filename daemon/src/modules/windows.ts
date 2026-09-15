import net from "node:net";
import path from "node:path";
import { has, run } from "../exec.js";
import { bus } from "../events.js";
import { demoWindows } from "../demo.js";
import { isDemo } from "./status.js";
import { appIdForWindow } from "./apps.js";
import type { WindowEntry } from "../types.js";

export const SHELL_CLASS = "nodeos-shell";
export const HOME_WORKSPACE = "1";

interface HyprClient {
  address: string;
  class: string;
  title: string;
  pid: number;
  workspace: { id: number; name: string };
  focusHistoryID: number;
  mapped: boolean;
  hidden: boolean;
}

export async function listWindows(): Promise<WindowEntry[]> {
  if (await isDemo()) return demoWindows;
  const r = await run("hyprctl", ["clients", "-j"]);
  let clients: HyprClient[] = [];
  try {
    clients = JSON.parse(r.stdout);
  } catch {
    return [];
  }
  const out: WindowEntry[] = [];
  for (const c of clients) {
    if (!c.mapped || c.hidden) continue;
    if (c.class === SHELL_CLASS) continue;
    out.push({
      address: c.address,
      class: c.class,
      title: c.title,
      workspace: c.workspace.id,
      pid: c.pid,
      focused: c.focusHistoryID === 0,
      appId: await appIdForWindow(c.class, c.title),
    });
  }
  return out.sort((a, b) => a.workspace - b.workspace);
}

export async function focusWindow(address: string): Promise<boolean> {
  if (await isDemo()) return true;
  const r = await run("hyprctl", ["dispatch", "focuswindow", `address:${address}`]);
  return r.ok;
}

export async function closeWindow(address: string): Promise<boolean> {
  if (await isDemo()) return true;
  const r = await run("hyprctl", ["dispatch", "closewindow", `address:${address}`]);
  return r.ok;
}

/** Bring the NODE shell back on screen: focus its window, or the home workspace. */
export async function goHome(): Promise<boolean> {
  if (await isDemo()) return true;
  const r = await run("hyprctl", ["dispatch", "focuswindow", `class:${SHELL_CLASS}`]);
  if (!r.ok || /No such window/i.test(r.stdout + r.stderr)) await run("hyprctl", ["dispatch", "workspace", HOME_WORKSPACE]);
  return true;
}

/**
 * Subscribe to Hyprland's event socket and republish window changes over SSE,
 * so the shell's "Continue" row updates the instant an app opens or closes.
 */
export async function watchHyprland(): Promise<void> {
  if (!(await has("hyprctl"))) return;
  const sig = process.env.HYPRLAND_INSTANCE_SIGNATURE;
  const runtime = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
  if (!sig) return;
  const sock = path.join(runtime, "hypr", sig, ".socket2.sock");
  const connect = () => {
    const client = net.createConnection(sock);
    let buf = "";
    let timer: NodeJS.Timeout | null = null;
    client.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        const ev = line.split(">>")[0];
        if (/^(openwindow|closewindow|activewindow|movewindow|windowtitle|workspace|fullscreen)$/.test(ev)) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(async () => bus.emit("windows", await listWindows()), 120);
        }
      }
    });
    client.on("error", () => {});
    client.on("close", () => setTimeout(connect, 3000));
  };
  connect();
}
