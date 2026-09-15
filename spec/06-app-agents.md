# 06 — One agent per app

A Facebook agent. A Toast agent. A Square agent. A Google Business agent. Each
good at one surface, reusable across every business that uses it.

This is the right unit, for a reason worth being explicit about: **the estate
has no AppMaps.** Not one, anywhere, across 136 repositories — and an app agent
is what an AppMap becomes when you give it a runtime.

## What an app agent is made of

Four things, all of which you already have schema for and none of which are
currently wired to each other:

1. **The AppMap** — the surface as data. Screens, fields, actions,
   preconditions, what confirms success, what failure looks like. Data, not
   code, which is what makes the agent reusable rather than rewritten.
2. **The Agent Card** — `/.well-known/agent-card.json`, the A2A declaration of
   which skills this one exposes.
3. **The grants** — which capabilities it is allowed to hold, issued by the
   catalog, checked against the card at load.
4. **The catalog product** — publisher, versions, releases, pricing.

## Read and write are different products

A Toast agent that *reads* tonight's covers and a Toast agent that *changes*
a price are not the same thing with a flag. They are separate products with
separate grants, and the second one needs a confirmation path.

The estate's own earlier position, from a briefing six days older than the
documents that replaced it, was *"official endpoints only"* and *"owner yes on
every write."* The newer documents say remote control is permissionless
integration. **That contradiction is still unresolved and it is yours to
settle** — but note that it only ever bites on the write half. Every read-side
app agent is identical under either answer, so there is no reason to wait
before building those.

## Build order

Read-side first, across the apps with real endpoints — Google Business, Toast,
Square, Facebook. Each one:

- an AppMap describing the surface
- read-only grants
- a card
- a catalog product

Write-side second, once the confirmation model is settled, as separate products
with separate grants.

## Why this scales the way the tree does

An app agent does not care which runtime executes it. A Facebook agent can run
on OpenClaw when the work is a message, on Hermes when the work is long, on the
daemon when the work is local — because `runtime_requirements` says which, and
nothing above the catalog had to know.

That is the same property that lets someone else's agent join later. The unit is
small, declared and gated, so an outside developer builds one without your SDK,
your source, or your permission — and it still cannot hold a capability you did
not grant.
