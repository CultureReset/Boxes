import { useState } from "react";
import { Wifi, Bluetooth, Volume2, Sun, Palette, Bell, BatteryMedium, HardDrive, Download, Info, ChevronRight, Lock, Eye, EyeOff, RefreshCw, Moon, Zap, Check, Image as ImageIcon, Power, Shield, LayoutGrid, Smartphone, Tv, ArrowUp, ArrowDown, Usb, Users, Plus, Trash2, MapPin, Pencil } from "lucide-react";
import { api, useApi } from "../../api/client";
import type { AudioResult, BluetoothResult, BluetoothDevice, Job, MonitorResult, PackageResult, WifiResult, WifiNetwork, Notification, AndroidStatus, World, Shortcut, AppEntry, AgentsInfo, Look, FeatureStatus } from "../../api/types";
import { Unavailable, DemoBadge } from "../../components/Unavailable";
import { useWorld } from "../../state/world";
import { LOOKS } from "../Home";
import { ICON_NAMES, iconFor } from "../../lib/icons";
import { useLayout } from "../../state/layout";
import { HOME_ROWS } from "../../modules/homeRows";
import { detectTv } from "../../lib/tv";
import { Hero } from "../../components/Hero";
import { Toggle, Slider, Pill, Empty, Skeleton } from "../../components/ui";
import { Sheet } from "../../components/Sheet";
import { useStatus } from "../../state/status";
import { useToast } from "../../state/toast";
import { navigate } from "../../lib/router";
import { bytes, uptime, timeAgo } from "../../lib/format";
import { SETTINGS_INDEX } from "./index";

const ICONS: Record<string, typeof Wifi> = { worlds: Users, home: LayoutGrid, devices: Smartphone, wifi: Wifi, bluetooth: Bluetooth, sound: Volume2, display: Sun, appearance: Palette, notifications: Bell, power: BatteryMedium, storage: HardDrive, updates: Download, about: Info };

export function Settings({ panel, onJob }: { panel?: string; onJob: (id: string) => void }) {
  const { status } = useStatus();
  const { active: activeWorld } = useWorld();
  const { layout: lay } = useLayout();
  const worldName = activeWorld ? `${activeWorld.name} · ${activeWorld.kind}` : "";
  const layoutLook = lay ? LOOKS[lay.look]?.title ?? "" : "";
  const active = panel ?? "";
  const summary: Record<string, string> = {
    wifi: status?.network.type === "unknown" ? "Unavailable" : status?.network.online ? (status.network.ssid ?? "Wired") : "Off",
    bluetooth: status?.bluetooth.unavailable ? "Unavailable" : status?.bluetooth.powered ? (status.bluetooth.connected[0] ?? "On") : "Off",
    sound: status ? (status.audio ? (status.audio.muted ? "Muted" : `${status.audio.volume}%`) : "Unavailable") : "",
    display: status?.brightness != null ? `${status.brightness}%` : "",
    appearance: status?.theme ?? "",
    power: status?.battery?.present ? `${status.battery.percent}%` : "",
    updates: status == null ? "" : status.updates == null ? "Can\u2019t check here" : status.updates ? `${status.updates} available` : "Up to date",
    worlds: worldName,
    home: layoutLook,
  };
  return (
    <>
      <Hero title="Settings" subtitle="Simple controls for everything under the hood." tagline={status?.demo ? "Demo mode" : "A more capable you."} />
      <div style={{ display: "grid", gridTemplateColumns: active ? "minmax(220px, 300px) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="settings-layout">
        <div className={`list${active ? " settings-nav" : ""}`} style={!active ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", background: "transparent", border: 0, gap: 12, overflow: "visible" } : undefined}>
          {SETTINGS_INDEX.map((s) => {
            const Icon = ICONS[s.id] ?? Info;
            return (
              <button key={s.id} type="button" className={`list-row${!active ? " card" : ""}`} style={{ background: active === s.id ? "var(--glass-strong)" : undefined, borderRadius: !active ? "var(--r-md)" : undefined, border: !active ? "1px solid var(--line)" : undefined }} onClick={() => navigate("settings", s.id)}>
                <span className="ic" style={{ ["--ic" as string]: s.color }}><Icon size={18} /></span>
                <span className="stack grow"><span className="t">{s.title}</span>{summary[s.id] && <span className="s truncate">{summary[s.id]}</span>}</span>
                <ChevronRight size={16} style={{ color: "var(--text-3)" }} />
              </button>
            );
          })}
        </div>
        {active && (
          <div key={active} className="fade-in">
            {active === "worlds" && <WorldsPanel />}
            {active === "home" && <HomePanel />}
            {active === "devices" && <DevicesPanel onJob={onJob} />}
            {active === "wifi" && <WifiPanel onJob={onJob} />}
            {active === "bluetooth" && <BluetoothPanel onJob={onJob} />}
            {active === "sound" && <SoundPanel onJob={onJob} />}
            {active === "display" && <DisplayPanel onJob={onJob} />}
            {active === "appearance" && <AppearancePanel />}
            {active === "notifications" && <NotificationsSettings />}
            {active === "power" && <PowerPanel />}
            {active === "storage" && <StoragePanel />}
            {active === "updates" && <UpdatesPanel onJob={onJob} />}
            {active === "about" && <AboutPanel />}
          </div>
        )}
      </div>
      <style>{`@media (max-width: 840px) { .settings-layout { grid-template-columns: 1fr !important; } .settings-nav { display: none; } }`}</style>
    </>
  );
}

function PanelTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="row" style={{ marginBottom: 14 }}>
      <button type="button" className="btn ghost sm settings-back" style={{ display: "none" }} onClick={() => navigate("settings")}>‹ Settings</button>
      <div className="stack grow"><h2 style={{ fontSize: 20, fontWeight: 600 }}>{title}</h2>{sub && <span className="dim small">{sub}</span>}</div>
      {right}
      <style>{`@media (max-width: 840px) { .settings-back { display: inline-flex !important; } }`}</style>
    </div>
  );
}

function Signal({ n }: { n: number }) {
  return <span className="row" style={{ gap: 2, alignItems: "flex-end", height: 14 }}>{[1, 2, 3, 4].map((i) => <span key={i} style={{ width: 3, height: 3 + i * 3, borderRadius: 1, background: n >= i * 25 - 10 ? "var(--text)" : "rgba(255,255,255,.2)" }} />)}</span>;
}

function WifiPanel({ onJob }: { onJob: (id: string) => void }) {
  const { status } = useStatus();
  const { data, reload, loading } = useApi<WifiResult>("/api/wifi", ["network"]);
  const feature: FeatureStatus | undefined = data?.status;
  const nets = data?.networks;
  const [joining, setJoining] = useState<WifiNetwork | null>(null);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const on = status?.network.type !== "none" || (nets?.length ?? 0) > 0;
  const connect = async (n: WifiNetwork, password?: string) => {
    setBusy(true);
    try {
      const r = await api.post<{ ok: boolean; message: string }>("/api/wifi/connect", { ssid: n.ssid, password });
      toast(r.message, r.ok ? "ok" : "error");
      if (r.ok) setJoining(null);
    } finally {
      setBusy(false);
      reload();
    }
  };
  return (
    <>
      <PanelTitle title="Wi‑Fi" sub={feature && !feature.available ? "Unavailable on this machine" : status?.network.online ? `Connected to ${status.network.ssid ?? "Ethernet"}` : "Not connected"} right={feature?.available ? <button type="button" className="btn sm" onClick={() => void api.get("/api/wifi?rescan").then(reload)}><RefreshCw size={13} className={loading ? "spin" : ""} /> Scan</button> : undefined} />
      {feature && !feature.available && <Unavailable status={feature} onJob={onJob} />}
      {feature?.demo && <div style={{ marginBottom: 12 }}><DemoBadge what="Sample networks, not your machine" /></div>}
      {feature?.available && <>
      <div className="list" style={{ marginBottom: 14 }}>
        <div className="list-row"><span className="ic" style={{ ["--ic" as string]: "#0a84ff" }}><Wifi size={18} /></span><span className="t grow">Wi‑Fi</span><Toggle on={on} onChange={(v) => void api.post("/api/wifi/radio", { on: v }).then(reload)} /></div>
      </div>
      {loading && !data && <Skeleton h={200} />}
      <div className="list">
        {(nets ?? []).map((n) => (
          <button key={n.ssid} type="button" className="list-row" onClick={() => (n.active ? null : n.security && !n.saved ? setJoining(n) : void connect(n))}>
            <Signal n={n.signal} />
            <span className="stack grow"><span className="t">{n.ssid}</span><span className="s">{n.active ? "Connected" : n.saved ? "Saved" : n.security || "Open network"}</span></span>
            <span className="v">{n.active && <Check size={16} color="var(--blue)" />}{n.security && <Lock size={13} />}{n.active && <button type="button" className="btn sm ghost" onClick={(e) => { e.stopPropagation(); void api.post("/api/wifi/disconnect").then(reload); }}>Disconnect</button>}{!n.active && n.saved && <button type="button" className="btn sm ghost" onClick={(e) => { e.stopPropagation(); void api.post("/api/wifi/forget", { ssid: n.ssid }).then(reload); }}>Forget</button>}</span>
          </button>
        ))}
        {nets && nets.length === 0 && <div className="list-row dim">No networks found</div>}
      </div>
      </>}
      {joining && (
        <Sheet title={`Join “${joining.ssid}”`} icon={<Wifi size={18} />} onClose={() => setJoining(null)} size="narrow" footer={<><button type="button" className="btn ghost" onClick={() => setJoining(null)}>Cancel</button><button type="button" className="btn primary" disabled={busy || pw.length < 8} onClick={() => void connect(joining, pw)}>{busy ? <span className="spinner" /> : "Join"}</button></>}>
          <div className="field"><label>Password</label><div className="search" style={{ height: 42 }}><Lock size={16} /><input type={show ? "text" : "password"} autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pw.length >= 8 && void connect(joining, pw)} /><button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
        </Sheet>
      )}
    </>
  );
}

function BluetoothPanel({ onJob }: { onJob: (id: string) => void }) {
  const { status } = useStatus();
  const { data, reload, setData } = useApi<BluetoothResult>("/api/bluetooth", ["bluetooth"]);
  const feature: FeatureStatus | undefined = data?.status;
  const devices = data?.devices;
  const [scanning, setScanning] = useState(false);
  const toast = useToast();
  const powered = status?.bluetooth.powered ?? false;
  const scan = () => { setScanning(true); void api.post<BluetoothResult>("/api/bluetooth/scan").then(setData).finally(() => setScanning(false)); };
  const toggle = (d: BluetoothDevice) => void api.post<{ ok: boolean; message: string }>("/api/bluetooth/connect", { mac: d.mac, connect: !d.connected }).then((r) => { toast(r.message, r.ok ? "ok" : "error"); reload(); });
  return (
    <>
      <PanelTitle title="Bluetooth" sub={feature && !feature.available ? "Unavailable on this machine" : powered ? `${status?.bluetooth.connected.length ?? 0} connected` : "Off"} right={feature?.available ? <button type="button" className="btn sm" disabled={!powered || scanning} onClick={scan}>{scanning ? <span className="spinner" /> : <RefreshCw size={13} />} Scan</button> : undefined} />
      {feature && !feature.available && <Unavailable status={feature} onJob={onJob} />}
      {feature?.demo && <div style={{ marginBottom: 12 }}><DemoBadge what="Sample devices, not your machine" /></div>}
      {feature?.available && <>
      <div className="list" style={{ marginBottom: 14 }}>
        <div className="list-row"><span className="ic" style={{ ["--ic" as string]: "#0a84ff" }}><Bluetooth size={18} /></span><span className="t grow">Bluetooth</span><Toggle on={powered} onChange={(v) => void api.post("/api/bluetooth/power", { on: v }).then(reload)} /></div>
      </div>
      <div className="list">
        {(devices ?? []).map((d) => (
          <button key={d.mac} type="button" className="list-row" onClick={() => toggle(d)}>
            <span className="stack grow"><span className="t">{d.name}</span><span className="s">{d.connected ? "Connected" : d.paired ? "Not connected" : "Nearby"}</span></span>
            <span className="v">{d.connected ? <Pill color="green" dot>Connected</Pill> : <span className="btn sm ghost">{d.paired ? "Connect" : "Pair"}</span>}{d.paired && <button type="button" className="btn sm ghost" onClick={(e) => { e.stopPropagation(); void api.post("/api/bluetooth/forget", { mac: d.mac }).then(reload); }}>Forget</button>}</span>
          </button>
        ))}
        {devices && devices.length === 0 && <div className="list-row dim">{powered ? "No devices yet. Press Scan." : "Turn on Bluetooth to see devices."}</div>}
      </div>
      </>}
    </>
  );
}

function SoundPanel({ onJob }: { onJob: (id: string) => void }) {
  const { status } = useStatus();
  const { data, reload } = useApi<AudioResult>("/api/audio/devices", ["audio"]);
  const feature: FeatureStatus | undefined = data?.status;
  const [vol, setVol] = useState<number | null>(null);
  const v = vol ?? status?.audio?.volume ?? 0;
  if (feature && !feature.available) {
    return (
      <>
        <PanelTitle title="Sound" sub="Unavailable on this machine" />
        <Unavailable status={feature} onJob={onJob} />
      </>
    );
  }
  return (
    <>
      <PanelTitle title="Sound" sub={status?.audio?.sink} right={feature?.demo ? <DemoBadge /> : undefined} />
      <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
        <div className="row" style={{ marginBottom: 6 }}><span style={{ fontWeight: 500 }}>Output volume</span><span className="spacer" /><span className="dim">{status?.audio?.muted ? "Muted" : `${v}%`}</span></div>
        <div className="row"><button type="button" className="icon-btn" onClick={() => void api.post("/api/audio/mute", { muted: !status?.audio?.muted })}><Volume2 size={18} /></button><Slider value={v} onChange={setVol} onCommit={(n) => { void api.post("/api/audio/volume", { volume: n }); setVol(null); }} /></div>
      </div>
      <h3 className="dim small" style={{ margin: "14px 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Output</h3>
      <div className="list">{(data?.outputs ?? []).map((d) => <button key={d.id} type="button" className="list-row" onClick={() => void api.post("/api/audio/default", { id: d.id }).then(reload)}><span className="t grow">{d.name}</span>{d.isDefault && <Check size={16} color="var(--blue)" />}</button>)}</div>
      <h3 className="dim small" style={{ margin: "14px 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Input</h3>
      <div className="list">{(data?.inputs ?? []).map((d) => <button key={d.id} type="button" className="list-row" onClick={() => void api.post("/api/audio/default", { id: d.id }).then(reload)}><span className="t grow">{d.name}</span>{d.isDefault && <Check size={16} color="var(--blue)" />}</button>)}</div>
    </>
  );
}

function DisplayPanel({ onJob }: { onJob: (id: string) => void }) {
  const { status } = useStatus();
  const { layout, tv, save } = useLayout();
  const { data: mons } = useApi<MonitorResult>("/api/display/monitors");
  const { data: brightFeature } = useApi<FeatureStatus>("/api/features/brightnessctl");
  const [b, setB] = useState<number | null>(null);
  const [night, setNight] = useState(false);
  const readable = status?.brightness != null;
  const v = b ?? status?.brightness ?? 100;
  return (
    <>
      <PanelTitle title="Display" />
      {readable ? (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
          <div className="row" style={{ marginBottom: 6 }}><span style={{ fontWeight: 500 }}>Brightness</span><span className="spacer" /><span className="dim">{v}%</span></div>
          <div className="row"><Sun size={18} className="dim" /><Slider value={v} min={1} onChange={setB} onCommit={(n) => { void api.post("/api/display/brightness", { brightness: n }); setB(null); }} /></div>
        </div>
      ) : (
        brightFeature && <div style={{ marginBottom: 14 }}><Unavailable status={brightFeature} onJob={onJob} /></div>
      )}
      <div className="list" style={{ marginBottom: 14 }}>
        <div className="list-row"><span className="ic" style={{ ["--ic" as string]: "#ff9f0a" }}><Moon size={18} /></span><span className="stack grow"><span className="t">Night Light</span><span className="s">Warmer colors in the evening</span></span><Toggle on={night} onChange={(on) => { setNight(on); void api.post("/api/display/nightlight", { on }); }} /></div>
        <div className="list-row"><span className="ic" style={{ ["--ic" as string]: "#5e5ce6" }}><Tv size={18} /></span><span className="stack grow"><span className="t">TV mode</span><span className="s">Bigger layout with remote-control navigation{layout?.tv === null ? ` · Auto (${detectTv() ? "on" : "off"})` : ""}</span></span><Toggle on={tv} onChange={(on) => void save({ tv: on })} /></div>
        {layout?.tv !== null && <button type="button" className="list-row" onClick={() => void save({ tv: null })}><span className="ic" style={{ ["--ic" as string]: "#636e7b" }}><RefreshCw size={18} /></span><span className="t grow">Detect TV automatically</span><ChevronRight size={16} className="dim" /></button>}
      </div>
      <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
        <div className="row" style={{ marginBottom: 6 }}><span style={{ fontWeight: 500 }}>Text & tile size</span><span className="spacer" /><span className="dim">{Math.round((layout?.scale ?? 1) * 100)}%</span></div>
        <Slider value={Math.round((layout?.scale ?? 1) * 100)} min={80} max={160} onChange={() => {}} onCommit={(n) => void save({ scale: n / 100 })} />
      </div>
      <h3 className="dim small" style={{ margin: "14px 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Displays {mons?.status.demo && <DemoBadge />}</h3>
      {mons && !mons.status.available ? <Unavailable status={mons.status} onJob={onJob} /> : <div className="list">{(mons?.monitors ?? []).map((m) => <div key={m.name} className="list-row"><span className="stack grow"><span className="t">{m.description}</span><span className="s">{m.width}×{m.height} · {m.refreshRate} Hz · {m.scale}× scale</span></span>{m.focused && <Pill color="blue">Main</Pill>}</div>)}</div>}
    </>
  );
}

function AppearancePanel() {
  const { status } = useStatus();
  const { data: themes, reload } = useApi<{ name: string; active: boolean }[]>("/api/themes", ["theme"]);
  const { data: bgs } = useApi<string[]>("/api/backgrounds", ["theme"]);
  const toast = useToast();
  return (
    <>
      <PanelTitle title="Appearance" sub={status?.theme} right={<button type="button" className="btn sm" onClick={() => void api.post("/api/backgrounds/next").then(() => toast("Background changed"))}><ImageIcon size={13} /> Next background</button>} />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginBottom: 18 }}>
        {(themes ?? []).map((t) => (
          <button key={t.name} type="button" className="card" style={{ padding: 14, textAlign: "left", border: t.active ? "1px solid var(--blue)" : undefined }} onClick={() => void api.post<{ ok: boolean; message: string }>("/api/themes/set", { name: t.name }).then((r) => { toast(r.message, r.ok ? "ok" : "error"); reload(); })}>
            <div style={{ height: 44, borderRadius: 10, marginBottom: 10, background: `linear-gradient(135deg, ${themeSwatch(t.name)[0]}, ${themeSwatch(t.name)[1]})` }} />
            <div className="row"><span style={{ fontWeight: 500 }} className="truncate">{t.name}</span><span className="spacer" />{t.active && <Check size={15} color="var(--blue)" />}</div>
          </button>
        ))}
      </div>
      {bgs && bgs.length > 0 && (
        <>
          <h3 className="dim small" style={{ margin: "14px 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Backgrounds</h3>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {bgs.map((f) => <button key={f} type="button" className="card" style={{ aspectRatio: "16/10", overflow: "hidden", border: status?.background === f ? "1px solid var(--blue)" : undefined }} onClick={() => void api.post("/api/backgrounds/set", { file: f })}><img src={`/api/background?t=${encodeURIComponent(f)}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></button>)}
          </div>
        </>
      )}
    </>
  );
}

function themeSwatch(name: string): [string, string] {
  const n = name.toLowerCase();
  if (n.includes("tokyo")) return ["#1a1b26", "#7aa2f7"];
  if (n.includes("catppuccin")) return ["#1e1e2e", "#cba6f7"];
  if (n.includes("nord")) return ["#2e3440", "#88c0d0"];
  if (n.includes("gruvbox")) return ["#282828", "#d79921"];
  if (n.includes("everforest")) return ["#2d353b", "#a7c080"];
  if (n.includes("rose")) return ["#191724", "#ebbcba"];
  if (n.includes("kanagawa")) return ["#1f1f28", "#7e9cd8"];
  if (n.includes("matte")) return ["#121212", "#8a8a8a"];
  if (n.includes("light") || n.includes("latte")) return ["#eff1f5", "#8839ef"];
  return ["#1c1f27", "#0a84ff"];
}

function NotificationsSettings() {
  const { data, reload } = useApi<Notification[]>("/api/notifications", ["notification", "notifications"]);
  const [silenced, setSilenced] = useState(false);
  return (
    <>
      <PanelTitle title="Notifications" right={<button type="button" className="btn sm" onClick={() => void api.post("/api/notifications/clear").then(reload)}>Clear all</button>} />
      <div className="list" style={{ marginBottom: 14 }}>
        <div className="list-row"><span className="ic" style={{ ["--ic" as string]: "#5e5ce6" }}><Moon size={18} /></span><span className="stack grow"><span className="t">Do Not Disturb</span><span className="s">Silence banners and sounds</span></span><Toggle on={silenced} onChange={setSilenced} /></div>
      </div>
      {(data ?? []).length === 0 ? <Empty icon={<Bell size={26} />} title="No recent notifications" /> : <div className="list">{(data ?? []).map((n) => <div key={n.id} className="list-row"><span className="stack grow"><span className="t">{n.title || n.app}</span><span className="s">{n.body}</span></span><span className="v tiny">{timeAgo(n.at)}</span></div>)}</div>}
    </>
  );
}

function PowerPanel() {
  const { status } = useStatus();
  const { data: profiles, reload } = useApi<{ name: string; active: boolean }[]>("/api/power/profiles");
  const toast = useToast();
  const act = (action: string) => void api.post<{ ok: boolean; message: string }>("/api/power", { action }).then((r) => toast(r.message, r.ok ? "ok" : "error"));
  const bat = status?.battery;
  return (
    <>
      <PanelTitle title="Battery & Power" sub={bat?.present ? `${bat.percent}% · ${bat.charging ? "Charging" : "On battery"}` : "Plugged in"} />
      {bat?.present && <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}><div className="row" style={{ marginBottom: 8 }}><BatteryMedium size={18} /><span style={{ fontWeight: 500 }}>Battery</span><span className="spacer" /><span className="dim">{bat.percent}%</span></div><div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.1)" }}><div style={{ height: "100%", width: `${bat.percent}%`, borderRadius: 4, background: bat.percent <= 15 ? "var(--red)" : "var(--green)" }} /></div></div>}
      <h3 className="dim small" style={{ margin: "14px 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Power mode</h3>
      <div className="list" style={{ marginBottom: 14 }}>
        {(profiles ?? []).map((p) => <button key={p.name} type="button" className="list-row" onClick={() => void api.post("/api/power/profile", { name: p.name }).then(reload)}><span className="ic" style={{ ["--ic" as string]: p.name === "performance" ? "#ff9f0a" : p.name === "power-saver" ? "#30d158" : "#0a84ff" }}><Zap size={18} /></span><span className="t grow">{p.name === "power-saver" ? "Low Power" : p.name[0].toUpperCase() + p.name.slice(1)}</span>{p.active && <Check size={16} color="var(--blue)" />}</button>)}
      </div>
      <div className="list">
        <button type="button" className="list-row" onClick={() => act("lock")}><span className="ic" style={{ ["--ic" as string]: "#636e7b" }}><Lock size={18} /></span><span className="t grow">Lock Screen</span><ChevronRight size={16} className="dim" /></button>
        <button type="button" className="list-row" onClick={() => act("sleep")}><span className="ic" style={{ ["--ic" as string]: "#5e5ce6" }}><Moon size={18} /></span><span className="t grow">Sleep</span><ChevronRight size={16} className="dim" /></button>
        <button type="button" className="list-row" onClick={() => act("restart")}><span className="ic" style={{ ["--ic" as string]: "#ff9f0a" }}><RefreshCw size={18} /></span><span className="t grow">Restart</span><ChevronRight size={16} className="dim" /></button>
        <button type="button" className="list-row" onClick={() => act("shutdown")}><span className="ic" style={{ ["--ic" as string]: "#ff453a" }}><Power size={18} /></span><span className="t grow">Shut Down</span><ChevronRight size={16} className="dim" /></button>
      </div>
    </>
  );
}

function StoragePanel() {
  const { data: disk } = useApi<{ total: number; used: number } | null>("/api/files/disk");
  return (
    <>
      <PanelTitle title="Storage" />
      {disk ? (
        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ marginBottom: 10 }}><HardDrive size={18} /><span style={{ fontWeight: 500 }}>Main disk</span><span className="spacer" /><span className="dim">{bytes(disk.total - disk.used)} free</span></div>
          <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,.1)" }}><div style={{ height: "100%", width: `${Math.min(100, (disk.used / disk.total) * 100)}%`, borderRadius: 5, background: "linear-gradient(90deg, var(--blue), var(--purple))" }} /></div>
          <div className="dim small" style={{ marginTop: 8 }}>{bytes(disk.used)} of {bytes(disk.total)} used</div>
          <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => navigate("files")}>Manage files</button>
        </div>
      ) : <Skeleton h={120} />}
    </>
  );
}

function UpdatesPanel({ onJob }: { onJob: (id: string) => void }) {
  const { data, loading } = useApi<PackageResult>("/api/store/updates", ["job"]);
  const toast = useToast();
  const feature = data?.status;
  const list = data?.packages;
  const sub = !data ? "Checking…" : !feature?.available ? "Cannot check on this machine" : list!.length ? `${list!.length} update${list!.length === 1 ? "" : "s"} available` : "Everything is up to date";
  return (
    <>
      <PanelTitle title="Software Update" sub={sub} right={feature?.available && list && list.length > 0 ? <button type="button" className="btn primary sm" onClick={() => void api.post<Job>("/api/store/update").then((j) => onJob(j.id)).catch((e) => toast(e.message, "error"))}><Download size={13} /> Update all</button> : undefined} />
      {loading && !data && <Skeleton h={160} />}
      {feature && !feature.available && <Unavailable status={feature} onJob={onJob} />}
      {feature?.demo && <div style={{ marginBottom: 12 }}><DemoBadge what="Sample updates, not your machine" /></div>}
      {feature?.available && list && list.length === 0 && <Empty icon={<Shield size={26} />} title="You're up to date" hint="NODE checks for updates automatically." />}
      {feature?.available && list && list.length > 0 && <div className="list">{list.map((p) => <div key={p.name} className="list-row"><span className="stack grow"><span className="t">{p.name}</span><span className="s">{p.version}</span></span></div>)}</div>}
      {feature?.available && <p className="dim small" style={{ marginTop: 12 }}>Updates take a system snapshot first, so you can always go back.</p>}
    </>
  );
}

function AboutPanel() {
  const { status } = useStatus();
  const { data: sys } = useApi<Record<string, string>>("/api/system");
  const rows: [string, string][] = [["Name", status?.user.hostname ?? ""], ["User", status?.user.fullName ?? ""], ["System", sys?.distro ?? ""], ["Kernel", sys?.kernel ?? ""], ["Processor", sys?.cpu ?? ""], ["Memory", sys?.memory ?? ""], ["Architecture", sys?.arch ?? ""], ["Theme", status?.theme ?? ""], ["Uptime", status ? uptime(status.uptimeSeconds) : ""], ["NODE", "0.1.0"]];
  return (
    <>
      <PanelTitle title="About" />
      <div className="card" style={{ padding: 24, textAlign: "center", marginBottom: 14 }}>
        <div className="wordmark" style={{ fontSize: 28, marginBottom: 6 }}>NODE</div>
        <div className="dim">Your AI computer, everywhere.</div>
      </div>
      <div className="list">{rows.map(([k, v]) => <div key={k} className="list-row"><span className="t" style={{ minWidth: 120 }}>{k}</span><span className="v truncate" style={{ color: "var(--text)", marginLeft: 0, flex: 1, justifyContent: "flex-end", textAlign: "right" }}>{v || "—"}</span></div>)}</div>
    </>
  );
}


function LookPicker() {
  const { layout, save } = useLayout();
  const { active } = useWorld();
  const previews: Record<Look, React.ReactNode> = {
    dashboard: <><span className="b" style={{ left: 8, top: 8, width: 60, height: 8, background: "#fff", opacity: 0.9 }} /><span className="b" style={{ left: 8, top: 24, right: 8, height: 14, background: "rgba(255,255,255,.12)" }} /><span className="b" style={{ left: 8, top: 46, width: 46, height: 30, background: "rgba(255,255,255,.12)" }} /><span className="b" style={{ left: 60, top: 46, width: 46, height: 30, background: "rgba(255,255,255,.12)" }} /><span className="b" style={{ left: 112, top: 46, width: 46, height: 30, background: "rgba(255,255,255,.12)" }} /><span className="b" style={{ left: 8, top: 86, right: 8, height: 12, borderRadius: 6, background: "rgba(255,255,255,.2)" }} /></>,
    living: <><span className="b" style={{ left: 10, top: 12, width: 44, height: 22, background: "#0f172a", opacity: 0.85 }} /><span className="b" style={{ left: 70, top: 10, width: 40, height: 30, background: "#fff" }} /><span className="b" style={{ left: 114, top: 10, width: 40, height: 30, background: "#4f8cff" }} /><span className="b" style={{ left: 10, top: 56, width: 22, height: 22, borderRadius: 6, background: "#ff453a" }} /><span className="b" style={{ left: 38, top: 56, width: 22, height: 22, borderRadius: 6, background: "#30d158" }} /><span className="b" style={{ left: 66, top: 56, width: 22, height: 22, borderRadius: 6, background: "#ff2d55" }} /><span className="b" style={{ left: 94, top: 56, width: 22, height: 22, borderRadius: 6, background: "#0a84ff" }} /><span className="b" style={{ left: 10, top: 88, right: 10, height: 12, borderRadius: 6, background: "rgba(15,23,42,.12)" }} /></>,
    cinema: <><span className="b" style={{ left: 8, top: 8, right: 8, height: 44, background: "linear-gradient(135deg,#f0a35a,#3b6fb6)" }} /><span className="b" style={{ left: 8, top: 58, width: 34, height: 18, background: "#5e5ce6" }} /><span className="b" style={{ left: 46, top: 58, width: 34, height: 18, background: "#0a84ff" }} /><span className="b" style={{ left: 84, top: 58, width: 34, height: 18, background: "#ff2d55" }} /><span className="b" style={{ left: 122, top: 58, width: 34, height: 18, background: "#30d158" }} /><span className="b" style={{ left: 8, top: 84, right: 8, height: 14, background: "rgba(255,255,255,.12)" }} /></>,
  };
  return (
    <>
      <h3 className="dim small" style={{ margin: "0 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Look for {active?.name ?? "this world"}</h3>
      <div className="looks">
        {(Object.keys(LOOKS) as Look[]).map((k) => (
          <button key={k} type="button" className={`card look-card${layout?.look === k ? " active" : ""}`} onClick={() => void save({ look: k })}>
            <div className={`prev ${k}`}>{previews[k]}</div>
            <div className="row"><span className="t">{LOOKS[k].title}</span><span className="spacer" />{layout?.look === k && <Check size={15} color="var(--blue)" />}</div>
            <div className="s">{LOOKS[k].description}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function ShortcutsEditor() {
  const { active, reload } = useWorld();
  const { data: apps } = useApi<AppEntry[]>("/api/apps");
  const { data: agents } = useApi<AgentsInfo>("/api/agents", ["world"]);
  const [editing, setEditing] = useState<Shortcut | null>(null);
  const toast = useToast();
  if (!active) return null;
  const list = active.shortcuts;
  const save = (shortcuts: Shortcut[]) => api.post("/api/worlds", { id: active.id, shortcuts }).then(() => reload()).then(() => toast("Saved"));
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void save(next);
  };
  const targetLabel = (s: Shortcut) => (s.action.type === "app" ? apps?.find((a) => a.id === s.action.target)?.name ?? s.action.target : s.action.type === "agent" ? `${agents?.personas.find((p) => p.id === s.action.target)?.name ?? s.action.target} agent` : s.action.type === "world" ? `Switch to ${s.action.target}` : s.action.target);
  return (
    <>
      <div className="row" style={{ margin: "18px 0 8px" }}><h3 className="dim small" style={{ margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Shortcuts (big icons & tiles)</h3><span className="spacer" /><button type="button" className="btn sm" onClick={() => setEditing({ id: `s${Date.now().toString(36)}`, label: "", icon: "star", color: "#0a84ff", action: { type: "screen", target: "apps" } })}><Plus size={13} /> Add</button></div>
      <div className="list">
        {list.map((s, i) => {
          const Icon = iconFor(s.icon);
          return (
            <div key={s.id} className="list-row">
              <span className="ic" style={{ ["--ic" as string]: s.color }}><Icon size={17} /></span>
              <span className="stack grow"><span className="t">{s.label}</span><span className="s">{s.action.type} · {targetLabel(s)}</span></span>
              <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
              <button type="button" className="icon-btn" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
              <button type="button" className="icon-btn" aria-label="Edit" onClick={() => setEditing(s)}><Pencil size={15} /></button>
              <button type="button" className="icon-btn" aria-label="Remove" onClick={() => void save(list.filter((x) => x.id !== s.id))}><Trash2 size={15} /></button>
            </div>
          );
        })}
      </div>
      {editing && <ShortcutSheet initial={editing} apps={apps ?? []} agents={agents?.personas ?? []} onClose={() => setEditing(null)} onSave={(sc) => { void save(list.some((x) => x.id === sc.id) ? list.map((x) => (x.id === sc.id ? sc : x)) : [...list, sc]); setEditing(null); }} />}
    </>
  );
}

function ShortcutSheet({ initial, apps, agents, onClose, onSave }: { initial: Shortcut; apps: AppEntry[]; agents: AgentsInfo["personas"]; onClose: () => void; onSave: (s: Shortcut) => void }) {
  const [s, setS] = useState(initial);
  const { worlds } = useWorld();
  const set = (p: Partial<Shortcut>) => setS((x) => ({ ...x, ...p }));
  const setA = (p: Partial<Shortcut["action"]>) => set({ action: { ...s.action, ...p } });
  const screens = ["home", "apps", "agents", "automations", "files", "calendar", "settings", "settings/worlds", "settings/wifi"];
  const Icon = iconFor(s.icon);
  return (
    <Sheet title={initial.label ? "Edit shortcut" : "New shortcut"} icon={<Icon size={18} />} onClose={onClose} footer={<><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={!s.label.trim() || !s.action.target} onClick={() => onSave(s)}>Save</button></>}>
      <div className="form-row">
        <div className="field"><label>Label</label><input className="input" autoFocus value={s.label} onChange={(e) => set({ label: e.target.value })} placeholder="Music" /></div>
        <div className="field"><label>Colour</label><div className="row" style={{ flexWrap: "wrap" }}>{["#ff453a", "#ff9f0a", "#ffd60a", "#30d158", "#0a84ff", "#5e5ce6", "#bf5af2", "#ff2d55", "#636e7b", "#3ddc84"].map((c) => <button key={c} type="button" aria-label={c} onClick={() => set({ color: c })} style={{ width: 26, height: 26, borderRadius: 13, background: c, boxShadow: s.color === c ? "0 0 0 2px var(--bg), 0 0 0 4px var(--text)" : undefined }} />)}</div></div>
      </div>
      <div className="field"><label>Icon</label><div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{ICON_NAMES.map((n) => { const I = iconFor(n); return <button key={n} type="button" aria-label={n} className="icon-btn" style={{ width: 34, height: 34, background: s.icon === n ? "var(--blue)" : "var(--glass)", color: s.icon === n ? "#fff" : undefined }} onClick={() => set({ icon: n })}><I size={16} /></button>; })}</div></div>
      <div className="field"><label>Opens</label><div className="segment" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>{(["screen", "app", "agent", "world", "url"] as const).map((t) => <button key={t} type="button" className={s.action.type === t ? "active" : ""} onClick={() => setA({ type: t, target: "" })}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div></div>
      <div className="field">
        <label>Target</label>
        {s.action.type === "screen" && <select className="input" value={s.action.target} onChange={(e) => setA({ target: e.target.value })}><option value="">Choose…</option>{screens.map((x) => <option key={x} value={x}>{x}</option>)}</select>}
        {s.action.type === "app" && <select className="input" value={s.action.target} onChange={(e) => setA({ target: e.target.value })}><option value="">Choose…</option>{apps.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.provider})</option>)}</select>}
        {s.action.type === "agent" && <select className="input" value={s.action.target} onChange={(e) => setA({ target: e.target.value })}><option value="">Choose…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
        {s.action.type === "world" && <select className="input" value={s.action.target} onChange={(e) => setA({ target: e.target.value })}><option value="">Choose…</option>{worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
        {s.action.type === "url" && <input className="input" value={s.action.target} onChange={(e) => setA({ target: e.target.value })} placeholder="https://…" />}
      </div>
    </Sheet>
  );
}

function HomePanel() {
  const { layout, save } = useLayout();
  const [loc, setLoc] = useState<string | null>(null);
  const rows = layout?.rows ?? [];
  const move = (i: number, d: -1 | 1) => {
    const next = [...rows];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void save({ rows: next });
  };
  return (
    <>
      <PanelTitle title="Home Screen" sub="Pick a look, arrange shortcuts and rows. Each world remembers its own." />
      <LookPicker />
      <ShortcutsEditor />
      <div className="row" style={{ margin: "18px 0 8px" }}><h3 className="dim small" style={{ margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Rows</h3></div>
      <div className="list">
        {rows.map((r, i) => {
          const mod = HOME_ROWS.find((m) => m.id === r.id);
          if (!mod) return null;
          return (
            <div key={r.id} className="list-row">
              <span className="stack grow"><span className="t">{mod.title}</span><span className="s">{mod.description}</span></span>
              <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
              <button type="button" className="icon-btn" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
              <Toggle on={r.enabled} onChange={(v) => void save({ rows: rows.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)) })} />
            </div>
          );
        })}
      </div>
      <p className="dim small" style={{ marginTop: 12 }}>Rows are modules. Developers add new ones in <code>shell/src/modules/homeRows.tsx</code>.</p>
      <h3 className="dim small" style={{ margin: "18px 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Weather</h3>
      <div className="list"><div className="list-row"><span className="ic" style={{ ["--ic" as string]: "#4f8cff" }}><MapPin size={17} /></span><span className="stack grow"><span className="t">Location</span><span className="s">Leave empty to detect automatically</span></span><input className="input" style={{ width: 220 }} value={loc ?? layout?.weatherLocation ?? ""} onChange={(e) => setLoc(e.target.value)} onBlur={() => loc !== null && void save({ weatherLocation: loc })} onKeyDown={(e) => e.key === "Enter" && loc !== null && void save({ weatherLocation: loc })} placeholder="San Francisco" /></div></div>
    </>
  );
}

function WorldsPanel() {
  const { worlds, active, switchTo, reload } = useWorld();
  const [editing, setEditing] = useState<Partial<World> | null>(null);
  const toast = useToast();
  const KIND: Record<string, string> = { personal: "Personal", family: "Family", business: "Business", work: "Employee / Operator", public: "Customer / Public", person: "Person" };
  return (
    <>
      <PanelTitle title="People & Worlds" sub="One identity, many fully separated environments. Each has its own look, apps, agents and data." right={<button type="button" className="btn primary sm" onClick={() => setEditing({ kind: "person", color: "#0a84ff", look: "cinema", apps: null, agents: null })}><Plus size={13} /> New</button>} />
      <div className="list" style={{ marginBottom: 14 }}>
        {worlds.map((w) => (
          <div key={w.id} className="list-row">
            <span className="avatar world" style={{ ["--ic" as string]: w.color, width: 36, height: 36 }}>{w.locked ? <Lock size={15} /> : w.name.charAt(0)}</span>
            <span className="stack grow"><span className="t">{w.name} {active?.id === w.id && <Pill color="blue">Current</Pill>}</span><span className="s">{KIND[w.kind]} · {LOOKS[w.look]?.title} look · {w.apps ? `${w.apps.length} apps` : "all apps"} · {w.agents ? `${w.agents.length} agents` : "all agents"}</span></span>
            {active?.id !== w.id && <button type="button" className="btn sm" onClick={() => void switchTo(w.id).then((r) => (r === "pin" ? toast("This world has a PIN: switch from the Home profiles row", "info") : r === "ok" ? toast(`Switched to ${w.name}`) : toast("Locked", "error")))}>Switch</button>}
            <button type="button" className="icon-btn" aria-label="Edit" onClick={() => setEditing(w)}><Pencil size={15} /></button>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ marginBottom: 6 }}><Shield size={16} className="dim" /><span style={{ fontWeight: 600 }}>Separate by design</span></div>
        <p className="dim small">Calendar, automations, web apps, home layout and the agents allowed are stored per world under <code>~/.local/share/nodeos</code>. Linux apps are shared by the machine, but each world chooses which ones it shows. A PIN is a convenience lock for family screens, not account security.</p>
      </div>
      {editing && <WorldSheet initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); toast("Saved"); }} />}
    </>
  );
}

function WorldSheet({ initial, onClose, onSaved }: { initial: Partial<World>; onClose: () => void; onSaved: () => void }) {
  const [w, setW] = useState<Partial<World>>(initial);
  const [tab, setTab] = useState<"basics" | "apps" | "agents">("basics");
  const { data: apps } = useApi<AppEntry[]>("/api/apps?all");
  const { data: agentsAll } = useApi<AgentsInfo>("/api/agents");
  const { worlds } = useWorld();
  const toast = useToast();
  const set = (p: Partial<World>) => setW((x) => ({ ...x, ...p }));
  const personas = (agentsAll?.personas ?? []).filter((p) => p.id !== "auto");
  const toggleIn = (key: "apps" | "agents", id: string) => {
    const cur = w[key] ?? null;
    if (cur === null) return;
    set({ [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } as Partial<World>);
  };
  const save = () => void api.post("/api/worlds", w).then(onSaved).catch((e) => toast(e.message, "error"));
  const del = () => void api.del(`/api/worlds/${w.id}`).then(onSaved).catch((e) => toast(e.message, "error"));
  return (
    <Sheet title={w.id ? `Edit ${w.name}` : "New world"} icon={<Users size={18} />} onClose={onClose} size="wide" footer={<>{w.id && worlds.length > 1 && <button type="button" className="btn danger" style={{ marginRight: "auto" }} onClick={del}><Trash2 size={15} /> Delete</button>}<button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={!w.name?.trim()} onClick={save}>Save</button></>}>
      <div className="segment" style={{ marginBottom: 16 }}>{(["basics", "apps", "agents"] as const).map((t) => <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
      {tab === "basics" && (
        <>
          <div className="form-row">
            <div className="field"><label>Name</label><input className="input" autoFocus value={w.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="Emma" /></div>
            <div className="field"><label>Kind</label><select className="input" value={w.kind ?? "person"} onChange={(e) => set({ kind: e.target.value as World["kind"] })}><option value="person">Person</option><option value="personal">Personal</option><option value="family">Family</option><option value="business">Business</option><option value="work">Employee / Operator</option><option value="public">Customer / Public</option></select></div>
          </div>
          <div className="field"><label>Tagline</label><input className="input" value={w.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} placeholder="Your life, your rules." /></div>
          <div className="form-row">
            <div className="field"><label>Colour</label><div className="row" style={{ flexWrap: "wrap" }}>{["#0a84ff", "#30d158", "#ff9f0a", "#bf5af2", "#ff453a", "#ff2d55", "#5e5ce6", "#64d2ff", "#ffd60a", "#636e7b"].map((c) => <button key={c} type="button" aria-label={c} onClick={() => set({ color: c })} style={{ width: 26, height: 26, borderRadius: 13, background: c, boxShadow: w.color === c ? "0 0 0 2px var(--bg), 0 0 0 4px var(--text)" : undefined }} />)}</div></div>
            <div className="field"><label>Look</label><select className="input" value={w.look ?? "dashboard"} onChange={(e) => set({ look: e.target.value as Look })}>{(Object.keys(LOOKS) as Look[]).map((k) => <option key={k} value={k}>{LOOKS[k].title}</option>)}</select></div>
          </div>
          <div className="field"><label>PIN (optional, 4–8 digits)</label><input className="input" inputMode="numeric" value={w.pin ?? ""} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder={initial.locked ? "•••• (set)" : "Leave empty for none"} /></div>
        </>
      )}
      {tab === "apps" && (
        <>
          <div className="row" style={{ marginBottom: 12 }}><span className="dim">Which apps this world can see</span><span className="spacer" /><span className="segment"><button type="button" className={w.apps === null ? "active" : ""} onClick={() => set({ apps: null })}>All apps</button><button type="button" className={w.apps !== null ? "active" : ""} onClick={() => set({ apps: w.apps ?? [] })}>Only these</button></span></div>
          {w.apps !== null && <div className="list" style={{ maxHeight: "40vh", overflowY: "auto" }}>{(apps ?? []).map((a) => <button key={a.id} type="button" className="list-row" onClick={() => toggleIn("apps", a.id)}><span className="stack grow"><span className="t">{a.name}</span><span className="s">{a.provider} · {a.comment}</span></span>{w.apps?.includes(a.id) ? <Check size={16} color="var(--blue)" /> : <span className="status-dot" />}</button>)}</div>}
        </>
      )}
      {tab === "agents" && (
        <>
          <div className="row" style={{ marginBottom: 12 }}><span className="dim">Which agents may work here</span><span className="spacer" /><span className="segment"><button type="button" className={w.agents === null ? "active" : ""} onClick={() => set({ agents: null })}>All agents</button><button type="button" className={w.agents !== null ? "active" : ""} onClick={() => set({ agents: w.agents ?? [] })}>Only these</button></span></div>
          {w.agents !== null && <div className="list" style={{ maxHeight: "40vh", overflowY: "auto" }}>{personas.map((p) => { const I = iconFor(p.icon); return <button key={p.id} type="button" className="list-row" onClick={() => toggleIn("agents", p.id)}><span className="ic" style={{ ["--ic" as string]: p.color }}><I size={16} /></span><span className="stack grow"><span className="t">{p.name}</span><span className="s">{p.tagline}</span></span>{w.agents?.includes(p.id) ? <Check size={16} color="var(--blue)" /> : <span className="status-dot" />}</button>; })}</div>}
        </>
      )}
    </Sheet>
  );
}

function DevicesPanel({ onJob }: { onJob: (id: string) => void }) {
  const { data: a, reload } = useApi<AndroidStatus>("/api/android", ["android"]);
  const toast = useToast();
  const install = (name: string) => void api.post<Job>("/api/store/install", { name }).then((j) => onJob(j.id)).catch((e) => toast(e.message, "error"));
  const mirror = () => void api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id: "android:__screen" }).then((r) => toast(r.message, r.ok ? "ok" : "error"));
  return (
    <>
      <PanelTitle title="Phone & Devices" sub="Plug in an Android phone over USB and its apps join NODE" right={<button type="button" className="btn sm" onClick={reload}><RefreshCw size={13} /> Refresh</button>} />
      {a && !a.available && (
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="row" style={{ marginBottom: 10 }}><Usb size={18} /><span style={{ fontWeight: 600 }}>Phone support is not installed yet</span></div>
          <p className="dim small" style={{ marginBottom: 12 }}>NODE uses two open-source tools: <b>android-tools</b> (adb) to talk to the phone and <b>scrcpy</b> to show its screen. Both come from the App Store.</p>
          <div className="row"><button type="button" className="btn primary sm" onClick={() => install("android-tools")}><Download size={13} /> Install android-tools</button><button type="button" className="btn primary sm" onClick={() => install("scrcpy")}><Download size={13} /> Install scrcpy</button></div>
        </div>
      )}
      {a?.available && !a.scrcpy && (
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="row"><span className="stack grow"><span style={{ fontWeight: 600 }}>Screen mirroring is off</span><span className="dim small">Apps can be started on the phone, but to see them here install scrcpy.</span></span><button type="button" className="btn primary sm" onClick={() => install("scrcpy")}><Download size={13} /> Install scrcpy</button></div>
        </div>
      )}
      <div className="list" style={{ marginBottom: 14 }}>
        {(a?.devices ?? []).map((d) => (
          <div key={d.serial} className="list-row">
            <span className="ic" style={{ ["--ic" as string]: d.state === "device" ? "#3ddc84" : "#ff9f0a" }}><Smartphone size={18} /></span>
            <span className="stack grow"><span className="t">{d.model}</span><span className="s">{d.state === "device" ? `Connected · Android ${d.androidVersion ?? ""}` : d.state === "unauthorized" ? "Waiting for you to tap Allow on the phone" : `Phone is ${d.state}`}</span></span>
            {d.state === "device" ? <button type="button" className="btn sm" onClick={mirror}><Tv size={13} /> Show screen</button> : <Pill color="orange" dot>{d.state}</Pill>}
          </div>
        ))}
        {a && a.devices.length === 0 && <div className="list-row dim">No phone detected.</div>}
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>How to connect a phone</div>
        <ol className="dim small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>On the phone: Settings → About → tap “Build number” seven times to unlock Developer options.</li>
          <li>Developer options → turn on <b>USB debugging</b>.</li>
          <li>Plug the phone into this computer and tap <b>Allow</b> when it asks.</li>
          <li>Its apps appear on Home and in Apps → Phone. Each opens full screen here.</li>
        </ol>
        {a?.scrcpyVersion && <p className="dim tiny" style={{ marginTop: 10 }}>scrcpy {a.scrcpyVersion}{Number(a.scrcpyVersion.split(".")[0]) >= 3 ? " · apps run in their own virtual display, the phone stays usable" : " · upgrade to scrcpy 3 to run apps without taking over the phone screen"}</p>}
      </div>
    </>
  );
}
