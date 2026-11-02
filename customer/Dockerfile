# syntax=docker/dockerfile:1
#
# One customer's NODE: the daemon plus the React shell, in a small non-root image.
#
#   docker build -f customer/Dockerfile -t nodeos-customer:local .
#
# Build context is the repository root (see /.dockerignore).
#
# What this image deliberately does NOT contain: adb, scrcpy, xwd, ImageMagick,
# systemd, a docker CLI, or any of the platform owner's host configuration
# (config/ is excluded by .dockerignore). The daemon runs with NODEOS_MODE=customer,
# which also turns those features off in code.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---- build ------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /src

# Manifests first so the dependency layer is cached. apps/menu is a workspace of
# the root package.json; only its manifest is needed to resolve the lockfile.
COPY package.json package-lock.json .npmrc ./
COPY daemon/package.json daemon/
COPY shell/package.json shell/
COPY apps/menu/package.json apps/menu/
RUN npm ci --workspace=daemon --workspace=shell --include-workspace-root

COPY daemon daemon
COPY shell shell

# Typechecks and builds both. Fails the image build if either does not compile.
RUN npm run build
# The daemon tests include the customer-mode checks.
RUN npm test --workspace=daemon

# Test files are not shipped (they quote the owner's values on purpose).
RUN find daemon/dist -name '*.test.js' -delete

# Replace the compiled platform-owner defaults (owner name, Paperclip company and
# lead ids, tailnet hostnames, host upload path) with empty strings, then fail the
# build if any of them is still anywhere in the daemon output. The keys must match
# daemon/src/homeDefaults.ts; a daemon test checks that they do.
RUN printf '%s\n' 'export const HOME_DEFAULTS = { ownerName: "", paperclipCompany: "", paperclipLead: "", doorPublic: "", nodePublic: "", uploadDir: "" };' > daemon/dist/homeDefaults.js \
 && ! grep -rIlE 'ffaab782-ce21|19db7bc5-ff7f|tail1af4f2|steve-ms|/home/steve|/hdd/home|From Matt' daemon/dist --include='*.js'

# ---- run --------------------------------------------------------------------
FROM ${NODE_IMAGE} AS run

# Streaming proxy settings (HTTP_PROXY with NODE_USE_ENV_PROXY=1) need Node 22.21+.
RUN node -e "const [a,b]=process.versions.node.split('.').map(Number); if (a<22 || (a===22 && b<21)) { console.error('Node 22.21+ required, got '+process.version); process.exit(1) }"

# A dedicated unprivileged user. 10001 is also what the compose file runs as.
RUN groupadd --gid 10001 nodeos \
 && useradd --uid 10001 --gid 10001 --home-dir /data/home --shell /usr/sbin/nologin --no-create-home nodeos \
 && mkdir -p /data/home /data/data /data/uploads /app \
 && chown -R 10001:10001 /data

WORKDIR /app
# The daemon has no runtime npm dependencies, so there is no node_modules here.
# daemon/package.json is kept because it carries "type": "module".
COPY --from=build /src/package.json ./package.json
COPY --from=build /src/daemon/package.json ./daemon/package.json
COPY --from=build /src/daemon/dist ./daemon/dist
COPY --from=build /src/shell/dist ./shell/dist

ENV NODE_ENV=production \
    NODEOS_MODE=customer \
    NODEOS_HOST=0.0.0.0 \
    NODEOS_PORT=7770 \
    HOME=/data/home \
    NODEOS_DATA_DIR=/data/data \
    NODEOS_UPLOAD_DIR=/data/uploads

USER 10001:10001
EXPOSE 7770
VOLUME ["/data"]

# Loopback is trusted by the daemon, so this needs no credentials. NO_PROXY is set
# by the compose file; the healthcheck talks to 127.0.0.1 only.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:7770/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "daemon/dist/index.js"]
