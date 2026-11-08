#!/usr/bin/env bash
# Run on the box when something looks wrong. Answers, in order, the questions
# a person actually asks: is it on, can it see the phone, can it see us.

set -uo pipefail
ok(){ printf '  \033[32m✓\033[0m %s\n' "$1"; }
no(){ printf '  \033[31m✗\033[0m %s\n' "$1"; }
hm(){ printf '  \033[33m!\033[0m %s\n' "$1"; }

echo; echo "CyberCheck node — health"; echo "========================================"; echo

# ── power ────────────────────────────────────────────────────────────────────
# Under-voltage is the single most common cause of a Pi that "randomly stops
# working" with a phone drawing current off it. Check it first, and loudly.
if command -v vcgencmd >/dev/null 2>&1; then
  T=$(vcgencmd get_throttled 2>/dev/null | cut -d= -f2)
  if [ "$T" = "0x0" ]; then ok "power steady"
  else no "POWER — under-voltage detected ($T). Use the official 5V/3A supply; a phone charger is not enough once a handset is drawing off the USB port."; fi
else hm "power — cannot read (not a Pi?)"; fi

# ── the phone ────────────────────────────────────────────────────────────────
if command -v adb >/dev/null 2>&1 || docker compose exec -T node which adb >/dev/null 2>&1; then
  LIST=$(docker compose -f "$(dirname "$0")/../runtime/docker-compose.yml" exec -T node adb devices 2>/dev/null | tail -n +2 | grep -v '^$')
  if   [ -z "$LIST" ];                    then no "PHONE — nothing plugged in. Use a data cable, not a charging cable."
  elif echo "$LIST" | grep -q 'unauthorized'; then no "PHONE — plugged in but not allowed. Unlock it and tap Allow on the USB debugging prompt."
  elif echo "$LIST" | grep -q 'offline';      then no "PHONE — not responding. Unplug, unlock the screen, plug back in."
  elif echo "$LIST" | grep -q 'device';       then ok "phone connected and allowed"
  else hm "phone — unrecognised state: $LIST"; fi
else no "adb not available"; fi

# ── containers ───────────────────────────────────────────────────────────────
CF="$(dirname "$0")/../runtime/docker-compose.yml"
for s in node tunnel; do
  S=$(docker compose -f "$CF" ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk -v s="$s" '$1==s{print $2}')
  case "$S" in
    running) ok "$s running" ;;
    "")      no "$s NOT RUNNING — run: docker compose -f $CF up -d" ;;
    *)       no "$s is $S" ;;
  esac
done

# ── reaching the platform ────────────────────────────────────────────────────
if ping -c1 -W3 1.1.1.1 >/dev/null 2>&1; then ok "internet reachable"
else no "NO INTERNET — check Wi-Fi in cybercheck.conf on the boot partition"; fi

# ── the card ─────────────────────────────────────────────────────────────────
# A full SD card looks exactly like a hung box.
USE=$(df -P / | awk 'NR==2{print 0+$5}')
if [ "$USE" -lt 85 ]; then ok "disk ${USE}% used"
else no "DISK ${USE}% FULL — logs or images have filled the card"; fi

echo
