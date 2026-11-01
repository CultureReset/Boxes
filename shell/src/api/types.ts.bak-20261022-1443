/** Shared shapes between the daemon and the shell. Mirrored in shell/src/api/types.ts. */

export interface AppEntry {
  /** Namespaced "<provider>:<local id>", e.g. "linux:firefox", "web:toast", "android:com.whatsapp". */
  id: string;
  provider: string;
  name: string;
  comment: string;
  exec: string;
  icon: string;
  categories: string[];
  source: "system" | "user" | "flatpak" | "webapp" | "android";
  color?: string;
  desktopFile?: string;
  url?: string;
  package?: string;
}

export interface WindowEntry {
  address: string;
  class: string;
  title: string;
  workspace: number;
  pid: number;
  focused: boolean;
  appId?: string;
}

export interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
  active: boolean;
  saved: boolean;
}

export interface BluetoothDevice {
  mac: string;
  name: string;
  connected: boolean;
  paired: boolean;
  type: "audio" | "input" | "display" | "phone" | "other";
}

export type FileKind = "folder" | "image" | "video" | "audio" | "pdf" | "document" | "spreadsheet" | "presentation" | "text" | "code" | "archive" | "app" | "other";

export interface FileEntry {
  name: string;
  path: string;
  kind: FileKind;
  size: number;
  modified: string;
  hidden?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
  notes?: string;
  color?: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  icon: string;
  kind: "agent" | "command" | "open";
  payload: string;
  schedule: { type: "daily" | "weekly" | "interval" | "manual"; time?: string; weekday?: number; minutes?: number };
  enabled: boolean;
  lastRun?: string;
  lastStatus?: "ok" | "failed";
  nextRun?: string;
}

export interface Job {
  id: string;
  kind: "install" | "remove" | "update" | "agent" | "automation";
  title: string;
  status: "running" | "done" | "failed";
  lines: string[];
  startedAt: string;
  finishedAt?: string;
  meta?: Record<string, unknown>;
}

export interface Status {
  demo: boolean;
  user: { name: string; fullName: string; hostname: string };
  time: string;
  battery: { present: boolean; percent: number; charging: boolean } | null;
  /** "unknown" means the tool that reports it is missing: never a guess. */
  network: { online: boolean; type: "wifi" | "ethernet" | "none" | "unknown"; ssid?: string; signal?: number };
  bluetooth: { powered: boolean; connected: string[]; unavailable?: boolean };
  /** null when the audio tool is missing. */
  audio: { volume: number; muted: boolean; sink: string } | null;
  brightness: number | null;
  /** null when this machine cannot be asked; not the same as zero. */
  updates: number | null;
  theme: string;
  background: string | null;
  uptimeSeconds: number;
  capabilities: Record<string, boolean>;
}

export interface FeatureStatus {
  available: boolean;
  demo: boolean;
  tool?: string;
  install?: string;
  reason?: string;
}

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  description: string;
  scope: string[];
  keywords: string[];
  color: string;
  icon: string;
}

export interface AgentsInfo {
  providers: { id: string; name: string; installed: boolean; isDefault: boolean }[];
  personas: Persona[];
}

export interface Package {
  name: string;
  version: string;
  description: string;
  repo: string;
  installed: boolean;
  source: "flathub" | "pacman";
  appId?: string;
  icon?: string;
}

export interface PackageResult {
  status: FeatureStatus;
  packages: Package[];
}

export interface WifiResult {
  status: FeatureStatus;
  networks: WifiNetwork[];
}

export interface BluetoothResult {
  status: FeatureStatus;
  devices: BluetoothDevice[];
}

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AudioResult {
  status: FeatureStatus;
  outputs: AudioDevice[];
  inputs: AudioDevice[];
}

export interface Monitor {
  name: string;
  description: string;
  width: number;
  height: number;
  refreshRate: number;
  scale: number;
  focused: boolean;
}

export interface MonitorResult {
  status: FeatureStatus;
  monitors: Monitor[];
}

export interface Notification {
  id: string;
  app: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  ok: boolean;
  reason?: string;
}

export interface WebApp {
  slug: string;
  name: string;
  url: string;
  comment: string;
  color: string;
  category: string;
  added: boolean;
}

export interface AndroidDevice {
  serial: string;
  model: string;
  state: "device" | "unauthorized" | "offline" | "no permissions";
  androidVersion?: string;
}

export interface AndroidStatus {
  available: boolean;
  reason?: string;
  scrcpy: boolean;
  scrcpyVersion?: string;
  devices: AndroidDevice[];
}

export interface HomeRow {
  id: string;
  enabled: boolean;
}

export type Look = "dashboard" | "living" | "cinema";

export interface Layout {
  rows: HomeRow[];
  look: Look;
  tv: boolean | null;
  scale: number;
  weatherLocation: string;
}

export type WorldKind = "personal" | "family" | "business" | "work" | "public" | "person";

export interface Shortcut {
  id: string;
  label: string;
  icon: string;
  color: string;
  action: { type: "screen" | "app" | "agent" | "world" | "url"; target: string };
}

export interface World {
  id: string;
  name: string;
  kind: WorldKind;
  color: string;
  tagline: string;
  look: Look;
  apps: string[] | null;
  agents: string[] | null;
  shortcuts: Shortcut[];
  locked?: boolean;
  pin?: string;
}

export interface Weather {
  location: string;
  tempC: number;
  tempF: number;
  highF: number;
  lowF: number;
  code: number;
  summary: string;
  demo: boolean;
}
