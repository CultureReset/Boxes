import { createGcrAdapter, renderSurface, type Manifest } from "@nextgent/app-engine";
import { HttpError, obj, str, type Router } from "../router.js";
import { transcribe, model as sttModel } from "../voice/stt.js";
import { env } from "./env.js";
import { companyId, gcr, linkState, list, paperclip, relay, settle } from "./cloud.js";
import { readCreds, paired, accountLinked } from "./creds.js";
import { pairingView, qrSvg, startPairing, forgetPairing } from "./pairing.js";
import { calendar, dropCopy, isoDay, approvalTitle, startCalendarRefresh } from "./calendar.js";
import { phoneMirror, phoneStatus } from "./phone.js";

const enc = encodeURIComponent;
const q = (o: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : "";
};
const day = (v: string | null, fallback: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback);
const pc = async (path: string) => `/companies/${enc(await companyId())}${path}`;

/**
 * Which agent the owner talks to: the company's front door, as Play-user picks
 * it (src/app/useAssistant.js) — the active agent at the top of the org chart,
 * oldest first. No name is assumed.
 */
function pickAssistant(agents: Record<string, unknown>[]) {
  const active = agents.filter((a) => a.status !== "terminated");
  const top = active.filter((a) => !a.reportsTo);
  const pool = top.length ? top : active;
  return [...pool].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0] ?? null;
}

export function registerNextgent(api: Router): void {
  startCalendarRefresh();

  /* ── who this computer is ─────────────────────────────────────────────── */

  api.get("/api/nextgent", async () => {
    const e = env();
    const c = await readCreds();
    return {
      configured: { paperclip: Boolean(e.paperclipUrl), gcr: Boolean(e.gcrUrl), phone: Boolean(e.androidUrl && e.deviceId), events: Boolean(e.eventsSection) },
      paired: paired(c),
      accountLinked: accountLinked(c),
      company: c.account ? { id: c.account.companyId, name: c.account.companyName ?? "" } : null,
      computer: c.node ?? null,
      pairedAt: c.pairedAt ?? null,
      brand: e.brand,
      link: linkState(),
      pairing: pairingView(),
    };
  });

  api.post("/api/nextgent/pair", () => startPairing());
  api.get("/api/nextgent/pair", () => pairingView());
  api.get("/api/nextgent/pair/qr.svg", ({ res }) => {
    const link = pairingView().link;
    if (!link) throw new HttpError(404, "No pairing link to show.");
    const svg = qrSvg(link);
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
    res.end(svg);
  });
  api.post("/api/nextgent/forget", async () => {
    await forgetPairing();
    await dropCopy();
    return { ok: true };
  });

  /* ── the day ──────────────────────────────────────────────────────────── */

  api.get("/api/nextgent/calendar", ({ query }) => {
    const today = isoDay(new Date());
    const from = day(query.get("from"), today);
    const to = day(query.get("to"), from);
    if (to < from) throw new HttpError(400, "to is before from");
    return calendar(from, to);
  });

  /** Home at a glance: each part settles on its own, so one dead source costs only its tile. */
  api.get("/api/nextgent/home", async () => {
    const c = await readCreds();
    if (!paired(c) || !accountLinked(c)) return { paired: paired(c), accountLinked: false };
    const today = isoDay(new Date());
    const [bookings, threads, payments, approvals, store, receipts, activity, agents] = await Promise.all([
      settle(async () => list(await gcr("GET", `/owner/bookings${q({ from: today, to: today })}`), "bookings")),
      settle(async () => list(await gcr("GET", "/owner/messages/threads"), "threads")),
      settle(async () => list(await gcr("GET", `/owner/payments${q({ from: today, to: today })}`), "payments")),
      settle(async () => list(await paperclip("GET", await pc(`/approvals${q({ status: "pending" })}`)), "approvals")),
      settle(async () => list(await paperclip("GET", await pc("/store")), "items")),
      settle(async () => list(await paperclip("GET", await pc(`/receipts${q({ limit: 50 })}`)), "receipts")),
      settle(async () => list(await paperclip("GET", await pc(`/activity${q({ limit: 20 })}`)), "activity")),
      settle(async () => list(await paperclip("GET", await pc("/agents")), "agents")),
    ]);
    return {
      paired: true,
      accountLinked: true,
      bookings,
      threads,
      payments,
      approvals: { ...approvals, data: approvals.data?.map((a) => ({ ...a, title: approvalTitle(a) })) ?? null },
      updates: { ...store, data: store.data?.filter((i) => i.installed && i.updateAvailable) ?? null },
      receipts,
      activity,
      agents,
      link: linkState(),
    };
  });

  /* ── approvals: the same Paperclip routes Play-user uses ──────────────── */

  api.get("/api/nextgent/approvals", async () =>
    relay(async () => list(await paperclip("GET", await pc(`/approvals${q({ status: "pending" })}`)), "approvals").map((a) => ({ ...a, title: approvalTitle(a) }))),
  );
  for (const decision of ["approve", "reject"] as const) {
    api.post(`/api/nextgent/approvals/:id/${decision}`, ({ params, body }) =>
      relay(() => paperclip("POST", `/approvals/${enc(params.id)}/${decision}`, { decisionNote: str(obj(body).note, "note", { optional: true, max: 2000 }) || undefined })),
    );
  }

  /* ── agents ───────────────────────────────────────────────────────────── */

  api.get("/api/nextgent/agents", async () => {
    const [agents, working] = await Promise.all([
      settle(async () => list(await paperclip("GET", await pc("/agents")), "agents")),
      settle(async () => list(await paperclip("GET", await pc(`/issues${q({ status: "in_progress,todo", limit: 100 })}`)), "issues")),
    ]);
    const assistant = agents.data ? pickAssistant(agents.data) : null;
    return { agents, working, assistantId: assistant?.id ?? null };
  });

  /* ── Ask: a conversation with an agent in the cloud (Paperclip chats) ─── */

  /** Open (or create) the conversation with an agent; the company's assistant when none is named. */
  api.post("/api/nextgent/ask/chat", async ({ body }) =>
    relay(async () => {
      const agents = list(await paperclip("GET", await pc("/agents")), "agents");
      const wanted = str(obj(body).agentId, "agentId", { optional: true, max: 128 });
      const agent = wanted ? agents.find((a) => a.id === wanted) : pickAssistant(agents);
      if (!agent) throw new HttpError(404, "No agent to talk to yet. The account's assistant is created when the account is set up.");
      const chat = (await paperclip<Record<string, unknown>>("POST", await pc(`/chats/${enc(String(agent.urlKey || agent.id))}`), {})) ?? {};
      return { agent, chatId: chat.id };
    }),
  );
  api.get("/api/nextgent/ask/chat/:id", ({ params }) => relay(async () => list(await paperclip("GET", `/issues/${enc(params.id)}/comments`), "comments")));
  api.post("/api/nextgent/ask/chat/:id", ({ params, body }) =>
    relay(() => paperclip("POST", `/issues/${enc(params.id)}/comments`, { body: str(obj(body).text, "text", { max: 8000 }) })),
  );

  /** Speech to text on this computer (whisper), so the TV's microphone needs no cloud service. */
  api.post("/api/nextgent/voice/transcribe", async ({ body }) => {
    if ((await sttModel()) === "none") throw new HttpError(503, "No speech recognition is installed on this computer.");
    const wav = Buffer.from(str(obj(body).wav, "wav", { max: 12_000_000 }), "base64");
    return { text: (await transcribe(wav)).trim() };
  });
  api.get("/api/nextgent/voice", async () => ({ stt: await sttModel() }));

  /* ── messages: gcr-api-clean /api/owner/messages (Play-user's shapes) ─── */

  api.get("/api/nextgent/messages", () => relay(() => gcr("GET", "/owner/messages/threads")));
  api.get("/api/nextgent/messages/:id", ({ params }) => relay(() => gcr("GET", `/owner/messages/threads/${enc(params.id)}`)));
  api.post("/api/nextgent/messages/:id/send", ({ params, body }) =>
    relay(() => gcr("POST", `/owner/messages/threads/${enc(params.id)}/send`, { text: str(obj(body).text, "text", { max: 4000 }) })),
  );

  /* ── activity and receipts ────────────────────────────────────────────── */

  api.get("/api/nextgent/activity", async () => {
    const [receipts, activity, agents] = await Promise.all([
      settle(async () => list(await paperclip("GET", await pc(`/receipts${q({ limit: 100 })}`)), "receipts")),
      settle(async () => list(await paperclip("GET", await pc(`/activity${q({ limit: 100 })}`)), "activity")),
      settle(async () => list(await paperclip("GET", await pc("/agents")), "agents")),
    ]);
    const names = Object.fromEntries((agents.data ?? []).map((a) => [String(a.id), String(a.name ?? "")]));
    return { receipts, activity, names };
  });

  /* ── installed apps, drawn by the shared engine ───────────────────────── */

  api.get("/api/nextgent/apps", async () => settle(async () => list(await paperclip("GET", await pc("/store")), "items")));

  /**
   * An installed app's TV card: the engine's renderSurface for the manifest's
   * widget surface, with the install's own token (it reaches only what the
   * owner approved for that install).
   */
  api.get("/api/nextgent/apps/:itemId/tv", async ({ params }) =>
    relay(async () => {
      const items = list(await paperclip("GET", await pc("/store")), "items");
      const item = items.find((i) => i.id === params.itemId);
      if (!item || !item.installed) throw new HttpError(404, "That app is not installed.");
      const manifest = (item.app ?? item.manifest ?? null) as Manifest | null;
      const installId = typeof item.installId === "string" ? item.installId : null;
      if (!manifest || !installId) return { available: false, reason: "missing_manifest" };
      const surface = (manifest.surfaces ?? []).find((s) => s.kind === "widget");
      if (!surface) return { available: false, reason: "no_tv_surface" };
      const tokenPath = await pc(`/installs/${enc(installId)}/token`);
      const adapter = createGcrAdapter({
        baseUrl: `${env().gcrUrl}/api`,
        timeoutMs: env().timeoutMs,
        getToken: async () => String((await paperclip<{ token?: string }>("POST", tokenPath, {}))?.token ?? ""),
      });
      const loaded = await adapter.load(manifest, surface.id);
      const blocks = renderSurface(manifest, surface.id, loaded.settings, loaded.data, { granted: loaded.granted }, {});
      return { available: true, surface: surface.id, blocks, errors: Object.fromEntries(Object.entries(loaded.errors).map(([k, v]) => [k, (v as Error).message])) };
    }),
  );

  /* ── the agent phone: shown here, driven only by nextgent-platform ────── */

  api.get("/api/nextgent/phone", () => phoneStatus());
  api.post("/api/nextgent/phone/mirror", () => phoneMirror());
}
