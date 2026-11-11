# Boxes

NODE: a Linux computer you run from a screen, not a terminal. A TypeScript daemon and a React shell put home screens, apps, agents, files, a calendar and an ask bar on one machine.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

The daemon is a local HTTP server on `127.0.0.1:7770`. It serves the built shell, reads the desktop session (windows, audio, Bluetooth, network, power, files, calendar, weather), launches Linux, Flathub, Android and web apps, and hands work to agents. The shell is one React app with phone, desktop and TV layouts; it only renders what the daemon returns and holds no business data. Web apps open inside NODE through per-app frame proxies that pass traffic through and strip only the headers that block framing. Writes that arrive through the door or the MCP hub wait for an owner approval, and every model call goes through one LiteLLM gateway.

> **Which branch to read.** This default branch is the September 2026 Ghost-era build. Current NODE work is on these branches:
>
> | Branch | What it is |
> |---|---|
> | `fix/node-pwa-inframe-apps` | The build NODE runs today |
> | `feat/portable-20261109` | Portable config and `install.sh`: no hard-coded paths, every port and directory from the environment |
> | `design/clean-ui-20261109` | The clean sectioned home and ambient TV board, on top of the portable branch |
>
> Since November 9, 2026 the daemon and shell are also split into their own repos, [`node-daemon`](https://github.com/CultureReset/node-daemon) and [`node-shell`](https://github.com/CultureReset/node-shell). Boxes stays the working copy until that split is tested and cut over.

## How it works

```
 phone / desktop / TV  ──►  shell (React)  ──►  daemon :7770  ──►  desktop session, apps, files
                                                   │
                                                   ├─►  web apps in frames (frame proxies)
                                                   ├─►  agents and tasks (Paperclip)
                                                   ├─►  models (LiteLLM gateway)
                                                   └─►  MCP hub + approval gateway (writes wait for a YES)
```

- **One login.** Requests that arrive from another device must carry a session from [`node-door`](https://github.com/CultureReset/node-door). The machine's own screen is trusted over loopback.
- **Work goes to Paperclip.** The ask bar and the app bridge (`/api/bridge/ask`, plus an MCP endpoint at `/api/bridge/mcp`) turn a request into a Paperclip task and bring the answer back. Other apps call the bridge with a per-machine app token.
- **No database credential on the box.** `daemon/src/platform/` is the only code that knows the platform's URL. Phrases are matched by a router with no model in it; a model may phrase an answer, but every figure comes from the platform.
- **Web apps are tiles.** `config/webapps.json` lists the web apps NODE shows (21 in the current build); `config/frames.json` maps them to frame-proxy ports.

## Run it

Node.js 20 or newer.

```bash
npm install
npm run dev        # daemon on :7770, shell dev server on :5173
npm run build      # build daemon and shell
npm start          # run the built daemon (serves the shell)
npm test           # daemon tests
```

With no desktop session the daemon starts in demo mode with sample data, and the screen says so.

On the `feat/portable-20261109` branch, a fresh clone installs without path edits:

```bash
cp .env.example .env              # every port and directory is configurable
./install.sh --build-only         # build and write env, start nothing
./install.sh --port 17770 --start # a second copy on other ports
```

## Layout

```
daemon/     local HTTP server: modules (apps, agents, calendar, files, windows...), frame proxies, platform client, voice
shell/      the screen: React + Vite, phone / desktop / TV layouts
apps/menu/  QR menu app and its editor
box/        appliance files: image, boot config, systemd units, device agent, Hyprland rules
config/     web-app tiles, frame ports, service controls
services/   optional voice/call path
spec/       design notes, not code
```

## Related repos

- [`node-daemon`](https://github.com/CultureReset/node-daemon) and [`node-shell`](https://github.com/CultureReset/node-shell): the daemon and shell split out with history
- [`node-door`](https://github.com/CultureReset/node-door): passkey and password login in front of NODE
- [`node-mcp-hub`](https://github.com/CultureReset/node-mcp-hub): one MCP gateway for every app
- [`node-app-store`](https://github.com/CultureReset/node-app-store): installable NODE apps and the TV board layout
- [`ai-stack-kit`](https://github.com/CultureReset/ai-stack-kit): pins and installs every NODE component
