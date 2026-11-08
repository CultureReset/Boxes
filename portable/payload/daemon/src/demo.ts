/**
 * Demo data used when NODE runs somewhere without the real Linux desktop
 * underneath (a laptop preview, a CI box, a browser on another machine).
 * Every module falls back here only when the real tool is missing.
 */
import type { AppEntry, WindowEntry, WifiNetwork, BluetoothDevice, FileEntry } from "./types.js";

export const demoApps: AppEntry[] = [
  { id: "linux:chromium", provider: "linux", name: "Browser", comment: "Web everywhere", exec: "chromium", icon: "chromium", categories: ["Network"], source: "system", color: "#1a73e8" },
  { id: "linux:org.gnome.Nautilus", provider: "linux", name: "Files", comment: "Your documents", exec: "nautilus", icon: "org.gnome.Nautilus", categories: ["System"], source: "system", color: "#0a84ff" },
  { id: "linux:spotify", provider: "linux", name: "Spotify", comment: "Music & podcasts", exec: "spotify", icon: "spotify", categories: ["AudioVideo"], source: "system", color: "#1db954" },
  { id: "linux:vlc", provider: "linux", name: "VLC", comment: "Media player", exec: "vlc", icon: "vlc", categories: ["AudioVideo"], source: "system", color: "#ff8800" },
  { id: "linux:firefox", provider: "linux", name: "Firefox", comment: "Web browser", exec: "firefox", icon: "firefox", categories: ["Network"], source: "system", color: "#ff7139" },
  { id: "linux:libreoffice-startcenter", provider: "linux", name: "LibreOffice", comment: "Office suite", exec: "libreoffice", icon: "libreoffice-startcenter", categories: ["Office"], source: "system", color: "#18a303" },
  { id: "linux:obsidian", provider: "linux", name: "Obsidian", comment: "Knowledge base", exec: "obsidian", icon: "obsidian", categories: ["Office"], source: "system", color: "#7c3aed" },
  { id: "linux:slack", provider: "linux", name: "Slack", comment: "Team communication", exec: "slack", icon: "slack", categories: ["Network"], source: "system", color: "#4a154b" },
  { id: "linux:zoom", provider: "linux", name: "Zoom", comment: "Video meetings", exec: "zoom", icon: "Zoom", categories: ["Network"], source: "system", color: "#2d8cff" },
  { id: "linux:signal-desktop", provider: "linux", name: "Signal", comment: "Private messaging", exec: "signal-desktop", icon: "signal-desktop", categories: ["Network"], source: "system", color: "#3a76f0" },
  { id: "linux:1password", provider: "linux", name: "1Password", comment: "Password manager", exec: "1password", icon: "1password", categories: ["Utility"], source: "system", color: "#0a5cff" },
  { id: "linux:imv", provider: "linux", name: "Photos", comment: "View and organize", exec: "imv", icon: "imv", categories: ["Graphics"], source: "system", color: "#ff2d55" },
  { id: "linux:mpv", provider: "linux", name: "Videos", comment: "Play anything", exec: "mpv", icon: "mpv", categories: ["AudioVideo"], source: "system", color: "#5e2ca5" },
  { id: "linux:gnome-calculator", provider: "linux", name: "Calculator", comment: "Quick math", exec: "gnome-calculator", icon: "gnome-calculator", categories: ["Utility"], source: "system", color: "#ff9f0a" },
];

export const demoWindows: WindowEntry[] = [
  { address: "0x1", class: "chromium", title: "Q2 Travel Plans — Google Docs", workspace: 2, pid: 4210, focused: false, appId: "linux:chromium" },
  { address: "0x2", class: "spotify", title: "Spotify — Discover Weekly", workspace: 3, pid: 4380, focused: false, appId: "linux:spotify" },
  { address: "0x3", class: "obsidian", title: "Business Plan — Obsidian", workspace: 4, pid: 4501, focused: false, appId: "linux:obsidian" },
];

export const demoWifi: WifiNetwork[] = [
  { ssid: "Corner Table 5G", signal: 92, security: "WPA2", active: true, saved: true },
  { ssid: "Corner Table Guest", signal: 80, security: "WPA2", active: false, saved: false },
  { ssid: "xfinitywifi", signal: 41, security: "", active: false, saved: false },
  { ssid: "NETGEAR_2G", signal: 33, security: "WPA2", active: false, saved: false },
];

export const demoBluetooth: BluetoothDevice[] = [
  { mac: "AC:12:2F:9B:00:01", name: "AirPods Pro", connected: true, paired: true, type: "audio" },
  { mac: "AC:12:2F:9B:00:02", name: "MX Master 3S", connected: true, paired: true, type: "input" },
  { mac: "AC:12:2F:9B:00:03", name: "Living Room TV", connected: false, paired: true, type: "display" },
];

export function demoFiles(dir: string): FileEntry[] {
  const now = Date.now();
  const d = (h: number) => new Date(now - h * 3600e3).toISOString();
  if (dir === "~" || dir === "") {
    return [
      { name: "Documents", path: "~/Documents", kind: "folder", size: 0, modified: d(2) },
      { name: "Downloads", path: "~/Downloads", kind: "folder", size: 0, modified: d(1) },
      { name: "Pictures", path: "~/Pictures", kind: "folder", size: 0, modified: d(30) },
      { name: "Music", path: "~/Music", kind: "folder", size: 0, modified: d(300) },
      { name: "Videos", path: "~/Videos", kind: "folder", size: 0, modified: d(120) },
      { name: "Work", path: "~/Work", kind: "folder", size: 0, modified: d(5) },
      { name: "Business Plan.pdf", path: "~/Business Plan.pdf", kind: "pdf", size: 1_240_000, modified: d(4) },
      { name: "Q2 Travel Plans.docx", path: "~/Q2 Travel Plans.docx", kind: "document", size: 84_000, modified: d(2) },
    ];
  }
  if (dir.endsWith("Documents")) {
    return [
      { name: "Invoices", path: `${dir}/Invoices`, kind: "folder", size: 0, modified: d(50) },
      { name: "Menu Fall 2026.pdf", path: `${dir}/Menu Fall 2026.pdf`, kind: "pdf", size: 2_100_000, modified: d(20) },
      { name: "Staff Schedule.xlsx", path: `${dir}/Staff Schedule.xlsx`, kind: "spreadsheet", size: 41_000, modified: d(9) },
      { name: "Notes.md", path: `${dir}/Notes.md`, kind: "text", size: 3_200, modified: d(1) },
    ];
  }
  if (dir.endsWith("Pictures")) {
    return Array.from({ length: 8 }, (_, i) => ({ name: `IMG_20${40 + i}.jpg`, path: `${dir}/IMG_20${40 + i}.jpg`, kind: "image" as const, size: 3_000_000 + i * 20000, modified: d(40 + i) }));
  }
  return [{ name: "README.md", path: `${dir}/README.md`, kind: "text", size: 900, modified: d(3) }];
}
