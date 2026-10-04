import { test } from "node:test";
import assert from "node:assert/strict";
import { mirrorArgs } from "./providers/android.js";

// The phone mirror on the TV is view-only. scrcpy's --no-control refuses every
// tap, key and swipe from the window, so nobody at the TV can operate the
// agent phone outside nextgent-platform's policy, approvals and journal.
test("the phone mirror is opened with scrcpy --no-control", () => {
  const args = mirrorArgs("R5CT30ABCDE");
  assert.ok(args.includes("--no-control"), `expected --no-control in ${JSON.stringify(args)}`);
});

test("the mirror still names the phone and its window", () => {
  const args = mirrorArgs("R5CT30ABCDE");
  assert.deepEqual(args.slice(0, 2), ["-s", "R5CT30ABCDE"]);
  assert.ok(args.includes("--window-title"), "window title so the Continue row can map the window back");
});
