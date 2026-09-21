import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Router, HttpError, num, obj, str, sendJson } from "./router.js";
import { bus } from "./events.js";
import { status, uname } from "./modules/status.js";
import { listApps, launchApp, removeApp, launchWebapp, openPath, refreshAppsCache, providersInfo } from "./modules/apps.js";
import { catalog, addWebApp, removeWebApp } from "./modules/providers/webapps.js";
import { androidStatus, watchAndroid } from "./modules/providers/android.js";
import { getLayout, setLayout, type Layout } from "./modules/layout.js";
import { readIcon } from "./modules/icons.js";
import { listWindows, focusWindow, closeWindow, goHome, watchHyprland } from "./modules/windows.js";
import { listDir, recentFiles, searchFiles, newFolder, renamePath, trashPath, readText, readBinary, diskUsage } from "./modules/files.js";
import { listEvents, upsertEvent, deleteEvent } from "./modules/calendar.js";
import { searchPackages, listUpdates, updatesStatus, packageJob, installedPackages } from "./modules/packages.js";
import { icon as flathubIcon } from "./modules/providers/flathub.js";
import { getJob, listJobs } from "./modules/jobs.js";
import { audioDevices, setVolume, setMuted, setDefaultDevice } from "./modules/audio.js";
import { setBrightness, monitors, nightlight } from "./modules/display.js";
import { wifiNetworks, wifiConnect, wifiDisconnect, wifiForget, wifiRadio } from "./modules/network.js";
import { bluetoothDevices, bluetoothPower, bluetoothConnect, bluetoothScan, bluetoothForget } from "./modules/bluetooth.js";
import { power, powerProfiles, setPowerProfile, type PowerAction } from "./modules/power.js";
import { listThemes, setTheme, listBackgrounds, nextBackground, setBackground } from "./modules/theme.js";
import { listProviders, personasForWorld, ask } from "./modules/agents.js";
import { listWorlds, switchWorld, saveWorld, deleteWorld, type World } from "./modules/worlds.js";
import { weather } from "./modules/weather.js";
import { check } from "./modules/features.js";
import { TEMPLATES, listAutomations, saveAutomation, deleteAutomation, runAutomation, startScheduler } from "./modules/automations.js";
import { listNotifications, markRead, clearAll, sendDesktop, watchDbus } from "./modules/notifications.js";
import { backgroundPath } from "./modules/status.js";
import type { Automation, CalendarEvent } from "./types.js";
import { platformConfig, savePlatformConfig, isConnected } from "./platform/config.js";
import { platform, qs } from "./platform/client.js";
import { answer } from "./platform/answer.js";
import { CAPABILITIES } from "./platform/capabilities.js";
import { handle, handleAudio, reply, replyAloud, history, voiceStatus, type Channel } from "./voice/pipeline.js";
import { kernelStatus, collections as kernelCollections, read as kernelRead, act as kernelAct } from "./modules/kernel.js";
import { ask as kernelAsk } from "./modules/ask.js";

const PORT = Number(process.env.NODEOS_PORT ?? 7770);
const HOST = "127.0.0.1";
const here = path.dirname(fileURLToPath(import.meta.url));
const SHELL_DIST = process.env.NODEOS_SHELL_DIST ?? path.resolve(here, "../../shell/dist");

const api = new Router();

// ---- Status & events ------------------------------------------------------
api.get("/api/status", () => status());
api.get("/api/system", () => uname());
api.get("/api/events", ({ res }) => bus.attach(res));
api.get("/api/background", async ({ res }) => {
  const file = await backgroundPath();
  if (!file) throw new HttpError(404, "No background");
  const body = await readFile(file);
  res.writeHead(200, { "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "max-age=60" });
  res.end(body);
});

// ---- The business this box belongs to ------------------------------------
// The box holds no database credential. Everything here is a call to the
// platform, which is the only thing that touches the database.

api.get("/api/platform", async () => {
  const c = await platformConfig();
  return {
    connected: await isConnected(),
    baseUrl: c.baseUrl,
    slug: c.slug,
    businessName: c.businessName,
    capabilities: CAPABILITIES.map((x) => ({ key: x.key, summary: x.summary, phrases: x.phrases, readOnly: x.readOnly })),
  };
});

api.post("/api/platform/connect", async ({ body }) => {
  const b = obj(body);
  const saved = await savePlatformConfig({
    baseUrl: str(b.baseUrl, "baseUrl", { max: 300 }),
    token: str(b.token, "token", { max: 500 }),
    slug: str(b.slug, "slug", { max: 120 }),
    businessName: str(b.businessName, "businessName", { optional: true, max: 200 }) || "",
  });
  return { connected: true, slug: saved.slug, businessName: saved.businessName };
});

/** Ask the box something, deterministically. The voice and SMS paths call this
 *  same function, so a spoken question and a typed one cannot diverge. */
// The ask bar. When a kernel is attached the sentence becomes a task it
// decided on; with no kernel the box still answers from the platform it knows.
api.post("/api/ask", async ({ body }) => {
  const text = str(obj(body).text, "text", { max: 500 });
  const resource = str(obj(body).resource, "resource", { optional: true, max: 128 }) || "default";
  const k = await kernelStatus();
  return k.available ? kernelAsk(text, resource) : answer(text);
});

api.get("/api/business/menu", async () => {
  const { slug } = await platformConfig();
  return platform.get(`/api/dashboard/menu${qs({ slug })}`);
});

api.get("/api/business/hours", async () => {
  const { slug } = await platformConfig();
  return platform.get(`/api/dashboard/hours${qs({ slug })}`);
});

api.get("/api/business/reviews", async () => {
  const { slug } = await platformConfig();
  return platform.get(`/api/reviews${qs({ slug, limit: 20 })}`);
});

api.post("/api/business/menu/item", async ({ body }) => {
  const { slug } = await platformConfig();
  return platform.post(`/api/dashboard/menu/item${qs({ slug })}`, obj(body));
});

api.delete("/api/business/menu/item/:id", async ({ params }) => {
  const { slug } = await platformConfig();
  return platform.del(`/api/dashboard/menu/item/${encodeURIComponent(params.id)}${qs({ slug })}`);
});

api.get("/api/business/specials", async ({ query }) => {
  const { slug } = await platformConfig();
  return platform.get(`/api/dashboard/specials${qs({ slug, from: query.get("from") ?? "", to: query.get("to") ?? "" })}`);
});

api.delete("/api/business/specials/:id", async ({ params }) => {
  const { slug } = await platformConfig();
  return platform.del(`/api/dashboard/specials/${encodeURIComponent(params.id)}${qs({ slug })}`);
});

api.get("/api/business/availability", async ({ query }) => {
  const { slug } = await platformConfig();
  return platform.get(`/api/availability${qs({ slug, from: query.get("from") ?? "", to: query.get("to") ?? "" })}`);
});

// ---- Voice ---------------------------------------------------------------
// One entry point. A sentence spoken at the television, said down the phone,
// texted to the number or posted by a webhook is the same sentence, resolved
// the same way, so the box cannot say one thing in the room and another on the
// line. Hearing and speaking both happen here, on this machine.

api.get("/api/voice", () => voiceStatus());

// ---- Kernel ---------------------------------------------------------------
// The kernel decides; this screen renders. Every path below comes from the
// kernel's own handshake, so nothing here has to be edited when it changes.
api.get("/api/kernel", () => kernelStatus());
api.get("/api/kernel/collections", async () => ({ collections: await kernelCollections() }));
api.get("/api/kernel/read/:collection", (c) => kernelRead(c.params.collection));
api.post("/api/kernel/act/:action", (c) => {
  const b = obj(c.body);
  return kernelAct(c.params.action, b.body, b.id === undefined ? undefined : str(b.id, "id"));
});
api.get("/api/voice/history", ({ query }) => history(Number(query.get("limit") ?? 50)));

/** A transcript from anywhere — SIP, a carrier webhook, a VM. Text in, text out. */
api.post("/api/voice/text", async ({ body }) => {
  const b = obj(body);
  const turn = await handle(str(b.text, "text", { max: 1000 }), (str(b.channel, "channel", { optional: true, max: 16 }) || "webhook") as Channel);
  return turn;
});

/** Audio in, audio back. 16kHz mono WAV, base64. What a phone bridge posts. */
api.post("/api/voice/heard", async ({ body }) => {
  const b = obj(body);
  const wav = Buffer.from(str(b.wav, "wav", { max: 12_000_000 }), "base64");
  const turn = await handleAudio(wav, (str(b.channel, "channel", { optional: true, max: 16 }) || "phone") as Channel);
  const spoken = await reply(turn);
  return { ...turn, wav: spoken ? spoken.wav.toString("base64") : null, engine: spoken?.engine ?? "none" };
});

/** Turn any sentence into speech. The phone plays what comes back. */
api.post("/api/voice/say", async ({ body }) => {
  const spoken = await reply({ said: "", reply: str(obj(body).text, "text", { max: 2000 }), lines: [], via: "router", channel: "phone", at: new Date().toISOString() });
  if (!spoken) throw new HttpError(503, "No voice is installed on this box yet.");
  return { wav: spoken.wav.toString("base64"), engine: spoken.engine, sampleRate: spoken.sampleRate };
});

/** Say it in the room, on this machine's own speakers. */
api.post("/api/voice/aloud", async ({ body }) => {
  const turn = await handle(str(obj(body).text, "text", { max: 1000 }), "screen");
  return { ...turn, spoken: await replyAloud(turn) };
});

/** An inbound text to the SIM. Same path; the reply is sent by whatever asked. */
api.post("/api/voice/sms", async ({ body }) => {
  const b = obj(body);
  const turn = await handle(str(b.text, "text", { max: 1000 }), "sms");
  return { from: str(b.from, "from", { optional: true, max: 32 }) || null, reply: turn.reply, capability: turn.capability ?? null, via: turn.via };
});

// ---- Apps ----------------------------------------------------------------
api.get("/api/apps", ({ query }) => listApps(query.has("all")));
api.get("/api/apps/providers", () => providersInfo());
api.post("/api/apps/refresh", async () => {
  await refreshAppsCache();
  return listApps();
});
api.post("/api/apps/launch", ({ body }) => launchApp(str(obj(body).id, "id", { max: 256 })));
api.post("/api/apps/remove", ({ body }) => removeApp(str(obj(body).id, "id", { max: 256 })));
api.get("/api/webapps/catalog", () => catalog());
api.post("/api/webapps/add", ({ body }) => {
  const b = obj(body);
  return addWebApp({ slug: str(b.slug, "slug", { optional: true, max: 64 }) || undefined, name: str(b.name, "name", { optional: true, max: 64 }) || undefined, url: str(b.url, "url", { optional: true, max: 2048 }) || undefined, color: str(b.color, "color", { optional: true, max: 16 }) || undefined });
});
api.post("/api/webapps/remove", ({ body }) => removeWebApp(str(obj(body).slug, "slug", { max: 64 })));
api.get("/api/android", () => androidStatus());
api.get("/api/layout", () => getLayout());
api.get("/api/worlds", () => listWorlds());
api.post("/api/worlds", ({ body }) => saveWorld(obj(body) as Partial<World>));
api.post("/api/worlds/switch", ({ body }) => switchWorld(str(obj(body).id, "id", { max: 32 }), str(obj(body).pin, "pin", { optional: true, max: 8 }) || undefined).then(({ pin, ...w }) => w));
api.delete("/api/worlds/:id", ({ params }) => deleteWorld(params.id));
api.get("/api/weather", async () => weather((await getLayout()).weatherLocation));
api.get("/api/features/:tool", ({ params }) => check(params.tool));
api.post("/api/layout", ({ body }) => setLayout(obj(body) as Partial<Layout>));
api.post("/api/apps/webapp", async ({ body }) => ({ ok: await launchWebapp(str(obj(body).url, "url")) }));
api.post("/api/open", async ({ body }) => ({ ok: await openPath(str(obj(body).target, "target")) }));
api.get("/api/icon/:name", async ({ params, res }) => {
  const icon = await readIcon(params.name);
  if (!icon) throw new HttpError(404, "No icon");
  res.writeHead(200, { "Content-Type": icon.type, "Cache-Control": "max-age=3600" });
  res.end(icon.body);
});

// ---- Windows (Hyprland) ------------------------------------------------
api.get("/api/windows", () => listWindows());
api.post("/api/windows/focus", async ({ body }) => ({ ok: await focusWindow(str(obj(body).address, "address")) }));
api.post("/api/windows/close", async ({ body }) => ({ ok: await closeWindow(str(obj(body).address, "address")) }));
api.post("/api/home", async () => ({ ok: await goHome() }));

// ---- Files --------------------------------------------------------------
api.get("/api/files", ({ query }) => listDir(query.get("path") ?? "~", query.has("hidden")));
api.get("/api/files/recent", () => recentFiles());
api.get("/api/files/search", ({ query }) => searchFiles(str(query.get("q"), "q", { max: 100 })));
api.get("/api/files/disk", () => diskUsage());
api.get("/api/files/text", ({ query }) => readText(str(query.get("path"), "path")).then((text) => ({ text })));
api.get("/api/files/raw", async ({ query, res }) => {
  const { body, type } = await readBinary(str(query.get("path"), "path"));
  res.writeHead(200, { "Content-Type": type, "Content-Length": body.length, "Cache-Control": "no-store" });
  res.end(body);
});
api.post("/api/files/folder", async ({ body }) => newFolder(str(obj(body).parent, "parent"), str(obj(body).name, "name", { max: 255 })));
api.post("/api/files/rename", async ({ body }) => renamePath(str(obj(body).path, "path"), str(obj(body).name, "name", { max: 255 })));
api.post("/api/files/trash", ({ body }) => trashPath(str(obj(body).path, "path")));

// ---- Calendar -----------------------------------------------------------
api.get("/api/calendar", ({ query }) => listEvents(query.get("from") ?? undefined, query.get("to") ?? undefined));
api.post("/api/calendar", ({ body }) => upsertEvent(obj(body) as Partial<CalendarEvent>));
api.delete("/api/calendar/:id", ({ params }) => deleteEvent(params.id));

// ---- Store & updates ----------------------------------------------------
api.get("/api/store/search", ({ query }) => searchPackages(query.get("q") ?? ""));
api.get("/api/store/installed", () => installedPackages());
api.get("/api/store/updates", () => listUpdates());
api.get("/api/store/status", () => updatesStatus());
api.post("/api/store/install", ({ body }) => {
  const b = obj(body);
  return packageJob("install", str(b.appId ?? b.name, "name", { max: 255 }), b.source === "flathub" ? "flathub" : b.source === "pacman" ? "pacman" : undefined);
});
api.post("/api/store/remove", ({ body }) => {
  const b = obj(body);
  return packageJob("remove", str(b.appId ?? b.name, "name", { max: 255 }), b.source === "flathub" ? "flathub" : b.source === "pacman" ? "pacman" : undefined);
});
api.get("/api/store/icon/:id", async ({ params, res }) => {
  const img = await flathubIcon(params.id);
  if (!img) throw new HttpError(404, "No icon");
  res.writeHead(200, { "Content-Type": img.type, "Cache-Control": "max-age=86400" });
  res.end(img.body);
});
api.post("/api/store/update", () => packageJob("update"));
api.get("/api/jobs", () => listJobs());
api.get("/api/jobs/:id", ({ params }) => getJob(params.id) ?? (() => { throw new HttpError(404, "No such job"); })());

// ---- Settings: audio, display, network, bluetooth, power, appearance --
api.get("/api/audio/devices", () => audioDevices());
api.post("/api/audio/volume", ({ body }) => setVolume(num(obj(body).volume, "volume", 0, 100)));
api.post("/api/audio/mute", ({ body }) => setMuted(Boolean(obj(body).muted)));
api.post("/api/audio/default", ({ body }) => setDefaultDevice(str(obj(body).id, "id", { max: 16 })));
api.post("/api/display/brightness", ({ body }) => setBrightness(num(obj(body).brightness, "brightness", 1, 100)));
api.get("/api/display/monitors", () => monitors());
api.post("/api/display/nightlight", ({ body }) => nightlight(Boolean(obj(body).on)));
api.get("/api/wifi", ({ query }) => wifiNetworks(query.has("rescan")));
api.post("/api/wifi/connect", ({ body }) => wifiConnect(str(obj(body).ssid, "ssid", { max: 64 }), str(obj(body).password, "password", { optional: true, max: 128 }) || undefined));
api.post("/api/wifi/disconnect", () => wifiDisconnect());
api.post("/api/wifi/forget", ({ body }) => wifiForget(str(obj(body).ssid, "ssid", { max: 64 })));
api.post("/api/wifi/radio", ({ body }) => wifiRadio(Boolean(obj(body).on)));
api.get("/api/bluetooth", () => bluetoothDevices());
api.post("/api/bluetooth/power", ({ body }) => bluetoothPower(Boolean(obj(body).on)));
api.post("/api/bluetooth/scan", () => bluetoothScan().then(() => bluetoothDevices()));
api.post("/api/bluetooth/connect", ({ body }) => bluetoothConnect(str(obj(body).mac, "mac", { max: 17 }), obj(body).connect !== false));
api.post("/api/bluetooth/forget", ({ body }) => bluetoothForget(str(obj(body).mac, "mac", { max: 17 })));
api.post("/api/power", ({ body }) => {
  const action = str(obj(body).action, "action", { max: 16 });
  if (!["lock", "sleep", "restart", "shutdown", "logout"].includes(action)) throw new HttpError(400, "Unknown action");
  return power(action as PowerAction);
});
api.get("/api/power/profiles", () => powerProfiles());
api.post("/api/power/profile", ({ body }) => setPowerProfile(str(obj(body).name, "name", { max: 32 })));
api.get("/api/themes", () => listThemes());
api.post("/api/themes/set", ({ body }) => setTheme(str(obj(body).name, "name", { max: 64 })));
api.get("/api/backgrounds", () => listBackgrounds());
api.post("/api/backgrounds/next", () => nextBackground());
api.post("/api/backgrounds/set", ({ body }) => setBackground(str(obj(body).file, "file")));

// ---- Agents & automations ------------------------------------------------
api.get("/api/agents", async () => ({ providers: await listProviders(), personas: (await personasForWorld()).map(({ system, ...p }) => p) }));
api.post("/api/agents/ask", ({ body }) => {
  const b = obj(body);
  return ask(str(b.prompt, "prompt", { max: 8000 }), str(b.persona, "persona", { optional: true, max: 32 }) || "general", str(b.provider, "provider", { optional: true, max: 32 }) || undefined);
});
api.get("/api/automations", async () => ({ items: await listAutomations(), templates: TEMPLATES }));
api.post("/api/automations", ({ body }) => saveAutomation(obj(body) as Partial<Automation>));
api.post("/api/automations/:id/run", async ({ params }) => ({ jobId: await runAutomation(params.id) }));
api.delete("/api/automations/:id", ({ params }) => deleteAutomation(params.id));

// ---- Notifications ------------------------------------------------------
api.get("/api/notifications", () => listNotifications());
api.post("/api/notifications/read", ({ body }) => markRead(obj(body).all ? "all" : ((obj(body).ids as string[]) ?? [])));
api.post("/api/notifications/clear", () => clearAll());
api.post("/api/notifications/send", ({ body }) => sendDesktop(str(obj(body).title, "title", { max: 200 }), str(obj(body).body, "body", { optional: true, max: 1000 })));

// ---- Static shell -------------------------------------------------------
const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  let file = path.join(SHELL_DIST, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(SHELL_DIST)) file = path.join(SHELL_DIST, "index.html");
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = path.join(file, "index.html");
  } catch {
    file = path.join(SHELL_DIST, "index.html"); // SPA fallback
  }
  try {
    const body = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream", "Cache-Control": ext === ".html" ? "no-store" : "max-age=31536000, immutable" });
    res.end(body);
  } catch {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><meta charset=utf-8><title>NODE</title><body style="font-family:system-ui;background:#0b0f14;color:#e6e9ef;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="letter-spacing:.4em">NODE</h1><p>The daemon is running, but the shell has not been built yet.<br>Run <code>npm run build</code> in the NODE checkout.</p></div>`);
  }
}

const server = http.createServer(async (req, res) => {
  // Only ever talk to the local shell. A browser tab on another origin cannot
  // read responses (no CORS headers) and cannot POST (JSON body forces preflight).
  const origin = req.headers.origin;
  if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    sendJson(res, 403, { error: "Forbidden origin" });
    return;
  }
  if (req.url?.startsWith("/api/")) {
    if (!(await api.handle(req, res))) sendJson(res, 404, { error: "Not found" });
    return;
  }
  await serveStatic(req, res);
});

server.listen(PORT, HOST, async () => {
  const s = await status();
  console.log(`NODE daemon listening on http://${HOST}:${PORT}${s.demo ? " (demo mode: no compositor detected)" : ""}`);
  void watchHyprland();
  void watchDbus();
  void watchAndroid();
  startScheduler();
  // Periodic status heartbeat keeps battery, network and clock fresh in the shell.
  setInterval(async () => {
    if (bus.size > 0) bus.emit("status", await status());
  }, 20_000).unref();
});

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => server.close(() => process.exit(0)));
