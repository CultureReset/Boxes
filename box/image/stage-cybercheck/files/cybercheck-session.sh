#!/usr/bin/env bash
# The desktop the box drives.
#
# X11, not Wayland: Wayland has no sanctioned way for one process to synthesise
# input into another's window, and every workaround is compositor-specific and
# breaks on update. X11's are twenty years old and boring, which is what an
# appliance needs.
#
# openbox rather than a full desktop — a window manager is required (so windows
# can be raised and focused) but a taskbar, file manager and settings daemon on
# a machine with no user sitting at it are just update churn.

set -uo pipefail
export DISPLAY=:0

xset s off          # no screensaver
xset -dpms          # never blank: a blank screen cannot be screenshotted
xset s noblank

openbox --config-file /etc/xdg/openbox/rc.xml &

# A phone already plugged in at boot never fires a udev add event.
/usr/local/bin/cybercheck-mirror.sh &

wait
