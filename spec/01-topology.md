# 01 — Topology

Five planes. A thing belongs to exactly one, and what may cross between them is
fixed.

## 1. Doors

Where a person arrives. A phone call, a text, WhatsApp, Telegram, Discord, the
TV in the dining room, the owner's dashboard.

A door does one job: turn an arrival into `{ said, channel, who }` and hand it
up. A door holds no capability, no data and no model. OpenClaw is a door — a
very good one, fifty channels wide — and calling it anything more is the
mistake this design exists to avoid.

**May cross upward:** the sentence, the channel, an identity if the channel
carries one.
**May cross downward:** an answer to say back.

## 2. Orchestrator

OpenJarvis. One per box. Holds the conversation, holds the capability list, and
is the only plane permitted to touch business data.

It answers in this order:

1. **Router.** Declared phrases, matched deterministically. No model. This is
   most traffic and it answers in milliseconds.
2. **Small local model.** Chooses a capability key from the list, the capability
   runs for real, the model writes one line *from the result*. It never
   produces a figure because it has nothing to invent from until a capability
   has returned.
3. **The cage.** Only when 1 and 2 both come back with nothing.
4. **UNROUTED.** A correct and expected answer. Logged, because every UNROUTED
   sentence is a phrase the router should have declared.

Runs with the network unplugged at steps 1, 2 and 4.

## 3. The cage

A bigger model, beside the orchestrator, not above it. Reads a sentence.
Returns one key from a closed set. Full contract in `02-the-cage.md`.

**May cross upward:** one value from a menu the orchestrator supplied, or NONE.
**May cross downward:** the sentence, and the menu. Nothing else. Never a
capability result, never a row, never a figure.

## 4. Runtimes

Where work actually happens. OpenClaw for channel work, Hermes for server-side
jobs that run long and learn, the NODE daemon for anything on the box itself,
and whatever comes next.

Each publishes an Agent Card (`03-agent-card.md`) saying what it is good at.
Each reports to the trace bus. Each holds only the capabilities the catalog
granted its installed products.

**Execution happens here, not in the orchestrator.** The orchestrator decides
and dispatches; a Hermes job runs Hermes-side and reports up. If every job ran
through the orchestrator, a 3B model on a mini-PC would be the queue for the
entire estate, and the whole estate would stop when it did.

## 5. Catalog

`cybercheck-marketplace`. Publishers, products, categories, product_versions,
releases — with declared `permissions`, `capabilities`, `events`, `surfaces`,
`bindings`, `runtime_requirements`, `install_requirements`, `pricing`.

`runtime_requirements` is what makes the tree branch: a product declares which
runtime it needs, and the catalog does not otherwise care. That is why a fourth
runtime can be added in a year without touching the trunk.

The catalog is the trunk. Not OpenJarvis. A trunk that runs a model is a trunk
that can be down.

## What crosses, in one table

| From → To | Carries | Never carries |
|---|---|---|
| Door → Orchestrator | sentence, channel, identity | capabilities |
| Orchestrator → Cage | sentence, menu of keys | data, results, figures |
| Cage → Orchestrator | one key, or NONE | free text, arguments, plans |
| Orchestrator → Runtime | capability + validated args | anything the catalog did not grant |
| Runtime → Trace bus | the envelope in `04` | payloads, values, figures |
| Catalog → Runtime | grants | data |
