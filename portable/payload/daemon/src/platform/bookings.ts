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

function toEvent(raw: unknown, kind: keyof typeof COLOUR): CalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const start = pick(r, "start_time", "starts_at", "start", "date", "start_date", "booking_date");
  if (!start) return null;
  const startIso = new Date(start).toISOString();
  if (Number.isNaN(Date.parse(startIso))) return null;

  const rawEnd = pick(r, "end_time", "ends_at", "end", "end_date");
  const durMin = Number(pick(r, "duration_minutes", "duration")) || 0;
  const endIso = rawEnd
    ? new Date(rawEnd).toISOString()
    : new Date(Date.parse(startIso) + (durMin || 60) * 60_000).toISOString();

  const who = pick(r, "customer_name", "guest_name", "name", "title", "product_name");
  const party = pick(r, "party_size", "guests", "seats", "quantity");
  const title = kind === "booking" ? [who || "Booking", party ? `(${party})` : ""].filter(Boolean).join(" ") : who || "Event";

  return {
    id: `platform:${kind}:${pick(r, "id", "booking_id", "uuid") || startIso}`,
    title: title.slice(0, 200),
    start: startIso,
    end: endIso,
    allDay: !/T\d\d:/.test(start),
    location: pick(r, "location", "meeting_point", "resource_name") || undefined,
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
      const ev = toEvent(r, kind);
      if (ev) out.push(ev);
    }
  });
  return out;
}

/** True when at least one source answered. Lets the screen say "offline" honestly. */
export async function platformReachable(): Promise<boolean> {
  if (!(await isConnected())) return false;
  try {
    await platform.get("/api/health");
    return true;
  } catch (e) {
    return !(e instanceof NotConnected) && !(e instanceof PlatformError && e.status === 0);
  }
}
