import path from "node:path";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { DATA_DIR } from "../paths.js";
import { listEvents } from "../modules/calendar.js";
import { env } from "./env.js";
import { companyId, gcr, list, paperclip, settle, type Settled, type SourceState } from "./cloud.js";
import { readCreds, paired, accountLinked } from "./creds.js";

/**
 * One calendar (plan §10, "The calendar's source"): bookings, events and
 * availability from gcr-api-clean; agents' scheduled and current work and the
 * approvals waiting for the owner from Paperclip; plus this computer's own
 * entries. The same sources and shapes Play-user's Calendar reads.
 *
 * Today's combined calendar is kept on disk every time it loads, so the TV
 * still shows the day when the internet is down — and says that it is a copy.
 */

export type Kind = "booking" | "event" | "availability" | "task" | "approval" | "local";

export interface CalItem {
  id: string;
  kind: Kind;
  /** Local wall-clock time, "YYYY-MM-DDTHH:MM" (no zone: this computer's day). */
  start: string;
  end?: string | null;
  allDay: boolean;
  title: string;
  meta?: string;
  status?: string | null;
  /** What a screen can act on: an approval id, a task id. */
  ref?: string;
  details?: Record<string, string>;
}

export interface CalendarResult {
  items: CalItem[];
  sources: Record<string, SourceState>;
  errors: Record<string, string>;
  offline: boolean;
  savedAt: string | null;
  paired: boolean;
  accountLinked: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = (d: Date) => `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "YYYY-MM-DD" + optional "HH:MM" → a local stamp; an ISO with a zone → this computer's local time. */
function local(value: unknown, time?: unknown): { at: string; allDay: boolean } | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const day = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (day) {
    const t = String(time ?? "").match(/^(\d{1,2}):(\d{2})/);
    return t ? { at: `${day[1]}T${pad(Number(t[1]))}:${t[2]}`, allDay: false } : { at: `${day[1]}T00:00`, allDay: true };
  }
  const wall = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (wall) return { at: `${wall[1]}T${wall[2]}:${wall[3]}`, allDay: false };
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : { at: stamp(d), allDay: false };
}

const text = (...v: unknown[]) => v.filter((x) => x !== null && x !== undefined && x !== "").map(String);
const human = (s: unknown) => String(s ?? "").replace(/[._-]+/g, " ").trim();

function details(raw: Record<string, unknown>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (raw[k] !== null && raw[k] !== undefined && raw[k] !== "") out[human(k)] = String(raw[k]);
  return out;
}

/** Approval wording, as Play-user words it (src/screens/Home.jsx approvalTitle). */
export function approvalTitle(a: Record<string, unknown>): string {
  const p = (a.payload && typeof a.payload === "object" ? a.payload : {}) as Record<string, unknown>;
  return String(p.title || p.summary || p.action || p.description || human(a.type) || "Approval");
}

async function cloudSources(from: string, to: string) {
  const e = env();
  const cid = await companyId().catch(() => "");
  const q = (o: Record<string, string>) => `?${new URLSearchParams(o).toString()}`;
  const [bookings, events, availability, routines, tasks, approvals] = await Promise.all([
    settle(() => gcr("GET", `/owner/bookings${q({ from, to })}`)),
    e.eventsSection
      ? settle(() => gcr("GET", `/business/${encodeURIComponent(e.eventsSection)}${q({ limit: "500" })}`))
      : Promise.resolve<Settled<unknown>>({ state: "not_configured", data: null, error: "NEXTGENT_EVENTS_SECTION is not set." }),
    settle(() => gcr("GET", `/business/availability${q({ from, to })}`)),
    settle(() => paperclip("GET", `/companies/${cid}/routines`)),
    settle(() => paperclip("GET", `/companies/${cid}/issues${q({ status: "in_progress,todo", limit: "50" })}`)),
    settle(() => paperclip("GET", `/companies/${cid}/approvals${q({ status: "pending" })}`)),
  ]);
  return { bookings, events, availability, routines, tasks, approvals };
}

function normalise(src: Awaited<ReturnType<typeof cloudSources>>, from: string, to: string): CalItem[] {
  const out: CalItem[] = [];
  const today = isoDay(new Date());
  const inRange = (at: string) => at.slice(0, 10) >= from && at.slice(0, 10) <= to;

  for (const b of list(src.bookings.data, "bookings")) {
    const s = local(b.start);
    if (!s) continue;
    const e = local(b.end);
    out.push({
      id: `b-${b.id}`, kind: "booking", start: s.at, end: e && !e.allDay ? e.at : null, allDay: s.allDay,
      title: String(b.title || b.customer_name || "Booking"),
      meta: text(b.party_size && `${b.party_size} people`, b.staff, b.source).join(" · "),
      status: (b.status as string) ?? null,
      details: details(b, ["customer_name", "party_size", "staff", "source", "status", "notes"]),
    });
  }
  for (const ev of list(src.events.data, "rows")) {
    if (ev.is_active === false || !ev.event_date) continue;
    const s = local(ev.event_date, ev.start_time);
    if (!s || !inRange(s.at)) continue;
    const e = ev.end_time ? local(ev.event_date, ev.end_time) : null;
    out.push({
      id: `e-${ev.id}`, kind: "event", start: s.at, end: e?.at ?? null, allDay: s.allDay,
      title: String(ev.event_name || ev.title || "Event"),
      meta: text(ev.artist_name, ev.description).join(" · "),
      details: details(ev, ["artist_name", "description", "price", "location"]),
    });
  }
  for (const a of list(src.availability.data, "days")) {
    const s = local(a.availability_date, a.time_slot);
    if (!s) continue;
    const open = a.remaining_spots !== null && a.remaining_spots !== undefined;
    out.push({
      id: `a-${a.id}`, kind: "availability", start: s.at, allDay: s.allDay,
      title: open ? `${a.remaining_spots} open${a.total_capacity ? ` of ${a.total_capacity}` : ""}` : human(a.status) || "Availability",
      meta: text(a.booking_type, a.status).join(" · "),
    });
  }
  for (const b of list(src.availability.data, "blocks")) {
    const s = local(b.date);
    if (!s) continue;
    out.push({ id: `blk-${b.id}`, kind: "availability", start: s.at, allDay: true, title: String(b.title || "Closed to bookings"), meta: "Not taking bookings" });
  }
  for (const r of list(src.routines.data, "routines")) {
    for (const trig of (Array.isArray(r.triggers) ? r.triggers : []) as Record<string, unknown>[]) {
      const s = local(trig.nextRunAt);
      if (s && inRange(s.at)) out.push({ id: `r-${r.id}-${trig.id}`, kind: "task", start: s.at, allDay: false, title: String(r.title ?? "Scheduled work"), meta: "Scheduled agent work", ref: String(r.id) });
    }
  }
  if (today >= from && today <= to) {
    for (const t of list(src.tasks.data, "issues")) {
      if (!t.assigneeAgentId) continue;
      out.push({ id: `t-${t.id}`, kind: "task", start: `${today}T00:00`, allDay: true, title: String(t.title ?? "Task"), meta: human(t.status), status: String(t.status ?? ""), ref: String(t.id) });
    }
    for (const a of list(src.approvals.data, "approvals")) {
      const s = local(a.createdAt);
      out.push({ id: `ap-${a.id}`, kind: "approval", start: s && s.at.slice(0, 10) === today ? s.at : `${today}T00:00`, allDay: !(s && s.at.slice(0, 10) === today), title: approvalTitle(a), meta: "Waiting for you", status: "pending", ref: String(a.id) });
    }
  }
  return out;
}

async function localItems(from: string, to: string): Promise<CalItem[]> {
  const toEnd = new Date(`${to}T23:59:59`).toISOString();
  const events = await listEvents(new Date(`${from}T00:00:00`).toISOString(), toEnd).catch(() => []);
  return events.map((e) => ({
    id: `l-${e.id}`, kind: "local" as const, start: stamp(new Date(e.start)), end: stamp(new Date(e.end)), allDay: e.allDay,
    title: e.title, meta: e.location, ref: e.id, details: e.notes ? { notes: e.notes } : undefined,
  }));
}

/* ── today's copy on disk ─────────────────────────────────────────────────── */

const CACHE = path.join(DATA_DIR, "nextgent-today.json");

interface Copy {
  day: string;
  savedAt: string;
  items: CalItem[];
  sources: Record<string, SourceState>;
}

async function saveCopy(copy: Copy) {
  const tmp = `${CACHE}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(copy));
    await rename(tmp, CACHE);
  } catch {
    /* a read-only disk costs the offline copy, not the calendar */
  }
}

async function readCopy(): Promise<Copy | null> {
  try {
    return JSON.parse(await readFile(CACHE, "utf8")) as Copy;
  } catch {
    return null;
  }
}

export async function dropCopy(): Promise<void> {
  await rm(CACHE, { force: true });
}

const byStart = (a: CalItem, b: CalItem) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1);

export async function calendar(from: string, to: string): Promise<CalendarResult> {
  const c = await readCreds();
  const mine = await localItems(from, to);
  if (!paired(c) || !accountLinked(c)) return { items: mine.sort(byStart), sources: {}, errors: {}, offline: false, savedAt: null, paired: paired(c), accountLinked: false };

  const src = await cloudSources(from, to);
  const sources: Record<string, SourceState> = {};
  const errors: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    sources[k] = v.state;
    if (v.error && v.state !== "ok") errors[k] = v.error;
  }
  const states = Object.values(src).map((s) => s.state);
  const offline = states.every((s) => s === "offline" || s === "not_configured");
  const today = isoDay(new Date());

  if (offline) {
    const copy = await readCopy();
    const fromCopy = copy && copy.day === today && today >= from && today <= to ? copy.items : [];
    return { items: [...fromCopy, ...mine].sort(byStart), sources, errors, offline: true, savedAt: copy?.day === today ? copy.savedAt : null, paired: true, accountLinked: true };
  }

  const items = normalise(src, from, to);
  if (today >= from && today <= to && states.some((s) => s === "ok")) {
    await saveCopy({ day: today, savedAt: new Date().toISOString(), items: items.filter((i) => i.start.slice(0, 10) === today), sources });
  }
  return { items: [...items, ...mine].sort(byStart), sources, errors, offline: false, savedAt: null, paired: true, accountLinked: true };
}

/** Keep today's copy fresh even when nobody is looking at the calendar. */
export function startCalendarRefresh(): void {
  const every = Number(process.env.NEXTGENT_CALENDAR_REFRESH_MS) > 0 ? Number(process.env.NEXTGENT_CALENDAR_REFRESH_MS) : 10 * 60_000;
  const tick = async () => {
    const c = await readCreds();
    if (!paired(c) || !accountLinked(c)) return;
    const today = isoDay(new Date());
    await calendar(today, today).catch(() => {});
  };
  setTimeout(() => void tick(), 5_000).unref();
  setInterval(() => void tick(), every).unref();
}
