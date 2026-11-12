import { has, run } from "../exec.js";
import { isDemo } from "./status.js";

/**
 * Raise and maximize a window on the local Plasma display.
 * The daemon unit may have DISPLAY=:10 (xrdp); native apps launched from
 * NODE's kiosk live on the physical seat, which is :0 unless overridden.
 */
function plasmaEnv(): NodeJS.ProcessEnv {
  const display = (process.env.NODEOS_UI_DISPLAY ?? ":0").trim() || ":0";
  const env: NodeJS.ProcessEnv = { ...process.env, DISPLAY: display };
  if (process.env.XAUTHORITY) env.XAUTHORITY = process.env.XAUTHORITY;
  return env;
}

export async function maximizeWindow(address: string): Promise<boolean> {
  if (await isDemo()) return true;
  const env = plasmaEnv();
  if (await has("wmctrl")) {
    await run("wmctrl", ["-ia", address], { env });
    // In case a previous placement pinned the window under the kiosk.
    await run("wmctrl", ["-i", "-r", address, "-b", "remove,below"], { env });
    const r = await run("wmctrl", ["-i", "-r", address, "-b", "add,maximized_vert,maximized_horz"], { env });
    return r.ok;
  }
  if (await has("hyprctl")) {
    await run("hyprctl", ["dispatch", "focuswindow", `address:${address}`]);
    const r = await run("hyprctl", ["dispatch", "fullscreen", "1"]);
    return r.ok;
  }
  return false;
}
