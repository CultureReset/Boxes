import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nativeLaunchId, effectiveOpenMode, resolveFrameSrc, planLaunch, type LaunchApp } from "./native-open.js";

const desktop = { localDesktop: true, hostname: "steve-ms-7c02.tail1af4f2.ts.net" };
const phone = { localDesktop: false, hostname: "steve-ms-7c02.tail1af4f2.ts.net" };
const loop = { localDesktop: true, hostname: "127.0.0.1" };

function web(partial: Partial<LaunchApp> & Pick<LaunchApp, "id">): LaunchApp {
  return {
    provider: "web",
    frameUrl: "https://steve-ms-7c02.tail1af4f2.ts.net:25443/",
    localFrameUrl: "http://127.0.0.1:17804/",
    url: "https://automations.voicecommandapi.com/",
    ...partial,
  };
}

describe("nativeLaunchId", () => {
  it("uses nativeApp for any tile, and has no hardcoded slugs", () => {
    assert.equal(nativeLaunchId({ id: "web:notes", nativeApp: "linux:appflowy" }), "linux:appflowy");
    assert.equal(nativeLaunchId({ id: "web:other", nativeApp: "linux:gimp" }), "linux:gimp");
    // Without nativeApp, Notes is not special-cased.
    assert.equal(nativeLaunchId({ id: "web:notes", openIn: "frame" }), undefined);
    assert.equal(nativeLaunchId({ id: "linux:appflowy" }), undefined);
    assert.equal(nativeLaunchId({ id: "linux:appflowy", nativeApp: "linux:appflowy" }), undefined);
  });
});

describe("effectiveOpenMode", () => {
  it("lets config override a stale saved copy", () => {
    assert.equal(effectiveOpenMode("native", "frame"), "native");
    assert.equal(effectiveOpenMode(undefined, "frame"), "frame");
    assert.equal(effectiveOpenMode("tab", undefined), "tab");
  });
});

describe("planLaunch — one rule for every tile", () => {
  it("native Linux apps: maximize on the local desktop, stream only when remote", () => {
    const app = { id: "linux:appflowy", provider: "linux" };
    assert.deepEqual(planLaunch(app, desktop), { action: "native", nativeId: "linux:appflowy", stream: false });
    assert.deepEqual(planLaunch(app, phone), { action: "native", nativeId: "linux:appflowy", stream: true });
  });

  it("android apps follow the same native rule", () => {
    const app = { id: "android:com.whatsapp", provider: "android" };
    assert.equal(planLaunch(app, desktop).stream, false);
    assert.equal(planLaunch(app, phone).stream, true);
    assert.equal(planLaunch(app, desktop).action, "native");
  });

  it("a web tile with nativeApp launches that OS app, not a frame", () => {
    const notes = web({ id: "web:notes", openIn: "native", nativeApp: "linux:appflowy" });
    assert.deepEqual(planLaunch(notes, desktop), { action: "native", nativeId: "linux:appflowy", stream: false });
    assert.deepEqual(planLaunch(notes, phone), { action: "native", nativeId: "linux:appflowy", stream: true });
  });

  it("web tiles with a frame proxy (n8n, CRM, Rakazo, POS, …) open that frame, locally and remotely", () => {
    for (const id of ["web:n8n", "web:twenty-crm", "web:crm2", "web:rakazo", "web:pos", "web:paperclip", "web:openjarvis", "web:kamra", "web:tickets", "web:supabase"]) {
      const app = web({ id });
      const local = planLaunch(app, desktop);
      const remote = planLaunch(app, phone);
      assert.equal(local.action, "frame", id);
      assert.equal(remote.action, "frame", id);
      assert.equal(local.url, app.frameUrl);
      assert.equal(local.stream, false);
      assert.equal(remote.stream, false);
    }
  });

  it("on loopback, the frame uses the local door-proxy so the session cookie is sent", () => {
    const app = web({ id: "web:n8n" });
    assert.equal(planLaunch(app, loop).url, app.localFrameUrl);
  });

  it("tiles marked tab still use the door-gated frame once you are in NODE, not a raw Access URL", () => {
    const litellm = web({
      id: "web:litellm",
      openIn: "tab",
      frameUrl: "https://steve-ms-7c02.tail1af4f2.ts.net:23443/ui/",
      localFrameUrl: "http://127.0.0.1:17805/ui/",
      url: "https://api.voicecommandapi.com/ui/",
    });
    const plan = planLaunch(litellm, desktop);
    assert.equal(plan.action, "frame");
    assert.equal(plan.url, litellm.frameUrl);
    assert.notEqual(plan.url, litellm.url);
  });

  it("a web tile with no proxy falls back to a tab", () => {
    const app = { id: "web:loose", provider: "web", url: "https://example.com" };
    assert.deepEqual(planLaunch(app, desktop), { action: "tab", url: "https://example.com", stream: false });
  });
});

describe("resolveFrameSrc", () => {
  it("never returns a frame when a nativeApp is set", () => {
    const notes = web({ id: "web:notes", nativeApp: "linux:appflowy", openIn: "native" });
    assert.equal(resolveFrameSrc(notes, desktop.hostname), undefined);
  });
});
