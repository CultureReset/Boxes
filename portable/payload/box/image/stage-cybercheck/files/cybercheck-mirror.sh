#!/usr/bin/env bash
# Put the phone on the screen, and keep it there.
#
# scrcpy renders the handset as an ordinary window on the desktop. That is the
# whole trick: once the phone is a window, the same pointer and keyboard that
# drive a browser drive the phone, and there is one automation mechanism on
# this box instead of two.
#
# Started by udev when a handset is plugged in, and by the session at login for
# a phone that was already there.

set -uo pipefail
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-/home/cybercheck/.Xauthority}"

log(){ logger -t cybercheck-mirror "$*"; }

pgrep -x scrcpy >/dev/null && { log "already mirroring"; exit 0; }

# Wait for the handset to finish enumerating and be authorised. A phone plugged
# in at boot is not ready the instant udev fires.
for i in $(seq 1 30); do
  STATE=$(adb devices | awk 'NR>1 && NF {print $2; exit}')
  [ "$STATE" = "device" ] && break
  [ "$STATE" = "unauthorized" ] && log "waiting: phone plugged in but Allow not tapped"
  sleep 2
done

[ "${STATE:-}" = "device" ] || { log "giving up: phone never became ready (last state: ${STATE:-none})"; exit 0; }

# --stay-awake so the screen does not sleep mid-task and swallow a click.
# --window-title is fixed so the executor can find it by name across handsets.
# --no-audio because nothing here listens to the phone, and audio forwarding is
#   the most common cause of scrcpy failing to start at all.
exec scrcpy \
  --stay-awake \
  --no-audio \
  --window-title "CyberCheck Phone" \
  --window-borderless \
  --max-size 1024 \
  --video-bit-rate 4M
