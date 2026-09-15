// Reading the one file the owner edits.
//
// This runs before anything else on the box, on a partition somebody may have
// opened in Notepad, so it is forgiving about what it accepts and specific
// about what it refuses. Every message here is written to be read by the person
// who filled the file in, not by whoever wrote this code.

import { readFileSync } from 'node:fs';

const COUNTRY = /^[A-Za-z]{2}$/;
// Pairing codes are read aloud and typed by hand, so the alphabet excludes
// the characters people confuse: no O/0, no I/1.
const PAIRING = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** Tolerant key=value parsing. Quotes optional, whitespace ignored, # comments. */
export function parseConf(text) {
  const out = {};
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim().toLowerCase().replace(/[\s-]+/g, '_');
    let value = line.slice(eq + 1).trim();
    // Someone will paste a quoted password. Take the quotes off, but only a
    // matched pair — a password may legitimately start or end with one.
    if (value.length > 1 && /^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

/**
 * Turn the file into either a usable config or a list of things to tell the
 * owner. Never throws — a box that dies parsing its own config cannot write
 * the status file that explains why.
 */
export function validate(conf) {
  const problems = [];
  const c = conf ?? {};

  if (!c.wifi_name) {
    problems.push('Wi-Fi name is blank. Fill in wifi_name with your network name, exactly as it appears on your phone.');
  }
  // An open network is legal and some marinas use one. Only complain when a
  // name is given with no password AND no explicit "open".
  if (c.wifi_name && !c.wifi_password && c.wifi_password !== '' ) {
    problems.push('Wi-Fi password is missing. If the network has no password, write wifi_password=open');
  }
  if (!c.country) {
    problems.push('Country is blank. Put your two-letter country code in country, such as US.');
  } else if (!COUNTRY.test(c.country)) {
    problems.push(`Country "${c.country}" is not a two-letter code. Use US, GB, CA, AU and so on.`);
  }
  if (!c.pairing_code) {
    problems.push('Pairing code is blank. Get one from Settings, Devices, Add a box.');
  } else if (!PAIRING.test(normaliseCode(c.pairing_code))) {
    problems.push(`Pairing code "${c.pairing_code}" does not look right. It should be three groups of four, like ABCD-2345-EFGH.`);
  }

  if (problems.length) return { ok: false, problems };

  return {
    ok: true,
    config: {
      wifiName: c.wifi_name,
      wifiPassword: c.wifi_password === 'open' ? null : c.wifi_password,
      country: c.country.toUpperCase(),
      pairingCode: normaliseCode(c.pairing_code),
      label: c.label || null,
      platformUrl: (c.platform_url || 'https://api.cybercheck.io').replace(/\/+$/, ''),
    },
  };
}

/** Accept lowercase, spaces, missing dashes — people type these off a screen. */
export function normaliseCode(code) {
  const bare = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return bare.length === 12 ? `${bare.slice(0, 4)}-${bare.slice(4, 8)}-${bare.slice(8)}` : String(code ?? '').toUpperCase();
}

export function load(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { ok: false, problems: [`Could not find ${path}. The card may not have been written correctly — try writing the image again.`] };
  }
  return validate(parseConf(text));
}
