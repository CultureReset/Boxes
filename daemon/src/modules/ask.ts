import { read, act, connect } from "./kernel.js";

/**
 * A sentence said at the television becomes a task the kernel decided on.
 *
 * Nothing in this file knows what the box can do. The capabilities and the
 * phrases that reach them are read from the kernel, which is where they are
 * data on the capability itself. Declaring a new phrase is a row in the
 * kernel, not an edit here and a deploy of the shell.
 *
 * There is no model in this path. A sentence matches a phrase a capability
 * declared or it does not, and not matching is a real answer — it names the
 * phrase somebody should declare next.
 *
 * The screen never decides whether something is allowed. It submits, the
 * kernel evaluates, and what comes back is the kernel's decision including
 * being told no.
 */

export interface Capability {
  id: string;
  name: string;
  version: string;
  phrases?: string[];
  parameters: { properties: Record<string, unknown>; required: string[] };
}

/** Words that carry no routing information. Small on purpose: a stop list that
 *  grows starts swallowing meaning. */
const STOP = new Set(["the","a","an","my","our","is","are","do","does","for","of","to","on","in","me","i","we","please","can","you","it"]);

export function words(sentence: string): string[] {
  return sentence.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
}

export interface Match { capability: Capability; phrase: string; score: number }

/** Best declared phrase wins, and every word of it must be present. */
export function route(sentence: string, capabilities: Capability[]): Match | null {
  const present = new Set(words(sentence));
  if (!present.size) return null;
  const lowered = sentence.toLowerCase();
  let best: Match | null = null;
  for (const capability of capabilities) {
    for (const phrase of capability.phrases ?? []) {
      const needed = words(phrase);
      if (!needed.length || !needed.every((w) => present.has(w))) continue;
      // A phrase quoted verbatim beats one whose words merely all appear.
      const score = needed.length + (lowered.includes(phrase.toLowerCase()) ? 1 : 0);
      if (!best || score > best.score) best = { capability, phrase, score };
    }
  }
  return best;
}

export interface Answer {
  said: string;
  reply: string;
  routed: boolean;
  capability?: string;
  state?: string;
  taskId?: string;
  /** How the kernel answered, so the screen can render rather than re-parse prose. */
  task?: Record<string, unknown>;
}

/** What the box says when no declared phrase matched. Not an apology. */
export const UNROUTED =
  "I do not know how to do that yet. It has been written down — once it is added, every box gets it.";

/** Said to the owner for each state the kernel can come back with. The kernel
 *  decides; this only puts its decision into a sentence. */
function sentenceFor(state: string, result: string | null): string {
  if (state === "working") return "Working on it.";
  if (state === "authorization_required") return "That needs your approval. Check your messages.";
  if (state === "failed" && result === "policy_denied") return "You have not given me permission to do that.";
  if (state === "failed") return `That did not go through${result ? `: ${result}` : "."}`;
  if (state === "completed") return "Done.";
  return `That is ${state.replace(/_/g, " ")}.`;
}

export async function ask(said: string, resource: string): Promise<Answer> {
  const text = said.trim();
  if (!text) return { said, reply: "", routed: false };

  const handshake = await connect();
  if (!handshake.status.available) {
    return { said: text, reply: handshake.status.reason ?? "The kernel is not reachable.", routed: false };
  }

  const { items } = await read<{ items: Capability[] }>("capabilities");
  const match = route(text, items);
  if (!match) return { said: text, reply: UNROUTED, routed: false };

  const { capability } = match;
  const required = capability.parameters.required ?? [];
  if (required.length) {
    // A phrase says what the owner wants, never with which values. Guessing one
    // is the failure this whole system exists to prevent.
    return {
      said: text,
      routed: true,
      capability: capability.name,
      reply: `I can do that, but I need ${required.join(", ")}. Tell me those and I will start.`,
    };
  }

  const submitted = await act<{ id: string }>("submit", {
    capability: capability.name,
    version: capability.version,
    resource,
    parameters: {},
    expected: { asked: true },
    idempotency_key: `ask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const task = await act<{ state: string; result: string | null }>("evaluate", undefined, submitted.id);

  return {
    said: text,
    routed: true,
    capability: capability.name,
    taskId: submitted.id,
    state: task.state,
    reply: sentenceFor(task.state, task.result),
    task: task as unknown as Record<string, unknown>,
  };
}
