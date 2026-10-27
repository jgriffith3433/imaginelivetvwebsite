#!/usr/bin/env node
// Writes night-shift/storyboard.html: every scene's lines beside its keyframes, for J's review of the photographed room.
// A keyframe is the room as js/console-room.js leaves it when the scene opens and after each line that has an act (the plate or
// the place's still, the overlays raised so far, one silhouette layer per person). It runs the real room in jsdom, so what the page
// shows is what the player resolves. Usage: node tools/make-storyboard.mjs   (needs jsdom, like npm run test:room)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(process.env.JSDOM_DIR || ROOT, 'x.js'))('jsdom')); } catch { console.log('skip jsdom is not installed; no storyboard written'); process.exit(0); }
const src = fs.readFileSync(path.join(ROOT, 'js/console-room.js'), 'utf8');
const data = Function(`const window = {}; ${fs.readFileSync(path.join(ROOT, 'js/story-data.js'), 'utf8')}; return window.ILTV_STORIES;`)();
const story = data.stories.find((s) => s.id === 'night-shift');
const stageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'night-shift/media/stage/stage.json'), 'utf8'));
const dom = new JSDOM('<body><div id="console-room"><div id="console-room-art"></div><figure id="console-big"></figure><div id="console-room-figs"></div></div><p id="console-action"></p></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
dom.window.setTimeout = () => 0;
dom.window.eval(src);
const R = dom.window.iltvRoom;
R.useStage(stageJson);

// the checks' scores (node tools/room-art.mjs --write): a scene's score is its worst frame's; the page sorts by it
const qaFile = path.join(ROOT, 'night-shift/qa/frames.json');
const qa = fs.existsSync(qaFile) ? JSON.parse(fs.readFileSync(qaFile, 'utf8')) : null;
const sceneScore = {};
if (qa) for (const f of qa.frames) for (const u of f.uses) { const id = u.replace(/#.*/, ''); sceneScore[id] = Math.max(sceneScore[id] ?? 0, f.score); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const M = 'media/stage/';
const frame = (ph, label) => {
  const imgs = [`<img src="${M}${ph.still || ph.plate}" loading="lazy" alt="">`];
  if (ph.still === ph.plate || !ph.still) {
    for (const o of ph.overlays) if (stageJson.overlays[o]) imgs.push(`<img class="ov" src="${M}${stageJson.overlays[o]}" loading="lazy" alt="">`);
    for (const f of Object.values(ph.layers)) if (f) imgs.push(`<img src="${M}${f}" loading="lazy" alt="">`);
  }
  return `<figure class="kf">${imgs.join('')}<figcaption>${esc(label)}</figcaption></figure>`;
};

const scenes = [];
let keyframes = 0;
let withoutLayer = new Set();
for (const [id, s] of Object.entries(story.scenes)) {
  R.scene({ id, time: s.time, place: s.place, cast: s.cast, away: s.away, lines: s.lines });
  const kfs = [frame(R.view().photo, `opens, ${s.time}${s.place ? ` (${s.place})` : ''}`)];
  s.lines.forEach((l, i) => {
    R.line(i);
    R.runBeats();
    const acts = (l.act == null ? [] : Array.isArray(l.act) ? l.act : [l.act]).map((e) => (typeof e === 'string' ? e : `${e.act}@${e.at}`));
    if (acts.length || l.place) kfs.push(frame(R.view().photo, `line ${i + 1}: ${[l.place && 'place ' + l.place, ...acts].filter(Boolean).join(', ')}`));
    for (const a of acts) {
      const who = a.split(':')[0];
      const v = R.view();
      if (who !== 'room' && v.actors[who] && v.actors[who].shown && v.photo.on && !v.photo.layers[who] && v.place === 'room') withoutLayer.add(`${who} (${a})`);
    }
  });
  keyframes += kfs.length;
  const lines = s.lines.map((l, i) => {
    const acts = l.act == null ? '' : ` <span class="act">${esc((Array.isArray(l.act) ? l.act : [l.act]).map((e) => (typeof e === 'string' ? e : `${e.act}@${e.at}`)).join(', '))}</span>`;
    return `<li><b>${esc(l.speaker)}</b> ${esc(l.text)}${acts}</li>`;
  }).join('');
  const sc = sceneScore[id] ?? 0;
  scenes.push(`<section id="${id}" data-score="${sc}"><span class="score ${sc > 40 ? 'bad' : sc > 20 ? 'meh' : 'ok'}">${qa ? 'check score ' + sc : ''}</span><h2>${esc(s.title || id)} <small>${id} · ${s.time}${s.ending ? ' · ending' : ''}</small></h2><div class="row"><div class="kfs">${kfs.join('')}</div><ol>${lines}</ol></div></section>`);
}
const css = `body{margin:0;background:#101416;color:#d6d3c8;font:15px/1.45 system-ui,sans-serif}header{padding:1rem 1.5rem;position:sticky;top:0;background:#101416ee;border-bottom:1px solid #2b3a3f}
h1{font-size:1.1rem;margin:0}h2{font-size:1rem;margin:0 0 .5rem}h2 small{color:#8fa09a;font-weight:400}section{padding:1rem 1.5rem;border-bottom:1px solid #1d272b}
.row{display:grid;grid-template-columns:minmax(300px,520px) 1fr;gap:1rem}.kfs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.5rem;align-content:start}
.kf{position:relative;margin:0;aspect-ratio:1536/920;background:#000}.kf img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.kf figcaption{position:absolute;left:0;right:0;bottom:0;padding:2px 5px;font-size:11px;background:#000a;color:#d9c58a}
ol{margin:0;padding-left:1.2rem}li{margin:.15rem 0}b{color:#d9c58a;font-weight:600}.score{float:right;font-size:12px;padding:1px 6px;border-radius:3px}.score.ok{background:#1d3b2c}.score.meh{background:#4a3f1a}.score.bad{background:#5a2323}.act{color:#7fb89a;font-size:12px}@media(max-width:800px){.row{grid-template-columns:1fr}}`;
fs.writeFileSync(path.join(ROOT, 'night-shift/storyboard.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Night Shift storyboard</title><style>${css}</style></head><body><header><h1>Night Shift: the photographed room, scene by scene (${Object.keys(story.scenes).length} scenes, ${keyframes} keyframes)</h1><p><button id="worst">Sort worst first</button> <button id="story">Story order</button> Score: the room checks (npm run test:room-art): 0 passes every mask check; higher is worse. Review the worst 20 and a few per stretch.</p><p>Generated by tools/make-storyboard.mjs from the real room code. Black people are the silhouette layers; a person with no layer at some moment is listed in the summary.</p></header>${scenes.join('\n')}<script>const secs=[...document.querySelectorAll('section')];const box=secs[0].parentNode;document.getElementById('worst').onclick=()=>secs.slice().sort((a,b)=>b.dataset.score-a.dataset.score).forEach(x=>box.appendChild(x));document.getElementById('story').onclick=()=>secs.forEach(x=>box.appendChild(x));</script></body></html>\n`);
console.log(`night-shift/storyboard.html: ${Object.keys(story.scenes).length} scenes, ${keyframes} keyframes`);
console.log(withoutLayer.size ? `acts of people shown with no layer (${withoutLayer.size}): ${[...withoutLayer].sort().join('; ')}` : 'every act has a layer');
