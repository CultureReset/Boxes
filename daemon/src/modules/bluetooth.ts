import { has, run } from "../exec.js";
import { bus } from "../events.js";
import { demoBluetooth } from "../demo.js";
import { check, type FeatureStatus } from "./features.js";
import type { BluetoothDevice, Status } from "../types.js";

export interface BluetoothResult {
  status: FeatureStatus;
  devices: BluetoothDevice[];
}

let demoDevices = demoBluetooth.map((d) => ({ ...d }));
let demoPowered = true;

function typeFromIcon(icon: string): BluetoothDevice["type"] {
  if (/audio|headset|headphone/.test(icon)) return "audio";
  if (/input|mouse|keyboard/.test(icon)) return "input";
  if (/video|display|tv/.test(icon)) return "display";
  if (/phone/.test(icon)) return "phone";
  return "other";
}

export async function bluetoothState(): Promise<Status["bluetooth"]> {
  const f = await check("bluetoothctl");
  if (!f.available) return { powered: false, connected: [], unavailable: true };
  if (f.demo) return { powered: demoPowered, connected: demoDevices.filter((d) => d.connected).map((d) => d.name) };
  const show = await run("bluetoothctl", ["show"]);
  const powered = /Powered:\s*yes/.test(show.stdout);
  const devices = powered ? (await bluetoothDevices()).devices : [];
  return { powered, connected: devices.filter((d) => d.connected).map((d) => d.name) };
}

export async function bluetoothDevices(): Promise<BluetoothResult> {
  const f = await check("bluetoothctl");
  if (!f.available) return { status: f, devices: [] };
  if (f.demo) return { status: f, devices: demoDevices };
  const paired = await run("bluetoothctl", ["devices", "Paired"]);
  const all = await run("bluetoothctl", ["devices"]);
  const seen = new Map<string, BluetoothDevice>();
  const pairedMacs = new Set(paired.stdout.split("\n").map((l) => l.split(" ")[1]).filter(Boolean));
  for (const line of all.stdout.trim().split("\n")) {
    const m = line.match(/^Device\s+([0-9A-F:]{17})\s+(.*)$/i);
    if (!m) continue;
    const [, mac, name] = m;
    const info = await run("bluetoothctl", ["info", mac]);
    const connected = /Connected:\s*yes/.test(info.stdout);
    const icon = info.stdout.match(/Icon:\s*(\S+)/)?.[1] ?? "";
    // Skip unnamed advertisement noise unless paired.
    if (!pairedMacs.has(mac) && /^[0-9A-F:-]+$/i.test(name)) continue;
    seen.set(mac, { mac, name, connected, paired: pairedMacs.has(mac), type: typeFromIcon(icon) });
  }
  return { status: f, devices: [...seen.values()].sort((a, b) => Number(b.connected) - Number(a.connected) || Number(b.paired) - Number(a.paired)) };
}

export async function bluetoothPower(on: boolean): Promise<void> {
  const f = await check("bluetoothctl");
  if (!f.available) return;
  if (f.demo) demoPowered = on;
  else await run("bluetoothctl", ["power", on ? "on" : "off"]);
  bus.emit("bluetooth", await bluetoothState());
}

export async function bluetoothConnect(mac: string, connect: boolean): Promise<{ ok: boolean; message: string }> {
  const f = await check("bluetoothctl");
  if (!f.available) return { ok: false, message: f.reason! };
  if (f.demo) {
    demoDevices = demoDevices.map((d) => (d.mac === mac ? { ...d, connected: connect, paired: true } : d));
    bus.emit("bluetooth", await bluetoothState());
    return { ok: true, message: connect ? "Connected" : "Disconnected" };
  }
  if (connect) {
    const info = await run("bluetoothctl", ["info", mac]);
    if (!/Paired:\s*yes/.test(info.stdout)) await run("bluetoothctl", ["pair", mac], { timeout: 30000 });
    await run("bluetoothctl", ["trust", mac]);
  }
  const r = await run("bluetoothctl", [connect ? "connect" : "disconnect", mac], { timeout: 30000 });
  bus.emit("bluetooth", await bluetoothState());
  return { ok: r.ok, message: r.ok ? (connect ? "Connected" : "Disconnected") : r.stderr.trim() || r.stdout.trim() || "Failed" };
}

export async function bluetoothScan(seconds = 6): Promise<void> {
  if (await has("bluetoothctl")) await run("bluetoothctl", ["--timeout", String(seconds), "scan", "on"], { timeout: (seconds + 2) * 1000 });
}

export async function bluetoothForget(mac: string): Promise<void> {
  const f = await check("bluetoothctl");
  if (!f.available) return;
  if (f.demo) demoDevices = demoDevices.filter((d) => d.mac !== mac);
  else await run("bluetoothctl", ["remove", mac]);
  bus.emit("bluetooth", await bluetoothState());
}
