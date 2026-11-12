import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, realpathSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the daemon's HOME and spinning drive at a throwaway tree before files.ts loads.
const base = realpathSync(mkdtempSync(path.join(os.tmpdir(), "nodeos-files-api-")));
const home = path.join(base, "home", "steve");
const hdd = path.join(base, "hdd");
const hddHome = path.join(hdd, "home", "steve");
process.env.HOME = home;
process.env.NODEOS_HDD = hdd;
process.env.NODEOS_DEMO = "0";
process.env.XDG_DATA_HOME = path.join(base, "xdg");
process.env.XDG_STATE_HOME = path.join(base, "xdg-state");
process.env.XDG_CONFIG_HOME = path.join(base, "xdg-config");

let files: typeof import("./files.js");

before(async () => {
  for (const d of [path.join(home, "Documents"), path.join(hddHome, "Downloads"), path.join(hddHome, "scrapers")]) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(hddHome, "Downloads", "spec.txt"), "spec");
  writeFileSync(path.join(hddHome, "scrapers", "run.log"), "log");
  writeFileSync(path.join(home, "Documents", "note.txt"), "note");
  symlinkSync(path.join(hddHome, "Downloads"), path.join(home, "Downloads"));
  symlinkSync(path.join(hddHome, "scrapers"), path.join(home, "scrapers"));
  files = await import("./files.js");
});

const status = (n: number) => (e: unknown) => (e as { status?: number }).status === n;

test("listDir: ~/Downloads (symlink onto /hdd) lists and is read-only", async () => {
  const r = await files.listDir("~/Downloads");
  assert.equal(r.path, "~/Downloads");
  assert.deepEqual(r.entries.map((e) => e.path), ["~/Downloads/spec.txt"]);
  assert.equal(r.readOnly, true);
});

test("listDir: /hdd paths list directly", async () => {
  const r = await files.listDir(hddHome);
  assert.ok(r.entries.some((e) => e.name === "scrapers"));
  assert.equal(r.readOnly, true);
  assert.equal((await files.readText(path.join(hddHome, "scrapers", "run.log"))), "log");
});

test("listDir: SSD home stays writable", async () => {
  assert.equal((await files.listDir("~/Documents")).readOnly, false);
});

test("outside the allowlist is denied", async () => {
  await assert.rejects(files.listDir("/etc"), status(403));
  await assert.rejects(files.readText("/etc/hostname"), status(403));
});

test("rename, trash and new folder refuse on scrap/archive", async () => {
  await assert.rejects(files.renamePath("~/scrapers/run.log", "x.log"), status(403));
  await assert.rejects(files.trashPath("~/scrapers/run.log"), status(403));
  await assert.rejects(files.trashPath(path.join(hddHome, "Downloads", "spec.txt")), status(403));
  await assert.rejects(files.newFolder("~/Downloads", "new"), status(403));
  assert.ok(existsSync(path.join(hddHome, "scrapers", "run.log")));
  assert.ok(existsSync(path.join(hddHome, "Downloads", "spec.txt")));
});

test("rename rejects .. as a new name", async () => {
  await assert.rejects(files.renamePath("~/Documents/note.txt", ".."), status(400));
});

test("rename still works in live home", async () => {
  await files.renamePath("~/Documents/note.txt", "note2.txt");
  assert.ok(existsSync(path.join(home, "Documents", "note2.txt")));
});

test("listSources returns the five named sources with ~ paths", async () => {
  const s = await files.listSources();
  assert.deepEqual(s.map((x) => x.id), ["ssd", "spinning", "scrap", "images", "documents"]);
  assert.equal(s[0].folders[0].path, "~");
  assert.ok(s.find((x) => x.id === "scrap")!.folders.some((f) => f.label === "scrapers" && f.readOnly));
});

test("search can be scoped to a source and finds files on /hdd", async () => {
  const r = await files.searchFiles("run", 40, "scrap");
  assert.ok(r.some((e) => e.name === "run.log"));
  await assert.rejects(files.searchFiles("run", 40, "nope"), status(404));
});
