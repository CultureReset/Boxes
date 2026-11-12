# Permanent rule: Cloudflare Access for every app

Every service-facing tile and link in NODE must use a Cloudflare Access
hostname (`https://*.voicecommandapi.com`). Tailscale Funnel/Serve URLs and
raw IPs are not allowed as the public front door. Tailscale remains a LAN
fallback only.

## New app or service

1. Create the Cloudflare hostname, DNS CNAME (to the named tunnel), and an
   Access application with the same "Matt only" policy as the other
   `*.voicecommandapi.com` apps. Do not put the hostname on the live tunnel
   until Access is in front.
2. Commit the URL to GitHub (`config/webapps.json` and, if it has start/stop
   controls, `config/services-control.json`).
3. Apply live.

The daemon enforces this: `addWebApp` rejects any other URL, the catalog
omits them, and the service-control panel will not show a Tailscale link.
See `daemon/src/cloudflare-access-url.ts`.
