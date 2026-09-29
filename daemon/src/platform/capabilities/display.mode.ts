import type { Capability } from "../capabilities.js";
import { getLayout, setLayout } from "../../modules/layout.js";

/**
 * Switching what the TV looks like, from anywhere.
 *
 * The shell already has three faces in screens/homes/ — LivingHome,
 * CinemaHome, DashboardHome — and worlds.ts already stores which one is
 * active as `look`. What was missing was any way to change it that wasn't
 * clicking through settings on the TV itself.
 *
 * Now it's a capability, which means it works from the phone, from a text,
 * from an agent, or spoken at the box. setLayout emits on the event bus, so
 * the screen changes live — no refresh, no restart.
 *
 * The names people actually use are mapped to the looks the code uses. Say
 * "magic mirror" and you get the living look; nobody should have to know the
 * internal word for it.
 */

type Look = "dashboard" | "living" | "cinema";

// What a person says -> what the shell calls it.
const MODES: Record<string, { look: Look; says: string }> = {
  mirror:    { look: "living",    says: "Magic mirror — clock, weather, the ambient one." },
  magic:     { look: "living",    says: "Magic mirror — clock, weather, the ambient one." },
  living:    { look: "living",    says: "Magic mirror — clock, weather, the ambient one." },
  ambient:   { look: "living",    says: "Magic mirror — clock, weather, the ambient one." },

  jarvis:    { look: "dashboard", says: "Jarvis — the working dashboard." },
  dashboard: { look: "dashboard", says: "Jarvis — the working dashboard." },
  work:      { look: "dashboard", says: "Jarvis — the working dashboard." },

  cinema:    { look: "cinema",    says: "Cinema — big and dark." },
  tv:        { look: "cinema",    says: "Cinema — big and dark." },
  movie:     { look: "cinema",    says: "Cinema — big and dark." },
};

const FRIENDLY: Record<Look, string> = {
  living: "magic mirror",
  dashboard: "Jarvis",
  cinema: "cinema",
};

function resolve(said: string): { look: Look; says: string } | null {
  const want = said.toLowerCase().trim();
  if (MODES[want]) return MODES[want];
  // "put it on the magic mirror" — find any known word inside the sentence.
  for (const [key, val] of Object.entries(MODES)) {
    if (want.includes(key)) return val;
  }
  return null;
}

export default [
  {
    key: "display.mode.read",
    summary: "Which face the screen is showing.",
    phrases: [
      "what mode is the screen in",
      "what is the tv showing",
      "which look is it on",
      "what screen mode",
    ],
    readOnly: true,
    run: async () => {
      const l = await getLayout();
      return { ok: true, look: l.look, mode: FRIENDLY[l.look as Look] ?? l.look };
    },
  },

  {
    key: "display.mode.set",
    summary: "Switch the screen between the magic mirror, Jarvis and cinema.",
    phrases: [
      "switch to magic mirror",
      "show the magic mirror",
      "switch to jarvis",
      "show jarvis",
      "switch to cinema",
      "cinema mode",
      "change the screen mode",
      "change the look",
    ],
    slots: { mode: "text" },
    // Changes what's on screen. Reversible and harmless, but it is a write.
    readOnly: false,
    run: async (slots: Record<string, string>) => {
      const said = (slots.mode ?? "").trim();
      if (!said) {
        return {
          ok: false,
          message: "Which one? Magic mirror, Jarvis, or cinema.",
          options: ["magic mirror", "jarvis", "cinema"],
        };
      }

      const hit = resolve(said);
      if (!hit) {
        return {
          ok: false,
          message: `Don't know a mode called "${said}".`,
          options: ["magic mirror", "jarvis", "cinema"],
        };
      }

      // setLayout emits on the bus, so the shell repaints without a reload.
      const next = await setLayout({ look: hit.look });
      return { ok: true, look: next.look, mode: FRIENDLY[hit.look], said: hit.says };
    },
  },
] satisfies Capability[];
