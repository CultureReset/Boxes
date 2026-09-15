# 04 — The trace bus

One funnel. Every door, every runtime, every capability call reports the same
envelope to the same place.

This is the rule that already earns its keep elsewhere in the estate: a single
funnel is what makes an event stream *complete* rather than whatever each
component remembered to log. Federated traces from four runtimes, each with its
own shape, would be worth nothing.

## The envelope

```json
{
  "trace_id":    "01J...",
  "span_id":     "01J...",
  "parent_id":   "01J...",

  "ts":          "2026-09-15T18:04:11.204Z",
  "runtime":     "node-daemon",
  "agent":       "booking",
  "door":        "phone",

  "stage":       "router | small | cage | dispatch | capability | phrase",
  "said_hash":   "sha256:...",
  "said_shape":  "what time do you <verb> <day>",

  "chose":       "bookings.today",
  "chose_from":  14,
  "outcome":     "ok | unrouted | refused | error | timeout",

  "latency_ms":  38,
  "tokens_in":   0,
  "tokens_out":  0,
  "energy_mj":   null,

  "error_code":  null
}
```

## What is deliberately not in it

There is no field for a value. No `result`, no `rows`, no `answer`, no `args`,
no `said` in the clear.

That is not an oversight and it is not squeamishness about PII, though it helps
there too. **The learning loop reads this bus and only this bus.** A schema that
cannot express a figure is a loop that cannot learn a figure. The constraint in
`05-learning.md` is enforced here, in the shape of the record, rather than by a
rule somebody has to remember.

- `said_hash` lets you count repeats without storing the sentence.
- `said_shape` is the sentence with content words masked — enough to cluster
  "what time do you close Sunday" with "what time do you open Monday" and learn
  a missing phrase pattern, not enough to learn that Sunday is 11 to 10.
- `chose_from` is the menu size at decision time, so a routing accuracy figure
  means something.

If you later need a payload for debugging, it goes to a **separate**, short-
retention store that the learning loop has no read path to. Not this bus.

## Required of every runtime

A runtime that does not report is not installable. This is a catalog
requirement, in `install_requirements`, checked at publish time — not a
convention.

Minimum: one span per inbound sentence, one per dispatch, one per capability
call, each carrying `trace_id` and `outcome`.

## What it buys

- **Routing accuracy** — `chose` vs. what actually satisfied the caller.
- **Unrouted rate**, per door and per business. The single most useful number
  you have: every point it falls is a call the model never has to be fast
  enough for.
- **Latency per stage, per engine.** This is how the CPU-versus-Vulkan argument
  gets settled with a measurement instead of an opinion, and why `energy_mj` is
  in the envelope even though nothing fills it yet.
- **Cage hit rate** — how often steps 1 and 2 both failed. If this climbs, the
  router is rotting.
