#!/usr/bin/env node
// Night Shift's photographed room: automatic quality checks, so J never has to look at every moment (story doc "The control room").
// Offline: node + ffmpeg + jsdom, no browser, no API. `npm run test:room-art` must be green before a change to the room, its layers
// or its acts is finished.
//
//   node tools/room-art.mjs                 the checks (below); prints a table of failures; exit 1 when one fails
//   node tools/room-art.mjs --write         also writes stage.json's `reg` (which pairs of one person's layers cross-fade) and
//                                           night-shift/qa/frames.json (every unique frame the story can show, with its score)
//   node tools/room-art.mjs --sheets [dir]  also composes every unique frame to PNG and writes contact sheets (12 frames each,
//                                           captioned, worst first) to dir (default $TMPDIR/room-art): LOOK at them (Read the PNGs)
//
// 1. Mask sanity, every silhouette layer: one dominant blob, no detached chunks, no holes, alpha off the frame edges, area in range,
//    convex-hull solidity (a missing back or arm is a notch), the body on the pose's stage mark (night-shift/stage-marks.json).
// 2. Presence over the story: the scenes are played through the real room code (tools/lib/room-sim.mjs) on a virtual clock. Nobody
//    shows after `gone` until they enter (or a scene's cast has them), nobody speaks in the room while absent unless it is a radio,
//    phone or intercom line, every act has a layer, every beat's `at` is in [0,1] and ordered, a person in the room has a pose.
// 3. Registration: for two layers of one person that are shown one after the other, IoU and centroid shift of their masks decide a
//    cross-fade (they line up) or a swap through the plate (they don't); stage.reg must say so, and never two layers of one person at once.
// 4. The composite renderer (--sheets): plate + overlays + the big screen + people (people above the screen, as the page does) + door.
// 5. tests/room-art-known-defects.json: every defect J reported, as a permanent case.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { load, save, blank, over } from './lib/img.mjs';
import * as M from './lib/mask.mjs';
import { ROOT, loadStory, loadStage, makeRoom, playScene, actsOf } from './lib/room-sim.mjs';

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const SHEETS = argv.includes('--sheets');
const sheetDir = SHEETS && argv[argv.indexOf('--sheets') + 1] && !argv[argv.indexOf('--sheets') + 1].startsWith('--') ? argv[argv.indexOf('--sheets') + 1] : path.join(os.tmpdir(), 'room-art');
const STAGE_DIR = path.join(ROOT, 'night-shift/media/stage/');
const W = 1536, H = 920;

const story = loadStory();
const stage = loadStage();
const marks = JSON.parse(fs.readFileSync(path.join(ROOT, 'night-shift/stage-marks.json'), 'utf8')).marks;
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/room-art-known-defects.json'), 'utf8'));

const failures = []; // { check, where, detail }
const warnings = [];
const fail = (check, where, detail) => failures.push({ check, where, detail });
const warn = (check, where, detail) => warnings.push({ check, where, detail });
const t0 = Date.now();

/* ---------- 1. mask sanity ---------- */

// every layer of every person, with the person and the posture its key says
const layers = new Map(); // file -> { who, keys }
for (const [who, table] of Object.entries(stage.poses)) for (const [key, file] of Object.entries(table)) {
  const e = layers.get(file) || { who, keys: [] };
  e.keys.push(key);
  layers.set(file, e);
}
const seated = (e) => e.keys.every((k) => k.startsWith('seated'));

// where the body should be: [x0, x1] of its bounding box centre, from the stage marks
function markFor(file, e) {
  if (seated(e)) return e.who === 'dee' ? marks['chair-dee'].seat[0] : marks['chair-good'].seat[0];
  if (/door-l|at-door/.test(file)) return marks['door-lobby'].foot[0] + 250; // by the lobby door, left of the room (the trainee's back to it)
  if (/door-r/.test(file)) return marks['door-corridor'].foot[0];
  return null;
}

const info = {}; // file -> metrics
for (const [file, e] of layers) {
  const img = load(STAGE_DIR + file, W, H);
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = img.data[i * 4 + 3] > 127 ? 1 : 0;
  const area = M.area(mask);
  const comps = M.components(mask, W, H);
  const order = comps.sizes.map((s, k) => [s, k]).slice(1).sort((a, b) => b[0] - a[0]);
  const mainSize = order[0] ? order[0][0] : 0;
  const detached = order.slice(1).filter(([s]) => s >= 120);
  const { holes } = M.fillHoles(mask, W, H);
  const bigHoles = holes.filter((h) => h >= 120);
  const box = M.bbox(mask, W, H);
  const hull = M.hullArea(mask, W, H);
  let edge = 0;
  // the frame's edges: a person never touches the sides or the top; a chair's base may run off the bottom (seated layers)
  // (standing feet may be cut a little by the bottom of the frame)
  let foot = 0;
  for (let x = 0; x < W; x++) { edge += mask[x]; foot += mask[(H - 1) * W + x]; }
  if (!seated(e) && foot > 150) edge += foot;
  for (let y = 0; y < H; y++) edge += mask[y * W] + mask[y * W + W - 1];
  const cx = box ? (box[0] + box[2]) / 2 : 0;
  let cxs = 0, cys = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { cxs += x; cys += y; }
  info[file] = { who: e.who, seated: seated(e), mask, area, blobs: order.length, mainShare: area ? mainSize / area : 0, detached: detached.map(([s]) => s), holes: bigHoles, holeArea: bigHoles.reduce((a, b) => a + b, 0), box, solidity: hull ? area / hull : 0, edge, cx, centroid: area ? [cxs / area, cys / area] : [0, 0], mark: markFor(file, e) };
}

const LIMITS = { area: { standing: [40000, 135000], seated: [45000, 140000] }, solidity: 0.50, mainShare: 0.97, holes: 0, edge: 0, markDx: 260 };
const layerScore = {}; // file -> 0..100+, higher is worse
for (const [file, m] of Object.entries(info)) {
  const probs = [];
  if (!m.area) probs.push('empty layer');
  if (m.mainShare < LIMITS.mainShare || m.detached.length) probs.push(`detached chunks ${m.detached.join('+')} px (${(m.mainShare * 100).toFixed(1)}% in the main blob)`);
  if (m.holes.length) probs.push(`${m.holes.length} holes (${m.holeArea} px)`);
  if (m.edge > LIMITS.edge) probs.push(`${m.edge} edge px on the frame border`);
  const [a0, a1] = LIMITS.area[m.seated ? 'seated' : 'standing'];
  if (m.area && (m.area < a0 || m.area > a1)) probs.push(`area ${m.area} outside ${a0}-${a1}`);
  if (m.solidity < LIMITS.solidity) probs.push(`solidity ${m.solidity.toFixed(2)} < ${LIMITS.solidity} (a notch: a missing back, arm or tablet)`);
  if (m.mark != null && Math.abs(m.cx - m.mark) > LIMITS.markDx) probs.push(`body at x ${Math.round(m.cx)}, its mark is x ${m.mark} (±${LIMITS.markDx})`);
  m.problems = probs;
  layerScore[file] = Math.round(probs.length * 30 + Math.max(0, (0.8 - m.solidity)) * 100 + m.holeArea / 100 + m.detached.reduce((a, b) => a + b, 0) / 200);
  for (const p of probs) fail('mask', file, p);
}

/* ---------- 3a. registration: which pairs of one person's layers line up ---------- */

const IOU_FADE = 0.85, SHIFT_FADE = 20;
const regs = {}; // 'a|b' -> { iou, shift, fade }
for (const who of Object.keys(stage.poses)) {
  const files = [...new Set(Object.values(stage.poses[who]))].sort();
  for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) {
    const a = info[files[i]], b = info[files[j]];
    let inter = 0, uni = 0;
    for (let k = 0; k < a.mask.length; k++) { const x = a.mask[k], y = b.mask[k]; inter += x & y; uni += x | y; }
    const iou = uni ? inter / uni : 0;
    const shift = Math.hypot(a.centroid[0] - b.centroid[0], a.centroid[1] - b.centroid[1]);
    regs[`${files[i]}|${files[j]}`] = { iou: +iou.toFixed(3), shift: +shift.toFixed(1), fade: iou >= IOU_FADE && shift <= SHIFT_FADE };
  }
}
const fadePairs = Object.entries(regs).filter(([, r]) => r.fade).map(([k]) => k).sort();
const stageFade = (stage.reg && stage.reg.fade) || [];
if (JSON.stringify(stageFade) !== JSON.stringify(fadePairs)) {
  if (WRITE) {
    let raw = fs.readFileSync(STAGE_DIR + 'stage.json', 'utf8');
    const block = `  "reg": {\n    "_about": "Pairs of one person's layers that line up (mask IoU >= ${IOU_FADE} and centroid shift <= ${SHIFT_FADE} px): they cross-fade; every other pair is a swap through the plate (old out in ~80 ms, new in over ~120 ms). Written by tools/room-art.mjs --write.",\n    "fade": ${JSON.stringify(fadePairs)}\n  }`;
    raw = /\n  "reg": \{[\s\S]*?\n  \}/.test(raw) ? raw.replace(/\n  "reg": \{[\s\S]*?\n  \}/, '\n' + block) : raw.replace(/\n\}\s*$/, ',\n' + block + '\n}\n');
    fs.writeFileSync(STAGE_DIR + 'stage.json', raw);
    console.log(`wrote stage.json reg.fade (${fadePairs.length} pairs)`);
  } else fail('registration', 'stage.json reg', `stale: stage.reg.fade has ${stageFade.length} pairs, the layers say ${fadePairs.length} (node tools/room-art.mjs --write)`);
}

/* ---------- 2. presence over the story ---------- */

const people = new Set(Object.keys(stage.poses));
// a line spoken over a radio, walkie, intercom or phone (its `treatment`) or from outside the room (its performance says so) has no body in the room
const radioish = (l) => ['radio', 'walkie', 'intercom', 'phone'].includes(l.treatment || (story.speakers[l.speaker] || {}).treatment) || /over the (radio|phone|intercom)|on the (walkie|phone|radio)|through the (door|intercom)/i.test(l.perform || '');
const sims = {}; // scene id -> states
const room = makeRoom();
const transitions = {}; // 'who|from|to' -> count
let propLines = 0;
const accepted = new Set((fixtures.acceptedStoryConflicts || []).map((c) => `${c.scene}#${c.line}`));
const used = new Set();
for (const [id, s] of Object.entries(story.scenes)) {
  let states;
  try { states = playScene(story, id, room); } catch (e) { fail('presence', id, `the scene threw in the room: ${e.message}`); continue; }
  sims[id] = states;
  // beats are in [0,1] and ordered
  s.lines.forEach((l, i) => {
    let last = 0;
    for (const b of actsOf(l)) {
      if (!(b.at >= 0 && b.at <= 1)) fail('beats', `${id}#${i}`, `at ${b.at} is outside 0..1`);
      if (b.at < last) fail('beats', `${id}#${i}`, `beat ${b.act} at ${b.at} is before the one before it (${last})`);
      last = Math.max(last, b.at);
    }
  });
  const gone = {}; // who -> true after a gone/leave, until an enter
  s.lines.forEach((l, i) => {
    const list = actsOf(l);
    for (const b of list) {
      const [who, verb] = b.act.split(':');
      if (who === 'room') continue;
      if (verb === 'leave' || verb === 'gone') gone[who] = true;
      else if (verb === 'enter') gone[who] = false;
      else if (gone[who]) fail('presence', `${id}#${i}`, `${b.act} after ${who} left, with no enter`);
      if (verb === 'leave' && !list.some((x) => x.act === `${who}:gone`) && s.place !== 'room-day') warn('presence', `${id}#${i}`, `${who}:leave has no ${who}:gone beat (the room takes them out 1.4 s after the walk)`);
    }
    // a speaker in the room is shown, unless the line is a radio, phone or intercom line (then no body)
    const prevLine = s.lines[i - 1];
    // the next line of someone already on the radio or phone is still the call
    const onCall = radioish(l) || (prevLine && prevLine.speaker === l.speaker && radioish(prevLine) && !/from the door|in the room/i.test(l.perform || ''));
    const startState = states.find((st) => st.line === i && st.kind === 'line');
    const who = l.speaker;
    if (people.has(who) && startState && startState.place === 'room') {
      const a = startState.actors[who];
      const shown = !!(a && a.shown);
      if (!shown && !onCall && !l.offstage) {
        const key = `${id}#${i}`;
        if (accepted.has(key)) used.add(key); else fail('presence', key, `${who} speaks in the room while absent (not a radio, phone or intercom line)`);
      } else if (shown && (radioish(l) || l.offstage)) warn('presence', `${id}#${i}`, `${who} is shown in the room on a ${(l.treatment || story.speakers[who].treatment)} line`);
      else if (!shown) propLines++;
    }
  });
  // everyone shown in the room has a layer; consecutive layers of one person are a fade or a swap, never both visible
  let prev = null;
  for (const st of states) {
    if (st.place === 'room' && st.on) {
      for (const [who, a] of Object.entries(st.actors)) if (a.shown && people.has(who) && !st.layers[who]) fail('pose', `${id}#${st.line} ${st.kind}`, `${who} is in the room (${st.said || 'standing'}) with no layer`);
      for (const [who, a] of Object.entries(st.actors)) if (!a.shown && st.layers[who]) fail('presence', `${id}#${st.line} ${st.kind}`, `${who} is out of the room but their layer ${st.layers[who]} is still drawn`);
      if (prev && prev.place === 'room') for (const [who, f] of Object.entries(st.layers)) {
        const g = prev.layers[who];
        if (g && g !== f) { const k = `${who}|${g}|${f}`; transitions[k] = (transitions[k] || 0) + 1; }
      }
    }
    prev = st;
  }
}
for (const key of accepted) if (!used.has(key)) fail('fixtures', key, 'acceptedStoryConflicts names a line that no longer conflicts: remove it');

// every act (person, verb) has a layer: its own, or the generic one for the posture
const verbsUsed = {};
for (const s of Object.values(story.scenes)) for (const l of s.lines) for (const b of actsOf(l)) { const [who, verb] = b.act.split(':'); if (who !== 'room') (verbsUsed[who] ||= {})[verb] = (verbsUsed[who][verb] || 0) + 1; }
const ownPose = {}, fallbackActs = [];
for (const [who, vs] of Object.entries(verbsUsed)) {
  const table = stage.poses[who];
  if (!table) { if (!['brandt', 'courier', 'sleeper'].includes(who)) fail('pose', who, 'acts in the story but stage.json has no poses for them'); continue; }
  for (const [verb, n] of Object.entries(vs)) {
    if (['enter', 'leave', 'gone', 'rest', 'sit', 'stand', 'hangup'].includes(verb)) continue;
    const own = Object.keys(table).some((k) => k.split('.').includes(verb) || (verb === 'phone' && k.includes('phone')));
    if (!own) fallbackActs.push(`${who}:${verb} (${n})`);
  }
}
for (const [verb, n] of Object.entries(verbsUsed.you || {})) void verb, n;
// layers that exist on disk
for (const f of layers.keys()) if (!fs.existsSync(STAGE_DIR + f)) fail('pose', f, 'named in stage.json but missing');

/* ---------- 3b. the transitions the story makes, and the rule that picks cross-fade or swap ---------- */

const fadeSet = new Set(fadePairs);
let nFade = 0, nSwap = 0;
const swapList = [];
for (const [k, n] of Object.entries(transitions)) {
  const [, a, b] = k.split('|');
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  if (fadeSet.has(key)) nFade += n; else { nSwap += n; swapList.push([n, k, regs[key]]); }
  const r = regs[key];
  if (fadeSet.has(key) && r && (r.iou < IOU_FADE || r.shift > SHIFT_FADE)) fail('registration', k, `cross-fades but IoU ${r.iou} / shift ${r.shift}`);
}
/* ---------- 5. the known defects ---------- */

const defectResults = [];
const covered = (mask, [x0, y0, x1, y1]) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) n += mask[y * W + x]; return n / ((x1 - x0 + 1) * (y1 - y0 + 1)); };
const grayMask = (file) => { const im = load(file, W, H); const m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) m[i] = im.data[i * 4] > 127 ? 1 : 0; return m; };
for (const d of fixtures.defects) {
  const res = { id: d.id, ok: true };
  const bad = (m) => { res.ok = false; fail('known-defect', d.id, m); };
  if (d.type === 'maskCovers') {
    for (const c of d.cases) {
      const m = info[c.layer];
      if (!m) { bad(`layer ${c.layer} is not in stage.json`); continue; }
      const got = covered(m.mask, c.region);
      if (got < c.min) bad(`${c.layer}: ${c.what} is ${(got * 100).toFixed(0)}% inside the silhouette (needs ${(c.min * 100).toFixed(0)}%; SAM alone gave ${(c.samOnly * 100).toFixed(0)}%)`);
    }
  } else if (d.type === 'chairWhole') {
    for (const [who, chairFile] of Object.entries(d.chairs)) {
      const chair = grayMask(path.join(ROOT, 'night-shift/stage-src', chairFile + '.png'));
      for (const [file, m] of Object.entries(info)) {
        if (m.who !== who || !m.seated) continue;
        let n = 0, k = 0;
        for (let i = 0; i < chair.length; i++) if (chair[i]) { n++; k += m.mask[i]; }
        if (k / n < d.min) bad(`${file}: only ${(k / n * 100).toFixed(0)}% of the chair they sit in is in the silhouette (needs ${(d.min * 100).toFixed(0)}%)`);
      }
    }
  } else if (d.type === 'zOrder') {
    const r = makeRoom();
    const sc = story.scenes[d.scene];
    r.R.scene({ id: d.scene, time: sc.time, place: sc.place, cast: sc.cast, away: sc.away, lines: sc.lines });
    r.advance(10);
    const host = r.doc.getElementById('console-room');
    const kids = [...host.children];
    const idx = (sel) => kids.findIndex((k) => k.matches(sel));
    const [plate, big, people] = [idx('.room-photo:not(.room-people)'), idx('#console-big'), idx('.room-people')];
    if (!(plate >= 0 && big > plate && people > big)) bad(`the room's layers are plate ${plate}, big screen ${big}, people ${people}: people must come after the big screen, which comes after the plate`);
  } else if (d.type === 'goneAfter') {
    const states = sims[d.scene];
    const at = states.findIndex((st) => st.line === d.line && st.kind === 'beat' && st.acts.includes(d.act));
    const plain = states.findIndex((st) => st.line === d.line && st.kind === 'line' && st.acts.includes(d.act));
    const from = at >= 0 ? at : plain;
    if (from < 0) bad(`${d.scene}: no ${d.act} at line ${d.line}`);
    else for (const st of states.slice(from)) {
      if (st.layers[d.who] || (st.actors[d.who] && st.actors[d.who].shown)) { bad(`${d.scene}: ${d.who} is still drawn at line ${st.line} (${st.kind}) after ${d.act}`); break; }
      if (st.door) { bad(`${d.scene}: the door is still open at line ${st.line} (${st.kind}) after ${d.who} is gone`); break; }
    }
  } else if (d.type === 'noDoubleImage') {
    const r = makeRoom();
    const sc = story.scenes[d.scene];
    r.R.scene({ id: d.scene, time: sc.time, place: sc.place, cast: sc.cast, away: sc.away, lines: sc.lines });
    for (let i = 0; i < d.line; i++) { r.R.line(i); r.advance(((+sc.lines[i].dur || 3) * 1000) + 350); }
    const wrap = r.doc.querySelector(`.room-pose[data-who="${d.who}"]`);
    const before = wrap.querySelector('img.on');
    r.R.line(d.line);
    const imgs = [...wrap.querySelectorAll('img')];
    const next = imgs.find((im) => im !== before);
    if (!before || !next) bad(`${d.scene} line ${d.line}: ${d.who} does not change layer (nothing to check)`);
    else {
      const a = before.getAttribute('data-f'), b = next.getAttribute('data-f');
      const reg = regs[a < b ? `${a}|${b}` : `${b}|${a}`];
      if (reg && reg.fade) { if (reg.iou < IOU_FADE) bad(`${a} -> ${b} cross-fade but IoU ${reg.iou}`); }
      else if (!(before.style.transitionDuration === '80ms' && next.style.transitionDelay === '80ms')) bad(`${a} -> ${b} do not register (IoU ${reg && reg.iou}, shift ${reg && reg.shift} px) but they are not swapped: old out in ${before.style.transitionDuration || 'default'}, new in after ${next.style.transitionDelay || '0'}`);
      r.advance(400);
      if (wrap.querySelectorAll('img').length !== 1) bad(`${d.who} still has ${wrap.querySelectorAll('img').length} layers in the DOM 400 ms after the change`);
    }
  } else bad(`unknown defect type ${d.type}`);
  defectResults.push(res);
}

/* ---------- 4. every unique frame the story can show ---------- */

const OVERLAY_OF = { 'door-left': 'door-left', 'door-right': 'door-right' };
const frames = new Map(); // key -> frame
let statesSeen = 0;
for (const [id, states] of Object.entries(sims)) {
  let spilled = false;
  for (const st of states) {
    statesSeen++;
    if (!st.on) continue;
    const acts = st.acts || [];
    if (acts.includes('room:spill') || acts.some((a) => /:spill$/.test(a))) spilled = true;
    let key, f;
    if (st.place === 'room') {
      const ov = [];
      if (st.door) ov.push('door-' + st.door);
      if (acts.some((a) => /:(write|read)$/.test(a))) ov.push('writing');
      if (spilled) ov.push('spill');
      if (acts.includes('room:buzz')) ov.push('buzz');
      const lay = Object.entries(st.layers).sort(([a], [b]) => a.localeCompare(b));
      key = JSON.stringify(['room', lay, ov]);
      f = { kind: 'room', layers: Object.fromEntries(lay), overlays: ov };
    } else {
      key = JSON.stringify(['still', st.still]);
      f = { kind: 'still', still: st.still };
    }
    if (!frames.has(key)) { f.key = key; f.uses = []; frames.set(key, f); }
    const fr = frames.get(key);
    if (fr.uses.length < 6) fr.uses.push(`${id}#${st.line}${st.kind === 'beat' ? '@' + st.at : ''}`);
    fr.count = (fr.count || 0) + 1;
  }
}
// a frame's score (higher is worse): its worst layer, and two people's silhouettes running into each other
let frameNo = 0;
for (const f of frames.values()) {
  f.id = 'f' + String(++frameNo).padStart(3, '0');
  if (f.kind === 'still') { f.score = 0; f.issues = []; continue; }
  const files = Object.values(f.layers);
  f.score = Math.max(0, ...files.map((x) => layerScore[x] || 0));
  f.issues = [];
  for (const x of files) for (const p of info[x].problems) f.issues.push(`${x}: ${p}`);
  const whos = Object.keys(f.layers);
  for (let i = 0; i < whos.length; i++) for (let j = i + 1; j < whos.length; j++) {
    const a = info[f.layers[whos[i]]], b = info[f.layers[whos[j]]];
    let inter = 0;
    for (let k = 0; k < a.mask.length; k++) inter += a.mask[k] & b.mask[k];
    const share = inter / Math.min(a.area, b.area);
    if (share > 0.12) { f.score += Math.round(share * 100); f.issues.push(`${whos[i]} and ${whos[j]} overlap (${(share * 100).toFixed(0)}% of the smaller)`); }
  }
}
const ranked = [...frames.values()].sort((a, b) => b.score - a.score);

if (WRITE) {
  const out = { _about: 'Every unique frame Night Shift\'s photographed room can show (tools/room-art.mjs --write): its layers, overlays, score (higher is worse; 0 passes every mask check) and where the story uses it. night-shift/storyboard.html sorts by it.', states: statesSeen, unique: frames.size, frames: ranked.map((f) => ({ id: f.id, score: f.score, kind: f.kind, ...(f.kind === 'room' ? { layers: f.layers, overlays: f.overlays } : { still: f.still }), uses: f.uses, count: f.count, issues: f.issues })), layerScore };
  fs.mkdirSync(path.join(ROOT, 'night-shift/qa'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'night-shift/qa/frames.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote night-shift/qa/frames.json (${frames.size} unique frames from ${statesSeen} states)`);
}

if (SHEETS) {
  // composite: plate, overlays, the big screen, then the people above it (the page's own order), captioned, 12 to a sheet, worst first
  const CW = 384, CH = 230, CAP = 40, COLS = 4, PER = 12;
  const cache = new Map();
  const get = (file) => { if (!cache.has(file)) cache.set(file, load(STAGE_DIR + file, CW, CH)); return cache.get(file); };
  const bs = stage.bigScreen;
  const compose = (f) => {
    const img = blank(CW, CH);
    if (f.kind === 'still') { over(img, get(f.still)); return img; }
    over(img, get(stage.plate));
    for (const o of f.overlays) if (stage.overlays[o]) over(img, get(stage.overlays[o]));
    const sx = CW / stage.width, sy = CH / stage.height;
    for (let y = Math.round(bs.y * sy); y < Math.round((bs.y + bs.h) * sy); y++) for (let x = Math.round(bs.x * sx); x < Math.round((bs.x + bs.w) * sx); x++) { const i = (y * CW + x) * 4; img.data[i] = 34; img.data[i + 1] = 62; img.data[i + 2] = 74; }
    for (const [, file] of Object.entries(f.layers)) over(img, get(file));
    return img;
  };
  fs.mkdirSync(sheetDir, { recursive: true });
  const font = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'].find((p) => fs.existsSync(p));
  for (let n = 0; n * PER < ranked.length; n++) {
    const part = ranked.slice(n * PER, n * PER + PER);
    const rows = Math.ceil(part.length / COLS);
    const sheet = blank(CW * COLS, (CH + CAP) * rows, [16, 20, 22, 255]);
    const filters = [];
    part.forEach((f, k) => {
      const cell = compose(f);
      const ox = (k % COLS) * CW, oy = Math.floor(k / COLS) * (CH + CAP);
      for (let y = 0; y < CH; y++) sheet.data.set(cell.data.subarray(y * CW * 4, (y + 1) * CW * 4), ((oy + y) * sheet.w + ox) * 4);
      const cap = `${f.id} score ${f.score} | ${f.uses[0]}${f.count > 1 ? ` (+${f.count - 1})` : ''}\n${f.kind === 'room' ? Object.entries(f.layers).map(([w, x]) => `${w}:${x.replace('.webp', '')}`).join(' ') + (f.overlays.length ? ' +' + f.overlays.join(',') : '') : f.still}`;
      const tf = path.join(sheetDir, `cap-${n}-${k}.txt`);
      fs.writeFileSync(tf, cap);
      filters.push(`drawtext=fontfile=${font}:textfile=${tf}:x=${ox + 4}:y=${oy + CH + 4}:fontsize=11:fontcolor=${f.score > 40 ? 'f2b36b' : 'd9d3c0'}:line_spacing=3`);
    });
    const raw = path.join(sheetDir, `raw-${n}.png`);
    save(sheet, raw);
    const out = path.join(sheetDir, `sheet-${String(n + 1).padStart(2, '0')}.png`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', filters.join(','), out]);
    fs.unlinkSync(raw);
  }
  console.log(`contact sheets: ${Math.ceil(ranked.length / PER)} sheets of ${PER} in ${sheetDir} (sheet-01.png is the worst)`);
}

/* ---------- report ---------- */

console.log(`room-art: ${layers.size} layers, ${Object.keys(sims).length} scenes, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const worst = Object.entries(layerScore).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('worst layers:\n' + worst.map(([f, sc]) => `  ${String(sc).padStart(4)}  ${f.padEnd(26)} area ${String(info[f].area).padStart(6)}  solidity ${info[f].solidity.toFixed(2)}  holes ${info[f].holes.length}  chunks ${info[f].detached.length}`).join('\n'));
console.log(`frames: ${frames.size} unique of ${statesSeen} states; worst ${ranked.slice(0, 3).map((f) => f.id + ' ' + f.score).join(', ')}`);
console.log(`transitions: ${nFade} cross-fades, ${nSwap} swaps; acts with only the generic pose: ${fallbackActs.length ? fallbackActs.join(', ') : 'none'}; radio/phone lines with an absent speaker: ${propLines}`);
if (warnings.length) console.log(`warnings (${warnings.length}):\n` + warnings.slice(0, 15).map((w) => `  ${w.check} ${w.where}: ${w.detail}`).join('\n'));
if (failures.length) {
  console.log(`FAILURES (${failures.length}):`);
  const by = {};
  for (const f of failures) (by[f.check] ||= []).push(f);
  for (const [c, list] of Object.entries(by)) { console.log(` ${c} (${list.length})`); for (const f of list.slice(0, 40)) console.log(`   ${f.where}: ${f.detail}`); }
  process.exit(1);
}
console.log('room-art: all checks pass');
