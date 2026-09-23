import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Router } from "../router.js";

/**
 * Routes as a folder, not 37 imports at the top of index.ts.
 *
 * The problem this solves: index.ts currently imports named functions from
 * twenty-five modules and wires every route inline. Delete any one module and
 * index.ts stops compiling. Nothing can be removed, nothing can be shipped on
 * its own, and every new feature makes the file longer. That's the stacking.
 *
 * The fix is the same one that worked for capabilities. A route module owns its
 * own paths and registers them itself. index.ts reads the folder and doesn't
 * know or care what's in it.
 *
 * A module that throws on load is SKIPPED WITH A WARNING. The daemon still
 * starts. One broken feature must never take the box down.
 *
 * This is additive. The existing inline routes keep working untouched. Modules
 * move across one at a time, and the box stays up the whole way.
 */

export interface RouteModule {
  /** For the log, so a failure names itself. */
  name: string;
  /** Register this module's paths. Called once at startup. */
  register(api: Router): void | Promise<void>;
}

const LOADABLE = /\.(js|mjs)$/;
const IGNORED = /^[._]|\.test\.|\.d\.ts$|^registry\./;

function candidate(mod: unknown): RouteModule | null {
  const m = mod as { default?: unknown; route?: unknown };
  const v = (m.route ?? m.default ?? mod) as Partial<RouteModule>;
  if (v && typeof v === "object" && typeof v.register === "function") {
    return { name: typeof v.name === "string" ? v.name : "unnamed", register: v.register };
  }
  return null;
}

export interface RouteLoadReport {
  loaded: string[];
  skipped: Map<string, string>;
}

/**
 * Load and register every route module in `dir`. Never throws.
 */
export async function loadRoutes(api: Router, dir: string): Promise<RouteLoadReport> {
  const loaded: string[] = [];
  const skipped = new Map<string, string>();

  let files: string[];
  try {
    files = (await readdir(resolve(dir))).sort();
  } catch {
    return { loaded, skipped }; // no folder yet is fine, not an error
  }

  for (const file of files) {
    if (IGNORED.test(file) || !LOADABLE.test(file)) continue;

    try {
      const mod = await import(pathToFileURL(join(resolve(dir), file)).href);
      const r = candidate(mod);
      if (!r) {
        skipped.set(file, "no register() export");
        continue;
      }
      await r.register(api);
      loaded.push(r.name);
    } catch (e) {
      // One bad route module. The rest of the daemon is unaffected.
      skipped.set(file, (e as Error).message);
    }
  }

  return { loaded, skipped };
}

/** Say what happened. A route that silently failed to register is a ghost. */
export function reportRoutes(r: RouteLoadReport): void {
  if (r.loaded.length) console.log(`routes: +${r.loaded.length} from folder (${r.loaded.join(", ")})`);
  for (const [file, why] of r.skipped) console.warn(`routes: SKIPPED ${file} — ${why}`);
}

/** The one call index.ts makes. */
export async function mountRoutes(api: Router): Promise<void> {
  const dir = new URL("./", import.meta.url).pathname;
  reportRoutes(await loadRoutes(api, dir));
}
