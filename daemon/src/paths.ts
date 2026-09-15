import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

export const HOME = os.homedir();
export const DATA_DIR = process.env.NODEOS_DATA_DIR ?? path.join(process.env.XDG_DATA_HOME ?? path.join(HOME, ".local/share"), "nodeos");
export const STATE_DIR = path.join(process.env.XDG_STATE_HOME ?? path.join(HOME, ".local/state"), "nodeos");
export const CONFIG_DIR = path.join(process.env.XDG_CONFIG_HOME ?? path.join(HOME, ".config"), "nodeos");
export const OMARCHY_PATH = process.env.OMARCHY_PATH ?? "/usr/share/omarchy";
export const OMARCHY_STATE = path.join(process.env.XDG_STATE_HOME ?? path.join(HOME, ".local/state"), "omarchy");

for (const dir of [DATA_DIR, STATE_DIR, CONFIG_DIR]) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* read-only home in odd environments is fine; stores fall back to memory */
  }
}
