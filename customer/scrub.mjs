// Keeps the platform owner's own values out of a customer image.
//
//   node customer/scrub.mjs [--root DIR] [DIR...]
//
// 1. Reads the values from daemon/src/homeDefaults.ts (the one place they live) and replaces the
//    compiled daemon/dist/homeDefaults.js with a copy whose values are all empty strings.
// 2. Looks for those values, and the host names, name parts and paths derived from them, in every
//    file under the given directories (default: daemon/dist and shell/dist, i.e. both halves of what a
//    customer receives). Any hit stops the build with exit code 1.
//
// The values are never written in this file or in the Dockerfile, and a hit is reported by file and by
// which default it came from, never by printing the value.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  let root = path.resolve(here, "..");
  const dirs = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root") root = path.resolve(argv[++i] ?? "");
    else dirs.push(argv[i]);
  }
  return { root, dirs: dirs.length ? dirs : ["daemon/dist", "shell/dist"] };
}

/** { key: value } for every string-valued key of HOME_DEFAULTS in the TypeScript source. */
export function readHomeDefaults(source) {
  const block = /HOME_DEFAULTS\s*=\s*\{([\s\S]*?)\}/.exec(source)?.[1] ?? "";
  const out = {};
  for (const m of block.matchAll(/(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/g)) out[m[1]] = m[2];
  return out;
}

/** What to look for, per key: the value, host names and name parts in it, and sub-paths of a path. */
export function needlesFor(value) {
  const found = new Set();
  const add = (s) => { if (s && s.length >= 3) found.add(s); };
  add(value);
  if (/^https?:\/\//i.test(value)) {
    let host = "";
    try { host = new URL(value).hostname; } catch { /* not a URL after all */ }
    add(host);
    for (const label of host.split(".")) if (label.length >= 6) add(label); // e.g. machine and tailnet names
  }
  if (value.startsWith("/")) {
    const segs = value.split("/").filter(Boolean);
    if (segs.length >= 2) add("/" + segs[0]); // a root directory of the owner's disks
    for (let i = 0; i < segs.length; i += 1) for (let j = i + 2; j <= segs.length; j += 1) add("/" + segs.slice(i, j).join("/"));
  }
  return [...found];
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A plain name is matched as a whole word, any case; everything else as a substring, any case. */
export function matcherFor(needle) {
  return /^[A-Za-z]+$/.test(needle) ? new RegExp(`\\b${escapeRe(needle)}\\b`, "i") : new RegExp(escapeRe(needle), "i");
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

export function scrub({ root, dirs }) {
  const src = path.join(root, "daemon/src/homeDefaults.ts");
  const defaults = readHomeDefaults(fs.readFileSync(src, "utf8"));
  const keys = Object.keys(defaults);
  if (keys.length === 0 || keys.every((k) => defaults[k] === "")) throw new Error("no values found in daemon/src/homeDefaults.ts; refusing to continue (the scan would prove nothing)");

  const compiled = path.join(root, "daemon/dist/homeDefaults.js");
  if (!fs.existsSync(path.dirname(compiled))) throw new Error("daemon/dist does not exist; build first");
  fs.writeFileSync(compiled, `export const HOME_DEFAULTS = { ${keys.map((k) => `${k}: ""`).join(", ")} };\n`);

  const checks = keys.flatMap((k) => (defaults[k] ? needlesFor(defaults[k]).map((n) => ({ key: k, re: matcherFor(n) })) : []));
  const hits = [];
  let scanned = 0;
  for (const d of dirs) {
    const abs = path.resolve(root, d);
    if (!fs.existsSync(abs)) throw new Error(`${d} does not exist; build first`);
    for (const file of walk(abs)) {
      scanned += 1;
      const text = fs.readFileSync(file, "latin1");
      for (const c of checks) if (c.re.test(text)) hits.push({ file: path.relative(root, file), key: c.key });
    }
  }
  return { keys, scanned, hits, checks: checks.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const r = scrub(parseArgs(process.argv.slice(2)));
    if (r.hits.length) {
      const seen = new Set();
      console.error("scrub FAILED: the platform owner's values are still in what a customer would receive:");
      for (const h of r.hits) {
        const line = `  ${h.file}  (derived from HOME_DEFAULTS.${h.key})`;
        if (!seen.has(line)) { seen.add(line); console.error(line); }
      }
      process.exit(1);
    }
    console.log(`scrub ok: ${r.scanned} files checked against ${r.checks} patterns from ${r.keys.length} defaults; compiled defaults emptied`);
  } catch (e) {
    console.error(`scrub FAILED: ${e.message}`);
    process.exit(1);
  }
}
