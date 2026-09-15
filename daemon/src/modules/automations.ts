import { id } from "../store.js";
import { WorldStore } from "./worlds.js";
import { bus } from "../events.js";
import { HttpError } from "../router.js";
import { launchDetached, stream } from "../exec.js";
import { ask } from "./agents.js";
import { launchApp } from "./apps.js";
import { createJob, appendLine, finishJob } from "./jobs.js";
import { isDemo } from "./status.js";
import type { Automation } from "../types.js";

/**
 * Automations are small scheduled jobs the user builds from templates:
 * "ask an agent every morning", "open an app at 9", "run a command weekly".
 * They live in one JSON file and run inside the daemon (no cron, no terminal).
 */
export const TEMPLATES: Array<Omit<Automation, "id" | "enabled" | "lastRun" | "lastStatus" | "nextRun">> = [
  { name: "Morning Brief", description: "News, email, calendar", icon: "newspaper", kind: "agent", payload: "Give me a short morning brief: today's calendar, anything urgent, and one thing to focus on.", schedule: { type: "daily", time: "07:00" } },
  { name: "Review Watch", description: "Track product reviews", icon: "star", kind: "agent", payload: "Check for new customer reviews and summarise sentiment and anything that needs a reply.", schedule: { type: "interval", minutes: 240 } },
  { name: "Inventory Watch", description: "Track stock & alerts", icon: "package", kind: "agent", payload: "Look at the inventory spreadsheet in ~/Documents and list items that are running low.", schedule: { type: "daily", time: "08:00" } },
  { name: "Weekly Sales Report", description: "Compile and send report", icon: "bar-chart", kind: "agent", payload: "Compile this week's sales into a short report and save it to ~/Documents/Reports.", schedule: { type: "weekly", weekday: 1, time: "09:00" } },
  { name: "Social Media Scheduler", description: "Plan and publish content", icon: "megaphone", kind: "agent", payload: "Draft three social posts for this week based on what's new in ~/Documents/Marketing.", schedule: { type: "weekly", weekday: 1, time: "15:00" } },
  { name: "Travel Watch", description: "Monitor flights & prices", icon: "plane", kind: "agent", payload: "Check saved trips in ~/Documents/Travel and report price changes.", schedule: { type: "daily", time: "18:00" } },
  { name: "Invoice Organizer", description: "Sort and file receipts", icon: "file-text", kind: "agent", payload: "Move new receipts from ~/Downloads into ~/Documents/Invoices/<year>/<month> and rename them consistently.", schedule: { type: "daily", time: "21:00" } },
  { name: "Open Music at 9", description: "Start the day with a playlist", icon: "music", kind: "open", payload: "linux:spotify", schedule: { type: "daily", time: "09:00" } },
];

const store = new WorldStore<Automation[]>("automations", () => []);
let timer: NodeJS.Timeout | null = null;

function computeNext(a: Automation, from = new Date()): string | undefined {
  const s = a.schedule;
  if (s.type === "manual") return undefined;
  if (s.type === "interval") return new Date(from.getTime() + (s.minutes ?? 60) * 60000).toISOString();
  const [h, m] = (s.time ?? "09:00").split(":").map(Number);
  const next = new Date(from);
  next.setHours(h, m, 0, 0);
  if (s.type === "daily") {
    if (next <= from) next.setDate(next.getDate() + 1);
  } else if (s.type === "weekly") {
    const wd = s.weekday ?? 1;
    while (next.getDay() !== wd || next <= from) next.setDate(next.getDate() + 1);
    next.setHours(h, m, 0, 0);
  }
  return next.toISOString();
}

export async function listAutomations(): Promise<Automation[]> {
  return store.read();
}

export async function saveAutomation(input: Partial<Automation>): Promise<Automation> {
  if (!input.name || !input.kind || !input.payload) throw new HttpError(400, "name, kind and payload are required");
  const a: Automation = {
    id: input.id ?? id(),
    name: input.name.slice(0, 80),
    description: (input.description ?? "").slice(0, 200),
    icon: input.icon ?? "zap",
    kind: input.kind,
    payload: input.payload.slice(0, 4000),
    schedule: input.schedule ?? { type: "manual" },
    enabled: input.enabled ?? true,
    lastRun: input.lastRun,
    lastStatus: input.lastStatus,
  };
  a.nextRun = a.enabled ? computeNext(a) : undefined;
  await store.update((all) => [...all.filter((x) => x.id !== a.id), a]);
  bus.emit("automations", await store.read());
  return a;
}

export async function deleteAutomation(autoId: string): Promise<void> {
  await store.update((all) => all.filter((x) => x.id !== autoId));
  bus.emit("automations", await store.read());
}

export async function runAutomation(autoId: string, worldStore?: { read(): Promise<Automation[]>; update(fn: (c: Automation[]) => Automation[]): Promise<Automation[]> }): Promise<string | undefined> {
  const s = worldStore ?? store;
  const a = (await s.read()).find((x) => x.id === autoId);
  if (!a) throw new HttpError(404, "Automation not found");
  let jobId: string | undefined;
  let ok = true;
  if (a.kind === "agent") {
    const job = await ask(a.payload, "general");
    jobId = job.id;
  } else if (a.kind === "open") {
    ok = (await launchApp(a.payload.includes(":") ? a.payload : `linux:${a.payload}`)).ok;
  } else {
    const job = createJob("automation", a.name);
    jobId = job.id;
    if (await isDemo()) {
      appendLine(job, `$ ${a.payload}`);
      appendLine(job, "(demo) ok");
      finishJob(job, true);
    } else {
      const code = await stream("bash", ["-lc", a.payload], (line) => appendLine(job, line));
      ok = code === 0;
      finishJob(job, ok);
    }
  }
  await s.update((all) => all.map((x) => (x.id === a.id ? { ...x, lastRun: new Date().toISOString(), lastStatus: ok ? "ok" : "failed", nextRun: x.enabled ? computeNext(x) : undefined } : x)));
  bus.emit("automations", await store.read());
  return jobId;
}

/** Poll once a minute; fire anything whose nextRun has passed. */
export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(async () => {
    const now = Date.now();
    for (const { store: ws } of await store.all()) {
      for (const a of await ws.read()) {
        if (a.enabled && a.nextRun && Date.parse(a.nextRun) <= now) {
          try {
            await runAutomation(a.id, ws);
          } catch {
            /* recorded in lastStatus */
          }
        }
      }
    }
  }, 60_000);
  timer.unref();
}

export function openExternal(url: string): boolean {
  return launchDetached("xdg-open", [url]);
}
