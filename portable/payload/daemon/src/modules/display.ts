import { has, run } from "../exec.js";
import { bus } from "../events.js";
import { check, type FeatureStatus } from "./features.js";

/** Canned level, used only when demo mode is on. */
let demoBrightness = 70;

export interface MonitorResult {
  status: FeatureStatus;
  monitors: Monitor[];
}

/** null means brightness cannot be read here, never a guess. */
export async function brightnessState(): Promise<number | null> {
  const f = await check("brightnessctl");
  if (!f.available) return null;
  if (f.demo) return demoBrightness;
  const r = await run("brightnessctl", ["-m"]);
  // Format: device,class,current,percent%,max
  const m = r.stdout.match(/,(\d+)%,/);
  return m ? Number(m[1]) : null;
}

export async function setBrightness(percent: number): Promise<void> {
  const f = await check("brightnessctl");
  if (!f.available) return;
  if (f.demo) demoBrightness = percent;
  else await run("brightnessctl", ["set", `${percent}%`]);
  bus.emit("brightness", await brightnessState());
}

export interface Monitor {
  name: string;
  description: string;
  width: number;
  height: number;
  refreshRate: number;
  scale: number;
  focused: boolean;
}

export async function monitors(): Promise<MonitorResult> {
  const f = await check("hyprctl");
  if (!f.available) return { status: f, monitors: [] };
  if (f.demo) return { status: f, monitors: [{ name: "eDP-1", description: "Built-in Display", width: 2560, height: 1600, refreshRate: 120, scale: 1.6, focused: true }] };
  const r = await run("hyprctl", ["monitors", "-j"]);
  try {
    const list = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
    return { status: f, monitors: list.map((m) => ({
      name: String(m.name),
      description: String(m.description ?? m.name),
      width: Number(m.width),
      height: Number(m.height),
      refreshRate: Math.round(Number(m.refreshRate)),
      scale: Number(m.scale),
      focused: Boolean(m.focused),
    })) };
  } catch {
    return { status: f, monitors: [] };
  }
}

export async function nightlight(on: boolean): Promise<void> {
  if (await has("omarchy-toggle-nightlight")) await run("omarchy-toggle-nightlight", [on ? "on" : "off"]);
}
