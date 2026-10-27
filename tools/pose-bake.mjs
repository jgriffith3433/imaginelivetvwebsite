#!/usr/bin/env node
// Bakes the photographed room's pose layers (night-shift/media/stage/<name>.webp): the person as a flat black silhouette, a full-plate
// (1536x920) WebP with alpha.
//
//   node tools/pose-bake.mjs --auto [name ...] [--stills <dir>]   rebuild layers from their sources (below); no name = every pose
//   node tools/pose-bake.mjs --sam <name> <cutout.png>             store a new image.segment cut-out as the SAM source of <name>
//   node tools/pose-bake.mjs <name> <cutout.png> [more.png ...]    (legacy) bake straight from cut-outs
//
// The mask of a pose is built from three things, because SAM alone drops what a person holds and half of what they sit in
// (J, 2026-10-26: Mr. Okafor's tablet and bag, the back of the seated person's chair):
//   1. SAM: the image.segment cut-out, kept as night-shift/stage-src/sam/<name>.png (alpha only);
//   2. the DIFFERENCE between the generated still and the empty plate (what the edit added to the room), thresholded, kept near the
//      person only (SAM dilated by NEAR px) and cleaned: shadows on the wall are not people;
//   3. for a seated pose, the chair they sit in (night-shift/stage-src/chair-<who>.png, image.segment of the plate), so the back of
//      the chair is whole and the plate's own chair never shows through a hole in the silhouette.
// Then the mask is closed, its holes filled and specks dropped. `--stills` is a folder of the generated stills at 1536x920,
// <asset id>.png (fetch them with Hawkes Gen image.transform, a free resize, save_to; the recipes name the asset of each pose).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, save, alphaMask } from './lib/img.mjs';
import * as M from './lib/mask.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const STAGE = path.join(ROOT, 'night-shift/media/stage/');
const SRC = path.join(ROOT, 'night-shift/stage-src/');
const W = 1536, H = 920;
const REACH_BELOW = 680; // below this row (the floor) only a difference right at SAM's edge counts
const IGNORE = [[455, 435, 765, 565], [770, 435, 1065, 565], [730, 530, 805, 590], [315, 295, 415, 435]]; // plate pixels: the desk monitors, the tablet, the fire panel
const NEAR = 8, REACH = 80, DIFF = 36; // px: any difference this close to SAM counts; a difference that is not a shadow counts this far (a bag, a tablet held out)

function writeLayer(mask, out) {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < mask.length; i++) data[i * 4 + 3] = mask[i] ? 255 : 0;
  const tmp = path.join(mkdtempSync(path.join(tmpdir(), 'bake-')), 'layer.png');
  save({ w: W, h: H, data }, tmp);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-c:v', 'libwebp', '-lossless', '0', '-quality', '82', '-pix_fmt', 'yuva420p', out]);
}
const grayPng = (mask, file) => {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < mask.length; i++) { const v = mask[i] ? 255 : 0; data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  save({ w: W, h: H, data }, file);
};
const readGray = (file) => { const im = load(file, W, H); const m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) m[i] = im.data[i * 4] > 127 ? 1 : 0; return m; };

/** The mask for a pose: SAM + the difference against the plate near it + the chair, cleaned. Returns { mask, notes }. */
export function buildMask({ sam, still, plate, chair, seat }) {
  const d = new Uint8Array(W * H), shadow = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = [0, 1, 2].map((k) => still.data[i * 4 + k]), [pr, pg, pb] = [0, 1, 2].map((k) => plate.data[i * 4 + k]);
    d[i] = Math.max(Math.abs(r - pr), Math.abs(g - pg), Math.abs(b - pb)) > DIFF ? 1 : 0;
    // a shadow the person throws is the plate made darker with the same colour: not part of them, nor of what they hold
    const ratio = (0.3 * r + 0.59 * g + 0.11 * b + 1) / (0.3 * pr + 0.59 * pg + 0.11 * pb + 1);
    shadow[i] = ratio < 0.95 && Math.abs((r - g) - (pr - pg)) + Math.abs((g - b) - (pg - pb)) < 14 ? 1 : 0;
  }
  // the edit re-renders the screens and the floor a little: a difference there is not a held object
  const notShadow = d.map((v, i) => {
    const x = i % W, y = (i / W) | 0;
    return v && !shadow[i] && y < REACH_BELOW && !IGNORE.some(([a, b, c, e]) => x >= a && x <= c && y >= b && y <= e) ? 1 : 0;
  });
  const opened = (m) => M.dilate(M.dilate(m, W, H, 2, true), W, H, 2); // drops specks and thin edges
  const diff = M.union(M.inter(opened(notShadow), M.dilate(sam, W, H, REACH)), M.inter(opened(d), M.dilate(sam, W, H, NEAR)));
  let u = M.union(sam, diff);
  if (chair) u = M.union(u, chair);
  u = M.close(u, W, H, 6);
  u = M.fillHoles(u, W, H).mask;
  // keep the main blob, any blob at least 15% of it within 120 px (a person cut in two by their chair; the empty chair across the room is not theirs) and small ones within 12 px of it (a held object)
  const c = M.components(u, W, H);
  let main = 1;
  for (let k = 1; k <= c.n; k++) if (c.sizes[k] > c.sizes[main]) main = k;
  if (seat) { // a seated person is the blob at their own seat (SAM sometimes takes the empty chair across the room too)
    const hit = {};
    for (let y = Math.max(0, seat[1] - 200); y < Math.min(H, seat[1] + 200); y++) for (let x = Math.max(0, seat[0] - 160); x < Math.min(W, seat[0] + 160); x++) { const l = c.label[y * W + x]; if (l) hit[l] = (hit[l] || 0) + 1; }
    const best = Object.keys(hit).sort((a, b) => hit[b] - hit[a])[0];
    if (best) main = +best;
  }
  const mainMask = Uint8Array.from(c.label, (v) => (v === main ? 1 : 0));
  const grown = M.dilate(mainMask, W, H, 12), wide = M.dilate(mainMask, W, H, 120);
  const out = new Uint8Array(W * H);
  const big = c.sizes[main] * 0.15;
  for (let i = 0; i < out.length; i++) if (c.label[i] && (c.label[i] === main || (wide[i] && c.sizes[c.label[i]] >= big) || (grown[i] && c.sizes[c.label[i]] >= 150))) out[i] = 1;
  return { mask: out, notes: { sam: M.area(sam), added: M.area(out) - M.area(M.inter(out, sam)), chair: chair ? M.area(chair) : 0, final: M.area(out) } };
}

const argv = process.argv.slice(2);
if (import.meta.url === 'file://' + process.argv[1]) {
  if (argv[0] === '--auto') {
    const si = argv.indexOf('--stills');
    const stills = si >= 0 ? argv[si + 1] : path.join(tmpdir(), 'iltv-stills');
    const names = argv.slice(1).filter((a, i) => a !== '--stills' && argv[i] !== '--stills').map((n) => n.replace(/\.webp$/, ''));
    const recipes = JSON.parse(fs.readFileSync(path.join(ROOT, 'night-shift/stage-recipes.json'), 'utf8')).poses;
    const stage = JSON.parse(fs.readFileSync(STAGE + 'stage.json', 'utf8'));
    const seatedOf = {};
    for (const [who, table] of Object.entries(stage.poses)) for (const [k, f] of Object.entries(table)) if (k.startsWith('seated')) seatedOf[f.replace(/\.webp$/, '')] = who;
    const plate = load(STAGE + 'plate.webp', W, H);
    const marks = JSON.parse(fs.readFileSync(path.join(ROOT, 'night-shift/stage-marks.json'), 'utf8')).marks;
    const all = Object.keys(recipes).map((n) => n.replace(/\.webp$/, ''));
    for (const name of names.length ? names : all) {
      const r = recipes[name + '.webp'];
      const samFile = SRC + 'sam/' + name + '.png';
      if (!r || !fs.existsSync(samFile)) { console.log(`skip ${name}: ${!r ? 'no recipe' : 'no SAM source'}`); continue; }
      const stillFile = path.join(stills, r.picked.split(':')[1].split(' ')[0] + '.png');
      if (!fs.existsSync(stillFile)) { console.log(`skip ${name}: no still at ${stillFile}`); continue; }
      const who = seatedOf[name];
      const chairFile = SRC + 'chair-' + (who === 'dee' ? 'dee' : 'you') + '.png';
      const chair = who && fs.existsSync(chairFile) ? readGray(chairFile) : null;
      const seat = who ? marks[who === 'dee' ? 'chair-dee' : 'chair-good'].seat : null;
      const { mask, notes } = buildMask({ sam: readGray(samFile), still: load(stillFile, W, H), plate, chair, seat });
      writeLayer(mask, STAGE + name + '.webp');
      console.log(`${name}: SAM ${notes.sam} + ${notes.added} px added${notes.chair ? ` (chair ${notes.chair})` : ''} = ${notes.final}`);
    }
  } else if (argv[0] === '--sam') {
    const [, name, cut] = argv;
    grayPng(alphaMask(load(cut, W, H)), SRC + 'sam/' + name.replace(/\.webp$/, '') + '.png');
    console.log('stored SAM source for', name);
  } else {
    const [name, ...cuts] = argv;
    if (!name || !cuts.length) { console.error('usage: node tools/pose-bake.mjs --auto [name ...] | --sam <name> <cutout.png> | <name> <cutout.png> [more.png ...]'); process.exit(2); }
    let src = cuts[0];
    if (cuts.length > 1) {
      const tmp = path.join(mkdtempSync(path.join(tmpdir(), 'bake-')), 'merged.png');
      const args = ['-y', '-v', 'error'];
      cuts.forEach((c) => args.push('-i', c));
      let f = '[0]format=rgba[m0];';
      for (let i = 1; i < cuts.length; i++) f += `[${i}]format=rgba[x${i}];[m${i - 1}][x${i}]overlay=format=auto[m${i}];`;
      args.push('-filter_complex', f.replace(/;$/, ''), '-map', `[m${cuts.length - 1}]`, tmp);
      execFileSync('ffmpeg', args);
      src = tmp;
    }
    execFileSync('node', [path.join(here, 'silhouette.mjs'), src, STAGE + name + '.webp'], { stdio: 'inherit' });
  }
}
