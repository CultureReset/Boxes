import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Frame } from "./frameproxy.js";
import {
  allocateServePort,
  allocateLocalPort,
  assignMissingServePorts,
  ensureFrameForApp,
  frameUrlForFrame,
  localFrameUrlForFrame,
  PREFERRED_SERVE_PORTS,
} from "./frameassign.js";

function frame(partial: Partial<Frame> & Pick<Frame, "slug">): Frame {
  return {
    upstream: "http://127.0.0.1:3000",
    localPort: 17802,
    servePort: 0,
    path: "/",
    ...partial,
  };
}

describe("allocateServePort", () => {
  it("uses the preferred port for a known slug when free", () => {
    assert.equal(allocateServePort(new Set(), "rakazo"), 40443);
    assert.equal(allocateServePort(new Set(), "twenty-crm"), 26443);
  });

  it("skips a preferred port that is already taken and picks the next free *443", () => {
    const used = new Set([40443, 20443, 23443, 24443, 25443, 26443, 27443, 29443, 30443, 31443, 32443, 33443, 34443, 35443, 36443, 37443, 38443, 39443, 41443]);
    // Preferred 40443 is taken, so fall through to the first free *443 in the series (21443 is a gap).
    assert.equal(allocateServePort(used, "rakazo"), 21443);
  });

  it("assigns the first free *443 for an unknown slug", () => {
    assert.equal(allocateServePort(new Set(), "brand-new"), 20443);
    assert.equal(allocateServePort(new Set([20443, 21443]), "brand-new"), 22443);
  });
});

describe("allocateLocalPort", () => {
  it("starts at 17801 and skips used ports", () => {
    assert.equal(allocateLocalPort(new Set()), 17801);
    assert.equal(allocateLocalPort(new Set([17801, 17802, 17804])), 17803);
  });
});

describe("assignMissingServePorts", () => {
  it("fills servePort 0 and leaves existing ports alone", () => {
    const list = [
      frame({ slug: "twenty-crm", servePort: 26443, localPort: 17802 }),
      frame({ slug: "rakazo", servePort: 0, localPort: 17818 }),
      frame({ slug: "notes", servePort: 0, localPort: 17812 }),
    ];
    const { list: next, changed } = assignMissingServePorts(list);
    assert.equal(changed, true);
    assert.equal(next[0].servePort, 26443);
    assert.equal(next[1].servePort, PREFERRED_SERVE_PORTS.rakazo);
    assert.equal(next[2].servePort, PREFERRED_SERVE_PORTS.notes);
    assert.equal(next[0].upstream, list[0].upstream);
  });

  it("is a no-op when every servePort is already set", () => {
    const list = [frame({ slug: "twenty-crm", servePort: 26443 })];
    const { list: next, changed } = assignMissingServePorts(list);
    assert.equal(changed, false);
    assert.equal(next[0].servePort, 26443);
  });
});

describe("ensureFrameForApp", () => {
  it("creates a new frame with free ports for a brand-new slug", () => {
    const existing = [frame({ slug: "twenty-crm", servePort: 26443, localPort: 17802 })];
    const { list, frame: f, changed } = ensureFrameForApp(existing, "my-new-app", {
      url: "https://notes.example.com/",
    });
    assert.equal(changed, true);
    assert.equal(list.length, 2);
    assert.equal(f.slug, "my-new-app");
    assert.equal(f.upstream, "https://notes.example.com/");
    assert.equal(f.localPort, 17801);
    assert.equal(f.servePort, 20443);
    assert.equal(f.path, "/");
    assert.equal(existing.length, 1); // original list not mutated
  });

  it("only fills servePort on an existing row, keeping its upstream", () => {
    const existing = [frame({ slug: "rakazo", servePort: 0, localPort: 17818, upstream: "http://127.0.0.1:45173" })];
    const { frame: f, changed } = ensureFrameForApp(existing, "rakazo", { url: "https://rakazo.voicecommandapi.com/" });
    assert.equal(changed, true);
    assert.equal(f.servePort, 40443);
    assert.equal(f.localPort, 17818);
    assert.equal(f.upstream, "http://127.0.0.1:45173");
  });
});

describe("frame URLs", () => {
  it("advertises no Tailscale frame URL by default (retired 2026-11-12)", () => {
    const f = frame({ slug: "rakazo", servePort: 40443, localPort: 17818, path: "/" });
    delete process.env.NODEOS_FRAME_SAME_ORIGIN;
    assert.equal(frameUrlForFrame(f), undefined);
    process.env.NODEOS_FRAME_TAILSCALE = "1";
    try { assert.equal(frameUrlForFrame(f), "https://steve-ms-7c02.tail1af4f2.ts.net:40443/"); }
    finally { delete process.env.NODEOS_FRAME_TAILSCALE; }
    assert.equal(localFrameUrlForFrame(f), "http://127.0.0.1:17818/");
    assert.equal(frameUrlForFrame({ ...f, servePort: 0 }), undefined);
  });

  it("uses the same-origin path when NODEOS_FRAME_SAME_ORIGIN=1", () => {
    process.env.NODEOS_FRAME_SAME_ORIGIN = "1";
    try {
      const f = frame({ slug: "rakazo", servePort: 40443, path: "/" });
      assert.equal(frameUrlForFrame(f), "/frame/rakazo/");
    } finally {
      delete process.env.NODEOS_FRAME_SAME_ORIGIN;
    }
  });
});
