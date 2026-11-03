# Customer NODE

A customer NODE is the same NODE (daemon on :7770 plus the React shell), run as a
container for one customer business on the platform owner's machine. It is the
customer's own computer; the platform owner only hosts it. Customers are strangers
to each other and to the host, so everything here is built around keeping them apart.

| Piece | Where | Per customer |
| --- | --- | --- |
| `node` (daemon + shell) | `customer/Dockerfile` | one container, no route out |
| `edge` (inbound forwarder, scoped Paperclip gateway, CONNECT allow-list proxy) | `customer/edge/` | one container |
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
`--secret-file api_token=/path` or `--secret-stdin api_token`, and the customer's Paperclip key
with `--secret-file paperclip_api_key=/path`. `app_token` (the bearer token a future door
presents) and `vnc_password` are generated if absent. An absent `paperclip_api_key` is created
empty, and the node then **refuses to start** (see "Paperclip credential" below) unless you pass
`--paperclip-allow-anon`, which is unsafe. Re-running with
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
- **Paperclip credential.** See the section below. A missing key is a startup error.
- **Issue text** says "From <owner> (<business>) via ..." instead of the hard-coded owner
  name. The same name labels the user in "send this chat to Paperclip". Names are flattened
  to one line before they reach an agent.
- **No owner defaults.** The owner's name, Paperclip company and lead ids, tailnet host
  names and upload path live only in `daemon/src/homeDefaults.ts`, used by home mode alone.
  The shell gets its owner name and MCP endpoint from the daemon (`/api/status` `config`:
  `ownerName`, `businessName`, `mcpUrl`), never from the bundle. In customer mode `mcpUrl` is
  empty unless `NODEOS_MCP_URL` or `NODEOS_DOOR_PUBLIC` is set, and the MCP screen then says
  "Not set up yet".
- **The scrub step** (`customer/scrub.mjs`, run by the Dockerfile after the build). It reads the
  values from `homeDefaults.ts` at build time (so no other file contains them), writes the compiled
  copy with every value empty, and then searches **both** `daemon/dist` and `shell/dist` for each
  value and for what is derived from it: host names and their name parts, and every sub-path of the
  upload path. A hit stops the image build with exit 1, naming the file and which default it came
  from, never the value. A test (`daemon/src/platform/customer.test.ts`) plants each kind of
  leftover and checks the build fails, and another walks the source tree and fails if any file
  other than `homeDefaults.ts` carries a value. `config/` is the owner's own host configuration
  (service catalogue, tile icons); it holds such values by design and `.dockerignore` keeps it out
  of the image.
- **Hardware is inert** (also with `NODEOS_HARDWARE=0` alone): adb/scrcpy and the Android
  provider, window streaming (`xwd`), window control, power and power profiles, `systemctl`
  services and the service-control list, the health file, frame proxies, battery from
  `/sys`, local speakers, the software store, and file access outside the home directory.
  Each returns "Not available in hosted mode"; `/api/status` carries a `hosted` object.
  Demo data is off in hosted mode, so a customer never sees canned state as their own.
- `NODEOS_API_TOKEN_FILE` is read like `NODEOS_API_TOKEN`; the platform token arrives as a
  mounted secret file.

## Isolation model: enforced, assumed, or the host's job

Paperclip is the platform owner's agent orchestrator. One Paperclip serves every customer's company, and
how it authenticates callers is **not known from this repository**. So the isolation of one customer's
company from another's is built so that it does not depend on Paperclip:

| Layer | What it does | Status |
| --- | --- | --- |
| **Edge gateway** (`customer/edge/`) | The node reaches Paperclip only through it. It allows exactly `POST` and `GET /companies/<this container's COMPANY_ID>/issues`, and `GET /issues/<id>` and `GET /issues/<id>/comments` for ids **this container created** (read from Paperclip's create responses, kept in a bounded file on the `edge-state` volume). Everything else is `403` with a JSON error and never reaches Paperclip. | **Enforced by code, tested** (`npm run test:edge`) |
| **Edge proxy** | CONNECT tunnels only to hosts in `EDGE_ALLOW`, only to port 443, never to the Paperclip host, and a listed host *name* that resolves to a loopback, LAN, tailnet or link-local address is refused. Plain HTTP through it is refused. | **Enforced by code, tested** |
| **Compose** | The node is on an `internal` network with no route out except the edge; non-root, no capabilities, read-only root, resource limits. | Enforced by Docker once running. **Never run here** (no Docker daemon) |
| **Host firewall** | Keeps the edge and desktop subnets off the host, LAN and tailnet. | **Host's job**: generated, you load it as root |
| **Paperclip checks the key** | The daemon sends `Authorization: Bearer <key>` on every call (below). Whether the Paperclip server checks it, and whether a key is bound to one company, is **ASSUMED, not confirmed from code**. | **Assumed** |
| **Paperclip rejects cross-company references in a body** | The gateway checks the path, the method, the size and that the body is a JSON object. It does not read inside it. An issue created in this company could name another company's agent or parent issue; refusing that is Paperclip's job. | **Assumed** |

What the gateway enforces, precisely: a path is accepted only if it is already canonical. Letters, digits and
`. _ ~ -` only, so every percent escape (encoded slashes and dots, double encoding) is refused outright
rather than decoded; no empty segment (`//`, trailing `/`), no `.` or `..` segment; no query string and no
fragment; the fixed words and the company id are compared exactly, case-sensitively. The forwarded path is
the validated string itself, so nothing is parsed twice. Only `GET` and `POST`. `POST` bodies need a
`Content-Length` up to `EDGE_MAX_BODY` (256 KiB), `application/json`, and must parse as a JSON object;
chunked bodies and `GET` bodies are refused. Only `Authorization`, `Content-Type` and its own `Host`/`Accept`
go upstream. Upstream calls time out after 30 s (`504`), a redirect or a response over 4 MiB becomes `502`,
and a response whose `companyId` is another company's is `502` and its id is not recorded. Slow headers
(10 s) and slow bodies (30 s) are cut off. The log has method, decision, reason and a shortened target; never
a header or a body.

Why a gateway and not a path filter on the proxy: Node's environment proxy support sends even `http://`
requests as `CONNECT`, which hides the path, and a tunnel cannot be scoped. The node is therefore configured
with `PAPERCLIP_API_URL=http://edge:8890/api`, and the real URL is the edge's `PAPERCLIP_UPSTREAM_URL`
(`http` or `https`; the edge terminates TLS toward Paperclip). Because the key is held by the node, a
process inside the node container can read it and can use it, but only through the gateway's scope.

Not covered by the gateway: it limits what *this container* may ask, not what Paperclip's agents then do
with an issue's text (Lead reads the description, which is customer-controlled: prompt injection into the
orchestrator is a separate risk), and not anything that does not come through the edge, which is why the
`internal` network and the host firewall matter.

### Paperclip credential

- The daemon's Paperclip client sends `Authorization: Bearer <key>` when `PAPERCLIP_API_KEY` or
  `PAPERCLIP_API_KEY_FILE` is set (the variable wins if both are). Prefer the file (compose mounts
  `/run/secrets/paperclip_api_key`). The file is read once at start. The key is not part of the settings
  object, not in `/api/status`, not in logs or error text (an upstream error that echoes it is redacted), and
  `PAPERCLIP_API_KEY` is removed from the environment of every child process the daemon starts.
- **Customer mode with no key does not start** (exit 78, naming the variables) unless
  `PAPERCLIP_ALLOW_ANON=1` is set. That setting is **unsafe**: Paperclip is then called with no credential, the
  daemon prints a warning at start, and only the edge gateway's scope stands between this customer and
  every other company. Use it only against a Paperclip that has no authentication, knowingly. Any other
  value for `PAPERCLIP_ALLOW_ANON` is an error. An unreadable, empty or multi-word key file is an error
  that names the variable and never the value.
- Home mode is unchanged: no key, no header; with a key set, the header is sent.
- **ASSUMED, not confirmed from code:** that the Paperclip server enforces such a key, and that a key can be
  scoped to one company. The repository holds only Paperclip's client side. If the server ignores the
  header, the header does nothing, and the edge gateway is the whole defence.

## Isolation: what a customer container can and cannot reach

Compose cannot say "this container may not reach the LAN", so isolation has two layers.

**Structural (compose).** `node` is attached to one network, `inner`, which is
`internal: true`: no route to the host, the LAN, the tailnet or the internet, and name
resolution only for its project siblings. Its only exit is an HTTP proxy in `edge`, which
refuses every host not in `EDGE_ALLOW` (the platform API, plus anything added with `--allow`; not
Paperclip, which has its own scoped gateway there) and CONNECTs only to port 443. Containers run as non-root, with all
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
| `edge` | hosts in `EDGE_ALLOW` (443); Paperclip, for this company's issues only | everything else (proxy and gateway); LAN and host (firewall) |
| `desktop` | the internet, `node` | LAN, tailnet, host, other customers (firewall) |
| the customer | `127.0.0.1:<NODE_HOST_PORT>` via whatever door you put in front | anything else on the host |

Limits you should know about:

- **The firewall layer is only as good as you load it.** Without it the edge and desktop
  containers could reach the LAN. Docker also bypasses `ufw`; use the generated `DOCKER-USER` rules.
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
host command, home mode unchanged, the Paperclip key header, startup errors and anon warning, the key
absent from status output and logs and child environments, the scrub step catching planted leftovers in
the daemon and shell output, no owner value in any source file but `homeDefaults.ts`); the edge tests
(`npm run test:edge`: 101 tests; 64 allow/deny table rows for the path policy, with traversal,
encoding, case tricks, query and fragment smuggling and another company's id, 17 for CONNECT, plus the real servers on
real sockets against a fake Paperclip: recording, persistence across restart, the bound, body cap,
timeouts, CONNECT limits); the daemon started in customer mode and answering `/api/status`;
`docker compose config` on the template, on a generated env file and with the `desktop` profile; the
provision script's dry run, apply (with a stand-in `docker` that only skips `up`), idempotence.
Node's `NODE_USE_ENV_PROXY` was observed to send `CONNECT` even for `http://` targets, which is why
Paperclip goes through the gateway and not through the proxy.

**Not verified: any Docker build or run.** The Docker client was present but there was no Docker
daemon in this environment. So the images have never been built, the containers never started, the
`internal` network and proxy path never exercised, the generated iptables rules never loaded, and
**the `desktop` profile (Xvfb, openbox, Chromium, x11vnc, noVNC) has never been run at all.**
The edge's code is tested on real sockets, but `customer/edge/Dockerfile` has never been built.
Treat the edge image and every file under `customer/desktop/` as a first draft.

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
- **Confirming Paperclip's own authentication** (does it check the key, is a key scoped to a company).
  Until someone reads the server's code or tests it, only the gateway is a known control.
- **Inspecting issue bodies** for references to other companies' objects (see the table above).
- **A generic tailnet-suffix rule in the shell.** `nativeFor` in `shell/src/native/NativeApp.tsx` sends a
  bare `*.ts.net` link to the OpenJarvis screen. It holds the generic Tailscale suffix, not the owner's
  name, and is unchanged; a customer without that app would see an empty screen for such a link.
- Per-customer disk quotas on the volumes.

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
