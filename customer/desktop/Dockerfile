# A virtual desktop with Chromium for one customer's agents, watchable and
# take-over-able in a browser through noVNC.
#
# UNTESTED: written without a Docker daemon available. Nothing in this directory
# has been built or run. See docs/CUSTOMER-NODE.md before relying on it.
FROM debian:bookworm-slim

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bash ca-certificates chromium openbox x11-utils x11vnc xvfb novnc websockify socat tini \
      fonts-liberation fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/* \
 && ln -sf vnc.html /usr/share/novnc/index.html \
 && groupadd --gid 10003 desktop \
 && useradd --uid 10003 --gid 10003 --home-dir /profile --shell /usr/sbin/nologin --no-create-home desktop \
 && mkdir -p /profile /etc/chromium/policies/managed \
 && chown 10003:10003 /profile

# Managed policy: no local files, no developer tools surface that reads the container.
COPY chromium-policy.json /etc/chromium/policies/managed/policy.json
COPY entrypoint.sh /usr/local/bin/desktop-entrypoint
RUN chmod 0755 /usr/local/bin/desktop-entrypoint

ENV HOME=/profile DISPLAY=:99 DESKTOP_WIDTH=1440 DESKTOP_HEIGHT=900
USER 10003:10003
EXPOSE 6080 9223
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/desktop-entrypoint"]
