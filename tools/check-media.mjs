#!/usr/bin/env node
/**
 * Every story's media is on disk and plays with sound (npm run test:media; part of Studio's checks).
 *
 * For each story in js/story-data.js (run `npm run story` first):
 *  - clip stories: every scene has a clip; its full and phone (sm) renditions and poster are real files (not empty,
 *    not Git LFS pointers); each mp4 has a picture track and a sound track; full and phone cuts run the same length.
 *  - console stories: every voice line, ambience, music bed, sound effect and camera picture it names is a real file,
 *    and every ambience/music/sfx key a scene uses is in the story's sound lists.
 *  - the story's home card picture exists.
 * Listed stories fail the build on any problem. Unlisted drafts (stories still being made) only warn.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "js/story-data.js"), "utf8"), sandbox);
const stories = sandbox.window.ILTV_STORIES.stories;

const problems = [];
const warnings = [];
let files = 0;
const seen = new Map();

/** Path on disk for a site URL ("/water-road/x/scene.mp4" -> <repo>/water-road/x/scene.mp4); null for remote URLs. */
function onDisk(url) {
  if (!url || /^(https?:|data:|blob:)/.test(url)) return null;
  return path.join(root, decodeURI(url.split(/[?#]/)[0]).replace(/^\/+/, ""));
}

/** Checks one file once. Returns the problem text, or "" when it is fine. */
function fileProblem(url) {
  if (seen.has(url)) return seen.get(url);
  let why = "";
  const file = onDisk(url);
  if (file) {
    files++;
    if (!fs.existsSync(file)) why = "missing";
    else {
      const size = fs.statSync(file).size;
      if (!size) why = "empty";
      else if (size < 200) {
        const head = fs.readFileSync(file, "utf8");
        if (head.startsWith("version https://git-lfs")) why = "a Git LFS pointer, not the file";
      }
      if (!why && /\.mp4$/i.test(file)) why = mp4Problem(file);
    }
  }
  seen.set(url, why);
  return why;
}

/** The top-level and moov boxes of an mp4: handler types of its tracks, and its length in seconds. */
function mp4Info(file) {
  const buf = fs.readFileSync(file);
  const info = { handlers: [], seconds: null };
  const walk = (start, end, inside) => {
    let at = start;
    while (at + 8 <= end) {
      let size = buf.readUInt32BE(at);
      const type = buf.toString("latin1", at + 4, at + 8);
      let head = 8;
      if (size === 1) { size = Number(buf.readBigUInt64BE(at + 8)); head = 16; }
      else if (size === 0) size = end - at;
      if (size < head || at + size > end) break;
      if (["moov", "trak", "mdia"].includes(type)) walk(at + head, at + size, type);
      else if (type === "hdlr" && inside === "mdia") info.handlers.push(buf.toString("latin1", at + head + 8, at + head + 12));
      else if (type === "mvhd") {
        const v = buf[at + head];
        const scale = v === 1 ? buf.readUInt32BE(at + head + 20) : buf.readUInt32BE(at + head + 12);
        const dur = v === 1 ? Number(buf.readBigUInt64BE(at + head + 24)) : buf.readUInt32BE(at + head + 16);
        if (scale) info.seconds = dur / scale;
      }
      at += size;
    }
  };
  walk(0, buf.length, "");
  return info;
}

function mp4Problem(file) {
  let info;
  try { info = mp4Info(file); } catch (e) { return "not a readable mp4 (" + e.message + ")"; }
  if (!info.handlers.includes("vide")) return "no picture track";
  if (!info.handlers.includes("soun")) return "no sound track (it would play silent)";
  return "";
}

function seconds(url) {
  const file = onDisk(url);
  try { return file && fs.existsSync(file) ? mp4Info(file).seconds : null; } catch (e) { return null; }
}

for (const story of stories) {
  const out = story.listed ? problems : warnings;
  const say = (where, text) => out.push(`${story.id}${where ? " / " + where : ""}: ${text}`);
  const need = (where, what, url) => {
    if (!url) return;
    const why = fileProblem(url);
    if (why) say(where, `${what} ${url}: ${why}`);
  };
  need("", "home card picture", story.image);
  const scenes = Array.isArray(story.scenes) ? story.scenes : Object.entries(story.scenes || {}).map(([id, s]) => ({ ...s, _id: id }));

  if (story.type === "console") {
    const lists = { ambience: story.ambience || {}, music: story.music || {}, sfx: story.sfx || {} };
    const sound = (where, kind, key) => {
      if (!key) return;
      if (!(key in lists[kind])) return say(where, `${kind} "${key}" is not in the story's ${kind} list`);
      if (lists[kind][key]) need(where, kind, lists[kind][key]);
      else if (story.listed) say(where, `${kind} "${key}" has no file (it would play silent)`);
    };
    for (const kind of Object.keys(lists)) for (const [key, url] of Object.entries(lists[kind])) if (url) need("", `${kind} "${key}"`, url);
    for (const cam of story.cameras || []) for (const [state, s] of Object.entries(cam.states || {})) need("", `camera ${cam.id} ${state} picture`, s.image);
    for (const scene of scenes) {
      const where = scene._id || scene.folder;
      sound(where, "ambience", scene.ambience);
      sound(where, "music", scene.music);
      (scene.lines || []).forEach((line, i) => {
        if (!line.file) say(where, `line ${i + 1} has no voice file`);
        else need(where, `line ${i + 1} voice`, line.file);
        sound(where, "sfx", line.sfx);
      });
    }
    continue;
  }

  for (const scene of scenes) {
    const where = scene.folder || scene._id;
    if (!scene.video) { say(where, "has no clip"); continue; }
    need(where, "clip", scene.video);
    need(where, "phone clip", scene.small);
    need(where, "poster", scene.poster);
    if (scene.small && scene.video && !fileProblem(scene.small) && !fileProblem(scene.video)) {
      const a = seconds(scene.video), b = seconds(scene.small);
      if (a && b && Math.abs(a - b) > 0.5) say(where, `phone clip runs ${b.toFixed(1)} s but the clip runs ${a.toFixed(1)} s`);
    }
  }
}

for (const w of warnings) console.warn("draft (not listed): " + w);
if (problems.length) {
  console.error(`check-media: ${problems.length} problem(s) in listed stories:`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`check-media: ${files} media files across ${stories.length} stories are there and have sound` + (warnings.length ? ` (${warnings.length} draft warning(s))` : ""));
