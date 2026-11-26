import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { toEvent, platformEvents, platformReachable } from "./bookings.js";

type Mode = "ok" | "health404" | "health404-root-down" | "health-down" | "health500";

let mode: Mode = "ok";
const hits: string[] = [];
const server = http.createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  hits.push(path);
  if (path === "/api/health") {
    if (mode === "health-down") {
      res.destroy();
      return;
    }
    if (mode === "health500") {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "down" }));
      return;
    }
    if (mode === "health404" || mode === "health404-root-down") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (path === "/") {
    if (mode === "health404-root-down") {
      res.destroy();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (path === "/api/dashboard/bookings") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      data: [
        null,
        { id: "bad", start_time: "not-a-real-date", end_time: "also-bad", customer_name: "Broken" },
        { id: "bad-end", start_time: "2026-11-26T16:00:00.000Z", end_time: "still-not-a-date", customer_name: "Bea", party_size: 1 },
        { id: "good", start_time: "2026-11-26T15:00:00.000Z", end_time: "2026-11-26T16:00:00.000Z", customer_name: "Ada", party_size: 2 },
        { id: "lodge", date: "2026-11-27", guest_name: "Cara", room_name: "Cabin 2" },
      ],
    }));
    return;
  }
  if (path === "/api/dashboard/events") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify([{ id: "ev1", start: "2026-12-01T12:00:00.000Z", title: "Special dinner" }]));
    return;
  }
  // A dead third source must not drop the rows that did come back.
  res.writeHead(500, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "specials down" }));
});

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  process.env.NODEOS_API_URL = `http://127.0.0.1:${port}`;
  process.env.NODEOS_API_TOKEN = "test-token";
  process.env.NODEOS_SLUG = "demo";
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test("malformed dates are skipped and never throw", () => {
  assert.doesNotThrow(() => {
    assert.equal(toEvent({ start_time: "not-a-date", end_time: "nope", customer_name: "Broken" }, "booking"), null);
    assert.equal(toEvent(null, "event"), null);
    assert.equal(toEvent("nope", "special"), null);
  });

  const kept = toEvent({ id: "bad-end", start_time: "2026-11-26T16:00:00.000Z", end_time: "still-not-a-date", customer_name: "Bea" }, "booking");
  assert.ok(kept);
  assert.equal(kept.start, "2026-11-26T16:00:00.000Z");
  assert.equal(kept.end, "2026-11-26T17:00:00.000Z");
  assert.equal(kept.allDay, false);

  const lodge = toEvent({ id: "lodge", check_in: "2026-11-27", check_out: "2026-11-29", guest_name: "Cara", room_name: "Cabin 2" }, "booking");
  assert.ok(lodge);
  assert.equal(lodge.allDay, true);
  assert.equal(lodge.start, "2026-11-27T00:00:00.000Z");
  assert.equal(lodge.end, "2026-11-29T00:00:00.000Z");
  assert.equal(lodge.title, "Cara");
  assert.equal(lodge.location, "Cabin 2");

  const dateOnly = toEvent({ id: "stay", date: "2026-11-27", customer_name: "Ada" }, "booking");
  assert.ok(dateOnly);
  assert.equal(dateOnly.allDay, true);
  assert.equal(dateOnly.end, "2026-11-28T00:00:00.000Z");
});

describe("platform http", { concurrency: false }, () => {
  test("one malformed date does not abort the calendar fetch", async () => {
    mode = "ok";
    const events = await platformEvents("2026-11-01", "2026-12-31");
    assert.deepEqual(events.map((e) => e.id).sort(), [
      "platform:booking:bad-end",
      "platform:booking:good",
      "platform:booking:lodge",
      "platform:event:ev1",
    ]);
    const lodge = events.find((e) => e.id === "platform:booking:lodge");
    assert.equal(lodge?.allDay, true);
    assert.equal(lodge?.title, "Cara");
    assert.equal(events.some((e) => e.id.includes(":bad") && !e.id.includes("bad-end")), false);
  });

  test("/api/health stays primary and 404 falls back to GET /", async () => {
    hits.length = 0;
    mode = "ok";
    assert.equal(await platformReachable(), true);
    assert.deepEqual(hits, ["/api/health"]);

    hits.length = 0;
    mode = "health500";
    assert.equal(await platformReachable(), true);
    assert.deepEqual(hits, ["/api/health"]);

    hits.length = 0;
    mode = "health404";
    assert.equal(await platformReachable(), true);
    assert.deepEqual(hits, ["/api/health", "/"]);

    hits.length = 0;
    mode = "health404-root-down";
    assert.equal(await platformReachable(), false);
    assert.deepEqual(hits, ["/api/health", "/"]);

    hits.length = 0;
    mode = "health-down";
    assert.equal(await platformReachable(), false);
    assert.deepEqual(hits, ["/api/health"]);
  });
});
