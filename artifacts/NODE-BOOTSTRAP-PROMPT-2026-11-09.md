# NODE zero-omission bootstrap prompt — 2026-11-09

**Status:** RECONSTRUCTED. The original ~450-line bootstrap prompt was not found on this box (`/workspace`, `/home/box`) or on steve-MS-7C02 (`/home/steve`, including `~/artifacts`, `~/ang/src/boxes`, `~/_work`). This document is rebuilt from:

- `/workspace/artifacts/full-state-research-2026-11-09.md` (observed ~3:35–3:44 PM CST)
- `/home/steve/artifacts/sprawl-audit-20261109/` (`inventory.md`, `plan.md`, `execution-20261109.md`, `portability.md`, `running.tsv`, `repos.tsv`, plus supporting inventories)

Hostname names in §6 also use `CultureReset/Boxes` `config/webapps.json` (already in this repo) joined to the cloudflared port list in `portability.md`.

**Machine:** steve-MS-7C02 (`ce6bda5c-c0ec-4471-9e53-7827decdc497`), home `/home/steve`, timezone America/Chicago (CST, UTC-6 on this date).  
**As-of:** sprawl execution completed ~3:50 PM CST, 2026-11-09. Live Boxes tree remains `/home/steve/ang/src/boxes` on `fix/node-pwa-inframe-apps` at `5b7e39c`.  
**Rules used while writing this:** no secret values, tokens, passwords, JWTs, connection strings, or enrollment fragments. Environment template uses variable **names** and placeholders only. Do not `docker compose down -v`, do not restart `node-box.service` from this document, and do not touch `/home/steve/ang/src/boxes-sysmon`.

Facts not present in those sources are marked **TODO**.

---

## 0. How to use this document

This is a bootstrap *prompt and inventory* for standing up or understanding the NODE desktop on this class of machine. It is **not** a “clone and it works” installer. `portability.md` recorded **174 break**-severity hardcoded paths (`/home/steve`, `/hdd`, tailnet hostname `steve-ms-7c02.tail1af4f2.ts.net`, tailnet IP `100.104.20.101`, `/opt/node-approvals`). A fresh machine must substitute `${HOME}`, `${DATA_ROOT}`, `${TAILNET_HOSTNAME}`, and `${TAILSCALE_IP}` (see §9).

On *this* box, keep running paths where they are. New CultureReset repos were published from scratch clones; live trees were not moved and were not converted into checkouts.

---

## 1. This-box facts

| Item | Value |
|---|---|
| Hostname (OS) | steve-MS-7C02 |
| Tailnet DNS | `steve-ms-7c02.tail1af4f2.ts.net` |
| Tailscale IPv4 | `100.104.20.101` |
| NODE listen | `127.0.0.1:7770` and `100.104.20.101:7770` (HTTP 200 when last checked) |
| NODE kiosk | transient `node-tv-live.service`: Chrome `--kiosk http://127.0.0.1:7770/?tv=1` on **DISPLAY=:0**, profile `~/.config/node-tv-session/chrome-profile` |
| node-box DISPLAY | `:10.0` (XRDP/XFCE session, **not** the HDMI console) |
| Disk (audit 3:24 PM CST) | `/` 325G used / 938G (then ~566G free) |
| Photo backup (local) | `/home/steve/ang/var/backup/photos` — 22,529 files, 19,239 images, 7.2G (not `/ang/var/backup/photos`) |
| Personal Pictures | `/home/steve/Pictures` — 49 files, 36 images (not the CyberCheck gallery) |

CultureReset GitHub org is the home for component repos (289 repos existed at audit time). Boxes remains the glue repo; daemon and shell also now exist as standalone private repos (live service still starts from the Boxes tree).

---

## 2. Clone commands with exact SHAs

All URLs are `https://github.com/CultureReset/<repo>.git` unless noted. Prefer a detached checkout (or a throwaway branch) at the pinned SHA. Do not force-push. Do not point `node-box.service` at a new checkout until Matt approves a cutover.

### 2.1 Core NODE (glue + split sources)

```bash
# Glue repo — this is what node-box.service still runs from on this box
git clone https://github.com/CultureReset/Boxes.git
cd Boxes
git checkout 5b7e39cefecec4d555cfbffa66e7bce2532d856c
# branch name on this box: fix/node-pwa-inframe-apps
# full SHA confirmed in execution + research

# Standalone daemon (history split from Boxes daemon/; live unit is NOT retargeted)
git clone https://github.com/CultureReset/node-daemon.git
cd node-daemon
git checkout 3f1531bb82a2f3901246365904627e0ba34cfc13   # main

# Standalone shell (history split from Boxes shell/; do not confuse with nextgent-shell)
git clone https://github.com/CultureReset/node-shell.git
cd node-shell
git checkout 75f28f73adaf01f35ff8f2fab71158c0965f5387   # main

# TV kiosk scripts (Chrome profile must stay local — never commit it)
git clone https://github.com/CultureReset/node-tv-session.git
cd node-tv-session
git checkout bb5fce7
# TODO: full 40-char SHA was not recorded in the source reports; confirm with git rev-parse
```

`Boxes` GitHub was **not** rewritten when daemon/shell were split. The running worktree `/home/steve/ang/src/boxes` is still the combined tree at `5b7e39c`. Unpushed and **do not touch:** worktree `/home/steve/ang/src/boxes-sysmon`, branch `feat/node-system-monitor` @ `494941fce23345c55c50e7de933ea9fc877b687d` (ahead 1 / behind 1 of `fix/node-pwa-inframe-apps`).

Related but not the live NODE tree: `CultureReset/nextgent-vitals` (local `/home/steve/ang/src/node-vitals`, `main` @ `82b978a`, not running). **Do not** create a new `node-vitals` repo.

### 2.2 New private repos created 2026-11-09 (compose/config only; no live data)

```bash
git clone https://github.com/CultureReset/rakazo.git
cd rakazo
git checkout 774c6a926ec9b8ca284c573dcd7fac66e26f83e7
# contains compose files, bin/ proxies, install-images.sh, restrict-computer-egress.sh,
# LOCAL.md, .env.images.example, UI overrides. No .env, sockets, or volumes.

git clone https://github.com/CultureReset/supabase-local.git
cd supabase-local
git checkout 3af12d040c24eb1d4afef4effa2df7c8dd69046b
# official compose/scripts, sanitized .env.example, docker-compose.override.example.yml
# (includes this box’s tailnet IP — replace with ${TAILSCALE_IP}), volume SQL/function
# templates only. No live .env or DB data. First commit was 1d1dcbc.
```

On this box the *running* trees remain `/home/steve/apps/rakazo` and `/home/steve/supabase` (not git checkouts).

### 2.3 MCP hub (already-git, pushed 2026-11-09)

```bash
git clone https://github.com/CultureReset/node-mcp-hub.git
cd node-mcp-hub
git checkout 276eb44391161bf5ef4e532f3bfcf7faaff2066a
# branch: approval-gateway-enforce
# ancestor 80e0c5cf1774a010d83a73dd76ab747e0dba4b33 ("add computer-use-linux to MCP hub") is on this branch
```

Live path: `/home/steve/agents/mcp`. Unit `node-mcp-hub.service`, port `127.0.0.1:7790` (HTTP 401 = process up, auth required).

### 2.4 Import branches (`import/live-20261109`) — published 2026-11-09

These were imported from live untracked trees into *scratch* clones. Live directories were not converted to checkouts.

```bash
# node-home — live /home/steve/node-home
git clone https://github.com/CultureReset/node-home.git
git -C node-home checkout 129ef783cb4c7989b6425d6b64b3e6d3184ea1bb

# node-helpers — live scripts from /home/steve/ang/bin (no binaries/models)
git clone https://github.com/CultureReset/node-helpers.git
git -C node-helpers checkout 4a80ed16d5c4610bc3e22a7aa2d2f73ac163babf

# scrapers — live /home/steve/scrapers (symlink to /hdd); data and vendored lib not imported
git clone https://github.com/CultureReset/scrapers.git
git -C scrapers checkout 4f1bb930f41085b6f0470b76f8e9aa447d87199f

# second-brain — live /home/steve/second-brain; vault/data not imported
git clone https://github.com/CultureReset/second-brain.git
git -C second-brain checkout 6dee8cf29b40a31f056e2f4d3914631ccba240b1

# smsgw-relay — live /home/steve/smsgw/relay
git clone https://github.com/CultureReset/smsgw-relay.git
git -C smsgw-relay checkout 150a7028f57bcdb47b9fc7820513c615b1a510f7

# ai-chat-logger — code only; 6.9G data dir was NOT imported
git clone https://github.com/CultureReset/ai-chat-logger.git
git -C ai-chat-logger checkout 7a73929a86d2ff694cef4684074fb37b2dc61862

# openclaw-workspace — notes only; API key file not copied
git clone https://github.com/CultureReset/openclaw-workspace.git
git -C openclaw-workspace checkout 449816e3166315a874a6b16bcd6817316349aef4

# nextgent-runtimes — added twenty/docker-compose.yml + setup_twenty.py (the :3000 stack)
git clone https://github.com/CultureReset/nextgent-runtimes.git
git -C nextgent-runtimes checkout 007c03d38128dc5e9e8b2f0344f7748232b5c75d

# nextgent-n8n — added sandbox/docker-compose.yml (no .env, .tls, or data volume)
git clone https://github.com/CultureReset/nextgent-n8n.git
git -C nextgent-n8n checkout dcb5a884630f56d14503623eb14e63cb3da4940c
```

**Skipped:** `CultureReset/paperclip-node` — existing history already flagged by gitleaks (95 findings, mostly tests/docs). Live Paperclip is an npm install + instance DB; no config-only import was pushed.

### 2.5 Forks — keep upstream `origin`, CultureReset is a second remote

```bash
# OpenJarvis (running checkout: /home/steve/.openjarvis/src)
git clone https://github.com/open-jarvis/OpenJarvis.git openjarvis
cd openjarvis
git checkout 5e5f5efde4bfcf8a60fe70d1cea12a0185f615ec
git remote add cultureReset https://github.com/CultureReset/openjarvis-node.git
# On this box, origin remains upstream; cultureReset was added; branch matt/local-20261109
# was pushed at the same SHA. Four local changes are NOT on GitHub:
#   modified: src/openjarvis/mcp/loader.py
#   modified: src/openjarvis/system/builder.py
#   untracked: src/openjarvis/mcp/loader.py.bak-20261021
#   untracked: src/openjarvis/system/builder.py.bak-20261021
# This pin is 94 commits behind upstream main (as of the 2026-11-09 audit).

# Hermes (installed at /home/steve/.hermes/hermes-agent; process was NOT running)
git clone https://github.com/NousResearch/hermes-agent.git hermes-agent
cd hermes-agent
git checkout d923a5eb487a17c0a68801bba9ef0f56c81040a8
git remote add cultureReset https://github.com/CultureReset/hermes-agent.git
# cultureReset branch matt/local-20261109 is at this SHA. Do not use ang/src/hermes
# (older pin 00570550f3) as the install.
```

### 2.6 Other already-on-GitHub components (SHAs as recorded, or TODO)

| Repo | Live / canonical path | Recorded ref | Notes |
|---|---|---|---|
| `node-door` | `/home/steve/agents/node-door` | on `origin/local-history` | dirty=1 untracked; do not commit secrets. Unit listens `127.0.0.1:7700` |
| `node-pccall` | `/home/steve/agents/node-pccall` | `local-history` | running |
| `node-voice` | `/home/steve/agents/node-voice` | `local-history` | unit inactive at audit |
| `sms-door` | `/home/steve/agents/sms-door` | `local-history` | unit inactive at audit |
| `approval-gateway` | `/home/steve/agents/approval-gateway` | `local-history` | distinct from running `/opt/node-approvals/app` |
| `node-approval-grants` | (portable source) | TODO confirm SHA | running code stays at `/opt/node-approvals/app` (NOT git) |
| `nextgent-chat` | `/home/steve/ang/src/node-chat` | TODO confirm SHA | running; dirty=2 at audit |
| `nextgent-phone` | `/home/steve/ang/src/node-phone` | running branch `approval-gateway` `eed44fd` | dirty=2; local `main` differed from GitHub `main` |
| `twenty-CRM` | `/home/steve/ang/src/twenty-CRM` | TODO | **source fork only** (~1.9G). Not what is running |
| `n8n` (public fork) | `ang/apps/n8n` | TODO | upstream fork; live editor is the official image, not this tree |
| `gbrain` | bun install `~/.bun/bin/gbrain` | TODO | `GBRAIN_HOME=%h/SecondBrain/gbrain` |
| `openclaw` | npm global under nvm v24.22.0 | TODO | running gateway is **not** a git worktree |
| `Linux-` | `/home/steve/ang/repos/Linux-` | `513e596` | different repo, not Boxes |

---

## 3. Docker stacks / compose + ports

Observed 2026-11-09 (audit / research). Official-image stacks have no git checkout at the running path.

### 3.1 Running (keep up)

| Project / container | Path / compose | Host ports (published) | Role / notes |
|---|---|---|---|
| `twenty` (`twenty-server-1`, `twenty-worker-1`, `twenty-db-1`, `twenty-redis-1`) | `/home/steve/twenty/docker-compose.yml` | **`127.0.0.1:3000->3000`** (db/redis not published on loopback in the inventory) | Official `twentycrm/twenty` image. **NODE CRM tile**, MCP hub, door, `crm.voicecommandapi.com`. `/healthz` 200. `node-mcp-hub.service` ExecStartPre waits on `http://127.0.0.1:3000/healthz`. Restart `unless-stopped`. **No systemd unit.** Compose also published to `nextgent-runtimes` @ `007c03d`. |
| `nextgent-twenty` (`nextgent-twenty-server`, `-worker`, `-redis`) | `/home/steve/nextgent/apps/twenty-runtime/docker-compose.yml` | **`127.0.0.1:3020->3000`** | Official `twentycrm/twenty` image. Redis only, **no local Postgres**; attached to external network `supabase_default`. NODE slug `crm2`, hostnames `crm2.` and `nextgent-crm.voicecommandapi.com`. **Referenced — do not remove** until those tiles and hostnames are retired. |
| `n8n` (no compose project) | official `docker.n8n.io/n8nio/n8n:latest` | **`127.0.0.1:5678->5678`** | Live editor/webhooks. Volume `n8n_data` (multi-GB; do not dump). Networks `bridge` + `supabase_default`. Frame slug `n8n`, servePort 25443, `automations.voicecommandapi.com`. Container env mentioned a webhook port 5443; live Tailscale serve was **:25443 → 17804**. Recreate via ports + `WEBHOOK_URL` + volume, not a repo path. |
| `n8n-sandbox` (`n8n-sandbox-runner-1`, `n8n-sandbox-sandbox-api-1`) | `/home/steve/n8n-sandbox/docker-compose.yml` | **no host ports** | Official n8n sandbox / DinD, not a second editor. On `supabase_default`. Live `n8n` has **no sandbox-related environment variables** — use is **ambiguous**; leave running. Compose (no secrets) published to `nextgent-n8n` @ `dcb5a88`. |
| `rakazo` | `/home/steve/apps/rakazo/docker-compose.images.yml` + `docker-compose.override.yml` + `docker-compose.litellm-proxy.yml` | **`127.0.0.1:45173->5173`** (web), **`127.0.0.1:43100->3100`** (api). Env name `RAKAZO_WEB_PORT`. | Images `ghcr.io/elie222/rakazo/*:edge`. Running: web, worker, api, supervisor, postgres, litellm-proxy, mcp-hub-proxy. Exited oneshots: data-init, migrate, computer (exit 0). Unit `rakazo-stack.service` is a oneshot (`active/exited` after start). **Do not `docker compose down -v`** (LOCAL.md). Public hostname still behind Cloudflare Access (`X-Frame-Options: DENY`, `servePort: 0`). |
| `supabase` (11 containers) | `/home/steve/supabase/docker-compose.yml` + `docker-compose.override.yml` | Studio **`127.0.0.1:54323->3000`**. Pooler/Postgres **`127.0.0.1:5432`** and **`100.104.20.101:5432`**, **`:6543`** same bind pattern. Envoy/API **`127.0.0.1:8001->8000`** and **`100.104.20.101:8001`**. | Official Supabase images (studio, storage, edge-functions, meta, pooler, auth, realtime, rest, envoy, db, imgproxy). Override hardcodes this box’s tailnet IP. Data volumes stay on disk. |
| `litellm` + `litellm-db` | no compose working_dir in inventory; config tree `/home/steve/api-gateway` is **NOT git** | LiteLLM loopback **`:4000`**. `litellm-db` **`127.0.0.1:5433->5432`**. | Image `ghcr.io/berriai/litellm:v1.105.1`. `https://api.voicecommandapi.com/` is tunneled here (`cloudflared-ai-gateway.service`). `HEAD /health` returns 405 (`Allow: GET`). `x-frame-options: DENY` / `frame-ancestors 'none'` on the public host. |
| `uptime-kuma` | official `louislam/uptime-kuma:2`, no compose dir | **host network**, listener **`127.0.0.1:3002`** | Data bind `uptime-kuma:/app/data`. Frame slug `uptime-kuma`, servePort **27443**. `services-control.json` lists a *different* URL port **:7443** — verify live `tailscale serve status` (**TODO**). |
| `searxng` | official `searxng/searxng:latest` | **`127.0.0.1:8888->8080`** | Frame slug `searxng`, servePort 29443. |
| `crawl4ai` | official image, no compose dir | host/publish **TODO** (frame upstream `http://127.0.0.1:11235`) | Frame servePort 32443; webapps URL is Tailscale `:12443/playground` (discrepancy — **TODO** verify). |

### 3.2 Present but not running (do not start from this document)

| Project | Path | Notes |
|---|---|---|
| `~/nextgent/n8n` | compose would publish **:5680** | Nothing listened on 5680. Has a local `data/` directory. Not referenced by NODE/door/cloudflared/systemd/node-home in the scoped search. Leave in place; do not delete data. |
| `nextgent-pos` / Odoo | `/home/steve/nextgent/apps/odoo-runtime` | Exited. Frame slug `pos` upstream `:8069`, servePort 0. |
| `nextgent-pretix` | `/home/steve/nextgent/apps/pretix-runtime` | Exited. Frame slug `tickets` upstream `:8345`, servePort 0. |
| `kamra-runtime` | was `/tmp/schema-load/kamra-runtime` | Exited. Frame slug `kamra` upstream `:8090`, servePort 0. |
| `nextgent-engine-contract-v01` db | `/home/steve/nextgent/nextgent-engine-contract-v0.1` | Exited. |
| `appflowy-cloud` | `/home/steve/appflowy-cloud` | Exited (10 containers). Frame slug `notes` upstream `:8025`, servePort 0. |

---

## 4. Systemd units

### 4.1 Core NODE / agents (user units unless noted)

| Unit | State at audit | Exec / source (this box) | Ports / notes |
|---|---|---|---|
| `node-box.service` | active/running | `node /home/steve/ang/src/boxes/daemon/dist/index.js`, WorkingDirectory `/home/steve/ang/src/boxes` | `:7770`. Env keys in §7. Restart=on-failure, RestartSec=3. Drop-in `node-box.service.d/boot-order.conf`. **Do not restart from this doc.** |
| `node-tv-live.service` | active/running (transient) | Chrome kiosk on DISPLAY=:0 | URL `http://127.0.0.1:7770/?tv=1`. Scripts live in `node-tv-session`; profile is local. |
| `node-mcp-hub.service` | active/running | `%h/agents/mcp/.venv/bin/python %h/agents/mcp/hub.py` | `:7790`. ExecStartPre: wait 90s for Twenty `:3000/healthz`, LiteLLM `:4000/health/liveliness`, Paperclip `:3100/api/health`. |
| `node-door.service` | active/running | `/home/steve/agents/node-door/.venv/bin/python` | `127.0.0.1:7700` |
| `node-home.service` | active/running | `/home/steve/node-home` | static + `frame_proxy.py` |
| `node-chat.service` | active/running | `/home/steve/ang/src/node-chat/server.js` | drop-in loads `~/.config/litellm/litellm.env` (values not recorded) |
| `node-sms.service` | active/running | nvm node v22.23.3 under `/home/steve/ang/src/node-phone` | |
| `node-pccall.service` | active/running | nvm node v22.23.3 | |
| `node-tunnel.service` | active/running | `~/.local/share/node-tunnel/chisel` | uses `~/.config/nodeos/door/chisel.key` and `chisel-users.json` (do not commit) |
| `openjarvis.service` | active/running | `~/.openjarvis/src/.venv/bin/python` | API `127.0.0.1:8000` (`/health` 200) |
| `openjarvis-ui.service` | active/running | Vite in `~/.openjarvis/src/frontend` | `127.0.0.1:5173` (HTTP 200) |
| `paperclipai.service` | active/running | `~/.local/bin/paperclipai run --instance default` | `127.0.0.1:3100`. `PAPERCLIP_HOME` → `~/.paperclip` |
| `openclaw-gateway.service` | active/running | nvm node v24.22.0 global `openclaw ... gateway --port 18789` | `127.0.0.1:18789` and `[::1]:18789`. Drop-in loads `~/.config/xai/xai.env` (values not recorded) |
| `gbrain.service` | active/running | `%h/.bun/bin/gbrain serve --http --port 3131 --bind 127.0.0.1 --suppress-bootstrap-token` | `127.0.0.1:3131`. `GBRAIN_HOME=%h/SecondBrain/gbrain` |
| `gbrain-audit-gw.service` | active/running | `~/second-brain/bin/mcp-audit-tap.py` | `127.0.0.1:3130` → upstream `:3131` |
| `llm.service` | active/running | `/home/steve/ang/bin/llama-swap` + `/home/steve/ang/etc/llama-swap.yaml` | `:8080` (llama-swap, **not** LiteLLM) |
| `rakazo-stack.service` | active/exited (oneshot) | compose up via the three rakazo compose files + `.env` | starts the stack; do not down -v |
| `rakazo-litellm-proxy.service` | active/running | `~/apps/rakazo/bin/litellm-auth-proxy.py` | |
| `rakazo-litellm-unix-proxy.service` | active/running | `~/apps/rakazo/bin/litellm-unix-proxy.py` | socket `~/apps/rakazo/run/litellm.sock` |
| `rakazo-mcp-hub-unix-proxy.service` | active/running | `~/apps/rakazo/bin/unix_to_tcp_proxy.py` | socket `~/apps/rakazo/run/mcp-hub.sock` |
| `smsgw-relay.service` | active/running | `/home/steve/smsgw/relay/relay.py` | |
| `ai-chat-logger.service` | active/running | `~/.local/share/jarvis-send/ai_chat_logger.py` | data dir ~6.9G — do not publish |
| `asr-shim.service` | active/running | `/home/steve/ang/bin/asr-shim.py` | |
| `navidrome.service` | active/running | `~/.local/share/navidrome/navidrome` | frame upstream `:4533` |
| `ntfy.service` | active/running | `~/.local/bin/ntfy` | |
| `selkies-desktop.service` | active/running | `~/.local/bin/selkies-desktop` | frame slug `desktop` upstream `:8081` |
| `x11vnc-console.service` | active/running | uses `~/.Xauthority` and `~/.vnc/passwd` | same-screen console path |
| `cloudflared-ai-gateway.service` | active/running | `~/.local/bin/cloudflared` + `~/.cloudflared/config.yml` | public `*.voicecommandapi.com` + `api.voicecommandapi.com` (see §6) |
| `node-approval-gateway.service` | **system**, active/running | `/opt/node-approvals/app/gateway.py` | MCP/door talk to n8n via `http://127.0.0.1:7795/n8n-ro/...` |
| `sudo-runner.service` | **system**, active/running | `/usr/local/lib/sudo-runner/sudo-runner.py` | |

### 4.2 User units that were inactive/dead at audit (do not auto-start)

`cloudflared-litellm.service`, `sms-door.service` (source under `~/agents/approval-gateway`), `node-health.service`, `tailscale-serve-apply.service` (helper `/home/steve/ang/bin/tailscale-serve-apply`), `paperclip-approval-bridge.service`, `local-universal-query.service`, `ollama.service` (**system**, dead), plus several scraper/watcher units (`hotel-websites-*`, `google-hotels-scraper`, `dockside-scraper`, `mygulfcoastchamber-scraper`, `gulfshores-worker2`, `second-brain-logrotate`).

### 4.3 Scraper receivers that *were* running

`beachball-receiver`, `brettrobinson-receiver`, `gmaps-recv`, `gulfshores-recv`, `gulfshores-scraper`, `southbaldwin-receiver`, `youngssuncoast-receiver`.

---

## 5. NODE frames and Tailscale serve ports

Bindings come from Boxes `config/frames.json` (portability table). `frameUrlFor()` prefers `https://steve-ms-7c02.tail1af4f2.ts.net:${servePort}` unless `NODEOS_FRAME_SAME_ORIGIN=1`. Slugs with **`servePort: 0`** fall back to the public `*.voicecommandapi.com` hostname (Cloudflare Access will deny framing when that host sends `X-Frame-Options: DENY`).

| slug | upstream | localPort (frame proxy) | servePort (Tailscale) | Confirmed live serve (execution) |
|---|---|---|---|---|
| openjarvis | `http://127.0.0.1:5173` | 17801 | **20443** | TODO (not re-dumped) |
| twenty-crm | `http://127.0.0.1:3000` | 17802 | **26443** | **yes:** `:26443` → `http://127.0.0.1:17802` |
| paperclip | `http://127.0.0.1:3100` | 17803 | **30443** | TODO |
| n8n | `http://127.0.0.1:5678` | 17804 | **25443** | **yes:** `:25443` → `http://127.0.0.1:17804` |
| litellm | `http://127.0.0.1:4000` | 17805 | **23443** | TODO |
| searxng | `http://127.0.0.1:8888` | 17806 | **29443** | TODO |
| openclaw | `http://127.0.0.1:18789` | 17807 | **31443** | TODO |
| uptime-kuma | `http://127.0.0.1:3002` | 17808 | **27443** | TODO — `services-control.json` says `:7443` |
| navidrome | `http://127.0.0.1:4533` | 17809 | **24443** | TODO — `services-control.json` says `:4443` |
| crawl4ai | `http://127.0.0.1:11235` | 17810 | **32443** | TODO — `services-control.json` / webapps say `:12443` |
| llama-swap | `http://127.0.0.1:8080` | 17811 | **33443** | TODO — `services-control.json` id `llm` says `:13443` |
| notes | `http://127.0.0.1:8025` | 17812 | **0** | public hostname only |
| crm2 | `http://127.0.0.1:3020` | 17813 | **0** | public hostname only |
| pos | `http://127.0.0.1:8069` | 17814 | **0** | public hostname only (stack exited) |
| tickets | `http://127.0.0.1:8345` | 17815 | **0** | public hostname only (stack exited) |
| kamra | `http://127.0.0.1:8090` | 17816 | **0** | public hostname only (stack exited) |
| supabase | `http://127.0.0.1:54323` | 17817 | **0** | public hostname only |
| rakazo | `http://127.0.0.1:45173` | 17818 | **0** | public hostname only (Access denials) |
| desktop | `http://127.0.0.1:8081` | 17819 | **0** | public hostname only |

Additional Tailscale / door ports recorded in config and docs (not all confirmed with a live `tailscale serve status` dump):

| Port | Purpose (as documented) |
|---|---|
| **14443** | NODE itself (`services-control.json` id `node-box`; also door `origins` / `door.json`) |
| **10000** | node-door / enroll / MCP path in several binaries and docs (`…:10000`, `…:10000/mcp`) |
| **17790** | MCP hub on the tailnet (documented in `node-mcp-hub` `ADD-NEW-APP.md`) |
| **7443 / 4443 / 13443 / 12443** | see discrepancies vs `frames.json` servePorts above |

`services-control.json` also lists local-only services without a serve URL: `gbrain`, `node-chat`, `sms`, `open-webui`, `scraper-receivers`, `gulfshores-scraper`.

**Proposed kiosk fix (not applied):** point the kiosk at `https://steve-ms-7c02.tail1af4f2.ts.net:14443/?tv=1` *or* serve frames on `http://127.0.0.1:<localPort>` and add `http://127.0.0.1:7770` to `FRAME_ANCESTORS`. Today the kiosk still uses `http://127.0.0.1:7770/?tv=1`, so `door_session` is bound to `127.0.0.1` while framed apps load from the tailnet host.

---

## 6. Cloudflare tunnel hostname map

`cloudflared-ai-gateway.service` uses `~/.cloudflared/config.yml`. Portability listed ingress *origins* (ports only). Hostnames below are from Boxes `config/webapps.json` plus explicit audit/research lines. Credentials file path is **not** repeated here (see §10).

### 6.1 Confirmed or strongly joined

| Public hostname | Proxied origin | Evidence |
|---|---|---|
| `crm.voicecommandapi.com` | `http://127.0.0.1:17802` (Twenty `:3000` via NODE frame) | execution log |
| `crm2.voicecommandapi.com` | `http://127.0.0.1:17813` (Twenty `:3020` via NODE frame) | execution log |
| `nextgent-crm.voicecommandapi.com` | `http://127.0.0.1:17813` (same) | execution log |
| `automations.voicecommandapi.com` | `http://127.0.0.1:17804` (n8n `:5678` via NODE frame) | execution log |
| `status.voicecommandapi.com` | `http://127.0.0.1:17808` (Uptime Kuma `:3002`) | research + webapps + config.yml:72 |
| `rakazo.voicecommandapi.com` | `http://127.0.0.1:17818` (Rakazo `:45173`) | webapps + config.yml:92 + research. **Cloudflare Access** in front (`autumn-bread-a4ec.cloudflareaccess.com`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`). |
| `api.voicecommandapi.com` | LiteLLM `http://127.0.0.1:4000` | research (`cloudflared-ai-gateway`). Public `/` HTTP 200, `/v1/` 404, `HEAD /health` 405. **`:4000` does not appear in the portability extract of `config.yml` ingress ports — TODO confirm the exact ingress block.** |
| `jarvis.voicecommandapi.com` | `http://127.0.0.1:17801` | webapps + config.yml:36 |
| `paperclip.voicecommandapi.com` | `http://127.0.0.1:17803` | webapps + config.yml:40 |
| `hub.voicecommandapi.com` | `http://127.0.0.1:7790` | webapps + config.yml:44 (open=tab; Bearer API) |
| `notes.voicecommandapi.com` | `http://127.0.0.1:17812` | webapps + config.yml:20 (AppFlowy; stack was exited) |
| `desktop.voicecommandapi.com` | `http://127.0.0.1:17819` | webapps + config.yml:111 (Selkies) |
| `openclaw.voicecommandapi.com` | `http://127.0.0.1:17807` | webapps + config.yml:80 |
| `music.voicecommandapi.com` | `http://127.0.0.1:17809` | webapps + config.yml:76 |
| `search.voicecommandapi.com` | `http://127.0.0.1:17806` | webapps + config.yml:88 |
| `llm.voicecommandapi.com` | `http://127.0.0.1:17811` (llama-swap `:8080`; webapps path `/ui`) | webapps + config.yml:84 |
| `supabase.voicecommandapi.com` | `http://127.0.0.1:17817` | webapps + config.yml:68 |
| `pos.voicecommandapi.com` | `http://127.0.0.1:17814` | webapps + config.yml:56 (Odoo stack exited) |
| `tickets.voicecommandapi.com` | `http://127.0.0.1:17815` | webapps + config.yml:60 (Pretix stack exited) |
| `kamra.voicecommandapi.com` | `http://127.0.0.1:17816` | webapps + config.yml:64 (stack exited) |

LiteLLM admin in webapps is `https://api.voicecommandapi.com/ui/` with `open=tab` (comment: public `/ui` blocked from framing).

MiniDLNA in webapps is **not** Cloudflare: `http://100.104.20.101:8200/` (`open=tab`).

### 6.2 Ingress origins in `config.yml` without a hostname in the source reports

| config.yml origin | Likely service | Hostname |
|---|---|---|
| `127.0.0.1:7700` | node-door | **TODO** |
| `127.0.0.1:7710` | mentioned in node-door `CONNECT-RESEARCH.md` | **TODO** |
| `127.0.0.1:7690` (listed twice, lines 25 and 102) | unknown | **TODO** |

`cloudflared-litellm.service` was inactive/dead at audit. Full historical “21 ingress / five Funnel mounts” maps from earlier gateway work were **not** in the two source trees used here — treat any additional hostnames as **TODO** until `config.yml` is read in a secrets-safe way (hostnames and ports only).

---

## 7. Environment template (variable names only)

Copy this to a private, uncommitted file (mode 0600). **Never commit values.** Placeholders only — no live values are recorded here.

```bash
# --- machine / network ---
HOME="${HOME}"                          # do not hardcode /home/steve
DATA_ROOT="__SET_ME__"                  # this box uses /hdd (scrapers, SecondBrain via symlink)
TAILNET_HOSTNAME="__SET_ME__"           # this box: steve-ms-7c02.tail1af4f2.ts.net
TAILSCALE_IP="__SET_ME__"               # this box: 100.104.20.101  (tailscale ip -4)
APPROVAL_APP_ROOT="__SET_ME__"          # this box: /opt/node-approvals

# --- NODE (node-box.service) ---
NODEOS_HOST="__SET_ME__"                # this box sets the tailnet IPv4
DISPLAY=":10.0"                         # unit uses XRDP session; kiosk is :0
XAUTHORITY="__SET_ME__"                 # path only; typically $HOME/.Xauthority
NODEOS_LLM_URL="http://127.0.0.1:4000/v1"
NODEOS_LLM_MODEL="fast"
NODEOS_OWNER_NUMBER="__SET_ME__"        # secret; set in the unit today — do not commit
NODEOS_API_TOKEN="__SET_ME__"           # optional; writing this or platform.json bypasses the 500-char connect cap
NODEOS_FRAME_SAME_ORIGIN="0"            # set 1 to prefer http://127.0.0.1:<localPort> frame URLs
# FRAME_ANCESTORS lives in daemon/src/frameproxy.ts; today it omits http://127.0.0.1:7770

# --- MCP hub (node-mcp-hub.service) ---
HUB_HOSTS="127.0.0.1,${TAILSCALE_IP}"
HUB_PORT="7790"

# --- Paperclip / GBrain ---
PAPERCLIP_HOME="__SET_ME__"             # this box: $HOME/.paperclip
GBRAIN_HOME="__SET_ME__"                # this box: $HOME/SecondBrain/gbrain

# --- Rakazo ---
RAKAZO_WEB_PORT="45173"                 # name confirmed in ~/apps/rakazo/.env (value is this box's published port)

# --- n8n (live editor; no compose file) ---
WEBHOOK_URL="__SET_ME__"                # must match the public or tailnet URL you actually serve

# --- files that hold additional secrets (do not copy into git) ---
# $HOME/apps/rakazo/.env
# $HOME/twenty/.env                    # and/or API key files beside the compose dir
# $HOME/nextgent/apps/twenty-runtime/.env
# $HOME/n8n-sandbox/.env
# $HOME/supabase/.env                  # JWTs, service keys
# $HOME/api-gateway/config.yaml        # LiteLLM provider keys
# $HOME/.config/litellm/litellm.env    # loaded by node-chat drop-in
# $HOME/.config/xai/xai.env            # loaded by openclaw-gateway drop-in
# $HOME/.config/nodeos/platform.json   # MISSING today; baseUrl / token / slug when connected
# $HOME/.config/nodeos/door/*          # see §10
# $HOME/.config/nodeos/app-token       # referenced from MCP registry.yaml
```

Platform connect fields (when you *do* write `~/.config/nodeos/platform.json`, mode 0600): `baseUrl`, `token`, `slug`, optional `businessName`. Draft template in the specialist report used `baseUrl` `https://gcr-api-clean.vercel.app` and slug `the-hangout` as an example only. A raw Supabase access token typically expires in ~1 hour, is not refreshed by NODE, and often exceeds the 500-character `POST /api/platform/connect` cap (`daemon/src/index.ts`).

---

## 8. Security fixes (outstanding — none of these were applied in the research pass)

1. **Door cookie / frame host split (highest user-visible bug).** Kiosk loads `http://127.0.0.1:7770/?tv=1`, so `door_session` is scoped to `127.0.0.1` (Secure=0, Lax). Frames prefer `https://steve-ms-7c02.tail1af4f2.ts.net:${servePort}`. Tailscale Serve sets `X-Forwarded-Proto`, so `doorauth.ts` treats the request as remote and `requireDoor` returns HTML 401: exact text `Sign in to NODE first.` (`daemon/src/doorauth.ts` ~line 94) with a device-width viewport (looks like a “mobile” page). **Fix options:** same-origin frames (`NODEOS_FRAME_SAME_ORIGIN=1`) **and** add `http://127.0.0.1:7770` to `FRAME_ANCESTORS` in `daemon/src/frameproxy.ts`; or move the kiosk to `https://steve-ms-7c02.tail1af4f2.ts.net:14443/?tv=1` and issue `door_session` with `SameSite=None; Secure`. Requires a **node-box restart after the daemon change**, then a kiosk reload. Do not bounce the unit “just because.”

2. **Rakazo (and CRM 2 if kept) need a private Tailscale `servePort`.** Framing `*.voicecommandapi.com` through Cloudflare Access yields `XFO: DENY`. Rakazo process is up locally (HTTP 200 on `:45173` and frame `17818`); the public frame is still broken.

3. **Public credential leak on production GCR API.** Live `GET https://gcr-api-clean.vercel.app/api/gcr/entity/:slug` (`select('*')`, no allowlist) returns `menu_pin`, `ical_token`, and `menu_pin_fail_count`. Cache-Control is public (`max-age=120`). Verified on slug `the-hangout` (values not recorded). Route is **not** named `business-info`. Draft PR 113 does **not** fix this. Follow-up must stop `select('*')` and strip pin/token/lock fields.

4. **Gulf Coast Radar RLS off.** Project ref `adpnhipmdefutkzzltbs`: **128 RLS off / 54 on / 182** public tables. Specifically off: `entity_photos`, `menu_items`, `gcr_menu_items`, `menu_details`, `menu_sections`, `menu_sub_sections`, `photos`. Enabling RLS has a high blast radius — Matt-only.

5. **Owner token / connect cap.** Business-dashboard sessions are Supabase Auth JWTs (~1h `expires_in`); NODE never stores the refresh token and sends a static `Authorization: Bearer`. `POST /api/platform/connect` caps `token` at 500 characters. Preferred path: revocable slug-scoped device token (designed, not built). Do not paste impersonation or MCP keys into NODE.

6. **PR 113** (`CultureReset/gcr-api-clean`, draft, unmerged, undeployed, head `3352af8601840d2b1dde3dd996885a7fe073cc29`, base production `edb480069f21a881ebaf6cebe6cdc3cb621e5481`): adds `GET /api/health`, aliases `/api/dashboard/menu*`, field aliases, slim `GET /api/public/:slug`. Production `GET /api/health` is still 404. Deploy is a Matt decision. Until then, NODE should call `/api/dashboard/menu-items` (not the missing alias) and should not call missing `/api/health`.

7. **`~/.config/nodeos/platform.json` is missing.** User-visible message: `This box is not connected to a business yet. Open Settings and sign in.` Settings still has no connect form. NODE Pictures is only `~/Pictures`; it does not call `GET /api/gallery/:slug`. CyberCheck `public.entity_photos` count is **77,497** (project `mkepugvdlktfsossumox`).

8. **OpenJarvis sidebar** still defaults `sidebarOpen: true` (`store.ts:292`) — proposed matchMedia one-liner is not applied. Cursor/zoom: source+dist in `5b7e39c` no longer force 120% TV zoom or unguarded `cursor: none`; **the kiosk must be reloaded (F5)** to pick up the new CSS. A node-box restart is not required for that CSS/JS.

---

## 9. Portability warnings (list only — no fixes applied)

Full table: `/home/steve/artifacts/sprawl-audit-20261109/portability.md` (317 rows, 119 files).

| Severity | Count | Meaning |
|---|---|---|
| break | 174 | `/home/steve`, `/hdd`, this tailnet hostname/IP, `/opt/node-approvals` |
| box | 65 | this box’s frame/serve/listen ports |
| install | 24 | `/usr/local/...` |
| docs | 28 | README only |
| note | 26 | PATH fragments / already using `%h` |

Highest-impact: almost every custom user unit uses literal `/home/steve` or nvm version paths; NODE `frames.json` / `webapps.json` / `services-control.json` hardcode frame ports, `/home/steve/.local/share/node-icons/`, and tailnet URLs; cloudflared + door configs bind this hostname; MCP `registry.yaml` uses loopback URLs and secret-file paths; scrapers/second-brain use `/hdd`; approval gateway is under `/opt`. Proposed longer-term contract: `nodeos.manifest.json` (research §7.2) so a fresh clone does not need 174 manual edits.

Duplicate clones: 119 trees were **moved** (not deleted) to `/home/steve/_archive/2026-11-09/` (~3.87 GB / `du` 4.1G). Disk use did not drop. Running paths were not moved. Optional later delete of the archive is a Matt decision.

---

## 10. Secrets inventory (NAMES and file locations only)

Do not print, commit, or paste values. If you find a value in a worktree, redact it before any push (run gitleaks).

| Name / class | Location(s) on this box |
|---|---|
| Rakazo environment / image registry credentials | `/home/steve/apps/rakazo/.env`, `.env.bak*`, `run/*.sock` (sockets), compose volumes |
| Twenty / nextgent-twenty env and API keys | `/home/steve/twenty/.env` (and sibling key files), `/home/steve/nextgent/apps/twenty-runtime/.env` |
| Supabase JWTs / service role / DB URL | `/home/steve/supabase/.env` (`.env.example` in the published repo was sanitized) |
| n8n-sandbox env / TLS | `/home/steve/n8n-sandbox/.env`, `.tls`; live editor volume `n8n_data`; license path `~/n8n-license` (plan; do not commit) |
| LiteLLM provider keys | `/home/steve/api-gateway/config.yaml`; `~/.config/litellm/litellm.env` |
| xAI / OpenClaw provider env | `~/.config/xai/xai.env` |
| NODE owner number | unit env `NODEOS_OWNER_NUMBER` in `node-box.service` |
| NODE platform token | `NODEOS_API_TOKEN` and/or `~/.config/nodeos/platform.json` (file missing today) |
| MCP / door app token file | `~/.config/nodeos/app-token` (path referenced from `~/agents/mcp/registry.yaml`) |
| Door config, origins, machines | `~/.config/nodeos/door/door.json`, `origins`, `apps.json`, `machines.json` |
| Door enroll link (contains a secret fragment) | `~/.config/nodeos/door/enroll-link` — **do not publish this file** |
| Chisel tunnel key + users | `~/.config/nodeos/door/chisel.key`, `chisel-users.json` |
| VNC password | `~/.vnc/passwd` |
| Approval-gateway n8n key file | path held by `node-approval-gateway.service` (value not logged) |
| Paperclip instance DB / app config | `~/.paperclip/instances/default/db`, `~/.config/paperclip-app` |
| OpenClaw claimed API key (excluded from import) | `~/.openclaw/workspace/paperclip-claimed-api-key.json` |
| Cloudflare tunnel credentials | `~/.cloudflared/*.json` and `~/.cloudflared/config.yml` (config may also contain a credentials path) |
| Pay-link preview files | `~/.config/nodeos/paylinks/previews/*` (contain capability URLs — do not publish) |
| Chrome / kiosk profiles | `~/.config/node-tv-session/chrome-profile`, `~/.config/google-chrome` |
| CyberCheck / GCR entity secrets in the public API | field **names** `menu_pin`, `ical_token` on `GET /api/gcr/entity/:slug` — values must never be copied into this repo |

`CultureReset/Boxes` history was gitleaks-clean (0) at split time. Still treat `artifacts/` as public-facing documentation: names and paths only.

---

## 11. Verification checklist

Run on the target machine after clone/start. Expected results are from the 2026-11-09 pass on this box (America/Chicago). Do not treat a 401 on the MCP hub as failure.

```bash
# NODE shell
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7770/          # expect 200

# MCP hub (auth required)
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7790/mcp     # expect 401

# CRM + automations
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/healthz  # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3020/healthz  # expect 200 (CRM 2; still referenced)
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5678/         # expect 200

# OpenJarvis
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/         # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/health   # expect 200

# Rakazo local (Access may still deny the public hostname)
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:45173/        # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:17818/        # expect 200 (frame)

# Frame proxies for the two Twenties and n8n
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:17802/        # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:17804/        # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:17813/        # expect 200

# LiteLLM liveness (GET, not HEAD)
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/health   # expect 200 (HEAD is 405)

# Units
systemctl --user is-active node-box.service node-mcp-hub.service openjarvis.service openjarvis-ui.service
# expect: active (one per line)

# Git pins on this box (live Boxes must stay here until cutover)
git -C /home/steve/ang/src/boxes rev-parse --short HEAD   # expect 5b7e39c
git -C /home/steve/ang/src/boxes status -sb               # expect clean, branch fix/node-pwa-inframe-apps
git -C /home/steve/agents/mcp rev-parse --short HEAD      # expect 276eb44
```

Kiosk visual checks (after an F5, no unit restart required for CSS): pointer visible when a mouse is present; zoom at 100% unless Settings scale says otherwise. Framed apps from the kiosk will still 401 until the cookie/CSP fix lands.

GitHub pins to confirm (no live pull required on the running trees):

- `CultureReset/node-daemon` `3f1531b`
- `CultureReset/node-shell` `75f28f7`
- `CultureReset/rakazo` `774c6a9`
- `CultureReset/supabase-local` `3af12d0`
- `CultureReset/node-mcp-hub` `approval-gateway-enforce` `276eb44`
- import branches listed in §2.4
- `openjarvis-node` `matt/local-20261109` @ `5e5f5ef` (dirty patches absent)
- `hermes-agent` `matt/local-20261109` @ `d923a5e`

---

## 12. Known gaps / TODO in this reconstruction

- Original 450-line bootstrap prompt file was never located; this is a reconstruction, not a verbatim copy.
- Full 40-char SHA for `node-tv-session` `bb5fce7` and `nextgent-vitals` `82b978a` were not in the source reports.
- Live `tailscale serve status` was only sampled for Twenty `:26443` and n8n `:25443`. Other serve ports come from `frames.json` / `services-control.json` and disagree in four places (Kuma, Navidrome, llama-swap, Crawl4AI).
- Three `config.yml` ingress ports (7700, 7710, 7690) have no hostname in the sources.
- Exact Cloudflare ingress block for `api.voicecommandapi.com` → `:4000` was described in research but not present in the portability port extract.
- LiteLLM / SearXNG / Kuma / Crawl4AI **config** is still not in a CultureReset repo (`~/api-gateway` is NOT git).
- Hermes is installed but was not running. `node-vitals` is not running. System monitor commit is unpushed and must not be launched from `boxes-sysmon` against the live unit.
- Paperclip, OpenClaw, GBrain, approval-gateway (`/opt`), sudo-runner, and several binaries remain install-only (no safe source import this round).

---

## 13. What this document will not do for you

It will not replace 174 hardcoded paths, write `platform.json`, merge PR 113, enable RLS, strip the public GCR leak, assign Rakazo a `servePort`, restart `node-box`, retire CRM 2, commit OpenJarvis dirty files, or delete `~/_archive/2026-11-09/`. Those are listed in `artifacts/NODE-FULL-TODO-2026-11-09.md`.
