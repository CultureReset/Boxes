#!/bin/bash
# Renders the proxy allow-list from EDGE_ALLOW and runs the proxy and the
# inbound forwarder. Exits when either stops, so the restart policy brings both back.
set -euo pipefail

: "${EDGE_ALLOW:?EDGE_ALLOW is required: comma-separated host names this customer may reach}"
UPSTREAM="${EDGE_UPSTREAM:-node:7770}"
OUT="${EDGE_RENDER_DIR:-/tmp}"

# Host names or IPv4 addresses only. Anything else is a configuration mistake, not something to escape.
: > "$OUT/tinyproxy.filter"
IFS=',' read -ra HOSTS <<< "$EDGE_ALLOW"
count=0
for h in "${HOSTS[@]}"; do
  h="${h//[[:space:]]/}"
  [ -z "$h" ] && continue
  if [[ ! "$h" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
    echo "edge: refusing EDGE_ALLOW entry that is not a plain host name" >&2
    exit 64
  fi
  printf '^%s$\n' "${h//./\\.}" >> "$OUT/tinyproxy.filter"
  count=$((count + 1))
done
[ "$count" -gt 0 ] || { echo "edge: EDGE_ALLOW lists no hosts" >&2; exit 64; }

cat > "$OUT/tinyproxy.conf" <<CONF
Port 8888
Listen 0.0.0.0
Timeout 60
MaxClients 20
PidFile "$OUT/tinyproxy.pid"
LogFile "/dev/stdout"
LogLevel Warning
DisableViaHeader Yes
ConnectPort 443
Filter "$OUT/tinyproxy.filter"
FilterType ere
FilterDefaultDeny Yes
CONF

if [ "${EDGE_RENDER_ONLY:-0}" = "1" ]; then exit 0; fi

tinyproxy -d -c "$OUT/tinyproxy.conf" &
socat TCP-LISTEN:7770,fork,reuseaddr "TCP:${UPSTREAM}" &
wait -n
exit 1
