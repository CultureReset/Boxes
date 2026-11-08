#!/usr/bin/env bash
# Build the flashable image.
#
# Wraps pi-gen — the Raspberry Pi Foundation's own image builder — rather than
# hand-rolling one, so the result is genuine Raspberry Pi OS with one extra
# stage on top. That matters when a card goes wrong in the field: every normal
# Pi recovery instruction still applies.
#
#   ./image/build.sh              64-bit Lite, the default
#   PI_GEN_REF=arm64 ./image/build.sh
#
# Must run on Linux with Docker. pi-gen needs binfmt for ARM; on a non-ARM host
# run once:  docker run --privileged --rm tonistiigi/binfmt --install arm64

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
WORK="$ROOT/work"
PI_GEN_REF="${PI_GEN_REF:-arm64}"

command -v docker >/dev/null || { echo "Docker is required to build the image."; exit 1; }

mkdir -p "$WORK"
if [ ! -d "$WORK/pi-gen" ]; then
  echo "Fetching pi-gen ($PI_GEN_REF)…"
  git clone --depth 1 --branch "$PI_GEN_REF" https://github.com/RPi-Distro/pi-gen "$WORK/pi-gen"
fi

# Lite only. A desktop on an appliance is several hundred megabytes of attack
# surface and update churn for a machine with no screen attached.
touch "$WORK/pi-gen/stage3/SKIP" "$WORK/pi-gen/stage4/SKIP" "$WORK/pi-gen/stage5/SKIP" 2>/dev/null || true
rm -f "$WORK/pi-gen/stage4/EXPORT_IMAGE" "$WORK/pi-gen/stage5/EXPORT_IMAGE" 2>/dev/null || true

rm -rf "$WORK/pi-gen/stage-cybercheck"
cp -r "$HERE/stage-cybercheck" "$WORK/pi-gen/stage-cybercheck"
touch "$WORK/pi-gen/stage-cybercheck/EXPORT_IMAGE"

cat > "$WORK/pi-gen/config" <<CONF
IMG_NAME=cybercheck-node
RELEASE=bookworm
DEPLOY_COMPRESSION=xz
LOCALE_DEFAULT=en_US.UTF-8
TARGET_HOSTNAME=cybercheck
FIRST_USER_NAME=cybercheck
DISABLE_FIRST_BOOT_USER_RENAME=1
STAGE_LIST="stage0 stage1 stage2 stage-cybercheck"
CONF

echo "Building. This takes 20–40 minutes."
( cd "$WORK/pi-gen" && ./build-docker.sh )

mkdir -p "$ROOT/deploy"
cp "$WORK/pi-gen/deploy/"*.img.xz "$ROOT/deploy/" 2>/dev/null || true
echo
echo "Done. Image in $ROOT/deploy/"
echo "Write it with Raspberry Pi Imager or:  xzcat *.img.xz | sudo dd of=/dev/sdX bs=4M status=progress"
