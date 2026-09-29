/**
 * The one phone this box drives.
 *
 * On a Ghost box the phone is named once, by serial, in NEXTGENT_ANDROID_SERIAL
 * (the same setting androidd reads). Every adb call here is pinned to it, so a
 * second device, an emulator, or a phone someone plugs in to charge is never
 * the one that gets tapped. Without the setting, adb picks as it always has.
 */
export const PHONE_SERIAL = (process.env.NEXTGENT_ANDROID_SERIAL ?? "").trim();

/** adb arguments pinned to the box's phone; `adb devices` lists all of them. */
export function pinned(args: string[]): string[] {
  if (!PHONE_SERIAL || args[0] === "devices" || args[0] === "-s") return args;
  return ["-s", PHONE_SERIAL, ...args];
}
