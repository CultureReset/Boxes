import { has, run } from "../../exec.js";

/**
 * The system package manager, whichever one this machine actually has.
 *
 * packages.ts hardcodes pacman in twenty places. On a Debian or Ubuntu box that
 * means "Cannot check on this machine" and a button offering to install
 * pacman-contrib, which is nonsense on apt. The distro was baked into the
 * module instead of being asked about.
 *
 * This file is the seam. Add a distro by adding one entry below. Nothing else
 * in the daemon needs to know which one is in use.
 */

export type PkgSource = "flathub" | "pacman" | "apt";

export interface PkgManager {
  /** What packages.ts reports as `source`. */
  id: Exclude<PkgSource, "flathub">;
  /** The binary a human would type. */
  bin: string;
  /** Present on this machine? */
  available(): Promise<boolean>;
  /** Package names with an update waiting: [name, from, to][] */
  updates(): Promise<Array<[string, string, string]>>;
  /** Free-text search. */
  search(needle: string): Promise<Array<{ name: string; version: string; description: string; repo: string }>>;
  /** Explicitly installed package names. */
  installed(): Promise<string[]>;
  /** argv for an action, run as root by the caller. */
  argv(action: "install" | "remove" | "update", name?: string): string[];
  /** What to tell a person when this manager isn't usable. */
  missingHint: string;
}

const pacman: PkgManager = {
  id: "pacman",
  bin: "pacman",
  missingHint: "Checking for updates needs checkupdates, from pacman-contrib.",

  async available(): Promise<boolean> {
    return has("pacman");
  },

  async updates(): Promise<Array<[string, string, string]>> {
    if (!(await has("checkupdates"))) return [];
    const r = await run("checkupdates", ["--nocolor"], { timeout: 20_000 });
    const out: Array<[string, string, string]> = [];
    for (const line of r.stdout.trim().split("\n").filter(Boolean)) {
      const p: string[] = line.split(/\s+/);
      if (p.length >= 4) out.push([p[0], p[1], p[3]]);
    }
    return out;
  },

  async search(needle: string): Promise<Array<{ name: string; version: string; description: string; repo: string }>> {
    const r = await run("pacman", ["-Ss", needle], { timeout: 15_000 });
    const out: Array<{ name: string; version: string; description: string; repo: string }> = [];
    const lines: string[] = r.stdout.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = /^(\S+)\/(\S+)\s+(\S+)/.exec(lines[i]);
      if (m) out.push({ repo: m[1], name: m[2], version: m[3], description: (lines[i + 1] ?? "").trim() });
    }
    return out;
  },

  async installed(): Promise<string[]> {
    if (!(await has("pacman"))) return [];
    return (await run("pacman", ["-Qeq"])).stdout.trim().split("\n").filter(Boolean);
  },

  argv(action: "install" | "remove" | "update", name?: string): string[] {
    if (action === "remove") return ["pacman", "-Rns", "--noconfirm", name!];
    if (action === "update") return ["pacman", "-Syu", "--noconfirm"];
    return ["pacman", "-S", "--noconfirm", "--needed", name!];
  },
};

const apt: PkgManager = {
  id: "apt",
  bin: "apt",
  missingHint: "Checking for updates needs apt, which this machine doesn't have.",

  async available(): Promise<boolean> {
    return has("apt-get");
  },

  async updates(): Promise<Array<[string, string, string]>> {
    // -s is a dry run: no root, no lock, no changes. Exactly what a status
    // check should cost. Lines look like:
    //   Inst curl [7.81.0-1] (7.81.0-2 Ubuntu:22.04/jammy [amd64])
    const r = await run("apt-get", ["-s", "upgrade"], { timeout: 25_000 });
    const out: Array<[string, string, string]> = [];
    for (const line of r.stdout.split("\n")) {
      const m = /^Inst\s+(\S+)\s+\[([^\]]+)\]\s+\(([^\s)]+)/.exec(line.trim());
      if (m) out.push([m[1], m[2], m[3]]);
    }
    return out;
  },

  async search(needle: string): Promise<Array<{ name: string; version: string; description: string; repo: string }>> {
    // apt-cache is read-only and needs no root.
    const res = await run("apt-cache", ["search", "--names-only", needle], { timeout: 15_000 });

    const rows: Array<{ name: string; description: string }> = [];
    for (const line of res.stdout.trim().split("\n").filter(Boolean).slice(0, 60)) {
      const i = line.indexOf(" - ");
      rows.push(
        i === -1
          ? { name: line.trim(), description: "" }
          : { name: line.slice(0, i).trim(), description: line.slice(i + 3).trim() },
      );
    }

    // Versions come from a second call; one policy call covers every hit.
    const versions = new Map<string, string>();
    if (rows.length) {
      try {
        const names: string[] = rows.map((row: { name: string }): string => row.name);
        const p = await run("apt-cache", ["policy", ...names], { timeout: 15_000 });
        let current = "";
        for (const line of p.stdout.split("\n")) {
          const nameLine = /^(\S+):$/.exec(line);
          if (nameLine) current = nameLine[1];
          const cand = /^\s*Candidate:\s*(\S+)/.exec(line);
          if (cand && current) versions.set(current, cand[1] === "(none)" ? "" : cand[1]);
        }
      } catch {
        /* versions are a nicety, not a requirement */
      }
    }

    return rows.map(
      (row: { name: string; description: string }) => ({
        name: row.name,
        version: versions.get(row.name) ?? "",
        description: row.description,
        repo: "apt",
      }),
    );
  },

  async installed(): Promise<string[]> {
    if (!(await has("apt-mark"))) return [];
    return (await run("apt-mark", ["showmanual"])).stdout.trim().split("\n").filter(Boolean);
  },

  argv(action: "install" | "remove" | "update", name?: string): string[] {
    const base = ["apt-get", "-y", "-o", "Dpkg::Options::=--force-confold"];
    if (action === "remove") return [...base, "remove", name!];
    if (action === "update") return ["sh", "-c", "apt-get update && apt-get -y upgrade"];
    return [...base, "install", name!];
  },
};

const ALL = [pacman, apt];

let cached: PkgManager | null | undefined;

/**
 * Whichever package manager this machine has, or null if it has none.
 * Detected once — a box does not change distro while it runs.
 */
export async function detect(): Promise<PkgManager | null> {
  if (cached !== undefined) return cached;
  for (const m of ALL) {
    if (await m.available()) {
      cached = m;
      return cached;
    }
  }
  cached = null;
  return null;
}

/** For tests and for forcing one in config. */
export function byId(id: string): PkgManager | null {
  return ALL.find((m) => m.id === id) ?? null;
}
