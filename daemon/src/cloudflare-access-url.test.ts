import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCloudflareAccessUrl, accessUrlError, ACCESS_URL_RULE } from "./cloudflare-access-url.js";

describe("isCloudflareAccessUrl", () => {
  it("accepts Cloudflare Access hostnames", () => {
    assert.equal(isCloudflareAccessUrl("https://minidlna.voicecommandapi.com/"), true);
    assert.equal(isCloudflareAccessUrl("https://crawl.voicecommandapi.com/playground"), true);
    assert.equal(isCloudflareAccessUrl("https://automations.voicecommandapi.com/"), true);
  });

  it("rejects Tailscale Funnel and Serve URLs", () => {
    assert.equal(isCloudflareAccessUrl("https://steve-ms-7c02.tail1af4f2.ts.net:12443/playground"), false);
    assert.equal(isCloudflareAccessUrl("https://steve-ms-7c02.tail1af4f2.ts.net:10000"), false);
    assert.equal(isCloudflareAccessUrl("http://100.104.20.101:8200/"), false);
    assert.equal(isCloudflareAccessUrl("https://100.104.20.101/"), false);
  });

  it("rejects http, localhost, and other hosts", () => {
    assert.equal(isCloudflareAccessUrl("http://minidlna.voicecommandapi.com/"), false);
    assert.equal(isCloudflareAccessUrl("https://localhost:8200/"), false);
    assert.equal(isCloudflareAccessUrl("https://example.com/"), false);
    assert.equal(isCloudflareAccessUrl("not a url"), false);
  });

  it("explains the standing rule on reject", () => {
    assert.equal(accessUrlError("https://steve-ms-7c02.tail1af4f2.ts.net/"), ACCESS_URL_RULE);
    assert.equal(accessUrlError("https://music.voicecommandapi.com/"), null);
  });
});
