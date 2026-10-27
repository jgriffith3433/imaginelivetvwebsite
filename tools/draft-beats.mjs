#!/usr/bin/env node
// Drafts the `at` of a line's acts from where the action words fall in its text (story/night-shift.json; story doc "The control room", beats).
// A beat is { "act": "who:verb", "at": 0.45 }: the fraction (0 to 1) of the line's own `dur` at which it happens. The draft reads the
// text as speech: the clause an action is in starts that far through the line (characters over characters). It only touches narrator
// lines (the narrator says what people do) that have an act in a later clause or more than one act, and gives every `leave` a `gone`
// (the clause where the door shuts, else a beat after the walk). Lines that already carry beats are left alone.
// Usage: node tools/draft-beats.mjs [--write]   (prints the draft; --write edits story/night-shift.json, then run npm run story)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'story/night-shift.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// where each verb's words fall: the first clause that matches
const WORDS = {
  enter: /comes? (in|through|back|down)|walks? in|leans? in|opens,? and|knocks? twice|already open|is back|comes? up/i,
  stand: /gets? up|stands?\b|takes? the keys|out of her chair|takes? the folded|goes? (to|as far)/i,
  sit: /\bsits?\b/i,
  leave: /\b(goes|goes out|leaves?|takes? (her|his|him|the \w+) (coat|bag|tablet)? ?(and goes|to the)?|goes upstairs)\b|takes her coat to/i,
  hand: /hands?\b|slides|turns the tablet|puts the pencil|holds the fourth|sets? (your|the)/i,
  count: /count/i,
  lean: /lean|reads?\b|looks at/i,
  eat: /eat|unwraps/i,
  drink: /drinks?|coffee/i,
  write: /writ|initial|pencil|you take the pencil/i,
  point: /point|pencil against|puts a pencil/i,
  touch: /tap|touch|glass/i,
  phone: /phone|answers|picks up|you read it|dispatcher|a woman's voice/i,
  hangup: /hang|dead|goes quiet/i,
  read: /reads?\b/i,
  press: /press|release/i,
  spill: /spill|knocks? (it|the cup)/i,
  buzz: /buzz/i,
  ring: /rings?\b|ring\b/i,
  flicker: /lights drop|flicker/i,
  knock: /knocks? twice|knock/i,
  rest: /./,
  hangup2: /./,
  angry: /./, press2: /./, door: /door/i, gone: /swings? shut|shuts?\b|closes|takes (him|her)|carries him/i,
};

/** Clause starts of a text: the start of each sentence and of each ", and" / "; " part, as fractions of the text length. */
function clauses(text) {
  const out = [{ at: 0, text }];
  const re = /(?<=[.!?])\s+|,\s+and\s+|\s+and\s+(?=\w+ (?:the|her|his|a)\b)|;\s+/g;
  let m;
  const starts = [0];
  while ((m = re.exec(text))) starts.push(m.index + m[0].length);
  return starts.map((s, k) => ({ at: s / text.length, text: text.slice(s, starts[k + 1] ?? text.length) }));
}

const round = (x) => Math.round(x * 100) / 100;
const changes = [];
for (const sc of data.scenes) {
  sc.lines.forEach((l, i) => {
    if (!l.act) return;
    const acts = Array.isArray(l.act) ? l.act : [l.act];
    if (acts.some((a) => typeof a !== 'string')) return;
    if (l.speaker !== 'narrator') return;
    const cl = clauses(l.text);
    let plan = acts.map((a) => {
      const [who, verb] = a.split(':');
      if (who === 'room' && ['ring', 'buzz', 'flicker', 'door'].includes(verb)) return { act: a, at: 0 };
      const re = WORDS[verb];
      const hit = re && cl.find((c) => c.at > 0 && re.test(c.text));
      const first = re && re.test(cl[0].text);
      return { act: a, at: first || !hit || hit.at < 0.1 ? 0 : round(hit.at) };
    });
    // a person who leaves also goes: the clause where the door shuts, else a little after the walk
    for (const b of [...plan]) {
      const [who, verb] = b.act.split(':');
      if (verb !== 'leave' || plan.some((x) => x.act === `${who}:gone`)) continue;
      const hit = cl.find((c) => c.at >= b.at && WORDS.gone.test(c.text));
      let at = hit ? round(hit.at) : round(b.at + 0.15);
      if (at <= b.at) at = round(b.at + 0.12);
      plan.push({ act: `${who}:gone`, at: Math.min(at, 0.95) });
    }
    plan = plan.map((b, k) => ({ ...b, k })).sort((a, b) => a.at - b.at || a.k - b.k).map(({ act, at }) => ({ act, at }));
    const needs = plan.some((b) => b.at > 0);
    if (!needs) return;
    changes.push({ scene: sc.id, line: i, text: l.text, dur: l.dur, plan });
    l.act = plan.map((b) => (b.at > 0 ? { act: b.act, at: b.at } : b.act));
  });
}
for (const c of changes) console.log(`${c.scene}#${c.line}: ${c.plan.map((b) => `${b.act}@${b.at}`).join(', ')}\n    ${c.text}`);
console.log(`${changes.length} lines get beats`);
if (process.argv.includes('--write')) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); console.log('wrote story/night-shift.json'); }
