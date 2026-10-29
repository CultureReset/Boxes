# Boxes (NODE / Ghost TV)

Boxes is the screen side of the Ghost box: a full-screen TV and desktop shell with a local daemon. The owner gets home screens, apps, files, calendar, settings, notifications, automations, and an ask bar and voice input to talk to the box, all without opening a terminal. It does not drive the phone or the SIM itself. Any sentence or action that would change something, and anything that touches `phone.*` or `notify.*`, is sent to NEXT GENT core (the `nextgent-platform` block), where the owner's rules and text approvals apply. When core is not running, the screen only answers read-only questions such as menu, hours and bookings. In the Ghost box assembly (`nextgent-ghost-image`) it runs as the `ghost-tv` unit on the customer's own Linux machine.

## What is in the code

| Path | What it does |
|---|---|
| `daemon/` | TypeScript Node HTTP server (`daemon/src/index.ts`, default `127.0.0.1:7770`). Serves the built shell and a JSON API covering apps, packages (Flathub, apt and other package managers), windows (Hyprland, X11), files, calendar, audio, display, Wi-Fi, Bluetooth, power, themes, "worlds" (layouts), automations, notifications (D-Bus), weather, agents, and voice |
| `daemon/src/platform/decide.ts`, `gate.ts` | The single decision path for every sentence. It asks core first, then falls back to local read-only answers. The gate refuses phone/SIM actions, and any non-read-only action that arrives as a sentence |
| `daemon/src/modules/kernel.ts` | Client for NEXT GENT core (`NEXTGENT_CORE_URL` / `NODE_KERNEL_URL`) |
| `daemon/src/voice/` | Speech-to-text (whisper model file), an OpenAI-compatible local LLM client, and text-to-speech (piper, a custom command, or a remote URL) |
| `shell/` | React + Vite front end (TV-style screens: Home variants, Apps, Agents, Automations, Calendar, Files, Settings) |
| `apps/menu/` | A separate Next.js restaurant QR-menu editor (`npm run dev:menu`) |
| `box/` | A separate "cybercheck" Raspberry Pi image build (pi-gen stage, systemd units, docker-compose with a node and a tunnel, an Android udev rule, and a JS agent that reads an owner-edited conf file with a pairing code) |
| `services/voice/` | Older JavaScript voice/SMS services using Supabase, Redis and OpenAI. They are not an npm workspace and nothing in the daemon calls them |
| `spec/` | Design notes (topology, "cage", agent card, trace bus, learning, app agents) |
| `module.manifest.json` | Block manifest. Health check at `http://127.0.0.1:7770/api/status` |

## Run

Requires Node 20+. The npm workspaces are `daemon`, `shell` and `apps/menu`.

```bash
npm ci
npm run build        # builds daemon (tsc) and shell (vite)
npm start            # node daemon/dist/index.js
npm run dev          # watch mode for daemon and shell
npm test             # daemon tests (node --test)
NODEOS_DEMO=1 npm start   # demo mode
```

## Configuration (environment)

- Server: `NODEOS_PORT` (7770), `NODEOS_HOST` (`127.0.0.1`; set it to the Tailscale address to reach the box from your tailnet. `0.0.0.0` exposes it to the LAN), `NODEOS_SHELL_DIST`, `NODEOS_DATA_DIR`, `NODEOS_DEMO`.
- Kernel: `NEXTGENT_CORE_URL` (default `http://127.0.0.1:8764`), `NEXTGENT_CORE_TOKEN` (or `NODE_KERNEL_URL` / `NODE_KERNEL_TOKEN`), `NEXTGENT_ANDROID_SERIAL` (pins every adb call to the box's one phone).
- Business answers: `NODEOS_API_URL`, `NODEOS_API_TOKEN`, `NODEOS_SLUG`, which can also be saved to disk from the UI.
- Voice: `NODEOS_LLM_URL` (default `http://127.0.0.1:8080/v1`), `NODEOS_LLM_MODEL`, `NODEOS_STT_MODEL`, `NODEOS_TTS_VOICE`, `NODEOS_TTS_CMD`, `NODEOS_TTS_CMD_RATE`, `NODEOS_TTS_URL`, `NODEOS_TTS_MODEL`, `NODEOS_TTS_REMOTE_VOICE`.
- Other: `NODEOS_OWNER_NUMBER`, `OMARCHY_PATH`.

## Notes

- The default branch is `claude/linux-build-cleanup-dfpu0e`, not `main`. The newest commits are on `claude/agent-ecosystem-architecture-nzexu1`.
- `box/` (Raspberry Pi "cybercheck") and `services/voice/` (Supabase/OpenAI) do not fit the rest of the repo or the Ghost box story. Treat them as legacy or separate until someone decides what to do with them.
