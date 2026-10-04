import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// dist/nextgent/*.test.js → the daemon's own package.json two levels up.
const daemonDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(await readFile(path.join(daemonDir, "package.json"), "utf8")) as { dependencies?: Record<string, string> };

// routes.ts imports @nextgent/app-engine; the package that imports it must say so.
test("the daemon declares the engine it imports", () => {
  const spec = pkg.dependencies?.["@nextgent/app-engine"];
  assert.ok(spec, "daemon/package.json has no dependency on @nextgent/app-engine");
  assert.match(spec, /^file:/, "declared the same way the repo root declares it (a file: link)");
  const target = path.resolve(daemonDir, spec.replace(/^file:/, ""));
  assert.ok(existsSync(path.join(target, "package.json")), `file: path does not resolve from daemon/: ${target}`);
});
