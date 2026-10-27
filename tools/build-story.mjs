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
// A console story's state rules (flags, meters, conditions, the state explorer): the same code the player runs.
import '../js/console-rules.js';

// ILTV_ROOT: build another folder's stories with this script (tools/test-console.mjs builds broken copies).
const ROOT = process.env.ILTV_ROOT ? path.resolve(process.env.ILTV_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
    console: data.type === 'console',
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
  if (st.console) return validateConsole(st);
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
  if (st.console) return null;
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
    if (st.console) return consoleData(st);
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
  <main class="story-link">${st.entry.image ? `
    <img src="${esc(st.entry.image)}" alt="${esc(st.entry.alt ?? titleOf(st))}">` : ''}
    <h1>${esc(titleOf(st))}</h1>
    <p>${esc(st.entry.logline)}</p>
    <p><a class="story-link-go" href="${to}">Play</a></p>
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
  if (st.console) return consolePage(st, s);
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
  if (st.console) return consoleAssets(st);
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

/* ---------------- console stories (story type "console": story/README.md, "Console stories") ---------------- */

const rules = globalThis.iltvConsoleRules;
const CAMERA_MIN = 6;
const CAMERA_MAX = 9;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CHOICE_KEYS = ['say', 'next', 'requires', 'forbids', 'meters', 'set', 'clear', 'add', 'log', 'cosmetic'];

/** A choice as the player's data has it: [say, say, next, extra] (extra left out when empty). */
function consoleChoice(c) {
  const extra = {};
  for (const k of ['requires', 'forbids', 'meters', 'set', 'clear', 'add', 'log', 'cosmetic']) if (c[k] != null && !(Array.isArray(c[k]) && !c[k].length)) extra[k] = c[k];
  return Object.keys(extra).length ? [c.say, c.say, c.next, extra] : [c.say, c.say, c.next];
}

/** The story the rules run on (js/console-rules.js): the same shape the player gets. */
function consoleShape(st) {
  return {
    start: st.data.start,
    state: st.data.state ?? {},
    cameras: st.data.cameras ?? [],
    scenes: Object.fromEntries(st.scenes.map((s) => [s.id, { ending: s.ending ? [s.ending, s.ending] : undefined, feeds: s.feeds, choices: (s.choices ?? []).map(consoleChoice) }])),
  };
}

const sayOf = (state) => [...Object.keys(state.flags).sort(), ...Object.entries(state.meters).map(([k, v]) => `${k} ${v}`)].join(', ') || 'a fresh state';

function validateConsole(st) {
  const { id, data, scenes, byId } = st;
  const at = (s) => `${id}/${s.id}`;
  const flags = new Set(data.state?.flags ?? []);
  const meters = data.state?.meters ?? {};
  const cameras = data.cameras ?? [];
  const cams = new Map(cameras.map((c) => [c.id, c]));
  if (!data.tap?.title) problems.push(`${id}: tap.title (the Tap to play screen's title) is missing`);
  if ((data.state?.flags ?? []).length !== flags.size) problems.push(`${id}: state.flags lists a flag twice`);
  for (const [name, m] of Object.entries(meters)) {
    if (![m.min, m.max, m.start].every(Number.isInteger) || m.min > m.start || m.start > m.max) problems.push(`${id}: meter ${name} needs whole numbers min <= start <= max`);
  }
  if (cameras.length < CAMERA_MIN || cameras.length > CAMERA_MAX) problems.push(`${id}: the monitor wall needs ${CAMERA_MIN} to ${CAMERA_MAX} cameras, has ${cameras.length}`);
  if (cams.size !== cameras.length) problems.push(`${id}: a camera id is used twice`);
  for (const c of cameras) {
    if (!ID.test(c.id || '') || !c.name) problems.push(`${id}: every camera needs an id (lower-case-with-dashes) and a name`);
    if (!c.states?.normal) problems.push(`${id}: camera ${c.id} has no "normal" state (its default picture)`);
  }
  if (!byId.has(data.start)) problems.push(`${id}: start scene ${data.start} doesn't exist`);
  const noVoice = new Set();
  const folders = new Set();
  const read = new Set();
  const wrote = new Set();
  for (const s of scenes) {
    if (byId.get(s.id) !== s) problems.push(`${id}: duplicate scene id ${s.id}`);
    if (!s.folder || !ID.test(s.folder)) problems.push(`${at(s)}: folder must be lower-case-with-dashes`);
    if (folders.has(s.folder)) problems.push(`${at(s)}: folder ${s.folder} is used twice`);
    folders.add(s.folder);
    if (typeof s.title !== 'string' || !s.title) problems.push(`${at(s)}: title must be a string`);
    if (!TIME.test(s.time ?? '')) problems.push(`${at(s)}: time must be HH:MM (the shift log's timestamp)`);
    if (s.ambience && !data.ambience?.[s.ambience]) problems.push(`${at(s)}: ambience ${s.ambience} isn't in ambience`);
    if (s.music && !data.music?.[s.music]) problems.push(`${at(s)}: music cue ${s.music} isn't in music`);
    for (const [cam, state] of Object.entries(s.feeds ?? {})) {
      if (!cams.has(cam)) problems.push(`${at(s)}: feeds names camera ${cam}, which isn't in cameras`);
      else if (!cams.get(cam).states?.[state]) problems.push(`${at(s)}: camera ${cam} has no state "${state}"`);
    }
    if (s.focus && !cams.has(s.focus)) problems.push(`${at(s)}: focus ${s.focus} isn't a camera`);
    if (s.place != null && !ROOM_PLACES.includes(s.place)) problems.push(`${at(s)}: place ${s.place} isn't one of ${ROOM_PLACES.join(', ')}`);
    for (const key of ['cast', 'away']) {
      if (s[key] == null) continue;
      const who = Array.isArray(s[key]) ? s[key].map((w) => String(w).split('@')[0]) : [];
      if (!Array.isArray(s[key]) || !s[key].length || s[key].some((w) => !ROOM_ACTORS.includes(String(w).split('@')[0]) || (String(w).includes('@') && !['left', 'right'].includes(String(w).split('@')[1]))) || new Set(who).size !== who.length) problems.push(`${at(s)}: ${key} is a list of people (${ROOM_ACTORS.join(', ')}), each once, optionally standing at left or right ("dee@right")`);
    }
    if (!Array.isArray(s.lines) || !s.lines.length) problems.push(`${at(s)}: no lines (a scene is heard: at least one voiced line)`);
    for (const l of s.lines ?? []) {
      const who = data.speakers?.[l.speaker];
      if (!who) problems.push(`${at(s)}: speaker ${l.speaker} isn't in speakers`);
      else if (!who.voice) noVoice.add(l.speaker);
      if (!l.text) problems.push(`${at(s)}: a line of ${l.speaker} has no text`);
      if (l.sfx && !data.sfx?.[l.sfx]) problems.push(`${at(s)}: sfx cue ${l.sfx} isn't in sfx`);
      if (l.place != null && !ROOM_PLACES.includes(l.place)) problems.push(`${at(s)}: a line's place ${l.place} isn't one of ${ROOM_PLACES.join(', ')}`);
      for (const cam of l.feed == null ? [] : Array.isArray(l.feed) ? l.feed : [l.feed]) if (!cams.has(cam)) problems.push(`${at(s)}: a line's feed ${cam} isn't a camera`);
      let lastAt = 0;
      for (const entry of l.act == null ? [] : Array.isArray(l.act) ? l.act : [l.act]) {
        // an act is "who:verb[:where]" (as the line starts) or a beat { act, at }: at is the fraction (0 to 1) of the line's own dur
        const a = typeof entry === 'string' ? entry : entry?.act;
        if (typeof entry !== 'string') {
          if (typeof a !== 'string' || typeof entry.at !== 'number' || !(entry.at >= 0 && entry.at <= 1) || Object.keys(entry).some((k) => !['act', 'at'].includes(k))) { problems.push(`${at(s)}: a beat is { "act": "who:verb", "at": 0 to 1 } (got ${JSON.stringify(entry)})`); continue; }
          if (entry.at < lastAt) problems.push(`${at(s)}: beat "${a}" at ${entry.at} comes before the one before it (beats are in order of \`at\`)`);
          lastAt = Math.max(lastAt, entry.at);
        }
        const [who, verb, where] = String(a).split(':');
        if (!(who === 'room' ? ROOM_OBJECT_VERBS : ROOM_VERBS).includes(verb) || (who !== 'room' && !ROOM_ACTORS.includes(who)) || (where != null && !(verb === 'enter' ? ['left', 'right'].includes(where) : ['point', 'touch', 'press'].includes(verb)))) problems.push(`${at(s)}: act "${a}" isn't who:verb (people ${ROOM_ACTORS.join(', ')}, or room; verbs ${ROOM_VERBS.join(', ')}; room: ${ROOM_OBJECT_VERBS.join(', ')}; enter takes left or right, point, touch and press a target)`);
      }
    }
    if (s.log != null && typeof s.log !== 'string') problems.push(`${at(s)}: log must be a string`);
    if (!s.log) warnings.push(`${at(s)}: no log line (the shift log shows a blank for it)`);
    if (s.ending && (typeof s.ending !== 'string' || (s.choices ?? []).length)) problems.push(`${at(s)}: an ending is a string and has no choices`);
    if (!s.ending && !(s.choices ?? []).length) problems.push(`${at(s)}: no choices and no ending (a dead end)`);
    for (const c of s.choices ?? []) {
      for (const k of Object.keys(c)) if (!CHOICE_KEYS.includes(k)) problems.push(`${at(s)}: choice "${c.say}" has an unknown field ${k}`);
      if (!c.say) problems.push(`${at(s)}: a choice has no words`);
      if (!byId.has(c.next)) problems.push(`${at(s)}: choice "${c.say}" goes to ${c.next}, which doesn't exist`);
      for (const k of ['requires', 'forbids']) for (const f of c[k] ?? []) (flags.has(f) ? read.add(f) : problems.push(`${at(s)}: choice "${c.say}" ${k} ${f}, which isn't in state.flags`));
      for (const k of ['set', 'clear']) for (const f of c[k] ?? []) (flags.has(f) ? (k === 'set' && wrote.add(f)) : problems.push(`${at(s)}: choice "${c.say}" ${k}s ${f}, which isn't in state.flags`));
      for (const m of Object.keys(c.meters ?? {})) (meters[m] ? read.add(m) : problems.push(`${at(s)}: choice "${c.say}" tests meter ${m}, which isn't in state.meters`));
      for (const [m, n] of Object.entries(c.add ?? {})) {
        if (!meters[m]) problems.push(`${at(s)}: choice "${c.say}" adds to meter ${m}, which isn't in state.meters`);
        else if (!Number.isInteger(n) || !n) problems.push(`${at(s)}: choice "${c.say}" adds ${n} to ${m}: a whole number, not 0`);
      }
      if (c.cosmetic != null && (typeof c.cosmetic !== 'string' || !c.cosmetic)) problems.push(`${at(s)}: choice "${c.say}" is cosmetic: say why, as a string`);
    }
    const said = [s.title, s.ending ?? '', ...(s.lines ?? []).map((l) => l.text), ...(s.choices ?? []).map((c) => c.say)].join(' ').toLowerCase();
    for (const w of data.unspoken ?? []) if (new RegExp(`\\b${w.toLowerCase()}`).test(said)) problems.push(`${at(s)}: its words say "${w}", which this story never says (unspoken)`);
  }
  for (const who of data.placeholder ? [] : noVoice) warnings.push(`${id}: ${who} has no voice id yet, so its lines have no voice recipe (the player reads them on a timer until they're made)`);
  if (!scenes.some((s) => s.ending)) warnings.push(`${id}: no ending yet (a scene with an "ending"): its card's badge can't say Completed until it has one`);
  for (const f of flags) {
    if (read.has(f) && !wrote.has(f)) problems.push(`${id}: flag ${f} is read by a choice but nothing sets it`);
    else if (!read.has(f) && !data.placeholder) warnings.push(`${id}: flag ${f} is set but no choice reads it`);
  }
  if (problems.some((p) => p.startsWith(`${id}`))) return;

  // Every state the story can be in (the same explorer the playtest walks).
  const shape = consoleShape(st);
  const cap = data.stateCap ?? 50000;
  const x = (st.explored = rules.explore(shape, { cap, maxCosmetic: 2 }));
  const where = (path) => path.join(' > ');
  if (x.capped) warnings.push(`${id}: more than ${cap} states; the state check stopped early, so unreachable scenes and unusable choices below may be missed`);
  for (const s of scenes) if (!x.scenes[s.id] && !x.capped) problems.push(`${at(s)}: no way of playing reaches this scene (no usable choice leads here under any state)`);
  for (const bad of x.stuck) problems.push(`${id}/${bad.scene}: no usable choice when you hold ${sayOf(bad.state)} (via ${where(bad.path)}); every state of a scene that isn't an ending needs a choice`);
  for (const s of scenes) {
    (s.choices ?? []).forEach((c, i) => {
      const used = x.used[`${s.id}#${i}`];
      if (!used) return void (x.capped || problems.push(`${at(s)}: choice "${c.say}" can never be made: its conditions fail in every state that reaches the scene`));
      if (!c.cosmetic && !used.changes && !used.branch && !c.log) problems.push(`${at(s)}: choice "${c.say}" has no visible effect: it sets or changes nothing, adds no log line and leads where another choice here leads (give it an effect, or mark it "cosmetic" with a reason)`);
    });
  }
  for (const c of x.cosmetic) problems.push(`${id}/${c.scene}: more than 2 cosmetic choices on one run (${where(c.path)})`);
}

/** The control room of a console story (js/console-room.js): where scenes can be, who can be in them, what they can do. */
const ROOM_PLACES = ['room', 'room-day', 'lobby', 'vestibule', 'dock', 'stairwell', 'corridor', 'roof'];
const ROOM_ACTORS = ['you', 'dee', 'okafor', 'terrell', 'marisol', 'dev', 'adler', 'brandt', 'courier', 'sleeper', 'pierce'];
const ROOM_VERBS = ['sit', 'stand', 'point', 'touch', 'write', 'phone', 'hangup', 'spill', 'angry', 'knock', 'count', 'lean', 'hand', 'drink', 'eat', 'press', 'read', 'enter', 'leave', 'gone', 'charger', 'rest'];
const ROOM_OBJECT_VERBS = ['ring', 'buzz', 'door', 'flicker'];

/** Where a console story's made media would be, and whether it is. */
const consoleFiles = (st) => ({
  line: (s, i) => `${st.base}${s.folder}/media/line-${i + 1}.mp3`,
  bed: (cue) => `${st.base}media/ambience/${cue}.mp3`,
  sfx: (cue) => `${st.base}media/sfx/${cue}.mp3`,
  music: (cue) => `${st.base}media/music/${cue}.mp3`,
  feed: (cam, state) => `${st.base}media/feeds/${cam}-${state}.png`,
  endcard: (scene) => `${st.base}media/endcards/${scene}.png`,
});
const urlIfMade = (rel) => (exists(rel) ? '/' + rel : null);

function consoleData(st) {
  const d = st.data;
  const f = consoleFiles(st);
  const scenes = {};
  for (const s of st.scenes) {
    scenes[s.id] = {
      folder: st.base + s.folder,
      lang: 'en',
      dir: '',
      time: s.time,
      ...(s.ending ? { endcard: urlIfMade(f.endcard(s.id)) } : {}),
      title: [s.title, s.title],
      ...(s.ambience ? { ambience: s.ambience } : {}),
      ...(s.music ? { music: s.music } : {}),
      ...(s.feeds ? { feeds: s.feeds } : {}),
      ...(s.focus ? { focus: s.focus } : {}),
      ...(s.place ? { place: s.place } : {}),
      ...(s.cast ? { cast: s.cast } : {}),
      ...(s.away ? { away: s.away } : {}),
      lines: s.lines.map((l, i) => ({
        speaker: l.speaker,
        text: l.text,
        ...(l.sfx ? { sfx: l.sfx } : {}),
        ...(l.act ? { act: l.act } : {}),
        ...(l.place ? { place: l.place } : {}),
        ...(l.feed ? { feed: l.feed } : {}),
        file: l.file ?? urlIfMade(f.line(s, i)),
        dur: l.dur ?? Math.round((words(l.text) / 2.5 + 1) * 10) / 10,
      })),
      log: s.log ?? '',
      ...(s.ending ? { ending: [s.ending, s.ending] } : {}),
      choices: s.choices.map(consoleChoice),
    };
  }
  return {
    id: st.id,
    type: 'console',
    title: titleOf(st),
    tagline: d.tagline ?? '',
    logline: st.entry.logline,
    image: st.entry.image ?? null,
    listed: st.listed,
    cookie: d.cookie,
    tap: d.tap,
    start: d.start,
    ui: { en: { mouth: 'Start', depth: 'Step' } },
    state: d.state ?? { flags: [], meters: {} },
    cameras: d.cameras.map((c) => ({
      id: c.id,
      name: c.name,
      states: Object.fromEntries(Object.entries(c.states).map(([state, desc]) => [state, { desc, image: urlIfMade(f.feed(c.id, state)) }])),
    })),
    speakers: Object.fromEntries(Object.entries(d.speakers ?? {}).map(([k, v]) => [k, { name: v.name }])),
    ambience: Object.fromEntries(Object.keys(d.ambience ?? {}).map((cue) => [cue, urlIfMade(f.bed(cue))])),
    sfx: Object.fromEntries(Object.keys(d.sfx ?? {}).map((cue) => [cue, urlIfMade(f.sfx(cue))])),
    music: Object.fromEntries(Object.keys(d.music ?? {}).map((cue) => [cue, urlIfMade(f.music(cue))])),
    ...(d.unspoken ? { unspoken: d.unspoken } : {}),
    ...(d.stateCap ? { stateCap: d.stateCap } : {}),
    scenes,
  };
}

/** A console scene's branch page: its wall, its words, its log line, the state on the shortest way here (marked), and
    each choice (a link when the choice is open in that state, shown locked with what it needs when it isn't). */
function consolePage(st, s) {
  const d = st.data;
  const tap = d.tap ?? {};
  const canon = st.explored?.scenes[s.id];
  const state = canon?.state ?? rules.fresh(consoleShape(st));
  const feeds = rules.feedsOf(consoleShape(st), s);
  const data = consoleData(st);
  const ds = data.scenes[s.id];
  const needs = (c) => [...(c.requires ?? []).map((f) => `${f} set`), ...(c.forbids ?? []).map((f) => `${f} not set`), ...Object.entries(c.meters ?? {}).map(([m, r]) => `${m} ${r.min != null ? `at least ${r.min}` : ''}${r.min != null && r.max != null ? ', ' : ''}${r.max != null ? `at most ${r.max}` : ''}`)];
  const tiles = d.cameras
    .map((cam, i) => {
      const img = data.cameras[i].states[feeds[cam.id]]?.image;
      return `<figure class="feed${cam.id === s.focus ? ' is-focus' : ''}" data-camera="${cam.id}" data-state="${esc(feeds[cam.id])}"><div class="feed-pic">${img ? `<img src="${esc(img)}" alt="${esc(cam.states[feeds[cam.id]])}" loading="lazy">` : `<span class="feed-blank" aria-hidden="true"></span>`}</div><figcaption><b>${esc(cam.id.toUpperCase())}</b> ${esc(cam.name)}${feeds[cam.id] === 'normal' ? '' : ` <em>${esc(feeds[cam.id])}</em>`}</figcaption></figure>`;
    })
    .join('');
  const lines = s.lines
    .map((l, i) => `<li><span class="line-who">${esc(d.speakers[l.speaker].name)}</span> ${esc(l.text)}${ds.lines[i].file ? ` <audio controls preload="none" src="${esc(ds.lines[i].file)}"></audio>` : ''}</li>`)
    .join('');
  const choices = s.choices
    .map((c, i) => {
      const to = st.byId.get(c.next);
      const open = rules.usable(consoleChoice(c), state);
      return open
        ? `<a class="choice" href="/${st.base}${to.folder}/">${esc(c.say)}</a>`
        : `<span class="choice is-locked" aria-disabled="true">${esc(c.say)} <small>(needs ${esc(needs(c).join('; '))})</small></span>`;
    })
    .join('');
  const meters = Object.entries(state.meters).map(([k, v]) => `${esc(k)} ${v}`).join(', ');
  return `<!DOCTYPE html>
<!-- Generated by tools/build-story.mjs from ${st.file} (scene "${s.id}"). Do not edit: change the data and run \`npm run story\`. -->
<html lang="en"${tap.title ? ` data-tap-title="${esc(tap.title)}"` : ''}${tap.line ? ` data-tap-line="${esc(tap.line)}"` : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(s.title)} · ${esc(titleOf(st))}</title>
  <meta name="description" content="${esc(s.lines.map((l) => l.text).join(' '))}">
  <link rel="canonical" href="https://imaginelivetv.com/${st.base}${s.folder}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/site.css">
  <meta name="theme-color" content="#070807">
</head>
<body>
  <header class="site-header">
    <a href="/">Imagine Live TV</a>
  </header>

  <main class="passage console-passage" data-story="${st.id}" data-node="${s.folder}" data-type="console"${s.ending ? ' data-state="soon"' : ''}>
    <h1>${esc(s.title)}</h1>
    <p class="passage-note"><time>${esc(s.time)}</time> · ${esc(s.log ?? '')}</p>
    <aside class="canon" data-canon>
      <strong>State on the shortest way here</strong>
      <span class="canon-path">${esc((canon?.path ?? []).join(' > '))}</span>
      <span class="canon-flags">Flags: ${Object.keys(state.flags).length ? Object.keys(state.flags).sort().map(esc).join(', ') : 'none'}</span>
      <span class="canon-meters">Meters: ${meters || 'none'}</span>
      <span class="canon-note">The page is drawn for this state: a choice that needs another state is shown locked. In the player, the state is the one you earned.</span>
    </aside>
    <div class="wall" data-wall>${tiles}</div>
    <ol class="passage-lines">${lines}</ol>
    ${s.ending ? `<p class="passage-prompt">${esc(s.ending)}</p>` : ''}
    ${choices ? `<div class="spark-choices">${choices}</div>` : ''}
  </main>

  <footer class="site-footer">
    <p>Copyright © 2026 Imagine Live TV - All Rights Reserved.</p>
    <p class="powered">Powered by <a class="powered-mark" href="https://hawkesgen.com">HAWKES GEN</a></p>
    <p class="stats-note">Anonymous viewing statistics (no cookies, no personal data, no IP stored) help us improve the stories. <a href="/privacy.html">Privacy</a></p>
  </footer>
  <script src="/js/hawkes-build.js"></script>
  <script src="/js/hawkes-analytics.js" data-product="imaginelivetv"></script>
  <script src="/js/analytics.js"></script>
  <script src="/js/hawkes-sound.js"></script>
</body>
</html>
`;
}

/** The recipes for a console story's media: camera stills (image.generate for the normal picture, image.edit for
    every other state of it), ambience beds and sound effects (audio.sfx), and each voiced line (audio.voice,
    eleven_v4, with the line's performance tags in front). */
function consoleAssets(st) {
  const d = st.data;
  const f = consoleFiles(st);
  const P = st.prefix;
  const of = ` (${titleOf(st)})`;
  const list = [];
  const still = (desc) => `A fixed security camera frame, 16:9: ${desc}`;
  for (const cam of d.cameras) {
    const base = f.feed(cam.id, 'normal');
    for (const [state, desc] of Object.entries(cam.states)) {
      if (state === 'normal') {
        list.push({
          id: `${P}feed-${cam.id}-normal`,
          note: `Camera ${cam.id.toUpperCase()} ${cam.name}${of}: the normal picture.`,
          steps: [{ tool: 'image.generate', params: { prompt: positive(d, `${still(desc)} ${d.style}`), width: 1024, height: 576 }, save: 'image' }],
          candidates: 3,
          pick: `matches the description (${desc}); reads as a security camera frame; empty and quiet; no text, no timestamp`,
          files: { image: base },
        });
      } else {
        list.push({
          id: `${P}feed-${cam.id}-${state}`,
          note: `Camera ${cam.id.toUpperCase()} ${cam.name}${of}: ${state}.`,
          inputs: [base],
          steps: [{ tool: 'image.edit', params: { prompt: `${still(desc)} Keep the camera angle, the lens, the lighting and everything else in the picture exactly as it is; change only what the description says. ${d.style}`, negative: d.negative, width: 1024, height: 576 }, inputs: { images: ['$input:0'] }, save: 'image' }],
          candidates: 2,
          pick: `the same camera view as the normal picture with only this change: ${desc}; no text`,
          files: { image: f.feed(cam.id, state) },
        });
      }
    }
  }
  list.push({
    id: `${P}card`,
    note: `The landing card's key image${of}: nine camera tiles on a dark wall, one of them frozen.`,
    steps: [{ tool: 'image.generate', params: { prompt: positive(d, `A vertical poster-like frame, 9:16: a wall of nine security monitors in a dark control room, eight showing quiet empty rooms and one frozen. ${d.style}`), width: 720, height: 1280 }, save: 'image' }],
    candidates: 3,
    pick: 'nine camera tiles, a dark control room, a security-camera look; no readable text',
    files: { image: 'assets/images/night-shift.jpg' },
  });
  for (const s of st.scenes.filter((x) => x.ending)) {
    list.push({
      id: `${P}endcard-${s.id}`,
      note: `End card for the ending "${s.ending}" (${s.title})${of}: the control room at the end of the shift.`,
      steps: [{ tool: 'image.generate', params: { prompt: positive(d, `${d.endcardStyle ?? still('the control room wall at the end of the shift')} The ending is called "${s.ending}": ${s.endcard ?? s.title}. ${d.style}`), width: 1024, height: 576 }, save: 'image' }],
      candidates: 3,
      pick: `an end card for "${s.ending}" in the same security-camera look as the wall; matches the building bible's control room; empty of readable text`,
      files: { image: f.endcard(s.id) },
    });
  }
  for (const [cue, text] of Object.entries(d.ambience ?? {})) {
    list.push({ id: `${P}ambience-${cue}`, note: `Ambience bed ${cue}${of}: a loop under the scenes that use it.`, steps: [{ tool: 'audio.sfx', params: { text, duration: 30, loop: true }, save: 'bed' }], files: { bed: f.bed(cue) } });
  }
  for (const [cue, text] of Object.entries(d.sfx ?? {})) {
    list.push({ id: `${P}sfx-${cue}`, note: `Sound effect ${cue}${of}.`, steps: [{ tool: 'audio.sfx', params: { text, duration: 2 }, save: 'sfx' }], files: { sfx: f.sfx(cue) } });
  }
  // A sting is sparse and short (20 s, no loop): it plays once as its scene opens, under the first line, at -40 LUFS.
  for (const [cue, text] of Object.entries(d.music ?? {})) {
    list.push({ id: `${P}music-${cue}`, note: `Music sting ${cue}${of}: plays once as its scenes open, never under a line louder than the bed.`, steps: [{ tool: 'audio.music', params: { prompt: text, lyrics: '[Instrumental]', seconds: 20, bpm: 60 }, save: 'music' }], files: { music: f.music(cue) } });
  }
  for (const s of st.scenes) {
    s.lines.forEach((l, i) => {
      const who = d.speakers[l.speaker];
      if (!who?.voice) return;
      const tags = String(l.perform ?? '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => `[${t}]`).join('');
      list.push({
        id: `${P}${s.id}-line-${i + 1}`,
        note: `${s.title}${of}: ${who.name} says "${l.text}"${l.draft ? ' (DRAFT line: J to approve)' : ''}.`,
        steps: [{ tool: 'audio.voice', params: { text: `${tags ? tags + ' ' : ''}${l.text}`, voice: who.voice, model: d.narrator?.model ?? 'eleven_v4' }, save: 'line' }],
        files: { line: f.line(s, i) },
      });
    });
  }
  return list;
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
  for (const st of stories) for (const s of st.scenes) if (!st.console && useOf(st, s) === 'gen') cut(st, s);
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
    console.log(`${st.id}: ${st.scenes.length} scenes (${st.console ? `console story, ${st.explored?.states ?? 0} states explored` : `${gen} on generated media`})${st.listed ? '' : ', not on the landing page'}`);
  }
  console.log(`${changed.length} file(s) changed`);
}
