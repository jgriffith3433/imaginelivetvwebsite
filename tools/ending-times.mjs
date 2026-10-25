// Play time to every ending of story/night-shift.json, from the build's own state rules and each line's `dur` (the recording's
// length once the voices are made): the shortest and the longest way to each ending, and the shortest way's choices.
//   node tools/ending-times.mjs [--md]      --md prints the table the sign-off uses
import fs from 'node:fs';
import '../js/console-rules.js';

const rules = globalThis.iltvConsoleRules;
const data = JSON.parse(fs.readFileSync(new URL('../story/night-shift.json', import.meta.url), 'utf8'));
// The player waits GAP between two lines (js/console.js).
const GAP = 0.35;
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const dur = Object.fromEntries(data.scenes.map((s) => [s.id, s.lines.reduce((a, l) => a + (l.dur ?? Math.round((words(l.text) / 2.5 + 1) * 10) / 10) + GAP, 0)]));
const consoleChoice = (c) => {
  const e = {};
  for (const k of ['requires', 'forbids', 'meters', 'set', 'clear', 'add', 'log', 'cosmetic']) if (c[k] != null && !(Array.isArray(c[k]) && !c[k].length)) e[k] = c[k];
  return Object.keys(e).length ? [c.say, c.say, c.next, e] : [c.say, c.say, c.next];
};
const shape = {
  start: data.start,
  state: data.state,
  cameras: data.cameras,
  scenes: Object.fromEntries(data.scenes.map((s) => [s.id, { ending: s.ending ? [s.ending, s.ending] : undefined, feeds: s.feeds, choices: s.choices.map(consoleChoice) }])),
};
const title = Object.fromEntries(data.scenes.filter((s) => s.ending).map((s) => [s.id, s.ending]));

// walk: for each state, per ending reached: { min, max, via } (via = the choices of the shortest way from here).
const memo = new Map();
function walk(id, st) {
  const k = `${id}#${rules.stateKey(st)}`;
  if (memo.has(k)) return memo.get(k);
  const open = shape.scenes[id].choices.filter((c) => rules.usable(c, st));
  const r = {};
  if (!open.length) r[id] = { min: dur[id], max: dur[id], via: [] };
  else {
    for (const c of open) {
      const sub = walk(c[2], rules.apply(shape, st, c));
      for (const [e, v] of Object.entries(sub)) {
        const min = dur[id] + v.min, max = dur[id] + v.max;
        const cur = r[e];
        if (!cur) r[e] = { min, max, via: [c[0], ...v.via] };
        else {
          if (min < cur.min) { cur.min = min; cur.via = [c[0], ...v.via]; }
          if (max > cur.max) cur.max = max;
        }
      }
    }
  }
  memo.set(k, r);
  return r;
}
const res = walk(data.start, rules.fresh(shape));
const rows = Object.entries(res).map(([id, v]) => ({ id, ending: title[id] ?? id, shortest: v.min / 60, longest: v.max / 60, choices: v.via.length, via: v.via })).sort((a, b) => a.shortest - b.shortest);
if (process.argv.includes('--md')) {
  console.log('| Ending | Scene | Shortest way (min) | Longest way (min) | Choices on the shortest way |\n| --- | --- | ---: | ---: | ---: |');
  for (const r of rows) console.log(`| ${r.ending} | \`${r.id}\` | ${r.shortest.toFixed(1)} | ${r.longest.toFixed(1)} | ${r.choices} |`);
} else for (const r of rows) console.log(`${r.ending.padEnd(22)} ${r.id.padEnd(18)} shortest ${r.shortest.toFixed(1)} min  longest ${r.longest.toFixed(1)} min  ${r.choices} choices`);
