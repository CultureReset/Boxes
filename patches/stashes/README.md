# Boxes stashes from steve-MS-7C02 (captured 2026-11-13 CST)

Source: `/home/steve/ang/src/boxes` (live tree, branch `deploy/node-live-2026-11-12` @ `3910bf1`).
Exported read-only with `git stash show -p --include-untracked stash@{N}`. Nothing was popped, dropped, or applied on the machine.
The exact stash commit objects are also preserved on GitHub as branches `archive/stash-refs/stash-N-<sha>` (check out `<branch>` and diff against `<branch>^1`).

"Unique" = added lines that are not present anywhere in the corresponding file at `deploy/node-live-2026-11-12` (`3910bf1`).

| # | Stash SHA | Date (CST/CDT as recorded) | Base | Message | Patch |
|---|---|---|---|---|---|
| 0 | `fa126e4` | 2026-11-11 21:26:52 -0600 | `520174a` (on GitHub) | On fix/native-apps-one-window: pre-369971a local dirty (frames/linux/windows/winstream/sw) | [stash-0-fa126e4.patch](stash-0-fa126e4.patch) |
| 1 | `4ce6df6` | 2026-11-11 20:12:23 -0600 | `5d4399d` (on GitHub) | On fix/native-apps-one-window: pre-520174a local dirty (frames/linux/windows/winstream/sw/AppView/tv) | [stash-1-4ce6df6.patch](stash-1-4ce6df6.patch) |
| 2 | `6982d40` | 2026-11-11 19:28:14 -0600 | `603de7e` (on GitHub) | On fix/node-pwa-inframe-apps: pre-3774ccd local desktop-ui/kiosk/supabase-servePort | [stash-2-6982d40.patch](stash-2-6982d40.patch) |
| 3 | `ab60112` | 2026-09-28 16:20:29 -0500 | `003163b` (on GitHub) | On working-box: pre-ubuntu-fix-local | [stash-3-ab60112.patch](stash-3-ab60112.patch) |

## What is unique vs. already committed

- **stash 0 (`fa126e4`)** — linux.ts, windows.ts, winstream.ts changes are already committed. Unique: `config/frames.json` entry with upstream `http://100.104.20.101:8200/` (Tailscale IP; historical only) and `shell/public/sw.js` cache bump to `node-shell-v6`.
- **stash 1 (`4ce6df6`)** — same as stash 0 for frames/linux/windows/winstream/sw, PLUS unique:
  - `shell/src/components/AppView.tsx`: the iPhone-style **swipe-up Home bar** (134×5 pill, full-width 48px hit bar above the iframe; ~32 of 40 added lines not in HEAD).
  - `shell/src/lib/tv.ts`: **`guardTvPopups`** — keeps `window.open` / `target=_blank` navigations inside the TV kiosk window (~23 of 32 lines not in HEAD).
- **stash 2 (`6982d40`)** — exec.ts, frameproxy.ts, linux.ts, windows.ts, winstream.ts, frames.json already committed. Unique:
  - `daemon/src/modules/providers/webapps.ts`: `frameUrls()` returning `frameUrl` + **`localFrameUrl`** (loopback frame-proxy URL so `door_session` is sent on 127.0.0.1).
  - `daemon/src/types.ts`, `shell/src/api/types.ts`: `localFrameUrl` field.
  - `shell/src/lib/openApp.ts`: **`resolveWebUrl()`** picking a same-host frame URL.
  - `shell/src/lib/tv.ts`: the same `guardTvPopups` block as stash 1; `sw.js` cache bump.
  - Note: the old logic references the Tailscale hostname as the non-loopback host; Cloudflare `*.voicecommandapi.com` is now primary.
- **stash 3 (`ab60112`, Sep 28 "pre-ubuntu-fix-local")** — `daemon/src/index.ts`: a capability tool-description block ("Every capability, described the way a model expects tools to be described…"); 23 of 25 added lines not in HEAD. Its untracked-files commit (`250206c`) has an empty tree.

These are archived for reference only; they are not proposed for merge as-is.
