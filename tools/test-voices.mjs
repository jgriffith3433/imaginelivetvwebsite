// One voice at a time in Trust Fall (story doc "One voice at a time"), in jsdom, no browser: the real js/audio.js and js/game.js
// with a fake Web Audio context and a fake clip clock. A voice in the video (the narration baked into the clip, a talking
// shot) and ARGUS's recording or a still's narration are never heard together: the narrator goes first and alone, the lines
// come after it, the caption names the voice that is speaking, and a one-choice page waits for ARGUS before it carries on.
// Run: npm run test:voices (exits 1 on a failure). The playtest `trust-fall` checks the same in a real browser at 390x844.
import { JSDOM, ResourceLoader, VirtualConsole } from "jsdom";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/story-data.js"), "utf8"), ctx);
const DATA = ctx.window.ILTV_STORIES.stories.find((s) => s.id === "trust-fall");

class Files extends ResourceLoader {
  fetch(url) {
    const u = new URL(url);
    if (u.hostname !== "localhost") return Promise.resolve(Buffer.from(""));
    const p = path.join(ROOT, decodeURIComponent(u.pathname));
    return Promise.resolve(fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p) : Buffer.from(""));
  }
}

let failed = 0, passed = 0;
const fail = (m) => { failed++; console.log(`FAIL ${m}`); };
const ok = (m) => { passed++; console.log(`ok   ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The player on one scene, with a fake audio context (a narration recording lasts `narrSecs` s) and, when the scene has a clip, a
    clip clock the test drives. `patch` edits the scene's data before the page reads it (a talking shot, say). */
async function open(sceneId, history, { narrSecs = 0.8, patch } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { if (!/Not implemented/.test(String(e.message || e))) errors.push(String(e.message || e).slice(0, 160)); });
  const clip = { t: 0, paused: true, ended: false, duration: 30 };
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, "home.html"), "utf8"), {
    url: "http://localhost/?story=trust-fall",
    runScripts: "dangerously",
    resources: new Files(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.document.cookie = `${DATA.cookie}=${encodeURIComponent(JSON.stringify({ scene: sceneId, history }))}; Path=/`;
      w.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      // A recording that is made (an ArrayBuffer) is as long as the test says; a voice file that isn't is a 404.
      w.fetch = (url) => {
        const u = String(url);
        if (/\/voice\//.test(u)) return Promise.resolve({ ok: false, status: 404 });
        if (/narration/.test(u)) return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) });
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
      };
      let seq = 0;
      w.AudioContext = class {
        constructor() { this.state = "running"; this.currentTime = 0; this.sampleRate = 22050; this.destination = {}; }
        resume() { return Promise.resolve(); }
        createGain() { const p = { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} }; return { gain: p, connect() {}, disconnect() {} }; }
        createBuffer(c, len, rate) { return { duration: len / rate, length: len, getChannelData: () => new Float32Array(len) }; }
        decodeAudioData(ab, good) { return Promise.resolve({ duration: narrSecs, id: ++seq }).then((b) => { good && good(b); return b; }); }
        createBufferSource() {
          const s = { buffer: null, loop: false, connect() {}, disconnect() {}, onended: null, ended: false };
          const end = () => { if (s.ended) return; s.ended = true; clearTimeout(s.timer); if (s.onended) s.onended(); };
          s.start = () => { if (s.buffer && s.buffer.duration > 0.01 && !s.loop) s.timer = setTimeout(end, s.buffer.duration * 1000); };
          s.stop = () => end();
          return s;
        }
      };
      // The audio is unlocked the moment js/audio.js defines it, so the first scene already speaks (a viewer has pressed Tap to play).
      let realAudio;
      Object.defineProperty(w, "iltvAudio", { configurable: true, get: () => realAudio, set(v) { realAudio = v; try { v.unlock(); } catch (e) { /* no gesture */ } } });
      Object.defineProperty(w, "ILTV_STORIES", {
        configurable: true,
        set(v) {
          const st = v.stories.find((s) => s.id === "trust-fall");
          if (st && patch) patch(st);
          Object.defineProperty(w, "ILTV_STORIES", { value: v, writable: true, configurable: true });
        },
        get() { return undefined; }
      });
      // A clip clock the test drives: currentTime, paused, ended and duration are the test's.
      const P = w.HTMLMediaElement.prototype;
      Object.defineProperty(P, "currentTime", { configurable: true, get: () => clip.t, set(v) { clip.t = v; } });
      Object.defineProperty(P, "paused", { configurable: true, get: () => clip.paused });
      Object.defineProperty(P, "ended", { configurable: true, get: () => clip.ended });
      Object.defineProperty(P, "duration", { configurable: true, get: () => clip.duration });
      Object.defineProperty(P, "readyState", { configurable: true, get: () => 4 });
      P.play = function () { clip.paused = false; return Promise.resolve(); };
      P.pause = function () { clip.paused = true; };
      P.load = () => {};
    }
  });
  const w = dom.window;
  const until = Date.now() + 8000;
  while (Date.now() < until && !(w.finalSpark && w.finalSpark.scene() === sceneId)) await sleep(50);
  if (!w.finalSpark || w.finalSpark.scene() !== sceneId) throw new Error(`the saved run didn't open ${sceneId}`);
  return { w, clip, errors, close: () => w.close() };
}

/** The voice log as spans (who, start, end, the caption shown when it began), and any overlap the audio itself saw. */
function spans(w) {
  const by = {};
  for (const e of w.iltvAudio.voiceLog()) {
    if (e.ev === "start") by[e.id] = { id: e.id, who: e.who, kind: e.kind, a: e.t, b: null, caption: e.note ? e.note.caption : null };
    else if (by[e.id]) by[e.id].b = e.t;
  }
  return Object.values(by).sort((x, y) => x.a - y.a);
}
const waitFor = async (fn, ms = 6000) => { const until = Date.now() + ms; while (Date.now() < until) { if (fn()) return true; await sleep(25); } return !!fn(); };
const tick = (w, el, name) => el.dispatchEvent(new w.Event(name));

function ordered(name, w, want) {
  const list = spans(w);
  const got = list.map((s) => s.who).join(" > ");
  if (got !== want) return fail(`${name}: voices were ${got || "none"}, want ${want}`);
  for (let i = 1; i < list.length; i++) if (list[i - 1].b == null || list[i].a < list[i - 1].b) return fail(`${name}: ${list[i].who} began (${list[i].a} ms) before ${list[i - 1].who} ended (${list[i - 1].b} ms)`);
  const over = w.iltvAudio.voiceOverlaps();
  if (over.length) return fail(`${name}: the audio saw an overlap: ${JSON.stringify(over[0])}`);
  for (const s of list) {
    const want = s.who === "narrator" ? "" : s.who.toLowerCase();
    if ((s.caption || "").toLowerCase() !== want) return fail(`${name}: ${s.who} spoke while the caption said "${s.caption}"`);
  }
  ok(`${name}: ${got}, one at a time, captions in step`);
}

// 1. A clip with the narration baked in and ARGUS's line over it (the old bug: ARGUS's recording started 0.9 s in, on top of the narration).
{
  const name = "the-plug (unplug): narration in the clip, then ARGUS";
  const data = DATA.scenes.unplug;
  const { w, clip, errors, close } = await open("unplug", ["start"]);
  const v = w.document.querySelector("#spark-video video:not(.spark-leave)");
  if (!v) fail(`${name}: no clip element`);
  else {
    clip.duration = data.voice.narr + 0.8;
    clip.paused = false; clip.t = 0.5; tick(w, v, "playing");
    await sleep(1300); // where the old code started ARGUS (0.9 s in): nothing but the narrator may speak now
    if (spans(w).some((s) => s.who === "argus")) fail(`${name}: ARGUS spoke while the narration was still running`);
    clip.t = data.voice.narr - 0.2; tick(w, v, "timeupdate");
    await sleep(300);
    if (spans(w).some((s) => s.who === "argus")) fail(`${name}: ARGUS spoke before the narration ended`);
    clip.t = data.voice.narr + 0.1; tick(w, v, "timeupdate");
    clip.t = clip.duration; clip.paused = true; clip.ended = true; tick(w, v, "ended"); // the clip is over while ARGUS is still to speak
    if (!(await waitFor(() => spans(w).some((s) => s.who === "argus")))) fail(`${name}: ARGUS never spoke`);
    else {
      const wasAt = w.finalSpark.scene();
      await sleep(150);
      if (w.finalSpark.scene() !== wasAt) fail(`${name}: the page carried on while ARGUS was speaking`);
      await waitFor(() => w.finalSpark.scene() !== "unplug", 5000);
      if (w.finalSpark.scene() === "unplug") fail(`${name}: the page never carried on after ARGUS`);
      else ok(`${name}: the one-choice page waited for ARGUS, then carried on to ${w.finalSpark.scene()}`);
    }
    ordered(name, w, "narrator > argus");
  }
  if (errors.length) fail(`${name}: page errors ${errors.join(" | ")}`);
  close();
}

// 2. A still: its narration is spoken first, ARGUS's recording only when it has ended.
{
  const name = "the-promise (promise): still narration, then ARGUS";
  const { w, errors, close } = await open("promise", ["start"], {
    narrSecs: 0.8,
    // the-promise now has its clip, so this still case sets it back to a still (what a scene without a cut is)
    patch: (st) => { const s = st.scenes.promise; delete s.video; delete s.poster; delete s.small; delete s.live; s.still = "/assets/images/trust-fall.jpg"; s.narration = "/trust-fall/the-promise/media/narration.mp3"; s.score = "/assets/story/trust-fall/music/rescue.mp3"; }
  });
  if (!(await waitFor(() => spans(w).some((s) => s.who === "argus" && s.b != null), 12000))) fail(`${name}: ARGUS never finished speaking (voices: ${spans(w).map((s) => s.who).join(", ") || "none"})`);
  else ordered(name, w, "narrator > argus");
  if (errors.length) fail(`${name}: page errors ${errors.join(" | ")}`);
  close();
}

// 3. A clip with a talking shot for ARGUS in it: the narration first, then the shot, the caption in step, and ARGUS's recording is not
// played on top of the clip's own voice.
{
  const name = "how-it-knows (asked): narration, then ARGUS's talking shot in the clip";
  const { w, clip, errors, close } = await open("asked", ["start", "unplug"], {
    patch: (st) => { st.scenes.asked.voice = { narr: 4, talks: [{ who: "argus", i: 0, start: 4.8, end: 6.5 }] }; }
  });
  const v = w.document.querySelector("#spark-video video:not(.spark-leave)");
  if (!v) fail(`${name}: no clip element`);
  else {
    clip.duration = 7.5;
    clip.paused = false; clip.t = 0.5; tick(w, v, "playing");
    clip.t = 4.1; tick(w, v, "timeupdate");
    clip.t = 5.2; tick(w, v, "timeupdate");
    const mid = spans(w).filter((s) => s.who === "argus");
    if (mid.length !== 1 || mid[0].kind !== "clip") fail(`${name}: want one ARGUS voice from the clip, got ${JSON.stringify(mid)}`);
    clip.t = 6.8; tick(w, v, "timeupdate");
    await sleep(600);
    if (spans(w).some((s) => s.kind === "line")) fail(`${name}: ARGUS's recording played over a clip that speaks the line itself`);
    ordered(name, w, "narrator > argus");
  }
  if (errors.length) fail(`${name}: page errors ${errors.join(" | ")}`);
  close();
}

// 4. The queue: a line asked for while the narrator speaks waits for it and starts after the gap; a second voice opened on top is an overlap;
// the next scene's stopVoices drops what was waiting.
{
  const name = "the audio queue";
  const { w, errors, close } = await open("start", []);
  const au = w.iltvAudio;
  au.stopVoices();
  au.voiceSpan("narrator", "q", true);
  const asked = au.playVoice("trust-fall-q", "Rae. Please stop walking.", "argus");
  await sleep(200);
  if (!asked || au.voiceLog().some((e) => e.who === "argus")) fail(`${name}: a line asked for while the narrator speaks started at once`);
  au.voiceSpan("narrator", "q", false);
  if (!(await waitFor(() => au.voiceLog().some((e) => e.who === "argus" && e.ev === "start"), 2000))) fail(`${name}: the waiting line never started`);
  else {
    const end = au.voiceLog().find((e) => e.who === "narrator" && e.ev === "end"), go = au.voiceLog().find((e) => e.who === "argus" && e.ev === "start");
    if (go.t - end.t < 250) fail(`${name}: the line started ${go.t - end.t} ms after the narrator, under the 300 ms gap`);
    else ok(`${name}: a line waited for the narrator and started ${go.t - end.t} ms after it`);
  }
  au.stopVoices();
  au.voiceSpan("narrator", "q2", true);
  au.playVoice("trust-fall-q2", "Good morning, Rae.", "argus");
  au.stopVoices();
  au.voiceSpan("narrator", "q3", false);
  await sleep(500);
  if (au.voiceLog().some((e) => e.key === "trust-fall-q2" && e.ev === "start")) fail(`${name}: a line queued in one scene was spoken in the next`);
  else ok(`${name}: stopVoices drops what was waiting`);
  const before = au.voiceOverlaps().length;
  au.voiceSpan("narrator", "x", true);
  au.voiceSpan("argus", "x", true);
  if (au.voiceOverlaps().length !== before + 1) fail(`${name}: two voices opened at once weren't reported as an overlap`);
  else ok(`${name}: two voices at once are reported as an overlap`);
  if (errors.length) fail(`${name}: page errors ${errors.join(" | ")}`);
  close();
}

// 5. The data: every scene's talking shots start after its narration, and no two overlap.
{
  let n = 0;
  for (const [sid, sc] of Object.entries(DATA.scenes)) {
    if (!sc.voice) continue;
    n++;
    let end = sc.voice.narr;
    for (const k of sc.voice.talks || []) {
      if (k.start < end) fail(`trust-fall/${sid}: talking shot ${k.i + 1} starts at ${k.start} s, before the voice ahead of it ends at ${end} s`);
      end = Math.max(end, k.end);
    }
  }
  if (!n) fail("the story data has no scene.voice: run npm run story");
  else ok(`${n} scenes carry their voice timing (js/story-data.js)`);
}

console.log(`${passed} check(s) passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
