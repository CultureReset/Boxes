import { has } from "../exec.js";
import { isDemo } from "./status.js";

/**
 * Honesty layer.
 *
 * NODE never invents system state. A panel either shows what the machine
 * actually reports, or it says which tool is missing and offers to install it.
 * Canned data exists for exactly one purpose: previewing the shell on a box
 * with no desktop, and it is only ever returned when demo mode is explicitly
 * on, which the UI labels everywhere it appears.
 */
export interface FeatureStatus {
  /** True when the real tool answered. */
  available: boolean;
  /** True when the payload is canned preview data. Always surfaced in the UI. */
  demo: boolean;
  /** The missing command, e.g. "nmcli". */
  tool?: string;
  /** Arch package that provides it, for the one-tap install. */
  install?: string;
  /** Plain sentence for the user. */
  reason?: string;
}

export const OK: FeatureStatus = { available: true, demo: false };
export const DEMO: FeatureStatus = { available: true, demo: true };

const TOOLS: Record<string, { install: string; what: string }> = {
  nmcli: { install: "networkmanager", what: "Wi-Fi and networking" },
  bluetoothctl: { install: "bluez-utils", what: "Bluetooth" },
  wpctl: { install: "wireplumber", what: "sound" },
  brightnessctl: { install: "brightnessctl", what: "screen brightness" },
  pacman: { install: "", what: "installing and updating software" },
  checkupdates: { install: "pacman-contrib", what: "checking for updates" },
  hyprctl: { install: "hyprland", what: "window management" },
  adb: { install: "android-tools", what: "connecting a phone" },
  scrcpy: { install: "scrcpy", what: "showing a phone's screen" },
};

/**
 * Decide what a subsystem may return. `demo` means "canned data is allowed and
 * will be labelled"; `available: false` means "say what is missing", never
 * "make something up".
 */
export async function check(tool: string): Promise<FeatureStatus> {
  if (await has(tool)) return OK;
  if (await isDemo()) return DEMO;
  const t = TOOLS[tool];
  return {
    available: false,
    demo: false,
    tool,
    install: t?.install || undefined,
    reason: t ? `${t.what[0].toUpperCase()}${t.what.slice(1)} needs ${tool}, which is not installed on this machine.` : `This needs ${tool}, which is not installed on this machine.`,
  };
}
