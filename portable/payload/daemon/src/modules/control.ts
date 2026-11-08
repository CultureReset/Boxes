import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../exec.js";
import { HttpError } from "../router.js";

/**
 * Start / stop / restart the services listed in config/services-control.json.
 * Only ids from that file are accepted, and only systemctl --user or docker is
 * run (argument arrays, never a shell), so nothing here needs sudo and nothing
 * outside the list can be touched.
 */
export interface ControlEntry {
  id: string;
  name: string;
  tier: "core" | "on-demand";
  kind: "systemd" | "docker";
  units: string[];
  url: string | null;
  why: string;
  self?: boolean;
  /** Shown inside this entry instead of as its own top-level entry. */
  parent?: string;
  /** Parts with no service of their own, listed inside this entry. */
  includes?: { name: string; why: string }[];
}

export interface UnitState {
  unit: string;
  running: boolean;
  state: string;
}

export interface ControlStatus extends ControlEntry {
  status: "running" | "partial" | "stopped";
  unitStates: UnitState[];
}

export type ControlAction = "start" | "stop" | "restart";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.NODEOS_CONTROL_FILE ?? path.resolve(here, "../../../config/services-control.json");

async function entries(): Promise<ControlEntry[]> {
  const j = JSON.parse(await readFile(FILE, "utf8")) as { services: ControlEntry[] };
  return j.services.filter((s) => (s.kind === "systemd" || s.kind === "docker") && Array.isArray(s.units) && s.units.length > 0);
}

async function unitState(kind: ControlEntry["kind"], unit: string): Promise<UnitState> {
  if (kind === "systemd") {
    const r = await run("systemctl", ["--user", "show", unit, "-p", "ActiveState", "-p", "SubState", "--value"]);
    const [active = "unknown", sub = ""] = r.stdout.trim().split("\n");
    return { unit, running: active === "active" && sub === "running", state: sub ? `${active} (${sub})` : active };
  }
  const r = await run("docker", ["inspect", "-f", "{{.State.Status}}|{{.State.Health}}", unit]);
  if (!r.ok) return { unit, running: false, state: "missing" };
  const [st, health] = r.stdout.trim().split("|");
  const h = /healthy|unhealthy|starting/.exec(health ?? "")?.[0];
  return { unit, running: st === "running", state: h ? `${st} (${h})` : st };
}

async function withState(e: ControlEntry): Promise<ControlStatus> {
  const unitStates = await Promise.all(e.units.map((u) => unitState(e.kind, u)));
  const up = unitStates.filter((u) => u.running).length;
  return { ...e, unitStates, status: up === unitStates.length ? "running" : up === 0 ? "stopped" : "partial" };
}

export async function controlList(): Promise<ControlStatus[]> {
  return Promise.all((await entries()).map(withState));
}

export async function controlOne(id: string): Promise<ControlStatus> {
  const e = (await entries()).find((x) => x.id === id);
  if (!e) throw new HttpError(404, `Unknown service ${id}`);
  return withState(e);
}

export async function controlAction(id: string, action: string): Promise<{ ok: boolean; status?: ControlStatus; error?: string }> {
  if (action !== "start" && action !== "stop" && action !== "restart") throw new HttpError(400, "action must be start, stop or restart");
  const e = (await entries()).find((x) => x.id === id);
  if (!e) throw new HttpError(404, `Unknown service ${id}`);
  if (e.self) {
    if (action !== "restart") throw new HttpError(400, "NODE can only restart itself");
    // Answer first; systemd restarts us a moment later.
    setTimeout(() => void run("systemctl", ["--user", "restart", "--no-block", ...e.units]), 500).unref();
    return { ok: true };
  }
  const units = action === "stop" ? [...e.units].reverse() : e.units;
  let error: string | undefined;
  if (e.kind === "systemd") {
    const r = await run("systemctl", ["--user", action, ...units], { timeout: 300_000 });
    if (!r.ok) error = r.stderr.trim() || `systemctl ${action} failed`;
  } else {
    for (const u of units) {
      const r = await run("docker", [action, u], { timeout: 180_000 });
      if (!r.ok) {
        error = `${u}: ${r.stderr.trim() || `docker ${action} failed`}`;
        break;
      }
    }
  }
  return { ok: !error, error, status: await withState(e) };
}
