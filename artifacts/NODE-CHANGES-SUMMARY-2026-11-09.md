# NODE changes summary — 2026-11-09

**Machine:** steve-MS-7C02 (America/Chicago / CST)  
**Branch for this doc:** `CultureReset/Boxes` `fix/node-pwa-inframe-apps`  
**Sources (no invention):** `/home/steve/artifacts/sprawl-audit-20261109/execution-20261109.md`, `bootstrap-verification-20261109.md`, `archive-moves.json`, `portability.md`, `plan.md`, `inventory.md`; live `git` / `gh api` / service checks at write time.  
**Rule:** secret **names and file locations only** — no secret values.

This file is the single inventory of what changed on the machine and on GitHub today. It does not apply further fixes.

---

## At a glance

| Repo | GitHub URL | Branch | SHA | Status |
|---|---|---|---|---|
| Boxes (live glue + running NODE) | https://github.com/CultureReset/Boxes | `fix/node-pwa-inframe-apps` | `d9a83ca8968930a407f421c0e272b3711d72961d` before this summary commit; **new HEAD after push is this commit** | Live tree `/home/steve/ang/src/boxes`; `node-box.service` cwd still this path; **not** restructured into glue-only |
| Boxes (sysmon draft, local-only) | (same remote; branch **not** pushed) | local `feat/node-system-monitor` in worktree `/home/steve/ang/src/boxes-sysmon` | `494941fce23345c55c50e7de933ea9fc877b687d` | Ahead 1 / behind 2 of `origin/fix/node-pwa-inframe-apps`; **not deployed**; do not retarget live `node-box` |
| node-daemon | https://github.com/CultureReset/node-daemon | `main` | `3f1531bb82a2f3901246365904627e0ba34cfc13` | New private repo today; subtree split from Boxes `5b7e39c:daemon/` + `.gitignore` |
| node-shell | https://github.com/CultureReset/node-shell | `main` | `75f28f73adaf01f35ff8f2fab71158c0965f5387` | New private repo today; subtree split from Boxes `5b7e39c:shell/` + `.gitignore` |
| rakazo | https://github.com/CultureReset/rakazo | `main` | `774c6a926ec9b8ca284c573dcd7fac66e26f83e7` | New private repo today; from `/home/steve/apps/rakazo` (live tree is **not** a git checkout) |
| supabase-local | https://github.com/CultureReset/supabase-local | `main` | `3af12d040c24eb1d4afef4effa2df7c8dd69046b` (first commit `1d1dcbc6221f877fbc2bb97fcc2606c26f241d4c`) | New private repo today; from `/home/steve/supabase` (live tree is **not** a git checkout) |
| node-mcp-hub | https://github.com/CultureReset/node-mcp-hub | `approval-gateway-enforce` | `276eb44391161bf5ef4e532f3bfcf7faaff2066a` (contains ancestor `80e0c5cf1774a010d83a73dd76ab747e0dba4b33`) | Pushed today; live `/home/steve/agents/mcp` |
| node-home | https://github.com/CultureReset/node-home | `import/live-20261109` | `129ef783cb4c7989b6425d6b64b3e6d3184ea1bb` | Import branch only; live `/home/steve/node-home` not converted to a checkout |
| node-helpers | https://github.com/CultureReset/node-helpers | `import/live-20261109` | `4a80ed16d5c4610bc3e22a7aa2d2f73ac163babf` | Import branch; no binaries |
| scrapers | https://github.com/CultureReset/scrapers | `import/live-20261109` | `4f1bb930f41085b6f0470b76f8e9aa447d87199f` | Import branch; data / vendored lib not imported |
| second-brain | https://github.com/CultureReset/second-brain | `import/live-20261109` | `6dee8cf29b40a31f056e2f4d3914631ccba240b1` | Import branch (gitignore; live scripts already matched) |
| smsgw-relay | https://github.com/CultureReset/smsgw-relay | `import/live-20261109` | `150a7028f57bcdb47b9fc7820513c615b1a510f7` | Import branch (gitignore; live already matched) |
| ai-chat-logger | https://github.com/CultureReset/ai-chat-logger | `import/live-20261109` | `7a73929a86d2ff694cef4684074fb37b2dc61862` | Import branch; **6.9G data dir not imported** |
| openclaw-workspace | https://github.com/CultureReset/openclaw-workspace | `import/live-20261109` | `449816e3166315a874a6b16bcd6817316349aef4` | Import branch; API key file not copied |
| nextgent-runtimes | https://github.com/CultureReset/nextgent-runtimes | `import/live-20261109` | `007c03d38128dc5e9e8b2f0344f7748232b5c75d` | Import branch; Twenty `:3000` compose + setup script |
| nextgent-n8n | https://github.com/CultureReset/nextgent-n8n | `import/live-20261109` | `dcb5a884630f56d14503623eb14e63cb3da4940c` | Import branch; sandbox compose only (no `.env` / data) |
| openjarvis-node | https://github.com/CultureReset/openjarvis-node | `matt/local-20261109` | `5e5f5efde4bfcf8a60fe70d1cea12a0185f615ec` | Second remote added on live `~/.openjarvis/src`; local branch remains `main`; **4 dirty files not on GitHub** |
| hermes-agent | https://github.com/CultureReset/hermes-agent | `matt/local-20261109` | `d923a5eb487a17c0a68801bba9ef0f56c81040a8` | Second remote added on live `~/.hermes/hermes-agent`; detached HEAD; clean |
| paperclip-node | https://github.com/CultureReset/paperclip-node | — | — | **Skipped** today: existing history already has 95 gitleaks findings |

Repo creation timestamps (UTC, from `gh api`): `node-daemon` 2026-11-09T21:45:07Z; `node-shell` 21:45:12Z; `rakazo` 21:45:18Z; `supabase-local` 21:45:23Z. All **private**.

---

## 1. New private CultureReset repos created today

| Name | Initial / main SHA | Contents | Source path on MSI |
|---|---|---|---|
| `node-daemon` | main `3f1531bb82a2f3901246365904627e0ba34cfc13` | Boxes `daemon/` tree at `5b7e39c` (exact tree match of subtree tip `4217183`) plus one `.gitignore` commit | Split from Boxes scratch clone (`~/_work/split-20261109/`), **not** from the live worktree |
| `node-shell` | main `75f28f73adaf01f35ff8f2fab71158c0965f5387` | Boxes `shell/` tree at `5b7e39c` (exact tree match of subtree tip `71e7295`) plus one `.gitignore` commit. Some `*.bak-*` files remain tracked in history/tree (gitignore does not untrack them; left as-is, no history rewrite) | Same scratch split |
| `rakazo` | main `774c6a926ec9b8ca284c573dcd7fac66e26f83e7` | Compose files, `bin/` proxies, `install-images.sh`, `restrict-computer-egress.sh`, `LOCAL.md`, `.env.images.example`, UI overrides. **No** `.env`, sockets, or volumes. gitleaks 0 | `/home/steve/apps/rakazo` (running tree stays non-git) |
| `supabase-local` | main `3af12d040c24eb1d4afef4effa2df7c8dd69046b`; first commit `1d1dcbc6221f877fbc2bb97fcc2606c26f241d4c` | Official compose/scripts, sanitized `.env.example`, `docker-compose.override.example.yml` (includes this box’s tailnet IP — replace with `${TAILSCALE_IP}` on a new machine), volume **templates** (SQL/functions). **No** live `.env` or DB data. Two key-bearing test scripts omitted. gitleaks 0 after sanitize | `/home/steve/supabase` (running tree stays non-git) |

---

## 2. Existing repos that received `import/live-20261109`

All imports used scratch clones under `~/_work/import-20261109/`. Live directories were **not** converted to checkouts and were **not** moved.

| Repo | Branch SHA | What was imported | Excluded |
|---|---|---|---|
| `node-home` | `129ef783cb4c7989b6425d6b64b3e6d3184ea1bb` | `live-20261109/{index.html,apps.json,frame_proxy.py}` + payload refresh + gitignore | Live dir remains non-git |
| `node-helpers` | `4a80ed16d5c4610bc3e22a7aa2d2f73ac163babf` | `wait-for`, `node-healthcheck`, `node-mcp-add`, `node-sudo`, `openjarvis-prestart`, `lead-paperclip-mcp`, `tailscale-serve-apply` | **No binaries** (llama-swap, piper, scrcpy, `.so`, models) |
| `scrapers` | `4f1bb930f41085b6f0470b76f8e9aa447d87199f` | gitignore + tiny beachball test stub; live Python already matched main | Vendored `mygulfcoastchamber/lib`; data trees |
| `second-brain` | `6dee8cf29b40a31f056e2f4d3914631ccba240b1` | gitignore only; live scripts already matched | — |
| `smsgw-relay` | `150a7028f57bcdb47b9fc7820513c615b1a510f7` | gitignore only; live `relay.py` already matched | — |
| `ai-chat-logger` | `7a73929a86d2ff694cef4684074fb37b2dc61862` | gitignore only; live `.py` already matched | **~6.9G data dir** |
| `openclaw-workspace` | `449816e3166315a874a6b16bcd6817316349aef4` | `DREAMS.md` + Nov memory notes | API key file (`paperclip-claimed-api-key.json` was gitleaks-hit; excluded + gitignored) |
| `nextgent-runtimes` | `007c03d38128dc5e9e8b2f0344f7748232b5c75d` | `twenty/docker-compose.yml` + `setup_twenty.py` (the `:3000` stack) | Live compose diffs that only changed secret values for `pms-runtime` / `odoo-runtime` / `twenty-runtime` |
| `nextgent-n8n` | `dcb5a884630f56d14503623eb14e63cb3da4940c` | `sandbox/docker-compose.yml` | `.env`, `.tls`, data volume |

**Skipped:** `paperclip-node` — existing history already flagged by gitleaks (**95** findings, mostly tests/docs/fixtures in commit `220756f`). Live Paperclip is an npm install + instance DB; no safe config-only import was pushed. `/opt/node-approvals/app` was not imported as a new branch this round (running code stays at `/opt`).

---

## 3. Shell / daemon split

- Method: `git subtree split` ( `git-filter-repo` was not installed; no sudo / pip).
- Scratch only: fresh clone into `~/_work/split-20261109/` from GitHub, branch `fix/node-pwa-inframe-apps` at **`5b7e39cefecec4d555cfbffa66e7bce2532d856c`**.
- Daemon subtree tip `4217183` → tree exact match of `5b7e39c:daemon/` → `.gitignore` commit → **`node-daemon` main `3f1531b`**.
- Shell subtree tip `71e7295` → tree exact match of `5b7e39c:shell/` → `.gitignore` commit → **`node-shell` main `75f28f7`**.
- **Live** `/home/steve/ang/src/boxes` was left untouched by the split (still the running tree; HEAD later moved only for docs commits).
- **`CultureReset/Boxes` on GitHub was not restructured** (still the full glue+daemon+shell repo). `node-box.service` still points at `/home/steve/ang/src/boxes`.
- Worktree `/home/steve/ang/src/boxes-sysmon` at `494941f` / `feat/node-system-monitor` was **not** touched.

---

## 4. MCP hub push

- Repo: https://github.com/CultureReset/node-mcp-hub.git  
- Branch pushed: **`approval-gateway-enforce`** (requested name; local tracking still shows `origin/local-history` ahead 2).  
- Remote SHA: **`276eb44391161bf5ef4e532f3bfcf7faaff2066a`** — commit message: `chore: extend gitignore for secrets, data, volumes, sockets`.  
- Ancestor on that branch: **`80e0c5cf1774a010d83a73dd76ab747e0dba4b33`** — `add computer-use-linux to MCP hub` (the commit Matt asked to get onto GitHub).  
- No force-push. gitleaks 0 on hub history.  
- Post-push check (execution): MCP `:7790` HTTP 401 (auth required = up), NODE `:7770` HTTP 200, `node-mcp-hub.service` active.

---

## 5. OpenJarvis + Hermes CultureReset remotes

### OpenJarvis (`~/.openjarvis/src`)

- Added remote **`cultureReset`** → `https://github.com/CultureReset/openjarvis-node.git`
- Kept **`origin`** → `https://github.com/open-jarvis/OpenJarvis.git`
- Local branch remains **`main`** at `5e5f5efde4bfcf8a60fe70d1cea12a0185f615ec` (**94 behind** upstream `origin/main`)
- Pushed `HEAD:matt/local-20261109` → remote SHA `5e5f5efde4bfcf8a60fe70d1cea12a0185f615ec`
- **Not committed / not on GitHub** (still dirty locally as of this summary):
  - modified: `src/openjarvis/mcp/loader.py`
  - modified: `src/openjarvis/system/builder.py`
  - untracked: `src/openjarvis/mcp/loader.py.bak-20261021`
  - untracked: `src/openjarvis/system/builder.py.bak-20261021`
- UI `:5173` and API `:8000/health` were HTTP 200 after the remote add; both units active.

### Hermes (`~/.hermes/hermes-agent`)

- Added remote **`cultureReset`** → `https://github.com/CultureReset/hermes-agent.git`
- Kept **`origin`** → `https://github.com/NousResearch/hermes-agent.git`
- Remained **detached HEAD** at `d923a5eb487a17c0a68801bba9ef0f56c81040a8` (clean)
- Push used `HEAD:refs/heads/matt/local-20261109` (first attempt failed because detached HEAD is not a branch ref) → remote SHA `d923a5eb487a17c0a68801bba9ef0f56c81040a8`
- No local file changes. Hermes has no unit and is not running.

---

## 6. Archive

- Destination: **`/home/steve/_archive/2026-11-09/`** (top-level `ang/` + `gh-export/`).
- **119** trees moved (`archive-moves.json` `moved` length).
- Bytes recorded: **3,865,529,048** (~3.87 GB); `du -sh` on the archive dir = **4.1G**.
- This is a **relocation (`mv` / same-filesystem rename), not a delete.** Disk used space did not drop (`/` still ~325G used / ~565G free at verification time).
- Running NODE, agents, OpenJarvis, Hermes, Twenty, n8n, rakazo, supabase, and `boxes-sysmon` were **not** moved.
- Largest moves (from execution): `gh-export/foundation` (~2.06 GB), `ang/repos/Data` (~383 MB), `ang/repos/ghost-ai` (~349 MB), `ang/repos/Open-jarvis` (~182 MB — **not** the running `~/.openjarvis/src`), plus other identical `ang/repos` copies and confirmed `gh-export` snapshots. Stale `ang/src/Boxes` and `ang/repos/Boxes` at `d0b85927e660` were moved (live lowercase `/home/steve/ang/src/boxes` kept).

**Skipped / left in place (still need Matt decisions):**

From `archive-moves.json` skipped entries that still exist on disk:

| Path | Reason |
|---|---|
| `/home/steve/ang/repos/Admin-dashboard-main` | 11 unique commits vs src |
| `/home/steve/ang/repos/Dashboards-users-` | HEAD differs (src was `8f6199a414`; repos `f323f5510f`) |
| `/home/steve/ang/repos/cybercheck-orchestrator` | HEAD differs |
| `/home/steve/ang/repos/cybercheck-api-database` | symlink (uncertain) |
| `/home/steve/ang/repos/gar-front-end-data` | symlink (uncertain) |

Note: `archive-moves.json` also lists `/home/steve/ang/repos/Boxes` under skipped, but the same manifest lists it under moved and the live path is **absent** (present under the archive). Treat as **moved**.

Also not auto-archived (per execution / plan uncertainty): `ang/src/openclaw-upstream` (~3.4–3.5G), `ang/src/twenty-CRM` (~1.9–2.0G), `/home/steve/agent-catalog` (path is **not** `ang/src/agent-catalog`), dirty-only `ang/repos` trees, stale `ang/src/Open-jarvis`, extra Hermes `ang/src/hermes`, and `~/.openclaw/workspace` (live untracked workspace).

Optional later: delete `~/_archive/2026-11-09/` to actually free ~4.1G.

---

## 7. Boxes commits today (including the two docs)

On `fix/node-pwa-inframe-apps` (times America/Chicago):

| SHA | Time (CST) | Summary |
|---|---|---|
| `20ba888` | 2026-11-09 15:10:51 | TalkNode: PC voice relay handoff; drop Travel Watch automation template (`TalkNode.tsx`, `automations.ts`) |
| `7d28723` | 2026-11-09 15:11:21 | Ignore local `_backups/` for moved `*.bak` edit snapshots (gitignore only; untracked bak trees moved into `_backups/` on disk — currently 133 files under `_backups/{config,daemon,shell}`, not tracked) |
| `5b7e39c` | 2026-11-09 15:14:58 | fix(shell): show mouse cursor in TV mode when a pointer is present; stop forcing 120% zoom (`tv.ts`, `components.css`). Shell rebuilt; `shell/dist/index.html` mtime 15:14:28 CST. Live daemon process was **not** restarted for this (static shell assets). |
| `d9a83ca` | 2026-11-09 16:16:00 | docs: NODE full to-do + zero-omission bootstrap prompt (2026-11-09) |

Docs published at `d9a83ca`:

- https://github.com/CultureReset/Boxes/blob/fix/node-pwa-inframe-apps/artifacts/NODE-BOOTSTRAP-PROMPT-2026-11-09.md  
- https://github.com/CultureReset/Boxes/blob/fix/node-pwa-inframe-apps/artifacts/NODE-FULL-TODO-2026-11-09.md  

Full commit: https://github.com/CultureReset/Boxes/commit/d9a83ca8968930a407f421c0e272b3711d72961d  

Those two files were **reconstructed** from the research report + sprawl audit (originals ~450 / ~213 lines were not found on disk). Bootstrap verification later found **16 mismatches / 3 unchecked** against the live machine — corrections are still open (see §10).

This summary file is an additional docs commit on the same branch (message: `docs: full change summary for 2026-11-09 NODE work`).

---

## 8. Current live HEAD of the running Boxes tree

At write time, before this summary commit:

- Path: `/home/steve/ang/src/boxes` (also `node-box` process cwd)
- Branch: `fix/node-pwa-inframe-apps` tracking `origin/fix/node-pwa-inframe-apps`
- HEAD: **`d9a83ca8968930a407f421c0e272b3711d72961d`**
- Process: `node /home/steve/ang/src/boxes/daemon/dist/index.js`, PID from unit start **Mon 2026-11-09 13:46:16 CST** (still the same long-lived process; this docs push does not restart it)
- **After this push, live HEAD becomes the new summary commit** (report that hash in the push receipt). Code under `daemon/` / `shell/` is unchanged by this commit.

Local-only sibling worktree (unchanged by today‘s publication sequence and by this doc):

- `/home/steve/ang/src/boxes-sysmon` @ `494941f` `feat/node-system-monitor` — System Monitor draft, **not deployed**, ahead 1 / behind 2 of origin `fix/node-pwa-inframe-apps`.

---

## 9. Services started / confirmed running (ports + last check)

Dedup outcome (t1415u): **nothing removed**. Both Twenty stacks are referenced. Live n8n is Docker `:5678`. `n8n-sandbox` is a companion (use ambiguous) — left running. `/home/steve/nextgent/n8n` is not running and was left in place (has a `data/` dir).

| Service | Port / URL | Last verified | Notes |
|---|---|---|---|
| NODE (`node-box.service`) | `127.0.0.1:7770` (also on tailnet IP) | HTTP **200** at summary write; unit **active**; started 13:46:16 CST | DISPLAY=:10.0; kiosk separate on `:0` |
| NODE frame Twenty CRM | `127.0.0.1:17802` → `:3000` | HTTP **200** | servePort 26443; cloudflared `crm.voicecommandapi.com` |
| NODE frame CRM 2 | `127.0.0.1:17813` → `:3020` | HTTP **200** | servePort **0**; cloudflared `crm2.` + `nextgent-crm.voicecommandapi.com` |
| NODE frame n8n | `127.0.0.1:17804` → `:5678` | HTTP **200** | servePort 25443; `automations.voicecommandapi.com` |
| NODE frame Rakazo | `127.0.0.1:17818` → `:45173` | HTTP **200** | servePort **0**; public hostname still Access-gated / XFO DENY |
| Twenty primary | `127.0.0.1:3000/healthz` | HTTP **200**; containers Up ~2h | `/home/steve/twenty`; MCP hub `ExecStartPre` waits on this |
| Twenty / CRM 2 | `127.0.0.1:3020/healthz` | HTTP **200**; containers Up ~2h | `/home/steve/nextgent/apps/twenty-runtime`; external `supabase_default` network |
| n8n live editor | `127.0.0.1:5678` | HTTP **200**; Up ~5h | Official image; volume `n8n_data` |
| n8n-sandbox | no host ports | containers Up ~5h (healthy) | Companion DinD / sandbox-api; **not** a second editor |
| Rakazo stack | host `127.0.0.1:45173`→5173; API `43100`→3100 | containers Up ~2h | Proxies include litellm-proxy + mcp-hub-proxy containers |
| MCP hub | `127.0.0.1:7790` | HTTP **401** (auth required = up); unit **active** | Restarted earlier today after Twenty health was up |
| OpenJarvis UI / API | `:5173` / `:8000/health` | both HTTP **200**; units **active** | |
| node-home | `:7690` | HTTP **200** | Static file server (frame_proxy.py is in the tree but not what the unit runs) |
| LiteLLM | `:4000` | `/health` **401**; `/health/liveliness` **200** | MCP wait uses liveliness |
| Supabase | studio `:54323`, API `:8001`, db/pooler on 5432/6543 | containers Up ~5h (healthy) | Live tree `/home/steve/supabase` |

Earlier today (parent context + execution): Rakazo `:45173` (frame/proxy `:17818`), Twenty `~/twenty` `:3000` (frame `:17802`), nextgent twenty-runtime `:3020`, and `node-mcp-hub` `:7790` were brought/confirmed up (MCP after Twenty health).

---

## 10. Still NOT done for “clone from GitHub and it works on a fresh machine”

These remain open. Full checklist lives in `artifacts/NODE-FULL-TODO-2026-11-09.md`. Highlights:

1. **Per-repo manifest / contract** (`nodeos.manifest.json` or equivalent) so a fresh clone starts without manual path edits.
2. **`node-launch` / bootstrap tool** that wires units, Tailscale serve, cloudflared, and health waits from the manifest.
3. **Secrets provisioning** — enroll door owner login, MCP/app tokens, compose `.env` files, approval-gateway keys; never commit values.
4. **Data volumes / DB migration** — Twenty, n8n `n8n_data`, Supabase volumes, scraper/second-brain `/hdd` data, photo backup, etc. are **not** in the new repos.
5. **174 `break` hardcoded paths** in `~/artifacts/sprawl-audit-20261109/portability.md` (plus 65 box / 24 install / 28 docs / 26 note = 317 rows / 119 files). Highest impact: systemd user units with literal `/home/steve` and nvm paths; NODE `frames.json` / `webapps.json` / `services-control.json`; cloudflared + door; MCP `registry.yaml`; scrapers/second-brain `/hdd`; `/opt/node-approvals`.
6. **Kiosk cookie / frame fix** — kiosk on `http://127.0.0.1:7770/?tv=1` vs Tailscale `:14443`; `door_session` cookie host mismatch; add `http://127.0.0.1:7770` to `NODEOS_FRAME_ANCESTORS` / `frameproxy.ts`; or point kiosk at Tailscale URL with `SameSite=None; Secure`. Daemon restart required after code change — **not approved yet**.
7. **Rakazo `servePort`** still `0`; framing through Cloudflare Access hits `X-Frame-Options: DENY`. Same for CRM 2 `servePort: 0`.
8. **Boxes not yet reduced to glue** — live unit still runs the monolith tree; cutover to `node-daemon` / `node-shell` consumers is future work.
9. **OpenJarvis uncommitted patches** (`loader.py`, `builder.py`, two `.bak-20261021`) — decide commit vs discard onto `openjarvis-node` `matt/local-20261109`. Pin is 94 behind upstream.
10. **CRM 2 retirement decision** — `:3020` is referenced (tiles, two cloudflared hostnames, frame 17813, node-home ids). Remove references **before** stopping that stack.
11. **System Monitor deploy** — decide whether to land/rebase unpushed `494941f` from `boxes-sysmon`; do **not** run that worktree against live `node-box`.
12. **`platform.json` connect** — `~/.config/nodeos/platform.json` still absent; Settings connect form + token strategy (device token vs raised 500-char cap + refresh) still open. API path mismatches (`/api/dashboard/menu` vs `/menu-items`; `/api/health` 404) until gcr-api-clean PR 113 is deployed.
13. **RLS off** on many GCR public tables (project `adpnhipmdefutkzzltbs`; ~128 tables flagged in research — not re-queried in verification because that needs production DB credentials). High blast radius; plan before enabling.
14. **16 doc corrections** from `bootstrap-verification-20261109.md` (181 match / 16 mismatch / 3 can’t-check of 200 claims) — Boxes HEAD pin, LiteLLM `/health` vs liveliness, `node-home` ExecStart, HUB_HOSTS drop-in, MiniDLNA :8200 down, missing kamra tmp / `hotel-websites-receiver` / `node-voice` units, agent-catalog path, Dashboards-users- SHAs, T25 checkbox, etc. — not yet patched into the bootstrap/TODO docs.
15. **Other open TODO items** (non-exhaustive): GCR `select('*')` field leak on entity route; Tailscale serve vs `services-control` port disagreements (Kuma/Navidrome/llama-swap/Crawl4AI); LiteLLM/SearXNG/Kuma/Crawl4AI config still not in CultureReset repos; `/opt/node-approvals` vs `node-approval-grants` source publish; `fix/ubuntu-node-support` ahead 1 / behind 8; sudo-runner source publication; OpenJarvis mobile `sidebarOpen` default; DISPLAY `:0` kiosk vs `:10.0` daemon; Paperclip-as-sole-orchestrator product decision; leftover archive candidates listed in §6.

---

## What this summary commit does / does not do

- **Does:** add this one markdown file under `artifacts/` and push it to `fix/node-pwa-inframe-apps`.
- **Does not:** change running services, restart `node-box`, touch `boxes-sysmon`, restructure Boxes, move/delete archive contents, commit OpenJarvis dirty files, or apply portability / kiosk / CRM 2 fixes.
