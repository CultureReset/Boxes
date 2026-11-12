import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Activity,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bluetooth,
  ChevronRight,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { api } from "../api/client";
import type { SystemStats } from "../api/types";
import { isLocalDesktopShell } from "../lib/openApp";
import { clock } from "../lib/format";
import { navigate } from "../lib/router";
import { useStatus } from "../state/status";
import { fmtPct, hottestTemp, useSystemStats } from "../state/sysmon";
import { Slider } from "./ui";

function useTvShell(): boolean {
  const [tv, setTv] = useState(() => (typeof document !== "undefined" ? isLocalDesktopShell() : false));
  useEffect(() => {
    const sync = () => setTv(isLocalDesktopShell());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", sync);
    return () => { obs.disconnect(); window.removeEventListener("resize", sync); };
  }, []);
  return tv;
}

function useMode(tv: boolean): "tv" | "phone" | "desktop" {
  const [narrow, setNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 700 : false));
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 700);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  if (tv) return "tv";
  return narrow ? "phone" : "desktop";
}

function hotClass(n: number | null | undefined, warnAt: number, critAt = warnAt + 15): string {
  if (n == null) return "";
  if (n >= critAt) return " is-crit";
  if (n >= warnAt) return " is-warn";
  return "";
}

function Vital({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <span className={`node-sb-vital${cls ?? ""}`}>
      <span className="node-sb-vital-label">{label}</span>
      <span className="node-sb-vital-value">{value}</span>
    </span>
  );
}

function Gauge({ label, value, display, hint }: { label: string; value: number | null | undefined; display: string; hint?: string }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const cls = hotClass(value ?? null, 80, 95);
  return (
    <div className={`node-cc-gauge${cls}`}>
      <div className="node-cc-gauge-top">
        <span className="node-cc-gauge-label">{label}</span>
        <span className="node-cc-gauge-value">{display}</span>
      </div>
      <div className="node-cc-bar" aria-hidden="true">
        <div className="node-cc-bar-fill" style={{ width: `${v}%` }} />
      </div>
      {hint && <div className="node-cc-gauge-hint">{hint}</div>}
    </div>
  );
}

function ControlCenter({
  onClose,
  stats,
  mode,
}: {
  onClose: () => void;
  stats: SystemStats | null;
  mode: "tv" | "phone" | "desktop";
}) {
  const { status } = useStatus();
  const [vol, setVol] = useState<number | null>(null);
  const [bright, setBright] = useState<number | null>(null);
  const volume = vol ?? status?.audio?.volume ?? 0;
  const brightness = bright ?? status?.brightness ?? 100;
  const temp = hottestTemp(stats);
  const gpu = stats?.gpu;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const go = (screen: string, sub?: string) => {
    onClose();
    navigate(screen, sub);
  };

  return (
    <div className={`node-cc-backdrop node-cc-${mode}`} onClick={onClose} role="presentation">
      <div
        className="node-cc"
        role="dialog"
        aria-label="Quick settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="node-cc-head">
          <h2>Quick Settings</h2>
          <button type="button" className="node-cc-close" aria-label="Close" onClick={onClose}>
            <X size={mode === "tv" ? 22 : 16} />
          </button>
        </div>

        <div className="node-cc-tiles">
          <div className="node-cc-tile" title={status?.network.ssid}>
            {status?.network.online ? <Wifi size={20} /> : <WifiOff size={20} />}
            <span className="node-cc-tile-title">{status?.network.online ? (status.network.ssid ?? (status.network.type === "ethernet" ? "Ethernet" : "Online")) : "Offline"}</span>
            <span className="node-cc-tile-sub">{status?.network.type === "unknown" ? "Unavailable" : status?.network.type ?? ""}</span>
          </div>
          <div className="node-cc-tile">
            <Bluetooth size={20} />
            <span className="node-cc-tile-title">{status?.bluetooth.powered ? (status.bluetooth.connected[0] ?? "On") : "Bluetooth"}</span>
            <span className="node-cc-tile-sub">{status?.bluetooth.unavailable ? "Unavailable" : status?.bluetooth.powered ? (status.bluetooth.connected.length ? "Connected" : "On") : "Off"}</span>
          </div>
          <button
            type="button"
            className={`node-cc-tile${status?.audio?.muted ? " is-on" : ""}`}
            disabled={!status?.audio}
            onClick={() => status?.audio && void api.post("/api/audio/mute", { muted: !status.audio.muted })}
          >
            {status?.audio?.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            <span className="node-cc-tile-title">{status?.audio ? (status.audio.muted ? "Muted" : "Sound") : "Sound"}</span>
            <span className="node-cc-tile-sub">{status?.audio ? (status.audio.muted ? "Tap to unmute" : status.audio.sink) : "Unavailable"}</span>
          </button>
        </div>

        {status?.brightness != null && (
          <div className="node-cc-slider">
            <Sun size={18} />
            <Slider
              value={brightness}
              min={1}
              onChange={setBright}
              onCommit={(n) => { void api.post("/api/display/brightness", { brightness: n }); setBright(null); }}
            />
            <span className="node-cc-slider-val">{Math.round(brightness)}%</span>
          </div>
        )}
        {status?.audio && (
          <div className="node-cc-slider">
            {status.audio.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <Slider
              value={volume}
              onChange={setVol}
              onCommit={(n) => { void api.post("/api/audio/volume", { volume: n }); setVol(null); }}
            />
            <span className="node-cc-slider-val">{status.audio.muted ? "Muted" : `${Math.round(volume)}%`}</span>
          </div>
        )}

        <div className="node-cc-gauges">
          <Gauge
            label="CPU"
            value={stats?.cpu.busyPct}
            display={fmtPct(stats?.cpu.busyPct)}
            hint={[stats?.cpu.tempC != null ? `${Math.round(stats.cpu.tempC)}°C` : null, stats?.cpu.model].filter(Boolean).join(" · ") || undefined}
          />
          <Gauge
            label="GPU"
            value={gpu?.present ? gpu.busyPct : null}
            display={gpu?.present ? fmtPct(gpu.busyPct) : "None"}
            hint={gpu?.present ? [gpu.name, gpu.tempC != null ? `${Math.round(gpu.tempC)}°C` : null, gpu.watts != null ? `${gpu.watts} W` : null].filter(Boolean).join(" · ") : (gpu?.why ?? undefined)}
          />
          <Gauge
            label="Memory"
            value={stats?.mem.pct}
            display={stats ? `${stats.mem.usedMB} / ${stats.mem.totalMB} MB` : "—"}
            hint={stats ? `${fmtPct(stats.mem.pct)} used` : undefined}
          />
          <Gauge
            label="Temp"
            value={temp}
            display={temp != null ? `${Math.round(temp)}°C` : "—"}
            hint={stats?.temps.length ? stats.temps.slice(0, 4).map((t) => `${t.label} ${Math.round(t.celsius)}°`).join(" · ") : undefined}
          />
        </div>

        <div className="node-cc-links">
          <button type="button" onClick={() => go("settings", "system")}>
            <Activity size={16} /> System Monitor <ChevronRight size={16} />
          </button>
          <button type="button" onClick={() => go("settings", "sound")}>
            <Volume2 size={16} /> Sound <ChevronRight size={16} />
          </button>
          <button type="button" onClick={() => go("settings", "display")}>
            <Sun size={16} /> Display <ChevronRight size={16} />
          </button>
          <button type="button" onClick={() => go("settings", "wifi")}>
            <Wifi size={16} /> Wi-Fi <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Always-on iPad-style status bar: live vitals and a tap target for Quick Settings.
 * Sits above AppView (and the Home bar) so it is reachable on every screen.
 */
export function StatusBar() {
  const { status } = useStatus();
  const stats = useSystemStats();
  const tv = useTvShell();
  const mode = useMode(tv);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const ref = useRef<HTMLDivElement>(null);
  const temp = hottestTemp(stats);
  const bat = status?.battery;
  const BatIcon = !bat?.present ? null : bat.charging ? BatteryCharging : bat.percent > 60 ? BatteryFull : bat.percent > 25 ? BatteryMedium : BatteryLow;

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--node-statusbar-height", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--node-statusbar-height");
    };
  }, [mode]);

  const compact = mode === "phone";

  return (
    <>
      <div ref={ref} className={`node-statusbar node-statusbar-${mode}`} role="region" aria-label="System status">
        <span className="node-sb-clock" suppressHydrationWarning>{clock(now)}</span>
        <button
          type="button"
          className="node-sb-cluster"
          aria-label="Quick settings"
          aria-expanded={open}
          title="Quick settings"
          onClick={() => setOpen(true)}
        >
          <Vital label="CPU" value={fmtPct(stats?.cpu.busyPct)} cls={hotClass(stats?.cpu.busyPct, 85, 95)} />
          {(!compact || stats?.gpu.present) && stats?.gpu.present && (
            <Vital label="GPU" value={fmtPct(stats.gpu.busyPct)} cls={hotClass(stats.gpu.busyPct, 85, 95)} />
          )}
          <Vital label="MEM" value={fmtPct(stats?.mem.pct)} cls={hotClass(stats?.mem.pct, 85, 95)} />
          {temp != null && <Vital label="" value={`${Math.round(temp)}°`} cls={hotClass(temp, 75, 90)} />}
          <span className="node-sb-icons">
            {status?.network.online ? <Wifi size={mode === "tv" ? 18 : 14} /> : <WifiOff size={mode === "tv" ? 18 : 14} />}
            {status?.bluetooth.powered && status.bluetooth.connected.length > 0 && <Bluetooth size={mode === "tv" ? 17 : 13} />}
            {status?.audio && (status.audio.muted ? <VolumeX size={mode === "tv" ? 18 : 14} /> : <Volume2 size={mode === "tv" ? 18 : 14} />)}
            {BatIcon && bat && (
              <span className={`node-sb-bat${bat.percent <= 15 && !bat.charging ? " is-crit" : ""}`}>
                <BatIcon size={mode === "tv" ? 19 : 15} />
                {!compact && <span>{bat.percent}%</span>}
              </span>
            )}
          </span>
        </button>
      </div>
      {open && <ControlCenter onClose={() => setOpen(false)} stats={stats} mode={mode} />}
    </>
  );
}
