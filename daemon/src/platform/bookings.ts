import { platform, qs, NotConnected, PlatformError } from "./client.js";
import { platformConfig, isConnected } from "./config.js";
import type { CalendarEvent } from "../types.js";

/**
 * Bookings, normalised.
 *
 * The platform has several sources — a booking engine, FareHarbor, an iCal
 * feed, a manual entry. They arrive in different shapes. They are flattened
 * here, once, into the one shape the calendar understands.
 *
 * The calendar never learns what FareHarbor is. That is the whole point of
 * doing it at this boundary rather than in the screen.
 */

const COLOUR = {
  booking: "#0a84ff",
  event: "#ff9f0a",
  special: "#bf5af2",
  block: "#8e8e93",
} as const;

const pick = (o: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
};

/** A clock time, as opposed to a date-only lodging stay. Checked before any Date conversion. */
function hasClock(value: string): boolean {
  const v = value.trim();
  return /(?:T|\s)\d{1,2}:\d{2}/.test(v) || /^\d{1,2}:\d{2}/.test(v);
}

/**
 * ISO string, or null when the value is not a real date.
 * `new Date(bad).toISOString()` throws RangeError — that must not escape a row.
 */
function toIso(value: string): string | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function toEvent(raw: unknown, kind: keyof typeof COLOUR): CalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const start = pick(r, "start_time", "starts_at", "start", "date", "start_date", "booking_date", "check_in", "check_in_date", "arrival_date");
  if (!start) return null;
  const startIso = toIso(start);
  if (!startIso) return null;

  const rawEnd = pick(r, "end_time", "ends_at", "end", "end_date", "check_out", "check_out_date");
  const durMin = Number(pick(r, "duration_minutes", "duration")) || 0;
  const allDay = !hasClock(start);
  // A bad end date is this row's problem. Fall back to a duration (or one day
  // for a date-only stay) instead of throwing and dropping the calendar.
  const endIso = (rawEnd && toIso(rawEnd)) || new Date(Date.parse(startIso) + (allDay ? 86_400_000 : (durMin || 60) * 60_000)).toISOString();

  const who = pick(r, "customer_name", "guest_name", "name", "title", "product_name");
  const party = pick(r, "party_size", "guests", "guest_count", "seats", "quantity");
  const title = kind === "booking" ? [who || "Booking", party ? `(${party})` : ""].filter(Boolean).join(" ") : who || "Event";

  return {
    id: `platform:${kind}:${pick(r, "id", "booking_id", "uuid") || startIso}`,
    title: title.slice(0, 200),
    start: startIso,
    end: endIso,
    allDay,
    location: pick(r, "location", "meeting_point", "resource_name", "room_name") || undefined,
    notes: pick(r, "notes", "status", "confirmation_id") || undefined,
    color: COLOUR[kind],
  };
}

const rows = (d: unknown): unknown[] =>
  Array.isArray(d) ? d : d && typeof d === "object" && Array.isArray((d as { data?: unknown[] }).data) ? (d as { data: unknown[] }).data! : [];

/**
 * Everything the owner has on between two dates, from every source the
 * platform knows about. Failures are per-source: a dead booking provider costs
 * you its rows, not the calendar.
 */
export async function platformEvents(from: string, to: string): Promise<CalendarEvent[]> {
  if (!(await isConnected())) return [];
  const { slug } = await platformConfig();
  const q = qs({ slug, from, to });

  const sources: Array<[string, keyof typeof COLOUR]> = [
    [`/api/dashboard/bookings${q}`, "booking"],
    [`/api/dashboard/events${q}`, "event"],
    [`/api/dashboard/specials${q}`, "special"],
  ];

  const settled = await Promise.allSettled(sources.map(([p]) => platform.get(p)));
  const out: CalendarEvent[] = [];
  settled.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    const kind = sources[i][1];
    for (const r of rows(res.value)) {
      try {
        const ev = toEvent(r, kind);
        if (ev) out.push(ev);
      } catch (err) {
        // One bad row must not abort the rest of this source, or the sources after it.
        console.error("calendar: skipped a malformed booking:", (err as Error).message);
      }
    }
  });
  return out;
}

/** The platform answered. A network failure (status 0) and "not connected" did not. */
function answered(e: unknown): boolean {
  return !(e instanceof NotConnected) && !(e instanceof PlatformError && e.status === 0);
}

/**
 * True when the platform answered. Lets the screen say "offline" honestly.
 *
 * `/api/health` is the real check. On the unmerged gcr-api-clean deploy that
 * route 404s, so a 404 falls through to `GET /` rather than reporting the
 * platform down before the API is deployed. Any other answer — including a
 * 500 — means we reached it.
 */
export async function platformReachable(): Promise<boolean> {
  if (!(await isConnected())) return false;
  try {
    await platform.get("/api/health");
    return true;
  } catch (e) {
    if (e instanceof PlatformError && e.status === 404) {
      try {
        await platform.get("/");
        return true;
      } catch (e2) {
        return answered(e2);
      }
    }
    return answered(e);
  }
}
