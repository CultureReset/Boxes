import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Capability } from "./capabilities.js";

/**
 * Capabilities as a folder, not an array.
 *
 * Before: every capability was compiled into CAPABILITIES. Adding one meant
 * editing daemon source and rebuilding the daemon.
 *
 * After: drop a file into platform/capabilities/, it's there. Delete it, it's
 * gone. A file that won't import, or fails validation, or claims a key that is
 * already taken, is SKIPPED WITH A WARNING and nothing else is affected.
 *
 * That last part is the whole point. One capability breaking must never take
 * the box down.
 *
 * `import type` above is deliberate — it is erased at compile time, so there is
 * no runtime cycle between this file and capabilities.ts.
 */

export interface LoadReport {
  loaded: Capability[];
  /** file -> why it was skipped. Printed at startup, never swallowed. */
  skipped: Map<string, string>;
}

/** Compiled output only. Source .ts is built before the daemon runs. */
const LOADABLE = /\.(js|mjs)$/;
const IGNORED = /^[._]|\.test\.|\.d\.ts$/;

type CapModule = {
  default?: Capability | Capability[];
  capabilities?: Capability | Capability[];
};

function candidatesFrom(m: CapModule): unknown[] {
  const v = m.capabilities ?? m.default ?? m;
  return Array.isArray(v) ? v : [v];
}

/**
 * Check before it joins the registry. Returns why it's rejected, or null.
 * This is what turns a bad file into a log line instead of a crash.
 */
export function invalidReason(c: unknown): string | null {
  if (!c || typeof c !== "object") return "not an object";
  const x = c as Partial<Capability>;

  if (typeof x.key !== "string" || !x.key.trim()) return "missing key";
  if (!/^[a-z0-9]+(\.[a-z0-9_]+)+$/.test(x.key))
    return `key "${x.key}" must be lowercase and dotted, e.g. menu.read`;
  if (typeof x.summary !== "string" || !x.summary.trim())
    return `${x.key}: missing summary`;
  if (!Array.isArray(x.phrases) || x.phrases.length === 0)
    return `${x.key}: needs at least one phrase`;
  if (x.phrases.some((p) => typeof p !== "string" || !p.trim()))
    return `${x.key}: every phrase must be a non-empty string`;
  if (typeof x.readOnly !== "boolean")
    return `${x.key}: readOnly must be true or false, not omitted`;
  if (typeof x.run !== "function") return `${x.key}: run must be a function`;
  if (x.slots !== undefined && (typeof x.slots !== "object" || Array.isArray(x.slots)))
    return `${x.key}: slots must be an object mapping name -> type`;

  return null;
}

/**
 * Load every capability in `dir`.
 *
 * Never throws. Missing folder, unparseable file, failed validation, duplicate
 * key — all produce a skip entry. The box starts with whatever is good.
 *
 * `taken` is the set of keys already claimed by the built-in array, so a file
 * can't silently shadow a compiled-in capability.
 */
export async function loadCapabilities(
  dir: string,
  taken: Iterable<string> = [],
): Promise<LoadReport> {
  const loaded: Capability[] = [];
  const skipped = new Map<string, string>();
  const seen = new Map<string, string>();

  for (const k of taken) seen.set(k, "built-in");

  let files: string[];
  try {
    files = (await readdir(resolve(dir))).sort();
  } catch {
    // No folder yet is normal, not an error. Nothing to load.
    return { loaded, skipped };
  }

  for (const file of files) {
    if (IGNORED.test(file) || !LOADABLE.test(file)) continue;

    let mod: CapModule;
    try {
      mod = (await import(pathToFileURL(join(resolve(dir), file)).href)) as CapModule;
    } catch (e) {
      skipped.set(file, `failed to import: ${(e as Error).message}`);
      continue;
    }

    for (const candidate of candidatesFrom(mod)) {
      const bad = invalidReason(candidate);
      if (bad) {
        skipped.set(file, bad);
        continue;
      }
      const cap = candidate as Capability;

      const prior = seen.get(cap.key);
      if (prior) {
        skipped.set(file, `key "${cap.key}" already claimed by ${prior}`);
        continue;
      }
      seen.set(cap.key, file);
      loaded.push(cap);
    }
  }

  return { loaded, skipped };
}

/**
 * Say what happened, out loud, at startup. A capability that silently failed to
 * load is the worst failure mode this design has, so it is never quiet.
 */
export function report(r: LoadReport): void {
  if (r.loaded.length) {
    console.log(
      `capabilities: +${r.loaded.length} from folder (${r.loaded
        .map((c) => c.key)
        .join(", ")})`,
    );
  }
  for (const [file, why] of r.skipped) {
    console.warn(`capabilities: SKIPPED ${file} — ${why}`);
  }
}

/**
 * The one call capabilities.ts makes. Returns the extra capabilities found on
 * disk, already validated and already checked against the built-in keys.
 */
export async function fromFolder(builtInKeys: Iterable<string>): Promise<Capability[]> {
  const dir = new URL("./capabilities/", import.meta.url).pathname;
  const r = await loadCapabilities(dir, builtInKeys);
  report(r);
  return r.loaded;
}
