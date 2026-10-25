#!/usr/bin/env node
// Plays every ending of Night Shift through the real console player (js/console.js) in jsdom, by real button presses on the
// fewest-choices way to each (the one the `night-shift-signoff` playtest presses), and checks at every scene what a
// browser-less server can: the scene reached is the one the rules give, the buttons on screen are exactly the choices whose
// conditions hold (by choice, not by label), the subtitles are the lines in order, the ending is shown with its card, and every
// file the scene names (lines, bed, effects, camera pictures, end card) exists on disk. Prints the minutes of audio each way
// holds (each line's recording plus the player's 0.35 s gap). Layout, sound and sync need a browser: that is the playtest.
//
//   node tools/test-endings.mjs [end-scene]      (jsdom is a devDependency: npm ci)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let JSDOM;
try {
  ({ JSDOM } = createRequire(path.join(process.env.JSDOM_DIR || ROOT, 'x.js'))('jsdom'));
} catch {
  console.log('skip jsdom is not installed (JSDOM_DIR=<folder with node_modules/jsdom>); nothing checked');
  process.exit(0);
}
const GAP = 0.35;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = html.indexOf('<section class="console"');
const section = html.slice(start, html.indexOf('</section>', start) + 10);
const rulesSrc = fs.readFileSync(path.join(ROOT, 'js/console-rules.js'), 'utf8');
const playerSrc = fs.readFileSync(path.join(ROOT, 'js/console.js'), 'utf8');
const data = Function(`const window = {}; ${fs.readFileSync(path.join(ROOT, 'js/story-data.js'), 'utf8')}; return window.ILTV_STORIES;`)();
const story = data.stories.find((s) => s.id === 'night-shift');

let failed = 0;
const unmade = new Set(); // lines with no recording yet (ElevenLabs billing): a warning, the player skips them after dur + 4 s
const bad = (msg) => { failed++; console.log(`FAIL ${msg}`); };
const exists = (url) => url && fs.existsSync(path.join(ROOT, url.replace(/^\//, '')));

function page() {
  const dom = new JSDOM(`<!doctype html><body>${section}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  const w = dom.window;
  const realSet = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms, ...a) => realSet(fn, Math.max(0, Math.round((ms || 0) / 100)), ...a);
  w.scrollTo = () => {};
  w.HTMLMediaElement.prototype.play = function () {
    const el = this;
    realSet(() => { if (typeof el.onended === 'function') el.onended(); }, 3);
    return Promise.resolve();
  };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.eval(rulesSrc);
  w.eval(playerSrc);
  const hooks = {
    seen: new Set(),
    visit: (id) => { hooks.seen.add(id); return Math.floor((hooks.seen.size * 100) / Object.keys(story.scenes).length); },
    history: () => {},
    tell: () => {},
  };
  return { w, hooks, c: w.iltvConsole, R: w.iltvConsoleRules, $: (id) => w.document.getElementById(id) };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const heard = (p) => p.c.lines().done >= p.c.lines().total && p.c.lines().playing < 0 && p.$('console').dataset.lines === 'done';
async function until(fn, what) {
  for (let i = 0; i < 20000; i++) { if (fn()) return; await sleep(1); }
  throw new Error(`timed out waiting for ${what}`);
}

const only = process.argv[2];
const ex = page().R.explore(story, { cap: story.stateCap || 400000 });
const rows = [];
for (const [id, sc] of Object.entries(story.scenes).filter(([id, s]) => s.ending && (!only || only === id))) {
  const picks = ex.scenes[id].picks;
  const p = page();
  p.c.open(story, p.hooks, null);
  const m = { scene: story.start, state: p.R.fresh(story) };
  let seconds = 0;
  let problems = 0;
  const flag = (msg) => { problems++; bad(`${sc.ending[0]} (${id}) at ${m.scene}: ${msg}`); };
  const check = () => {
    const s = story.scenes[m.scene];
    seconds += s.lines.reduce((a, l) => a + l.dur + GAP, 0);
    if (p.c.scene() !== m.scene) return flag(`the player is at ${p.c.scene()}`);
    const usable = s.ending ? [] : s.choices.map((c, i) => i).filter((i) => p.R.usable(s.choices[i], m.state));
    const onScreen = [...p.w.document.querySelectorAll('#console-choices .choice')].map((b) => Number(b.dataset.choice));
    for (const i of onScreen) if (!usable.includes(i)) flag(`"${s.choices[i][0]}" shows although its conditions fail`);
    for (const i of usable) if (!onScreen.includes(i)) flag(`"${s.choices[i][0]}" is missing although its conditions hold`);
    const subs = [...p.w.document.querySelectorAll('#console-subs .sub')].map((e) => e.textContent.trim());
    if (subs.length !== s.lines.length || subs.some((t, i) => !t.endsWith(s.lines[i].text))) flag('the subtitles are not the lines in order');
    s.lines.forEach((l, n) => { if (!l.file) unmade.add(`${m.scene}#${n + 1}`); else if (!exists(l.file)) flag(`no recording ${l.file}`); });
    if (s.ambience && !exists(story.ambience[s.ambience])) flag(`no bed ${s.ambience}`);
    for (const cam of story.cameras) {
      const state = (s.feeds && s.feeds[cam.id]) || 'normal';
      const img = cam.states[state] && cam.states[state].image;
      if (!exists(img)) flag(`no picture for camera ${cam.id} in state ${state}`);
    }
    if (s.endcard && !exists(s.endcard)) flag(`no end card ${s.endcard}`);
  };
  await until(() => heard(p), 'the first scene');
  check();
  for (const i of picks) {
    const c = story.scenes[m.scene].choices[i];
    const b = p.$('console-choices').querySelector(`.choice[data-choice="${i}"]`);
    if (!b) { flag(`choice ${i} "${c[0]}" is not on screen`); break; }
    b.click();
    m.state = p.R.apply(story, m.state, c);
    m.scene = c[2];
    await until(() => heard(p), `lines of ${m.scene}`);
    check();
  }
  const text = p.$('console-ending').textContent.trim();
  if (m.scene !== id || p.$('console-ending').hidden || text !== sc.ending[0]) flag(`the ending isn't shown (${text})`);
  if (!p.$('console-choices').hidden) flag('choices show at an ending');
  rows.push({ id, ending: sc.ending[0], choices: picks.length, minutes: seconds / 60, problems });
  console.log(`${problems ? 'FAIL' : 'ok  '} ${sc.ending[0].padEnd(24)} ${id.padEnd(18)} ${String(picks.length).padStart(3)} choices  ${(seconds / 60).toFixed(1)} min of audio`);
}
if (!rows.length) bad('no ending played');
if (unmade.size) console.log(`warn ${unmade.size} line(s) on these ways have no recording yet (unmade, not a failure)`);
console.log(failed ? `${failed} problem(s)` : `all ok: ${rows.length} endings played by real presses`);
process.exit(failed ? 1 : 0);
