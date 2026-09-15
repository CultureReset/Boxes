# NODE

A Linux computer the owner talks to. Everything on screen, nothing in a terminal.

```bash
npm install
npm run dev          # daemon on :7770, shell on :5173
npm run dev:menu     # the menu app on :3000
```

## What is here

```
daemon/      the local HTTP server
  platform/  the client for the platform. the only thing that knows a URL.
  voice/     hearing, speaking, and the small model. all on this machine.
shell/       the TV interface — renders only, holds no business data
apps/menu/   the QR menu and its editor
box/         the appliance — image, boot config, systemd units, device agent
services/    an optional cloud path for inbound calls. not required.
```

## The three devices

**The phone** carries the SIM, the number, and the owner's own logins. It is
where the access lives, because it is where they signed in. It does the work.

**The box** does the talking and the thinking. Hearing, voice and the small
model all run here — not on the phone and not in a data centre. One voice for
the television, for a phone call, and for a text read aloud, so the business
sounds like one thing whichever door somebody came in.

**Their own phone** is the remote control.

## The three rules

**The box holds no database credential.** `daemon/src/platform/` is the only
thing that knows where the platform is. Everything above it asks for bookings or
a menu; nothing builds a URL, and nothing issues SQL.

**There is no model in the router.** `daemon/src/platform/router.ts` matches a
sentence against phrases each capability declared. A sentence either matches or
it returns UNROUTED — which is a correct and useful answer. It means: this is a
job for the shop. Solve it once, declare the phrase, every box gets it.

**The model never produces a figure.** When a sentence is escalated, a model may
choose which capability runs and phrase what came back. Every number in an
answer came out of the platform on that request.

## The path a sentence takes

```
  spoken at the TV, typed in the ask bar, or texted to the number
                          │
                          ▼
  router.ts        match a declared phrase. no model here.
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        a capability              UNROUTED
              │                   a real answer
              ▼
  capabilities.ts  run it — this is the only thing that fetches a value
              │
              ▼
  client.ts        one call to the platform. the platform owns the database.
              │
              ▼
  answer.ts        present what came back. invent nothing.
```

## Connecting a box

```bash
curl -X POST localhost:7770/api/platform/connect \
  -H 'Content-Type: application/json' \
  -d '{"baseUrl":"https://api.example.com","token":"…","slug":"flora-bama-yacht-club"}'
```

Written to `~/.config/nodeos/platform.json`, mode 0600. `NODEOS_API_URL`,
`NODEOS_API_TOKEN` and `NODEOS_SLUG` override it so a laptop can point at
staging without touching a box.

Unconnected is a normal state, not an error. The shell, files, calendar,
windows, audio and network all work on a box that has never been claimed.

## Voice

Everything lands in one place. `daemon/src/voice/pipeline.ts`:

```
      text ─┐
     audio ─┤                    ┌─ router: declared phrases, no model
       SMS ─┼──►  handle()  ────►┤
   webhook ─┘                    └─ small model, only when unrecognised
                                      │
                                      ▼
                            a capability runs for real
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  a list, on screen        one sentence, on the phone
```

There is exactly one place where a question becomes an answer, so the box
cannot say one thing in the room and another on the line.

A screen can carry a list. A call cannot — `2026-09-15 18:30 — Mike Halloran (6)`
is a row, not a sentence. `spoken()` in `platform/answer.ts` reads the same data
and says it the way a person would:

| Screen | Phone |
|---|---|
| `Sunday: 11:00 to 22:00` / `Monday: closed` / `Friday: 11:00 to 02:00` | *"Sunday, 11:00 to 22:00 and Friday, 11:00 to 02:00. Closed Monday."* |
| `2 bookings today.` / `  18:30 — Mike Halloran (6)` / `  20:00 — Dana Reyes (2)` | *"2 bookings today, starting at 6:30 pm and finishing at 8 pm."* |

Both are the same facts, fetched once. Neither invents one.

### What it runs on

| Layer | Default | Where |
|---|---|---|
| Hearing | whisper.cpp, `small.en` | on the box |
| Voice | Piper, falls back to espeak-ng | on the box |
| Model | any OpenAI-compatible endpoint — Ollama, llama.cpp | on the box, `:11434` |

`GET /api/voice` reports what this machine actually has. Nothing is claimed
that is not installed, and a box with no voice still answers in writing.

### The small model's job

It is not answering. It reads a sentence the router did not recognise and picks
which capability would answer it. The capability then runs for real, and the
model writes one line from what came back. It is choosing and phrasing, never
knowing — which is why 3B parameters on a mini-PC is enough.

### The number that matters

`GET /api/voice` returns the share of sentences that came back UNROUTED. When
it climbs, the answer is to declare more phrases, not to buy a bigger model.
Watching it fall is the whole business.

### Getting a call into it

The box answers on `POST /api/voice/heard` (16kHz mono WAV in, WAV out) or
`POST /api/voice/text` if something upstream already transcribed.

**One constraint worth knowing before wiring a phone up:** Android does not let
an ordinary app read the audio of a normal cellular call. There is no ADB route
to it. Three things do work:

| Route | How |
|---|---|
| **SIP / VoIP app on the phone** | The number is carried over data. The app has the audio because the call is its own. Closest to "the phone answers it". |
| **Carrier forwarding to a SIP trunk** | The SIM keeps the number; calls forward to something that can hand the box audio. |
| **Twilio or similar** | A webhook posts audio or a transcript to the box. `services/` holds a working version of this. |

The middle one keeps the owner's number on the owner's SIM and still gives the
box the audio. It is the one to try first.

## Adding a capability

One entry in `daemon/src/platform/capabilities.ts`:

```ts
{
  key: "reviews.recent",
  summary: "Reviews that arrived recently.",
  phrases: ["new reviews", "any reviews", "what are people saying"],
  readOnly: true,
  run: async () => platform.get(`/api/reviews${qs({ slug })}`),
}
```

Then a presenter in `answer.ts` if the default line is not good enough. That is
the whole extension point. The shell does not change, the router does not
change, and the phrase is now live on every box that syncs.

## Where the pieces came from

| Here | Taken from |
|---|---|
| `daemon/`, `shell/` | `Linux-` |
| `daemon/src/platform/` | new |
| `apps/menu/` | `menu-builder`, with its Supabase key removed |
| `services/voice/` | `ghost-ai/backend-api` |
| `box/agent/` | `cybercheck-node/runtime/agent` |
| `box/image/`, `box/boot/` | `cybercheck-node` |

## What is not done

- `services/voice/` — the cloud call path — still writes to the database
  directly. 24 call sites. `services/voice/README.md` lists every one and what
  it should become. The on-box path in `daemon/src/voice/` does not have this
  problem; it goes through `platform/`.
- Nothing has been tested against a real handset yet. The voice pipeline has
  been exercised end to end with text and with a stub platform.
- `box/image/` is still the Raspberry Pi build. The target is x86, 16GB, with an
  immutable image and rollback.
- Nothing writes outward yet. Canonical facts, fan-out and receipts — the
  "say it once, it lands everywhere" half — are not in this repo. The design is
  finished and sitting in `cybercheck-orchestrator/db/*.sql` and
  `src/kernel/channels.js`; it needs one decision before it moves.
