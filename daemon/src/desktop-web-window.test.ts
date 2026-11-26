import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { desktopFrameUrl, windowClassForSlug } from "./desktop-web-window.js";

describe("desktopFrameUrl", () => {
  it("prefers the HTTPS frame proxy and never returns the public Access URL", () => {
    assert.equal(
      desktopFrameUrl({
        frameUrl: "https://steve-ms-7c02.tail1af4f2.ts.net:25443/",
        localFrameUrl: "http://127.0.0.1:17804/",
        url: "https://automations.voicecommandapi.com/",
      }),
      "https://steve-ms-7c02.tail1af4f2.ts.net:25443/",
    );
  });

  it("falls back to the loopback door proxy when there is no frameUrl", () => {
    assert.equal(
      desktopFrameUrl({ localFrameUrl: "http://127.0.0.1:17804/", url: "https://automations.voicecommandapi.com/" }),
      "http://127.0.0.1:17804/",
    );
  });

  it("returns undefined rather than a Cloudflare Access hostname", () => {
    assert.equal(desktopFrameUrl({ url: "https://automations.voicecommandapi.com/" }), undefined);
  });
});

describe("windowClassForSlug", () => {
  it("names the n8n window so it can be maximized", () => {
    assert.equal(windowClassForSlug("n8n"), "nodeos-web-n8n");
  });
});
