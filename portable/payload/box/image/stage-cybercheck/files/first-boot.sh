#!/usr/bin/env bash
# Runs once, on the first boot, before anything else.
#
# Reads the file the owner edited, brings up Wi-Fi, and hands over to the node.
# Every failure writes a sentence to cybercheck.status and keeps going far
# enough to write it — a box that dies silently is a box that gets returned.

set -uo pipefail

BOOT=/boot/firmware
[ -d "$BOOT" ] || BOOT=/boot
CONF="$BOOT/cybercheck.conf"
STATUS="$BOOT/cybercheck.status"

say() { printf '%s\n' "$*" >> "$STATUS" 2>/dev/null || true; }

: > "$STATUS" 2>/dev/null || true
say "CyberCheck node"
say "================================================"
say ""
say "Started: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
say ""

if [ ! -f "$CONF" ]; then
  say "Status:   CANNOT START"
  say ""
  say "What to fix"
  say "------------------------------------------------"
  say "1. cybercheck.conf is missing from this card."
  say "   Write the image again and edit cybercheck.conf before"
  say "   putting the card in the box."
  exit 0
fi

# Same tolerant parsing as the agent: quotes optional, comments ignored.
get() { sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$CONF" | head -1 | sed 's/^"\(.*\)"$/\1/; s/^'"'"'\(.*\)'"'"'$/\1/'; }

WIFI_NAME="$(get wifi_name)"
WIFI_PASS="$(get wifi_password)"
COUNTRY="$(get country)"

if [ -z "$WIFI_NAME" ]; then
  say "Status:   CANNOT START"
  say ""
  say "What to fix"
  say "------------------------------------------------"
  say "1. Wi-Fi name is blank in cybercheck.conf."
  say "   Fill in wifi_name with your network name, exactly"
  say "   as it appears on your phone. Capital letters matter."
  exit 0
fi

# The radio is legally required to know its region and will not associate
# without one. This is the single most common reason a headless Pi never
# appears on the network.
COUNTRY="${COUNTRY:-US}"
raspi-config nonint do_wifi_country "$COUNTRY" >/dev/null 2>&1 || true

if [ -z "$WIFI_PASS" ] || [ "$WIFI_PASS" = "open" ]; then
  nmcli device wifi connect "$WIFI_NAME" >/dev/null 2>&1
else
  nmcli device wifi connect "$WIFI_NAME" password "$WIFI_PASS" >/dev/null 2>&1
fi

# Give DHCP a moment before deciding the network is unreachable.
for _ in $(seq 1 20); do
  ping -c1 -W2 1.1.1.1 >/dev/null 2>&1 && ONLINE=1 && break
  sleep 3
done

if [ -z "${ONLINE:-}" ]; then
  say "Status:   NO INTERNET"
  say ""
  say "What to fix"
  say "------------------------------------------------"
  say "1. The box could not join \"$WIFI_NAME\"."
  say "   Check the name and password in cybercheck.conf."
  say "   The name must match exactly, including capitals."
  say "   If the network has no password, write:  wifi_password=open"
  say ""
  say "2. If the name and password are right, the box may be"
  say "   out of range. Move it closer to the router and"
  say "   power it off and on again."
  exit 0
fi

say "Status:   STARTING"
say ""
say "  Wi-Fi              connected to $WIFI_NAME"
say "  Internet           reachable"
say ""
say "Bringing up the node. This takes a few minutes the first time."

systemctl enable --now cybercheck-node.service >/dev/null 2>&1
