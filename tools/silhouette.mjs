// Fill a person cut-out (RGBA PNG from image.segment) flat black, keep its alpha, write WebP with alpha.
// Usage: node tools/silhouette.mjs <cutout.png> <out.webp> [--keep-colour]
import { execFileSync } from 'node:child_process';
const [src, out, flag] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node tools/silhouette.mjs <cutout.png> <out.webp> [--keep-colour]'); process.exit(2); }
const black = 'colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0';
const vf = 'format=rgba' + (flag === '--keep-colour' ? '' : ',' + black);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', vf, '-c:v', 'libwebp', '-lossless', '0', '-quality', '82', '-pix_fmt', 'yuva420p', out]);
console.log('wrote', out);
