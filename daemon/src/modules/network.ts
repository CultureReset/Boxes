import { has, run } from "../exec.js";
import { bus } from "../events.js";
import { demoWifi } from "../demo.js";
import { check, type FeatureStatus } from "./features.js";
import type { Status, WifiNetwork } from "../types.js";

/** Canned networks, used only when demo mode is on. */
let demoNets = demoWifi.map((n) => ({ ...n }));

export interface WifiResult {
  status: FeatureStatus;
  networks: WifiNetwork[];
}

export async function networkState(): Promise<Status["network"]> {
  const f = await check("nmcli");
  if (!f.available) return { online: false, type: "unknown" };
  if (f.demo) {
    const active = demoNets.find((n) => n.active);
    return active ? { online: true, type: "wifi", ssid: active.ssid, signal: active.signal } : { online: false, type: "none" };
  }
  const r = await run("nmcli", ["-t", "-f", "TYPE,STATE,CONNECTION", "device"]);
  const rows = r.stdout.trim().split("\n").map((l) => l.split(":"));
  const wifi = rows.find((c) => c[0] === "wifi" && c[1] === "connected");
  const eth = rows.find((c) => c[0] === "ethernet" && c[1] === "connected");
  if (wifi) {
    const { networks } = await wifiNetworks(false);
    const active = networks.find((n) => n.active);
    return { online: true, type: "wifi", ssid: wifi[2], signal: active?.signal };
  }
  if (eth) return { online: true, type: "ethernet" };
  return { online: false, type: "none" };
}

export async function wifiNetworks(rescan = true): Promise<WifiResult> {
  const f = await check("nmcli");
  if (!f.available) return { status: f, networks: [] };
  if (f.demo) return { status: f, networks: demoNets };
  const args = ["-t", "-f", "ACTIVE,SSID,SIGNAL,SECURITY", "device", "wifi", "list"];
  if (rescan) args.push("--rescan", "yes");
  const r = await run("nmcli", args, { timeout: 15000 });
  const saved = new Set((await run("nmcli", ["-t", "-f", "NAME", "connection", "show"])).stdout.trim().split("\n"));
  const seen = new Map<string, WifiNetwork>();
  for (const line of r.stdout.trim().split("\n")) {
    // nmcli escapes ':' in SSIDs as '\:'
    const cols = line.split(/(?<!\\):/).map((c) => c.replace(/\\:/g, ":"));
    const [active, ssid, signal, security] = cols;
    if (!ssid) continue;
    const entry: WifiNetwork = { ssid, signal: Number(signal), security: security ?? "", active: active === "yes", saved: saved.has(ssid) };
    const prev = seen.get(ssid);
    if (!prev || entry.signal > prev.signal || entry.active) seen.set(ssid, { ...entry, active: entry.active || Boolean(prev?.active) });
  }
  return { status: f, networks: [...seen.values()].sort((a, b) => Number(b.active) - Number(a.active) || b.signal - a.signal) };
}

export async function wifiConnect(ssid: string, password?: string): Promise<{ ok: boolean; message: string }> {
  const f = await check("nmcli");
  if (!f.available) return { ok: false, message: f.reason! };
  if (f.demo) {
    demoNets = demoNets.map((n) => ({ ...n, active: n.ssid === ssid, saved: n.saved || n.ssid === ssid }));
    bus.emit("network", await networkState());
    return { ok: true, message: `Connected to ${ssid}` };
  }
  const args = ["device", "wifi", "connect", ssid];
  if (password) args.push("password", password);
  const r = await run("nmcli", args, { timeout: 30000 });
  bus.emit("network", await networkState());
  return { ok: r.ok, message: r.ok ? `Connected to ${ssid}` : r.stderr.trim() || "Could not connect" };
}

export async function wifiDisconnect(): Promise<void> {
  const f = await check("nmcli");
  if (!f.available) return;
  if (f.demo) demoNets = demoNets.map((n) => ({ ...n, active: false }));
  else {
    const r = await run("nmcli", ["-t", "-f", "DEVICE,TYPE", "device"]);
    const dev = r.stdout.split("\n").map((l) => l.split(":")).find((c) => c[1] === "wifi")?.[0];
    if (dev) await run("nmcli", ["device", "disconnect", dev]);
  }
  bus.emit("network", await networkState());
}

export async function wifiForget(ssid: string): Promise<void> {
  const f = await check("nmcli");
  if (!f.available) return;
  if (f.demo) demoNets = demoNets.map((n) => (n.ssid === ssid ? { ...n, saved: false, active: false } : n));
  else await run("nmcli", ["connection", "delete", "id", ssid]);
  bus.emit("network", await networkState());
}

export async function wifiRadio(on: boolean): Promise<void> {
  if (await has("nmcli")) await run("nmcli", ["radio", "wifi", on ? "on" : "off"]);
  bus.emit("network", await networkState());
}
