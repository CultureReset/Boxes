import { kernelStatus } from "../modules/kernel.js";
import { ask as kernelAsk } from "../modules/ask.js";
import { answer, type Answer } from "./answer.js";

/**
 * Every door a sentence comes through (the ask bar, voice, an inbound text,
 * an agent prompt) calls this, so they cannot diverge.
 *
 *   1  the kernel, when it is running: the owner's rules decide, and ASK
 *      becomes a text to the owner's phone
 *   2  otherwise, or when the kernel does not know the sentence, this box's
 *      own read-only answers (menu, hours, bookings…); anything that would
 *      change something is refused here (platform/gate.ts)
 */
export interface Decided extends Answer {
  via: "kernel" | "local";
  state?: string;
}

export async function decide(text: string, resource = "default"): Promise<Decided> {
  const k = await kernelStatus();
  if (k.available) {
    try {
      const r = await kernelAsk(text, resource);
      if (r.routed) {
        const ok = r.state !== "failed";
        return { via: "kernel", lines: [r.reply], ok, capability: r.capability, state: r.state };
      }
    } catch {
      /* the kernel went away mid-sentence: answer locally, read-only */
    }
  }
  return { via: "local", ...(await answer(text)) };
}
