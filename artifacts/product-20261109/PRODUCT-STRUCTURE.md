# NODE product structure

Date: 9 November 2026 (America/Chicago).
Scope: proposal only. Nothing in this document deletes, moves, or stops a live process.
Companion: `MATT-REQUIREMENTS.md` in this kit (Matt's words, screenshots, and the design rules this structure must match).
Evidence for current live owners: the 9 November 2026 CultureReset repo audit (`Boxes/artifacts/repo-audit-2026-11-09/` and `/home/steve/artifacts/sprawl-audit-20261109/`). This is not a re-audit.

Rules that bind this proposal (Matt + steering, later messages win):

- No MVP. Keep the full live feature set, organized.
- Delete nothing. Archive or map extras. Exactly one owner per function.
- Modular: many small single-purpose modules/agents, each with a manifest.
- No mystery wiring: every connection is declared and shown on a connection map.
- Cherry-pick / rewrite into a **small number of sellable product repos**. Do not fork whole existing trees into the product.
- One install command. Then tell the built-in AI chat what to build.
- Same product on phone, desktop, and TV — different layouts. TV is a MagicMirror-style ambient board, not the phone screen enlarged. MagicMirror can also exist as its own module.
- Paperclip is the orchestrator / only brain. Jarvis is the front door. NODE is the UI and control surface. One approval gateway.
- Do not build from the Grok Bot replica. Build the live NODE on this computer.
- Portable: clone and it works; no hardcoded `/home/steve`, no hardcoded 21.5" panel (it may be a 100" TV).

---

## 1. The product repos (five)

These are the sellable units a new machine clones. Existing CultureReset repos stay where they are as sources or archives. The product repos receive **cherry-picked** code, not whole-repo forks.

| Product repo | Purpose | What a buyer gets |
|---|---|---|
| `nodeos-core` | Runtime, identity, installer, config contract, process supervision | Daemon, door, home portal, launcher, `install.sh`, Compose, `nodeos.manifest.json`, env/port contract |
| `nodeos-shell` | The NODE UI — one frontend, three layouts | Phone (sectioned home + bottom nav), desktop (sidebar + spacious chrome), TV/ambient board entry |
| `nodeos-apps` | App catalog and ingress, not the upstream apps themselves | Manifests for every installed app, frame/proxy config, grouping (Business / Operations / Media / System). Apps are installed from their own upstream or pin repo |
| `nodeos-agents` | Workforce and tool bus | Paperclip wiring, approval gateway, MCP hub, Grok Bot / OpenJarvis / Paperclip / Hermes / OpenClaw launch contracts, persona chips, "Call my computer" / "Talk to NODE" |
| `nodeos-display` | Ambient / kiosk surfaces | MagicMirror-style TV board (clock, weather, agenda, agent status, system vitals, alerts), optional standalone MagicMirror module, `node-tv-session` kiosk scripts (not Plasma/xrdp/HDMI setup) |

Optional later, not a sixth product repo unless it grows: system vitals stay in **`nextgent-vitals`** (already the vitals owner — do not invent `node-vitals`). Core/shell/display consume it through a declared API.

`Boxes` remains the **live glue on this machine** until a tested cutover. `node-daemon` and `node-shell` remain the published splits. After cutover, `nodeos-core` and `nodeos-shell` are what a fresh clone uses; Boxes is archived as the historical monorepo, not deleted.

---

## 2. Cherry-pick map (existing path → product repo)

"Owner" is the single product home for that function. Source trees are not deleted.

| Function | Live / current source to cherry-pick | Product owner | Do not treat as owner |
|---|---|---|---|
| Daemon, layout, worlds, `/api/*` | Live: `CultureReset/Boxes` `daemon/` (`/home/steve/ang/src/boxes`). Published split: `CultureReset/node-daemon` | `nodeos-core` | Older `nextgent-box*` |
| Shell UI | Live: `Boxes/shell`. Published split: `CultureReset/node-shell`. This kit's `design/clean-ui-20261109` is the clean-look source | `nodeos-shell` | `nextgent-shell` (different, nearly empty). Grok Bot replica screens. |
| Passkey / session door | `CultureReset/node-door` (live `:7700`) | `nodeos-core` (door module) | `sms-door` stays a **separate module** under agents (SMS entry), not a second door |
| Static home portal | `CultureReset/node-home` (live `:7690`) | `nodeos-core` (home module) | — |
| Installer, compose, manifest, units | This portable kit: `install.sh`, `docker-compose.yml`, `Caddyfile.example`, `nodeos.manifest.json`, `units/` plus useful bits of `node-infra`, `node-services`, `node-kit-runtime`, `ai-stack-kit` | `nodeos-core` | Do not fork those infra repos wholesale |
| Helpers / path-safe launch | `CultureReset/node-helpers` (`~/ang/bin`) | `nodeos-core` (helpers module) | — |
| Tunnel | `CultureReset/node-tunnel` (chisel `:7710`) | `nodeos-core` (tunnel module) | Raw `chisel` fork |
| MCP hub | Live: `CultureReset/node-mcp-hub` branch `approval-gateway-enforce` at `/home/steve/agents/mcp` (`:7790`) | `nodeos-agents` (hub module) | Older `main` on that repo until it matches live |
| Approval gateway | `CultureReset/approval-gateway` plus live `/opt/node-approvals/app` (reconcile, one owner) | `nodeos-agents` (approval module) | `paperclip-approval-bridge` after its unique bits are folded in |
| Paperclip (orchestrator) | Live npm install + pin `CultureReset/paperclip-node` | `nodeos-agents` (contract + wiring). Upstream stays `paperclipai/paperclip`; public `CultureReset/paperclip` is the fork pin, not the product | A second "brain" in the shell or Grok Bot replica |
| OpenJarvis (front door) | Live `~/.openjarvis/src` = `CultureReset/openjarvis-node` | Stays its own app repo. `nodeos-agents` holds only the launch / SSO / one-tap contract | `OpenJarvis` public fork, `nextgent-openjarvis`, `Open-jarvis` |
| Hermes | Live `~/.hermes/hermes-agent` + `CultureReset/hermes-agent` | Same: own app repo + contract in `nodeos-agents` | Extra `~/ang/src/hermes` |
| OpenClaw | Live npm-global + pin `CultureReset/openclaw`; workspace `openclaw-workspace` | Contract in `nodeos-agents`; workspace data stays out of git | Tiny public `Open-claw` |
| Grok Bot | The live Grok Bot the owner already uses (one-tap from Agents). Not the replica dashboard | Contract in `nodeos-agents` | Replica / `s.png` prototype |
| `nextgent-jarvis` | Separate front-door / papertrail app | Keep as its own app, cataloged in `nodeos-apps` | Do not merge into OpenJarvis |
| TV kiosk session | `CultureReset/node-tv-session` | `nodeos-display` | Do not touch Plasma / xrdp / LightDM / HDMI |
| MagicMirror | `CultureReset/MagicMirror` (public fork, not running this audit) | Optional module in `nodeos-display`; NODE TV board is the default ambient surface | Using the phone home at `?tv=1` as the TV product |
| System vitals (GPU, temp, power, …) | `CultureReset/nextgent-vitals` (and unpublished `boxes-sysmon` / `feat/node-system-monitor` work — map, do not deploy live in this pass) | `nextgent-vitals` remains the vitals repo; shell System page and TV vitals tile consume it | A new `node-vitals` repo |
| App catalog + frames | `Boxes/config/webapps.json` + frame proxy in the daemon | `nodeos-apps` (one manifest per app) | Listing the same app again under Agents **and** Apps **and** "Web Apps" **and** "My Apps" |
| n8n automations | Official n8n image + `CultureReset/nextgent-n8n` (compose/workflows) | App + automations module; catalog in `nodeos-apps`. Shell Automations screen stays in `nodeos-shell` | Public `n8n` source fork unless building from source; `n8n-sandbox` until proven |
| Twenty CRM / CRM 2 | Official images + `nextgent-runtimes`. Source fork `twenty-CRM` | Catalog two entries only while both stacks exist; one owner compose: `nextgent-runtimes` | Running the source fork; long-term two Twenty stacks (Matt does not want that forever — CRM 2 stays until its tile and hostname are retired) |
| Rakazo | `CultureReset/rakazo` (live `~/apps/rakazo` still not a git checkout) | Own app repo; catalog in `nodeos-apps` | — |
| Supabase | `CultureReset/supabase-local` (config only; no DB volumes in git) | Own config repo / module; catalog in `nodeos-apps` | — |
| SearXNG, LiteLLM | Official images; redacted config should live in `node-infra` or a small config module, then `nodeos-core` or `nodeos-apps` | Catalog + config module. Do not ship the source forks as the product | `CultureReset/searxng` and `CultureReset/litellm` source forks |
| GCR / CyberCheck business data | API owner candidate: `CultureReset/gcr-api-clean`. Front ends and dashboards are a family still being reconciled | Accessed through NODE Files/apps via that API. Not pasted into the shell | `gcr-api`, `gcr-api-v2`, and the historical GCR/CyberCheck name pile — map, one API owner |
| Files | Boxes / node-daemon files API (real home folder) | `nodeos-core` (files module) + Files screen in `nodeos-shell` | A fake or sandboxed "files" demo |
| Calendar, weather, notifications, jobs | Daemon modules already in Boxes / node-daemon | `nodeos-core` + sections in the shell | — |
| Voice / "Talk to NODE" / "Call my computer" | `node-voice`, `node-pccall`, `nextgent-phone` / `node-sms`, plus Home chrome already in the shell | Keep as modules under `nodeos-agents` (voice, call, SMS). Shell keeps the two buttons | Do not drop these to "clean up" the home |
| Chat service | `nextgent-chat` (`:7780`) | Module under `nodeos-agents` or cataloged app | A second in-shell chat stack |
| SMS gateway | `smsgw-relay`, `sms-door` | Modules under `nodeos-agents` | — |
| Scrapers / second-brain / chat logger | `scrapers`, `second-brain`, `ai-chat-logger` | Data-tool modules; data stays on disk, not in git | Importing vaults or the 6.9 GB logger data dir |
| Caddy + Authelia (planned single origin / SSO) | `Caddyfile.example` in this kit; Authelia not fully wired in the portable run | `nodeos-core` (edge module) | Per-app logins as the long-term model (Matt: one login) |

---

## 3. Duplicates collapsed (existing copies → single owner)

Nothing in the right-hand "archive / map" column is deleted. It is frozen or redirected.

| Function today implemented more than once | Single owner going forward | Other copies |
|---|---|---|
| NODE daemon + shell (live monorepo vs published splits) | Live remains `Boxes` until cutover. Product owner: `nodeos-core` + `nodeos-shell`. Published `node-daemon` / `node-shell` are the split sources to merge into those | Extra Boxes clones under `~/_archive/2026-11-09/`. `nextgent-box*` older consolidations. Do not reuse `nextgent-shell` |
| This portable kit's `src/boxes/shell` and `src/node-shell` (kept in sync on `design/clean-ui-20261109`) | One UI tree after cutover (`nodeos-shell`). Until then both copies stay identical; Boxes/shell is the running-source sibling | Do not let them drift |
| Home rows "My Apps" + "Web Apps" showing the same web apps | One Apps catalog, grouped. Agents are not also app tiles | `DEFAULT_ROWS` enabling both `apps` and `webapps` |
| OpenJarvis / Paperclip / Grok Bot listed as apps and as agents | Agents section / Agents screen only for those three | Web app tiles for the same ids (`openjarvis`, `paperclip`, `grok-bot`) |
| OpenJarvis source trees | `openjarvis-node` + `~/.openjarvis/src` | Public `OpenJarvis`, `nextgent-openjarvis`, `Open-jarvis` |
| Paperclip source / install | Live npm + `paperclip-node` | Public `paperclip` fork, `paperclip-approval-bridge` (fold, then archive) |
| Approval path | One gateway (reconcile `approval-gateway` and `/opt/node-approvals/app`) | Parallel grant paths, hub-only checks, bridge repo |
| Hermes checkouts | Live `~/.hermes/hermes-agent` + `hermes-agent` repo | Extra `~/ang/src/hermes` |
| OpenClaw | Live npm-global + `openclaw` pin + `openclaw-workspace` | Public `Open-claw` |
| Twenty CRM stacks | `nextgent-runtimes` compose. Catalog may still show CRM and CRM 2 while both run | Source fork `twenty-CRM`; extra `twentyhq/twenty` clones |
| n8n | Official image + `nextgent-n8n` | Public `n8n` fork; unproven `n8n-sandbox` |
| GCR API | `gcr-api-clean` (candidate) | `gcr-api`, `gcr-api-v2`, empty/historical GCR launch repos |
| GCR front ends | One unified front end, still to be picked (`gcr-unified` family) | `gcr-unified-v2`, `gcr-public`, `gcr-links`, `gulf-coast-radar*`, `live-gcr`, … |
| Dashboards | Business shell vs CyberCheck admin are **two functions** (two owners), not duplicates of each other | Empty `Dashboard-` / `admin-login-` / `Universal-dashboard-` names |
| CyberCheck admin | `Admin-dashboard-main` | Other cybercheck-* historical trees after uniqueness check |
| Vitals / system monitor | `nextgent-vitals` | Unpublished `boxes-sysmon` worktree (map; do not deploy onto live NODE in this pass) |
| TV surface | `nodeos-display` TV board + optional MagicMirror module | Phone/desktop home scaled up at `?tv=1` (the current bug). Hardcoded 21.5" layout |
| "Brain" / orchestrator | Paperclip only | Shell-local agent loops, replica dashboards, a second orchestrator |
| Login / SSO | Door session + planned Authelia at the single origin | Per-app logins as the product default |

---

## 4. How the pieces connect (no mystery wiring)

Every arrow below must appear in a manifest `connectsTo` list.

```
                    [ Authelia  (SSO, planned) ]
                              |
                     [ Caddy single origin ]
                              |
              +---------------+---------------+
              |               |               |
        node-door          shell          app ingress
        (passkeys,      (nodeos-shell)    (frames /
         session)             |            hostnames)
              |               |
              +------+--------+
                     |
              nodeos-core daemon
              (/api/status, system, apps, agents,
               automations, calendar, weather,
               notifications, jobs, files, layout,
               control, services)
                     |
        +------------+------------------+
        |            |                  |
   node-home    nodeos-apps        nodeos-agents
   (portal)     (catalog +         (Paperclip brain,
                 manifests)         approval gateway,
                                    MCP hub, voice,
                                    call, SMS, chat)
                          |
                          +-- OpenJarvis (front door UI)
                          +-- Grok Bot (one-tap agent)
                          +-- Hermes, OpenClaw (modules)
                          +-- n8n (automations engine)
                          +-- nextgent-vitals (GPU/temp/power)
                          +-- gcr-api-clean (business data)
                          +-- Files (real $HOME)
                          |
                   nodeos-display
                   (?tv=1 board, optional MagicMirror,
                    node-tv-session kiosk)
```

Single origin, one login, one approval gateway, one orchestrator. The shell does not talk to apps or agents through hidden URLs: it opens catalog ids and agent ids declared in manifests.

---

## 5. Manifest contract

Every module and agent ships a manifest (JSON or YAML) with:

- `id`, `name`, `version`
- `purpose` — one sentence
- `whatItDoes`
- `howItWorks`
- `inputs`, `outputs`
- `connectsTo` — explicit list of other module ids (the connection map is generated from this)
- `owner` — the product repo that holds it
- `ui` — optional: `section` (Today / Agents / Apps / Automations / System), `surfaces` (`phone`, `desktop`, `tv`), `nav` / `tab`
- `install` — image, unit, or command; ports from env, never a hardcoded machine path

The kit-level file is `nodeos.manifest.json` (already in this tree). It should grow to list every module id and the install order. App entries in `webapps.json` become per-app manifests under `nodeos-apps`.

---

## 6. Modules / agents table (purpose + connections)

| id | Purpose | Connects to |
|---|---|---|
| `core.daemon` | Owner API and process control | `core.door`, `core.files`, `apps.catalog`, `agents.hub`, `agents.paperclip`, `display.tv`, `vitals` |
| `core.door` | Passkey / session login | `core.daemon`, `core.edge` |
| `core.home` | Static landing portal | `core.door`, `core.edge` |
| `core.edge` | Caddy single origin + Authelia | `core.door`, `shell`, app ingress |
| `core.install` | One-command install, env, ports, compose | all modules via the kit manifest |
| `core.helpers` | Path-safe launch helpers | `core.daemon`, `core.install` |
| `core.tunnel` | Tailnet / chisel tunnel | `core.edge` |
| `core.files` | Browse the real home folder | `core.daemon`, `shell.files` |
| `shell` | Phone / desktop / TV UI | `core.daemon`, `apps.catalog`, `agents.*`, `display.tv` |
| `display.tv` | Ambient MagicMirror-style board | `core.daemon` (clock is local; weather, agenda, agents, vitals, alerts via API) |
| `display.magicmirror` | Optional standalone MagicMirror | same data sources; not a second NODE home |
| `display.kiosk` | `node-tv-session` full-screen kiosk | `display.tv`, `shell?tv=1` |
| `apps.catalog` | One registry of installed apps | `core.daemon`, `shell`, each `app.*` |
| `app.openjarvis` | OpenJarvis front-door product | `agents.paperclip`, `core.door`, `apps.catalog` |
| `app.grokbot` | Grok Bot, one tap | `agents.paperclip`, `apps.catalog` |
| `app.paperclip` | Paperclip UI | `agents.paperclip`, `agents.approval` |
| `app.rakazo` | Rakazo | `apps.catalog` |
| `app.twenty-crm` | Twenty CRM | `apps.catalog`, `nextgent-runtimes` |
| `app.crm2` | CRM 2 (until retired) | `apps.catalog`, `nextgent-runtimes` |
| `app.n8n` | Automations engine | `shell.automations`, `agents.approval` |
| `app.notes` | Notes (AppFlowy) | `apps.catalog` |
| `app.desktop` | Linux desktop (Selkies) | `apps.catalog` |
| `app.openclaw` | OpenClaw UI | `agents.openclaw` |
| `app.uptime-kuma` | Status | `apps.catalog` |
| `app.navidrome` | Music | `apps.catalog` |
| `app.searxng` | Search | `apps.catalog` |
| `app.llama-swap` | Local LLM router | `apps.catalog` |
| `app.supabase` | Supabase studio | `apps.catalog` |
| `app.pos` | POS (Odoo) | `apps.catalog` |
| `app.tickets` | Tickets (Pretix) | `apps.catalog` |
| `app.kamra` | Kamra | `apps.catalog` |
| `app.litellm` | LiteLLM UI | `apps.catalog` |
| `app.minidlna` | MiniDLNA | `apps.catalog` |
| `app.mcp` | MCP Hub UI | `agents.hub` |
| `app.crawl4ai` | Crawl4AI | `apps.catalog` |
| `app.gcr` | Gulf Coast Radar / CyberCheck via `gcr-api-clean` | `gcr-api-clean`, `apps.catalog` |
| `agents.paperclip` | Only orchestrator / brain | `agents.approval`, `agents.hub`, all agents, `shell` |
| `agents.approval` | One approval gateway | `agents.paperclip`, `agents.hub`, `app.n8n` |
| `agents.hub` | MCP tool bus | `agents.paperclip`, `app.mcp`, tools |
| `agents.hermes` | Hermes agent module | `agents.paperclip`, `agents.hub` |
| `agents.openclaw` | OpenClaw agent module | `agents.paperclip`, `app.openclaw` |
| `agents.personas` | Named persona chips on the Agents section | `agents.paperclip` |
| `agents.voice` | Talk to NODE | `shell`, `agents.paperclip` |
| `agents.call` | Call my computer (`node-pccall`) | `shell` |
| `agents.sms` | SMS door / phone / relay | `core.door` (not a second login), `nextgent-phone`, `smsgw-relay` |
| `agents.chat` | `nextgent-chat` | `shell`, `agents.paperclip` |
| `vitals` | GPU, temp, CPU, RAM, disk, power, services | `nextgent-vitals`, `shell.system`, `display.tv` |
| `data.scrapers` | Scrapers | `agents.hub` (data stays on disk) |
| `data.second-brain` | Second brain helpers | disk vault on `/hdd` |
| `data.chat-logger` | AI chat logger | OpenJarvis send path; no data dir in git |

New modules the owner asks the AI to build get the same shape and land in `apps.catalog` or `agents.*`.

---

## 7. One install command

From a fresh machine, with ports free:

```bash
git clone <nodeos-core-url> nodeos && cd nodeos
./install.sh --start
```

`install.sh` already exists in this portable kit. It must (and the product version will) :

1. Read `nodeos.manifest.json` and `.env.example`.
2. Use `${HOME}`, `${NODE_DATA}`, `${NODE_HOST}`, and env ports — no path edits after clone.
3. Pull or submodule `nodeos-shell`, `nodeos-apps`, `nodeos-agents`, `nodeos-display` at the versions the manifest pins.
4. Build core + shell, write env, start daemon, door, home, and hub.
5. Refuse to clobber a NODE already bound to the default ports; the caller passes `--port` / `--data` for a second copy (as this portable kit already documents).

Docker alternative, same manifest:

```bash
docker compose up -d
```

Caddy / Authelia is a compose profile (`caddy`), not a required first start.

After install, the owner opens the shell, signs in once, and uses the built-in AI chat.

---

## 8. How the built-in AI chat builds new apps and modules

This is a product flow, not a second factory in the Grok Bot replica.

1. The owner types what they need in the NODE ask bar / Agents chat (Jarvis is the front door; Paperclip is the orchestrator).
2. Paperclip plans the work as one or more **modules**, each with a draft manifest (purpose, inputs/outputs, `connectsTo`).
3. The **one approval gateway** shows the plan and waits.
4. On approval, the module is written into the correct product repo (`nodeos-apps` for an app, `nodeos-agents` for an agent, `nodeos-display` for a board, `nodeos-shell` only if a new screen is required).
5. The catalog / connection map updates from the manifest. The new tile appears in the right section (Apps group or Agents), never in two places, never as a mystery URL.
6. Nothing existing is deleted to make room. If the new module replaces a function, the old copy is archived and the duplicates-collapsed table is updated.

---

## 9. Live component mapping (nothing lost)

Every component seen on the live NODE or in the 9 November audit, mapped to a product home.

### 9.1 Core and shell

| Live component | Product home |
|---|---|
| Live Boxes daemon + shell (`node-box` on `:7770`) | Source for `nodeos-core` + `nodeos-shell`; stay running here until cutover |
| `node-daemon` published split | Merges into `nodeos-core` |
| `node-shell` published split | Merges into `nodeos-shell` |
| `node-door` `:7700` | `nodeos-core` |
| `node-home` `:7690` | `nodeos-core` |
| `node-mcp-hub` `:7790` | `nodeos-agents` |
| `node-helpers`, `node-infra`, `node-services`, `node-kit-runtime`, `ai-stack-kit`, `node-tunnel` | Cherry-pick into `nodeos-core` modules |
| Portable kit `install.sh` / compose / manifest | `nodeos-core` |
| Files, Calendar, Settings, Automations screens | `nodeos-shell` |
| System screen + vitals tile | `nodeos-shell` UI; data from `nextgent-vitals` + daemon `/api/status` `/api/system` `/api/services` `/api/control` |
| Call my computer / Talk to NODE / Ask bar | `nodeos-shell` chrome + `nodeos-agents` voice/call modules |

### 9.2 The 21 web apps in `config/webapps.json`

| Catalog id | Name | Product home |
|---|---|---|
| `openjarvis` | OpenJarvis | Own repo `openjarvis-node`; contract in `nodeos-agents`; **Agents**, not Apps |
| `paperclip` | Paperclip | Pin `paperclip-node`; contract in `nodeos-agents`; **Agents**, not Apps |
| `rakazo` | Rakazo | Own repo; `nodeos-apps` |
| `twenty-crm` | Twenty CRM | `nextgent-runtimes` + catalog |
| `crm2` | CRM 2 | Same, until retired |
| `n8n` | n8n | Official image + `nextgent-n8n`; catalog + Automations |
| `notes` | Notes | Catalog (AppFlowy) |
| `desktop` | Desktop | Catalog (Selkies) |
| `openclaw` | OpenClaw | Pin + workspace; Agents contract; catalog UI |
| `uptime-kuma` | Uptime Kuma | Catalog |
| `navidrome` | Navidrome | Catalog |
| `searxng` | SearXNG | Official image + config module; catalog |
| `llama-swap` | llama-swap | Catalog |
| `supabase` | Supabase | `supabase-local` config; catalog; no volumes in git |
| `pos` | POS | Catalog (Odoo; container state was unverified in the audit) |
| `tickets` | Tickets | Catalog (Pretix; unverified in the audit) |
| `kamra` | Kamra | Catalog (unverified in the audit) |
| `litellm` | LiteLLM | Official image + config; catalog |
| `minidlna` | MiniDLNA | Catalog |
| `mcp` | MCP Hub | Same process as `agents.hub`; one tile, in System/Agents — not a second hub |
| `crawl4ai` | Crawl4AI | Catalog |

Grok Bot is a first-class agent even if it is missing from `webapps.json`. It is not dropped.

### 9.3 Other live / kept modules

| Live component | Product home |
|---|---|
| Hermes | `hermes-agent` + agents contract |
| `nextgent-jarvis` | Own app, not OpenJarvis |
| `nextgent-vitals` | Vitals owner |
| `nextgent-phone` / node-sms `:7772` | Agents SMS |
| `nextgent-chat` `:7780` | Agents chat |
| `node-pccall` `:7794` | Agents call |
| `node-voice` | Agents voice (status was unclear in the audit — keep, investigate, do not delete) |
| `node-tv-session` | `nodeos-display` |
| MagicMirror fork | Optional `nodeos-display` module |
| `gcr-api-clean` | Business API owner candidate |
| `Admin-dashboard-main` | CyberCheck admin app |
| `Dashboards-users-` | Business user dashboard (separate function) |
| `gbrain` | Own pin (`:3131`) |
| `scrapers`, `second-brain`, `ai-chat-logger`, `smsgw-relay` | Data / relay modules; data stays off git |
| `approval-gateway` | Agents approval |
| `sms-door` | Agents SMS entry |

### 9.4 Explicitly not the product

| Item | Why it stays out of the sellable set |
|---|---|
| Grok Bot replica dashboard | Matt: do not build from that |
| Hardcoded 21.5" layout | May be a 100" TV; layouts are fluid |
| Whole-repo forks of Twenty, n8n, SearXNG, LiteLLM, MagicMirror as the thing you ship | Pins / official images + config; cherry-pick only |
| Instance data (Paperclip DB, Supabase volumes, n8n data, scrapers / second-brain vaults, chat-logger data) | Stay on the machine, never in the product git |
| Plasma / xrdp / LightDM / HDMI / the Windows laptop | Out of scope |
| Unpublished `boxes-sysmon` deployed onto live NODE | Map only in this pass |

---

## 10. What this portable tree already does vs what is still a proposal

Already in `/home/steve/build/node-portable-20261109/`:

- `install.sh`, `docker-compose.yml`, `Caddyfile.example`, `nodeos.manifest.json`
- Portable env/port contract
- Source copies of Boxes, node-shell, node-daemon, node-door, node-home, node-mcp-hub
- Clean UI work on `design/clean-ui-20261109` (sectioned home, distinct TV board, System page) to match `MATT-REQUIREMENTS.md`

Still proposal (not executed by this document):

- Creating the five GitHub product repos and cherry-picking into them
- Cutover off live Boxes
- Authelia in front of a single origin (example Caddyfile exists; not fully tested here)
- Reconciling `/opt/node-approvals/app` with `approval-gateway`
- Folding GPU/power from `nextgent-vitals` into `/api/status` (the clean System card currently uses daemon status and notes the gap)
- Picking one GCR API/front-end SHA and retiring CRM 2
- Publishing this kit as `nodeos-core`

---

## 11. Unverified in this pass

- IMG_6679–6682 (9 Nov phone shots of frame bugs) were not on disk; requirements describe them from chat only.
- MCP hub, Authelia, and app frames were not fully re-tested in the portable run.
- GPU / power vitals are not in current `/api/status`.
- POS, Tickets, and Kamra containers were not in `docker ps` during the 9 Nov audit.
- `node-voice` unit status was unclear.
- This structure has not been applied to GitHub (no new repos, no push).

---

## 12. Design implication for the UI already in this kit

The clean look in `design/clean-ui-20261109` must keep matching `MATT-REQUIREMENTS.md`:

- Phone home: sections Today, Agents, Apps (grouped, agents removed from the grid), Automations, System. Bottom nav Home / Apps / Agents / Files / Settings. Keep Call my computer and Talk to NODE.
- Desktop: same data, sidebar, Automations in desktop nav, spacious chrome.
- TV (`?tv=1`): distinct ambient board (clock, weather, agenda, agent status, vitals, alerts), fluid typography, no phone tab bar.
- Every live app and agent remains reachable. Nothing dropped for cleanliness.
