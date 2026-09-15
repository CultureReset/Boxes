# 02 — The cage

A second model, bigger than the one that ships on the box, sitting beside the
orchestrator. Its only job is to understand a sentence the router and the small
model both failed on, and say which agent or capability should have handled it.

It never touches data. That is not a policy — it is the interface.

## The contract

**In:**

```json
{
  "said": "<the caller's sentence, verbatim>",
  "menu": [
    { "key": "bookings.today",   "summary": "Bookings for today." },
    { "key": "menu.read",        "summary": "The menu, its sections and items." },
    { "key": "agent:hermes.seo", "summary": "Long-running search work." }
  ]
}
```

**Out:**

```json
{ "choice": "bookings.today" }
```

or

```json
{ "choice": "NONE" }
```

That is the entire surface. No arguments. No plan. No prose. No tool calls.

## Enforcement

The orchestrator does not trust the cage's output — it **validates** it:

```
const hit = menu.find(m => m.key === returned);
const choice = hit ? hit.key : "NONE";
```

Anything not literally in the menu it just sent becomes NONE. This is the same
shape the daemon's existing `choose()` already uses, with a bigger model and a
wider menu.

## Why this holds under attack

The cage is the component reading text written by a stranger. Assume the
stranger is trying to steer it — because eventually one will be.

The worst a successful injection achieves is **making the cage name a different
key from the menu the orchestrator already trusted.** It cannot:

- invent a capability — validation rejects anything off-menu
- produce a figure — nothing it returns is ever spoken; the key selects a
  capability, the capability runs for real, and the small local model phrases
  the result
- reach data — it is never sent any, and it has no network and no tools
- escalate — the menu only ever contains what the catalog already granted

The literature calls this a privileged planner with a quarantined reader. The
detail everyone gets wrong is letting the quarantined half return free text that
the privileged half then acts on — at which point the quarantined half *is* the
planner and the cage is decorative. **The output must be a value from a closed
set, or the cage is theatre.**

## What the cage must never be given

- a capability result, ever — that is the phrasing step, and it stays with the
  small local model on the box
- conversation history containing figures
- credentials, tokens, connection strings
- network access
- tools of any kind

## Where it runs

Anywhere. It is the one component in the design that may be a hosted model,
because it never sees a customer's data — only their sentence and a list of key
names. That is also what makes it affordable: a couple of hundred tokens in, one
word out, and only on sentences the first two steps already failed.

If it is unreachable, the answer is UNROUTED. The box does not stop.
