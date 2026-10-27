// Tiny image helpers for the room-art checks: decode any image to RGBA with ffmpeg, encode PNG with ffmpeg. No other dependencies.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/** Decode a file to { w, h, data } (RGBA, 4 bytes a pixel), scaled to w x h when given. */
export function load(file, w, h) {
  if (!w) {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',');
    w = +out[0]; h = +out[1];
  }
  const args = ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=bilinear,format=rgba`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'];
  const buf = execFileSync('ffmpeg', args, { maxBuffer: 1 << 29 });
  return { w, h, data: new Uint8Array(buf.buffer, buf.byteOffset, buf.length) };
}

export function save(img, file) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${img.w}x${img.h}`, '-i', '-', '-frames:v', '1', file], { input: Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), maxBuffer: 1 << 28 });
}

export function blank(w, h, rgba = [0, 0, 0, 255]) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = rgba[0]; data[i + 1] = rgba[1]; data[i + 2] = rgba[2]; data[i + 3] = rgba[3]; }
  return { w, h, data };
}

/** Draw src (RGBA) over dst (RGBA, opaque) in place; `opacity` 0..1 scales src alpha. */
export function over(dst, src, opacity = 1) {
  const d = dst.data, s = src.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = (s[i + 3] / 255) * opacity;
    if (!a) continue;
    d[i] = d[i] * (1 - a) + s[i] * a; d[i + 1] = d[i + 1] * (1 - a) + s[i + 1] * a; d[i + 2] = d[i + 2] * (1 - a) + s[i + 2] * a;
  }
}

/** Binary mask (Uint8Array 0/1) of alpha > t. */
export function alphaMask(img, t = 127) {
  const m = new Uint8Array(img.w * img.h);
  for (let i = 0; i < m.length; i++) m[i] = img.data[i * 4 + 3] > t ? 1 : 0;
  return m;
}
