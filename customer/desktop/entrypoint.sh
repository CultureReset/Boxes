#!/bin/bash
# Xvfb + openbox + Chromium (persistent profile) + x11vnc + noVNC, in one container.
# The container exits when any of them dies so the restart policy brings it all back.
set -euo pipefail

PASSFILE="${VNC_PASSWORD_FILE:-/run/secrets/vnc_password}"
[ -s "$PASSFILE" ] || { echo "desktop: VNC password secret is missing or empty" >&2; exit 64; }

W="${DESKTOP_WIDTH:-1440}"; H="${DESKTOP_HEIGHT:-900}"
rm -f /tmp/.X99-lock

Xvfb :99 -screen 0 "${W}x${H}x24" -nolisten tcp &
for _ in $(seq 1 50); do xdpyinfo -display :99 >/dev/null 2>&1 && break; sleep 0.2; done
xdpyinfo -display :99 >/dev/null 2>&1 || { echo "desktop: X display did not start" >&2; exit 1; }

openbox &

# VNC only on loopback inside the container; noVNC (websockify) is the one way in.
x11vnc -display :99 -localhost -rfbport 5900 -passwdfile "cmd:cat $PASSFILE" -forever -shared -noxdamage -quiet &
websockify --web=/usr/share/novnc 6080 127.0.0.1:5900 &

# --no-sandbox: Docker's default seccomp profile blocks the user namespaces Chromium's
# sandbox needs. The container is the sandbox here: non-root, no capabilities, read-only
# root filesystem, no route to the host network. See docs/CUSTOMER-NODE.md.
mkdir -p /profile/chromium /profile/Downloads /tmp/chromium-cache
chromium \
  --no-sandbox --no-first-run --no-default-browser-check --password-store=basic \
  --user-data-dir=/profile/chromium --disk-cache-dir=/tmp/chromium-cache \
  --window-size="${W},${H}" --window-position=0,0 --start-maximized \
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 \
  about:blank &

# Chromium answers DevTools requests only for an IP or localhost Host header and
# only on loopback; this forwards the project-internal port to it.
socat TCP-LISTEN:9223,fork,reuseaddr TCP:127.0.0.1:9222 &

wait -n
exit 1
