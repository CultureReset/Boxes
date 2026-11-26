import { test } from "node:test";
import assert from "node:assert/strict";
import { presentLines, spoken } from "./answer.js";

const gcrHours = {
  data: [
    { day_of_week: 1, opens_at: "09:00:00", closes_at: "17:00:00", is_closed: false },
    { day_of_week: 2, opens_at: "09:00:00", closes_at: "17:00:00", is_closed: false },
    { day_of_week: 0, opens_at: null, closes_at: null, is_closed: true },
  ],
};

const legacyHours = [
  { weekday: 5, open: "08:00", close: "12:00" },
  { day: "Thursday", closed: true },
  { day: "Wednesday", closed: "false", opens: "11:00", closes: "15:00" },
];

test("hours accept entity_hours columns and the legacy names", () => {
  assert.deepEqual(presentLines("business.hours.read", gcrHours), [
    "Monday: 09:00 to 17:00",
    "Tuesday: 09:00 to 17:00",
    "Sunday: closed",
  ]);
  assert.equal(
    spoken("business.hours.read", gcrHours, []),
    "Monday and Tuesday, 09:00 to 17:00. Closed Sunday.",
  );

  assert.deepEqual(presentLines("business.hours.read", legacyHours), [
    "Friday: 08:00 to 12:00",
    "Thursday: closed",
    "Wednesday: 11:00 to 15:00",
  ]);
  assert.deepEqual(presentLines("business.hours.read", [{ day_of_week: 3 }]), ["Wednesday: hours not on file"]);
  assert.deepEqual(presentLines("business.hours.read", []), ["There are no hours on file yet."]);
});

test("availability accepts availability_date and remaining_spots", () => {
  const gcr = {
    data: [
      { availability_date: "2026-11-27", remaining_spots: 4 },
      { availability_date: "2026-11-28T18:00:00", remaining_spots: 0 },
    ],
  };
  assert.deepEqual(presentLines("availability.open", gcr), [
    "2 openings.",
    "  2026-11-27 — 4 left",
    "  2026-11-28 18:00 — 0 left",
  ]);
  assert.equal(spoken("availability.open", gcr, []), "2 openings, 4 spaces in total.");

  assert.deepEqual(presentLines("availability.open", [{ date: "2026-12-01T09:30:00Z", remaining: 2 }]), [
    "1 opening.",
    "  2026-12-01 09:30 — 2 left",
  ]);
  assert.equal(spoken("availability.open", [{ date: "2026-12-01", remaining: 1 }], []), "1 opening, 1 space in total.");
});

test("date-only lodging bookings render as all day, timed bookings keep their clock", () => {
  const rows = [
    { date: "2026-11-26", guest_name: "Ada Lovelace" },
    { booking_date: "2026-11-26", customer_name: "Alan", party_size: 2 },
    { check_in: "2026-11-26", name: "Grace" },
  ];
  assert.deepEqual(presentLines("bookings.today", rows), [
    "3 bookings today.",
    "  2026-11-26 · all day — Ada Lovelace",
    "  2026-11-26 · all day — Alan (2)",
    "  2026-11-26 · all day — Grace",
  ]);
  assert.equal(spoken("bookings.today", [{ date: "2026-11-26", guest_name: "Ada" }], []), "One booking today, Ada, all day.");
  assert.equal(spoken("bookings.today", rows, []), "3 bookings today, all day.");
  assert.doesNotMatch(spoken("bookings.today", rows, []), /\bat\b/);

  const timed = [{ start_time: "2026-11-26T15:04:00", customer_name: "Grace", guests: 3 }];
  assert.deepEqual(presentLines("bookings.today", timed), [
    "1 booking today.",
    "  2026-11-26 15:04 — Grace (3)",
  ]);
  assert.match(spoken("bookings.today", timed, []), /^One booking today, Grace at \d{1,2}:\d{2} [ap]m\.$/);

  assert.deepEqual(presentLines("bookings.today", [{}]), [
    "1 booking today.",
    "  All day — booking",
  ]);
});
