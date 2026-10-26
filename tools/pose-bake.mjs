// Bake a pose layer: the person's cut-out (image.segment, RGBA PNG), optionally merged with a second cut-out (their chair, a bag),
// filled flat black and written as a full-plate WebP with alpha into night-shift/media/stage/.
// Usage: node tools/pose-bake.mjs <name> <person-cutout.png> [extra-cutout.png ...]   (the layer is <name>.webp)
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [name, ...cuts] = process.argv.slice(2);
if (!name || !cuts.length) { console.error('usage: node tools/pose-bake.mjs <name> <cutout.png> [more.png ...]'); process.exit(2); }
const out = path.join(here, '..', 'night-shift', 'media', 'stage', name + '.webp');
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
execFileSync('node', [path.join(here, 'silhouette.mjs'), src, out], { stdio: 'inherit' });
