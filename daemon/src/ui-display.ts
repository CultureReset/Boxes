/**
 * The X display the NODE TV kiosk actually sits on.
 * The daemon unit may inherit DISPLAY=:10 from an xrdp session; native
 * launches and window maximize must still go to Plasma on the physical seat.
 *
 * Override with NODEOS_UI_DISPLAY. No per-app special cases.
 */

/** The seat to launch and maximize on. */
export function uiDisplay(): string {
  const forced = process.env.NODEOS_UI_DISPLAY?.trim();
  if (forced) return forced;
  const current = process.env.DISPLAY?.trim() ?? "";
  // :10 / :10.0 is the xrdp session, not the Plasma kiosk.
  if (!current || /^:10(\.|$)/.test(current)) return ":0";
  return current;
}

export function uiEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, DISPLAY: uiDisplay() };
  if (process.env.XAUTHORITY) env.XAUTHORITY = process.env.XAUTHORITY;
  return env;
}

/** Point this process (and every gtk-launch / wmctrl child) at the kiosk seat. */
export function applyUiDisplay(): void {
  const d = uiDisplay();
  process.env.DISPLAY = d;
  if (!process.env.NODEOS_UI_DISPLAY?.trim()) process.env.NODEOS_UI_DISPLAY = d;
}
