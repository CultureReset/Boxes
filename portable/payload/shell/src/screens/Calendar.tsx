import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, MapPin, Trash2, Clock } from "lucide-react";
import { api, useApi } from "../api/client";
import type { CalendarEvent } from "../api/types";
import { Hero } from "../components/Hero";
import { Sheet } from "../components/Sheet";
import { Toggle, Empty } from "../components/ui";
import { useToast } from "../state/toast";
import { sameDay, timeRange, longDate } from "../lib/format";

const COLORS = ["#0a84ff", "#30d158", "#ff9f0a", "#ff453a", "#bf5af2", "#64d2ff", "#ff375f"];

export function Calendar() {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);
  const toast = useToast();
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42);
  const { data: events, reload } = useApi<CalendarEvent[]>(`/api/calendar?from=${gridStart.toISOString()}&to=${gridEnd.toISOString()}`, ["calendar"], [cursor.getMonth(), cursor.getFullYear()]);

  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; }), [gridStart.getTime()]);
  const eventsOn = (d: Date) => (events ?? []).filter((e) => { const s = new Date(e.start); const en = new Date(e.end); return sameDay(s, d) || (s < d && en > d); });
  const dayEvents = eventsOn(selected);
  const today = new Date();

  const newEvent = (d: Date) => {
    const s = new Date(d); s.setHours(today.getHours() + 1, 0, 0, 0);
    const e = new Date(s); e.setHours(s.getHours() + 1);
    setEditing({ start: s.toISOString(), end: e.toISOString(), allDay: false, color: COLORS[0] });
  };

  return (
    <>
      <Hero title="Calendar" subtitle={longDate(today)} right={<button type="button" className="btn primary" onClick={() => newEvent(selected)}><Plus size={16} /> New event</button>} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 1fr)", gap: 20, alignItems: "start" }} className="cal-layout">
        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            <span className="spacer" />
            <button type="button" className="btn ghost sm" onClick={() => { setCursor(new Date()); setSelected(new Date()); }}>Today</button>
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="tiny muted" style={{ textAlign: "center", padding: "4px 0 8px", fontWeight: 600 }}>{d}</div>)}
            {days.map((d) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const evs = eventsOn(d);
              const isSel = sameDay(d, selected);
              const isToday = sameDay(d, today);
              return (
                <button key={d.toISOString()} type="button" onClick={() => setSelected(d)} onDoubleClick={() => newEvent(d)} style={{ minHeight: 64, borderRadius: 12, padding: 6, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, background: isSel ? "var(--glass-strong)" : "transparent", border: `1px solid ${isSel ? "var(--line-strong)" : "transparent"}`, opacity: inMonth ? 1 : 0.35, minWidth: 0 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 13, display: "grid", placeItems: "center", fontWeight: 600, fontSize: 13, background: isToday ? "var(--red)" : "transparent", color: isToday ? "#fff" : undefined }}>{d.getDate()}</span>
                  <span style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{evs.slice(0, 4).map((e) => <span key={e.id} style={{ width: 6, height: 6, borderRadius: 3, background: e.color ?? "var(--blue)" }} />)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>{sameDay(selected, today) ? "Today" : selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
          {dayEvents.length === 0 && <Empty icon={<CalIcon size={26} />} title="Nothing scheduled" hint="Double-click a day or press New event." />}
          <div className="list" style={{ display: dayEvents.length ? undefined : "none" }}>
            {dayEvents.map((e) => (
              <button key={e.id} type="button" className="list-row" onClick={() => setEditing(e)}>
                <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: e.color ?? "var(--blue)" }} />
                <span className="stack grow">
                  <span className="t">{e.title}</span>
                  <span className="s"><Clock size={11} style={{ verticalAlign: -1 }} /> {timeRange(e.start, e.end, e.allDay)}{e.location ? ` · ${e.location}` : ""}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 840px) { .cal-layout { grid-template-columns: 1fr !important; } }`}</style>
      {editing && <EventEditor initial={editing} onClose={() => setEditing(null)} onSave={(ev) => void api.post("/api/calendar", ev).then(() => { setEditing(null); reload(); toast("Saved"); }).catch((e) => toast(e.message, "error"))} onDelete={editing.id ? () => void api.del(`/api/calendar/${editing.id}`).then(() => { setEditing(null); reload(); toast("Deleted"); }) : undefined} />}
    </>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventEditor({ initial, onClose, onSave, onDelete }: { initial: Partial<CalendarEvent>; onClose: () => void; onSave: (e: Partial<CalendarEvent>) => void; onDelete?: () => void }) {
  const [e, setE] = useState<Partial<CalendarEvent>>(initial);
  const set = (p: Partial<CalendarEvent>) => setE((x) => ({ ...x, ...p }));
  return (
    <Sheet title={e.id ? "Edit event" : "New event"} icon={<CalIcon size={18} />} onClose={onClose} footer={<>{onDelete && <button type="button" className="btn danger" style={{ marginRight: "auto" }} onClick={onDelete}><Trash2 size={15} /> Delete</button>}<button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={!e.title?.trim()} onClick={() => onSave(e)}>Save</button></>}>
      <div className="field"><label>Title</label><input className="input" autoFocus value={e.title ?? ""} onChange={(ev) => set({ title: ev.target.value })} placeholder="Lunch with Sam" /></div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}><span className="dim">All day</span><Toggle on={Boolean(e.allDay)} onChange={(v) => set({ allDay: v })} /></div>
      <div className="form-row">
        <div className="field"><label>Starts</label><input type={e.allDay ? "date" : "datetime-local"} className="input" value={e.allDay ? toLocalInput(e.start!).slice(0, 10) : toLocalInput(e.start!)} onChange={(ev) => set({ start: new Date(ev.target.value).toISOString() })} /></div>
        <div className="field"><label>Ends</label><input type={e.allDay ? "date" : "datetime-local"} className="input" value={e.allDay ? toLocalInput(e.end!).slice(0, 10) : toLocalInput(e.end!)} onChange={(ev) => set({ end: new Date(ev.target.value).toISOString() })} /></div>
      </div>
      <div className="field"><label>Location</label><div className="search" style={{ height: 42 }}><MapPin size={16} /><input value={e.location ?? ""} onChange={(ev) => set({ location: ev.target.value })} placeholder="Optional" /></div></div>
      <div className="field"><label>Notes</label><textarea className="input" value={e.notes ?? ""} onChange={(ev) => set({ notes: ev.target.value })} /></div>
      <div className="field"><label>Color</label><div className="row">{COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => set({ color: c })} style={{ width: 26, height: 26, borderRadius: 13, background: c, boxShadow: e.color === c ? "0 0 0 2px var(--bg), 0 0 0 4px #fff" : undefined }} />)}</div></div>
    </Sheet>
  );
}
