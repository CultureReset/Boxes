import { test } from "node:test";
import assert from "node:assert/strict";
import { refusal } from "./gate.js";
import type { Capability } from "./capabilities.js";

const cap = (key: string, readOnly: boolean): Capability => ({ key, summary: key, phrases: [key], readOnly, run: async () => null });

test("a sentence may run read-only capabilities here", () => {
  assert.equal(refusal(cap("bookings.today", true), "sentence"), null);
  assert.equal(refusal(cap("phone.screen", true), "sentence"), null);
});

test("a sentence may not change anything here", () => {
  assert.match(refusal(cap("display.mode.set", false), "sentence") ?? "", /goes through your rules/);
  assert.match(refusal(cap("apps.add", false), "sentence") ?? "", /goes through your rules/);
});

test("a button on this screen may change local things", () => {
  assert.equal(refusal(cap("display.mode.set", false), "button"), null);
  assert.equal(refusal(cap("apps.add", false), "button"), null);
});

test("the phone and the SIM are never driven from here, not even by a button", () => {
  for (const key of ["phone.tap", "phone.open", "notify.text", "notify.test"]) {
    assert.match(refusal(cap(key, false), "button") ?? "", /uses the phone/, key);
    assert.match(refusal(cap(key, false), "sentence") ?? "", /uses the phone/, key);
  }
});

test("when core is running but did not recognise the sentence, it does not say core is down", () => {
  for (const key of ["notify.text", "phone.tap"]) {
    const said = refusal(cap(key, false), "sentence", true) ?? "";
    assert.match(said, /did not recognise/, key);
    assert.doesNotMatch(said, /core is running/, key);
  }
  assert.match(refusal(cap("display.mode.set", false), "sentence", true) ?? "", /did not recognise/);
});
