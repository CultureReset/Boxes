import { readdir, stat, readFile, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { HOME } from "../paths.js";
import { demoFiles } from "../demo.js";
import { isDemo } from "./status.js";
import { HttpError } from "../router.js";
import type { FileEntry, FileKind } from "../types.js";

const KIND_BY_EXT: Record<string, FileKind> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", svg: "image", heic: "image", avif: "image",
  mp4: "video", mkv: "video", mov: "video", webm: "video", avi: "video",
  mp3: "audio", flac: "audio", wav: "audio", ogg: "audio", m4a: "audio", opus: "audio",
  pdf: "pdf",
  doc: "document", docx: "document", odt: "document", rtf: "document", pages: "document",
  xls: "spreadsheet", xlsx: "spreadsheet", ods: "spreadsheet", csv: "spreadsheet", numbers: "spreadsheet",
  ppt: "presentation", pptx: "presentation", odp: "presentation", key: "presentation",
  txt: "text", md: "text", log: "text",
  js: "code", ts: "code", tsx: "code", jsx: "code", py: "code", rb: "code", go: "code", rs: "code", c: "code", h: "code", cpp: "code", java: "code", sh: "code", lua: "code", json: "code", yaml: "code", yml: "code", toml: "code", html: "code", css: "code",
  zip: "archive", tar: "archive", gz: "archive", xz: "archive", zst: "archive", "7z": "archive", rar: "archive",
  appimage: "app", desktop: "app",
};

export function kindOf(name: string, isDir: boolean): FileKind {
  if (isDir) return "folder";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return KIND_BY_EXT[ext] ?? "other";
}

/** Expand `~` and refuse anything outside the home directory or mounted media. */
export function resolveUserPath(p: string): string {
  const expanded = p === "~" || p === "" ? HOME : p.startsWith("~/") ? path.join(HOME, p.slice(2)) : p;
  const abs = path.resolve(expanded);
  const allowed = [HOME, "/media", "/run/media", "/mnt"];
  if (!allowed.some((root) => abs === root || abs.startsWith(root + path.sep))) throw new HttpError(403, "Path outside your files");
  return abs;
}

export function displayPath(abs: string): string {
  return abs === HOME ? "~" : abs.startsWith(HOME + path.sep) ? "~" + abs.slice(HOME.length) : abs;
}

export async function listDir(p: string, showHidden = false): Promise<{ path: string; entries: FileEntry[] }> {
  if (await isDemo()) return { path: p || "~", entries: demoFiles(p || "~") };
  const abs = resolveUserPath(p);
  const names = await readdir(abs, { withFileTypes: true }).catch(() => {
    throw new HttpError(404, "Folder not found");
  });
  const entries: FileEntry[] = [];
  for (const d of names) {
    if (!showHidden && d.name.startsWith(".")) continue;
    const full = path.join(abs, d.name);
    try {
      const s = await stat(full);
      entries.push({ name: d.name, path: displayPath(full), kind: kindOf(d.name, s.isDirectory()), size: s.isDirectory() ? 0 : s.size, modified: s.mtime.toISOString(), hidden: d.name.startsWith(".") });
    } catch {
      /* broken symlink etc. */
    }
  }
  entries.sort((a, b) => Number(b.kind === "folder") - Number(a.kind === "folder") || a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { path: displayPath(abs), entries };
}

/** Recently used files from the freedesktop recently-used.xbel bookmark file. */
export async function recentFiles(limit = 12): Promise<FileEntry[]> {
  if (await isDemo()) {
    return [...demoFiles("~").filter((f) => f.kind !== "folder"), ...demoFiles("~/Documents").filter((f) => f.kind !== "folder")].sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, limit);
  }
  const file = path.join(process.env.XDG_DATA_HOME ?? path.join(HOME, ".local/share"), "recently-used.xbel");
  let xml = "";
  try {
    xml = await readFile(file, "utf8");
  } catch {
    return [];
  }
  const out: FileEntry[] = [];
  const re = /<bookmark href="([^"]+)"[^>]*modified="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (!m[1].startsWith("file://")) continue;
    const abs = decodeURIComponent(m[1].slice(7));
    try {
      const s = await stat(abs);
      out.push({ name: path.basename(abs), path: displayPath(abs), kind: kindOf(abs, s.isDirectory()), size: s.size, modified: m[2] });
    } catch {
      /* file gone */
    }
  }
  return out.sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, limit);
}

export async function searchFiles(q: string, limit = 40): Promise<FileEntry[]> {
  const needle = q.toLowerCase();
  if (await isDemo()) {
    const all = ["~", "~/Documents", "~/Pictures"].flatMap((d) => demoFiles(d));
    return all.filter((f) => f.name.toLowerCase().includes(needle)).slice(0, limit);
  }
  const out: FileEntry[] = [];
  const skip = new Set(["node_modules", ".git", ".cache", ".local", ".config", ".npm", ".cargo", ".rustup", ".venv", "__pycache__"]);
  async function walk(dir: string, depth: number) {
    if (out.length >= limit || depth > 6) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith(".") || skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.name.toLowerCase().includes(needle)) {
        try {
          const s = await stat(full);
          out.push({ name: e.name, path: displayPath(full), kind: kindOf(e.name, s.isDirectory()), size: s.size, modified: s.mtime.toISOString() });
        } catch {
          /* ignore */
        }
      }
      if (e.isDirectory()) await walk(full, depth + 1);
    }
  }
  await walk(HOME, 0);
  return out;
}

export async function newFolder(parent: string, name: string): Promise<void> {
  if (await isDemo()) return;
  if (/[/\\]/.test(name) || name === "." || name === "..") throw new HttpError(400, "Invalid folder name");
  await mkdir(path.join(resolveUserPath(parent), name));
}

export async function renamePath(p: string, name: string): Promise<void> {
  if (await isDemo()) return;
  if (/[/\\]/.test(name)) throw new HttpError(400, "Invalid name");
  const abs = resolveUserPath(p);
  await rename(abs, path.join(path.dirname(abs), name));
}

/** Moves to the XDG trash via gio when available; otherwise refuses (never rm -rf silently). */
export async function trashPath(p: string): Promise<{ ok: boolean; message: string }> {
  if (await isDemo()) return { ok: true, message: "Moved to Trash" };
  const abs = resolveUserPath(p);
  const { run, has } = await import("../exec.js");
  if (await has("gio")) {
    const r = await run("gio", ["trash", abs]);
    return r.ok ? { ok: true, message: "Moved to Trash" } : { ok: false, message: r.stderr.trim() };
  }
  const trash = path.join(HOME, ".local/share/Trash/files");
  await mkdir(trash, { recursive: true });
  await rename(abs, path.join(trash, `${Date.now()}-${path.basename(abs)}`)).catch(() => rm(abs, { recursive: true }));
  return { ok: true, message: "Moved to Trash" };
}

export async function readText(p: string, max = 200_000): Promise<string> {
  if (await isDemo()) return "# Notes\n\nDemo mode: this is placeholder text.\n";
  const abs = resolveUserPath(p);
  const s = await stat(abs);
  if (s.size > max) throw new HttpError(413, "File too large to preview");
  return readFile(abs, "utf8");
}

export async function readBinary(p: string): Promise<{ body: Buffer; type: string }> {
  const abs = resolveUserPath(p);
  const ext = abs.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", pdf: "application/pdf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", flac: "audio/flac", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4" };
  return { body: await readFile(abs), type: types[ext] ?? "application/octet-stream" };
}

export async function diskUsage(): Promise<{ total: number; used: number } | null> {
  const { run } = await import("../exec.js");
  const r = await run("df", ["-B1", "--output=size,used", HOME]);
  const line = r.stdout.trim().split("\n")[1];
  if (!line) return null;
  const [total, used] = line.trim().split(/\s+/).map(Number);
  return { total, used };
}
