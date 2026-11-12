import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

/**
 * Where the Files screen may look, and what it may change there.
 *
 * Two layers:
 *  - Access roots: the allowlist. Every request is checked against these twice,
 *    once on the path as written (so `~/Downloads` keeps its friendly name) and
 *    once on the real path after symlinks (so a home link into /hdd works, but
 *    a link out to /etc does not). The root that owns the *real* path decides
 *    whether writes are allowed.
 *  - Named sources: what the UI shows as separate places (SSD, spinning drive,
 *    scrap, images, documents). Each is a list of folders inside the roots.
 *
 * The spinning drive (/hdd) is an archive: list, search, preview — never
 * rename, trash or create. That holds even when it is reached through a home
 * symlink such as ~/Downloads or ~/MacBackup.
 */

export type AccessMode = "rw" | "ro";

export interface AccessRoot {
  root: string;
  mode: AccessMode;
}

export type SourceId = "ssd" | "spinning" | "scrap" | "images" | "documents";

export interface SourceFolder {
  label: string;
  path: string;
}

export interface FileSourceDef {
  id: SourceId;
  label: string;
  hint: string;
  folders: SourceFolder[];
}

export interface FileSource extends FileSourceDef {
  readOnly: boolean;
  folders: (SourceFolder & { readOnly: boolean })[];
}

export interface Layout {
  home: string;
  /** Mount point of the spinning drive. */
  hdd: string;
  /** The previous install's home on the spinning drive. */
  hddHome: string;
}

export class FileAccessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function defaultLayout(home: string, env: NodeJS.ProcessEnv = process.env): Layout {
  const hdd = path.resolve(env.NODEOS_HDD ?? "/hdd");
  return { home, hdd, hddHome: path.resolve(env.NODEOS_HDD_HOME ?? path.join(hdd, "home", path.basename(home))) };
}

export function accessRoots(l: Layout): AccessRoot[] {
  return [
    { root: l.home, mode: "rw" },
    { root: "/media", mode: "rw" },
    { root: "/run/media", mode: "rw" },
    { root: "/mnt", mode: "rw" },
    { root: l.hdd, mode: "ro" },
  ];
}

/** Credential folders are never served, wherever they live. */
const DENY_SEGMENTS = new Set([".ssh", ".gnupg", ".aws", ".password-store"]);

const within = (p: string, root: string) => p === root || p.startsWith(root === path.sep ? root : root + path.sep);

/** The most specific root that contains `p`, or null when `p` is outside every root. */
export function rootFor(p: string, roots: AccessRoot[]): AccessRoot | null {
  let best: AccessRoot | null = null;
  for (const r of roots) if (within(p, r.root) && (!best || r.root.length > best.root.length)) best = r;
  return best;
}

/** realpath of `p`, or of its deepest existing ancestor joined with the rest (for paths about to be created). */
export function realPathOf(p: string): string {
  let cur = p;
  const rest: string[] = [];
  for (;;) {
    try {
      return rest.length ? path.join(realpathSync(cur), ...rest) : realpathSync(cur);
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return p;
      rest.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

export interface Checked {
  /** Absolute path as requested (symlinks kept), used for display and listing. */
  abs: string;
  /** Real path after symlinks, used for the allowlist and write decisions. */
  real: string;
  mode: AccessMode;
}

export function expandPath(p: string, home: string): string {
  const expanded = p === "~" || p === "" ? home : p.startsWith("~/") ? path.join(home, p.slice(2)) : p;
  return path.resolve(expanded);
}

export function checkPath(p: string, l: Layout, want: "read" | "write" = "read", resolveReal: (p: string) => string = realPathOf): Checked {
  const abs = expandPath(p, l.home);
  const roots = accessRoots(l);
  if (!rootFor(abs, roots)) throw new FileAccessError(403, "Path outside your files");
  const real = resolveReal(abs);
  const owner = rootFor(real, roots);
  if (!owner) throw new FileAccessError(403, "Path outside your files");
  if (real.split(path.sep).some((s) => DENY_SEGMENTS.has(s)) || abs.split(path.sep).some((s) => DENY_SEGMENTS.has(s))) throw new FileAccessError(403, "That folder holds credentials and isn't shown in Files");
  if (want === "write" && owner.mode === "ro") throw new FileAccessError(403, "This is on the spinning drive archive, which is read-only in NODE");
  return { abs, real, mode: owner.mode };
}

export function sourceDefs(l: Layout): FileSourceDef[] {
  const h = (rel: string) => path.join(l.hddHome, rel);
  const mac = (rel: string) => path.join(l.hddHome, "MacBackup", rel);
  return [
    { id: "ssd", label: "SSD", hint: "Live home on the NVMe", folders: [{ label: "Home", path: l.home }] },
    {
      id: "spinning",
      label: "Spinning drive",
      hint: "Old install and archive on /hdd (read-only)",
      folders: [
        { label: "Old home", path: l.hddHome },
        { label: "Whole drive", path: l.hdd },
      ],
    },
    {
      id: "scrap",
      label: "Scrap",
      hint: "Scrapers, backups and data dumps (read-only)",
      folders: [
        { label: "scrapers", path: h("scrapers") },
        { label: "macbook-scrapers", path: h("macbook-scrapers") },
        { label: "MacBackup", path: h("MacBackup") },
        { label: "Backups", path: h("Backups") },
        { label: "backups", path: h("backups") },
        { label: "grokbot-box-copy", path: h("grokbot-box-copy") },
        { label: "gmaps-things-to-do", path: h("gmaps-things-to-do-orange-beach-gulf-shores") },
        { label: "gulfshores-data", path: h("gulfshores-data") },
        { label: "gulfshores-data (old partial)", path: h("gulfshores-data-partial-old") },
        { label: "gcr-structured", path: h("gcr-structured") },
        { label: "gsparts", path: h("gsparts") },
        { label: "qwtest", path: h("qwtest") },
        { label: "Old ang copy", path: h("ang") },
      ],
    },
    {
      id: "images",
      label: "Images",
      hint: "Pictures on both drives and the Mac Photos Library",
      folders: [
        { label: "Pictures (SSD)", path: path.join(l.home, "Pictures") },
        { label: "Pictures (spinning)", path: h("Pictures") },
        { label: "Mac Pictures", path: mac("Pictures") },
        { label: "Mac Photos Library", path: mac("Pictures/Photos Library.photoslibrary") },
      ],
    },
    {
      id: "documents",
      label: "Documents",
      hint: "Document folders on both drives and the Mac backup",
      folders: [
        { label: "Documents (SSD)", path: path.join(l.home, "Documents") },
        { label: "Documents (spinning)", path: h("Documents") },
        { label: "Mac Documents", path: mac("Documents") },
        { label: "Mac Downloads", path: mac("Downloads") },
        { label: "Downloads", path: path.join(l.home, "Downloads") },
      ],
    },
  ];
}

/** Named sources with folders that exist and pass the allowlist; each folder knows whether it's read-only. */
export function fileSources(l: Layout, exists: (p: string) => boolean = existsSync, resolveReal: (p: string) => string = realPathOf): FileSource[] {
  return sourceDefs(l).map((s) => {
    const folders: FileSource["folders"] = [];
    for (const f of s.folders) {
      if (!exists(f.path)) continue;
      try {
        folders.push({ ...f, readOnly: checkPath(f.path, l, "read", resolveReal).mode === "ro" });
      } catch {
        /* outside the allowlist on this machine: leave it out */
      }
    }
    return { ...s, folders, readOnly: folders.length > 0 && folders.every((f) => f.readOnly) };
  });
}
