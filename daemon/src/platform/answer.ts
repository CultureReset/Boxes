import { route, UNROUTED, type Match } from "./router.js";
import { NotConnected, PlatformError } from "./client.js";

/**
 * Turning what came back into a sentence.
 *
 * Every presenter below reads values that a capability already fetched. None of
 * them invents one. A figure in an answer is a figure the platform returned on
 * this request, or it is not in the answer.
 */

export interface Answer {
  lines: string[];
  ok: boolean;
  capability?: string;
  /** What actually came back, so the caller can render it rather than re-parse prose. */
  data?: unknown;
}

const list = (rows: unknown): unknown[] =>
  Array.isArray(rows) ? rows : rows && typeof rows === "object" && Array.isArray((rows as { data?: unknown[] }).data) ? (rows as { data: unknown[] }).data! : [];

const get = (o: unknown, k: string): unknown => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined);
const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Hours rows come from two schemas. The daemon's own names are weekday / day,
 * opens / open, closes / close, closed. gcr-api-clean's entity_hours columns
 * are day_of_week, opens_at, closes_at, is_closed. Numeric days are Sunday = 0,
 * the same index `weekday` already uses.
 */
function dayName(r: unknown): string {
  const raw = get(r, "weekday") ?? get(r, "day_of_week") ?? get(r, "day");
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < DAYS.length) return DAYS[raw];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (n >= 0 && n < DAYS.length) return DAYS[n];
    }
    return t;
  }
  return "";
}

function closedFlag(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" || t === "t" || t === "yes" || t === "1" || t === "closed";
  }
  return false;
}

function isClosedDay(r: unknown): boolean {
  const modern = get(r, "is_closed");
  if (modern !== undefined && modern !== null) return closedFlag(modern);
  const legacy = get(r, "closed");
  if (legacy !== undefined && legacy !== null) return closedFlag(legacy);
  return false;
}

function tidyTime(v: unknown): string {
  const raw = s(v).trim();
  const m = raw.match(/^(\d{1,2}:\d{2})(?::\d{2})?(?:\.\d+)?$/);
  return m ? m[1] : raw;
}

function firstText(r: unknown, ...keys: string[]): string {
  for (const k of keys) {
    const v = get(r, k);
    if (v === undefined || v === null) continue;
    const text = tidyTime(v);
    if (text) return text;
  }
  return "";
}

function hoursSpan(r: unknown): { open: string; close: string } {
  return {
    open: firstText(r, "opens", "open", "opens_at"),
    close: firstText(r, "closes", "close", "closes_at"),
  };
}

function hoursLine(r: unknown): string {
  const day = dayName(r) || "Day";
  if (isClosedDay(r)) return `${day}: closed`;
  const { open, close } = hoursSpan(r);
  if (!open && !close) return `${day}: hours not on file`;
  if (!open || !close) return `${day}: ${open || close}`;
  return `${day}: ${open} to ${close}`;
}

/** A value that carries a clock, not just a calendar date. */
function hasClock(v: unknown): boolean {
  const raw = s(v).trim();
  if (!raw) return false;
  return /(?:T|\s)\d{1,2}:\d{2}/.test(raw) || /^\d{1,2}:\d{2}/.test(raw);
}

function presentClock(v: unknown): string {
  const raw = s(v).trim();
  if (/^\d{1,2}:\d{2}/.test(raw)) return tidyTime(raw);
  return raw.slice(0, 16).replace("T", " ");
}

/**
 * Bookings that only carry a date (lodging stays, no start_time / starts_at / time)
 * are all-day. Inventing a clock from midnight is how "today" used to render a blank time.
 */
function bookingMoment(r: unknown): { label: string; allDay: boolean } {
  const clockRaw = get(r, "start_time") ?? get(r, "starts_at") ?? get(r, "time");
  if (hasClock(clockRaw)) return { label: presentClock(clockRaw), allDay: false };
  const dateRaw = (clockRaw !== undefined && clockRaw !== null && s(clockRaw).trim())
    ? clockRaw
    : (get(r, "date") ?? get(r, "booking_date") ?? get(r, "start_date") ?? get(r, "check_in") ?? get(r, "check_in_date") ?? get(r, "arrival_date"));
  if (dateRaw !== undefined && dateRaw !== null && s(dateRaw).trim()) {
    const day = s(dateRaw).trim().slice(0, 10);
    return { label: day ? `${day} · all day` : "All day", allDay: true };
  }
  return { label: "All day", allDay: true };
}

function guestName(r: unknown): string {
  return s(get(r, "customer_name") || get(r, "guest_name") || get(r, "name")).trim() || "booking";
}

function partySize(r: unknown): unknown {
  return get(r, "party_size") ?? get(r, "guests") ?? get(r, "guest_count");
}

/** availability rows: intake writes availability_date / remaining_spots; older rows use date / remaining. */
function availabilityWhen(r: unknown): string {
  return s(get(r, "date") || get(r, "availability_date") || get(r, "start_time") || get(r, "starts_at")).trim().slice(0, 16).replace("T", " ");
}

function spotsLeft(r: unknown): unknown {
  return get(r, "remaining") ?? get(r, "remaining_spots") ?? get(r, "available") ?? get(r, "seats_left");
}

const PRESENT: Record<string, (data: unknown) => string[]> = {
  "business.identity": (d) => {
    const name = s(get(d, "name") || get(d, "display_name"));
    const city = s(get(d, "city"));
    return name ? [city ? `${name}, ${city}.` : `${name}.`] : ["No business is on file for this box yet."];
  },

  "business.hours.read": (d) => {
    const rows = list(d);
    if (!rows.length) return ["There are no hours on file yet."];
    return rows.map(hoursLine);
  },

  "menu.read": (d) => {
    const rows = list(d);
    if (!rows.length) return ["There is no menu on file yet."];
    const bySection = new Map<string, number>();
    for (const r of rows) {
      const sec = s(get(r, "section") || get(r, "section_name") || "Menu");
      bySection.set(sec, (bySection.get(sec) ?? 0) + 1);
    }
    const out = [`${rows.length} item${rows.length === 1 ? "" : "s"} on the menu.`];
    for (const [sec, n] of bySection) out.push(`  ${sec} — ${n}`);
    return out;
  },

  "bookings.today": (d) => {
    const rows = list(d);
    if (!rows.length) return ["Nothing booked today."];
    const out = [`${rows.length} booking${rows.length === 1 ? "" : "s"} today.`];
    for (const r of rows.slice(0, 10)) {
      const when = bookingMoment(r);
      const party = partySize(r);
      out.push(`  ${when.label} — ${guestName(r)}${party ? ` (${party})` : ""}`);
    }
    return out;
  },

  "bookings.week": (d) => PRESENT["bookings.today"](d),

  "availability.open": (d) => {
    const rows = list(d);
    if (!rows.length) return ["Nothing is showing as open in the next seven days."];
    const out: string[] = [];
    for (const r of rows.slice(0, 10)) {
      const when = availabilityWhen(r);
      const left = spotsLeft(r);
      out.push(`  ${when}${left !== undefined && left !== null ? ` — ${left} left` : ""}`);
    }
    return [`${rows.length} opening${rows.length === 1 ? "" : "s"}.`, ...out];
  },

  "reviews.recent": (d) => {
    const rows = list(d);
    if (!rows.length) return ["No reviews have come in."];
    const out = [`${rows.length} recent review${rows.length === 1 ? "" : "s"}.`];
    for (const r of rows.slice(0, 5)) {
      const rating = get(r, "rating");
      const text = s(get(r, "text") || get(r, "comment")).slice(0, 90);
      out.push(`  ${rating ? `${rating}★ ` : ""}${text}`);
    }
    return out;
  },

  "events.upcoming": (d) => {
    const rows = list(d);
    if (!rows.length) return ["Nothing is scheduled."];
    const out = [`${rows.length} coming up.`];
    for (const r of rows.slice(0, 8)) {
      const when = s(get(r, "start_date") || get(r, "date") || get(r, "starts_at")).slice(0, 10);
      out.push(`  ${when} — ${s(get(r, "title") || get(r, "name"))}`);
    }
    return out;
  },
};

function fallback(data: unknown): string[] {
  const rows = list(data);
  if (rows.length) return [`${rows.length} result${rows.length === 1 ? "" : "s"}.`];
  return ["Done."];
}

/** Screen lines for a capability payload. Presenters invent nothing; they only read what came back. */
export function presentLines(capability: string | undefined, data: unknown): string[] {
  const present = (capability && PRESENT[capability]) || fallback;
  return present(data);
}

/**
 * Ask the box something.
 *
 * Deterministic all the way through: match a declared phrase, run the
 * capability, present what came back. No model anywhere in this path.
 */
export async function answer(sentence: string): Promise<Answer> {
  const match: Match | null = route(sentence);
  if (!match) return { lines: [UNROUTED], ok: false };

  try {
    const data = await match.capability.run({});
    return { lines: presentLines(match.capability.key, data), ok: true, capability: match.capability.key, data };
  } catch (e) {
    if (e instanceof NotConnected) {
      return { lines: ["This box is not connected to a business yet. Open Settings and sign in."], ok: false };
    }
    if (e instanceof PlatformError) {
      return { lines: [`I could not reach the platform just now — ${e.message}.`], ok: false };
    }
    return { lines: [`Something went wrong: ${(e as Error).message}`], ok: false };
  }
}

/**
 * The same facts, said out loud.
 *
 * A screen can carry a list. A phone call cannot — "2026-09-15 18:30 — Mike
 * Halloran (6)" is a row, not a sentence. These read the same data the screen
 * reads and say it the way a person would, and they still invent nothing.
 */
const time = (v: unknown): string => {
  const d = new Date(s(v));
  if (Number.isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")} ${ampm}` : `${h} ${ampm}`;
};

const join = (parts: string[]): string =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

const SPOKEN: Record<string, (data: unknown) => string> = {
  "business.identity": (d) => {
    const name = s(get(d, "name") || get(d, "display_name"));
    return name ? `This is ${name}.` : "No business is set up on this box yet.";
  },

  "business.hours.read": (d) => {
    const rows = list(d);
    if (!rows.length) return "There are no hours on file.";
    const open = rows.filter((r) => !isClosedDay(r));
    const shut = rows.filter(isClosedDay).map(dayName).filter(Boolean);

    if (!open.length) return `Closed ${join(shut)}.`;

    // Days that share the same hours are said once.
    const groups = new Map<string, string[]>();
    for (const r of open) {
      const { open: from, close: to } = hoursSpan(r);
      const span = from && to ? `${from} to ${to}` : from || to || "hours not on file";
      const name = dayName(r) || "that day";
      groups.set(span, [...(groups.get(span) ?? []), name]);
    }
    const said = [...groups.entries()].map(([span, days]) => `${join(days)}, ${span}`);
    return [join(said), shut.length ? `Closed ${join(shut)}` : ""].filter(Boolean).join(". ") + ".";
  },


  "menu.read": (d) => {
    const rows = list(d);
    if (!rows.length) return "There is no menu on file.";
    const sections = [...new Set(rows.map((r) => s(get(r, "section") || get(r, "section_name") || "the menu")))];
    return `There are ${rows.length} items, across ${join(sections)}.`;
  },

  "bookings.today": (d) => {
    const rows = list(d);
    if (!rows.length) return "Nothing is booked today.";
    const clockOf = (r: unknown): string => {
      const raw = get(r, "start_time") ?? get(r, "starts_at") ?? get(r, "time");
      return hasClock(raw) ? time(raw) : "";
    };
    if (rows.every((r) => bookingMoment(r).allDay)) {
      return rows.length === 1
        ? `One booking today, ${guestName(rows[0])}, all day.`
        : `${rows.length} bookings today, all day.`;
    }
    const firstTime = clockOf(rows[0]);
    if (rows.length === 1) {
      return `One booking today, ${guestName(rows[0])}${firstTime ? ` at ${firstTime}` : ""}.`;
    }
    const last = rows[rows.length - 1];
    const lastTime = bookingMoment(last).allDay ? "" : clockOf(last);
    return `${rows.length} bookings today${firstTime ? `, starting at ${firstTime}` : ""}${lastTime ? ` and finishing at ${lastTime}` : ""}.`;
  },

  "bookings.week": (d) => {
    const rows = list(d);
    return rows.length ? `${rows.length} booking${rows.length === 1 ? "" : "s"} in the next week.` : "Nothing is booked this week.";
  },

  "availability.open": (d) => {
    const rows = list(d);
    if (!rows.length) return "Nothing is showing as open in the next week.";
    const total = rows.reduce<number>((n, r) => {
      const num = Number(spotsLeft(r) ?? 0);
      return n + (Number.isFinite(num) ? num : 0);
    }, 0);
    return total
      ? `${rows.length} opening${rows.length === 1 ? "" : "s"}, ${total} space${total === 1 ? "" : "s"} in total.`
      : `${rows.length} opening${rows.length === 1 ? "" : "s"}.`;
  },

  "reviews.recent": (d) => {
    const rows = list(d);
    if (!rows.length) return "No reviews have come in.";
    const rated = rows.map((r) => Number(get(r, "rating"))).filter((n) => !Number.isNaN(n) && n > 0);
    const avg = rated.length ? (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1) : "";
    return `${rows.length} recent review${rows.length === 1 ? "" : "s"}${avg ? `, averaging ${avg} stars` : ""}.`;
  },

  "events.upcoming": (d) => {
    const rows = list(d);
    if (!rows.length) return "Nothing is scheduled.";
    const first = s(get(rows[0], "title") || get(rows[0], "name"));
    return rows.length === 1 ? `One thing coming up: ${first}.` : `${rows.length} coming up, next is ${first}.`;
  },
};

/** One sentence, for a phone call or a text. Falls back to the screen lines. */
export function spoken(capability: string | undefined, data: unknown, lines: string[]): string {
  const f = capability ? SPOKEN[capability] : undefined;
  if (f) {
    try {
      return f(data);
    } catch {
      /* fall through */
    }
  }
  return lines.join(" ");
}
