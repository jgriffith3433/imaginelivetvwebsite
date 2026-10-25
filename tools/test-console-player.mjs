#!/usr/bin/env node
// Runs the console player (js/console.js) for real in jsdom and checks what a browser-less server can: a reload at the
// start, mid-scene, right after a choice and at an ending restores the scene, flags, meters, history, log and heard
// lines; Skip/Replay; the Log is a Daily Activity Report with a redacted row per way not taken and nothing pressable;
// with localStorage (and the cookies) refusing every call the story still plays a choice, opens the Log and toggles CC.
// Layout (390x844, 360x640, 844x390) and real taps need a browser: that is the `console` playtest.
//
//   node tools/test-console-player.mjs          (jsdom is a devDependency: npm ci; JSDOM_DIR=<folder with node_modules/jsdom> still works)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let JSDOM;
try {
  const req = createRequire(path.join(process.env.JSDOM_DIR || ROOT, 'x.js'));
  ({ JSDOM } = req('jsdom'));
} catch {
  console.log('skip jsdom is not installed (JSDOM_DIR=<folder with node_modules/jsdom>); nothing checked');
  process.exit(0);
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const section = html.slice(html.indexOf('<section class="console"'), html.indexOf('</section>', html.indexOf('<section class="console"')) + 10);
const rulesSrc = fs.readFileSync(path.join(ROOT, 'js/console-rules.js'), 'utf8');
const playerSrc = fs.readFileSync(path.join(ROOT, 'js/console.js'), 'utf8');
const data = Function(`const window = {}; ${fs.readFileSync(path.join(ROOT, 'js/story-data.js'), 'utf8')}; return window.ILTV_STORIES;`)();
const story = data.stories.find((s) => s.id === 'night-shift');

let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     ${extra === undefined ? '' : JSON.stringify(extra)}`}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A page: the console markup, the rules and the player, with timers 100x faster and audio that ends at once.
    `blocked`: localStorage and the cookie jar refuse every call. */
function page({ store, blocked, fakeRO } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${section}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  const w = dom.window;
  const realSet = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms, ...a) => realSet(fn, Math.max(0, Math.round((ms || 0) / 100)), ...a);
  w.scrollTo = () => {};
  w.HTMLMediaElement.prototype.play = function () {
    const el = this;
    realSet(() => { if (typeof el.onended === 'function') el.onended(); }, 12);
    return Promise.resolve();
  };
  w.HTMLMediaElement.prototype.pause = function () {};
  if (blocked) {
    const refuse = () => { throw new w.DOMException('The operation is insecure.', 'SecurityError'); };
    Object.defineProperty(w, 'localStorage', { get: refuse });
    Object.defineProperty(w, 'sessionStorage', { get: refuse });
    Object.defineProperty(w.document, 'cookie', { get: refuse, set: refuse });
  } else if (store) {
    for (const [k, v] of Object.entries(store)) w.localStorage.setItem(k, v);
  }
  if (fakeRO) w.ResizeObserver = fakeRO;
  w.eval(rulesSrc);
  w.eval(playerSrc);
  const hooks = {
    place: null,
    visit: (id) => { hooks.place = id; hooks.seen.add(id); return Math.floor((hooks.seen.size * 100) / Object.keys(story.scenes).length); },
    history: () => {},
    tell: () => {},
    seen: new Set(),
  };
  return { w, hooks, c: w.iltvConsole, doc: w.document, $: (id) => w.document.getElementById(id) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, what) => {
  for (let i = 0; i < 4000; i++) { if (fn()) return true; await sleep(1); }
  throw new Error(`timed out waiting for ${what}`);
};
const snapshot = (p) => ({ scene: p.c.scene(), flags: p.c.flags(), meters: p.c.meters(), history: p.c.history(), log: p.c.log(), done: p.c.lines().done, selected: p.c.selected() });
const subsCount = (p) => p.$('console-subs').children.length;
const heard = (p) => p.c.lines().done >= p.c.lines().total && p.c.lines().playing < 0 && p.$('console').dataset.lines === 'done';
const rules = (p) => p.w.iltvConsoleRules;

/** Plays lines to the end and presses the first usable choice, `n` times (or until an ending). */
async function walk(p, n) {
  for (let i = 0; i < n; i++) {
    await until(() => heard(p), `lines of ${p.c.scene()}`);
    const buttons = p.$('console-choices').querySelectorAll('.choice');
    if (!buttons.length) return;
    buttons[buttons.length - 1 > 2 ? 1 : 0].click();
  }
}

/** A reload: the old page is gone, a new one has only what the browser keeps (localStorage, the cookie's place). */
function reload(p) {
  const store = {};
  for (let i = 0; i < p.w.localStorage.length; i++) { const k = p.w.localStorage.key(i); store[k] = p.w.localStorage.getItem(k); }
  const place = p.hooks.place;
  const before = snapshot(p);
  p.c.close();
  const q = page({ store });
  q.hooks.seen = new Set(p.hooks.seen);
  q.c.open(story, q.hooks, place);
  q.before = before;
  return q;
}

async function main() {
  // --- reload restores the exact state
  let p = page();
  p.c.open(story, p.hooks, null);
  check('opens at the start with no lines heard', p.c.scene() === story.start && p.c.lines().done === 0);
  p.c.log(); // a view must not change the run
  let q = reload(p);
  check('reload at the start: same scene, flags, meters, log, lines', same(q.before, snapshot(q)), [q.before, snapshot(q)]);
  p = q;

  await walk(p, 6);
  await until(() => p.c.lines().done >= 1 && p.c.lines().done < p.c.lines().total, 'a scene part-way through its lines');
  const midSubs = subsCount(p);
  q = reload(p);
  const mid = q.before;
  check('reload mid-scene: same scene, flags, meters, history, log and lines heard', same(mid, snapshot(q)) && mid.done >= 1, [mid, snapshot(q)]);
  check('reload mid-scene: the lines already heard are shown again', subsCount(q) >= mid.done && midSubs >= mid.done, { midSubs, now: subsCount(q), done: mid.done });
  p = q;

  await until(() => heard(p), 'the lines of the scene');
  p.$('console-choices').querySelector('.choice').click();
  const choice = snapshot(p);
  q = reload(p);
  check('reload right after a choice: same scene, flags, meters, history, log; no lines heard', same(snapshot(q), { ...choice, done: 0 }), [choice, snapshot(q)]);
  p = q;

  // Skip and Replay
  await sleep(10);
  p.$('console-skip').click();
  await until(() => heard(p), 'Skip to finish the lines');
  check('Skip takes the lines as heard and the choices show', p.$('console-choices').querySelectorAll('.choice').length > 0 && !p.$('console-choices').hidden);
  p.$('console-replay').click();
  await until(() => heard(p), 'Replay to finish');
  check('Replay hears the last line again, then the choices are back', p.$('console-choices').querySelectorAll('.choice').length > 0);

  // The Log: a Daily Activity Report, a redacted row per way not taken, nothing pressable
  p.$('console-log-btn').click();
  const log = p.$('console-log');
  const entries = p.c.log();
  check('the Log opens as a Daily Activity Report', !log.hidden && /Daily Activity Report/.test(log.textContent));
  const redactedRows = log.querySelectorAll('tr.is-redacted').length;
  const expectRedacted = entries.reduce((n, e) => n + (e.k === 'c' ? e.o : 0), 0) + story.scenes[p.c.scene()].choices.length;
  check('the Log redacts every way not taken (and the choices now open)', redactedRows === expectRedacted, { redactedRows, expectRedacted });
  check('nothing in the Log can be pressed', log.querySelectorAll('button, a, input, [tabindex], [role="button"]').length === 0);
  check('the redacted rows hold no text', [...log.querySelectorAll('tr.is-redacted')].every((r) => r.textContent.trim() === ''));
  p.$('console-log-btn').click();
  check('the Log button closes it again', log.hidden);

  // Ending: the cheapest way, from the explorer, by real presses on the buttons
  const ex = rules(p).explore(story, { cap: story.stateCap || 400000 });
  const endId = Object.keys(story.scenes).find((id) => story.scenes[id].ending && ex.scenes[id]);
  const picks = ex.scenes[endId].picks;
  p.c.close();
  p = page();
  p.c.open(story, p.hooks, null);
  for (const pick of picks) {
    await until(() => heard(p), `lines of ${p.c.scene()}`);
    const button = p.$('console-choices').querySelector(`.choice[data-choice="${pick}"]`);
    if (!button) throw new Error(`choice ${pick} of ${p.c.scene()} is not on screen`);
    button.click();
  }
  await until(() => heard(p), 'the ending');
  check('plays to an ending by presses', p.c.scene() === endId && !p.$('console-ending').hidden && p.$('console-choices').hidden);
  const end = snapshot(p);
  q = reload(p);
  check('reload at an ending: same scene, flags, meters, history, log; the end screen is back', same(snapshot(q), { ...end, done: story.scenes[endId].lines.length }) && !q.$('console-ending').hidden, [end, snapshot(q)]);
  q.$('console-log-btn').click();
  check('the Log at the ending says the shift is signed', /Signed/.test(q.$('console-log').textContent) && q.$('console-log').querySelectorAll('tr.is-redacted').length === end.log.reduce((n, e) => n + (e.k === 'c' ? e.o : 0), 0));
  q.c.close();


  // --- fitSubs against a ResizeObserver that re-fires on every style write to the strip (the layout loop)
  for (const [name, grow, max] of [['a stable layout settles', false, 3], ['a layout that grows with every write is capped', true, 5]]) {
    const observers = [];
    class FakeRO { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() {} }
    const l = page({ fakeRO: FakeRO });
    l.c.open(story, l.hooks, null);
    await until(() => heard(l), 'the scene heard');
    const subs = l.$('console-subs');
    let writes = 0, h = 40, inline = '';
    const fire = () => observers.forEach((o) => o.cb([]));
    Object.defineProperty(subs.style, 'minHeight', {
      get: () => inline,
      set: (v) => { inline = v; writes++; if (grow) h += 10; fire(); },
    });
    Object.defineProperty(l.w.HTMLElement.prototype, 'offsetHeight', { get: () => h, configurable: true });
    l.w.getComputedStyle = () => ({ paddingTop: '4px', paddingBottom: '4px' });
    fire();
    await sleep(120);
    check(`fitSubs: ${name} in at most ${max} writes (${writes})`, writes >= 1 && writes <= max, writes);
    l.c.close();
  }

  // --- storage refusing every call
  let errors = [];
  const b = page({ blocked: true });
  b.w.addEventListener('error', (e) => errors.push(e.message));
  try {
    b.c.open(story, b.hooks, null);
    b.$('console-cc').click();
    await until(() => heard(b), 'lines with storage blocked');
    b.$('console-choices').querySelector('.choice').click();
    b.$('console-log-btn').click();
    check('with storage blocked the story plays a choice, opens the Log and toggles CC', b.c.history().length === 1 && !b.$('console-log').hidden && b.$('console-cc').getAttribute('aria-pressed') === 'false' && !errors.length, errors);
    b.c.close();
    b.c.open(story, b.hooks, b.hooks.place);
    check('with storage blocked, All stories and back keeps the run within the page', b.c.history().length === 1, b.c.history());
    b.c.close();
  } catch (e) {
    check('with storage blocked the story still plays', false, String(e && e.stack || e));
  }
}

await main();
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
