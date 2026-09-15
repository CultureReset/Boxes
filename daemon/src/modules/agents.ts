import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { has, stream } from "../exec.js";
import { HOME } from "../paths.js";
import { createJob, appendLine, finishJob } from "./jobs.js";
import { answer } from "../platform/answer.js";
import { isConnected } from "../platform/config.js";
import { isDemo } from "./status.js";
import { activeWorld } from "./worlds.js";
import type { Job } from "../types.js";

/**
 * NODE does not ship a model of its own. It drives whichever coding agent CLI
 * the user already has (the same set Omarchy supports) in headless mode and
 * streams the answer back into the shell. No terminal is ever shown.
 */
export interface AgentProvider {
  id: string;
  name: string;
  installed: boolean;
  isDefault: boolean;
}

const PROVIDERS: Array<{ id: string; name: string; bin: string; args: (prompt: string) => string[] }> = [
  { id: "claude", name: "Claude Code", bin: "claude", args: (p) => ["-p", p, "--output-format", "text"] },
  { id: "codex", name: "Codex", bin: "codex", args: (p) => ["exec", p] },
  { id: "opencode", name: "OpenCode", bin: "opencode", args: (p) => ["run", p] },
  { id: "copilot", name: "GitHub Copilot", bin: "copilot", args: (p) => ["-p", p, "--allow-all"] },
  { id: "crush", name: "Crush", bin: "crush", args: (p) => ["run", p] },
  { id: "pi", name: "Pi", bin: "pi", args: (p) => ["-p", p] },
];

async function defaultAgentId(): Promise<string | null> {
  try {
    return (await readFile(path.join(HOME, ".config/omarchy/defaults/agent"), "utf8")).trim() || null;
  } catch {
    return null;
  }
}

export async function listProviders(): Promise<AgentProvider[]> {
  const def = await defaultAgentId();
  const out: AgentProvider[] = [];
  for (const p of PROVIDERS) out.push({ id: p.id, name: p.name, installed: await has(p.bin), isDefault: p.id === def });
  if (!out.some((p) => p.isDefault)) {
    const first = out.find((p) => p.installed);
    if (first) first.isDefault = true;
  }
  return out;
}

/**
 * The specialised-agent workforce. Each agent has a narrow role and a
 * limited remit spelled out in its system prompt; the Orchestrator ("auto")
 * reads the request and hands it to the right specialist. All of them run on
 * the same installed CLI: the specialisation is in the brief, the allowed
 * scope, and which worlds may use them.
 */
export interface Persona {
  name: string;
  tagline: string;
  description: string;
  system: string;
  /** Plain-language scope shown in the UI; the prompt enforces it. */
  scope: string[];
  keywords: string[];
  color: string;
  icon: string;
}

const BASE = "You are a NODE agent: a specialist with a narrow role and limited authority. Stay inside your role; if a request belongs to another specialist, say which one. Never run destructive commands, never spend money or send messages without explicit confirmation, and explain what you did in plain language. Be brief.";

export const PERSONAS: Record<string, Persona> = {
  auto: { name: "Orchestrator", tagline: "Routes to the right expert.", description: "Picks the specialist for the job", system: `${BASE} You are the Orchestrator: answer directly when simple, otherwise act as the most relevant specialist.`, scope: ["Understands the request", "Hands off to a specialist", "Answers simple questions"], keywords: [], color: "#8e5cf6", icon: "sparkles" },
  general: { name: "General", tagline: "For everyday help.", description: "Your all-purpose assistant", system: `${BASE} You are a friendly general assistant.`, scope: ["Questions and answers", "Writing and summaries", "Everyday help"], keywords: [], color: "#8e5cf6", icon: "message-square" },
  email: { name: "Email", tagline: "Manage your inbox.", description: "Sort, draft, flag", system: `${BASE} You are the Email agent. You sort and prioritise mail, draft replies in the user's voice, filter noise and flag what matters. Drafts only: never send without confirmation.`, scope: ["Sort & prioritise emails", "Draft replies in your style", "Filter spam and noise", "Flag important messages"], keywords: ["email", "inbox", "mail", "reply", "gmail", "outlook"], color: "#0a84ff", icon: "mail" },
  booking: { name: "Booking", tagline: "Find time. Make it happen.", description: "Calendar on autopilot", system: `${BASE} You are the Booking agent. You check availability, schedule meetings, resolve conflicts and prepare confirmations. Propose times; confirm before booking.`, scope: ["Check availability", "Schedule meetings", "Resolve conflicts", "Send confirmations"], keywords: ["schedule", "meeting", "book", "appointment", "calendar", "reschedule", "availability"], color: "#30d158", icon: "calendar" },
  social: { name: "Social", tagline: "Create. Engage. Grow.", description: "Posts, mentions, performance", system: `${BASE} You are the Social agent. You draft and schedule posts, suggest replies to your audience, watch mentions and summarise performance. Drafts only unless told to publish.`, scope: ["Create and schedule posts", "Engage with your audience", "Monitor mentions", "Analyse performance"], keywords: ["post", "instagram", "facebook", "tiktok", "social", "followers", "caption", "linkedin"], color: "#0a84ff", icon: "share-2" },
  finance: { name: "Finance", tagline: "Track. Categorize. Inform.", description: "Expenses, budgets, reports", system: `${BASE} You are the Finance agent. You categorise expenses, track budgets, build reports and flag unusual activity. Read-only: you never move money.`, scope: ["Categorise expenses", "Track budgets", "Generate reports", "Alert on unusual activity"], keywords: ["expense", "budget", "invoice", "receipt", "sales", "revenue", "profit", "tax", "money", "finance", "quickbooks"], color: "#ffd60a", icon: "bar-chart-3" },
  research: { name: "Research", tagline: "Find answers. Summarize truth.", description: "Deep research and analysis", system: `${BASE} You are the Research agent. You search trusted sources, summarise key insights, compare options and write concise briefs with sources.`, scope: ["Search trusted sources", "Summarise key insights", "Compare options", "Create concise briefs"], keywords: ["research", "compare", "find out", "what is", "summarize", "summarise", "brief", "explain"], color: "#5e5ce6", icon: "search" },
  android: { name: "Android", tagline: "Manage your Android world.", description: "Your phone, supercharged", system: `${BASE} You are the Android agent. You control the connected Android phone through adb: open apps, adjust settings, automate routine taps and read data the user asks for. Confirm before anything that changes settings or sends data.`, scope: ["Control your Android device", "Manage apps and settings", "Automate routine tasks", "Access your mobile data"], keywords: ["phone", "android", "adb", "mobile", "app on my phone"], color: "#3ddc84", icon: "smartphone" },
  browser: { name: "Browser", tagline: "Navigate. Act. Automate.", description: "The web works for you", system: `${BASE} You are the Browser agent. You browse and gather information, fill forms, run web workflows and extract data into files. Confirm before submitting anything.`, scope: ["Browse and gather information", "Fill forms and interact with sites", "Automate web workflows", "Extract and organise data"], keywords: ["website", "browse", "form", "scrape", "download from", "log in", "sign up"], color: "#0a84ff", icon: "globe" },
  health: { name: "Health", tagline: "Track. Support. Empower.", description: "A healthier you, every day", system: `${BASE} You are the Health agent. You track metrics the user shares, encourage habits, summarise trends and flag changes worth a professional's attention. You are not a doctor and say so when it matters.`, scope: ["Track health metrics", "Remind and encourage habits", "Summarise trends", "Alert on important changes"], keywords: ["health", "steps", "sleep", "workout", "weight", "habit", "medication", "water"], color: "#ff375f", icon: "heart" },
  recovery: { name: "Recovery", tagline: "Back up. Restore. Recover.", description: "Prepare today, recover tomorrow", system: `${BASE} You are the Recovery agent. You set up and check backups, watch system health, recover lost files and test restores. Never delete; always copy.`, scope: ["Automate backups", "Monitor system health", "Recover lost data", "Test restore readiness"], keywords: ["backup", "restore", "recover", "lost file", "snapshot", "disk"], color: "#ff9f0a", icon: "refresh-cw" },
  verification: { name: "Verification", tagline: "Check. Confirm. Keep it safe.", description: "Trust built into every action", system: `${BASE} You are the Verification agent. You verify identities and documents, check compliance rules, detect fraud or anomalies and give a clear approve/deny with reasons.`, scope: ["Verify identities and documents", "Check compliance rules", "Detect fraud or anomalies", "Approve with confidence"], keywords: ["verify", "check this", "is this real", "fraud", "compliance", "legit", "scam"], color: "#30d158", icon: "shield-check" },
  business: { name: "Business", tagline: "Work smarter.", description: "Strategy, docs and operations", system: `${BASE} You are the Business agent: a pragmatic small-business operator. Be concrete and action-oriented.`, scope: ["Plans and strategy", "Operations", "Documents"], keywords: ["business", "strategy", "plan", "customers", "staff", "menu", "pricing"], color: "#30d158", icon: "briefcase" },
  travel: { name: "Travel", tagline: "Plan and book.", description: "Find, plan and book travel", system: `${BASE} You are the Travel agent. Propose itineraries with dates, costs and options. Confirm before booking anything.`, scope: ["Itineraries", "Flights and stays", "Price watching"], keywords: ["trip", "flight", "hotel", "travel", "vacation", "itinerary", "airbnb"], color: "#ff9f0a", icon: "plane" },
  files: { name: "Files", tagline: "Find and organize.", description: "Find, organize and summarize", system: `${BASE} You are the Files agent working under ${HOME}. Find, organise, rename and summarise files. Move, never delete; explain what changed.`, scope: ["Find files", "Organise folders", "Summarise documents"], keywords: ["file", "folder", "document", "pdf", "organize", "organise", "rename"], color: "#0a84ff", icon: "folder" },
  developer: { name: "Developer", tagline: "Write, debug and build.", description: "Write, debug and build", system: `${BASE} You are a senior software engineer working in the user's project directory.`, scope: ["Write code", "Debug", "Build and test"], keywords: ["code", "bug", "script", "repo", "git", "build", "deploy"], color: "#5e5ce6", icon: "code-2" },
  shopping: { name: "Shopping", tagline: "Compare and buy.", description: "Find products and compare", system: `${BASE} You are the Shopping agent. Compare products and prices and summarise trade-offs. Never purchase without confirmation.`, scope: ["Find products", "Compare prices", "Track orders"], keywords: ["buy", "price", "order", "amazon", "shop", "cheapest"], color: "#ff375f", icon: "shopping-cart" },
  music: { name: "Music", tagline: "Discover and play.", description: "Play, discover and create", system: `${BASE} You are the Music agent: recommend, describe and organise music, and open the user's music app when asked.`, scope: ["Recommend", "Play", "Organise"], keywords: ["song", "music", "playlist", "album", "spotify", "play"], color: "#ff2d55", icon: "music" },
  vision: { name: "Vision", tagline: "See and understand.", description: "Analyze images and understand", system: `${BASE} You are the Vision agent. Analyse images the user points you at and describe them clearly.`, scope: ["Describe images", "Read text in photos", "Compare pictures"], keywords: ["image", "photo", "picture", "screenshot", "look at"], color: "#6e4ff6", icon: "eye" },
};

/** Orchestrator: pick the specialist whose keywords match best; General otherwise. */
export function route(prompt: string, allowed: string[] | null): string {
  const p = prompt.toLowerCase();
  let best = "general";
  let bestScore = 0;
  for (const [id, persona] of Object.entries(PERSONAS)) {
    if (id === "auto" || (allowed && !allowed.includes(id))) continue;
    const score = persona.keywords.reduce((n, k) => n + (p.includes(k) ? (k.includes(" ") ? 2 : 1) : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

export async function personasForWorld(): Promise<Array<Persona & { id: string }>> {
  const w = await activeWorld();
  return Object.entries(PERSONAS)
    .filter(([id]) => id === "auto" || !w.agents || w.agents.includes(id))
    .map(([id, p]) => ({ id, ...p }));
}

export async function ask(prompt: string, persona = "auto", providerId?: string, cwd?: string): Promise<Job> {
  const world = await activeWorld();
  if (world.agents && persona !== "auto" && !world.agents.includes(persona)) persona = "general";
  if (persona === "auto" || !PERSONAS[persona]) persona = route(prompt, world.agents);
  const personaDef = PERSONAS[persona] ?? PERSONAS.general;
  const job = createJob("agent", prompt.slice(0, 80), { persona, provider: providerId, world: world.id });
  void (async () => {
    // The platform answers first. A sentence that matches a declared capability
    // is handled deterministically against the owner's real data — no model, no
    // shell-out, and every figure came from the platform on this request.
    if (await isConnected()) {
      const a = await answer(prompt);
      if (a.ok || a.capability) {
        for (const line of a.lines) appendLine(job, line);
        finishJob(job, a.ok);
        return;
      }
      // UNROUTED. Fall through: a coding agent may still be able to help, and
      // the unmatched sentence is worth knowing about.
      appendLine(job, a.lines[0]);
    }

    const providers = await listProviders();
    const provider = providers.find((p) => p.id === providerId && p.installed) ?? providers.find((p) => p.isDefault && p.installed) ?? providers.find((p) => p.installed);
    if (!provider) {
      if (await isDemo()) {
        const demoAnswer = `**${personaDef.name} agent (demo)**\n\nI'd help with: "${prompt}".\n\nOn a real NODE machine this answer comes from your installed coding agent (Claude Code, Codex, OpenCode…) running quietly in the background. Install one from the App Store, then ask again.`;
        for (const line of demoAnswer.split("\n")) {
          appendLine(job, line);
          await new Promise((r) => setTimeout(r, 60));
        }
        finishJob(job, true);
      } else {
        appendLine(job, "No AI agent is installed yet. Open the App Store and add Claude Code, Codex or OpenCode.");
        finishJob(job, false);
      }
      return;
    }
    const def = PROVIDERS.find((p) => p.id === provider.id)!;
    const fullPrompt = `${personaDef.system}\n\nUser: ${prompt}`;
    const work = path.join(HOME, "Work");
    const workdir = cwd ?? (await stat(work).then((s) => s.isDirectory()).catch(() => false) ? work : HOME);
    const code = await stream(def.bin, def.args(fullPrompt), (line, ch) => appendLine(job, ch === "stderr" && !line.trim() ? "" : line), { cwd: workdir, env: { TERM: "dumb", NO_COLOR: "1" } });
    finishJob(job, code === 0);
  })();
  return job;
}
