import { CAPABILITIES } from "../platform/capabilities.js";

/**
 * The small model.
 *
 * It has one job and it is not answering. It reads a sentence the router did
 * not recognise and decides which capability, if any, would answer it. The
 * capability then runs for real. The model sees the result and writes one line
 * from it.
 *
 * THE MODEL NEVER PRODUCES A FIGURE. It has nothing to invent from until a
 * capability has run, and when none applies it is required to say so. That is
 * what makes a 3B model on a mini-PC sufficient: it is choosing and phrasing,
 * not knowing.
 *
 * Any OpenAI-compatible endpoint — Ollama, llama.cpp's server, vLLM. The box
 * ships pointed at localhost. No key, no network, no per-question cost.
 */

const BASE = process.env.NODEOS_LLM_URL ?? "http://127.0.0.1:11434/v1";
const MODEL = process.env.NODEOS_LLM_MODEL ?? "qwen2.5:3b";
const TIMEOUT_MS = 20_000;

export interface Choice {
  capability: string | null;
  /** Why, in the model's words. Logged, never shown to the owner. */
  because?: string;
}

async function chat(messages: Array<{ role: string; content: string }>, maxTokens = 120): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0, max_tokens: maxTokens, stream: false }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function available(): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/models`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Which capability would answer this? `null` is a valid and common answer. */
export async function choose(sentence: string): Promise<Choice> {
  const menu = CAPABILITIES.filter((c) => c.readOnly)
    .map((c) => `${c.key}: ${c.summary}`)
    .join("\n");

  const out = await chat(
    [
      {
        role: "system",
        content:
          "You match a question to one capability. Reply with the capability key alone, or the single word NONE. " +
          "Never explain. Never answer the question itself. Never state a fact, a time, a price or a count.\n\n" +
          `Capabilities:\n${menu}`,
      },
      { role: "user", content: sentence },
    ],
    24,
  );

  const key = out.split(/\s+/)[0]?.replace(/[^a-z0-9.]/gi, "") ?? "";
  const hit = CAPABILITIES.find((c) => c.key === key && c.readOnly);
  return { capability: hit ? hit.key : null, because: out };
}

/**
 * Turn what came back into one spoken line.
 *
 * The data is in the prompt. If a number is not in it, it cannot be in the
 * answer — and a model that tries is corrected by the caller, which compares
 * the reply against the data before it is spoken.
 */
export async function phrase(sentence: string, data: unknown): Promise<string> {
  return chat(
    [
      {
        role: "system",
        content:
          "Answer in one short spoken sentence, under 30 words, using ONLY the data given. " +
          "Every number, time and name must appear in the data. If the data does not answer the question, " +
          "say you do not have that. Do not apologise. Do not mention data, systems or lookups.",
      },
      { role: "user", content: `Question: ${sentence}\n\nData:\n${JSON.stringify(data).slice(0, 4000)}` },
    ],
    90,
  );
}
