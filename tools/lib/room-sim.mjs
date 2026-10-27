// Plays Night Shift's scenes through the real room code (js/console-room.js) in jsdom on a virtual clock, and records the room's state at
// every moment a viewer could see something change: as a scene opens, as each line starts, at each timed beat and once the motion has
// settled. No browser, no audio: a line lasts its `dur`. Used by tools/room-art.mjs (checks and composites), tools/make-storyboard.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadStory() {
  const data = Function(`const window = {}; ${fs.readFileSync(path.join(ROOT, 'js/story-data.js'), 'utf8')}; return window.ILTV_STORIES;`)();
  const story = data.stories.find((s) => s.id === 'night-shift');
  // the built data keeps what the player needs; the checks also read how a line is performed and treated (radio, phone) from the source
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'story/night-shift.json'), 'utf8'));
  for (const sc of src.scenes) sc.lines.forEach((l, i) => { const t = story.scenes[sc.id].lines[i]; if (l.treatment) t.treatment = l.treatment; if (l.perform) t.perform = l.perform; if (l.offstage) t.offstage = true; });
  story.speakers = src.speakers;
  return story;
}
export const loadStage = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'night-shift/media/stage/stage.json'), 'utf8'));

/** A fresh room (jsdom + a virtual clock). Returns { R, now(), advance(ms) }. */
export function makeRoom() {
  let JSDOM;
  try { ({ JSDOM } = createRequire(path.join(process.env.JSDOM_DIR || ROOT, 'x.js'))('jsdom')); } catch { throw new Error('jsdom is not installed (npm ci)'); }
  const dom = new JSDOM('<body><div id="console-room"><div id="console-room-art"></div><figure id="console-big"></figure><div id="console-room-figs"></div></div><p id="console-action"></p></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  let clock = 0, seq = 0;
  let queue = [];
  w.setTimeout = (fn, ms) => { const id = ++seq; queue.push({ id, t: clock + (ms || 0), fn }); return id; };
  w.clearTimeout = (id) => { queue = queue.filter((q) => q.id !== id); };
  w.requestAnimationFrame = (fn) => w.setTimeout(fn, 0);
  w.eval(fs.readFileSync(path.join(ROOT, 'js/console-room.js'), 'utf8'));
  const advance = (ms) => {
    const end = clock + ms;
    for (;;) {
      queue.sort((a, b) => a.t - b.t || a.id - b.id);
      const next = queue[0];
      if (!next || next.t > end) break;
      queue.shift();
      clock = next.t;
      next.fn();
    }
    clock = end;
  };
  const R = w.iltvRoom;
  R.useStage(loadStage());
  return { R, now: () => clock, advance, doc: w.document };
}

const acts = (l) => (l.act == null ? [] : Array.isArray(l.act) ? l.act : [l.act]).map((a) => (typeof a === 'string' ? { act: a, at: 0 } : a));
export const actsOf = acts;

/** Every state of one scene: [{ scene, line, kind, t, beat, layers, actors, place, still, said, acts }]. */
export function playScene(story, id, room = makeRoom()) {
  const { R, advance } = room;
  const s = story.scenes[id];
  const states = [];
  const snap = (kind, line, extra = {}) => {
    const v = R.view();
    states.push({ scene: id, line, kind, place: v.place, still: v.photo.still, on: v.photo.on, layers: Object.fromEntries(Object.entries(v.photo.layers).filter(([, f]) => f)), actors: Object.fromEntries(Object.entries(v.actors).map(([k, a]) => [k, { present: a.present, shown: a.shown }])), door: v.photo.door, said: v.said.slice(-1)[0] || '', ...extra });
  };
  R.scene({ id, time: s.time, place: s.place, cast: s.cast, away: s.away, lines: s.lines });
  snap('open', -1);
  s.lines.forEach((l, i) => {
    R.line(i);
    if (l.place) advance(300); // a change of place swaps the picture after ~220 ms
    const beats = acts(l);
    snap('line', i, { speaker: l.speaker, acts: beats.filter((b) => !(b.at > 0)).map((b) => b.act) });
    const dur = (+l.dur > 0 ? +l.dur : 3) * 1000;
    // the room's own timers fire the beats as the clock passes them; sample each beat as it happens and 1.5 s later, once the motion has settled
    const marks = [];
    beats.filter((b) => b.at > 0).forEach((b, k, all) => {
      const at = Math.round(b.at * dur);
      marks.push({ at, kind: 'beat', beat: b });
      const nextAt = all[k + 1] ? Math.round(all[k + 1].at * dur) : dur;
      if (at + 1500 < nextAt) marks.push({ at: at + 1500, kind: 'settled', beat: b });
    });
    let t = 0;
    for (const m of marks) {
      advance(m.at - t);
      t = m.at;
      snap(m.kind, i, { at: m.beat.at, acts: [m.beat.act] });
    }
    advance(Math.max(0, dur - t));
    snap('end', i, { acts: [] });
  });
  return states;
}
