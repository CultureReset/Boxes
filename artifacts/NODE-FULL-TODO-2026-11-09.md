# NODE full to-do — 2026-11-09

**Status:** RECONSTRUCTED. The original ~213-line to-do list was not found on this box or on steve-MS-7C02. Items below are the still-open work from `/workspace/artifacts/full-state-research-2026-11-09.md` §9 and `/home/steve/artifacts/sprawl-audit-20261109/` (especially `execution-20261109.md` “Matt still needs”, `plan.md`, and `portability.md`).

**As-of:** 2026-11-09 ~3:50 PM CST (America/Chicago), after the approved sprawl sequence completed. No item below was applied by the research pass. Do not restart running services, do not touch `/home/steve/ang/src/boxes-sysmon`, and do not delete data volumes unless Matt says so in a later instruction.

Priority: **P0** user-visible / security, **P1** product decisions Matt must make, **P2** follow-through and portability, **P3** cleanup.

---

## P0 — User-visible and security

### T1. Door cookie / frame host split
- [ ] Serve kiosk frames on `http://127.0.0.1:<localPort>` **and** add `http://127.0.0.1:7770` to `FRAME_ANCESTORS` in `daemon/src/frameproxy.ts`.
- [ ] Alternative (also acceptable): point the kiosk at `https://steve-ms-7c02.tail1af4f2.ts.net:14443/?tv=1` and issue `door_session` with `SameSite=None; Secure`.
- [ ] Stop treating Tailscale Serve `X-Forwarded-Proto` as “signed out” for a user who already has a loopback `door_session` (`daemon/src/doorauth.ts`).
- [ ] After the **daemon** change is in `daemon/dist`, restart `node-box.service` once (coordinate; do not bounce it twice). Then reload the kiosk.
- **Blocked on:** code change + explicit restart approval. Live daemon at last check was still the 1:46 PM CST process.

### T2. Reload the kiosk for the already-landed CSS/JS
- [ ] F5 (or equivalent) on the DISPLAY=:0 Chrome kiosk so `5b7e39c` is what is on screen.
- [ ] Confirm with a pointer present: cursor visible; zoom at 100% unless Settings scale says otherwise.
- **Note:** no `node-box` restart is required for this item.

### T3. Give Access-blocked tiles a private Tailscale servePort
- [ ] Assign Rakazo (`frames.json` slug `rakazo`, today `servePort: 0`) a private serve port and stop framing `https://rakazo.voicecommandapi.com/` through Cloudflare Access (`X-Frame-Options: DENY`).
- [ ] If CRM 2 is kept, do the same for slug `crm2` (today `servePort: 0`).
- [ ] Do not `docker compose down -v` on Rakazo.

### T4. Public GCR credential leak
- [ ] On production `gcr-api-clean` (`edb480069f21a881ebaf6cebe6cdc3cb621e5481`), stop `GET /api/gcr/entity/:slug` from using `select('*')`.
- [ ] Strip at least `menu_pin`, `ical_token`, and pin-lock fields (`menu_pin_fail_count`).
- [ ] Re-check the live route (keys only; do not record values).
- **Note:** draft PR 113 does **not** include this fix.

### T5. NODE platform connect
- [ ] Raise or remove the 500-character token cap (`daemon/src/index.ts` ~85), **or** (preferred) implement the drafted revocable, slug-scoped device token.
- [ ] Store and use a refresh token if continuing to use Supabase Auth JWTs (today NODE never refreshes; access token ~1h).
- [ ] Add a Settings connect form so `This box is not connected to a business yet. Open Settings and sign in.` is not a dead end.
- [ ] Until PR 113 is deployed: call `/api/dashboard/menu-items` (not `/api/dashboard/menu`); do not call missing `/api/health`.
- [ ] Do not paste impersonation or MCP keys into NODE.
- [ ] Write `~/.config/nodeos/platform.json` (mode 0600) only **after** a token strategy exists. File is missing today.

### T6. Gulf Coast Radar RLS
- [ ] Matt decision only: whether to enable RLS on the 128 public tables where it is off (project `adpnhipmdefutkzzltbs`). Tables known off include `entity_photos`, `menu_items`, `gcr_menu_items`, `menu_details`, `menu_sections`, `menu_sub_sections`, `photos`.
- [ ] High blast radius — plan, do not flip globally without a review.

---

## P1 — Decisions only Matt can make

### T7. Keep or retire CRM 2
- [ ] Decide the fate of `/home/steve/nextgent/apps/twenty-runtime` on `:3020`.
- [ ] It **is** referenced: NODE slug `crm2`, `webapps.json` “CRM 2”, cloudflared `crm2.voicecommandapi.com` and `nextgent-crm.voicecommandapi.com` → frame `17813`, `~/node-home/apps.json` ids `crm2` and `nextgent-crm`.
- [ ] If retiring: remove those tiles, both hostnames, and frame 17813 **first**, then stop that compose stack. Do not delete volumes until confirmed.
- [ ] Do not remove the `:3000` stack (`/home/steve/twenty`); MCP hub ExecStartPre depends on it.

### T8. n8n companions
- [ ] Decide whether `~/n8n-sandbox` is actually used (live `n8n` has no sandbox env; use is ambiguous — left running).
- [ ] Decide what to do with unused `/home/steve/nextgent/n8n` (would be `:5680`, has a `data/` dir, not running). Do not delete data casually.

### T9. Merge / deploy gcr-api-clean PR 113
- [ ] Review and merge https://github.com/CultureReset/gcr-api-clean/pull/113 (draft; head `3352af8601840d2b1dde3dd996885a7fe073cc29`).
- [ ] Deploy separately from T4 (leak) and T6 (RLS).
- [ ] Confirm production `GET /api/health` becomes 200 after deploy (today 404).

### T10. Token strategy
- [ ] Choose device token vs raised cap + refresh (see T5).
- [ ] Hangout example slug/businessName exists only as a draft in the specialist report — not a live config.

### T11. System monitor
- [ ] Decide whether to land or rebase unpushed `494941fce23345c55c50e7de933ea9fc877b687d` (`feat/node-system-monitor`) onto `fix/node-pwa-inframe-apps` (it is already behind `5b7e39c`).
- [ ] Do **not** run it from `/home/steve/ang/src/boxes-sysmon` against the live `node-box` unit.
- [ ] Do not touch that worktree from other tasks.

### T12. OpenJarvis dirty patches
- [ ] Decide whether to commit or discard the four uncommitted files on `~/.openjarvis/src` (`loader.py`, `builder.py`, and two `.bak-20261021` files) onto `CultureReset/openjarvis-node` branch `matt/local-20261109`.
- [ ] The published pin `5e5f5ef` is **94 commits behind** upstream `open-jarvis/OpenJarvis` `main`. Rebase/cherry-pick policy is Matt’s.

### T13. Boxes as glue only
- [ ] Later, slim `CultureReset/Boxes` to `box/`, `apps/`, `services/`, `config/`, `spec/` once consumers point at `node-daemon` and `node-shell`.
- [ ] Do not retarget `node-box.service` until that cutover is explicit. Live path stays `/home/steve/ang/src/boxes`.

### T14. TV vs desktop display
- [ ] Keep `tv: true` + kiosk on `:0` while `node-box` uses `DISPLAY=:10.0`, **or** point the daemon at `:0` / turn TV mode off for the desktop monitor.

### T15. Orchestrator vision
- [ ] Whether Paperclip becomes the sole agent/task orchestrator, and what happens to n8n, OpenClaw, GBrain, and Rakazo as control planes. Today they are separate framed tiles.

### T16. Archive deletion / leftover duplicates
- [ ] Optionally delete `/home/steve/_archive/2026-11-09/` later to actually free ~4.1G (currently a move, not a delete).
- [ ] Left in place and still needing a decision: `ang/repos/Admin-dashboard-main` (11 unique commits), `ang/repos/Dashboards-users-` (HEAD differs), `ang/repos/cybercheck-orchestrator` (HEAD differs), symlink-uncertain `cybercheck-api-database` and `gar-front-end-data`, plus `ang/src/openclaw-upstream` (3.4G), `twenty-CRM` (1.9G), `agent-catalog`, dirty `ang/repos` trees, stale `ang/src/Open-jarvis`, extra Hermes `ang/src/hermes`.

---

## P2 — Follow-through and portability

### T17. Replace hardcoded paths
- [ ] Work through the 174 `break` rows in `portability.md` (systemd units first: use `%h` / `${HOME}`, drop literal nvm version paths).
- [ ] Parameterize NODE `frames.json`, `webapps.json`, `services-control.json` (frame/serve ports, icon dir, tailnet URLs).
- [ ] Parameterize cloudflared + door configs (`${TAILNET_HOSTNAME}`, `${TAILSCALE_IP}`, frame ports).
- [ ] Parameterize MCP `registry.yaml` secret-file paths and health URLs (do not hardcode `127.0.0.1:3000/healthz`).
- [ ] Replace `/hdd/...` in scrapers and second-brain with `${DATA_ROOT}`.
- [ ] Replace `/opt/node-approvals` with `${APPROVAL_APP_ROOT}`.
- [ ] Longer term: adopt `nodeos.manifest.json` (research §7.2) so a freshly cloned repo starts without manual path edits.

### T18. Reconcile serve-port discrepancies
- [ ] Run and record `tailscale serve status` (hostnames/ports only).
- [ ] Resolve `frames.json` vs `services-control.json` disagreements: Uptime Kuma `27443` vs `7443`; Navidrome `24443` vs `4443`; llama-swap `33443` vs `13443`; Crawl4AI `32443` vs `12443`.
- [ ] Identify Cloudflare hostnames for `config.yml` origins `:7700`, `:7710`, `:7690`.
- [ ] Confirm the exact ingress that maps `api.voicecommandapi.com` → LiteLLM `:4000`.

### T19. Pictures / business gallery
- [ ] Once connected (T5), add a business gallery screen on `GET /api/gallery/:slug`.
- [ ] Keep `~/Pictures` as the personal album (49 files / 36 images today).
- [ ] Offline photo backup remains `/home/steve/ang/var/backup/photos` (19,239 images, 7.2G) — a subset of CyberCheck’s 77,497 `entity_photos`.

### T20. OpenJarvis sidebar one-liner
- [ ] In `~/.openjarvis/src/frontend/src/lib/store.ts:292`, default `sidebarOpen` from `matchMedia("(max-width: 768px)")` (or equivalent) instead of always `true`.
- [ ] Publish the patch to `openjarvis-node` only after T12.

### T21. Rebase leftover Boxes / dashboard branches
- [ ] `fix/ubuntu-node-support` local `e7164c2` vs remote `9d32c04` (ahead 1, behind 8) — rebase/reconcile before any push.
- [ ] Optional: `Dashboards-users-` local `8f6199a` vs remote `aac903f` — reconcile, no force-push without a look.

### T22. Publish remaining install-only / config-only sources
- [ ] LiteLLM config (`/home/steve/api-gateway`) — redacted config only, never keys; plan suggested `node-infra` or a small `node-litellm-config`.
- [ ] SearXNG and Uptime Kuma compose/config overlays (running images have no git tree).
- [ ] Compare `/opt/node-approvals/app` with `CultureReset/node-approval-grants` / `approval-gateway` and publish source, not the `/opt` deploy.
- [ ] `paperclip-node` remains skipped until the existing 95 gitleaks findings are triaged.
- [ ] sudo-runner (`/usr/local/lib/sudo-runner`) source publication — TODO (not imported this round).

### T23. Health / dependency contract
- [ ] Stop hardcoding MCP ExecStartPre to Twenty `:3000`, LiteLLM `:4000`, and Paperclip `:3100`; read health URLs from a manifest.
- [ ] Keep Twenty `:3000` up for as long as the current ExecStartPre remains (starting `:3000` is what unblocked `:7790` today).

---

## P3 — Cleanup and hygiene

### T24. Secret-scan hygiene (ongoing)
- [ ] gitleaks (or equivalent) before every future push.
- [ ] Keep ignore rules for `.env`, `*.pem`, keys, `.n8n`, docker volumes, `_backups/`, `*.bak*`, `node_modules`, `.venv`, data dirs, Chrome profiles, `chisel-users.json`, enroll-link, paylink previews.
- [ ] Never commit `~/.config/nodeos/door/enroll-link` or paylink preview files.

### T25. Documentation already produced (no action except “know where it is”)
- [x] Sprawl inventory, plan, portability, execution log: `~/artifacts/sprawl-audit-20261109/`
- [x] Full-state research: `/workspace/artifacts/full-state-research-2026-11-09.md` (box)
- [x] Four new private repos + import branches + CultureReset remotes on OpenJarvis/Hermes (see bootstrap §2)
- [x] 119 duplicate trees relocated to `~/_archive/2026-11-09/`
- [ ] This to-do and the bootstrap prompt published under `CultureReset/Boxes` `artifacts/` (this commit)

### T26. Services that are installed but idle (FYI, not a start order)
- [ ] Hermes checkout exists (`d923a5e`); no unit, not running.
- [ ] `node-vitals` (`CultureReset/nextgent-vitals` @ `82b978a`) not running; no unit.
- [ ] `sms-door.service`, `cloudflared-litellm.service`, `node-health.service`, `ollama.service`, AppFlowy / Odoo / Pretix / Kamra stacks exited.
- [ ] Do not start these from this list without a separate request.

---

## Suggested order (when Matt says go)

1. T2 (kiosk reload) — no restart, immediate visual check.
2. T1 + T3 (session + Rakazo/CRM2 serve ports) — needs a daemon change and one coordinated `node-box` restart.
3. T4 (public leak) — independent of NODE, high severity.
4. T5 + T9 + T10 (connect/token + PR 113) — then maybe write `platform.json`.
5. T7 / T8 (duplicate stacks) — only after references are removed.
6. T12 + T20 (OpenJarvis patches).
7. T17 + T18 + T23 (portability / serve-port truth / health contract).
8. T11, T13, T14, T15, T16, T21, T22 — when chosen.

---

## Explicitly out of scope until re-approved

- Restarting `node-box.service` without the T1 daemon change already in `daemon/dist`.
- `docker compose down -v` on Rakazo, Twenty, Supabase, or n8n.
- Stopping the `:3020` Twenty stack or `n8n-sandbox` while references/ambiguity remain.
- Touching `boxes-sysmon`.
- Force-pushing any CultureReset repo.
- Deleting `~/_archive/2026-11-09/` or large third-party trees.
- Enabling GCR RLS or deploying PR 113 without Matt’s go.
