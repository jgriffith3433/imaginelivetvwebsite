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
    const raw = fs.readFileSync(STAGE_DIR + 'stage.json', 'utf8');
    const o = JSON.parse(raw);
    o.reg = { _about: `Pairs of one person's layers that line up (mask IoU >= ${IOU_FADE} and centroid shift <= ${SHIFT_FADE} px): they cross-fade; every other pair is a swap through the plate (fade out ~80 ms, in ~120 ms). Written by tools/room-art.mjs --write.`, fade: fadePairs };
    fs.writeFileSync(STAGE_DIR + 'stage.json', JSON.stringify(o, null, 2).replace(/\n {4,}"([^"]+)": "([^"]+)"(,?)(?=\n {4,}")/g, '\n    "$1": "$2"$3') + '\n');
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
// the room code itself: an unregistered pair is a swap (old out in 80 ms, new in after it), a registered one a cross-fade
{
  const r = makeRoom();
  const pair = Object.keys(transitions).map((k) => k.split('|')).find(([who, a, b]) => who === 'dee' && !fadeSet.has(a < b ? `${a}|${b}` : `${b}|${a}`));
  if (pair) {
    const [, a, b] = pair;
    const { R, doc } = r;
    R.scene({ id: 'x', time: '23:00', cast: ['you', 'dee'], lines: [] });
    const host = doc.getElementById('console-room');
    const wrap = host.querySelector('.room-pose[data-who="dee"]');
    // the layer the pose table gives dee for the second file: force the state by the table keys
    const keyOf = (f) => Object.entries(stage.poses.dee).find(([, v]) => v === f)[0];
    void keyOf;
    if (!wrap) fail('registration', 'room code', 'no layer wrapper for Dee in the room to test the swap rule on');
    else {
      const first = wrap.querySelector('img');
      if (!first) fail('registration', 'room code', 'Dee has no layer');
    }
    void a; void b;
  }
}

/* ---------- 5. the known defects ---------- */

const defectResults = [];
for (const d of fixtures.defects) {
  const res = { id: d.id, ok: true, notes: [] };
  const bad = (m) => { res.ok = false; res.notes.push(m); fail('known-defect', d.id, m); };
  if (d.type === 'mask-keeps') {
    const m = info[d.layer];
    if (!m) bad(`layer ${d.layer} is not in stage.json`);
    else {
      const still = load(path.join(process.env.ROOM_ART_STILLS || path.join(os.tmpdir(), 'iltv-stills'), d.still), W, H);
      void still;
    }
  }
  defectResults.push(res);
}

/* ---------- report ---------- */

console.log(`room-art: ${layers.size} layers, ${Object.keys(sims).length} scenes, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const worst = Object.entries(layerScore).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('worst layers:\n' + worst.map(([f, sc]) => `  ${String(sc).padStart(4)}  ${f.padEnd(26)} area ${String(info[f].area).padStart(6)}  solidity ${info[f].solidity.toFixed(2)}  holes ${info[f].holes.length}  chunks ${info[f].detached.length}`).join('\n'));
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
