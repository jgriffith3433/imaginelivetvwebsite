#!/usr/bin/env node
// Builds every choose-your-path story on the site from its data (story doc: story/README.md):
//
//   story/stories.json    the listing: which stories, in what order, each one's card (logline, key image)
//   story/<id>.json       a story's scenes, cast, music and labels (The Final Spark is story/final-spark.json)
//
// into
//
//   js/story-data.js      every story's scenes for the player on the home page (js/game.js) and the playtest bot
//   index.html            the landing page's story cards (between the <!-- stories --> markers)
//   <id>/index.html       a link to each story's player (/?story=<id>)
//   <pages><folder>/      one static page per scene (the branch pages): The Final Spark's at the site root, as
//                         they always were (/the-sewer/), every other story's under its id (/<id>/<folder>/)
//   hawkes.assets.json    the Hawkes Gen recipes for every scene's media (made by `studio.cmd assets imaginelivetv make`)
//                         (a story with an `inventory` gets its own bar, js/kit.js, instead of the flashlight)
//   <folder>/scene.mp4    for scenes that use generated media: the clip, narration, talking shots and music, cut
//                         together with ffmpeg (skipped, with a warning, until the media exists)
//
//   node tools/build-story.mjs           build
//   node tools/build-story.mjs --check   exit 1 if a tree is broken or a generated file is out of date
//
// Never hand-edit the outputs: change the data and run this again.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// A story's own inventory (counts per scene): the same code the player and the branch pages run.
import '../js/kit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LISTING = 'story/stories.json';
const CHECK = process.argv.includes('--check');
// Top-level folders that aren't story pages.
const RESERVED = new Set(['assets', 'css', 'js', 'f', 'story', 'tools', 'node_modules', 'hawkesgen', 'media']);
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const problems = [];
const warnings = [];
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/* ---------------- the stories ---------------- */

const listing = readJson(LISTING).stories;
const stories = [];
for (const entry of listing) {
  if (!ID.test(entry.id || '')) {
    problems.push(`${LISTING}: story id "${entry.id}" must be lower-case-with-dashes`);
    continue;
  }
  const file = `story/${entry.id}.json`;
  if (!fs.existsSync(path.join(ROOT, file))) {
    problems.push(`${LISTING}: ${entry.id} has no data file (${file})`);
    continue;
  }
  const data = readJson(file);
  const root = entry.pages === '/';
  if (entry.pages != null && !root && entry.pages !== `/${entry.id}/`) problems.push(`${entry.id}: pages must be "/" or "/${entry.id}/" (the default)`);
  stories.push({
    id: entry.id,
    entry,
    file,
    data,
    scenes: data.scenes,
    byId: new Map(data.scenes.map((s) => [s.id, s])),
    root,
    // Where its pages, media and asset ids go. The Final Spark keeps the site root and its old asset ids.
    base: root ? '' : `${entry.id}/`,
    prefix: root ? '' : `${entry.id}-`,
    musicDir: root ? 'assets/story/music' : `assets/story/${entry.id}/music`,
    listed: entry.listed !== false,
  });
}

/* ---------------- the trees ---------------- */

function validate(st) {
  const { id, data, scenes, byId } = st;
  const at = (s) => `${id}/${s.id}`;
  if (!Array.isArray(data.title) && typeof data.title !== 'string') problems.push(`${id}: no title`);
  if (!st.entry.logline) problems.push(`${id}: no logline in ${LISTING} (its card's one line)`);
  if (st.entry.status != null) problems.push(`${id}: status is gone from ${LISTING}: every card wears the player's own progress badge (Not started, Started, Completed), and a story is completed at a scene with an "ending"`);
  if (st.entry.image && !fs.existsSync(path.join(ROOT, st.entry.image.replace(/^\//, '')))) problems.push(`${id}: card image ${st.entry.image} doesn't exist`);
  if (!data.cookie || !/^[A-Za-z0-9_-]+$/.test(data.cookie)) problems.push(`${id}: cookie (the name its progress is saved under) must be letters, digits, - or _`);
  if (!data.ui || !data.ui.en) problems.push(`${id}: ui.en (the English under the player's labels) is missing`);
  for (const [lang, ui] of Object.entries(data.ui ?? {})) for (const k of ['mouth', 'depth']) if (!ui[k]) problems.push(`${id}: ui.${lang} has no ${k}`);
  for (const s of scenes) if (!data.ui?.[s.lang]) problems.push(`${at(s)}: language ${s.lang} has no labels in ui`);
  if (!byId.has(data.start)) problems.push(`${id}: start scene ${data.start} doesn't exist`);
  const folders = new Set();
  for (const s of scenes) {
    if (byId.get(s.id) !== s) problems.push(`${id}: duplicate scene id ${s.id}`);
    if (!s.folder || !ID.test(s.folder)) problems.push(`${at(s)}: folder must be lower-case-with-dashes`);
    if (folders.has(s.folder)) problems.push(`${at(s)}: folder ${s.folder} is used twice`);
    if (st.root && (RESERVED.has(s.folder) || stories.some((o) => o.id === s.folder))) problems.push(`${at(s)}: folder ${s.folder} is taken at the site root`);
    folders.add(s.folder);
    for (const k of ['title', 'story', 'question']) if (!Array.isArray(s[k]) || s[k].length !== 2) problems.push(`${at(s)}: ${k} must be [in ${s.lang}, in English]`);
    if (!s.choices.length && !s.ending) problems.push(`${at(s)}: no choices and no ending (a dead end)`);
    // An ending (its "ending" line) is where the story is completed (the card's badge says Completed); a death isn't one.
    if (s.ending && (s.dead || s.choices.length)) problems.push(`${at(s)}: an ending has no choices and isn't a death`);
    for (const c of s.choices) if (!byId.has(c.next)) problems.push(`${at(s)}: choice "${c.en}" goes to ${c.next}, which doesn't exist`);
    for (const who of s.shot?.cast ?? []) if (!data.characters?.[who]) problems.push(`${at(s)}: cast member ${who} isn't in characters`);
    for (const l of s.lines ?? []) {
      const who = data.characters?.[l.speaker];
      if (!who) problems.push(`${at(s)}: speaker ${l.speaker} isn't in characters`);
      else if (!who.voice) problems.push(`${at(s)}: ${l.speaker} has no voice id`);
    }
    if (s.music && !data.music?.[s.music]) problems.push(`${at(s)}: music cue ${s.music} isn't in music`);
    if (!s.shot) problems.push(`${at(s)}: no shot (what the camera sees, for its generated media)`);
    if (!s.film && useOf(st, s) !== 'gen') problems.push(`${at(s)}: no filmed clip, so it must use "gen"`);
    // Words no page may say (The Water Road's bird is only ever seen).
    const said = [s.title, s.story, s.question, s.ending ?? [], ...s.choices.map((c) => [c.say, c.en])].flat().join(' ').toLowerCase();
    for (const w of data.unspoken ?? []) if (new RegExp(`\\b${w.toLowerCase()}`).test(said)) problems.push(`${at(s)}: its words say "${w}", which this story never says (unspoken)`);
  }
  if (!scenes.some((s) => s.ending)) warnings.push(`${id}: no ending yet (a scene with an "ending"): its card's badge can't say Completed until it has one`);
  validateInventory(st);
  // Every scene can be reached from the start.
  const seen = new Set([data.start]);
  const queue = [data.start];
  while (queue.length) for (const c of byId.get(queue.shift())?.choices ?? []) if (!seen.has(c.next) && byId.has(c.next)) seen.add(c.next), queue.push(c.next);
  for (const s of scenes) if (!seen.has(s.id)) problems.push(`${at(s)}: no choice leads here (unreachable)`);
}

/* ---------------- a story's inventory (js/kit.js) ---------------- */

const kit = globalThis.iltvKit;
const KIT_EMPTY = ['dead'];

/** The counts on the shortest way to each scene (what its branch page shows). */
function kitCounts(st) {
  const inv = st.data.inventory;
  if (!inv) return new Map();
  const scenes = Object.fromEntries(st.scenes.map((s) => [s.id, s]));
  const path = new Map([[st.data.start, [st.data.start]]]);
  const queue = [st.data.start];
  while (queue.length) {
    const id = queue.shift();
    for (const c of st.byId.get(id)?.choices ?? []) if (!path.has(c.next) && st.byId.has(c.next)) path.set(c.next, [...path.get(id), c.next]), queue.push(c.next);
  }
  return new Map([...path].map(([id, p]) => [id, kit.counts(inv, scenes, st.data.start, p)]));
}

function validateInventory(st) {
  const { id, data, scenes, byId } = st;
  const inv = data.inventory;
  if (!inv) {
    for (const s of scenes) if (s.inventory) problems.push(`${id}/${s.id}: changes the inventory, but ${id} has none (inventory.items)`);
    return;
  }
  const before = problems.length;
  const items = new Map((inv.items ?? []).map((item) => [item.id, item]));
  if (!items.size) problems.push(`${id}: inventory has no items`);
  for (const item of inv.items ?? []) {
    if (!item.id || !item.name) problems.push(`${id}: an inventory item needs an id and a name`);
    if (!kit.icons.includes(item.icon)) problems.push(`${id}: inventory item ${item.id} has icon "${item.icon}"; js/kit.js draws ${kit.icons.join(', ')}`);
    if (item.start != null && (!Number.isInteger(item.start) || item.start < 0)) problems.push(`${id}: inventory item ${item.id}'s start must be a whole number, 0 or more`);
    if (item.max != null && (!Number.isInteger(item.max) || item.max < (item.start ?? 0))) problems.push(`${id}: inventory item ${item.id}'s max must be a whole number, at least its start`);
    if (item.empty != null && !KIT_EMPTY.includes(item.empty)) problems.push(`${id}: inventory item ${item.id}'s empty must be "dead" (running out ends the run) or left out`);
  }
  for (const s of scenes) {
    for (const [k, v] of Object.entries(s.inventory ?? {})) {
      const item = items.get(k);
      if (!item) problems.push(`${id}/${s.id}: inventory changes ${k}, which isn't an item`);
      else if (item.start == null) problems.push(`${id}/${s.id}: inventory changes ${k}, which has no count (no start)`);
      else if (!Number.isInteger(v) && !(v && Number.isInteger(v.set) && v.set >= 0)) problems.push(`${id}/${s.id}: inventory.${k} must be a whole number (a change) or { "set": n }`);
    }
  }
  if (problems.length > before) return;
  // Every way through the story (a scene and the counts you have there): nothing goes below none, and an item
  // whose running out ends the run ("empty": "dead") only runs out on a death page.
  const all = Object.fromEntries(scenes.map((s) => [s.id, s]));
  const first = kit.apply(inv, kit.fresh(inv), all[data.start]).counts;
  const key = (sid, c) => sid + ' ' + JSON.stringify(c);
  const seen = new Set([key(data.start, first)]);
  const queue = [[data.start, first]];
  const told = new Set();
  const tell = (msg) => !told.has(msg) && (told.add(msg), problems.push(msg));
  while (queue.length && seen.size < 20000) {
    const [sid, counts] = queue.shift();
    for (const c of byId.get(sid).choices) {
      const next = all[c.next];
      const base = c.next === data.start ? kit.fresh(inv) : counts;
      const { counts: after, raw } = kit.apply(inv, base, next);
      for (const item of inv.items) {
        if (!(item.id in raw)) continue;
        if (raw[item.id] < 0 && !next.dead) tell(`${id}/${next.id}: ${item.name} goes below none (${raw[item.id]}) on the way from ${sid}; only a death page may empty it past zero`);
        if (item.empty === 'dead' && after[item.id] === 0 && !next.dead) tell(`${id}/${next.id}: ${item.name} runs out on the way from ${sid}, but running out ends the run and this isn't a death page`);
      }
      const k = key(c.next, after);
      if (!seen.has(k)) seen.add(k), queue.push([c.next, after]);
    }
  }
  if (seen.size >= 20000) warnings.push(`${id}: more than 20000 ways through the inventory; not all checked`);
}

function validateAll() {
  if (stories.filter((st) => st.root).length > 1) problems.push(`${LISTING}: only one story can have its pages at the site root ("/")`);
  const ids = new Set();
  for (const st of stories) {
    if (ids.has(st.id)) problems.push(`${LISTING}: ${st.id} is listed twice`);
    ids.add(st.id);
    if (RESERVED.has(st.id)) problems.push(`${st.id}: that name is taken at the site root (${[...RESERVED].join(', ')})`);
    validate(st);
  }
  if (!stories.some((st) => st.listed)) problems.push(`${LISTING}: no listed story (the landing page would be empty)`);
}

/* ---------------- media paths ---------------- */

const useOf = (st, s) => s.use ?? st.data.use ?? 'film';
const media = (st, s, file) => `${st.base}${s.folder}/media/${file}`;
const musicFile = (st, cue) => `${st.musicDir}/${cue}.mp3`;
const cutFile = (st, s) => `${st.base}${s.folder}/scene.mp4`;
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const titleOf = (st) => st.data.title;

/** The parts of a scene's generated cut, and whether they're all there. */
function cutParts(st, s) {
  const talks = (s.lines ?? []).map((l, i) => ({ video: media(st, s, `talk-${i + 1}.mp4`), audio: media(st, s, `line-${i + 1}.mp3`) }));
  let music = s.music ? musicFile(st, s.music) : null;
  // A draft's scene isn't held back by a music cue that isn't made yet: it's cut without it, and cut again once it is.
  const later = music && !st.listed && !exists(music) ? music : null;
  if (later) music = null;
  const parts = { clip: media(st, s, 'clip.mp4'), narration: media(st, s, 'narration.mp3'), talks, music, later };
  const need = [parts.clip, parts.narration, ...talks.flatMap((t) => [t.video, t.audio]), ...(parts.music ? [parts.music] : [])];
  return { ...parts, missing: need.filter((f) => !exists(f)), all: need };
}

/** What the player and the page play: the generated cut when the scene uses it and it's made, else the film. */
function videoOf(st, s) {
  if (useOf(st, s) === 'gen') {
    const { missing } = cutParts(st, s);
    if (!missing.length) return '/' + cutFile(st, s);
    const why = `${st.id}/${s.id}: uses "gen" but ${missing.length} media file(s) aren't made yet (${missing[0]}…)`;
    if (s.film) warnings.push(`${why}; playing the film`);
    // A story off the landing page can be drafted before its media exists: its pages show no video until then.
    else if (!st.listed) warnings.push(`${st.id}: a draft (not on the landing page) whose media isn't made yet: its scenes show no video until it is`);
    else problems.push(`${st.id}/${s.id}: uses "gen", has no film, and its media isn't made yet`);
  }
  return s.film ?? null;
}

/* ---------------- js/story-data.js ---------------- */

function storyData() {
  const list = stories.map((st) => {
    const out = {};
    for (const s of st.scenes) {
      out[s.id] = {
        folder: st.base + s.folder,
        lang: s.lang,
        dir: s.dir ?? '',
        title: s.title,
        story: s.story,
        question: s.question,
        video: videoOf(st, s),
        ...(s.dead ? { dead: true } : {}),
        ...(s.ending ? { ending: s.ending } : {}),
        ...(s.inventory ? { inventory: s.inventory } : {}),
        choices: s.choices.map((c) => [c.say, c.en, c.next]),
      };
    }
    const langs = new Set(['en', ...st.scenes.map((s) => s.lang)]);
    return {
      id: st.id,
      title: titleOf(st),
      tagline: st.data.tagline ?? '',
      logline: st.entry.logline,
      image: st.entry.image ?? null,
      listed: st.listed,
      cookie: st.data.cookie,
      tap: st.data.tap ?? { title: titleOf(st).toUpperCase(), line: '' },
      start: st.data.start,
      ui: Object.fromEntries(Object.entries(st.data.ui).filter(([lang]) => langs.has(lang))),
      ...(st.data.inventory ? { inventory: st.data.inventory } : {}),
      ...(st.data.unspoken ? { unspoken: st.data.unspoken } : {}),
      scenes: out,
    };
  });
  return (
    `// Generated by tools/build-story.mjs from ${LISTING} and the story files. Do not edit: change the data and run \`npm run story\`.\n` +
    `window.ILTV_STORIES = ${JSON.stringify({ stories: list }, null, 1)};\n`
  );
}

/* ---------------- the landing page's cards (index.html) ---------------- */

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

function card(st) {
  const first = videoOf(st, st.byId.get(st.data.start));
  const picture = st.entry.image
    ? `<img src="${esc(st.entry.image)}" alt="${esc(st.entry.alt ?? titleOf(st))}">`
    : first
      ? `<video src="${esc(first)}#t=0.5" muted playsinline preload="metadata" aria-hidden="true"></video>`
      : `<span class="story-card-blank" aria-hidden="true"></span>`;
  // The badge, the percent explored and the button are the player's own progress: js/game.js sets them from the
  // story's cookies (its run and its unlocks).
  return `      <a class="story-card" href="/?story=${st.id}" data-story="${st.id}" data-progress="new">
        ${picture}
        <span class="story-card-ribbon">Not started</span>
        <div class="story-card-text">
          <h2>${esc(titleOf(st))}</h2>
          <p>${esc(st.entry.logline)}</p>
          <div class="story-card-foot">
            <span class="story-card-go">Play</span>
            <span class="story-card-explored">0% explored</span>
          </div>
        </div>
      </a>`;
}

const CARDS_START = '<!-- stories: generated by tools/build-story.mjs from story/stories.json. Do not edit: change the data and run `npm run story`. -->';
const CARDS_END = '<!-- /stories -->';

function landing() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const a = html.indexOf(CARDS_START);
  const b = html.indexOf(CARDS_END);
  if (a < 0 || b < a) {
    problems.push(`index.html: the story cards' markers are missing (${CARDS_START} … ${CARDS_END})`);
    return html;
  }
  const cards = stories.filter((st) => st.listed).map(card).join('\n');
  return html.slice(0, a + CARDS_START.length) + '\n' + cards + '\n      ' + html.slice(b);
}

/* ---------------- a story's own link: /<id>/ opens its player ---------------- */

function storyLink(st) {
  const to = `/?story=${st.id}`;
  return `<!DOCTYPE html>
<!-- Generated by tools/build-story.mjs from ${LISTING} (story "${st.id}"). Do not edit: change the data and run \`npm run story\`. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titleOf(st))} · Imagine Live TV</title>
  <meta name="description" content="${esc(st.entry.logline)}">
  <link rel="canonical" href="https://imaginelivetv.com${to}">
  <meta http-equiv="refresh" content="0; url=${to}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/site.css">
  <meta name="theme-color" content="#070807">
  <script>location.replace(${JSON.stringify(to)});</script>
</head>
<body>
  <header class="site-header">
    <a href="/">Imagine Live TV</a>
  </header>
  <main class="missing">
    <h1>${esc(titleOf(st))}</h1>
    <p><a href="${to}">Play</a></p>
  </main>
  <footer class="site-footer">
    <p>Copyright © 2026 Imagine Live TV - All Rights Reserved.</p>
    <p class="powered">Powered by <a class="powered-mark" href="https://hawkesgen.com">HAWKES GEN</a></p>
    <p class="stats-note">Anonymous viewing statistics (no cookies, no personal data, no IP stored) help us improve the stories. <a href="/privacy.html">Privacy</a></p>
  </footer>
</body>
</html>
`;
}

/* ---------------- branch pages ---------------- */

const spot = (s, [say, en], tag = 'span', attrs = '') => {
  const dir = s.dir ? ` dir="${s.dir}"` : '';
  const src = esc(say).replace(/\n/g, '<br>');
  const eng = esc(en).replace(/\n/g, '<br>');
  return `<${tag} class="${attrs ? attrs + ' ' : ''}spot"><span class="spot-src" lang="${s.lang}"${dir}>${src}</span><span class="spot-en" aria-hidden="true">${eng}</span></${tag}>`;
};

function page(st, s, counts) {
  const tap = st.data.tap ?? {};
  const inv = st.data.inventory;
  const choices = s.choices
    .map((c) => {
      const to = st.byId.get(c.next);
      return `<a class="choice spot" href="/${st.base}${to.folder}/"><span class="spot-src" lang="${s.lang}"${s.dir ? ` dir="${s.dir}"` : ''}>${esc(c.say)}</span><span class="spot-en" aria-hidden="true">${esc(c.en)}</span></a>`;
    })
    .join('');
  const video = videoOf(st, s);
  return `<!DOCTYPE html>
<!-- Generated by tools/build-story.mjs from ${st.file} (scene "${s.id}"). Do not edit: change the data and run \`npm run story\`. -->
<html lang="${s.lang}"${tap.title ? ` data-tap-title="${esc(tap.title)}"` : ''}${tap.line ? ` data-tap-line="${esc(tap.line)}"` : ''}${inv ? ` data-kit="${st.id}"` : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(s.title[0])}</title>
  <meta name="description" content="${esc(s.story[0].replace(/\s+/g, ' '))}">
  <link rel="canonical" href="https://imaginelivetv.com/${st.base}${s.folder}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/site.css">
  <meta name="theme-color" content="#070807">
</head>
<body>
  <header class="site-header">
    <a href="/">Imagine Live TV</a>
  </header>

  <main class="passage" data-story="${st.id}" data-node="${s.folder}"${s.dead ? ' data-state="dead"' : s.ending ? ' data-state="soon"' : ''}>
    ${spot(s, s.title, 'h1')}
    ${video ? `<video src="${esc(video)}" controls playsinline preload="auto" data-sound-start></video>` : `<div class="passage-blank" aria-hidden="true"><span>${esc(s.title[1])}</span></div>`}
    ${spot(s, s.story, 'p', 'passage-note')}
    ${s.question[1] ? spot(s, s.question, 'p', 'passage-prompt') : ''}
    ${choices ? `<div class="spark-choices">${choices}</div>` : ''}${s.ending ? `\n    ${spot(s, s.ending, 'p', 'passage-prompt')}` : ''}
  </main>

  <footer class="site-footer">
    <p>Copyright © 2026 Imagine Live TV - All Rights Reserved.</p>
    <p class="powered">Powered by <a class="powered-mark" href="https://hawkesgen.com">HAWKES GEN</a></p>
    <p class="stats-note">Anonymous viewing statistics (no cookies, no personal data, no IP stored) help us improve the stories. <a href="/privacy.html">Privacy</a></p>
  </footer>
${inv ? `  <div class="inventory kit" data-kit="${esc(JSON.stringify({ inventory: inv, counts }))}"></div>
` : ''}  <script src="/js/hawkes-build.js"></script>
  <script src="/js/hawkes-analytics.js" data-product="imaginelivetv"></script>
  <script src="/js/analytics.js"></script>
  <script src="/js/hawkes-sound.js"></script>
  <script src="/js/${inv ? 'kit' : 'spot'}.js"></script>
</body>
</html>
`;
}

/* ---------------- hawkes.assets.json ---------------- */

const words = (t) => String(t).split(/\s+/).filter(Boolean).length;
const flat = (t) => String(t).replace(/\n+•?\s*/g, ' ').replace(/\s+/g, ' ').trim();

// image.generate (Z-Image Turbo) has no negative prompt: what matters of the story's `negative` goes into the prompt
// as its `avoid` line (e.g. "a modern 3D game render, not a photograph"). image.edit and video.i2v keep `negative`.
const positive = (story, prompt) => (story.avoid ? `${prompt} ${story.avoid}` : prompt);

function castRefs(st, cast) {
  return cast.map((who, i) => `image ${i + 1} is the reference sheet for ${who === 'hero' ? 'the hero' : st.data.characters[who].name.toLowerCase()} (${st.data.characters[who].look})`).join('; ');
}

function assets(st) {
  const story = st.data;
  const scenes = st.scenes;
  const P = st.prefix;
  const of = st.root ? '' : ` (${titleOf(st)})`;
  const list = [];
  const used = new Set(scenes.map((s) => s.shot?.cast ?? []).flat().concat(scenes.flatMap((s) => (s.lines ?? []).map((l) => l.speaker))));

  // One reference sheet per character, from a frame of J's filmed clips (or, with no film, from its look alone),
  // so every shot keeps the same faces.
  for (const [id, c] of Object.entries(story.characters ?? {})) {
    if (!used.has(id)) continue;
    const prompt = `Character reference sheet of this exact individual: ${c.look}. Full-body front view, three-quarter view, side view and back view, plus a close-up of the face, side by side on a plain mid-grey background. Same proportions and clothes in every view. ${story.style}`;
    list.push({
      id: `${P}char-${id}`,
      note: c.seed ? `Reference sheet for ${c.name}${of}, from a frame of the filmed clips (${c.seed}).` : `Reference sheet for ${c.name}${of}, from the description alone (no filmed clip).`,
      ...(c.seed ? { inputs: [c.seed] } : {}),
      steps: [
        c.seed
          ? { tool: 'image.edit', params: { prompt, negative: story.negative, width: 1536, height: 1024 }, inputs: { images: ['$input:0'] }, save: 'sheet' }
          : { tool: 'image.generate', params: { prompt: positive(story, prompt), width: 1536, height: 1024 }, save: 'sheet' },
      ],
      candidates: 3,
      pick: c.seed ? 'the same individual as the reference photo; every view consistent; clean grey background; no text' : `matches the description (${c.look}); every view consistent; clean grey background; no text`,
      files: { sheet: c.sheet },
    });
  }

  // One music cue per mood, shared by the scenes that use it.
  for (const cue of [...new Set(scenes.map((s) => s.music).filter(Boolean))]) {
    list.push({
      id: `${P}music-${cue}`,
      note: `Music for the ${cue} scenes${of} (${scenes.filter((s) => s.music === cue).map((s) => s.id).join(', ')}).`,
      steps: [{ tool: 'audio.music', params: { prompt: story.music[cue], lyrics: '[Instrumental]', seconds: 60, bpm: 70 }, save: 'music' }],
      files: { music: musicFile(st, cue) },
    });
  }

  for (const s of scenes) {
    const cast = (s.shot?.cast ?? []).slice(0, 3);
    const still = `A vertical 9:16 film still: ${s.shot.scene}.`;
    // The keyframe (image.edit from the cast's sheets, or image.generate with nobody in it; best of 3) and its clip (video.i2v).
    list.push({
      id: `${P}${s.id}-shot`,
      note: `${s.title[1]}${of}: keyframe and clip.`,
      ...(cast.length ? { inputs: cast.map((who) => story.characters[who].sheet) } : {}),
      steps: [
        cast.length
          ? {
              tool: 'image.edit',
              params: { prompt: `${still} ${castRefs(st, cast)}; keep their faces, bodies and clothes exactly. ${story.style}`, negative: story.negative, width: 720, height: 1280 },
              inputs: { images: cast.map((_, i) => `$input:${i}`) },
              save: 'keyframe',
            }
          : { tool: 'image.generate', params: { prompt: positive(story, `${still} ${story.style}`), width: 720, height: 1280 }, save: 'keyframe' },
        {
          tool: 'video.i2v',
          params: { prompt: `${s.shot.motion}. ${story.camera ?? 'Slow, tense handheld camera'}. ${story.style}`, negative: story.negative, width: 544, height: 960, frames: 81, fps: 16 },
          inputs: { start: '$prev' },
          save: 'clip',
        },
      ],
      candidates: 3,
      pick: `matches the scene (${s.shot.scene}); the characters match their reference sheets; reads clearly as a vertical frame; no text`,
      files: { keyframe: media(st, s, 'keyframe.png'), clip: media(st, s, 'clip.mp4') },
    });

    // Narration: the story and the question, spoken in the scene's language.
    list.push({
      id: `${P}${s.id}-voice`,
      note: `${s.title[1]}${of}: narration in ${s.lang}.`,
      steps: [{ tool: 'audio.voice', params: { text: `${flat(s.story[0])} ${flat(s.question[0])}`, voice: story.narrator.voice, model: story.narrator.model }, save: 'narration' }],
      files: { narration: media(st, s, 'narration.mp3') },
    });

    // Talking shots: a close-up of the speaker (image.edit), the line (audio.voice), lips and head to it (video.talk).
    (s.lines ?? []).forEach((l, i) => {
      const who = story.characters[l.speaker];
      const seconds = words(l.text) / 2.5 + 1;
      list.push({
        id: `${P}${s.id}-talk-${i + 1}`,
        note: `${s.title[1]}${of}: ${who.name} says "${l.text}"${l.draft ? ' (DRAFT line: J to approve)' : ''}. video.talk is experimental.`,
        inputs: [who.sheet, media(st, s, 'keyframe.png')],
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
        files: { [`portrait-${i + 1}`]: media(st, s, `portrait-${i + 1}.png`), [`line-${i + 1}`]: media(st, s, `line-${i + 1}.mp3`), [`talk-${i + 1}`]: media(st, s, `talk-${i + 1}.mp4`) },
      });
    });
  }
  return list;
}

function assetsFile() {
  const list = stories.flatMap(assets);
  const ids = new Set();
  for (const a of list) {
    if (ids.has(a.id)) problems.push(`hawkes.assets.json: asset id ${a.id} comes from two stories`);
    ids.add(a.id);
  }
  return JSON.stringify({ $comment: `Generated by tools/build-story.mjs from ${LISTING} and the story files. Do not edit: change the data and run \`npm run story\`.`, project: 'imaginelivetv', assets: list }, null, 2) + '\n';
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
function cut(st, s) {
  const p = cutParts(st, s);
  if (p.missing.length) return;
  if (p.later) warnings.push(`${st.id}/${s.id}: cut without its music (${p.later} isn't made yet)`);
  const out = path.join(ROOT, cutFile(st, s));
  const newest = Math.max(...p.all.map((f) => fs.statSync(path.join(ROOT, f)).mtimeMs), fs.statSync(path.join(ROOT, st.file)).mtimeMs);
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= newest) return;
  if (CHECK) return problems.push(`${cutFile(st, s)} is out of date`);

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
    console.log(`cut      ${cutFile(st, s)} (${total.toFixed(1)} s)`);
  } catch (e) {
    warnings.push(`${st.id}/${s.id}: ffmpeg failed to cut ${cutFile(st, s)} (${e.message.split('\n')[0]})`);
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

/** Folders (at the root, and inside each story's own folder) with a generated page nothing owns any more. */
function strays() {
  const owned = new Set(stories.flatMap((st) => [st.id, ...st.scenes.map((s) => st.base + s.folder)]));
  const dirs = ['', ...stories.filter((st) => !st.root).map((st) => st.base)];
  for (const dir of dirs) {
    if (!fs.existsSync(path.join(ROOT, dir))) continue;
    for (const d of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir + d.name;
      if (!d.isDirectory() || owned.has(rel)) continue;
      const f = path.join(ROOT, rel, 'index.html');
      if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('Generated by tools/build-story.mjs')) warnings.push(`${rel}/ is a generated page no scene or story owns any more (delete it)`);
    }
  }
}

validateAll();
if (!problems.length) {
  for (const st of stories) for (const s of st.scenes) if (useOf(st, s) === 'gen') cut(st, s);
  const assetsText = assetsFile();
  write('js/story-data.js', storyData());
  write('index.html', landing());
  for (const st of stories) {
    write(`${st.id}/index.html`, storyLink(st));
    const counts = kitCounts(st);
    for (const s of st.scenes) write(`${st.base}${s.folder}/index.html`, page(st, s, counts.get(s.id)));
  }
  if (!problems.length) write('hawkes.assets.json', assetsText);
  strays();
}

const sceneCount = stories.reduce((n, st) => n + st.scenes.length, 0);
// A scene's media is looked up for the player, its card and its page: say each thing once.
for (const w of new Set(warnings)) console.warn(`warning  ${w}`);
for (const p of new Set(problems)) console.error(`problem  ${p}`);
if (CHECK) {
  for (const c of changed) console.error(`stale    ${c}`);
  if (problems.length || changed.length) process.exit(1);
  console.log(`ok       ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}, ${sceneCount} scenes, everything generated is up to date`);
} else {
  if (problems.length) process.exit(1);
  for (const c of changed) console.log(`wrote    ${c}`);
  for (const st of stories) {
    const gen = st.scenes.filter((s) => useOf(st, s) === 'gen').length;
    console.log(`${st.id}: ${st.scenes.length} scenes (${gen} on generated media)${st.listed ? '' : ', not on the landing page'}`);
  }
  console.log(`${changed.length} file(s) changed`);
}
