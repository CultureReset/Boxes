import type { Capability } from "./capabilities.js";

/**
 * What this box may do on its own, without the kernel's rules.
 *
 * The kernel (NEXT GENT core) holds the owner's ALLOW / DENY / ASK rules and
 * the approval-by-text loop. Anything that changes the world goes through it.
 * The daemon's own capabilities run locally only when that cannot matter:
 *
 *   a sentence (typed, spoken, texted)   read-only capabilities only
 *   a button on this screen              anything except the phone and the SIM
 *
 * The phone and the SIM (phone.*, notify.*) are never driven from here: a tap
 * or a text on the owner's line is exactly what the rules exist for, and a
 * second sender on the same SIM would bypass them.
 */

export type Door = "sentence" | "button";

const KERNEL_ONLY = /^(phone|notify)\./;

/** Null when it may run here; otherwise the sentence that says why not. */
export function refusal(cap: Capability, door: Door, kernelUp = false): string | null {
  if (KERNEL_ONLY.test(cap.key) && !cap.readOnly) {
    return kernelUp
      ? "That uses the phone, and your box's rules did not recognise how it was worded, so nothing was done. Try it the way the box words it, for example \"open display settings\"."
      : "That uses the phone, so it goes through your rules and approvals. Ask it once the box's core is running.";
  }
  if (door === "sentence" && !cap.readOnly) {
    return kernelUp
      ? "That changes something, and your box's rules did not recognise how it was worded, so nothing was done. Tap it on the screen instead."
      : "That changes something, so it goes through your rules. Tap it on the screen, or ask again once the box's core is running.";
  }
  return null;
}
