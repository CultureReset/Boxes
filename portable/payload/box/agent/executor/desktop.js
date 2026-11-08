// Driving the Linux desktop.
//
// This is the executor the platform calls Lane A. The box runs a desktop
// session; the phone is mirrored onto it as an ordinary window; everything the
// owner asks for happens as pointer and keyboard events against that desktop —
// including taps on the phone, which are just clicks inside the scrcpy window.
//
// Why input events and not ADB: the moment the phone is a window on a screen,
// one mechanism drives everything. A browser tab, a POS app, a spreadsheet and
// the phone are all the same kind of target, and there is one thing to get
// right instead of two.
//
// X11 rather than Wayland, on purpose. Wayland has no sanctioned way for one
// process to synthesise input into another's window; the workarounds are
// compositor-specific and break on update. X11's are twenty years old and
// stable, which is what an appliance in a marina office needs.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

const DISPLAY = () => process.env.DISPLAY || ':0';
const env = () => ({ ...process.env, DISPLAY: DISPLAY() });

async function x(cmd, args, { timeout = 10000 } = {}) {
  try {
    const { stdout } = await run(cmd, args, { env: env(), timeout });
    return stdout.trim();
  } catch (err) {
    // Name the display. "Cannot open display" with no display named is the
    // least useful error in this entire stack.
    throw new Error(`${cmd} ${args.join(' ')} failed on ${DISPLAY()}: ${(err.stderr || err.message).trim()}`);
  }
}

/** Is there a desktop to drive at all? */
export async function ready() {
  try {
    const info = await x('xdpyinfo', ['-display', DISPLAY()], { timeout: 5000 });
    const dims = /dimensions:\s+(\d+)x(\d+)/.exec(info);
    return { ok: true, display: DISPLAY(), width: dims ? +dims[1] : null, height: dims ? +dims[2] : null };
  } catch (err) {
    return { ok: false, display: DISPLAY(), error: err.message };
  }
}

/* ── pointer ─────────────────────────────────────────────────────────────── */

export async function click({ x: px, y: py, button = 1, double = false }) {
  if (!Number.isFinite(px) || !Number.isFinite(py)) throw new Error('click needs numeric x and y');
  // No --sync: it waits for a pointer-motion acknowledgement that some virtual
  // displays never send, and hangs the step for its whole timeout. Move, then
  // read back if the caller cares where it landed.
  await x('xdotool', ['mousemove', String(Math.round(px)), String(Math.round(py))]);
  await x('xdotool', ['click', ...(double ? ['--repeat', '2'] : []), String(button)]);
  return { clicked: { x: Math.round(px), y: Math.round(py), button, double } };
}

export async function move({ x: px, y: py }) {
  if (!Number.isFinite(px) || !Number.isFinite(py)) throw new Error('move needs numeric x and y');
  await x('xdotool', ['mousemove', String(Math.round(px)), String(Math.round(py))]);
  return { at: { x: Math.round(px), y: Math.round(py) } };
}

/**
 * Can this display actually be pointed at?
 *
 * A headless X server with no virtual input device accepts every mousemove and
 * moves nothing. Better to find that out at startup than to spend an afternoon
 * wondering why clicks land in the wrong place.
 */
export async function pointerWorks() {
  const before = await pointer();
  const target = { x: before.x === 100 ? 200 : 100, y: before.y === 100 ? 200 : 100 };
  await move(target);
  const after = await pointer();
  await move(before).catch(() => {});
  return after.x === target.x && after.y === target.y;
}

export async function pointer() {
  const out = await x('xdotool', ['getmouselocation', '--shell']);
  const g = (k) => Number(new RegExp(`${k}=(-?\\d+)`).exec(out)?.[1]);
  return { x: g('X'), y: g('Y'), screen: g('SCREEN') };
}

export async function drag({ from, to, button = 1 }) {
  await x('xdotool', ['mousemove', String(Math.round(from.x)), String(Math.round(from.y))]);
  await x('xdotool', ['mousedown', String(button)]);
  await x('xdotool', ['mousemove', String(Math.round(to.x)), String(Math.round(to.y))]);
  await x('xdotool', ['mouseup', String(button)]);
  return { dragged: { from, to } };
}

/* ── keyboard ────────────────────────────────────────────────────────────── */

export async function type({ text, delayMs = 12 }) {
  if (typeof text !== 'string') throw new Error('type needs text');
  // --clearmodifiers so a stuck Shift from an earlier keystroke does not turn
  // the next sentence into SHOUTING, which is a real thing that happens.
  await x('xdotool', ['type', '--clearmodifiers', '--delay', String(delayMs), '--', text],
          { timeout: Math.max(15000, text.length * delayMs * 3) });
  return { typed: text.length };
}

export async function key({ keys }) {
  const seq = Array.isArray(keys) ? keys : [keys];
  for (const k of seq) await x('xdotool', ['key', '--clearmodifiers', '--', k]);
  return { pressed: seq };
}

/* ── windows ─────────────────────────────────────────────────────────────── */

export async function windows() {
  const ids = (await x('xdotool', ['search', '--onlyvisible', '--name', '.'])).split('\n').filter(Boolean);
  const out = [];
  for (const id of ids) {
    try {
      const name = await x('xdotool', ['getwindowname', id]);
      const geo = await x('xdotool', ['getwindowgeometry', '--shell', id]);
      const g = (k) => Number(new RegExp(`${k}=(-?\\d+)`).exec(geo)?.[1]);
      out.push({ id, name, x: g('X'), y: g('Y'), width: g('WIDTH'), height: g('HEIGHT') });
    } catch { /* a window can close between listing and asking about it */ }
  }
  return out;
}

/**
 * Bring a window to the front by a fragment of its title.
 *
 * The mirrored phone is found this way rather than by a hardcoded title,
 * because scrcpy names its window after the handset and the owner will one day
 * change the phone.
 */
export async function focus({ match }) {
  const all = await windows();
  const needle = String(match ?? '').toLowerCase();
  const hit = all.find((w) => w.name.toLowerCase().includes(needle));
  if (!hit) {
    throw new Error(`no window matching "${match}". Open windows: ${all.map((w) => w.name).join(', ') || 'none'}`);
  }
  // windowactivate needs the window manager to advertise _NET_ACTIVE_WINDOW.
  // The appliance runs one, but a session that lost its WM — or a bare X
  // server during setup — must not become undrivable. Raise and focus
  // directly, which needs no WM cooperation at all.
  try {
    await x('xdotool', ['windowactivate', '--sync', hit.id]);
    return { focused: hit, how: 'activate' };
  } catch {
    await x('xdotool', ['windowraise', hit.id]);
    await x('xdotool', ['windowfocus', hit.id]);
    return { focused: hit, how: 'raise+focus' };
  }
}

/* ── seeing ──────────────────────────────────────────────────────────────── */

export async function screenshot({ path = '/tmp/cybercheck-screen.png' } = {}) {
  await x('scrot', ['-o', '-F', path], { timeout: 20000 });
  return { path };
}

/**
 * Run one step. The same verb vocabulary the android executor uses, so an
 * appmap written against a phone reads the same as one written against a
 * desktop and the kernel above does not care which lane it lands in.
 */
export async function step(s) {
  if (s.click) return click(s.click);
  if (s.move) return move(s.move);
  if (s.drag) return drag(s.drag);
  if (s.type !== undefined) return type({ text: s.type, delayMs: s.delayMs });
  if (s.key) return key({ keys: s.key });
  if (s.focus) return focus({ match: s.focus });
  if (s.screenshot !== undefined) return screenshot(s.screenshot === true ? {} : s.screenshot);
  if (s.wait) return new Promise((r) => setTimeout(() => r({ waited: s.wait }), s.wait));
  throw new Error(`unknown step: ${JSON.stringify(s)}`);
}

export async function runSteps(steps = []) {
  const done = [];
  for (const s of steps) done.push({ step: s, result: await step(s) });
  return done;
}
