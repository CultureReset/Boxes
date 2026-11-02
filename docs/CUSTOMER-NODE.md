# Customer NODE

A customer NODE is the same NODE (daemon on :7770 plus the React shell), run as a
container for one customer business on the platform owner's machine. It is the
customer's own computer; the platform owner only hosts it. Customers are strangers
to each other and to the host, so everything here is built around keeping them apart.

| Piece | Where | Per customer |
| --- | --- | --- |
| `node` (daemon + shell) | `customer/Dockerfile` | one container, no route out |
| `edge` (inbound forwarder + allow-list proxy) | `customer/edge/` | one container |
| `desktop` (virtual display, Chromium, noVNC) | `customer/desktop/`, profile `desktop` | optional, **untested** |
| compose project `nodeos-<slug>` | `customer/docker-compose.yml` | one project, own networks and volumes |
| provisioning | `scripts/provision-customer.sh` | writes `customers/<slug>/` |

## Provision

Dry run is the default. Nothing is written or started without `--apply`.

```
scripts/provision-customer.sh harbor-coffee \
  --owner-name "Dana Reyes" --business-name "Harbor Coffee" \
  --paperclip-url http://<paperclip-host>:3100/api \
  --paperclip-company <company-uuid> --paperclip-lead <lead-agent-uuid> \
  --api-url https://<gcr-api-clean-host>            # plan only

scripts/provision-customer.sh harbor-coffee ... --apply              # write files, start
scripts/provision-customer.sh harbor-coffee ... --apply --desktop    # also the desktop sidecar
sudo customers/harbor-coffee/firewall.rules.sh                       # once, as root (see Isolation)
```

Secrets are never on the command line and never printed. Supply the business token with
`--secret-file api_token=/path` or `--secret-stdin api_token`. `app_token` (the bearer
token a future door presents) and `vnc_password` are generated if absent. Re-running with
the same inputs changes nothing and keeps the subnets, ports and secrets chosen the first time.

```
scripts/provision-customer.sh --deprovision harbor-coffee --apply
    stops and removes containers and networks; KEEPS the volumes and customers/harbor-coffee/
scripts/provision-customer.sh --deprovision harbor-coffee --apply --purge --confirm-slug harbor-coffee
    also deletes the volumes (node data, browser profile) and the customer's files; run as root
    so the firewall rules are unloaded first
```

`customers/` is git-ignored: it holds secrets.

## Customer mode in the daemon

`NODEOS_MODE=customer` (the image sets it). Home-machine mode is unchanged and is still
the default when `NODEOS_MODE` is unset.

- **Refuses to start** (exit 78, a plain message naming the variables, never their values)
  unless `NODEOS_OWNER_NAME`, `NODEOS_BUSINESS_NAME`, `NODEOS_SLUG`, `PAPERCLIP_API_URL`,
  `PAPERCLIP_COMPANY_ID` and `PAPERCLIP_LEAD_ID` are set; the two ids must be UUIDs and must
  not be the platform owner's own company or lead. A typo in `NODEOS_MODE` is also an error
  rather than a silent fall back to home mode.
- **Issue text** says "From <owner> (<business>) via ..." instead of the hard-coded owner
  name. The same name labels the user in "send this chat to Paperclip". Names are flattened
  to one line before they reach an agent.
- **No owner defaults.** The owner's name, Paperclip company and lead ids, tailnet host
  names and upload path live only in `daemon/src/homeDefaults.ts`, used by home mode alone.
  The image build replaces the compiled copy with empty strings and fails if any of those
  values is still in `daemon/dist`.
- **Hardware is inert** (also with `NODEOS_HARDWARE=0` alone): adb/scrcpy and the Android
  provider, window streaming (`xwd`), window control, power and power profiles, `systemctl`
  services and the service-control list, the health file, frame proxies, battery from
  `/sys`, local speakers, the software store, and file access outside the home directory.
  Each returns "Not available in hosted mode"; `/api/status` carries a `hosted` object.
  Demo data is off in hosted mode, so a customer never sees canned state as their own.
- `NODEOS_API_TOKEN_FILE` is read like `NODEOS_API_TOKEN`; the platform token arrives as a
  mounted secret file.

## Isolation: what a customer container can and cannot reach

Compose cannot say "this container may not reach the LAN", so isolation has two layers.

**Structural (compose).** `node` is attached to one network, `inner`, which is
`internal: true`: no route to the host, the LAN, the tailnet or the internet, and name
resolution only for its project siblings. Its only exit is an HTTP proxy in `edge`, which
refuses every host not in `EDGE_ALLOW` (Paperclip and the platform API, plus anything added
with `--allow`) and CONNECTs only to port 443. Containers run as non-root, with all
capabilities dropped, `no-new-privileges`, a read-only root filesystem, tmpfs for `/tmp`, and
named volumes for data. Per-service cpu, memory, pids and log-size caps. No docker socket,
no privileged, no host network or PID, no devices (no USB, no GPU), no bind mounts of host
paths except the customer's own secret files. Ports are published on `127.0.0.1` only.

**Host firewall (generated, you load it).** `edge` and `desktop` sit on their own fixed
subnets (`10.77.N.0/24`, `10.78.N.0/24`). `customers/<slug>/firewall.rules.sh` adds
`DOCKER-USER` and `INPUT` rules that drop traffic from those subnets to RFC 1918, tailnet
(100.64/10), link-local and loopback ranges and to the host itself. Only the edge subnet gets
one exception: the Paperclip address and port, and only when Paperclip is given as an IPv4
address. The desktop subnet never does.

| | Can reach | Cannot reach |
| --- | --- | --- |
| `node` | `edge`, `desktop` (project siblings) | host, LAN, tailnet, internet, other customers, other projects' networks |
| `edge` | hosts in `EDGE_ALLOW` | everything else (proxy); LAN and host (firewall) |
| `desktop` | the internet, `node` | LAN, tailnet, host, other customers (firewall) |
| the customer | `127.0.0.1:<NODE_HOST_PORT>` via whatever door you put in front | anything else on the host |

Limits you should know about:

- **The firewall layer is only as good as you load it.** Without it the edge and desktop
  containers could reach the LAN. Docker also bypasses `ufw`; use the generated `DOCKER-USER` rules.
- **Paperclip has no per-company authentication as the daemon calls it.** `paperclip.ts` sends
  no credential; the company id is in the URL. Anything that can reach Paperclip's port can
  read and write any company. The edge allow-list is per host, not per path. Until Paperclip
  (or a proxy in front of it that pins the company per customer) authenticates, a customer
  who can run code in the node container can reach another company's issues. This is the
  largest remaining isolation gap.
- `/api` on a customer node requires either a door session or the bearer `app_token`.
  Without a door, only that token works. Loopback inside the container is trusted (the healthcheck).
- Secret files are mode 0444 inside a 0700 directory, because the container user is not the
  host user and file secrets keep the host mode. Other host users cannot traverse the directory; root can.
- The desktop's Chromium runs with `--no-sandbox` (Docker's default seccomp blocks its user
  namespaces). The container is the sandbox: non-root, no capabilities, read-only, no LAN route.
- VNC passwords are effectively 8 characters. noVNC is on loopback only and needs a door in front of it.
- Base images are pinned by tag, not digest.

## Verified and not verified

Verified here: daemon and shell typecheck; the shell and daemon build; the daemon tests (customer
mode refuses to start, no owner UUID or name in issue text, hardware modules inert and running no
host command, home mode unchanged); the daemon started in customer mode on a free port and
answered the status route, the Dockerfile healthcheck command, and the hosted responses; the
Dockerfile's `npm ci`, build, test and owner-value scrub steps replayed in a clean directory;
`docker compose config` on the template and on a generated env file; the provision script's dry
run, apply (with a stand-in `docker`), idempotence, deprovision, purge and refusals; the edge
entrypoint's allow-list rendering; Node's `NODE_USE_ENV_PROXY` sending requests through the proxy.

**Not verified: any Docker build or run.** The Docker client was present but there was no Docker
daemon in this environment. So the images have never been built, the containers never started, the
`internal` network and proxy path never exercised, the generated iptables rules never loaded, and
**the `desktop` profile (Xvfb, openbox, Chromium, x11vnc, noVNC) has never been run at all.**
Treat every file under `customer/edge/` and `customer/desktop/` as a first draft.

## NOT done

- **A node-door in front of each customer.** Nothing yet signs the customer's browser in to their
  node. The shell cannot be used from a browser until one exists; today `/api` answers only to the
  bearer `app_token`. The same door is what should expose the desktop's noVNC.
- **Creating the customer's Paperclip company and agents.** The script takes the company and lead
  ids as input; it does not create either, nor seed agents.
- **Issuing the gcr-api-clean business token** (`business_mcp_tokens` / session token). Supply it
  as the `api_token` secret. Without it the node runs with no platform connection.
- **Agent wiring to the desktop.** Chromium DevTools is on `desktop:9223` inside the project
  network (send `Host: localhost`; it is unauthenticated). Nothing connects an agent to it, and
  Paperclip agents run on the host, outside this project.
- **Backups** of `node-data` and `browser-profile` (the browser profile holds the customer's logins).
- **Model and AI cost limits.** Chat goes to LiteLLM (`NODEOS_LLM_URL`); no customer gateway or
  budget exists, and the owner's gateway is deliberately not reachable from a customer container.
- **Shell leftovers.** `shell/src/native/NativeApp.tsx` hard-codes the owner's tailnet MCP URL and
  `shell/src/components/TalkNode.tsx` has "not Matt speaking" in a prompt. Both are in the bundle a
  customer receives. The daemon scrub does not cover the shell.
- **The Paperclip authentication gap** above, and per-customer disk quotas on the volumes.

## Repository notes

- Base branch: `claude/linux-build-cleanup-dfpu0e` has no Paperclip module. This work is based on
  `sync/steve-2026-10-31`, which matches the local mirror (`codex/foundation-reliability-20261101`
  does not exist on origin).
- `shell/src/styles/tokens.css` was deleted by the sync commit and the shell did not build without
  it; it is restored from `claude/linux-build-cleanup-dfpu0e` (the built CSS hash matches the
  owner's own `dist.bak-20261026signin`).
- `*.bak-*` files are ignored for new files (`.gitignore`) and excluded from the image build
  context (`.dockerignore`). Nothing was deleted.
- `box/docker-compose.yml` is the appliance (USB phone, tunnel, images that do not exist). It is not used here.
