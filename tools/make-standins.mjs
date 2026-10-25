// Stand-in art for Night Shift until the real stills are made (no GPU): one SVG per camera state, one end card per
// ending, and the landing card. Every state of a camera is drawn on the same room (the camera's own layout), with
// only the state's change added, so a room reads as the same room. tools/build-story.mjs uses a stand-in only while
// the real picture (media/feeds/<camera>-<state>.png ...) is missing. Run: node tools/make-standins.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'story/night-shift.json'), 'utf8'));
const OUT = 'night-shift/media/standin/';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// The room of each camera: fixed shapes (x, y, w, h, fill) that never change between its states.
const ROOMS = {
  c1: [[0, 380, 1024, 196, '#3a4140'], [120, 250, 380, 40, '#566160'], [140, 290, 340, 90, '#2b3231'], [620, 200, 60, 180, '#667170'], [720, 200, 60, 180, '#667170'], [820, 120, 160, 260, '#1d2423'], [60, 330, 200, 30, '#4a5352']],
  c2: [[0, 400, 1024, 176, '#364041'], [80, 120, 420, 280, '#27302f'], [524, 120, 420, 280, '#1f2928'], [100, 340, 800, 36, '#5b6665']],
  c3: [[0, 400, 1024, 176, '#33393a'], [300, 80, 420, 320, '#4d5656'], [60, 200, 160, 200, '#2c3534'], [800, 240, 160, 160, '#222a29']],
  c4: [[0, 440, 1024, 136, '#363d3d'], [330, 70, 360, 370, '#4b5453'], [470, 90, 40, 40, '#aab3b1']],
  c5: [[0, 420, 1024, 156, '#454d4c'], [80, 110, 190, 310, '#5f6a69'], [290, 110, 190, 310, '#5f6a69'], [500, 110, 190, 310, '#5f6a69'], [710, 110, 190, 310, '#5f6a69'], [930, 300, 50, 120, '#2e5a3a']],
  c6: [[0, 330, 1024, 246, '#3b3f44'], [440, 190, 150, 140, '#2a3030'], [490, 215, 40, 115, '#4a5252'], [0, 0, 1024, 90, '#272d2d']],
  c7: [[0, 400, 1024, 176, '#2f3535'], [140, 100, 300, 300, '#425250'], [584, 100, 300, 300, '#425250'], [440, 330, 144, 70, '#222827'], [480, 60, 64, 14, '#c9c7a0']],
  c8: [[0, 430, 1024, 146, '#323839'], [380, 90, 264, 340, '#4a5453'], [470, 250, 84, 12, '#9aa3a1'], [560, 40, 70, 24, '#c9c7a0']],
  c9: [[0, 420, 1024, 156, '#30383a'], [180, 120, 220, 300, '#3f4948'], [560, 150, 260, 270, '#2a3231'], [590, 190, 90, 60, '#223a2c'], [700, 190, 90, 60, '#3a2e22']],
};
// What a state adds on top of its room: [shape...]. 'p' = a figure (x, y), others are rects.
const person = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="-70" rx="22" ry="26" fill="#0c0f0f"/><rect x="-34" y="-46" width="68" height="130" rx="16" fill="#0c0f0f"/></g>`;
const lying = (x, y) => `<rect x="${x}" y="${y}" width="320" height="46" rx="20" fill="#0c0f0f"/><ellipse cx="${x - 20}" cy="${y + 20}" rx="26" ry="22" fill="#0c0f0f"/>`;
const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const OVER = {
  'c1:desk-visitor': person(440, 330) + person(560, 330, 1.05),
  'c1:laptop': rect(150, 262, 90, 14, '#9aa3a1') + rect(250, 270, 20, 10, '#d0d0d0'),
  'c1:coat': person(520, 380, 1.15),
  'c1:box': rect(300, 245, 70, 50, '#8a6a42') + rect(380, 230, 36, 60, '#0c0f0f'),
  'c1:dawn': rect(0, 0, 1024, 576, 'rgba(255,230,190,0.28)'),
  'c2:sleeper': lying(300, 330),
  'c2:empty-cold': rect(300, 350, 300, 26, '#1b2322') + rect(0, 0, 1024, 576, 'rgba(120,160,200,0.14)'),
  'c3:van': rect(300, 300, 420, 100, '#d8d8d0') + person(180, 400),
  'c4:wedge': rect(500, 360, 70, 80, '#171c1c') + rect(488, 420, 38, 18, '#e8761e'),
  'c5:stuck': rect(120, 130, 90, 18, '#d33') + rect(320, 460, 220, 14, '#aab3b1'),
  'c5:cart': rect(420, 330, 200, 110, '#2a6f9e') + rect(440, 300, 60, 40, '#101414'),
  'c6:reader': person(320, 390) + person(400, 390, 0.95) + rect(700, 260, 24, 36, '#2e5a3a'),
  'c6:leak': `<ellipse cx="515" cy="350" rx="250" ry="42" fill="#0f1b2a" opacity="0.8"/>`,
  'c6:papers': person(512, 400, 1.3) + rect(450, 230, 90, 120, '#e8e4d4'),
  'c7:coat': person(512, 400, 1.2),
  'c9:trouble': rect(600, 200, 24, 24, '#e8b81e') + rect(630, 200, 24, 24, '#e8b81e'),
  'c9:frozen': '',
};
const STATIC_STATES = new Set(['frozen']);
const clock = (cam, state) => (state === 'frozen' ? '03:41:07' : '02:13:44');

function feed(cam, state) {
  const room = (ROOMS[cam.id] || []).map(([x, y, w, h, f]) => rect(x, y, w, h, f)).join('');
  const over = OVER[`${cam.id}:${state}`] ?? '';
  const hold = STATIC_STATES.has(state);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 576" width="1024" height="576" role="img" aria-label="${esc(cam.states[state])}">
<title>${esc(cam.id.toUpperCase())} ${esc(cam.name)}: ${esc(state)} (stand-in)</title>
<defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.75"/></radialGradient>
<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${hold ? '0.9' : '0.6'}" numOctaves="2" seed="${cam.id.charCodeAt(1)}"/><feColorMatrix type="saturate" values="0"/></filter>
<pattern id="s" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity="0.18"/></pattern></defs>
<rect width="1024" height="576" fill="#1b2221"/>${room}${over}
<rect width="1024" height="576" filter="url(#n)" opacity="${hold ? 0.55 : 0.12}"/><rect width="1024" height="576" fill="url(#s)"/><rect width="1024" height="576" fill="url(#v)"/>
<g font-family="monospace" font-size="26" fill="#d8ded6" opacity="0.85"><text x="28" y="48">${esc(cam.id.toUpperCase())}  ${esc(cam.name.replace(/^\d+ /, '').toUpperCase())}</text><text x="28" y="548">2026-10-24  ${clock(cam, state)}</text>${hold ? '<text x="700" y="548" fill="#e66">NO SIGNAL</text>' : ''}</g>
</svg>
`;
}

function card(title, sub, w, h, hue = '#1b2221') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)} (stand-in)</title>
<defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="50%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.8"/></radialGradient>
<pattern id="s" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity="0.2"/></pattern></defs>
<rect width="${w}" height="${h}" fill="${hue}"/>
${[0, 1, 2].map((r) => [0, 1, 2].map((c) => rect(w * 0.08 + c * w * 0.3, h * 0.12 + r * h * 0.08, w * 0.26, h * 0.06, '#2b3534')).join('')).join('')}
<rect width="${w}" height="${h}" fill="url(#s)"/><rect width="${w}" height="${h}" fill="url(#v)"/>
<g font-family="Georgia,serif" fill="#e6ece4" text-anchor="middle"><text x="${w / 2}" y="${h * 0.62}" font-size="${Math.round(w / 12)}" letter-spacing="3">${esc(title.toUpperCase())}</text>
<text x="${w / 2}" y="${h * 0.7}" font-size="${Math.round(w / 26)}" opacity="0.8" font-style="italic">${esc(sub)}</text></g>
</svg>
`;
}

function put(rel, text) {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}
let n = 0;
for (const cam of data.cameras) for (const state of Object.keys(cam.states)) { put(`${OUT}feeds/${cam.id}-${state}.svg`, feed(cam, state)); n++; }
for (const s of data.scenes.filter((x) => x.ending)) { put(`${OUT}endcards/${s.id}.svg`, card(s.ending.replace(/\.$/, ''), 'Night Shift: the report is signed', 1024, 576)); n++; }
put('assets/images/night-shift.svg', card('Night Shift', 'Nine cameras of nothing', 720, 1280)); n++;
console.log(`${n} stand-in pictures written`);
