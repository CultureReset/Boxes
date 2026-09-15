import { has, run } from "../exec.js";
import { isDemo } from "./status.js";

export type PowerAction = "lock" | "sleep" | "restart" | "shutdown" | "logout";

export async function power(action: PowerAction): Promise<{ ok: boolean; message: string }> {
  if (await isDemo()) return { ok: true, message: `Would ${action} (demo mode)` };
  switch (action) {
    case "lock":
      if (await has("omarchy-system-lock")) return finish(await run("omarchy-system-lock"));
      if (await has("hyprlock")) return finish(await run("hyprlock"));
      return finish(await run("loginctl", ["lock-session"]));
    case "sleep":
      return finish(await run("systemctl", ["suspend"]));
    case "restart":
      return finish(await run("systemctl", ["reboot"]));
    case "shutdown":
      return finish(await run("systemctl", ["poweroff"]));
    case "logout":
      if (await has("uwsm")) return finish(await run("uwsm", ["stop"]));
      return finish(await run("hyprctl", ["dispatch", "exit"]));
  }
}

function finish(r: { ok: boolean; stderr: string }) {
  return { ok: r.ok, message: r.ok ? "OK" : r.stderr.trim() || "Failed" };
}

export interface PowerProfile {
  name: string;
  active: boolean;
}

export async function powerProfiles(): Promise<PowerProfile[]> {
  if (!(await has("powerprofilesctl"))) return ["power-saver", "balanced", "performance"].map((n) => ({ name: n, active: n === "balanced" }));
  const list = await run("powerprofilesctl", ["list"]);
  const out: PowerProfile[] = [];
  for (const line of list.stdout.split("\n")) {
    const m = line.match(/^(\*)?\s*([a-z-]+):$/);
    if (m) out.push({ name: m[2], active: Boolean(m[1]) });
  }
  return out;
}

export async function setPowerProfile(name: string): Promise<void> {
  if (!/^[a-z-]+$/.test(name)) return;
  if (await has("powerprofilesctl")) await run("powerprofilesctl", ["set", name]);
}
