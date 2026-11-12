import { has, run } from "../exec.js";
import { isDemo } from "./status.js";
import { uiEnv } from "../ui-display.js";

/**
 * Raise a native app as one clean, fullscreen, app-like window on the
 * Plasma kiosk seat. No JPEG stream, no title-bar "desktop window" look.
 */
export async function maximizeWindow(address: string): Promise<boolean> {
  if (await isDemo()) return true;
  const env = uiEnv();
  if (await has("wmctrl")) {
    await run("wmctrl", ["-ia", address], { env });
    // In case a previous placement pinned the window under the kiosk.
    await run("wmctrl", ["-i", "-r", address, "-b", "remove,below"], { env });
    await run("wmctrl", ["-i", "-r", address, "-b", "add,maximized_vert,maximized_horz"], { env });
    const r = await run("wmctrl", ["-i", "-r", address, "-b", "add,fullscreen"], { env });
    return r.ok;
  }
  if (await has("hyprctl")) {
    await run("hyprctl", ["dispatch", "focuswindow", `address:${address}`]);
    const r = await run("hyprctl", ["dispatch", "fullscreen", "1"]);
    return r.ok;
  }
  return false;
}
