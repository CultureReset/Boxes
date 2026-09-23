import { has, run, stream } from "../exec.js";
import { isDemo } from "./status.js";
import { detect as detectPkg } from "./providers/pkgmgr.js";
import { check, type FeatureStatus } from "./features.js";
import * as flathub from "./providers/flathub.js";
import { createJob, appendLine, finishJob } from "./jobs.js";
import { refreshAppsCache } from "./apps.js";
import { HttpError } from "../router.js";
import type { Job } from "../types.js";

export interface Package {
  name: string;
  version: string;
  description: string;
  repo: string;
  installed: boolean;
  /** Which real source this came from, and the id to install by. */
  /** Where it came from. "apt" added so Debian/Ubuntu boxes report honestly. */
  source: "flathub" | "pacman" | "apt";
  appId?: string;
  icon?: string;
}

export interface PackageResult {
  status: FeatureStatus;
  packages: Package[];
}

const NAME_RE = /^[a-z0-9@._+-]+$/i;

let updatesCache: { at: number; count: number | null } | null = null;

/**
 * Count of pending updates, or null when this machine cannot be asked.
 * "None" and "cannot tell" are different answers and the UI shows both.
 * Cached for 15 minutes; checkupdates hits the network.
 */
export async function updatesCount(): Promise<number | null> {
  if (updatesCache && Date.now() - updatesCache.at < 15 * 60_000) return updatesCache.count;
  let count: number | null = null;

  // Ask whichever package manager this machine actually has. Used to check
  // for `checkupdates` alone, which meant every Debian or Ubuntu box reported
  // "cannot check" forever and offered to install pacman-contrib.
  const pm = await detectPkg();
  if (pm) {
    try {
      count = (await pm.updates()).length;
    } catch {
      count = null; // asked and couldn't answer — different from "none"
    }
  } else if (await isDemo()) count = 3;

  updatesCache = { at: Date.now(), count };
  return count;
}

/** Zero updates and "cannot check" are different things; the UI says which. */
export async function updatesStatus(): Promise<FeatureStatus> {
  const pm = await detectPkg();
  if (pm) return { available: true, demo: false, tool: pm.bin, install: pm.bin };
  if (await isDemo()) return { available: true, demo: true, tool: "none", install: "" };
  return {
    available: false,
    demo: false,
    tool: "none",
    install: "",
    reason: "No supported package manager found on this machine.",
  };
}

export async function listUpdates(): Promise<PackageResult> {
  const f = await updatesStatus();
  if (!f.available) return { status: f, packages: [] };
  if (f.demo) {
    return { status: f, packages: [
      { name: "linux", version: "6.18.2 → 6.18.4", description: "The Linux kernel", repo: "core", installed: true, source: "pacman" },
      { name: "chromium", version: "140.0 → 140.1", description: "Web browser", repo: "extra", installed: true, source: "pacman" },
      { name: "omarchy", version: "3.4.1 → 3.5.0", description: "Omarchy", repo: "omarchy", installed: true, source: "pacman" },
    ] };
  }

  const pm = await detectPkg();
  if (!pm) return { status: f, packages: [] };

  const rows = await pm.updates();
  return {
    status: f,
    packages: rows.map(([name, from, to]) => ({
      name,
      version: `${from} → ${to}`,
      description: "",
      repo: "",
      installed: true,
      source: pm.id,
    })),
  };
}

/**
 * The store reads real catalogues: Flathub over its public API (works on any
 * distribution, and is what a freshly installed machine sees) and pacman when
 * the machine has it. Nothing here is a list typed into the source code.
 */
export async function searchPackages(q: string): Promise<PackageResult> {
  const needle = q.trim().toLowerCase();
  const fromFlathub = (needle ? await flathub.search(needle) : await flathub.popular()).map((a) => ({
    name: a.name,
    version: a.developer ?? "Flathub",
    description: a.summary,
    repo: "flathub",
    installed: a.installed,
    source: "flathub" as const,
    appId: a.id,
    icon: a.icon,
  }));
  const f = await check("pacman");
  if (!f.available) {
    // No pacman is fine as long as Flathub answered; only both failing is a dead end.
    if (fromFlathub.length > 0) return { status: { available: true, demo: false }, packages: fromFlathub };
    return { status: { available: false, demo: false, tool: "flatpak", install: "flatpak", reason: "The App Store needs either flatpak (for Flathub) or pacman, and could not reach a catalogue." }, packages: [] };
  }
  if (!needle) return { status: f, packages: [...(await featured()), ...fromFlathub] };
  const installed = new Set((await run("pacman", ["-Qq"])).stdout.split("\n"));
  const r = await run("pacman", ["-Ss", needle], { timeout: 15000 });
  const out: Package[] = [];
  const lines = r.stdout.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\S+)\/(\S+)\s+(\S+)/);
    if (!m) continue;
    const description = (lines[i + 1] ?? "").trim();
    out.push({ repo: m[1], name: m[2], version: m[3], description, installed: installed.has(m[2]), source: "pacman" });
  }
  return { status: f, packages: [...out.slice(0, 40), ...fromFlathub] };
}

/**
 * Native picks for an empty search box, taken from the package lists Omarchy
 * actually ships rather than a list invented here. No Omarchy, no native
 * picks: Flathub carries the store on its own.
 */
async function featured(): Promise<Package[]> {
  const { readFile } = await import("node:fs/promises");
  const { OMARCHY_PATH } = await import("../paths.js");
  const names = new Set<string>();
  for (const file of ["install/omarchy-other.packages", "install/omarchy-base.packages"]) {
    try {
      const text = await readFile(`${OMARCHY_PATH}/${file}`, "utf8");
      for (const line of text.split("\n")) {
        const n = line.trim();
        if (n && !n.startsWith("#") && NAME_RE.test(n)) names.add(n);
      }
    } catch {
      /* Omarchy is not installed here */
    }
  }
  if (names.size === 0) return [];
  const installed = new Set((await run("pacman", ["-Qq"])).stdout.split("\n"));
  const out: Package[] = [];
  for (const name of [...names].filter((n) => !installed.has(n)).slice(0, 24)) {
    const r = await run("pacman", ["-Si", name]);
    if (!r.ok) continue;
    const get = (k: string) => r.stdout.match(new RegExp(`^${k}\\s*:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";
    out.push({ name, version: get("Version"), description: get("Description"), repo: get("Repository"), installed: false, source: "pacman" });
  }
  return out;
}

export async function installedPackages(): Promise<string[]> {
  if (!(await has("pacman"))) return [];
  return (await run("pacman", ["-Qeq"])).stdout.trim().split("\n");
}

/**
 * Install or remove a package as a background job. Privilege comes from pkexec
 * (polkit shows the system password dialog), never from a stored password.
 */
/**
 * Install or remove, routed to whichever real source owns the id. A Flathub
 * app id goes to flatpak (user scope, no root); anything else goes to pacman
 * through pkexec so polkit shows the system password dialog.
 */
export async function packageJob(action: "install" | "remove" | "update", name?: string, source?: "flathub" | "pacman"): Promise<Job> {
  if (source === "flathub" || (name && source !== "pacman" && name.includes(".") && flathub.validId(name) && action !== "update")) {
    const f = await flathub.status();
    if (!f.available) throw new HttpError(503, f.reason!);
    return flathub.install(name!, action === "remove");
  }
  if (name && !NAME_RE.test(name)) throw new HttpError(400, "Invalid package name");
  const f = await check("pacman");
  if (!f.available) throw new HttpError(503, f.reason!);
  const title = action === "update" ? "Updating everything" : `${action === "install" ? "Installing" : "Removing"} ${name}`;
  const job = createJob(action, title, { name });
  void (async () => {
    if (await isDemo()) {
      for (const l of ["resolving dependencies...", "looking for conflicting packages...", `${action === "remove" ? "removing" : "installing"} ${name ?? "packages"}...`, "running post-transaction hooks...", "done"]) {
        appendLine(job, l);
        await new Promise((r) => setTimeout(r, 500));
      }
      finishJob(job, true);
      return;
    }
    let cmd: string;
    let args: string[];
    if (action === "update" && (await has("omarchy-update"))) {
      cmd = "omarchy-update";
      args = [];
    } else if (action === "install" && (await has("omarchy-pkg-install"))) {
      cmd = "pkexec";
      args = ["pacman", "-S", "--noconfirm", "--needed", name!];
    } else {
      cmd = "pkexec";
      args = action === "remove" ? ["pacman", "-Rns", "--noconfirm", name!] : action === "update" ? ["pacman", "-Syu", "--noconfirm"] : ["pacman", "-S", "--noconfirm", "--needed", name!];
    }
    const code = await stream(cmd, args, (line) => appendLine(job, line));
    finishJob(job, code === 0);
    updatesCache = null;
    await refreshAppsCache();
  })();
  return job;
}
