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

const PRESENT: Record<string, (data: unknown) => string[]> = {
  "business.identity": (d) => {
    const name = s(get(d, "name") || get(d, "display_name"));
    const city = s(get(d, "city"));
    return name ? [city ? `${name}, ${city}.` : `${name}.`] : ["No business is on file for this box yet."];
  },

  "business.hours.read": (d) => {
    const rows = list(d);
    if (!rows.length) return ["There are no hours on file yet."];
    return rows.map((r) => {
      const day = typeof get(r, "weekday") === "number" ? DAYS[get(r, "weekday") as number] : s(get(r, "day"));
      if (get(r, "closed")) return `${day}: closed`;
      const open = s(get(r, "opens") ?? get(r, "open"));
      const close = s(get(r, "closes") ?? get(r, "close"));
      return `${day}: ${open} to ${close}`;
    });
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
      const time = s(get(r, "start_time") || get(r, "starts_at") || get(r, "time")).slice(0, 16).replace("T", " ");
      const who = s(get(r, "customer_name") || get(r, "name") || "booking");
      const party = get(r, "party_size") ?? get(r, "guests");
      out.push(`  ${time} — ${who}${party ? ` (${party})` : ""}`);
    }
    return out;
  },

  "bookings.week": (d) => PRESENT["bookings.today"](d),

  "availability.open": (d) => {
    const rows = list(d);
    if (!rows.length) return ["Nothing is showing as open in the next seven days."];
    const out: string[] = [];
    for (const r of rows.slice(0, 10)) {
      const when = s(get(r, "date") || get(r, "start_time")).slice(0, 16).replace("T", " ");
      const left = get(r, "remaining") ?? get(r, "available") ?? get(r, "seats_left");
      out.push(`  ${when}${left !== undefined ? ` — ${left} left` : ""}`);
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
    const present = PRESENT[match.capability.key] ?? fallback;
    return { lines: present(data), ok: true, capability: match.capability.key, data };
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
    const dayOf = (r: unknown) =>
      typeof get(r, "weekday") === "number" ? DAYS[get(r, "weekday") as number] : s(get(r, "day"));
    const open = rows.filter((r) => !get(r, "closed"));
    const shut = rows.filter((r) => get(r, "closed")).map(dayOf).filter(Boolean);

    if (!open.length) return `Closed ${join(shut)}.`;

    // Days that share the same hours are said once.
    const groups = new Map<string, string[]>();
    for (const r of open) {
      const span = `${s(get(r, "opens"))} to ${s(get(r, "closes"))}`;
      groups.set(span, [...(groups.get(span) ?? []), dayOf(r)]);
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
    const firstTime = time(get(rows[0], "start_time") || get(rows[0], "starts_at"));
    if (rows.length === 1) {
      return `One booking today, ${s(get(rows[0], "customer_name") || get(rows[0], "name"))}${firstTime ? ` at ${firstTime}` : ""}.`;
    }
    const lastTime = time(get(rows[rows.length - 1], "start_time") || get(rows[rows.length - 1], "starts_at"));
    return `${rows.length} bookings today${firstTime ? `, starting at ${firstTime}` : ""}${lastTime ? ` and finishing at ${lastTime}` : ""}.`;
  },

  "bookings.week": (d) => {
    const rows = list(d);
    return rows.length ? `${rows.length} booking${rows.length === 1 ? "" : "s"} in the next week.` : "Nothing is booked this week.";
  },

  "availability.open": (d) => {
    const rows = list(d);
    if (!rows.length) return "Nothing is showing as open in the next week.";
    const total = rows.reduce<number>((n, r) => n + (Number(get(r, "remaining") ?? get(r, "available") ?? 0) || 0), 0);
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
