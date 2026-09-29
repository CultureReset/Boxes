import type { Capability } from "../capabilities.js";

/**
 * A capability in its own file. This is the template.
 *
 * To add another: copy this file, change the key, the summary, the phrases and
 * what run() does. Rebuild, restart. NOTHING ELSE IN THE REPO IS EDITED.
 *
 * Same shape as the ones still in the compiled array — same interface, same
 * rules. The only difference is where it lives.
 *
 * Try it: say "say hello" to the box.
 */

const capability: Capability = {
  key: "box.hello",

  summary: "Proves the capability folder is being read.",

  // Every word of a phrase must appear in what was said. No model involved.
  // More phrasings cost nothing — add them freely.
  phrases: ["say hello", "hello box", "are you there", "is the loader working"],

  // Reads nothing, changes nothing.
  readOnly: true,

  run: async () => ({
    ok: true,
    message: "Loaded from platform/capabilities/, not from the array.",
    at: new Date().toISOString(),
  }),
};

export default capability;
