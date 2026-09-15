import { has, run } from "../exec.js";
import { bus } from "../events.js";
import { check, type FeatureStatus } from "./features.js";
import type { Status } from "../types.js";

/** Canned levels, used only when demo mode is on. */
let demoVolume = 62;
let demoMuted = false;

export interface AudioResult {
  status: FeatureStatus;
  outputs: AudioDevice[];
  inputs: AudioDevice[];
}

export async function audioState(): Promise<Status["audio"]> {
  const f = await check("wpctl");
  if (!f.available) return null;
  if (f.demo) return { volume: demoVolume, muted: demoMuted, sink: "Built-in Audio" };
  const r = await run("wpctl", ["get-volume", "@DEFAULT_AUDIO_SINK@"]);
  const m = r.stdout.match(/Volume:\s*([\d.]+)(\s*\[MUTED\])?/);
  const volume = m ? Math.round(Number(m[1]) * 100) : 0;
  const muted = Boolean(m?.[2]);
  const sink = await defaultSinkName();
  return { volume, muted, sink };
}

async function defaultSinkName(): Promise<string> {
  const r = await run("wpctl", ["inspect", "@DEFAULT_AUDIO_SINK@"]);
  const m = r.stdout.match(/node\.description = "([^"]+)"/);
  return m?.[1] ?? "Speakers";
}

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

/** Parse `wpctl status` for sinks (outputs) or sources (inputs). */
async function parseDevices(kind: "sinks" | "sources"): Promise<AudioDevice[]> {
  const r = await run("wpctl", ["status"]);
  const section = kind === "sinks" ? "Sinks:" : "Sources:";
  const lines = r.stdout.split("\n");
  const start = lines.findIndex((l) => l.includes(section));
  if (start < 0) return [];
  const out: AudioDevice[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*[├└│]?\s*$/.test(line) || (!line.includes("│") && !line.includes("├") && !line.includes("└"))) break;
    const m = line.match(/(\*)?\s+(\d+)\.\s+(.+?)\s+\[vol:/);
    if (m) out.push({ id: m[2], name: m[3].trim(), isDefault: Boolean(m[1]) });
    if (line.trim() === "│" || line.trim() === "") break;
  }
  return out;
}

/** Both device lists plus whether the audio tool answered at all. */
export async function audioDevices(): Promise<AudioResult> {
  const f = await check("wpctl");
  if (!f.available) return { status: f, outputs: [], inputs: [] };
  if (f.demo) {
    return {
      status: f,
      outputs: [
        { id: "1", name: "Built-in Audio", isDefault: true },
        { id: "2", name: "AirPods Pro", isDefault: false },
      ],
      inputs: [{ id: "3", name: "Built-in Microphone", isDefault: true }],
    };
  }
  return { status: f, outputs: await parseDevices("sinks"), inputs: await parseDevices("sources") };
}

export async function setVolume(percent: number): Promise<void> {
  const f = await check("wpctl");
  if (!f.available) return;
  if (f.demo) {
    demoVolume = percent;
  } else {
    await run("wpctl", ["set-volume", "-l", "1.0", "@DEFAULT_AUDIO_SINK@", `${percent}%`]);
  }
  bus.emit("audio", await audioState());
}

export async function setMuted(muted: boolean): Promise<void> {
  const f = await check("wpctl");
  if (!f.available) return;
  if (f.demo) demoMuted = muted;
  else await run("wpctl", ["set-mute", "@DEFAULT_AUDIO_SINK@", muted ? "1" : "0"]);
  bus.emit("audio", await audioState());
}

export async function setDefaultDevice(id: string): Promise<void> {
  if (await has("wpctl")) await run("wpctl", ["set-default", id]);
  bus.emit("audio", await audioState());
}
