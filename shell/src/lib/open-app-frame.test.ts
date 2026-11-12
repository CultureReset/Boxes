import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLocalDesktopShell, resolveFrameSrc } from "./open-app-frame.ts";
import type { AppEntry } from "../api/types.ts";

const n8n: AppEntry = {
  id: "web:n8n",
  provider: "web",
  name: "n8n",
  comment: "",
  exec: "",
  icon: "",
  categories: [],
  source: "webapp",
  url: "https://automations.voicecommandapi.com/",
  frameUrl: "https://steve-ms-7c02.tail1af4f2.ts.net:25443/",
  localFrameUrl: "http://127.0.0.1:17804/",
  openIn: "window",
};

describe("isLocalDesktopShell", () => {
  it("is true on the TV kiosk and false on the phone (no ?tv=)", () => {
    assert.equal(isLocalDesktopShell("?tv=1", false), true);
    assert.equal(isLocalDesktopShell("?tv=0", false), false);
    assert.equal(isLocalDesktopShell("", false), false);
    assert.equal(isLocalDesktopShell("", true), true);
  });
});

describe("resolveFrameSrc", () => {
  it("gives the phone the HTTPS frame proxy, never the Access URL", () => {
    assert.equal(resolveFrameSrc(n8n), "https://steve-ms-7c02.tail1af4f2.ts.net:25443/");
    assert.notEqual(resolveFrameSrc(n8n), n8n.url);
  });

  it("does not iframe explicit tab apps", () => {
    assert.equal(resolveFrameSrc({ ...n8n, openIn: "tab" }), undefined);
  });
});
