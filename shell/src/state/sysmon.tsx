import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SystemStats } from "../api/types";

/** Poll GET /api/system/stats. The daemon already caches for 2s. */
export function useSystemStats(intervalMs = 3000): SystemStats | null {
  const [stats, setStats] = useState<SystemStats | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void api
        .get<SystemStats>("/api/system/stats")
        .then((s) => { if (alive) setStats(s); })
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, intervalMs);
    return () => { alive = false; window.clearInterval(id); };
  }, [intervalMs]);
  return stats;
}

export function hottestTemp(stats: SystemStats | null): number | null {
  if (!stats) return null;
  const vals = [stats.cpu.tempC, stats.gpu.tempC, ...stats.temps.map((t) => t.celsius)].filter((n): n is number => n != null);
  return vals.length ? Math.max(...vals) : null;
}

export function fmtPct(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? "—" : `${Math.round(n)}%`;
}
