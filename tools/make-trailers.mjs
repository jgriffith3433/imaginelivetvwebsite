// Cut muted trailers and card loops for the landing page from clips that already exist (CPU / ffmpeg only).
 //   node tools/make-trailers.mjs            make what is missing or older than its sources
 //   node tools/make-trailers.mjs --check    fail if anything is missing or out of date
 // Outputs under assets/trailers/<story-id>/:
 //   trailer.mp4 / trailer-sm.mp4 / poster.webp   15–20 s muted hero (1280×720 / 720×404)
 //   loop.mp4 / loop-sm.mp4 / loop-poster.webp    3 s muted card loop (540×960 / 360×640)
 // Night Shift has no clips: its trailer and loop are slow pushes across existing CCTV stills.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const OUT = 'assets/trailers';

const mtime = (rel) => { try { return fs.statSync(path.join(ROOT, rel)).mtimeMs; } catch { return 0; } };
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const newest = (srcs) => Math.max(0, ...srcs.map(mtime));
const stale = (srcs, outs) => outs.some((o) => mtime(o) < newest(srcs));
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
const probe = (rel) => {
  try {
    return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rel], { cwd: ROOT }).toString().trim());
  } catch { return 0; }
};

/** Prefer the phone rendition when present (smaller); fall back to the full clip. */
function pick(rel) {
  const sm = rel.replace(/([^/]+)\.mp4$/, 'sm/$1.mp4').replace(/\/sm\/sm\//, '/sm/');
  // assets/video/foo.mp4 → assets/video/sm/foo.mp4; folder/scene.mp4 → folder/sm/scene.mp4
  const alt = rel.includes('/sm/') ? rel
    : rel.startsWith('assets/video/') ? rel.replace('assets/video/', 'assets/video/sm/')
    : rel.replace(/\/([^/]+)\.mp4$/, '/sm/$1.mp4');
  if (exists(alt)) return alt;
  if (exists(rel)) return rel;
  return null;
}

const STORIES = [
  {
    id: 'final-spark',
    // Best moments: wake with the rat, the fork, the gate, the fog, the shadow, the town.
    beats: [
      { src: 'the-sewer/scene.mp4', at: 1.0, dur: 2.6 },
      { src: 'assets/video/direction.mp4', at: 1.5, dur: 2.6 },
      { src: 'assets/video/gate.mp4', at: 2.0, dur: 2.6 },
      { src: 'assets/video/fog.mp4', at: 3.0, dur: 2.6 },
      { src: 'assets/video/shadow-dance.mp4', at: 4.0, dur: 2.8 },
      { src: 'assets/video/destroy-town.mp4', at: 2.0, dur: 2.6 },
    ],
    loop: { src: 'the-sewer/scene.mp4', at: 1.2, dur: 3.0 },
  },
  {
    id: 'water-road',
    beats: [
      { src: 'water-road/the-water-road/scene.mp4', at: 1.0, dur: 3.2 },
      { src: 'water-road/the-salt-flats/scene.mp4', at: 1.0, dur: 3.0 },
      { src: 'water-road/under-the-mesa/scene.mp4', at: 1.0, dur: 3.0 },
      { src: 'water-road/the-dust/scene.mp4', at: 1.5, dur: 3.2 },
      { src: 'water-road/a-drink-for-strangers/scene.mp4', at: 1.0, dur: 3.0 },
      { src: 'water-road/dry-fork/scene.mp4', at: 1.0, dur: 3.0 },
    ],
    loop: { src: 'water-road/the-water-road/scene.mp4', at: 2.0, dur: 3.0 },
  },
  {
    id: 'night-shift',
    // CCTV stills with a slow push (no clips).
    stills: [
      'night-shift/media/feeds/c1-normal.png',
      'night-shift/media/feeds/c4-wedge.png',
      'night-shift/media/feeds/c3-van.png',
      'night-shift/media/feeds/c5-stuck.png',
      'night-shift/media/feeds/c2-sleeper.png',
      'night-shift/media/feeds/c9-trouble.png',
    ],
    loopStill: 'night-shift/media/feeds/c1-normal.png',
  },
];

const LANDSCAPE = { w: 1280, h: 720, smW: 720, smH: 404 };
const PORTRAIT = { w: 540, h: 960, smW: 360, smH: 640 };

function scaleCrop(w, h) {
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
}

function sliceClip(src, at, dur, out, w, h) {
  const len = probe(src);
  const start = Math.max(0, Math.min(at, Math.max(0, len - 0.4)));
  const take = Math.min(dur, Math.max(0.3, len - start));
  ff('-ss', String(start), '-i', src, '-t', String(take),
    '-vf', scaleCrop(w, h), '-an',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
}

/** Slow push across a still into a short muted clip. */
function pushStill(src, dur, out, w, h, zoom = 1.12) {
  const frames = Math.max(15, Math.round(dur * 25));
  const vf = `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},zoompan=z='min(zoom+0.0008,${zoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=25,setsar=1`;
  ff('-loop', '1', '-i', src, '-t', String(dur), '-vf', vf, '-an',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
}

function concatClips(parts, out) {
  const list = path.join(path.dirname(out), `_concat-${path.basename(out)}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${path.resolve(ROOT, p).replace(/'/g, "'\\''")}'`).join('\n'));
  ff('-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out);
  fs.unlinkSync(list);
}

function posterOf(src, out) {
  ff('-ss', '0.4', '-i', src, '-frames:v', '1', '-vf', 'scale=540:-2', '-c:v', 'libwebp', '-quality', '70', out);
}

function transcode(src, out, w, h) {
  ff('-i', src, '-vf', scaleCrop(w, h), '-an',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
}

function makeStory(st) {
  const dir = path.join(OUT, st.id);
  const outs = {
    trailer: `${dir}/trailer.mp4`,
    trailerSm: `${dir}/trailer-sm.mp4`,
    poster: `${dir}/poster.webp`,
    loop: `${dir}/loop.mp4`,
    loopSm: `${dir}/loop-sm.mp4`,
    loopPoster: `${dir}/loop-poster.webp`,
  };
  const srcs = st.stills
    ? [...st.stills, st.loopStill]
    : [...st.beats.map((b) => pick(b.src) || b.src), pick(st.loop.src) || st.loop.src];

  for (const s of srcs) {
    if (!exists(s)) throw new Error(`${st.id}: missing source ${s} (restore the clip or still, then re-run)`);
  }
  if (!stale(srcs, Object.values(outs))) return { id: st.id, made: false, outs };

  if (CHECK) return { id: st.id, made: 'todo', outs };

  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const tmp = path.join(ROOT, dir, '_parts');
  fs.mkdirSync(tmp, { recursive: true });
  const parts = [];

  if (st.stills) {
    st.stills.forEach((still, i) => {
      const part = path.join(dir, `_parts/beat-${i}.mp4`);
      pushStill(still, 3.0, part, LANDSCAPE.w, LANDSCAPE.h, 1.14);
      parts.push(part);
    });
  } else {
    st.beats.forEach((beat, i) => {
      const src = pick(beat.src);
      const part = path.join(dir, `_parts/beat-${i}.mp4`);
      sliceClip(src, beat.at, beat.dur, part, LANDSCAPE.w, LANDSCAPE.h);
      parts.push(part);
    });
  }
  concatClips(parts, outs.trailer);
  transcode(outs.trailer, outs.trailerSm, LANDSCAPE.smW, LANDSCAPE.smH);
  posterOf(outs.trailer, outs.poster);

  if (st.stills) {
    pushStill(st.loopStill, 3.0, outs.loop, PORTRAIT.w, PORTRAIT.h, 1.1);
  } else {
    sliceClip(pick(st.loop.src), st.loop.at, st.loop.dur, outs.loop, PORTRAIT.w, PORTRAIT.h);
  }
  transcode(outs.loop, outs.loopSm, PORTRAIT.smW, PORTRAIT.smH);
  posterOf(outs.loop, outs.loopPoster);

  for (const p of parts) try { fs.unlinkSync(path.join(ROOT, p)); } catch {}
  try { fs.rmdirSync(tmp); } catch {}
  return { id: st.id, made: true, outs };
}

let made = 0;
const todo = [];
for (const st of STORIES) {
  const r = makeStory(st);
  if (r.made === 'todo') todo.push(...Object.values(r.outs));
  else if (r.made) {
    made += 1;
    console.log(`made     ${st.id}: trailer + loop`);
  } else console.log(`ok       ${st.id}`);
}

if (CHECK) {
  if (todo.length) {
    console.error(`${todo.length} trailer file(s) missing or out of date (run: node tools/make-trailers.mjs):\n  ${todo.slice(0, 10).join('\n  ')}`);
    process.exit(1);
  }
  console.log(`trailers: ${STORIES.length} stories covered`);
} else {
  console.log(`trailers: ${made} story set(s) made, ${STORIES.length} covered`);
}
