# Tailscale serve/funnel: target after the Cloudflare move (2026-11-13)

Matt, 2026-11-13 15:25 CST: "Move everything off Tailscale onto Cloudflare, SMS included, then turn off the Funnel."
Tailscale itself stays installed and connected (LAN/tailnet fallback). No public path may depend on it.

Before: `serve-before-20261113.json` (Funnel ON for :10000 NODE door and :8443 SMS relay).

| Port | Before | After | Cloudflare replacement |
|---|---|---|---|
| 10000 | Funnel (public): `/` -> 127.0.0.1:7700 door, `/tunnel` -> :7710 chisel | **Funnel OFF**; same handlers kept **tailnet-only** (approval links from the root-owned approval gateway still point here; machine enrollment `POST /machine-enroll` has no Access bypass on Cloudflare) | `node.voicecommandapi.com` (Access app "NODE apps", `/tunnel` via "node tunnel bypass") |
| 8443 | Funnel (public): `/send` `/inbound` `/sms-hook` -> 127.0.0.1:8787 relay | Funnel OFF only once every `/send` caller is on Cloudflare (see CultureReset/smsgw-relay docs/MIGRATION.md) | `sms.voicecommandapi.com` (Access apps "SMS relay" + "SMS relay webhooks bypass") |
| 4443, 7443, 12443, 13443, 14443, 16443, 17790 | tailnet-only | unchanged, tailnet-only | see report; nothing public depends on them |

Commands (tailscale 1.104):

```
tailscale funnel --https=10000 off           # removes the port's handlers too
tailscale serve --bg --https=10000 http://127.0.0.1:7700
tailscale serve --bg --https=10000 --set-path=/tunnel http://127.0.0.1:7710
# later, for 8443:
tailscale funnel --https=8443 off
```

Rollback: `tailscale funnel --bg --https=10000 http://127.0.0.1:7700` and
`tailscale funnel --bg --https=10000 --set-path=/tunnel http://127.0.0.1:7710` (same for 8443 per
smsgw-relay `deploy/tailscale/funnel-8443.current.txt`).

## Applied 2026-11-13 (CST)

- 15:38 `sms.voicecommandapi.com` live (tunnel restart once; `config/cloudflared-config.yml`).
- 15:42 Funnel OFF on :10000; :10000 re-added tailnet-only (`/` -> :7700, `/tunnel` -> :7710).
- 15:45 Funnel :8443 trimmed to `/send` only (`/inbound`, `/sms-hook` removed). `/send` stays public on Funnel
  **only** for the Supabase Edge Function `sms-inbound` (project cyber check), whose `RELAY_URL` secret still
  points at it and whose deployed code sends no Access headers. Finish per CultureReset/smsgw-relay docs/MIGRATION.md.
- After state: `serve-after-20261113.json`.
- Consumers moved: gcr-api-clean (Vercel prod+preview env + CultureReset/gcr-api-clean#120), sms-door PIN link
  (CultureReset/sms-door 08ecade). Not moved (need Matt): approval gateway in /opt/node-approvals (root-owned; its
  SMS/ntfy approval links and passkey rp_id are still the tailnet host; moving to node.voicecommandapi.com needs sudo
  and passkey re-enrollment); TV kiosk stays on tailnet :14443 (its Cloudflare Access session has expired, so
  node.voicecommandapi.com would show an interactive Access login on the TV).
