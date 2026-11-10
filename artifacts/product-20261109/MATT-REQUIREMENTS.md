# Matt's NODE requirements

**Compiled:** 9 November 2026, evening, America/Chicago  
**Purpose:** Every explicit NODE / UI / product instruction in Matt's own words, plus what each screenshot he sent actually shows, so the clean UI and the sellable repo structure match *his* product, not a replica or an MVP.

## How this was compiled

- **Primary source:** Matt's messages in the main Grok Bot chat (agent `291b655a-cc89-462b-9ff3-f7f27837bb6f`), cited as `t####u` with timestamps in America/Chicago. SearchTranscripts/ReadTranscript could not open that main chat from this subagent run ("no record" / main-chat restriction), so quotes were taken from the conversation index for that same chat. Wording is Matt's unless marked as a later steering paraphrase of a voice/call turn.
- **Screenshots:** files Matt dropped in chat, still on disk under the main-chat attachments store and `/workspace/uploads`. Phone shots from today (`IMG_6679.png`–`IMG_6682.png`, t1375–t1382) are **referenced in the chat but the image bytes were not on disk** in attachments, Pictures, Downloads, or artifacts at compile time. What they showed is taken from the assistant's contemporaneous description after opening them, noted as such.
- **Also used:** profile memory dated 17 Oct, 26 Oct, 9–10 Nov 2026; `/home/box/sand-data/matt-image-notes.md` (notes on earlier uploaded NODE and product-poster batches).
- **Not used as product canon:** agent-taken verification shots of the current cluttered portable/live UI; the Grok Bot replica wallpaper; Google Workspace DNS and other unrelated uploads. Secrets, passwords, API keys, and verification tokens are omitted.

Later messages win when Matt corrects an earlier instruction. Those conflicts are listed in §4.

---

## 1. What NODE is (canonical)

NODE is the **one admin dashboard and clean UI for all of his data and tools**, on a computer he (or a customer) owns. It is **not** a sandbox, **not** a Grok Bot replica, and **not** an MVP slice of the live system.

From Matt, in order:

- **17 Oct 2026, t173u:** "they need to be able to see everything they have, all the agents, all the automations, that like they need the clean UI, UX to see everything. Even though that Jarvis is one orchestrator and everything. Cause the whole thing is so that UI, UX and framed."
- **17 Oct 2026, t172u:** "the goal is to start selling plug and play local computers" — "a UI/UX with logins like a SaaS."
- **26 Oct 2026, t711u:** "everything needs to be reachable with paperclip. Like, this is a fully voice automated system. Business operating system. You plug it up and it works."
- **26 Oct 2026, t715u:** "I'm basically building my own Grokbot, but now Paperclip can also orchestrate my Grokbots." (Do not build *on* Grok Bot; Grok Bots are workers Paperclip can send work to.)
- **26 Oct 2026, t737u:** "I need to be able to see it on my web app just like I would on my computer. It's a web app version of everything on the computer. So I can have the UI, UX cached on my web app, but basically all the backend stuff can happen on my computer."
- **26 Oct 2026, t790u:** "once I log in once, it should be able to… display the same thing… my computer is the cloud… Even if the UI, UX becomes is downloaded on my phone, the data can come through my computer."
- **26 Oct 2026, t823u:** "Some of the stuff may have its own UI, UX, but it needs to basically, it's one interface basically connecting to a lot… all the stuff still hits the same backend."
- **27 Oct 2026, t917u** (Matt's architecture, stated directly): "(1) NODES = UI/UX layer only. (2) JARVIS = the front door. (3) PAPERCLIP = the orchestrator/control plane. It does not matter what app, tool, or add-on sits on top of Paperclip — Paperclip talks to it, and it should just work, however many things get added. Everything else (LiteLLM, PC Call, SMS, pay links, OpenClaw, Hermes, MCP hub, Vercel apps, GCR, etc.) is a CLIENT of Paperclip, not something built on top of the nodes."
- **4 Nov 2026, t1266u / t1268u:** "one front door" so he can "click on an app, and it can actually open up inside of my app." "It should almost be as like an iPhone… I need to be able to see the whole web app of all of my apps… like a kiosk type thing… like being able to access all the data from one place. So it's literally like a iPhone or a smart home."
- **4 Nov 2026, t1275u:** "the NODE phone UI … must become the single control surface for the whole platform — Paperclip agents (pause/resume/model/heartbeat/history), n8n, LiteLLM, automations, Ollama/local stack, billing/usage, files/services. Not a launcher."
- **9 Nov 2026, t1386u** (call, quoted): "it needs to be one, one part, one ecosystem." And: "I'm literally looking at it at Node, the thing I showed you. It may just be a little bit different UI/UX. And I'm gonna use Magic Mirror as a different one, so each, each part, each piece can be modular."
- **9 Nov 2026, t1401u:** "NODE is supposed to be the admin dashboard / clean UI for ALL his data on this computer, not just a sandbox." Three layers: real home-directory Files; connection to the CyberCheck / Gulf Coast Radar Supabase project (business data, menus, hours, images); agents openable from NODE.
- **9 Nov 2026, t1426u:** "do not build from that, Grok bot replica."
- **9 Nov 2026, t1429u:** "it's on my goddamn fucking computer, the UI, UX… You literally don't even have my goddamn fucking node in a goddamn fucking repo. You don't even have all the fucking apps structured correctly, all the fucking automations, all the UI, all the UX."
- **9 Nov 2026, t1432u:** "just build me a couple big fucking works I could sell and do not start giving me a MVP bullshit do not give me a fucking one fucking version of this shit I need a fully functional built version of this exact same shit like everything. I'm fucking doing it needs to be clean. It needs to be structured. It needs to work everything needs to be connected. I need to be able to download it from a fucking repo and I can start fucking just tell what I need and an AI chat with an AI will build with a fuck ever I need… make a nice clean you RUX… that's not bad if you actually had sections that's one screen over the node looking screen, but that's not the magic mirror looking screen because it may have multiple versions of the same thing so I need something to make me some money and to Cell into work exactly like I'm fucking explained 100 goddamn fucking times"

---

## 2. Requirements in his words

Each item is a rule the build must follow. Source is date + message id. Quotes are trimmed only for length or to drop secrets; ellipses mark cuts.

### 2.1 Product completeness (no MVP, nothing removed)

| # | Date (CT) | Source | His words | Build rule |
|---|-----------|--------|-----------|------------|
| R1 | 9 Nov 19:04 | t1432u | "do not start giving me a MVP bullshit… I need a fully functional built version of this exact same shit like everything." | Ship the full live feature set: every app, automation, agent, Files, chat, voice, system monitor, CRM, etc. Organize and clean; do not cut a 5% slice. |
| R2 | 9 Nov 18:22 | t1429u | "You're not building my fucking thing… it's on my goddamn fucking computer, the UI, UX." | The source of truth is the live NODE already running on the desktop, plus the screenshots and instructions in this chat — not a new invented shell and not the Grok Bot replica. |
| R3 | 9 Nov 18:19 | t1426u | "do not build from that, Grok bot replica. Like, I've told you a hundred times what the fucking did." | Ignore Grok Bot replica tiles/UI as a template. Grok Bot is one agent/app inside NODE. |
| R4 | 26 Oct 00:02 | t715u | "I'm not trying to use Grok. basically, Grokbot is a way that I can use it. But I'm basically building my own Grokbot, but now Paperclip can also orchestrate my Grokbots." | NODE is his product. Grok Bots are optional workers under Paperclip. |

### 2.2 Clean, sectioned UI — not a wall of tiles

| # | Date (CT) | Source | His words | Build rule |
|---|-----------|--------|-----------|------------|
| R5 | 9 Nov 19:04 | t1432u | "look how dirty that that's not clean that looks very complicated. Like, why can you not just make this thing clean make a nice clean you RUX… that's not bad if you actually had sections that's one screen over the node looking screen" | Phone/desktop home uses **grouped sections**, not a long duplicated tile wall. The Oct 25–26 NODE phone screens he sent already show this pattern (Today stats, Agents, Chats, bottom nav). |
| R6 | 17 Oct 17:10 | t173u | "they need the clean UI, UX to see everything" — agents and automations in one framed UI. | Home and dedicated screens must surface Agents and Automations, not hide them. |
| R7 | 24 Oct 22:09 | t603u | "the Node with everything on it, with like files and the, the nice clean UI, but I need one that I can actually like chat, where I can chat a phase type thing, like a chat history type thing… my interface is not really that clean on mobile." | Chat history is first-class. Mobile must stay clean, not cramped (also t1247u, 2 Nov: "Make this a little bit cleaner. It's kind of cramped together on mobile."). |
| R8 | 4 Nov 16:30–16:34 | t1266u, t1268u | "I can click on an app, and it can actually open up inside of my app… see the full UI, UX, I can see my full CRM, not just like a, a temporary list." | Apps open **inside NODE** (iframe/ingress), full app UI, not a summary card. |
| R9 | 2 Nov 13:12 | t1225u | "one goddamn fucking interface. one UI, one UX, a nice clean interface… behind one goddamn fucking login." | One login, one origin, one control surface. |
| R10 | 9 Nov 14:55 | t1404u | Everything was "rendering in mobile view on his desktop/TV monitor." "Sign into Node first" while already signed in. | Desktop and TV must use a spacious layout, not the phone layout stretched. Framed apps must get a real desktop viewport and a working same-origin session. |

### 2.3 Phone, desktop, and TV are one ecosystem — different layouts

| # | Date (CT) | Source | His words | Build rule |
|---|-----------|--------|-----------|------------|
| R11 | 9 Nov 13:39 | t1386u | "it needs to be one, one part, one ecosystem… I'm literally looking at it at Node, the thing I showed you. It may just be a little bit different UI/UX. And I'm gonna use Magic Mirror as a different one, so each, each part, each piece can be modular." | Phone hub, desktop, and TV are the **same NODE app and data**. Layouts differ. MagicMirror the software stays a **separate modular piece** (and there may be more than one display version — see R13). |
| R12 | 9 Nov 13:37–13:38 | t1383u, t1384u | NODE should "operate as a local hub on their phone — like a remote control for their computer." "Tapping Grok Bot in NODE should show the Grok Bot screen directly, no external URL visible, no blank page." Approved: install as a full-screen PWA / home-screen app with no address bar. | Phone NODE feels native. Grok Bot and OpenJarvis render **inside** the frame with real content. |
| R13 | 9 Nov 19:04 | t1432u | "that's one screen over the node looking screen, but that's not the magic mirror looking screen because it may have multiple versions of the same thing" | The **TV / MagicMirror-style screen is not the phone or desktop NODE screen enlarged**. It is a separate ambient widget layout. Multiple versions of that display are allowed (NODE TV mode, and MagicMirror as its own module). |
| R14 | 9 Nov 18:21 | t1428u | "Why are you hard coding shit? You trying to put it on a 21.5 monitor? … It may be on a goddamn fucking 100 inch TV." | No hardcoded screen size, host, path, or port in product code. TV typography and layout scale with the viewport (phone to 100" TV). The 21.5" HDMI panel is just the current monitor. |
| R15 | 9 Nov 14:51 | t1403u | "OpenJarvis to have one responsive frontend: full dashboard on desktop, condensed mobile view on phone — same data, different layout." Same question asked for Twenty CRM. | Each framed app should adapt; NODE itself must also: phone = condensed sections, desktop = spacious + sidebar, TV = ambient widgets. |

### 2.4 Agents, Paperclip, Jarvis, Hermes, automations

| # | Date (CT) | Source | His words | Build rule |
|---|-----------|--------|-----------|------------|
| R16 | 27 Oct 12:12 | t917u | Jarvis = front door. Paperclip = orchestrator. Everything else is a client of Paperclip. NODE is UI only. | One brain: Paperclip. OpenJarvis is the talk/front-door UI, not a second orchestrator. Hermes and OpenClaw are modular workers/apps, not copies of the brain. |
| R17 | 26 Oct 09:38 | t764u | "Jarvis is fucking Grok, and … my COO … is my fucking paperclip. It handles all my goddamn fucking thing, but I also talk to them through my fucking, the Jarvis." | User talks through Jarvis/NODE chat; Paperclip runs the company of agents. |
| R18 | 26 Oct 12:04 | t821u | Agents must not all talk to everything directly. "that defeats the whole fucking purpose through one gateway before it acts." | One approval / action gateway. Risky actions need YES (research + t784u: payouts/sudo need YES + passkey; all of Paperclip, Hermes, OpenClaw, Jarvis, Grok Bots go through one gateway). |
| R19 | 9 Nov 14:43 | t1400u | "can he easily book/open any of his agents from NODE?" Grok Bot, OpenJarvis, "one-tap agent access." | Home has an Agents section with one-tap open for Grok Bot, OpenJarvis, and Paperclip (and the rest of the workforce). Do not also repeat those same tiles in a second Apps wall. |
| R20 | 9 Nov 19:06 | t1433u | "it needs to be lots of little agents, it needs to be modular. Every fucking piece needs to be modular." | Many small single-purpose agents/modules, each with a declared purpose — not a few monoliths. |
| R21 | 26 Oct 09:26 | t749u | "they can basically pick and choose, oh, I want that, and now they can use it… creating these individual specialized agents" | Catalog / install model: customer picks modules. AI chat can also build a new one on request (R27). |
| R22 | 2 Nov 17:02–17:04 | t1241u, t1242u | "Rakazo Download it as another agents" + the elie222/rakazo repo. | Rakazo is one installable agent/app, not the cleanup tool and not the product shell. |
| R23 | 4 Nov 23:40–23:55 | t1269u–t1274u | Stop looping Paperclip agents burning API credits. Heartbeats off unless he asks. Local models via LiteLLM. No surprise loops. | Zero duplicate loops / workers doing the same job. One owner per function. On-demand agents unless Matt enables a schedule. |

### 2.5 Data, Files, business connection, system vitals

| # | Date (CT) | Source | His words | Build rule |
|---|-----------|--------|-----------|------------|
| R24 | 9 Nov 14:44 | t1401u | Files section "should browse his real home directory and key folders (not just a sandbox)." NODE should connect to the CyberCheck / Gulf Coast Radar Supabase project for "business data, menus, hours, images." | Keep Files as a real home-folder browser. Business data comes through the GCR/CyberCheck API / connected project — NODE is the admin UI, not a second database. |
| R25 | 9 Nov 14:42 | t1399u | He was in NODE looking at pictures but did not see restaurant/business images that should be in the system. | Gallery / business media must actually read the connected GCR data, not a sandbox placeholder. |
| R26 | 9 Nov 15:11 | t1409u | "a system monitoring view inside NODE: GPU usage and temperature, CPU, RAM, disk space, power draw if readable, and a list of everything running (processes, Docker containers, systemd services)." | System section / TV vitals widget: GPU, CPU, RAM, disk, power, running services. (Also t566u, 21 Oct: he asked where to see last 12–24h GPU/CPU history.) |
| R27 | 29 Oct 21:05 | t1071u | "everything's supposed to be pointed to the GCR API clean… the dashboard, everything goes through GCR API clean." | NODE and dashboards talk to business data through gcr-api-clean, not by poking the hosted DB directly. |

### 2.6 Repos, portability, install, AI that builds

| # | Date (CT) | Source | His words | Build rule |
|---|-----------|--------|-----------|------------|
| R28 | 9 Nov 15:19 | t1414u | "he does NOT want one giant Boxes repo containing everything. He wants each component as its own separate GitHub repo under CultureReset — Hermes separate, OpenJarvis separate, NODE shell separate from NODE daemon, Twenty separate, Rakazo separate, node-vitals separate, etc." | One CultureReset repo per component. No monorepo of everything. |
| R29 | 9 Nov 15:30 | t1415u | "any new repo he downloads must connect and work immediately with zero manual path fixes." No two Twenty stacks or two n8n stacks. | Portable config only (`${HOME}`, `${DATA}`, host/ports from env). One canonical instance per function. |
| R30 | 9 Nov 18:21 | t1428u | No hardcoding of this machine, this monitor, this path. | Same as R14 + R29. |
| R31 | 9 Nov 19:04 | t1432u | "you don't know I can pick and choose and rewrite goddamn codes fucking you act like you have to use a whole goddamn fucking repo. All you do is fucking for it and then you have 100 things done the same goddamn thing… just build me a couple big fucking works I could sell… download it from a fucking repo and I can start fucking just tell what I need and an AI chat with an AI will build with a fuck ever I need" | Cherry-pick and rewrite into a **small set of sellable product repos**. Do not fork entire upstream repos and keep five copies. After install, the built-in AI chat builds new apps/modules on request. |
| R32 | 9 Nov 19:06 | t1433u | "you better not just delete shit, or, things better not be fucking wired up, fucking stupid. You better not have multiple loop, loop, lubricants, fucking duplicate this, duplicate that. Like, it's one goddamn, everything needs to have a meaning and a structure of what it is, how it works." | **Delete nothing** (archive / map instead). **Zero duplicates:** one owner per function, no duplicate loops, services, tiles, or workers. Every module has a meaning, a structure, and declared wiring — no mystery connections. |
| R33 | 30 Oct 04:45 | t1159u | "Make sure each one is modular. Do not start overlapping shit. Everything is a standalone module. So song request, that's a module, an app. Shout out, that's a fucking app. Tip pop-ups, that's an app." | Modules are single-purpose. They share data underneath (t1161u: "the same data underneath the hood, no matter what. And they can display in many different ways"). |
| R34 | 17 Oct 17:20 | t182u | Modular platform: "private place to access everything" and "a public place" ; "each piece of this are modular nothing is hardwire." | NODE is the private control surface. Public slug/QR pages are a separate modular surface on the same data (NEXT GENT / GCR). Do not hard-wire modules together. |

### 2.7 Voice, remote control, login

| # | Date (CT) | Source | His words | Build rule |
|---|-----------|--------|-----------|------------|
| R35 | 9 Nov 13:20–13:22 | t1366u, t1367u | Same machine visible at home on the monitor and from the phone; phone can be the speaker and mic while the picture is on a TV/display. | Phone is a remote control + voice I/O. "Call my computer" and "Talk to NODE" stay in the product (they are on his screenshots). |
| R36 | 26 Oct 10:51 | t790u | "once I log in once" the same session should cover the web/phone view of the platform. | Single sign-on / one door session for shell and framed apps (this is also the fix for "Sign in to NODE first"). |

---

## 3. Screenshots — what he showed, and what it means

### 3.1 Canonical NODE phone UI (the product look he sent)

These are the NODE mobile screens documented in the image notes and still on disk in the main-chat attachments. They are the **sectioned NODE phone UI** he is pointing at when he says "the thing I showed you" and "if you actually had sections that's one screen over the node looking screen."

| File (hash / staged name) | Approx. date | What it shows | Means for the clean UI |
|---|---|---|---|
| `447dbb8f…` node-home-good-evening.png | late Oct (Batch 4, ~05:15 CT notes) | NODE home: wordmark, search/bell/settings, greeting "Good evening, steve." / "Your life, your rules." **Section cards, not a tile wall:** 0 meetings today, 5 apps open, 23 updates available, "Your AI agents are ready / 1 automation running," Chats. Ask bar "What do you need?" | **This is the phone home to match.** Grouped status sections. Agents and chats as sections, not a grid of every Linux app. |
| `bafeba54…` node-apps-marketplace.png | same | Apps list: Codex (Installed / Use this), OpenCode (Get it), GitHub Copilot, Crush. Ask bar at bottom. | Apps screen is a **catalog** (installed vs get it), not a dump of desktop utilities. |
| `cb108fff…` node-workforce.png | same | "The workforce" + "Ask the Orchestrator." Engine picker ("On this machine (fast)"). General Agent and Email Agent cards with scope checklists and Ask. | Agents screen: specialized agents with a clear job, one orchestrator entry. |
| `4bf6a25f…` node-call-talk.png | 26 Oct ~20:30 CT (status bar) | Green **Call my computer**, **Talk to NODE**, chat overlay, bottom nav: **Home, Apps, Agents, Files, Settings**. Address bar still visible (`…ms-7c02.tail…:10000`) — the problem he later wanted gone via PWA. | Keep Call / Talk / chat. Bottom nav on phone is those five tabs (Automations lives under a section or Agents, not a sixth cramped tab). Hide the URL in the installed app. |
| `bff5ccbb…` node-chats-nav.png | 26 Oct ~20:30 CT | Chats list with search, history (test threads 26 Oct), same bottom nav. | Chat history is a real section, reachable from Home. |
| `18cfade2…`, `52324866…`, `c61e6282…`, `2e90c37e…` | 26 Oct | Chat threads and a one-sentence "what is NODE" card (model blurb — not product canon). | Assistant Q&A UI. |
| `cd581483…` | 26 Oct | "Sign in to Google (Gemini) via NODE" helper — NODE types into the PC browser; "nothing saved." | Connect-style sign-in helper stays available; credentials are not kept by the bot. |
| `12-image.png` (uploads) | Oct (chat test) | Mobile NODE chat with image attach (invoice.pdf, red-circle image) and model labels (gemma, deepseek-flash, v4). Same bottom nav. | Chat must support attachments / vision. Model picker stays. |
| `20-desktop-chat.png` (uploads) | Oct (12:16 AM) | **Desktop** NODE: top nav Home / Apps / Agents / **Automations** / Files, wifi/volume/search/bell/settings, profile "steve / Personal," wide chat, attach, "All systems online," tagline "Your AI computer, everywhere." | **This is the desktop chrome to keep**, made more spacious, with a sidebar for sections. Automations is a first-class desktop nav item. |
| `04-Automations.png` (uploads) | Oct | Automations screen: "Little helpers that run on a schedule." + New automation. Sections **Running** (Travel Watch, daily 6:00, toggle) and **Suggested** (Morning Brief, Add +). | Automations is its own sectioned screen (running vs suggested), not mixed into the app tile wall. |

### 3.2 Home Node / local AI (related, not the NODE shell)

| File | What it shows | Means |
|---|---|---|
| `c7db0779…` home-node-system.png | Light "SYSTEM" dashboard on the Tailscale host: session tokens, device power/energy, cost comparison Local $0 vs cloud models, "Your AI runs locally." | System / cost / local-vs-cloud vitals belong in the product (System section and TV vitals). This is a sibling surface, not a replacement for the dark NODE shell. |
| Jarvis setup / model / Bot Computer batch (`575c1001…`, `4a66a30a…`, `7dc2110f…`, `92651ab8…`, `9b5993e8…`, `bb62a40e…`, etc.) | Installer wizard for local Ollama vs OpenAI-compatible; chat vs fast model; shared Bot Computer update/reset/disk. | Local BYOM installer and a managed box lifecycle are part of the sellable product, as modules — not hardcoded to this PC. |
| `55a39458…` Connect a model | Mobile "connect a model" (self-hosted / OpenAI-compatible base URL). | Customer brings a model endpoint. |
| `5c43481d…` | Blind password widget: "Stored securely, never shown to your Bot." | Credential vault pattern. **Do not print or store values from that screen.** |
| `650d9041…` | Uptime Kuma first-run on the Tailscale host. | Uptime Kuma is a catalog/ops app. |

### 3.3 Product posters and modular-app law (30–31 Oct batches)

Matt uploaded architecture posters (documented in `matt-image-notes.md`). They are product law for how modules work, even when the surface is NEXT GENT / GCR rather than the NODE shell:

- **VAPPs / modules are capabilities, not monoliths** — purpose, read/write scope, actions, permissions, executors, outputs (SMS, voice, page, approval, automation).
- **One data hub, many displays** — "Update once, spread everywhere."
- **Public guest page** = modules as in-page popups ("one page customers stay on"), not a Linktree.
- **Home Node poster (#1):** "Your Everything. One Environment" across phone/laptop/tablet.
- **Dynamic UI:** the interface forms around the task (SMS, voice, temporary page, chart, approval).

These support R33–R34 and the "AI chat will build whatever I need" request: new modules are declared, installed, and connected, not forked as whole repos.

### 3.4 Screenshots from 9 Nov 2026 (live machine / bugs — not the target look)

| Item | Source | What it showed | Means |
|---|---|---|---|
| `IMG_6679.png` | t1375u / t1376u, 13:32 CT. Bytes not on disk now. Assistant description: xrdp/console session; icons looked wrong. | Desktop-icon theme bug on the remote session. Not a NODE layout brief. |
| `IMG_6680.png` | t1379u, 13:34 CT. Bytes not on disk. | Sent in the same "icons / TV dashboard" stretch of the call; treat as supporting the live-desktop / NODE-on-phone context. Exact pixels unverified at compile time. |
| `IMG_6681.png`, `IMG_6682.png` | t1382u, 13:36 CT. Bytes not on disk. Assistant: NODE app viewer, **Grok Bot frame completely dark/empty**; **OpenJarvis completely blank white**. | Must-fix product behavior: those agents open with real UI inside NODE (R12). |
| `screen0top.png`, `screen0-now.png`, `node-tv-live-0.png`, `node-tv-restored.png`, `x10auth.png`, `auth-dialog-on-10.png` | Agent captures 13:33–14:39 CT, also in `/workspace/uploads` and MSI `~/artifacts/tmp/`. | Live monitor / kiosk / auth prompts while setting up `?tv=1`. The restored TV view is the **current NODE home enlarged** (greeting, stat tiles, ask bar) — the look Matt later called dirty and *not* the MagicMirror screen (R5, R13). |
| Portable-build shots `tv-1280x720.png`, `tv-3840x2160.png` (18:46 CT) | Agent test of the portable branch. | Same problem: TV is still the phone/desktop home scaled up. The new design must replace this with a distinct ambient layout. |

### 3.5 Explicitly not the product

| Item | What it is | Rule |
|---|---|---|
| `/workspace/uploads/s.png` | Grok Bot (mac-style) orange wallpaper / replica chrome. | **Do not build from this** (t1426u). |
| `screen.png` / `screen2.png` | Android notification shade (20 Oct). | Unrelated to NODE layout. |
| `3452a9ef…` (390×844) | Light "Integrations" sheet (Stripe, Figma, Notion…). | Not the NODE shell. |
| `5665bf50…` | Google Workspace domain-verification page. | Unrelated. Token not recorded here. |
| Current live/portable Apps page | A wall of Linux desktop apps (3D LUT Maker, Solitaire, …) plus a second "Web Apps" row repeating the same web apps. OpenJarvis/Paperclip appear more than once. | This is the dirt he is angry about. Dedupe; keep the apps on the Apps screen, organized; do not delete features. |

---

## 4. Conflicts and which rule wins

| Topic | Earlier | Later / winning rule |
|---|---|---|
| 21.5" HDMI TV | t1388u–t1389u asked to verify the kiosk on the 21.5" monitor. | **t1428u:** do not hardcode that size; it may be a 100" TV. Viewport-fluid only. |
| MagicMirror vs NODE TV | t1386u: TV is NODE with a slightly different UX; MagicMirror is a *different modular piece*. An assistant at 13:39 CT wrongly said MagicMirror "isn't needed." | **Both are true together (t1432u):** NODE TV is a **distinct MagicMirror-style widget layout**, not the NODE phone screen blown up. MagicMirror can also exist as its own modular app ("multiple versions of the same thing"). |
| Dedup / delete | t1415u: "Stop and remove the duplicate that NOTHING references." | **t1433u + later steering:** delete nothing. Archive or map extras. Collapse to **one owner per function**. Do not leave two loops, two Twentys, two n8ns, or two tiles for the same app. |
| Paperclip vs n8n as brain | n8n is in the live stack and must remain as an automation app (R1). | Paperclip is the orchestrator (t917u). n8n is a modular automation leaf, not a second brain. |
| Local Supabase vs hosted GCR | 28 Oct: local Supabase as the app-data foundation for CRM/POS/booking experiments. | 9 Nov t1401u / t1071u: NODE's business data for menus/hours/images is the CyberCheck/GCR project, reached through gcr-api-clean. Both can exist; NODE must not confuse a sandbox with the business project. |
| "NODE is UI only" vs "single control surface" | t917u: NODE is the UI layer. | Compatible: NODE *is* the control surface, but it **renders** and **forwards**; Paperclip (and the daemon) remain the spine. Do not move orchestration into the shell. |

---

## 5. Design implications (what to build so this is satisfied)

**Phone (condensed, sectioned — match the Oct screens, not today's tile wall):**

- Home sections: Today (meetings, alerts), Agents (Grok Bot, OpenJarvis, Paperclip / workforce — one each), Apps (the live web-app catalog, once), Automations (running + suggested), System (vitals + running services). Chat / "What do you need?" ask bar stays.
- Bottom nav: Home, Apps, Agents, Files, Settings (as in his screenshots). Automations is a section and a desktop nav item.
- Keep Call my computer and Talk to NODE.
- Deduplicate: no "My Apps" + "Web Apps" showing the same items; no repeated OpenJarvis/Paperclip tiles.

**Desktop (same data, spacious):**

- Top or side nav: Home, Apps, Agents, Automations, Files, System, Settings — modeled on `20-desktop-chat.png`, with a sidebar and room to breathe.
- Apps open inside the shell, full UI.
- Not the phone layout stretched (t1404u).

**TV (`?tv=1` and large ambient displays):**

- A separate MagicMirror-style board: clock, weather slot, agenda, agent status, system vitals, alerts.
- Fluid typography and grid (viewport units / `clamp`). No 21.5" or any other size baked in.
- Not the phone or desktop home enlarged.
- MagicMirror remains installable as its own module (a second version of a similar display).

**Product repos (small sellable set, cherry-pick/rewrite, nothing deleted, no mystery wiring):**

- One repo per component (shell, daemon, door, apps catalog, agents, display/TV, etc.).
- One install command; clone on any computer and it comes up connected.
- Every module/agent has a manifest: purpose, what it does, how it works, inputs/outputs, what it connects to.
- Built-in AI chat can build new modules on request.
- Duplicates collapsed to a single owner; old copies archived and mapped, not silently deleted.

---

## 6. Unverified / missing at compile time

- Image bytes for `IMG_6679.png`–`IMG_6682.png` (9 Nov 13:32–13:36 CT) were not found on the box, MSI Pictures/Downloads/artifacts, or remaining attachments. Descriptions rely on the chat's contemporaneous read of those files.
- Some Oct 25–26 `IMG_6384`–`IMG_6458` phone drops are indexed in the chat but not all hashes remain on disk; the Batch 4 NODE screens above are the ones still available and already described.
- SearchTranscripts could not be used on the main chat from this subagent; if a quote needs to be re-checked in the live thread, use the `t####u` id.
