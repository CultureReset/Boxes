import type { Capability } from "../capabilities.js";
import * as flathub from "../../modules/providers/flathub.js";
import { packageJob, installedPackages } from "../../modules/packages.js";
import { getJob } from "../../modules/jobs.js";

/**
 * The app store, as capabilities.
 *
 * Everything needed was already in the box — `flathub.ts` does popular,
 * search, icons and install; `packages.ts` runs the job; `jobs.ts` tracks it.
 * What was missing was a way for a screen to ask for any of it in one call.
 *
 * The rule this file is written to: NOBODY SEES THE MACHINERY. A person taps a
 * tile and gets an app. They never learn the words flatpak, apt, repository or
 * package id. Every message below is written for someone standing in front of
 * a TV with a remote, not someone reading a terminal.
 *
 * That's the actual product. The catalogue is free — Flathub has thousands of
 * apps and gives them away. What's worth selling is that installing one is a
 * tap instead of an afternoon.
 */

/** Trim the catalogue down to what a tile needs. Nothing internal leaks. */
function forScreen(app: {
  id: string; name?: string; summary?: string;
  installedSize?: number; license?: string;
}) {
  const mb = app.installedSize ? Math.round(app.installedSize / 1024 / 1024) : 0;
  return {
    id: app.id,
    name: app.name || app.id,
    what: app.summary || "",
    size: mb ? (mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`) : "",
    // Icons come from the box's own /api route, so a screen never talks to
    // Flathub directly and works offline once an app is installed.
    icon: `/api/apps/icon/${encodeURIComponent(app.id)}`,
  };
}

export default [
  {
    key: "apps.browse",
    summary: "Apps you could add, ready to show as tiles.",
    phrases: [
      "what apps can i get", "show me apps", "app store",
      "browse apps", "what can i install", "show the store",
    ],
    readOnly: true,
    run: async () => {
      try {
        const apps = await flathub.popular();
        return { ok: true, apps: apps.map(forScreen), count: apps.length };
      } catch {
        return {
          ok: false,
          apps: [],
          message: "Can't reach the app catalogue. Check the internet connection.",
        };
      }
    },
  },

  {
    key: "apps.find",
    summary: "Search for an app by what it does.",
    phrases: [
      "find an app", "search for an app", "is there an app for",
      "look for an app", "app for",
    ],
    slots: { what: "text" },
    readOnly: true,
    run: async (slots: Record<string, string>) => {
      const q = (slots.what ?? "").trim();
      if (!q) return { ok: false, message: "What kind of app are you after?" };

      try {
        const apps = await flathub.search(q);
        if (!apps.length) {
          return { ok: true, apps: [], message: `Nothing called "${q}" in the store.` };
        }
        return { ok: true, apps: apps.map(forScreen), count: apps.length };
      } catch {
        return { ok: false, apps: [], message: "Can't reach the app catalogue right now." };
      }
    },
  },

  {
    key: "apps.add",
    summary: "Install an app. One tap, nothing to configure.",
    phrases: ["install the app", "add the app", "get the app", "download the app"],
    slots: { app: "text" },
    // Installs software. A person asks for this; a model doesn't decide it.
    readOnly: false,
    agentSafe: false,
    run: async (slots: Record<string, string>) => {
      const id = (slots.app ?? "").trim();
      if (!id) return { ok: false, message: "Which app?" };

      // Refuse anything that isn't a real app id before running anything.
      if (!flathub.validId(id)) {
        return { ok: false, message: "That doesn't look like an app from the store." };
      }

      try {
        const job = await packageJob("install", id, "flathub");
        return {
          ok: true,
          jobId: job.id,
          // The screen shows this and polls apps.progress. No log, no scroll.
          message: "Installing. It'll appear on your home screen when it's ready.",
        };
      } catch (e) {
        return { ok: false, message: `Couldn't start the install: ${(e as Error).message}` };
      }
    },
  },

  {
    key: "apps.remove",
    summary: "Take an app off the box.",
    phrases: ["remove the app", "uninstall the app", "delete the app", "get rid of the app"],
    slots: { app: "text" },
    readOnly: false,
    agentSafe: false,
    run: async (slots: Record<string, string>) => {
      const id = (slots.app ?? "").trim();
      if (!id) return { ok: false, message: "Which app?" };

      try {
        const job = await packageJob("remove", id, "flathub");
        return { ok: true, jobId: job.id, message: "Removing it." };
      } catch (e) {
        return { ok: false, message: `Couldn't remove it: ${(e as Error).message}` };
      }
    },
  },

  {
    key: "apps.progress",
    summary: "How an install is getting on.",
    phrases: ["is it installed yet", "how is the install going", "install progress"],
    slots: { jobId: "text" },
    readOnly: true,
    run: async (slots: Record<string, string>) => {
      const id = (slots.jobId ?? "").trim();
      if (!id) return { ok: false, message: "Which install?" };

      const job = await getJob(id);
      if (!job) return { ok: false, message: "No install by that name." };

      // Job states become sentences. Nobody reads "exit code 0".
      const said =
        job.state === "done"    ? "Done. It's on your home screen."
      : job.state === "failed"  ? "That didn't work. Nothing was changed."
      : job.state === "running" ? "Still going."
      :                           "Queued.";

      return { ok: true, state: job.state, message: said };
    },
  },

  {
    key: "apps.installed",
    summary: "What's already on this box.",
    phrases: ["what apps do i have", "what is installed", "my apps", "list my apps"],
    readOnly: true,
    run: async () => {
      const names = await installedPackages();
      return { ok: true, apps: names, count: names.length };
    },
  },
] satisfies Capability[];
