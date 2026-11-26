import path from "node:path";
import { existsSync, mkdirSync, readdirSync, cpSync, rmSync } from "node:fs";
import { HOME } from "./paths.js";
import { run } from "./exec.js";
import { displayEnv, uiScreen } from "./xdisplay.js";

const CONFIG_HOME = process.env.XDG_CONFIG_HOME ?? path.join(HOME, ".config");
export const CLAUDE_UI_PROFILE = path.join(CONFIG_HOME, "node-claude-ui");
const CLAUDE_SRC_PROFILE = path.join(CONFIG_HOME, "Claude");

/** Heavy or instance-locked paths we do not copy into the NODE-managed profile. */
const SKIP = new Set([
  "SingletonCookie",
  "SingletonLock",
  "SingletonSocket",
  "Cache",
  "Code Cache",
  "GPUCache",
  "GPUPersistentCache",
  "DawnWebGPUCache",
  "DawnGraphiteCache",
  "Crashpad",
  "logs",
  "blob_storage",
  "local-agent-mode-sessions",
  "claude-code",
  "Crash Reports",
]);

/**
 * A second Claude Desktop profile so NODE can open a desktop-width window on
 * the physical display without stealing the existing instance on the portrait
 * xrdp session (single-instance lock). Copies just enough session data to
 * stay signed in; never overwrites an already-initialized profile.
 */
export function ensureClaudeUiProfile(): string {
  mkdirSync(CLAUDE_UI_PROFILE, { recursive: true });
  if (existsSync(path.join(CLAUDE_UI_PROFILE, "Cookies")) || existsSync(path.join(CLAUDE_UI_PROFILE, "Preferences"))) {
    return CLAUDE_UI_PROFILE;
  }
  if (!existsSync(CLAUDE_SRC_PROFILE)) return CLAUDE_UI_PROFILE;
  try {
    for (const name of readdirSync(CLAUDE_SRC_PROFILE)) {
      if (SKIP.has(name)) continue;
      const src = path.join(CLAUDE_SRC_PROFILE, name);
      const dest = path.join(CLAUDE_UI_PROFILE, name);
      if (existsSync(dest)) continue;
      cpSync(src, dest, {
        recursive: true,
        filter: (p) => !SKIP.has(path.basename(p)),
      });
    }
  } catch {
    // A partial copy still lets the app start; the user can sign in if needed.
  }
  for (const lock of ["SingletonCookie", "SingletonLock", "SingletonSocket"]) {
    try {
      rmSync(path.join(CLAUDE_UI_PROFILE, lock), { force: true });
    } catch {
      /* ignore */
    }
  }
  return CLAUDE_UI_PROFILE;
}

function parseWmctrlId(line: string): string | null {
  const m = line.match(/^(0x[0-9a-f]+)\s+/i);
  return m ? m[1] : null;
}

/** Resize a newly mapped app window to the UI display and keep it under the kiosk. */
export async function placeDesktopAppWindow(display: string, classNeedle: string, pid?: number): Promise<boolean> {
  const env = displayEnv(display);
  const needle = classNeedle.toLowerCase();
  const screen = await uiScreen();
  const width = Math.max(1280, screen.width);
  const height = Math.max(720, screen.height);
  for (let i = 0; i < 40; i++) {
    const r = await run("wmctrl", ["-lpGx"], { env, timeout: 3000 });
    const lines = r.stdout.split("\n").filter(Boolean);
    const hit = lines.find((line) => {
      const lower = line.toLowerCase();
      if (!lower.includes(needle)) return false;
      if (pid && !lower.includes(String(pid))) return false;
      return true;
    });
    const id = hit ? parseWmctrlId(hit) : null;
    if (id) {
      await run("wmctrl", ["-i", "-r", id, "-e", `0,0,0,${width},${height}`], { env, timeout: 3000 });
      await run("wmctrl", ["-i", "-r", id, "-b", "add,below"], { env, timeout: 3000 });
      return true;
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  return false;
}
