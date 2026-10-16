#!/usr/bin/env node
// Builds The Final Spark from its data file, story/final-spark.json (the source of truth; story doc: story/README.md):
//
//   js/story-data.js      the scenes for the player on the home page (js/game.js) and the playtest bot (js/playtest.js)
//   <folder>/index.html   one static page per scene (the branch pages)
//   hawkes.assets.json    the Hawkes Gen recipes for every scene's media (made by `studio.cmd assets imaginelivetv make`)
//   <folder>/scene.mp4    for scenes that use generated media: the clip, narration, talking shots and music, cut
//                         together with ffmpeg (skipped, with a warning, until the media exists)
//
//   node tools/build-story.mjs           build
//   node tools/build-story.mjs --check   exit 1 if the tree is broken or a generated file is out of date
//
// Never hand-edit the outputs: change the data and run this again.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = 'story/final-spark.json';
const CHECK = process.argv.includes('--check');

const story = JSON.parse(fs.readFileSync(path.join(ROOT, DATA), 'utf8'));
const scenes = story.scenes;
const byId = new Map(scenes.map((s) => [s.id, s]));
const problems = [];
const warnings = [];

/* ---------------- the tree ---------------- */

function validate() {
  const folders = new Set();
  // The player's button labels exist per language (UI in js/game.js).
  const langs = new Set([...fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8').matchAll(/^\s+([a-z]{2}): \{ back:/gm)].map((m) => m[1]));
  for (const s of scenes) if (!langs.has(s.lang)) problems.push(`${s.id}: language ${s.lang} has no labels in js/game.js (UI)`);
  if (!byId.has('start') || story.start !== 'start') problems.push('the first scene must have id "start" (js/game.js starts there)');
  for (const s of scenes) {
    if (byId.get(s.id) !== s) problems.push(`duplicate scene id ${s.id}`);
    if (!s.folder || !/^[a-z0-9-]+$/.test(s.folder)) problems.push(`${s.id}: folder must be lower-case-with-dashes`);
    if (folders.has(s.folder)) problems.push(`${s.id}: folder ${s.folder} is used twice`);
    folders.add(s.folder);
    for (const k of ['title', 'story', 'question']) if (!Array.isArray(s[k]) || s[k].length !== 2) problems.push(`${s.id}: ${k} must be [in ${s.lang}, in English]`);
    if (!s.choices.length && !s.ending) problems.push(`${s.id}: no choices and no ending (a dead end)`);
    for (const c of s.choices) if (!byId.has(c.next)) problems.push(`${s.id}: choice "${c.en}" goes to ${c.next}, which doesn't exist`);
    for (const who of s.shot?.cast ?? []) if (!story.characters[who]) problems.push(`${s.id}: cast member ${who} isn't in characters`);
    for (const l of s.lines ?? []) {
      const who = story.characters[l.speaker];
      if (!who) problems.push(`${s.id}: speaker ${l.speaker} isn't in characters`);
      else if (!who.voice) problems.push(`${s.id}: ${l.speaker} has no voice id`);
    }
    if (s.music && !story.music[s.music]) problems.push(`${s.id}: music cue ${s.music} isn't in music`);
    if (!s.film && useOf(s) !== 'gen') problems.push(`${s.id}: no filmed clip, so it must use "gen"`);
  }
  // Every scene can be reached from the start.
  const seen = new Set(['start']);
  const queue = ['start'];
  while (queue.length) for (const c of byId.get(queue.shift())?.choices ?? []) if (!seen.has(c.next) && byId.has(c.next)) seen.add(c.next), queue.push(c.next);
  for (const s of scenes) if (!seen.has(s.id)) problems.push(`${s.id}: no choice leads here (unreachable)`);
}

/* ---------------- media paths ---------------- */

const useOf = (s) => s.use ?? story.use ?? 'film';
const media = (s, file) => `${s.folder}/media/${file}`;
const musicFile = (cue) => `assets/story/music/${cue}.mp3`;
const cutFile = (s) => `${s.folder}/scene.mp4`;
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** The parts of a scene's generated cut, and whether they're all there. */
function cutParts(s) {
  const talks = (s.lines ?? []).map((l, i) => ({ video: media(s, `talk-${i + 1}.mp4`), audio: media(s, `line-${i + 1}.mp3`) }));
  const parts = { clip: media(s, 'clip.mp4'), narration: media(s, 'narration.mp3'), talks, music: s.music ? musicFile(s.music) : null };
  const need = [parts.clip, parts.narration, ...talks.flatMap((t) => [t.video, t.audio]), ...(parts.music ? [parts.music] : [])];
  return { ...parts, missing: need.filter((f) => !exists(f)), all: need };
}

/** What the player and the page play: the generated cut when the scene uses it and it's made, else the film. */
function videoOf(s) {
  if (useOf(s) === 'gen') {
    const { missing } = cutParts(s);
    if (!missing.length) return '/' + cutFile(s);
    if (s.film) warnings.push(`${s.id}: uses "gen" but ${missing.length} media file(s) aren't made yet (${missing[0]}…); playing the film`);
    else problems.push(`${s.id}: uses "gen", has no film, and its media isn't made yet`);
  }
  return s.film;
}

/* ---------------- js/story-data.js ---------------- */

function storyData() {
  const out = {};
  for (const s of scenes) {
    out[s.id] = {
      folder: s.folder,
      lang: s.lang,
      dir: s.dir ?? '',
      title: s.title,
      story: s.story,
      question: s.question,
      video: videoOf(s),
      ...(s.dead ? { dead: true } : {}),
      ...(s.ending ? { ending: s.ending } : {}),
      choices: s.choices.map((c) => [c.say, c.en, c.next]),
    };
  }
  return (
    `// Generated by tools/build-story.mjs from ${DATA}. Do not edit: change the data and run \`npm run story\`.\n` +
    `window.FINAL_SPARK = ${JSON.stringify({ title: story.title, start: story.start, scenes: out }, null, 1)};\n`
  );
}

/* ---------------- branch pages ---------------- */

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const spot = (s, [say, en], tag = 'span', attrs = '') => {
  const dir = s.dir ? ` dir="${s.dir}"` : '';
  const src = esc(say).replace(/\n/g, '<br>');
  const eng = esc(en).replace(/\n/g, '<br>');
  return `<${tag} class="${attrs ? attrs + ' ' : ''}spot"><span class="spot-src" lang="${s.lang}"${dir}>${src}</span><span class="spot-en" aria-hidden="true">${eng}</span></${tag}>`;
};

function page(s) {
  const choices = s.choices
    .map((c) => {
      const to = byId.get(c.next);
      return `<a class="choice spot" href="/${to.folder}/"><span class="spot-src" lang="${s.lang}"${s.dir ? ` dir="${s.dir}"` : ''}>${esc(c.say)}</span><span class="spot-en" aria-hidden="true">${esc(c.en)}</span></a>`;
    })
    .join('');
  return `<!DOCTYPE html>
<!-- Generated by tools/build-story.mjs from ${DATA} (scene "${s.id}"). Do not edit: change the data and run \`npm run story\`. -->
<html lang="${s.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(s.title[0])}</title>
  <meta name="description" content="${esc(s.story[0].replace(/\s+/g, ' '))}">
  <link rel="canonical" href="https://imaginelivetv.com/${s.folder}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/site.css">
  <meta name="theme-color" content="#070807">
</head>
<body>
  <header class="site-header">
    <a href="/">Imagine Live TV</a>
  </header>

  <main class="passage"${s.dead ? ' data-state="dead"' : s.ending ? ' data-state="soon"' : ''}>
    ${spot(s, s.title, 'h1')}
    <video src="${esc(videoOf(s))}" controls playsinline preload="metadata"></video>
    ${spot(s, s.story, 'p', 'passage-note')}
    ${spot(s, s.question, 'p', 'passage-prompt')}
    ${choices ? `<div class="spark-choices">${choices}</div>` : ''}${s.ending ? `\n    ${spot(s, s.ending, 'p', 'passage-prompt')}` : ''}
  </main>

  <footer class="site-footer">
    <p>Copyright © 2026 Imagine Live TV - All Rights Reserved.</p>
    <p class="powered">Powered by Someone</p>
  </footer>
  <script src="/js/spot.js"></script>
</body>
</html>
`;
}

/* ---------------- hawkes.assets.json ---------------- */

const words = (t) => String(t).split(/\s+/).filter(Boolean).length;
const flat = (t) => String(t).replace(/\n+•?\s*/g, ' ').replace(/\s+/g, ' ').trim();

function castRefs(cast) {
  return cast.map((who, i) => `image ${i + 1} is the reference sheet for ${who === 'hero' ? 'the hero' : story.characters[who].name.toLowerCase()} (${story.characters[who].look})`).join('; ');
}

function assets() {
  const list = [];
  const used = new Set(scenes.map((s) => s.shot?.cast ?? []).flat().concat(scenes.flatMap((s) => (s.lines ?? []).map((l) => l.speaker))));

  // One reference sheet per character, from a frame of J's filmed clips, so every shot keeps the same faces.
  for (const [id, c] of Object.entries(story.characters)) {
    if (!used.has(id)) continue;
    list.push({
      id: `char-${id}`,
      note: `Reference sheet for ${c.name}, from a frame of the filmed clips (${c.seed}).`,
      inputs: [c.seed],
      steps: [
        {
          tool: 'image.edit',
          params: {
            prompt: `Character reference sheet of this exact individual: ${c.look}. Full-body front view, three-quarter view, side view and back view, plus a close-up of the face, side by side on a plain mid-grey background. Same proportions and clothes in every view. ${story.style}`,
            negative: story.negative,
            width: 1536,
            height: 1024,
          },
          inputs: { images: ['$input:0'] },
          save: 'sheet',
        },
      ],
      candidates: 3,
      pick: 'the same individual as the reference photo; every view consistent; clean grey background; no text',
      files: { sheet: c.sheet },
    });
  }

  // One music cue per mood, shared by the scenes that use it.
  for (const cue of [...new Set(scenes.map((s) => s.music).filter(Boolean))]) {
    list.push({
      id: `music-${cue}`,
      note: `Music for the ${cue} scenes (${scenes.filter((s) => s.music === cue).map((s) => s.id).join(', ')}).`,
      steps: [{ tool: 'audio.music', params: { prompt: story.music[cue], lyrics: '[Instrumental]', seconds: 60, bpm: 70 }, save: 'music' }],
      files: { music: musicFile(cue) },
    });
  }

  for (const s of scenes) {
    const cast = (s.shot?.cast ?? []).slice(0, 3);
    // The keyframe (image.edit from the cast's sheets, best of 3) and its clip (video.i2v).
    list.push({
      id: `${s.id}-shot`,
      note: `${s.title[1]}: keyframe and clip.`,
      inputs: cast.map((who) => story.characters[who].sheet),
      steps: [
        {
          tool: 'image.edit',
          params: {
            prompt: `A vertical 9:16 film still: ${s.shot.scene}. ${castRefs(cast)}; keep their faces, bodies and clothes exactly. ${story.style}`,
            negative: story.negative,
            width: 720,
            height: 1280,
          },
          inputs: { images: cast.map((_, i) => `$input:${i}`) },
          save: 'keyframe',
        },
        {
          tool: 'video.i2v',
          params: { prompt: `${s.shot.motion}. Slow, tense handheld camera. ${story.style}`, negative: story.negative, width: 544, height: 960, frames: 81, fps: 16 },
          inputs: { start: '$prev' },
          save: 'clip',
        },
      ],
      candidates: 3,
      pick: `matches the scene (${s.shot.scene}); the characters match their reference sheets; reads clearly as a vertical frame; no text`,
      files: { keyframe: media(s, 'keyframe.png'), clip: media(s, 'clip.mp4') },
    });

    // Narration: the story and the question, spoken in the scene's language.
    list.push({
      id: `${s.id}-voice`,
      note: `${s.title[1]}: narration in ${s.lang}.`,
      steps: [{ tool: 'audio.voice', params: { text: `${flat(s.story[0])} ${flat(s.question[0])}`, voice: story.narrator.voice, model: story.narrator.model }, save: 'narration' }],
      files: { narration: media(s, 'narration.mp3') },
    });

    // Talking shots: a close-up of the speaker (image.edit), the line (audio.voice), lips and head to it (video.talk).
    (s.lines ?? []).forEach((l, i) => {
      const who = story.characters[l.speaker];
      const seconds = words(l.text) / 2.5 + 1;
      list.push({
        id: `${s.id}-talk-${i + 1}`,
        note: `${s.title[1]}: ${who.name} says "${l.text}"${l.draft ? ' (DRAFT line: J to approve)' : ''}. video.talk is experimental.`,
        inputs: [who.sheet, media(s, 'keyframe.png')],
        steps: [
          {
            tool: 'image.edit',
            params: {
              prompt: `A vertical medium close-up of the individual from image 1 (${who.look}) facing the camera, mouth closed, in the setting of image 2: ${s.shot.scene}. ${story.style}`,
              negative: story.negative,
              width: 480,
              height: 832,
            },
            inputs: { images: ['$input:0', '$input:1'] },
            save: `portrait-${i + 1}`,
          },
          { tool: 'audio.voice', params: { text: l.text, voice: who.voice, model: story.narrator.model }, save: `line-${i + 1}` },
          {
            tool: 'video.talk',
            params: { prompt: `${who.look} speaks to the camera, natural head movement, ${s.shot.motion}`, width: 480, height: 832, frames: Math.min(1000, Math.ceil(seconds * 25)), fps: 25 },
            inputs: { image: '$step1', audio: '$step2', audio2: '$step2' },
            save: `talk-${i + 1}`,
          },
        ],
        candidates: 2,
        pick: 'front-facing, face clearly visible and well lit, mouth closed, matches the reference sheet',
        files: { [`portrait-${i + 1}`]: media(s, `portrait-${i + 1}.png`), [`line-${i + 1}`]: media(s, `line-${i + 1}.mp3`), [`talk-${i + 1}`]: media(s, `talk-${i + 1}.mp4`) },
      });
    });
  }
  return JSON.stringify({ $comment: `Generated by tools/build-story.mjs from ${DATA}. Do not edit: change the data and run \`npm run story\`.`, project: 'imaginelivetv', assets: list }, null, 2) + '\n';
}

/* ---------------- the generated cut (ffmpeg) ---------------- */

function ffmpegBin(name) {
  for (const p of [process.env.FFMPEG_DIR, 'C:/ffmpeg/bin'].filter(Boolean)) {
    const f = path.join(p, name + (process.platform === 'win32' ? '.exe' : ''));
    if (fs.existsSync(f)) return f;
  }
  return name;
}
const duration = (rel) => Number(execFileSync(ffmpegBin('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(ROOT, rel)], { encoding: 'utf8' }).trim());

/** Clip looped under the narration, then each talking shot with its line, all over the mood music. */
function cut(s) {
  const p = cutParts(s);
  if (p.missing.length) return;
  const out = path.join(ROOT, cutFile(s));
  const newest = Math.max(...p.all.map((f) => fs.statSync(path.join(ROOT, f)).mtimeMs), fs.statSync(path.join(ROOT, DATA)).mtimeMs);
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= newest) return;
  if (CHECK) return problems.push(`${cutFile(s)} is out of date`);

  const fit = 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=24,setsar=1';
  const args = ['-v', 'error', '-y'];
  const graph = [];
  const pairs = [];
  const a0 = duration(p.narration) + 0.8;
  let total = a0;
  args.push('-stream_loop', '-1', '-i', path.join(ROOT, p.clip), '-i', path.join(ROOT, p.narration));
  graph.push(`[0:v]${fit},trim=duration=${a0},setpts=PTS-STARTPTS[v0]`, `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,apad=whole_dur=${a0}[a0]`);
  pairs.push('[v0][a0]');
  p.talks.forEach((t, i) => {
    const d = duration(t.audio) + 0.5;
    const vi = 2 + i * 2;
    total += d;
    args.push('-i', path.join(ROOT, t.video), '-i', path.join(ROOT, t.audio));
    graph.push(`[${vi}:v]${fit},tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d},setpts=PTS-STARTPTS[v${i + 1}]`, `[${vi + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,apad=whole_dur=${d}[a${i + 1}]`);
    pairs.push(`[v${i + 1}][a${i + 1}]`);
  });
  graph.push(`${pairs.join('')}concat=n=${pairs.length}:v=1:a=1[v][speech]`);
  let audio = '[speech]';
  if (p.music) {
    const mi = 2 + p.talks.length * 2;
    args.push('-stream_loop', '-1', '-i', path.join(ROOT, p.music));
    graph.push(`[${mi}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.22,atrim=duration=${total},afade=t=out:st=${Math.max(0, total - 1.5)}:d=1.5[m]`, `[speech][m]amix=inputs=2:duration=first:normalize=0[mix]`);
    audio = '[mix]';
  }
  args.push('-filter_complex', graph.join(';'), '-map', '[v]', '-map', audio, '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out);
  try {
    execFileSync(ffmpegBin('ffmpeg'), args, { stdio: ['ignore', 'inherit', 'inherit'] });
    console.log(`cut      ${cutFile(s)} (${total.toFixed(1)} s)`);
  } catch (e) {
    warnings.push(`${s.id}: ffmpeg failed to cut ${cutFile(s)} (${e.message.split('\n')[0]})`);
  }
}

/* ---------------- write ---------------- */

const changed = [];
function write(rel, text) {
  const f = path.join(ROOT, rel);
  const old = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (old === text) return;
  changed.push(rel);
  if (CHECK) return;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}

validate();
if (!problems.length) {
  for (const s of scenes) if (useOf(s) === 'gen') cut(s);
  write('js/story-data.js', storyData());
  for (const s of scenes) write(`${s.folder}/index.html`, page(s));
  write('hawkes.assets.json', assets());
  // Folders with a generated page that no scene owns any more.
  const owned = new Set(scenes.map((s) => s.folder));
  for (const d of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!d.isDirectory() || owned.has(d.name)) continue;
    const f = path.join(ROOT, d.name, 'index.html');
    if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('Generated by tools/build-story.mjs')) warnings.push(`${d.name}/ is a generated page no scene owns any more (delete it)`);
  }
}

for (const w of warnings) console.warn(`warning  ${w}`);
for (const p of problems) console.error(`problem  ${p}`);
if (CHECK) {
  for (const c of changed) console.error(`stale    ${c}`);
  if (problems.length || changed.length) process.exit(1);
  console.log(`ok       ${scenes.length} scenes, everything generated is up to date`);
} else {
  if (problems.length) process.exit(1);
  for (const c of changed) console.log(`wrote    ${c}`);
  const gen = scenes.filter((s) => useOf(s) === 'gen').length;
  console.log(`${scenes.length} scenes (${gen} on generated media), ${changed.length} file(s) changed`);
}
