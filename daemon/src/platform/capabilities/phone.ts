import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Capability } from "../capabilities.js";

/**
 * The phone, as capabilities.
 *
 * The box can now see and drive a real Android plugged into it. Same approach
 * as orch/src/drivers/adb.js, which is the good version of this and should
 * eventually become a shared package both repos depend on. This file is
 * deliberately self-contained so Boxes has no cross-repo import — drop it in,
 * it works; delete it, nothing else notices.
 *
 * Elements are found by NAME — text, resource-id, or content-description —
 * read off the live view hierarchy. Coordinates come from the node that
 * matched. Nothing here writes down a pixel position, because a map built on
 * pixels breaks the first time the phone is a different size.
 *
 * No model in this file. It taps what it was told to tap.
 */

const run = promisify(execFile);
const TIMEOUT = 20_000;

async function adb(args: string[]): Promise<string> {
  const { stdout } = await run("adb", args, {
    timeout: TIMEOUT,
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

interface Node {
  text: string;
  id: string;
  desc: string;
  clickable: boolean;
  bounds: { x1: number; y1: number; x2: number; y2: number } | null;
  center: { x: number; y: number } | null;
}

/** uiautomator emits XML. One shape of document; a tolerant scrape beats a parser. */
function parseNodes(xml: string): Node[] {
  const out: Node[] = [];
  const nodeRe = /<node\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;

  while ((m = nodeRe.exec(xml)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRe = /([\w-]+)="([^"]*)"/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[1])) !== null) attrs[a[1]] = a[2];

    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attrs.bounds ?? "");
    const bounds = b
      ? { x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4] }
      : null;

    out.push({
      text: attrs.text ?? "",
      id: attrs["resource-id"] ?? "",
      desc: attrs["content-desc"] ?? "",
      clickable: attrs.clickable === "true",
      bounds,
      center: bounds
        ? {
            x: Math.round((bounds.x1 + bounds.x2) / 2),
            y: Math.round((bounds.y1 + bounds.y2) / 2),
          }
        : null,
    });
  }
  return out;
}

async function dump(): Promise<Node[]> {
  // exec-out avoids the round trip through /sdcard. Some builds ignore it.
  let xml = await adb(["exec-out", "uiautomator", "dump", "/dev/tty"]);
  if (!xml.includes("<node")) {
    await adb(["shell", "uiautomator", "dump", "/sdcard/window_dump.xml"]);
    xml = await adb(["shell", "cat", "/sdcard/window_dump.xml"]);
  }
  return parseNodes(xml);
}

/** Exact match first, then contains. Text, then description, then id. */
function findNode(nodes: Node[], name: string): Node | null {
  const want = name.toLowerCase().trim();
  const fields = (n: Node) => [n.text, n.desc, n.id];

  for (const n of nodes) {
    if (fields(n).some((f) => f.toLowerCase() === want)) return n;
  }
  for (const n of nodes) {
    if (fields(n).some((f) => f && f.toLowerCase().includes(want))) return n;
  }
  return null;
}

/** The thing you can actually tap is often a parent of the thing you can see. */
function tappable(nodes: Node[], node: Node): Node {
  if (node.clickable || !node.bounds) return node;
  const b = node.bounds;
  const wrapping = nodes.filter(
    (n) =>
      n.clickable &&
      n.bounds &&
      n.bounds.x1 <= b.x1 &&
      n.bounds.y1 <= b.y1 &&
      n.bounds.x2 >= b.x2 &&
      n.bounds.y2 >= b.y2,
  );
  if (!wrapping.length) return node;
  const area = (n: Node) =>
    (n.bounds!.x2 - n.bounds!.x1) * (n.bounds!.y2 - n.bounds!.y1);
  return wrapping.sort((x, y) => area(x) - area(y))[0];
}

async function attached(): Promise<string[]> {
  try {
    const out = await adb(["devices"]);
    return out
      .split("\n")
      .slice(1)
      .map((l) => l.trim().split(/\s+/))
      .filter((p) => p[1] === "device")
      .map((p) => p[0]);
  } catch {
    return [];
  }
}

/** Every capability here needs a phone. Say so plainly rather than throwing. */
async function requirePhone(): Promise<string[] | { ok: false; message: string }> {
  const devices = await attached();
  if (devices.length) return devices;
  return {
    ok: false,
    message:
      "No phone is connected. Plug it in, unlock it, and allow USB debugging when it asks.",
  };
}

export default [
  {
    key: "phone.devices",
    summary: "Which Android phones are plugged into this box.",
    phrases: ["what phones are connected", "is my phone connected", "list phones", "phone status"],
    readOnly: true,
    run: async () => {
      const devices = await attached();
      return devices.length
        ? { ok: true, devices, count: devices.length }
        : { ok: false, devices: [], message: "Nothing plugged in, or USB debugging isn't allowed yet." };
    },
  },

  {
    key: "phone.screen",
    summary: "What is on the phone's screen right now.",
    phrases: ["what is on my phone", "read my phone screen", "whats on the phone", "phone screen"],
    readOnly: true,
    run: async () => {
      const check = await requirePhone();
      if (!Array.isArray(check)) return check;

      const nodes = await dump();
      // Only what a person would actually read.
      const visible = nodes
        .map((n) => n.text || n.desc)
        .filter((t) => t && t.trim())
        .filter((t, i, a) => a.indexOf(t) === i);

      return { ok: true, items: visible, count: visible.length };
    },
  },

  {
    key: "phone.open",
    summary: "Open an app on the phone.",
    phrases: ["open the app", "open app on phone", "launch app on phone", "start app on phone"],
    slots: { app: "text" },
    readOnly: false,
    run: async (slots: Record<string, string>) => {
      const check = await requirePhone();
      if (!Array.isArray(check)) return check;

      const app = (slots.app ?? "").trim();
      if (!app) return { ok: false, message: "Which app? Give me its package name." };

      await adb(["shell", "monkey", "-p", app, "-c", "android.intent.category.LAUNCHER", "1"]);
      await new Promise((r) => setTimeout(r, 1200));
      return { ok: true, opened: app };
    },
  },

  {
    key: "phone.tap",
    summary: "Tap something on the phone by what it says.",
    phrases: ["tap on the phone", "press on my phone", "click on the phone"],
    slots: { target: "text" },
    readOnly: false,
    run: async (slots: Record<string, string>) => {
      const check = await requirePhone();
      if (!Array.isArray(check)) return check;

      const target = (slots.target ?? "").trim();
      if (!target) return { ok: false, message: "Tap what?" };

      const nodes = await dump();
      const found = findNode(nodes, target);
      if (!found) {
        return {
          ok: false,
          message: `Nothing on screen matching "${target}".`,
          // Tell them what IS there. A failure that doesn't help is a waste.
          onScreen: nodes.map((n) => n.text || n.desc).filter(Boolean).slice(0, 20),
        };
      }

      const hit = tappable(nodes, found);
      if (!hit.center) return { ok: false, message: `"${target}" has no position on screen.` };

      await adb(["shell", "input", "tap", String(hit.center.x), String(hit.center.y)]);
      await new Promise((r) => setTimeout(r, 400));
      return { ok: true, tapped: found.text || found.desc || found.id, at: hit.center };
    },
  },
] satisfies Capability[];
