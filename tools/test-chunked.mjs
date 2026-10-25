#!/usr/bin/env node
// Checks the chunked (sliced, async) state explorer and way lengths in js/console-rules.js return exactly what the
// plain synchronous versions do, and that the slices really hand the thread back. The reference `oldLengths` below is the
// recursive function js/playtest.js used before it was sliced (nightLengthsOf), kept here as the yardstick.
//
//   node tools/test-chunked.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = Function(`const window = {}; ${fs.readFileSync(path.join(ROOT, 'js/story-data.js'), 'utf8')}; return window.ILTV_STORIES;`)();
const g = {};
Function('globalThis', fs.readFileSync(path.join(ROOT, 'js/console-rules.js'), 'utf8'))(g);
const R = g.iltvConsoleRules;

function oldLengths(st) {
  const dur = Object.fromEntries(Object.entries(st.scenes).map(([id, sc]) => [id, sc.lines.reduce((a, l) => a + (l.dur || 0) + 0.35, 0)]));
  const memo = new Map();
  const go = (id, state) => {
    const key = `${id}#${R.stateKey(state)}`;
    if (memo.has(key)) return memo.get(key);
    const open = st.scenes[id].choices.map((c, i) => [c, i]).filter(([c]) => R.usable(c, state));
    let r;
    if (!open.length) r = { min: dur[id], max: dur[id], mean: dur[id] };
    else {
      const next = open.map(([c, i]) => ({ i, ...go(c[2], R.apply(st, state, c)) }));
      const lo = next.reduce((a, b) => (b.min < a.min ? b : a));
      const hi = next.reduce((a, b) => (b.max > a.max ? b : a));
      r = { min: dur[id] + lo.min, max: dur[id] + hi.max, mean: dur[id] + next.reduce((a, b) => a + b.mean, 0) / next.length, lo: lo.i, hi: hi.i };
    }
    memo.set(key, r);
    return r;
  };
  const wayOf = (which) => {
    let id = st.start;
    let state = R.fresh(st);
    const picks = [];
    for (;;) {
      const r = go(id, state);
      const i = which === 'lo' ? r.lo : r.hi;
      if (i == null) return picks;
      picks.push(i);
      const c = st.scenes[id].choices[i];
      state = R.apply(st, state, c);
      id = c[2];
    }
  };
  const top = go(st.start, R.fresh(st));
  return { dur, shortest: top.min, longest: top.max, mean: top.mean, shortestWay: wayOf('lo'), longestWay: wayOf('hi'), states: memo.size };
}

let failed = 0;
for (const st of data.stories.filter((s) => s.type === 'console')) {
  try {
    let ticks = 0;
    // sliceMs 0: hand the thread back after every step, so the tick count proves the work is sliced
    const run = { sliceMs: 0, tick: () => { ticks++; return Promise.resolve(); } };
    const want = oldLengths(st);
    assert.deepEqual(R.lengths(st), want, 'lengths()');
    assert.deepEqual(await R.lengthsAsync(st, run), want, 'lengthsAsync()');
    const lengthTicks = ticks;
    const opts = { cap: st.stateCap || 50000 };
    const sync = R.explore(st, opts);
    ticks = 0;
    let last = null;
    const async_ = await R.exploreAsync(st, opts, { ...run, onProgress: (p) => { last = p; } });
    assert.deepEqual(async_, sync, 'exploreAsync()');
    if (sync.states > 600) {
      assert.ok(ticks > 0 && lengthTicks > 0, 'the work yields the thread');
      assert.ok(last && last.states > 0, 'progress is reported');
    }
    console.log(`ok   ${st.id}: chunked lengths and explorer equal the synchronous ones (${sync.states} states, ${ticks} yields)`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${st.id}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
