import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nativeLaunchId, effectiveOpenMode, planLaunch, launchHref, type LaunchApp } from "./native-open.js";

const desktop = { localDesktop: true };
const phone = { localDesktop: false };

/** /api/apps still carries frame-proxy fields; the launcher must ignore them. */
type ApiTile = LaunchApp & { frameUrl?: string; localFrameUrl?: string };
function web(partial: Partial<ApiTile> & Pick<ApiTile, "id">): ApiTile {
  return {
    provider: "web",
    frameUrl: "https://steve-ms-7c02.tail1af4f2.ts.net:25443/",
    localFrameUrl: "http://127.0.0.1:17804/",
    url: "https://automations.voicecommandapi.com/",
    ...partial,
  };
}

/** Every web tile in config/webapps.json with its public Cloudflare hostname. */
const CF_TILES: [string, string, string?][] = [
  ["web:openjarvis", "https://jarvis.voicecommandapi.com/"],
  ["web:rakazo", "https://rakazo.voicecommandapi.com/"],
  ["web:twenty-crm", "https://crm.voicecommandapi.com/"],
  ["web:paperclip", "https://paperclip.voicecommandapi.com/"],
  ["web:n8n", "https://automations.voicecommandapi.com/", "window"],
  ["web:desktop", "https://desktop.voicecommandapi.com/"],
  ["web:openclaw", "https://openclaw.voicecommandapi.com/"],
  ["web:uptime-kuma", "https://status.voicecommandapi.com/"],
  ["web:navidrome", "https://music.voicecommandapi.com/"],
  ["web:searxng", "https://search.voicecommandapi.com/"],
  ["web:llama-swap", "https://llm.voicecommandapi.com/ui"],
  ["web:supabase", "https://supabase.voicecommandapi.com/"],
  ["web:pos", "https://pos.voicecommandapi.com/"],
  ["web:tickets", "https://tickets.voicecommandapi.com/"],
  ["web:kamra", "https://kamra.voicecommandapi.com/"],
  ["web:litellm", "https://api.voicecommandapi.com/ui/", "tab"],
  ["web:mcp", "https://hub.voicecommandapi.com/", "tab"],
];

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

  it("every web tile is a top-level link to its Cloudflare hostname, on every display", () => {
    for (const [id, url, openIn] of CF_TILES) {
      const app = web({ id, url, openIn });
      for (const ctx of [desktop, phone]) {
        const plan = planLaunch(app, ctx);
        assert.deepEqual(plan, { action: "navigate", url, stream: false }, id);
        assert.notEqual(plan.url, app.frameUrl, id);
        assert.notEqual(plan.url, app.localFrameUrl, id);
        assert.match(plan.url!, /^https:\/\/[a-z0-9-]+\.voicecommandapi\.com\//, id);
      }
      assert.equal(launchHref(app), url, id);
    }
  });

  it("never plans a frame for a web tile, whatever its old openIn", () => {
    for (const openIn of [undefined, "frame", "tab", "window"]) {
      const app = web({ id: "web:n8n", openIn });
      assert.equal(planLaunch(app, desktop).action, "navigate");
      assert.equal(planLaunch(app, phone).action, "navigate");
      assert.equal(planLaunch(app, desktop).url, "https://automations.voicecommandapi.com/");
    }
  });

  it("a web tile with no url plans navigate with no target (the shell reports it)", () => {
    assert.deepEqual(planLaunch({ id: "web:loose", provider: "web" }, phone), { action: "navigate", url: undefined, stream: false });
  });
});

describe("launchHref", () => {
  it("is undefined for native tiles, so they stay buttons", () => {
    assert.equal(launchHref(web({ id: "web:notes", nativeApp: "linux:appflowy", openIn: "native" })), undefined);
    assert.equal(launchHref({ id: "linux:grok-bot", provider: "linux" }), undefined);
    assert.equal(launchHref({ id: "android:com.facebook.katana", provider: "android" }), undefined);
  });
});
