import { platform, qs } from "./client.js";
import { platformConfig } from "./config.js";

/**
 * What the box knows how to do.
 *
 * Every capability declares three things:
 *
 *   phrases  — how a person says it. The router matches against these and
 *              there is no model in that path. A sentence either matches a
 *              declared phrase or it does not.
 *   describe — what it is, for the escalation path only.
 *   run      — what actually happens. It calls the platform. It is the only
 *              thing that produces a figure.
 *
 * THE MODEL NEVER PRODUCES A NUMBER. When a sentence is escalated, a model may
 * choose which capability runs and phrase what came back. Every value in an
 * answer came out of the platform on that request. This is the same rule
 * gcr-api-clean/routes/dashboard-sms.js states in its own header, applied here.
 */

export interface Capability {
  key: string;
  summary: string;
  phrases: string[];
  slots?: Record<string, "text" | "time" | "date" | "number">;
  /** Read-only capabilities are safe to offer a model. Writes are not. */
  readOnly: boolean;
  run: (slots: Record<string, string>) => Promise<unknown>;
}

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export const CAPABILITIES: Capability[] = [
  {
    key: "business.identity",
    summary: "Who this box belongs to.",
    phrases: ["who am i", "what business is this", "whose box is this"],
    readOnly: true,
    run: async () => {
      const c = await platformConfig();
      return platform.get(`/api/public/${encodeURIComponent(c.slug)}`);
    },
  },
  {
    key: "business.hours.read",
    summary: "The opening hours on file.",
    phrases: ["what are my hours", "what time do i open", "what time do i close", "am i open", "opening hours", "closing time"],
    readOnly: true,
    run: async () => {
      const c = await platformConfig();
      return platform.get(`/api/dashboard/hours${qs({ slug: c.slug })}`);
    },
  },
  {
    key: "menu.read",
    summary: "The menu, its sections and its items.",
    phrases: ["show my menu", "what is on the menu", "read my menu", "menu items", "whats on the menu"],
    readOnly: true,
    run: async () => {
      const c = await platformConfig();
      return platform.get(`/api/dashboard/menu${qs({ slug: c.slug })}`);
    },
  },
  {
    key: "bookings.today",
    summary: "Bookings for today.",
    phrases: ["what is on today", "todays bookings", "who is booked today", "whats today", "bookings today", "schedule today"],
    readOnly: true,
    run: async () => {
      const c = await platformConfig();
      return platform.get(`/api/dashboard/bookings${qs({ slug: c.slug, from: today(), to: today() })}`);
    },
  },
  {
    key: "bookings.week",
    summary: "Bookings for the next seven days.",
    phrases: ["this week", "bookings this week", "whats coming up", "next seven days", "upcoming bookings"],
    readOnly: true,
    run: async () => {
      const c = await platformConfig();
      return platform.get(`/api/dashboard/bookings${qs({ slug: c.slug, from: today(), to: plusDays(7) })}`);
    },
  },
  {
    key: "availability.open",
    summary: "What is still free to book.",
    phrases: ["what is open", "any openings", "free slots", "seats left", "whats available", "availability"],
    readOnly: true,
    run: async () => {
      const c = await platformConfig();
      return platform.get(`/api/availability${qs({ slug: c.slug, from: today(), to: plusDays(7) })}`);
    },
  },
  {
    key: "reviews.recent",
    summary: "Reviews that arrived recently.",
    phrases: ["new reviews", "any reviews", "what are people saying", "recent reviews", "reviews"],
    readOnly: true,
    run: async () => {
      const c = await platformConfig();
      return platform.get(`/api/reviews${qs({ slug: c.slug, limit: 10 })}`);
    },
  },
  {
    key: "events.upcoming",
    summary: "Events and specials coming up.",
    phrases: ["whats on", "upcoming events", "any specials", "happy hour", "events"],
    readOnly: true,
    run: async () => {
      const c = await platformConfig();
      return platform.get(`/api/dashboard/events${qs({ slug: c.slug, from: today(), to: plusDays(30) })}`);
    },
  },
];

export const BY_KEY = new Map(CAPABILITIES.map((c) => [c.key, c]));
