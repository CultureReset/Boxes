import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { accessRoots, checkPath, fileSources, rootFor, FileAccessError, type Layout } from "./filesources.js";

/** A throwaway machine: SSD home, spinning drive with an old home, and links between them. */
function fixture(): Layout & { outside: string } {
  const base = realpathSync(mkdtempSync(path.join(os.tmpdir(), "nodeos-files-")));
  const home = path.join(base, "home", "steve");
  const hdd = path.join(base, "hdd");
  const hddHome = path.join(hdd, "home", "steve");
  const outside = path.join(base, "etc");
  for (const d of [home, path.join(home, "Documents"), path.join(home, "Pictures"), hddHome, path.join(hddHome, "Downloads"), path.join(hddHome, "scrapers"), path.join(hddHome, "MacBackup", "Pictures", "Photos Library.photoslibrary"), path.join(hddHome, "MacBackup", "Documents"), path.join(hddHome, ".ssh"), outside]) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(hddHome, "Downloads", "spec.pdf"), "pdf");
  writeFileSync(path.join(outside, "passwd"), "root");
  symlinkSync(path.join(hddHome, "Downloads"), path.join(home, "Downloads"));
  symlinkSync(path.join(hddHome, "scrapers"), path.join(home, "scrapers"));
  symlinkSync(path.join(hddHome, "MacBackup"), path.join(home, "MacBackup"));
  symlinkSync(outside, path.join(home, "escape"));
  return { home, hdd, hddHome, outside };
}

const denied = (fn: () => unknown, status = 403) => assert.throws(fn, (e: unknown) => e instanceof FileAccessError && e.status === status);

test("/hdd is on the allowlist, read-only", () => {
  const l = fixture();
  const c = checkPath(l.hdd, l);
  assert.equal(c.mode, "ro");
  assert.equal(checkPath(path.join(l.hddHome, "Downloads", "spec.pdf"), l).mode, "ro");
  assert.deepEqual(rootFor(l.hdd, accessRoots(l)), { root: l.hdd, mode: "ro" });
});

test("a home symlink onto /hdd is allowed and keeps its ~ path", () => {
  const l = fixture();
  const c = checkPath("~/Downloads/spec.pdf", l);
  assert.equal(c.abs, path.join(l.home, "Downloads", "spec.pdf"));
  assert.equal(c.real, path.join(l.hddHome, "Downloads", "spec.pdf"));
  assert.equal(c.mode, "ro");
});

test("live home on the SSD stays writable", () => {
  const l = fixture();
  assert.equal(checkPath("~/Documents", l, "write").mode, "rw");
  assert.equal(checkPath("~/Documents/new-folder", l, "write").mode, "rw");
});

test("paths outside the allowlist are still denied", () => {
  const l = fixture();
  denied(() => checkPath("/etc/passwd", l));
  denied(() => checkPath(l.outside, l));
  denied(() => checkPath("~/../../etc", l));
});

test("a home symlink pointing outside the allowlist is denied", () => {
  const l = fixture();
  denied(() => checkPath("~/escape/passwd", l));
});

test("credential folders are never served, even on the archive", () => {
  const l = fixture();
  denied(() => checkPath(path.join(l.hddHome, ".ssh"), l));
});

test("scrap and archive paths refuse writes (rename, trash, new folder)", () => {
  const l = fixture();
  for (const p of ["~/scrapers", "~/MacBackup/Documents", "~/Downloads/spec.pdf", path.join(l.hddHome, "scrapers"), l.hdd, path.join(l.hddHome, "scrapers", "new")]) denied(() => checkPath(p, l, "write"));
});

test("named sources: SSD, spinning drive, scrap, images, documents", () => {
  const l = fixture();
  const sources = fileSources(l);
  assert.deepEqual(sources.map((s) => s.id), ["ssd", "spinning", "scrap", "images", "documents"]);
  const by = Object.fromEntries(sources.map((s) => [s.id, s]));
  assert.equal(by.ssd.readOnly, false);
  assert.deepEqual(by.ssd.folders.map((f) => f.path), [l.home]);
  assert.equal(by.spinning.readOnly, true);
  assert.ok(by.spinning.folders.some((f) => f.path === l.hddHome));
  assert.equal(by.scrap.readOnly, true);
  assert.ok(by.scrap.folders.some((f) => f.label === "scrapers"));
  assert.ok(by.scrap.folders.every((f) => f.readOnly));
  assert.ok(by.images.folders.some((f) => f.label === "Mac Photos Library" && f.readOnly));
  assert.ok(by.images.folders.some((f) => f.label === "Pictures (SSD)" && !f.readOnly));
  assert.ok(by.documents.folders.some((f) => f.label === "Documents (SSD)" && !f.readOnly));
  assert.ok(by.documents.folders.some((f) => f.label === "Mac Documents" && f.readOnly));
  // Folders that don't exist on this machine are left out rather than shown broken.
  assert.ok(!by.scrap.folders.some((f) => f.label === "qwtest"));
});
