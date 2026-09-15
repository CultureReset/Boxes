# The orchestration spec

How the doors, the orchestrator, the cage, the runtimes and the catalog fit
together — and, more to the point, what each one is **not allowed to do.**

The whole design is one idea repeated at five levels: *the thing that reads
what a stranger wrote never holds a capability.*

    01-topology.md    the five planes and what crosses between them
    02-the-cage.md    the caged reasoner — the contract, and why it holds
    03-agent-card.md  how a runtime declares what it is good at (A2A)
    04-trace-bus.md   what every runtime reports, and what it may not report
    05-learning.md    what the loop may learn, enforced by the trace schema
    06-app-agents.md  one agent per app, and why that is the reusable unit

## The shape in one page

    DOORS        phone · WhatsApp · SMS · Telegram · the TV · the dashboard
                 └── all of them arrive as a sentence and a channel
                                     │
    ORCHESTRATOR OpenJarvis. Holds the conversation. Holds the capabilities.
                 Runs offline. THE ONLY THING THAT TOUCHES DATA.
                     │                    │
                     │ (only when it      │ executes
                     │  cannot route)     │
                     ▼                    ▼
    THE CAGE     bigger model        RUNTIMES
                 reads text          OpenClaw · Hermes · NODE daemon · …
                 returns ONE key     each publishes an Agent Card
                 from a closed set   each reports to the trace bus
                 no data, no tools
                 no network
                                     │
    CATALOG      cybercheck-marketplace — publishes, versions, prices,
                 and gates every capability any of them may hold.

Everything above reports to one trace bus. The learning loop reads only that
bus, and the bus cannot carry a fact.

## Why the orchestrator is the offline one

The door that matters is a phone line. A caller does not care that Telegram is
down, that a token expired, or that a cloud model is rate-limited. So the thing
that answers has to be the thing that still works when everything else is not.

That is the whole argument for putting the local, offline-capable orchestrator
at the conversation layer rather than the gateway. Access is not architecture.
The common mistake is to put the gateway in front because the gateway is the
easiest way in — and then the business goes quiet whenever the gateway does.

## Why there is a cage

A bigger model is better at understanding a sentence nobody anticipated. It is
also the component reading text written by a stranger who may be trying to
steer it. Those two facts are not in tension if the bigger model has nothing to
steer: no data, no tools, no network, and an output that is one value from a
list the orchestrator already trusts.

This is privilege separation, and it is the same trade the kernel makes with
userspace. The smart part is untrusted. The trusted part is dumb on purpose.
