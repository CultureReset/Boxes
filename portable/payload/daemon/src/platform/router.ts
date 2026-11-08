import { CAPABILITIES, type Capability } from "./capabilities.js";

/**
 * The router. Deterministic, and there must not be a model in it.
 *
 * A sentence is normalised, then matched against the phrases each capability
 * declared. Best overlap wins. If nothing matches, the answer is UNROUTED —
 * which is a correct and useful answer. It means: this is a job for the shop.
 * Solve it once, declare a phrase, and every box gets it.
 */

export interface Match {
  capability: Capability;
  score: number;
  matched: string;
}

const STOP = new Set(["the", "a", "an", "my", "our", "is", "are", "do", "does", "for", "of", "to", "on", "in", "me", "i", "we", "please", "can", "you"]);

function normalise(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

export function route(sentence: string): Match | null {
  const words = normalise(sentence);
  if (!words.length) return null;
  const set = new Set(words);

  let best: Match | null = null;
  for (const capability of CAPABILITIES) {
    for (const phrase of capability.phrases) {
      const pw = normalise(phrase);
      if (!pw.length) continue;
      const hits = pw.filter((w) => set.has(w)).length;
      if (hits === 0) continue;
      // Every word of the declared phrase must be present, or it is not that
      // phrase. "what is open" must not match "what is on the menu".
      if (hits < pw.length) continue;
      const score = pw.length + (sentence.toLowerCase().includes(phrase) ? 1 : 0);
      if (!best || score > best.score) best = { capability, score, matched: phrase };
    }
  }
  return best;
}

/** What the box says when it does not recognise a sentence. Not an apology. */
export const UNROUTED =
  "I do not know how to do that yet. It has been written down — once it is added, every box gets it.";
