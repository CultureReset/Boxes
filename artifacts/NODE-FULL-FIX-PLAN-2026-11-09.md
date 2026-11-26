# NODE full fix plan — portable platform on GitHub — 2026-11-09

**Machine:** steve-MS-7C02 (America/Chicago / CST)  
**As-of:** 2026-11-09 4:54 PM CST  
**This file's branch (before this commit):** `CultureReset/Boxes` `fix/node-pwa-inframe-apps` @ `e9b71ddeda6ac8b2cf2a3d81c43bc4ecbf48a6f0`  
**Live running tree:** `/home/steve/ang/src/boxes` (same HEAD). `node-box.service` still starts `daemon/dist/index.js` from this path. Process start recorded in the change summary: Mon 2026-11-09 1:46:16 PM CST.  
**Rule:** secret **names and file locations only** — no secret values. If a SHA or path is not in the sources below, this plan writes `unknown` or `TBD (Matt)`.

**Sources used (no invention):**

- `/home/steve/artifacts/sprawl-audit-20261109/execution-20261109.md`, `portability.md`, `inventory.md`, `plan.md`, `bootstrap-verification-20261109.md`, `duplicates.md`, `running.tsv`, `repos.tsv`, `archive-moves.json`
- `/workspace/artifacts/full-state-research-2026-11-09.md` (research report; no copy found on the MSI)
- `/home/steve/ang/src/boxes/artifacts/NODE-CHANGES-SUMMARY-2026-11-09.md`, `NODE-BOOTSTRAP-PROMPT-2026-11-09.md`, `NODE-FULL-TODO-2026-11-09.md`
- Live read-only at write time: `git` status/log on Boxes, `boxes-sysmon`, and `node-door`; `config/frames.json`, `config/webapps.json`, `config/services-control.json`; `daemon/src/doorauth.ts`, `frameproxy.ts`, `modules/providers/webapps.ts` (`frameUrlFor`), `platform/config.ts`, `daemon/src/index.ts` (`/api/platform/connect`); `~/agents/node-door/door.py` cookie flags; systemd user units (Environment values redacted); `platform.json` absence; `node-tv-live.service` / `node-tv-session` kiosk URL

This document is a plan only. **This commit does not change running services, units, configs, `boxes-sysmon`, or any code.**

---

## 1. Goal statement

“Done” means a new machine can clone a documented set of CultureReset repos (one repo per component, not one giant monorepo), run a single launcher (`node-launch`) that reads each repo’s `nodeos.manifest.json`, allocate loopback ports, write systemd user units or Compose with only `${HOME}`, `${DATA}`, and `${NODE_HOST}` (no literal `/home/steve`, no baked-in `steve-ms-7c02.tail1af4f2.ts.net` or `100.104.20.101`), start every core service, register frames with NODE, and pass health checks — with the TV/desktop kiosk and in-app frames sharing a working `door_session` (no 401 “Sign in to NODE first.” HTML), and with business data connectable through a long-lived, revocable, slug-scoped device token stored in `~/.config/nodeos/platform.json` (mode 0600) once Matt has approved the token design and the public GCR leak / API path work. Secrets and data volumes stay on the machine, never in git. The live MSI is not the testbed for the first cutover: daemon/shell edits and the cookie/frame fix are proven in a copy (or on a second listen port) before `node-box.service` is restarted.

---

## 2. Prerequisites / safety rules

These are hard constraints. An agent executing any later phase must stop and report rather than violate them.

1. **Never touch the live `node-box` process until the cookie/frame fix is ready and tested.** Do not restart `node-box.service` just to pick up docs, manifests, or an untested daemon patch. Research report §2 and TODO T1: a daemon change must be in `daemon/dist` *and* explicitly approved before bounce. The live process at last record started 1:46:16 PM CST (`NODE-CHANGES-SUMMARY` §8).
2. **Shell and daemon work only in copies.** The 2026-11-09 split already followed this (`execution-20261109.md` §3e: scratch clone `~/_work/split-20261109/`). Future frame/cookie work uses a second tree and/or a second listen port (Phase 4 test plan). Do not retarget `node-box.service` `WorkingDirectory` or `ExecStart` until Matt explicitly approves cutover (TODO T13).
3. **Do not touch `/home/steve/ang/src/boxes-sysmon`.** Live status at 4:54 PM CST: branch `feat/node-system-monitor`, HEAD `494941fce23345c55c50e7de933ea9fc877b687d`, `ahead 1, behind 3` of `origin/fix/node-pwa-inframe-apps`. Not deployed. Untracked `node_modules` trees are present; leave them.
4. **Archive is already done.** 119 trees relocated (not deleted) to `/home/steve/_archive/2026-11-09/` (~3.87 GB recorded / `du` 4.1G). Do not delete the archive, and do not archive anything still running, without a new Matt decision (TODO T16).
5. **Do not `docker compose down -v`** on Rakazo, Twenty, Supabase, or n8n. Do not stop Twenty `:3020` or `n8n-sandbox` while references or ambiguous use remain (`execution-20261109.md` §1).
6. **No force-push** to any CultureReset repo. Secret-scan (gitleaks, `--redact`) before every push. Never commit `.env`, door keys, `chisel-users.json`, enroll-link, paylink previews, Chrome profiles, volumes, or JWTs.
7. **Do not invent paths or SHAs.** If something is missing, write `unknown` / `TBD (Matt)` and cite the gap.

### What must stay running

Confirmed in `execution-20261109.md` §1 / final rollup and `NODE-CHANGES-SUMMARY` §9 (plus live kiosk unit at write time). Do not stop these to "clean up."

| Service | Port / URL | Why it must stay up |
|---|---|---|
| NODE (`node-box.service`) | `127.0.0.1:7770` (also tailnet IP `:7770`); Tailscale serve `:14443` → `:7770` | The shell and API. Do not restart until Phase 4 passes. |
| node-tv-live (transient user unit) | Chrome `--kiosk http://127.0.0.1:7770/?tv=1` on DISPLAY `:0`; profile `~/.config/node-tv-session/chrome-profile` (local only) | HDMI kiosk. Default URL also in `node-tv-session` L16. |
| node-door | `127.0.0.1:7700`; public `https://steve-ms-7c02.tail1af4f2.ts.net:10000` (`doorauth.ts` L26–27) | Issues `door_session`. |
| MCP hub (`node-mcp-hub.service`) | `127.0.0.1:7790` (HTTP 401 = up); Tailscale `:17790` | ExecStartPre waits on Twenty `:3000/healthz`, LiteLLM liveliness, Paperclip. |
| Twenty primary (`~/twenty`) | `127.0.0.1:3000/healthz`; frame `17802`; serve `26443`; `crm.voicecommandapi.com` | NODE CRM tile, MCP, door, services-control, node-home `crm`. |
| Twenty / CRM 2 (`~/nextgent/apps/twenty-runtime`) | `127.0.0.1:3020/healthz`; frame `17813`; servePort **0**; `crm2.` + `nextgent-crm.voicecommandapi.com` | Still referenced. Leave up until Phase 6 / Matt decision. |
| n8n live editor (Docker `n8n`) | `127.0.0.1:5678`; frame `17804`; serve `25443`; `automations.voicecommandapi.com` | Live automations tile. No compose file. |
| n8n-sandbox (`~/n8n-sandbox`) | no host ports; on `supabase_default` | Companion, use ambiguous — left running. |
| Rakazo stack | host `127.0.0.1:45173`→5173, API `43100`→3100; frame `17818`; servePort **0** | NODE tile; public hostname is Access-gated. Do not `down -v`. |
| OpenJarvis UI / API | `:5173` / `:8000/health`; frame `17801`; serve `20443` | Core tile. |
| Paperclip | `:3100`; frame `17803`; serve `30443` | MCP wait + tile. |
| LiteLLM | `:4000`; `/health` 401, `/health/liveliness` 200; frame `17805`; serve `23443` | MCP wait uses liveliness. |
| Supabase (`~/supabase`) | studio `:54323`, API `:8001`, db/pooler 5432/6543; frame `17817`; servePort 0 | CRM 2 uses external network `supabase_default`. |
| node-home | `:7690` (plain `python3 -m http.server`, not `frame_proxy.py`) | Referenced by cloudflared / portal. |
| Core units also expected up (services-control “core” / inventory) | `llm.service` `:8080`, `openclaw-gateway.service` `:18789`, `gbrain` / `gbrain-audit-gw`, `node-chat` `:7780`, `smsgw-relay` + `node-sms`, `node-mcp-hub`, `openjarvis` + `openjarvis-ui` | Do not stop as part of this plan. |

Also leave in place, even if idle: `/home/steve/nextgent/n8n` (not running, has `data/`), AppFlowy / Odoo / Pretix / Kamra exited stacks, Hermes checkout (no unit). `boxes-sysmon` is a worktree, not a running unit — still do not touch it.

---

## 3. Phase 1 — Platform contract (highest priority; blocks Phases 3, 7, and the “fresh clone works” claim)

**Owner:** Agent drafts and implements after Matt accepts the schema and the launcher’s home (Decision 13 in §10).  
**Depends on:** nothing code-wise; should be written before path rewrites so units are *generated*, not hand-edited 174 times.  
**Does not restart `node-box`.**

Today there is no shared manifest (research report §7.1). Ports live in `config/frames.json` / `webapps.json` / `services-control.json`; launch is a mix of systemd units with literal `/home/steve` and Docker `restart: unless-stopped`.

### 3.1 `nodeos.manifest.json` schema (proposed v1)

This extends the draft in research report §7.2 (lines 367–410) with the fields this plan requires (`version`, `repo`, `launch.kind`, `env.secret`, `frame.path` / `frame.servePort`). It is a **contract proposal**, not a file that already exists in any repo.

Place one file at the **repo root** of each component (or a private override under `${HOME}/.config/nodeos/apps/<slug>.json` for allocated ports). `$schema` URL below is a placeholder until the launcher repo publishes a real schema file.

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/CultureReset/node-launch/main/schema/nodeos-manifest-v1.json",
  "manifestVersion": 1,
  "name": "twenty-crm",
  "version": "1.0.0",
  "slug": "twenty-crm",
  "title": "Twenty CRM",
  "kind": "docker",
  "repo": "https://github.com/CultureReset/nextgent-runtimes",
  "ports": [
    {
      "name": "web",
      "container": 3000,
      "host": "loopback",
      "preferred": 3000,
      "protocol": "http"
    }
  ],
  "deps": {
    "runtime": "docker",
    "packages": [],
    "services": ["postgres", "redis"]
  },
  "env": [
    { "name": "SERVER_URL", "from": "port:web", "required": true, "secret": false },
    { "name": "APP_SECRET", "from": "secret:twenty-crm-app-secret", "required": true, "secret": true }
  ],
  "data": [
    { "id": "db", "path": "${DATA}/twenty-crm/db", "persist": true }
  ],
  "healthcheck": {
    "url": "http://127.0.0.1:${port.web}/healthz",
    "expect": 200
  },
  "launch": {
    "kind": "compose",
    "install": null,
    "start": "docker compose up -d",
    "unit": "twenty-crm.service",
    "workdir": "."
  },
  "frame": {
    "path": "/",
    "open": "frame",
    "sameOrigin": true,
    "servePort": 0,
    "ancestors": ["http://127.0.0.1:${NODEOS_PORT}", "https://${NODE_HOST}:${NODEOS_SERVE_PORT}"]
  }
}
```

Field notes: `kind` is `webapp | docker | proc | static | mcp | systemd`. `ports[].host` is always loopback (`127.0.0.1`) unless Matt says otherwise. `ports[].preferred` of `0` means the launcher allocates a free loopback port and records it. `launch.kind` is `systemd | compose | npm`. `frame.sameOrigin: true` prefers `/frame/<slug>/` so `door_session` stays first-party. `frame.servePort` of `0` means the launcher allocates a Tailscale serve port if needed — do not bake `26443`.

**Hard rules for every manifest:**

- No absolute `/home/steve`, `/hdd`, `steve-ms-7c02.tail1af4f2.ts.net`, or `100.104.20.101` (portability.md “Top portable replacements”, lines 51–60).
- Paths use only `${HOME}`, `${DATA}` (default `${HOME}/.local/share/nodeos/apps/<slug>`), and `${NODE_HOST}` (this machine’s Tailscale MagicDNS name, from `tailscale hostname` / `NODEOS_FRAME_HOST` at launch time — not a checked-in string). Generated units may also expand `${port.*}`.
- Secrets are referenced by **name** (`from: "secret:<id>"`). Values live in `${HOME}/.config/nodeos/secrets/` or an enrolled vault, never in the manifest or in git.
- Missing required env → a connect/enroll form, not a crash (research §7.2 rule 3).

### 3.2 Example manifests for real components (documented values)

These use ports and paths already recorded in `portability.md` lines 66–86 / live `frames.json`. `preferred` / `servePort` numbers are **this box’s current bindings**, for migration reference; a fresh machine should set `preferred: 0` / `servePort: 0` and let the launcher allocate, then write the result to the private override file.

**A. Twenty CRM (live `:3000` stack — keep; MCP ExecStartPre depends on it)**

```json
{
  "manifestVersion": 1,
  "name": "twenty-crm",
  "version": "1.0.0",
  "slug": "twenty-crm",
  "title": "Twenty CRM",
  "kind": "docker",
  "repo": "https://github.com/CultureReset/nextgent-runtimes",
  "ports": [{ "name": "web", "container": 3000, "host": "loopback", "preferred": 3000, "protocol": "http" }],
  "deps": { "runtime": "docker", "packages": [], "services": ["postgres", "redis"] },
  "env": [
    { "name": "SERVER_URL", "from": "port:web", "required": true, "secret": false }
  ],
  "data": [{ "id": "volumes", "path": "${DATA}/twenty-crm", "persist": true }],
  "healthcheck": { "url": "http://127.0.0.1:${port.web}/healthz", "expect": 200 },
  "launch": { "kind": "compose", "start": "docker compose up -d", "workdir": "twenty" },
  "frame": { "path": "/", "open": "frame", "sameOrigin": true, "servePort": 0 }
}
```

Compose source already published on `nextgent-runtimes` `import/live-20261109` @ `007c03d38128dc5e9e8b2f0344f7748232b5c75d` (`execution-20261109.md` §3c). Live tree `/home/steve/twenty` is still not a checkout.

**B. n8n live editor (Docker official image, no compose today)**

```json
{
  "manifestVersion": 1,
  "name": "n8n",
  "version": "1.0.0",
  "slug": "n8n",
  "title": "n8n",
  "kind": "docker",
  "repo": "https://github.com/CultureReset/nextgent-n8n",
  "ports": [{ "name": "web", "container": 5678, "host": "loopback", "preferred": 5678, "protocol": "http" }],
  "deps": { "runtime": "docker", "packages": [], "services": [] },
  "env": [
    { "name": "WEBHOOK_URL", "from": "frame", "required": true, "secret": false },
    { "name": "N8N_ENCRYPTION_KEY", "from": "secret:n8n-encryption-key", "required": true, "secret": true }
  ],
  "data": [{ "id": "n8n_data", "path": "${DATA}/n8n", "persist": true }],
  "healthcheck": { "url": "http://127.0.0.1:${port.web}/", "expect": 200 },
  "launch": { "kind": "compose", "start": "docker compose up -d", "workdir": "." },
  "frame": { "path": "/", "open": "frame", "sameOrigin": true, "servePort": 0 }
}
```

The live editor has **no compose file** today (`portability.md` scanner limits; `execution-20261109.md` §1). Phase 2 must add a redacted compose/recipe to `nextgent-n8n` before this manifest can launch a fresh clone. Do not commit volume `n8n_data`.

**C. OpenJarvis (API `:8000` + UI `:5173`)**

```json
{
  "manifestVersion": 1,
  "name": "openjarvis",
  "version": "1.0.0",
  "slug": "openjarvis",
  "title": "OpenJarvis",
  "kind": "proc",
  "repo": "https://github.com/CultureReset/openjarvis-node",
  "ports": [
    { "name": "ui", "host": "loopback", "preferred": 5173, "protocol": "http" },
    { "name": "api", "host": "loopback", "preferred": 8000, "protocol": "http" }
  ],
  "deps": { "runtime": "python+node", "packages": ["uv-or-venv", "npm"], "services": [] },
  "env": [],
  "data": [{ "id": "src", "path": "${HOME}/.openjarvis", "persist": true }],
  "healthcheck": { "url": "http://127.0.0.1:${port.api}/health", "expect": 200 },
  "launch": { "kind": "systemd", "unit": "openjarvis.service", "workdir": "${HOME}/.openjarvis/src" },
  "frame": { "path": "/", "open": "frame", "sameOrigin": false, "servePort": 0 }
}
```

`sameOrigin: false` here because research / `frameproxy.ts` L126–129: Vite apps built at base `/` still need a dedicated serve port (asset-absolute URLs break under `/frame/<slug>/`) unless the UI is rebuilt with base `/frame/openjarvis/`. Pin on CultureReset: `matt/local-20261109` @ `5e5f5efde4bfcf8a60fe70d1cea12a0185f615ec`. Four dirty files are not on GitHub (Phase 2).

### 3.3 `node-launch` tool spec

A CLI the owner runs once per machine (and again to add an app):

```
node-launch init                         # write ${HOME}/.config/nodeos/launch.toml (DATA, NODE_HOST)
node-launch add <git-url> [--ref <sha>]  # clone, read or infer manifest, allocate ports, generate unit/compose, register frame
node-launch up [<slug>]                  # start according to launch.kind; wait on healthcheck
node-launch status                       # curl each healthcheck; print port map
node-launch register-frames              # merge allocated ports into NODE's frame catalog (generated file, not hand-edited frames.json)
```

Behavior:

1. Read `nodeos.manifest.json` from each cloned repo (and the per-machine override).
2. Allocate loopback ports: honor `preferred` if free; otherwise pick a free `127.0.0.1` port and record it under `${HOME}/.config/nodeos/apps/<slug>.json`.
3. Generate **systemd user units** or **Compose** using only `${HOME}`, `${DATA}`, `${NODE_HOST}` (and `${port.*}`). Use systemd `%h` instead of `/home/steve`. Never emit a literal nvm version path; use `${HOME}/.nvm/current/bin` or a login-shell PATH.
4. Register frames with NODE: write a generated `frames` fragment (slug, `upstream=http://127.0.0.1:${port}`, `localPort`, `servePort`, `path`) and prefer `sameOrigin` `/frame/<slug>/` when `frame.sameOrigin` is true (`frameproxy.ts` `handleSameOriginFrame`, L131–153; `webapps.ts` `frameUrlFor`, L135–144, already honors `NODEOS_FRAME_SAME_ORIGIN=1`).
5. Health waits (today hardcoded in `node-mcp-hub.service` ExecStartPre to Twenty `:3000/healthz`, LiteLLM liveliness, Paperclip — TODO T23) must read `healthcheck.url` from manifests.
6. Apply Tailscale serve and cloudflared ingress from the same port map (templates, not handwritten host:port lists). Hostname in those templates is `${NODE_HOST}`, not `steve-ms-7c02.tail1af4f2.ts.net`.

### 3.4 How existing components get manifests

Generator order (research §7.3):

1. If `nodeos.manifest.json` exists, use it.
2. Else infer from `compose.yaml` / `docker-compose*.yml` ports and healthchecks.
3. Else `devcontainer.json` `appPort` / `forwardPorts` (none found at these roots today, research §7.1).
4. Else `package.json` scripts (`dev` / `start`).
5. Else `Procfile` `web`.
6. Else hand-write (systemd-only components: OpenJarvis, MCP hub, node-door, node-box).

Write the inferred or allocated result to `${HOME}/.config/nodeos/apps/<slug>.json` **without editing the clone** when the upstream repo is a fork (OpenJarvis, Hermes, Twenty source). CultureReset-original repos should land a checked-in `nodeos.manifest.json` with `preferred: 0` and no hostnames.

### 3.5 Where the launcher lives

- **Recommend:** new private repo `CultureReset/node-launch` (schema, CLI, unit/compose templates, frame registrar). Keeps the launcher out of the still-monolithic live Boxes tree and matches “one repo per component.” **Repo creation is a Matt-only decision** (none exists today; do not `gh repo create` until approved).
- **Alternative (no new repo):** put the CLI under `CultureReset/Boxes` as `launch/` glue, and move it when Boxes is slimmed (TODO T13). Acceptable if Matt does not want another repo yet.

Do not put the launcher into `node-foundation` (historical; `plan.md` says do not expand it) or into `nextgent-shell` (a different project).

### Phase 1 steps and PASS/FAIL

| Step | Action | PASS | FAIL |
|---|---|---|---|
| 1.1 | Matt accepts schema + launcher home (§10 decision 13) | Written decision | Do not create a repo or merge a schema unilaterally |
| 1.2 | Publish schema file + three example manifests (Twenty, n8n, OpenJarvis) in the chosen repo | Schema validates examples; gitleaks 0; no `/home/steve` or tailnet hostname in examples except in comments marked “this-box reference” | Schema rejects examples, or a hostname is baked in |
| 1.3 | Implement `node-launch` enough to: allocate a loopback port, write a unit with `%h`, register a dummy frame | In a scratch directory, `node-launch add` of a fixture app binds `127.0.0.1:<allocated>` and the generated unit has zero `/home/steve` | Unit contains a literal username path |
| 1.4 | Point MCP health waits at the manifest (design only until Phase 3 applies it) | Design reviewed; live ExecStartPre left unchanged until a tested unit drop-in exists | Live `node-mcp-hub` unit edited without a backup / test |

**Commands (after 1.3):** `git ls-remote https://github.com/CultureReset/node-launch.git` shows the schema commit (if the new repo was approved); `grep -n '/home/steve\|steve-ms-7c02\|100.104.20.101' generated-unit` exits 1.

---

## 4. Phase 2 — Git completeness

**Owner:** Agent, after Matt signs the remaining-import list (especially paperclip-node, sysmon, OpenJarvis dirty files, and any *new* repo).  
**Depends on:** Phase 1 schema can land in parallel; do not block imports on the launcher.  
**Does not restart `node-box`.** Live trees stay where they are (scratch clones, as in `execution-20261109.md` §3c).

### 4.1 What is already on GitHub (do not redo)

From `NODE-CHANGES-SUMMARY` §1–5 / `execution-20261109.md` §3b–3f. Live directories were **not** converted to checkouts.

| Repo | Branch | SHA | Notes |
|---|---|---|---|
| node-daemon | `main` | `3f1531bb82a2f3901246365904627e0ba34cfc13` | Split from Boxes `5b7e39c:daemon/` in a scratch clone. Live unit still uses `/home/steve/ang/src/boxes`. |
| node-shell | `main` | `75f28f73adaf01f35ff8f2fab71158c0965f5387` | Split from `5b7e39c:shell/`. Some `*.bak-*` remain tracked; no history rewrite. Not `nextgent-shell`. |
| rakazo | `main` | `774c6a926ec9b8ca284c573dcd7fac66e26f83e7` | From `/home/steve/apps/rakazo`. No `.env` / volumes. Live tree is still not a checkout. |
| supabase-local | `main` | `3af12d040c24eb1d4afef4effa2df7c8dd69046b` (first `1d1dcbc6221f877fbc2bb97fcc2606c26f241d4c`) | Overlay + templates. Override still contains this box’s tailnet IP — replace with `${NODE_HOST}` in Phase 3. |
| node-mcp-hub | `approval-gateway-enforce` | `276eb44391161bf5ef4e532f3bfcf7faaff2066a` (contains `80e0c5cf1774a010d83a73dd76ab747e0dba4b33`) | Pushed; live `/home/steve/agents/mcp`. |
| node-home | `import/live-20261109` | `129ef783cb4c7989b6425d6b64b3e6d3184ea1bb` | Live `/home/steve/node-home` not a checkout. |
| node-helpers | `import/live-20261109` | `4a80ed16d5c4610bc3e22a7aa2d2f73ac163babf` | Partial: wait-for, node-healthcheck, node-mcp-add, node-sudo, openjarvis-prestart, lead-paperclip-mcp, tailscale-serve-apply. **No binaries.** |
| scrapers | `import/live-20261109` | `4f1bb930f41085b6f0470b76f8e9aa447d87199f` | Data / vendored lib excluded. |
| second-brain | `import/live-20261109` | `6dee8cf29b40a31f056e2f4d3914631ccba240b1` | gitignore; vault/data not imported. |
| smsgw-relay | `import/live-20261109` | `150a7028f57bcdb47b9fc7820513c615b1a510f7` | gitignore; live already matched. |
| ai-chat-logger | `import/live-20261109` | `7a73929a86d2ff694cef4684074fb37b2dc61862` | 6.9G data dir not imported. |
| openclaw-workspace | `import/live-20261109` | `449816e3166315a874a6b16bcd6817316349aef4` | API key file not copied. |
| nextgent-runtimes | `import/live-20261109` | `007c03d38128dc5e9e8b2f0344f7748232b5c75d` | Twenty `:3000` compose + `setup_twenty.py` only. |
| nextgent-n8n | `import/live-20261109` | `dcb5a884630f56d14503623eb14e63cb3da4940c` | Sandbox compose only. |
| openjarvis-node | `matt/local-20261109` | `5e5f5efde4bfcf8a60fe70d1cea12a0185f615ec` | Second remote on `~/.openjarvis/src`; local branch remains `main`. **Dirty files not on GitHub.** |
| hermes-agent | `matt/local-20261109` | `d923a5eb487a17c0a68801bba9ef0f56c81040a8` | Second remote; detached HEAD; clean; not running. |

### 4.2 Still untracked or only partially tracked — target repo

“Running without git” in `inventory.md` §3 was a snapshot; several of those trees were imported later the same day. What remains:

| Running / local component | Target CultureReset repo | Status | Import (code only; no secrets/volumes) |
|---|---|---|---|
| `/home/steve/ang/bin` leftover scripts (`asr-shim.py`, `paperclip-approval-bridge.py`, `mcp-gate.py`, etc. per `plan.md` L40) | `node-helpers` | Partial — not in the 2026-11-09 import list | Second import branch; still exclude `llama-swap`, `piper`, `scrcpy`, `.so`, models |
| `~/ang/etc/llama-swap.yaml` + `llm.service` | TBD (Matt): `node-helpers` config-only vs existing `nextgent-llm-api` / new small repo | Config not published | Redacted config only; binary stays local |
| Live n8n editor (`docker` official image, volume `n8n_data`) | `nextgent-n8n` | No compose today | Add a recipe/compose **without** `n8n_data`, `.env`, license |
| Twenty `:3020` compose `~/nextgent/apps/twenty-runtime` | `nextgent-runtimes` | Skipped because live diffs were secret-only (`execution` §3c) | Only after a redacted compose exists; do not stop the stack |
| `/home/steve/api-gateway` LiteLLM config | TBD (Matt): `node-infra` or new `node-litellm-config` (TODO T22) | Not git | Redacted config only; never keys |
| SearXNG / Uptime Kuma / Crawl4AI host config | `nextgent-runtimes` (or small overlay repos) | Official images, no git tree (`inventory.md` §3) | Compose/config overlays only |
| `/opt/node-approvals/app` (system unit `node-approval-gateway.service`) | `node-approval-grants` and/or `approval-gateway` (`plan.md` L33, L134) | Running tree is NOT git; existing GH repos exist | Diff and publish **source**, not the `/opt` deploy |
| `/usr/local/lib/sudo-runner` | TBD (Matt) — no import this round (TODO T22) | NOT git | Source publication only |
| `~/.paperclip` + `/home/steve/.local/bin/paperclipai` | `paperclip-node` | **Skipped:** existing history has **95** gitleaks findings, mostly tests/docs/fixtures in commit `220756f` (`execution` §3a, §3c) | Do not push until history is triaged (Decision 16). Do not commit instance DB |
| `~/.openjarvis/src` dirty files | `openjarvis-node` `matt/local-20261109` | Pin is on GitHub; patches are not | Decision 8 (commit vs discard). Files: `src/openjarvis/mcp/loader.py`, `src/openjarvis/system/builder.py`, plus untracked `loader.py.bak-20261021`, `builder.py.bak-20261021` |
| `/home/steve/ang/src/boxes-sysmon` | same Boxes repo, branch `feat/node-system-monitor` | SHA `494941fce23345c55c50e7de933ea9fc877b687d` **unpushed**; ahead 1 / behind 3 of `origin/fix/node-pwa-inframe-apps` at 4:54 PM CST | Decision 7. Rebase in a **copy**, never from the live sysmon worktree against `node-box` |
| `/home/steve/ang/src/node-chat` (dirty=2 at inventory time) | existing `nextgent-chat` | Already on GitHub; dirty not re-verified this write except inventory/plan | Review then import; no force-push |
| `/home/steve/ang/src/node-phone` (dirty=2; local `main` differs) | existing `nextgent-phone` | `plan.md` L38 | Reconcile `main`; no new `node-phone` repo |
| `/home/steve/agents/node-door` | existing `node-door` | Live at 4:54 PM CST: HEAD `eed793c`, untracked `tests/peek.cjs` only | Review `peek.cjs` before add; do not commit secrets |
| `fix/ubuntu-node-support` on Boxes | Boxes | local `e7164c2` vs remote `9d32c04` (ahead 1, behind 8) — TODO T21 | Rebase/reconcile before any push |
| `Dashboards-users-` | existing `Dashboards-users-` | Verification correction 10: local HEAD `f323f55` on `claude/dashboard-inventory-purposes-m5wtba`; GitHub tip of that branch `aac903f`; GitHub main `d290da4`. Doc SHA `8f6199a` is stale | Reconcile; no force-push |
| `node-launch` | **new** (or Boxes `launch/`) | Does not exist | Phase 1 / Decision 13 |
| Install-only binaries (navidrome, ntfy, selkies, chisel, gbrain bun, cloudflared, openclaw npm global) | existing packaging repos (`node-tunnel`, `gbrain`, `openclaw`, `node-infra`) | Running is an install, not a checkout | Pin versions in manifests; do not git-init inside install dirs |

OpenJarvis CultureReset remote is already `cultureReset` → `openjarvis-node`; upstream `origin` remains `open-jarvis/OpenJarvis`. Local branch name is `main` (verification correction 11); `matt/local-20261109` exists on the CultureReset remote only. Pin is **94 behind** upstream `main`.

### 4.3 Import order (no secrets, no volumes)

1. Secret-scan + gitignore on the tree (gitleaks `--redact`). Abort that repo if findings are not clearly false positives.
2. Scratch clone under `~/_work/…` — do not `git init` inside a running compose/unit directory.
3. Copy code only. Exclude: `.env`, `*.env.bak*`, volumes, `n8n_data`, Supabase `volumes/`, Rakazo sockets, `~/.paperclip/instances/*/db`, Chrome profiles, `chisel-users.json`, enroll-link, paylink previews, 6.9G logger data, scraper data, SecondBrain vault, llama-swap/piper binaries.
4. Push a dated branch (`import/live-YYYYMMDD`), not a force onto `main`.
5. Verify the running service still answers on its port (same checks as execution §3c).

Suggested sequence: (a) leftover `node-helpers` scripts; (b) n8n live recipe; (c) LiteLLM/SearXNG/Kuma/Crawl4AI redacted overlays after Matt picks the repo; (d) approval-gateway source vs `/opt`; (e) sudo-runner source after Matt picks a repo; (f) OpenJarvis dirty files only after Decision 8; (g) sysmon only after Decision 7, in a copy; (h) paperclip-node only after Decision 16.

### Phase 2 PASS/FAIL

| Check | PASS | FAIL |
|---|---|---|
| Each imported branch | `git ls-remote` shows the new SHA; gitleaks 0 on the pushed tree | Secrets in history; force-push; live dir converted in place |
| Running services after import | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:7770/` = 200; MCP `:7790` = 401; Twenty `:3000/healthz` and `:3020/healthz` = 200; n8n `:5678` = 200; OpenJarvis `:5173` and `:8000/health` = 200 | Any of those down after the import |
| OpenJarvis remotes | `git -C ~/.openjarvis/src remote -v` still has `origin` = upstream and `cultureReset` = `CultureReset/openjarvis-node` | Upstream remote removed |
| paperclip-node | Left untouched until Decision 16 | Any push that adds to the 95-hit history without triage |
| sysmon | `boxes-sysmon` worktree untouched; any rebase happens in a copy | Agent edits `/home/steve/ang/src/boxes-sysmon` or retargets `node-box` at it |

---

## 5. Phase 3 — Remove hardcoded paths

**Owner:** Agent, after Phase 1 can generate units/frames.  
**Depends on:** Phase 1 (otherwise each fix is a one-off edit that will drift).  
**Does not restart `node-box` until Phase 4 says so.** Generate new units beside the live ones; switch in a later, tested step.

Full table: `portability.md` (317 rows / 119 files; **174 break**, 65 box, 24 install, 28 docs, 26 note). Generated ~3:41 PM CST; list only.

### 5.1 Top offenders (cite `portability.md` file:line)

**systemd-user (85 rows; highest impact).** Almost every custom user unit uses literal `/home/steve/...` in `ExecStart`, `WorkingDirectory`, or PATH (including pinned nvm versions). Replacement: generated units with `%h` / `${HOME}`. Examples:

| File:line (portability.md) | Hardcoded value | Replacement |
|---|---|---|
| `~/.config/systemd/user/node-box.service:8` (portability L113) | `/home/steve/ang/src/boxes` | `%h` / `${HOME}` workdir from manifest |
| `node-box.service:9` (L114) | `100.104.20.101` | `${NODE_HOST}` / `tailscale ip -4` at launch (do not bake the IP) |
| `node-box.service:15` (L116) | `/home/steve/ang/src/boxes/daemon/dist/index.js` | `${HOME}/…` or `$NODE_ROOT/daemon/dist/index.js` |
| `node-mcp-hub.service:7` (L126) | `100.104.20.101` | `${NODE_HOST}` |
| `node-sms.service:7–8` (L128–129) | `/home/steve/.nvm/versions/node/v22.23.3/bin/node` and that PATH | `${HOME}/.nvm/current/bin` or unit `PATH` from nvm “current” |
| `openclaw-gateway.service:9` (L133–134) | `/home/steve/.nvm/versions/node/v24.22.0/bin/node` + global module path | same — no pinned nvm version in published units |
| `openjarvis.service:6–9` and `openjarvis-ui.service:6–9` (L139–146) | `/home/steve/.openjarvis/src` and Vite/venv paths | `${HOME}/.openjarvis/src` |
| `rakazo-stack.service:10–15` (L156–166) | `/home/steve/apps/rakazo` and `.env` / compose paths | `${HOME}/apps/rakazo` or `${DATA}/rakazo` |
| `node-health.service:2` (L122–123) | `/hdd/home/steve/logs/node-health.log` | `${DATA}/logs/node-health.log` (`${DATA}` may be `/hdd/...` on this box only, set at `node-launch init`) |

Effective live `node-box` restart policy is **Restart=always / RestartSec=5** because of `node-box.service.d/boot-order.conf` (verification correction 3), not only the main file’s `on-failure` / 3s.

**NODE config / daemon (Boxes 58 rows).**

| File:line | Hardcoded value | Replacement |
|---|---|---|
| `config/services-control.json` (portability L184–195) | `https://steve-ms-7c02.tail1af4f2.ts.net:<servePort>/` | Generated from `${NODE_HOST}` + allocated serve ports |
| `config/webapps.json` icon paths (L196–205) | `/home/steve/.local/share/node-icons/<slug>.png` | `${HOME}/.local/share/node-icons/<slug>.png` (code in `webapps.ts` L53 already uses `process.env.HOME` for a fallback icon — keep that pattern) |
| `config/webapps.json:179` (L206) | `100.104.20.101:8200` (MiniDLNA) | `${NODE_HOST}` / tailnet IP at launch. Live: MiniDLNA URL is correct but **nothing listens on :8200** (verification correction 14) |
| `config/webapps.json:197` (L207) | `steve-ms-7c02.tail1af4f2.ts.net:12443/playground` | `${NODE_HOST}` |
| `daemon/src/doorauth.ts:27–28` (L208–209) | default `DOOR_PUBLIC` / `NODE_PUBLIC` host `steve-ms-7c02.tail1af4f2.ts.net` | default from `NODEOS_DOOR_PUBLIC` / `NODEOS_PUBLIC_ORIGIN` / `${NODE_HOST}` with no this-box fallback string |
| `daemon/src/frameproxy.ts:29` (L210–212) | default `FRAME_ANCESTORS` list includes this-box tailnet origins, **omits** `http://127.0.0.1:7770` | env `NODEOS_FRAME_ANCESTORS` (already read at L27–30) must be the source of truth; include kiosk origin (Phase 4) |
| `daemon/src/modules/providers/webapps.ts:142` (L217) | `NODEOS_FRAME_HOST ?? "steve-ms-7c02.tail1af4f2.ts.net"` | require `NODEOS_FRAME_HOST` or `${NODE_HOST}`; no hardcoded default hostname |
| `daemon/src/frameproxy.ts:56` (L213) | `process.env.HOME ?? "/home/steve"` | `process.env.HOME ?? os.homedir()` — never `/home/steve` |
| `daemon/src/modules/chat.ts:20` (L215–216) | `/hdd/home/steve/nodeos/uploads` and `/home/steve/nodeos/uploads` | `${DATA}/nodeos/uploads` |

Live `frames.json` (19 entries) is a this-box port map (`portability.md` L66–86). `servePort: 0` today: `notes`, `crm2`, `pos`, `tickets`, `kamra`, `supabase`, `rakazo`, `desktop`. Launcher should allocate serve ports for any tile that must be framed without Cloudflare Access (TODO T3: Rakazo, and CRM 2 if kept).

**cloudflared** (`~/.cloudflared/config.yml`): credential JSON path under `/home/steve/.cloudflared/` (portability L277, **break**); every ingress origin is a literal `127.0.0.1:178xx` / `:7690` / `:7700` / `:7710` / `:7790` (L278–300, **box**). Generate ingress from the frame port map. Do not commit `cert.pem` or the tunnel credentials JSON.

**node-door / nodeos-config:** `doorauth` / `door.py` listen default `127.0.0.1:7700`; `~/.config/nodeos/door/door.json` and `origins` bake the tailnet hostname (portability L354–359). Cookie flags are already portable (`door.py` L25: `Path=/; Max-Age=…; Secure; HttpOnly; SameSite=None`). Do **not** commit `enroll-link` or paylink previews (they contain tokens; portability flagged hostname hits in those files — TODO T24).

**MCP hub `registry.yaml`:** secret-file paths under `~/.config/nodeos/` and `http://127.0.0.1:3000/rest` (execution §2). Parameterize; do not hardcode Twenty’s health URL (TODO T17, T23).

**Scrapers / second-brain / node-healthcheck:** `/hdd/home/steve/...` (portability L333–344, plus scrapers/second-brain sections). `${DATA}` set at init; this machine may set it to the `/hdd` mount.

**Approval gateway:** `/opt/node-approvals/app` (portability L308–309; system unit). `${APPROVAL_APP_ROOT}` is the portability suggested name; generated units may still only expand `${HOME}`, `${DATA}`, `${NODE_HOST}` plus a documented install prefix in `launch.toml`.

**supabase-local** `docker-compose.override.yml` L6, 10, 12: `100.104.20.101` (portability L372–374). Already noted in the published repo: replace with `${NODE_HOST}` at generate time.

### 5.2 How the launcher replaces them

Do not hand-edit all 174 rows in place on the live machine as a first move. Instead:

1. Generate units, `frames.json`, `services-control.json` URLs, and cloudflared ingress from manifests.
2. Diff against the live files; apply on a copy or as a new drop-in (`*.service.d/` or a parallel `config/` in a scratch Boxes tree).
3. Switch one non-critical unit first (e.g. a stopped on-demand service), then core units, with a rollback path (`systemctl --user revert`).
4. Leave live `node-box.service` on the current ExecStart until Phase 4 + Matt’s restart approval.

### Phase 3 PASS/FAIL

| Check | PASS | FAIL |
|---|---|---|
| Generated artifacts | `rg '/home/steve|steve-ms-7c02\.tail1af4f2\.ts\.net|100\.104\.20\.101|/hdd/'` on generated units/manifests/frames is empty | Any baked this-box path in generated output |
| Live services during generation | Same curl matrix as Phase 2 still passes; no unit daemon-reload of `node-box` | Accidental restart or broken ExecStart |
| Data paths | `${DATA}` documented for this box (`/hdd` vs `$HOME`) in `launch.toml`, not in git | Hardcoded `/hdd` in a published repo |

---

## 6. Phase 4 — Session and framing fix

**Owner:** Agent implements in a copy; Matt approves the approach (Decision 15) and the one live `node-box` restart.  
**Depends on:** can start in parallel with Phase 1 (this is user-visible P0, TODO T1). Prefer landing `NODEOS_FRAME_ANCESTORS` / same-origin support so Phase 1’s `frame.sameOrigin` works.  
**Do not restart live `node-box` until the test plan below passes.**

### 6.1 What is broken (verified)

Research report §2 (and live files read at 4:54 PM CST):

- Kiosk is a transient user unit `node-tv-live.service` whose `ExecStart` is `/usr/bin/google-chrome-stable … --kiosk "http://127.0.0.1:7770/?tv=1"`. Default in `/home/steve/ang/src/node-tv-session/node-tv-session` L16: `NODE_TV_URL="${NODE_TV_URL:-http://127.0.0.1:7770/?tv=1}"`.
- `door_session` is set by `~/agents/node-door/door.py` L25 as `Path=/; Max-Age=<SESSION_TTL>; Secure; HttpOnly; SameSite=None`. Cookies are per **host**, not per port (`doorauth.ts` L19–21).
- Research §2 kiosk cookie inventory (t160u, names/hosts only): `door_session` was present on **`127.0.0.1` only** (Secure=0, Lax — expected: the browser will not store `Secure; SameSite=None` on plain `http://127.0.0.1`). No `door_session` for `steve-ms-7c02.tail1af4f2.ts.net`.
- `frameUrlFor` in `daemon/src/modules/providers/webapps.ts` L135–144 prefers `https://${NODEOS_FRAME_HOST ?? "steve-ms-7c02.tail1af4f2.ts.net"}:${servePort}${path}` unless `NODEOS_FRAME_SAME_ORIGIN=1`. If `servePort` is 0, it returns `undefined` and the tile falls through to the public `webapps.json` URL (Access / `X-Frame-Options: DENY` for Rakazo).
- Frame proxies listen on `127.0.0.1:${localPort}` (`frameproxy.ts` L118) and call `requireDoor(req, res, true)` at **L95** (and same-origin handler L138).
- `isRemote` (`doorauth.ts` L49–55): loopback or `NODEOS_HOST` is trusted **unless** `X-Forwarded-For`, `tailscale-user-login`, or **`X-Forwarded-Proto`** is present. Tailscale Serve sets the latter, so a request that reached a frame via `https://steve-ms-7c02.tail1af4f2.ts.net:<servePort>` is “remote.”
- `requireDoor` (`doorauth.ts` L75–96): if remote, no CF Access email, not `/webhook` or `/form`, and no door user → framed requests get HTML **401** with exact text `Sign in to NODE first.` (L92–94), including a `width=device-width` viewport (this is the “mobile view” people see in tiles).
- `FRAME_ANCESTORS` (`frameproxy.ts` L27–30) is `process.env.NODEOS_FRAME_ANCESTORS` or the default list `https://node.voicecommandapi.com https://steve-ms-7c02.tail1af4f2.ts.net https://steve-ms-7c02.tail1af4f2.ts.net:10000 https://steve-ms-7c02.tail1af4f2.ts.net:14443`. It **omits** `http://127.0.0.1:7770`, so even a loopback iframe would be CSP-blocked until the list is widened.

Same-origin support already exists but is off: `handleSameOriginFrame` (`frameproxy.ts` L131–153) serves `/frame/<slug>/…`; `NODEOS_FRAME_SAME_ORIGIN=1` switches `frameUrlFor` to `/frame/${slug}/` (L141). Vite-at-base-`/` apps still need a serve port (comment L126–129).

### 6.2 Proposed approach (two complementary fixes; Matt picks the kiosk URL)

**Fix A — same-origin / loopback frames (recommended for the HDMI kiosk, keeps `NODE_TV_URL` on loopback):**

1. Widen `FRAME_ANCESTORS` to include the kiosk origin `http://127.0.0.1:7770`.
2. Prefer `http://127.0.0.1:${localPort}${path}` or `/frame/<slug>/` for tiles opened from a loopback kiosk (cookie or, on pure loopback without proxy headers, `isRemote` is false and `requireDoor` allows the request).
3. Keep Tailscale serve URLs for phones / remote browsers, where `door_session` is already first-party on `steve-ms-7c02.tail1af4f2.ts.net`.

**Fix B — move the kiosk to the Tailscale origin (TODO T1 alternative):**

Point `NODE_TV_URL` at `https://${NODE_HOST}:14443/?tv=1` (this box’s current host is `steve-ms-7c02.tail1af4f2.ts.net`). Then the kiosk can store `Secure; SameSite=None` `door_session` on the same host the frames use. Requires a one-time door login in that Chrome profile. Door already sets those cookie flags (`door.py` L25) — no cookie-flag change is required for Fix B.

**Also required in both cases:**

4. Stop treating Tailscale Serve `X-Forwarded-Proto` alone as “signed out” when a valid `door_session` is present (the cookie check already exists; the bug is mostly the missing cookie on the frame host). Do **not** blindly trust `X-Forwarded-Proto` from the public internet.
5. Later: a short-lived, scoped **frame token** (query or header) that `requireDoor` accepts for iframe navigations, so asset-absolute apps on a serve port work even before the cookie is present. Not built today; design only until Matt approves (Decision 20).
6. Assign a private `servePort` to Rakazo (and CRM 2 if kept) so tiles are not framed through Cloudflare Access (`X-Frame-Options: DENY`) — TODO T3. Do this in `frames.json` / launcher map, then `tailscale serve`. Frames are read at process start (`startFrameProxies()` in `frameproxy.ts` L121–123), so a restart or a hot-reload (if added) is needed to bind a new `localPort`.

### 6.3 Exact proposed code changes (copy only; do not apply to the live tree first)

Paths are the live tree `/home/steve/ang/src/boxes/…`. Apply the same patches in a scratch clone or a worktree that is **not** `boxes-sysmon`.

**`daemon/src/frameproxy.ts` L27–30 — default ancestors must include the loopback kiosk origin; prefer env; drop baked hostname from source of truth:**

```ts
// current (L27–30):
const FRAME_ANCESTORS = (
  process.env.NODEOS_FRAME_ANCESTORS
  ?? "https://node.voicecommandapi.com https://steve-ms-7c02.tail1af4f2.ts.net https://steve-ms-7c02.tail1af4f2.ts.net:10000 https://steve-ms-7c02.tail1af4f2.ts.net:14443"
).trim();

// proposed:
const FRAME_ANCESTORS = (
  process.env.NODEOS_FRAME_ANCESTORS
  ?? [
      "https://node.voicecommandapi.com",
      "http://127.0.0.1:7770",
      process.env.NODEOS_PUBLIC_ORIGIN,   // e.g. https://${NODE_HOST}:14443
      process.env.NODEOS_DOOR_PUBLIC,     // e.g. https://${NODE_HOST}:10000
    ].filter(Boolean).join(" ")
).trim();
```

Live unit should set `NODEOS_FRAME_ANCESTORS` explicitly (including `http://127.0.0.1:7770` and the public origins) so a missing env never silently drops the kiosk origin. Do not commit a this-box hostname as the only default.

**`daemon/src/modules/providers/webapps.ts` L135–144 — prefer same-origin when asked; no hardcoded frame host:**

```ts
// current:
function frameUrlFor(slug: string, _url: string): string | undefined {
  const f = frames().find((x) => x.slug === slug);
  if (!f || !f.servePort) return undefined;
  if (process.env.NODEOS_FRAME_SAME_ORIGIN === "1") return `/frame/${slug}/`;
  const host = process.env.NODEOS_FRAME_HOST ?? "steve-ms-7c02.tail1af4f2.ts.net";
  return `https://${host}:${f.servePort}${f.path}`;
}

// proposed:
function frameUrlFor(slug: string, _url: string): string | undefined {
  const f = frames().find((x) => x.slug === slug);
  if (!f) return undefined;
  // Loopback kiosk / same-origin: stay on NODE's origin so door_session is first-party.
  if (process.env.NODEOS_FRAME_SAME_ORIGIN === "1") return `/frame/${slug}/`;
  if (process.env.NODEOS_FRAME_LOOPBACK === "1" && f.localPort) {
    return `http://127.0.0.1:${f.localPort}${f.path}`;
  }
  if (!f.servePort) return undefined; // caller falls back to webapps.json public URL
  const host = process.env.NODEOS_FRAME_HOST; // required; set by unit from ${NODE_HOST}
  if (!host) return undefined;
  return `https://${host}:${f.servePort}${f.path}`;
}
```

For this box’s kiosk, set `NODEOS_FRAME_LOOPBACK=1` (Fix A) **or** change `NODE_TV_URL` (Fix B) and keep serve-port frame URLs.

**`daemon/src/doorauth.ts` — defaults (L26–28) and requireDoor (L75–96):**

```ts
// current L26–28:
const DOOR = (process.env.NODEOS_DOOR_URL ?? "http://127.0.0.1:7700").replace(/\/$/, "");
export const DOOR_PUBLIC = (process.env.NODEOS_DOOR_PUBLIC ?? "https://steve-ms-7c02.tail1af4f2.ts.net:10000").replace(/\/$/, "");
export const NODE_PUBLIC = process.env.NODEOS_PUBLIC_ORIGIN ?? "https://steve-ms-7c02.tail1af4f2.ts.net:14443";

// proposed: keep loopback door default; do not bake the tailnet hostname.
const DOOR = (process.env.NODEOS_DOOR_URL ?? "http://127.0.0.1:7700").replace(/\/$/, "");
export const DOOR_PUBLIC = (process.env.NODEOS_DOOR_PUBLIC ?? "").replace(/\/$/, "");
export const NODE_PUBLIC = (process.env.NODEOS_PUBLIC_ORIGIN ?? "").replace(/\/$/, "");
```

Units must set `NODEOS_DOOR_PUBLIC` and `NODEOS_PUBLIC_ORIGIN`. `requireDoor` L85 already builds `login` from those values.

Optional tightening of `isRemote` (L49–55): if a valid `door_session` already authenticates (`doorUser`), `requireDoor` L84 already allows the request. No change needed for the “valid cookie on the frame host” path. Do **not** treat “has `X-Forwarded-Proto` but no cookie” as trusted. A later frame-token check would go here, immediately after the CF Access email check (L79–80):

```ts
  // proposed (only after a token design is approved — do not invent a token scheme in production):
  // if (await isValidFrameToken(req)) return true;
```

**Kiosk URL (Fix B only) — `node-tv-session` L16 and the transient unit:**

```sh
# current:
NODE_TV_URL="${NODE_TV_URL:-http://127.0.0.1:7770/?tv=1}"

# proposed portable default (Fix B):
NODE_TV_URL="${NODE_TV_URL:-https://${NODE_HOST}:14443/?tv=1}"
```

Do not bake `steve-ms-7c02…` into the script. Changing the **running** transient `node-tv-live.service` is a visible kiosk change — only after Matt accepts Fix B and a test profile has logged in at the door.

**Unit env to add (names only):** `NODEOS_FRAME_ANCESTORS`, `NODEOS_FRAME_SAME_ORIGIN` or `NODEOS_FRAME_LOOPBACK`, `NODEOS_FRAME_HOST`, `NODEOS_PUBLIC_ORIGIN`, `NODEOS_DOOR_PUBLIC`. Values come from `${NODE_HOST}` and known ports, not committed secrets.

### 6.4 Test plan (copy / second port) — before restarting live `node-box`

Work in a scratch clone or a new worktree **other than** `boxes-sysmon`. Do not change the live unit’s `ExecStart` until the last step.

1. Build daemon in the copy (use the repo’s existing package scripts — do not invent a new toolchain).
2. Run it on a **second port**, e.g. whatever listen env `daemon/src/index.ts` already documents (read it at implementation time; do not guess a new name into production). Use a temporary frames file whose `localPort` values are unused (not 17801–17819).
3. Set `NODEOS_FRAME_ANCESTORS` to include `http://127.0.0.1:<testPort>` and the public origins. Exercise:
   - Loopback iframe: `curl -s -D- -o /dev/null -H 'Origin: http://127.0.0.1:<testPort>' http://127.0.0.1:<tempLocalPort>/` — CSP `frame-ancestors` must list the test origin; body must **not** be the L94 “Sign in to NODE first.” HTML when the request is pure loopback.
   - Same-origin path: `GET http://127.0.0.1:<testPort>/frame/twenty-crm/` with and without a door cookie.
   - Simulated Serve: request with `X-Forwarded-Proto: https` **and** a valid `door_session` (obtained from door `/login` on a test user, value not logged) must be 200; the same request **without** cookie must still 401.
4. Optional: a throwaway Chrome user-data-dir (not `~/.config/node-tv-session/chrome-profile`) opened at `http://127.0.0.1:<testPort>/?tv=1`, then a Twenty/n8n/OpenJarvis tile. PASS = app UI, not the 401 HTML and not an Access deny page.
5. Rakazo: only after a temp `servePort` is assigned, confirm the frame URL is the Tailscale/loopback proxy, not `https://rakazo.voicecommandapi.com/`.
6. When that passes, request Matt’s OK to: build `daemon/dist` in the **live** tree, `systemctl --user restart node-box.service` **once**, then reload the kiosk (F5, or a `NODE_TV_URL` change if Fix B). Do not bounce twice (TODO T1).

### 6.5 Rollback

- Keep the previous `daemon/dist` directory as `daemon/dist.bak-YYYYMMDD-HHMM` (already a local pattern; `_backups/` is gitignored — `NODE-CHANGES-SUMMARY` §7).
- `systemctl --user restart node-box.service` back onto the bak dist (temporary ExecStart override in a drop-in, then revert).
- If the kiosk URL was changed, set `NODE_TV_URL` back to `http://127.0.0.1:7770/?tv=1` and relaunch `node-tv-live` only.
- Confirm rollback: `curl http://127.0.0.1:7770/` = 200; unit active; kiosk process still present.

### Phase 4 PASS/FAIL

| Check | PASS | FAIL |
|---|---|---|
| Copy / second-port tests | 401 HTML absent for loopback frames; CSP includes the test origin; remote without cookie still 401 | Live `node-box` was restarted to “see if it works” |
| After approved live restart | `curl http://127.0.0.1:7770/` = 200; Twenty/n8n frames 17802/17804 = 200; kiosk tile shows app UI, not “Sign in to NODE first.” | Tiles still 401 or CSP-blocked; multiple restarts |
| Cookie flags | `door.py` L25 still `Secure; HttpOnly; SameSite=None` (no accidental loosening) | Cookie becomes `SameSite=Lax` on HTTPS frames |

---

## 7. Phase 5 — Business connection and security

**Owner:** Agent implements token + NODE connect form after Matt’s token / PR / leak / RLS decisions (Decisions 3–6).  
**Depends on:** none of the MSI daemon restarts, except if the 500-char cap change is in the same `node-box` bounce as Phase 4 — prefer not to combine.  
**Do not write `~/.config/nodeos/platform.json` until a token strategy exists** (TODO T5). File is **absent** today (live check).

### 7.1 Device token design (preferred; not the 1h Supabase JWT)

Verified drafts, **unbuilt**, in research §5.2–5.6 and `/workspace/reports/node-platform-readiness.md`:

- Dashboard sessions are Supabase Auth JWTs; `expires_in` is typically **one hour**; refresh is a separate `refresh_token` that NODE **never stores** (`daemon/src/platform/client.ts` sends a static `Authorization: Bearer ${token}`; no refresh).
- `POST /api/platform/connect` in `daemon/src/index.ts` L81–89 caps `token` at **500** characters (`baseUrl` max 300, `slug` max 120, `businessName` optional max 200). Typical Supabase JWTs exceed 500 characters, so the connect API will reject the token the dashboard issues. Writing `platform.json` or `NODEOS_API_TOKEN` bypasses the cap (`platform/config.ts` L38–43, L47–52, mode 0600 at L50).
- Preferred design (research §5.6): a **revocable, slug-scoped, per-device token**, modeled on `business_mcp_tokens`: shown once, **hash at rest**, accepted on dashboard routes, short enough for the 500-char cap (or the cap is raised only for this token class), **long-lived or refreshable**. Not an impersonation key and not an MCP key (TODO T5 / T10).
- Env overrides already defined: `NODEOS_API_URL`, `NODEOS_API_TOKEN`, `NODEOS_SLUG` (`config.ts` L39–41). Loader path: `${HOME}/.config/nodeos/platform.json`.
- Example slug `the-hangout` / businessName `The Hangout` / `baseUrl` `https://gcr-api-clean.vercel.app` is a **draft template only**, not a live config. Do not write it until Matt says so.

Implementation sketch (API side, `gcr-api-clean`, not in PR 113):

1. Table of device tokens: id, entity slug, device label, hash, scopes (read menu / hours / etc.), created_at, last_used, revoked_at.
2. Issue endpoint (owner-authenticated) returns the raw token **once**.
3. Dashboard routes accept `Authorization: Bearer <device-token>` in addition to a live user JWT.
4. NODE Settings form calls `POST /api/platform/connect` with `{ baseUrl, token, slug, businessName }` and saves via `savePlatformConfig`.
5. NODE never logs the token. Rotation = revoke + re-issue.

Alternative Matt may choose: raise/remove the 500-char cap **and** store+use a refresh token. That still expires/rotates with Supabase Auth and is worse for a kiosk box.

### 7.2 `platform.json` creation

Only after 7.1 exists:

- Write `${HOME}/.config/nodeos/platform.json` mode 0600 with `baseUrl`, `token`, `slug`, optional `businessName` (`config.ts` L12–21, L47–52).
- Confirm `GET http://127.0.0.1:7770/api/platform` shows `connected: true` without printing the token.
- Add the Settings connect form so the message “This box is not connected to a business yet. Open Settings and sign in.” is not a dead end (TODO T5; `answer.ts` referenced in research §9).

### 7.3 API path alignment

Production `gcr-api-clean` is `edb480069f21a881ebaf6cebe6cdc3cb621e5481`. NODE calls `GET /api/dashboard/menu` (`index.ts` around L97–98, research §5.1 / TODO T5). Production route is `/menu-items`. Production `GET /api/health` is **404**.

PR 113 (https://github.com/CultureReset/gcr-api-clean/pull/113, draft, unmerged, undeployed; head `3352af8601840d2b1dde3dd996885a7fe073cc29`) adds `GET /api/health`, aliases `/api/dashboard/menu*`, field aliases, and slim `GET /api/public/:slug`. It does **not** add device tokens, does **not** strip the public entity leak, and does **not** enable RLS.

Until PR 113 is deployed: change NODE to call `/api/dashboard/menu-items` and do not call `/api/health`. After deploy: confirm `GET https://gcr-api-clean.vercel.app/api/health` is 200, then aliases can stay.

Pictures today is only `~/Pictures`. Business gallery on `GET /api/gallery/:slug` is TODO T19, after connect works. Offline backup `/home/steve/ang/var/backup/photos` (19,239 images, 7.2G) is a subset of CyberCheck `entity_photos` (doc count 77,497, project `mkepugvdlktfsossumox`) — verification did **not** re-query that count (unchecked item 180).

### 7.4 Public entity leak strip

Production `GET https://gcr-api-clean.vercel.app/api/gcr/entity/:slug` uses `select('*')` / `buildFullEntity()` with no allowlist (research §5.4). Live check on slug `the-hangout`: HTTP 200, ~198 KB, top-level `menu_pin`, `ical_token`, `menu_pin_fail_count` present (values not recorded). `Cache-Control: public, max-age=120, s-maxage=120`. Route is **not** named `business-info`. PR 113 does not fix this.

Follow-up (separate PR, Matt must authorize): stop `select('*')`; strip at least `menu_pin`, `ical_token`, and pin-lock fields; re-check keys only. This is independent of NODE and is high severity (TODO T4).

### 7.5 RLS notes — Matt decision only

Gulf Coast Radar project `adpnhipmdefutkzzltbs`: research §5.5 recorded **128 RLS off, 54 RLS on, 182 total** public tables. Off includes `entity_photos`, `menu_items`, `gcr_menu_items`, `menu_details`, `menu_sections`, `menu_sub_sections`, `photos`. Verification did **not** re-query (needs production DB credentials; uncheckable item 176). High blast radius — plan, do not flip globally (TODO T6). No RLS changes in this plan’s execution.

### Phase 5 PASS/FAIL

| Check | PASS | FAIL |
|---|---|---|
| Device token | Token shorter than 500 chars (or cap updated); hash at rest; revoke works; NODE connect saves mode 0600 | Raw 1h JWT written to `platform.json`; token printed in logs or git |
| API paths | Until PR 113: NODE calls `/menu-items`; no `/api/health` dependency. After deploy: `/api/health` 200 | Connect appears to work but menu always errors |
| Leak | Public entity payload no longer contains `menu_pin` / `ical_token` / fail_count (key names only) | `select('*')` still on the public route |
| RLS | No change unless Matt approved a reviewed enablement plan | Global enable without a review |
| `platform.json` | Absent until strategy exists; then mode 0600 and `isConnected()` true | File written with a placeholder or example token from the draft |

---

## 8. Phase 6 — Dedup and cleanup

**Owner:** Agent executes only after Matt’s CRM 2 / n8n / archive decisions.  
**Depends on:** Decision 1 and 2. No service stops until references are removed.

### 8.1 CRM 2 decision path

Both Twenty stacks are referenced (`execution-20261109.md` §1). **Do not remove the one in use.**

**Keep (`:3000`, `/home/steve/twenty`) always**, unless Matt later replaces it: NODE slug `twenty-crm`, `webapps.json` “Twenty CRM” → `https://crm.voicecommandapi.com/`, services-control `twenty`, door `apps.json`, MCP `registry.yaml` `http://127.0.0.1:3000/rest`, `node-mcp-hub` ExecStartPre `wait-for 90 http://127.0.0.1:3000/healthz`, Tailscale `:26443` → `17802`, cloudflared `crm.voicecommandapi.com` → `17802`, node-home id `crm`.

**CRM 2 (`:3020`, `/home/steve/nextgent/apps/twenty-runtime`)** is also referenced: `frames.json` slug `crm2` upstream `http://127.0.0.1:3020`, `localPort` 17813, `servePort` **0**; `webapps.json` “CRM 2”; cloudflared `crm2.voicecommandapi.com` **and** `nextgent-crm.voicecommandapi.com` → `17813`; node-home ids `crm2` and `nextgent-crm`. Official image + Redis, **no local Postgres**; attached to external Docker network `supabase_default`.

If Matt **retires** CRM 2, do this in order:

1. Remove NODE tile / `webapps.json` `crm2`, `frames.json` `crm2`, node-home `crm2` and `nextgent-crm`.
2. Remove cloudflared hostnames `crm2.` and `nextgent-crm.` (and DNS if needed).
3. Confirm nothing else points at `:3020` or `17813` (`rg` over units, door, MCP, node-home, cloudflared).
4. Stop the compose stack **without** `-v`. Leave volumes until Matt confirms a delete.
5. Recheck `:3000/healthz` 200, MCP `:7790` 401, NODE `:7770` 200.

If Matt **keeps** CRM 2: assign a private `servePort` (TODO T3) and a manifest; do not treat it as a duplicate.

### 8.2 Two n8n items

| Item | Role | Action until Matt decides |
|---|---|---|
| Docker `n8n` `:5678` | Live editor / webhooks / NODE tile | **Keep.** |
| `~/n8n-sandbox` | Official n8n sandbox / DinD + `sandbox-api` on `supabase_default`; **no host ports**; live `n8n` has **no sandbox-related environment variables** — use is **ambiguous** | Leave running. Decision 2. |
| `/home/steve/nextgent/n8n` | Not running; would publish `:5680`; has a local `data/` dir; no NODE/door/cloudflared references found in the scoped search | Leave in place. Do not delete `data/` casually. |

### 8.3 Remaining duplicates / skipped archive items

Already archived: 119 trees to `~/_archive/2026-11-09/` (`archive-moves.json`). Not deleted.

Still on disk, needing a Matt decision (`execution` §3g, `NODE-CHANGES-SUMMARY` §6, TODO T16):

| Path | Reason left |
|---|---|
| `/home/steve/ang/repos/Admin-dashboard-main` | 11 unique commits vs src |
| `/home/steve/ang/repos/Dashboards-users-` | HEAD differs (`f323f5510f` vs earlier src pin; see verification correction 10 for current SHAs) |
| `/home/steve/ang/repos/cybercheck-orchestrator` | HEAD differs |
| `/home/steve/ang/repos/cybercheck-api-database` | symlink, uncertain |
| `/home/steve/ang/repos/gar-front-end-data` | symlink, uncertain |
| `/home/steve/ang/src/openclaw-upstream` | ~3.4–3.5G third-party tree |
| `/home/steve/ang/src/twenty-CRM` | ~1.9–2.0G source fork, not the running images |
| `/home/steve/agent-catalog` | path is **not** `ang/src/agent-catalog` (verification correction 9) |
| dirty-only `ang/repos` trees (`cyber-admin`, `trip-swipe-`, etc.) | likely unignored build artifacts; review first |
| stale `ang/src/Open-jarvis` | not the running `~/.openjarvis/src` |
| extra Hermes `ang/src/hermes` | older pin `00570550f3`; running install is `~/.hermes/hermes-agent` |
| `~/.openclaw/workspace` | live untracked workspace; not archived |

Optional later: delete `~/_archive/2026-11-09/` to actually free ~4.1G. Not part of this plan’s automatic steps.

### Phase 6 PASS/FAIL

| Check | PASS | FAIL |
|---|---|---|
| CRM 2 retired (only if approved) | References gone, then stack stopped without `-v`; `:3000` and MCP still healthy | Stack stopped while `crm2` frame or hostnames still exist |
| n8n | `:5678` still 200; sandbox / `~/nextgent/n8n` only changed after an explicit decision | Data dir deleted; live editor down |
| Archive leftovers | Moved or deleted only on Matt’s list | Running path or `boxes-sysmon` moved |

---

## 9. Phase 7 — Verification and bootstrap

**Owner:** Agent after Phases 1–6 have landed enough to try a clean clone (Phase 1 + secrets provisioning at minimum).  
**Depends on:** Phase 1 launcher; Phase 2 recipe for n8n; Phase 3 generated units; Phase 4 session fix for framed tiles; Phase 5 only if business data is in the acceptance bar.

### 9.1 How to prove a fresh clone works

Use a **clean user, VM, or container** — not a second checkout that still has `/home/steve` units. Accept that data volumes (Twenty DB, n8n_data, Supabase, photos) will be empty unless Matt provides a documented restore.

1. Install OS deps (Docker, Node, Python, Tailscale, cloudflared) as documented in the updated bootstrap prompt.
2. `node-launch init` with `${HOME}`, `${DATA}`, `${NODE_HOST}` (from `tailscale hostname` / `tailscale ip -4`).
3. Clone the published list at pinned SHAs (update the bootstrap file with **final** SHAs at this time; do not copy stale pins — see §9.2).
4. Enroll secrets by **name** (door owner login, MCP/app tokens, compose env files, approval-gateway keys). Never commit values.
5. One command: `node-launch up` (or equivalent) starts core services from manifests, allocates loopback ports, generates units, registers frames.
6. Expected health checks (status codes, not bodies with secrets):

| Check | Expected |
|---|---|
| `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${NODEOS_PORT}/` | 200 |
| MCP hub root | 401 (auth required = up) |
| Twenty `${port.web}/healthz` | 200 |
| n8n `${port.web}/` | 200 |
| OpenJarvis API `/health` | 200 |
| LiteLLM `/health/liveliness` | 200 (do **not** expect `/health` 200; that is 401 on this box — verification correction 2) |
| Door `/health` | 200 (open route, per `door.py` header comment) |
| A framed tile from a test kiosk origin | App UI, not 401 “Sign in to NODE first.” and not Access `XFO: DENY` |
| `rg '/home/steve|steve-ms-7c02' ${HOME}/.config/systemd/user/node-*.service` (generated units) | no matches |

FAIL if any core unit was hand-edited with a this-box path, or if the operator had to change source files to start the stack.

### 9.2 Update bootstrap + to-do with final SHAs, and apply the 16 verification corrections

Docs to update (same Boxes branch, separate docs commit is fine):

- `artifacts/NODE-BOOTSTRAP-PROMPT-2026-11-09.md`
- `artifacts/NODE-FULL-TODO-2026-11-09.md`
- this plan’s SHA table, if pins moved

**Verification corrections** from `bootstrap-verification-20261109.md` “Doc corrections needed” (16 mismatches + related notes; 181/200 matched). Apply all of these when rewriting the bootstrap/to-do:

1. Live Boxes worktree and `origin/fix/node-pwa-inframe-apps` are **not** stuck at `5b7e39c`. At plan write, HEAD is `e9b71ddeda6ac8b2cf2a3d81c43bc4ecbf48a6f0` (this plan commit will move HEAD again). `5b7e39c` remains the last shell/CSS code parent before the docs commits. `boxes-sysmon` at write: ahead 1 / behind **3** of current origin.
2. LiteLLM: `GET /health` is **401**, not 200. `GET /health/liveliness` is 200 and is what `node-mcp-hub` ExecStartPre waits on. `HEAD /health` is 405.
3. `node-box.service` effective Restart is **always / 5s** because of `boot-order.conf`, not only `on-failure` / 3s from the main unit.
4. `node-home.service` ExecStart is `python3 -m http.server 7690 --bind 127.0.0.1`. `frame_proxy.py` exists in `/home/steve/node-home` but is not what the unit runs.
5. `node-mcp-hub.service.d/10-localhost-only.conf` **is applied** and sets `HUB_HOSTS=127.0.0.1`. Hub listens only on `127.0.0.1:7790`; tailnet access is `tailscale serve :17790`.
6. Cloudflare hostnames for `:7700`, `:7710`, `:7690`: `node.voicecommandapi.com` defaults to 7700, `/tunnel` to 7710, `/portal` to 7690. `home.voicecommandapi.com` to 7690 is still commented; public GET is 404.
7. `api.voicecommandapi.com` ingress: `config.yml` maps `/ui*` and `/(sso|login).*` to 403 and the default to `http://127.0.0.1:4000`.
8. Record full live `tailscale serve status`: every `frames.json` `servePort` matches; four `services-control` discrepancies are also live (`:7443`→17808, `:4443`→4533 direct, `:13443`→8080 direct, `:12443`→11235 direct). Also present: `:14443/approvals`→7795, `:16443`→2586, Funnel `:8443` `/send|/inbound|/sms-hook`→8787, Funnel `:10000`. (TODO T18 still must *decide* which port is canonical.)
9. T16 `agent-catalog` path is `/home/steve/agent-catalog`, not `ang/src/agent-catalog`.
10. `Dashboards-users-` SHAs: local HEAD `f323f55` on `claude/dashboard-inventory-purposes-m5wtba`; GitHub tip of that branch `aac903f`; GitHub main `d290da4`. `8f6199a` is not in the local object store.
11. OpenJarvis local branch name is `main` at `5e5f5ef`; `matt/local-20261109` exists on the CultureReset remote only.
12. Fill in full SHAs: `node-tv-session` `bb5fce7a6659c3bb7a4f3b65b899661152444697`; `nextgent-vitals` `82b978ac5517e9e61b847a56a33ac11e4d9dd084`.
13. `hotel-websites-receiver.service` does not exist (watcher and scraper units do). `node-voice.service` is **not-found**, not merely inactive.
14. MiniDLNA webapps URL is correct, but nothing listens on `:8200` now.
15. T25 last checkbox should be `[x]`: both files are on GitHub (at least since `d9a83ca`; later summary `e9b71dd`).
16. CultureReset repo count was 293 at verification (289 at audit plus the four repos created that day). Re-count at bootstrap update time; do not invent a new number.
17. (Related note 17) `kamra-runtime` compose path `/tmp/schema-load/kamra-runtime` is gone; exited containers remain.
18. (Related note 18) `frameUrlFor()` lives in `daemon/src/modules/providers/webapps.ts`, not `frameproxy.ts`.
19. Optional notes: leftover exited container `rakazo-bot-team`; Access-protected hostnames 302 to Cloudflare Access (XFO is not on the 302 itself).

Unchecked in verification (do not claim re-checked until someone with credentials does it): GCR RLS table count (176), CyberCheck photo count (180), TV kiosk cursor/zoom screenshot after F5 (183).

### Phase 7 PASS/FAIL

| Check | PASS | FAIL |
|---|---|---|
| Fresh-clone harness | `node-launch up` on a clean machine meets the health table in §9.1 with zero manual path edits | Operator had to edit units or `frames.json` by hand |
| Docs | Bootstrap pins match `git ls-remote`; all 16 corrections applied; T25 checked | Pins still say Boxes HEAD is `5b7e39c` or LiteLLM `/health` 200 |
| Live MSI | Still up during the clone test (the test is not a teardown of steve-MS-7C02) | Production kiosk taken down to run the proof |

---

## 10. Matt-only decisions

The plan cannot make these. Do not execute the dependent step until Matt answers.

1. **Keep or retire CRM 2** (`:3020` / `crm2` + `nextgent-crm` hostnames / frame 17813). It is referenced, not an unused duplicate. If kept, assign a `servePort`. If retired, follow §8.1 order. (TODO T7)
2. **n8n companions:** is `~/n8n-sandbox` actually used? What to do with unused `/home/steve/nextgent/n8n` (has `data/`)? (TODO T8)
3. **Merge and deploy gcr-api-clean PR 113** (draft, head `3352af8601840d2b1dde3dd996885a7fe073cc29`). Separate from the leak strip and from RLS. (TODO T9)
4. **Authorize the public entity leak strip** on `GET /api/gcr/entity/:slug` (stop `select('*')`; strip `menu_pin`, `ical_token`, pin-lock fields). Not in PR 113. (TODO T4)
5. **RLS on Gulf Coast Radar** (`adpnhipmdefutkzzltbs`): whether, and in what order, to enable RLS on the ~128 public tables where it is off. High blast radius. (TODO T6)
6. **Token strategy:** preferred revocable slug-scoped **device token**, vs raised 500-char cap + refresh of the 1h Supabase JWT. Do not paste impersonation or MCP keys into NODE. When (if ever) to write `platform.json`, and whether the Hangout slug is the live business. (TODO T5, T10)
7. **System Monitor:** land or rebase unpushed `494941fce23345c55c50e7de933ea9fc877b687d` (`feat/node-system-monitor`) onto `fix/node-pwa-inframe-apps` (behind 3 docs commits at plan write). Do not run it from `/home/steve/ang/src/boxes-sysmon` against live `node-box`. (TODO T11)
8. **OpenJarvis dirty patches:** commit or discard `loader.py`, `builder.py`, and the two `.bak-20261021` files onto `openjarvis-node` `matt/local-20261109`. Rebase/cherry-pick policy while the pin is 94 commits behind upstream. Sidebar `store.ts:292` one-liner only after this. (TODO T12, T20)
9. **Boxes as glue only:** when to slim `CultureReset/Boxes` to `box/`, `apps/`, `services/`, `config/`, `spec/` and retarget `node-box.service` at `node-daemon` / `node-shell`. Live path stays `/home/steve/ang/src/boxes` until that cutover is explicit. (TODO T13)
10. **TV vs desktop display:** keep `tv: true` + kiosk on `:0` while `node-box` uses `DISPLAY=:10.0`, or point the daemon at `:0` / turn TV mode off for the desktop monitor. (TODO T14)
11. **Orchestrator vision:** whether Paperclip becomes the sole agent/task orchestrator, and what happens to n8n, OpenClaw, GBrain, and Rakazo as control planes. Today they are separate framed tiles. (TODO T15)
12. **Archive deletion / leftover duplicates:** optionally delete `~/_archive/2026-11-09/` (~4.1G). Fate of the skipped paths in §8.3 (including `openclaw-upstream`, `twenty-CRM`, `agent-catalog`, extra Hermes / Open-jarvis clones). (TODO T16)
13. **Where `node-launch` lives:** new private `CultureReset/node-launch` (recommended) vs `Boxes/launch/` glue. Do not `gh repo create` until this is answered. (Phase 1)
14. **Rakazo (and CRM 2 if kept) `servePort` assignment** and any new Tailscale serve ports. Do not `docker compose down -v` on Rakazo. (TODO T3)
15. **Kiosk session approach:** Fix A (keep `http://127.0.0.1:7770/?tv=1`, loopback/same-origin frames + `FRAME_ANCESTORS`) vs Fix B (point kiosk at `https://${NODE_HOST}:14443/?tv=1`). And when to approve the **one** live `node-box` restart after the copy/second-port test passes. (TODO T1; T2 kiosk reload can happen sooner, without a restart, for already-landed CSS/JS.)
16. **`paperclip-node` history:** triage/rewrite the 95 gitleaks findings, replace the repo, or leave it skipped forever. No push until then.
17. **Reconcile serve-port disagreements** (which number is canonical): Uptime Kuma `27443` vs `7443`; Navidrome `24443` vs `4443`; llama-swap `33443` vs `13443`; Crawl4AI `32443` vs `12443`. Live serve status has both styles (verification correction 8 / TODO T18).
18. **`fix/ubuntu-node-support`:** rebase local `e7164c2` vs remote `9d32c04` (ahead 1, behind 8) before any push. (TODO T21)
19. **New overlay repos** for LiteLLM config, SearXNG, Kuma, Crawl4AI, sudo-runner, if they are not folded into `nextgent-runtimes` / `node-infra`. (TODO T22)
20. **Frame token** (Phase 4 item 5): whether to add a scoped iframe token, or rely only on cookie + same-origin / Fix B.

---

## Execution order (when Matt says go)

1. **Phase 1** contract + launcher home (Decision 13) — blocks a true fresh-clone proof.
2. **Phase 4** session/framing in a copy, then one approved `node-box` restart; kiosk F5 (T2) can happen anytime for cursor/zoom CSS already in `5b7e39c`.
3. **Phase 5** leak strip (Decision 4) can run in parallel — it is not a NODE restart.
4. **Phase 2** remaining imports (OpenJarvis / sysmon / paperclip-node only after Decisions 7, 8, 16).
5. **Phase 3** replace hardcoded paths with generated units (after Phase 1).
6. **Phase 6** CRM 2 / n8n / archive only after Decisions 1, 2, 12.
7. **Phase 7** fresh-clone proof + bootstrap/to-do SHA and correction update.

Explicitly out of scope until re-approved: restarting live `node-box` without a passing Phase 4 test; `docker compose down -v` on Rakazo / Twenty / Supabase / n8n; stopping `:3020` or `n8n-sandbox` while references or ambiguity remain; touching `boxes-sysmon`; force-pushing any CultureReset repo; deleting archive or data volumes; writing `platform.json` with a 1h JWT or a draft placeholder token.

---

## What this document commit does / does not do

- **Does:** add this one markdown file under `artifacts/` and push it to `fix/node-pwa-inframe-apps`.
- **Does not:** change running services, restart `node-box`, touch `boxes-sysmon`, create repos, move or delete archive contents, apply portability or kiosk fixes, write `platform.json`, or merge PR 113.
