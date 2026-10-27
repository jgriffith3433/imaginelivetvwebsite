#!/usr/bin/env node
// Runs the control room (js/console-room.js) for real in jsdom against Night Shift's data and checks what a browser-less
// server can: every scene opens, every line's acts run without a throw, the people are where the data puts them (in the
// room as silhouettes, out of it in the place they are in, in daylight at the endings), and the moments the story needs to
// show are there (someone stands up, someone comes in at the door, the phone is answered, something is written in the log,
// coffee spills, the screen is touched, someone gets angry). Looks and layout need a browser: that is the `room` playtest.
//
//   node tools/test-console-room.mjs          (jsdom is a devDependency: npm ci; JSDOM_DIR=<folder with node_modules/jsdom> still works)
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

const src = fs.readFileSync(path.join(ROOT, 'js/console-room.js'), 'utf8');
const data = Function(`const window = {}; ${fs.readFileSync(path.join(ROOT, 'js/story-data.js'), 'utf8')}; return window.ILTV_STORIES;`)();
const story = data.stories.find((s) => s.id === 'night-shift');

let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     ${extra === undefined ? '' : JSON.stringify(extra)}`}`);
};

function stage() {
  const dom = new JSDOM('<body><div id="console-room"><div id="console-room-art"></div><figure id="console-big"></figure><div id="console-room-figs"></div></div><p id="console-action"></p></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.setTimeout = () => 0; // the moments are checked by their start; none waits for a timer here
  w.eval(src);
  return { R: w.iltvRoom, doc: w.document };
}

const def = (id) => {
  const s = story.scenes[id];
  return { id, time: s.time, place: s.place, cast: s.cast, away: s.away, lines: s.lines };
};
const play = (R, id, upTo) => {
  const s = story.scenes[id];
  R.scene(def(id));
  const said = [];
  for (let i = 0; i < (upTo ?? s.lines.length); i++) {
    R.line(i);
    R.runBeats(); // the line's timed beats (act { act, at }) happen now: the tests never wait
  }
  said.push(...R.view().said);
  return said;
};

/* every scene opens and every line runs; the whole data keeps the room standing */
{
  const { R } = stage();
  let threw = null;
  let acts = 0;
  const seen = {};
  for (const [id, s] of Object.entries(story.scenes)) {
    try {
      R.scene(def(id));
      s.lines.forEach((l, i) => {
        R.line(i);
        for (const a of (l.act == null ? [] : Array.isArray(l.act) ? l.act : [l.act]).map((e) => (typeof e === 'string' ? e : e.act))) {
          acts++;
          const k = a.split(':').slice(0, 2).join(':').replace(/^[a-z]+:/, '');
          seen[k] = (seen[k] || 0) + 1;
        }
      });
      R.catchUp(s.lines.length);
      const v = R.view();
      if (!v.place || !v.mode) throw new Error(`${id}: no place after its lines`);
    } catch (e) {
      threw = `${id}: ${e.message}`;
      break;
    }
  }
  check('every scene opens and every line runs in the room', !threw, threw);
  check('the data holds acts for the room (some hundreds)', acts > 250, acts);
  for (const verb of ['stand', 'enter', 'leave', 'phone', 'write', 'spill', 'touch', 'angry', 'knock', 'count', 'ring', 'door', 'hangup', 'sit', 'eat', 'press'])
    check(`the data uses "${verb}"`, !!seen[verb], seen);
}

/* silhouettes in the room, people out of it, daylight at the endings */
{
  const { R } = stage();
  R.scene(def('the-chairs'));
  let v = R.view();
  check('the room opens with silhouettes in front of the screen', v.mode === 'room' && v.look === 'sil' && v.place === 'room', v);
  check('the trainee starts standing, Dee seated', v.actors.you.posture === 'standing' && v.actors.dee.posture === 'seated', v.actors);
  play(R, 'the-chairs');
  v = R.view();
  check('"Sit." sits the trainee down', v.actors.you.posture === 'seated', v.actors.you);

  R.scene(def('tour1-door'));
  v = R.view();
  check('a tour scene is out of the room: the stairwell, drawn as people', v.mode === 'away' && v.look === 'color' && v.place === 'stairwell', v);
  check('the trainee and Dee are with you out there', v.actors.you.shown && v.actors.dee.shown, v.actors);
  for (const [id, place] of [['tour2-trucks', 'dock'], ['tour3-test', 'roof'], ['leak-go', 'corridor'], ['sleeper-wake', 'vestibule']]) {
    R.scene(def(id));
    if (id === 'leak-go') for (let i = 0; i < story.scenes[id].lines.length; i++) R.line(i);
    check(`${id} is ${place}, out of the room`, R.view().place === place && R.view().look === 'color', R.view());
  }

  R.scene(def('visitor-desk'));
  for (let i = 0; i < 2; i++) R.line(i);
  v = R.view();
  check('visitor-desk: the lobby desk takes the trainee out of the room (with Terrell)', v.place === 'lobby' && v.actors.terrell?.shown, v);
  for (let i = 2; i < story.scenes['visitor-desk'].lines.length; i++) R.line(i);
  v = R.view();
  check('visitor-desk: back in the room, silhouettes again', v.place === 'room' && v.look === 'sil' && v.mode === 'room', v);

  R.scene(def('end-clean'));
  v = R.view();
  check('an ending is in the room by daylight: people, not silhouettes', v.place === 'room-day' && v.look === 'color' && v.mode === 'room', v);
}

/* the moments */
{
  const { R } = stage();
  let said = play(R, 'okafor-out');
  let v = R.view();
  check('someone leaves through the door (Mr. Okafor goes at handover)', said.some((a) => /leaves the room/.test(a)) && !v.actors.okafor.present, { said, v: v.actors.okafor });
  check('Dee knocks twice on the wall', said.some((a) => /knocks twice/.test(a)), said);

  said = play(R, 'radio-ok');
  check('someone enters through the door (Terrell leans in for coffee)', said.some((a) => /Terrell comes in through the door/.test(a)), said);

  said = play(R, 'okafor-call');
  check('the phone rings and is answered', said.some((a) => /phone rings/.test(a)) && said.some((a) => /answer the phone/.test(a)), said);

  said = play(R, 'log-in-asked');
  check('something is written in the log', said.some((a) => /write in the log/.test(a)), said);

  said = play(R, 'flicker');
  check('the lights flicker and coffee spills', said.some((a) => /lights flicker/.test(a)) && said.some((a) => /Coffee spills/.test(a)), said);

  said = play(R, 'w1-dead');
  check('the screen is touched (Dee taps the glass over tile two)', said.some((a) => /touches the screen/.test(a)), said);

  said = play(R, 'laptop-opened');
  v = R.view();
  check('Dee stands up and gets angry', said.some((a) => /stands up/.test(a)) && said.some((a) => /gets angry/.test(a)), said);

  said = play(R, 'trouble-signal-f');
  check('the fire panel buzzes', said.some((a) => /fire panel buzzes/.test(a)), said);

  said = play(R, 'radio-23');
  v = R.view();
  check('Dee leaves with the keys at eleven and is gone from the room', said.some((a) => /Dee stands up/.test(a)) && !v.actors.dee.present, { said, dee: v.actors.dee });

  said = play(R, 'day-log');
  v = R.view();
  check('Dee comes back in from the lobby and counts the radios', said.some((a) => /Dee comes in/.test(a)) && v.actors.dee.present, { said });

  // a resume: the lines already heard leave the room as they would have
  R.scene(def('radio-23'));
  R.catchUp(4);
  check('a resume after four lines settles Dee out of the room', !R.view().actors.dee.present, R.view().actors);
}


/* the photographed room: night-shift/media/stage/stage.json, its layers and what the data does with them */
{
  const stageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'night-shift/media/stage/stage.json'), 'utf8'));
  const dir = path.join(ROOT, 'night-shift/media/stage');
  const files = new Set([stageJson.plate, ...Object.values(stageJson.places), ...Object.values(stageJson.overlays), ...Object.values(stageJson.poses).flatMap((t) => Object.values(t))]);
  const missing = [...files].filter((f) => !fs.existsSync(path.join(dir, f)));
  check(`every layer stage.json names exists (${files.size} files)`, !missing.length, missing);
  const notWebp = [...files].filter((f) => !/\.webp$/.test(f) || fs.readFileSync(path.join(dir, f)).subarray(8, 12).toString() !== 'WEBP');
  check('every layer is a WebP', !notWebp.length, notWebp);
  const heavy = [...files].filter((f) => fs.statSync(path.join(dir, f)).size > 160 * 1024);
  check('no layer is over 160 KB (iOS Safari memory)', !heavy.length, heavy);
  const speakers = Object.keys(story.speakers || {});
  const unknown = Object.keys(stageJson.poses).filter((w) => !['you', ...speakers].includes(w));
  check('stage.json only poses people the story has', !unknown.length, unknown);

  const { R } = stage();
  R.useStage(stageJson);
  let threw = null;
  try {
    for (const [id, s] of Object.entries(story.scenes)) {
      R.scene(def(id));
      s.lines.forEach((l, i) => R.line(i));
      R.catchUp(s.lines.length);
      const ph = R.view().photo;
      if (ph.on !== !!ph.still || (R.view().place === 'room' && !ph.on)) throw new Error(`${id}: photo is ${ph.on} (${ph.still}) in ${R.view().place}`);
    }
  } catch (e) { threw = e.message; }
  check('every scene and line runs in the photographed room', !threw, threw);

  R.scene(def('the-chairs'));
  let v = R.view();
  check('the room opens as a photograph: the plate, Dee seated, the trainee standing', v.photo.on && v.photo.plate === 'plate.webp' && v.photo.layers.dee === 'dee-sit.webp' && v.photo.layers.you === 'trainee-stand-clock.webp', v.photo);
  play(R, 'the-chairs');
  check('"Sit." swaps the trainee to the seated layer', R.view().photo.layers.you === 'trainee-sit.webp', R.view().photo);
  play(R, 'okafor-call');
  check('answering the phone is the phone layer', R.view().photo.layers.you === 'you-phone.webp', R.view().photo);
  play(R, 'radio-ok');
  v = R.view();
  check('Terrell comes in: his layer and the lobby door open', v.photo.layers.terrell === 'terrell-left.webp' && v.photo.overlays.includes('door-left'), v.photo);
  play(R, 'flicker');
  check('the coffee spill is an overlay on the plate', R.view().photo.overlays.includes('spill'), R.view().photo);
  play(R, 'trouble-signal-f');
  check('the fire panel buzzing is an overlay on the plate', R.view().photo.overlays.includes('buzz'), R.view().photo);
  play(R, 'laptop-opened');
  check('Dee standing angry is her angry layer', R.view().photo.layers.dee === 'dee-angry.webp', R.view().photo);
  R.scene(def('tour1-door'));
  check('the stairwell is its own still, people in it', R.view().photo.on && R.view().photo.still === 'places/stairwell.webp', R.view().photo);
  R.scene(def('courier-signed'));
  R.line(0);
  check('the dock with the courier is its own still', R.view().photo.still === 'places/dock-courier.webp', R.view().photo);
  R.scene(def('leak-go'));
  for (let i = 0; i < story.scenes['leak-go'].lines.length; i++) R.line(i);
  check('the corridor upstairs has no still yet and stays the SVG place', !R.view().photo.on && R.view().place === 'corridor', R.view().photo);
  const endings = Object.entries(story.scenes).filter(([, s]) => s.ending).map(([id]) => id);
  const noStill = endings.filter((id) => { R.scene(def(id)); return R.view().photo.still !== `places/${id}.webp`; });
  check(`every ending (${endings.length}) is its own still by daylight`, endings.length === 12 && !noStill.length, noStill);
  const used = new Set();
  for (const s of Object.values(story.scenes)) { if (s.place) used.add(s.place); for (const l of s.lines) if (l.place) used.add(l.place); }
  check('the places the data uses are all stills except the corridor', [...used].filter((p) => !['room', 'room-day', 'corridor'].includes(p) && !Object.keys(stageJson.places).some((k) => k === p || k.startsWith(p + ':'))).length === 0, [...used]);
}

console.log(failed ? `\n${failed} failed` : '\nall ok');
process.exit(failed ? 1 : 0);
