import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { has, launchDetached, run } from "../../exec.js";
import { HOME } from "../../paths.js";
import { demoApps } from "../../demo.js";
import { isDemo } from "../status.js";
import type { AppEntry } from "../../types.js";
import { qualify, type AppProvider } from "./types.js";

const APP_DIRS = [
  { dir: "/usr/share/applications", source: "system" as const },
  { dir: "/usr/local/share/applications", source: "system" as const },
  { dir: "/var/lib/flatpak/exports/share/applications", source: "flatpak" as const },
  { dir: path.join(HOME, ".local/share/flatpak/exports/share/applications"), source: "flatpak" as const },
  { dir: path.join(HOME, ".nix-profile/share/applications"), source: "system" as const },
  { dir: path.join(HOME, ".local/share/applications"), source: "user" as const },
];

/** A friendly rename for a handful of core apps so the shell reads like a phone. */
const FRIENDLY: Record<string, string> = {
  "org.gnome.Nautilus": "Files",
  chromium: "Browser",
  "google-chrome": "Chrome",
  imv: "Photos",
  mpv: "Videos",
  "org.gnome.Calculator": "Calculator",
  "gnome-calculator": "Calculator",
};

const HIDE_CATEGORIES = new Set(["Settings", "System", "ConsoleOnly"]);
const HIDE_IDS = /^(alacritty|kitty|foot|ghostty|wezterm|nvim|neovim|vim|btop|htop|lazygit|lazydocker|tmux|yazi|ranger|nnn|fzf|bat|xterm|uxterm|qt5ct|qt6ct|nvtop|hyprland|Hyprland|avahi-discover|bssh|bvnc|lstopo|electron\d*|cmake-gui|micro|helix|lf|chromium-flags|nodeos|org\.codeberg\.dnkl\.foot.*)$/;

async function parseDesktop(file: string): Promise<Record<string, string> | null> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return null;
  }
  const entry: Record<string, string> = {};
  let inMain = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      inMain = line === "[Desktop Entry]";
      continue;
    }
    if (!inMain || !line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!(key in entry)) entry[key] = line.slice(eq + 1).trim();
  }
  return entry;
}

let cache: { at: number; apps: AppEntry[] } | null = null;

async function scan(): Promise<AppEntry[]> {
  if (await isDemo()) return demoApps.filter((a) => a.provider === "linux");
  if (cache && Date.now() - cache.at < 30_000) return cache.apps;
  const byId = new Map<string, AppEntry>();
  for (const { dir, source } of APP_DIRS) {
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".desktop"));
    } catch {
      continue;
    }
    for (const f of files) {
      const e = await parseDesktop(path.join(dir, f));
      if (!e) continue;
      const id = f.replace(/\.desktop$/, "");
      if (e.Type && e.Type !== "Application") continue;
      // Later dirs (user) override earlier ones, including hiding via NoDisplay/Hidden.
      if (e.NoDisplay === "true" || e.Hidden === "true") {
        byId.delete(id);
        continue;
      }
      if (e.OnlyShowIn && !/Hyprland|GNOME|Omarchy|NODE/i.test(e.OnlyShowIn)) continue;
      const cats = (e.Categories ?? "").split(";").filter(Boolean);
      const hidden = e.Terminal?.match(/true/i) || HIDE_IDS.test(id) || (cats.length > 0 && cats.every((c) => HIDE_CATEGORIES.has(c)));
      if (hidden) {
        byId.delete(id);
        continue;
      }
      // Web-app launchers created by Omarchy are still "linux" apps: they have a .desktop file.
      byId.set(id, {
        id: qualify("linux", id),
        provider: "linux",
        name: FRIENDLY[id] ?? e.Name ?? id,
        comment: e.Comment ?? e.GenericName ?? "",
        exec: e.Exec ?? "",
        icon: e.Icon ?? "",
        categories: cats,
        source: /omarchy-launch-webapp|--app=/.test(e.Exec ?? "") ? "webapp" : source,
        desktopFile: path.join(dir, f),
      });
    }
  }
  const apps = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  cache = { at: Date.now(), apps };
  return apps;
}

export function invalidate(): void {
  cache = null;
}

export const linuxProvider: AppProvider = {
  id: "linux",
  name: "Linux apps",
  description: "Everything installed on this computer",
  available: async () => ({ ok: true }),
  list: scan,
  async launch(localId) {
    const app = (await scan()).find((a) => a.id === qualify("linux", localId));
    if (!app) return { ok: false, message: "App not found" };
    if (await isDemo()) return { ok: true, message: `Would open ${app.name}` };
    if (app.desktopFile && (await has("uwsm-app"))) {
      return launchDetached("uwsm-app", ["--", `${localId}.desktop`]) ? { ok: true, message: `Opening ${app.name}` } : { ok: false, message: "Launch failed" };
    }
    if (await has("gtk-launch")) return launchDetached("gtk-launch", [localId]) ? { ok: true, message: `Opening ${app.name}` } : { ok: false, message: "Launch failed" };
    const parts = app.exec.replace(/%[a-zA-Z]/g, "").trim().split(/\s+/);
    return launchDetached(parts[0], parts.slice(1)) ? { ok: true, message: `Opening ${app.name}` } : { ok: false, message: "Launch failed" };
  },
  async remove(localId) {
    const app = (await scan()).find((a) => a.id === qualify("linux", localId));
    if (!app) return { ok: false, message: "App not found" };
    // Omarchy web apps are just a .desktop file in the user's dir.
    if (app.source === "webapp" && (await has("omarchy-webapp-remove"))) {
      const r = await run("omarchy-webapp-remove", [app.name]);
      invalidate();
      return { ok: r.ok, message: r.ok ? `Removed ${app.name}` : r.stderr.trim() };
    }
    const { packageJob } = await import("../packages.js");
    const pkg = app.exec.split(/\s+/)[0]?.split("/").pop() ?? localId;
    const job = await packageJob("remove", pkg);
    return { ok: true, message: `Removing ${app.name}`, jobId: job.id };
  },
  async matchWindow(cls) {
    const apps = await scan();
    const lower = cls.toLowerCase();
    const hit =
      apps.find((a) => a.id.slice(6).toLowerCase() === lower) ??
      apps.find((a) => a.id.slice(6).toLowerCase().endsWith(`.${lower}`)) ??
      apps.find((a) => a.exec.toLowerCase().split(/\s+/)[0]?.split("/").pop() === lower) ??
      apps.find((a) => a.name.toLowerCase() === lower);
    return hit ? hit.id.slice(6) : undefined;
  },
};

export async function refreshLinuxApps(): Promise<void> {
  invalidate();
  if (await has("omarchy-refresh-applications")) await run("omarchy-refresh-applications");
}
