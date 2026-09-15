import { id } from "../store.js";
import { isDemo } from "./status.js";
import { WorldStore } from "./worlds.js";
import { bus } from "../events.js";
import { HttpError } from "../router.js";
import type { CalendarEvent } from "../types.js";
import { platformEvents } from "../platform/bookings.js";

/**
 * Sample events exist so the demo preview is not a blank wall. A real machine
 * starts with an empty calendar: NODE never puts appointments you did not make
 * in front of you.
 */
function seed(): CalendarEvent[] {
  if (!demoSeed) return [];
  const today = new Date();
  const at = (dayOffset: number, h: number, m = 0, durMin = 60) => {
    const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, h, m);
    const e = new Date(s.getTime() + durMin * 60000);
    return { start: s.toISOString(), end: e.toISOString() };
  };
  return [
    { id: id(), title: "Team sync", ...at(0, 11), allDay: false, color: "#0a84ff", location: "Video call" },
    { id: id(), title: "Dinner rush prep", ...at(0, 17, 0, 90), allDay: false, color: "#ff9f0a" },
    { id: id(), title: "Weekly review", ...at(1, 9, 30), allDay: false, color: "#30d158" },
    { id: id(), title: "Q2 travel planning", ...at(3, 14, 0, 45), allDay: false, color: "#bf5af2" },
  ];
}

let demoSeed = false;
void isDemo().then((d) => (demoSeed = d));

const store = new WorldStore<CalendarEvent[]>("calendar", seed);

export async function listEvents(from?: string, to?: string): Promise<CalendarEvent[]> {
  const local = await store.read();
  const f = from ? Date.parse(from) : -Infinity;
  const t = to ? Date.parse(to) : Infinity;

  // The owner's own entries, plus whatever the business actually has booked.
  // Platform rows carry a `platform:` id and are not written to the local
  // store — they are read fresh, so cancelling a booking removes it here.
  const remote = await platformEvents(
    from ?? new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10),
    to ?? new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10),
  ).catch(() => [] as CalendarEvent[]);

  const seen = new Set<string>();
  return [...local, ...remote]
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return Date.parse(e.end) >= f && Date.parse(e.start) <= t;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function upsertEvent(input: Partial<CalendarEvent>): Promise<CalendarEvent> {
  if (input.id?.startsWith("platform:")) throw new HttpError(409, "That is a booking. Change it where it was taken.");
  if (!input.title || !input.start || !input.end) throw new HttpError(400, "title, start and end are required");
  if (Number.isNaN(Date.parse(input.start)) || Number.isNaN(Date.parse(input.end))) throw new HttpError(400, "Invalid date");
  const ev: CalendarEvent = {
    id: input.id ?? id(),
    title: input.title.slice(0, 200),
    start: new Date(input.start).toISOString(),
    end: new Date(input.end).toISOString(),
    allDay: Boolean(input.allDay),
    location: input.location?.slice(0, 200),
    notes: input.notes?.slice(0, 2000),
    color: input.color,
  };
  await store.update((all) => [...all.filter((e) => e.id !== ev.id), ev]);
  bus.emit("calendar", { changed: ev.id });
  return ev;
}

export async function deleteEvent(eventId: string): Promise<void> {
  // A booking is not the calendar's to delete. It belongs to whatever took it.
  if (eventId.startsWith("platform:")) {
    throw new HttpError(409, "That is a booking. Cancel it where it was taken.");
  }
  await store.update((all) => all.filter((e) => e.id !== eventId));
  bus.emit("calendar", { removed: eventId });
}
