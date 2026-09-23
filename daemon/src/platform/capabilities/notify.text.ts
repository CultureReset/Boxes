import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Capability } from "../capabilities.js";

/**
 * Texting the owner, through the phone plugged into the box.
 *
 * This is the piece that makes human-in-the-loop real. An agent that stops and
 * waits is useless if nobody knows it stopped. It has to reach you wherever
 * you are, and the one channel that always does is a text.
 *
 * No Twilio, no A2P registration, no carrier account. The phone on the USB
 * cable has a SIM and a normal plan. It sends the message the same way it
 * would if you'd typed it.
 *
 * Set NODEOS_OWNER_NUMBER to the number that should be reached.
 *
 * How it sends: an intent opens the SMS composer with the recipient and body
 * already filled, then we find the send control on the live view hierarchy and
 * tap it. Elements are located by name — text, resource-id or
 * content-description — never by written-down coordinates, because a map built
 * on pixels breaks the first time the phone is a different size.
 */

const run = promisify(execFile);
const OWNER = (process.env.NODEOS_OWNER_NUMBER ?? "").trim();

async function adb(args: string[], timeout = 20_000): Promise<string> {
  const { stdout } = await run("adb", args, { timeout, maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

async function attached(): Promise<string[]> {
  try {
    const out = await adb(["devices"], 5_000);
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

interface Node {
  text: string;
  id: string;
  desc: string;
  clickable: boolean;
  center: { x: number; y: number } | null;
}

function parseNodes(xml: string): Node[] {
  const out: Node[] = [];
  const re = /<node\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const a: Record<string, string> = {};
    const ar = /([\w-]+)="([^"]*)"/g;
    let x: RegExpExecArray | null;
    while ((x = ar.exec(m[1])) !== null) a[x[1]] = x[2];

    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(a.bounds ?? "");
    out.push({
      text: a.text ?? "",
      id: a["resource-id"] ?? "",
      desc: a["content-desc"] ?? "",
      clickable: a.clickable === "true",
      center: b
        ? { x: Math.round((+b[1] + +b[3]) / 2), y: Math.round((+b[2] + +b[4]) / 2) }
        : null,
    });
  }
  return out;
}

async function dump(): Promise<Node[]> {
  let xml = await adb(["exec-out", "uiautomator", "dump", "/dev/tty"]);
  if (!xml.includes("<node")) {
    await adb(["shell", "uiautomator", "dump", "/sdcard/window_dump.xml"]);
    xml = await adb(["shell", "cat", "/sdcard/window_dump.xml"]);
  }
  return parseNodes(xml);
}

/** The send control, by any of the names the Messages apps give it. */
function findSend(nodes: Node[]): Node | null {
  const names = ["send", "send message", "send sms"];
  for (const n of nodes) {
    const fields = [n.text, n.desc, n.id].map((f) => f.toLowerCase());
    if (fields.some((f) => names.includes(f.trim()))) return n.center ? n : null;
  }
  for (const n of nodes) {
    if (!n.clickable || !n.center) continue;
    const fields = [n.text, n.desc, n.id].map((f) => f.toLowerCase());
    if (fields.some((f) => f.includes("send"))) return n;
  }
  return null;
}

async function sendText(to: string, body: string) {
  const devices = await attached();
  if (!devices.length) {
    return { ok: false, message: "No phone connected, so nothing could be sent." };
  }

  // Compose with the recipient and body already in place.
  await adb([
    "shell", "am", "start",
    "-a", "android.intent.action.SENDTO",
    "-d", `sms:${to}`,
    "--es", "sms_body", body,
    "--ez", "exit_on_sent", "true",
  ]);
  await new Promise((r) => setTimeout(r, 1500));

  const nodes = await dump();
  const send = findSend(nodes);
  if (!send?.center) {
    return {
      ok: false,
      message: "Composer opened but I couldn't find the send button.",
      // Say what IS on screen. A failure that doesn't help is wasted.
      onScreen: nodes.map((n) => n.text || n.desc).filter(Boolean).slice(0, 20),
    };
  }

  await adb(["shell", "input", "tap", String(send.center.x), String(send.center.y)]);
  await new Promise((r) => setTimeout(r, 800));

  return { ok: true, to, chars: body.length };
}

export default [
  {
    key: "notify.text",
    summary: "Text the owner through the phone plugged into this box.",
    phrases: ["text me", "send me a text", "message me", "let me know by text"],
    slots: { body: "text", to: "text" },
    // Reaches a human. Never something a model should fire off on its own.
    readOnly: false,
    agentSafe: false,
    run: async (slots: Record<string, string>) => {
      const body = (slots.body ?? "").trim();
      const to = (slots.to ?? OWNER).trim();

      if (!body) return { ok: false, message: "Nothing to send." };
      if (!to) {
        return {
          ok: false,
          message: "No number set. Put NODEOS_OWNER_NUMBER in the environment.",
        };
      }
      return sendText(to, body.slice(0, 600));
    },
  },

  {
    key: "notify.test",
    summary: "Check the box can reach the owner by text.",
    phrases: ["can you text me", "test my notifications", "test texting"],
    readOnly: false,
    agentSafe: false,
    run: async () => {
      if (!OWNER) return { ok: false, message: "NODEOS_OWNER_NUMBER isn't set." };
      return sendText(OWNER, "Your box can reach you. This is the channel an agent uses when it needs you.");
    },
  },
] satisfies Capability[];
