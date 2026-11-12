import { useCallback, useEffect, useState } from "react";
import { Activity, HardDrive, RefreshCw, Server, Thermometer } from "lucide-react";
import { api } from "../../api/client";
import type { SystemStats } from "../../api/types";
import { uptime } from "../../lib/format";
import { fmtPct } from "../../state/sysmon";

function barPct(n: number | null | undefined, warn = 80, crit = 95) {
  const v = Math.max(0, Math.min(100, Number(n) || 0));
  const color = v >= crit ? "var(--red)" : v >= warn ? "#ff9f0a" : "linear-gradient(90deg, var(--blue), var(--purple))";
  return (
    <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${v}%`, borderRadius: 4, background: color }} />
    </div>
  );
}

function Metric({ title, value, sub, pct }: { title: string; value: string; sub?: string; pct?: number | null }) {
  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div className="small dim" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 650 }}>{value}</div>
      {pct != null && barPct(pct)}
      {sub && <div className="dim small">{sub}</div>}
    </div>
  );
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

/**
 * Full System Monitor page — same /api/system/* the status bar uses.
 * Ported from the unpushed feat/node-system-monitor Settings panel (494941f).
 */
export function SystemMonitor() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [procs, setProcs] = useState<{ pid: number; cpu: number; mem: number; rssKB: number; user: string; command: string }[]>([]);
  const [containers, setContainers] = useState<{ available: boolean; containers: { name: string; status: string; cpu: string; memUsage: string; memPct: string }[]; error?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p, c] = await Promise.all([
        api.get<SystemStats>("/api/system/stats"),
        api.get<typeof procs>("/api/system/processes?limit=20"),
        api.get<NonNullable<typeof containers>>("/api/system/containers"),
      ]);
      setStats(s);
      setProcs(p ?? []);
      setContainers(c);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, [load]);

  const cpu = stats?.cpu;
  const mem = stats?.mem;
  const gpu = stats?.gpu;

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="stack grow">
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>System Monitor</h2>
          <span className="dim small">{stats ? `Updated ${new Date(stats.at).toLocaleTimeString()} · up ${uptime(stats.uptimeSeconds)}` : "Live CPU, GPU, memory, disks and what’s running"}</span>
        </div>
        <button type="button" className="btn ghost sm" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button>
      </div>
      {err && <div className="card" style={{ padding: 12, marginBottom: 12, color: "var(--red)" }}>{err}</div>}
      {stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            <Metric title="CPU" value={cpu?.busyPct != null ? fmtPct(cpu.busyPct) : "—"} pct={cpu?.busyPct} sub={[cpu?.tempC != null ? `${cpu.tempC}°C` : null, cpu?.mhz ? `${cpu.mhz} MHz` : null, cpu ? `load ${cpu.load.one.toFixed(2)}` : null, `${cpu?.cores ?? "?"} thr`].filter(Boolean).join(" · ")} />
            <Metric title="Memory" value={mem ? `${mem.usedMB} / ${mem.totalMB} MB` : "—"} pct={mem?.pct} sub={mem ? `swap ${mem.swapUsedMB}/${mem.swapTotalMB} MB · ${mem.availableMB} MB free` : undefined} />
            <Metric title="GPU" value={gpu?.present ? fmtPct(gpu.busyPct) : "None"} pct={gpu?.present ? gpu.busyPct : null} sub={gpu?.present ? [gpu.name, gpu.tempC != null ? `${gpu.tempC}°C` : null, gpu.watts != null ? `${gpu.watts} W` : null, gpu.vramUsedMB != null ? `VRAM ${gpu.vramUsedMB}/${gpu.vramTotalMB} MB` : null].filter(Boolean).join(" · ") : (gpu?.why ?? "No GPU")} />
            <Metric title="Power" value={stats.power.gpuWatts != null ? `${stats.power.gpuWatts} W GPU` : "—"} sub={[stats.power.packageWatts != null ? `CPU pkg ${stats.power.packageWatts} W` : null, stats.power.note].filter(Boolean).join(" · ") || undefined} />
          </div>

          {!!stats.disks.length && (
            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
              <div className="row" style={{ marginBottom: 8 }}><HardDrive size={16} className="dim" /><span style={{ fontWeight: 600 }}>Disks</span></div>
              {stats.disks.map((d) => (
                <div key={d.mount} style={{ marginBottom: 10 }}>
                  <div className="row" style={{ marginBottom: 4 }}><span className="t">{d.mount}</span><span className="spacer" /><span className="dim small">{bytes(d.usedB)} / {bytes(d.totalB)} ({d.pct}%)</span></div>
                  {barPct(d.pct)}
                </div>
              ))}
            </div>
          )}

          {!!stats.temps.length && (
            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
              <div className="row" style={{ marginBottom: 8 }}><Thermometer size={16} className="dim" /><span style={{ fontWeight: 600 }}>Temperatures</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                {stats.temps.map((t) => (
                  <div key={`${t.name}-${t.label}`} className="row" style={{ gap: 8 }}><span className="dim small">{t.name}/{t.label}</span><span className="spacer" /><span style={{ fontWeight: 600 }}>{t.celsius}°C</span></div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 14, marginBottom: 14, overflow: "auto" }}>
            <div className="row" style={{ marginBottom: 8 }}><Server size={16} className="dim" /><span style={{ fontWeight: 600 }}>Top processes</span></div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr className="dim small" style={{ textAlign: "left" }}><th style={{ padding: "4px 6px" }}>PID</th><th>CPU%</th><th>MEM%</th><th>Command</th></tr></thead>
              <tbody>
                {procs.map((p) => (
                  <tr key={p.pid} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "5px 6px" }} className="dim">{p.pid}</td>
                    <td>{p.cpu.toFixed(1)}</td>
                    <td>{p.mem.toFixed(1)}</td>
                    <td className="truncate" title={`${p.user} ${p.command}`}>{p.command}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 14, overflow: "auto" }}>
            <div className="row" style={{ marginBottom: 8 }}><Activity size={16} className="dim" /><span style={{ fontWeight: 600 }}>Docker containers</span></div>
            {!containers?.available && <div className="dim small">{containers?.error ?? "Docker unavailable"}</div>}
            {containers?.available && !containers.containers.length && <div className="dim small">No running containers</div>}
            {!!containers?.containers?.length && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr className="dim small" style={{ textAlign: "left" }}><th style={{ padding: "4px 6px" }}>Name</th><th>CPU</th><th>Memory</th><th>Status</th></tr></thead>
                <tbody>
                  {containers.containers.map((c) => (
                    <tr key={c.name} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "5px 6px", fontWeight: 500 }}>{c.name}</td>
                      <td>{c.cpu}</td>
                      <td>{c.memUsage} <span className="dim">({c.memPct})</span></td>
                      <td className="dim small">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
