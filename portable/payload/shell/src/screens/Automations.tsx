import { useState } from "react";
import { Zap, Newspaper, Star, Package, BarChart3, Megaphone, Plane, FileText, Music, Play, Trash2, Plus, Clock, Bot, Terminal, AppWindow } from "lucide-react";
import { api, useApi } from "../api/client";
import type { Automation } from "../api/types";
import { Hero } from "../components/Hero";
import { Section } from "../components/Section";
import { ItemCard } from "../components/ItemCard";
import { Sheet } from "../components/Sheet";
import { Pill, Toggle, Empty } from "../components/ui";
import { useMenu } from "../components/Menu";
import { useToast } from "../state/toast";
import { timeAgo } from "../lib/format";

export const AUTOMATION_ICONS: Record<string, typeof Zap> = { newspaper: Newspaper, star: Star, package: Package, "bar-chart": BarChart3, megaphone: Megaphone, plane: Plane, "file-text": FileText, music: Music, zap: Zap };

type Template = Omit<Automation, "id" | "enabled" | "lastRun" | "lastStatus" | "nextRun">;

function describeSchedule(s: Automation["schedule"]): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const t = (time?: string) => (time ? new Date(`2000-01-01T${time}:00`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "");
  switch (s.type) {
    case "daily":
      return `Runs daily · ${t(s.time)}`;
    case "weekly":
      return `Runs weekly · ${days[s.weekday ?? 1].slice(0, 3)} ${t(s.time)}`;
    case "interval":
      return `Every ${s.minutes && s.minutes >= 60 ? `${Math.round(s.minutes / 60)} h` : `${s.minutes} min`}`;
    default:
      return "Runs when you ask";
  }
}

export function Automations({ onJob }: { onJob: (id: string) => void }) {
  const { data, reload } = useApi<{ items: Automation[]; templates: Template[] }>("/api/automations", ["automations"]);
  const [editing, setEditing] = useState<Partial<Automation> | null>(null);
  const toast = useToast();
  const menu = useMenu();
  const items = data?.items ?? [];
  const save = (a: Partial<Automation>) => api.post<Automation>("/api/automations", a).then(() => reload());
  const run = (a: Automation) => void api.post<{ jobId?: string }>(`/api/automations/${a.id}/run`).then((r) => (r.jobId ? onJob(r.jobId) : toast(`Ran ${a.name}`)));

  return (
    <>
      <Hero title="Automations" subtitle="Little helpers that run on a schedule, so you don't have to." right={<button type="button" className="btn primary" onClick={() => setEditing({ kind: "agent", schedule: { type: "daily", time: "09:00" }, icon: "zap" })}><Plus size={16} /> New automation</button>} />

      <Section title="Running" grid>
        {data && items.length === 0 && <Empty icon={<Zap size={28} />} title="No automations yet" hint="Pick a template below or create your own." />}
        {items.map((a) => {
          const Icon = AUTOMATION_ICONS[a.icon] ?? Zap;
          return (
            <ItemCard key={a.id} icon={<span className="app-icon" style={{ ["--ic" as string]: a.enabled ? "#2b2f3a" : "#1c1f27" }}><Icon size={26} /></span>} title={a.name} subtitle={a.description || describeSchedule(a.schedule)} meta={<>{a.enabled ? <Pill color="green" dot>Active</Pill> : <Pill color="orange" dot>Paused</Pill>} <span className="tiny">{describeSchedule(a.schedule)}{a.lastRun ? ` · Last ${timeAgo(a.lastRun)}${a.lastStatus === "failed" ? " (failed)" : ""}` : ""}</span></>} onClick={() => setEditing(a)} onMore={(e) => menu.open(e, [{ label: "Run now", icon: <Play size={14} />, onClick: () => run(a) }, { label: "Edit", icon: <Clock size={14} />, onClick: () => setEditing(a) }, { label: "", divider: true }, { label: "Delete", icon: <Trash2 size={14} />, danger: true, onClick: () => void api.del(`/api/automations/${a.id}`).then(reload) }])} action={<Toggle on={a.enabled} onChange={(v) => void save({ ...a, enabled: v })} />} />
          );
        })}
      </Section>

      <Section title="Suggested" grid>
        {(data?.templates ?? []).map((t) => {
          const Icon = AUTOMATION_ICONS[t.icon] ?? Zap;
          const added = items.some((i) => i.name === t.name);
          return <ItemCard key={t.name} icon={<span className="app-icon" style={{ ["--ic" as string]: "#2b2f3a" }}><Icon size={26} /></span>} title={t.name} subtitle={t.description} meta={added ? <Pill color="green">Added</Pill> : <button type="button" className="btn sm" onClick={() => void save(t).then(() => toast(`Added ${t.name}`))}>Add +</button>} onClick={() => setEditing({ ...t })} />;
        })}
      </Section>

      {editing && <Editor initial={editing} onClose={() => setEditing(null)} onSave={(a) => void save(a).then(() => { setEditing(null); toast("Saved"); })} />}
      {menu.element}
    </>
  );
}

function Editor({ initial, onClose, onSave }: { initial: Partial<Automation>; onClose: () => void; onSave: (a: Partial<Automation>) => void }) {
  const [a, setA] = useState<Partial<Automation>>({ enabled: true, ...initial, schedule: initial.schedule ?? { type: "daily", time: "09:00" } });
  const s = a.schedule!;
  const set = (patch: Partial<Automation>) => setA((x) => ({ ...x, ...patch }));
  const setS = (patch: Partial<Automation["schedule"]>) => set({ schedule: { ...s, ...patch } });
  const kinds: { id: Automation["kind"]; label: string; Icon: typeof Bot; hint: string }[] = [
    { id: "agent", label: "Ask an agent", Icon: Bot, hint: "What should the agent do?" },
    { id: "open", label: "Open an app", Icon: AppWindow, hint: "App id, e.g. linux:spotify, web:toast or android:com.whatsapp" },
    { id: "command", label: "Run a task", Icon: Terminal, hint: "A shell command to run quietly" },
  ];
  return (
    <Sheet title={a.id ? "Edit automation" : "New automation"} icon={<Zap size={18} />} onClose={onClose} footer={<><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={!a.name?.trim() || !a.payload?.trim()} onClick={() => onSave(a)}>Save</button></>}>
      <div className="field"><label>Name</label><input className="input" value={a.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="Morning Brief" autoFocus /></div>
      <div className="field"><label>Description</label><input className="input" value={a.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="What it does, in a few words" /></div>
      <div className="field">
        <label>What happens</label>
        <div className="segment" style={{ alignSelf: "flex-start" }}>
          {kinds.map((k) => <button key={k.id} type="button" className={a.kind === k.id ? "active" : ""} onClick={() => set({ kind: k.id })}><k.Icon size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{k.label}</button>)}
        </div>
      </div>
      <div className="field"><label>{kinds.find((k) => k.id === a.kind)?.hint ?? "Details"}</label><textarea className="input" value={a.payload ?? ""} onChange={(e) => set({ payload: e.target.value })} /></div>
      <div className="field">
        <label>When</label>
        <div className="segment" style={{ alignSelf: "flex-start" }}>
          {(["daily", "weekly", "interval", "manual"] as const).map((t) => <button key={t} type="button" className={s.type === t ? "active" : ""} onClick={() => setS({ type: t })}>{t[0].toUpperCase() + t.slice(1)}</button>)}
        </div>
      </div>
      {(s.type === "daily" || s.type === "weekly") && (
        <div className="form-row">
          {s.type === "weekly" && <div className="field"><label>Day</label><select className="input" value={s.weekday ?? 1} onChange={(e) => setS({ weekday: Number(e.target.value) })}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>}
          <div className="field"><label>Time</label><input type="time" className="input" value={s.time ?? "09:00"} onChange={(e) => setS({ time: e.target.value })} /></div>
        </div>
      )}
      {s.type === "interval" && <div className="field"><label>Every (minutes)</label><input type="number" min={5} className="input" value={s.minutes ?? 60} onChange={(e) => setS({ minutes: Math.max(5, Number(e.target.value)) })} /></div>}
      <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
        <span className="dim">Enabled</span>
        <Toggle on={a.enabled !== false} onChange={(v) => set({ enabled: v })} />
      </div>
    </Sheet>
  );
}
