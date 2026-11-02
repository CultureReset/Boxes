#!/usr/bin/env bash
# Provision (or deprovision) one customer's NODE: a compose project of its own.
#
#   scripts/provision-customer.sh <slug> [options]            show the plan, change nothing
#   scripts/provision-customer.sh <slug> --apply [options]    write files, start the project
#   scripts/provision-customer.sh --deprovision <slug> [--apply]
#                                                              stop the project, KEEP the data
#   scripts/provision-customer.sh --deprovision <slug> --apply --purge --confirm-slug <slug>
#                                                              also delete volumes and customers/<slug>/
#
# Dry run is the default for every action. Nothing is written, started, stopped or
# deleted without --apply.
#
# Secrets never go on the command line and are never printed:
#   --secret-file NAME=PATH   copy the secret from a file
#   --secret-stdin NAME       read the secret from standard input (one per run)
# NAME is app_token | api_token | vnc_password. A secret that is not supplied is kept
# if it already exists; otherwise app_token and vnc_password are generated and
# api_token is created empty (the daemon then runs without a platform connection).
#
# Idempotent: running it again with the same inputs changes nothing, keeps the
# subnets, ports and secrets it chose the first time, and reconciles the project.
#
# See docs/CUSTOMER-NODE.md.

set -euo pipefail
umask 077

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO/customer/docker-compose.yml"
CUSTOMERS_DIR="${NODEOS_CUSTOMERS_DIR:-$REPO/customers}"

# Per-customer address plan. Customer number N (1..250) gets 10.77.N.0/24 for the edge
# proxy and 10.78.N.0/24 for the desktop browser, host ports 18000+N and 19000+N.
EDGE_NET_PREFIX="10.77"
WEB_NET_PREFIX="10.78"
NODE_PORT_BASE=18000
DESKTOP_PORT_BASE=19000

die() { echo "error: $*" >&2; exit 2; }
say() { echo "$*"; }

usage() { sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

# ---- arguments ---------------------------------------------------------------

MODE="provision"; SLUG=""; APPLY=0; PURGE=0; CONFIRM=""; DESKTOP=0; BUILD=0
CONFIG_FILE=""
declare -A OPT=()          # settings given on the command line
declare -a EXTRA_ALLOW=()
declare -A SECRET_FILE=()  # name -> path
STDIN_SECRET=""

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --apply) APPLY=1 ;;
    --deprovision) MODE="deprovision" ;;
    --purge) PURGE=1 ;;
    --confirm-slug) CONFIRM="${2:?--confirm-slug needs a value}"; shift ;;
    --desktop) DESKTOP=1 ;;
    --build) BUILD=1 ;;
    --config) CONFIG_FILE="${2:?--config needs a file}"; shift ;;
    --owner-name) OPT[OWNER_NAME]="${2:?}"; shift ;;
    --business-name) OPT[BUSINESS_NAME]="${2:?}"; shift ;;
    --paperclip-url) OPT[PAPERCLIP_API_URL]="${2:?}"; shift ;;
    --paperclip-company) OPT[PAPERCLIP_COMPANY_ID]="${2:?}"; shift ;;
    --paperclip-lead) OPT[PAPERCLIP_LEAD_ID]="${2:?}"; shift ;;
    --api-url) OPT[NODEOS_API_URL]="${2:?}"; shift ;;
    --allow) EXTRA_ALLOW+=("${2:?}"); shift ;;
    --customers-dir) CUSTOMERS_DIR="${2:?}"; shift ;;
    --secret-file)
      kv="${2:?--secret-file needs NAME=PATH}"; shift
      SECRET_FILE["${kv%%=*}"]="${kv#*=}" ;;
    --secret-stdin) STDIN_SECRET="${2:?--secret-stdin needs a NAME}"; shift ;;
    --secret|--token|--password|--secret-value)
      die "secrets are never taken from the command line; use --secret-file NAME=PATH or --secret-stdin NAME" ;;
    -*) die "unknown option: $1 (see --help)" ;;
    *) [ -z "$SLUG" ] || die "only one slug may be given"; SLUG="$1" ;;
  esac
  shift
done

[ -n "$SLUG" ] || { usage; exit 2; }
[[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,30}[a-z0-9]$ ]] || die "slug must be 3-32 chars: lowercase letters, digits and dashes, starting with a letter"
[[ "$SLUG" != *--* ]] || die "slug must not contain two dashes in a row"

DIR="$CUSTOMERS_DIR/$SLUG"
ENV_FILE="$DIR/compose.env"
SECRETS_DIR="$DIR/secrets"
FIREWALL="$DIR/firewall.rules.sh"
PROJECT="nodeos-$SLUG"

compose() {
  local profile=()
  [ "$DESKTOP" = 1 ] && profile=(--profile desktop)
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "${profile[@]}" "$@"
}

# ---- helpers -----------------------------------------------------------------

# Free text that ends up inside a compose env file and an agent-readable issue.
safe_text() { # name value maxlen
  local v="$2"
  [ -n "$v" ] || die "$1 is required"
  [ "${#v}" -le "$3" ] || die "$1 is longer than $3 characters"
  case "$v" in *[\"\$\`\\]*) die "$1 must not contain a double quote, dollar sign, backtick or backslash" ;; esac
  [[ "$v" != *[[:cntrl:]]* ]] || die "$1 must not contain control characters or newlines"
}

uuid_ok() { [[ "$2" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || die "$1 must be a UUID"; }

url_host() { # prints the host of an http(s) URL, or fails
  local u="$1" rest
  [[ "$u" =~ ^https?://[^/[:space:]]+ ]] || return 1
  rest="${u#*://}"; rest="${rest%%/*}"; rest="${rest##*@}"; rest="${rest%%:*}"
  [[ "$rest" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || return 1
  printf '%s' "$rest"
}
url_port() {
  local u="$1" rest
  rest="${u#*://}"; rest="${rest%%/*}"; rest="${rest##*@}"
  if [[ "$rest" == *:* ]]; then printf '%s' "${rest##*:}"; elif [[ "$u" == https://* ]]; then printf 443; else printf 80; fi
}
is_ipv4() { [[ "$1" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; }

env_get() { # file key -> value (no quotes), empty when absent
  [ -f "$1" ] || return 0
  local line
  line="$(grep -E "^$2=" "$1" | tail -n 1 || true)"
  line="${line#*=}"; line="${line#\"}"; line="${line%\"}"
  printf '%s' "$line"
}

# KEY=VALUE lines only; the file is read as data, never sourced.
read_config() {
  local f="$1" line k v
  [ -r "$f" ] || die "cannot read config file $f"
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" =~ ^([A-Z_]+)=(.*)$ ]] || die "config file: not a KEY=VALUE line"
    k="${BASH_REMATCH[1]}"; v="${BASH_REMATCH[2]}"; v="${v#\"}"; v="${v%\"}"
    case "$k" in
      OWNER_NAME|BUSINESS_NAME|PAPERCLIP_API_URL|PAPERCLIP_COMPANY_ID|PAPERCLIP_LEAD_ID|NODEOS_API_URL)
        [ -n "${OPT[$k]+x}" ] || OPT[$k]="$v" ;;
      EXTRA_ALLOW) IFS=',' read -ra _a <<< "$v"; EXTRA_ALLOW+=("${_a[@]}") ;;
      *) die "config file: key $k is not allowed here (secrets do not belong in it)" ;;
    esac
  done < "$f"
}

# Write a file only when its content would change. Never echoes the content.
write_file() { # path mode  (content on stdin)
  local path="$1" mode="$2" tmp
  tmp="$(mktemp "$path.XXXXXX")"
  cat > "$tmp"
  if [ -f "$path" ] && cmp -s "$tmp" "$path"; then
    rm -f "$tmp"; chmod "$mode" "$path"; say "  unchanged  $path"
  else
    chmod "$mode" "$tmp"; mv "$tmp" "$path"; say "  wrote      $path"
  fi
}

# ---- deprovision ---------------------------------------------------------------

if [ "$MODE" = "deprovision" ]; then
  [ -d "$DIR" ] || say "note: $DIR does not exist (nothing of this customer's files on this machine)"
  if [ "$PURGE" = 1 ]; then
    [ "$CONFIRM" = "$SLUG" ] || die "--purge deletes this customer's volumes and files for good; add --confirm-slug $SLUG to proceed"
    say "PURGE $SLUG: stop the project, delete its volumes (node data, browser profile) and $DIR"
  else
    say "Deprovision $SLUG: stop and remove the containers and networks; KEEP the volumes (node data, browser profile) and $DIR"
  fi
  if [ "$APPLY" != 1 ]; then say "(dry run: nothing changed. Add --apply.)"; exit 0; fi
  [ -f "$ENV_FILE" ] || die "$ENV_FILE is missing; cannot address the compose project"
  command -v docker >/dev/null || die "docker is not installed"
  # The firewall script lives in the directory a purge deletes, so a purge unloads the rules first.
  if [ "$PURGE" = 1 ] && [ -f "$FIREWALL" ] && [ "$(id -u)" != 0 ]; then
    die "run the purge as root (sudo) so this customer's firewall rules are unloaded before their files are deleted"
  fi
  DESKTOP=1   # include the optional service so it is stopped too
  if [ "$PURGE" = 1 ]; then compose down --volumes --remove-orphans; else compose down --remove-orphans; fi
  if [ "$PURGE" = 1 ]; then
    [ ! -f "$FIREWALL" ] || bash "$FIREWALL" --remove
    # Only ever remove exactly customers/<slug>, and only if it looks like one.
    case "$DIR" in "$CUSTOMERS_DIR"/"$SLUG") ;; *) die "refusing to delete $DIR" ;; esac
    [ -f "$ENV_FILE" ] && rm -rf -- "$DIR"
    say "purged: containers, volumes and $DIR"
  else
    say "stopped. Data kept: docker volumes of project $PROJECT, and $DIR (env + secrets)."
    [ ! -f "$FIREWALL" ] || say "the customer's firewall rules stay loaded (harmless while stopped); unload with: $FIREWALL --remove"
    say "bring it back with: $0 $SLUG --apply"
  fi
  exit 0
fi

# ---- provision: gather and validate ------------------------------------------------

[ -n "$CONFIG_FILE" ] && read_config "$CONFIG_FILE"

setting() { # KEY -> command line / config, else what the existing env file has
  local k="$1" envkey="$1"
  case "$k" in OWNER_NAME) envkey=NODEOS_OWNER_NAME ;; BUSINESS_NAME) envkey=NODEOS_BUSINESS_NAME ;; esac
  if [ -n "${OPT[$k]+x}" ]; then printf '%s' "${OPT[$k]}"; else env_get "$ENV_FILE" "$envkey"; fi
}

OWNER_NAME="$(setting OWNER_NAME)"
BUSINESS_NAME="$(setting BUSINESS_NAME)"
PAPERCLIP_API_URL="$(setting PAPERCLIP_API_URL)"
PAPERCLIP_COMPANY_ID="$(setting PAPERCLIP_COMPANY_ID)"
PAPERCLIP_LEAD_ID="$(setting PAPERCLIP_LEAD_ID)"
NODEOS_API_URL="$(setting NODEOS_API_URL)"

safe_text owner-name "$OWNER_NAME" 80
safe_text business-name "$BUSINESS_NAME" 120
safe_text paperclip-url "$PAPERCLIP_API_URL" 300
safe_text api-url "$NODEOS_API_URL" 300
uuid_ok paperclip-company "$PAPERCLIP_COMPANY_ID"
uuid_ok paperclip-lead "$PAPERCLIP_LEAD_ID"
PC_HOST="$(url_host "$PAPERCLIP_API_URL")" || die "paperclip-url must be an http(s) URL with a plain host name or IPv4 address"
API_HOST="$(url_host "$NODEOS_API_URL")" || die "api-url must be an http(s) URL with a plain host name or IPv4 address"
PC_PORT="$(url_port "$PAPERCLIP_API_URL")"

# Refuse the platform owner's own Paperclip company and lead, read from the source of the defaults.
OWN_IDS="$(grep -ohE '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' "$REPO/daemon/src/homeDefaults.ts" 2>/dev/null || true)"
for pair in "paperclip-company:$PAPERCLIP_COMPANY_ID" "paperclip-lead:$PAPERCLIP_LEAD_ID"; do
  if printf '%s\n' "$OWN_IDS" | grep -qix "${pair#*:}"; then die "${pair%%:*} is the platform owner's own id; each customer needs their own Paperclip company and lead"; fi
done
[ "$PAPERCLIP_COMPANY_ID" != "$PAPERCLIP_LEAD_ID" ] || die "company and lead ids must differ"

# What the container may reach: Paperclip, the platform API, anything added with --allow.
declare -A seen=(); ALLOW=()
for h in "$PC_HOST" "$API_HOST" ${EXTRA_ALLOW[@]+"${EXTRA_ALLOW[@]}"}; do
  h="${h//[[:space:]]/}"; [ -n "$h" ] || continue
  [[ "$h" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die "--allow takes plain host names or IPv4 addresses"
  [ -n "${seen[$h]+x}" ] || { seen[$h]=1; ALLOW+=("$h"); }
done
EDGE_ALLOW="$(IFS=,; echo "${ALLOW[*]}")"

# Subnets and ports: keep what an existing customer already has, otherwise pick the lowest free number.
EDGE_SUBNET="$(env_get "$ENV_FILE" EDGE_SUBNET)"; WEB_SUBNET="$(env_get "$ENV_FILE" WEB_SUBNET)"
NODE_HOST_PORT="$(env_get "$ENV_FILE" NODE_HOST_PORT)"; DESKTOP_HOST_PORT="$(env_get "$ENV_FILE" DESKTOP_HOST_PORT)"
if [ -z "$EDGE_SUBNET" ]; then
  used=" "
  for f in "$CUSTOMERS_DIR"/*/compose.env; do
    [ -f "$f" ] || continue
    used+="$(env_get "$f" EDGE_SUBNET | cut -d. -f3) "
  done
  n=1; while [[ "$used" == *" $n "* ]]; do n=$((n + 1)); done
  [ "$n" -le 250 ] || die "no free customer numbers left (250 customers per host with this address plan)"
  EDGE_SUBNET="$EDGE_NET_PREFIX.$n.0/24"; WEB_SUBNET="$WEB_NET_PREFIX.$n.0/24"
  NODE_HOST_PORT=$((NODE_PORT_BASE + n)); DESKTOP_HOST_PORT=$((DESKTOP_PORT_BASE + n))
fi

# Secrets: what will happen to each, without ever reading one into a printed variable.
declare -A SECRET_PLAN=()
for name in app_token api_token vnc_password; do
  if [ -n "$STDIN_SECRET" ] && [ "$STDIN_SECRET" = "$name" ]; then SECRET_PLAN[$name]="replace from standard input"
  elif [ -n "${SECRET_FILE[$name]+x}" ]; then
    [ -r "${SECRET_FILE[$name]}" ] || die "cannot read the file given for $name"
    [ -s "${SECRET_FILE[$name]}" ] || die "the file given for $name is empty"
    SECRET_PLAN[$name]="replace from the file given"
  elif [ -s "$SECRETS_DIR/$name" ]; then SECRET_PLAN[$name]="keep existing"
  elif [ "$name" = api_token ]; then SECRET_PLAN[$name]="create empty (no platform connection until a business token is supplied)"
  else SECRET_PLAN[$name]="generate"
  fi
done
for name in "${!SECRET_FILE[@]}"; do [[ "$name" =~ ^(app_token|api_token|vnc_password)$ ]] || die "unknown secret name: $name"; done
[ -z "$STDIN_SECRET" ] || [[ "$STDIN_SECRET" =~ ^(app_token|api_token|vnc_password)$ ]] || die "unknown secret name: $STDIN_SECRET"

IMAGE_NOTE="builds images from this repository on first start"; [ "$BUILD" = 1 ] && IMAGE_NOTE="rebuilds images from this repository"

# ---- the plan --------------------------------------------------------------------

say "Customer:   $SLUG   (compose project $PROJECT)"
say "Owner:      $OWNER_NAME   Business: $BUSINESS_NAME"
say "Paperclip:  $PAPERCLIP_API_URL   company $PAPERCLIP_COMPANY_ID   lead $PAPERCLIP_LEAD_ID"
say "Platform:   $NODEOS_API_URL"
say "May reach:  $EDGE_ALLOW   (everything else is refused by the edge proxy)"
say "Networks:   inner (internal, no route out), edge $EDGE_SUBNET, web $WEB_SUBNET"
say "Ports:      127.0.0.1:$NODE_HOST_PORT -> node (needs a door or the app token)$([ "$DESKTOP" = 1 ] && echo ", 127.0.0.1:$DESKTOP_HOST_PORT -> desktop (noVNC)")"
say "Desktop:    $([ "$DESKTOP" = 1 ] && echo 'included (profile desktop, UNTESTED)' || echo 'not included (add --desktop)')"
say "Secrets:    app_token: ${SECRET_PLAN[app_token]}; api_token: ${SECRET_PLAN[api_token]}; vnc_password: ${SECRET_PLAN[vnc_password]}"
say "Images:     $IMAGE_NOTE"
say "Files:      $ENV_FILE  $SECRETS_DIR/{app_token,api_token,vnc_password}  $FIREWALL"

if [ "$APPLY" != 1 ]; then
  say ""
  say "Dry run: nothing was written or started. Add --apply to do it."
  exit 0
fi

# ---- apply -------------------------------------------------------------------------

command -v docker >/dev/null || die "docker is not installed on this machine"
docker compose version >/dev/null 2>&1 || die "the docker compose plugin is not installed"
[ -f "$COMPOSE_FILE" ] || die "missing $COMPOSE_FILE"

say ""
mkdir -p "$CUSTOMERS_DIR"; chmod 700 "$CUSTOMERS_DIR" 2>/dev/null || true
mkdir -p "$DIR" "$SECRETS_DIR"; chmod 700 "$DIR" "$SECRETS_DIR"

# Secrets first. Content goes file to file or from the generator, never through argv or the terminal.
# The files are 0444 inside a 0700 directory: the container user (uid 10001/10003) is not the
# host user, and compose file-secrets keep the host file's mode, so the directory is the lock.
put_secret() { # name
  local name="$1" dest="$SECRETS_DIR/$1" tmp
  tmp="$(mktemp "$dest.XXXXXX")"
  case "${SECRET_PLAN[$name]}" in
    "replace from standard input") cat > "$tmp" ;;
    "replace from the file given") cat "${SECRET_FILE[$name]}" > "$tmp" ;;
    "keep existing") rm -f "$tmp"; chmod 444 "$dest"; say "  kept       $dest"; return ;;
    generate) head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$tmp" ;;
    *) : > "$tmp" ;;
  esac
  [ "$name" != vnc_password ] || [ -s "$tmp" ] || { rm -f "$tmp"; die "vnc_password cannot be empty"; }
  chmod 444 "$tmp"; mv "$tmp" "$dest"; say "  secret     $dest (${SECRET_PLAN[$name]})"
}
for name in app_token api_token vnc_password; do put_secret "$name"; done

write_file "$ENV_FILE" 600 <<EOF
# Generated by scripts/provision-customer.sh. No secrets in this file. Safe to regenerate.
CUSTOMER_SLUG=$SLUG
NODEOS_SLUG=$SLUG
NODEOS_OWNER_NAME="$OWNER_NAME"
NODEOS_BUSINESS_NAME="$BUSINESS_NAME"
PAPERCLIP_API_URL=$PAPERCLIP_API_URL
PAPERCLIP_COMPANY_ID=$PAPERCLIP_COMPANY_ID
PAPERCLIP_LEAD_ID=$PAPERCLIP_LEAD_ID
NODEOS_API_URL=$NODEOS_API_URL
EDGE_ALLOW=$EDGE_ALLOW
EDGE_SUBNET=$EDGE_SUBNET
WEB_SUBNET=$WEB_SUBNET
NODE_HOST_PORT=$NODE_HOST_PORT
DESKTOP_HOST_PORT=$DESKTOP_HOST_PORT
SECRETS_DIR=$SECRETS_DIR
EOF

# Host firewall rules. Compose cannot express "this container may not reach the LAN", so the
# script writes them for the operator to load once, as root. They are idempotent.
CHAIN_BASE="NODEOS-${SLUG:0:12}-$(printf '%s' "$SLUG" | cksum | cut -d' ' -f1 | cut -c1-4)"
PC_RULE=""
if is_ipv4 "$PC_HOST"; then PC_RULE="$PC_HOST $PC_PORT"; fi
write_file "$FIREWALL" 750 <<EOF
#!/usr/bin/env bash
# Generated by scripts/provision-customer.sh for customer $SLUG. Run as root:
#   $FIREWALL            load the rules (idempotent)
#   $FIREWALL --remove   unload them
# Keeps the customer's two outward-facing subnets off the host and the LAN, tailnet and
# link-local ranges. The node container has no such route to begin with (internal network);
# these rules cover the edge proxy and the optional desktop browser.
set -euo pipefail
[ "\$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
EDGE="$EDGE_SUBNET"; WEB="$WEB_SUBNET"; BASE="$CHAIN_BASE"
PAPERCLIP="$PC_RULE"   # "IP PORT" when Paperclip is addressed by IPv4; the edge subnet alone may reach it
PRIVATE="0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.168.0.0/16 224.0.0.0/4"

unhook() { # subnet suffix
  iptables -D DOCKER-USER -s "\$1" -j "\$BASE-\$2F" 2>/dev/null || true
  iptables -D INPUT -s "\$1" -j "\$BASE-\$2I" 2>/dev/null || true
  for c in "\$BASE-\$2F" "\$BASE-\$2I"; do iptables -F "\$c" 2>/dev/null || true; iptables -X "\$c" 2>/dev/null || true; done
}
if [ "\${1:-}" = "--remove" ]; then unhook "\$EDGE" E; unhook "\$WEB" W; echo "removed"; exit 0; fi

load() { # subnet suffix allow_paperclip(0/1)
  local s="\$1" x="\$2" pc="\$3" f="\$BASE-\$2F" i="\$BASE-\$2I" p
  iptables -N "\$f" 2>/dev/null || iptables -F "\$f"
  iptables -N "\$i" 2>/dev/null || iptables -F "\$i"
  # forwarded traffic: replies, own subnet, optionally Paperclip, then nothing private
  iptables -A "\$f" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  iptables -A "\$f" -d "\$s" -j RETURN
  if [ "\$pc" = 1 ] && [ -n "\$PAPERCLIP" ]; then iptables -A "\$f" -d "\${PAPERCLIP% *}" -p tcp --dport "\${PAPERCLIP#* }" -j RETURN; fi
  for p in \$PRIVATE; do iptables -A "\$f" -d "\$p" -j DROP; done
  iptables -A "\$f" -j RETURN
  # traffic to this machine itself
  iptables -A "\$i" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  if [ "\$pc" = 1 ] && [ -n "\$PAPERCLIP" ]; then iptables -A "\$i" -d "\${PAPERCLIP% *}" -p tcp --dport "\${PAPERCLIP#* }" -j RETURN; fi
  iptables -A "\$i" -j DROP
  iptables -C DOCKER-USER -s "\$s" -j "\$f" 2>/dev/null || iptables -I DOCKER-USER 1 -s "\$s" -j "\$f"
  iptables -C INPUT -s "\$s" -j "\$i" 2>/dev/null || iptables -I INPUT 1 -s "\$s" -j "\$i"
}
load "\$EDGE" E 1
load "\$WEB" W 0
echo "loaded rules for $SLUG (chains \$BASE-*). IPv6 is not enabled on these networks."
EOF

PROFILE_NOTE=""; [ "$DESKTOP" = 1 ] && PROFILE_NOTE=" --profile desktop"
BUILD_FLAG=(); [ "$BUILD" = 1 ] && BUILD_FLAG=(--build)
say ""
say "Starting project $PROJECT$PROFILE_NOTE"
compose config --quiet || die "the compose file did not validate with this customer's settings"
compose up -d "${BUILD_FLAG[@]}"

say ""
say "Started. Next:"
say "  * as root, load the firewall rules once:  $FIREWALL"
say "  * the node answers on http://127.0.0.1:$NODE_HOST_PORT (loopback only); /api needs the bearer token in $SECRETS_DIR/app_token"
[ "$DESKTOP" = 1 ] && say "  * the desktop (UNTESTED) is at http://127.0.0.1:$DESKTOP_HOST_PORT/ ; its password is in $SECRETS_DIR/vnc_password"
say "  * status:     docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps"
say "  * deprovision (keeps data):  $0 --deprovision $SLUG --apply"
