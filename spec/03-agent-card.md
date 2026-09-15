# 03 — Agent Cards

You described the cage as the thing that "understands what Jarvis is good at,
what OpenClaw is good at, what Hermes is good at." There is a standard for
exactly that and you do not have to invent it.

**A2A (Agent2Agent).** Created at Google, donated to the Linux Foundation,
which launched it as its own project. 150+ organisations, integrated across
Google, Microsoft and AWS, v1.0.1 (May 2026) added an extension mechanism, and
SDKs in Python, JavaScript, Java, Go and .NET.

An A2A server publishes an **Agent Card** at:

    /.well-known/agent-card.json

declaring its skills, supported MIME types, transport bindings and security
schemes. That card *is* the "what is this one good at" registry. The cage's menu
is built from the cards of every runtime currently reachable.

## Why this matters more than it looks

Without a standard, every runtime you add costs a bespoke adapter, and the cage
learns a private vocabulary that means nothing outside your estate. With A2A:

- a runtime you did not write can join by publishing a card
- an outside developer can build against your estate without your SDK
- the extension mechanism carries your own fields without forking the spec

## The extension

A2A says what an agent can do. Your catalog says what it is *allowed* to do,
and who gets paid. That goes in an extension rather than a fork:

```json
{
  "protocolVersion": "1.0.1",
  "name": "hermes-seo",
  "description": "Long-running search and content work.",
  "skills": [
    { "id": "seo.audit", "name": "Site audit", "tags": ["seo", "slow"] }
  ],
  "capabilities": { "streaming": true },
  "extensions": [
    {
      "uri": "https://cybercheck.dev/a2a/catalog/v1",
      "params": {
        "product_id": "prd_...",
        "product_version": "1.4.2",
        "runtime": "hermes",
        "grants": ["reviews.recent", "menu.read"],
        "pricing_ref": "pri_..."
      }
    }
  ]
}
```

`grants` must be a subset of what the catalog issued for that installed product
version. The orchestrator checks it against the catalog on load — a card is a
claim, not an authority. A runtime that claims a grant it was not issued is
refused, loudly, and the trace records it.

## Card discovery

1. On boot, the orchestrator reads its catalog install list.
2. For each installed product, it fetches the runtime's card.
3. It intersects `skills` with catalog `grants`.
4. The intersection becomes the cage's menu and the orchestrator's dispatch
   table.

A runtime that is unreachable is simply absent from the menu. Nothing errors;
the sentence routes elsewhere or comes back UNROUTED.

## Note on the gaps

The published critique of these protocols is that MCP, A2A and ACP describe
*capability* well and *authority* poorly — they say what an agent can do, not
what it is permitted to do, for whom, or who answers when it is wrong. That gap
is exactly the hole your catalog schema already fills. Do not wait for the
protocol to grow into it; keep authority in the catalog and let A2A carry
capability.
