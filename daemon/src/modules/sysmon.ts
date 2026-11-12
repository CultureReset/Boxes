/**
 * Read-only system monitoring for NODE.
 *
 * Reads /proc, amdgpu sysfs (Polaris RX 580), hwmon temps/power, docker stats,
 * and systemd unit resource fields. Never starts or stops anything.
 *
 * GPU path mirrors CultureReset/nextgent-vitals (node-vitals): ROCm dropped
 * Polaris, so nvidia-smi / rocm-smi are unused; amdgpu sysfs is the source of truth.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { run } from "../exec.js";

const DRM = "/sys/class/drm";
const CACHE_MS = 2000;
const TOP_N = 25;
const SERVICE_LIMIT = 80;

async function readText(p: string): Promise<string | null> {
  try {
    return (await readFile(p, "utf8")).trim();
  } catch {
    return null;
  }
}

async function readNum(p: string, div = 1): Promise<number | null> {
  const v = await readText(p);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / div : null;
}

// ── GPU (amdgpu sysfs) ────────────────────────────────────────────────

const AMD_PARTS: Record<string, string> = {
  "67df": "Radeon RX 580 / 570 (Polaris 10)",
  "6fdf": "Radeon RX 580 2048SP (Polaris 10)",
  "67ef": "Radeon RX 560 (Polaris 11)",
  "699f": "Radeon RX 550 (Polaris 12)",
  "731f": "Radeon RX 5700 (Navi 10)",
  "73df": "Radeon RX 6700 (Navi 22)",
  "744c": "Radeon RX 7900 (Navi 31)",
};

async function findCard(root = DRM): Promise<{ name: string; dev: string } | null> {
  let entries: string[] = [];
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }
  for (const e of entries.sort()) {
    if (!/^card\d+$/.test(e)) continue;
    const dev = join(root, e, "device");
    try {
      await stat(join(dev, "vendor"));
    } catch {
      continue;
    }
    return { name: e, dev };
  }
  return null;
}

async function hwmonDir(dev: string): Promise<string | null> {
  try {
    const dir = join(dev, "hwmon");
    const [first] = (await readdir(dir)).filter((d) => d.startsWith("hwmon"));
    return first ? join(dir, first) : null;
  } catch {
    return null;
  }
}

function activeClock(text: string | null): { mhz: number | null; level: number | null; max: number | null } {
  if (!text) return { mhz: null, level: null, max: null };
  const rows = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const all = rows
    .map((l) => {
      const m = /^(\d+):\s*(\d+)\s*mhz/i.exec(l);
      return m ? { level: Number(m[1]), mhz: Number(m[2]), active: l.includes("*") } : null;
    })
    .filter((r): r is { level: number; mhz: number; active: boolean } => Boolean(r));
  const on = all.find((r) => r.active) ?? null;
  return {
    mhz: on?.mhz ?? null,
    level: on?.level ?? null,
    max: all.length ? Math.max(...all.map((r) => r.mhz)) : null,
  };
}

export interface GpuStats {
  present: boolean;
  name: string | null;
  card: string | null;
  driver: string | null;
  busyPct: number | null;
  tempC: number | null;
  watts: number | null;
  wattCap: number | null;
  fanRpm: number | null;
  coreMhz: number | null;
  memMhz: number | null;
  vramUsedMB: number | null;
  vramTotalMB: number | null;
  vramPct: number | null;
  why?: string;
}

async function gpuStats(): Promise<GpuStats> {
  // Prefer nvidia-smi when present (not on this box).
  const nv = await run("nvidia-smi", ["--query-gpu=name,utilization.gpu,temperature.gpu,power.draw,power.limit,memory.used,memory.total", "--format=csv,noheader,nounits"], { timeout: 4000 });
  if (nv.ok) {
    const [name, util, temp, power, cap, memUsed, memTotal] = nv.stdout.trim().split("\n")[0]?.split(",").map((s) => s.trim()) ?? [];
    const used = Number(memUsed);
    const total = Number(memTotal);
    return {
      present: true,
      name: name || "NVIDIA",
      card: null,
      driver: "nvidia",
      busyPct: Number(util) || null,
      tempC: Number(temp) || null,
      watts: Number(power) || null,
      wattCap: Number(cap) || null,
      fanRpm: null,
      coreMhz: null,
      memMhz: null,
      vramUsedMB: Number.isFinite(used) ? Math.round(used) : null,
      vramTotalMB: Number.isFinite(total) ? Math.round(total) : null,
      vramPct: Number.isFinite(used) && Number.isFinite(total) && total > 0 ? Math.round((used / total) * 100) : null,
    };
  }

  const card = await findCard();
  if (!card) return { present: false, name: null, card: null, driver: null, busyPct: null, tempC: null, watts: null, wattCap: null, fanRpm: null, coreMhz: null, memMhz: null, vramUsedMB: null, vramTotalMB: null, vramPct: null, why: "no GPU under /sys/class/drm" };

  const { dev } = card;
  const hw = await hwmonDir(dev);
  const [vendorId, deviceId, sclk, mclk, busy, vramUsed, vramTotal, temp, powerAvg, powerIn, powerCap, fan] = await Promise.all([
    readText(join(dev, "vendor")),
    readText(join(dev, "device")),
    readText(join(dev, "pp_dpm_sclk")),
    readText(join(dev, "pp_dpm_mclk")),
    readNum(join(dev, "gpu_busy_percent")),
    readNum(join(dev, "mem_info_vram_used")),
    readNum(join(dev, "mem_info_vram_total")),
    hw ? readNum(join(hw, "temp1_input"), 1000) : Promise.resolve(null),
    hw ? readNum(join(hw, "power1_average"), 1_000_000) : Promise.resolve(null),
    hw ? readNum(join(hw, "power1_input"), 1_000_000) : Promise.resolve(null),
    hw ? readNum(join(hw, "power1_cap"), 1_000_000) : Promise.resolve(null),
    hw ? readNum(join(hw, "fan1_input")) : Promise.resolve(null),
  ]);

  const id = deviceId?.replace(/^0x/, "").toLowerCase() ?? null;
  const amd = vendorId === "0x1002";
  const core = activeClock(sclk);
  const mem = activeClock(mclk);
  const watts = powerAvg ?? powerIn;

  return {
    present: true,
    name: amd ? (AMD_PARTS[id ?? ""] ?? `AMD device ${id}`) : id ? `PCI ${vendorId}:${id}` : null,
    card: card.name,
    driver: amd ? "amdgpu" : null,
    busyPct: busy,
    tempC: temp,
    watts: watts != null ? Math.round(watts * 100) / 100 : null,
    wattCap: powerCap != null ? Math.round(powerCap * 100) / 100 : null,
    fanRpm: fan != null ? Math.round(fan) : null,
    coreMhz: core.mhz,
    memMhz: mem.mhz,
    vramUsedMB: vramUsed != null ? Math.round(vramUsed / 1048576) : null,
    vramTotalMB: vramTotal != null ? Math.round(vramTotal / 1048576) : null,
    vramPct: vramUsed != null && vramTotal != null && vramTotal > 0 ? Math.round((vramUsed / vramTotal) * 100) : null,
  };
}

// ── CPU ───────────────────────────────────────────────────────────────

interface CpuSnap {
  idle: number;
  total: number;
  cores: { idle: number; total: number }[];
}

let prevCpu: CpuSnap | null = null;

function parseStat(text: string): CpuSnap | null {
  const lines = text.split("\n").filter((l) => /^cpu[\d ]/.test(l));
  if (!lines.length) return null;
  const parse = (line: string) => {
    const n = line.split(/\s+/).slice(1).map(Number);
    const idle = n[3] + (n[4] ?? 0);
    const total = n.reduce((a, b) => a + b, 0);
    return { idle, total };
  };
  const all = parse(lines[0]);
  const cores = lines.slice(1).filter((l) => /^cpu\d+/.test(l)).map(parse);
  return { ...all, cores };
}

function pctDelta(cur: { idle: number; total: number }, prev: { idle: number; total: number } | undefined): number | null {
  if (!prev) return null;
  const dt = cur.total - prev.total;
  const di = cur.idle - prev.idle;
  return dt > 0 ? Math.round(((dt - di) / dt) * 1000) / 10 : null;
}

export interface CpuStats {
  busyPct: number | null;
  perCore: number[];
  load: { one: number; five: number; fifteen: number };
  cores: number;
  mhz: number | null;
  model: string | null;
  tempC: number | null;
}

async function cpuStats(): Promise<CpuStats> {
  const [statText, loadText, cpuinfo, k10] = await Promise.all([
    readText("/proc/stat"),
    readText("/proc/loadavg"),
    readText("/proc/cpuinfo"),
    readNum("/sys/class/hwmon/hwmon1/temp1_input", 1000).catch(() => null),
  ]);

  // Prefer k10temp by name walk
  let cpuTemp = k10;
  try {
    for (const h of await readdir("/sys/class/hwmon")) {
      const name = await readText(`/sys/class/hwmon/${h}/name`);
      if (name === "k10temp" || name === "coretemp") {
        cpuTemp = await readNum(`/sys/class/hwmon/${h}/temp1_input`, 1000);
        break;
      }
    }
  } catch {
    /* ignore */
  }

  const cur = statText ? parseStat(statText) : null;
  const busyPct = cur ? pctDelta(cur, prevCpu ?? undefined) : null;
  const perCore = cur
    ? cur.cores.map((c, i) => pctDelta(c, prevCpu?.cores[i]) ?? 0).map((n) => (n == null ? 0 : n))
    : [];
  if (cur) prevCpu = cur;

  const [one, five, fifteen] = (loadText ?? "").split(/\s+/).map(Number);
  const mhzList = (cpuinfo ?? "")
    .split("\n")
    .filter((l) => l.startsWith("cpu MHz"))
    .map((l) => Number(l.split(":")[1]));
  const model = /^model name\s*:\s*(.+)$/m.exec(cpuinfo ?? "")?.[1]?.trim() ?? null;
  const threads = (cpuinfo ?? "").split("\n").filter((l) => l.startsWith("processor")).length || (cur?.cores.length ?? 0);

  return {
    busyPct,
    perCore,
    load: { one: one || 0, five: five || 0, fifteen: fifteen || 0 },
    cores: threads,
    mhz: mhzList.length ? Math.round(mhzList.reduce((a, b) => a + b, 0) / mhzList.length) : null,
    model,
    tempC: cpuTemp != null ? Math.round(cpuTemp * 10) / 10 : null,
  };
}

// ── Memory / disks / power ────────────────────────────────────────────

export interface MemStats {
  totalMB: number;
  usedMB: number;
  availableMB: number;
  pct: number;
  swapTotalMB: number;
  swapUsedMB: number;
}

async function memStats(): Promise<MemStats> {
  const t = (await readText("/proc/meminfo")) ?? "";
  const g = (k: string) => {
    const m = new RegExp(`^${k}:\\s+(\\d+) kB`, "m").exec(t);
    return m ? Number(m[1]) * 1024 : 0;
  };
  const total = g("MemTotal");
  const avail = g("MemAvailable");
  const swapTotal = g("SwapTotal");
  const swapFree = g("SwapFree");
  const used = total - avail;
  return {
    totalMB: Math.round(total / 1048576),
    usedMB: Math.round(used / 1048576),
    availableMB: Math.round(avail / 1048576),
    pct: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
    swapTotalMB: Math.round(swapTotal / 1048576),
    swapUsedMB: Math.round((swapTotal - swapFree) / 1048576),
  };
}

export interface DiskStats {
  filesystem: string;
  mount: string;
  totalB: number;
  usedB: number;
  availB: number;
  pct: number;
}

async function diskStats(): Promise<DiskStats[]> {
  const r = await run("df", ["-PB1", "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs", "-x", "efivarfs"], { timeout: 5000 });
  if (!r.ok) return [];
  return r.stdout
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const p = line.trim().split(/\s+/);
      if (p.length < 6) return null;
      const [filesystem, size, used, avail, capacity, ...mountParts] = p;
      const mount = mountParts.join(" ");
      if (!mount.startsWith("/")) return null;
      const totalB = Number(size);
      const usedB = Number(used);
      const availB = Number(avail);
      return {
        filesystem,
        mount,
        totalB,
        usedB,
        availB,
        pct: Number(String(capacity).replace("%", "")) || (totalB > 0 ? Math.round((usedB / totalB) * 100) : 0),
      };
    })
    .filter((d): d is DiskStats => Boolean(d));
}

export interface PowerStats {
  gpuWatts: number | null;
  packageWatts: number | null;
  note: string | null;
}

async function powerStats(gpuWatts: number | null): Promise<PowerStats> {
  // RAPL energy_uj is root-only on this box — report null, never guess.
  let packageWatts: number | null = null;
  let note: string | null = null;
  try {
    const energy = await readText("/sys/class/powercap/intel-rapl:0/energy_uj");
    if (energy == null) note = "CPU package power (RAPL) not readable without root";
  } catch {
    note = "CPU package power (RAPL) not readable without root";
  }
  if (gpuWatts == null && packageWatts == null && !note) note = "No power sensors readable";
  return { gpuWatts, packageWatts, note };
}

export interface TempReading {
  name: string;
  label: string;
  celsius: number;
}

async function tempStats(): Promise<TempReading[]> {
  const out: TempReading[] = [];
  try {
    for (const h of await readdir("/sys/class/hwmon")) {
      const base = `/sys/class/hwmon/${h}`;
      const name = (await readText(join(base, "name"))) ?? h;
      const entries = await readdir(base);
      for (const e of entries) {
        const m = /^temp(\d+)_input$/.exec(e);
        if (!m) continue;
        const c = await readNum(join(base, e), 1000);
        if (c == null) continue;
        const label = (await readText(join(base, `temp${m[1]}_label`))) ?? `temp${m[1]}`;
        out.push({ name, label, celsius: Math.round(c * 10) / 10 });
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export interface SystemStats {
  at: string;
  cpu: CpuStats;
  mem: MemStats;
  gpu: GpuStats;
  disks: DiskStats[];
  power: PowerStats;
  temps: TempReading[];
  uptimeSeconds: number;
}

let statsCache: { at: number; value: SystemStats } | null = null;

export async function systemStats(force = false): Promise<SystemStats> {
  if (!force && statsCache && Date.now() - statsCache.at < CACHE_MS) return statsCache.value;
  // First CPU sample may be null busyPct — take a short second sample when cold.
  let cpu = await cpuStats();
  if (cpu.busyPct == null) {
    await new Promise((r) => setTimeout(r, 120));
    cpu = await cpuStats();
  }
  const [mem, gpu, disks, temps] = await Promise.all([memStats(), gpuStats(), diskStats(), tempStats()]);
  const power = await powerStats(gpu.watts);
  const uptimeSeconds = Number((await readText("/proc/uptime"))?.split(/\s+/)[0] ?? 0);
  const value: SystemStats = { at: new Date().toISOString(), cpu, mem, gpu, disks, power, temps, uptimeSeconds };
  statsCache = { at: Date.now(), value };
  return value;
}

// ── Processes ─────────────────────────────────────────────────────────

export interface ProcRow {
  pid: number;
  cpu: number;
  mem: number;
  rssKB: number;
  user: string;
  command: string;
}

export async function topProcesses(limit = TOP_N): Promise<ProcRow[]> {
  const n = Math.min(Math.max(1, limit), 100);
  const r = await run("ps", ["-eo", "pid,pcpu,pmem,rss,user,comm", "--sort=-pcpu", "--no-headers"], { timeout: 5000 });
  if (!r.ok) return [];
  return r.stdout
    .trim()
    .split("\n")
    .slice(0, n)
    .map((line) => {
      const m = /^\s*(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
      if (!m) return null;
      return {
        pid: Number(m[1]),
        cpu: Number(m[2]),
        mem: Number(m[3]),
        rssKB: Number(m[4]),
        user: m[5],
        command: m[6].trim(),
      };
    })
    .filter((p): p is ProcRow => Boolean(p));
}

// ── Docker containers ─────────────────────────────────────────────────

export interface ContainerRow {
  id: string;
  name: string;
  status: string;
  cpu: string;
  memUsage: string;
  memPct: string;
  netIO: string;
  blockIO: string;
}

export async function containerStats(): Promise<{ available: boolean; containers: ContainerRow[]; error?: string }> {
  const list = await run("docker", ["ps", "--format", "{{.ID}}\t{{.Names}}\t{{.Status}}"], { timeout: 5000 });
  if (!list.ok) return { available: false, containers: [], error: list.stderr.trim() || "docker unavailable" };
  const names = list.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [id, name, status] = l.split("\t");
      return { id, name, status };
    });
  if (!names.length) return { available: true, containers: [] };

  const stats = await run("docker", ["stats", "--no-stream", "--format", "{{json .}}"], { timeout: 15000 });
  const byName = new Map<string, Record<string, string>>();
  if (stats.ok) {
    for (const line of stats.stdout.trim().split("\n").filter(Boolean)) {
      try {
        const j = JSON.parse(line) as Record<string, string>;
        byName.set(j.Name ?? j.name ?? "", j);
      } catch {
        /* skip */
      }
    }
  }
  return {
    available: true,
    containers: names.map((n) => {
      const s = byName.get(n.name) ?? {};
      return {
        id: n.id,
        name: n.name,
        status: n.status,
        cpu: s.CPUPerc ?? "—",
        memUsage: s.MemUsage ?? "—",
        memPct: s.MemPerc ?? "—",
        netIO: s.NetIO ?? "—",
        blockIO: s.BlockIO ?? "—",
      };
    }),
  };
}

// ── systemd services ──────────────────────────────────────────────────

export interface ServiceRow {
  scope: "user" | "system";
  unit: string;
  description: string;
  active: string;
  sub: string;
  memoryB: number | null;
  cpuNSec: number | null;
}

async function listRunning(scope: "user" | "system"): Promise<string[]> {
  const args = scope === "user"
    ? ["--user", "list-units", "--type=service", "--state=running", "--no-legend", "--plain", "--no-pager"]
    : ["list-units", "--type=service", "--state=running", "--no-legend", "--plain", "--no-pager"];
  const r = await run("systemctl", args, { timeout: 8000 });
  if (!r.ok) return [];
  return r.stdout
    .trim()
    .split("\n")
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((u) => u.endsWith(".service"))
    .slice(0, SERVICE_LIMIT);
}

async function showUnit(scope: "user" | "system", unit: string): Promise<ServiceRow> {
  const args = scope === "user"
    ? ["--user", "show", unit, "-p", "Id", "-p", "Description", "-p", "ActiveState", "-p", "SubState", "-p", "MemoryCurrent", "-p", "CPUUsageNSec", "--no-pager"]
    : ["show", unit, "-p", "Id", "-p", "Description", "-p", "ActiveState", "-p", "SubState", "-p", "MemoryCurrent", "-p", "CPUUsageNSec", "--no-pager"];
  const r = await run("systemctl", args, { timeout: 4000 });
  const map: Record<string, string> = {};
  for (const line of r.stdout.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) map[line.slice(0, i)] = line.slice(i + 1);
  }
  const memRaw = map.MemoryCurrent;
  const cpuRaw = map.CPUUsageNSec;
  const memoryB = memRaw && memRaw !== "[not set]" && /^\d+$/.test(memRaw) ? Number(memRaw) : null;
  const cpuNSec = cpuRaw && cpuRaw !== "[not set]" && /^\d+$/.test(cpuRaw) ? Number(cpuRaw) : null;
  return {
    scope,
    unit: (map.Id ?? unit).replace(/\.service$/, ""),
    description: map.Description ?? "",
    active: map.ActiveState ?? "unknown",
    sub: map.SubState ?? "",
    memoryB,
    cpuNSec,
  };
}

export async function serviceStats(): Promise<{ user: ServiceRow[]; system: ServiceRow[] }> {
  const [userUnits, systemUnits] = await Promise.all([listRunning("user"), listRunning("system")]);
  const [user, system] = await Promise.all([
    Promise.all(userUnits.map((u) => showUnit("user", u))),
    Promise.all(systemUnits.map((u) => showUnit("system", u))),
  ]);
  const byMem = (a: ServiceRow, b: ServiceRow) => (b.memoryB ?? 0) - (a.memoryB ?? 0);
  return { user: user.sort(byMem), system: system.sort(byMem) };
}
