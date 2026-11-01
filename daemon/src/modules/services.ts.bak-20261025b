import { run, runJson } from "../exec.js";

/**
 * What is running on this computer, read-only: systemd --user units, docker
 * containers and listening TCP ports. Ports that `tailscale serve` proxies get
 * the tailnet URL so the phone can open them. Nothing here starts or stops
 * anything.
 */
export interface ServiceEntry {
  kind: "systemd" | "docker";
  name: string;
  description: string;
  state: string;
  running: boolean;
}

export interface PortEntry {
  port: number;
  address: string;
  process: string;
  url: string | null;
}

export interface ServicesReport {
  services: ServiceEntry[];
  ports: PortEntry[];
}

async function systemdUnits(): Promise<ServiceEntry[]> {
  const r = await run("systemctl", ["--user", "list-units", "--type=service", "--all", "--no-legend", "--plain", "--no-pager"]);
  if (!r.ok) return [];
  return r.stdout
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length >= 4 && p[0].endsWith(".service") && p[1] === "loaded")
    .map(([unit, , active, sub, ...desc]) => ({ kind: "systemd" as const, name: unit.replace(/\.service$/, ""), description: desc.join(" "), state: `${active} (${sub})`, running: sub === "running" }));
}

async function dockerContainers(): Promise<ServiceEntry[]> {
  const r = await run("docker", ["ps", "-a", "--format", "{{.Names}}\t{{.Image}}\t{{.State}}\t{{.Status}}"]);
  if (!r.ok) return [];
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, image, state, status] = l.split("\t");
      return { kind: "docker" as const, name, description: image, state: status, running: state === "running" };
    });
}

/** Map local port -> tailnet https URL, from `tailscale serve status --json`. */
async function servedPorts(): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const j = await runJson<{ Web?: Record<string, { Handlers?: Record<string, { Proxy?: string }> }> }>("tailscale", ["serve", "status", "--json"]);
  for (const [hostPort, web] of Object.entries(j?.Web ?? {})) {
    const root = web.Handlers?.["/"]?.Proxy;
    const m = root?.match(/:(\d+)\/?$/);
    if (!m) continue;
    const [host, port] = hostPort.split(":");
    out.set(Number(m[1]), port === "443" ? `https://${host}/` : `https://${host}:${port}/`);
  }
  return out;
}

async function listeningPorts(served: Map<number, string>): Promise<PortEntry[]> {
  const r = await run("ss", ["-ltnpH"]);
  if (!r.ok) return [];
  const byPort = new Map<number, PortEntry>();
  for (const line of r.stdout.split("\n")) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 4) continue;
    const local = cols[3];
    const i = local.lastIndexOf(":");
    const port = Number(local.slice(i + 1));
    const address = local.slice(0, i);
    // Skip the tailscale serve listeners themselves and DNS stubs.
    if (!port || /%tailscale0|%lo$/.test(address)) continue;
    const proc = line.match(/users:\(\("([^"]+)"/)?.[1] ?? "";
    const prev = byPort.get(port);
    if (prev) {
      if (!prev.process && proc) prev.process = proc;
      continue;
    }
    const direct = /^(0\.0\.0\.0|\*|\[::\]|100\.)/.test(address) && process.env.NODEOS_HOST ? `http://${process.env.NODEOS_HOST}:${port}/` : null;
    byPort.set(port, { port, address, process: proc, url: served.get(port) ?? direct });
  }
  return [...byPort.values()].sort((a, b) => a.port - b.port);
}

export async function servicesReport(): Promise<ServicesReport> {
  const [units, containers, served] = await Promise.all([systemdUnits(), dockerContainers(), servedPorts()]);
  return { services: [...units, ...containers], ports: await listeningPorts(served) };
}
