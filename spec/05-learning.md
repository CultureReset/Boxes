# 05 — The learning loop

Everything reports up, so the loop sees a complete trace across every channel
and every runtime. That is the strongest part of the design and it is also the
part most likely to quietly poison the product.

## The one rule

**Learn the map. Never the territory.**

The box's entire credibility rests on the model not knowing things. It chooses
and it phrases; capabilities produce the figures. A loop that trains on traces
is the model starting to know things — and a model that has learned "they close
at ten" will eventually say it on a night they closed at eight.

That failure is not loud. It sounds exactly like a correct answer.

## Allowed outputs

| The loop may propose | Example |
|---|---|
| a new phrase → capability mapping | `"y'all still serving"` → `business.hours.read` |
| a routing weight change | `"book"` leans Booking over Business |
| an agent-selection correction | slow SEO work goes to Hermes, not the daemon |
| a capability that does not exist yet | 240 unrouted sentences all asking about parking |

## Forbidden outputs

| Never | Why |
|---|---|
| a fact, figure, time, price, name | the capability owns it, always |
| a default or fallback value | a remembered value is a stale value |
| a cached answer | if the data moved, the cache lies |
| a rule that skips a capability call | the call *is* the freshness guarantee |

The trace schema in `04` enforces this by construction: there is no field a
figure could travel in. If someone adds one, this document is the reason not to.

## Nothing deploys itself

Every proposal lands as an **unpublished draft in the catalog** —
`product_versions`, same as any outside developer's submission. It ships when a
person publishes it.

This matters twice over. It stops a bad inference reaching a customer's box.
And it turns the loop into the thing that seeds your store: your own fleet
writes the first few hundred automations, through the same gate everyone else
goes through, so the gate is proven before the first outside developer arrives.

## Self-generating runtimes

Hermes generates its own skills — that is its whole pitch. Several Hermes
instances means several divergent skill sets, none reviewed, none catalogued,
each drifting from the others.

Same answer: a self-generated skill is a **proposal**, not a deployment. It
enters as a draft product version, carrying the trace spans that justified it,
and it holds no grant until it is published. `product_versions` already has the
shape.

## The measurement

The loop is working if unrouted rate falls while routing accuracy holds. It is
broken — and must be stopped — if unrouted rate falls while *correction rate*
climbs, because that means it learned to answer confidently rather than
correctly. Both numbers come off the same bus.
