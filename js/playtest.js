/* Hawkes playtest hooks (contract v1, spec: C:\Projects\hawkesstudio\docs\playtest.md).
   Nothing here runs until the runner calls window.hawkesPlaytest.start() or the URL has
   ?playtest=<id>. Everything is driven from the home page, so a run never has to survive a
   page load: the home page is the landing page (a card per story) and the player (js/game.js)
   opens the story you choose on the same page; the branch pages and blog posts open in a
   full-screen frame laid over it while a run is going, then the frame is removed.
   The bot clicks the same cards, buttons and links a viewer does. */
import { installPlaytest } from "./hawkes-playtest.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);

// The stories and their branch pages (one folder per scene), from js/story-data.js (built from story/stories.json
// and story/<id>.json by tools/build-story.mjs, the same data the player uses). A crawl starts at a story's start page.
const FIRST = "final-spark"; // The Final Spark: the smoke, sound and credits runs play it
const allStories = () => (window.ILTV_STORIES && window.ILTV_STORIES.stories) || [];
const listedStories = () => allStories().filter((s) => s.listed);
const storyOf = (id) => allStories().find((s) => s.id === id);
const story = (id = FIRST) => storyOf(id) || { id, start: "start", scenes: {} };
const folderOf = (id, st = story()) => `/${st.scenes[id].folder}/`;
const branchFolders = (st) => Object.keys(st.scenes).map((id) => folderOf(id, st));
// Stories made on generated media (The Water Road, story/water-road.md): every scene must play its own generated cut.
const MADE = ["water-road"];
const mustPlay = (st) => st.listed || MADE.includes(st.id);
// What Decision tree.txt promises for The Final Spark's opening scenes (checked by hand, not from the data).
const TREE = {
  start: { choices: 2, to: ["deadEnd", "sewerWater"] },
  deadEnd: { choices: 2, to: ["direction", "sludge"] },
  direction: { choices: 2, to: ["deadEnd", "sewerWater"] },
  sludge: { state: "dead", to: ["start"] },
  sewerWater: { choices: 2 },
};

const spark = () => window.finalSpark;
const stories = () => window.iltvStories;
const sceneId = () => spark() && spark().scene();
const choiceButtons = () => [...document.querySelectorAll("#spark-choices .choice")];
const enText = (el) => ((el && (el.querySelector(".spot-en") || el).textContent) || "").trim();

/* ---------------- videos ---------------- */

const MEDIA_ERR = { 1: "aborted", 2: "network error", 3: "decode error", 4: "not found or unsupported" };

/** The video loads (metadata and a frame), then plays for `seconds`. Returns true when it did.
    `autoplay`: the player's videos must start by themselves (muted if the browser wants a tap for sound). */
async function checkVideo(t, video, where, seconds = 2, { autoplay = false } = {}) {
  if (!video) {
    t.problem("bug", `${where}: no video`);
    return false;
  }
  const src = decodeURI(new URL(video.currentSrc || video.src, location.href).pathname);
  const t0 = performance.now();
  const ready = () => video.readyState >= 2 && isFinite(video.duration) && video.duration > 0;
  const already = ready();
  const loaded = await waitFor(() => video.error || ready(), 20000);
  if (video.error || !loaded) {
    const why = video.error ? MEDIA_ERR[video.error.code] || `error ${video.error.code}` : `readyState ${video.readyState} after 20 s`;
    t.problem("bug", `${where}: video ${src} didn't load (${why})`);
    return false;
  }
  t.add("videosLoaded");
  const loadMs = Math.round(performance.now() - t0);
  if (!already) t.metric("lastVideoLoadMs", loadMs);
  t.log(`${where}: ${src} ${video.duration.toFixed(1)} s, ${already ? "already loaded" : `loaded in ${loadMs} ms`}, at ${video.currentTime.toFixed(1)} s${video.paused ? ", paused" : ""}${video.muted ? ", muted" : ""}`);

  if (autoplay && !video.ended) {
    const t1 = video.currentTime;
    const moving = await waitFor(() => !video.paused && video.currentTime > t1 + 0.3, 3000);
    if (!moving) t.problem("bug", `${where}: video ${src} doesn't start by itself (stuck at ${video.currentTime.toFixed(1)} s${video.paused ? ", paused" : ""}): it shows one frozen frame until a tap`);
  }

  const start = video.currentTime;
  if (video.paused) {
    // A viewer taps the page; the player's own tap-to-unmute handler listens for pointerdown.
    video.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    try {
      await video.play();
    } catch {
      // Unmuted autoplay is up to the browser. Muted playback is always allowed, and it still
      // proves the file plays.
      t.event("autoplay-blocked", where);
      video.muted = true;
      try {
        await video.play();
      } catch {}
    }
  }
  const want = Math.min(seconds, Math.max(0.2, video.duration - start - 0.1));
  const played = await waitFor(() => video.error || video.currentTime - start >= want, 15000);
  if (video.error || !played) {
    t.problem("bug", `${where}: video ${src} won't play (at ${video.currentTime.toFixed(1)} s${video.error ? ", " + MEDIA_ERR[video.error.code] : ""})`);
    return false;
  }
  t.add("videosPlayed");
  t.metric("lastVideoTime", Number(video.currentTime.toFixed(1)));
  return true;
}

/** A made story's scene plays its generated cut (<folder>/scene.mp4): 9:16, with its sound (narration and music). */
function checkCut(t, video, where) {
  const src = decodeURI(new URL(video.currentSrc || video.src, location.href).pathname);
  const ratio = video.videoWidth / video.videoHeight;
  if (!/\/scene\.mp4$/.test(src)) t.problem("bug", `${where}: plays ${src}, not its generated cut (scene.mp4)`);
  if (!(Math.abs(ratio - 9 / 16) < 0.01)) t.problem("bug", `${where}: the video is ${video.videoWidth}×${video.videoHeight}, not 9:16`);
  // Chromium counts the audio it decoded: the cut's narration and music. (Muted playback still decodes.)
  const heard = video.webkitAudioDecodedByteCount;
  if (heard === 0) t.problem("bug", `${where}: ${src} has no sound (no narration or music)`);
  t.event("cut", `${where}: ${src} ${video.videoWidth}×${video.videoHeight}, ${video.duration.toFixed(1)} s${heard ? `, ${heard} bytes of sound` : ""}`);
  t.add("cutsPlayed");
}

/** The story's words (title, story, question, choices) never say an `unspoken` word: the dove is only in the pictures. */
function checkUnspoken(t, st, root, where) {
  const said = (root.textContent || "").toLowerCase();
  for (const w of st.unspoken || []) if (new RegExp(`\\b${w.toLowerCase()}`).test(said)) t.problem("bug", `${where}: the page says "${w}" (${st.title} never says it)`);
}

function waitFor(test, ms) {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      let ok = false;
      try {
        ok = !!test();
      } catch {}
      if (ok) return resolve(true);
      if (performance.now() - t0 > ms) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

/* ---------------- the Tap to play prompt and Settings (js/hawkes-sound.js) ---------------- */

const SOUND_KEY = "hawkes.sound";
const SOUND_RUN = "iltv.playtest.sound"; // sessionStorage: the sound scenario carries on after its reload
const soundOf = (doc = document) => doc.defaultView && doc.defaultView.hawkesSound;

/** A press where a viewer's finger or mouse would go: whatever is on top there gets it, so a covered control fails. */
async function tapAt(t, el, label) {
  if (!el) throw new Error(`${label} is not on the page`);
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const target = doc.elementFromPoint(x, y) || el;
  if (!el.contains(target)) t.problem("bug", `${label} is covered: a press on it lands on ${target.id ? "#" + target.id : target.tagName.toLowerCase()}`);
  const touch = win.matchMedia("(pointer: coarse)").matches;
  const init = { pointerType: touch ? "touch" : "mouse", pointerId: touch ? 51 : 1, isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: win };
  target.dispatchEvent(new win.PointerEvent("pointerdown", init));
  target.dispatchEvent(new win.MouseEvent("mousedown", init));
  await sleep(60);
  target.dispatchEvent(new win.PointerEvent("pointerup", { ...init, buttons: 0 }));
  target.dispatchEvent(new win.MouseEvent("mouseup", { ...init, buttons: 0 }));
  target.dispatchEvent(new win.MouseEvent("click", { ...init, buttons: 0 }));
  t.log(`tap ${label}`);
  await sleep(120);
}

/** The prompt's line says the saved Sound setting: "Sound on." or "Sound off.", never "Sound on." over a saved Off. */
function checkNote(t, doc, where) {
  const sound = soundOf(doc);
  const note = sound && sound.prompt() && sound.prompt().querySelector(".tap-note");
  if (!note) return t.problem("bug", `${where}: the Tap to play prompt has no sound line`);
  const on = sound.settings().on;
  const says = note.textContent.trim();
  if (!says.startsWith(on ? "Sound on" : "Sound off")) t.problem("bug", `${where}: the Tap to play prompt says "${says}" but the saved setting is Sound ${on ? "on" : "off"}`);
  t.event("tap-note", `${where}: "${says}" (saved: Sound ${on ? "on" : "off"})`);
}

/** Settings from the Tap to play prompt's own button (before the tap): Sound off or on, then Done. */
async function gateSound(t, doc, on, where) {
  const sound = soundOf(doc);
  const byId = (id) => doc.getElementById(id);
  await tapAt(t, sound.prompt().querySelector(".tap-settings"), `Settings on the prompt (${where})`);
  if (!(await waitFor(() => sound.state().settingsOpen, 3000))) throw new Error(`the prompt's Settings didn't open (${where})`);
  if (!sound.prompt()) t.problem("bug", `${where}: the prompt's Settings button counted as the tap`);
  await sleep(500);
  if (sound.settings().on !== on) await tapAt(t, byId("sound-on"), `Sound ${on ? "on" : "off"} (${where})`);
  await sleep(400);
  await tapAt(t, byId("sound-done"), `Done (${where})`);
  await sleep(300);
  const saved = JSON.parse(doc.defaultView.localStorage.getItem(SOUND_KEY) || "null");
  if (!saved || saved.on !== on) t.problem("bug", `${where}: Sound ${on ? "on" : "off"} from the prompt wasn't saved: ${JSON.stringify(saved)}`);
  else t.event("setting-saved", `${where}: ${JSON.stringify(saved)}`);
}

/** The prompt covers the whole screen, then a tap on it makes it go. Every scenario starts here, like a viewer.
    The home page's landing page has no prompt: its title splash fades by itself, and the run waits for it. */
async function passPrompt(t, doc = document, where = "home") {
  const sound = soundOf(doc);
  if (!sound) {
    t.problem("bug", `${where}: no sound setup (js/hawkes-sound.js isn't loaded)`);
    return false;
  }
  if (doc === document && stories() && stories().view() === "landing") return passSplash(t, where);
  const prompt = sound.prompt();
  if (!prompt) {
    if (!sound.unlocked()) t.problem("bug", `${where}: no Tap to play prompt when the page loads`);
    return sound.unlocked();
  }
  const r = prompt.getBoundingClientRect();
  const win = doc.defaultView;
  if (r.width < win.innerWidth - 2 || r.height < win.innerHeight - 2) t.problem("bug", `${where}: the Tap to play prompt doesn't cover the screen (${Math.round(r.width)}x${Math.round(r.height)} of ${win.innerWidth}x${win.innerHeight})`);
  checkNote(t, doc, where);
  await tapAt(t, prompt.querySelector(".tap-button") || prompt, `Tap to play (${where})`);
  const gone = await waitFor(() => !sound.prompt(), 3000);
  if (!gone) t.problem("bug", `${where}: the Tap to play prompt stays up after a tap`);
  t.event("tap-to-play", `${where}: audio ${sound.state().audio}`);
  return gone;
}

const SPLASH_WAIT = 6000; // the splash holds about 1.6 s and fades in 0.9 s

/** The landing page's title splash: the site's title alone (no Tap to play, no sound line) on the prompt's
    background, covering the screen; nothing to tap: it fades away by itself and leaves the stories. A run that
    starts after it has gone reads what hawkes-sound.js recorded of it. */
async function passSplash(t, where = "home") {
  const sound = soundOf();
  const title = document.documentElement.getAttribute("data-tap-title") || "";
  if (sound.prompt()) t.problem("bug", `${where}: the landing page shows a Tap to play prompt, not the title splash`);
  const el = $("title-splash");
  if (el && sound.state().splash === "shown") {
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth - 2 || r.height < innerHeight - 2) t.problem("bug", `${where}: the title splash doesn't cover the screen (${Math.round(r.width)}x${Math.round(r.height)} of ${innerWidth}x${innerHeight})`);
    const says = el.textContent.replace(/\s+/g, " ").trim();
    if (says !== title) t.problem("bug", `${where}: the title splash says "${says}", not just "${title}"`);
    if (el.querySelector(".tap-button, .tap-note, .tap-settings")) t.problem("bug", `${where}: the title splash has Tap to play, a sound line or Settings on it`);
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === "none") t.problem("warning", `${where}: the title splash hasn't the prompt's background`);
    t.event("splash", `${where}: "${says}"`);
    // No tap: it goes by itself.
    if (!(await waitFor(() => !$("title-splash"), SPLASH_WAIT))) t.problem("bug", `${where}: the title splash is still up after ${SPLASH_WAIT / 1000} s (it should fade by itself)`);
  } else if (!sound.state().splashes) {
    t.problem("bug", `${where}: no title splash when the landing page loads`);
    return false;
  } else await waitFor(() => !$("title-splash"), SPLASH_WAIT);
  const log = sound.state().splashLog;
  if (log) {
    if (log.title !== title) t.problem("bug", `${where}: the title splash said "${log.title}", not "${title}"`);
    if (log.fading == null || log.gone == null) t.problem("bug", `${where}: the title splash never went away`);
    else {
      const fade = log.gone - log.fading;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced && fade < 300) t.problem("bug", `${where}: the title splash vanished (${fade} ms) instead of fading out`);
      t.event("splash-gone", `${where}: held ${log.fading - log.shown} ms, faded ${fade} ms`);
      t.metric("splashMs", log.gone - log.shown);
    }
  }
  if (sound.prompt()) t.problem("bug", `${where}: a Tap to play prompt is up on the landing page after the splash`);
  if (document.documentElement.classList.contains("is-tap-waiting")) t.problem("bug", `${where}: the page still can't scroll after the splash`);
  checkInventory(t, where);
  return true;
}

const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

/** The inventory is the open story's: none on the landing page; The Final Spark's flashlight (js/spot.js) in its
    player; a story with its own `inventory` (js/kit.js) shows that bar instead, and no flashlight. */
function checkInventory(t, where, doc = document) {
  const torchBar = doc.querySelector(".inventory:not(.kit)");
  const kitBar = doc.querySelector(".inventory.kit");
  const torch = doc.getElementById("torch");
  if (doc === document && landingShown()) {
    if (shown(torchBar) || shown(torch) || shown(kitBar)) t.problem("bug", `${where}: the landing page shows an inventory`);
    else t.event("no-inventory", `${where}: landing page`);
    return;
  }
  const id = doc === document ? stories().current() : doc.documentElement.getAttribute("data-kit") || FIRST;
  const st = storyOf(id);
  if (st && st.inventory) {
    if (!shown(kitBar) || !kitBar.querySelector(".kit-item")) t.problem("bug", `${where}: ${id} is open but its inventory (${st.inventory.items.map((i) => i.name).join(", ")}) isn't shown`);
    else if (shown(torchBar) || shown(torch)) t.problem("bug", `${where}: ${id} shows The Final Spark's flashlight`);
    else t.event("inventory", `${where}: ${id} (${kitText(kitBar)})`);
  } else if (!shown(torchBar) || !shown(doc.getElementById("torch-slot"))) t.problem("bug", `${where}: ${id} is open but its inventory (the flashlight) isn't shown`);
  else if (shown(kitBar)) t.problem("bug", `${where}: ${id} shows another story's inventory`);
  else t.event("inventory", `${where}: ${id}`);
}

/* ---------------- a story's own inventory (js/kit.js): the counts the data gives, at every scene ---------------- */

/** What the data says you hold after walking `chain` (scene ids from the start), worked out here on its own (not
    with js/kit.js): every item's start, each scene's change ({ n } adds, { set: n } sets), kept between 0 and the
    item's max; back at the start, the counts start over. */
function expectKit(st, chain) {
  const items = st.inventory.items.filter((i) => typeof i.start === "number");
  const fresh = () => Object.fromEntries(items.map((i) => [i.id, i.start]));
  let now = fresh();
  for (const id of chain) {
    if (id === st.start) now = fresh();
    const changes = st.scenes[id].inventory || {};
    for (const i of items) {
      const c = changes[i.id];
      let v = now[i.id];
      if (c && typeof c === "object") v = c.set;
      else if (typeof c === "number") v += c;
      now[i.id] = Math.max(0, Math.min(i.max ?? Infinity, v));
    }
  }
  return now;
}

/** The counts a bar shows ({ item: n }), from its count and, for rounds, the rounds still lit. */
function shownKit(bar) {
  const out = {};
  if (!bar) return out;
  bar.querySelectorAll(".kit-item[data-item]").forEach((el) => {
    const count = el.querySelector(".kit-count");
    if (!count) return;
    out[el.dataset.item] = Number(count.textContent.split("/")[0]);
    const rounds = el.querySelectorAll(".kit-round");
    if (rounds.length) out[el.dataset.item + ":rounds"] = rounds.length - el.querySelectorAll(".kit-round.is-spent").length;
  });
  return out;
}
const kitText = (bar) => Object.entries(shownKit(bar)).filter(([k]) => !k.includes(":")).map(([k, v]) => `${k} ${v}`).join(", ");

/** The bar on `doc` shows exactly what the data gives for `chain`. */
function checkKit(t, st, chain, where, doc = document) {
  if (!st.inventory) return;
  const want = expectKit(st, chain);
  const bar = doc.querySelector(".inventory.kit");
  const got = shownKit(bar);
  if (doc === document && !shown(bar)) return t.problem("bug", `${where}: the inventory isn't shown`);
  const wrong = Object.entries(want).filter(([k, v]) => got[k] !== v || (`${k}:rounds` in got && got[`${k}:rounds`] !== v));
  if (wrong.length) t.problem("bug", `${where}: the inventory shows ${wrong.map(([k]) => `${k} ${got[k]}${`${k}:rounds` in got ? ` (${got[`${k}:rounds`]} rounds lit)` : ""}`).join(", ")}; the data gives ${wrong.map(([k, v]) => `${k} ${v}`).join(", ")} (via ${chain.join(" > ")})`);
  else t.add("inventoryChecked");
  if (doc === document && spark().inventory) {
    const api = spark().inventory() || {};
    if (Object.entries(want).some(([k, v]) => api[k] !== v)) t.problem("bug", `${where}: finalSpark.inventory() says ${JSON.stringify(api)}, the data gives ${JSON.stringify(want)}`);
  }
}

/* ---------------- the player on the home page ---------------- */

// Every story keeps two cookies (js/game.js): its run (`cookie`: { scene, history }) and its unlocks
// (`<cookie>Unlocked`: { seen, completed }, every scene reached in the player). A run puts them all back as they were
// (and the URL: the run leaves the page on the landing page or the story it was on).
const unlocksCookie = (st) => `${st.cookie}Unlocked`;
const cookiesOf = (st) => [st.cookie, unlocksCookie(st)];
let savedCookie = null; // { name: "name=value" or "" }
function rememberProgress() {
  const jar = document.cookie.split(";").map((s) => s.trim());
  savedCookie = Object.fromEntries(allStories().flatMap(cookiesOf).map((name) => [name, jar.find((c) => c.startsWith(name + "=")) ?? ""]));
}
function restoreProgress() {
  if (savedCookie == null) return;
  for (const [name, value] of Object.entries(savedCookie)) {
    document.cookie = value ? `${value}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax` : `${name}=; Max-Age=0; Path=/`;
  }
  savedCookie = null;
}

/* ---------------- the landing page ---------------- */

// Every card wears the viewer's own progress in its story (js/game.js, from the story's cookies): Not started
// (nothing reached), Started (opened), Completed (an ending reached once: a scene with an "ending"; deaths aren't),
// and how much of it is explored (unlocked scenes / all, rounded down). Completed stories show Start Over; otherwise
// the button follows the run: Play (none, or at the start), Continue (mid-run), Start Over (at an ending).
const BADGE = { new: "Not started", started: "Started", completed: "Completed" };
const GO = { start: "Play", mid: "Continue", end: "Start Over" };
/** A fresh browser: every story's run and unlocks forgotten. */
function clearProgress() {
  for (const name of allStories().flatMap(cookiesOf)) document.cookie = `${name}=; Max-Age=0; Path=/`;
}

/** What a story's unlocks cookie holds ({ seen, completed }), or null. */
function savedUnlocks(st) {
  return readJsonCookie(unlocksCookie(st));
}

/** The percent explored the data and the unlocks cookie give: unlocked scenes / all, rounded down. */
function exploredWant(st) {
  const seen = new Set((savedUnlocks(st)?.seen || []).filter((id) => st.scenes[id]));
  return Math.floor((seen.size * 100) / Object.keys(st.scenes).length);
}

/** Where the run cookie says the story's run is: start (none, or at the first page), mid or end (an ending). */
function runWant(st) {
  const run = savedPlace(st);
  if (!run || !st.scenes[run.scene] || run.scene === st.start) return "start";
  return st.scenes[run.scene].ending ? "end" : "mid";
}

/** A card's badge says `want` (new, started, completed), visible across the card's top right corner. */
function checkBadge(t, card, st, want, where) {
  const ribbon = card && card.querySelector(".story-card-ribbon");
  const win = ribbon && ribbon.ownerDocument.defaultView;
  if (!ribbon || !ribbon.getClientRects().length || win.getComputedStyle(ribbon).visibility === "hidden") {
    t.problem("bug", `${where}: ${st.title}'s card has no progress badge (it should say ${BADGE[want]})`);
    return false;
  }
  const says = ribbon.textContent.trim();
  if (says !== BADGE[want] || card.dataset.progress !== want) {
    t.problem("bug", `${where}: ${st.title}'s card says "${says}" (${card.dataset.progress}), not "${BADGE[want]}"`);
    return false;
  }
  // Completed stories always say Start Over; otherwise the button follows the run, and its percent the unlocks.
  const go = (card.querySelector(".story-card-go")?.textContent || "").trim();
  const label = want === "completed" ? "Start Over" : GO[runWant(st)];
  if (go !== label) t.problem("bug", `${where}: ${st.title}'s card is ${want} (run at ${runWant(st)}) but its button says "${go}", not "${label}"`);
  const explored = (card.querySelector(".story-card-explored")?.textContent || "").trim();
  const pct = `${exploredWant(st)}% explored`;
  if (explored !== pct) t.problem("bug", `${where}: ${st.title}'s card says "${explored || "nothing"}", its unlocks give "${pct}"`);
  const r = ribbon.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  if (r.right < c.right - 1 && r.top > c.top + 1) t.problem("bug", `${where}: ${st.title}'s badge isn't across the card's corner`);
  if (card.ownerDocument === document && stories().progress && stories().progress(st.id) !== want) t.problem("bug", `${where}: iltvStories.progress("${st.id}") says ${stories().progress(st.id)}, the card ${want}`);
  t.event("badge", `${where}: ${st.id} ${says}, ${explored}, ${go}`);
  return true;
}

/** The home page loaded fresh in the frame (a reload): every listed story's card says `want(st)`. */
async function badgesAfterLoad(t, want, where) {
  const doc = await frameLoad(t, (f) => (f.src = "/"));
  const win = frame && frame.contentWindow;
  if (!doc || !(await waitFor(() => win.iltvStories && doc.querySelector("#story-list a.story-card[data-progress]"), 10000))) {
    t.problem("bug", `${where}: the home page didn't load in the frame`);
    closeFrame();
    return;
  }
  await sleep(300);
  for (const st of listedStories()) checkBadge(t, doc.querySelector(`#story-list a.story-card[data-story="${st.id}"]`), st, want(st), where);
  await sleep(600); // on screen for the footage
  closeFrame();
}

/** The shortest way from the start (not through a death) to a scene that passes `test`: the scene ids after the start. */
function wayTo(st, test) {
  const from = { [st.start]: null };
  const queue = [st.start];
  while (queue.length) {
    const id = queue.shift();
    if (id !== st.start && test(st.scenes[id])) {
      const way = [];
      for (let at = id; at !== st.start; at = from[at]) way.unshift(at);
      return way;
    }
    if (st.scenes[id].dead) continue;
    for (const c of st.scenes[id].choices) if (!(c[2] in from) && st.scenes[c[2]]) (from[c[2]] = id), queue.push(c[2]);
  }
  return null;
}

/** Plays a way through the open story from where it is, clicking the choice that leads to each next scene. */
async function playWay(t, st, way) {
  for (const next of way) {
    const at = st.scenes[sceneId()];
    const i = at.choices.findIndex((c) => c[2] === next);
    const button = choiceButtons()[i];
    if (i < 0 || !button) throw new Error(`${st.id}: no choice from ${sceneId()} to ${next}`);
    button.click();
    await sleep(150);
    if (sceneId() !== next) throw new Error(`${st.id}: the choice "${enText(button)}" didn't open ${next} (on ${sceneId()})`);
  }
}

/** Opens a story the way its shared link does, /?story=<id> (the player follows the address): its saved place,
    whatever its card says. */
function openByLink(t, id) {
  window.history.pushState({ story: id }, "", `/?story=${id}`);
  window.dispatchEvent(new PopStateEvent("popstate", { state: { story: id } }));
}

function readJsonCookie(name) {
  const item = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  try {
    return item ? JSON.parse(decodeURIComponent(item.slice(name.length + 1))) : null;
  } catch {
    return null;
  }
}

/** A story's current run as its cookie holds it ({ scene, history }), or null. */
function savedPlace(st) {
  return readJsonCookie(st.cookie);
}

const landingShown = () => !$("stories").hidden && $("spark").hidden;
const cardOf = (id) => document.querySelector(`#story-list a.story-card[data-story="${id}"]`);

/** Opens a story from its card on the landing page, a viewer's tap (hit-tested). Its own Tap to play prompt comes
    up (until sound is unlocked) and is tapped, unless `tap` is false (the caller does it). */
async function openStory(t, id, { tap = true } = {}) {
  if (stories().current() === id && !$("spark").hidden) return;
  if (!landingShown()) await toLanding(t);
  const card = cardOf(id);
  if (card) {
    card.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(200);
    await tapAt(t, card.querySelector("h2") || card, `the ${story(id).title} card`);
  } else if (!story(id).listed) {
    // A draft has no card: it opens the way its shared link does.
    openByLink(t, id);
    t.log(`open ${id} by its link (a draft: no card)`);
  } else throw new Error(`the landing page has no card for ${id}`);
  await sleep(300);
  if (stories().current() !== id) throw new Error(`${card ? `the ${story(id).title} card` : `/?story=${id}`} didn't open the story (open: ${stories().current()})`);
  if ($("spark").hidden) t.problem("bug", `${id}: the card opened the story but the player is hidden`);
  if (new URL(location.href).searchParams.get("story") !== id) t.problem("bug", `${id}: the address doesn't say ?story=${id} (a reload would lose the story)`);
  t.event("story-open", `${id} (${story(id).title})`);
  const sound = soundOf();
  if (sound.prompt()) {
    const promptTitle = (sound.prompt().querySelector(".tap-title")?.textContent || "").trim();
    if (promptTitle !== story(id).tap.title) t.problem("bug", `${id}: the Tap to play prompt says "${promptTitle}", not "${story(id).tap.title}"`);
    if (tap) await passPrompt(t, document, id);
  } else if (!sound.unlocked()) t.problem("bug", `${id}: the story opened without its Tap to play prompt (sound is still locked)`);
  document.querySelector("#spark").scrollIntoView({ block: "start", behavior: "instant" });
}

/** Back to the landing page with the player's "All stories" link. */
async function toLanding(t) {
  if (landingShown()) return;
  await tapAt(t, $("spark-stories"), "All stories");
  await sleep(300);
  if (!landingShown()) throw new Error("All stories didn't bring the landing page back");
  if (document.querySelector("#spark-video video")) t.problem("bug", "the story's video is still on the page after All stories");
  t.event("landing", "All stories");
}

/** The player has no Back button (J, 2026-10-18: players own their choices; a death means starting over). */
function checkNoBack(t, where) {
  if ($("spark-back") || document.querySelector("#spark .back-button")) t.problem("bug", `${where}: the player has a Back button (there's no stepping back to undo a choice)`);
}

/** PLAY/TREE tabs and the settings gear button have at least 44x44px hit targets on mobile and desktop. */
function checkHitTargets(t, doc = document, where = "player") {
  const targets = [
    ["#tab-play", "PLAY tab"],
    ["#tab-tree", "TREE tab"],
    ["#sound-gear", "Settings gear"],
  ];
  const sizes = [];
  for (const [sel, name] of targets) {
    const el = doc.querySelector(sel);
    if (!el || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w < 44 || h < 44) t.problem("bug", `${where}: ${name} (${sel}) is ${w}x${h}px, smaller than 44x44px`);
    else sizes.push(`${name} ${w}x${h}px`);
  }
  if (sizes.length) t.event("hit-targets", `${where}: ${sizes.join(", ")}`);
}

/** Recent Posts rows in the blog sidebar: each row is a flex row (thumbnail + min-width: 0 flex column) with the title above the date on its own line. */
function checkRecentPosts(t, doc, where) {
  const rows = [...doc.querySelectorAll(".recent-list li > a")];
  if (!rows.length) return;
  const win = doc.defaultView;
  let checked = 0;
  for (const a of rows) {
    const aStyle = win.getComputedStyle(a);
    const col = a.querySelector(":scope > span");
    const title = col && col.querySelector(":scope > strong");
    const date = col && col.querySelector(":scope > span");
    if (!col || !title || !date) {
      t.problem("bug", `${where}: Recent Posts item is missing its text column, title or date`);
      continue;
    }
    const colStyle = win.getComputedStyle(col);
    if (aStyle.display !== "flex") t.problem("bug", `${where}: Recent Posts row is display "${aStyle.display}", not flex`);
    if (colStyle.display !== "flex" || colStyle.flexDirection !== "column" || colStyle.minWidth !== "0px") {
      t.problem("bug", `${where}: Recent Posts text column is ${colStyle.display}/${colStyle.flexDirection} (min-width ${colStyle.minWidth}), not a min-width: 0 flex column`);
    }
    const tr = title.getBoundingClientRect();
    const dr = date.getBoundingClientRect();
    if (dr.top < tr.bottom - 1 || Math.abs(dr.left - tr.left) > 2) {
      t.problem("bug", `${where}: Recent Posts date isn't stacked cleanly below the title (title bottom ${Math.round(tr.bottom)}, date top ${Math.round(dr.top)}, lefts ${Math.round(tr.left)} vs ${Math.round(dr.left)})`);
    } else checked++;
  }
  if (checked) t.event("recent-posts", `${where}: ${checked}/${rows.length} rows stacked (title above date)`);
}

/** Back to the story's first page, a new run: there's no Back and the Tree can't be pressed, so the bot does what
    Start Over does: the story's run cookie goes (its unlocks stay) and the story opens again by its link. */
async function toStart(t, { quiet = false } = {}) {
  const id = spark().story();
  const start = spark().start();
  $("tab-play").click();
  if (sceneId() === start && spark().depth() === 0) return;
  const unlocked = spark().unlocked().length;
  document.cookie = `${story(id).cookie}=; Max-Age=0; Path=/`;
  window.history.replaceState({ story: id }, "", `/?story=${id}`);
  window.dispatchEvent(new PopStateEvent("popstate", { state: { story: id } }));
  await sleep(200);
  if (soundOf().prompt()) await passPrompt(t, document, id);
  if (sceneId() !== start || spark().depth() !== 0) throw new Error(`${id}: a new run opened ${sceneId()} (${spark().depth()} steps in), not the start`);
  if (spark().unlocked().length !== unlocked) t.problem("bug", `${id}: a new run changed the unlocked scenes (${unlocked} -> ${spark().unlocked().length}): they must stay`);
  if (!quiet) t.event("reset", `${id}: ${start} (a new run, unlocks kept)`);
}

/** The Tree tab is a map of what you've found (J, 2026-10-18: no cheating): a node for each unlocked scene (the
    current one marked), a locked "?" for each choice from one of them to a scene not reached yet, with nothing
    below it and nothing of that scene in it, and nothing in it can be pressed. */
async function checkTree(t, st, where) {
  const before = sceneId();
  $("tab-tree").click();
  await sleep(200);
  const tree = $("spark-tree");
  const unlocked = new Set(spark().unlocked());
  const nodes = [...tree.querySelectorAll(".tree-node")];
  const shown = nodes.filter((n) => n.dataset.scene).map((n) => n.dataset.scene);
  const locked = nodes.filter((n) => n.classList.contains("is-locked"));
  // The scenes the tree can draw: the unlocked ones reachable from the start through unlocked scenes.
  const reach = new Set();
  const queue = unlocked.has(st.start) ? [st.start] : [];
  let ways = 0;
  while (queue.length) {
    const id = queue.shift();
    if (reach.has(id)) continue;
    reach.add(id);
    for (const c of st.scenes[id].choices) {
      if (!st.scenes[c[2]]) continue;
      if (unlocked.has(c[2])) queue.push(c[2]);
      else ways++;
    }
  }
  if (tree.querySelector("button, a[href], [tabindex], [onclick]")) t.problem("bug", `${where}: the Tree has something to press (it's a map now: no node opens a scene)`);
  shown.filter((id) => !unlocked.has(id)).forEach((id) => t.problem("bug", `${where}: the Tree shows ${id}, which the player hasn't reached`));
  [...reach].filter((id) => !shown.includes(id)).forEach((id) => t.problem("bug", `${where}: the Tree is missing ${id}, which the player has reached`));
  if (locked.length !== ways) t.problem("bug", `${where}: the Tree has ${locked.length} locked "?", there are ${ways} ways not taken`);
  // A locked node is a "?" and the choice that leads there (on the page already): no id, title, death or ending.
  for (const n of locked) {
    const extra = [...n.children].filter((c) => !c.matches(".tree-node-title, .tree-node-via"));
    if (n.dataset.scene || extra.length || (n.querySelector(".tree-node-title")?.textContent || "").trim() !== "?" || n.className.trim() !== "tree-node is-locked") t.problem("bug", `${where}: a locked node gives its scene away (${n.outerHTML.slice(0, 160)})`);
  }
  const current = nodes.filter((n) => n.classList.contains("is-current")).map((n) => n.dataset.scene);
  if (current.join() !== before) t.problem("bug", `${where}: the Tree marks ${current.join(", ") || "nothing"} as current, not ${before}`);
  // Pressing a node does nothing (the old Tree opened any scene from it).
  const target = nodes.find((n) => n.dataset.scene && n.dataset.scene !== before) || locked[0];
  if (target) {
    target.click();
    await sleep(150);
    if (sceneId() !== before || $("spark-tree").hidden) t.problem("bug", `${where}: pressing a Tree node changed the scene or left the Tree (${before} -> ${sceneId()})`);
  }
  t.event("tree", `${where}: ${shown.length} found, ${locked.length} locked`);
  $("tab-play").click();
  await sleep(100);
}

/** The percent explored the player shows, against the unlocked scenes. */
function checkExplored(t, st, want, where) {
  const got = spark().explored();
  const text = ($("spark-explored")?.textContent || "").trim();
  if (got !== want || text !== `${want}% explored`) t.problem("bug", `${where}: the player says "${text}" (explored() ${got}), the unlocked scenes give ${want}%`);
}

function stopVideos() {
  document.querySelectorAll("video").forEach((v) => {
    try {
      v.pause();
    } catch {}
  });
}

async function smoke(options, t) {
  rememberProgress();
  t.scene("Home");
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  if (!landingShown()) await toLanding(t);
  t.scene("Choose your story");
  const cards = [...document.querySelectorAll("#story-list a.story-card")];
  if (!cards.length) t.problem("bug", "the landing page shows no stories");
  t.metric("stories", cards.length);
  t.note(`${cards.length} stories: ${cards.map((c) => c.querySelector("h2")?.textContent.trim()).join(" / ")}`);
  await sleep(800);
  await openStory(t, FIRST);
  await toStart(t);
  await checkTree(t, story(FIRST), "The Final Spark's Tree");
  t.scene("The sewer");
  t.progress(0.2);
  const ok = await checkVideo(t, document.querySelector("#spark-video video"), "start", 3, { autoplay: true });
  t.progress(0.6);
  const buttons = choiceButtons();
  if (!buttons.length || buttons.some((b) => b.offsetParent === null)) t.problem("bug", "start: no visible choices");
  t.metric("choices", buttons.length);
  t.note(`${buttons.length} choices: ${buttons.map(enText).join(" / ")}`);
  if (ok && buttons.length) {
    // One step in (there's no Back: a choice stands).
    const storyBefore = $("spark-story").textContent;
    buttons[0].click();
    await sleep(300);
    t.event("choice", `${enText(buttons[0])} -> ${sceneId()}`);
    if (sceneId() === "start") t.problem("bug", `start: "${enText(buttons[0])}" goes nowhere`);
    else if ($("spark-story").textContent === storyBefore) t.problem("bug", `${sceneId()}: the page text didn't change after "${enText(buttons[0])}"`);
    else await checkVideo(t, document.querySelector("#spark-video video"), sceneId(), 1, { autoplay: true });
  }
  checkNoBack(t, "The Final Spark");
  checkHitTargets(t, document, "The Final Spark");
  await toLanding(t);
  t.progress(1);
}

async function branches(options, t) {
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  // A fresh browser: nothing unlocked, so the walk must unlock every scene (and only then 100%).
  clearProgress();
  const list = allStories(); // the drafts too (opened by their link)
  const total = list.reduce((n, st) => n + Object.keys(st.scenes).length, 0);
  const sums = { scenes: 0, endings: 0, deaths: 0 };
  t.metric("stories", list.length);
  t.metric("scenes", total);
  for (const st of list) {
    t.scene(st.title);
    await openStory(t, st.id);
    checkHitTargets(t, document, st.title);
    await walkStory(t, st, sums, total);
    await toLanding(t);
    if (st.listed) {
      checkBadge(t, cardOf(st.id), st, wayTo(st, (s) => !!s.ending) ? "completed" : "started", `after every scene of ${st.title}`);
      await sleep(600);
    }
  }
  t.metric("scenesVisited", sums.scenes);
  t.metric("endings", sums.endings);
  t.metric("deaths", sums.deaths);
  t.progress(1);
}

/** Every scene of the open story, by clicking every choice. The player has no Back, so after each choice the bot
    comes back the way Start Over does: a new run from the start (the run cookie cleared, the unlocks kept), the
    same choices. Every new scene unlocks one more: the percent explored follows, and is 100 only after the last. */
async function walkStory(t, st, sums, total) {
  await toStart(t);
  const all = spark().scenes();
  const seen = new Map(); // id -> { state, choices, to: [] }
  const at = (id) => (st.id === FIRST ? id : `${st.id}/${id}`);
  let noVideo = 0;

  /** To the end of `chain` (scene ids from the start) again, from the start. */
  async function rewalk(chain) {
    await toStart(t, { quiet: true });
    await playWay(t, st, chain.slice(1));
    t.add("rewalks");
  }

  async function visit(id, path, chain) {
    const root = $("spark");
    const info = { state: root.dataset.state, choices: choiceButtons().map(enText), to: [] };
    seen.set(id, info);
    t.scene(at(id));
    checkExplored(t, st, Math.floor((seen.size * 100) / all.length), at(id));
    if (spark().unlocked().length !== seen.size) t.problem("bug", `${at(id)}: ${spark().unlocked().length} scenes unlocked, the bot has reached ${seen.size}`);
    if (seen.size === 1) await checkTree(t, st, `${st.title}'s Tree at the start`);
    t.note(`${st.title}: ${path.join(" > ")}`);
    t.event("scene", `${at(id)} (${info.state}, ${info.choices.length} choices)`);
    t.progress((sums.scenes + seen.size) / total);
    const video = document.querySelector("#spark-video video");
    if (video || st.scenes[id].video || mustPlay(st)) {
      if ((await checkVideo(t, video, at(id), 2, { autoplay: true })) && MADE.includes(st.id)) checkCut(t, video, at(id));
    } else noVideo++;
    if (st.unspoken) checkUnspoken(t, st, root, at(id));
    checkKit(t, st, chain, at(id));
    if (!info.choices.length) {
      if (info.state === "soon") t.event("ending", `${at(id)}: ${enText($("spark-ending"))}`);
      else t.problem("bug", `${at(id)}: dead end with no choices and no ending`);
    }
    if (info.state === "soon" && $("spark-ending").hidden) t.problem("bug", `${at(id)}: the ending text is hidden`);

    for (let i = 0; i < info.choices.length; i++) {
      const button = choiceButtons()[i];
      const label = enText(button);
      button.click();
      await sleep(150);
      const next = sceneId();
      if (next === id) {
        t.problem("bug", `${at(id)}: choice "${label}" goes nowhere`);
        continue;
      }
      info.to.push(next);
      t.add("choicesClicked");
      if (!seen.has(next)) await visit(next, [...path, label], [...chain, next]);
      else checkKit(t, st, [...chain, next], at(next));
      if (i === info.choices.length - 1) break;
      await rewalk(chain);
      t.scene(at(id));
      checkKit(t, st, chain, `${at(id)} (again from the start)`);
    }
  }
  if (st.inventory) checkInventory(t, st.title);
  await visit(st.start, [st.start], [st.start]);
  stopVideos();
  if (noVideo) t.problem("warning", `${st.title}: ${noVideo} scene(s) have no video yet (a draft, not on the landing page)`);
  // Every scene found: the whole tree, nothing locked, 100%.
  await checkTree(t, st, `${st.title}'s Tree, every scene found`);
  if (seen.size === all.length) checkExplored(t, st, 100, `${st.title}, every scene found`);

  // Every scene is reachable, and The Final Spark's opening matches Decision tree.txt.
  all.filter((id) => !seen.has(id)).forEach((id) => t.problem("bug", `${at(id)}: no choice leads here (unreachable)`));
  sums.scenes += seen.size;
  sums.endings += [...seen.values()].filter((s) => s.state === "soon").length;
  sums.deaths += [...seen.values()].filter((s) => s.state === "dead").length;
  if (st.id !== FIRST) return toStart(t);
  Object.entries(TREE).forEach(([id, want]) => {
    const got = seen.get(id);
    if (!got) return t.problem("bug", `Decision tree: ${id} is missing`);
    if (want.choices != null && got.choices.length !== want.choices) {
      t.problem("bug", `Decision tree: ${id} should have ${want.choices} choices, has ${got.choices.length}`);
    }
    if (want.state && got.state !== want.state) t.problem("bug", `Decision tree: ${id} should be "${want.state}", is "${got.state}"`);
    (want.to || []).forEach((to) => !got.to.includes(to) && t.problem("bug", `Decision tree: ${id} should lead to ${to}`));
  });
  await toStart(t);
}

/* ---------------- stories: the landing page opens every story ---------------- */

async function storiesRun(options, t) {
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  if (!landingShown()) await toLanding(t);
  t.scene("Choose your story");
  const list = listedStories();
  const cards = [...document.querySelectorAll("#story-list a.story-card")];
  t.metric("stories", list.length);
  t.metric("cards", cards.length);
  // A card for every listed story, in the listing's order, and none for the others.
  const order = cards.map((c) => c.dataset.story);
  if (order.join() !== list.map((st) => st.id).join()) t.problem("bug", `the landing page shows ${order.join(", ") || "no stories"}, the listing has ${list.map((st) => st.id).join(", ")}`);
  allStories().filter((st) => !st.listed && cardOf(st.id)).forEach((st) => t.problem("bug", `${st.id} has a card but isn't listed`));
  checkInventory(t, "landing page");
  await sleep(1000); // the landing page stays on screen for the footage

  // A fresh browser (no saved places): every card says Not started.
  t.scene("Progress: a fresh browser");
  clearProgress();
  await badgesAfterLoad(t, () => "new", "fresh browser");

  for (let i = 0; i < list.length; i++) {
    const st = list[i];
    const card = cardOf(st.id);
    if (!card) continue;
    t.scene(`${st.title}: card`);
    // Its card: the title, a line of logline, a key image (or the first video's frame) that loads.
    const title = (card.querySelector("h2")?.textContent || "").trim();
    if (title !== st.title) t.problem("bug", `${st.id}: the card says "${title}", not "${st.title}"`);
    if (!(card.querySelector("p")?.textContent || "").trim()) t.problem("bug", `${st.id}: the card has no logline`);
    const img = card.querySelector("img");
    const poster = card.querySelector("video");
    if (img) {
      await waitFor(() => img.complete, 10000);
      if (!img.naturalWidth) t.problem("bug", `${st.id}: the card's image ${pathOf(img.src)} didn't load`);
    } else if (poster) {
      if (!(await waitFor(() => poster.readyState >= 2 || poster.error, 15000)) || poster.error) t.problem("bug", `${st.id}: the card's video frame didn't load`);
    } else t.problem("warning", `${st.id}: the card has no picture`);
    // Its progress badge (the landing page was drawn before the run cleared the saved places: the first card's is
    // checked after All stories).
    if (i > 0) checkBadge(t, card, st, "new", "before opening it");

    // A tap on it opens that story's player, with its title, its first page's text, video and choices.
    await openStory(t, st.id);
    t.scene(`${st.title}: player`);
    if ($("spark-title").textContent.trim() !== st.title.toUpperCase()) t.problem("bug", `${st.id}: the player's title is "${$("spark-title").textContent}"`);
    if (!st.scenes[sceneId()]) t.problem("bug", `${st.id}: the player is on ${sceneId()}, which isn't one of its scenes`);
    checkInventory(t, st.title);
    checkNoBack(t, st.title);
    checkHitTargets(t, document, st.title);
    await toStart(t);
    // Only the first page is found: the Tree is it and a "?" per choice, and the percent is one scene's worth.
    checkExplored(t, st, Math.floor(100 / Object.keys(st.scenes).length), `${st.id}: ${st.start}`);
    await checkTree(t, st, `${st.title}'s Tree on its first page`);
    const first = st.scenes[st.start];
    if (enText($("spark-story")) !== first.story[1]) t.problem("bug", `${st.id}: the first page says "${enText($("spark-story"))}"`);
    if (first.video || document.querySelector("#spark-video video")) await checkVideo(t, document.querySelector("#spark-video video"), `${st.id}: ${st.start}`, 2, { autoplay: true });
    const buttons = choiceButtons();
    if (!buttons.length || buttons.some((b) => b.offsetParent === null)) t.problem("bug", `${st.id}: no visible choices on the first page`);
    t.note(`${st.title}: ${buttons.map(enText).join(" / ")}`);
    t.add("storiesOpened");
    await sleep(800);

    // All stories brings the landing page back (and stops the story's video).
    await toLanding(t);
    if (new URL(location.href).searchParams.has("story")) t.problem("bug", "the address still names a story on the landing page");
    if ($("title-splash")) t.problem("bug", "All stories shows the title splash again (it's for the first visit)");
    await sleep(100);
    checkInventory(t, "landing page, after All stories");
    // Opening it started it; the stories not opened yet are still Not started.
    list.forEach((other, j) => checkBadge(t, cardOf(other.id), other, j <= i ? "started" : "new", `after opening ${st.title}`));
    t.progress((i + 1) / (list.length + 2));
  }

  // Reaching an ending completes a story; a death and Try again don't undo it; a reload keeps it.
  for (const st of list) {
    const ending = wayTo(st, (s) => !!s.ending);
    if (!ending) {
      t.problem("warning", `${st.id}: no ending to reach (no scene with an "ending")`);
      continue;
    }
    t.scene(`${st.title}: to an ending`);
    await openStory(t, st.id);
    await toStart(t);
    await playWay(t, st, ending);
    const end = sceneId();
    if ($("spark").dataset.state !== "soon" || $("spark-ending").hidden) t.problem("bug", `${st.id}: ${end} is an ending but the player doesn't show it as one`);
    const chain = spark().path();
    t.event("ending", `${st.id}: ${chain.join(" > ")}`);
    checkExplored(t, st, exploredWant(st), `${st.id}: ${end}`);
    if (spark().explored() >= 100 && spark().unlocked().length < Object.keys(st.scenes).length) t.problem("bug", `${st.id}: 100% explored with scenes still locked`);
    await checkTree(t, st, `${st.title}'s Tree at an ending`);
    await sleep(800);
    await toLanding(t);
    checkBadge(t, cardOf(st.id), st, "completed", `after ${st.title}'s ending`);
    await sleep(600); // on screen for the footage
    // The saved place is the ending (with the counts of the way there). The card now says Start Over, so the
    // ending is opened again by the story's link, not the card.
    openByLink(t, st.id);
    await sleep(300);
    if (soundOf().prompt()) await passPrompt(t, document, st.id);
    if (sceneId() !== end) t.problem("bug", `${st.id}: the saved place was ${end}, it opened at ${sceneId()}`);
    else if (st.inventory) checkKit(t, st, chain, `${st.id}: ${end} (saved place)`);
    // A death, then Try again: back at the start, still Completed.
    const death = wayTo(st, (s) => !!s.dead);
    if (death) {
      await toStart(t);
      await playWay(t, st, death);
      t.event("death", `${st.id}: ${sceneId()}`);
      const again = choiceButtons()[st.scenes[sceneId()].choices.findIndex((c) => c[2] === st.start)];
      if (!again) t.problem("bug", `${st.id}: the death ${sceneId()} has no Try again back to the start`);
      else {
        again.click();
        await sleep(200);
        if (sceneId() !== st.start) t.problem("bug", `${st.id}: Try again didn't go back to the start`);
      }
      await toLanding(t);
      checkBadge(t, cardOf(st.id), st, "completed", `after a death and Try again in ${st.title}`);
    }
  }
  // A reload keeps every badge.
  t.scene("Progress: after a reload");
  await badgesAfterLoad(t, () => "completed", "after a reload");

  // Start Over: once completed (or at an ending) the card says Start Over; pressing it forgets that story's run only
  // (its run cookie: its unlocks, its percent and Completed stay, and the other stories' cookies are untouched) and
  // opens it at the start with an empty history. Its card then says Completed, the same percent, and Start Over.
  for (const st of list) {
    const ending = wayTo(st, (s) => !!s.ending);
    if (!ending) continue;
    t.scene(`${st.title}: Start Over`);
    await openStory(t, st.id);
    await toStart(t);
    await playWay(t, st, ending);
    await toLanding(t);
    if (!checkBadge(t, cardOf(st.id), st, "completed", `before Start Over in ${st.title}`)) continue;
    const go = () => (cardOf(st.id).querySelector(".story-card-go")?.textContent || "").trim();
    if (go() !== "Start Over") t.problem("bug", `${st.id}: at an ending its card's button says "${go()}", not Start Over`);
    const unlocks = JSON.stringify(savedUnlocks(st));
    const pct = exploredWant(st);
    const others = Object.fromEntries(allStories().filter((o) => o.id !== st.id).flatMap(cookiesOf).map((name) => [name, readJsonCookie(name)]));
    await openStory(t, st.id);
    const saved = savedPlace(st);
    if (sceneId() !== st.start || spark().depth() !== 0) t.problem("bug", `${st.id}: Start Over opened ${sceneId()} (${spark().depth()} steps in), not its start`);
    if (!saved || saved.scene !== st.start || saved.history.length) t.problem("bug", `${st.id}: after Start Over its run is ${JSON.stringify(saved)}, not the start with an empty history`);
    if (JSON.stringify(savedUnlocks(st)) !== unlocks) t.problem("bug", `${st.id}: Start Over changed its unlocks (${unlocks} -> ${JSON.stringify(savedUnlocks(st))}): they must stay`);
    checkExplored(t, st, pct, `${st.id}: after Start Over`);
    if (stories().progress(st.id) !== "completed") t.problem("bug", `${st.id}: after Start Over iltvStories.progress says ${stories().progress(st.id)}, not completed (an ending stays reached)`);
    if (st.inventory) checkKit(t, st, [st.start], `${st.id}: ${st.start} (after Start Over)`);
    for (const [name, was] of Object.entries(others)) {
      if (JSON.stringify(readJsonCookie(name)) !== JSON.stringify(was)) t.problem("bug", `Start Over in ${st.id} changed the cookie ${name} (${JSON.stringify(was)} -> ${JSON.stringify(readJsonCookie(name))})`);
    }
    t.event("start-over", `${st.id}: at ${sceneId()}, ${pct}% explored kept; ${Object.keys(others).length} other cookies untouched`);
    await sleep(600);
    await toLanding(t);
    checkBadge(t, cardOf(st.id), st, "completed", `after Start Over in ${st.title}`);
    if (go() !== "Start Over") t.problem("bug", `${st.id}: after Start Over its card's button says "${go()}", not Start Over`);
    await sleep(600);
  }
  t.progress((list.length + 1) / (list.length + 2));

  // A draft (listed: false) has no card, but plays at /?story=<id>: its title, first page, choices, inventory; and its
  // saved place (a few choices in, then All stories and back) comes back with the same scene and counts.
  for (const st of allStories().filter((s) => !s.listed)) {
    t.scene(`${st.title}: draft, by its link`);
    await openStory(t, st.id);
    if ($("spark-title").textContent.trim() !== st.title.toUpperCase()) t.problem("bug", `${st.id}: the player's title is "${$("spark-title").textContent}"`);
    await toStart(t);
    if (enText($("spark-story")) !== st.scenes[st.start].story[1]) t.problem("bug", `${st.id}: the first page says "${enText($("spark-story"))}"`);
    if (!choiceButtons().length) t.problem("bug", `${st.id}: no choices on the first page`);
    if (MADE.includes(st.id)) {
      // Its media is made: the first page plays its cut (still no card until J lists it).
      const video = document.querySelector("#spark-video video");
      if (await checkVideo(t, video, `${st.id}: ${st.start}`, 3, { autoplay: true })) checkCut(t, video, `${st.id}: ${st.start}`);
    }
    checkInventory(t, st.title);
    if (st.inventory) {
      checkKit(t, st, [st.start], `${st.id}: ${st.start}`);
      for (let i = 0; i < 3 && choiceButtons().length; i++) {
        choiceButtons()[0].click();
        await sleep(200);
      }
      const where = sceneId();
      const chain = spark().path();
      checkKit(t, st, chain, `${st.id}: ${where}`);
      const before = kitText(document.querySelector(".inventory.kit"));
      await toLanding(t);
      checkInventory(t, "landing page, after a draft");
      await openStory(t, st.id);
      if (sceneId() !== where) t.problem("bug", `${st.id}: the saved place was ${where}, it opened at ${sceneId()}`);
      else {
        checkKit(t, st, chain, `${st.id}: ${where} (saved place)`);
        t.event("saved-place", `${st.id}: ${where} (${before})`);
      }
      await toStart(t);
    }
    await sleep(800);
    await toLanding(t);
  }

  // A shared link opens a story straight away: /?story=<id> and the story's own /<id>/.
  for (const st of allStories()) {
    t.scene(`${st.title}: its link`);
    await frameLoad(t, (f) => (f.src = `/${st.id}/`));
    // It forwards to /?story=<id>, a second page load in the frame.
    await waitFor(() => frame.contentWindow.iltvStories && frame.contentDocument.readyState === "complete", 10000);
    const win = frame && frame.contentWindow;
    if (!win || !win.iltvStories) t.problem("bug", `/${st.id}/ didn't open the home page's player`);
    else if (win.iltvStories.current() !== st.id) t.problem("bug", `/${st.id}/ opened ${win.iltvStories.current() || "the landing page"}, not ${st.id}`);
    else {
      t.event("story-link", `/${st.id}/ -> ${win.location.pathname}${win.location.search}`);
      const promptTitle = (win.hawkesSound?.prompt()?.querySelector(".tap-title")?.textContent || "").trim();
      if (promptTitle !== st.tap.title) t.problem("bug", `/${st.id}/: the Tap to play prompt says "${promptTitle}", not "${st.tap.title}"`);
      if (win.hawkesSound?.state().splashes) t.problem("bug", `/${st.id}/: the title splash showed over the story (it's the landing page's)`);
    }
    await sleep(800);
    closeFrame();
  }
  const postCard = document.querySelector("#blog a.post-card");
  if (postCard) {
    const postPath = pathOf(postCard.getAttribute("href"));
    const postDoc = await openByClick(t, "/", postPath);
    if (postDoc && !isMissingPage(postDoc)) checkRecentPosts(t, postDoc, postPath);
    closeFrame();
  }
  t.progress(1);
}

/* ---------------- pages in a frame: branch folders and blog posts ---------------- */

let frame = null;
function openFrame() {
  if (frame) return frame;
  frame = document.createElement("iframe");
  frame.title = "Playtest";
  frame.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;background:#070807";
  document.body.appendChild(frame);
  return frame;
}
function closeFrame() {
  if (frame) frame.remove();
  frame = null;
}

/** Loads a URL in the frame (or follows a link clicked inside it) and waits for the page. */
function frameLoad(t, go, timeout = 20000) {
  return new Promise((resolve) => {
    const f = openFrame();
    const timer = setTimeout(() => {
      f.removeEventListener("load", done);
      resolve(null);
    }, timeout);
    function done() {
      clearTimeout(timer);
      f.removeEventListener("load", done);
      resolve(f.contentDocument);
    }
    f.addEventListener("load", done);
    go(f);
  });
}

async function status(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    await r.arrayBuffer(); // read it all, so the request doesn't show up as aborted
    return r.status;
  } catch {
    return 0;
  }
}

const pathOf = (href, base) => decodeURI(new URL(href, base || location.href).pathname);
const isMissingPage = (doc) => !doc || !!doc.querySelector("main.missing") || /not found/i.test(doc.title);

/** Opens `target` by clicking its link on `from` (a viewer's click). Falls back to loading it. */
async function openByClick(t, from, target) {
  if (from) {
    const doc = await frameLoad(t, (f) => (f.src = from));
    const link = doc && [...doc.querySelectorAll("a[href]")].find((a) => pathOf(a.getAttribute("href"), doc.baseURI) === target);
    if (link) return frameLoad(t, () => link.click());
  }
  return frameLoad(t, (f) => (f.src = target));
}

async function pages(options, t) {
  t.scene("Branch pages");
  const list = allStories();
  const total = list.reduce((n, st) => n + Object.keys(st.scenes).length, 0);
  const done = new Set();
  for (const st of list) await crawlPages(t, st, done, total);
  t.metric("pages", done.size);
  closeFrame();
  t.progress(1);
}

/** One story's branch pages, from its start page, following every choice link a viewer can click. */
async function crawlPages(t, st, done, total) {
  const first = folderOf(st.start, st);
  let noVideo = 0;
  // A branch page shows the counts you'd have on the shortest way there from the start.
  const sceneAt = new Map(Object.keys(st.scenes).map((id) => [folderOf(id, st), id]));
  const shortest = new Map([[st.start, [st.start]]]);
  for (const queue = [st.start]; queue.length; ) {
    const id = queue.shift();
    for (const [, , next] of st.scenes[id].choices) if (!shortest.has(next)) shortest.set(next, [...shortest.get(id), next]), queue.push(next);
  }
  const parent = new Map([[first, null]]);
  const queue = [first];
  const mine = new Set();
  while (queue.length) {
    const path = queue.shift();
    if (mine.has(path)) continue;
    mine.add(path);
    done.add(path);
    t.scene(path);
    t.progress(done.size / total);
    if ((await status(path)) !== 200) {
      t.problem("bug", `${path}: page missing (from ${parent.get(path) || "the home page"})`);
      continue;
    }
    const doc = await openByClick(t, parent.get(path), path);
    if (isMissingPage(doc)) {
      t.problem("bug", `${path}: opened the not-found page`);
      continue;
    }
    t.add("pagesOpened");
    t.note((doc.querySelector("h1 .spot-en") || doc.querySelector("h1") || {}).textContent || path);
    await waitFor(() => soundOf(doc), 3000);
    await passPrompt(t, doc, path);
    const video = doc.querySelector("video");
    if (video || mustPlay(st)) {
      if ((await checkVideo(t, video, path, 2, { autoplay: true })) && MADE.includes(st.id)) checkCut(t, video, path);
    } else noVideo++;
    if (st.unspoken) checkUnspoken(t, st, doc.body, path);
    if (st.inventory) {
      checkInventory(t, path, doc);
      checkKit(t, st, shortest.get(sceneAt.get(path)) || [], path, doc);
    }
    const links = [...doc.querySelectorAll(".spark-choices a.choice")].map((a) => ({ label: enText(a), to: pathOf(a.getAttribute("href"), doc.baseURI) }));
    t.event("page", `${path}: ${links.length} choices`);
    const ending = doc.querySelector('main[data-state="soon"]');
    if (!links.length && ending) t.event("ending", `${path}: ${enText(ending.querySelector(".passage-prompt:last-of-type"))}`);
    else if (!links.length) t.problem("warning", `${path}: dead end, no choices and no ending`);
    for (const l of links) {
      if (l.to === "/") {
        t.event("back-to-start", `${path}: "${l.label}"`);
        continue;
      }
      if ((await status(l.to)) !== 200) {
        t.problem("bug", `${path}: choice "${l.label}" links to ${l.to}, which doesn't exist`);
        continue;
      }
      if (!parent.has(l.to)) parent.set(l.to, path);
      queue.push(l.to);
    }
    doc.querySelectorAll("video").forEach((v) => v.pause());
  }
  if (noVideo) t.problem("warning", `${st.title}: ${noVideo} page(s) have no video yet (a draft, not on the landing page)`);
  branchFolders(st).filter((p) => !mine.has(p)).forEach((p) => t.problem("warning", `${p}: no choice links here (orphan page)`));
  // The story's own link, /<id>/, opens its player.
  if ((await status(`/${st.id}/`)) !== 200) t.problem("bug", `/${st.id}/ (${st.title}'s link) is missing`);
}

async function blog(options, t) {
  t.scene("Blog");
  await passPrompt(t); // like a viewer: the home page's title splash goes first, so none is left behind the post frame
  const posts = [...document.querySelectorAll("#blog a.post-card")].map((a) => ({
    to: pathOf(a.getAttribute("href")),
    title: enText(a.querySelector("h3")),
  }));
  t.metric("posts", posts.length);
  if (!posts.length) throw new Error("the home page lists no posts");
  // Cover images on the home page.
  document.querySelectorAll("#blog img").forEach((img) => {
    if (img.complete && !img.naturalWidth) t.problem("bug", `home: image ${pathOf(img.src)} didn't load`);
  });
  const links = new Set();
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    t.scene(p.title || p.to);
    t.progress(i / posts.length);
    if ((await status(p.to)) !== 200) {
      t.problem("bug", `Post "${p.title}" (${p.to}) is missing`);
      continue;
    }
    const doc = await openByClick(t, "/", p.to);
    if (isMissingPage(doc)) {
      t.problem("bug", `Post "${p.title}" opened the not-found page`);
      continue;
    }
    if (!doc.querySelector("h1")) t.problem("warning", `Post "${p.title}" has no heading`);
    checkRecentPosts(t, doc, p.to);
    await waitFor(() => [...doc.images].every((img) => img.complete), 10000);
    [...doc.images].forEach((img) => !img.naturalWidth && t.problem("bug", `${p.to}: image ${pathOf(img.src)} didn't load`));
    for (const v of doc.querySelectorAll("video")) await checkVideo(t, v, p.to, 1);
    doc.querySelectorAll("video").forEach((v) => v.pause());
    doc.querySelectorAll("a[href]").forEach((a) => {
      const u = new URL(a.getAttribute("href"), doc.baseURI);
      if (u.origin === location.origin) links.add(decodeURI(u.pathname));
    });
    t.add("postsOpened");
    t.event("post", p.title || p.to);
  }
  // Every local link on the posts goes somewhere.
  for (const l of links) {
    if ((await status(l)) !== 200) t.problem("bug", `A post links to ${l}, which doesn't exist`);
  }
  t.metric("postLinksChecked", links.size);
  closeFrame();
  t.progress(1);
}

/* ---------------- credits: "Powered by HAWKES GEN" on every page, the parent company on the home page ---------------- */

const GEN_URL = "https://hawkesgen.com";
const PARENT_URL = "https://hawkesbiomedical.com";
const sameUrl = (a, b) => {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
};
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** A footer link a viewer can see and press: scrolled to, on top where it is, going to `url`. */
async function checkLink(t, doc, find, url, label, where) {
  const link = [...doc.querySelectorAll("a[href]")].find((a) => find(a) && sameUrl(a.href, url));
  if (!link) {
    t.problem("bug", `${where}: no "${label}" link to ${url}`);
    return null;
  }
  link.scrollIntoView({ block: "center", behavior: "instant" });
  await sleep(500);
  const r = link.getBoundingClientRect();
  const win = doc.defaultView;
  const style = win.getComputedStyle(link);
  if (!r.width || !r.height || style.visibility === "hidden" || Number(style.opacity) === 0) {
    t.problem("bug", `${where}: the "${label}" link is not visible`);
    return link;
  }
  const top = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (!top || !link.contains(top)) t.problem("bug", `${where}: the "${label}" link is covered by ${top ? (top.id ? "#" + top.id : top.tagName.toLowerCase()) : "nothing on screen"}`);
  else t.event("credit-link", `${where}: "${label}" -> ${link.href}`);
  t.add("creditLinks");
  return link;
}

/** The mark: "Powered by HAWKES GEN" linking to hawkesgen.com, and never over the page's story video. */
async function checkMark(t, doc, where) {
  const link = await checkLink(t, doc, (a) => /powered by\s+hawkes gen/i.test(((a.parentElement || a).textContent || "").replace(/\s+/g, " ")) && /^HAWKES GEN$/i.test(a.textContent.trim()), GEN_URL, "Powered by HAWKES GEN", where);
  if (!link) return;
  for (const v of [...doc.querySelectorAll("video")].filter((v) => v.getClientRects().length)) {
    v.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(300);
    const vr = v.getBoundingClientRect();
    const mark = (link.closest(".powered") || link).getBoundingClientRect();
    const onTop = doc.elementFromPoint(vr.left + vr.width / 2, vr.top + vr.height / 2);
    if (overlaps(vr, mark)) t.problem("bug", `${where}: the HAWKES GEN mark overlaps the story video`);
    else if (onTop && !v.contains(onTop) && !(onTop.closest && onTop.closest("video"))) t.problem("bug", `${where}: the story video is covered by ${onTop.id ? "#" + onTop.id : onTop.tagName.toLowerCase()}`);
    else t.event("video-clear", `${where}: nothing over the story video`);
  }
}

async function credits(options, t) {
  rememberProgress();
  const originalSound = localStorage.getItem(SOUND_KEY);
  try {
    await creditsRun(t);
  } finally {
    if (originalSound == null) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, originalSound);
  }
}

async function creditsRun(t) {
  t.scene("Home footer");
  await passPrompt(t); // the landing page's title splash
  if (!landingShown()) await toLanding(t);
  await checkMark(t, document, "home (stories)");
  await checkLink(t, document, (a) => /hawkes biomedical/i.test(a.textContent), PARENT_URL, "Hawkes Biomedical", "home");
  await sleep(1500); // the footer stays on screen for the footage
  t.progress(0.15);

  // The same with a story open in the player: the mark is still there and nothing lies over the story video.
  // Sound off from the story's Tap to play prompt, its own Settings button: its line must say so, and so must the
  // branch page's prompt, which loads with Sound off already saved.
  t.scene("The Final Spark: footer and video");
  await openStory(t, FIRST, { tap: false });
  if (soundOf().prompt()) {
    t.scene("Tap to play");
    await sleep(800);
    await gateSound(t, document, false, "The Final Spark");
    t.scene("Tap to play (Sound off)");
    checkNote(t, document, "The Final Spark, after Sound off");
    await sleep(1500);
  }
  await passPrompt(t, document, FIRST);
  checkHitTargets(t, document, "home (The Final Spark)");
  await checkMark(t, document, "home (The Final Spark)");
  await sleep(800);
  await toLanding(t);
  t.progress(0.25);

  // A blog post and a branch page, opened by a viewer's click from the home page, then What's new.
  const post = document.querySelector("#blog a.post-card");
  const pagesToCheck = [
    post && { from: "/", to: pathOf(post.getAttribute("href")), name: "blog post" },
    { from: null, to: folderOf(story().start), name: "branch page" },
    { from: "/", to: "/whatsnew.html", name: "What's new" },
  ].filter(Boolean);
  for (let i = 0; i < pagesToCheck.length; i++) {
    const p = pagesToCheck[i];
    t.scene(`${p.name} footer`);
    const doc = await openByClick(t, p.from, p.to);
    if (isMissingPage(doc)) {
      t.problem("bug", `${p.to}: opened the not-found page`);
      continue;
    }
    if (soundOf(doc)) {
      if (soundOf(doc).prompt()) {
        t.scene(`${p.name}: Tap to play (Sound off saved)`);
        await sleep(1200);
      }
      await passPrompt(t, doc, p.to);
    }
    await checkMark(t, doc, `${p.name} ${p.to}`);
    if (p.name === "blog post") checkRecentPosts(t, doc, p.to);
    doc.querySelectorAll("video").forEach((v) => v.pause());
    await sleep(1200);
    t.progress(0.25 + (0.75 * (i + 1)) / pagesToCheck.length);
  }
  closeFrame();
  window.scrollTo(0, 0);
  t.progress(1);
}

/* ---------------- sound: the prompt, the unlock, Settings that survive a reload ---------------- */

const savedSound = () => {
  try {
    return JSON.parse(localStorage.getItem(SOUND_KEY));
  } catch {
    return null;
  }
};
const near = (a, b) => Math.abs(a - b) < 0.011;

/** The video plays with sound (or muted, when Sound is off) at the saved volume, moving by itself. */
async function checkSound(t, video, where, { on, volume }) {
  if (!video) return t.problem("bug", `${where}: no video`);
  const t1 = video.currentTime;
  const moving = await waitFor(() => !video.paused && video.currentTime > t1 + 0.5, 6000);
  if (!moving) t.problem("bug", `${where}: the video doesn't play after the tap (at ${video.currentTime.toFixed(1)} s${video.paused ? ", paused" : ""})`);
  if (on && video.muted) t.problem("bug", `${where}: the video plays muted with Sound on`);
  if (!on && !video.muted) t.problem("bug", `${where}: the video has sound with Sound off`);
  const sound = soundOf(video.ownerDocument);
  if (sound && sound.state().volumeWorks && !near(video.volume, volume)) t.problem("bug", `${where}: video volume ${video.volume.toFixed(2)}, Settings say ${volume}`);
  t.metric("videoMuted", video.muted ? 1 : 0);
  t.metric("videoVolume", Number(video.volume.toFixed(2)));
  t.event("video-sound", `${where}: ${video.paused ? "paused" : "playing"}, ${video.muted ? "muted" : "sound"}, volume ${video.volume.toFixed(2)}`);
}

async function openSettings(t, where) {
  await tapAt(t, $("sound-gear"), `Settings (${where})`);
  if (!(await waitFor(() => soundOf().state().settingsOpen, 3000))) throw new Error(`Settings didn't open (${where})`);
  t.scene(`Settings (${where})`);
  await sleep(600);
}

function slide(input, value) {
  input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function sound(options, t) {
  const carried = JSON.parse(sessionStorage.getItem(SOUND_RUN) || "null");
  if (!soundOf()) throw new Error("js/hawkes-sound.js isn't loaded");

  if (!carried) {
    // Part 1: the prompt, a tap, the video plays with sound; Sound off and Volume 40%; reload.
    const original = localStorage.getItem(SOUND_KEY);
    rememberProgress();
    localStorage.removeItem(SOUND_KEY); // a first visit: Sound on, full volume
    // The landing page: the title splash fades by itself, no prompt, no sound to unlock (it has no video).
    t.scene("Title splash");
    await passPrompt(t);
    // The story's card: its Tap to play prompt, and that tap unlocks sound and starts the first video with it.
    await openStory(t, FIRST, { tap: false });
    t.scene("Tap to play");
    if (!soundOf().prompt()) t.problem("bug", "no Tap to play prompt when The Final Spark opens");
    await sleep(1200);
    const firstVideo = document.querySelector("#spark-video video");
    if (firstVideo && !firstVideo.paused) t.problem("bug", "the video plays behind the prompt, before the tap");
    await passPrompt(t, document, "The Final Spark");
    const st = soundOf().state();
    if (!st.unlocked) t.problem("bug", "the tap didn't unlock sound");
    if (st.audio !== "running") t.problem("bug", `the AudioContext is "${st.audio}" after the tap, not running`);
    t.scene("The Final Spark (sound on)");
    checkHitTargets(t, document, "The Final Spark (sound on)");
    await checkSound(t, document.querySelector("#spark-video video"), "after the tap", { on: true, volume: 1 });
    t.progress(0.2);

    // A choice: the next scene's video starts with sound too, no extra tap.
    await toStart(t);
    const button = choiceButtons()[0];
    if (button) {
      await tapAt(t, button, `choice "${enText(button)}"`);
      await sleep(300);
      t.scene(`${sceneId()} (sound on)`);
      await checkSound(t, document.querySelector("#spark-video video"), `${sceneId()}, after a choice`, { on: true, volume: 1 });
    }
    t.progress(0.35);

    await openSettings(t, "home");
    await tapAt(t, $("sound-on"), "Sound off");
    slide($("sound-volume"), 40);
    await sleep(600);
    const now = savedSound();
    if (!now || now.on !== false || !near(now.music, 0.4) || !near(now.sfx, 0.4)) t.problem("bug", `hawkes.sound didn't save Sound off and Volume 40%: ${JSON.stringify(now)}`);
    else t.event("setting-saved", JSON.stringify(now));
    if (!document.querySelector("#spark-video video").muted) t.problem("bug", "Sound off didn't mute the video right away");
    await tapAt(t, $("sound-done"), "Done");
    await sleep(300);
    if (soundOf().state().settingsOpen) t.problem("bug", "Done didn't close Settings");
    t.progress(0.5);

    // What part 1 found goes with the run (its report starts over after the reload).
    const sofar = window.hawkesPlaytest.report() || { events: [], problems: [] };
    const events = sofar.events.filter((e) => !["start", "scene", "problem"].includes(e.type)).map(({ type, detail }) => ({ type, detail }));
    sessionStorage.setItem(SOUND_RUN, JSON.stringify({ original, cookie: savedCookie, events, problems: sofar.problems }));
    savedCookie = null; // put back after the reload
    t.event("reload", "the page reloads; the run carries on after it");
    const url = new URL(location.href);
    url.searchParams.set("playtest", "sound");
    url.searchParams.set("seed", String(options.seed ?? 1));
    url.searchParams.set("speed", String(options.speed ?? 1));
    await sleep(300);
    location.replace(url.toString());
    await new Promise(() => {}); // the page is going away
    return;
  }

  // Part 2, after the reload: the prompt again, the saved choice is back and applied, then Sound on at 40%.
  sessionStorage.removeItem(SOUND_RUN);
  savedCookie = carried.cookie;
  try {
    for (const e of carried.events) t.event(`before-reload:${e.type}`, e.detail);
    for (const p of carried.problems || []) t.problem(p.severity, `before the reload: ${p.message}`);
    t.progress(0.55);
    t.scene("Tap to play (after reload)");
    if (!soundOf().prompt()) t.problem("bug", "no Tap to play prompt after the reload");
    // The address kept ?story=final-spark, so the page opens straight into the story, and the prompt names it.
    if (stories().current() !== FIRST) t.problem("bug", `after the reload the page didn't open The Final Spark again (open: ${stories().current() || "the landing page"})`);
    if (soundOf().state().splashes) t.problem("bug", "the title splash showed over The Final Spark (it's the landing page's)");
    const promptTitle = (soundOf().prompt()?.querySelector(".tap-title")?.textContent || "").trim();
    if (stories().current() === FIRST && promptTitle !== story().tap.title) t.problem("bug", `the prompt over The Final Spark says "${promptTitle}", not "${story().tap.title}"`);
    await sleep(1000);
    const back = soundOf().settings();
    if (back.on !== false || !near(back.music, 0.4)) t.problem("bug", `the setting didn't survive the reload: ${JSON.stringify(back)}`);
    else t.event("setting-survived-reload", JSON.stringify(back));
    await passPrompt(t, document, "home, after the reload");
    await openStory(t, FIRST);
    t.scene("The Final Spark (sound off)");
    await checkSound(t, document.querySelector("#spark-video video"), "after the reload", { on: false, volume: 0.4 });
    t.progress(0.7);

    await openSettings(t, "after the reload");
    const shows = `${$("sound-on").getAttribute("aria-checked") === "true" ? "On" : "Off"} / ${$("sound-volume").value}%`;
    if (shows !== "Off / 40%") t.problem("bug", `Settings show "${shows}" after the reload, not Off / 40%`);
    await tapAt(t, $("sound-on"), "Sound on");
    await sleep(400);
    await tapAt(t, $("sound-done"), "Done");
    t.scene("The Final Spark (sound on, 40%)");
    await checkSound(t, document.querySelector("#spark-video video"), "Sound on at 40%", { on: true, volume: 0.4 });
    t.progress(0.85);

    // A branch page (its own page load): the prompt, then its video with the same saved sound.
    const path = folderOf(story().start);
    await toLanding(t);
    const doc = await frameLoad(t, (f) => (f.src = path));
    if (!doc) throw new Error(`${path} didn't load`);
    t.scene(`${path} (branch page)`);
    await sleep(800);
    await passPrompt(t, doc, path);
    await checkSound(t, doc.querySelector("video"), path, { on: true, volume: 0.4 });
    closeFrame();
    t.progress(1);
  } finally {
    if (carried.original == null) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, carried.original);
  }
}

/* ---------------- analytics: the events going out on a way through The Final Spark, and the two questions ---------------- */

// js/hawkes-build.js turns on the SDK's debug mode in a bot's tab, so hawkesAnalytics.debugLog holds every event
// and marks each one `sent` when its batch goes out. The scenario puts them on the timeline as they go.
const ANALYTICS_SHOWN = ["story_open", "screen", "video", "choice", "death", "run_start", "run_end", "feature", "feedback_prompt", "feedback", "game_ready"];
const ASK_KEYS = { session: ["hawkes.asked", "iltv.backs"], local: ["hawkes.askSnoozed"] };

function describeEvent(e) {
  const p = e.props || {};
  const c = e.ctx || {};
  const bits = {
    screen: () => p.name,
    video: () => `${p.action} ${p.id} at ${p.at ?? 0} s${p.watched != null ? `, watched ${p.watched} s` : ""}`,
    choice: () => `${p.node}: "${p.option}" -> ${p.to}`,
    death: () => `${p.cause} (at ${p.where})`,
    run_start: () => `${p.run} (${p.mode})`,
    run_end: () => `${p.run}: ${p.result}${p.ending ? `, ending ${p.ending}` : ""}${p.cause ? `, ${p.cause}` : ""}, depth ${p.depth}`,
    feature: () => `${p.name}${p.via ? ` via ${p.via}` : ""}${p.from ? ` from ${p.from}` : ""}`,
    feedback_prompt: () => `${p.action} ${p.id}`,
    feedback: () => `${p.rating}${p.context ? ` (${p.context})` : ""}`,
    story_open: () => `${p.story} via ${p.via}`,
    game_ready: () => `${p.view}, ${p.ms} ms`,
  }[e.name];
  const where = c.node ? ` · ${c.story}/${c.node}, depth ${c.depth}` : "";
  return `${e.name} ${bits ? bits() : ""}${where}`;
}

/** The feedback card the SDK draws (a shadow root on [data-hawkes-ask]), waited for. */
async function waitForAsk(t, id, ms) {
  const sel = `[data-hawkes-ask="${id}"]`;
  if (!(await waitFor(() => document.querySelector(sel)?.shadowRoot?.querySelector(".ha-r button"), ms))) return null;
  return document.querySelector(sel);
}

/** Answers the card the way a viewer would: the rating's button, then Skip on the optional comment. */
async function answerAsk(t, host, which, label) {
  const root = host.shadowRoot;
  const buttons = [...root.querySelectorAll(".ha-r button")];
  const button = which === "up" ? buttons[0] : buttons[which - 1];
  button.click();
  t.log(`tap ${label}`);
  await sleep(400);
  const skip = [...root.querySelectorAll(".ha-s button")].find((b) => b.textContent.trim() === "Skip");
  if (skip) skip.click();
  if (!(await waitFor(() => !host.isConnected, 4000))) t.problem("bug", `${label}: the feedback card didn't close after answering`);
}

async function analyticsRun(options, t) {
  const A = window.hawkesAnalytics;
  if (!A || !A.config) {
    t.problem("bug", "Hawkes Analytics didn't load on the home page (js/hawkes-analytics.js)");
    return;
  }
  const fromLoad = A.config().debug; // the bot's tab has it from the URL (js/hawkes-build.js)
  if (!fromLoad) {
    t.problem("warning", "The SDK's debug mode wasn't on from the page load (?hawkes-analytics-debug=1): the events before this run can't be shown");
    A.init({ debug: true });
  }
  const c = A.config();
  t.log(`analytics product ${c.product}, env ${c.env}, build ${JSON.stringify(c.build)}, session ${c.session}`);
  t.event("analytics-config", `${c.product} · env ${c.env} · build ${c.build && c.build.version}${c.build && c.build.commit ? " @" + c.build.commit : ""}${c.build && c.build.date ? " (" + c.build.date + ")" : ""}`);
  t.metric("analyticsEnv", c.env);
  t.metric("analyticsBuild", (c.build && c.build.version) || "none");
  if (c.product !== "imaginelivetv") t.problem("bug", `Analytics product is "${c.product}", not imaginelivetv`);
  if (!c.build || !c.build.version || !c.build.commit) t.problem("bug", `Analytics has no build with a commit (HAWKES_BUILD is ${JSON.stringify(c.build)}): run npm run stamp (js/hawkes-build.js)`);
  if (/\.hawkesgen\.com$/.test(location.hostname) && c.env !== "beta" && c.env !== "preview") t.problem("bug", `On ${location.hostname} the analytics env is ${c.env}, not beta`);

  // Every sent event goes on the timeline as it goes out.
  const shownSeqs = new Set();
  const pump = () => {
    for (const e of A.debugLog || []) {
      if (!e.sent || shownSeqs.has(e.seq) || !ANALYTICS_SHOWN.includes(e.name)) continue;
      shownSeqs.add(e.seq);
      t.event("analytics", describeEvent(e));
    }
  };
  const timer = setInterval(() => {
    try {
      pump();
    } catch {}
  }, 500);

  // The questions show once a session and not for 7 days after a close: start this run as a new viewer would.
  const saved = { session: {}, local: {} };
  for (const k of ASK_KEYS.session) (saved.session[k] = sessionStorage.getItem(k)), sessionStorage.removeItem(k);
  for (const k of ASK_KEYS.local) (saved.local[k] = localStorage.getItem(k)), localStorage.removeItem(k);
  rememberProgress();
  clearProgress();
  const st = story(FIRST);
  const tapChoice = async (to) => {
    const i = st.scenes[sceneId()].choices.findIndex((ch) => ch[2] === to);
    const button = choiceButtons()[i];
    if (i < 0 || !button) throw new Error(`no choice from ${sceneId()} to ${to}`);
    button.scrollIntoView({ block: "center", behavior: "instant" });
    await tapAt(t, button, `"${enText(button)}"`);
    await sleep(200);
    if (sceneId() !== to) throw new Error(`"${enText(button)}" didn't open ${to} (on ${sceneId()})`);
    t.scene(`${FIRST}/${st.scenes[to].folder}`);
    // A moment on each page, so its video plays (and is skipped by the next choice).
    await waitFor(() => !document.querySelector("#spark-video video")?.paused, 4000);
    await sleep(900);
  };

  try {
    t.scene("Home");
    await passPrompt(t);
    await openStory(t, FIRST);
    await toStart(t);
    t.scene(`${FIRST}/${st.scenes[st.start].folder}`);
    await sleep(1200);
    t.progress(0.1);

    // Back up the tree twice: the dead end's "go back" (to a page nearer the tunnel), then a death and Try again.
    await tapChoice("deadEnd");
    await tapChoice("direction");
    await tapChoice("deadEnd");
    await tapChoice("sludge");
    await tapChoice(st.start);
    t.progress(0.3);
    const thumbs = await waitForAsk(t, "back-twice", 8000);
    if (!thumbs) t.problem("bug", "Going back up the tree twice (a back choice, then Try again) didn't show the thumbs question");
    else {
      const q = thumbs.shadowRoot.querySelector(".ha-q").textContent.trim();
      const n = thumbs.shadowRoot.querySelectorAll(".ha-r button").length;
      t.event("feedback-prompt", `after going back twice: "${q}" (${n === 2 ? "thumbs" : n + " buttons"})`);
      if (n !== 2) t.problem("bug", `The going-back question should be thumbs, it has ${n} buttons`);
      await sleep(1500);
      await answerAsk(t, thumbs, "up", "thumbs up");
    }

    // The shortest way to an ending, a choice at a time.
    const way = wayTo(st, (s) => !!s.ending);
    if (!way) throw new Error("The Final Spark has no ending to reach");
    for (let i = 0; i < way.length; i++) {
      await tapChoice(way[i]);
      t.progress(0.3 + (0.5 * (i + 1)) / way.length);
    }
    const end = st.scenes[sceneId()];
    t.event("ending", `${end.folder}: ${enText($("spark-ending"))}`);
    const stars = await waitForAsk(t, `ending-${FIRST}-${end.folder}`, 10000);
    if (!stars) t.problem("bug", `Reaching the ending (${end.folder}) didn't show the "How was this ending?" question`);
    else {
      const q = stars.shadowRoot.querySelector(".ha-q").textContent.trim();
      const n = stars.shadowRoot.querySelectorAll(".ha-r button").length;
      t.event("feedback-prompt", `at the ending: "${q}" (${n} stars)`);
      if (q !== "How was this ending?") t.problem("bug", `The ending's question says "${q}"`);
      if (n !== 5) t.problem("bug", `The ending's question should be 1-5 stars, it has ${n} buttons`);
      // It sits above the inventory bar, never on it.
      const card = stars.shadowRoot.querySelector(".ha-c").getBoundingClientRect();
      const bar = document.querySelector(".inventory")?.getBoundingClientRect();
      if (bar && bar.height && card.bottom > bar.top + 1) t.problem("bug", `The feedback card covers the inventory bar (card bottom ${Math.round(card.bottom)}, bar top ${Math.round(bar.top)})`);
      await sleep(2000);
      await answerAsk(t, stars, 5, "5 stars");
    }
    t.progress(0.9);
    await toLanding(t);
    A.flush();
    await sleep(600);
    pump();

    // What went out: the standard events at their moments, each with the build and the story's context.
    const sent = (A.debugLog || []).filter((e) => e.sent);
    t.metric("analyticsEvents", sent.length);
    const has = (name, test) => sent.some((e) => e.name === name && (!test || test(e.props || {}, e)));
    const want = [
      ["screen", (p) => p.name === `${FIRST}/${st.scenes[st.start].folder}`, "a screen for the story's first page"],
      ["video", (p) => p.action === "play", "a video play"],
      ["video", (p) => p.action === "skip" && p.watched != null, "a video skip with the seconds watched"],
      ["choice", (p, e) => p.node && p.option && e.ctx && e.ctx.story === FIRST && e.ctx.path, "a choice with its node, option and the path so far"],
      ["run_start", null, "run_start"],
      ["death", (p) => p.cause === st.scenes.sludge.folder, "the sludge's death"],
      ["feature", (p) => p.name === "back" && p.via === "choice", "the back choice (feature back)"],
      ["feature", (p) => p.name === "restart" && p.via === "try_again", "Try again (feature restart)"],
      ["run_end", (p) => p.result === "win" && p.ending === end.folder, "run_end with the ending"],
      ["feedback", (p) => p.rating === "up", "the thumbs answer"],
      ["feedback", (p) => p.rating === 5, "the ending's stars"],
    ];
    if (fromLoad) want.push(["game_ready", null, "game_ready"]);
    for (const [name, test, what] of want) if (!has(name, test)) t.problem("bug", `Analytics: no ${what} went out (${name})`);
    const noCtx = sent.filter((e) => e.name === "choice" && !(e.ctx && e.ctx.node && e.ctx.depth != null));
    if (noCtx.length) t.problem("bug", `Analytics: ${noCtx.length} choice event(s) without the node and depth in their context`);
    t.note(`${sent.length} analytics events sent: ${[...new Set(sent.map((e) => e.name))].join(", ")}`);
    t.progress(1);
  } finally {
    clearInterval(timer);
    for (const k of ASK_KEYS.session) saved.session[k] == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, saved.session[k]);
    for (const k of ASK_KEYS.local) saved.local[k] == null ? localStorage.removeItem(k) : localStorage.setItem(k, saved.local[k]);
  }
}

installPlaytest({
  product: "imaginelivetv",
  scenarios: [
    { id: "smoke", title: "The landing page, The Final Spark from its card: its Tree shows only what's found (nothing to press), the first video plays, a choice appears, one step in (no Back button), All stories", seconds: 25, tags: ["smoke"] },
    {
      id: "stories",
      title: "The landing page opens every story: its card, its player, its first page, All stories, its link",
      seconds: 75,
      tags: ["full"],
      description: "Waits for the landing page's title splash (just IMAGINE LIVE TV on the prompt's background, no Tap to play, no sound line) to fade away by itself, and checks the landing page shows no inventory (the flashlight is The Final Spark's: it's there once the story is open). Checks the landing page has a card for every listed story in story/stories.json (title, logline, an image that loads) and none for the unlisted ones. Progress on the cards: with the saved places cleared (a fresh browser, the home page loaded in a frame) every card says Not started and 0% explored; opening a story makes its card say Started, one scene's percent; its Tree then shows only the first page and a locked ? per choice (nothing to press, nothing of the scene behind a ?); reaching one of its endings (the shortest way) makes it Completed, the percent follows the unlocked scenes (100% only with every scene found) and its card's button says Start Over (the run is at an ending), the story's link reopens it at that ending (with the inventory's counts of the way there), and a death and Try again keep it Completed (the button Play: the run is back at the start); the home page loaded again shows every card Completed. Then, from an ending, each card's Start Over: it forgets only that story's run (its unlocks, percent and Completed stay; the other stories' cookies are untouched) and opens it at its start with an empty history; back on the landing page its card says Completed, the same percent, and Play. Taps each card: the player opens that story (its title, ?story=<id> in the address) under its own Tap to play prompt, which it taps; its first page's text, video and choices, and no Back button in the player; All stories brings the landing page back with the video gone (no splash again, no inventory). A draft (listed: false) opens by its link, /?story=<id>: its title, first page and inventory (a draft whose media is made plays its first page's cut, 9:16 with sound), and a saved place a few choices in comes back with the same counts. Then each story's own link, /<id>/, opens the home page straight into that story, with its own Tap to play title.",
    },
    { id: "branches", title: "Every story's player (drafts too): every scene, every choice, every video (The Water Road's cuts: 9:16, with sound), the inventory's counts, the percent explored rising scene by scene to 100% only at the last, the Tree locked until found (no Back: after each choice it walks again from the start, a new run)", seconds: 330, tags: ["full"] },
    { id: "pages", title: "Every story's branch pages (one folder per branch): videos, choice links, the inventory's counts", seconds: 90, tags: ["full"] },
    { id: "blog", title: "Every blog post opens, with its images and links", seconds: 40, tags: ["full"] },
    {
      id: "credits",
      title: "Powered by HAWKES GEN on every kind of page, Hawkes Biomedical on the home page",
      seconds: 30,
      tags: ["full"],
      description: "Waits for the landing page's title splash to fade, scrolls to the home page (landing page) footer and checks \"Powered by HAWKES GEN\" links to https://hawkesgen.com and the parent company link goes to https://hawkesbiomedical.com (visible, hit-tested, not covered), and the mark again with The Final Spark open in the player. Then opens a blog post, the start's branch page and What's new and checks the mark in each footer, and that nothing lies over the story video (the mark never overlaps it). Before tapping The Final Spark's Tap to play it turns Sound off with the prompt's own Settings button: the prompt's line must then say \"Sound off.\", and so must the branch page's prompt, which loads with Sound off saved. The viewer's own hawkes.sound is put back.",
    },
    {
      id: "sound",
      title: "Tap to play unlocks sound, Settings (Sound, Volume) that survive a reload",
      seconds: 45,
      tags: ["full", "menus"],
      description: "Waits for the landing page's title splash to fade (no prompt there), opens The Final Spark from its card: its Tap to play prompt shows and is tapped with a pointer press on the spot (hit-tested, so a covered prompt fails); the AudioContext runs and the story's video plays unmuted by itself, and so does the next scene's after a choice. Opens Settings from the header, turns Sound off and Volume to 40% (saved in hawkes.sound), reloads the page (the run carries on through ?playtest=sound), checks the page opens straight back into The Final Spark (?story=final-spark) and the prompt is back with its title, the choice was kept and the video plays muted, turns Sound on, then opens the start's branch page: its prompt, then its video with sound at 40%. The viewer's own hawkes.sound and progress are put back.",
    },
    {
      id: "analytics",
      title: "Hawkes Analytics: the events going out on a way through The Final Spark (screen, video, choice, back, Try again, the ending), the thumbs question after going back twice and the stars question at the ending",
      seconds: 75,
      tags: ["analytics"],
      description: "Checks the analytics SDK is loaded with product imaginelivetv and a build (version, commit, date) and, on beta, env beta. Puts every event the page sends on the timeline as its batch goes out (the SDK's debug mode, ?hawkes-analytics-debug=1, on in a bot's tab). Opens The Final Spark from its card (fresh progress), then by tapping choices: Go back, the dead end's go back (back up the tree), the sludge (a death), Try again: the thumbs question (\"Retracing your steps…\") comes up and is answered thumbs up. Then the shortest way to the ending, a page at a time (each video plays, the next choice skips it): at Destroy the town the stars question \"How was this ending?\" comes up above the inventory bar and is answered 5 stars. Then All stories, and a check that screen, video (play, skip with seconds watched), choice (node, option, path in context), run_start, death, back, restart, run_end with the ending, both feedback answers and game_ready went out. The viewer's progress and question history are put back.",
    },
  ],
  isReady: () => document.readyState === "complete" && !!stories() && !!soundOf(),
  async start(id, options, t) {
    try {
      if (id === "smoke") await smoke(options, t);
      else if (id === "stories") await storiesRun(options, t);
      else if (id === "branches") await branches(options, t);
      else if (id === "pages") await pages(options, t);
      else if (id === "blog") await blog(options, t);
      else if (id === "sound") await sound(options, t);
      else if (id === "credits") await credits(options, t);
      else if (id === "analytics") await analyticsRun(options, t);
    } finally {
      stopVideos();
      closeFrame();
      restoreProgress();
    }
  },
  stop() {
    stopVideos();
    closeFrame();
    restoreProgress();
  },
});
