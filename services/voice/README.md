# voice — the call-in system

**This does not run on the box.** It runs beside the platform.

A phone number has to be reachable from the internet. The box dials out and
nothing listens on it, so a Twilio webhook can never reach it. Voice is
service-side, exactly as `The_System` §25 puts it:

> Service side, on no box — email parser intake · the public data layer and its
> MCP surface · the user dashboard web app.

## What is in here

| File | What it does |
|---|---|
| `services/realtime-voice.service.js` | Twilio ↔ OpenAI Realtime over WebSocket. Bidirectional live audio, sessions keyed on `callSid`, conversation history. |
| `services/phone.service.js` | Inbound call → TwiML. Looks the business up and uses its own `phone_ai_greeting`. |
| `services/sms.service.js`, `sms-ai.service.js` | SMS in and out. |
| `services/ai-orchestrator.service.js` | Which provider answers. |
| `services/voiceDataExtraction.js` | Pulls structured fields out of what was said. |
| `services/runtime-executor.service.js` | Runs the resulting action. |
| `workers/receiptWorker.js` | Bull + Redis queue. |

## One thing is wrong and is not hidden

These files hold a Supabase key and write to the database directly:

    config/supabase.js          ← the key
    services/phone.service.js         11 call sites
    services/realtime-voice.service.js 6 call sites
    services/ai-orchestrator.service.js 3 call sites
    services/openai.service.js         4 call sites

That breaks the rule `gcr-api-clean/CLAUDE.md` states plainly: **only
gcr-api-clean talks to the database.** Two writers against one schema drift
until one has a hole.

It works today, so it has not been torn out. The fix is 24 call sites,
mechanical, and each one becomes an HTTP call to `gcr-api-clean`:

| Table touched here | Should become |
|---|---|
| `businesses` (read) | `GET /api/public/:slug` |
| `phone_calls` (insert/update) | `POST /api/calls` |
| `usage_records` (insert) | `POST /api/usage` |
| `notifications` (insert) | `POST /api/notifications` |

Do that before a second person works on either side.

## The rule this shares with the box

The model chooses which query runs and phrases the result. **It never produces a
figure.** A spoken answer about hours, a menu or availability contains values
that came back from the platform on that call, or it does not contain them.

`daemon/src/platform/answer.ts` on the box and this service answer through the
same capability list, so a spoken question and a typed one cannot diverge.
