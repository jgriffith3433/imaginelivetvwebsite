// Evens out the audio assets (audio.voice, audio.sfx) of hawkes.assets.json for one story with ffmpeg, whoever made them:
//   node tools/make-audio.mjs <story> --mix              every file on disk not yet mixed (what Studio's asset make wrote)
//   node tools/make-audio.mjs <story> --ingest <folder>  <folder>/<asset id>/*.mp3 straight from Hawkes Gen (hawkesgen_run save_to)
//   node tools/make-audio.mjs <story> --list             the assets with no file yet (add --only <text in the id>)
//   node tools/make-audio.mjs <story> --reuse [<ref>]    after the text was edited (lines moved, cut or added): every asset whose recipe (voice and text)
//                                                        matches one that had a file at <ref> (default HEAD) gets that file; prints the ones still to make
//   node tools/make-audio.mjs <story> --seam            close the loop of every ambience bed on disk (see SEAM; --mix does it to new ones)
//   node tools/make-audio.mjs <story> --beds            level and loop-check every ambience bed on disk (see BEDS; changes only the beds that need it)
//   node tools/make-audio.mjs <story> --dur              set each line's dur in the story data to its recording's length
// Music (audio.music, the stingers on endings and key moments) is -40 LUFS: never louder than a bed's neighbour. Voices: silence trimmed, loudness -16 LUFS. Sound effects: -26 LUFS. Ambience beds: -38 LUFS, so a bed always sits
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

const kindOf = (a) => (a.id.includes('-ambience-') ? 'bed' : a.id.includes('-sfx-') ? 'sfx' : a.id.includes('-music-') ? 'music' : 'voice');
// Voices are cut in stages (start, then the end by reversing, then loudness): one chained graph hung ffmpeg on some clips.
const LOUD = { voice: 'loudnorm=I=-16:TP=-1.5:LRA=9', sfx: 'loudnorm=I=-26:TP=-3:LRA=7', bed: 'loudnorm=I=-38:TP=-6:LRA=7', music: 'loudnorm=I=-40:TP=-6:LRA=7' };
// A bed loops (audio.sfx has no loop that closes): its first SEAM seconds are laid over its last SEAM seconds with an
// equal-power crossfade, so the end runs straight into the start and the file is SEAM shorter.
const SEAM = 2;
// A sting fades in and out so it never starts or ends on a click.
const fadeMusic = (sec) => `afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, sec - 3).toFixed(2)}:d=3`;
const secs = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
function seam(src, out) {
  const n = secs(src);
  const head = out + '.head.wav', body = out + '.body.wav';
  ff('-i', src, '-t', String(SEAM), '-ar', '44100', '-ac', '1', head);
  ff('-i', src, '-ss', String(SEAM), '-ar', '44100', '-ac', '1', body);
  ff('-i', body, '-i', head, '-filter_complex', `acrossfade=d=${SEAM}:c1=qsin:c2=qsin`, out);
  for (const t of [head, body]) fs.rmSync(t, { force: true });
  return n - SEAM;
}

// BEDS: the loop is closed already (SEAM), but a bed is not steady: a refrigerator cycling or a tick near the join makes the
// last quarter second a different level from the first (the audio playtest measures exactly that: 3 dB at most), and some
// beds came out of loudnorm too loud to sit under a line (12 dB under the voice at least; the voice is about -19 dB RMS).
// So a bed is turned round (a loop turned round is still a loop) to start where its level is the same before and after the
// cut, and brought down to BED_MAX_RMS when it is louder.
const BED_MAX_RMS = -36;
const BED_GAP_DB = 1;
const pcm = (f) => { const b = execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', '44100', '-'], { maxBuffer: 1 << 28 }); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const dbOf = (sq, n) => 10 * Math.log10(sq / Math.max(1, n) + 1e-12);
function bedFacts(d) {
  const q = 11025;
  const cum = new Float64Array(d.length + 1);
  for (let i = 0; i < d.length; i++) cum[i + 1] = cum[i] + d[i] * d[i];
  const win = (a, b) => { // energy of d[a..b) taken round the loop
    let e = 0;
    for (let i = a; i < b;) { const j = ((i % d.length) + d.length) % d.length, run = Math.min(b - i, d.length - j); e += cum[j + run] - cum[j]; i += run; }
    return dbOf(e, b - a);
  };
  const gapAt = (p) => Math.abs(win(p - q, p) - win(p, p + q)) + Math.abs(win(p - 4 * q, p) - win(p, p + 4 * q)) / 2;
  return { rms: dbOf(cum[d.length], d.length), gapAt, q };
}
function bedFix(a, f) {
  const d = pcm(f);
  const { rms, gapAt, q } = bedFacts(d);
  const own = Math.abs(dbOf(d.slice(0, q).reduce((x, v) => x + v * v, 0), q) - dbOf(d.slice(d.length - q).reduce((x, v) => x + v * v, 0), q));
  let cut = 0;
  if (own > BED_GAP_DB) {
    let best = Infinity;
    for (let p = q; p < d.length - q; p += 441) { const g = gapAt(p); if (g < best) { best = g; cut = p; } }
  }
  const gain = rms > BED_MAX_RMS + 0.15 ? BED_MAX_RMS - rms : 0;
  if (!cut && !gain) return { changed: false, own, rms };
  const sec = (cut / 44100).toFixed(4), tmp = f + '.tmp.mp3';
  const graph = cut
    ? `[0]atrim=start=${sec},asetpts=PTS-STARTPTS[a];[0]atrim=end=${sec},asetpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=0:a=1,volume=${gain.toFixed(2)}dB`
    : `[0]volume=${gain.toFixed(2)}dB`;
  ff('-i', f, '-filter_complex', graph, '-ar', '44100', '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '4', tmp);
  fs.renameSync(tmp, f);
  return { changed: true, own, rms, cut: cut / 44100, gain };
}
const TRIM_START = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05';
const TRIM_END = 'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse';
const ff = (...a) => execFileSync('ffmpeg', ['-nostdin', '-y', '-v', 'error', ...a], { timeout: 60000 });

const mine = (a) => a.id.startsWith(story + '-') && !a.id.startsWith(story + '-demo-') && a.steps?.length === 1 && /^audio\.(voice|sfx|music)$/.test(a.steps[0].tool) && a.id.includes(only);
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
  const tmpFiles = [];
  if (kind === 'voice') {
    ff('-i', src, '-af', TRIM_START, w1);
    ff('-i', w1, '-af', TRIM_END, w2);
    src = w2;
  }
  if (kind === 'bed') {
    const w3 = dest + '.3.wav';
    seam(src, w3);
    src = w3;
    tmpFiles.push(w3);
  }
  const af = kind === 'music' ? `${fadeMusic(secs(src))},${LOUD.music}` : LOUD[kind];
  ff('-i', src, '-af', af, '-ar', '44100', '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '4', tmp);
  for (const t of [w1, w2, ...tmpFiles]) fs.rmSync(t, { force: true });
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
} else if (args.includes('--reuse')) {
  const ref = args[args.indexOf('--reuse') + 1]?.startsWith('--') || !args[args.indexOf('--reuse') + 1] ? 'HEAD' : args[args.indexOf('--reuse') + 1];
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const before = JSON.parse(git('show', `${ref}:hawkes.assets.json`).toString());
  const had = new Map();
  for (const a of before.assets.filter(mine)) {
    const rel = relOf(a);
    try { execFileSync('git', ['cat-file', '-e', `${ref}:${rel}`], { cwd: ROOT, stdio: 'ignore' }); } catch { continue; }
    if (!had.has(recipeOf(a))) had.set(recipeOf(a), rel);
  }
  const current = (a) => fs.existsSync(path.join(ROOT, relOf(a))) && lock[a.id]?.recipe === recipeOf(a);
  const todo = [];
  let n = 0;
  for (const a of assets) {
    if (current(a)) continue;
    const src = had.get(recipeOf(a));
    if (!src) { todo.push(a.id); continue; }
    const dest = path.join(ROOT, relOf(a));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, git('show', `${ref}:${src}`));
    const h = sha(dest);
    mixed[relOf(a)] = h;
    lock[a.id] = { recipe: recipeOf(a), job: lock[a.id]?.job ?? 'hawkesgen_run', made: new Date().toISOString(), files: { [relOf(a)]: h } };
    n++;
  }
  // A file left over from a line that no longer has this text would play the old words: remove the ones nothing current points at.
  for (const a of assets) if (todo.includes(a.id)) fs.rmSync(path.join(ROOT, relOf(a)), { force: true });
  save();
  console.log(`reused ${n}; ${todo.length} to make`);
  for (const id of todo) console.log(id);
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
} else if (args.includes('--seam')) {
  let n = 0;
  for (const a of assets.filter((x) => kindOf(x) === 'bed')) {
    const rel = relOf(a), f = path.join(ROOT, rel);
    if (!fs.existsSync(f) || secs(f) < 29.5) continue; // already closed (a made bed is 30 s)
    const out = f + '.seam.wav', tmp = f + '.tmp.mp3';
    seam(f, out);
    ff('-i', out, '-ar', '44100', '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '4', tmp);
    fs.rmSync(out);
    fs.renameSync(tmp, f);
    const h = sha(f);
    mixed[rel] = h;
    lock[a.id] = { ...(lock[a.id] ?? {}), recipe: recipeOf(a), made: new Date().toISOString(), files: { [rel]: h } };
    n++;
  }
  save();
  console.log(`closed the loop of ${n} beds`);
} else if (args.includes('--beds')) {
  let n = 0;
  for (const a of assets.filter((x) => kindOf(x) === 'bed')) {
    const rel = relOf(a), f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) continue;
    const r = bedFix(a, f);
    console.log(`${path.basename(rel).padEnd(24)} ${r.rms.toFixed(1)} dB RMS, join ${r.own.toFixed(1)} dB${r.changed ? ` -> cut at ${r.cut.toFixed(2)} s, gain ${r.gain.toFixed(1)} dB` : ' (kept)'}`);
    if (!r.changed) continue;
    const h = sha(f);
    mixed[rel] = h;
    lock[a.id] = { ...(lock[a.id] ?? {}), recipe: recipeOf(a), made: new Date().toISOString(), files: { [rel]: h } };
    n++;
  }
  save();
  console.log(`levelled ${n} beds`);
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
