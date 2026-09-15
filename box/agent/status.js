// What the box writes back to the card.
//
// The owner has no screen and no terminal. When something is wrong, the only
// channel that always works is: power off, take the card to a computer, read a
// file. So every failure ends up here, in words, with the next thing to do.

import { writeFileSync } from 'node:fs';

const STAMP = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

export function render({ state, label, problems = [], facts = {} }) {
  const lines = [];
  lines.push('CyberCheck node');
  lines.push('='.repeat(48));
  lines.push('');
  lines.push(`Status:   ${state}`);
  if (label) lines.push(`Name:     ${label}`);
  lines.push(`Checked:  ${STAMP()}`);
  lines.push('');

  for (const [k, v] of Object.entries(facts)) {
    lines.push(`  ${k.padEnd(18)} ${v}`);
  }
  if (Object.keys(facts).length) lines.push('');

  if (problems.length) {
    lines.push('What to fix');
    lines.push('-'.repeat(48));
    problems.forEach((p, i) => {
      lines.push(`${i + 1}. ${p}`);
      lines.push('');
    });
    lines.push('Fix the item above in cybercheck.conf, save, eject the card,');
    lines.push('put it back in the box and power it on again.');
  } else if (state === 'ONLINE') {
    lines.push('Everything is working. Nothing to do.');
    lines.push('You can leave the card in and forget about it.');
  }

  return lines.join('\n') + '\n';
}

export function write(path, payload) {
  try {
    writeFileSync(path, render(payload), 'utf8');
    return true;
  } catch {
    // The boot partition may be read-only or absent when running off a
    // developer machine. Never let that stop the node from working.
    return false;
  }
}
