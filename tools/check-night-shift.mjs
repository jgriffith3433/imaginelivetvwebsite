// Checks story/night-shift.json (the text-only slice) against the style guide and the slice's acceptance
// criteria in story/night-shift.md / story/night-shift-slice-notes.md. Not wired into build-story.mjs.
//   node tools/check-night-shift.mjs
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../story/night-shift.json', import.meta.url), 'utf8'));
const problems = [];
const bad = (m) => problems.push(m);
const scenes = new Map(data.scenes.map((s) => [s.id, s]));
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
// a sentence of four words or more counts; fragments ("One. Lobby.") are free, but a line stays under 32 words
const sentences = (t) => t.split(/(?<=[.!?…])\s+/).filter((x) => words(x) >= 4);

const BANNED = [
  /i['’]ve seen things/i, /in my (twenty|\d+) years/i, /back in my day/i, /you['’]ll understand someday/i, /\btrust me\b/i, /i['’]m retiring/i,
  /\bi['’]m (scared|afraid|lonely|proud)\b/i, /\bi (miss|care|lost)\b/i, /proud of you/i,
  /\bboundar(y|ies)\b/i, /\bclosure\b/i, /\bprocess(ing)? (this|that|your)\b/i, /observe and report/i,
  /\b(hack|decode|defuse|tackle)\b/i, /stay here,? i['’]ll handle/i,
];
const DEE_NEVER = [/\bkid\b/i, /\brookie\b/i];
const FIRST_NAMES = /\b(hale|voss|lang)\b/i;

const flagsSet = new Set(), flagsRead = new Set();
const readsIn = (expr) => { if (expr) for (const m of String(expr).matchAll(/!?([a-z_0-9]+)(?:==|>=|<=)?/g)) flagsRead.add(m[1]); };
let deeTotal = 0;

for (const s of data.scenes) {
  if (words(s.text) > 40) bad(`${s.id}: text is ${words(s.text)} words (max 40)`);
  if (s.text.split('\n').length > 1) bad(`${s.id}: text is more than one paragraph`);
  for (const k of ['time', 'ambience', 'wall']) if (!s[k]) bad(`${s.id}: no ${k}`);
  for (let i = 1; i <= 9; i++) if (!s.wall?.[`C${i}`]) bad(`${s.id}: wall feed C${i} missing`);
  if (!s.slice_end && !s.choices?.length) bad(`${s.id}: no choices`);
  if (s.enter) { for (const f of Object.keys(s.enter.set || {})) flagsSet.add(f); }
  for (const [i, l] of (s.lines || []).entries()) {
    const at = `${s.id} line ${i + 1} (${l.who})`;
    if (!data.characters[l.who]) bad(`${at}: unknown speaker`);
    if (!l.dir) bad(`${at}: no performance direction`);
    if (sentences(l.text).length > 3 || words(l.text) > 32) bad(`${at}: a speech (over three sentences or 32 words)`);
    if (l.who === 'pierce') bad(`${at}: Pierce speaks outside the cameo`);
    for (const re of BANNED) if (re.test(l.text)) bad(`${at}: banned pattern ${re}`);
    if (l.who === 'dee') for (const re of DEE_NEVER) if (re.test(l.text)) bad(`${at}: Dee never says that`);
    if (/\b(i feel|feeling|sad|lonely|grief|heartbroken)\b/i.test(l.text)) bad(`${at}: states a feeling`);
    readsIn(l.if);
    if (l.who === 'dee') deeTotal++;
  }
  for (const re of BANNED) if (re.test(s.text)) bad(`${s.id}: text hits banned pattern ${re}`);
  if (FIRST_NAMES.test(JSON.stringify(s))) bad(`${s.id}: a Board name appears`);
  for (const w of data.unspoken) if (new RegExp(`\\b${w}`, 'i').test(JSON.stringify(s))) bad(`${s.id}: unspoken word "${w}"`);
  for (const [i, c] of (s.choices || []).entries()) {
    const at = `${s.id} choice ${i + 1}`;
    const n = words(c.text);
    if (n < 2 || n > 6) bad(`${at}: "${c.text}" is ${n} words (2 to 6)`);
    if (!scenes.has(c.to)) bad(`${at}: goes to unknown scene ${c.to}`);
    const e = c.effects || {};
    const changes = Object.keys(e.set || {}).length + Object.values(e.add || {}).filter((v) => v).length + (e.log ? 1 : 0);
    const next = scenes.get(c.to);
    if (!changes && !c.cosmetic) bad(`${at}: "${c.text}" changes nothing`);
    for (const f of Object.keys(e.set || {})) flagsSet.add(f);
    for (const m of Object.keys(e.add || {})) if (!data.state.meters[m]) bad(`${at}: unknown meter ${m}`);
    readsIn(c.requires);
    if (e.log && words(e.log) > 60) bad(`${at}: log line too long`);
    void next;
  }
  readsIn(s.requires);
}

// reachability and Dee's lines on the shortest path (unconditional ones) and on the longest
const seen = new Set([data.start]); const q = [data.start];
while (q.length) for (const c of scenes.get(q.shift()).choices || []) if (!seen.has(c.to)) { seen.add(c.to); q.push(c.to); }
for (const id of scenes.keys()) if (!seen.has(id)) bad(`${id}: unreachable`);
const memo = new Map();
const best = (id, fn) => {
  const key = id + fn.name; if (memo.has(key)) return memo.get(key);
  const s = scenes.get(id);
  const own = (s.lines || []).filter((l) => l.who === 'dee' && !l.if).length;
  const next = (s.choices || []).map((c) => best(c.to, fn));
  const v = own + (next.length ? fn(...next) : 0);
  memo.set(key, v); return v;
};
function lo(...a) { return Math.min(...a); }
const deeMin = best(data.start, lo);
if (deeMin < 40) bad(`Dee has only ${deeMin} unconditional lines on the shortest path (need 40)`);

const declared = data.state.flags;
for (const f of flagsSet) { if (!declared[f] && !data.state.logs?.[f]) bad(`flag ${f} is set but not declared`); }
for (const [f, kind] of Object.entries(declared)) {
  if (kind === 'slice' && !flagsRead.has(f) && !data.state.flags_read_later.includes(f)) bad(`flag ${f} is never read`);
  if (!flagsSet.has(f)) bad(`flag ${f} is declared but never set`);
}
const sceneMin = data.scenes.length;

console.log(`${sceneMin} scenes, Dee: ${deeTotal} lines in total, ${deeMin} on the shortest way (unconditional)`);
if (problems.length) { for (const p of problems) console.error('problem  ' + p); process.exit(1); }
console.log('ok       night-shift slice');
