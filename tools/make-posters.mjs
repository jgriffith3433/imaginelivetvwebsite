// Posters and phone renditions for every clip the stories play, and a WebP of every card image. CPU only (ffmpeg).
//   node tools/make-posters.mjs            make what is missing or older than its source
//   node tools/make-posters.mjs --check    fail if anything is missing or out of date (nothing is written)
// For <dir>/<name>.mp4 (a clip a scene plays, found through js/story-data.js):
//   <dir>/poster/<name>.webp   a frame 1 s in, 360x640, shown by the player before the clip loads
//   <dir>/sm/<name>.mp4        a phone rendition: 480 wide, H.264 + AAC, picked by the player on small screens
// For /assets/images/<name>.jpg (a card's key image): /assets/images/<name>.webp, 540 wide.
// `npm run story` links them when they exist (build-story.mjs: posterOf, smallOf, webpOf).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { posterPath, smallPath, webpPath } from './lib/media-paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const mtime = (rel) => { try { return fs.statSync(path.join(ROOT, rel)).mtimeMs; } catch { return 0; } };
const stale = (src, out) => mtime(out) < mtime(src);
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });

const win = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/story-data.js'), 'utf8'), { window: win });
const videos = new Set();
const images = new Set();
for (const st of win.ILTV_STORIES.stories) {
  if (st.image && st.image.endsWith('.jpg')) images.add(st.image);
  for (const s of Object.values(st.scenes)) if (s.video) videos.add(s.video);
}

let made = 0;
const todo = [];
const job = (src, out, make) => {
  const s = src.replace(/^\//, '');
  const o = out.replace(/^\//, '');
  if (!stale(s, o)) return;
  if (CHECK) return todo.push(o);
  fs.mkdirSync(path.dirname(path.join(ROOT, o)), { recursive: true });
  make(s, o);
  made += 1;
  console.log(`made     ${o}`);
};

for (const v of [...videos].sort()) {
  job(v, posterPath(v), (s, o) => ff('-ss', '1', '-i', s, '-frames:v', '1', '-vf', 'scale=360:-2', '-c:v', 'libwebp', '-quality', '70', o));
  job(v, smallPath(v), (s, o) =>
    ff('-i', s, '-vf', 'scale=480:-2', '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-crf', '28', '-maxrate', '700k', '-bufsize', '1400k',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-ac', '2', '-movflags', '+faststart', o));
}
for (const i of [...images].sort()) job(i, webpPath(i), (s, o) => ff('-i', s, '-vf', 'scale=540:-2', '-c:v', 'libwebp', '-quality', '75', o));

if (CHECK) {
  if (todo.length) {
    console.error(`${todo.length} poster/rendition file(s) missing or out of date (run: node tools/make-posters.mjs):\n  ${todo.slice(0, 8).join('\n  ')}`);
    process.exit(1);
  }
  console.log(`posters: ${videos.size} clips and ${images.size} card images are covered`);
} else console.log(`posters: ${made} made, ${videos.size} clips and ${images.size} card images covered`);
