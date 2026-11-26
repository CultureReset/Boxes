# CultureReset / NODE full repository architecture audit

**First pass — 2026-11-09.** Read-only inspection plus documentation. No running services, units, configs, remotes, or `boxes-sysmon` were changed.

- **When:** Monday, Nov 9, 2026, approximately 5:00–5:30 PM CST (America/Chicago).
- **Machine:** steve-MS-7C02 (Matt's MSI desktop).
- **GitHub org/user:** CultureReset — **293** repositories listed by `gh repo list` / GraphQL `repositoryOwner` (Matt's earlier figure of ~289 was accurate *before* today's four new private repos: `node-daemon`, `node-shell`, `rakazo`, `supabase-local`; 289+4=293).
- **None of the 293 were cloned into live directories for this audit.** Remote-only repos were read with the GitHub Contents/README API. Scratch work stayed under `/home/steve/_work/repo-audit-20261109/` (plus today's already-existing `_work/import-20261109` and `_work/split-20261109` copies, which were only read).

## (a) Method, evidence sources, and coverage

### The “44 named repos Matt already listed” was not found

Searched, and **no document enumerates exactly 44 named repositories** as a labeled list. Places checked:

- `/home/steve/artifacts/sprawl-audit-20261109/plan.md` — closest item: the **49-row** “one repo per component” proposal table (some rows are grouped, e.g. ten `nextgent-*` services in one cell).
- `/home/steve/ang/src/boxes/artifacts/NODE-BOOTSTRAP-PROMPT-2026-11-09.md`, `NODE-FULL-TODO-2026-11-09.md`, `NODE-CHANGES-SUMMARY-2026-11-09.md`, and (later present) `NODE-FULL-FIX-PLAN-2026-11-09.md`.
- `/workspace/artifacts/full-state-research-2026-11-09.md` — discusses “14 CultureReset repos” (corrected as an undercount), “13/14 non-git running clusters,” and “348 / 83” local clones, not a 44-item list.
- `/home/steve/ang/REPO-MAP.md` — September 2026 inventory of `~/ang`, not 44 repos.
- `/home/steve/artifacts/node-kit-portability-2026-11-07.md` — **16** ai-stack-kit components, not 44.
- `/workspace/reports/_repo_names.txt` — 247 names from an older catalog.

The summary table in section (b) is therefore a **derived priority list of 48 repositories** that NODE actually runs or references, plus today's new CultureReset repos and the main GCR / dashboard / agent-family heads. It is **not** “Matt's 44 list.”

### Evidence sources (only these)

- GitHub: `gh repo list CultureReset --limit 1000` (293 rows) and paginated GraphQL (default branch name, SHA, commit date, fork parent, language, diskUsage, isEmpty). Default-branch SHA was obtained for **267** non-empty repos; **26** repos are empty/unborn (`isEmpty`, no default SHA).
- Branch tips (REST `/branches`, not a full clone) for 26 priority repos. `gcr-api-clean` has **at least 100** branches (response hit `per_page=100`; list may be truncated).
- Local clone inventory from `/home/steve/artifacts/sprawl-audit-20261109/repos.json` (348 git repos as of ~3:20 PM CST), **remapped** through `archive-moves.json` (119 folders moved at ~3:51 PM CST to `~/_archive/2026-11-09/`; all 119 destinations exist; original paths are gone). Plus today's `_work/import-20261109` and `_work/split-20261109` copies, and a live `git remote`/`HEAD` refresh of priority trees.
- Live runtime (this pass, read-only): `ss -ltnp`, `docker ps` + compose project working_dir labels, `systemctl --user` running units (ExecStart / WorkingDirectory / PID only), NODE `config/frames.json`, `webapps.json`, `services-control.json`, redacted `~/.cloudflared/config.yml` ingress map, `tailscale serve status`.
- Prior same-day docs, used as secondary evidence and never to invent missing facts: `execution-20261109.md`, `portability.md` (174 hardcoded-path findings), `plan.md`, `inventory.md`, `duplicates.md`, `bootstrap-verification-20261109.md`, `NODE-CHANGES-SUMMARY-2026-11-09.md`, `full-state-research-2026-11-09.md`.
- Deep/shallow tree reads of local checkouts and live runtime dirs: top-level layout, README heads, package/pyproject names, compose *service/image/port* summaries. **Secret-named files were not opened** (`.env`, credentials, `*.pem`, key files, etc.). Compose `environment` / `env_file` blocks were skipped. Secret *values* are not recorded anywhere in this audit.
- GitHub Contents + README API for 20 remote-only or thin-kit repos (gbrain, openclaw, paperclip, n8n, searxng, litellm, ollama, MagicMirror, chisel, node-tunnel, node-health, node-approval-grants, paperclip-approval-bridge, node-kit-runtime, nextgent-shell, node-infra, node-foundation, node-agents, Open-claw, Open-jarvis).

What this pass did **not** do: clone the long tail; walk all 100+ `gcr-api-clean` branches; re-run gitleaks on every repo history (a prior pass reported 95 hits in `paperclip-node` history — count only, not values); log into production databases; screenshot the TV kiosk; merge or create any GitHub repo.

### Coverage counts (honest)

| Depth | Count | Meaning |
|---|---:|---|
| **metadata-only** | 215 | GitHub GraphQL/list + local path mapping + running map. Includes all 26 empty repos (confirmed empty, no tree to inspect). |
| **shallow** | 42 | Root/README via GitHub API, and/or a local top-level + README/package read for a GCR, CyberCheck, nextgent-*, or fork family member. |
| **deep** | 36 | Local (or work-copy) tree: modules, manifests, compose/unit files, plus live runtime evidence where the component is running. |
| **Total CultureReset repos in this inventory** | 293 | All 293 GitHub repos. No extra local-only CultureReset remotes were found that are missing from the GitHub list. |

Also: **155 public**, **138 private**, **84 forks** (all 84 forks have a recorded parent), **0 archived** on GitHub, **26 empty/unborn**, **210** with at least one local path (live, work-copy, or today's archive), **25** with a live process/container actually attributable to them (excluding “source fork, not what's running” notes).

GraphQL default-branch SHA coverage: 267 / 293. The 26 without SHA are the empty repos listed in section (d).

Rate limit: GitHub core remaining was 4878 at the start of the GitHub list fetch and 3258 after branch + contents calls (other same-day work may also have used this token). Contents fetches were limited to the 20 names above; the long tail was not README-crawled.

## (b) Priority summary table (derived, not Matt's 44)

Authoritative SHAs below: GitHub **default branch** tip unless a different live/authoritative branch is stated in the Runtime / Branch column. Times are America/Chicago (CST).

| # | Repo | Vis | Source | Default branch @ SHA | Live / authoritative | Running? | Decision |
|---:|---|---|---|---|---|---|---|
| 1 | [`Boxes`](https://github.com/CultureReset/Boxes) | public | original | `claude/linux-build-cleanup-dfpu0e` `ae6e0ad07d2a` | `fix/node-pwa-inframe-apps` `b43ec0f943b5` (5:00 PM CST today). GitHub default is still `claude/linux-build-cleanup-dfpu0e` `ae6e0ad07d2a` (2026-09-29). Live tree `/home/steve/ang/src/boxes` matches the feature branch. | yes | keep — live glue + running NODE; do not replace process until launcher/session fix is ready |
| 2 | [`node-daemon`](https://github.com/CultureReset/node-daemon) | private | original | `main` `3f1531bb82a2` | `main` `3f1531bb82a2` (published today). Not running. | note | keep — split published; not yet what is running |
| 3 | [`node-shell`](https://github.com/CultureReset/node-shell) | private | original | `main` `75f28f73adaf` | `main` `75f28f73adaf` (published today). Not running. | note | keep — split published; do not confuse with nextgent-shell |
| 4 | [`node-mcp-hub`](https://github.com/CultureReset/node-mcp-hub) | private | original | `main` `10f3c558f696` | GitHub `approval-gateway-enforce` `276eb4439116` = live `/home/steve/agents/mcp`. GitHub `main` is older (`10f3c558f696`). | yes | keep — running; live commit is on approval-gateway-enforce, not GitHub main |
| 5 | [`node-door`](https://github.com/CultureReset/node-door) | private | original | `main` `6eadeb07dddf` | default `main` `6eadeb07dddf` (2026-10-31 04:55 PM CST) | yes | keep — running passkey door on :7700 |
| 6 | [`node-home`](https://github.com/CultureReset/node-home) | private | original | `main` `4345f767a6f9` | default `main` `4345f767a6f9` (2026-11-07 07:43 PM CST) | yes | keep — running static portal on :7690; live tree still not a git checkout |
| 7 | [`node-helpers`](https://github.com/CultureReset/node-helpers) | private | original | `main` `942f9fcdcbac` | default `main` `942f9fcdcbac` (2026-10-31 07:20 PM CST) | yes | keep — running helpers from ~/ang/bin; import branch not merged to main |
| 8 | [`node-tv-session`](https://github.com/CultureReset/node-tv-session) | private | original | `main` `bb5fce7a6659` | default `main` `bb5fce7a6659` (2026-11-09 01:57 PM CST) | yes | keep — TV kiosk scripts; node-tv-live.service running |
| 9 | [`nextgent-vitals`](https://github.com/CultureReset/nextgent-vitals) | private | original | `main` `82b978ac5517` | default `main` `82b978ac5517` (2026-09-27 04:34 PM CST) | no | keep — already the vitals repo; do not create node-vitals |
| 10 | [`openjarvis-node`](https://github.com/CultureReset/openjarvis-node) | private | original | `matt/main` `b33c95a4d6ad` | Default `matt/main` `b33c95a4d6ad`. Live `~/.openjarvis/src` is `main` `5e5f5efde4bf` (= `matt/local-20261109`) plus 2 modified + 2 untracked files, 94 behind upstream `origin/main`. | yes | keep — live OpenJarvis; commit uncommitted patches; keep upstream remote |
| 11 | [`hermes-agent`](https://github.com/CultureReset/hermes-agent) | private | original | `matt/main` `7be3cd948cbf` | Default `matt/main` `7be3cd948cbf`. Live `~/.hermes/hermes-agent` is detached `d923a5eb487a` (release 0.22.2) = `matt/local-20261109`. | no | keep — live install is detached at v0.22.2; keep upstream + CultureReset remotes |
| 12 | [`twenty-CRM`](https://github.com/CultureReset/twenty-CRM) | public | fork of twentyhq/twenty | `main` `f62ff4d3e482` | GitHub `main` `f62ff4d3e482`. Local `ang/src/twenty-CRM` matches; this is not the running stack. | no | keep as source fork — official images are what run, not this tree |
| 13 | [`nextgent-runtimes`](https://github.com/CultureReset/nextgent-runtimes) | private | original | `main` `8eedacce085e` | GitHub `main` `8eedacce085e`. Live compose import is `import/live-20261109` `007c03d38128`. | yes | keep — compose for both live Twenty stacks; import branch not on main |
| 14 | [`n8n`](https://github.com/CultureReset/n8n) | public | fork of n8n-io/n8n | `master` `a66221d24a36` | default `master` `a66221d24a36` (2026-09-29 01:43 AM CST) | note | investigate/archive-as-fork — live UI is the official image, not this source tree |
| 15 | [`nextgent-n8n`](https://github.com/CultureReset/nextgent-n8n) | private | original | `main` `3dafa4b361ba` | GitHub `main` `3dafa4b361ba`. Import branch `import/live-20261109` `dcb5a884630f`. | yes | keep — compose/workflows repo; live n8n is official image on :5678 |
| 16 | [`rakazo`](https://github.com/CultureReset/rakazo) | private | original | `main` `774c6a926ec9` | `main` `774c6a926ec9` today. Live `~/apps/rakazo` is still not git. | yes | keep — new repo; live stack at ~/apps/rakazo still not a git checkout |
| 17 | [`supabase-local`](https://github.com/CultureReset/supabase-local) | private | original | `main` `3af12d040c24` | `main` `3af12d040c24` today. Live `~/supabase` is still not git. | yes | keep — new repo; live ~/supabase still not a git checkout; no DB data in git |
| 18 | [`paperclip-node`](https://github.com/CultureReset/paperclip-node) | private | original | `matt/main` `220756f8b84f` | Default `matt/main` `220756f8b84f`. Live process is `~/.local/bin/paperclipai` / `~/.paperclip` (not a git checkout). | yes | keep as pin — live process is npm install, not this checkout; do not commit instance DB |
| 19 | [`openclaw`](https://github.com/CultureReset/openclaw) | private | original | `matt/main` `6dd8b2c4517f` | default `matt/main` `6dd8b2c4517f` (2026-10-31 07:05 PM CST) | yes | keep as pin — live gateway is npm global, not a git checkout |
| 20 | [`openclaw-workspace`](https://github.com/CultureReset/openclaw-workspace) | private | original | `main` `732f58ecc030` | default `main` `732f58ecc030` (2026-10-31 04:56 PM CST) | no | keep — import of workspace files; live ~/.openclaw/workspace still has no remotes / no commits |
| 21 | [`scrapers`](https://github.com/CultureReset/scrapers) | private | original | `main` `7e401d5e2136` | default `main` `7e401d5e2136` (2026-10-31 07:20 PM CST) | yes | keep — several receivers running; live ~/scrapers still not a git checkout |
| 22 | [`second-brain`](https://github.com/CultureReset/second-brain) | private | original | `main` `e4395a1680b4` | default `main` `e4395a1680b4` (2026-10-31 07:11 PM CST) | yes | keep — helpers; data stays on /hdd; live tree not a git checkout |
| 23 | [`smsgw-relay`](https://github.com/CultureReset/smsgw-relay) | private | original | `main` `6981c01536e5` | default `main` `6981c01536e5` (2026-10-31 07:11 PM CST) | yes | keep — running on :8787; live tree not a git checkout |
| 24 | [`ai-chat-logger`](https://github.com/CultureReset/ai-chat-logger) | private | original | `main` `8b943286d5e9` | default `main` `8b943286d5e9` (2026-10-31 07:11 PM CST) | yes | keep — running; import is code only (not the 6.9 GB data dir) |
| 25 | [`ai-stack-kit`](https://github.com/CultureReset/ai-stack-kit) | private | original | `main` `b11fd9a54c46` | default `main` `b11fd9a54c46` (2026-11-07 08:10 PM CST) | no | keep — portable kit / orchestrator; not a one-command full-stack rebuild yet |
| 26 | [`approval-gateway`](https://github.com/CultureReset/approval-gateway) | private | original | `main` `31fd4e74eab8` | default `main` `31fd4e74eab8` (2026-10-31 04:55 PM CST) | no | keep — repo exists; running approvals also involve /opt/node-approvals/app (not git) |
| 27 | [`sms-door`](https://github.com/CultureReset/sms-door) | private | original | `main` `0567aaf72089` | default `main` `0567aaf72089` (2026-10-31 04:56 PM CST) | no | keep — unit currently not in the running-unit list this pass; repo present |
| 28 | [`node-pccall`](https://github.com/CultureReset/node-pccall) | private | original | `main` `788aee0372f7` | default `main` `788aee0372f7` (2026-10-31 04:55 PM CST) | yes | keep — running on :7794 |
| 29 | [`node-voice`](https://github.com/CultureReset/node-voice) | private | original | `main` `4dc89b50fa48` | default `main` `4dc89b50fa48` (2026-10-31 04:56 PM CST) | no | investigate — repo present; earlier verification said the unit file was missing / not running |
| 30 | [`nextgent-phone`](https://github.com/CultureReset/nextgent-phone) | private | original | `main` `597c88da448e` | default `main` `597c88da448e` (2026-10-13 11:56 AM CST) | yes | keep — node-sms.service running from ~/ang/src/node-phone on :7772 |
| 31 | [`nextgent-chat`](https://github.com/CultureReset/nextgent-chat) | private | original | `main` `cbd02c7819c6` | default `main` `cbd02c7819c6` (2026-09-29 07:29 PM CST) | yes | keep — node-chat.service running on :7780 |
| 32 | [`nextgent-jarvis`](https://github.com/CultureReset/nextgent-jarvis) | private | original | `main` `f37d953598cc` | default `main` `f37d953598cc` (2026-10-10 11:45 PM CST) | no | keep separate from OpenJarvis — different app (front door / papertrail) |
| 33 | [`cybercheck-orchestrator`](https://github.com/CultureReset/cybercheck-orchestrator) | public | original | `claude/admin-dashboard-repos-review-903d4i` `071c6841c36d` | default `claude/admin-dashboard-repos-review-903d4i` `071c6841c36d` (2026-08-26 08:28 PM CST) | no | keep / investigate — three local HEADs on different branches; not seen as a live unit this pass |
| 34 | [`Dashboards-users-`](https://github.com/CultureReset/Dashboards-users-) | public | original | `claude/dashboard-inventory-purposes-m5wtba` `aac903f97b0f` | GitHub default `claude/dashboard-inventory-purposes-m5wtba` `aac903f97b0f`; `main` is `d290da42dab2`. Local `ang/src` is `8f6199a41493` (ahead 1 of its upstream when checked); `ang/repos` is `f323f5510fc8`. | no | investigate — two local clones at different SHAs; default branch is not main |
| 35 | [`Admin-dashboard-main`](https://github.com/CultureReset/Admin-dashboard-main) | public | original | `claude/cybercheck-modular-react-dashboard-7on41c` `5df87125247a` | default `claude/cybercheck-modular-react-dashboard-7on41c` `5df87125247a` (2026-11-02 12:57 PM CST) | no | keep as the CyberCheck admin dashboard (distinct from Dashboards-users-) |
| 36 | [`gcr-unified`](https://github.com/CultureReset/gcr-unified) | private | original | `master` `47f71ac7cd1b` | GitHub `master` `47f71ac7cd1b`. Local `ang/src` is `d8e5d63502aa` — behind. | no | investigate — local master is behind GitHub master; many branches |
| 37 | [`gcr-api-clean`](https://github.com/CultureReset/gcr-api-clean) | private | original | `main` `edb480069f21` | GitHub `main` `edb480069f21` (2026-11-02). Local `ang/src` is `b75300ca8de4` (2026-08-04) — behind. PushedAt is today (non-default branches). | no | keep as current GCR API candidate — local main is far behind GitHub main; 100+ branches |
| 38 | [`gcr-api`](https://github.com/CultureReset/gcr-api) | private | original | `main` `0dbafc63fafc` | default `main` `0dbafc63fafc` (2026-05-25 05:40 PM CST) | no | investigate/merge — older/alternate API tree (package name cybercheck-backend) |
| 39 | [`node-services`](https://github.com/CultureReset/node-services) | private | original | `main` `36afd54b28b0` | default `main` `36afd54b28b0` (2026-11-02 09:08 PM CST) | no | keep — systemd unit snapshots / scripts (deployment-config) |
| 40 | [`gbrain`](https://github.com/CultureReset/gbrain) | private | original | `matt/main` `12384420e701` | default `matt/main` `12384420e701` (2026-10-31 06:41 PM CST) | yes | keep as pin — running bun binary on :3131; no local CultureReset checkout |
| 41 | [`searxng`](https://github.com/CultureReset/searxng) | public | fork of searxng/searxng | `master` `ac11e14c5edf` | default `master` `ac11e14c5edf` (2026-11-06 01:51 PM CST) | yes | keep config vs fork separate — live is official image on :8888, not the source fork checkout |
| 42 | [`litellm`](https://github.com/CultureReset/litellm) | public | fork of BerriAI/litellm | `main` `07c722989560` | default `main` `07c722989560` (2026-11-07 06:57 PM CST) | yes | same — live is official image + ~/api-gateway config (config is not its own git repo) |
| 43 | [`node-tunnel`](https://github.com/CultureReset/node-tunnel) | private | original | `main` `492d0dd2be9c` | default `main` `492d0dd2be9c` (2026-11-07 07:34 PM CST) | yes | keep — running chisel on :7710; repo is a thin portable wrapper |
| 44 | [`paperclip`](https://github.com/CultureReset/paperclip) | public | fork of paperclipai/paperclip | `master` `dc0a649e2735` | default `master` `dc0a649e2735` (2026-10-16 07:23 AM CST) | no | keep public fork; use paperclip-node for Matt's pin |
| 45 | [`OpenJarvis`](https://github.com/CultureReset/OpenJarvis) | public | fork of open-jarvis/OpenJarvis | `main` `21b53bc7046b` | default `main` `21b53bc7046b` (2026-09-15 12:17 AM CST) | no | archive/freeze public fork — not the live tree |
| 46 | [`nextgent-openjarvis`](https://github.com/CultureReset/nextgent-openjarvis) | private | original | `main` `0c5649dd9311` | default `main` `0c5649dd9311` (2026-09-29 03:28 PM CST) | no | investigate/freeze — third OpenJarvis copy, not live |
| 47 | [`node-infra`](https://github.com/CultureReset/node-infra) | private | original | `main` `304b6e809f09` | default `main` `304b6e809f09` (2026-10-31 07:47 PM CST) | no | keep — host unit/compose snippets (no secrets); local clone was archived today |
| 48 | [`MagicMirror`](https://github.com/CultureReset/MagicMirror) | public | fork of MagicMirrorOrg/MagicMirror | `master` `f138f5b690ce` | default `master` `f138f5b690ce` (2026-10-01 08:34 AM CST) | no | investigate — public fork present on GitHub; not in docker ps this pass |

Full machine-readable inventory: [`inventory.csv`](./inventory.csv) and [`inventory.json`](./inventory.json).

## (c) Per-repo cards (deeply inspected, plus selected shallow family heads)

Cards use Matt's exact fields. Secret values are omitted. 'Authoritative' means the commit that should be treated as the published pin, which is **not always the GitHub default branch**.

### Deep cards

### `Boxes`

- **GitHub:** https://github.com/CultureReset/Boxes (public; default `claude/linux-build-cleanup-dfpu0e` `ae6e0ad07d2a`, last default-branch commit 2026-09-29 03:28 PM CST; pushed 2026-11-09 04:48 PM CST)
- **Purpose:** NODE itself: the owner-facing Linux 'computer you talk to.' Live process is the TypeScript daemon plus the Vite/React shell, served together from this tree. Also holds `config/` (frames, webapps, services-control), `apps/`, `services/`, `spec/`, and today's audit/docs artifacts.
- **Source:** Custom CultureReset original (public). Not a fork.
- **Technology:** TypeScript, Node, Vite/React (shell), systemd user unit `node-box.service`.
- **Architecture:** Top-level modules: `daemon/` (runtime, door integration, frame proxy, services), `shell/` (UI), `config/`, `box/`, `apps/`, `services/`, `spec/`, `artifacts/`. package name `node`; scripts: dev, build, typecheck, start, test.
- **Dependencies:** Node toolchain; `llm.service` (Wants/After); drop-in also After openclaw-gateway, paperclipai, openjarvis, node-chat. Framed apps are separate processes (Twenty, n8n, OpenJarvis, etc.).
- **Connections:** NODE tiles in `webapps.json` / `frames.json` point at Cloudflare or Tailscale URLs which proxy to local ports. Door on :7700 fronts `node.voicecommandapi.com`. Tailscale serve :14443 → :7770 (the Boxes UI).
- **Runtime:** **Running.** `node-box.service` pid=537178, started 2026-11-09 1:46 PM CST, cwd=`/home/steve/ang/src/boxes`, ExecStart=`node daemon/dist/index.js`. Listens on **:7770** (127.0.0.1 and Tailscale 100.104.20.101). Does *not* listen on :7700 (that is node-door).
- **Branch and commit:** Authoritative work branch: `fix/node-pwa-inframe-apps` `b43ec0f943b5` (docs: full ordered fix plan, 5:00 PM CST today), in sync with origin. GitHub **default** branch is still `claude/linux-build-cleanup-dfpu0e` `ae6e0ad07d2a` (2026-09-29) — stale. `main` is `1d3d451247f8`. Worktree `boxes-sysmon` on `feat/node-system-monitor` `494941f` is ahead 1 / behind 4 of this branch and was not modified this pass.
- **Overlap:** `CultureReset/node-daemon` and `CultureReset/node-shell` are history-filtered splits of `daemon/` and `shell/` from this tree (published today). Live process still uses Boxes. Older `~/ang/src/Boxes` and `~/ang/repos/Boxes` clones were moved to `~/_archive/2026-11-09/` today. `nextgent-box` / `nextgent-box-v1-with-jarvis*` are separate older consolidation repos, not this process.
- **Security:** Door/passkey and Cloudflare Access sit in front of public hostnames; this process binds 7770 on localhost + tailnet. Config files in-repo are app maps, not credential stores. Host secrets live under `~/.config/nodeos/` (not read this pass). Hardcoded `/home/steve` and tailnet hostnames are documented in `portability.md`.
- **Portability:** Not independently installable on a fresh machine yet. Units, frames, cloudflared, and Tailscale maps hardcode this host. No `nodeos.manifest.json` / `node-launch` in production use. The fix plan committed today describes that contract; it is not implemented.
- **Decision:** **keep** as the glue repo and as the live tree until a tested switch to split daemon/shell + launcher exists. Consider changing the GitHub default branch off the stale `claude/linux-build-cleanup-dfpu0e` branch (Matt decision).

### `node-daemon`

- **GitHub:** https://github.com/CultureReset/node-daemon (private; default `main` `3f1531bb82a2`, last default-branch commit 2026-11-09 03:47 PM CST; pushed 2026-11-09 03:47 PM CST)
- **GitHub description:** NODE daemon (split from CultureReset/Boxes). Private.
- **Purpose:** The NODE daemon extracted from Boxes (`daemon/`), published today so it can be its own repo.
- **Source:** Custom; split from Boxes with history (filter-repo in `_work/split-20261109/Boxes.daemon`, not in the live worktree).
- **Technology:** TypeScript (package name `nodeos-daemon`; scripts dev/build/typecheck/test). `src/` only at the inspected work-copy root.
- **Architecture:** Daemon sources only (no shell, no Boxes `config/` glue). Intended to become the standalone runtime.
- **Dependencies:** Will need the shell, door, and host unit/config once it replaces the in-tree daemon. Not wired as the live process.
- **Connections:** None as a running service today. Code originates from Boxes daemon.
- **Runtime:** **Not running.** Live daemon is still `Boxes` `daemon/dist/index.js` via `node-box.service`.
- **Branch and commit:** GitHub `main` `3f1531bb82a2` (2026-11-09 3:47 PM CST). Work-copy matches. Only one GitHub branch.
- **Overlap:** Duplicates the `daemon/` tree inside live Boxes (intentionally, as a split). Not to be confused with `nextgent-box`.
- **Security:** Same family as Boxes. No separate secret store in the split repo (work-copy was clean).
- **Portability:** The repo exists, but a fresh clone does not yet replace the live unit. Path/port contract still missing.
- **Decision:** **keep.** Do not point `node-box.service` at this checkout until the session/frame fix and launcher are tested.

### `node-shell`

- **GitHub:** https://github.com/CultureReset/node-shell (private; default `main` `75f28f73adaf`, last default-branch commit 2026-11-09 03:47 PM CST; pushed 2026-11-09 03:47 PM CST)
- **GitHub description:** NODE shell UI (split from CultureReset/Boxes). Private. Not nextgent-shell.
- **Purpose:** The NODE UI shell extracted from Boxes (`shell/`), published today.
- **Source:** Custom; split from Boxes in `_work/split-20261109/Boxes.shell`.
- **Technology:** TypeScript, Vite (`index.html`, `vite.config.ts`, `src/`, `public/`). Package name `nodeos-shell`.
- **Architecture:** Frontend only. This is **not** `CultureReset/nextgent-shell` (a different, nearly empty 'single NEXT GENT web shell' repo).
- **Dependencies:** Needs the daemon API / door session once split is live.
- **Connections:** Same frame/webapp URLs as Boxes, once it is what's served.
- **Runtime:** **Not running.** Live UI is served by the Boxes tree / `node-box.service`.
- **Branch and commit:** GitHub `main` `75f28f73adaf` (2026-11-09 3:47 PM CST). Work-copy matches.
- **Overlap:** Live Boxes `shell/`; distinct from `nextgent-shell`.
- **Security:** Browser UI; session/frame-ancestors issues are documented in today's research/fix plan and are not fixed in the live process.
- **Portability:** Clone exists; not a drop-in for the live kiosk yet.
- **Decision:** **keep.** Do not reuse `nextgent-shell` as this component.

### `node-mcp-hub`

- **GitHub:** https://github.com/CultureReset/node-mcp-hub (private; default `main` `10f3c558f696`, last default-branch commit 2026-10-31 04:56 PM CST; pushed 2026-11-09 03:42 PM CST)
- **Purpose:** MCP hub + app registry (`hub.py`, `registry.yaml`). NODE 'MCP Hub' tile and `hub.voicecommandapi.com` / Tailscale :17790 proxy to it.
- **Source:** Custom original.
- **Technology:** Python (venv at `/home/steve/agents/mcp/.venv`), YAML registry, tests under `tests/`, docs `ADD-NEW-APP.md`.
- **Architecture:** Single-process hub (`hub.py`) plus `registry.yaml`. Many dated `.bak-*` files exist in the live tree.
- **Dependencies:** Python venv; uses 127.0.0.1 bind. Earlier override/docs mentioned allowed hosts; live listen confirmed on 127.0.0.1:7790 (Tailscale reaches it via serve).
- **Connections:** Framed by NODE; Rakazo also has an `mcp-hub-proxy` container. Registry is the place new MCP apps are declared (per node-infra README).
- **Runtime:** **Running.** `node-mcp-hub.service` pid=894335, cwd=`/home/steve/agents/mcp`, port **7790**.
- **Branch and commit:** Live and GitHub `approval-gateway-enforce` `276eb4439116` (includes today's gitignore commit). GitHub default `main` is older (`10f3c558f696`). `local-history` is `33b81d7152d1`.
- **Overlap:** None as a second product. gh-export copy archived today.
- **Security:** Bind is localhost. Auth/host allow-list should be treated as security-sensitive; values not dumped. Backup copies of `hub.py` / `registry.yaml` in the live tree should not be committed if they ever contained secrets (not inspected for values).
- **Portability:** Hardcoded host paths in the user unit. Import/push happened today to a non-default branch; main is stale.
- **Decision:** **keep.** Consider making `approval-gateway-enforce` (`276eb44`) the published default, or merging to `main`.

### `node-door`

- **GitHub:** https://github.com/CultureReset/node-door (private; default `main` `6eadeb07dddf`, last default-branch commit 2026-10-31 04:55 PM CST; pushed 2026-11-07 07:33 PM CST)
- **Purpose:** One passkey-protected HTTP door (REST + MCP + webhooks) for NODE. This is what public `node.voicecommandapi.com` (except `/portal` and `/tunnel`) hits.
- **Source:** Custom original.
- **Technology:** Python (`door.py` and helpers: `accounts.py`, `approval_pin.py`, `intent/`, `pwa/`, tests).
- **Architecture:** Threading HTTP server; `DOOR_PORT` defaults to 7700, `DOOR_HOST` defaults to 127.0.0.1 (confirmed in source as names/defaults only).
- **Dependencies:** Passkey / WebAuthn material under `~/.config/nodeos/door/` (directory listed, contents not read). May call other local APIs.
- **Connections:** cloudflared: `node.voicecommandapi.com` → 127.0.0.1:7700; `/portal` → node-home :7690; `/tunnel` → chisel :7710. NODE UI itself is on :7770 behind Tailscale :14443.
- **Runtime:** **Running.** `node-door.service` pid=13186, port **7700**.
- **Branch and commit:** Live `/home/steve/agents/node-door` on `master` `eed793cc0801` tracking `origin/local-history`. GitHub default `main` is `6eadeb07dddf` (different). Treat `local-history` / live master as the operational pin until reconciled.
- **Overlap:** Not the Boxes daemon. Do not confuse port 7700 with node-box :7770.
- **Security:** Passkey-protected by design (unit description and README). Credential files were not opened. `apps.example.json` is the example; do not commit live app tokens.
- **Portability:** Unit and default paths assume this machine. Door session / frame-ancestors bugs are a known blocker for 'clone and it works' (documented in research + fix plan; not re-fixed this pass).
- **Decision:** **keep.** Reconcile GitHub `main` vs live `local-history` before treating a fresh clone as the door.

### `node-home`

- **GitHub:** https://github.com/CultureReset/node-home (private; default `main` `4345f767a6f9`, last default-branch commit 2026-11-07 07:43 PM CST; pushed 2026-11-09 03:44 PM CST)
- **GitHub description:** Portable NODE component; source and manual-only installation, no production activation
- **Purpose:** Static NODE portal / launcher (`index.html`, `apps.json`) plus `frame_proxy.py` in the live directory. The running service is a plain Python HTTP server on :7690, not the frame proxy (confirmed earlier today and again: ExecStart is `python3 -m http.server 7690 --bind 127.0.0.1`).
- **Source:** Custom original.
- **Technology:** Static HTML + optional Python `frame_proxy.py`.
- **Architecture:** Very small tree at `~/node-home`. GitHub import lives on `import/live-20261109` (`129ef783cb4c`); GitHub `main` is `4345f767a6f9`.
- **Dependencies:** None beyond Python stdlib for the running server.
- **Connections:** cloudflared `node.voicecommandapi.com/portal*` → :7690. NODE tile 'home' / portal.
- **Runtime:** **Running.** `node-home.service` pid=1810, port **7690**, cwd=`/home/steve/node-home`. Live dir is **not a git checkout**.
- **Branch and commit:** Authoritative published snapshot: `import/live-20261109` `129ef783cb4c`. Live files may still drift from that import.
- **Overlap:** None significant.
- **Security:** Unauthenticated local bind; public path is intended to sit behind Cloudflare Access (comments in cloudflared config). `apps.json` not opened for secret values.
- **Portability:** Live path is hardcoded in the unit as `/home/steve/node-home`.
- **Decision:** **keep.** Add a git remote to the live tree or keep importing; merge `import/live-20261109` to `main` after review.

### `node-helpers`

- **GitHub:** https://github.com/CultureReset/node-helpers (private; default `main` `942f9fcdcbac`, last default-branch commit 2026-10-31 07:20 PM CST; pushed 2026-11-09 03:44 PM CST)
- **GitHub description:** ang/bin Python helpers from steve-MS-7C02
- **Purpose:** Host helper scripts that NODE and related units call: `asr-shim.py`, `approved_actions.py`, `llama-swap` (binary), etc., from `~/ang/bin`.
- **Source:** Custom original.
- **Technology:** Mostly Python scripts; also vendored binaries (llama-swap, and other bins noted in the earlier plan as things to exclude unless wanted).
- **Architecture:** Flat `~/ang/bin` plus data dirs like `espeak-ng-data`. Git import is code-oriented (`import/live-20261109` `4a80ed16d5c4`); GitHub `main` `942f9fcdcbac`.
- **Dependencies:** Used by `asr-shim.service` and `llm.service` (`llama-swap --config ~/ang/etc/llama-swap.yaml --listen 127.0.0.1:8080`).
- **Connections:** llama-swap :8080 is framed as 'llama-swap' / `llm.voicecommandapi.com` and is a core NODE service. ASR shim supports voice.
- **Runtime:** **Running.** `asr-shim.service` pid=1806; `llm.service` pid=1805 port **8080**. Live `~/ang/bin` is **not a git checkout**.
- **Branch and commit:** Published import `import/live-20261109` `4a80ed16d5c4`.
- **Overlap:** Some scripts also relate to approval-gateway / paperclip bridges (names only; live `/opt` approvals are a separate non-git tree).
- **Security:** Units may reference config under `~/ang/etc` (not dumped). Do not commit binaries or machine-local configs with secrets.
- **Portability:** nvm/binary paths and `/home/steve/ang/bin` are hardcoded in units (`portability.md`).
- **Decision:** **keep.** Merge import branch after reviewing what was excluded (binaries, bak files).

### `node-tv-session`

- **GitHub:** https://github.com/CultureReset/node-tv-session (private; default `main` `bb5fce7a6659`, last default-branch commit 2026-11-09 01:57 PM CST; pushed 2026-11-09 01:57 PM CST)
- **GitHub description:** LightDM/xsession kiosk that boots Chrome full-screen on NODE's TV view
- **Purpose:** LightDM / openbox kiosk session and installer for the HDMI TV display of NODE (`install.sh`, `node-tv-session`, `node-tv.desktop`, `openbox-rc.xml`).
- **Source:** Custom original.
- **Technology:** Shell + desktop session files.
- **Architecture:** Small repo at `/home/steve/ang/src/node-tv-session`, in sync with GitHub `main` `bb5fce7a6659` (today 1:57 PM CST).
- **Dependencies:** Chrome kiosk (`node-tv-live.service` uses google-chrome-stable and `~/.config/node-tv-session/chrome-profile`).
- **Connections:** Opens the NODE UI (TV mode). Related to cursor/zoom issues documented in research (not re-tested with a screenshot this pass).
- **Runtime:** **Running.** `node-tv-live.service` pid=725035 (Chrome). Scripts are in this repo; the Chrome profile path is not git.
- **Branch and commit:** `main` `bb5fce7a6659`, local matches origin.
- **Overlap:** None.
- **Security:** Chrome profile directory is machine-local state. Do not commit it.
- **Portability:** Installer + example config exist (`config.example`). Still assumes this host's display setup.
- **Decision:** **keep.**

### `nextgent-vitals`

- **GitHub:** https://github.com/CultureReset/nextgent-vitals (private; default `main` `82b978ac5517`, last default-branch commit 2026-09-27 04:34 PM CST; pushed 2026-11-02 11:41 AM CST)
- **GitHub description:** Hardware monitor. Zero deps, reads /sys and /proc
- **Purpose:** Vitals helper (`vitals.js` + test). This is the existing vitals repo; a new `node-vitals` repo was explicitly not created.
- **Source:** Custom original.
- **Technology:** JavaScript.
- **Architecture:** Two files in `/home/steve/ang/src/node-vitals`.
- **Dependencies:** Not observed as its own systemd unit this pass.
- **Connections:** Intended NODE component; not seen in the running-unit list.
- **Runtime:** **Not running** as a separate service this pass.
- **Branch and commit:** GitHub/local `main` `82b978ac5517` (2026-09-27), in sync.
- **Overlap:** Do not create `node-vitals`.
- **Security:** No auth surface observed in this tiny tree.
- **Portability:** Small enough to copy, but not wired into a portable launcher yet.
- **Decision:** **keep** the existing name.

### `openjarvis-node`

- **GitHub:** https://github.com/CultureReset/openjarvis-node (private; default `matt/main` `b33c95a4d6ad`, last default-branch commit 2026-10-31 07:08 PM CST; pushed 2026-11-09 03:47 PM CST)
- **GitHub description:** Private mirror of open-jarvis/OpenJarvis + Matt local patches
- **Purpose:** Matt's CultureReset pin of OpenJarvis — the live chat/front-door UI and API (`openjarvis.service` + `openjarvis-ui.service`). NODE tile 'OpenJarvis' / `jarvis.voicecommandapi.com` → :17801 → upstream :5173.
- **Source:** Private mirror + Matt patches of `open-jarvis/OpenJarvis` (live origin still points at upstream; `cultureReset` remote added today).
- **Technology:** Python (packaged as `OpenJarvis`, hatchling, `uv.lock`, `.venv`) + Vite frontend + some Rust under `rust/`.
- **Architecture:** `src/` (Python package including `openjarvis/mcp`, `openjarvis/system`), `frontend/`, `docs/`, `deploy/`, `desktop/`, `tests/`. Live API: `python -m openjarvis.cli serve --port 8000`. UI: Vite `--port 5173`.
- **Dependencies:** LiteLLM gateway (services-control says Hermes/OpenJarvis use it). Python venv, Node for the UI.
- **Connections:** NODE frame slug `openjarvis`; Cloudflare `jarvis.voicecommandapi.com`; Tailscale :20443. Uses LiteLLM :4000.
- **Runtime:** **Running.** `openjarvis.service` pid=9577 port **8000** cwd=`~/.openjarvis/src`; `openjarvis-ui.service` pid=9583 port **5173** cwd=`~/.openjarvis/src/frontend`.
- **Branch and commit:** Live checkout: `main` `5e5f5efde4bf`, **behind upstream 94**, dirty: `src/openjarvis/mcp/loader.py` and `src/openjarvis/system/builder.py` modified, plus two `.bak-20261021` untracked files. Those four files are still not on GitHub. CultureReset default `matt/main` is `b33c95a4d6ad`. `matt/local-20261109` is `5e5f5efde4bf` (the clean upstream-base pin, without the dirty files).
- **Overlap:** Public `CultureReset/OpenJarvis` (`ang/src/OpenJarvis` at `21b53bc`, stale) and `nextgent-openjarvis` (`ang/mirrors/openjarvis` at `a6dcf84`) are other copies. Live tree is only `~/.openjarvis/src`.
- **Security:** Upstream project auth plus whatever is in local configs (not read). Do not commit `.venv` or env files.
- **Portability:** Running from `~/.openjarvis/src` with upstream as origin. A fresh clone of `openjarvis-node` would still need the dirty patches, venv, and unit paths.
- **Decision:** **keep** as the one OpenJarvis repo that matters. Commit the two real patches (and decide whether to keep the `.bak` files) to `matt/local-20261109`. Keep the upstream remote.

### `hermes-agent`

- **GitHub:** https://github.com/CultureReset/hermes-agent (private; default `matt/main` `7be3cd948cbf`, last default-branch commit 2026-10-31 06:38 PM CST; pushed 2026-11-09 03:47 PM CST)
- **GitHub description:** Private mirror of NousResearch/hermes-agent (Matt install v0.22.2)
- **Purpose:** Nous Research Hermes agent runtime. Used as Paperclip's agent runtime (services-control: Hermes for Lead, Coder, Researcher, etc.).
- **Source:** Private CultureReset mirror of `NousResearch/hermes-agent` (not marked isFork on GitHub, but it is a mirror; live origin is still upstream; `cultureReset` remote added today).
- **Technology:** Python + Node (package `hermes-agent`), Dockerfiles, optional gateway/dashboard compose, plugins, native, nix.
- **Architecture:** Large upstream tree: `agent/`, `hermes_cli/`, `gateway/`, `plugins/`, `plugin-catalog/`, etc. Inspected live install at `~/.hermes/hermes-agent`.
- **Dependencies:** LiteLLM; Paperclip. The live tree is the v0.22.2 release checkout.
- **Connections:** Invoked via Paperclip rather than a dedicated NODE tile this pass (no hermes systemd unit in the running list).
- **Runtime:** **No dedicated unit.** Detached HEAD `d923a5eb487a` (Release 0.22.2). Used through Paperclip.
- **Branch and commit:** CultureReset default `matt/main` `7be3cd948cbf`. `matt/local-20261109` = live `d923a5eb487a`. `upstream-main` `d33d4fd9e7b5`. Extra clone `~/ang/src/hermes` is older (`00570550f37e`) and still has only the NousResearch remote.
- **Overlap:** `~/ang/src/hermes` is a stale second copy (1.2G class in earlier plan). Not the live install.
- **Security:** `.env.example` present (names only; not a live `.env` read). Do not commit local env or bind tokens.
- **Portability:** Install is a detached release checkout plus CultureReset remotes. Fresh clone of `matt/main` is not automatically the same as the running v0.22.2 pin.
- **Decision:** **keep** remotes as they are. Prefer the live pin (`matt/local-20261109` / v0.22.2) as the install reference. Archive extra `ang/src/hermes` after confirming it has no unique commits (it was not archived today).
### `twenty-CRM`

- **GitHub:** https://github.com/CultureReset/twenty-CRM (public; default `main` `f62ff4d3e482`, last default-branch commit 2026-08-28 11:28 AM CST; pushed 2026-08-28 11:32 AM CST)
- **Fork parent:** `twentyhq/twenty`
- **GitHub description:** The open alternative to Salesforce, designed for AI.
- **Purpose:** CultureReset's public fork of Twenty CRM *source*. This is not what NODE's CRM tiles run.
- **Source:** Fork of `twentyhq/twenty`.
- **Technology:** TypeScript monorepo (yarn, nx, `packages/`). Large tree (~1.9G class in earlier audit).
- **Architecture:** Upstream Twenty monorepo layout. Local path `/home/steve/ang/src/twenty-CRM` on `main` `f62ff4d3e482`, matching origin.
- **Dependencies:** Upstream's own stack; not used by the live Docker images.
- **Connections:** None to the running NODE CRM tiles. Those use official `twentycrm/twenty:latest` images.
- **Runtime:** **Not running.** Live CRM is two official-image compose stacks (see `nextgent-runtimes`).
- **Branch and commit:** GitHub/local `main` `f62ff4d3e482` (2026-08-28).
- **Overlap:** Live: `~/twenty` (:3000, CRM tile / crm.voicecommandapi.com) and `~/nextgent/apps/twenty-runtime` (:3020, CRM 2 / crm2 + nextgent-crm hostnames). Also `ang/apps/twenty` and `nextgent/apps/twenty` clones of `twentyhq/twenty`.
- **Security:** Do not treat this fork as the production data plane. Production secrets live in the compose dirs' `.env` files (not opened, not in git).
- **Portability:** A source fork is not a portable NODE app by itself. Runtime compose belongs in `nextgent-runtimes`.
- **Decision:** **keep** as the source fork only. Do not deploy this tree over the running images unless Matt deliberately switches.

### `nextgent-runtimes`

- **GitHub:** https://github.com/CultureReset/nextgent-runtimes (private; default `main` `8eedacce085e`, last default-branch commit 2026-10-31 07:21 PM CST; pushed 2026-11-09 03:44 PM CST)
- **GitHub description:** nextgent apps runtime compose only
- **Purpose:** Compose-only repo for app runtimes (Twenty, and also hoteldruid / odoo / pms / pretix trees in the import). Holds deployment config, not application source.
- **Source:** Custom original (deployment-config).
- **Technology:** Docker Compose. Import tree contains `twenty/`, `twenty-runtime/`, `odoo-runtime/`, `pretix-runtime/`, `hoteldruid-runtime/`, `pms-runtime/`.
- **Architecture:** One directory per stack. Live running compose files are still the non-git dirs `~/twenty/docker-compose.yml` and `~/nextgent/apps/twenty-runtime/docker-compose.yml`. Import SHA `007c03d38128` captured those (without `.env` / volumes, per today's execution notes).
- **Dependencies:** Docker; official `twentycrm/twenty:latest`, postgres, redis. Odoo/Pretix/Kamra compose may exist in the repo but those stacks were **not** in `docker ps` this pass.
- **Connections:** NODE frames: `twenty-crm` localPort 17802 → :3000, `crm2` 17813 → :3020. cloudflared crm / crm2 / nextgent-crm hostnames. Tailscale :26443 → Twenty :3000 path. POS/tickets/kamra frames exist (ports 8069/8345/8090) but those containers were not running this pass.
- **Runtime:** **Running (Two Twenties).** `twenty` compose: `twenty-server-1` healthy on **:3000**. `nextgent-twenty` compose: `nextgent-twenty-server` healthy on **:3020**. Both referenced by NODE; neither was removed.
- **Branch and commit:** GitHub `main` `8eedacce085e` (2026-10-31). Authoritative new content: `import/live-20261109` `007c03d38128` (today). Live compose dirs remain **not git checkouts**.
- **Overlap:** `twenty-CRM` source fork; two live official-image stacks (Matt does not want two long-term; CRM 2 is still referenced).
- **Security:** `.env` / DB volumes excluded from git (per execution report). Do not add them.
- **Portability:** Compose still uses machine-local absolute paths in places (`portability.md`). Official images help, but env and volume layout are not yet fresh-machine automatic.
- **Decision:** **keep** as the runtime compose home. Merge the import branch after review. Retire CRM 2 only after NODE tiles and both hostnames are removed (Matt).

### `n8n`

- **GitHub:** https://github.com/CultureReset/n8n (public; default `master` `a66221d24a36`, last default-branch commit 2026-09-29 01:43 AM CST; pushed 2026-11-07 08:08 PM CST)
- **Fork parent:** `n8n-io/n8n`
- **GitHub description:** Fair-code workflow automation platform with native AI capabilities. Combine visual building with custom code, self-host or cloud, 400+ integrations.
- **Purpose:** Public fork of n8n source (`n8n-io/n8n`). Not the running workflow UI.
- **Source:** Fork of `n8n-io/n8n`.
- **Technology:** TypeScript (upstream). No local CultureReset clone on this machine.
- **Architecture:** Full upstream source (GitHub Contents shows a standard n8n root). Disk usage ~468k KB.
- **Dependencies:** N/A for runtime — live uses the official image.
- **Connections:** None from this source tree to NODE.
- **Runtime:** **Not running this tree.** Live n8n is `docker.n8n.io/n8nio/n8n:latest` on **:5678** (5 hours up).
- **Branch and commit:** GitHub default present (see inventory). No local SHA.
- **Overlap:** `nextgent-n8n` (compose/workflows), live official container, `~/n8n-sandbox` helper compose (running), stopped `~/nextgent/n8n` copy (left in place earlier today).
- **Security:** Upstream project. Do not confuse with live n8n data volume (not in git).
- **Portability:** A source fork is not required to run the official image.
- **Decision:** **investigate / likely freeze or archive as a fork pin**, unless Matt wants to build n8n from source. The live operational repo is `nextgent-n8n` plus the official image.

### `nextgent-n8n`

- **GitHub:** https://github.com/CultureReset/nextgent-n8n (private; default `main` `3dafa4b361ba`, last default-branch commit 2026-10-31 07:21 PM CST; pushed 2026-11-09 03:44 PM CST)
- **GitHub description:** nextgent n8n workflows + compose
- **Purpose:** Private compose/workflows repo for CultureReset's n8n deployment (and the n8n-sandbox helper).
- **Source:** Custom original.
- **Technology:** Docker Compose. Import tree has `docker-compose.yml` (service `n8n`), plus `sandbox/` and `workflows/`.
- **Architecture:** GitHub `main` is the older snapshot (`3dafa4b361ba`). Today's live import is `import/live-20261109` `dcb5a884630f`, which also captured `~/n8n-sandbox`.
- **Dependencies:** Docker. Live UI container is the official n8n image. Sandbox: `n8nio/n8n-sandbox-service-runner-dind` + `n8n-sandbox-service-api` (running, usage not proven).
- **Connections:** NODE tile 'n8n' / `automations.voicecommandapi.com` → :17804 → :5678. Tailscale :25443.
- **Runtime:** **Running (official image on :5678).** Sandbox compose also running from `~/n8n-sandbox`. Live dirs are not git checkouts.
- **Branch and commit:** `import/live-20261109` `dcb5a884630f` is the new content; `main` is behind that import.
- **Overlap:** See `n8n` fork; sandbox is a helper, not a second n8n UI (earlier execution finding, still valid: no second :5678).
- **Security:** Exclude `n8n_data` and license files from git (already the rule). Not re-opened this pass.
- **Portability:** Compose + official image is the right shape; host paths still need the launcher/manifest work.
- **Decision:** **keep.** Merge import to main after review. Leave sandbox running until usage is proven or Matt says to stop it.

### `rakazo`

- **GitHub:** https://github.com/CultureReset/rakazo (private; default `main` `774c6a926ec9`, last default-branch commit 2026-11-09 03:46 PM CST; pushed 2026-11-09 03:46 PM CST)
- **GitHub description:** Rakazo compose overlay and local proxies around official images. Private. No secrets or volumes.
- **Purpose:** Local overlay around official `ghcr.io/elie222/rakazo/app:edge` images: compose files, `bin/` auth/unix proxies, LOCAL.md. NODE 'Rakazo' tile / `rakazo.voicecommandapi.com` → :17818 → :45173.
- **Source:** Custom original overlay (not a fork of Rakazo source). New private repo created today.
- **Technology:** Docker Compose + Python proxy scripts in `bin/`.
- **Architecture:** Live `~/apps/rakazo` has `docker-compose.images.yml`, `docker-compose.override.yml`, `docker-compose.litellm-proxy.yml`, `bin/`, `overrides/`. Running containers: web :45173, api :43100, worker, supervisor, postgres, plus litellm-proxy and mcp-hub-proxy. Three systemd proxy units also run.
- **Dependencies:** Docker; LiteLLM (proxy units and a compose proxy); MCP hub proxy.
- **Connections:** NODE / Cloudflare / frames as above. Talks to LiteLLM and MCP hub via proxies.
- **Runtime:** **Running.** Compose project `rakazo` from `~/apps/rakazo` (7 containers) plus `rakazo-litellm-proxy.service`, `rakazo-litellm-unix-proxy.service`, `rakazo-mcp-hub-unix-proxy.service`. Live dir is **not a git checkout**. Published copy is `_work/import-20261109/rakazo-new`.
- **Branch and commit:** GitHub `main` `774c6a926ec9` (today 3:46 PM CST). Work-copy matches.
- **Overlap:** None as a second product. `.env` and `*.env.bak.*` exist in the live dir (names observed in a top-level listing; files were not opened and must stay uncommitted).
- **Security:** Live directory contains env backups. Repo creation excluded `.env`, sockets, volumes. Do not add them later.
- **Portability:** Fresh clone has compose + proxies, but still expects this host's units, images, and env files.
- **Decision:** **keep.** Optionally turn the live dir into a git checkout of this repo (without env files).

### `supabase-local`

- **GitHub:** https://github.com/CultureReset/supabase-local (private; default `main` `3af12d040c24`, last default-branch commit 2026-11-09 03:46 PM CST; pushed 2026-11-09 03:46 PM CST)
- **GitHub description:** Local Supabase compose overlay. Private. No .env secrets or database volumes.
- **Purpose:** Local Supabase compose overlay (Studio + API + DB + related official images). NODE 'Supabase' tile / `supabase.voicecommandapi.com` → :17817 → :54323.
- **Source:** Official Supabase compose overlay, published as a new private CultureReset repo today (no DB data).
- **Technology:** Docker Compose (11 running containers this pass: studio, storage, edge-functions, meta, pooler/supavisor, auth, realtime, rest, envoy, db, imgproxy).
- **Architecture:** Live `~/supabase` with `docker-compose.yml` + `docker-compose.override.yml`. Studio published on 127.0.0.1:54323. Pooler/API also on 127.0.0.1 and Tailscale IP :5432/:6543/:8001.
- **Dependencies:** Docker. This is a data plane for business apps (GCR etc.) when connected; `platform.json` / device-token work is still not done (prior research).
- **Connections:** NODE frame; Cloudflare hostname; used by dashboards/APIs as a database (not re-verified with a DB login this pass).
- **Runtime:** **Running** (5 hours up). Live dir **not a git checkout**. Published `_work/import-20261109/supabase-local-new` at `3af12d040c24`.
- **Branch and commit:** GitHub `main` `3af12d040c24` (today 3:46 PM CST).
- **Overlap:** No second Supabase stack observed in `docker compose ls`.
- **Security:** `.env` / JWTs / `volumes/` excluded from git. Not opened. Do not commit them.
- **Portability:** Official images help; secrets and volume paths still have to be supplied on a fresh machine.
- **Decision:** **keep.** No database data in git, by design.

### `paperclip-node`

- **GitHub:** https://github.com/CultureReset/paperclip-node (private; default `matt/main` `220756f8b84f`, last default-branch commit 2026-10-31 07:06 PM CST; pushed 2026-11-07 08:08 PM CST)
- **GitHub description:** Private snapshot mirror of paperclipai/paperclip (Matt install v2026.1012.0)
- **Purpose:** Private snapshot/pin of Paperclip (Jarvis HQ / agent company). Live process is the npm-installed `paperclipai` binary, not a git worktree.
- **Source:** Mirror/pin of paperclipai/paperclip (GitHub `isFork` is false on this private repo; `upstream-main` branch exists). Public `CultureReset/paperclip` is the public fork.
- **Technology:** Large TypeScript/JS app (many dependabot branches). Inspected work-copy at `_work/import-20261109/paperclip-node` on `matt/main` `220756f8b84f`.
- **Architecture:** Upstream Paperclip layout (not fully re-walked beyond top-level this pass). Live instance data would be under `~/.paperclip` (not git; not scanned for values).
- **Dependencies:** Uses Hermes as agent runtime (services-control). OpenClaw is listed as a parent/related tile.
- **Connections:** NODE tile 'Paperclip' / `paperclip.voicecommandapi.com` → :17803 → :3100. Tailscale :30443. `paperclipai.service` running pid=12698, port **3100**.
- **Runtime:** **Running** as `~/.local/bin/paperclipai run --instance default`. Not a checkout of this repo.
- **Branch and commit:** Default `matt/main` `220756f8b84f`. `upstream-main` `db03a55a3fb3`. Import of this repo was **skipped** for a push-from-live earlier today because existing history already had **95 gitleaks hits** (mostly tests/docs; values not recorded here).
- **Overlap:** Public `paperclip`; live npm install; `paperclip-approval-bridge` is a thin portable component (GitHub only this pass).
- **Security:** Do not commit `~/.paperclip/instances/default/db` or `~/.config/paperclip-app`. Prior gitleaks count=95 on repo history. No new historical scan was run this pass.
- **Portability:** A clone of `matt/main` is a source pin, not the live instance. Units/paths are host-specific.
- **Decision:** **keep** as the pin. Do not replace the running npm install from this tree without a planned cutover. Do not import live instance data.

### `openclaw`

- **GitHub:** https://github.com/CultureReset/openclaw (private; default `matt/main` `6dd8b2c4517f`, last default-branch commit 2026-10-31 07:05 PM CST; pushed 2026-11-07 08:08 PM CST)
- **GitHub description:** Private mirror of openclaw/openclaw (Matt install v2026.10.4)
- **Purpose:** Private pin/mirror of OpenClaw (gateway used by Paperclip ops). Live process is an npm-global Node gateway, not a git checkout.
- **Source:** Private mirror of `openclaw/openclaw` (description: Matt install v2026.10.4). Not marked isFork; treated as a pin. Public `Open-claw` is a tiny other repo (LICENSE only on GitHub, no README).
- **Technology:** TypeScript (GitHub Contents shows a full upstream root, including `.env.example`).
- **Architecture:** Not locally cloned. Runtime: `openclaw-gateway.service` runs node from nvm v24 with `--max-old-space-size=7969`.
- **Dependencies:** Paperclip relationship (services-control parent/includes). Workspace files belong in `openclaw-workspace`.
- **Connections:** NODE tile 'OpenClaw' / `openclaw.voicecommandapi.com` → :17807 → :18789. Tailscale :31443.
- **Runtime:** **Running.** `openclaw-gateway.service` pid=9549 port **18789**.
- **Branch and commit:** See inventory for default SHA (no local CultureReset checkout). node-infra README (2026-10-31) recorded `matt/main` `6dd8b2c4517f` — **not re-verified today** as the default tip; trust inventory.json for the current default SHA.
- **Overlap:** `Open-claw` (tiny public); `openclaw-workspace`; npm global install.
- **Security:** Gateway config/env not opened. Do not commit them.
- **Portability:** Need the pin + workspace + unit; not turnkey.
- **Decision:** **keep** as the install pin. Keep `openclaw-workspace` separate.

### `openclaw-workspace`

- **GitHub:** https://github.com/CultureReset/openclaw-workspace (private; default `main` `732f58ecc030`, last default-branch commit 2026-10-31 04:56 PM CST; pushed 2026-11-09 03:44 PM CST)
- **Purpose:** Agent workspace files for OpenClaw (AGENTS.md, IDENTITY.md, SOUL.md, USER.md, memory/, etc.).
- **Source:** Custom original.
- **Technology:** Markdown / workspace files only.
- **Architecture:** GitHub `main` `732f58ecc030`. Import `import/live-20261109` `449816e31663`. Live `~/.openclaw/workspace` has a git dir but **no remotes and no commits** ('No commits yet on master').
- **Dependencies:** OpenClaw gateway.
- **Connections:** Used by the running OpenClaw gateway.
- **Runtime:** Workspace is used by the running gateway; the live workspace is not the git repo.
- **Branch and commit:** Import branch holds today's snapshot. Live workspace still disconnected.
- **Overlap:** None as an app. Do not confuse with the `openclaw` source pin.
- **Security:** Workspace files can contain personal instructions; they were listed by name only (AGENTS/IDENTITY/SOUL/USER). Scrub before any wider publish. Secrets were not extracted.
- **Portability:** A clone gives starter workspace files, not the live gateway.
- **Decision:** **keep.** Either add the CultureReset remote to the live workspace after a secret scrub, or keep importing.

### `scrapers`

- **GitHub:** https://github.com/CultureReset/scrapers (private; default `main` `7e401d5e2136`, last default-branch commit 2026-10-31 07:20 PM CST; pushed 2026-11-09 03:44 PM CST)
- **GitHub description:** Scraper/receiver code only
- **Purpose:** Local scraper receivers and the Gulf Shores scraper. Multiple on-demand/core receivers post into local ports.
- **Source:** Custom original.
- **Technology:** Python (per-site receivers under `beachball/`, `brettrobinson/`, `gulfshores/`, `southbaldwin-chamber/`, `youngssuncoast/`, etc.).
- **Architecture:** Live `/home/steve/scrapers` (historically a symlink onto `/hdd`, per earlier plan). Import `import/live-20261109` `4f1bb930f410`; GitHub `main` `7e401d5e2136`.
- **Dependencies:** Python; some venv paths (gulfshores). Data stays out of git.
- **Connections:** NODE services-control group `scraper-receivers`. Units running: beachball, brettrobinson, gulfshores-recv, gulfshores-scraper, southbaldwin, youngssuncoast, plus `gmaps-recv.service` (script under `~/.local/bin`, not necessarily this repo).
- **Runtime:** **Running** (several units; pids recorded in inventory). Live dir is **not a git checkout**.
- **Branch and commit:** Import `4f1bb930f410` is the new published snapshot.
- **Overlap:** None as a product family. gmaps-recv may live outside this tree.
- **Security:** Exclude venv, data, gulfshores-data. Not opened.
- **Portability:** Hardcoded `/home/steve/scrapers` and `/hdd` paths in units (`portability.md`).
- **Decision:** **keep.** Merge import after review; confirm gmaps-recv ownership.

### `second-brain`

- **GitHub:** https://github.com/CultureReset/second-brain (private; default `main` `e4395a1680b4`, last default-branch commit 2026-10-31 07:11 PM CST; pushed 2026-11-09 03:44 PM CST)
- **GitHub description:** Second-brain helpers + gbrain audit gateway code
- **Purpose:** Helpers around a Second Brain / memory vault. `gbrain-audit-gw.service` runs `second-brain/bin/mcp-audit-tap.py` as a tap in front of GBrain.
- **Source:** Custom original (distinct from `eugeniughelbur/obsidian-second-brain` also cloned under `~/.local/share`).
- **Technology:** Python (`bin/`, a few test scripts).
- **Architecture:** Live `~/second-brain` with `bin/` and `kit/`. Data vault is `~/SecondBrain` → `/hdd` (not this repo).
- **Dependencies:** GBrain on :3131; this tap listens on :3130 and upstreams to :3131.
- **Connections:** `gbrain-audit-gw.service` pid=1802 port **3130**.
- **Runtime:** **Running** (the audit-tap). Live dir **not a git checkout**. Import `import/live-20261109` `6dee8cf29b40`; GitHub `main` `e4395a1680b4`.
- **Branch and commit:** Import SHA above.
- **Overlap:** `gbrain` is the memory server itself (bun binary). This repo is helpers/tap, not GBrain source.
- **Security:** Do not commit the vault. `log.txt` exists in the live tree (not opened).
- **Portability:** `/hdd` data path will break on a fresh machine.
- **Decision:** **keep** helpers only; vault stays local.

### `smsgw-relay`

- **GitHub:** https://github.com/CultureReset/smsgw-relay (private; default `main` `6981c01536e5`, last default-branch commit 2026-10-31 07:11 PM CST; pushed 2026-11-09 03:44 PM CST)
- **GitHub description:** SMS gateway relay (env/apk excluded)
- **Purpose:** SMS gateway relay used for approval-by-text. Funnel :8443 → relay :8787, together with `node-sms` (:7772).
- **Source:** Custom original.
- **Technology:** Python (`relay.py` in a nearly flat tree).
- **Architecture:** Live `/home/steve/smsgw/relay` (not git). Import `import/live-20261109` `150a7028f57b`; GitHub `main` `6981c01536e5`.
- **Dependencies:** `node-sms.service` from `nextgent-phone`. Public Funnel paths `/send`, `/inbound`, `/sms-hook` on Tailscale :8443.
- **Connections:** services-control `sms` group. NODE SMS approval flow.
- **Runtime:** **Running.** `smsgw-relay.service` pid=1825 port **8787**.
- **Branch and commit:** Import SHA above.
- **Overlap:** `sms-door` is a related but separate 'Matt texts NODE' component (repo present; not in the running-unit list this pass).
- **Security:** Relay tokens/env not opened. Do not commit them. Exclude apk/env as the GitHub description already says (prior plan).
- **Portability:** Hardcoded live path `/home/steve/smsgw/relay`.
- **Decision:** **keep.** Merge import after review.

### `ai-chat-logger`

- **GitHub:** https://github.com/CultureReset/ai-chat-logger (private; default `main` `8b943286d5e9`, last default-branch commit 2026-10-31 07:11 PM CST; pushed 2026-11-09 03:44 PM CST)
- **GitHub description:** AI chat logger + jarvis-send helpers (code only)
- **Purpose:** Logs / relays AI chat traffic (`ai_chat_logger.py`, `jarvis_send.py`, MCP helpers). Running from `~/.local/share/jarvis-send/`.
- **Source:** Custom original.
- **Technology:** Python.
- **Architecture:** Import work-copy is code files only. Live data dir was described as ~6.9 GB earlier today and was **not** imported.
- **Dependencies:** Python venv at `~/.local/share/jarvis-send/venv`.
- **Connections:** `ai-chat-logger.service` pid=24931.
- **Runtime:** **Running.** Code path is under `~/.local/share/jarvis-send/` (not a git checkout).
- **Branch and commit:** Import `import/live-20261109` `7a73929a86d2`; GitHub `main` `8b943286d5e9`.
- **Overlap:** None significant.
- **Security:** Never commit the data dir. Code-only import already followed.
- **Portability:** Unit points at a home-directory share path, not the git repo.
- **Decision:** **keep** code in git, data local.
### `ai-stack-kit`

- **GitHub:** https://github.com/CultureReset/ai-stack-kit (private; default `main` `b11fd9a54c46`, last default-branch commit 2026-11-07 08:10 PM CST; pushed 2026-11-07 10:12 PM CST)
- **GitHub description:** AI stack kit templates
- **Purpose:** Portable NODE/AI-stack kit: installer, inventory, templates, and documentation for fetching component payloads at pinned commits. It is an orchestrator/kit, not the live running platform.
- **Source:** Custom original (deployment-config / kit).
- **Technology:** Shell + docs + `bin/`; `install.sh`, `CURRENT-ARCHITECTURE.md`, inventories dated 2026-10-26 / 2026-11-07.
- **Architecture:** Live `/home/steve/ai-stack-kit` on `main` tracking `origin/local-history` at `0ac98030a4f8`. GitHub default `main` is `b11fd9a54c46` (different). A `ai-stack-kit.tar.gz` exists in the live tree (publication artifact).
- **Dependencies:** Authenticated GitHub access to private CultureReset component repos (per 2026-11-07 portability doc).
- **Connections:** References many component repos via pins; does not itself listen on a port this pass.
- **Runtime:** **Not a running service.** Kit/docs tree only.
- **Branch and commit:** Reconcile live `local-history` `0ac98030a4f8` vs GitHub `main` `b11fd9a54c46` vs published tag/archive `7f3eabb` mentioned in the Nov 7 portability doc (not re-hashed this pass).
- **Overlap:** `node-kit-runtime` is a related thin fetcher (`kit.py`, `manifest.json`) on GitHub only this pass.
- **Security:** Prior kit publication claimed a bounded credential scan; this pass did not re-scan kit history. Live tree was dirty=5 at 3:20 PM snapshot (not re-diffed in full).
- **Portability:** This *is* the portability attempt. The Nov 7 doc says a truthful one-command full-stack rebuild does **not** exist yet (`--profile full` blocked). Still true: no launcher/manifest contract in production.
- **Decision:** **keep** as the kit. Do not advertise it as a working full-stack install.

### `approval-gateway`

- **GitHub:** https://github.com/CultureReset/approval-gateway (private; default `main` `31fd4e74eab8`, last default-branch commit 2026-10-31 04:55 PM CST; pushed 2026-11-07 07:33 PM CST)
- **Purpose:** NODE approval gateway (README calls it a skeleton): approval tiers / WebAuthn / grant flow (`gateway.py`, `approval_grant.py`, hooks, plugins, tests).
- **Source:** Custom original.
- **Technology:** Python + HTML (`approve.html`) + systemd-related `deploy/`.
- **Architecture:** Live `/home/steve/agents/approval-gateway` on branch `approval-gateway` `ae3a449eb394` (= GitHub `local-history`). GitHub `main` is `31fd4e74eab8`.
- **Dependencies:** Related to sms-door, node-phone SMS codes, and `/opt/node-approvals/app` (running/non-git tree called out in the earlier plan; path exists, not a git checkout).
- **Connections:** Tailscale :14443 has a `/approvals` path to :7795 (a listener exists on 127.0.0.1:7795 this pass; process name was not shown in the ss snippet).
- **Runtime:** The named `approval-gateway.service` was **not** in the running-user-unit list this pass. `/opt/node-approvals/app` is still a non-git tree. Status of that process was not separately proven beyond the :7795 listen socket.
- **Branch and commit:** Live pin `ae3a449eb394` on `local-history` / `approval-gateway` branch.
- **Overlap:** `node-approval-grants` is a thin portable component (GitHub: README + install.sh + portable/). `/opt/node-approvals/app` may diverge from the git repo.
- **Security:** WebAuthn/approval material is sensitive; not read. Reconcile `/opt` vs git before publishing more.
- **Portability:** Host `/opt` path is a portability hazard.
- **Decision:** **keep** the repo. **investigate** whether `/opt/node-approvals/app` is the real live code and whether it should be imported (code only).

### `sms-door`

- **GitHub:** https://github.com/CultureReset/sms-door (private; default `main` `0567aaf72089`, last default-branch commit 2026-10-31 04:56 PM CST; pushed 2026-11-07 07:34 PM CST)
- **Purpose:** SMS line into NODE ('Matt texts NODE'): `sms_door.py` + a unit file in-repo.
- **Source:** Custom original.
- **Technology:** Python.
- **Architecture:** `/home/steve/agents/sms-door` on `master` `3fb9e49ff998` tracking `origin/local-history`. GitHub `main` `0567aaf`.
- **Dependencies:** Related to smsgw-relay and nextgent-phone (`node-sms`).
- **Connections:** Approval-by-text family.
- **Runtime:** **Not in the running-unit list this pass.** Repo is present and clean relative to its upstream in the earlier snapshot.
- **Branch and commit:** Live `3fb9e49ff998`.
- **Overlap:** `smsgw-relay` is what is actually running on :8787.
- **Security:** SMS tokens/env not opened.
- **Portability:** Unit in-repo still likely has host paths.
- **Decision:** **keep.** Confirm whether this unit is intentionally stopped (it was listed as inactive in the earlier plan).

### `node-pccall`

- **GitHub:** https://github.com/CultureReset/node-pccall (private; default `main` `788aee0372f7`, last default-branch commit 2026-10-31 04:55 PM CST; pushed 2026-11-07 07:33 PM CST)
- **Purpose:** 'Call my computer': a small Node server (`server.js`) that drives a local Chrome (CDP) so Matt can talk to Grok/ChatGPT/Gemini via the door. Default port 7794.
- **Source:** Custom original.
- **Technology:** Node (`package.json` name `pccall`) + `pccall_door.py` + `call.html`.
- **Architecture:** `/home/steve/agents/node-pccall` on `master` `831261d8b697` tracking `origin/local-history`. GitHub `main` `788aee0`.
- **Dependencies:** Local Chrome at `/opt/google/chrome/chrome` (from source comments). Door integration.
- **Connections:** node-door; documented in node-infra README as 127.0.0.1:7794.
- **Runtime:** **Running.** `node-pccall.service` pid=1812, port **7794** confirmed listening.
- **Branch and commit:** Live `831261d8b697`. Earlier snapshot marked dirty=2 (untracked); not re-committed this pass.
- **Overlap:** None.
- **Security:** Chrome profile and any door tokens are local. Source comments mention sign-in flows to third-party sites — treat as a privileged desktop agent.
- **Portability:** Hardcoded Chrome path and nvm Node path in the unit.
- **Decision:** **keep.** Reconcile dirty files and GitHub `main` vs `local-history`.

### `node-voice`

- **GitHub:** https://github.com/CultureReset/node-voice (private; default `main` `4dc89b50fa48`, last default-branch commit 2026-10-31 04:56 PM CST; pushed 2026-11-07 07:33 PM CST)
- **Purpose:** Voice routes / brain / phone helpers for talking to NODE (`brain.py`, `fastpath.py`, `phone.py`, `voice_routes.py`).
- **Source:** Custom original.
- **Technology:** Python.
- **Architecture:** `/home/steve/agents/node-voice` on `master` `ab63bedb8a83` tracking `origin/local-history`. GitHub `main` `4dc89b5`.
- **Dependencies:** ASR shim / llm / door — exact runtime wiring not re-traced beyond file names this pass.
- **Connections:** Voice stack with `asr-shim.service` (running from node-helpers) and possibly node-chat.
- **Runtime:** **No `node-voice.service` in the running list, and earlier verification (same day) reported the unit file missing.** Repo exists.
- **Branch and commit:** Live `ab63bedb8a83`.
- **Overlap:** Voice also exists in `nextgent-chat` (voice agent comment in services-control).
- **Security:** Not assessed beyond 'no running unit'.
- **Portability:** Unknown without a unit.
- **Decision:** **investigate** — is this superseded by node-chat / asr-shim, or is the unit missing accidentally?

### `nextgent-phone`

- **GitHub:** https://github.com/CultureReset/nextgent-phone (private; default `main` `597c88da448e`, last default-branch commit 2026-10-13 11:56 AM CST; pushed 2026-11-07 07:34 PM CST)
- **GitHub description:** SMS through the agent's own SIM — the approval door, without Twilio
- **Purpose:** SMS helper (`sms.js`) used by `node-sms.service` — the NODE SMS side of approval-by-text.
- **Source:** Custom original (repo name `nextgent-phone`; local folder `~/ang/src/node-phone`).
- **Technology:** Node (sms.js + tests).
- **Architecture:** Flat directory. Live branch `approval-gateway` `eed44fd876e0`, tracking origin of that branch, dirty=2 in the 3:20 PM snapshot and still on that branch this pass.
- **Dependencies:** smsgw-relay; LiteLLM key name is referenced by `node-chat` (not necessarily this file).
- **Connections:** `node-sms.service` pid=24932 cwd=`/home/steve/ang/src/node-phone` port **7772**.
- **Runtime:** **Running** on :7772.
- **Branch and commit:** Live `eed44fd876e0` on `approval-gateway`. GitHub `main` may differ (inventory default SHA). Reconcile main vs this branch.
- **Overlap:** sms-door, smsgw-relay, approval-gateway.
- **Security:** SMS code logic was previously described as CSPRNG 8-char codes with a 5-min cap (commit message); not re-audited line-by-line this pass. Env/secrets not opened.
- **Portability:** nvm path hardcoded in the unit.
- **Decision:** **keep.** Commit/reconcile dirty files; do not create a second `node-phone` repo.

### `nextgent-chat`

- **GitHub:** https://github.com/CultureReset/nextgent-chat (private; default `main` `cbd02c7819c6`, last default-branch commit 2026-09-29 07:29 PM CST; pushed 2026-11-07 07:34 PM CST)
- **GitHub description:** The agent that actually runs — voice, history, terminal, API
- **Purpose:** NODE chat / voice agent with an OpenAI-compatible API (`server.js`, `index.html`, `picker.js`). Core NODE service.
- **Source:** Custom original (repo `nextgent-chat`; local `~/ang/src/node-chat`).
- **Technology:** Node.
- **Architecture:** Flat directory. Live `main` `cbd02c7819c6` tracking origin/main (3:20 PM snapshot dirty=2; this pass status -sb showed tracking origin/main — dirty not re-printed in the short status line).
- **Dependencies:** Unit exports `UPSTREAM_KEY` from an environment variable named `LITELLM_MASTER_KEY` (name only) and runs `server.js`. LiteLLM.
- **Connections:** `node-chat.service` pid=6904 port **7780** (127.0.0.1 and Tailscale). Listed as a core service in services-control.
- **Runtime:** **Running** on :7780.
- **Branch and commit:** `cbd02c7819c6` on `main`.
- **Overlap:** Distinct from OpenJarvis and nextgent-jarvis.
- **Security:** Master-key env is provided by the unit/environment (value not read). Bind includes the tailnet address, not only localhost.
- **Portability:** Hardcoded path `/home/steve/ang/src/node-chat`.
- **Decision:** **keep.** Review dirty files if still present.

### `nextgent-jarvis`

- **GitHub:** https://github.com/CultureReset/nextgent-jarvis (private; default `main` `f37d953598cc`, last default-branch commit 2026-10-10 11:45 PM CST; pushed 2026-11-06 09:20 AM CST)
- **GitHub description:** Jarvis persistent front door: intent interpretation, scoped retrieval from Second Brains and Operational Warehouse, Paperclip task submission, and result reporting. Private.
- **Purpose:** A different 'Jarvis' app than OpenJarvis — README `# nextgent-jarvis`, with `src/`, `docs/`, `tests/`. Recent work on a papertrail/Paperclip bridge branch.
- **Source:** Custom original.
- **Technology:** Not fully typed from a package.json in the compact summary (README + src/tests).
- **Architecture:** `/home/steve/ang/repos/nextgent-jarvis` on `feat/local-papertrail-paperclip-bridge-20261012` `c86caa5243e1` (2026-11-06), tracking origin of that branch.
- **Dependencies:** Paperclip (branch name / commit message mention a trusted dispatcher result reader).
- **Connections:** Not seen as a running systemd unit this pass.
- **Runtime:** **Not running** as a unit this pass.
- **Branch and commit:** Feature branch SHA above. Default branch SHA is in inventory.json.
- **Overlap:** Name overlap with OpenJarvis / nextgent-openjarvis; **different product**. Keep separate.
- **Security:** Not deeply security-reviewed this pass.
- **Portability:** Unknown; no live unit.
- **Decision:** **keep separate** from OpenJarvis. Investigate whether this feature branch is the intended pin.

### `cybercheck-orchestrator`

- **GitHub:** https://github.com/CultureReset/cybercheck-orchestrator (public; default `claude/admin-dashboard-repos-review-903d4i` `071c6841c36d`, last default-branch commit 2026-08-26 08:28 PM CST; pushed 2026-11-02 11:36 AM CST)
- **Purpose:** Orchestrator / 'ghost-platform' package (`package.json` name `ghost-platform`) with modules, db, docs, verify script. Wired at one point to the NODE approval gateway (branch name `node-approval-gateway-wiring`).
- **Source:** Custom original.
- **Technology:** JavaScript (package scripts: demo, start, verify, test).
- **Architecture:** `/home/steve/ang/src/cybercheck-orchestrator` on `node-approval-gateway-wiring` `8ad32084907b`. Two other local clones were **not** archived because HEADs differ: `ang/repos` `071c6841c3` and `ang/src/orch` `f1d4e8b` (from the 3:20 PM inventory / archive skip list).
- **Dependencies:** Approval gateway (commit message). Broader CyberCheck/GCR family.
- **Connections:** Not a running unit this pass.
- **Runtime:** **Not running** this pass.
- **Branch and commit:** Three local HEADs (see overlap). GitHub default SHA is in inventory.
- **Overlap:** Multiple clones/branches of the same repo. Archive skipped today's extra copies for that reason.
- **Security:** Not deeply reviewed. Treat as product code, not an empty experiment.
- **Portability:** Unknown without a current runtime pin.
- **Decision:** **investigate** which of the three HEADs is authoritative, then archive the extras.

### `Dashboards-users-`

- **GitHub:** https://github.com/CultureReset/Dashboards-users- (public; default `claude/dashboard-inventory-purposes-m5wtba` `aac903f97b0f`, last default-branch commit 2026-10-30 03:07 AM CST; pushed 2026-11-06 04:37 PM CST)
- **Purpose:** Business / user dashboard shell (package name `dashboard-shell`, Vite + React, README '# Business dashboard'). Distinct from the CyberCheck *admin* dashboard.
- **Source:** Custom original.
- **Technology:** JavaScript/Vite (`src/`, `public/`, `sql/`, `docs/`, `.env.example`).
- **Architecture:** Two live clones: `ang/src` at `8f6199a41493` on `claude/dashboard-inventory-purposes-m5wtba` (ahead 1 vs its upstream when checked earlier today — GitHub that branch is now `aac903f97b0f`, so local and remote may have moved relative to each other); `ang/repos` at `f323f5510fc8` (archive was skipped because HEAD differs). GitHub `main` is `d290da42dab2`.
- **Dependencies:** Typically Supabase / GCR API in this family (`.env.example` present; values not read). Not re-traced to a live Vercel deployment this pass.
- **Connections:** Product family with `gcr-api-clean` and admin dashboards. Not framed in NODE `webapps.json`.
- **Runtime:** **Not running on this machine** as a systemd/docker unit this pass. (It may be deployed on Vercel; that was not re-verified here.)
- **Branch and commit:** Authoritative production pin is **not obvious**. `main` `d290da42dab2` vs default branch `claude/dashboard-inventory-purposes-m5wtba` `aac903f97b0f` vs two different local SHAs.
- **Overlap:** `Admin-dashboard-main` is a different app (CyberCheck admin). Other dashboard-named repos: `admin-dashboard-`, `Dashboard-` (empty), `Plat-admin`, `Play-user`, `Universal-dashboard-`.
- **Security:** `.env.example` only was eligible to be listed; `.env` not opened. Prior research flagged owner-token / public leak issues in the GCR/dashboard family — those findings were not re-tested this pass (see open questions).
- **Portability:** A dashboard app, not a NODE desktop component. Env and API URLs would need to be supplied.
- **Decision:** **investigate** the canonical branch before merging or archiving either local clone.

### `Admin-dashboard-main`

- **GitHub:** https://github.com/CultureReset/Admin-dashboard-main (public; default `claude/cybercheck-modular-react-dashboard-7on41c` `5df87125247a`, last default-branch commit 2026-11-02 12:57 PM CST; pushed 2026-11-06 04:37 PM CST)
- **Purpose:** CyberCheck admin dashboard — modular React rebuild wired to `gcr-api-clean` (package description says so). README '# CyberCheck Admin Dashboard'.
- **Source:** Custom original.
- **Technology:** Vite/React (`src/`, `docs/`, `vercel.json`, `.env.example`).
- **Architecture:** `/home/steve/ang/src/Admin-dashboard-main`. The `ang/repos` copy was **not** archived because it has 11 unique commits vs src (skip reason `dae7507753`).
- **Dependencies:** gcr-api-clean (stated in package.json description).
- **Connections:** GCR/CyberCheck admin plane. Not a NODE tile this pass.
- **Runtime:** **Not running locally** as a unit this pass (possible Vercel deploy, not re-verified).
- **Branch and commit:** See inventory for default SHA. Reconcile src vs repos unique commits.
- **Overlap:** Dashboards-users- (user/business shell); many older dashboard/GCR admin trees.
- **Security:** .env.example only; not opened live env. Same family security questions as GCR API (not re-tested).
- **Portability:** Standard web app + env.
- **Decision:** **keep** as the admin dashboard candidate; **investigate** the unique commits on `ang/repos/Admin-dashboard-main` before archive.

### `gcr-unified`

- **GitHub:** https://github.com/CultureReset/gcr-unified (private; default `master` `47f71ac7cd1b`, last default-branch commit 2026-10-30 09:07 AM CST; pushed 2026-11-09 10:18 AM CST)
- **Purpose:** Gulf Coast Radar unified frontend (package name `gcr-unified`, React + Vite). Public/tourist-facing family member.
- **Source:** Custom original.
- **Technology:** JavaScript/React (`src/`, `public/`, many one-off export/debug `*.mjs` scripts at the repo root).
- **Architecture:** Local `ang/src/gcr-unified` on `master` `d8e5d63502aa` (2026-08-04) tracking origin/master **as the local remote-tracking ref**. GitHub `master` is now `47f71ac7cd1b` — local is **behind**. 68 GitHub branches, including today's-looking `feature/tourist-rewards-hub-20261109`.
- **Dependencies:** Supabase / GCR API (many scripts mention supabase/db; no live credentials read). `.env.production` exists — **not opened**.
- **Connections:** GCR API family. Not a NODE tile.
- **Runtime:** **Not running locally** this pass. PushedAt today 10:18 AM CST (remote moved).
- **Branch and commit:** Authoritative GitHub `master` `47f71ac7cd1b` is ahead of the local clone. Do not assume the local tree is current.
- **Overlap:** `gcr-unified-v2` (local package name also `gcr-unified`, same Vite README stub, SHA `f992415` in the 3:20 PM inventory). Other GCR fronts: `gcr-public`, `gcr-links`, `gcr-visitor-guide`, `live-gcr`, etc.
- **Security:** .env.production present on disk (not read). Prior RLS / public-entity leak findings belong to this family (not re-tested this pass).
- **Portability:** Web app + env. Local clone is stale vs GitHub.
- **Decision:** **investigate** which branch is production; update or replace the stale local clone; do not archive v2 until compared.

### `gcr-api-clean`

- **GitHub:** https://github.com/CultureReset/gcr-api-clean (private; default `main` `edb480069f21`, last default-branch commit 2026-11-02 11:38 AM CST; pushed 2026-11-09 03:00 PM CST)
- **Purpose:** GCR / restaurant-data API described in package.json as 'GCR Clean API - Restaurant data platform'. This is the leading API candidate in prior work (Admin dashboard says it wires here). Routes, middleware, supabase, migrations, extractors.
- **Source:** Custom original.
- **Technology:** JavaScript (scripts: start, dev, many check/test/verify commands).
- **Architecture:** `/home/steve/ang/src/gcr-api-clean` on `main` `b75300ca8de4` (2026-08-04) — **behind** GitHub `main` `edb480069f21` (2026-11-02 11:38 AM CST). PushedAt is today 3:00 PM CST, so non-default branches moved today. GitHub has **at least 100 branches** (list possibly truncated).
- **Dependencies:** Supabase / Postgres (migrations, `.env.example`). Vercel build script present.
- **Connections:** Admin-dashboard-main; user dashboards; GCR frontends. Not a NODE tile.
- **Runtime:** **Not running on this machine** this pass (likely Vercel/cloud; not re-verified).
- **Branch and commit:** GitHub `main` `edb480069f21` is the default tip. Local clone is months behind. Do not treat `ang/src` as authoritative.
- **Overlap:** `gcr-api` (package name `cybercheck-backend`, different description) and `gcr-api-v2` (package name `gcr-api-clean`, same 'Force redeploy' README as clean, looks like a copy). This is a classic multiple-versions family.
- **Security:** .env.example only opened by name. Prior research: public entity leak, RLS notes, owner token TTL — **not re-tested this pass**. See open questions.
- **Portability:** API + env + hosted DB. Not a NODE desktop component.
- **Decision:** **keep** as the current API candidate, but **refresh the local clone** (read-only fetch/comparison) before any merge/archive of `gcr-api` / `gcr-api-v2`. Pick a real default/production branch among the 100+.

### `node-services`

- **GitHub:** https://github.com/CultureReset/node-services (private; default `main` `36afd54b28b0`, last default-branch commit 2026-11-02 09:08 PM CST; pushed 2026-11-02 09:09 PM CST)
- **Purpose:** Snapshot of NODE systemd user units and related scripts (deployment-config), not an application.
- **Source:** Custom original.
- **Technology:** systemd unit files + scripts + `config-examples/`.
- **Architecture:** `/home/steve/node-services` on `main` `36afd54b28b0` (2026-11-02), in sync with origin. README `# node-services`.
- **Dependencies:** The live units on the machine may have drifted from this snapshot (live units are under `~/.config/systemd/user/`).
- **Connections:** Documents/installs units that start Boxes, door, proxies, etc.
- **Runtime:** This repo is not a process. The units it describes are running from the host's systemd directories.
- **Branch and commit:** `36afd54b28b0`.
- **Overlap:** `node-infra` (broader host map, also units/compose/network). Both are config repos.
- **Security:** config-examples should stay example-only. Live unit ExecStart lines contain host paths (and some keyfile flags, values not recorded).
- **Portability:** A starting point for units, but paths are machine-specific. This is exactly what a future `node-launch` should generate instead of baking `/home/steve`.
- **Decision:** **keep** as deployment-config. Diff against live units before treating it as current.

### Selected shallow cards (family heads and remote-only pins)

These were inspected via a local top-level/README read and/or the GitHub Contents API, not a full module walk or runtime trace beyond what's in section (a).

### `gcr-api`

- **GitHub:** https://github.com/CultureReset/gcr-api (private; default `main` `0dbafc63fafc`, last default-branch commit 2026-05-25 05:40 PM CST; pushed 2026-09-29 08:53 PM CST)
- **Purpose:** Older/alternate GCR API. Local `ang/repos/gcr-api` package.json name is `cybercheck-backend` ('CyberCheck platform API server').
- **Source:** Custom. Decision: **investigate/merge** into the gcr-api-clean line after a real diff — not done this pass.
- **Runtime:** Not running locally this pass.
- **Overlap:** gcr-api-clean, gcr-api-v2.
- **Decision:** **investigate** (do not archive until compared to gcr-api-clean at the GitHub main tip, not the stale local clean clone).

### `gcr-api-v2`

- **GitHub:** https://github.com/CultureReset/gcr-api-v2 (public; default `main` `29eb8aa48f5f`, last default-branch commit 2026-07-19 10:34 PM CST; pushed 2026-11-06 04:37 PM CST)
- **Purpose:** Looks like a copy of gcr-api-clean (same package name and same 'Force redeploy at Thu May 28…' README stub) at `/home/steve/ang/src/gcr-api-v2`.
- **Source:** Custom copy/variant.
- **Runtime:** Not running locally.
- **Overlap:** gcr-api-clean.
- **Decision:** **investigate** then likely **archive** if it is a stale copy.

### `gcr-unified-v2`

- **GitHub:** https://github.com/CultureReset/gcr-unified-v2 (public; default `master` `4f47d3b18035`, last default-branch commit 2026-09-29 03:28 PM CST; pushed 2026-09-29 03:45 PM CST)
- **Purpose:** v2 tree of the unified frontend; package name still `gcr-unified`. Local SHA in the 3:20 PM inventory: `f992415`.
- **Source:** Custom variant.
- **Runtime:** Not running locally.
- **Decision:** **investigate** vs current GitHub `gcr-unified` master before archive.

### `OpenJarvis`

- **GitHub:** https://github.com/CultureReset/OpenJarvis (public; default `main` `21b53bc7046b`, last default-branch commit 2026-09-15 12:17 AM CST; pushed 2026-09-29 01:27 AM CST)
- **Fork parent:** `open-jarvis/OpenJarvis`
- **GitHub description:** Personal AI, On Personal Devices
- **Purpose:** Public CultureReset fork/copy of OpenJarvis at `ang/src/OpenJarvis` `21b53bc` (stale vs live).
- **Source:** Fork/copy of open-jarvis/OpenJarvis.
- **Runtime:** Not running. Live is `openjarvis-node` / `~/.openjarvis/src`.
- **Decision:** **archive/freeze** as a public fork; do not develop here.

### `nextgent-openjarvis`

- **GitHub:** https://github.com/CultureReset/nextgent-openjarvis (private; default `main` `0c5649dd9311`, last default-branch commit 2026-09-29 03:28 PM CST; pushed 2026-11-05 07:40 PM CST)
- **GitHub description:** Your maintained Jarvis foundation
- **Purpose:** Third OpenJarvis tree (`ang/mirrors/openjarvis`) with CultureReset origin and upstream remote, SHA `a6dcf84`.
- **Source:** Fork/mirror.
- **Runtime:** Not live.
- **Decision:** **investigate/freeze** — not the live runtime.

### `gbrain`

- **GitHub:** https://github.com/CultureReset/gbrain (private; default `matt/main` `12384420e701`, last default-branch commit 2026-10-31 06:41 PM CST; pushed 2026-11-07 08:08 PM CST)
- **GitHub description:** Private mirror of garrytan/gbrain (Matt install v0.60.317.0)
- **Purpose:** Private pin of garrytan/gbrain (description: Matt install v0.60.317.0). Running memory server.
- **Source:** Private mirror (GitHub Contents shows a full upstream-style tree + `.gitleaks.toml`).
- **Technology:** TypeScript; live binary is `~/.bun/bin/gbrain serve --http --port 3131 --bind 127.0.0.1`.
- **Connections:** second-brain audit tap on :3130 → :3131. Core NODE service (shared agent memory).
- **Runtime:** **Running.** `gbrain.service` pid=1801 port **3131**. No local CultureReset checkout.
- **Decision:** **keep** as the pin. Do not commit bind tokens (unit uses `--suppress-bootstrap-token`).

### `searxng`

- **GitHub:** https://github.com/CultureReset/searxng (public; default `master` `ac11e14c5edf`, last default-branch commit 2026-11-06 01:51 PM CST; pushed 2026-11-07 08:08 PM CST)
- **Fork parent:** `searxng/searxng`
- **GitHub description:** SearXNG is a free internet metasearch engine which aggregates results from various search services and databases. Users are neither tracked nor profiled.
- **Purpose:** Public fork of SearXNG source. Live search is the official image, not this fork.
- **Source:** Fork of `searxng/searxng`.
- **Runtime:** **Running official image** `searxng/searxng:latest` on **:8888**. Config dir `~/searxng` is not git (per earlier plan).
- **Decision:** **keep the fork as optional pin**; put Matt's compose/config in `nextgent-runtimes` or a small original repo — config was not imported today.

### `litellm`

- **GitHub:** https://github.com/CultureReset/litellm (public; default `main` `07c722989560`, last default-branch commit 2026-11-07 06:57 PM CST; pushed 2026-11-07 08:08 PM CST)
- **Fork parent:** `BerriAI/litellm`
- **GitHub description:** The fastest, litest AI Gateway. Rust core with Python SDK. Call 100+ LLM APIs in OpenAI (or native) format with cost tracking, guardrails, load balancing, and logging [Bedrock, Azure, OpenAI, Anthropic, OpenAI, VertexAI, vLLM, Nvidia NIM]
- **Purpose:** Public fork of LiteLLM source. Live gateway is the official image + `~/api-gateway/config.yaml` (not git).
- **Source:** Fork of `BerriAI/litellm`.
- **Runtime:** **Running official image** `ghcr.io/berriai/litellm:v1.105.1` (container `litellm`) with `litellm-db` on 127.0.0.1:5433. API on **:4000**. Core NODE service. `/health` was observed to return 401 in today's verification; `/health/liveliness` returned 200.
- **Decision:** **keep fork as optional pin**; keep redacted config in `node-infra` or a dedicated config repo — **not done today**. Never commit API keys.

### `node-tunnel`

- **GitHub:** https://github.com/CultureReset/node-tunnel (private; default `main` `492d0dd2be9c`, last default-branch commit 2026-11-07 07:34 PM CST; pushed 2026-11-07 07:34 PM CST)
- **GitHub description:** Portable NODE component; source and manual-only installation, no production activation
- **Purpose:** Thin portable wrapper (README + install.sh + portable/) for the chisel-based NODE tunnel.
- **Source:** Custom (deployment-config / wrapper). Upstream source also forked as `CultureReset/chisel`.
- **Runtime:** **Running.** `node-tunnel.service` pid=1813, binary `~/.local/share/node-tunnel/chisel`, port **7710**. cloudflared `/tunnel` and NODE door companion path.
- **Security:** Unit ExecStart includes a `--keyfile` flag (value redacted). Do not commit `chisel-users.json` or keyfiles from `~/.config/nodeos/door/`.
- **Decision:** **keep** the wrapper; keep `chisel` as the upstream fork.

### `node-infra`

- **GitHub:** https://github.com/CultureReset/node-infra (private; default `main` `304b6e809f09`, last default-branch commit 2026-10-31 07:47 PM CST; pushed 2026-11-02 11:47 AM CST)
- **Purpose:** Scrubbed infrastructure map (systemd, docker, network, scripts) for this host. README lists own-code repos and states secrets were redacted to placeholders.
- **Source:** Custom deployment-config. Local `gh-export/node-infra` was **moved to `~/_archive/2026-11-09/` today**; GitHub copy still exists.
- **Runtime:** Not a process.
- **Decision:** **keep.** Useful map; remember it is a 2026-10-31-era snapshot plus whatever has been pushed since (inventory has the default SHA). Live units may have drifted.

### `node-agents`

- **GitHub:** https://github.com/CultureReset/node-agents (private; default `main` `941bb96d7add`, last default-branch commit 2026-11-02 09:08 PM CST; pushed 2026-11-02 09:08 PM CST)
- **Purpose:** Documentation umbrella (NODE whitepaper, approval-flow research, plugin standard, SSO plans). GitHub root is mostly markdown. Intended not to vendor child repos.
- **Source:** Custom. Category: documentation-only.
- **Decision:** **keep** as docs; do not put component source here.

### `nextgent-shell`

- **GitHub:** https://github.com/CultureReset/nextgent-shell (private; default `main` `8ca8ea3a4873`, last default-branch commit 2026-10-13 06:38 PM CST; pushed 2026-11-02 11:43 AM CST)
- **GitHub description:** Single NEXT GENT web shell. Empty. Businesses and modules are data. Not Plat-admin or Play-user.
- **Purpose:** A different, nearly empty 'single NEXT GENT web shell' (GitHub: README + src; description says businesses/modules are elsewhere). **Not** `node-shell`.
- **Decision:** **do not reuse** for the Boxes shell split. Freeze unless Matt has another plan.

### `MagicMirror`

- **GitHub:** https://github.com/CultureReset/MagicMirror (public; default `master` `f138f5b690ce`, last default-branch commit 2026-10-01 08:34 AM CST; pushed 2026-11-06 12:20 AM CST)
- **Fork parent:** `MagicMirrorOrg/MagicMirror`
- **GitHub description:** MagicMirror² is an open source modular smart mirror platform. With a growing list of installable modules, the MagicMirror² allows you to convert your hallway or bathroom mirror into your personal assistant.
- **Purpose:** Public fork of MagicMirror². Ambient TV overview is part of Matt's stated vision (research §8); Display Bot work was not re-audited this pass.
- **Source:** Fork of `MagicMirrorOrg/MagicMirror`.
- **Runtime:** Not in `docker ps` / running user units this pass.
- **Decision:** **investigate** whether a live MagicMirror instance exists elsewhere; do not claim it is running.

### `paperclip`

- **GitHub:** https://github.com/CultureReset/paperclip (public; default `master` `dc0a649e2735`, last default-branch commit 2026-10-16 07:23 AM CST; pushed 2026-10-16 07:23 AM CST)
- **Fork parent:** `paperclipai/paperclip`
- **GitHub description:** The open-source app everyone uses to manage agents at work
- **Purpose:** Public fork of Paperclip. Use `paperclip-node` for Matt's pin.
- **Decision:** **keep** the public fork; don't develop live work here.

### `chisel`

- **GitHub:** https://github.com/CultureReset/chisel (public; default `master` `5ee6c74d60d9`, last default-branch commit 2026-10-11 07:07 AM CST; pushed 2026-10-11 07:07 AM CST)
- **Fork parent:** `jpillora/chisel`
- **GitHub description:** A fast TCP/UDP tunnel over HTTP
- **Purpose:** Upstream chisel source fork. Live tunnel uses a binary under `~/.local/share/node-tunnel/`.
- **Source:** Fork of `jpillora/chisel`.
- **Decision:** **keep** as upstream pin; runtime wrapper is `node-tunnel`.

### nextgent-* microservices (shallow local, mostly not running)

Local checkouts under `~/ang/src/node-*` map to `CultureReset/nextgent-*`. These are small JS modules (often a single `*.js` plus a test). None of the following were in the running-unit list this pass except `nextgent-chat` and `nextgent-phone` (already carded above).

| Repo | Local path (this pass) | What the tree contained | Decision |
|---|---|---|---|
| `nextgent-agents` | /home/steve/ang/src/node-agents | agents.js | **keep** as small modules; do not invent new repo names |
| `nextgent-auth` | /home/steve/ang/src/node-auth | auth.js + test | **keep** as small modules; do not invent new repo names |
| `nextgent-handoff` | /home/steve/ang/src/node-handoff | detect.js, handoff.js + test | **keep** as small modules; do not invent new repo names |
| `nextgent-llm-api` | /home/steve/ang/src/node-llm-api | key.js, keys.js, server.js | **keep** as small modules; do not invent new repo names |
| `nextgent-match` | /home/steve/ang/src/node-match | match.js + test + README | **keep** as small modules; do not invent new repo names |
| `nextgent-relay` | /home/steve/ang/src/node-relay | client.js, server.js | **keep** as small modules; do not invent new repo names |
| `nextgent-scout` | /home/steve/ang/src/node-scout | harvest/enrich/parse tools; package.json 'Who is in a market…' | **keep** as small modules; do not invent new repo names |
| `nextgent-store` | /home/steve/ang/src/node-store | index.html, server.js | **keep** as small modules; do not invent new repo names |
| `nextgent-survey` | /home/steve/ang/src/node-survey | survey.js + test | **keep** as small modules; do not invent new repo names |
| `nextgent-tools` | /home/steve/ang/src/node-tools | many scripts (backup, harvest, inventory, ALIGN.md, PLATFORM.md) — a toolbox, not one service | **keep** as small modules; do not invent new repo names |## (d) Category breakdown

Categories are assigned conservatively. A repo can be a real application **and** also appear under 'multiple versions' below. Empty GitHub repos are the only automatic 'abandoned experiment' class. Stale-but-substantial product trees (GCR, dashboards) stay 'real-application' until Matt decides otherwise.

| Category | Count |
|---|---:|
| real-application | 255 |
| deployment-config | 10 |
| documentation-only | 2 |
| abandoned-experiment | 26 |

### Real applications

255 repos. This default includes: the live NODE/agent/app stack; GCR and CyberCheck product trees; nextgent microservices; and many forks or older apps in the long tail that were **metadata-only** this pass (they may later be reclassified as experiments once inspected). Do not read this count as '255 things running.' Only 25 repos have a live process or container attributed in this pass.

### Deployment / configuration only

Assigned when the repo's job is units, compose, install wrappers, or the portable kit — not a standalone product UI/API:

- `ai-stack-kit` — AI stack kit templates (depth=deep)
- `nextgent-runtimes` — nextgent apps runtime compose only (depth=deep)
- `node-approval-grants` — Portable NODE component; source and manual-only installation, no production activation (depth=shallow)
- `node-health` — Portable NODE component; source and manual-only installation, no production activation (depth=shallow)
- `node-infra` — see card / inventory (depth=shallow)
- `node-kit-runtime` — Portable NODE component; source and manual-only installation, no production activation (depth=shallow)
- `node-services` — see card / inventory (depth=deep)
- `node-tunnel` — Portable NODE component; source and manual-only installation, no production activation (depth=shallow)
- `paperclip-approval-bridge` — Portable NODE component; source and manual-only installation, no production activation (depth=shallow)
- `supabase-local` — Local Supabase compose overlay. Private. No .env secrets or database volumes. (depth=deep)

### Documentation only

- `nextgent-assembly` — NEXT GENT source inventory, repository comparison, component extraction, and clean-platform migration workspace. (depth=metadata-only)
- `node-agents` — docs umbrella (depth=shallow)

`nextgent-docs` and `nextgent-site` are **empty** (listed below), so they are categorized as abandoned/unborn rather than documentation-only, even though the names sound like docs.

### Abandoned experiments (empty / unborn)

**26** GitHub repos have `isEmpty: true` (no default-branch SHA). None are archived on GitHub. This pass did not invent other 'abandoned' labels for stale product repos.

| Repo | Private | Description (GitHub) |
|---|---|---|
| `admin-login-` | yes |  |
| `ang-deploy` | yes |  |
| `ang-deploy-` | yes |  |
| `ang-drivers-` | yes |  |
| `Artist-` | no |  |
| `Book-it-` | yes |  |
| `check-mate` | yes |  |
| `circle-boats-` | yes |  |
| `cyber-check-` | no |  |
| `cybercheck-api-2-` | yes |  |
| `Dashboard-` | yes |  |
| `Faraharbor` | no |  |
| `GCR` | yes |  |
| `gcr-admin-` | yes |  |
| `GCR-Project` | yes |  |
| `Laravel-cybercheck` | yes |  |
| `launch-gcr` | yes |  |
| `launching-gcr-json` | no |  |
| `nextgent-docs` | yes | Architecture, deployment, hardware, developer, business, and patent-support material |
| `nextgent-site` | yes | The GhostOS/NEXT GENT website |
| `php-laravell-cybercheck-` | yes |  |
| `qr-menu` | no |  |
| `Reviews` | no |  |
| `Rides` | no |  |
| `Search` | yes |  |
| `trip-swipe-new-` | yes |  |

Thin portable stubs that are **not** empty (README + `install.sh` + `portable/`): `node-health`, `node-tunnel`, `node-approval-grants`, `paperclip-approval-bridge`. These were classified deployment-config.

### Multiple versions of the same function

Verified families (not exhaustive of the 156 'other' names):

1. **NODE itself:** live `Boxes` (`/home/steve/ang/src/boxes`, `fix/node-pwa-inframe-apps` `b43ec0f`) **is** the running process. `node-daemon` / `node-shell` are published splits and are **not** running. Archived extra Boxes clones live under `~/_archive/2026-11-09/`. `nextgent-box` and `nextgent-box-v1-with-jarvis*` are older consolidation repos (metadata/shallow only). `nextgent-shell` is a different, nearly empty project.
2. **OpenJarvis:** live `~/.openjarvis/src` → `openjarvis-node`. Stale public `OpenJarvis` (`21b53bc`). `nextgent-openjarvis` (`a6dcf84`). `Open-jarvis` exists on GitHub (Contents shows a full OpenJarvis-style tree) and was not the live checkout.
3. **Hermes:** live `~/.hermes/hermes-agent` (detached v0.22.2) with CultureReset + upstream remotes. Extra `~/ang/src/hermes` (older, upstream-only remote) was not archived today.
4. **Twenty:** source fork `twenty-CRM` (not running). Live official images in two compose projects, both referenced by NODE: `~/twenty` :3000 (CRM) and `~/nextgent/apps/twenty-runtime` :3020 (CRM 2). Additional `twentyhq/twenty` clones exist under `ang/apps` and `nextgent/apps`.
5. **n8n:** official image on :5678 (live). `nextgent-n8n` compose/workflows repo. Public source fork `n8n`. Helper `~/n8n-sandbox` running. Stopped `~/nextgent/n8n` left in place earlier today.
6. **Paperclip:** live npm install + `paperclipai.service`. Pin repo `paperclip-node`. Public fork `paperclip`. Thin `paperclip-approval-bridge`.
7. **OpenClaw:** live npm-global gateway. Pin repo `openclaw`. Workspace repo `openclaw-workspace` (live workspace has no remotes/commits). Tiny public `Open-claw` (LICENSE only).
8. **GCR APIs:** `gcr-api-clean` (leading candidate, local clone stale vs GitHub main), `gcr-api` (package `cybercheck-backend`), `gcr-api-v2` (looks like a clean copy). Many related empty or historical names (`GCR`, `GCR-Project`, `launch-gcr`, …).
9. **GCR frontends:** `gcr-unified` (local behind GitHub master) vs `gcr-unified-v2`; also `gcr-public`, `gcr-links`, `gcr-visitor-guide`, `live-gcr`, `gulf-coast-radar*`.
10. **Dashboards:** `Dashboards-users-` (business/user shell, conflicting local SHAs) vs `Admin-dashboard-main` (CyberCheck admin, unique commits on the repos clone). Plus `Plat-admin`, `Play-user`, `Universal-dashboard-`, empty `Dashboard-` / `admin-login-`.
11. **CyberCheck:** `cybercheck-orchestrator` has three divergent local HEADs. Other trees (`cybercheck-dashboard`, `cybercheck-backend`, `cybercheck-core`, `cybercheck-saas`, Laravel/php empty names, etc.) are a mixed historical family — only shallow/metadata this pass.

### Long tail ('other', metadata-only)

156 repos were grouped as family `other` by name (plus other families' metadata-only members). This includes many public forks (hyperframes, text-to-cad, Octop, xerj, ollama, …), historical GCR/marketing sites, and tools. **They were not deeply inspected.** Inventory.csv is the complete list. Do not assume they are unused or that they are running.

## (e) Open questions

These cannot be answered from this pass without guessing, a write/merge, a DB login, or Matt's decision:

1. What is the exact '44 named repos' list? It was not found on the MSI or in the research bundle. The derived 48-row table is a substitute.
2. CRM 2 (`:3020`, crm2 + nextgent-crm hostnames, NODE 'CRM 2' tile) is still referenced. When should it be retired? (Matt already said he does not want two Twenty stacks long-term.)
3. Is `~/n8n-sandbox` actually used by the live n8n instance? Still unproven.
4. Should GitHub **default branches** be moved? Boxes default is a stale September `claude/…` branch while all of today's docs work is on `fix/node-pwa-inframe-apps`. Several agent repos default to `main` while live pins are `local-history` / `approval-gateway-enforce` / `matt/main`.
5. Should `import/live-20261109` branches be merged to `main` (node-home, node-helpers, scrapers, second-brain, smsgw-relay, ai-chat-logger, openclaw-workspace, nextgent-runtimes, nextgent-n8n)?
6. OpenJarvis: commit the two dirty files (`loader.py`, `builder.py`) and the two `.bak` files? They are still only on disk.
7. Which SHA is production for `Dashboards-users-` and for `gcr-unified` / `gcr-api-clean` (local clones are behind or diverged; `gcr-api-clean` has 100+ branches)?
8. Which of the three `cybercheck-orchestrator` local HEADs is authoritative?
9. What unique commits exist on the skipped-archive clones (`ang/repos/Admin-dashboard-main`, `Dashboards-users-`, `Boxes`, `cybercheck-orchestrator`, plus two symlink-referenced repos)? They were left in place for that reason.
10. Is `/opt/node-approvals/app` the live approval gateway, and is it ahead of `CultureReset/approval-gateway`?
11. Is `node-voice` retired, or is its unit missing by accident?
12. Where should LiteLLM (`~/api-gateway/config.yaml`) and SearXNG (`~/searxng`) config live in git (redacted)? Not imported today.
13. GCR security items from today's research (public entity leak, RLS, 1h owner token, 500-char connect cap) were **not re-tested** in this pass (no DB login).
14. MiniDLNA, Odoo/POS, Pretix/tickets, Kamra, AppFlowy notes: frames/hostnames exist; Odoo/Pretix/Kamra containers were not in `docker ps` this pass. What is their intended state?
15. MagicMirror / ambient TV overview: vision vs reality. Not running here.
16. `boxes-sysmon` worktree is still ahead 1 / behind 4 of `fix/node-pwa-inframe-apps`. When should the System Monitor branch be rebased and published? (Not touched this pass.)
17. After 119 folders were moved to `~/_archive/2026-11-09/` (~3.6 GB), nothing was deleted — should the archive be compacted or left as a restore path?

## (f) Recommended consolidation decisions

Recommendations only. Nothing below has been executed in this pass. Top ten, then a short additional list.

1. **Do not switch the live `node-box.service` off `/home/steve/ang/src/boxes`** until the door/session/frame fix is tested. Keep `node-daemon` and `node-shell` as published splits for the future cutover.
2. **Treat `openjarvis-node` + `~/.openjarvis/src` as the only live OpenJarvis.** Freeze/archive `OpenJarvis` and `nextgent-openjarvis` after a uniqueness check. Commit the two dirty patches.
3. **Keep official Twenty images under `nextgent-runtimes`.** Leave `twenty-CRM` as a source fork. Do not remove CRM 2 until the NODE tile and both hostnames are retired (Matt).
4. **Treat official n8n on :5678 + `nextgent-n8n` as the operational pair.** Freeze the `n8n` source fork unless Matt wants to build from source. Decide the sandbox later.
5. **Merge (after review) the nine `import/live-20261109` branches** to their default branches so a fresh clone of `main` actually has today's live config/code. Until then, `main` is stale on those repos.
6. **Archive or mark the 26 empty GitHub repos** (they have no default SHA). This is the cleanest low-risk GitHub cleanup.
7. **Change or clearly document Boxes' GitHub default branch**, which is still `claude/linux-build-cleanup-dfpu0e` from 2026-09-29 while the live/docs branch is `fix/node-pwa-inframe-apps`.
8. **Reconcile the GCR API/frontend family against GitHub tips, not stale local clones**, then pick one API (`gcr-api-clean` is the candidate) and one unified frontend. Same for `Dashboards-users-` vs `Admin-dashboard-main`.
9. **Replace hardcoded `/home/steve` and tailnet hostnames** (174 findings in `portability.md`) with the manifest + `node-launch` contract in today's fix plan. This is the actual portability work; publishing repos alone does not make a fresh machine work.
10. **Leave the 119 archived folders in `~/_archive/2026-11-09/` as a restore path** until Matt says they can be deleted. Also leave the six skipped-archive clones until their unique commits are reviewed.

Additional:

- Keep upstream remotes on OpenJarvis and Hermes (already added).
- Keep `nextgent-vitals` (do not create `node-vitals`); keep `nextgent-jarvis` separate from OpenJarvis; do not reuse `nextgent-shell` for `node-shell`.
- Publish LiteLLM / SearXNG **config only** (redacted) in `node-infra` or a small config repo.
- Do not import Paperclip instance DBs, Supabase volumes, n8n data, or scraper/second-brain vaults.
- Investigate `/opt/node-approvals/app` vs `approval-gateway` before more approval-gateway work.
- Consider making live pins (`276eb44` on node-mcp-hub, `local-history` agent repos) the GitHub default so 'clone default branch' matches what runs.

## Full inventory

Every CultureReset GitHub repo as of this pass (293). `head_sha` is the **default branch** tip (empty if unborn). Local paths and live SHAs are in the CSV/JSON (including archived and work-copy paths). Running text is abbreviated here as yes/no/note.

| Name | Vis | Fork | Default branch | Default SHA | Default commit (CST) | Local? | Run | Category | Depth |
|---|---|---|---|---|---|---|---|---|---|
| `4you` | pub | yes | main | `45b48ba6baa4` | 2026-08-26 02:04 PM CST | yes | no | real-application | metadata-only |
| `A-knight` | pub | yes | main | `77cd7eb675ba` | 2026-08-25 03:15 PM CST | yes | no | real-application | metadata-only |
| `a-next-gent` | priv | no | main | `49ba8cb9ac06` | 2026-09-25 11:53 PM CST | no | no | real-application | metadata-only |
| `adk-go` | pub | yes | main | `5ff82280edeb` | 2026-09-22 02:17 PM CST | no | no | real-application | metadata-only |
| `admin-dashboard-` | pub | no | claude/taxi-gcr-api-dashboard-wzqc4y | `d22dae158ab8` | 2026-08-02 02:20 AM CST | yes | no | real-application | metadata-only |
| `Admin-dashboard-main` | pub | no | claude/cybercheck-modular-react-dashboard-7on41c | `5df87125247a` | 2026-11-02 12:57 PM CST | yes | no | real-application | deep |
| `admin-login-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `agency-agents` | pub | yes | main | `ad9264e309bd` | 2026-09-12 10:57 AM CST | yes | no | real-application | metadata-only |
| `agent-hub-ops` | priv | no | main | `8195f4b74c92` | 2026-10-31 07:21 PM CST | yes | no | real-application | metadata-only |
| `ai-chat-logger` | priv | no | main | `8b943286d5e9` | 2026-10-31 07:11 PM CST | yes | yes | real-application | deep |
| `ai-chatbot-api` | priv | no | main | `ffd875a5b34a` | 2026-04-05 08:07 PM CST | yes | no | real-application | metadata-only |
| `ai-stack-kit` | priv | no | main | `b11fd9a54c46` | 2026-11-07 08:10 PM CST | yes | no | deployment-config | deep |
| `android-cuttlefish` | pub | yes | main | `5a467328d69a` | 2026-09-22 12:51 PM CST | no | no | real-application | metadata-only |
| `ang-agent-` | priv | no | main | `aa10d306dfae` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `ang-cloud-` | priv | no | main | `decfa5a29fd1` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `ang-contract` | priv | no | main | `c0adfde65a6d` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `ang-core-` | priv | no | main | `0538876fa664` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `ang-deploy` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `ang-deploy-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `ang-drivers-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `API` | pub | no | claude/toast-website-rebuild-mk1l3f | `3d864688bff9` | 2026-08-29 07:47 PM CST | yes | no | real-application | metadata-only |
| `Api-layer-` | pub | no | main | `306884ae0d1b` | 2026-07-29 11:28 PM CST | yes | no | real-application | metadata-only |
| `API-layer-unified` | pub | no | main | `1810d79c10d0` | 2026-08-29 07:17 PM CST | yes | no | real-application | metadata-only |
| `App-build-` | pub | no | claude/modular-app-ecosystem-7xteeg | `18f7d52adceb` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `approval-gateway` | priv | no | main | `31fd4e74eab8` | 2026-10-31 04:55 PM CST | yes | no | real-application | deep |
| `appstore` | pub | yes | master | `150420845c41` | 2026-05-07 04:29 AM CST | yes | no | real-application | metadata-only |
| `Artist-` | pub | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `ax` | pub | yes | main | `d8ed0fe38bce` | 2026-09-19 09:27 PM CST | no | no | real-application | metadata-only |
| `blueprint` | pub | yes | develop | `da8bc148ca04` | 2026-09-17 11:40 AM CST | yes | no | real-application | metadata-only |
| `Boat-booker` | pub | no | claude/boat-booker-rebuild-77ntup | `ca877d008952` | 2026-08-30 02:30 PM CST | yes | no | real-application | metadata-only |
| `Book-it-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `booking-` | priv | no | main | `49c09b993342` | 2026-07-13 11:55 PM CST | yes | no | real-application | metadata-only |
| `bookish-goggles` | priv | no | claude/dealership-car-swap-design-6qbgpp | `72bc7818e64b` | 2026-07-27 05:46 PM CST | yes | no | real-application | metadata-only |
| `Booqable` | pub | no | claude/booqable-dashboard-rebuild-qzzmwt | `3568de542f4d` | 2026-08-30 01:31 PM CST | yes | no | real-application | metadata-only |
| `Boxes` | pub | no | claude/linux-build-cleanup-dfpu0e | `ae6e0ad07d2a` | 2026-09-29 03:28 PM CST | yes | yes | real-application | deep |
| `BrowserSkill` | pub | yes | main | `3da449e9ff2a` | 2026-09-22 08:44 AM CST | no | no | real-application | metadata-only |
| `chatbot` | priv | no | main | `c65f32509161` | 2026-05-13 02:04 AM CST | yes | no | real-application | metadata-only |
| `Check` | pub | no | main | `95fd3c9ef010` | 2026-10-06 10:08 PM CST | no | no | real-application | metadata-only |
| `check-mate` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `check-mate-` | priv | no | main | `d6a07d3bdaa3` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `check-mate-api-` | priv | no | main | `17dbe4e42919` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `Check-user-` | pub | no | main | `9cdde1ca0955` | 2026-08-29 07:20 PM CST | yes | no | real-application | metadata-only |
| `chisel` | pub | yes | master | `5ee6c74d60d9` | 2026-10-11 07:07 AM CST | no | yes | real-application | shallow |
| `chrome-extensions-samples` | pub | yes | main | `1822adce4a9d` | 2026-08-26 06:58 AM CST | yes | no | real-application | metadata-only |
| `circle-boats-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `circle-boats-main-` | pub | no | main | `0d41d59a862f` | 2026-05-13 02:53 PM CST | yes | no | real-application | metadata-only |
| `concord` | pub | yes | master | `0367f5b2166d` | 2026-09-18 03:56 PM CST | no | no | real-application | metadata-only |
| `context-mode` | pub | yes | main | `d7ecc232e887` | 2026-09-15 12:04 PM CST | yes | no | real-application | metadata-only |
| `core-home` | pub | yes | dev | `5b6d5e816ea9` | 2026-09-22 11:50 AM CST | no | no | real-application | metadata-only |
| `crosvm` | pub | yes | main | `f5035dc503d7` | 2026-09-22 03:46 PM CST | no | no | real-application | metadata-only |
| `cyber-admin` | priv | no | main | `186864b4f7aa` | 2026-04-23 11:31 PM CST | yes | no | real-application | metadata-only |
| `cyber-check-` | pub | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `cybercheck-api-2-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `cybercheck-api-database` | pub | no | main | `d64cd86ab969` | 2026-07-26 06:05 PM CST | no | no | real-application | metadata-only |
| `cybercheck-backend` | priv | no | main | `ba8ad9d07199` | 2026-03-02 01:33 AM CST | yes | no | real-application | shallow |
| `cybercheck-cloud` | pub | no | claude/modular-web-app-store-32zh3e | `27857dc84b6b` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `cybercheck-core` | pub | no | cybercheck-main | `21541598a620` | 2026-09-29 03:28 PM CST | yes | no | real-application | shallow |
| `cybercheck-dashboard` | pub | no | main | `dc3982943b31` | 2026-10-28 08:58 PM CST | yes | no | real-application | shallow |
| `cybercheck-links-` | pub | no | main | `32d7c85056ac` | 2026-07-26 06:05 PM CST | yes | no | real-application | metadata-only |
| `Cybercheck-llm` | pub | no | main | `d837b10ea7f7` | 2026-02-23 06:13 PM CST | yes | no | real-application | metadata-only |
| `cybercheck-login` | pub | no | main | `8b3d6dfc1b76` | 2026-08-01 08:25 PM CST | yes | no | real-application | metadata-only |
| `cybercheck-marketplace` | pub | no | cybercheck-main | `68cdbbe58e45` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `cybercheck-node` | pub | no | claude/review-codebase-zips-hck9hd | `9eb9bf4a923a` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `cybercheck-orchestrator` | pub | no | claude/admin-dashboard-repos-review-903d4i | `071c6841c36d` | 2026-08-26 08:28 PM CST | yes | no | real-application | deep |
| `cybercheck-saas` | priv | no | main | `0daa611869a6` | 2026-03-23 06:45 PM CST | yes | no | real-application | shallow |
| `cybercheck-web` | pub | no | claude/review-codebase-zips-hck9hd | `c316d8ec8fc5` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `Dashboard-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `Dashboards-users-` | pub | no | claude/dashboard-inventory-purposes-m5wtba | `aac903f97b0f` | 2026-10-30 03:07 AM CST | yes | no | real-application | deep |
| `Data` | pub | no | main | `b5487d6aafb7` | 2026-08-01 05:05 PM CST | yes | no | real-application | metadata-only |
| `demo-sales-` | priv | no | main | `2ba2ac7c8669` | 2026-05-01 05:24 PM CST | yes | no | real-application | metadata-only |
| `diagram-design` | pub | yes | main | `550fd66edff0` | 2026-10-16 01:42 PM CST | no | no | real-application | metadata-only |
| `ever-gauzy` | pub | yes | develop | `86c0be350be2` | 2026-09-15 07:01 AM CST | yes | no | real-application | metadata-only |
| `Faraharbor` | pub | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `Fareharbor` | pub | no | claude/fair-harbor-platform-map-l6h434 | `69a5e262749f` | 2026-08-29 08:49 PM CST | yes | no | real-application | metadata-only |
| `financial-services` | pub | yes | main | `574ed3624aeb` | 2026-09-21 03:10 PM CST | no | no | real-application | metadata-only |
| `foundations-cloudflare` | pub | yes | main | `4f84b3713350` | 2026-08-26 07:19 AM CST | yes | no | real-application | metadata-only |
| `frappe` | pub | yes | develop | `84986b7d2cad` | 2026-08-25 11:21 PM CST | yes | no | real-application | metadata-only |
| `Front-end-gcr-` | pub | no | main | `7aca1fbbdce3` | 2026-07-29 11:28 PM CST | yes | no | real-application | metadata-only |
| `gallery-links-` | pub | yes | main | `7376a27fd85f` | 2026-09-22 12:22 PM CST | no | no | real-application | metadata-only |
| `gar-front-end-data` | pub | no | main | `ed06803c4bb7` | 2026-05-27 12:29 AM CST | no | no | real-application | metadata-only |
| `gar-profiles-` | priv | no | main | `7f54b849b5c2` | 2026-04-18 06:51 PM CST | yes | no | real-application | metadata-only |
| `gbrain` | priv | no | matt/main | `12384420e701` | 2026-10-31 06:41 PM CST | no | yes | real-application | shallow |
| `GCR` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `gcr-admin` | priv | no | main | `8b6fd7d41c74` | 2026-06-04 01:12 PM CST | yes | no | real-application | shallow |
| `gcr-admin-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `gcr-api` | priv | no | main | `0dbafc63fafc` | 2026-05-25 05:40 PM CST | yes | no | real-application | shallow |
| `gcr-api-clean` | priv | no | main | `edb480069f21` | 2026-11-02 11:38 AM CST | yes | no | real-application | deep |
| `gcr-api-v2` | pub | no | main | `29eb8aa48f5f` | 2026-07-19 10:34 PM CST | yes | no | real-application | shallow |
| `GCR-CYBERCHECK-` | priv | no | main | `a76b381dab46` | 2026-04-19 02:59 PM CST | yes | no | real-application | metadata-only |
| `gcr-links` | pub | no | main | `ca8278c3d5b7` | 2026-05-22 07:38 AM CST | yes | no | real-application | shallow |
| `GCR-Project` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `gcr-public` | priv | no | main | `18dae1f43c9f` | 2026-05-21 11:52 PM CST | yes | no | real-application | shallow |
| `gcr-trip-swipe` | pub | no | main | `cf4311353cb9` | 2026-05-22 01:20 AM CST | yes | no | real-application | metadata-only |
| `gcr-trip-swipe-new` | pub | no | main | `30d721d08f1d` | 2026-05-29 03:02 AM CST | yes | no | real-application | metadata-only |
| `gcr-tripswipe` | priv | no | main | `89e12f043373` | 2026-05-22 07:38 AM CST | yes | no | real-application | metadata-only |
| `gcr-unified` | priv | no | master | `47f71ac7cd1b` | 2026-10-30 09:07 AM CST | yes | no | real-application | deep |
| `gcr-unified-v2` | pub | no | master | `4f47d3b18035` | 2026-09-29 03:28 PM CST | yes | no | real-application | shallow |
| `gcr-visitor-guide` | priv | no | main | `9f265b06d5f5` | 2026-10-11 01:06 AM CST | no | no | real-application | metadata-only |
| `gcr-voice-relay` | priv | no | main | `f439a5d02b2a` | 2026-10-16 01:34 PM CST | no | no | real-application | metadata-only |
| `ghost-ai` | pub | no | main | `5aaac3602ac0` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `ghost-concierge` | pub | no | master | `ab6c4b97b0af` | 2026-05-02 02:36 PM CST | yes | no | real-application | metadata-only |
| `ghost-os-fresh` | priv | no | main | `bd098c5aad75` | 2026-01-22 03:29 PM CST | yes | no | real-application | metadata-only |
| `ghost-os-platform` | priv | no | main | `dd20c8a8eb50` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `ghost-platform` | priv | no | main | `08421b4f2f04` | 2026-10-13 05:32 PM CST | no | no | real-application | metadata-only |
| `github-slideshow` | pub | no | main | `007a96d5665f` | 2021-01-25 08:45 AM CST | yes | no | real-application | metadata-only |
| `go-cloud` | pub | yes | master | `aa1fa83bf35a` | 2026-09-21 01:34 PM CST | no | no | real-application | metadata-only |
| `Google-business` | pub | no | claude/google-business-rebuild-mt2qs7 | `17cc4bba6afd` | 2026-08-30 08:24 AM CST | yes | no | real-application | metadata-only |
| `grok-build-plugin-cc` | pub | yes | main | `92b76a670713` | 2026-08-04 02:29 PM CST | yes | no | real-application | metadata-only |
| `gulf-coast-radar` | pub | no | main | `5b08c63abfa5` | 2026-05-13 12:41 PM CST | yes | no | real-application | metadata-only |
| `gulf-coast-radar-` | priv | no | main | `0c97444a4202` | 2026-03-30 12:20 PM CST | yes | no | real-application | metadata-only |
| `gvisor` | pub | yes | master | `252178ccf4d7` | 2026-09-22 05:55 PM CST | no | no | real-application | metadata-only |
| `Harness` | priv | no | claude/mcp-orchestrator-agents-sgrm1d | `ec10cc98bdc2` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `helpdesk` | pub | yes | develop | `3ab76d795fcb` | 2026-09-09 02:39 PM CST | yes | no | real-application | metadata-only |
| `hermes-agent` | priv | no | matt/main | `7be3cd948cbf` | 2026-10-31 06:38 PM CST | yes | no | real-application | deep |
| `hindsight` | pub | yes | main | `ccfe85b48519` | 2026-09-26 08:14 AM CST | no | no | real-application | metadata-only |
| `html-cybercheck` | priv | no | main | `7badfaf0f10f` | 2024-10-31 11:32 PM CST | yes | no | real-application | metadata-only |
| `html-starter` | priv | no | main | `1c62910cffe9` | 2024-11-01 12:05 AM CST | yes | no | real-application | metadata-only |
| `Huly-platform` | pub | yes | develop | `63e28dc96483` | 2026-08-27 07:24 AM CST | yes | no | real-application | metadata-only |
| `hyperframes` | pub | yes | main | `cc9e1bb33a43` | 2026-10-16 11:00 PM CST | no | no | real-application | metadata-only |
| `i-have-adhd` | pub | yes | main | `0a84de401019` | 2026-09-15 02:56 PM CST | yes | no | real-application | metadata-only |
| `jetpack-camera-app` | pub | yes | main | `3436434ceb59` | 2026-09-22 02:53 PM CST | no | no | real-application | metadata-only |
| `Just-do-it` | priv | no | build/foundation | `f15bbb37a0e6` | 2026-10-04 10:37 AM CST | no | no | real-application | metadata-only |
| `knowledge-work-plugins` | pub | yes | main | `33eeda1e8fd8` | 2026-10-15 08:20 PM CST | no | no | real-application | metadata-only |
| `L-y-f-t` | pub | no | claude/lift-platform-rebuild-t7oqfs | `6265587afe77` | 2026-08-30 03:58 AM CST | yes | no | real-application | metadata-only |
| `Landing-pages-` | pub | no | claude/link-tree-platform-xedfzi | `2ad372b51a30` | 2026-09-13 05:07 AM CST | yes | no | real-application | metadata-only |
| `Laravel-cybercheck` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `launch-gcr` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `LAUNCH-GCR-CYBERCHECK` | pub | no | main | `1de46f818af1` | 2026-04-19 06:46 PM CST | yes | no | real-application | metadata-only |
| `launching-GCR` | priv | no | main | `cd7ef57e045f` | 2026-05-22 07:38 AM CST | yes | no | real-application | metadata-only |
| `launching-gcr-json` | pub | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `launching-gcr-json-load` | pub | no | main | `95ad6cf9d1d0` | 2026-07-11 11:37 PM CST | yes | no | real-application | metadata-only |
| `launching-the-gcr` | pub | no | main | `7d7182917759` | 2026-06-01 11:42 AM CST | yes | no | real-application | metadata-only |
| `Linux-` | priv | no | claude/linux-ui-ux-frontend-99wmi6 | `12cf0e8802cc` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `Linux-CPU-X` | pub | yes | master | `53bce812d33d` | 2026-08-26 01:54 AM CST | yes | no | real-application | metadata-only |
| `LinuxCommandLibrary` | pub | yes | master | `a8206d4a9d90` | 2026-09-19 08:04 AM CST | yes | no | real-application | metadata-only |
| `litellm` | pub | yes | main | `07c722989560` | 2026-11-07 06:57 PM CST | no | yes | real-application | shallow |
| `live-gcr` | pub | no | main | `4f71a2a0cec9` | 2026-05-13 03:52 PM CST | yes | no | real-application | metadata-only |
| `live-gcr-` | priv | no | main | `7855975ec648` | 2026-05-13 04:22 PM CST | yes | no | real-application | metadata-only |
| `live-sales-pages-` | priv | no | main | `678b64b3de4b` | 2026-04-30 10:04 PM CST | yes | no | real-application | metadata-only |
| `lxc` | pub | yes | main | `4f1258197c15` | 2026-09-07 11:43 AM CST | yes | no | real-application | metadata-only |
| `MagicMirror` | pub | yes | master | `f138f5b690ce` | 2026-10-01 08:34 AM CST | no | no | real-application | shallow |
| `main-page-` | priv | no | main | `865025ff294a` | 2024-11-01 12:00 AM CST | yes | no | real-application | metadata-only |
| `marketplace` | pub | yes | main | `b4f12d92d616` | 2026-08-20 01:53 AM CST | yes | no | real-application | metadata-only |
| `Master-check` | pub | no | main | `41f708346bb6` | 2026-08-29 07:24 PM CST | yes | no | real-application | metadata-only |
| `meilisearch` | pub | yes | main | `21418db08cf7` | 2026-09-22 08:53 AM CST | no | no | real-application | metadata-only |
| `menu-builder` | priv | no | main | `29512fdb63a0` | 2026-06-01 02:38 PM CST | yes | no | real-application | metadata-only |
| `merchant-platform` | priv | no | main | `3731e6cb5196` | 2026-11-02 09:18 PM CST | no | no | real-application | metadata-only |
| `meridian` | pub | yes | main | `9b0d6bd4d4da` | 2026-09-22 05:07 PM CST | no | no | real-application | metadata-only |
| `mindfs` | pub | yes | main | `8f5bd3e8090e` | 2026-08-28 03:23 AM CST | yes | no | real-application | metadata-only |
| `moarchy` | pub | yes | main | `6c329b61a398` | 2026-09-19 08:51 AM CST | yes | no | real-application | metadata-only |
| `mobile-mcp` | pub | yes | main | `18d0e8c44ef4` | 2026-09-23 09:38 AM CST | no | no | real-application | metadata-only |
| `modular-mojo` | pub | yes | main | `1c9fd2e03331` | 2026-08-28 03:02 AM CST | yes | no | real-application | metadata-only |
| `n8n` | pub | yes | master | `a66221d24a36` | 2026-09-29 01:43 AM CST | no | note | real-application | shallow |
| `Next-gent` | priv | no | main | `fedc7e85b138` | 2026-09-29 03:28 PM CST | yes | no | real-application | metadata-only |
| `nextgent` | priv | no | main | `25b946e9b13a` | 2026-10-13 12:22 AM CST | no | no | real-application | metadata-only |
| `nextgent-agents` | priv | no | main | `42589667745d` | 2026-09-29 07:30 PM CST | yes | no | real-application | shallow |
| `nextgent-apps` | priv | no | main | `4941119bc80f` | 2026-10-10 11:45 PM CST | no | no | real-application | metadata-only |
| `nextgent-assembly` | priv | no | main | `18ad14cd690b` | 2026-10-28 01:44 PM CST | no | no | documentation-only | metadata-only |
| `nextgent-auth` | priv | no | main | `3fb280d47d69` | 2026-09-29 07:08 PM CST | yes | no | real-application | shallow |
| `nextgent-box` | priv | no | main | `9d4c089c107a` | 2026-10-08 07:05 AM CST | no | no | real-application | metadata-only |
| `nextgent-box-v1-with-jarvis` | priv | no | backup/2026-10-16-local | `c457dc216d84` | 2026-10-08 06:22 AM CST | no | no | real-application | metadata-only |
| `nextgent-box-v1-with-jarvis-backup` | priv | no | main | `c457dc216d84` | 2026-10-08 06:22 AM CST | no | no | real-application | metadata-only |
| `nextgent-chat` | priv | no | main | `cbd02c7819c6` | 2026-09-29 07:29 PM CST | yes | yes | real-application | deep |
| `nextgent-docs` | priv | no | — | `—` | empty | no | no | abandoned-experiment | metadata-only |
| `nextgent-engine-contract` | priv | no | main | `0f4fee2b686f` | 2026-10-31 07:21 PM CST | yes | no | real-application | metadata-only |
| `nextgent-flows` | priv | no | main | `c99e9d300dec` | 2026-09-27 04:34 PM CST | yes | no | real-application | metadata-only |
| `nextgent-flows-node` | priv | no | main | `51cf5c2002b5` | 2026-10-31 07:21 PM CST | yes | no | real-application | metadata-only |
| `nextgent-gateway` | priv | no | main | `57bc9fa38ebe` | 2026-10-31 07:20 PM CST | yes | no | real-application | metadata-only |
| `nextgent-ghost-image` | priv | no | main | `d8d390aa99aa` | 2026-09-29 03:30 PM CST | no | no | real-application | metadata-only |
| `nextgent-handoff` | priv | no | main | `72fded4eb29b` | 2026-09-29 07:08 PM CST | yes | no | real-application | shallow |
| `nextgent-jarvis` | priv | no | main | `f37d953598cc` | 2026-10-10 11:45 PM CST | yes | no | real-application | deep |
| `nextgent-llm-api` | priv | no | main | `61aaf977c2c0` | 2026-09-29 07:30 PM CST | yes | no | real-application | shallow |
| `nextgent-maps` | priv | no | main | `9637e5eec9bf` | 2026-09-29 03:28 PM CST | no | no | real-application | metadata-only |
| `nextgent-match` | priv | no | main | `bdb195bc056c` | 2026-09-29 07:08 PM CST | yes | no | real-application | shallow |
| `nextgent-modules` | priv | no | main | `a88500b473f2` | 2026-10-28 09:46 PM CST | no | no | real-application | metadata-only |
| `nextgent-n8n` | priv | no | main | `3dafa4b361ba` | 2026-10-31 07:21 PM CST | yes | yes | real-application | deep |
| `nextgent-openjarvis` | priv | no | main | `0c5649dd9311` | 2026-09-29 03:28 PM CST | yes | no | real-application | shallow |
| `nextgent-phone` | priv | no | main | `597c88da448e` | 2026-10-13 11:56 AM CST | yes | yes | real-application | deep |
| `nextgent-platform` | priv | no | main | `4971101d861b` | 2026-09-29 03:28 PM CST | no | no | real-application | metadata-only |
| `nextgent-quantum-warehouse` | priv | no | main | `a6da8ec431c8` | 2026-10-28 01:44 PM CST | no | no | real-application | metadata-only |
| `nextgent-relay` | priv | no | main | `3dfbd6653ce1` | 2026-09-29 07:08 PM CST | yes | no | real-application | shallow |
| `nextgent-runtimes` | priv | no | main | `8eedacce085e` | 2026-10-31 07:21 PM CST | yes | yes | deployment-config | deep |
| `nextgent-scout` | priv | no | main | `197d3ac8015f` | 2026-09-29 07:30 PM CST | yes | no | real-application | shallow |
| `nextgent-shell` | priv | no | main | `8ca8ea3a4873` | 2026-10-13 06:38 PM CST | no | no | real-application | shallow |
| `nextgent-site` | priv | no | — | `—` | empty | no | no | abandoned-experiment | metadata-only |
| `nextgent-skills` | priv | no | main | `156cfb2d0783` | 2026-10-31 07:21 PM CST | yes | no | real-application | metadata-only |
| `nextgent-store` | priv | no | main | `6ff0d66cacce` | 2026-09-29 07:08 PM CST | yes | no | real-application | shallow |
| `nextgent-survey` | priv | no | main | `2d871cd319fc` | 2026-09-27 04:34 PM CST | yes | no | real-application | shallow |
| `nextgent-tools` | priv | no | main | `2b499fab5692` | 2026-09-29 07:34 PM CST | yes | no | real-application | shallow |
| `nextgent-trailblaze` | priv | no | main | `df63d432fb5b` | 2026-09-19 07:44 PM CST | yes | no | real-application | metadata-only |
| `nextgent-vitals` | priv | no | main | `82b978ac5517` | 2026-09-27 04:34 PM CST | yes | no | real-application | deep |
| `nextgent-warehouse-memory` | priv | no | main | `3f50e9c50bf6` | 2026-10-10 11:45 PM CST | no | no | real-application | metadata-only |
| `nextgent-warehouse-operational` | priv | no | main | `ad0a1549845b` | 2026-10-10 11:45 PM CST | no | no | real-application | metadata-only |
| `nextgent-workspace-backup` | priv | no | backup/2026-10-16 | `cfce37d7cca3` | 2026-10-16 04:48 PM CST | no | no | real-application | metadata-only |
| `no-shoes-` | pub | no | main | `bd284e28301e` | 2026-02-26 07:19 PM CST | yes | no | real-application | metadata-only |
| `node-agents` | priv | no | main | `941bb96d7add` | 2026-11-02 09:08 PM CST | yes | no | documentation-only | shallow |
| `node-approval-grants` | priv | no | main | `704968b12a42` | 2026-11-07 07:34 PM CST | no | no | deployment-config | shallow |
| `node-daemon` | priv | no | main | `3f1531bb82a2` | 2026-11-09 03:47 PM CST | yes | note | real-application | deep |
| `node-door` | priv | no | main | `6eadeb07dddf` | 2026-10-31 04:55 PM CST | yes | yes | real-application | deep |
| `node-foundation` | priv | no | main | `a65c54f1e56a` | 2026-10-31 08:54 PM CST | yes | no | real-application | shallow |
| `node-health` | priv | no | main | `0b24b1bc4938` | 2026-11-07 07:39 PM CST | no | no | deployment-config | shallow |
| `node-helpers` | priv | no | main | `942f9fcdcbac` | 2026-10-31 07:20 PM CST | yes | yes | real-application | deep |
| `node-home` | priv | no | main | `4345f767a6f9` | 2026-11-07 07:43 PM CST | yes | yes | real-application | deep |
| `node-infra` | priv | no | main | `304b6e809f09` | 2026-10-31 07:47 PM CST | yes | no | deployment-config | shallow |
| `node-kit-runtime` | priv | no | main | `58f25912f254` | 2026-11-07 07:21 PM CST | no | no | deployment-config | shallow |
| `node-mcp-hub` | priv | no | main | `10f3c558f696` | 2026-10-31 04:56 PM CST | yes | yes | real-application | deep |
| `node-pccall` | priv | no | main | `788aee0372f7` | 2026-10-31 04:55 PM CST | yes | yes | real-application | deep |
| `node-services` | priv | no | main | `36afd54b28b0` | 2026-11-02 09:08 PM CST | yes | no | deployment-config | deep |
| `node-shell` | priv | no | main | `75f28f73adaf` | 2026-11-09 03:47 PM CST | yes | note | real-application | deep |
| `node-tunnel` | priv | no | main | `492d0dd2be9c` | 2026-11-07 07:34 PM CST | no | yes | deployment-config | shallow |
| `node-tv-session` | priv | no | main | `bb5fce7a6659` | 2026-11-09 01:57 PM CST | yes | yes | real-application | deep |
| `node-voice` | priv | no | main | `4dc89b50fa48` | 2026-10-31 04:56 PM CST | yes | no | real-application | deep |
| `obsidian-local-rest-api` | pub | yes | main | `532af3565925` | 2026-10-05 07:34 PM CST | no | no | real-application | metadata-only |
| `Octop` | pub | yes | main | `4f443babdc1e` | 2026-10-16 06:46 PM CST | no | no | real-application | metadata-only |
| `ollama` | pub | yes | main | `d63b702609c4` | 2026-11-07 06:36 PM CST | no | no | real-application | shallow |
| `omarchy` | pub | yes | quattro | `492b8837deea` | 2026-10-13 07:23 AM CST | no | no | real-application | metadata-only |
| `omarchy-jarvis` | pub | yes | main | `f136c25239ef` | 2026-10-13 02:26 PM CST | no | no | real-application | metadata-only |
| `Open` | priv | no | claude/firecrawl-mcp-scripting-me797j | `720ffdbc6f65` | 2026-09-20 01:17 AM CST | yes | no | real-application | metadata-only |
| `Open-claw` | pub | no | main | `f6dd362d39b8` | 2025-11-24 04:16 AM CST | yes | no | real-application | shallow |
| `open-dots` | pub | yes | main | `e8cf82b18dfc` | 2026-09-30 08:26 AM CST | no | no | real-application | metadata-only |
| `Open-jarvis` | pub | no | main | `21b53bc7046b` | 2026-09-15 12:17 AM CST | yes | no | real-application | shallow |
| `open-notebook` | pub | yes | main | `a0f6f3081ae0` | 2026-10-04 08:29 PM CST | no | no | real-application | metadata-only |
| `Open-v2` | pub | yes | main | `55658e664685` | 2026-09-18 10:26 AM CST | yes | no | real-application | metadata-only |
| `OpenBot` | pub | yes | main | `50c4bc5974f4` | 2026-09-21 09:56 PM CST | yes | no | real-application | metadata-only |
| `openclaw` | priv | no | matt/main | `6dd8b2c4517f` | 2026-10-31 07:05 PM CST | no | yes | real-application | shallow |
| `openclaw-workspace` | priv | no | main | `732f58ecc030` | 2026-10-31 04:56 PM CST | yes | no | real-application | deep |
| `OpenJarvis` | pub | yes | main | `21b53bc7046b` | 2026-09-15 12:17 AM CST | yes | no | real-application | shallow |
| `openjarvis-node` | priv | no | matt/main | `b33c95a4d6ad` | 2026-10-31 07:08 PM CST | yes | yes | real-application | deep |
| `openmuse` | pub | yes | main | `34b15bc80340` | 2026-09-26 01:45 PM CST | no | no | real-application | metadata-only |
| `OpenShell` | pub | yes | main | `eef8bec0c96b` | 2026-09-28 05:15 AM CST | no | no | real-application | metadata-only |
| `OpenStock` | pub | yes | main | `9677edd2097b` | 2026-09-21 02:01 PM CST | no | no | real-application | metadata-only |
| `opentable-mcp` | pub | yes | main | `5a9648b0467f` | 2026-09-20 11:00 PM CST | no | no | real-application | metadata-only |
| `oss-rebuild` | pub | yes | main | `56bbb6391a69` | 2026-09-22 09:15 AM CST | no | no | real-application | metadata-only |
| `osv.dev` | pub | yes | master | `c89af3385bf9` | 2026-09-22 06:13 PM CST | no | no | real-application | metadata-only |
| `ov-poc-standard` | pub | yes | master | `b27f9a80b2d3` | 2026-09-16 08:16 PM CST | yes | no | real-application | metadata-only |
| `paperclip` | pub | yes | master | `dc0a649e2735` | 2026-10-16 07:23 AM CST | no | no | real-application | shallow |
| `paperclip-approval-bridge` | priv | no | main | `6951473e46f6` | 2026-11-07 07:34 PM CST | no | no | deployment-config | shallow |
| `paperclip-node` | priv | no | matt/main | `220756f8b84f` | 2026-10-31 07:06 PM CST | yes | yes | real-application | deep |
| `papirus-icon-theme` | pub | yes | master | `bf539287ef5d` | 2026-09-21 06:43 AM CST | no | no | real-application | metadata-only |
| `Peek-pro` | pub | no | claude/peak-pro-dashboard-replica-qrvr4a | `000f2cffa937` | 2026-08-30 02:58 AM CST | yes | no | real-application | metadata-only |
| `php-laravell-cybercheck-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `pi` | pub | yes | main | `d7296c063b79` | 2026-09-15 10:54 AM CST | yes | no | real-application | metadata-only |
| `PI-Desktop` | pub | yes | main | `c6709b799f33` | 2026-09-22 01:45 PM CST | no | no | real-application | metadata-only |
| `Plat-admin` | priv | no | main | `c06c01bfaaab` | 2026-10-11 11:30 PM CST | no | no | real-application | metadata-only |
| `Play-user` | priv | no | main | `8f2ba505436a` | 2026-10-11 11:30 PM CST | no | no | real-application | metadata-only |
| `plugin-marketplace` | pub | yes | main | `817eea30476d` | 2026-08-04 05:12 PM CST | yes | no | real-application | metadata-only |
| `plugins` | pub | yes | main | `c1c0a3280222` | 2026-09-14 07:56 PM CST | yes | no | real-application | metadata-only |
| `Pms-abn-b` | pub | no | claude/airbnb-dashboard-friending-redesign-qdmrds | `950ca4f266ca` | 2026-08-30 01:49 AM CST | yes | no | real-application | metadata-only |
| `press` | pub | yes | develop | `548bb49b262a` | 2026-08-25 12:27 PM CST | yes | no | real-application | metadata-only |
| `python-tuf` | pub | yes | develop | `cc8a376f5f27` | 2026-09-15 02:07 AM CST | yes | no | real-application | metadata-only |
| `qr-menu` | pub | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `rakazo` | priv | no | main | `774c6a926ec9` | 2026-11-09 03:46 PM CST | yes | yes | real-application | deep |
| `ReserveTable` | pub | yes | main | `4f4a8df23f11` | 2024-04-03 02:54 PM CST | no | no | real-application | metadata-only |
| `restaurant-menu-editor` | priv | no | main | `74f00623cc32` | 2026-06-21 01:29 PM CST | yes | no | real-application | metadata-only |
| `restaurant-menu-editor-MAIN-` | pub | no | main | `69658e509cf7` | 2026-07-11 07:38 PM CST | yes | no | real-application | metadata-only |
| `Reviews` | pub | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `Rides` | pub | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `saas-cybercheck` | pub | no | main | `3ad522f78efa` | 2026-10-01 08:42 AM CST | yes | no | real-application | metadata-only |
| `sales-pages-` | pub | no | main | `a39f33f649f6` | 2026-05-01 01:14 PM CST | yes | no | real-application | metadata-only |
| `sam` | pub | yes | main | `91ce584a2ca2` | 2026-09-22 02:08 PM CST | no | no | real-application | metadata-only |
| `scientific-agent-skills` | pub | yes | main | `a1043ef544e3` | 2026-10-12 03:43 AM CST | no | no | real-application | metadata-only |
| `scrapers` | priv | no | main | `7e401d5e2136` | 2026-10-31 07:20 PM CST | yes | yes | real-application | deep |
| `Search` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `searxng` | pub | yes | master | `ac11e14c5edf` | 2026-11-06 01:51 PM CST | no | yes | real-application | shallow |
| `second-brain` | priv | no | main | `e4395a1680b4` | 2026-10-31 07:11 PM CST | yes | yes | real-application | deep |
| `silero-vad` | pub | yes | master | `867c2aa69264` | 2026-08-24 12:47 AM CST | yes | no | real-application | metadata-only |
| `skills` | pub | yes | main | `49dd158d1076` | 2026-10-09 04:56 AM CST | no | no | real-application | metadata-only |
| `sms-door` | priv | no | main | `0567aaf72089` | 2026-10-31 04:56 PM CST | yes | no | real-application | deep |
| `smsgw-relay` | priv | no | main | `6981c01536e5` | 2026-10-31 07:11 PM CST | yes | yes | real-application | deep |
| `Spot-on` | pub | no | claude/spot-on-dashboard-recreation-wki85d | `4a7f934cac74` | 2026-08-30 02:07 PM CST | yes | no | real-application | metadata-only |
| `supabase-local` | priv | no | main | `3af12d040c24` | 2026-11-09 03:46 PM CST | yes | yes | deployment-config | deep |
| `superpowers` | pub | yes | main | `b36e0829c6d0` | 2026-08-12 10:53 AM CST | yes | no | real-application | metadata-only |
| `Test-links-` | pub | no | main | `d0368e50ad6a` | 2026-07-26 04:54 PM CST | yes | no | real-application | metadata-only |
| `text-to-cad` | pub | yes | main | `24573128ceaa` | 2026-10-11 09:10 AM CST | no | no | real-application | metadata-only |
| `the-ghost-ai-` | pub | no | main | `044a667a4873` | 2026-01-24 04:50 AM CST | yes | no | real-application | metadata-only |
| `Toast` | pub | no | claude/toast-website-rebuild-mk1l3f | `fd2cfc760f68` | 2026-08-29 08:15 PM CST | yes | no | real-application | metadata-only |
| `Tourmind-Booking-Skills` | pub | yes | main | `a9a25bdb2f48` | 2026-10-09 09:19 PM CST | no | no | real-application | metadata-only |
| `trip-swipe-` | priv | no | main | `68b9d0cc152f` | 2026-05-10 11:23 PM CST | yes | no | real-application | metadata-only |
| `trip-swipe-live` | pub | no | main | `99095719a48b` | 2026-06-04 12:28 PM CST | yes | no | real-application | metadata-only |
| `trip-swipe-new-` | priv | no | — | `—` | empty | yes | no | abandoned-experiment | metadata-only |
| `twenty-CRM` | pub | yes | main | `f62ff4d3e482` | 2026-08-28 11:28 AM CST | yes | no | real-application | deep |
| `U-b-e-r` | pub | no | claude/uber-prototype-rebuild-wvt994 | `8fd7e40cfe1c` | 2026-08-30 12:18 AM CST | yes | no | real-application | metadata-only |
| `univer` | pub | yes | dev | `1defaf4ab67a` | 2026-09-24 04:56 AM CST | no | no | real-application | metadata-only |
| `Universal-dashboard-` | pub | no | main | `06d050257997` | 2026-10-01 11:06 AM CST | yes | no | real-application | metadata-only |
| `user-owned-environment-briefing` | priv | no | main | `d909206c356f` | 2026-09-08 08:27 AM CST | yes | no | real-application | metadata-only |
| `vercel-ai-gateway-embeddings-demo` | pub | no | main | `f0e7611fe38d` | 2026-04-04 04:47 AM CST | yes | no | real-application | metadata-only |
| `voyant-travel` | pub | yes | master | `1d348c8b694c` | 2026-03-10 01:07 AM CST | yes | no | real-application | metadata-only |
| `Vrbo` | pub | no | claude/vrbo-platform-replica-4nsvps | `743c9f1a2d5f` | 2026-08-30 02:54 AM CST | yes | no | real-application | metadata-only |
| `wasmtime` | pub | yes | main | `29b18af5393b` | 2026-09-15 01:44 PM CST | yes | no | real-application | metadata-only |
| `wxt-chrome` | pub | yes | main | `9b46da884160` | 2026-08-21 06:18 PM CST | yes | no | real-application | metadata-only |
| `X` | pub | no | claude/grok-bot-rebuild-034cg5 | `d7a5d434d550` | 2026-08-30 09:44 PM CST | yes | no | real-application | metadata-only |
| `xerj` | pub | yes | main | `928e00426c48` | 2026-10-16 05:32 PM CST | no | no | real-application | metadata-only |
| `Yelp` | pub | no | claude/yelp-business-dashboard-rebuild-cmah8e | `a9418d9fb339` | 2026-08-30 02:04 AM CST | yes | no | real-application | metadata-only |

Machine-readable copies with full local path lists, local SHAs, fork parents, descriptions, and running evidence:

- [inventory.csv](./inventory.csv)
- [inventory.json](./inventory.json)

## Appendix: what this pass deliberately did not change

No systemd units started or stopped; no Docker containers removed; no git remotes added; no force-push; no default-branch changes; no archive deletions; `boxes-sysmon` unread except a read-only `status`/`log -1`. The only intended follow-up write is committing this directory to `CultureReset/Boxes` on `fix/node-pwa-inframe-apps`.

