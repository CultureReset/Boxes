import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

/*
 * A fake kernel that speaks the same handshake NEXT GENT core does
 * (services/core/app.py: /interface, /kernel/intent). The daemon is pointed at
 * it through the setting it reads on a Ghost box, NEXTGENT_CORE_URL.
 */
const seen: { path: string; auth: string | undefined; body: unknown }[] = [];
const kernel = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : null;
    seen.push({ path: req.url ?? "", auth: req.headers.authorization, body });
    res.setHeader("content-type", "application/json");
    if (req.url === "/interface") {
      return res.end(JSON.stringify({
        interface: "next-gent.kernel", major: 1, minor: 0, version: "test",
        reads: { capabilities: "/kernel/capabilities" },
        actions: { intent: { method: "POST", path: "/kernel/intent" } },
        approvals: null, approval_channel: "sms",
      }));
    }
    if (req.url === "/kernel/intent") {
      const text = String((body as { text: string }).text).toLowerCase();
      if (text.startsWith("text ")) {
        return res.end(JSON.stringify({ resolved: true, capability: "android.sms.send", state: "authorization_required", result: null, task_id: "act_1" }));
      }
      if (text === "open display settings") {
        return res.end(JSON.stringify({ resolved: true, capability: "android.settings.open_display", state: "failed", result: "policy_denied", task_id: "act_2" }));
      }
      return res.end(JSON.stringify({ resolved: false }));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "no" }));
  });
});
await new Promise<void>((r) => kernel.listen(0, "127.0.0.1", r));
process.env.NEXTGENT_CORE_URL = `http://127.0.0.1:${(kernel.address() as AddressInfo).port}`;
process.env.NEXTGENT_CORE_TOKEN = "t0k";
after(() => kernel.close());

const { decide } = await import("./decide.js");

test("a sentence the kernel knows goes to the kernel, with the box's token", async () => {
  const d = await decide("text +15555550100 running late");
  assert.equal(d.via, "kernel");
  assert.equal(d.capability, "android.sms.send");
  assert.equal(d.state, "authorization_required");
  assert.match(d.lines[0], /needs your approval/);
  const call = seen.find((s) => s.path === "/kernel/intent");
  assert.equal(call?.auth, "Bearer t0k");
  assert.deepEqual(call?.body, { text: "text +15555550100 running late", requested_by: "tv" });
});

test("the kernel saying no is told as no", async () => {
  const d = await decide("open display settings");
  assert.equal(d.via, "kernel");
  assert.equal(d.ok, false);
  assert.match(d.lines[0], /not given me permission/);
});

test("a sentence the kernel does not know falls back to this box, read-only", async () => {
  const d = await decide("something nobody declared");
  assert.equal(d.via, "local");
  assert.equal(d.ok, false);
});
