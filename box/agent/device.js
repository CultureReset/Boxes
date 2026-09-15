// Is the phone there, awake, and on the screen?
//
// Three states an owner can act on, because there are only three things they
// can do: plug it in, unlock it, tap Allow.
//
// The phone is not what the box drives — it is how the owner reaches the box,
// and it is mirrored onto the desktop so its apps are reachable too. So
// "healthy" means two things: adb can see it, and scrcpy is showing it.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

const adb = process.env.ADB_BINARY || 'adb';

export async function devices() {
  try {
    const { stdout } = await run(adb, ['devices'], { timeout: 15000 });
    return stdout.split('\n').slice(1)
      .map((l) => l.trim()).filter(Boolean)
      .map((l) => { const [serial, state] = l.split(/\s+/); return { serial, state }; });
  } catch (err) {
    return [{ serial: null, state: 'adb-unavailable', error: err.message }];
  }
}

/** Is scrcpy actually showing it? A connected phone nobody can see is not done. */
export async function mirroring({ desktop }) {
  try {
    const open = await desktop.windows();
    const hit = open.find((w) => /cybercheck phone/i.test(w.name));
    return hit ? { ok: true, window: hit } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function check({ desktop = null } = {}) {
  const found = await devices();

  if (found.some((d) => d.state === 'adb-unavailable')) {
    return { ok: false, state: 'NO USB', problem: 'The box cannot talk to USB at all. This is a fault in the box, not something to fix on the phone.' };
  }
  if (found.length === 0) {
    return { ok: false, state: 'NO PHONE', problem: 'No phone is plugged in. Check the cable — a charging-only cable will not work, it has to be a data cable.' };
  }
  if (found.some((d) => d.state === 'unauthorized')) {
    return { ok: false, state: 'NOT ALLOWED', problem: 'The phone is plugged in but has not been allowed. Unlock it — there is a prompt asking to allow USB debugging. Tap Allow, and tick "always allow from this computer".' };
  }
  if (found.some((d) => d.state === 'offline')) {
    return { ok: false, state: 'ASLEEP', problem: 'The phone is plugged in but not responding. Unplug it, unlock the screen, and plug it back in.' };
  }

  const ready = found.find((d) => d.state === 'device');
  if (!ready) {
    return { ok: false, state: 'UNKNOWN', problem: `The phone reports "${found[0].state}", which the box does not recognise. Unplug it and plug it back in.` };
  }

  if (desktop) {
    const shown = await mirroring({ desktop });
    if (!shown.ok) {
      return { ok: false, state: 'NOT ON SCREEN', serial: ready.serial,
        problem: 'The phone is connected but is not showing on the screen. The box will keep trying; if it does not appear within a minute, unplug the phone and plug it back in.' };
    }
    return { ok: true, state: 'READY', serial: ready.serial, window: shown.window };
  }

  return { ok: true, state: 'CONNECTED', serial: ready.serial };
}
