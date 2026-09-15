import type { AppEntry } from "../../types.js";

/**
 * An app provider is one interchangeable source of tiles. The shell never
 * knows or cares where a tile came from: it lists, launches, and optionally
 * removes through this contract only.
 *
 *   linux    .desktop files on this machine
 *   web      websites run as chromeless windows (Toast, Facebook, Gmail…)
 *   android  apps on a phone plugged in over USB (via adb + scrcpy)
 *
 * Add a provider by dropping a file in this folder and registering it in
 * ../apps.ts. Ids are namespaced "<provider>:<local id>" so they never clash.
 */
export interface AppProvider {
  id: string;
  name: string;
  /** Short human description shown in Settings. */
  description: string;
  /** Whether the tools this provider needs exist on this machine. */
  available(): Promise<{ ok: boolean; reason?: string }>;
  list(): Promise<AppEntry[]>;
  launch(localId: string): Promise<{ ok: boolean; message: string }>;
  remove?(localId: string): Promise<{ ok: boolean; message: string; jobId?: string }>;
  /** Map a compositor window class/title back to a local id, for the Continue row. */
  matchWindow?(cls: string, title: string): Promise<string | undefined>;
}

export function qualify(provider: string, localId: string): string {
  return `${provider}:${localId}`;
}

export function split(id: string): { provider: string; localId: string } {
  const i = id.indexOf(":");
  return i < 0 ? { provider: "linux", localId: id } : { provider: id.slice(0, i), localId: id.slice(i + 1) };
}
