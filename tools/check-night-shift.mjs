// Checks story/night-shift.json (the whole night, the console format) against the style guide in story/night-shift.md and the
// acceptance bar: no banned patterns, speeches short, Dee never says what she never says, Pierce only in the cameo, nothing
// about the restricted work, and how long the night is to listen to (words at 150 wpm plus a pause per line).
// `npm run story` does the structural checks (dead ends, unreachable endings, choices with no effect); this does the voice
// and the clock.   node tools/check-night-shift.mjs [--quiet]
import fs from 'node:fs';
import '../js/console-rules.js';

const rules = globalThis.iltvConsoleRules;
const data = JSON.parse(fs.readFileSync(new URL('../story/night-shift.json', import.meta.url), 'utf8'));
const problems = [];
const bad = (m) => problems.push(m);
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
// A sentence of four words or more counts toward the three-sentence limit; fragments ("One. Lobby.") are free.
const sentences = (t) => t.split(/(?<=[.!?…])\s+/).filter((x) => words(x) >= 4);

const BANNED = [
  /i['’]ve seen things/i, /in my (twenty|\d+) years/i, /back in my day/i, /you['’]ll understand someday/i, /\btrust me\b/i, /i['’]m retiring/i,
  /\bi['’]m (scared|afraid|lonely|proud)\b/i, /\bi (miss|care|lost)\b/i, /proud of you/i,
  /\bboundar(y|ies)\b/i, /\bclosure\b/i, /\bprocess(ing)? (this|that|your)\b/i, /observe and report/i,
  /\b(hack|decode|defuse|tackle)\b/i, /stay here,? i['’]ll handle/i,
];
const DEE_NEVER = [/\bkid\b/i, /\brookie\b/i, /\bretire/i, /\bi['’]m sorry\b/i];
const OKAFOR_NEVER = [/good job/i, /unacceptable/i, /disappointed/i];
const TERRELL_NEVER = [/^no[.,!]?\s/i];
const FEELINGS = /\b(i feel|feeling|sad|lonely|grief|heartbroken)\b/i;
const BOARD_FIRST_NAME = /\b(?!Director\b)[A-Z][a-z]+ (Hale|Voss|Lang)\b/;
const CAMEO = new Set(['coat-lobby', 'pierce-signin']);

const scenes = new Map(data.scenes.map((s) => [s.id, s]));
const speakers = data.speakers ?? {};
const dur = {};
let lineCount = 0;
let deeLines = 0;
const pierceScenes = [];

for (const s of data.scenes) {
  dur[s.id] = 0;
  for (const [i, l] of s.lines.entries()) {
    const at = `${s.id} line ${i + 1} (${l.speaker})`;
    lineCount++;
    if (!speakers[l.speaker]) bad(`${at}: unknown speaker`);
    const n = words(l.text);
    dur[s.id] += l.dur ?? Math.round((n / 2.5 + 1) * 10) / 10;
    if (l.speaker === 'narrator') {
      if (n > 42) bad(`${at}: narration is ${n} words (max 42)`);
    } else {
      if (sentences(l.text).length > 3 || n > 32) bad(`${at}: a speech (over three sentences or 32 words): "${l.text}"`);
      if (!l.perform) bad(`${at}: no performance direction`);
    }
    for (const re of BANNED) if (re.test(l.text)) bad(`${at}: banned pattern ${re}`);
    if (FEELINGS.test(l.text)) bad(`${at}: states a feeling`);
    if (BOARD_FIRST_NAME.test(l.text)) bad(`${at}: a Board member has a first name`);
    if (l.speaker === 'dee') { deeLines++; for (const re of DEE_NEVER) if (re.test(l.text)) bad(`${at}: Dee never says that`); }
    if (l.speaker === 'okafor') for (const re of OKAFOR_NEVER) if (re.test(l.text)) bad(`${at}: Okafor never says that`);
    if (l.speaker === 'terrell') for (const re of TERRELL_NEVER) if (re.test(l.text)) bad(`${at}: Terrell never says "No"`);
    if (l.speaker === 'pierce') { pierceScenes.push(s.id); if (!CAMEO.has(s.id)) bad(`${at}: Pierce speaks outside the cameo`); if (n > 25) bad(`${at}: Pierce goes on`); }
  }
  for (const [i, c] of s.choices.entries()) {
    const n = words(c.say);
    if (n < 2 || n > 6) bad(`${s.id} choice ${i + 1}: "${c.say}" is ${n} words (2 to 6)`);
    for (const re of BANNED) if (re.test(c.say)) bad(`${s.id} choice ${i + 1}: banned pattern ${re}`);
  }
  const everything = [s.title, s.log ?? '', s.ending ?? '', ...s.lines.map((l) => l.text), ...s.choices.map((c) => `${c.say} ${c.log ?? ''}`)].join(' ');
  for (const w of data.unspoken ?? []) if (new RegExp(`\\b${w}`, 'i').test(everything)) bad(`${s.id}: unspoken word "${w}"`);
  if (BOARD_FIRST_NAME.test(everything)) bad(`${s.id}: a Board member has a first name`);
  if (/\bb3\b|\bthe vat\b|creature/i.test(everything)) bad(`${s.id}: mentions B3, the vat or the creature`);
}

// Pierce: one scene on any way through, and the lines he has are short.
const pierceTotal = data.scenes.filter((s) => s.lines.some((l) => l.speaker === 'pierce')).length;
if (pierceTotal < 1) bad('Pierce Hawkes never appears (the cameo)');
const pierceLines = data.scenes.flatMap((s) => s.lines.filter((l) => l.speaker === 'pierce').map((l) => l.text));
if (pierceLines.length > 2) bad(`Pierce has ${pierceLines.length} lines in the whole story (the cameo is two)`);

// The clock: every way through, worked out on the build's own state rules.
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
const memo = new Map();
function walk(id, st) {
  const k = `${id}#${rules.stateKey(st)}`;
  if (memo.has(k)) return memo.get(k);
  const open = shape.scenes[id].choices.filter((c) => rules.usable(c, st));
  let r;
  if (!open.length) r = { min: dur[id], max: dur[id], mean: dur[id], dee: 0 };
  else {
    const next = open.map((c) => walk(c[2], rules.apply(shape, st, c)));
    r = { min: dur[id] + Math.min(...next.map((x) => x.min)), max: dur[id] + Math.max(...next.map((x) => x.max)), mean: dur[id] + next.reduce((a, x) => a + x.mean, 0) / next.length };
  }
  memo.set(k, r);
  return r;
}
const t = walk(data.start, rules.fresh(shape));
// Random plays too: the median and the spread, with the policy "every open choice is equally likely".
function play(rng) {
  let id = data.start;
  let st = rules.fresh(shape);
  let total = 0;
  let steps = 0;
  const ends = [];
  for (;;) {
    total += dur[id];
    steps++;
    const open = shape.scenes[id].choices.filter((c) => rules.usable(c, st));
    if (!open.length) { ends.push(id); return { total, steps, end: id }; }
    const c = open[Math.floor(rng() * open.length)];
    st = rules.apply(shape, st, c);
    id = c[2];
  }
}
let seed = 12345;
const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const plays = Array.from({ length: 3000 }, () => play(rng)).sort((a, b) => a.total - b.total);
const pct = (p) => (plays[Math.floor((plays.length - 1) * p)].total / 60).toFixed(1);
const endings = new Set(plays.map((p) => p.end));
const allEndings = data.scenes.filter((s) => s.ending).length;

const x = rules.explore(shape, { cap: data.stateCap ?? 50000 });

// Decisions that change nothing: a choice that is open next to a differently worded one, changes no flag or meter in any state
// it can be made in, and does not end the story (the ending is the change). The build only asks for a log line, which is weak.
{
  const changes = new Set();
  const decision = new Set();
  const seen = new Set();
  const queue = [[data.start, rules.fresh(shape)]];
  while (queue.length) {
    const [id, st] = queue.shift();
    const key = `${id}#${rules.stateKey(st)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const open = shape.scenes[id].choices.map((c, i) => [c, i]).filter(([c]) => rules.usable(c, st));
    const words = new Set(open.map(([c]) => c[1]));
    for (const [c, i] of open) {
      const after = rules.apply(shape, st, c);
      if (rules.stateKey(after) !== rules.stateKey(st)) changes.add(`${id}#${i}`);
      if (words.size > 1) decision.add(`${id}#${i}`);
      queue.push([c[2], after]);
    }
  }
  let dead = 0;
  for (const s of data.scenes) s.choices.forEach((c, i) => {
    const k = `${s.id}#${i}`;
    if (decision.has(k) && !changes.has(k) && !scenes.get(c.next).ending && !c.cosmetic) { dead++; bad(`${s.id} choice ${i + 1} "${c.say}": a decision that changes no flag or meter in any state`); }
  });
  var deadDecisions = dead;
}

// The trainer's reveal layers (Dee's sheet, story doc section 3): each has a scene, each is reached by some way, and one way reaches them all.
const LAYERS = [
  ['2 the pencil', ['sign-why', 'sign-why-44']],
  ['5 the spring', ['drawer-notice']],
  ['3 the four hours', ['four-hours']],
  ['4 twelve', ['twelve']],
];
// One way through every layer that still ends well. The layers come in this order in the night (pencil 21:30, spring 23:25, four
// hours 02:58, twelve 05:24), so search stage by stage: every (scene, state) found at one layer is a source for the next.
const layerLines = [];
for (const [name, ids] of LAYERS) {
  const own = ids.map((id) => x.scenes[id]).filter(Boolean).sort((a, b) => a.picks.length - b.picks.length)[0];
  if (!own) bad(`reveal layer ${name}: no way reaches ${ids.join(' or ')}`);
  layerLines.push(own ? `${name} (${ids.join('/')}): ${own.picks.length} choices` : `${name}: NOT REACHED`);
}
let oneWay = null;
{
  let sources = [{ id: data.start, st: rules.fresh(shape), n: 0 }];
  const stages = [...LAYERS.map(([, ids]) => ids), ['end-someone', 'end-she-knew']];
  for (const targets of stages) {
    const seen = new Set();
    const queue = sources;
    const found = new Map();
    for (let q = 0; q < queue.length; q++) {
      const at = queue[q];
      const key = `${at.id}#${rules.stateKey(at.st)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (targets.includes(at.id)) { if (!found.has(key)) found.set(key, at); continue; }
      for (const c of shape.scenes[at.id].choices) if (rules.usable(c, at.st)) queue.push({ id: c[2], st: rules.apply(shape, at.st, c), n: at.n + 1 });
    }
    sources = [...found.values()];
    if (!sources.length) break;
  }
  if (sources.length) oneWay = { end: sources[0].id, choices: Math.min(...sources.map((s) => s.n)), ways: sources.length };
  else bad('no single way reaches every reveal layer (pencil, spring, four hours, twelve) and ends on a spring ending');
}

// Every ending is earned: its shortest way, and the state it needs, differ from every other ending's.
const endWays = data.scenes.filter((s) => s.ending).map((s) => {
  const w = x.scenes[s.id];
  if (!w) { bad(`the ending ${s.id} is never reached`); return null; }
  return { id: s.id, name: s.ending, picks: w.picks.length, state: w.state };
}).filter(Boolean);
{
  const feeders = new Map();
  for (const s of data.scenes) for (const c of s.choices) if (scenes.get(c.next).ending) feeders.set(c.next, [...(feeders.get(c.next) || []), `${s.id}:${JSON.stringify([c.requires, c.forbids, c.meters])}`]);
  const sigs = new Map([...feeders].map(([id, list]) => [id, [...new Set(list)].sort().join('|')]));
  const dup = [...sigs].filter(([id, sig], i, a) => a.findIndex(([, s2]) => s2 === sig) !== i);
  for (const [id] of dup) bad(`the ending ${id} is reached under the same conditions as another ending`);
}

if (t.min / 60 < 30) bad(`the shortest way through is ${(t.min / 60).toFixed(1)} minutes (needs 30)`);
if (allEndings < 8) bad(`${allEndings} endings (needs 8)`);
if (deeLines < 40) bad(`Dee has ${deeLines} lines`);
if (t.mean / 60 < 42 || t.mean / 60 > 48) bad(`the average way through is ${(t.mean / 60).toFixed(1)} minutes (about 45 wanted: 42 to 48)`);

if (!process.argv.includes('--quiet')) {
  console.log(`${data.scenes.length} scenes, ${lineCount} lines (${deeLines} Dee), ${allEndings} endings, ${x.states} states explored${x.capped ? ' (CAPPED)' : ''}`);
  console.log(`playing time: shortest ${(t.min / 60).toFixed(1)} min | average ${(t.mean / 60).toFixed(1)} min (every open choice equally likely) | median ${pct(0.5)} (3000 random plays: 10% ${pct(0.1)}, 90% ${pct(0.9)}) | longest ${(t.max / 60).toFixed(1)} min`);
  console.log(`endings met in 3000 random plays: ${endings.size} of ${allEndings}; Pierce speaks in: ${pierceScenes.join(', ') || 'nowhere'}`);
  console.log(`decisions that change nothing: ${deadDecisions}`);
  console.log(`reveal layers: ${layerLines.join(' | ')} | one way through all of them: ${oneWay ? `yes, ${oneWay.choices} choices` : 'NO'}`);
  console.log(`endings (shortest way, in choices): ${endWays.map((e) => `${e.name.replace(/\.$/, '')} ${e.picks}`).join(', ')}`);
}
if (problems.length) {
  for (const p of problems) console.error('problem  ' + p);
  console.error(`${problems.length} problem(s)`);
  process.exit(1);
}
console.log('ok       night-shift');
