// Evens out the audio assets (audio.voice, audio.sfx) of hawkes.assets.json for one story with ffmpeg, whoever made them:
//   node tools/make-audio.mjs <story> --mix              every file on disk not yet mixed (what Studio's asset make wrote)
//   node tools/make-audio.mjs <story> --ingest <folder>  <folder>/<asset id>/*.mp3 straight from Hawkes Gen (hawkesgen_run save_to)
//   node tools/make-audio.mjs <story> --list             the assets with no file yet (add --only <text in the id>)
//   node tools/make-audio.mjs <story> --dur              set each line's dur in the story data to its recording's length
// Voices: silence trimmed, loudness -19 LUFS. Sound effects: -26 LUFS. Ambience beds: -38 LUFS, so a bed always sits
// well under the voice (the player plays all three at the same volume). The lock entry is the one Studio writes
// (same recipe fingerprint), so Studio sees these as current.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const story = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const only = opt('only', '');
if (!story) throw new Error('usage: node tools/make-audio.mjs <story id> --mix | --ingest <folder> | --list');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'hawkes.assets.json'), 'utf8'));
const lockFile = path.join(ROOT, 'hawkes.assets.lock.json');
const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const recipeOf = (a) => crypto.createHash('sha256').update(JSON.stringify({ steps: a.steps, candidates: a.candidates ?? 1, ...(a.pick ? { pick: a.pick } : {}), ...(a.pickAt ? { pickAt: a.pickAt } : {}) })).digest('hex').slice(0, 16);

const kindOf = (a) => (a.id.includes('-ambience-') ? 'bed' : a.id.includes('-sfx-') ? 'sfx' : 'voice');
// Voices are cut in stages (start, then the end by reversing, then loudness): one chained graph hung ffmpeg on some clips.
const LOUD = { voice: 'loudnorm=I=-19:TP=-2:LRA=9', sfx: 'loudnorm=I=-26:TP=-3:LRA=7', bed: 'loudnorm=I=-38:TP=-6:LRA=7' };
const TRIM_START = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05';
const TRIM_END = 'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse';
const ff = (...a) => execFileSync('ffmpeg', ['-nostdin', '-y', '-v', 'error', ...a], { timeout: 60000 });

const mine = (a) => a.id.startsWith(story + '-') && !a.id.startsWith(story + '-demo-') && a.steps?.length === 1 && /^audio\.(voice|sfx)$/.test(a.steps[0].tool) && a.id.includes(only);
const assets = manifest.assets.filter(mine);
const relOf = (a) => Object.values(a.files)[0];
const markFile = path.join(ROOT, story, 'media', '.mixed.json');
const mixed = fs.existsSync(markFile) ? JSON.parse(fs.readFileSync(markFile, 'utf8')) : {};

function mixOne(a, input) {
  const rel = relOf(a);
  const dest = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const kind = kindOf(a);
  const w1 = dest + '.1.wav', w2 = dest + '.2.wav', tmp = dest + '.tmp.mp3';
  let src = input;
  if (kind === 'voice') {
    ff('-i', src, '-af', TRIM_START, w1);
    ff('-i', w1, '-af', TRIM_END, w2);
    src = w2;
  }
  ff('-i', src, '-af', LOUD[kind], '-ar', '44100', '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '4', tmp);
  for (const t of [w1, w2]) fs.rmSync(t, { force: true });
  fs.renameSync(tmp, dest);
  const h = sha(dest);
  mixed[rel] = h;
  lock[a.id] = { recipe: recipeOf(a), job: lock[a.id]?.job ?? 'hawkesgen_run', made: new Date().toISOString(), files: { [rel]: h } };
}
const save = () => {
  fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + '\n');
  fs.mkdirSync(path.dirname(markFile), { recursive: true });
  fs.writeFileSync(markFile, JSON.stringify(mixed, null, 1) + '\n');
};

if (args.includes('--list')) {
  const missing = assets.filter((a) => !fs.existsSync(path.join(ROOT, relOf(a))));
  console.log(`${missing.length} of ${assets.length} have no file`);
  for (const a of missing) console.log(a.id);
} else if (args.includes('--ingest')) {
  const dir = opt('ingest');
  let n = 0;
  for (const a of assets) {
    const d = path.join(dir, a.id);
    const f = fs.existsSync(d) && fs.readdirSync(d).find((x) => x.endsWith('.mp3'));
    if (f) { mixOne(a, path.join(d, f)); n++; }
  }
  save();
  console.log(`ingested ${n}`);
} else if (args.includes('--mix')) {
  let n = 0;
  for (const a of assets) {
    const rel = relOf(a), f = path.join(ROOT, rel);
    if (!fs.existsSync(f) || mixed[rel] === sha(f)) continue;
    const raw = f + '.raw.mp3';
    fs.copyFileSync(f, raw);
    mixOne(a, raw);
    fs.rmSync(raw);
    n++;
  }
  save();
  console.log(`mixed ${n}`);
}

// --dur: the player gives up on a recording after its line's `dur` + 4 s, so set `dur` in story/<story>.json to the
// length of every recording that exists (rounded up to a tenth of a second).
if (args.includes('--dur')) {
  const f = path.join(ROOT, 'story', story + '.json');
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const s of d.scenes) s.lines.forEach((l, i) => {
    const rec = path.join(ROOT, story, s.folder, 'media', `line-${i + 1}.mp3`);
    if (!fs.existsSync(rec)) return;
    const sec = Math.ceil(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rec]).toString()) * 10) / 10;
    if (l.dur !== sec) { l.dur = sec; n++; }
  });
  fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
  console.log(`dur set on ${n} lines`);
}
