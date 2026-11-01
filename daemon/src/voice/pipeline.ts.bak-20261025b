import { answer, spoken, type Answer } from "../platform/answer.js";
import { route, UNROUTED } from "../platform/router.js";
import { BY_KEY } from "../platform/capabilities.js";
import { transcribe, model as sttModel } from "./stt.js";
import { speak, sayAloud, engine as ttsEngine, type Speech } from "./tts.js";
import * as llm from "./llm.js";
import { bus } from "../events.js";

/**
 * One way in.
 *
 * Spoken at the television, said down the phone, texted to the number, or
 * posted by a webhook — every sentence lands here. There is exactly one place
 * where a question becomes an answer, so the box cannot say one thing on the
 * phone and another on the screen.
 *
 *      text ─┐
 *     audio ─┤                      ┌─ deterministic router  (no model)
 *       SMS ─┼──►  handle()  ──────►┤
 *   webhook ─┘                      └─ small model, only when unrecognised
 *                                        │
 *                                        ▼
 *                              a capability runs for real
 *                                        │
 *                                        ▼
 *                                 spoken, or written
 */

export type Channel = "screen" | "phone" | "sms" | "webhook";

export interface Turn {
  said: string;
  reply: string;
  lines: string[];
  capability?: string;
  /** How it was resolved. Worth logging: when `model` climbs, write more phrases. */
  via: "router" | "model" | "unrouted";
  channel: Channel;
  at: string;
}

const recent: Turn[] = [];

/** Take a sentence and answer it. Text in, text out; sound is the caller's job. */
export async function handle(said: string, channel: Channel = "screen"): Promise<Turn> {
  const text = said.trim();
  const at = new Date().toISOString();
  if (!text) return record({ said, reply: "", lines: [], via: "unrouted", channel, at });

  // 1 — The router. Declared phrases only. There is no model in this path.
  const matched = route(text);
  if (matched) {
    const a: Answer = await answer(text);
    // A screen gets the list. A phone gets a sentence. Same facts either way.
    const heard = channel === "screen" ? a.lines.join(" ") : spoken(a.capability, a.data, a.lines);
    return record({ said: text, reply: heard, lines: a.lines, capability: a.capability, via: "router", channel, at });
  }

  // 2 — Unrecognised. A small model may pick a capability, which then runs for
  //     real. The model still never produces the figure.
  if (await llm.available()) {
    const { capability } = await llm.choose(text);
    const cap = capability ? BY_KEY.get(capability) : undefined;
    if (cap) {
      try {
        const data = await cap.run({});
        const line = (await llm.phrase(text, data)).trim();
        if (line) {
          return record({ said: text, reply: line, lines: [line], capability: cap.key, via: "model", channel, at });
        }
        // The model had nothing to say about real data. Fall back to the
        // deterministic presenter rather than inventing a sentence.
        const a = await answer(cap.phrases[0]);
        return record({ said: text, reply: a.lines.join(" "), lines: a.lines, capability: cap.key, via: "model", channel, at });
      } catch {
        /* fall through to unrouted */
      }
    }
  }

  // 3 — UNROUTED. A correct answer, and the most useful log line in the system.
  return record({ said: text, reply: UNROUTED, lines: [UNROUTED], via: "unrouted", channel, at });
}

/** Audio in. Transcribe, then the same path as everything else. */
export async function handleAudio(wav: Buffer, channel: Channel = "phone"): Promise<Turn & { heard: string }> {
  const heard = await transcribe(wav);
  const turn = await handle(heard, channel);
  return { ...turn, heard };
}

/** Answer out loud — the phone, or the room. */
export async function reply(turn: Turn): Promise<Speech | null> {
  return speak(turn.reply);
}

/** Say it on this machine's own speakers. Used by the screen. */
export async function replyAloud(turn: Turn): Promise<boolean> {
  return sayAloud(turn.reply);
}

function record(t: Turn): Turn {
  recent.unshift(t);
  if (recent.length > 200) recent.pop();
  bus.emit("voice", t);
  return t;
}

/** What the box has been asked lately, and how it resolved. */
export function history(limit = 50): Turn[] {
  return recent.slice(0, limit);
}

/**
 * The number that matters.
 *
 * Every sentence the router did not recognise. When this climbs, the answer is
 * to declare more phrases — not to buy a bigger model. Watching it fall is the
 * whole business.
 */
export function unroutedRate(): { total: number; unrouted: number; viaModel: number; rate: number } {
  const total = recent.length;
  const unrouted = recent.filter((t) => t.via === "unrouted").length;
  const viaModel = recent.filter((t) => t.via === "model").length;
  return { total, unrouted, viaModel, rate: total ? unrouted / total : 0 };
}

export async function voiceStatus() {
  return {
    hearing: await sttModel(),
    voice: await ttsEngine(),
    model: (await llm.available()) ? (process.env.NODEOS_LLM_MODEL ?? "qwen2.5:3b") : "none",
    ...unroutedRate(),
  };
}
