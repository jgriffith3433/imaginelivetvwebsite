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
  direction: { choices: 1, to: ["sewerWater"] },
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
const AUDIO_KEY = "iltv.sound";
const SOUND_RUN = "iltv.playtest.sound"; // sessionStorage: the sound scenario carries on after its reload
const soundOf = (doc = document) => doc.defaultView && doc.defaultView.hawkesSound;
const audioOf = (doc = document) => doc.defaultView && doc.defaultView.iltvAudio;

/** A press where a viewer's finger or mouse would go: whatever is on top there gets it, so a covered control fails. */
async function tapAt(t, el, label, { quick = false } = {}) {
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
  await sleep(quick ? 25 : 60);
  target.dispatchEvent(new win.PointerEvent("pointerup", { ...init, buttons: 0 }));
  target.dispatchEvent(new win.MouseEvent("mouseup", { ...init, buttons: 0 }));
  target.dispatchEvent(new win.MouseEvent("click", { ...init, buttons: 0 }));
  if (!quick) t.log(`tap ${label}`);
  await sleep(quick ? 15 : 120);
}


/** A press on something that must not react (a camera tile, the big screen): a real pointer and click at its middle on whatever is there. */
async function pressNothing(t, el, label) {
  if (!el) throw new Error(`${label} is not on the page`);
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const target = doc.elementFromPoint(x, y) || el;
  const init = { pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: win };
  target.dispatchEvent(new win.PointerEvent("pointerdown", init));
  target.dispatchEvent(new win.MouseEvent("mousedown", init));
  await sleep(40);
  target.dispatchEvent(new win.PointerEvent("pointerup", { ...init, buttons: 0 }));
  target.dispatchEvent(new win.MouseEvent("mouseup", { ...init, buttons: 0 }));
  target.dispatchEvent(new win.MouseEvent("click", { ...init, buttons: 0 }));
  t.log(`press ${label} (it must do nothing)`);
  await sleep(120);
}

/** What the big screen and the strip show, for the player in `doc`: the same camera on both, no button anywhere. */
function screenState(doc) {
  const api = apiOf(doc);
  const big = byIdIn(doc, "console-big");
  return { selected: api.selected(), camera: big.dataset.camera, state: big.dataset.state, changes: api.screen() ? api.screen().changes : -1, marked: [...doc.querySelectorAll("#console-wall .feed.is-selected")].map((x) => x.dataset.camera) };
}

/** Pressing a tile of the strip or the big screen does nothing (the characters change the feed, never the viewer). */
async function checkNotEnlargeable(t, doc, where) {
  const before = screenState(doc);
  const other = [...doc.querySelectorAll("#console-wall .feed")].find((x) => x.dataset.camera !== before.camera);
  if (other) await pressNothing(t, other, `a camera tile (${where})`);
  await pressNothing(t, byIdIn(doc, "console-big"), `the big screen (${where})`);
  await sleep(150);
  const after = screenState(doc);
  if (JSON.stringify(after) !== JSON.stringify(before)) t.problem("bug", `${where}: a press on a camera tile or the big screen changed the screen (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);
  const buttons = doc.querySelectorAll("#console-wall button, #console-wall [role=button], #console-big button, .console-big button");
  if (buttons.length) t.problem("bug", `${where}: the camera strip or the big screen has ${buttons.length} buttons (nothing there can be pressed)`);
  if (doc.querySelector("#console-wall .feed[aria-pressed], .big-close")) t.problem("bug", `${where}: a camera tile still says it can be pressed (aria-pressed or a Shrink button)`);
  return before;
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

const SPLASH_WAIT = 6000; // the splash holds about 0.7 s and fades in 0.4 s (cards visible well under 2 s, J phone criterion)

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
  if (st && st.inventory && st.inventory.keepFlashlight) {
    // The count sits in the flashlight's bar (js/spot.js): one number beside the torch, no other bar.
    const box = doc.getElementById("match-count");
    if (!shown(torchBar) || !shown(doc.getElementById("torch-slot"))) t.problem("bug", `${where}: ${id} is open but its flashlight isn't shown`);
    else if (!shown(box) || !/^\d+$/.test((box.textContent || "").trim())) t.problem("bug", `${where}: ${id} is open but its match count isn't shown in the inventory bar`);
    else if (shown(kitBar)) t.problem("bug", `${where}: ${id} shows another story's inventory`);
    else t.event("inventory", `${where}: ${id} (flashlight, matches ${box.textContent.trim()})`);
  } else if (st && st.inventory) {
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
  if (bar.id === "match-count") {
    if (bar.dataset.count !== undefined && !bar.hidden) out.matches = Number(bar.dataset.count);
    return out;
  }
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
  const bar = st.inventory.keepFlashlight ? doc.getElementById("match-count") : doc.querySelector(".inventory.kit");
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
let savedRuns = null; // a console story's saved run (localStorage "iltv.run.<cookie>"): { key: text or null }
function endingsStorageKey(st) {
  return `iltv.endings.${st.cookie}`;
}
function rememberProgress() {
  savedRuns = Object.fromEntries([
    ...allStories().filter((st) => st.type === "console").map((st) => [`iltv.run.${st.cookie}`, localStorage.getItem(`iltv.run.${st.cookie}`)]),
    ...allStories().map((st) => [endingsStorageKey(st), localStorage.getItem(endingsStorageKey(st))]),
  ]);
  const jar = document.cookie.split(";").map((s) => s.trim());
  savedCookie = Object.fromEntries(allStories().flatMap(cookiesOf).map((name) => [name, jar.find((c) => c.startsWith(name + "=")) ?? ""]));
}
/** Only the `analytics` scenario talks to Gen's collect endpoint. In every other run the page's analytics batches are
    swallowed here (sendBeacon says sent, fetch answers 202) so a Gen hiccup (a 502) isn't a console error in a run that
    isn't about analytics, and bot traffic stays off the shared endpoint. The SDK still queues, batches and marks them
    sent in its debug log. Returns the undo. */
function quietAnalytics() {
  const endpoint = (window.hawkesAnalytics && window.hawkesAnalytics.config && window.hawkesAnalytics.config().endpoint) || "";
  if (!endpoint) return () => {};
  const beacon = navigator.sendBeacon;
  const fetched = window.fetch;
  const ours = (url) => String(url && url.url ? url.url : url).split("?")[0] === endpoint;
  try {
    navigator.sendBeacon = function (url, ...rest) {
      return ours(url) ? true : beacon.call(this, url, ...rest);
    };
    window.fetch = function (url, ...rest) {
      return ours(url) ? Promise.resolve(new Response("{}", { status: 202 })) : fetched.call(this, url, ...rest);
    };
  } catch (e) {
    return () => {};
  }
  return () => {
    navigator.sendBeacon = beacon;
    window.fetch = fetched;
  };
}

function restoreProgress() {
  for (const [key, value] of Object.entries(savedRuns || {})) value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
  savedRuns = null;
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
/** A fresh browser: every story's run, unlocks and found endings forgotten. */
function clearProgress() {
  for (const name of allStories().flatMap(cookiesOf)) document.cookie = `${name}=; Max-Age=0; Path=/`;
  for (const st of allStories()) {
    if (st.type === "console") localStorage.removeItem(`iltv.run.${st.cookie}`);
    localStorage.removeItem(endingsStorageKey(st));
  }
}

/** What a story's unlocks cookie holds ({ seen, completed }), or null. */
function savedUnlocks(st) {
  return readJsonCookie(unlocksCookie(st));
}

/** The percent explored for n of all scenes: rounded down, never 0 once one is seen, 100 only at all. */
const pctOf = (n, all) => (!n ? 0 : n >= all ? 100 : Math.min(99, Math.max(1, Math.floor((n * 100) / all))));

/** The percent explored the data and the unlocks cookie give: unlocked scenes / all, rounded down. */
function exploredWant(st) {
  const u = savedUnlocks(st);
  // A console story keeps its unlocks as a bit per scene, in the order of its data (js/game.js packSeen).
  const ids = Object.keys(st.scenes);
  const bits = (u && u.ix) || "";
  const packed = ids.filter((id, i) => (parseInt(bits.charAt(Math.floor(i / 4)) || "0", 16) & (1 << (i % 4))) !== 0);
  const seen = new Set((isConsole(st) ? packed : u?.seen || []).filter((id) => st.scenes[id]));
  return pctOf(seen.size, Object.keys(st.scenes).length);
}

/** Where the run cookie says the story's run is: start (none, or at the first page), mid or end (an ending). */
function runWant(st) {
  const run = savedPlace(st);
  if (!run || !st.scenes[run.scene] || run.scene === st.start) return "start";
  return st.scenes[run.scene].ending ? "end" : "mid";
}

/** A card's badge says `want` (new, started, completed), visible across the card's top right corner.
    The featured story's hero has no ribbon: its progress lives on data-progress and .hero-go. */
function checkBadge(t, card, st, want, where) {
  if (!card) {
    t.problem("bug", `${where}: ${st.title} has no card or hero on the landing page`);
    return false;
  }
  if (card.classList.contains("hero")) {
    if (card.dataset.progress !== want) {
      t.problem("bug", `${where}: ${st.title}'s hero says progress "${card.dataset.progress}", not "${want}"`);
      return false;
    }
    const go = (card.querySelector(".hero-go")?.textContent || "").trim();
    const label = want === "completed" ? "Start Over" : GO[runWant(st)];
    if (go !== label) t.problem("bug", `${where}: ${st.title}'s hero is ${want} (run at ${runWant(st)}) but its button says "${go}", not "${label}"`);
    if (card.ownerDocument === document && stories().progress && stories().progress(st.id) !== want) {
      t.problem("bug", `${where}: iltvStories.progress("${st.id}") says ${stories().progress(st.id)}, the hero ${want}`);
    }
    t.event("badge", `${where}: ${st.id} hero ${want}, ${go}`);
    return true;
  }
  const ribbon = card.querySelector(".story-card-ribbon");
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
  for (const st of listedStories()) {
    const el =
      doc.querySelector(`#story-list a.story-card[data-story="${st.id}"]`) ||
      doc.querySelector(`#stories a.hero[data-story="${st.id}"]`);
    checkBadge(t, el, st, want(st), where);
  }
  await sleep(600); // on screen for the footage
  closeFrame();
}

/** One story's card after a reload of the home page (a frame loading it, as a viewer's refresh does): its progress is read
    back from the cookies, so it must still say Started or Completed with the percent, never Not started / 0%. */
async function badgeAfterReload(t, st, want, where) {
  const doc = await frameLoad(t, (f) => (f.src = "/"));
  const win = frame && frame.contentWindow;
  const sel = `#story-list a.story-card[data-story="${st.id}"]`;
  if (!doc || !(await waitFor(() => win.iltvStories && doc.querySelector(sel + "[data-progress]"), 10000))) {
    t.problem("bug", `${where}: the home page didn't load in the frame`);
    closeFrame();
    return;
  }
  await sleep(300);
  checkBadge(t, doc.querySelector(sel), st, want, where);
  await sleep(600); // on screen for the footage
  closeFrame();
}

/** The flags a way sets (a choice row's `set`, [4]) and the match count it leaves (the data's inventory, worked out here). */
function sparkState(st, way) {
  const flags = {};
  for (let i = 0; i + 1 < way.length; i++) {
    const row = st.scenes[way[i]].choices.find((c) => c[2] === way[i + 1]);
    if (row && row[4]) Object.assign(flags, row[4]);
  }
  const item = st.inventory && st.inventory.items.find((i) => i.id === "matches");
  let matches = null;
  if (item) {
    matches = item.start;
    for (const id of way) {
      if (id === st.start) matches = item.start;
      const d = (st.scenes[id].inventory || {}).matches;
      if (typeof d === "number") matches = Math.max(0, Math.min(item.max, matches + d));
    }
  }
  return { flags, matches };
}

/** The choice rows of a scene that are on offer after `way` (a row's `when` flags and `matches` {min,max}, [5] and [6],
    and a gate's `requires` flags, [7]: a choice not there at all without them, like Trust Fall's belief gates). */
function offeredRows(st, id, way) {
  const { flags, matches } = sparkState(st, way);
  const hold = (want) => Object.entries(want).every(([k, v]) => (flags[k] === undefined ? false : flags[k]) === v);
  return st.scenes[id].choices.filter((c) => {
    if (c[5] && !hold(c[5])) return false;
    if (c[7] && c[7].requires && !hold(c[7].requires)) return false;
    if (c[6] && matches != null && ((c[6].min != null && matches < c[6].min) || (c[6].max != null && matches > c[6].max))) return false;
    return true;
  });
}

/** Whether some choice of the story is offered only in some states: a `when` [5], a `matches` range [6] or a gate's
    `requires` flags [7]. */
function hasConditionalChoices(st) {
  return Object.values(st.scenes).some((s) => s.choices.some((c) => c[5] || c[6] || (c[7] && c[7].requires)));
}

/** The shortest way from the start (not through a death) to a scene that passes `test`: the scene ids after the start.
    A story with conditional choices is walked by state (scene, flags, matches), so the way only uses choices that are offered. */
function wayTo(st, test) {
  const conditional = hasConditionalChoices(st);
  const key = (way) => (conditional ? `${way[way.length - 1]} ${JSON.stringify(sparkState(st, way))}` : way[way.length - 1]);
  const seen = new Set([key([st.start])]);
  const queue = [[st.start]];
  while (queue.length) {
    const way = queue.shift();
    const id = way[way.length - 1];
    if (id !== st.start && test(st.scenes[id])) return way.slice(1);
    if (st.scenes[id].dead) continue;
    for (const c of conditional ? offeredRows(st, id, way) : st.scenes[id].choices) {
      if (!st.scenes[c[2]]) continue;
      const next = [...way, c[2]];
      const k = key(next);
      if (!seen.has(k)) seen.add(k), queue.push(next);
    }
  }
  return null;
}

/** Plays a way through the open story from where it is, clicking the choice that leads to each next scene. */
async function playWay(t, st, way) {
  for (const next of way) {
    const at = st.scenes[sceneId()];
    const i = at.choices.findIndex((c) => c[2] === next);
    // A conditional fork shows only the choices on offer: each button keeps its place in the data (data-choice-index).
    const button = choiceButtons().find((b) => Number(b.dataset.choiceIndex) === i);
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
/** A story's landing tile: its catalogue card, or the featured hero when that story is featured (not repeated in the catalogue). */
const cardOf = (id) =>
  document.querySelector(`#story-list a.story-card[data-story="${id}"]`) ||
  document.querySelector(`#stories a.hero[data-story="${id}"]`);

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
  // Opening a story puts the page at the top at once (an animated scroll left the card cut off and the footer over the inventory bar).
  if (card && stories().current() === id && Math.round(window.scrollY) !== 0) t.problem("bug", `${id}: opening the story left the page scrolled (${Math.round(window.scrollY)}px): the card top is cut off and the footer shows over the inventory bar`);
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
  await tapAt(t, $("console") && !$("console").hidden ? $("console-stories") : $("spark-stories"), "All stories");
  await sleep(300);
  if (!landingShown()) throw new Error("All stories didn't bring the landing page back");
  if (document.querySelector("#spark-video video:not(.spark-leave)")) t.problem("bug", "the story's video is still on the page after All stories");
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
    ["#iltv-sound-toggle", "Sound toggle"],
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
  const cards = [...document.querySelectorAll("#story-list a.story-card, #stories a.hero")];
  if (!cards.length) t.problem("bug", "the landing page shows no stories");
  t.metric("stories", cards.length);
  t.note(`${cards.length} stories: ${cards.map((c) => c.querySelector("h2")?.textContent.trim()).join(" / ")}`);
  // First-minutes (J, 2026-11-11): as a newcomer from a fresh browser at 1280x720 and 390x844, report motion /
  // sound / first-choice timing per story; hero must move within 2 s; first choice after 30 s is a problem.
  t.scene("First minutes: hero motion and per-story timing");
  await firstMinutesRun({ at: "smoke" }, { ...t, progress: (p) => t.progress(0.05 * p) });
  await sleep(800);
  await openStory(t, FIRST);
  await toStart(t);
  await checkTree(t, story(FIRST), "The Final Spark's Tree");
  t.scene("The sewer");
  t.progress(0.2);
  const ok = await checkVideo(t, document.querySelector("#spark-video video:not(.spark-leave)"), "start", 3, { autoplay: true });
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
    else await checkVideo(t, document.querySelector("#spark-video video:not(.spark-leave)"), sceneId(), 1, { autoplay: true });
  }
  checkNoBack(t, "The Final Spark");
  checkHitTargets(t, document, "The Final Spark");
  await toLanding(t);
  t.progress(0.5);
  // The other listed stories, each opened from its card the way a viewer does.
  const others = listedStories().filter((x) => x.id !== FIRST);
  let k = 0;
  for (const info of others) {
    const st = story(info.id);
    if (!st) { t.problem("bug", `${info.id} is listed but has no data`); continue; }
    t.scene(`${st.title}: card, first page`);
    if (isConsole(st)) {
      await consoleOpen(t, st);
      await consoleFresh(t, st);
      await consoleHeard(t, document, st.id);
      const tiles = document.querySelectorAll("#console-wall .feed").length;
      if (tiles < 6) t.problem("bug", `${st.title}: the wall shows ${tiles} feeds, not 6 to 9`);
      const open = openChoices();
      if (!open.length) t.problem("bug", `${st.title}: no choices on its first scene`);
      t.event("smoke-story", `${st.title}: ${tiles} feeds, ${open.length} choices after the first lines`);
      if (open.length) {
        const m = consoleModel(st);
        await consoleChoose(t, st, m, m.open()[0][1], document, st.id, null);
      }
    } else {
      await openStory(t, st.id);
      await toStart(t);
      const played = await checkVideo(t, document.querySelector("#spark-video video:not(.spark-leave)"), `${st.id} start`, 3, { autoplay: true });
      const btns = choiceButtons();
      if (!btns.length) t.problem("bug", `${st.title}: no choices on its first page`);
      if (played && btns.length) {
        const before = $("spark-story").textContent;
        btns[0].click();
        await sleep(300);
        t.event("choice", `${st.title}: ${enText(btns[0])} -> ${sceneId()}`);
        if ($("spark-story").textContent === before) t.problem("bug", `${st.title}: the page text didn't change after "${enText(btns[0])}"`);
        else await checkVideo(t, document.querySelector("#spark-video video:not(.spark-leave)"), `${st.id} ${sceneId()}`, 1, { autoplay: true });
      }
      checkNoBack(t, st.title);
      checkHitTargets(t, document, st.title);
    }
    await toLanding(t);
    // Checked now, while the run's own cookies are still set: the run's end puts the viewer's earlier progress back
    // (restoreProgress), so a card photographed after it says Not started for a story the run played.
    checkBadge(t, cardOf(st.id), st, "started", `after one choice in ${st.title}`);
    t.progress(0.5 + (0.3 * ++k) / others.length);
  }
  // Phone-ready (J, 2026-11-09): beta's run plays smoke, so smoke also shows The Final Spark's language picker at
  // 390x844, a switch mid-story (same scene, the screen's text in the picked language) and the blog list's titles,
  // each in one language: the `language` scenario's own leg, its progress mapped onto the last part of this run.
  t.scene("Phone: language picker and blog titles");
  t.event("smoke-language", "the language leg at 390x844 (the `language` scenario)");
  await languageRun({}, { ...t, progress: (p) => t.progress(0.8 + 0.2 * p) });
  // Phone media (J, 2026-11-09): beta judges smoke, so it also shows, at 390x844, the landing's cards within 2 s, The Water
  // Road's poster under the clip before it loads and its smaller rendition after Tap to play (the `phone-media` leg).
  t.scene("Phone: landing within 2 s, poster, smaller clip");
  await phoneMediaRun({ story: "water-road", landingOnly: false }, { ...t, progress: (p) => t.progress(0.9 + 0.1 * p) });
  t.scene("Scene swap after a choice, 1280x720 and 390x844");
  await swapRun({}, { ...t, progress: (p) => t.progress(0.94 + 0.03 * p) });
  t.scene("Choice cards in all three stories at 390x844, 844x390 and 1280x720");
  await phoneChoicesRun({ at: "smoke" }, { ...t, progress: (p) => t.progress(0.97 + 0.015 * p) });
  // Continue Previously (beta plays smoke only): one choice in each story already happened above, but language /
  // phone-media / swap may have cleared mid-run state, so the trimmed continue-recap leg re-arms and presses Continue.
  t.scene("Continue recap after a choice");
  await continueRecap({ at: "smoke" }, { ...t, progress: (p) => t.progress(0.985 + 0.005 * p) });
  // Endings gallery (beta plays smoke): seed one found ending on The Water Road, open the Endings tab, check count
  // and a locked silhouette, and that it fits at 390x844.
  t.scene("Endings gallery (seeded one found)");
  await endingsGalleryRun({ at: "smoke", story: "water-road" }, { ...t, progress: (p) => t.progress(0.99 + 0.005 * p) });
  // Audio buses (beta plays smoke): unlock on first tap, duck under a clip, header toggle saves iltv.sound; 390x844.
  t.scene("Audio buses: unlock, duck, header toggle");
  await audioBusesRun({ at: "smoke" }, { ...t, progress: (p) => t.progress(0.995 + 0.004 * p) });
  // UI sounds and beds (beta plays smoke): choice-appear, tap, timer ticks, ending sting, beds, Sound off after a reload.
  t.scene("Audio: UI sounds, beds and Sound off after a reload");
  await audioUiRun({ at: "smoke" }, { ...t, progress: (p) => t.progress(0.9985 + 0.0005 * p) });
  // Decisive choice (beta plays smoke): chosen card glows, others fall away, double-tap is one choice, keys 1/2;
  // mid-animation screenshots at 390x844 for Final Spark and Night Shift.
  t.scene("Decisive choice: glow, fall-away, double-tap, keys");
  await decisiveRun({ at: "smoke" }, { ...t, progress: (p) => t.progress(0.999 + 0.001 * p) });
  closeViewFrame();
  t.progress(1);
}

/** Is the scene area painted with art right now (sampled in the frame's own window)? Clips are drawn to a small canvas
    and must not be near-uniform black; a poster/background picture or a console room counts when its image is loaded. */
function sceneArt(doc, console_) {
  const win = doc.defaultView;
  const box = doc.getElementById(console_ ? "console-room" : "spark-video");
  if (!box) return { painted: false, black: false };
  const r = box.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return { painted: false, black: false };
  const v = box.querySelector("video:not(.spark-leave)");
  if (v && v.readyState >= 2 && v.videoWidth) {
    try {
      const c = doc.createElement("canvas");
      c.width = 16; c.height = 16;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(v, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data;
      let max = 0;
      for (let i = 0; i < d.length; i += 4) max = Math.max(max, d[i], d[i + 1], d[i + 2]);
      return { painted: max > 24, black: max <= 24 };
    } catch (e) { /* tainted: fall through */ }
  }
  const imgs = [...box.querySelectorAll("img")];
  if (imgs.length) return { painted: imgs.some((i) => i.complete && i.naturalWidth > 0), black: false };
  const bg = win.getComputedStyle(box).backgroundImage;
  const m = /url\("?([^")]+)"?\)/.exec(bg || "");
  if (m) {
    const cache = (win.__swapImgs = win.__swapImgs || {});
    if (!cache[m[1]]) { cache[m[1]] = new win.Image(); cache[m[1]].src = m[1]; }
    return { painted: cache[m[1]].complete && cache[m[1]].naturalWidth > 0, black: false };
  }
  return { painted: !!console_ && !!box.querySelector(".fig, .room-art > *"), black: false };
}

/** After a choice: every painted frame for 1 s (requestAnimationFrame only) counts near-black frames of the scene area
    and the time until the next scene's art shows. Two choices in each story at 1280x720 and at 390x844. */
async function swapRun(options, t) {
  if (!savedRuns && savedCookie == null) rememberProgress();
  const sizes = [[1280, 720, "desktop"], [390, 844, "phone"], [844, 390, "landscape"]];
  const ids = [FIRST, ...listedStories().map((x) => x.id).filter((x) => x !== FIRST)];
  let n = 0;
  for (const id of ids) {
    const st = story(id);
    if (!st) continue;
    const con = isConsole(st);
    for (const [w, h, label] of sizes) {
      clearProgress();
      t.scene(`${st.title}: scene swap at ${w}x${h}`);
      const doc = await viewFrameLoad(t, `/?story=${id}`, w, h);
      const win = doc.defaultView;
      if (con) await consolePrompt(t, doc, `${id} (swap)`);
      else await passPrompt(t, doc, `${id} (swap)`);
      const sceneNow = () => (con ? win.iltvConsole.scene() : win.finalSpark.scene());
      const buttons = () => (con ? openChoices(doc) : [...doc.querySelectorAll("#spark-choices .choice")]);
      let blackFrames = 0, worstSwap = 0, frames = 0;
      for (let k = 0; k < 2; k++) {
        if (con) await consoleHeard(t, doc, `${id} ${label} swap ${k + 1}`);
        if (!(await waitFor(() => buttons().length && (con || doc.getElementById("spark-choices").dataset.phase === "ready"), 40000))) { t.problem("bug", `${id} ${label}: no choice to press for the swap check`); break; }
        await sleep(400);
        const before = sceneNow();
        const result = new Promise((resolve) => {
          const t0 = win.performance.now();
          const o = { black: 0, frames: 0, swap: null, changedAt: null };
          const tick = () => {
            const dt = win.performance.now() - t0;
            o.frames++;
            const now = sceneNow();
            const art = sceneArt(doc, con);
            if (art.black) o.black++;
            if (now !== before && o.changedAt == null) o.changedAt = dt;
            if (o.changedAt != null && o.swap == null && art.painted) o.swap = dt;
            if (dt < 1000) win.requestAnimationFrame(tick); else resolve(o);
          };
          win.requestAnimationFrame(tick);
        });
        await tapAt(t, buttons()[0], `swap choice ${k + 1}`, { quick: true });
        t.event("screenshot", `${id} ${label} ${w}x${h}: right after choice ${k + 1} (from ${before})`);
        const o = await result;
        if (sceneNow() === before) { t.problem("bug", `${id} ${label}: choice ${k + 1} went nowhere`); continue; }
        const swap = o.swap == null ? 1000 : Math.round(o.swap);
        blackFrames += o.black; frames += o.frames; worstSwap = Math.max(worstSwap, swap);
        t.event("scene-swap", `${id} ${label} choice ${k + 1} -> ${sceneNow()}: blackFrames ${o.black}/${o.frames}, sceneSwapMs ${swap}`);
        t.event("screenshot", `${id} ${label} ${w}x${h}: scene ${sceneNow()} after 1 s`);
        n++;
      }
      t.metric(`blackFrames-${id}-${label}`, blackFrames);
      t.metric(`sceneSwapMs-${id}-${label}`, worstSwap);
      t.event("scene-swap-report", `${id} ${label}: blackFrames ${blackFrames} of ${frames}, sceneSwapMs ${worstSwap}`);
      if (blackFrames > 0) t.problem("bug", `${id} ${label}: the scene area went black for ${blackFrames} frames after a choice`);
      if (worstSwap > 300) t.problem("bug", `${id} ${label}: the next scene's art took ${worstSwap} ms to show after a choice (over 300)`);
    }
  }
  t.metric("sceneSwapChecks", n);
  closeViewFrame();
}

/** `media`: every listed story shows its video and plays with sound, under iPhone Safari's media rules (the page's
    ?ios-rules=1, js/hawkes-sound.js: a video or audio may start with sound only if a press started it, else it is
    refused as Safari refuses it), at 390x844 and 1280x800. After Tap to play and after each of three choices (real
    presses, nothing else pressed in between): a clip story's clip is playing, unmuted, and has decoded sound; a
    console story's voice line is playing unmuted (and its ambience when the scene has one). A refused play, Tap to
    play coming back, a scene with no video or one that plays silent is a bug naming the story, size and scene. */
async function mediaRun(options, t) {
  if (!savedRuns && savedCookie == null) rememberProgress();
  const keepSound = localStorage.getItem(SOUND_KEY);
  localStorage.removeItem(SOUND_KEY); // sound on, full volume: a silent scene is then the player's fault
  const sizes = options.sizes === "desktop" ? [[1280, 800, "desktop"]] : options.sizes === "phone" ? [[390, 844, "phone"]] : [[390, 844, "phone"], [1280, 800, "desktop"]];
  const ids = options.story ? [options.story] : listedStories().map((x) => x.id);
  const srcOf = (m) => decodeURI(String(m.currentSrc || m.getAttribute("src") || ""));
  const playing = (m) => m && !m.paused && m.currentTime > 0.2 && !srcOf(m).startsWith("data:");
  let checks = 0, n = 0;
  try {
    for (const id of ids) {
      const st = story(id);
      if (!st) { t.problem("bug", `media: no story "${id}"`); continue; }
      const con = isConsole(st);
      for (const [w, h, label] of sizes) {
        clearProgress();
        const where = `${id} (${label})`;
        t.scene(`${st.title}: video and sound at ${w}x${h}, iPhone rules`);
        const doc = await viewFrameLoad(t, `/?story=${id}&ios-rules=1`, w, h);
        const win = doc.defaultView;
        if (!win.iosMediaRefusals) t.problem("bug", `${where}: the page didn't take ?ios-rules=1 (js/hawkes-sound.js), so iPhone rules weren't checked`);
        if (con) await consolePrompt(t, doc, where);
        else await passPrompt(t, doc, where);
        const scene = () => (con ? win.iltvConsole.scene() : win.finalSpark.scene());
        for (let k = 0; k <= 3; k++) {
          const at = `${where} at ${scene()}`;
          if (soundOf(doc).prompt()) t.problem("bug", `${at}: Tap to play is up again ${k ? `after choice ${k}` : "after the first tap"} (iPhone refused the next sound)`);
          if (con) {
            const voice = () => [...doc.querySelectorAll("audio")].find((a) => playing(a) && /\/media\/|line-\d/.test(srcOf(a)) && !/ambience|music|sfx/.test(srcOf(a)));
            const ok = await waitFor(() => voice() && !voice().muted, 8000);
            const v = voice();
            t.event("media-sound", `${at}: voice ${v ? `${srcOf(v).replace(win.location.origin, "")} playing${v.muted ? " MUTED" : ""} at ${v.currentTime.toFixed(1)} s` : "NOT playing"}`);
            if (!ok) t.problem("bug", `${at}: no voice line is playing with sound${k ? ` after choice ${k}` : " after Tap to play"}`);
            const amb = st.ambience && st.ambience[st.scenes[scene()].ambience];
            if (amb) {
              const bed = () => [...doc.querySelectorAll("audio")].find((a) => playing(a) && srcOf(a).endsWith(amb));
              if (!(await waitFor(() => bed() && !bed().muted, 4000))) t.problem("bug", `${at}: the ambience ${amb} isn't playing with sound`);
            }
          } else {
            const video = () => doc.querySelector("#spark-video video:not(.spark-leave)");
            const shown = await waitFor(() => playing(video()) && video().videoWidth > 0, 10000);
            const v = video();
            if (!shown) t.problem("bug", `${at}: no video playing${v ? ` (${srcOf(v).replace(win.location.origin, "") || "no src"}, readyState ${v.readyState}, paused ${v.paused}${v.error ? `, error ${v.error.code}` : ""})` : " (no video element)"}`);
            else {
              await waitFor(() => v.webkitAudioDecodedByteCount > 0, 3000);
              const heard = v.webkitAudioDecodedByteCount;
              t.event("media-sound", `${at}: ${srcOf(v).replace(win.location.origin, "")} playing${v.muted ? " MUTED" : ""}, volume ${v.volume}, ${heard == null ? "?" : heard} bytes of sound decoded`);
              if (v.muted) t.problem("bug", `${at}: the clip plays muted${k ? ` after choice ${k}` : " after Tap to play"}`);
              if (heard === 0) t.problem("bug", `${at}: the clip plays silent (no sound decoded)`);
            }
          }
          checks++;
          if (k === 3) break;
          // Next scene: a real press on the first choice, as a viewer would (console lines skipped with Skip, a press too).
          const buttons = () => (con ? openChoices(doc) : [...doc.querySelectorAll("#spark-choices .choice")]);
          if (con) await consoleHeard(t, doc, at);
          if (!(await waitFor(() => buttons().length && (con || doc.getElementById("spark-choices").dataset.phase === "ready"), 60000))) { t.problem("bug", `${at}: no choice to press`); break; }
          const before = scene();
          await tapAt(t, buttons()[0], `choice ${k + 1} (${where})`, { quick: true });
          if (!(await waitFor(() => scene() !== before, 9000))) { t.problem("bug", `${at}: choice ${k + 1} went nowhere`); break; }
          await sleep(con ? 300 : 800);
        }
        const refused = win.iosMediaRefusals || [];
        t.metric(`mediaRefusals-${id}-${label}`, refused.length);
        t.event("media-refusals", `${where}: ${refused.length} play(s) iPhone would refuse${refused.length ? ": " + refused.slice(0, 5).map((r) => `${r.tag} ${r.src}`).join(", ") : ""}`);
        for (const r of refused.slice(0, 5)) t.problem("bug", `${where}: iPhone would refuse to play ${r.tag} ${r.src} with sound at ${r.at} ms (no press started it; called from ${r.from || "?"})`);
        t.progress(++n / (ids.length * sizes.length));
      }
    }
  } finally {
    if (keepSound == null) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, keepSound);
    closeViewFrame();
  }
  t.metric("mediaChecks", checks);
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
    if (isConsole(st)) {
      // A console story: the state explorer's ways, played (see consoleWalk).
      await consoleOpen(t, st);
      await consoleWalk(t, st, sums);
      await toLanding(t);
      continue;
    }
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
    checkExplored(t, st, pctOf(seen.size, all.length), at(id));
    if (spark().unlocked().length !== seen.size) t.problem("bug", `${at(id)}: ${spark().unlocked().length} scenes unlocked, the bot has reached ${seen.size}`);
    if (seen.size === 1) await checkTree(t, st, `${st.title}'s Tree at the start`);
    t.note(`${st.title}: ${path.join(" > ")}`);
    t.event("scene", `${at(id)} (${info.state}, ${info.choices.length} choices)`);
    t.progress((sums.scenes + seen.size) / total);
    const video = document.querySelector("#spark-video video:not(.spark-leave)");
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
  // A fork with conditional choices (flags, a match range) hides some in some states. A scene no press above reached is walked
  // to by state (the shortest way that only uses choices on offer), by real presses, and visited from there.
  if (hasConditionalChoices(st)) {
    for (let round = 0; round < all.length; round++) {
      const todo = all
        .filter((id) => !seen.has(id))
        .map((id) => ({ id, way: wayTo(st, (sc) => sc === st.scenes[id]) }))
        .filter((x) => x.way)
        .sort((x, y) => x.way.length - y.way.length)[0];
      if (!todo) break;
      const chain = [st.start, ...todo.way];
      await toStart(t, { quiet: true });
      await playWay(t, st, todo.way);
      t.event("state-way", `${at(todo.id)}: by ${chain.join(" > ")} (flags ${JSON.stringify(sparkState(st, chain).flags)}, matches ${sparkState(st, chain).matches})`);
      await visit(todo.id, [...chain.slice(0, -1), todo.id], chain);
    }
  }
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
  const hero = document.querySelector("#stories a.hero");
  const featuredId = hero && hero.dataset.story;
  const cards = [...document.querySelectorAll("#story-list a.story-card")];
  t.metric("stories", list.length);
  t.metric("cards", cards.length + (featuredId ? 1 : 0));
  // Featured story is the hero only (not repeated as the first catalogue card). Catalogue follows the listing order of the rest.
  const catalogueWant = list.filter((st) => st.id !== featuredId).map((st) => st.id);
  const order = cards.map((c) => c.dataset.story);
  if (!featuredId || !list.some((st) => st.id === featuredId)) t.problem("bug", "the landing page has no featured hero for a listed story");
  if (order.join() !== catalogueWant.join()) t.problem("bug", `the catalogue shows ${order.join(", ") || "no stories"}, expected ${catalogueWant.join(", ") || "(only the hero)"}`);
  if (order[0] && order[0] === featuredId) t.problem("bug", `the featured story ${featuredId} is repeated as the first catalogue card`);
  for (const st of list) if (!cardOf(st.id)) t.problem("bug", `${st.id} is listed but has no hero or catalogue card`);
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

    // A console story opens its own player (title, first scene's lines and choices), under its own Tap to play.
    if (isConsole(st)) {
      await consoleListedOpen(t, st);
      list.forEach((other, j) => checkBadge(t, cardOf(other.id), other, j <= i ? "started" : "new", `after opening ${st.title}`));
      t.progress((i + 1) / (list.length + 2));
      continue;
    }
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
    checkExplored(t, st, pctOf(1, Object.keys(st.scenes).length), `${st.id}: ${st.start}`);
    await checkTree(t, st, `${st.title}'s Tree on its first page`);
    const first = st.scenes[st.start];
    if (enText($("spark-story")) !== first.story[1]) t.problem("bug", `${st.id}: the first page says "${enText($("spark-story"))}"`);
    if (first.video || document.querySelector("#spark-video video:not(.spark-leave)")) await checkVideo(t, document.querySelector("#spark-video video:not(.spark-leave)"), `${st.id}: ${st.start}`, 2, { autoplay: true });
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
    if (isConsole(st)) {
      await consoleListedEnding(t, st);
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
      const again = document.querySelector("#spark-choices [data-death=start]");
      if (!again) t.problem("bug", `${st.id}: the death ${sceneId()} has no Start over back to the start`);
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
    if (isConsole(st)) {
      await consoleListedStartOver(t, st);
      continue;
    }
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
    // Expected, not a bug (canon): Start Over forgets the run, never what was found, so the card stays Completed with its
  // percent and a Start Over button. A reviewer should not flag "Completed after Start Over".
  checkBadge(t, cardOf(st.id), st, "completed", `after Start Over in ${st.title} (expected: the card stays Completed with its percent and Start Over; only the run restarts)`);
  await badgeAfterReload(t, st, "completed", `after Start Over and a reload (expected: still Completed, same percent, Start Over)`);
    if (go() !== "Start Over") t.problem("bug", `${st.id}: after Start Over its card's button says "${go()}", not Start Over`);
    await sleep(600);
  }
  t.progress((list.length + 1) / (list.length + 2));

  // A draft (listed: false) has no card, but plays at /?story=<id>: its title, first page, choices, inventory; and its
  // saved place (a few choices in, then All stories and back) comes back with the same scene and counts.
  for (const st of allStories().filter((s) => !s.listed)) {
    t.scene(`${st.title}: draft, by its link`);
    if (isConsole(st)) {
      await consoleDraft(t, st);
      continue;
    }
    await openStory(t, st.id);
    if ($("spark-title").textContent.trim() !== st.title.toUpperCase()) t.problem("bug", `${st.id}: the player's title is "${$("spark-title").textContent}"`);
    await toStart(t);
    if (enText($("spark-story")) !== st.scenes[st.start].story[1]) t.problem("bug", `${st.id}: the first page says "${enText($("spark-story"))}"`);
    if (!choiceButtons().length) t.problem("bug", `${st.id}: no choices on the first page`);
    if (MADE.includes(st.id)) {
      // Its media is made: the first page plays its cut (still no card until J lists it).
      const video = document.querySelector("#spark-video video:not(.spark-leave)");
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
      const before = kitText(st.inventory.keepFlashlight ? document.getElementById("match-count") : document.querySelector(".inventory.kit"));
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
      // The link page itself shows the story's card (picture, title, logline) until it forwards, and the story is then
      // tapped open, so the screen the runner holds on is the story and not a flat dark prompt (gap 43: blank-screen warnings).
      if (win.hawkesSound?.prompt()) await passPrompt(t, frame.contentDocument, `/${st.id}/`);
    }
    await sleep(800);
    closeFrame();
  }
  const notesDoc = await frameLoad(t, (f) => (f.src = "/notes/"));
  const postCard = notesDoc && notesDoc.querySelector(".notes-list a");
  if (postCard) {
    const postPath = pathOf(postCard.getAttribute("href"));
    const postDoc = await openByClick(t, "/notes/", postPath);
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

/** No title splash or Tap to play overlay is visible on `doc` (or on the host page). */
function checkNoSplash(t, doc, where) {
  for (const [d, label] of [[doc, where], [document, `${where} (home)`]]) {
    if (!d) continue;
    const win = d.defaultView || window;
    const splash = d.querySelector("#title-splash, .tap-splash, #tap-to-play, .tap-to-play");
    if (splash) {
      const style = win.getComputedStyle(splash);
      if (splash.getClientRects().length > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0) {
        t.problem("bug", `${label}: splash overlay (${splash.id ? "#" + splash.id : splash.className}) is visible`);
        return false;
      }
    }
    if (d.documentElement.classList.contains("is-tap-waiting")) {
      t.problem("bug", `${label}: page still has is-tap-waiting set`);
      return false;
    }
  }
  return true;
}

/** Opens `target` by clicking its link on `from` (a viewer's click). Falls back to loading it. */
async function openByClick(t, from, target) {
  if (from) {
    const doc = await frameLoad(t, (f) => (f.src = from));
    if (doc && /^\/f(\/|$)/.test(target)) checkNoSplash(t, doc, `${from} -> ${target}`);
    const link = doc && [...doc.querySelectorAll("a[href]")].find((a) => pathOf(a.getAttribute("href"), doc.baseURI) === target);
    if (link) {
      link.scrollIntoView({ block: "center", behavior: "instant" });
      return frameLoad(t, () => link.click());
    }
  }
  return frameLoad(t, (f) => (f.src = target));
}

async function pages(options, t) {
  t.scene("Branch pages");
  const list = allStories();
  const total = list.reduce((n, st) => n + Object.keys(st.scenes).length, 0);
  const done = new Set();
  for (const st of list) await (isConsole(st) ? crawlConsolePages : crawlPages)(t, st, done, total);
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

async function crossfade(options, t) {
  t.scene("Cross-fade");
  await passPrompt(t);
  for (const id of options.story ? [options.story] : ["final-spark", "water-road"]) {
    if (!story(id)) continue;
    await openStory(t, id);
    await sleep(1500);
    const first = document.querySelector("#spark-video video:not(.spark-leave)");
    const vol0 = first ? first.volume : 1;
    const btn = choiceButtons()[0];
    if (!btn) { t.problem("bug", `${id}: no choice to press`); continue; }
    btn.disabled = false;
    await tapAt(t, btn, "the first choice");
    const seen = [];
    for (let i = 0; i < 8; i++) {
      await sleep(50);
      const box = document.getElementById("spark-video");
      const layers = [...box.querySelectorAll("video, .spark-video-blank")];
      const out = layers.find((l) => l.classList.contains("spark-leave"));
      const inn = layers.find((l) => !l.classList.contains("spark-leave"));
      seen.push({ layers: layers.length, outOpacity: out ? +getComputedStyle(out).opacity : null, outVol: out && out.tagName === "VIDEO" ? out.volume : null, inPlaying: inn && inn.tagName === "VIDEO" ? !inn.paused && inn.currentTime > 0 : null });
    }
    const during = seen.filter((x) => x.layers > 1);
    t.event("crossfade", `${id}: ${during.length} samples with both layers`, { vol0, seen });
    if (!during.length) t.problem("bug", `${id}: the scene change did not cross-fade (never two layers)`);
    else if (during.some((x) => x.outOpacity === 0)) t.problem("bug", `${id}: outgoing layer cut to nothing`);
    if (first && during.length > 1 && !during.some((x) => x.outVol != null && x.outVol < vol0)) t.problem("bug", `${id}: outgoing audio did not fade`);
    if (during.some((x) => x.inPlaying === false)) t.problem("bug", `${id}: incoming clip was not moving under the fade`);
    await sleep(600);
  }
}

/** The Continue control for a mid-run story: the hero's Continue, else a Continue-watching card, else the catalogue card. */
function continueControl(doc, id) {
  const hero = doc.querySelector(`#stories a.hero[data-story="${id}"]`);
  const heroGo = hero && (hero.querySelector(".hero-go")?.textContent || "").trim();
  if (hero && /continue/i.test(heroGo)) return hero.querySelector(".hero-go") || hero;
  const row = doc.querySelector(`#continue-list a.continue-card[data-story="${id}"]`);
  if (row) return row.querySelector(".continue-go") || row;
  const card = doc.querySelector(`#story-list a.story-card[data-story="${id}"]`);
  const go = card && (card.querySelector(".story-card-go")?.textContent || "").trim();
  if (card && /continue/i.test(go)) return card.querySelector(".story-card-go") || card;
  return null;
}

/** Continue opens with a Previously recap (criteria for k_e502567d7d4e): each listed story, one choice in, All stories,
    Continue; the recap shows the last scene's poster, the title and one short line; a tap skips; then the left-off
    scene with its choices. Checked on the page and in frames at 390x844 and 1280x720.
    Options: {"story":"<id>"}; {"at":"smoke"} is the short smoke leg (always skip, desktop page + phone + wide frames,
    screenshot events so beta's review sees the overlay). */
async function continueRecap(options, t) {
  if (!savedRuns && savedCookie == null) rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passSplash(t);
  clearProgress();
  if (!landingShown()) await toLanding(t);
  const ids = options.story ? [options.story] : listedStories().map((s) => s.id);
  const smoke = options.at === "smoke";
  const leftAt = {};
  const choiceOf = {};

  t.scene("Continue recap: set mid-run for each story");
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const st = story(id);
    if (!st) { t.problem("bug", `${id}: no story data`); continue; }
    t.progress((i / ids.length) * 0.35);
    if (isConsole(st)) {
      await consoleOpen(t, st);
      await consoleFresh(t, st);
      await consoleHeard(t, document, id);
      const open = openChoices();
      if (!open.length) { t.problem("bug", `${id}: no choices on the first scene`); await toLanding(t); continue; }
      choiceOf[id] = (open[0].textContent || "").trim().replace(/^\d+\.\s*/, "");
      const m = consoleModel(st);
      await consoleChoose(t, st, m, m.open()[0][1], document, id, null);
      leftAt[id] = window.iltvConsole ? window.iltvConsole.scene() : null;
    } else {
      await openStory(t, id);
      await toStart(t);
      const btns = choiceButtons();
      if (!btns.length) { t.problem("bug", `${id}: no choices on the first page`); await toLanding(t); continue; }
      choiceOf[id] = enText(btns[0]).replace(/^\d+\.\s*/, "");
      await tapAt(t, btns[0], `${id}: the first choice`);
      await sleep(400);
      leftAt[id] = window.finalSpark.scene();
    }
    t.event("recap-armed", `${id}: left at ${leftAt[id]}, last choice "${choiceOf[id]}"`);
    await toLanding(t);
    await sleep(200);
    if (stories().run(id) !== "mid") t.problem("bug", `${id}: after one choice the run is "${stories().run(id)}", not mid (Continue)`);
  }

  const checkRecapAt = async (doc, win, id, where, { skip }) => {
    const st = story(id);
    const go = continueControl(doc, id);
    if (!go) {
      t.problem("bug", `${where}: no Continue control for ${id}`);
      return;
    }
    go.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(150);
    await tapAt(t, go, `${where}: Continue for ${id}`);
    await sleep(300);
    const sound = win.hawkesSound;
    if (sound && sound.prompt && sound.prompt()) await passPrompt(t, doc, `${where} ${id}`);
    const recapEl = () => doc.getElementById("story-recap");
    const up = await waitFor(() => {
      const el = recapEl();
      return el && !el.hidden && el.dataset.story === id;
    }, 4000);
    if (!up) {
      t.problem("bug", `${where}: Continue for ${id} showed no Previously recap`);
      return;
    }
    const el = recapEl();
    const poster = el.querySelector(".story-recap-poster");
    const title = (el.querySelector(".story-recap-title")?.textContent || "").trim();
    const line = (el.querySelector(".story-recap-line")?.textContent || "").trim();
    const posterOk = !!(poster && poster.getAttribute("src") && (poster.complete ? poster.naturalWidth > 0 : true));
    // Screenshot while the overlay is up so beta's review footage shows poster, title and the choice line.
    t.event("screenshot", `${where}: Previously for ${id} (title "${title}", line "${line}")`);
    t.event("previously", `${where}: ${id}: title "${title}", line "${line}", poster ${posterOk ? "yes" : "MISSING"}, skip=${skip}`);
    if (title !== st.title) t.problem("bug", `${where}: ${id} recap title is "${title}", not "${st.title}"`);
    if (!line) t.problem("bug", `${where}: ${id} recap has no choice line`);
    else if (choiceOf[id] && line !== choiceOf[id] && !choiceOf[id].includes(line) && !line.includes(choiceOf[id].replace(/^\d+\.\s*/, ""))) {
      t.problem("bug", `${where}: ${id} recap line is "${line}", the choice was "${choiceOf[id]}"`);
    }
    if (!posterOk) t.problem("bug", `${where}: ${id} recap has no poster`);
    if ([...el.querySelectorAll("p, h2")].filter((n) => (n.textContent || "").trim()).length > 4) {
      t.problem("warning", `${where}: ${id} recap has more copy blocks than expected (keep to title + one line)`);
    }
    if (skip) {
      await tapAt(t, el, `${where}: skip Previously for ${id}`);
      await sleep(500);
    } else {
      await waitFor(() => { const e = recapEl(); return !e || e.hidden; }, 4500);
      await sleep(200);
    }
    const still = recapEl();
    if (still && !still.hidden) t.problem("bug", `${where}: ${id} Previously stayed up after ${skip ? "a tap" : "3 s"}`);
    const api = win.iltvStories;
    if (api.current() !== id) t.problem("bug", `${where}: after the recap open is ${api.current()}, not ${id}`);
    if (isConsole(st)) {
      const scene = win.iltvConsole && win.iltvConsole.scene();
      if (leftAt[id] && scene !== leftAt[id]) t.problem("bug", `${where}: ${id} after recap is at ${scene}, left at ${leftAt[id]}`);
      await consoleHeard(t, doc, `${where} ${id} after recap`);
      if (!openChoices(doc).length) t.problem("bug", `${where}: ${id} after recap has no choices`);
    } else {
      const scene = win.finalSpark && win.finalSpark.scene();
      if (leftAt[id] && scene !== leftAt[id]) t.problem("bug", `${where}: ${id} after recap is at ${scene}, left at ${leftAt[id]}`);
      if (!doc.querySelectorAll("#spark-choices .choice").length) t.problem("bug", `${where}: ${id} after recap has no choices`);
    }
    t.event("screenshot", `${where}: after Previously ${id} at ${leftAt[id]} with choices`);
    t.event("recap-landed", `${where}: ${id} at ${leftAt[id]} with choices`);
  };

  // On the page (desktop): smoke always skips (budget); full continue-recap skips the first, waits out the rest.
  t.scene("Continue recap: desktop");
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!leftAt[id]) continue;
    t.progress(0.35 + (i / ids.length) * 0.25);
    await checkRecapAt(document, window, id, "desktop", { skip: smoke || i === 0 });
    await toLanding(t);
    await sleep(200);
  }

  // Phone and desktop frames share the cookies, so Continue still opens mid-run with the same recap.
  // Smoke keeps portrait + wide; landscape 844x390 catches the console handoff that left a blank body after Previously.
  // Always skip to stay inside the 400 s budget.
  for (const [w, h, label] of [[390, 844, "phone"], [844, 390, "landscape"], [1280, 720, "wide"]]) {
    t.scene(`Continue recap: ${label} ${w}x${h}`);
    const doc = await viewFrameLoad(t, "/", w, h);
    const win = doc.defaultView;
    await waitFor(() => !doc.getElementById("title-splash") && doc.querySelector("#story-list a.story-card"), 5000);
    await sleep(400);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!leftAt[id]) continue;
      t.progress(0.6 + (label === "phone" ? 0 : 0.2) + (i / ids.length) * 0.2);
      // Landing in the frame: open Continue without leaving the frame between stories (reload cookies each time).
      if (!doc.getElementById("stories") || doc.getElementById("stories").hidden) {
        const back = doc.getElementById("spark-stories") || doc.getElementById("console-stories");
        if (back) await tapAt(t, back, `${label}: All stories`);
        await sleep(300);
      }
      await checkRecapAt(doc, win, id, label, { skip: true });
      const back = doc.getElementById("spark-stories") || doc.getElementById("console-stories");
      if (back && !(doc.getElementById("stories") && !doc.getElementById("stories").hidden)) {
        await tapAt(t, back, `${label}: All stories after ${id}`);
        await sleep(300);
      }
    }
    closeViewFrame();
  }
  t.progress(1);
}

/** One article layout per post: hero, title, date, language label, reading time; Arabic reads right to left; nothing overflows. */
function checkArticle(t, doc, p) {
  const art = doc.querySelector("article.post-article");
  const q = (s) => art && art.querySelector(s);
  if (!art) return t.problem("bug", `${p.to}: no article`);
  const hero = q(".post-hero img.hero-image");
  if (!hero) t.problem("bug", `${p.to}: no hero image`);
  const h1 = q("h1"), time = q(".post-meta time"), lang = q(".post-meta .post-lang"), read = q(".post-meta .post-read");
  if (!h1 || !h1.textContent.trim()) t.problem("bug", `${p.to}: no title`);
  if (!time || !time.getAttribute("datetime")) t.problem("bug", `${p.to}: no date`);
  if (!lang || !lang.textContent.trim()) t.problem("bug", `${p.to}: no language label`);
  if (!read || !/^\d+ min read$/.test(read.textContent.trim())) t.problem("bug", `${p.to}: no reading time`);
  const script = art.getAttribute("data-script");
  const rtl = doc.defaultView.getComputedStyle(art).direction === "rtl";
  if (rtl !== (script === "ar")) t.problem("bug", `${p.to}: direction is ${rtl ? "rtl" : "ltr"} for script ${script}`);
  const lh = parseFloat(doc.defaultView.getComputedStyle(q(".post-body")).lineHeight) / parseFloat(doc.defaultView.getComputedStyle(q(".post-body")).fontSize);
  if (["zh", "ja", "hi", "bn", "ar"].includes(script) && lh < 1.8) t.problem("bug", `${p.to}: line-height ${lh.toFixed(2)} too tight for ${script}`);
  const root = doc.documentElement;
  if (root.scrollWidth > root.clientWidth + 1) t.problem("bug", `${p.to}: the page scrolls sideways`);
  t.event("article", `${script} ${lang ? lang.textContent : ""} ${read ? read.textContent : ""} rtl=${rtl} lh=${lh.toFixed(2)}`);
  t.add("articlesChecked");
}

async function blog(options, t) {
  t.scene("Studio notes");
  await passPrompt(t); // like a viewer: the home page's title splash goes first, so none is left behind the post frame
  // Posts live under /notes/ ("Studio notes"); the home page itself lists none.
  if (document.querySelector("#blog a.post-card, main .post-card")) t.problem("bug", "the home page still lists blog posts (they belong on /notes/)");
  const notesLink = document.querySelector('footer a[href="/notes/"], footer a[href="/notes"]');
  if (!notesLink) t.problem("bug", "the footer has no Studio notes link");
  const notes = await frameLoad(t, (f) => (f.src = "/notes/"));
  if (!notes) throw new Error("Studio notes (/notes/) didn't load");
  const rows = [...notes.querySelectorAll(".notes-list a")].map((a) => ({
    to: pathOf(a.getAttribute("href")),
    title: (a.querySelector("h2")?.textContent || "").trim(),
    chip: (a.querySelector(".lang-chip")?.textContent || "").trim(),
  }));
  t.metric("posts", rows.length);
  if (!rows.length) throw new Error("Studio notes lists no posts");
  for (const row of rows) {
    if (!row.title || /[^\x00-\x7f\u2019]/.test(row.title)) t.problem("bug", `Studio notes title "${row.title}" is not English`);
    if (!row.chip) t.problem("bug", `Studio notes "${row.title}" has no language chip`);
    else t.event("notes-title", `${row.to}: "${row.title}" (${row.chip})`);
  }
  const links = new Set();
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    t.progress(i / rows.length);
    if ((await status(p.to)) !== 200) {
      t.problem("bug", `Post "${p.title}" (${p.to}) is missing`);
      continue;
    }
    const doc = await openByClick(t, "/notes/", p.to);
    t.scene(p.title || p.to);
    if (isMissingPage(doc)) {
      t.problem("bug", `Post "${p.title}" opened the not-found page`);
      continue;
    }
    if (!doc.querySelector("h1")) t.problem("warning", `Post "${p.title}" has no heading`);
    checkRecentPosts(t, doc, p.to);
    checkArticle(t, doc, p);
    await waitFor(() => [...doc.images].every((img) => img.complete), 10000);
    [...doc.images].forEach((img) => !img.naturalWidth && t.problem("bug", `${p.to}: image ${pathOf(img.src)} didn't load`));
    await sleep(300);
    if (checkNoSplash(t, doc, `${p.to} (300 ms after load)`)) t.add("postsSplashFree");
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

/* ---------------- cctv-art: the camera wall's pictures, the end cards and the landing card ---------------- */
const loadsImage = (url) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ w: img.naturalWidth || 1024, h: img.naturalHeight || 576 });
  img.onerror = () => resolve(null);
  img.src = url;
});

async function cctvArt(options, t) {
  const st = storyOf(options.story || "night-shift");
  if (!st || st.type !== "console") throw new Error(`cctv-art: ${options.story || "night-shift"} isn't a console story`);
  await passSplash(t);
  // The scenes name which states each camera shows; every one of those needs a picture, and a camera's pictures one look.
  const used = {};
  for (const sc of Object.values(st.scenes)) for (const [cam, state] of Object.entries(sc.feeds || {})) (used[cam] = used[cam] || new Set()).add(state);
  let pictures = 0;
  for (const cam of st.cameras) {
    const states = new Set(["normal", ...(used[cam.id] || [])]);
    const sizes = [];
    for (const state of states) {
      const info = cam.states[state];
      if (!info) { t.problem("bug", `${cam.id}: the script uses state ${state}, which the camera doesn't have`); continue; }
      const size = info.image ? await loadsImage(info.image) : null;
      if (!size) { t.problem("bug", `${cam.id} ${state}: no picture${info.image ? ` (${info.image} doesn't load)` : ""}`); continue; }
      sizes.push(size.w / size.h);
      pictures++;
    }
    if (sizes.length && sizes.some((r) => Math.abs(r - sizes[0]) > 0.01)) t.problem("bug", `${cam.id}: its states aren't one picture format (the same room must frame the same)`);
    t.event("camera", `${cam.id} ${cam.name}: ${states.size} states with pictures [${[...states].join(", ")}]`);
  }
  t.event("pictures", `${pictures} camera pictures load, ${st.cameras.length} cameras`);
  const endings = Object.entries(st.scenes).filter(([, sc]) => sc.ending);
  for (const [id, sc] of endings) {
    if (!sc.endcard || !(await loadsImage(sc.endcard))) t.problem("bug", `ending ${id} (${sc.ending[0]}): no end card picture`);
  }
  t.event("end-cards", `${endings.length} endings, each with an end card`);
  const entry = (window.ILTV_STORIES.stories || []).find((x) => x.id === st.id);
  if (!entry.image || !(await loadsImage(entry.image))) t.problem("bug", `${st.id}: the landing card has no image that loads`);
  else t.event("landing-card", `${st.id}: ${entry.image}`);
  // Then the wall as a viewer sees it: the first scene's tiles carry their pictures.
  await consoleOpen(t, st);
  await consoleFresh(t, st);
  await sleep(600);
  const tiles = [...document.querySelectorAll("#console-wall > *")];
  const loaded = tiles.filter((el) => { const im = el.querySelector("img"); return im && im.complete && im.naturalWidth > 0; });
  if (tiles.length !== st.cameras.length) t.problem("bug", `the wall shows ${tiles.length} tiles for ${st.cameras.length} cameras`);
  else if (loaded.length !== tiles.length) t.problem("bug", `${tiles.length - loaded.length} of ${tiles.length} wall tiles show no picture`);
  else t.event("wall", `all ${tiles.length} tiles show their picture`);
  // Then every state as a viewer sees it: play to scenes that show each (camera, state) and check its tile in the strip (and, for the focus, the big screen).
  if (options.at !== "wall") await cctvStates(t, st, used);
  await toLanding(t);
}

/** Plays the fewest ways (real presses) that reach a scene for every camera state the script uses; at each scene
    checks every feed whose state hasn't been seen yet is in the strip with that state's own, loaded picture, and the big screen shows the focus's. */
async function cctvStates(t, st, used) {
  const R = rulesOf();
  const x = consoleExplore(st);
  const ways = Object.entries(x.variants).flatMap(([id, vs]) => Object.values(vs).map((v) => ({ id, ...v })));
  const pairsOf = (way) => new Set(way.path.flatMap((id) => Object.entries(R.feedsOf(st, st.scenes[id])).map(([c, s]) => `${c}/${s}`)));
  const want = new Set(st.cameras.flatMap((c) => [...new Set(["normal", ...(used[c.id] || [])])].map((s) => `${c.id}/${s}`)));
  const plan = [];
  const covered = new Set();
  const scored = ways.map((w) => ({ w, pairs: pairsOf(w) }));
  while ([...want].some((p) => !covered.has(p))) {
    let best = null, gain = 0;
    for (const c of scored) {
      const g = [...c.pairs].filter((p) => want.has(p) && !covered.has(p)).length;
      if (g > gain || (g === gain && g && best && c.w.picks.length < best.w.picks.length)) { best = c; gain = g; }
    }
    if (!best) break;
    plan.push(best.w);
    best.pairs.forEach((p) => covered.add(p));
  }
  for (const p of want) if (!covered.has(p)) t.problem("bug", `${st.id}: no way through the story shows ${p}`);
  t.note(`${st.title}: ${want.size} camera states, ${plan.length} ways played to show them`);
  const shownPairs = new Set();
  const showScene = async (m, where) => {
    const feeds = R.feedsOf(st, st.scenes[m.scene]);
    for (const cam of st.cameras) {
      const state = feeds[cam.id], key = `${cam.id}/${state}`;
      if (shownPairs.has(key) || !want.has(key)) continue;
      const tile = document.querySelector(`#console-wall .feed[data-camera="${cam.id}"]`);
      if (!tile) { t.problem("bug", `${where}: no tile for ${cam.id}`); continue; }
      const img = tile.querySelector("img");
      const want_ = (cam.states[state] || {}).image;
      if (tile.dataset.state !== state) t.problem("bug", `${where}: the strip shows ${cam.id} as ${tile.dataset.state}, the scene says ${state}`);
      else if (!img || !want_ || !img.src.endsWith(want_.replace(/^\.?\//, "")) || !(await waitFor(() => img.complete && img.naturalWidth > 0, 3000))) t.problem("bug", `${where}: the strip's ${cam.id} ${state} tile shows no picture of its own`);
      else {
        shownPairs.add(key);
        t.event("camera-state", `${cam.id} ${cam.name} ${state}: ${img.naturalWidth}x${img.naturalHeight} ${want_}`);
      }
    }
    // The big screen shows the scene's focus camera, in the state the scene gives it, from that state's own picture.
    const focus = st.scenes[m.scene].focus;
    if (focus) {
      const big = $("console-big");
      const want_ = (st.cameras.find((c) => c.id === focus).states[feeds[focus]] || {}).image;
      const bimg = big.querySelector("img");
      if (big.hidden || big.dataset.camera !== focus || big.dataset.state !== feeds[focus]) t.problem("bug", `${where}: the big screen shows ${big.dataset.camera}/${big.dataset.state}, the scene's focus is ${focus}/${feeds[focus]}`);
      else if (!bimg || !want_ || !bimg.src.endsWith(want_.replace(/^\.?\//, "")) || !(await waitFor(() => bimg.complete && bimg.naturalWidth > 0, 3000))) t.problem("bug", `${where}: the big screen's ${focus} ${feeds[focus]} feed shows no picture of its own`);
    }
  };
  let n = 0;
  // The unlocks stay from way to way (a new run keeps them), so the percent explored follows every scene reached so far
  // in this scenario: start from none, and count each scene as it is entered.
  document.cookie = `${unlocksCookie(st)}=; Max-Age=0; Path=/`;
  const seen = new Set();
  for (const way of plan) {
    await consoleFresh(t, st);
    seen.add(st.start);
    const m = consoleModel(st);
    const where = `${st.id}: ${way.path.join(" > ")}`;
    t.scene(where);
    await consoleHeard(t, document, where);
    await showScene(m, where);
    for (const i of way.picks) {
      await consoleChoose(t, st, m, i, document, where, seen);
      await showScene(m, where);
    }
    t.progress(++n / plan.length);
  }
  t.event("camera-states", `${shownPairs.size} of ${want.size} camera states shown in the strip, each from its own picture`);
}

/* ---------------- credits: "Powered by HAWKES GEN" on every page, the parent company on the home page ---------------- */

const GEN_URL = "https://hawkesgen.ai";
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
  // A page can grow after it loads (What's new fills its entries from releases.json), pushing the link
  // off screen after the first scroll: scroll again until it stays in view.
  const win = doc.defaultView;
  let r;
  for (let i = 0; i < 6; i++) {
    link.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(500);
    r = link.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= win.innerHeight) break;
  }
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

/** The mark: "Powered by HAWKES GEN" linking to hawkesgen.ai, and never over the page's story video. */
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
  t.progress(0.22);

  // The other listed video stories (The Water Road), opened from their cards: the same footer under their player.
  for (const info of listedStories().filter((x) => x.id !== FIRST)) {
    const other = story(info.id);
    if (!other || isConsole(other)) continue;
    t.scene(`${other.title}: footer and video`);
    await openStory(t, other.id);
    checkHitTargets(t, document, `home (${other.title})`);
    await checkMark(t, document, `home (${other.title})`);
    await sleep(800);
    await toLanding(t);
  }
  t.progress(0.25);

  // Night Shift, from its card: its own Tap to play title, then the same footer under the console player.
  const night = consoleStories().find((c) => c.listed);
  if (night) {
    t.scene(`${night.title}: footer`);
    await consoleOpen(t, night, { tap: false });
    if (soundOf().prompt()) {
      await sleep(800);
      checkNote(t, document, night.id);
      await consolePrompt(t, document, night.id);
    }
    await consoleHeard(t, document, night.id);
    checkHitTargets(t, document, `home (${night.title})`);
    await checkMark(t, document, `home (${night.title})`);
    await sleep(800);
    await toLanding(t);
    window.scrollTo(0, 0);
    t.progress(0.3);
  }

  // A Studio notes post and a branch page, then What's new.
  const notesDoc = await frameLoad(t, (f) => (f.src = "/notes/"));
  const post = notesDoc && notesDoc.querySelector(".notes-list a");
  const pagesToCheck = [
    post && { from: "/notes/", to: pathOf(post.getAttribute("href")), name: "Studio notes post" },
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
    // Hold with the credit link in view and the page still open: the footage of this scene is the footer, not
    // the page it was closed over (What's new runs past the viewport, so the footer sits below the fold).
    const mark = [...doc.querySelectorAll("a.powered-mark, .powered a")][0];
    if (mark) mark.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(p.name === "What's new" ? 4000 : 1200);
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
    const firstVideo = document.querySelector("#spark-video video:not(.spark-leave)");
    if (firstVideo && !firstVideo.paused) t.problem("bug", "the video plays behind the prompt, before the tap");
    await passPrompt(t, document, "The Final Spark");
    const st = soundOf().state();
    if (!st.unlocked) t.problem("bug", "the tap didn't unlock sound");
    if (st.audio !== "running") t.problem("bug", `the AudioContext is "${st.audio}" after the tap, not running`);
    t.scene("The Final Spark (sound on)");
    checkHitTargets(t, document, "The Final Spark (sound on)");
    await checkSound(t, document.querySelector("#spark-video video:not(.spark-leave)"), "after the tap", { on: true, volume: 1 });
    t.progress(0.2);

    // A choice: the next scene's video starts with sound too, no extra tap.
    await toStart(t);
    const button = choiceButtons()[0];
    if (button) {
      await tapAt(t, button, `choice "${enText(button)}"`);
      await sleep(300);
      t.scene(`${sceneId()} (sound on)`);
      await checkSound(t, document.querySelector("#spark-video video:not(.spark-leave)"), `${sceneId()}, after a choice`, { on: true, volume: 1 });
    }
    t.progress(0.35);

    await openSettings(t, "home");
    await tapAt(t, $("sound-on"), "Sound off");
    slide($("sound-volume"), 40);
    await sleep(600);
    const now = savedSound();
    if (!now || now.on !== false || !near(now.music, 0.4) || !near(now.sfx, 0.4)) t.problem("bug", `hawkes.sound didn't save Sound off and Volume 40%: ${JSON.stringify(now)}`);
    else t.event("setting-saved", JSON.stringify(now));
    if (!document.querySelector("#spark-video video:not(.spark-leave)").muted) t.problem("bug", "Sound off didn't mute the video right away");
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
    await checkSound(t, document.querySelector("#spark-video video:not(.spark-leave)"), "after the reload", { on: false, volume: 0.4 });
    t.progress(0.7);

    await openSettings(t, "after the reload");
    const shows = `${$("sound-on").getAttribute("aria-checked") === "true" ? "On" : "Off"} / ${$("sound-volume").value}%`;
    if (shows !== "Off / 40%") t.problem("bug", `Settings show "${shows}" after the reload, not Off / 40%`);
    await tapAt(t, $("sound-on"), "Sound on");
    await sleep(400);
    await tapAt(t, $("sound-done"), "Done");
    t.scene("The Final Spark (sound on, 40%)");
    await checkSound(t, document.querySelector("#spark-video video:not(.spark-leave)"), "Sound on at 40%", { on: true, volume: 0.4 });
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
    // The other listed video stories (The Water Road), from their cards: their video follows the same saved sound.
    for (const info of listedStories().filter((x) => x.id !== FIRST)) {
      const other = story(info.id);
      if (!other || isConsole(other)) continue;
      t.scene(`${other.title} (sound)`);
      await openStory(t, other.id);
      await checkSound(t, document.querySelector("#spark-video video:not(.spark-leave)"), `${other.title}, after its tap`, { on: true, volume: 0.4 });
      await toLanding(t);
    }
    // A console story's audio (voice, ambience, effects) follows the same Settings: Night Shift, from its card.
    const cs = consoleStories().find((c) => c.listed) || consoleStories()[0];
    if (cs) {
      t.scene(`${cs.title} (sound)`);
      await consoleOpen(t, cs);
      await consoleSoundCheck(t, cs, `${cs.id} sound`);
      await toLanding(t);
    }
    t.progress(1);
  } finally {
    if (carried.original == null) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, carried.original);
  }
}

/* ---------------- audio-buses: Web Audio unlock, duck under a clip, header toggle (iltv.sound) ---------------- */

const savedAudio = () => {
  try {
    return JSON.parse(localStorage.getItem(AUDIO_KEY));
  } catch {
    return null;
  }
};

/** One size: unlock on Tap to play, duck while the clip has sound, header toggle mutes clips and saves iltv.sound,
    and after a reload the setting is still in place and Tap for sound restores playback. */
async function audioBusesAt(t, doc, where, { reload = null } = {}) {
  let win = doc.defaultView;
  let audio = audioOf(doc);
  let sound = soundOf(doc);
  if (!audio) {
    t.problem("bug", `${where}: no js/audio.js (window.iltvAudio)`);
    return;
  }
  if (!sound) {
    t.problem("bug", `${where}: no js/hawkes-sound.js`);
    return;
  }
  let video = doc.querySelector("#spark-video video:not(.spark-leave)");
  if (sound.prompt()) {
    if (audio.unlocked() || audio.bed().playing || (video && !video.paused)) {
      t.problem("bug", `${where}: sound or clip started before the viewer's first tap (unlocked=${audio.unlocked()}, bed=${audio.bed().playing}, paused=${video ? video.paused : "no-video"})`);
    } else {
      t.event("audio-before-tap", `${where}: locked before first tap, bed silent, clip paused`);
    }
    await passPrompt(t, doc, where);
  } else if (!sound.unlocked()) {
    t.problem("bug", `${where}: sound still locked with no Tap to play prompt`);
  }
  await sleep(400);
  if (!audio.unlocked()) t.problem("bug", `${where}: iltvAudio stayed locked after the first tap`);
  const unlocks = audio.events().filter((e) => e.what === "unlock");
  if (!unlocks.length) t.problem("bug", `${where}: no unlock playtest event on the first tap`);
  else t.event("audio-unlock", `${where}: ${unlocks[unlocks.length - 1].audio || "running"}`);
  t.metric("audioUnlocked", audio.unlocked() ? 1 : 0);

  video = doc.querySelector("#spark-video video:not(.spark-leave)");
  if (!video) {
    t.problem("bug", `${where}: no story video`);
    return;
  }
  // Clip with sound: duck ambience/music buses (event-driven from play/volumechange).
  if (win.hawkesSound) win.hawkesSound.set({ on: true });
  if (!audio.enabled()) audio.setEnabled(true);
  video.muted = false;
  try { if (video.paused) await video.play(); } catch (e) { /* autoplay */ }
  await waitFor(() => !video.paused && video.currentTime > 0.2, 6000);
  await sleep(350);
  const duckedBuses = audio.buses();
  if (!audio.ducked() || duckedBuses.ambience > 0.1 || duckedBuses.music > 0.1) {
    t.problem("bug", `${where}: ambience/music did not duck while the unmuted clip played (ducked=${audio.ducked()}, ambience=${duckedBuses.ambience.toFixed(2)}, music=${duckedBuses.music.toFixed(2)})`);
  } else {
    t.event("audio-duck", `${where}: ducked under the clip (ambience ${duckedBuses.ambience.toFixed(2)}, music ${duckedBuses.music.toFixed(2)})`);
  }
  t.metric("audioDucked", audio.ducked() ? 1 : 0);

  video.pause();
  await sleep(400);
  const liftedBuses = audio.buses();
  if (audio.ducked() || liftedBuses.ambience < 0.25 || liftedBuses.music < 0.2) {
    t.problem("bug", `${where}: duck stayed on after the clip paused (ducked=${audio.ducked()}, ambience=${liftedBuses.ambience.toFixed(2)}, music=${liftedBuses.music.toFixed(2)})`);
  } else {
    t.event("audio-duck", `${where}: duck lifted after pause (ambience ${liftedBuses.ambience.toFixed(2)}, music ${liftedBuses.music.toFixed(2)})`);
  }

  // Header toggle: mutes everything including the clip; saved in iltv.sound.
  let toggle = audio.toggle() || doc.getElementById("iltv-sound-toggle");
  if (!toggle) {
    t.problem("bug", `${where}: no header sound toggle`);
    return;
  }
  const r = toggle.getBoundingClientRect();
  if (r.width < 44 || r.height < 44) t.problem("bug", `${where}: sound toggle is ${Math.round(r.width)}x${Math.round(r.height)}, under 44px`);
  const gear = doc.getElementById("sound-gear");
  if (gear) {
    const gr = gear.getBoundingClientRect();
    if (r.right > gr.left + 1) t.problem("bug", `${where}: sound toggle (${Math.round(r.right)}) overlaps Settings gear (${Math.round(gr.left)})`);
  }
  await tapAt(t, toggle, `Sound off (${where})`);
  await sleep(500);
  if (audio.enabled()) t.problem("bug", `${where}: header toggle did not turn sound off`);
  const saved = savedAudio();
  if (!saved || saved.on !== false) t.problem("bug", `${where}: iltv.sound did not save Sound off: ${JSON.stringify(saved)}`);
  if (sound.settings().on !== false) t.problem("bug", `${where}: hawkes.sound stayed on after the header toggle`);
  if (audio.buses().master > 0.01 || audio.bed().playing) t.problem("bug", `${where}: buses still active after header toggle off (master=${audio.buses().master}, bed=${audio.bed().playing})`);
  try { await video.play(); } catch (e) { /* ignore */ }
  await sleep(200);
  if (!video.muted) t.problem("bug", `${where}: clip still has sound after the header toggle`);
  t.event("audio-toggle", `${where}: off, clip and buses muted, iltv.sound saved`);

  // Reload check: the muted setting is still in place after a reload (read from localStorage iltv.sound at load).
  if (reload) {
    doc = await reload();
    win = doc.defaultView;
    audio = audioOf(doc);
    sound = soundOf(doc);
    toggle = (audio && audio.toggle()) || doc.getElementById("iltv-sound-toggle");
    if (!audio || !sound) {
      t.problem("bug", `${where} reload: audio or sound module missing after reload`);
      return;
    }
    if (audio.enabled() || sound.settings().on !== false || (toggle && toggle.getAttribute("aria-pressed") !== "false")) {
      t.problem("bug", `${where} reload: Sound off was not kept at load (enabled=${audio.enabled()}, hawkes=${sound.settings().on}, pressed=${toggle && toggle.getAttribute("aria-pressed")})`);
    }
    if (sound.prompt()) await passPrompt(t, doc, `${where} reload`);
    await sleep(300);
    video = doc.querySelector("#spark-video video:not(.spark-leave)");
    if (audio.enabled() || (video && !video.muted) || audio.bed().playing) {
      t.problem("bug", `${where} reload: sound played after reload despite Sound off (enabled=${audio.enabled()}, muted=${video && video.muted}, bed=${audio.bed().playing})`);
    } else {
      t.event("audio-reload", `${where}: Sound off still in place after reload (iltv.sound={"on":false}, clip muted)`);
    }
  }

  // Tap for sound still works: turns sound back on and unmutes the clip.
  if (video && video.paused) {
    try { await video.play(); } catch (e) { /* ignore */ }
    await sleep(200);
  }
  const unmute = doc.querySelector(".spark-unmute");
  if (unmute && !unmute.hidden) {
    await tapAt(t, unmute, `Tap for sound (${where})`);
    await sleep(250);
    if (!audio.enabled() || sound.settings().on !== true) t.problem("bug", `${where}: Tap for sound did not turn sound back on`);
    if (video.muted) t.problem("bug", `${where}: Tap for sound left the clip muted`);
    t.event("tap-for-sound", `${where}: sound back on`);
  } else {
    await tapAt(t, toggle, `Sound on (${where})`);
    await sleep(250);
    if (!audio.enabled()) t.problem("bug", `${where}: header toggle did not turn sound back on`);
  }
  t.event("audio-buses", `${where}: unlock, duck, toggle, reload checked`);
}

async function audioBusesRun(options, t) {
  if (!savedRuns && savedCookie == null) rememberProgress();
  const originalSound = localStorage.getItem(SOUND_KEY);
  const originalAudio = localStorage.getItem(AUDIO_KEY);
  const putBack = () => {
    if (originalSound == null) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, originalSound);
    if (originalAudio == null) localStorage.removeItem(AUDIO_KEY);
    else localStorage.setItem(AUDIO_KEY, originalAudio);
  };
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify({ on: true, music: 1, sfx: 1 }));
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ on: true }));
    if (!stories()) throw new Error("the player (js/game.js) didn't start");
    await passPrompt(t);
    if (!landingShown()) await toLanding(t);

    // Smoke leg: one path on the page, then a 390x844 frame with reload (beta plays smoke).
    if (options.at === "smoke") {
      t.scene("Audio buses (smoke)");
      await openStory(t, FIRST);
      await toStart(t, { quiet: true });
      await audioBusesAt(t, document, "desktop smoke");
      t.progress(0.5);
      {
        localStorage.setItem(SOUND_KEY, JSON.stringify({ on: true, music: 1, sfx: 1 }));
        localStorage.setItem(AUDIO_KEY, JSON.stringify({ on: true }));
        const doc = await viewFrameLoad(t, `/?story=${FIRST}`, 390, 844);
        t.scene("Audio buses at 390x844 (smoke)");
        await audioBusesAt(t, doc, "390x844 smoke", {
          reload: () => viewFrameLoad(t, `/?story=${FIRST}`, 390, 844),
        });
        closeViewFrame();
      }
      t.progress(1);
      return;
    }

    t.scene("Audio buses: unlock, duck, toggle");
    await openStory(t, FIRST);
    await toStart(t, { quiet: true });
    await audioBusesAt(t, document, "desktop");
    t.progress(0.35);

    for (const [w, h] of [[390, 844], [1280, 720]]) {
      t.scene(`Audio buses at ${w}x${h}`);
      localStorage.setItem(SOUND_KEY, JSON.stringify({ on: true, music: 1, sfx: 1 }));
      localStorage.setItem(AUDIO_KEY, JSON.stringify({ on: true }));
      const doc = await viewFrameLoad(t, `/?story=${FIRST}`, w, h);
      await audioBusesAt(t, doc, `${w}x${h}`, {
        reload: () => viewFrameLoad(t, `/?story=${FIRST}`, w, h),
      });
      closeViewFrame();
      t.progress(w === 390 ? 0.7 : 1);
    }
  } finally {
    putBack();
  }
}

/* ---------------- audio-ui: choice-appear, tap, timer tick, ending sting, ambient beds (390x844, touch) ---------------- */

/** One video story in a 390x844 frame, played by taps: the first clip's start, the beds that start after it (never two at once, one on
    every page), the choices' appear sound, the 3 ticks of the timer, the tap on a choice, and the ending's sting. Every audio
    event goes on the timeline; a missing sound is a problem. Then, with Sound off saved and the frame reloaded, no audio events at all. */
async function audioUiAt(t, id) {
  const st = story(id);
  const url = `/?story=${id}`;
  const clean = () => {
    localStorage.setItem(SOUND_KEY, JSON.stringify({ on: true, music: 1, sfx: 1 }));
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ on: true }));
  };
  clean();
  const t0 = performance.now();
  let doc = await viewFrameLoad(t, url, 390, 844);
  let win = doc.defaultView;
  const events = [];
  const watch = (d) => d.addEventListener("iltv:audio", (e) => events.push({ ...e.detail, ms: Math.round(performance.now() - t0) }));
  watch(doc);
  let clipPlayingAt = null;
  const q = (d, sel) => d.querySelector(sel);
  const video = () => q(doc, "#spark-video video:not(.spark-leave)");
  const sceneNow = () => win.finalSpark && win.finalSpark.scene();
  const buttons = () => [...doc.querySelectorAll("#spark-choices .choice")];
  let worstBeds = 0;
  const sampler = setInterval(() => {
    const a = win.iltvAudio;
    if (!a) return;
    const n = a.beds().length;
    worstBeds = Math.max(worstBeds, n);
    const v = video();
    if (clipPlayingAt == null && v && !v.paused && v.currentTime > 0.05) clipPlayingAt = Math.round(performance.now() - t0);
  }, 80);
  const seenScenes = {};
  const checkBed = (where) => {
    const a = win.iltvAudio;
    if (!a.beds().length) t.problem("bug", `${id} ${where}: no ambient bed playing on ${sceneNow()}`);
    seenScenes[sceneNow()] = true;
  };
  const count = (what, name) => events.filter((e) => e.what === what && (!name || e.name === name)).length;
  try {
    await passPrompt(t, doc, `${id} 390x844`);
    const tapped = Math.round(performance.now() - t0);
    await waitFor(() => clipPlayingAt != null, 8000);
    await sleep(900);
    t.metric(`firstClipMs.${id}`, clipPlayingAt == null ? -1 : clipPlayingAt);
    const bedEv = events.find((e) => e.what === "bed" && e.on);
    if (!bedEv) t.problem("bug", `${id}: no bed event after the first tap and the first clip`);
    else {
      t.event("bed", `${id}: ${bedEv.story}/${bedEv.mood} via ${bedEv.via} at ${bedEv.ms} ms (first clip playing at ${clipPlayingAt} ms, tap at ${tapped} ms)`);
      if (clipPlayingAt != null && bedEv.ms + 60 < clipPlayingAt) t.problem("bug", `${id}: the bed started (${bedEv.ms} ms) before the first clip played (${clipPlayingAt} ms): it must not delay the clip`);
    }
    checkBed("first scene");
    // The way to the nearest ending, a page at a time: each clip skipped to its end, then the choices come up.
    const ending = Object.keys(st.scenes).filter((s) => st.scenes[s].ending);
    const way = wayTo(st, (sc) => !!sc.ending) || [];
    let ticked = false;
    for (let step = 0; step <= way.length; step++) {
      const v = video();
      if (v) {
        await waitFor(() => v.duration > 0.5 && isFinite(v.duration), 8000);
        if (v.duration > 0.5 && isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 0.12);
      }
      if (step === way.length) break;
      const here = sceneNow();
      const ready = await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready" && buttons().length, 10000);
      if (!ready) { if (st.scenes[here].choices.length === 1) { await waitFor(() => sceneNow() !== here, 6000); checkBed("auto"); continue; } t.problem("bug", `${id}: choices never came up on ${here}`); break; }
      if (step === 0) {
        await sleep(300);
        if (!count("ui", "appear")) t.problem("bug", `${id}: no choice-appear sound when the choices came up`);
        else t.event("ui", `${id}: choice-appear on ${here}`);
        // The timer's last 3 seconds: three ticks (the window is 15 s; the bot lets it run to 2.5 s left).
        await sleep(12600);
        const ticks = count("ui", "tick");
        if (ticks < 3) t.problem("bug", `${id}: ${ticks} timer ticks in the last 3 seconds (3 expected)`);
        else t.event("ui", `${id}: ${ticks} timer ticks in the last 3 s`);
        ticked = true;
      }
      const to = way[step];
      const i = st.scenes[here].choices.findIndex((c) => c[2] === to);
      const button = buttons()[i];
      if (i < 0 || !button) throw new Error(`${id}: no choice from ${here} to ${to}`);
      const before = count("ui", "tap");
      await tapAt(t, button, `"${enText(button)}"`);
      await sleep(250);
      if (count("ui", "tap") !== before + 1) t.problem("bug", `${id}: the tap on a choice made ${count("ui", "tap") - before} tap sounds (1 expected)`);
      await waitFor(() => sceneNow() === to, 3000);
      await sleep(400);
      checkBed(`step ${step + 1}`);
    }
    await sleep(600);
    if (!count("sting")) t.problem("bug", `${id}: no ending sting at ${ending.length ? "the ending" : "any ending"}`);
    else t.event("sting", `${id}: ${events.filter((e) => e.what === "sting").map((e) => e.name).join(", ")}`);
    if (!ticked) t.problem("bug", `${id}: the timer was never listened to`);
    if (count("ui-missing")) t.problem("bug", `${id}: missing sound ${events.filter((e) => e.what === "ui-missing").map((e) => e.name).join(", ")}`);
    if (worstBeds > 1) t.problem("bug", `${id}: two ambient beds were playing at once`);
    const duck = events.filter((e) => e.what === "duck");
    t.event("audio-events", `${id}: ${events.length} (${["bed", "ui", "duck", "sting"].map((w) => `${w} ${events.filter((e) => e.what === w).length}`).join(", ")}); beds at once ≤ ${worstBeds}; ${duck.length ? "ducked under dialogue" : "no duck seen"}`);
    t.metric(`bedsAtOnce.${id}`, worstBeds);
    // The story list: the bed stops.
    const back = q(doc, ".stories-back, #stories-back");
    if (back) {
      await tapAt(t, back, "All stories");
      await sleep(900);
      if (win.iltvAudio.beds().length) t.problem("bug", `${id}: the bed kept playing on the story list`);
      else t.event("bed", `${id}: stopped on the story list`);
    }
  } finally {
    clearInterval(sampler);
  }
  // Sound off, saved, reloaded: no audio events at all, even after a tap on a choice.
  localStorage.setItem(SOUND_KEY, JSON.stringify({ on: false, music: 1, sfx: 1 }));
  localStorage.setItem(AUDIO_KEY, JSON.stringify({ on: false }));
  doc = await viewFrameLoad(t, url, 390, 844);
  win = doc.defaultView;
  events.length = 0;
  watch(doc);
  await passPrompt(t, doc, `${id} sound off`);
  await sleep(1500);
  const v2 = q(doc, "#spark-video video:not(.spark-leave)");
  if (v2 && v2.duration > 0.5 && isFinite(v2.duration)) v2.currentTime = Math.max(0, v2.duration - 0.12);
  await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready", 8000);
  const b2 = [...doc.querySelectorAll("#spark-choices .choice")][0];
  if (b2) await tapAt(t, b2, "first choice (sound off)");
  await sleep(1200);
  const stray = events.filter((e) => e.what !== "toggle");
  if (stray.length) t.problem("bug", `${id}: Sound off after a reload, yet ${stray.length} audio events: ${stray.slice(0, 4).map((e) => e.what + (e.name ? ":" + e.name : "")).join(", ")}`);
  else t.event("audio-off", `${id}: Sound off kept after reload: zero audio events through a tap on a choice`);
  closeViewFrame();
}

async function audioUiRun(options, t) {
  if (!savedRuns && savedCookie == null) rememberProgress();
  const originalSound = localStorage.getItem(SOUND_KEY);
  const originalAudio = localStorage.getItem(AUDIO_KEY);
  try {
    clearProgress();
    const ids = options.story ? [options.story] : [FIRST, "water-road"];
    let k = 0;
    for (const id of ids) {
      t.scene(`Audio: UI sounds and beds, ${id} at 390x844`);
      await audioUiAt(t, id);
      t.progress(++k / ids.length);
    }
  } finally {
    if (originalSound == null) localStorage.removeItem(SOUND_KEY); else localStorage.setItem(SOUND_KEY, originalSound);
    if (originalAudio == null) localStorage.removeItem(AUDIO_KEY); else localStorage.setItem(AUDIO_KEY, originalAudio);
    closeViewFrame();
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

/** Another video story (The Water Road), from its card with fresh progress: one real choice, then All stories. What went
    out for it: story_open from the card, a screen of its first page, run_start, a video play, the choice with its
    context, level_start. */
async function analyticsVideoStory(t, A, pump, st) {
  t.scene(`${st.title}: analytics`);
  clearProgress();
  const mark = (A.debugLog || []).length;
  await openStory(t, st.id);
  await toStart(t);
  await checkVideo(t, document.querySelector("#spark-video video:not(.spark-leave)"), `${st.id} start`, 2, { autoplay: true });
  const button = choiceButtons()[0];
  if (button) {
    await tapAt(t, button, `choice "${enText(button)}"`);
    await sleep(500);
  }
  await toLanding(t);
  A.flush();
  await sleep(600);
  pump();
  const sent = (A.debugLog || []).slice(mark).filter((e) => e.sent);
  const has = (name, test) => sent.some((e) => e.name === name && (!test || test(e.props || {}, e)));
  const want = [
    ["story_open", (p) => p.story === st.id && p.via === "card", "story_open from its card"],
    ["screen", (p) => String(p.name).startsWith(`${st.id}/`), "a screen for its first page"],
    ["run_start", null, "run_start"],
    ["video", (p) => p.action === "play", "a video play"],
    ["choice", (p, e) => p.node && p.option && e.ctx && e.ctx.story === st.id && e.ctx.path, "a choice with its node, option and the path so far"],
    ["level_start", null, "level_start"],
  ];
  for (const [name, test, what] of want) if (!has(name, test)) t.problem("bug", `Analytics (${st.title}): no ${what} went out (${name})`);
  t.note(`${st.title}: ${sent.length} analytics events sent: ${[...new Set(sent.map((e) => e.name))].join(", ")}`);
}

/** Night Shift (a console story, no video): from its card, the big screen showing a camera, the shift log opened, one real choice, then
    the shortest way's last choices to an ending (a seeded run, consoleSeedAt: setup shortcut), where "How was this
    ending?" shows and is answered. What went out: story_open from the card, the screen and level, run_start, the choice,
    the two features, run_end with the ending, the stars. */
async function analyticsNight(t, A, pump, st) {
  t.scene(`${st.title}: analytics`);
  clearProgress();
  const mark = (A.debugLog || []).length;
  await consoleOpen(t, st);
  const m = consoleModel(st);
  await consoleHeard(t, document, st.id);
  await tapAt(t, byIdIn(document, "console-log-btn"), "Log");
  await sleep(300);
  await tapAt(t, byIdIn(document, "console-log-btn"), "Close log");
  await sleep(300);
  const first = m.open()[0];
  await consoleChoose(t, st, m, first[1], document, st.id, null);
  const sceneNode = (id) => String(st.scenes[id].folder || id).split("/").pop();
  const way = consoleShortestEnding(st);
  if (!way) throw new Error(`${st.id} has no ending to reach`);
  const keep = 2;
  const end = await consoleSeedAt(t, st, way.picks.slice(0, way.picks.length - keep), null);
  await consoleHeard(t, document, `${st.id} (seeded)`);
  for (const i of way.picks.slice(way.picks.length - keep)) await consoleChoose(t, st, end, i, document, st.id, null);
  const node = sceneNode(end.scene);
  t.event("ending", `${st.id}/${node}: ${st.scenes[end.scene].ending[0]}`);
  const stars = await waitForAsk(t, `ending-${st.id}-${node}`, 10000);
  if (!stars) t.problem("bug", `${st.id}: reaching the ending (${node}) didn't show the "How was this ending?" question`);
  else {
    const q = stars.shadowRoot.querySelector(".ha-q").textContent.trim();
    const n = stars.shadowRoot.querySelectorAll(".ha-r button").length;
    t.event("feedback-prompt", `${st.id} at the ending: "${q}" (${n} stars)`);
    if (q !== "How was this ending?") t.problem("bug", `${st.id}: the ending's question says "${q}"`);
    if (n !== 5) t.problem("bug", `${st.id}: the ending's question should be 1-5 stars, it has ${n} buttons`);
    await sleep(1500);
    await answerAsk(t, stars, 4, "4 stars");
  }
  await toLanding(t);
  A.flush();
  await sleep(600);
  pump();
  const sent = (A.debugLog || []).slice(mark).filter((e) => e.sent);
  const has = (name, test) => sent.some((e) => e.name === name && (!test || test(e.props || {}, e)));
  const want = [
    ["story_open", (p) => p.story === st.id && p.via === "card" && p.button === "play", "story_open from the card (button play)"],
    ["screen", (p) => p.name === `${st.id}/${sceneNode(st.start)}`, "a screen for the first scene"],
    ["level_start", null, "level_start"],
    ["run_start", (p) => p.run === st.id, "run_start"],
    ["choice", (p, e) => p.node && p.option && e.ctx && e.ctx.story === st.id && e.ctx.path, "a choice with its node, option and the path so far"],
    ["feature", (p) => p.name === "feed" && p.story === st.id, "the big screen showing a camera (feature feed)"],
    ["feature", (p) => p.name === "log" && p.story === st.id, "the shift log opened (feature log)"],
    ["run_end", (p) => p.result === "win" && p.ending === node, "run_end with the ending"],
    ["feedback", (p) => p.rating === 4, "the ending's stars"],
  ];
  for (const [name, test, what] of want) if (!has(name, test)) t.problem("bug", `Analytics (${st.title}): no ${what} went out (${name})`);
  if (has("feature", (p) => p.name === "back")) t.problem("bug", `Analytics (${st.title}): a "back" went out, a console story has no going back`);
  if (has("video")) t.problem("bug", `Analytics (${st.title}): a video event went out, it has no video`);
  t.note(`${st.title}: ${sent.length} analytics events sent: ${[...new Set(sent.map((e) => e.name))].join(", ")}`);
}

/** Cinematic ending cards (J, 2026-11-06): at each ending the card shows its name, the choices made (the recap) and
    Try another path, which starts a new run with that way marked (the choice taken last time on each page of it and its
    nodes in the Tree). Real presses all the way; no setup shortcut. Stories: The Final Spark, The Water Road (two endings). */
async function endingsRun(options, t) {
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  clearProgress();
  const ids = options.story ? [options.story] : [FIRST, "water-road"];
  let k = 0;
  const press = async (st, to) => {
    const i = st.scenes[sceneId()].choices.findIndex((c) => c[2] === to);
    const button = choiceButtons()[i];
    if (i < 0 || !button) throw new Error(`${st.id}: no choice from ${sceneId()} to ${to}`);
    button.scrollIntoView({ block: "center", behavior: "instant" });
    await tapAt(t, button, `"${enText(button)}"`);
    await sleep(250);
    if (sceneId() !== to) throw new Error(`${st.id}: "${enText(button)}" didn't open ${to} (on ${sceneId()})`);
  };
  try {
    for (const id of ids) {
      const st = story(id);
      if (!landingShown()) await toLanding(t);
      await openStory(t, id);
      await toStart(t, { quiet: true });
      const endings = Object.keys(st.scenes).filter((sid) => st.scenes[sid].ending);
      const names = [];
      let marked = null;
      for (const end of endings) {
        const way = wayTo(st, (sc) => sc === st.scenes[end]);
        if (!way) throw new Error(`${id}: no way to ${end}`);
        t.scene(`${id}: the way to ${end}`);
        const trail = [st.start, ...way];
        for (const to of way) {
          // A restarted run marks, on each page still on the last way, the choice taken there.
          if (marked) {
            const here = spark().depth();
            const hit = choiceButtons().filter((b) => b.classList.contains("was-taken"));
            const expect = marked[here] === sceneId() ? marked[here + 1] : null;
            const wasIdx = expect ? st.scenes[sceneId()].choices.findIndex((c) => c[2] === expect) : -1;
            const gotIdx = hit.length ? choiceButtons().indexOf(hit[0]) : -1;
            if (wasIdx !== gotIdx || hit.length > 1) t.problem("bug", `${id}: on ${sceneId()} the marked choice is #${gotIdx} (${hit.length} marked), the last way took #${wasIdx}`);
          }
          await press(st, to);
        }
        await sleep(500);
        const card = $("spark-ending");
        const endScene = st.scenes[end];
        t.event("ending", `${id}/${endScene.folder}: ${enText(card.querySelector(".ending-kicker"))}`);
        // 1. the card, with the ending's name
        if (card.hidden || !card.classList.contains("ending-card")) { t.problem("bug", `${id}: reaching ${end} shows no ending card`); continue; }
        const name = enText(card.querySelector(".ending-name"));
        const want = String(endScene.title[1]).trim();
        t.event("ending-card", `${id}/${endScene.folder}: "${name}"`);
        if (name !== want) t.problem("bug", `${id}: the ending card says "${name}", the ending is "${want}"`);
        if (names.includes(name)) t.problem("bug", `${id}: two endings share the card name "${name}"`);
        names.push(name);
        if (!card.getBoundingClientRect().height || card.getBoundingClientRect().bottom > innerHeight + 1) t.problem("bug", `${id}/${end}: the ending card isn't fully on screen`);
        // 2. the choices made
        const items = [...card.querySelectorAll(".ending-recap li")].map(enText);
        const made = trail.slice(0, -1).map((from, i) => st.scenes[from].choices.find((c) => c[2] === trail[i + 1])[1].replace(/^\d+\.\s*/, ""));
        t.event("recap", `${id}/${endScene.folder}: ${items.join(" | ")}`);
        if (items.length !== way.length) t.problem("bug", `${id}/${end}: the recap lists ${items.length} choices, ${way.length} were made`);
        else items.forEach((txt, i) => { if (txt !== made[i]) t.problem("bug", `${id}/${end}: recap step ${i + 1} says "${txt}", the choice was "${made[i]}"`); });
        // 3. Try another path
        const btn = $("spark-try-another");
        if (!btn || !/try another path/i.test(btn.textContent)) { t.problem("bug", `${id}/${end}: no "Try another path" button on the ending card`); continue; }
        if (btn.getBoundingClientRect().height < 44) t.problem("bug", `${id}/${end}: "Try another path" is under 44px high`);
        btn.scrollIntoView({ block: "center", behavior: "instant" });
        await sleep(1200);
        const before = spark().unlocked().length;
        await tapAt(t, btn, "Try another path");
        await sleep(400);
        if (sceneId() !== st.start || spark().depth() !== 0) t.problem("bug", `${id}: Try another path opened ${sceneId()} (${spark().depth()} steps in), not the start`);
        if (spark().unlocked().length < before) t.problem("bug", `${id}: Try another path lost unlocked scenes`);
        if (savedPlace(st)?.history?.length) t.problem("bug", `${id}: the saved run still holds the old way`);
        marked = trail;
        const first = choiceButtons().filter((b) => b.classList.contains("was-taken"));
        t.event("path-marked", `${id}: ${first.length} choice marked on the first page (last time: ${enText(first[0])})`);
        if (first.length !== 1 || !/last time/i.test(getComputedStyle(first[0], "::after").content)) t.problem("bug", `${id}: after Try another path the first page doesn't mark last time's choice`);
        $("tab-tree").click();
        await sleep(300);
        const walked = [...$("spark-tree").querySelectorAll(".tree-node.is-walked")].length;
        t.event("path-marked", `${id}: ${walked} Tree nodes marked as the last path`);
        if (walked < 1) t.problem("bug", `${id}: the Tree marks nothing of the last path`);
        await sleep(600);
        $("tab-play").click();
        await sleep(200);
        t.progress(++k / (ids.length * 2));
      }
    }
  } finally {
    restoreProgress();
  }
}

/** Endings gallery (J, 2026-11-10): after reaching endings, the gallery shows found posters/names and locked
    silhouettes with "???", a "N of M found" count, and tapping a found ending shows its card again. Reachable from
    the ending card and the Endings tab. Checks at 390x844 and 1280x720. Default story: The Water Road (two endings).
    Options: {"story":"<id>"}; {"at":"smoke"} is a short UI leg for smoke (seeds one found ending, opens the gallery). */
async function endingsGalleryRun(options, t) {
  // When run as a leg of smoke (or another scenario), don't overwrite the outer rememberProgress.
  if (!savedRuns && savedCookie == null) rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  clearProgress();
  const id = options.story || "water-road";
  const st = story(id);
  if (!st) throw new Error(`no story ${id}`);
  const ends = Object.keys(st.scenes).filter((sid) => st.scenes[sid].ending);
  if (ends.length < 1) throw new Error(`${id}: no endings`);
  const pressTo = async (to) => {
    const from = sceneId();
    const i = st.scenes[from].choices.findIndex((c) => c[2] === to);
    if (i < 0) throw new Error(`${id}: no choice from ${from} to ${to}`);
    // A viewer presses a card once it is there: the page's buttons are pressable when the last press's hand-off is over
    // (up to 3 s), so a press never lands on the box around them. The button is looked up again at each look.
    let button = null;
    for (let waited = 0; waited <= 3000; waited += 100) {
      button = choiceButtons()[i];
      if (button) {
        button.scrollIntoView({ block: "center", behavior: "instant" });
        const r = button.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (hit && button.contains(hit)) break;
      }
      await sleep(100);
    }
    if (!button) throw new Error(`${id}: no choice from ${from} to ${to}`);
    const say = enText(button);
    await tapAt(t, button, `"${say}"`);
    for (let waited = 0; waited < 3000 && sceneId() !== to; waited += 100) await sleep(100);
    await sleep(150);
    if (sceneId() !== to) throw new Error(`${id}: "${say}" didn't open ${to} (on ${sceneId()})`);
  };
  const checkGallery = (pane, foundWant, label) => {
    if (!pane || pane.hidden) { t.problem("bug", `${label}: endings gallery is not open`); return; }
    const count = pane.querySelector(".endings-count");
    const want = `${foundWant} of ${ends.length} found`;
    t.event("endings-count", `${label}: ${count ? count.textContent.trim() : "(none)"}`);
    if (!count || count.textContent.trim() !== want) t.problem("bug", `${label}: count says "${count ? count.textContent.trim() : ""}", want "${want}"`);
    const tiles = [...pane.querySelectorAll(".ending-tile")];
    if (tiles.length !== ends.length) t.problem("bug", `${label}: gallery has ${tiles.length} tiles, story has ${ends.length} endings`);
    const foundTiles = tiles.filter((el) => el.classList.contains("is-found"));
    const locked = tiles.filter((el) => el.classList.contains("is-locked"));
    if (foundTiles.length !== foundWant) t.problem("bug", `${label}: ${foundTiles.length} found tiles, want ${foundWant}`);
    if (locked.length !== ends.length - foundWant) t.problem("bug", `${label}: ${locked.length} locked tiles, want ${ends.length - foundWant}`);
    for (const tile of foundTiles) {
      const name = tile.querySelector(".ending-tile-name")?.textContent.trim() || "";
      const img = tile.querySelector(".ending-tile-media img");
      if (!name || name === "???") t.problem("bug", `${label}: a found tile shows "${name}"`);
      if (!img || !img.getAttribute("src")) t.problem("bug", `${label}: found ending "${name}" has no poster`);
    }
    for (const tile of locked) {
      const name = tile.querySelector(".ending-tile-name")?.textContent.trim() || "";
      if (name !== "???") t.problem("bug", `${label}: a locked tile says "${name}", want "???"`);
      const img = tile.querySelector(".ending-tile-media img");
      if (img && img.getAttribute("src")) {
        const blur = getComputedStyle(img).filter || "";
        if (!/blur\(/i.test(blur)) t.problem("bug", `${label}: locked poster is not blurred`);
      }
    }
    const box = pane.getBoundingClientRect();
    if (box.bottom > innerHeight + 2 || box.right > innerWidth + 2) t.problem("bug", `${label}: gallery runs off the screen (${Math.round(box.width)}x${Math.round(box.height)} in ${innerWidth}x${innerHeight})`);
    t.event("endings-gallery", `${label}: ${foundWant} of ${ends.length}, ${foundTiles.length} named, ${locked.length} locked`);
  };
  const openTab = async (label) => {
    const tab = $("tab-endings");
    if (!tab) throw new Error(`${id}: no Endings tab`);
    tab.scrollIntoView({ block: "center", behavior: "instant" });
    await tapAt(t, tab, "Endings tab");
    await sleep(300);
    checkGallery($("spark-endings"), stories().foundEndings(id)?.length || 0, label);
  };
  // Replay marks (J, 2026-11-11): with one ending found, a second run tags the choices that lead somewhere new ("New")
  // and the ones whose whole way is seen (a quiet "Seen"), on the page and in the Tree; the home card says "1 of N
  // endings". At 390x844 a tagged choice is 48 px or more and its words are not cut off, and the card's count fits.
  const replayLeg = async (end, way) => {
    t.scene(`${id}: second run (replay marks)`);
    $("tab-play").click();
    await sleep(300);
    if ($("spark-try-another")) { await tapAt(t, $("spark-try-another"), "Try another path"); await sleep(500); }
    else await toStart(t, { quiet: true });
    const onWay = new Set([st.start, ...way]);
    const checkMarks = (label) => {
      const sc = st.scenes[sceneId()];
      const seenNow = new Set(spark().unlocked());
      const tally = { new: 0, seen: 0, plain: 0 };
      choiceButtons().forEach((btn, i) => {
        const to = sc.choices[i][2];
        const mark = btn.dataset.mark || "";
        tally[mark || "plain"] += 1;
        if (!seenNow.has(to) && mark !== "new") t.problem("bug", `${id}: ${label}: a choice to an unseen scene (${to}) has no New tag`);
        if (seenNow.has(to) && mark === "new") t.problem("bug", `${id}: ${label}: a choice to a seen scene (${to}) wears New`);
        if (st.scenes[to].ending && seenNow.has(to) && mark !== "seen") t.problem("bug", `${id}: ${label}: the choice to the found ending ${to} has no Seen mark`);
      });
      t.event("replay-marks", `${id}/${sceneId()} ${label}: ${tally.new} New, ${tally.seen} Seen, ${tally.plain} untagged`);
      return tally;
    };
    let total = { new: 0, seen: 0 };
    const sum = (x) => { total = { new: total.new + x.new, seen: total.seen + x.seen }; };
    sum(checkMarks("start"));
    for (const to of way.slice(0, -1)) { await pressTo(to); sum(checkMarks(`on the way to ${end}`)); }
    if (!total.new) t.problem("bug", `${id}: the second run showed no New tag`);
    if (!total.seen) t.problem("bug", `${id}: the second run showed no Seen mark`);
    t.metric("replayNewTags", total.new);
    t.metric("replaySeenMarks", total.seen);
    // The Tree carries the same marks.
    $("tab-tree").click();
    await sleep(400);
    const treeNew = document.querySelectorAll('#spark-tree .tree-node[data-mark="new"]').length;
    const treeSeen = document.querySelectorAll('#spark-tree .tree-node[data-mark="seen"]').length;
    t.event("replay-tree", `${id}: Tree shows ${treeNew} New, ${treeSeen} Seen`);
    if (!treeNew) t.problem("bug", `${id}: the Tree shows no New mark on a second run`);
    $("tab-play").click();
    await sleep(300);
    // The home card (in this page) says how many endings are found.
    const want = `1 of ${ends.length} endings`;
    const here = stories().endingsCount(id);
    if (!here || here.found !== 1 || here.total !== ends.length) t.problem("bug", `${id}: endings count ${JSON.stringify(here)}, want 1 of ${ends.length}`);
    // Phone: the same story in a frame at 390x844 (same saved run), then its card on the landing page.
    const doc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
    const sound = doc.defaultView && doc.defaultView.hawkesSound;
    if (sound && sound.prompt && sound.prompt()) await passPrompt(t, doc, "replay marks phone");
    await sleep(600);
    const tagged = [...doc.querySelectorAll("#spark-choices .choice[data-mark]")];
    if (!tagged.length) t.problem("bug", `${id}: no tagged choice at 390x844`);
    for (const btn of tagged) {
      const r = btn.getBoundingClientRect();
      const text = btn.querySelector(".spot-src");
      const tr = text ? text.getBoundingClientRect() : r;
      const tagEl = btn.querySelector(".choice-mark");
      const tag = { content: tagEl ? tagEl.textContent.trim() : "" };
      const tagBox = tagEl ? tagEl.getBoundingClientRect() : null;
      const cut = btn.scrollHeight > btn.clientHeight + 1 || tr.right > r.right - 2 || btn.scrollWidth > btn.clientWidth + 1;
      t.event("replay-phone", `${btn.dataset.mark} choice ${Math.round(r.width)}x${Math.round(r.height)}, tag "${tag.content}"`);
      if (r.height < 47.5) t.problem("bug", `${id}: a ${btn.dataset.mark} choice is ${Math.round(r.height)} px tall at 390x844, want 48 or more`);
      if (cut) t.problem("bug", `${id}: a ${btn.dataset.mark} choice's text is cut off at 390x844`);
      // The tag sits inside the card, clear of the words, and the words keep the card's width: a short choice is one line.
      const lineH = text ? parseFloat(doc.defaultView.getComputedStyle(text).lineHeight) || 20 : 20;
      const lines = Math.round(tr.height / lineH);
      const words = (enText(btn) || "").length;
      t.event("replay-phone-fit", `${btn.dataset.mark}: ${lines} line(s) for ${words} characters, text ${Math.round(tr.width)} of ${Math.round(r.width)} px wide, tag ${tagBox ? `${Math.round(tagBox.width)}x${Math.round(tagBox.height)}` : "missing"}`);
      if (!tagEl) t.problem("bug", `${id}: a ${btn.dataset.mark} choice has no visible tag at 390x844`);
      else {
        if (tagBox.left < r.left || tagBox.right > r.right || tagBox.top < r.top || tagBox.bottom > r.bottom) t.problem("bug", `${id}: the ${btn.dataset.mark} tag sticks out of its choice at 390x844`);
        if (tagBox.bottom > tr.top + 1 && tagBox.left < tr.right && tagBox.right > tr.left) t.problem("bug", `${id}: the ${btn.dataset.mark} tag overlaps the choice's words at 390x844`);
      }
      if (tr.width < r.width * 0.7) t.problem("bug", `${id}: a ${btn.dataset.mark} choice's words only get ${Math.round(tr.width)} of ${Math.round(r.width)} px at 390x844 (they wrap at half the card)`);
      if (lines > 1 && words <= 30) t.problem("bug", `${id}: a ${btn.dataset.mark} choice of ${words} characters wraps onto ${lines} lines at 390x844`);
    }
    t.event("screenshot", `second run at 390x844: ${tagged.length} tagged choices`);
    const backBtn = doc.querySelector(".stories-back");
    if (backBtn) backBtn.click();
    await sleep(500);
    const cardEl = doc.querySelector(`.story-card[data-story="${id}"] .story-card-endings`);
    const cardBox = doc.querySelector(`.story-card[data-story="${id}"]`);
    if (!cardEl || !cardBox) t.problem("bug", `${id}: no endings count on the home card at 390x844`);
    else {
      cardEl.scrollIntoView({ block: "center", behavior: "instant" });
      await sleep(200);
      const er = cardEl.getBoundingClientRect();
      const cr = cardBox.getBoundingClientRect();
      const txt = cardEl.textContent.trim();
      t.event("replay-card", `home card at 390x844: "${txt}"`);
      if (txt !== want) t.problem("bug", `${id}: home card says "${txt}", want "${want}"`);
      if (er.right > cr.right + 1 || er.left < cr.left - 1 || cardEl.scrollWidth > cardEl.clientWidth + 1) t.problem("bug", `${id}: the endings count is cut off on its card at 390x844`);
    }
    closeViewFrame();
  };
  // Every ending found: the home card's count reads "N of N endings" and wears the completion badge (a tick, lit),
  // inside the card at 390x844.
  const bothFoundCard = async () => {
        const doc = await viewFrameLoad(t, "/", 390, 844);
        await sleep(700);
        const cardBox = doc.querySelector(`.story-card[data-story="${id}"]`);
        const cardEl = cardBox && cardBox.querySelector(".story-card-endings");
        if (!cardEl) t.problem("bug", `${id}: no endings count on the home card after both endings`);
        else {
          cardEl.scrollIntoView({ block: "center", behavior: "instant" });
          await sleep(200);
          const er = cardEl.getBoundingClientRect();
          const cr = cardBox.getBoundingClientRect();
          const txt = cardEl.textContent.trim();
          const badge = doc.defaultView.getComputedStyle(cardEl, "::before").content;
          t.event("replay-card-complete", `home card at 390x844: "${txt}", badge ${cardBox.dataset.allEndings === "true" ? "shown" : "missing"} (${badge})`);
          if (txt !== `${ends.length} of ${ends.length} endings`) t.problem("bug", `${id}: home card says "${txt}" with both endings found`);
          if (cardBox.dataset.allEndings !== "true") t.problem("bug", `${id}: no completion badge on the home card with every ending found`);
          if (er.right > cr.right + 1 || er.left < cr.left - 1 || cardEl.scrollWidth > cardEl.clientWidth + 1) t.problem("bug", `${id}: the completion badge is cut off on its card at 390x844`);
          t.event("screenshot", `home card with every ending found at 390x844`);
        }
        closeViewFrame();
  };
  try {
    // Smoke leg: seed one found ending, open the gallery from the story page, check locked silhouette + count.
    if (options.at === "smoke") {
      const first = ends[0];
      localStorage.setItem(endingsStorageKey(st), JSON.stringify({ ids: [first] }));
      if (!landingShown()) await toLanding(t);
      await openStory(t, id);
      await toStart(t, { quiet: true });
      t.scene(`${id}: Endings gallery (smoke)`);
      await openTab(`${id} smoke`);
      const foundName = String(st.scenes[first].title[1] || st.scenes[first].title[0]).trim();
      const named = [...document.querySelectorAll("#spark-endings .ending-tile.is-found .ending-tile-name")].map((n) => n.textContent.trim());
      if (!named.includes(foundName)) t.problem("bug", `${id} smoke: found tile should say "${foundName}"`);
      t.metric("endingsFound", 1);
      t.metric("endingsTotal", ends.length);
      {
        const doc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
        const sound = doc.defaultView && doc.defaultView.hawkesSound;
        if (sound && sound.prompt && sound.prompt()) await passPrompt(t, doc, "endings-gallery phone");
        await sleep(400);
        const tab = doc.getElementById("tab-endings");
        if (tab) { tab.click(); await sleep(300); }
        const pane = doc.getElementById("spark-endings");
        if (pane && !pane.hidden) {
          const count = pane.querySelector(".endings-count")?.textContent.trim();
          t.event("screenshot", `endings gallery at 390x844: ${count || "no count"}`);
          if (pane.getBoundingClientRect().bottom > 844 + 2) t.problem("bug", `${id}: gallery cut off at 390x844`);
        } else t.event("screenshot", "endings gallery at 390x844 (tab open attempted)");
        closeViewFrame();
      }
      t.progress(1);
      return;
    }

    // Replay leg on its own ({"at":"replay"}, and by default on a phone-sized page, where walking the player to an ending
    // is not what is being judged): a named setup shortcut, `seeded-run`. It writes what the player would have saved for a
    // viewer who had reached the first ending (the ending found, the scenes of the way unlocked), opens the story by
    // the card, then everything the criteria are about is real presses and taps: the New tags and Seen marks on the
    // choices, the Tree, the card's "1 of N endings" at 390x844, and then "N of N" with the badge.
    if (options.at === "replay" || innerWidth <= 600) {
      const first = ends[0];
      const seedWay = wayTo(st, (sc) => sc === st.scenes[first]);
      if (!seedWay) throw new Error(`${id}: no way to ${first}`);
      localStorage.setItem(endingsStorageKey(st), JSON.stringify({ ids: [first] }));
      document.cookie = `${unlocksCookie(st)}=${encodeURIComponent(JSON.stringify({ seen: [st.start, ...seedWay], completed: true }))}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax`;
      t.event("seeded-run", `${id}: ending ${first} found and the ${seedWay.length + 1} scenes of its way unlocked (setup shortcut)`);
      if (!landingShown()) await toLanding(t);
      await openStory(t, id);
      await toStart(t, { quiet: true });
      await replayLeg(first, seedWay);
      if (ends.length > 1) {
        localStorage.setItem(endingsStorageKey(st), JSON.stringify({ ids: ends }));
        t.event("seeded-run", `${id}: every ending found (setup shortcut)`);
        await bothFoundCard();
      }
      t.progress(1);
      return;
    }

    if (!landingShown()) await toLanding(t);
    await openStory(t, id);
    await toStart(t, { quiet: true });
    let reached = 0;
    for (const end of ends) {
      t.scene(`${id}: way to ${end}`);
      const way = wayTo(st, (sc) => sc === st.scenes[end]);
      if (!way) throw new Error(`${id}: no way to ${end}`);
      if (sceneId() !== st.start || spark().depth() !== 0) {
        // New run from the ending card or a restart.
        if ($("spark-try-another")) {
          await tapAt(t, $("spark-try-another"), "Try another path");
          await sleep(400);
        } else await toStart(t, { quiet: true });
      }
      for (const to of way) await pressTo(to);
      await sleep(400);
      reached += 1;
      const card = $("spark-ending");
      if (card.hidden || !card.classList.contains("ending-card")) t.problem("bug", `${id}: reaching ${end} shows no ending card`);
      const countEl = $("spark-ending-count") || card.querySelector(".ending-count");
      const want = `${reached} of ${ends.length} found`;
      t.event("ending-count", `${id}/${end}: ${countEl ? countEl.textContent.trim() : "(none)"}`);
      if (!countEl || countEl.textContent.trim() !== want) t.problem("bug", `${id}: ending card count "${countEl ? countEl.textContent.trim() : ""}", want "${want}"`);
      const openBtn = $("spark-endings-open");
      if (!openBtn) t.problem("bug", `${id}: ending card has no Endings button`);
      else {
        await tapAt(t, openBtn, "Endings from card");
        await sleep(300);
        checkGallery($("spark-endings"), reached, `${id} from ending card (${reached})`);
      }
      if (reached === 1 && ends.length > 1) await replayLeg(end, way);
      t.progress(reached / (ends.length + 2));
    }
    // Tapping a found ending shows its card again.
    const firstFound = ends[0];
    const tile = document.querySelector(`#spark-endings .ending-tile.is-found[data-ending="${firstFound}"]`);
    if (!tile) t.problem("bug", `${id}: no found tile for ${firstFound} to tap`);
    else {
      await tapAt(t, tile, `found ending ${firstFound}`);
      await sleep(350);
      const recall = $("spark-ending");
      t.event("ending-recall", `${id}/${firstFound}: card ${recall && !recall.hidden ? "shown" : "missing"}`);
      if (!recall || recall.hidden || recall.dataset.ending !== firstFound) t.problem("bug", `${id}: tapping found ending did not show its card`);
      else if (!recall.querySelector(".ending-name")) t.problem("bug", `${id}: recalled ending card has no name`);
    }
    // Story page tab still works once both are found.
    await openTab(`${id} Endings tab`);
    t.metric("endingsFound", stories().foundEndings(id)?.length || 0);
    t.metric("endingsTotal", ends.length);
    // Fit checks at the two sizes the brief asks for.
    for (const [w, h, name] of [[390, 844, "phone"], [1280, 720, "desktop"]]) {
      const doc = await viewFrameLoad(t, `/?story=${id}`, w, h);
      const sound = doc.defaultView && doc.defaultView.hawkesSound;
      if (sound && sound.prompt && sound.prompt()) await passPrompt(t, doc, `endings-gallery ${name}`);
      await sleep(400);
      const tab = doc.getElementById("tab-endings");
      if (tab) { tab.click(); await sleep(300); }
      const pane = doc.getElementById("spark-endings");
      if (!pane || pane.hidden) t.problem("bug", `${id}: gallery not open at ${w}x${h}`);
      else {
        const box = pane.getBoundingClientRect();
        t.event("screenshot", `endings gallery at ${w}x${h}: ${pane.querySelector(".endings-count")?.textContent.trim() || ""}`);
        if (box.bottom > h + 2 || box.right > w + 2) t.problem("bug", `${id}: gallery cut off at ${w}x${h}`);
        const locked = pane.querySelectorAll(".ending-tile.is-locked").length;
        if (locked !== 0) t.problem("bug", `${id}: at ${w}x${h} still has ${locked} locked tiles after both endings`);
      }
      closeViewFrame();
    }
    await bothFoundCard();
    t.event("criterion", `${id}: endings gallery shows found posters/names, locked ???, count up to ${ends.length} of ${ends.length}, recall works, fits 390x844 and 1280x720`);
    // Night Shift's twelve tiles must scroll inside the player at 390x844 (flex shell like the Tree).
    const night = story("night-shift");
    if (night && Array.isArray(night.endings) && night.endings.length > 4) {
      t.scene("Night Shift: Endings gallery scrolls at 390x844");
      localStorage.setItem(endingsStorageKey(night), JSON.stringify({ ids: night.endings.slice(0, 2).map((e) => e.id) }));
      const doc = await viewFrameLoad(t, "/?story=night-shift", 390, 844);
      const sound = doc.defaultView && doc.defaultView.hawkesSound;
      if (sound && sound.prompt && sound.prompt()) await passPrompt(t, doc, "night-shift endings");
      await sleep(500);
      const btn = doc.getElementById("console-endings-btn");
      if (!btn) t.problem("bug", "night-shift: no Endings button");
      else {
        btn.click();
        await sleep(350);
        const pane = doc.getElementById("console-endings");
        if (!pane || pane.hidden) t.problem("bug", "night-shift: Endings gallery did not open");
        else {
          const tiles = pane.querySelectorAll(".ending-tile").length;
          t.event("screenshot", `night-shift endings at 390x844: ${tiles} tiles, ${pane.querySelector(".endings-count")?.textContent.trim() || ""}`);
          if (tiles !== night.endings.length) t.problem("bug", `night-shift: gallery shows ${tiles} tiles, want ${night.endings.length}`);
          if (pane.scrollHeight <= pane.clientHeight + 1 && tiles > 6) t.problem("warning", "night-shift: gallery did not need to scroll at 390x844 (tiles may be too small)");
          if (pane.getBoundingClientRect().right > 390 + 2) t.problem("bug", "night-shift: gallery wider than 390px");
        }
      }
      closeViewFrame();
    }
    t.progress(1);
  } finally {
    closeViewFrame();
    // Outer smoke (or another parent) owns restoreProgress when this ran as a leg.
  }
}

/** The vertical-native stage (J, 2026-11-11): how much of the stage the picture fills, the clip's height, the blurred copy
    beside it and where the choices sit. `tag` is "1280x720" etc.; a `screenshot` event follows for the review. */
function stageFill(t, doc, id, tag) {
  const win = doc.defaultView;
  const W = win.innerWidth;
  const H = win.innerHeight;
  const stage = doc.querySelector(".spark-stage");
  const box = doc.getElementById("spark-video");
  const v = doc.querySelector("#spark-video video:not(.spark-leave)");
  if (!stage || !box || !v) { t.problem("bug", `${id} at ${tag}: no stage or clip to measure`); return null; }
  const sr = stage.getBoundingClientRect();
  const br = box.getBoundingClientRect();
  const ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 9 / 16;
  const fit = win.getComputedStyle(v).objectFit;
  // The picture: the box itself when the clip covers it, else the clip's own 9:16 centred inside it.
  let pw = br.width, ph = br.height;
  if (fit !== "cover") { ph = Math.min(br.height, br.width / ar); pw = ph * ar; }
  const share = (pw * ph) / (sr.width * sr.height);
  const blur = doc.getElementById("spark-blur");
  const blurShown = !!blur && win.getComputedStyle(blur).display !== "none";
  const blurVideo = blur && blur.querySelector("video");
  const blurPlaying = !!blurVideo && !blurVideo.paused && blurVideo.readyState >= 2;
  const bare = Math.max(0, sr.width - pw);
  const choices = [...doc.querySelectorAll("#spark-choices .choice")].map((c) => c.getBoundingClientRect());
  t.metric(`stageFill.${id}.${tag}`, Math.round(share * 100) / 100);
  t.metric(`clipHeightPx.${id}.${tag}`, Math.round(ph));
  t.event("stage-fill", `${id} ${tag}: stage ${Math.round(sr.width)}x${Math.round(sr.height)}, clip box ${Math.round(br.width)}x${Math.round(br.height)} at ${Math.round(br.left)},${Math.round(br.top)}, picture ${Math.round(pw)}x${Math.round(ph)} = ${Math.round(share * 100)}% of the stage (${Math.round((ph / H) * 100)}% of the viewport's height); object-fit ${fit}; blurred copy ${blurShown ? (blurPlaying ? "playing" : "shown") : "off"}; choices ${choices.map((r) => `${Math.round(r.top)}+${Math.round(r.height)}`).join(", ") || "none"}`);
  t.event("screenshot", `${id} ${tag}: the first frame fills ${Math.round(share * 100)}% of the stage`);
  if (W < 600 && H > W) {
    if (Math.abs(br.width - W) > 1 || br.left < -0.5) t.problem("bug", `${id} at ${tag}: the clip spans ${Math.round(br.width)} px of ${W}, not the full width`);
    if (parseFloat(win.getComputedStyle(box).borderTopLeftRadius) > 0) t.problem("bug", `${id} at ${tag}: the clip is a rounded card`);
    choices.forEach((r, i) => {
      if (r.top < H * 2 / 3 - 1) t.problem("bug", `${id} at ${tag}: choice ${i + 1} starts at y=${Math.round(r.top)}, above the bottom third (${Math.round(H * 2 / 3)})`);
    });
  } else if (W >= 900 && H >= 560) {
    if (ph < H * 0.6 - 1) t.problem("bug", `${id} at ${tag}: the clip is ${Math.round(ph)} px tall, under 60% of the ${H} px viewport`);
    if (bare > 2 && !(blurShown && blurVideo)) t.problem("bug", `${id} at ${tag}: ${Math.round(bare)} px of flat black beside the clip: no blurred copy of the video fills it`);
    else if (bare > 2 && !blurPlaying) t.problem("warning", `${id} at ${tag}: the blurred copy isn't playing yet`);
  }
  choices.forEach((r, i) => {
    if (r.height < 47.5) t.problem("bug", `${id} at ${tag}: choice ${i + 1} is ${Math.round(r.height)} px tall, under 48`);
    if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) t.problem("bug", `${id} at ${tag}: choice ${i + 1} isn't fully on screen (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} of ${W}x${H})`);
  });
  return share;
}

/** Cinematic player chrome (J, 2026-11-06): the video letterboxed to 2.39:1 on desktop, the choices dimmed while the clip
    plays and faded in at its end with a visible countdown, and the bar and title fading after 3 s idle. Real presses
    (the card, Tap to play); the clip is watched to its end. No setup shortcut. */
async function cinemaRun(options, t) {
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  clearProgress();
  try {
    const id = options.story || FIRST;
    if (!landingShown()) await toLanding(t);
    await openStory(t, id);
    await toStart(t, { quiet: true });
    const desktop = innerWidth >= 900 && innerHeight >= 560;
    const frame = document.querySelector("#spark-video");
    const video = () => document.querySelector("#spark-video video:not(.spark-leave)");
    const box = $("spark-choices");
    t.scene(`${id}: stage fill`);
    // 1. The vertical-native stage: the share of the stage the picture fills at 1280x720 (a frame), then at the page's own size.
    const r = frame.getBoundingClientRect();
    t.metric("videoFrameRatio", Math.round((r.width / r.height) * 100) / 100);
    stageFill(t, document, id, `${innerWidth}x${innerHeight}`);
    {
      const fdoc = await viewFrameLoad(t, `/?story=${id}`, 1280, 720);
      await passPrompt(t, fdoc, `${id} (1280x720)`);
      await waitFor(() => { const fv = fdoc.querySelector("#spark-video video:not(.spark-leave)"); return fv && !fv.paused && fv.currentTime > 0.5; }, 8000);
      await sleep(600);
      stageFill(t, fdoc, id, "1280x720");
      closeViewFrame();
    }
    // 2. choices show the "Up next" preview state while the clip plays (not greyed-out disabled text, countdown not running yet)
    const first = choiceButtons()[0];
    if (!first) throw new Error(`${id}: no choices on the first page`);
    if (!video().ended && box.dataset.phase !== "waiting") t.problem("bug", `${id}: the choices aren't waiting while the clip plays (phase ${box.dataset.phase})`);
    const dim = parseFloat(getComputedStyle(first).opacity);
    const timerState = $("spark-timer") ? $("spark-timer").dataset.state : "off";
    t.event("choices-waiting", `phase ${box.dataset.phase}, opacity ${dim.toFixed(2)}, timer state ${timerState} while the clip plays`);
    if (box.dataset.phase === "waiting" && dim < 0.9) t.problem("bug", `${id}: the choices look disabled (${dim.toFixed(2)} opacity) while the clip plays`);
    if (timerState === "running") t.problem("bug", `${id}: the countdown runs before the clip ends`);
    // 3. wait for the clip's end (watched, not skipped)
    t.scene(`${id}: watching the clip`);
    const limit = Date.now() + 90000;
    while (box.dataset.phase !== "ready" && Date.now() < limit) await sleep(200);
    if (box.dataset.phase !== "ready") throw new Error(`${id}: the clip never ended (${video() && video().currentTime}s of ${video() && video().duration}s)`);
    t.event("clip-ended", `${(video().duration || 0).toFixed(1)}s clip, choices ready`);
    const r2 = frame.getBoundingClientRect();
    t.event("frame-stable", `stage ${Math.round(r.width)}x${Math.round(r.height)} -> ${Math.round(r2.width)}x${Math.round(r2.height)}, top ${Math.round(r.top)} -> ${Math.round(r2.top)}`);
    if (Math.abs(r2.height - r.height) > 1 || Math.abs(r2.width - r.width) > 1 || Math.abs(r2.top - r.top) > 1) t.problem("bug", `${id}: the video stage resized or moved when the countdown appeared (${Math.round(r.width)}x${Math.round(r.height)} -> ${Math.round(r2.width)}x${Math.round(r2.height)})`);
    t.scene(`${id}: choices and timer`);
    const timer = $("spark-timer");
    const label = () => (timer.querySelector(".choice-timer-label").textContent || "").trim();
    if (!timer || timer.hidden || getComputedStyle(timer).display === "none") throw new Error(`${id}: no visible countdown at the end of the clip`);
    const tr = timer.getBoundingClientRect();
    if (tr.height < 1 || tr.width < 40) t.problem("bug", `${id}: the countdown is ${Math.round(tr.width)}x${Math.round(tr.height)}`);
    const bar = timer.querySelector(".choice-timer-bar");
    const scaleOf = () => parseFloat((getComputedStyle(bar).transform.match(/matrix\(([-\d.e]+)/) || [0, 1])[1]);
    const s1 = scaleOf();
    const l1 = label();
    await sleep(1600);
    const s2 = scaleOf();
    const l2 = label();
    t.event("countdown", `${l1} -> ${l2}, bar ${s1.toFixed(2)} -> ${s2.toFixed(2)}`);
    if (!(s2 < s1)) t.problem("bug", `${id}: the countdown bar isn't shrinking (${s1.toFixed(2)} -> ${s2.toFixed(2)})`);
    if (l1 === l2) t.problem("bug", `${id}: the countdown label stays at ${l1}`);
    const lit = parseFloat(getComputedStyle(choiceButtons()[0]).opacity);
    t.event("choices-faded-in", `opacity ${lit.toFixed(2)}`);
    if (lit < 0.95) t.problem("bug", `${id}: the choices are at ${lit.toFixed(2)} opacity after the clip ended`);
    t.metric("choiceWindowSeconds", 15);
    // 4. controls hide after 3 s idle and come back on movement
    t.scene(`${id}: controls idle`);
    const bar0 = document.querySelector("#spark .spark-bar");
    const wake = () => document.dispatchEvent(new PointerEvent("pointermove", { pointerType: "mouse", pointerId: 1, isPrimary: true, bubbles: true, clientX: 300 + Math.random() * 50, clientY: 300, view: window }));
    wake();
    const t0 = Date.now();
    await sleep(2000);
    const early = $("spark").classList.contains("is-idle");
    t.event("controls", `2 s idle: ${early ? "hidden (too early)" : "shown"}, opacity ${getComputedStyle(bar0).opacity}`);
    if (early) t.problem("bug", `${id}: the controls hid after 2 s, before the 3 s idle`);
    while (!$("spark").classList.contains("is-idle") && Date.now() - t0 < 6000) await sleep(100);
    const after = Date.now() - t0;
    await sleep(900);
    const op = parseFloat(getComputedStyle(bar0).opacity);
    t.event("controls-hidden", `hidden after ${(after / 1000).toFixed(1)} s idle, bar opacity ${op.toFixed(2)}`);
    t.metric("controlsHideSeconds", Math.round(after / 100) / 10);
    if (!$("spark").classList.contains("is-idle") || op > 0.1) t.problem("bug", `${id}: the controls didn't hide after 3 s idle (opacity ${op.toFixed(2)})`);
    else if (after < 2900 || after > 3600) t.problem("bug", `${id}: the controls hid after ${(after / 1000).toFixed(1)} s, not 3 s`);
    wake();
    await sleep(900);
    const back = parseFloat(getComputedStyle(bar0).opacity);
    t.event("controls-back", `bar opacity ${back.toFixed(2)} after movement`);
    if (back < 0.95) t.problem("bug", `${id}: the controls didn't come back on movement (opacity ${back.toFixed(2)})`);
    // 5. a choice still works, and the next page starts dimmed again
    const next = choiceButtons()[0];
    await tapAt(t, next, `"${enText(next)}"`);
    await sleep(400);
    if (!(video() && !video().ended) || $("spark-choices").dataset.phase !== "waiting") t.problem("bug", `${id}: the next page's choices don't wait for its clip (phase ${$("spark-choices").dataset.phase})`);
    if ($("spark-timer").dataset.state === "running") t.problem("bug", `${id}: the old countdown carried into the next page`);
    t.event("next-page", `phase ${$("spark-choices").dataset.phase}, timer state ${$("spark-timer").dataset.state}`);
    t.progress(1);
  } finally {
    restoreProgress();
  }
}

async function analyticsRun(options, t) {
  const A = window.hawkesAnalytics;
  if (!A || !A.config) {
    t.problem("bug", "Hawkes Analytics didn't load on the home page (hawkesgen.ai/sdk/analytics@1.js)");
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
  if (/\.hawkesgen\.ai$/.test(location.hostname) && c.env !== "beta" && c.env !== "preview") t.problem("bug", `On ${location.hostname} the analytics env is ${c.env}, not beta`);

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
  // A death's two buttons (Rewind to the choice, Start over): Start over is the old Try again.
  const tapDeath = async (kind) => {
    const button = document.querySelector(`#spark-choices [data-death=${kind}]`);
    if (!button) throw new Error(`no ${kind} button on the death ${sceneId()}`);
    button.scrollIntoView({ block: "center", behavior: "instant" });
    await tapAt(t, button, `"${enText(button)}"`);
    await sleep(200);
    if (kind === "start" && sceneId() !== st.start) throw new Error(`Start over didn't open ${st.start} (on ${sceneId()})`);
    t.scene(`${FIRST}/${st.scenes[sceneId()].folder}`);
    await waitFor(() => !document.querySelector("#spark-video video:not(.spark-leave)")?.paused, 4000);
    await sleep(900);
  };
  const tapChoice = async (to) => {
    const i = st.scenes[sceneId()].choices.findIndex((ch) => ch[2] === to);
    const button = choiceButtons()[i];
    if (i < 0 || !button) throw new Error(`no choice from ${sceneId()} to ${to}`);
    if (!button.getClientRects().length) {
      // A one-choice page has no button: it carries on by itself when its clip ends (the video is skipped to its end).
      const from = sceneId();
      const v = document.querySelector("#spark-video video:not(.spark-leave)");
      await waitFor(() => v && v.duration > 0.5 && isFinite(v.duration), 8000);
      if (v && v.duration > 0.5 && isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 0.12);
      if (!(await waitFor(() => sceneId() !== from, 5000))) throw new Error(`${from} has one choice and didn't carry on by itself`);
      t.event("auto-continue", `${from} → ${sceneId()} by itself`);
    } else {
      button.scrollIntoView({ block: "center", behavior: "instant" });
      await tapAt(t, button, `"${enText(button)}"`);
      await sleep(200);
    }
    if (sceneId() !== to) throw new Error(`"${enText(button)}" didn't open ${to} (on ${sceneId()})`);
    t.scene(`${FIRST}/${st.scenes[to].folder}`);
    // A moment on each page, so its video plays (and is skipped by the next choice).
    await waitFor(() => !document.querySelector("#spark-video video:not(.spark-leave)")?.paused, 4000);
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
    await tapDeath("start");
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
    t.progress(0.92);
    for (const info of listedStories().filter((x) => x.id !== FIRST && !isConsole(x))) await analyticsVideoStory(t, A, pump, story(info.id));
    const night = consoleStories().find((c) => c.listed);
    if (night) await analyticsNight(t, A, pump, night);
    t.progress(1);
  } finally {
    clearInterval(timer);
    for (const k of ASK_KEYS.session) saved.session[k] == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, saved.session[k]);
    for (const k of ASK_KEYS.local) saved.local[k] == null ? localStorage.removeItem(k) : localStorage.setItem(k, saved.local[k]);
  }
}

/* ---------------- console stories (js/console.js): a wall of cameras, voiced lines, a state, a shift log ---------------- */

const isConsole = (st) => !!st && st.type === "console";
const consoleStories = () => allStories().filter(isConsole);
const rulesOf = () => window.iltvConsoleRules;
const RUN_KEY = "iltv.run.";
const SUBS_KEY = "iltv.subtitles";
const apiOf = (doc = document) => doc.defaultView.iltvConsole;
const byIdIn = (doc, id) => doc.getElementById(id);
const openChoices = (doc = document) => [...doc.querySelectorAll("#console-choices .choice")];
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** What the data says a run holds, worked out here with the shared rules (js/console-rules.js) on its own: the
    state, the way there and the shift log, step by step as a viewer chooses. */
function consoleModel(st) {
  const R = rulesOf();
  const m = { scene: st.start, state: R.fresh(st), history: [], log: [] };
  const enter = () => {
    const s = st.scenes[m.scene];
    if (s.log) m.log.push({ k: "s", t: s.time, text: s.log, sc: m.scene });
  };
  enter();
  m.open = () => st.scenes[m.scene].choices.map((c, i) => [c, i]).filter(([c]) => R.usable(c, m.state));
  m.choose = (i) => {
    const s = st.scenes[m.scene];
    const c = s.choices[i];
    m.log.push({ k: "c", t: s.time, text: R.extraOf(c).log || c[0], o: s.choices.length - 1, sc: m.scene });
    m.state = R.apply(st, m.state, c);
    m.history.push(m.scene);
    m.scene = c[2];
    enter();
  };
  return m;
}

/** The state explorer's result for a story, worked out once per page load (it takes seconds on a story this size). */
const exploreCache = new Map();
function consoleExplore(st) {
  // consoleWarm fills the cache in slices before anything plays; this is only the one-go fallback.
  if (!exploreCache.has(st.id)) exploreCache.set(st.id, rulesOf().explore(st, { cap: st.stateCap || 50000 }));
  return exploreCache.get(st.id);
}

/* ---------------- frame time per scene (gap 42) and the state explorer before play ---------------- */

/* The page's frames, timed from requestAnimationFrame: for each scene the number of frames, the worst gap between two
   and how many were over 50 ms, as a `frame-time` event when a scene had a dip (over 50 ms) and in the run's metrics
   (frameWorstMs, framesOver50, slowestScenes). A gap over 2 s is a hidden tab, not a dip. The state explorer
   (consoleWarm) runs before anything plays and says how long it blocked the page, so a dip that lines up with it is
   the explorer's and one in the middle of a scene is the scene's (pictures decoding, audio starting). */
const probe = { on: false, last: 0, scene: "", n: 0, sum: 0, worst: 0, over: 0, all: [], total: { n: 0, worst: 0, over: 0 } };
function probeStart() {
  if (probe.on) return;
  probe.on = true;
  const tick = (now) => {
    if (!probe.on) return;
    if (probe.last) {
      const d = now - probe.last;
      if (d < 2000) {
        probe.n++;
        probe.sum += d;
        if (d > probe.worst) probe.worst = d;
        if (d > 50) probe.over++;
      }
    }
    probe.last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function probeFlush(t, next) {
  if (probe.scene && probe.n) {
    const mean = probe.sum / probe.n;
    probe.all.push({ scene: probe.scene, worst: probe.worst, over: probe.over });
    probe.total.n += probe.n;
    probe.total.over += probe.over;
    probe.total.worst = Math.max(probe.total.worst, probe.worst);
    if (probe.over) t.event("frame-time", `${probe.scene}: ${probe.n} frames, mean ${mean.toFixed(1)} ms, worst ${Math.round(probe.worst)} ms, ${probe.over} over 50 ms`);
    t.metric("frameWorstMs", Math.round(probe.total.worst));
    t.metric("framesOver50", probe.total.over);
    t.metric("slowestScenes", probe.all.slice().sort((a, b) => b.worst - a.worst).slice(0, 5).map((x) => `${x.scene} ${Math.round(x.worst)} ms`).join("; "));
  }
  probe.scene = next || "";
  probe.n = probe.sum = probe.worst = probe.over = 0;
}
function probeStop(t) {
  probeFlush(t, "");
  probe.on = false;
}

/** The state explorer (and the lengths of every way) for each console story, worked out before anything plays: it is
    seconds of work on the page's thread for Night Shift (257,606 states), which would freeze a scene's frames if it
    ran in the middle of one. Says how long it held the page. */
async function consoleWarm(t) {
  for (const st of consoleStories()) {
    if (exploreCache.has(st.id)) continue;
    t.scene(`setup: exploring ${st.id} 0%`);
    t.note(`${st.title}: working out its states before play`);
    t.progress(0.01);
    const t0 = performance.now();
    // Sliced: the work hands the thread back every ~30 ms (a macrotask), so frames draw and the runner can poll the page.
    // The job line moves every few seconds; 5 minutes in all is a bug that names the step.
    const run = (what, share, from) => {
      let said = 0;
      return {
        sliceMs: 30,
        tick: () => new Promise((ok) => setTimeout(ok, 0)),
        now: () => performance.now(),
        onProgress: (p) => {
          const now = performance.now();
          if (now - t0 > SETUP_TOTAL) throw new Error(`setup "${st.id}: ${what}" took over ${SETUP_TOTAL / 60000} minutes`);
          if (now - said < 2500) return;
          said = now;
          const frac = p.queued != null ? p.states / (p.states + p.queued) : Math.min(0.95, p.states / 260000);
          t.scene(`setup: ${what} ${st.id} ${Math.round(frac * 100)}%`);
          t.progress(from + share * frac);
          t.note(`${st.title}: ${what} (${p.states} states)`);
        },
      };
    };
    let x;
    try {
      x = await rulesOf().exploreAsync(st, { cap: st.stateCap || 50000 }, run("exploring", 0.03, 0.01));
      exploreCache.set(st.id, x);
      if (st.stateCap || x.states > 5000) {
        const stored = lengthsStored(st);
        if (stored) lengthsCache.set(st.id, stored);
        else {
          t.scene(`setup: working out how long each way of ${st.id} is 0%`);
          const l = await rulesOf().lengthsAsync(st, run("working out the ways of", 0.03, 0.04));
          lengthsCache.set(st.id, l);
          lengthsStore(st, l);
        }
      }
    } catch (e) {
      t.problem("bug", e.message);
      throw e;
    }
    t.scene(`setup: ${st.id}'s ways worked out`);
    const ms = Math.round(performance.now() - t0);
    probeFlush(t, `${st.id}: state explorer`);
    t.event("state-explorer", `${st.id}: ${x.states} states in ${ms} ms, sliced (the page gets the thread back every ~30 ms), before anything plays`);
    t.metric(`explorerMs:${st.id}`, ms);
    await boxed(t, `${st.id}: after the explorer`, sleep(200));
  }
}

/** A setup await with a 60 s box: it rejects with a bug that names the step (a wait that never resolves is a finding
    named by step, not a 10-minute stall). Synchronous work can't be boxed: say the step with t.scene before it. */
const SETUP_LIMIT = 60 * 1000;
const SETUP_TOTAL = 5 * 60 * 1000; // the explorer and the lengths together
function boxed(t, what, promise, ms = SETUP_LIMIT) {
  let timer;
  const box = new Promise((_, reject) => {
    timer = setTimeout(() => {
      t.problem("bug", `setup step "${what}" took over ${Math.round(ms / 1000)} s and was stopped`);
      reject(new Error(`setup step "${what}" took over ${Math.round(ms / 1000)} s`));
    }, ms);
  });
  return Promise.race([promise, box]).finally(() => clearTimeout(timer));
}

/** Writes a cookie the way the player does (js/game.js writeCookie). */
function writeJsonCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

/** SETUP SHORTCUT (named in the scenarios that use it: "seeded run"). A console story is hundreds of voiced lines long
    (Night Shift: 36 minutes at the shortest), more than a check can sit through. This leaves the player the way a
    viewer who had listened to the first `picks` choices would have left it: the saved run (state, history, shift log,
    this scene's lines heard) and the two cookies (the place, and the unlocks: `seen` and the scenes of the way, with
    Completed kept as it was). The story is closed first (it saves its run when it closes), then opened by its link,
    so the player itself resumes it. What follows from there is real presses. Returns the model of that run. */
async function consoleSeedAt(t, st, picks, seen) {
  const m = consoleSeedWrite(st, picks, seen);
  openByLink(t, st.id);
  if (!(await waitFor(() => window.iltvConsole.story() === st.id && window.iltvConsole.scene() === m.scene, 4000))) {
    throw new Error(`${st.id}: the seeded run didn't open at ${m.scene} (it is at ${window.iltvConsole.scene()})`);
  }
  if (soundOf().prompt()) await consolePrompt(t, document, st.id);
  t.event("seeded-run", `${st.id}: resumed at ${m.scene} after ${picks.length} choice(s) (setup shortcut: ${m.history.length} scene(s) of the way unlocked, this one's lines heard)`);
  return m;
}

/** The saving half of consoleSeedAt: closes the open story and leaves the saved run and the two cookies as a viewer
    who had listened to `picks` would have left them. The story is opened afterwards by whoever called (the page by its
    link, or a frame loading the same link). Returns the model of that run. */
function consoleSeedWrite(st, picks, seen) {
  const m = consoleModel(st);
  for (const i of picks) m.choose(i);
  const api = window.iltvConsole;
  if (api.story()) api.close();
  const ids = Object.keys(st.scenes);
  const unlocked = new Set([...(seen || []), ...m.history, m.scene]);
  const was = readJsonCookie(unlocksCookie(st)) || {};
  localStorage.setItem(
    RUN_KEY + st.cookie,
    JSON.stringify({ v: 1, scene: m.scene, history: m.history, flags: Object.keys(m.state.flags), meters: m.state.meters, log: m.log, done: st.scenes[m.scene].lines.length, sel: st.scenes[m.scene].focus || null }),
  );
  writeJsonCookie(st.cookie, { scene: m.scene, history: [] });
  let ix = "";
  for (let i = 0; i < ids.length; i += 4) ix += [0, 1, 2, 3].reduce((n, j) => (ids[i + j] && unlocked.has(ids[i + j]) ? n | (1 << j) : n), 0).toString(16);
  writeJsonCookie(unlocksCookie(st), { ix, completed: was.completed === true });
  return m;
}

/** The Tap to play prompt in `doc`: under a runner with a real mouse (Playwright, navigator.webdriver) it waits a
    moment for a real page.mouse.click, then taps it itself; either way the tap is recorded (trusted or not). */
async function consolePrompt(t, doc, where, { real = 0 } = {}) {
  const sound = soundOf(doc);
  if (!sound.prompt()) return sound.unlocked();
  if (real && navigator.webdriver) {
    t.event("real-click-wait", `${where}: waiting up to ${real} ms for a real mouse click on Tap to play`);
    await waitFor(() => !sound.prompt(), real);
  }
  if (sound.prompt()) await passPrompt(t, doc, where);
  const s = sound.state();
  t.event("sound-unlocked", `${where}: ${s.trusted ? "a real click" : "a synthetic press"}, audio ${s.audio}`);
  t.metric("realClick", s.trusted ? 1 : 0);
  if (!s.unlocked) t.problem("bug", `${where}: the tap didn't unlock sound`);
  return s.unlocked;
}

/** Waits for the scene's lines to finish (Skip line taps move them along), then the choices or the ending are there. */
async function consoleHeard(t, doc, where, { skip = true } = {}) {
  const api = apiOf(doc);
  const done = () => {
    const l = api.lines();
    return l && l.done >= l.total && l.playing < 0 && doc.getElementById("console").dataset.lines === "done";
  };
  const t0 = performance.now();
  while (!done() && performance.now() - t0 < 30000) {
    if (skip && !done()) {
      await tapAt(t, byIdIn(doc, "console-skip"), `Skip line (${where})`, { quick: true }).catch(() => {});
      t.add("linesSkipped");
    }
    await sleep(skip ? 15 : 250);
  }
  if (!done()) t.problem("bug", `${where}: the lines never finished (${JSON.stringify(api.lines())})`);
  await sleep(30);
}

/** The scene on screen matches what the data gives for the way the bot came: the state, the log, the wall, the choices. */
function consoleCheck(t, st, m, doc, where, seen) {
  const R = rulesOf();
  const api = apiOf(doc);
  const s = st.scenes[m.scene];
  if (api.scene() !== m.scene) return t.problem("bug", `${where}: the player is at ${api.scene()}, the data says ${m.scene}`);
  if (!sameJson(api.flags(), Object.keys(m.state.flags).sort())) t.problem("bug", `${where}: flags ${JSON.stringify(api.flags())}, the data gives ${JSON.stringify(Object.keys(m.state.flags).sort())}`);
  if (!sameJson(Object.entries(api.meters()).sort(), Object.entries(m.state.meters).sort())) t.problem("bug", `${where}: meters ${JSON.stringify(api.meters())}, the data gives ${JSON.stringify(m.state.meters)}`);
  if (!sameJson(api.history(), m.history)) t.problem("bug", `${where}: history ${api.history().join(" > ")}, the data gives ${m.history.join(" > ")}`);
  const plain = (log) => log.map(({ k, t: time, text, o }) => ({ k, t: time, text, ...(o != null ? { o } : {}) }));
  if (!sameJson(plain(api.log()), plain(m.log))) t.problem("bug", `${where}: the shift log holds ${JSON.stringify(api.log().map((e) => e.text))}, the data gives ${JSON.stringify(m.log.map((e) => e.text))}`);
  // The wall: a tile per camera, each showing the state the scene says.
  const feeds = R.feedsOf(st, s);
  const tiles = [...doc.querySelectorAll("#console-wall .feed")];
  if (tiles.length !== st.cameras.length || tiles.length < 6 || tiles.length > 9) t.problem("bug", `${where}: the wall has ${tiles.length} feeds, the story has ${st.cameras.length} cameras (6 to 9)`);
  for (const tile of tiles) if (tile.dataset.state !== feeds[tile.dataset.camera]) t.problem("bug", `${where}: camera ${tile.dataset.camera} shows "${tile.dataset.state}", the scene says "${feeds[tile.dataset.camera]}"`);
  if ((byIdIn(doc, "console-time").textContent || "").trim() !== s.time) t.problem("bug", `${where}: the clock says "${byIdIn(doc, "console-time").textContent}", the scene's time is ${s.time}`);
  // The lines heard are in order in the subtitles; the choices are the open ones (a gated choice is not on the page).
  const subs = [...doc.querySelectorAll("#console-subs .sub")].map((p) => p.textContent.trim());
  s.lines.forEach((l, i) => {
    if (subs[i] && !subs[i].endsWith(l.text)) t.problem("bug", `${where}: subtitle ${i + 1} is "${subs[i]}", line ${i + 1} is "${l.text}"`);
  });
  if (doc.getElementById("console").dataset.lines === "done") {
    if (subs.length !== s.lines.length) t.problem("bug", `${where}: ${subs.length} subtitles for ${s.lines.length} lines`);
    const shown = openChoices(doc).map((b) => b.textContent.trim());
    const want = s.ending ? [] : m.open().map(([c]) => c[0]);
    if (!sameJson(shown, want)) t.problem("bug", `${where}: the choices on screen are ${JSON.stringify(shown)}, the open ones in this state are ${JSON.stringify(want)}`);
    // By choice, not by label (several choices share one: "Wait for him" to four endings): the buttons on screen are
    // exactly the choices whose conditions hold, and none of the others.
    const onScreen = openChoices(doc).map((b) => Number(b.dataset.choice));
    const usableIx = s.ending ? [] : m.open().map(([, i]) => i);
    for (const i of onScreen) if (!usableIx.includes(i)) t.problem("bug", `${where}: "${s.choices[i][0]}" (choice ${i}) shows although its conditions fail (${sayState(m.state)})`);
    for (const i of usableIx) if (!onScreen.includes(i)) t.problem("bug", `${where}: "${s.choices[i][0]}" (choice ${i}) is missing although its conditions hold (${sayState(m.state)})`);
    if (s.ending) {
      const end = byIdIn(doc, "console-ending");
      if (end.hidden || end.textContent.trim() !== s.ending[0]) t.problem("bug", `${where}: the ending text is "${end.textContent}", not "${s.ending[0]}"`);
      if (doc.getElementById("console").dataset.state !== "soon") t.problem("bug", `${where}: an ending isn't marked as one`);
    }
  }
  if (seen) {
    seen.add(m.scene);
    const want = pctOf(seen.size, Object.keys(st.scenes).length);
    const text = (byIdIn(doc, "console-explored").textContent || "").trim();
    if (text !== `${want}% explored`) t.problem("bug", `${where}: the player says "${text}", the scenes reached give ${want}%`);
  }
}

const sayState = (state) => [...Object.keys(state.flags).sort(), ...Object.entries(state.meters).map(([k, v]) => `${k} ${v}`)].join(", ");

/** Taps the choice the model picks (a real press on its button), waits for the lines, checks the new scene. */
async function consoleChoose(t, st, m, i, doc, where, seen, { hear = true } = {}) {
  const label = st.scenes[m.scene].choices[i][0];
  const button = openChoices(doc).find((b) => Number(b.dataset.choice) === i);
  if (!button) throw new Error(`${where}: no choice "${label}" (choice ${i}) on screen at ${m.scene} (${JSON.stringify(openChoices(doc).map((b) => b.textContent.trim()))})`);
  let inkMs = null, chapterId = null;
  const tPress = performance.now();
  const onInk = (ev) => { if (inkMs == null) inkMs = Math.round(performance.now() - tPress); };
  const onChapter = (ev) => { chapterId = ev.detail && ev.detail.id; };
  doc.addEventListener("iltv:ink", onInk);
  doc.addEventListener("iltv:chapter", onChapter);
  await tapAt(t, button, `choice "${label}"`, { quick: true });
  t.log(`tap choice "${label}"`);
  m.choose(i);
  // Ink (~1 s) and a chapter card (2 s) can hold the next scene; give them room.
  if (!(await waitFor(() => apiOf(doc).scene() === m.scene, 9000))) throw new Error(`${where}: "${label}" didn't open ${m.scene} (on ${apiOf(doc).scene()})`);
  doc.removeEventListener("iltv:ink", onInk);
  doc.removeEventListener("iltv:chapter", onChapter);
  if (inkMs != null) {
    t.event("choice-ink", `${where}: ink ${inkMs} ms after trust/flag choice "${label}"`);
    t.metric("choiceInkMs", inkMs);
    if (inkMs > 2000) t.problem("bug", `${where}: ink took ${inkMs} ms (over 2 s) after "${label}"`);
  }
  if (chapterId) t.event("chapter-card", `${where}: chapter "${chapterId}" after "${label}"`);
  t.add("choicesClicked");
  if (hear) await consoleHeard(t, doc, `${where} > ${m.scene}`);
  consoleCheck(t, st, m, doc, `${where} > ${m.scene}`, seen);
}

/** A new run of the story, like Start Over: the run cookie and the saved run go (the unlocks stay), and the story
    opens again by its link at its first scene. */
async function consoleFresh(t, st) {
  document.cookie = `${st.cookie}=; Max-Age=0; Path=/`;
  localStorage.removeItem(RUN_KEY + st.cookie);
  openByLink(t, st.id);
  await waitFor(() => window.iltvConsole && window.iltvConsole.story() === st.id && window.iltvConsole.scene() === st.start, 3000);
  if (soundOf().prompt()) await consolePrompt(t, document, st.id);
  if (window.iltvConsole.scene() !== st.start || window.iltvConsole.history().length) throw new Error(`${st.id}: a new run opened ${window.iltvConsole.scene()}, not ${st.start}`);
}

/** Opens a console story (a draft, by its link; a listed one from its card), checks it is the console player. */
async function consoleOpen(t, st, { tap = true, real = 0 } = {}) {
  if (!landingShown() && !(stories().current() === st.id)) await toLanding(t);
  if (stories().current() !== st.id) {
    const card = cardOf(st.id);
    if (card) await tapAt(t, card.querySelector("h2") || card, `the ${st.title} card`);
    else {
      openByLink(t, st.id);
      t.log(`open ${st.id} by its link (a draft: no card)`);
    }
    await sleep(300);
  }
  if (stories().current() !== st.id) throw new Error(`${st.id}: didn't open (open: ${stories().current()})`);
  if ($("console").hidden) t.problem("bug", `${st.id}: opened but the console player is hidden`);
  if (!$("spark").hidden) t.problem("bug", `${st.id}: the video player is showing over a console story`);
  if (new URL(location.href).searchParams.get("story") !== st.id) t.problem("bug", `${st.id}: the address doesn't say ?story=${st.id}`);
  if (document.documentElement.dataset.type !== "console") t.problem("bug", `${st.id}: <html data-type> isn't "console"`);
  const bar = document.querySelector(".inventory");
  if (shown(bar) || shown(document.getElementById("torch"))) t.problem("bug", `${st.id}: an inventory bar shows over a console story`);
  t.event("story-open", `${st.id} (${st.title}, console)`);
  const sound = soundOf();
  if (sound.prompt()) {
    const promptTitle = (sound.prompt().querySelector(".tap-title")?.textContent || "").trim();
    if (promptTitle !== st.tap.title) t.problem("bug", `${st.id}: the Tap to play prompt says "${promptTitle}", not "${st.tap.title}"`);
    if (tap) await consolePrompt(t, document, st.id, { real });
  } else if (!sound.unlocked()) t.problem("bug", `${st.id}: opened without its Tap to play prompt (sound is locked)`);
}

/** Every scene and ending: the build's state explorer (js/console-rules.js explore) says how to reach each scene
    and each different set of open choices; the bot plays every one of those from a new run with real presses. */
async function consoleWalk(t, st, sums = { scenes: 0, endings: 0 }) {
  const R = rulesOf();
  // Normally already warmed before the run; if not, work it out sliced (Night Shift's 275k states in one go froze the page for a minute).
  await consoleWarm(t);
  const x = consoleExplore(st);
  const total = Object.keys(st.scenes).length;
  const targets = Object.entries(x.variants)
    .flatMap(([id, vs]) => Object.values(vs).map((v) => ({ id, ...v })))
    .sort((a, b) => a.picks.length - b.picks.length);
  // A small story is played way by way, every different set of open choices; a big one (hundreds of ways) scene by scene.
  const plan = targets;
  t.note(`${st.title}: ${x.states} states, ${targets.length} ways to play${targets.length > 60 ? ", every scene entered by a press" : ""}`);
  t.event("explored", `${st.id}: ${x.states} states, ${Object.keys(x.scenes).length}/${total} scenes reachable, ${targets.length} different sets of choices`);
  Object.keys(st.scenes).filter((id) => !x.scenes[id]).forEach((id) => t.problem("bug", `${st.id}/${id}: no state reaches this scene`));
  x.stuck.forEach((s) => t.problem("bug", `${st.id}/${s.scene}: no usable choice when ${sayState(s.state)}`));
  // A fresh browser for the percent: the unlocks go too, so it follows the scenes this walk reaches.
  document.cookie = `${unlocksCookie(st)}=; Max-Age=0; Path=/`;
  await consoleFresh(t, st);
  const seen = new Set();
  let ways = 0;
  // A story this big (Night Shift: 228 scenes, 1,288 lines) isn't walked way by way: see consoleEveryScene.
  if (targets.length > 60) await consoleEveryScene(t, st, x, seen, sums);
  else for (const target of plan) {
    if (ways++) await consoleFresh(t, st);
    const m = consoleModel(st);
    const where = `${st.id}: ${target.path.join(" > ")}`;
    t.scene(where);
    await consoleHeard(t, document, where);
    consoleCheck(t, st, m, document, where, seen);
    for (const i of target.picks) await consoleChoose(t, st, m, i, document, where, seen);
    t.progress(((sums.scenes || 0) + seen.size) / Math.max(1, total));
    const end = st.scenes[m.scene].ending;
    if (end) {
      t.event("ending", `${st.id}/${m.scene}: ${end[0]}`);
      if (stories().run(st.id) !== "end") t.problem("bug", `${st.id}: at an ending the run says "${stories().run(st.id)}", not end`);
    }
    if (m.scene !== target.id) t.problem("bug", `${where}: expected to end at ${target.id}`);
    if (document.cookie.length > 3800) t.problem("bug", `${st.id}: the cookies are ${document.cookie.length} bytes, near the 4 KB limit`);
  }
  sums.scenes = (sums.scenes || 0) + seen.size;
  sums.endings = (sums.endings || 0) + Object.values(st.scenes).filter((s) => s.ending).length;
  const hasEnd = Object.values(st.scenes).some((s) => s.ending);
  if (seen.size === total) {
    const text = (byIdIn(document, "console-explored").textContent || "").trim();
    if (text !== "100% explored") t.problem("bug", `${st.id}: every scene reached but the player says "${text}"`);
  } else t.problem("bug", `${st.id}: the bot reached ${seen.size} of ${total} scenes`);
  if (hasEnd && stories().progress(st.id) !== "completed") t.problem("bug", `${st.id}: an ending reached but its progress is ${stories().progress(st.id)}`);
  if (stories().explored(st.id) !== 100) t.problem("bug", `${st.id}: explored(${st.id}) is ${stories().explored(st.id)}, not 100`);
  return seen;
}

/** Every scene of a big console story, each entered by a real press of the choice that leads there. Ways this long can't
    be played end to end for every scene (that is what `night-shift` does for four of them, and `console` for the
    demo), so each scene is entered from a seeded run (consoleSeedAt: setup shortcut) that stands at its parent, with the
    state, history and log the shortest way there gives. Scenes go by the length of that way, so a scene's parent is
    always one already seen and the percent explored must follow the count. A scene with a gated choice and every
    ending is heard to the end and its choices checked; the others are checked as they are entered. */
async function consoleEveryScene(t, st, x, seen, sums) {
  const R = rulesOf();
  const total = Object.keys(st.scenes).length;
  const gated = (id) => st.scenes[id].choices.some((c) => {
    const e = R.extraOf(c);
    return (e.requires && e.requires.length) || (e.forbids && e.forbids.length) || e.meters;
  });
  const order = Object.entries(x.scenes).sort((a, b) => a[1].picks.length - b[1].picks.length);
  t.note(`${st.title}: ${order.length} scenes, each entered by a press from a seeded run at its parent`);
  for (const [id, way] of order) {
    const where = `${st.id}: ${way.path.join(" > ")}`;
    t.scene(`${st.id}/${id}`);
    if (!way.picks.length) {
      const m = consoleModel(st);
      await consoleHeard(t, document, where);
      consoleCheck(t, st, m, document, where, seen);
      continue;
    }
    const m = await consoleSeedAt(t, st, way.picks.slice(0, -1), seen);
    const last = way.picks[way.picks.length - 1];
    await consoleChoose(t, st, m, last, document, where, seen, { hear: !!st.scenes[id].ending || gated(id) });
    if (m.scene !== id) t.problem("bug", `${where}: expected to enter ${id}, is at ${m.scene}`);
    if (st.scenes[id].ending) {
      t.event("ending", `${st.id}/${id}: ${st.scenes[id].ending[0]}`);
      if (stories().run(st.id) !== "end") t.problem("bug", `${st.id}: at an ending the run says "${stories().run(st.id)}", not end`);
    }
    if (document.cookie.length > 3800) t.problem("bug", `${st.id}: the cookies are ${document.cookie.length} bytes, near the 4 KB limit`);
    t.progress(((sums.scenes || 0) + seen.size) / Math.max(1, total));
  }
}

/** The shift log (the Log button): it lists what was done and seen, a redacted line per way not taken, and has nothing
    to press. `m` is the model of the run so far. */
async function consoleLogCheck(t, st, m, doc, where) {
  const log = byIdIn(doc, "console-log");
  const button = byIdIn(doc, "console-log-btn");
  await tapAt(t, button, `Log (${where})`);
  await sleep(200);
  if (log.hidden) return t.problem("bug", `${where}: the Log button didn't open the shift log`);
  const rows = [...log.querySelectorAll(".dar-row")];
  const done = rows.filter((r) => !r.classList.contains("is-redacted")).map((r) => ({ time: r.querySelector(".dar-time").textContent.trim(), text: r.querySelector(".dar-text").textContent.trim() }));
  const want = m.log.map((e) => ({ time: e.t, text: e.text }));
  if (!sameJson(done, want)) t.problem("bug", `${where}: the log lists ${JSON.stringify(done.map((r) => r.text))}, what was done and seen is ${JSON.stringify(want.map((r) => r.text))}`);
  const redacted = log.querySelectorAll(".dar-redacted").length;
  const s = st.scenes[m.scene];
  const wantRedacted = m.log.filter((e) => e.k === "c").reduce((n, e) => n + e.o, 0) + (s.ending ? 0 : s.choices.length);
  if (redacted !== wantRedacted) t.problem("bug", `${where}: ${redacted} redacted lines, ${wantRedacted} ways not taken`);
  // Redacted means nothing of the way is readable: no choice that wasn't taken is written in the log.
  // The words of what was done and seen are cut out first: a taken choice logs as "Back to the wall." and its label
  // "Back to the wall" is inside that line, which is the way taken and not a leak of another one.
  let text = log.textContent;
  for (const w of [...new Set(m.log.map((e) => e.text))].sort((a, b) => b.length - a.length)) text = text.split(w).join("");
  const taken = new Set(m.log.map((e) => e.text));
  for (const sc of Object.values(st.scenes)) for (const c of sc.choices) {
    const x = rulesOf().extraOf(c);
    for (const words of [c[0], x.log].filter(Boolean)) if (!taken.has(words) && text.includes(words)) t.problem("bug", `${where}: the log gives away a way not taken: "${words}"`);
  }
  if (log.querySelector("button, a[href], input, select, textarea, [tabindex], [onclick], [role=button]")) t.problem("bug", `${where}: the shift log has something to press`);
  const row = rows.find((r) => !r.classList.contains("is-redacted"));
  if (row) {
    const before = apiOf(doc).scene();
    row.click();
    await sleep(100);
    if (apiOf(doc).scene() !== before || log.hidden) t.problem("bug", `${where}: pressing a log line changed the scene or closed the log`);
  }
  const paper = getComputedStyle(log.querySelector(".dar"));
  if (!paper.backgroundColor || paper.backgroundColor === "rgba(0, 0, 0, 0)") t.problem("warning", `${where}: the log has no paper background`);
  t.event("shift-log", `${where}: ${done.length} entries, ${redacted} redacted lines`);
  await sleep(700); // on screen for the footage
  await tapAt(t, button, `Close log (${where})`);
  await sleep(150);
  if (!log.hidden) t.problem("bug", `${where}: the Log button didn't close the log`);
}

/** Settings apply to the story's audio: Sound off mutes the voice, bed and effects; Volume sets their volume. */
async function consoleSoundCheck(t, st, where, { names = ["voice", "bed", "sfx"] } = {}) {
  const api = apiOf(document);
  const sound = soundOf();
  const original = localStorage.getItem(SOUND_KEY);
  const audio = () => api.audio();
  const checkAll = (what, { on, volume }) => {
    for (const name of names) {
      const a = audio()[name];
      if (!a) {
        t.problem("bug", `${where}: no ${name} audio element`);
        continue;
      }
      if (a.muted === on) t.problem("bug", `${where}: ${what}: the ${name} is ${a.muted ? "muted" : "not muted"}`);
      if (sound.state().volumeWorks && !near(a.volume, volume)) t.problem("bug", `${where}: ${what}: the ${name} volume is ${a.volume.toFixed(2)}, Settings say ${volume}`);
    }
    t.event("audio-settings", `${where}: ${what}: ${names.map((n) => `${n} ${audio()[n]?.muted ? "muted" : "sound"} ${audio()[n]?.volume.toFixed(2)}`).join(", ")}`);
  };
  // Settings opened while a line is being heard: the line is playing when it opens, and the scene is still the same
  // one, with no line heard fewer, once Settings are closed.
  const midLine = async (what, change) => {
    if (!(await waitFor(() => api.lines().playing >= 0, 6000))) return t.problem("bug", `${where}: ${what}: no line was playing to open Settings in the middle of`);
    const scene = api.scene();
    const at = api.lines();
    await openSettings(t, where);
    t.event("settings-mid-line", `${where}: ${what}: Settings opened while line ${at.playing + 1} of ${at.total} plays in ${scene}`);
    await change();
    await tapAt(t, $("sound-done"), "Done");
    await sleep(150);
    if (api.scene() !== scene || api.lines().done < at.done) t.problem("bug", `${where}: ${what}: Settings changed the scene or lost a heard line (${scene}, ${at.done} heard -> ${api.scene()}, ${api.lines().done})`);
  };
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify({ on: true, music: 1, sfx: 1 }));
    sound.set({ on: true, music: 1, sfx: 1 });
    await consoleFresh(t, st);
    // A line is playing while Settings change.
    await waitFor(() => api.lines().playing >= 0, 4000);
    const voice = audio().voice;
    if (!/silence\.wav|\.mp3/.test(voice.src) && !st.scenes[st.start].lines.every((l) => !l.file)) t.problem("bug", `${where}: the first line's audio isn't loaded in the voice element (${voice.src.slice(0, 60)})`);
    checkAll("sound on", { on: true, volume: 1 });
    await midLine("the first scene", async () => {
      await tapAt(t, $("sound-on"), "Sound off");
      await sleep(200);
      checkAll("Sound off", { on: false, volume: 1 });
      slide($("sound-volume"), 40);
      await sleep(300);
      await tapAt(t, $("sound-on"), "Sound on");
      await sleep(200);
      checkAll("Sound on, volume 40%", { on: true, volume: 0.4 });
    });
    // The next scene's audio gets the same settings (the elements are the same, or new ones inherit them).
    await consoleHeard(t, document, where);
    const first = openChoices()[0];
    if (first) {
      await tapAt(t, first, `choice "${first.textContent.trim()}"`);
      await sleep(400);
      checkAll("the next scene, volume 40%", { on: true, volume: 0.4 });
      // And Settings opened in the middle of that scene's first line: Sound off mutes every element, Sound on brings them back at 40%.
      await midLine("the next scene", async () => {
        await tapAt(t, $("sound-on"), "Sound off");
        await sleep(200);
        checkAll("the next scene, Sound off", { on: false, volume: 0.4 });
        await tapAt(t, $("sound-on"), "Sound on");
        await sleep(200);
        checkAll("the next scene, Sound on", { on: true, volume: 0.4 });
      });
    }
    // The tap itself: a press on the prompt unlocks audio.
    const s = sound.state();
    t.metric("audioContext", s.audio === "running" ? 1 : 0);
    if (s.audio !== "running" && s.audio !== "none") t.problem("bug", `${where}: the AudioContext is ${s.audio}`);
  } finally {
    if (original == null) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, original);
    sound.set(original ? JSON.parse(original) : { on: true, music: 1, sfx: 1 });
    if (sound.state().settingsOpen) await tapAt(t, $("sound-done"), "Done");
  }
}

/* A phone, a small phone and a phone on its side: the console in a frame of that size (the frame's own viewport, so
   the page's media queries answer to it). It is scaled down to fit the footage; the layout is not. */
const VIEWPORTS = [
  [390, 844, "portrait phone"],
  [360, 640, "small phone"],
  [844, 390, "landscape phone"],
];
let viewFrame = null;
function closeViewFrame() {
  if (viewFrame) viewFrame.remove();
  viewFrame = null;
}

async function viewFrameLoad(t, url, w, h, { loadMs = 0, alive = () => true } = {}) {
  // A play that was cut off must not open (or close) a frame: the next play owns it.
  if (!alive()) throw new Error("the play was cut off before its frame opened");
  closeViewFrame();
  viewFrame = document.createElement("iframe");
  viewFrame.title = `Playtest ${w}x${h}`;
  const scale = Math.min(1, innerWidth / w, innerHeight / h);
  viewFrame.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;z-index:2147483647;background:#070807;transform:scale(${scale});transform-origin:0 0`;
  document.body.appendChild(viewFrame);
  const frame = viewFrame;
  const loaded = await new Promise((resolve) => {
    frame.addEventListener("load", () => resolve(true), { once: true });
    // loadMs: a frame that never fires "load" gives up (the sign-off names the step) instead of waiting forever.
    if (loadMs) setTimeout(() => resolve(false), loadMs);
    frame.src = url;
  });
  if (!alive()) {
    frame.remove();
    if (viewFrame === frame) viewFrame = null;
    throw new Error("the play was cut off while its frame loaded");
  }
  if (!loaded) throw new Error(`the frame ${w}x${h} never finished loading ${url} (${loadMs} ms)`);
  const win = frame.contentWindow;
  const ready = await waitFor(() => win.iltvConsole && win.iltvStories && win.hawkesSound, 10000);
  if (loadMs && !ready) throw new Error(`the frame ${w}x${h} loaded ${url} but the player never started (10 s)`);
  return frame.contentDocument;
}

/** Everything the player needs is on the screen: nothing wider than it (no sideways scroll), the wall, the
    subtitles, the line buttons and every choice inside it, tap targets 44px or more. */
async function consoleFit(t, doc, where, { endScreen = false } = {}) {
  const win = doc.defaultView;
  const W = win.innerWidth;
  const H = win.innerHeight;
  const bad = (msg) => t.problem("bug", `${where}: ${msg}`);
  const root = doc.documentElement;
  if (root.scrollWidth > W + 1 || doc.body.scrollWidth > W + 1) bad(`the page scrolls sideways (${Math.max(root.scrollWidth, doc.body.scrollWidth)} px wide in ${W})`);
  for (const id of ["console", "console-body", "console-panel"]) {
    const el = id === "console-panel" ? doc.querySelector(".console-panel") : byIdIn(doc, id);
    if (el && el.scrollWidth > el.clientWidth + 1) bad(`#${id} is wider inside (${el.scrollWidth}) than on screen (${el.clientWidth})`);
  }
  const must = [
    ...doc.querySelectorAll("#console-wall .feed"),
    byIdIn(doc, "console-subs"),
    byIdIn(doc, "console-replay"),
    byIdIn(doc, "console-skip"),
    byIdIn(doc, "console-cc"),
    byIdIn(doc, "console-log-btn"),
    byIdIn(doc, "console-stories"),
    ...openChoices(doc),
  ];
  openChoices(doc).forEach((b) => b.getAnimations?.().forEach((a) => { if (a.animationName === "choice-in") a.finish(); }));
  const room = byIdIn(doc, "console-room");
  if (room) must.push(room);
  let scrolled = 0;
  const scrolledNames = [];
  // The part of the screen an element can really be seen in: the viewer's screen cut down by every box that scrolls
  // or clips on the way up (the words column scrolling inside itself hides what is past its edge, whatever the screen).
  const clipOf = (el) => {
    let c = { left: 0, top: 0, right: W, bottom: H };
    for (let p = el.parentElement; p && p !== doc.documentElement; p = p.parentElement) {
      const o = win.getComputedStyle(p);
      if (o.overflowX === "visible" && o.overflowY === "visible") continue;
      const b = p.getBoundingClientRect();
      c = { left: Math.max(c.left, b.left), top: Math.max(c.top, b.top), right: Math.min(c.right, b.right), bottom: Math.min(c.bottom, b.bottom) };
    }
    return c;
  };
  const shown = (el, r) => {
    const c = clipOf(el);
    return r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5 && r.left >= c.left - 0.5 && r.right <= c.right + 0.5;
  };
  for (const el of must) {
    if (!el || !el.getClientRects().length) {
      bad(`${el?.id || el?.className || "an element"} isn't shown`);
      continue;
    }
    let r = el.getBoundingClientRect();
    if (r.left < -0.5 || r.right > W + 0.5) bad(`${el.id || el.className} runs off the side (${Math.round(r.left)}..${Math.round(r.right)} of ${W})`);
    if (r.top < -0.5 || r.bottom > H + 0.5 || !shown(el, r)) {
      scrolledNames.push(`${el.id || el.className || el.tagName} (${Math.round(r.top)}..${Math.round(r.bottom)} of ${H})`);
      el.scrollIntoView({ block: "nearest", behavior: "instant" });
      scrolled++;
      r = el.getBoundingClientRect();
    }
    if (r.top < -0.5 || r.bottom > H + 0.5 || !shown(el, r)) bad(`${el.id || el.className} can't be brought on screen (${Math.round(r.top)}..${Math.round(r.bottom)} of ${H})`);
    // A choice that has been brought on screen is really there to press: nothing lies over its middle.
    if (el.matches(".choice")) {
      const hit = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !(hit === el || el.contains(hit))) bad(`choice "${el.textContent.trim().slice(0, 40)}" is covered by ${hit ? hit.id || hit.className || hit.tagName : "nothing"} (it can't be pressed)`);
    }
    if (el.matches("button, a, .choice") && (r.height < 43.5 || (r.width < 43.5))) bad(`${el.id || el.className || el.tagName} is ${Math.round(r.width)}x${Math.round(r.height)} px, under 44x44`);
  }
  // A choice's words are all there (not cut off by the button).
  for (const b of openChoices(doc)) if (b.scrollWidth > b.clientWidth + 1) bad(`choice "${b.textContent.trim()}" is cut off at the side`);
  // Two things never lie over each other. The words column was scrolled to bring the last choice up, so it goes back to
  // its top first, and each box counts only where it can be seen (what the column scrolls past is not over the wall).
  doc.querySelector(".console-body")?.scrollTo?.(0, 0);
  doc.querySelector(".console-panel")?.scrollTo?.(0, 0);
  const boxes = [...doc.querySelectorAll("#console-room, .room-action, #console-wall, .console-subs, .console-controls, #console-choices:not([hidden])")].map((el) => {
    const b = el.getBoundingClientRect();
    const c = clipOf(el);
    const left = Math.max(b.left, c.left);
    const top = Math.max(b.top, c.top);
    const right = Math.min(b.right, c.right);
    const bottom = Math.min(b.bottom, c.bottom);
    return [el.id || el.className, { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }];
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [an, a] = boxes[i];
    const [bn, b2] = boxes[j];
    if (a.width && b2.width && a.height && b2.height && overlaps(a, b2) && Math.min(a.right, b2.right) - Math.max(a.left, b2.left) > 2 && Math.min(a.bottom, b2.bottom) - Math.max(a.top, b2.top) > 2) bad(`${an} and ${bn} lie over each other`);
  }
  // With the words column back at its top (above), the subtitle strip shows the newest line whole (it is scrolled to its foot): never a strip that cuts the line's top off.
  const subsEl = byIdIn(doc, "console-subs");
  // The strip follows its newest line a frame after the layout changes (a ResizeObserver, then an animation frame): let those pass.
  await Promise.race([new Promise((res) => win.requestAnimationFrame(() => win.requestAnimationFrame(() => win.requestAnimationFrame(res)))), sleep(150)]);
  if (subsEl && subsEl.getClientRects().length && subsEl.lastElementChild) {
    const lastSub = subsEl.lastElementChild;
    const sr = subsEl.getBoundingClientRect();
    const lr = lastSub.getBoundingClientRect();
    const c = clipOf(subsEl);
    const top = Math.max(sr.top, c.top);
    const bottom = Math.min(sr.bottom, c.bottom);
    if (lr.height > 0 && (lr.top < top - 1 || lr.bottom > bottom + 1)) bad(`the subtitle strip cuts the newest line off (the line is ${Math.round(lr.height)} px tall, ${Math.round(lr.top)}..${Math.round(lr.bottom)}; the strip shows ${Math.round(top)}..${Math.round(bottom)}, ${Math.round(bottom - top)} px; ${["#console-endcard", ".console-endcard", "#console-wall", "#console-big:not([hidden])", ".console-panel", "#console-subs", ".console-controls", "#console-ending:not([hidden])"].map((q) => { const b = doc.querySelector(q)?.getBoundingClientRect(); return b ? `${q} ${Math.round(b.top)}..${Math.round(b.bottom)}` : ""; }).filter(Boolean).join(", ")}; scrollTop ${Math.round(subsEl.scrollTop)} of ${Math.round(subsEl.scrollHeight)})`);
  }
  // What holds the scroll, named with its sizes: the report that says which part of a screen is too tall.
  const holders = [".console-body", ".console-panel", "#console-subs", "#console-choices", "#console-wall"].map((q) => [q, doc.querySelector(q)]).filter(([, el]) => el);
  const tall = holders.filter(([, el]) => el.scrollHeight > el.clientHeight + 1).map(([q, el]) => `${q} ${el.scrollHeight} px of ${el.clientHeight}`);
  const boxOf = (q) => {
    const b = doc.querySelector(q)?.getBoundingClientRect();
    return b ? `${q} ${Math.round(b.top)}..${Math.round(b.bottom)}` : "";
  };
  const layout = [".console-bar", "#console-room", "#console-wall", ".console-panel", "#console-subs", ".console-controls", "#console-choices:not([hidden])", "#console-ending:not([hidden])"].map(boxOf).filter(Boolean).join(", ");
  t.event("fit", `${where}: ${W}x${H}, wall ${doc.querySelectorAll("#console-wall .feed").length} feeds, ${openChoices(doc).length} choices, ${scrolled} needed a scroll${scrolledNames.length ? ` (${scrolledNames.join("; ")})` : ""}, no sideways scroll; layout ${layout}${tall.length ? `; taller inside than shown: ${tall.join(", ")}` : ""}`);
  // The end screen has nothing to choose: the card, the ending's name, the line buttons and the wall all fit with no scroll at all, at any size.
  const tallEnd = tall.filter((x) => x.startsWith(".console-body") || x.startsWith(".console-panel"));
  if (endScreen && (scrolled || tallEnd.length)) bad(`the end screen needs a scroll (${scrolledNames.join("; ") || "nothing off screen"}${tallEnd.length ? `; ${tallEnd.join(", ")}` : ""}); layout ${layout}`);
  // The page itself must not have been scrolled to reach anything: the words column scrolling inside itself is fine.
  const pageMoved = Math.max(win.scrollY || 0, doc.scrollingElement?.scrollTop || 0, doc.querySelector(".console-body")?.scrollTop || 0);
  if (pageMoved > 1) bad(`the page itself scrolled ${Math.round(pageMoved)} px to bring things on screen (the words column should scroll inside itself)`);
  doc.querySelector(".console-body")?.scrollTo?.(0, 0);
  doc.querySelector(".console-panel")?.scrollTo?.(0, 0);
  return scrolled;
}

/** Choices on a phone (J, 2026-11-08, finding f_32e426e8a75b): in a 390x844 frame, each of the three stories shows its
    choices as full-width buttons at least 48px tall, near-white text with a visible border, whole (nothing cut off),
    clear of the video controls, and (the clip stories) the countdown "Choose in N s" above them. */
/** Language picker (J, 2026-11-08): The Final Spark's pages are each in another language by design; the picker at
    390px, a switch mid-story that keeps the scene and puts the screen's text in the picked language, and every blog
    title on the list in one language. */
/** The first-visit flashlight (J, 2026-11-11), played at 390x844 touch in a frame: a fresh viewer's sweep shows English
 *  under the light before the first choice with no instruction text; the light then rests and pulses until it is moved;
 *  a second visit does not sweep; a tap on a word or a choice lights its English for about 2 s; each page shows its
 *  language name for about 1.5 s where the location label is. Used by `language` and `phone-media`. */
async function torchSweepLeg(t, id) {
  clearProgress();
  try { localStorage.removeItem("iltv.torch"); } catch (e) { /* none */ }
  t.scene(`${id}: first visit, the flashlight sweep at 390x844`);
  let doc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
  let win = doc.defaultView;
  try { win.localStorage.removeItem("iltv.torch"); win.localStorage.removeItem("iltv.reading"); } catch (e) { /* none */ }
  const lit = new Set();
  let sweepSeen = false;
  let englishUnder = 0;
  let choicesLitBeforeReady = false;
  const wordsBefore = (doc.getElementById("spark")?.innerText || "").split(/\s+/).length;
  await passPrompt(t, doc, `${id} (first sweep)`);
  const sample = () => {
    if (!win.iltvTorch) return;
    if (win.iltvTorch.sweeping()) sweepSeen = true;
    doc.querySelectorAll("#spark-story.is-lit, #spark-question.is-lit, #spark-choices .choice.is-lit").forEach((el) => {
      lit.add(el.id || "choice");
      const en = el.querySelector(".spot-en");
      if (en && win.getComputedStyle(en).opacity !== "0") englishUnder++;
    });
  };
  const until = performance.now() + 60000;
  // The first clip must end (or the cut's push-in start) and the sweep come; sample every 60 ms while it runs.
  while (performance.now() < until) {
    sample();
    if (sweepSeen && !win.iltvTorch.sweeping()) break;
    await sleep(60);
  }
  const phase = doc.getElementById("spark-choices")?.dataset.phase;
  if (!sweepSeen) t.problem("bug", `${id}: a first visit's flashlight never swept by itself`);
  else if (!lit.has("spark-story")) t.problem("bug", `${id}: the sweep never lit the story line (lit: ${[...lit].join(", ") || "nothing"})`);
  else if (!englishUnder) t.problem("bug", `${id}: no English showed under the sweeping light`);
  if (sweepSeen && phase !== "ready") t.problem("bug", `${id}: the sweep ended before the choices were up (phase ${phase})`);
  const wordsAfter = (doc.getElementById("spark")?.innerText || "").split(/\s+/).length;
  const hint = doc.querySelector(".torch-hint, .hint, .tutorial, [data-hint]");
  if (hint) t.problem("bug", `${id}: instruction text on the first page: "${hint.textContent.trim().slice(0, 60)}"`);
  t.event("torch-sweep", `${id}: first visit swept ${sweepSeen}; lit ${[...lit].join(", ")}; English under the light in ${englishUnder} samples; words on screen ${wordsBefore} -> ${wordsAfter}; no instruction text ${!hint}; saved "${win.localStorage.getItem("iltv.torch")}"`);
  t.metric("torchSweepSeen", sweepSeen ? 1 : 0);
  // It rests within reach and pulses until moved.
  await sleep(300);
  const pulsing = doc.body.classList.contains("torch-beckon") && win.getComputedStyle(doc.getElementById("torch-slot")).animationName !== "none";
  if (sweepSeen && !pulsing) t.problem("bug", `${id}: after the sweep the flashlight doesn't rest and pulse`);
  t.event("torch-rest", `${id}: resting and pulsing ${pulsing}`);
  // A tap on a word lights its English for about 2 s, through touch, no drag.
  const touchDown = (el) => {
    const r = el.getBoundingClientRect();
    const init = { pointerType: "touch", pointerId: 52, isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true, composed: true, clientX: r.left + Math.min(40, r.width / 2), clientY: r.top + Math.min(12, r.height / 2), view: win };
    el.dispatchEvent(new win.PointerEvent("pointerdown", init));
    return () => el.dispatchEvent(new win.PointerEvent("pointerup", { ...init, buttons: 0 }));
  };
  const tapTest = async (el, label) => {
    el.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(120);
    const up = touchDown(el);
    const t0 = performance.now();
    await sleep(350);
    const spot = el.classList.contains("spot") ? el : el.querySelector(".spot");
    const en = spot?.querySelector(".spot-en");
    const shownNow = !!spot && spot.classList.contains("is-tapped") && !!en && win.getComputedStyle(en).opacity === "1" && win.getComputedStyle(spot.querySelector(".spot-src")).opacity === "0";
    let off = 0;
    while (spot && spot.classList.contains("is-tapped") && performance.now() - t0 < 4000) await sleep(40);
    off = performance.now() - t0;
    up();
    t.event("tap-light", `${id}: a touch tap on ${label}: English shown ${shownNow}, gone after ${Math.round(off)} ms`);
    if (!shownNow) t.problem("bug", `${id}: a touch tap on ${label} didn't show its English`);
    if (off < 1700 || off > 2600) t.problem("bug", `${id}: a tap on ${label} lit its English for ${Math.round(off)} ms (about 2000)`);
  };
  await tapTest(doc.getElementById("spark-story"), "the story line");
  const firstChoice = doc.querySelector("#spark-choices .choice");
  if (firstChoice) await tapTest(firstChoice, "a choice");
  // Moving the torch once ends the pulse for good.
  const slot = doc.getElementById("torch-slot");
  doc.getElementById("spark").scrollIntoView?.({ block: "end", behavior: "instant" });
  const sr = slot.getBoundingClientRect();
  const sinit = { pointerType: "touch", pointerId: 53, isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true, composed: true, clientX: sr.left + sr.width / 2, clientY: sr.top + sr.height / 2, view: win };
  slot.dispatchEvent(new win.PointerEvent("pointerdown", sinit));
  await sleep(150);
  slot.dispatchEvent(new win.PointerEvent("pointerup", { ...sinit, buttons: 0 }));
  await sleep(200);
  const moved = win.localStorage.getItem("iltv.torch") === "moved" && !doc.body.classList.contains("torch-beckon");
  if (!moved) t.problem("bug", `${id}: moving the flashlight once didn't end the pulse (saved "${win.localStorage.getItem("iltv.torch")}")`);
  // Each page names its language for about 1.5 s where the location label is.
  await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready", 40000);
  const choice = doc.querySelector("#spark-choices .choice");
  if (choice) {
    await tapAt(t, choice, "the first choice");
    const t0 = performance.now();
    const flash = await waitFor(() => doc.querySelector("#spark-step .step-lang"), 1500);
    let gone = 0;
    if (flash) { await waitFor(() => !doc.querySelector("#spark-step .step-lang"), 4000); gone = performance.now() - t0; }
    const nowScene = win.finalSpark.scene();
    const want = story(id).scenes[nowScene]?.lang;
    const name = flash ? (flash.textContent || "").trim() : "";
    t.event("language-name", `${id}: ${nowScene} (${want}) shows "${name}" in the location label for ${Math.round(gone)} ms`);
    if (!flash) t.problem("bug", `${id}: the page doesn't show its language name where the location label is`);
    else if (!name || /^[\x00-\x7f]+$/.test(name) && want !== "en" && want !== "de" && want !== "es" && want !== "fr" && want !== "id" && want !== "it" && want !== "pt" && want !== "sw" && want !== "tr" && want !== "vi") t.problem("bug", `${id}: the language name "${name}" isn't the language's own`);
    if (flash && (gone < 1000 || gone > 2400)) t.problem("bug", `${id}: the language name stayed ${Math.round(gone)} ms (about 1500)`);
  }
  closeViewFrame();
  // A second visit: no sweep by itself.
  t.scene(`${id}: second visit, no sweep`);
  try { localStorage.setItem("iltv.torch", "swept"); } catch (e) { /* none */ }
  clearProgress();
  doc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
  win = doc.defaultView;
  try { win.localStorage.setItem("iltv.torch", "swept"); } catch (e) { /* none */ }
  await passPrompt(t, doc, `${id} (second visit)`);
  let again = false;
  const end2 = performance.now() + 14000;
  await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready", 40000);
  while (performance.now() < end2) {
    if (win.iltvTorch && win.iltvTorch.sweeping()) again = true;
    if (doc.querySelector("#spark-story.is-lit, #spark-question.is-lit, #spark-choices .choice.is-lit")) again = true;
    await sleep(80);
  }
  t.event("torch-second-visit", `${id}: second visit swept by itself: ${again}`);
  if (again) t.problem("bug", `${id}: the flashlight swept again on a second visit`);
  closeViewFrame();
  try { localStorage.setItem("iltv.torch", "moved"); } catch (e) { /* none */ }
}

async function languageRun(options, t) {
  // As a leg of smoke the viewer's progress is already kept: remembering again would keep the run's own instead.
  if (!savedRuns && savedCookie == null) rememberProgress();
  clearProgress();
  const id = options.story || FIRST;
  t.scene(`${id}: language picker at 390px`);
  const doc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
  const win = doc.defaultView;
  try { win.localStorage.removeItem("iltv.reading"); } catch (e) { /* none */ }
  await passPrompt(t, doc, `${id} (language)`);
  const sel = doc.getElementById("spark-lang");
  const box = doc.getElementById("spark-lang-box");
  if (!sel || !box || box.hidden) t.problem("bug", `${id}: no language picker at 390px`);
  else {
    sel.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(200);
    const r = sel.getBoundingClientRect();
    const hit = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const visible = r.width > 100 && r.height >= 43.5 && r.left >= 0 && r.right <= win.innerWidth + 1 && getComputedStyle(box).visibility !== "hidden";
    if (!visible) t.problem("bug", `${id}: the language picker is ${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)} (needs 44px tall and on screen)`);
    if (!hit || !(hit === sel || sel.contains(hit) || box.contains(hit))) t.problem("bug", `${id}: something covers the language picker`);
    t.event("language-picker", `${Math.round(r.width)}x${Math.round(r.height)}, options ${[...sel.options].map((o) => o.value).join("/")}, hit-tested ${!!hit}`);
  }
  t.progress(0.25);
  // One choice in, so the switch is mid-story.
  const choices = () => [...doc.querySelectorAll("#spark-choices .choice")];
  const ready = await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready", 40000);
  if (!ready) t.problem("bug", `${id}: the choices never came up`);
  else await tapAt(t, choices()[0], "the first choice");
  await waitFor(() => win.finalSpark && win.finalSpark.scene() !== story(id).start, 4000);
  await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready", 40000);
  const sceneBefore = win.finalSpark.scene();
  const depthBefore = win.finalSpark.depth();
  const srcBefore = doc.querySelector("#spark-video video:not(.spark-leave)")?.currentSrc || "";
  t.scene(`${id}: switching to English at ${sceneBefore}`);
  // A native select can't be opened by a synthetic press: set it and fire change, as the browser does on a pick.
  sel.value = "en";
  sel.dispatchEvent(new win.Event("change", { bubbles: true }));
  await sleep(500);
  const now = win.finalSpark.scene();
  if (now !== sceneBefore || win.finalSpark.depth() !== depthBefore) t.problem("bug", `${id}: switching language moved the story (${sceneBefore} -> ${now}, depth ${depthBefore} -> ${win.finalSpark.depth()})`);
  const srcAfter = doc.querySelector("#spark-video video:not(.spark-leave)")?.currentSrc || "";
  if (srcBefore && srcAfter !== srcBefore) t.problem("bug", `${id}: switching language reloaded the clip`);
  const sc = story(id).scenes[sceneBefore];
  const seen = (sel2) => (doc.querySelector(sel2)?.innerText || "").replace(/\s+/g, " ").trim();
  const want = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const checks = [
    ["story text", seen("#spark-story"), want(sc.story[1])],
    ["question", seen("#spark-question"), want(sc.question[1])],
  ];
  (sc.choices || []).forEach((c, i) => checks.push([`choice ${i + 1}`, seen(`#spark-choices .choice:nth-child(${i + 1})`).replace(/^\d+\.\s*/, ""), want(String(c.en || c[1]).replace(/^\d+\.\s*/, ""))]));
  for (const [name, got, exp] of checks) {
    if (exp && got !== exp) t.problem("bug", `${id}: after picking English the ${name} reads "${got}", not "${exp}"`);
  }
  const timer = seen("#spark-timer");
  if (timer && /[^\x00-\x7f]/.test(timer)) t.problem("bug", `${id}: the timer reads "${timer}" (not English)`);
  const chrome = [seen("#spark-stories"), seen("#tab-play"), seen("#tab-tree"), timer].join(" | ");
  if (/[^\x00-\x7f\u2190]/.test(chrome)) t.problem("bug", `${id}: buttons not in English: ${chrome}`);
  t.event("language-scene", `scene id before ${sceneBefore}, after ${now}: ${now === sceneBefore ? "same scene" : "CHANGED"}; reading ${win.localStorage.getItem("iltv.reading")}`);
  t.event("language-ui-sample", `story "${checks[0][1].slice(0, 60)}"; question "${checks[1][1].slice(0, 60)}"; buttons "${chrome}"`);
  t.event("language-switched", `${sceneBefore}, depth ${depthBefore}: scene kept, clip kept ${srcBefore === srcAfter}, texts ${checks.map((c) => c[1] === c[2]).join("/")}; chrome "${chrome}"`);
  if (win.localStorage.getItem("iltv.reading") !== "en") t.problem("bug", `${id}: the picked language wasn't saved`);
  // The Tree and its words follow too.
  await tapAt(t, doc.getElementById("tab-tree"), "Tree");
  await sleep(300);
  const treeSrc = [...doc.querySelectorAll("#spark-tree .spot-src")].filter((e) => e.offsetParent !== null);
  if (treeSrc.length) t.problem("bug", `${id}: the Tree still shows ${treeSrc.length} words in the page's own language after picking English`);
  await tapAt(t, doc.getElementById("tab-play"), "Play");
  try { win.localStorage.removeItem("iltv.reading"); } catch (e) { /* none */ }
  t.progress(0.5);
  await torchSweepLeg(t, id);
  t.progress(0.7);
  // Studio notes titles: English on /notes/, each with a language chip (posts moved off the home page).
  t.scene("Studio notes titles");
  const home = await viewFrameLoad(t, "/", 390, 844);
  await waitFor(() => { const sp = home.getElementById("title-splash"); return !sp || sp.hidden || home.defaultView.getComputedStyle(sp).display === "none" || +home.defaultView.getComputedStyle(sp).opacity === 0; }, 6000);
  if (home.querySelector("#blog .post-card, main .post-card")) t.problem("bug", "the home page still lists blog posts at 390x844");
  const notesLink = home.querySelector('footer a[href="/notes/"], footer a[href="/notes"]');
  if (!notesLink) t.problem("bug", "the footer has no Studio notes link at 390x844");
  closeViewFrame();
  const notes = await frameLoad(t, (f) => (f.src = "/notes/"));
  const rows = notes ? [...notes.querySelectorAll(".notes-list a")] : [];
  if (!rows.length) t.problem("bug", "Studio notes has no posts");
  t.event("notes-list", `/notes/ at 390x844: ${rows.length} posts`);
  for (const row of rows) {
    const title = (row.querySelector("h2")?.textContent || "").replace(/\s+/g, " ").trim();
    const chip = (row.querySelector(".lang-chip")?.textContent || "").trim();
    if (!title || /[^\x00-\x7f\u2019]/.test(title)) t.problem("bug", `Studio notes title "${title}" is not English alone`);
    else if (!chip) t.problem("bug", `Studio notes "${title}" has no language chip`);
    else t.event("notes-title", `${row.getAttribute("href")}: "${title}" (${chip})`);
  }
  t.metric("blogTitles", rows.length);
  closeFrame();
  t.progress(1);
}

async function phoneChoicesRun(options, t) {
  const inSmoke = options && options.at === "smoke";
  if (!savedRuns && savedCookie == null) rememberProgress();
  clearProgress();
  const lum = (css) => { const m = (css || "").match(/[\d.]+/g) || []; return 0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]; };
  const ids = options && options.story ? [options.story] : ["final-spark", "water-road", "night-shift"];
  const sizes = [[390, 844, "390x844"], [844, 390, "844x390"], [1280, 720, "1280x720"]];
  const totalSteps = ids.length * sizes.length;
  try {
    let step = 0;
    for (const id of ids) {
      const st = story(id);
      const console_ = st.type === "console";
      for (const [w, h, sizeTag] of sizes) {
        step += 1;
        clearProgress();
        t.scene(`${id}: choices at ${sizeTag}`);
        if (console_) consoleSeedWrite(st, [], null); // setup shortcut: the first scene's lines already heard
        const doc = await viewFrameLoad(t, `/?story=${id}`, w, h);
        const win = doc.defaultView;
        const bad = [];
        if (console_) {
          await consolePrompt(t, doc, `${id} (${sizeTag})`);
          t.event("seeded-run", `${id} (${sizeTag}): first scene's lines counted as heard (setup shortcut)`);
          if (!(await waitFor(() => doc.querySelectorAll("#console-choices .choice").length > 0, 15000))) throw new Error(`${id} at ${sizeTag}: no choices at the first scene`);
        } else {
          await passPrompt(t, doc, `${id} (${sizeTag})`);
          const box = doc.getElementById("spark-choices");
          const v = () => doc.querySelector("#spark-video video:not(.spark-leave)");
          // Criterion 3: while the clip still plays, choices show an "up next" preview state (soft glow, thin progress line,
          // bright text, never greyed-out disabled text).
          await waitFor(() => v() && !v().paused && v().currentTime > 0.15, 6000);
          if (box.dataset.phase === "waiting") {
            await sleep(250);
            const early = [...box.querySelectorAll(".choice")];
            const tb = doc.getElementById("spark-timer");
            const cueLabel = (tb.querySelector(".choice-timer-label")?.textContent || "").trim();
            const cueOn = !tb.hidden && win.getComputedStyle(tb).visibility !== "hidden" && tb.dataset.state === "waiting";
            const dim = early.filter((b) => +win.getComputedStyle(b).opacity < 0.99 || lum(win.getComputedStyle(b).color) < 215);
            const glow = early.every((b) => win.getComputedStyle(b).boxShadow && win.getComputedStyle(b).boxShadow !== "none");
            const lineH = early[0] ? parseFloat(win.getComputedStyle(early[0], "::before").height) : 0;
            t.event("waiting-choices", `${id} ${sizeTag}: ${early.length} choice(s) while clip plays, ${dim.length} dim, cue "${cueLabel}" shown ${cueOn}, glow ${glow}, progress line ${lineH}px`);
            if (w === 390 && h === 844) t.event("screenshot", `${id} ${sizeTag}: up next preview state while clip plays`);
            if (dim.length) bad.push(`${dim.length} choice(s) look disabled while the clip plays (opacity ${win.getComputedStyle(dim[0]).opacity}, color ${win.getComputedStyle(dim[0]).color})`);
            if (early.length && !cueOn) bad.push(`no "Up next" preview cue while the clip plays (label "${cueLabel}", state ${tb.dataset.state})`);
            if (early.length && !/Up next/i.test(cueLabel)) bad.push(`preview cue says "${cueLabel}", not "Up next"`);
            if (early.length && (!glow || lineH < 1.5)) bad.push(`preview state missing soft glow (${glow}) or thin progress line (${lineH}px)`);
            // After verifying the preview state, seek near the end of the clip so the natural ended event triggers
            // revealChoices without waiting 30 s three times per story.
            const vid = v();
            if (vid && vid.duration > 0.5 && isFinite(vid.duration)) {
              vid.currentTime = Math.max(0, vid.duration - 0.12);
            } else if (vid) {
              vid.dispatchEvent(new win.Event("ended"));
            }
          }
          if (!(await waitFor(() => box.dataset.phase === "ready", Math.max(20000, ((v() && v().duration) || 30) * 1000 + 10000)))) throw new Error(`${id} at ${sizeTag}: the choices never came up`);
        }
        const sel = console_ ? "#console-choices .choice" : "#spark-choices .choice";
        const btns = [...doc.querySelectorAll(sel)];
        if (!btns.length) throw new Error(`${id} at ${sizeTag}: no choices on screen`);
        // Criterion 2: choices slide and fade in one after another (60 to 80 ms apart) when they become active.
        const delays = btns.map((b) => {
          const d = win.getComputedStyle(b).animationDelay || "0s";
          return d.endsWith("ms") ? parseFloat(d) : parseFloat(d) * 1000;
        });
        const animNames = btns.map((b) => win.getComputedStyle(b).animationName || "");
        const stepMs = delays.length > 1 ? Math.round(delays[1] - delays[0]) : 70;
        t.event("choice-stagger", `${id} ${sizeTag}: animation ${animNames[0]}, delays [${delays.map((d) => Math.round(d) + "ms").join(", ")}] (${stepMs}ms apart)`);
        if (!animNames.every((n) => n.includes("choice-in"))) bad.push(`active choices don't use choice-in animation (${animNames.join(", ")})`);
        if (delays.length > 1 && (stepMs < 60 || stepMs > 80)) bad.push(`stagger delay is ${stepMs}ms apart, not 60 to 80 ms`);
        const timerEl = !console_ ? doc.getElementById("spark-timer") : null;
        const timerBar = timerEl ? timerEl.querySelector(".choice-timer-bar") : null;
        const timerTrack = timerEl ? timerEl.querySelector(".choice-timer-track") : null;
        const scaleOf = () => {
          if (!timerBar) return 1;
          const m = (win.getComputedStyle(timerBar).transform || "").match(/matrix\(([-\d.e]+)/);
          return m ? parseFloat(m[1]) : 1;
        };
        const labOf = () => (timerEl?.querySelector(".choice-timer-label")?.textContent || "").trim();
        if (!console_) await new Promise((r) => win.requestAnimationFrame(() => win.requestAnimationFrame(r)));
        const s1 = !console_ ? scaleOf() : 1;
        const lab1 = !console_ ? labOf() : "";
        await sleep(!console_ ? 1100 : 650); // let staggered slide/fade-in finish and timer drain 1s
        const wrap = btns[0].parentElement.getBoundingClientRect();
        const ctl = [".spark-unmute", ".spark-fullscreen"].map((q) => doc.querySelector(q)).filter((e) => e && !e.hidden && win.getComputedStyle(e).display !== "none").map((e) => e.getBoundingClientRect());
        for (const b of btns) {
          const r = b.getBoundingClientRect();
          const cs = win.getComputedStyle(b);
          const label = (b.textContent || "").trim().slice(0, 40);
          const cut = b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 || r.left < -1 || r.right > win.innerWidth + 1;
          const offVert = (w === 390 || w === 844) && (r.top < -1 || r.bottom > win.innerHeight + 1);
          const over = ctl.some((c) => r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top);
          const bw = parseFloat(cs.borderTopWidth);
          const txt = lum(cs.color);
          const edge = lum(cs.borderTopColor);
          t.event("choice-button", `${id} ${sizeTag}: "${label}" ${Math.round(r.width)}x${Math.round(r.height)} at y=${Math.round(r.top)}..${Math.round(r.bottom)} (column ${Math.round(wrap.width)}), text luminance ${Math.round(txt)}, border ${bw}px luminance ${Math.round(edge)}, cut ${cut}, offVert ${offVert}, over video controls ${over}`);
          if (r.height < 47.5) bad.push(`"${label}" is ${Math.round(r.height)}px tall (under 48px)`);
          if (r.width < wrap.width - 1) bad.push(`"${label}" is ${Math.round(r.width)}px wide in a ${Math.round(wrap.width)}px column`);
          if (cut) bad.push(`"${label}" is cut off`);
          if (offVert) bad.push(`"${label}" is not fully visible vertically (${Math.round(r.top)}..${Math.round(r.bottom)} of ${win.innerHeight})`);
          if (over) bad.push(`"${label}" overlaps the video controls`);
          if (+cs.opacity < 0.99) bad.push(`"${label}" is faded (opacity ${cs.opacity})`);
          if (txt < 215) bad.push(`"${label}" text is dim (luminance ${Math.round(txt)})`);
          if (bw < 1 || edge < 150) bad.push(`"${label}" has no visible border (${bw}px, luminance ${Math.round(edge)})`);
        }
        if (!console_) {
          const timer = timerEl;
          const tr = timer.getBoundingClientRect();
          const trackR = timerTrack.getBoundingClientRect();
          const lab = labOf();
          const s2 = scaleOf();
          const shown = !timer.hidden && win.getComputedStyle(timer).visibility !== "hidden" && tr.height > 4 && trackR.width > 40 && trackR.height >= 3;
          const above = tr.bottom <= btns[0].getBoundingClientRect().top + 1;
          const draining = s2 < s1 - 0.02 && s1 <= 1 && s2 > 0;
          t.event("timer", `${id} ${sizeTag}: "${lab1}" -> "${lab}", bar scaleX ${s1.toFixed(2)} -> ${s2.toFixed(2)}, track ${Math.round(trackR.width)}x${Math.round(trackR.height)}px, shown ${shown}, draining ${draining}, above the first choice ${above}`);
          if (!shown) bad.push("the timer isn't visible");
          if (!above) bad.push("the timer isn't above the choices");
          if (!draining) bad.push(`the timer bar isn't draining (${s1.toFixed(2)} -> ${s2.toFixed(2)})`);
          if (!/^(Choose in \d+ s|Choosing\.\.\.)$/.test(lab)) bad.push(`the timer says "${lab}", not "Choose in N s"`);
        } else {
          const cue = win.getComputedStyle(doc.getElementById("console-choices"), "::before").content;
          const noTimer = !doc.querySelector("#console .choice-timer");
          t.event("cue", `${id} ${sizeTag}: choices cue ${cue}, untimed by design (no timer bar: ${noTimer})`);
          if (!/Your move/.test(cue)) bad.push("no cue above the choices");
          if (!noTimer) bad.push("Night Shift showed a timer bar (its choices are untimed by design)");
        }
        if (doc.documentElement.scrollWidth > win.innerWidth + 1) bad.push("the page scrolls sideways");
        t.event("screenshot", `${id} ${sizeTag}: active choices (${btns.length} cards)`);
        const checkTimeout = !console_ && (w === 390 || w === 1280) && (!inSmoke || id === "final-spark");
        if (checkTimeout) {
          const sceneBefore = win.finalSpark.scene();
          const gotUrgent = await waitFor(() => timerEl.dataset.urgent === "true", 15000);
          const urgentLab = labOf();
          const barCs = win.getComputedStyle(timerBar);
          const trackCs = win.getComputedStyle(timerTrack);
          const pulseAnim = `${barCs.animationName || ""},${trackCs.animationName || ""}`;
          const pulsing = gotUrgent && pulseAnim.includes("choice-timer-pulse");
          t.event("timer-urgent-pulse", `${id} ${sizeTag}: "${urgentLab}", urgent=${timerEl.dataset.urgent}, pulse=${pulsing} (${pulseAnim}), scaleX=${scaleOf().toFixed(2)}`);
          t.event("screenshot", `${id} ${sizeTag}: timer bar pulsing warmer in last 3 s (${urgentLab})`);
          if (!pulsing) bad.push(`in the last 3 s the timer bar did not pulse (urgent=${timerEl.dataset.urgent}, anim=${pulseAnim})`);
          const gotDone = await waitFor(() => timerEl.dataset.state === "done", 5000);
          const defBtn = doc.querySelector("#spark-choices .choice.is-default-pick");
          const defText = (defBtn?.textContent || "").trim().slice(0, 40);
          const heldAtScene = win.finalSpark.scene() === sceneBefore;
          t.event("timer-default-highlight", `${id} ${sizeTag}: label "${labOf()}", default choice "${defText}" highlighted=${!!defBtn}, held before playing=${heldAtScene}`);
          t.event("screenshot", `${id} ${sizeTag}: default choice highlighted before playing`);
          if (!gotDone || !defBtn || !heldAtScene) bad.push(`when time ran out the default choice was not highlighted before playing (done=${gotDone}, defaultPick=${!!defBtn}, held=${heldAtScene})`);
          const played = await waitFor(() => win.finalSpark.scene() !== sceneBefore, 3000);
          t.event("timer-default-played", `${id} ${sizeTag}: default choice played (${sceneBefore} -> ${win.finalSpark.scene()})`);
          if (!played) bad.push(`the default choice did not play after being highlighted (still at ${win.finalSpark.scene()})`);
        } else if (w === 390 && h === 844) {
          await tapAt(t, btns[0], `the first choice (${id})`);
          await sleep(400);
        }
        for (const b of bad) t.problem("bug", `${id} at ${sizeTag}: ${b}`);
        t.event("phone-choices", `${id} ${sizeTag}: ${btns.length} choice(s) checked, ${bad.length} problem(s)`);
        closeViewFrame();
        t.progress(step / totalSteps);
      }
    }
  } finally {
    closeViewFrame();
    if (!inSmoke) restoreProgress();
  }
}

/** Phone player: the first clip plays after one tap, a loading ring shows while a clip buffers, and turned on its side
    the clip fills the screen, keeps playing and the choices stay visible. A frame at 390x844 turned to 844x390. */
async function phonePlayerRun(options, t) {
  rememberProgress();
  clearProgress();
  const id = options.story || FIRST;
  const st = story(id);
  t.scene(`${id}: phone upright`);
  const doc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
  const win = doc.defaultView;
  const loadingLog = [];
  doc.addEventListener("iltv:loading", (e) => { loadingLog.push(e.detail.on); t.event("loading", `${e.detail.scene}: ${e.detail.on ? "ring on" : "ring off"}`); });
  t.progress(0.1);
  // 1. One tap on Tap to play and the first clip plays.
  // The time from the press on Tap to play to the clip playing: the press and the media's own `playing` event are
  // caught as they happen (no polling).
  let tappedAt = 0, playingAt = 0;
  doc.addEventListener("click", () => { if (!tappedAt) tappedAt = win.performance.now(); }, true);
  doc.addEventListener("playing", (e) => { if (tappedAt && !playingAt && e.target.closest && e.target.closest("#spark-video")) playingAt = win.performance.now(); }, true);
  await passPrompt(t, doc, `${id} (phone)`);
  const video = () => doc.querySelector("#spark-video video:not(.spark-leave)");
  const ok = await waitFor(() => video() && !video().paused && video().currentTime > 0.3, 8000);
  if (!ok) t.problem("bug", `${id}: after one tap the first clip isn't playing (paused ${video() && video().paused}, ${video() && video().currentTime}s)`);
  else {
    t.event("first-clip-playing", `after one tap: ${video().currentTime.toFixed(1)}s, muted ${video().muted}, playsinline ${video().hasAttribute("playsinline")}`);
    if (!playingAt && !video().paused) playingAt = win.performance.now(); // it was already playing before the listener could hear it
    const ms = Math.max(0, Math.round(playingAt - tappedAt));
    t.metric("phoneTapToPlayMs", ms);
    t.event("tap-to-playing", `${win.innerWidth}x${win.innerHeight}: ${ms} ms from the press on Tap to play to the first clip playing`);
    if (ms > 3000) t.problem("bug", `${id}: the first clip took ${ms} ms to play after one tap (over 3 s)`);
  }
  if (video() && !video().hasAttribute("playsinline")) t.problem("bug", `${id}: the clip has no playsinline (iPhone would take it full screen)`);
  t.progress(0.3);
  // Controls over the clip: Full screen (44px), Tap for sound when it plays muted.
  const full = doc.querySelector(".spark-fullscreen");
  if (!full) t.problem("bug", `${id}: no Full screen button on the clip`);
  else {
    const r = full.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) t.problem("bug", `${id}: the Full screen button is ${Math.round(r.width)}x${Math.round(r.height)}, under 44px`);
    t.event("fullscreen-button", `${Math.round(r.width)}x${Math.round(r.height)}, element fullscreen ${!!(doc.documentElement.requestFullscreen || doc.documentElement.webkitRequestFullscreen)}, video fullscreen ${!!(video() && video().webkitEnterFullscreen)}`);
  }
  // The choices are on screen (waiting, dimmed) beside / below the clip.
  const inView = (els) => els.length && els.every((b) => { const r = b.getBoundingClientRect(); return r.bottom <= win.innerHeight + 1 && r.top >= -1 && r.right <= win.innerWidth + 1; });
  const choices = () => [...doc.querySelectorAll("#spark-choices .choice")];
  t.event("choices", `upright: ${choices().length} choices, all on screen: ${inView(choices())}`);
  // The first frame fills the phone: the clip spans the full width, the choices sit in the bottom third (390x844, touch).
  stageFill(t, doc, id, "390x844");
  // The next clips are fetched while this one plays.
  // (at phone size the player asks for each clip's smaller rendition: scene.small)
  const next = Object.values(st.scenes[st.start].choices || []).map((c) => st.scenes[c.next] && [st.scenes[c.next].video, st.scenes[c.next].small]).filter((p) => p && p[0]);
  const wasAsked = (p) => win.performance.getEntriesByType("resource").some((e) => p.some((v) => v && e.name.includes(v)));
  await waitFor(() => next.every(wasAsked), 6000);
  const fetched = next.filter(wasAsked);
  t.event("preload", `${fetched.length} of ${next.length} next clips requested while the first plays`);
  if (next.length && !fetched.length) t.problem("bug", `${id}: the next clips weren't preloaded`);
  t.progress(0.45);
  // 2. A loading ring while a clip buffers: the next clip starts from nothing (loadstart) and the ring comes and goes.
  // Skip to the end of the first clip is not a viewer's move; the choices come when it ends, so wait for them (the clip is short).
  const ready = await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready", Math.max(15000, ((video() && video().duration) || 20) * 1000 + 8000));
  if (!ready) t.problem("bug", `${id}: the choices never came up`);
  else {
    await tapAt(t, choices()[0], "the first choice");
    await waitFor(() => loadingLog.includes(true) && loadingLog[loadingLog.length - 1] === false, 6000);
    if (!loadingLog.includes(true)) t.problem("bug", `${id}: no loading indicator while the next clip buffered`);
    else if (loadingLog[loadingLog.length - 1] !== false) t.problem("bug", `${id}: the loading indicator never went away`);
    else t.event("loading-ring", `shown and cleared (${loadingLog.join(", ")})`);
  }
  const playing2 = await waitFor(() => video() && !video().paused && video().currentTime > 0.2, 8000);
  if (!playing2) t.problem("bug", `${id}: the second clip isn't playing`);
  t.progress(0.6);
  // 3. Turn the phone: the frame becomes 844x390 while the clip plays.
  t.scene(`${id}: phone on its side`);
  const f = viewFrame;
  const before = video().currentTime;
  f.style.width = "844px";
  f.style.height = "390px";
  f.style.transform = `scale(${Math.min(1, innerWidth / 844, innerHeight / 390)})`;
  win.dispatchEvent(new win.Event("orientationchange"));
  await sleep(1200);
  const v = video();
  const turned = win.matchMedia("(orientation: landscape)").matches;
  if (!turned) t.problem("bug", "the frame didn't turn landscape");
  const moved = v.currentTime > before || v.ended;
  if (v.paused && !v.ended) t.problem("bug", `${id}: the clip stopped when the phone turned`);
  else if (!moved) t.problem("bug", `${id}: the clip froze after turning (${before.toFixed(2)}s -> ${v.currentTime.toFixed(2)}s)`);
  const box = doc.getElementById("spark-video").getBoundingClientRect();
  const fill = box.height / win.innerHeight;
  const fillW = box.width / win.innerWidth;
  // The picture inside the video box (object-fit: contain keeps the clip's own shape, 9:16, so it is centred with black either side).
  const ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 9 / 16;
  const picH = Math.min(box.height, box.width / ar);
  const picW = picH * ar;
  const picLeft = box.left + (box.width - picW) / 2;
  const picRight = picLeft + picW;
  t.metric("landscapeVideoFill", Math.round(fill * 100) / 100);
  t.metric("landscapePictureFill", Math.round((picH / win.innerHeight) * 100) / 100);
  t.event("video-box", `viewport ${win.innerWidth}x${win.innerHeight}; video box ${Math.round(box.width)}x${Math.round(box.height)} at ${Math.round(box.left)},${Math.round(box.top)}; picture ${Math.round(picW)}x${Math.round(picH)} centred at x=${Math.round(picLeft + picW / 2)} (screen centre ${Math.round(win.innerWidth / 2)}); height ${Math.round((picH / win.innerHeight) * 100)}% of the screen`);
  if (Math.abs(picLeft + picW / 2 - win.innerWidth / 2) > 2) t.problem("bug", `${id}: in landscape the picture isn't centred (centre ${Math.round(picLeft + picW / 2)}, screen ${Math.round(win.innerWidth / 2)})`);
  t.event("landscape", `${win.innerWidth}x${win.innerHeight}: the video fills ${Math.round(fillW * 100)}% of the width and ${Math.round(fill * 100)}% of the height (${Math.round(box.width)}x${Math.round(box.height)}); its picture is ${Math.round(picW)}x${Math.round(picH)}, ${Math.round((picH / win.innerHeight) * 100)}% of the screen's height, playing ${!v.paused}`);
  if (fill < 0.95 || fillW < 0.95) t.problem("bug", `${id}: in landscape the video fills ${Math.round(fillW * 100)}% of the width and ${Math.round(fill * 100)}% of the height of the screen`);
  if (picH / win.innerHeight < 0.9) t.problem("bug", `${id}: in landscape the picture is ${Math.round((picH / win.innerHeight) * 100)}% of the screen's height`);
  const cs = choices();
  const first = cs[0] && cs[0].getBoundingClientRect();
  if (!cs.length || !first || first.bottom > win.innerHeight + 1 || first.right > win.innerWidth + 1 || first.top < 0) t.problem("bug", `${id}: in landscape the choices aren't on screen`);
  else {
    t.event("choices", `landscape: first choice at ${Math.round(first.left)},${Math.round(first.top)} ${Math.round(first.width)}x${Math.round(first.height)}, ${cs.length} choices, over the picture: ${cs.some((c) => { const r = c.getBoundingClientRect(); return r.left < picRight - 1 && r.right > picLeft + 1; })}`);
    t.event("choice-positions", cs.map((c, i) => { const r = c.getBoundingClientRect(); return `#${i + 1} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; }).join("; "));
    // Each choice is what a thumb reaches: visible, hit-tested (nothing lies over it) and not covering the picture.
    for (const c of cs) {
      const r = c.getBoundingClientRect();
      if (r.left < picRight - 1 && r.right > picLeft + 1) t.problem("bug", `${id}: in landscape a choice covers the picture (${Math.round(r.left)}-${Math.round(r.right)} over ${Math.round(picLeft)}-${Math.round(picRight)})`);
      if (r.bottom > win.innerHeight + 1) continue; // below the panel's own scroll: reachable by scrolling it
      const hit = doc.elementFromPoint(Math.min(r.right - 2, Math.max(r.left + 2, r.left + r.width / 2)), Math.min(r.bottom - 2, Math.max(r.top + 2, r.top + r.height / 2)));
      if (hit && !c.contains(hit)) t.problem("bug", `${id}: in landscape something lies over a choice (${hit.id || hit.className || hit.tagName})`);
    }
  }
  for (const sel of [".spark-fullscreen", ".spark-bar", ".spark-tab"]) {
    const el = doc.querySelector(sel);
    const r = el && el.getBoundingClientRect();
    if (r && r.width && (r.left < picRight - 1 && r.right > picLeft + 1) && r.top < win.innerHeight) t.problem("bug", `${id}: in landscape ${sel} sits over the picture`);
  }
  if (doc.documentElement.scrollWidth > win.innerWidth + 1) t.problem("bug", `${id}: landscape scrolls sideways`);
  stageFill(t, doc, id, "844x390");
  {
    // And the desktop frame: the clip at least 60% of the height over its blurred copy.
    const ddoc = await viewFrameLoad(t, `/?story=${id}`, 1280, 720);
    await passPrompt(t, ddoc, `${id} (1280x720)`);
    await waitFor(() => { const dv = ddoc.querySelector("#spark-video video:not(.spark-leave)"); return dv && !dv.paused && dv.currentTime > 0.5; }, 8000);
    await sleep(600);
    stageFill(t, ddoc, id, "1280x720");
  }
  t.progress(1);
  closeViewFrame();
  restoreProgress();
}

/** Posters and the phone rendition (J: 'a poster for every card and clip, a smaller clip for phones'). A phone frame
    (390x844) loads the landing page: content shows within 2 s, the hero's picture loads first and the cards below the
    fold are lazy, every card has a picture. Then each clip story is opened by its link: the clip's poster is on the
    video (and loads) before the clip does, and after Tap to play the player has requested the smaller rendition and
    not the full clip. A desktop frame (1280x800) must still play the full clip. */
/** The Water Road's picture never snaps back and keeps moving under the choices (J, 2026-11-11): from the tap on Tap to play until the
 *  choices are up the clip's currentTime must never jump backward (`loopRestarts`, fails above 0); then, for 3 s with the choices
 *  up, the video isn't paused, its currentTime advances at least 2 s and two frames 1 s apart differ (the picture is moving). */
async function livePictureCheck(t, doc, id, label) {
  const win = doc.defaultView;
  const video = () => doc.querySelector("#spark-video video:not(.spark-leave)");
  const boxPhase = () => (doc.getElementById("spark-choices") || {}).dataset?.phase;
  let restarts = 0;
  let last = -1;
  let v = video();
  const t0 = performance.now();
  while (performance.now() - t0 < 70000) {
    v = video();
    if (v && !v.seeking) {
      if (last >= 0 && v.currentTime < last - 0.5 && !v.ended) { restarts++; t.event("loop-restart", `${id} (${label}): currentTime jumped back from ${last.toFixed(2)} s to ${v.currentTime.toFixed(2)} s`); }
      last = v.currentTime;
    }
    if (boxPhase() === "ready" && [...doc.querySelectorAll("#spark-choices .choice")].length) break;
    await sleep(100);
  }
  v = video();
  if (!v || boxPhase() !== "ready") return t.problem("bug", `${id} (${label}): the choices never came up within 70 s`);
  const probe = () => {
    const c = doc.createElement("canvas");
    c.width = 32; c.height = 56;
    const g = c.getContext("2d");
    g.drawImage(v, 0, 0, 32, 56);
    return g.getImageData(0, 0, 32, 56).data;
  };
  const wasPaused = v.paused;
  const from = v.currentTime;
  const a = probe();
  let paused = wasPaused;
  await sleep(1000);
  const b = probe();
  for (let i = 0; i < 20; i++) {
    await sleep(100);
    v = video();
    if (v.paused) paused = true;
    if (v.currentTime < last - 0.5 && !v.ended) { restarts++; t.event("loop-restart", `${id} (${label}): currentTime jumped back during the choices`); }
    last = v.currentTime;
  }
  const advanced = v.currentTime - from;
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  diff /= (a.length / 4) * 3;
  t.metric(`loopRestarts.${id}.${label}`, restarts);
  t.event("live-picture", `${id} (${label}): loopRestarts ${restarts}; choices up: paused ${paused}, currentTime +${advanced.toFixed(2)} s over 3 s, frames 1 s apart differ by ${diff.toFixed(1)}/255`);
  if (restarts > 0) t.problem("bug", `${id} (${label}): the picture snapped back ${restarts} time(s) (loopRestarts must be 0)`);
  if (paused) t.problem("bug", `${id} (${label}): the video is paused while the choices are up`);
  if (advanced < 2) t.problem("bug", `${id} (${label}): the video advanced only ${advanced.toFixed(2)} s during a 3 s choice window (want 2 s or more)`);
  if (diff < 0.5) t.problem("bug", `${id} (${label}): the picture isn't moving under the choices (frames 1 s apart differ by ${diff.toFixed(2)})`);
}

async function phoneMediaRun(options, t) {
  rememberProgress();
  clearProgress();
  const fetchedBy = (win, url) => win.performance.getEntriesByType("resource").filter((e) => e.name.endsWith(url));
  t.scene("Landing page at phone size");
  let doc = await viewFrameLoad(t, "/", 390, 844);
  let win = doc.defaultView;
  const paint = win.performance.getEntriesByName("first-contentful-paint")[0];
  const nav = win.performance.getEntriesByType("navigation")[0];
  const shown = paint ? paint.startTime : nav ? nav.domContentLoadedEventEnd : 0;
  t.metric("phoneFirstContentMs", Math.round(shown));
  t.event("first-content", `390x844: first content at ${Math.round(shown)} ms (DOMContentLoaded ${nav ? Math.round(nav.domContentLoadedEventEnd) : "?"} ms, load ${nav ? Math.round(nav.loadEventEnd) : "?"} ms)`);
  if (!shown || shown > 2000) t.problem("bug", `the landing page's first content shows at ${Math.round(shown)} ms on a phone (limit 2000 ms)`);
  // The splash is content too, so first-contentful-paint passes while a viewer sees only the title: the stories count as
  // shown when a card is in the viewport and no splash (or one faded to nothing) lies over it.
  const landingShownAt = () => {
    const card = doc.querySelector(".story-card");
    const sp = doc.getElementById("title-splash");
    if (!card || (sp && parseFloat(win.getComputedStyle(sp).opacity) > 0.05)) return 0;
    const r = card.getBoundingClientRect();
    const cs = win.getComputedStyle(card);
    return r.width > 0 && r.top < win.innerHeight && r.bottom > 0 && cs.visibility !== "hidden" && !doc.documentElement.classList.contains("is-splash-pending") ? Math.round(win.performance.now()) : 0;
  };
  const visibleAt = await new Promise((resolve) => { const tick = () => { const n = landingShownAt(); if (n) resolve(n); else if (win.performance.now() > 8000) resolve(0); else setTimeout(tick, 25); }; tick(); });
  t.metric("landingVisibleMs", visibleAt);
  t.event("landing-visible", `390x844: the first story card is in view with no splash over it at ${visibleAt} ms after load`);
  if (!visibleAt || visibleAt > 2000) t.problem("bug", `the landing page's story cards aren't visible until ${visibleAt || "after 8000"} ms on a phone (limit 2000 ms)`);
  const imgs = [...doc.querySelectorAll(".story-card img, .hero img")];
  if (!imgs.length) t.problem("bug", "no picture on the landing page's cards");
  const cards = [...doc.querySelectorAll(".story-card")];
  const heroTile = doc.querySelector("a.hero");
  const listed = stories().listed();
  const tileCount = cards.length + (heroTile ? 1 : 0);
  if (tileCount !== listed.length) t.problem("bug", `${tileCount} tiles (hero + catalogue) for ${listed.length} listed stories`);
  if (heroTile && cards.some((c) => c.dataset.story === heroTile.dataset.story)) t.problem("bug", `featured ${heroTile.dataset.story} is repeated in the catalogue`);
  for (const card of cards) {
    const img = card.querySelector("img");
    const video = card.querySelector("video");
    if (img) {
      const lazy = img.loading === "lazy";
      const r = img.getBoundingClientRect();
      const below = r.top > win.innerHeight;
      if (below && !lazy) t.problem("bug", `${card.dataset.story}: the card's picture is below the fold and isn't lazy-loaded`);
      const typed = (img.currentSrc || img.src).endsWith(".webp");
      t.event("card-picture", `${card.dataset.story}: ${(img.currentSrc || img.src).split("/").pop()}, ${below ? "below the fold" : "in view"}, loading=${img.loading || "eager"}, ${typed ? "webp" : "jpg"}${img.complete && img.naturalWidth ? ", loaded" : ", not loaded yet"}`);
      if (!below && !(await waitFor(() => img.complete && img.naturalWidth > 0, 4000))) t.problem("bug", `${card.dataset.story}: the card's picture in view didn't load`);
    } else if (video) {
      if (!video.getAttribute("poster")) t.problem("bug", `${card.dataset.story}: the card shows a video with no poster`);
      if (video.preload === "auto") t.problem("bug", `${card.dataset.story}: the card's video preloads the clip`);
    } else t.problem("bug", `${card.dataset.story}: the card has no picture and no poster`);
  }
  // Scroll down the cards, a beat on each, so the footage shows every card's poster (the lazy ones load as they come near).
  for (const card of cards) {
    card.scrollIntoView({ block: "center", behavior: "instant" });
    const img = card.querySelector("img");
    const ok = img ? await waitFor(() => img.complete && img.naturalWidth > 0, 4000) : !!card.querySelector("video[poster]");
    t.event("card-poster-seen", `${card.dataset.story}: scrolled into view, poster ${ok ? "shown" : "NOT shown"}`);
    if (!ok) t.problem("bug", `${card.dataset.story}: the card's poster didn't show once scrolled into view`);
    await sleep(500);
  }
  doc.defaultView.scrollTo(0, 0);
  const heroImg = doc.querySelector(".hero img");
  if (heroImg && heroImg.loading === "lazy") t.problem("bug", "the hero's picture (the first thing seen) is lazy-loaded");
  t.progress(0.2);

  const ids = options.story ? [options.story] : stories().listed();
  let k = 0;
  for (const id of ids) {
    const st = story(id);
    const first = st.scenes[st.start];
    if (!first.video) {
      // A console story has no clip: its card picture is behind its Tap to play.
      if (st.type === "console" && st.image) {
        t.scene(`${id}: prompt picture`);
        closeViewFrame();
        clearProgress();
        const cdoc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
        let shown = "";
        await waitFor(() => { const p = cdoc.querySelector(".tap-to-play[data-poster]"); shown = (p && p.getAttribute("data-poster")) || ""; return shown; }, 6000);
        t.event("poster-visible", `${id}: Tap to play shows ${shown || "NO picture"}`);
        if (!shown || !shown.endsWith(st.image.replace(/\.jpg$/, ".webp"))) t.problem("bug", `${id}: the Tap to play prompt doesn't show the story's picture (${shown || "none"})`);
        else t.add("postersShown");
        await sleep(1500);
      }
      continue;
    }
    for (const [w, h, label] of [[390, 844, "phone"], [1280, 800, "desktop"]]) {
      t.scene(`${id}: ${label} ${w}x${h}`);
      closeViewFrame();
      clearProgress();
      doc = await viewFrameLoad(t, `/?story=${id}`, w, h);
      win = doc.defaultView;
      const video = () => doc.querySelector("#spark-video video:not(.spark-leave)");
      if (!(await waitFor(() => video(), 6000))) { t.problem("bug", `${id} (${label}): no video in the player`); continue; }
      // 1. The poster is on the clip before it has loaded anything, and it loads.
      const poster = video().getAttribute("poster");
      if (!first.poster) t.problem("bug", `${id}: the first scene has no poster in the data (run node tools/make-posters.mjs, then npm run story)`);
      else if (!poster || !poster.endsWith(first.poster)) t.problem("bug", `${id} (${label}): the clip's poster is ${poster}, not ${first.poster}`);
      else {
        const loaded = await new Promise((resolve) => { const im = new win.Image(); im.onload = () => resolve(im.naturalWidth); im.onerror = () => resolve(0); im.src = poster; });
        if (!loaded) t.problem("bug", `${id} (${label}): the poster ${poster} didn't load`);
        else t.event("poster", `${id} (${label}): the clip shows ${poster} (${loaded}px wide), readyState ${video().readyState} before Tap to play`);
        t.add("postersShown");
      }
      // The poster is what the viewer sees: behind Tap to play (dimmed, the prompt's own picture) and as the clip box's own
      // picture, under the loading ring, so it is never a plain black box.
      const prompt = doc.querySelector(".tap-to-play");
      const behind = prompt ? prompt.getAttribute("data-poster") : "";
      const boxPic = doc.querySelector("#spark-video").style.backgroundImage;
      const clipBg = win.getComputedStyle(video()).backgroundColor;
      t.event("poster-visible", `${id} (${label}): Tap to play shows ${behind || "NO picture"}; the clip box's picture is ${boxPic || "NONE"}; the clip element's own background is ${clipBg}`);
      if (!behind || !behind.endsWith(first.poster)) t.problem("bug", `${id} (${label}): the Tap to play prompt doesn't show the clip's poster (${behind || "none"})`);
      if (!boxPic || !boxPic.includes(first.poster)) t.problem("bug", `${id} (${label}): the clip box has no poster picture under the clip`);
      if (clipBg !== "rgba(0, 0, 0, 0)") t.problem("bug", `${id} (${label}): the clip element paints ${clipBg} over the poster before it has loaded`);
      // The clip waits behind Tap to play with its poster and nothing loaded: hold there so the footage shows it.
      t.event("poster-waiting", `${id} (${label}): clip readyState ${video().readyState}, networkState ${video().networkState}, paused ${video().paused}, poster ${poster ? "set" : "MISSING"}; held 2 s`);
      await sleep(2000);
      // 2. After one tap the right rendition is requested.
      await passPrompt(t, doc, `${id} (${label})`);
      t.event("poster-until-playing", `${id} (${label}): right after the tap readyState ${video().readyState}, the poster ${video().readyState < 2 ? "is still what shows" : "was replaced by the first frame"}`);
      const want = label === "phone" ? first.small : first.video;
      const other = label === "phone" ? first.video : first.small;
      if (label === "phone" && !first.small) t.problem("bug", `${id}: no phone rendition in the data for the first scene`);
      await waitFor(() => fetchedBy(win, want).length > 0 && video().currentSrc, 8000);
      const src = decodeURI(new URL(video().currentSrc || video().src, win.location.href).pathname);
      const bytes = fetchedBy(win, want).reduce((n, e) => n + (e.encodedBodySize || e.transferSize || 0), 0);
      t.event("rendition", `${id} (${label}): plays ${src}${bytes ? ` (${Math.round(bytes / 1024)} KB fetched so far)` : ""}`);
      if (src !== want) t.problem("bug", `${id} (${label}): the player plays ${src}, not ${want}`);
      if (other && fetchedBy(win, other).length) t.problem("bug", `${id} (${label}): the player also fetched ${other}`);
      if (label === "phone") {
        t.metric(`phoneClipKB_${id}`, Math.round(bytes / 1024));
        const ok = await waitFor(() => video().readyState >= 2 && !video().error, 15000);
        if (!ok) t.problem("bug", `${id}: the phone rendition ${want} didn't load`);
        else if (Math.abs(video().videoWidth / video().videoHeight - 9 / 16) > 0.01) t.problem("bug", `${id}: the phone rendition is ${video().videoWidth}x${video().videoHeight}, not 9:16`);
        t.add("phoneRenditions");
      }
      if (MADE.includes(id)) await livePictureCheck(t, doc, id, label);
    }
    t.progress(0.2 + (0.8 * ++k) / ids.length);
  }
  await torchSweepLeg(t, FIRST);
  closeViewFrame();
  restoreProgress();
}

/** The console at one screen size: the room and its big screen, subtitles while a line plays, the choices. */
async function consoleView(t, st, [w, h, name]) {
  const where = `${name} ${w}x${h}`;
  t.scene(where);
  await consoleFresh(t, st); // a new run, so the frame loads the first scene
  const doc = await viewFrameLoad(t, `/?story=${st.id}`, w, h);
  const api = apiOf(doc);
  if (!api) return t.problem("bug", `${where}: the console player didn't start in the frame`);
  await consolePrompt(t, doc, where);
  await waitFor(() => api.lines() && api.lines().playing >= 0, 4000);
  await consoleFit(t, doc, `${where}, a line playing`);
  // The big screen shows one camera and nothing in the strip or on the screen can be pressed to enlarge it.
  const cam = api.selected();
  const bigNow = byIdIn(doc, "console-big");
  if (bigNow.hidden || bigNow.dataset.camera !== cam) t.problem("bug", `${where}: the big screen doesn't show the selected camera (${bigNow.dataset.camera} / ${cam})`);
  await checkNotEnlargeable(t, doc, where);
  await consoleHeard(t, doc, where);
  await consoleFit(t, doc, `${where}, the room and the big screen, the choices shown`);
  await sleep(500);
  // The shift log fits too.
  await tapAt(t, byIdIn(doc, "console-log-btn"), `Log (${where})`);
  await sleep(200);
  const log = byIdIn(doc, "console-log");
  const lr = log.getBoundingClientRect();
  if (lr.left < -0.5 || lr.right > doc.defaultView.innerWidth + 0.5 || log.scrollWidth > log.clientWidth + 1) t.problem("bug", `${where}: the shift log runs off the side`);
  if (doc.documentElement.scrollWidth > doc.defaultView.innerWidth + 1) t.problem("bug", `${where}: the log scrolls the page sideways`);
  await tapAt(t, byIdIn(doc, "console-log-btn"), `Close log (${where})`);
  // The end screen: the shortest way to an ending, played in the frame, then the ending, the Log button and the way out fit.
  const x = consoleExplore(st);
  const end = Object.entries(x.variants).flatMap(([id, vs]) => Object.values(vs).map((v) => ({ id, ...v }))).filter((v) => st.scenes[v.id].ending).sort((a, b) => a.picks.length - b.picks.length)[0];
  if (end) {
    const m = consoleModel(st);
    await consoleHeard(t, doc, where);
    for (const i of end.picks) await consoleChoose(t, st, m, i, doc, `${where} end`);
    await consoleHeard(t, doc, `${where} end`);
    if (byIdIn(doc, "console-ending").hidden) t.problem("bug", `${where}: the ending isn't shown`);
    await consoleFit(t, doc, `${where}, the end screen`, { endScreen: true });
    if (!byIdIn(doc, "console-ending").getClientRects().length || byIdIn(doc, "console-ending").getBoundingClientRect().bottom > doc.defaultView.innerHeight + 0.5) {
      byIdIn(doc, "console-ending").scrollIntoView({ block: "nearest", behavior: "instant" });
      const r = byIdIn(doc, "console-ending").getBoundingClientRect();
      if (r.bottom > doc.defaultView.innerHeight + 0.5 || r.top < -0.5) t.problem("bug", `${where}: the ending text can't be brought on screen`);
    }
  }
  await sleep(500);
  closeViewFrame();
}

/** Reload one saved moment: what the player holds now (scene, flags, meters, log, history, lines heard) is compared with
    what a new page load of the story's link (a frame) comes back with. `label` names the moment. */
async function consoleReloadAt(t, st, label, { afterReload } = {}) {
  const n = st.scenes[apiOf().scene()].lines.length;
  const before = { scene: apiOf().scene(), flags: apiOf().flags(), meters: apiOf().meters(), log: apiOf().log(), history: apiOf().history(), lines: apiOf().lines() };
  const saved = apiOf().saved();
  if (!saved || saved.scene !== before.scene) t.problem("bug", `${st.id} (${label}): nothing saved for the run in localStorage ("${RUN_KEY}${st.cookie}")`);
  else t.event("run-saved", `${st.id} (${label}): ${saved.scene}, flags ${saved.flags.join(", ") || "none"}, ${saved.log.length} log entries, ${saved.done} line(s) heard, ${JSON.stringify(saved).length} bytes`);
  const doc = await viewFrameLoad(t, `/?story=${st.id}`, 390, 844);
  const api = apiOf(doc);
  if (!api) return t.problem("bug", `${st.id} (${label}): the reloaded page has no console player`);
  const prompt = soundOf(doc).prompt();
  if (!prompt && !soundOf(doc).unlocked()) t.problem("bug", `${st.id} (${label}): the reloaded page has no Tap to play prompt`);
  await consolePrompt(t, doc, `after the reload (${label})`);
  await sleep(300);
  const after = { scene: api.scene(), flags: api.flags(), meters: api.meters(), log: api.log(), history: api.history() };
  for (const k of Object.keys(after)) if (!sameJson(after[k], before[k])) t.problem("bug", `${st.id} (${label}): after a reload ${k} is ${JSON.stringify(after[k])}, it was ${JSON.stringify(before[k])}`);
  const heard = [...doc.querySelectorAll("#console-subs .sub")].length;
  if (before.lines.done > 0 && heard < Math.min(before.lines.done, n)) t.problem("bug", `${st.id} (${label}): after a reload ${heard} subtitle(s), ${before.lines.done} line(s) had been heard`);
  const ended = !!st.scenes[before.scene].ending;
  if (ended && !(await waitFor(() => !byIdIn(doc, "console-ending").hidden, 20000))) t.problem("bug", `${st.id} (${label}): the reloaded page doesn't show the ending`);
  await consoleHeard(t, doc, `after the reload (${label})`);
  if (ended) await consoleFit(t, doc, `${label}, reloaded at the ending`, { endScreen: true });
  if (afterReload) await afterReload(doc, api);
  const ok = sameJson(Object.keys(after).map((k) => after[k]), Object.keys(after).map((k) => before[k]));
  t.event("reloaded", `${st.id} (${label}): back at ${after.scene} with flags ${after.flags.join(", ") || "none"}, ${after.log.length} log entries, ${heard} line(s) already heard (${ok ? "same" : "DIFFERENT"})`);
  await sleep(700);
  closeViewFrame();
}

/** Reload at four moments: the start (nothing done), mid-scene (some lines heard), right after a choice, and at an
    ending. Each must come back to the same scene, flags, meters, log and heard lines. */
async function consoleReload(t, st) {
  const R = rulesOf();
  t.scene("Reload: start, mid-scene, after a choice, at an ending");
  const x = consoleExplore(st);
  const all = Object.entries(x.variants).flatMap(([id, vs]) => Object.values(vs).map((v) => ({ id, ...v })));
  // The way to the scene with the most choices behind it that is not an ending: the explorer's longest variant.
  const target = all.filter((v) => v.picks.length && !st.scenes[v.id].ending).sort((a, b) => b.picks.length - a.picks.length)[0];
  const ending = all.filter((v) => st.scenes[v.id].ending).sort((a, b) => a.picks.length - b.picks.length)[0];
  if (!target) return t.problem("warning", `${st.id}: no scene in the middle to reload at`);

  // 1. The start: a new run, the first line not yet heard.
  await consoleFresh(t, st);
  await consoleReloadAt(t, st, "start");

  // 2. Right after a choice: the first choice of the way, the new scene just entered.
  await consoleFresh(t, st);
  const mc = consoleModel(st);
  await consoleHeard(t, document, "reload");
  await consoleChoose(t, st, mc, target.picks[0], document, "reload");
  await consoleReloadAt(t, st, "after a choice");

  // 3. Mid-scene: the first line heard, the second not.
  await consoleFresh(t, st);
  const m2 = consoleModel(st);
  await consoleHeard(t, document, "reload");
  for (const i of target.picks.slice(0, -1)) await consoleChoose(t, st, m2, i, document, "reload");
  // The last choice by hand, its lines not skipped: the first is heard, the rest are still to come.
  const lastPick = target.picks[target.picks.length - 1];
  const lastLabel = st.scenes[m2.scene].choices[lastPick][0];
  await tapAt(t, openChoices(document).find((b) => b.textContent.trim() === lastLabel), `choice "${lastLabel}"`);
  m2.choose(lastPick);
  if (st.scenes[m2.scene].lines.length > 1) await waitFor(() => apiOf().lines().done >= 1 && apiOf().lines().done < st.scenes[m2.scene].lines.length, 20000);
  await consoleReloadAt(t, st, "mid-scene");

  // 4. At an ending (the shortest way there, its lines heard).
  if (ending) {
    await consoleFresh(t, st);
    const m3 = consoleModel(st);
    await consoleHeard(t, document, "reload");
    for (const i of ending.picks) await consoleChoose(t, st, m3, i, document, "reload");
    await consoleHeard(t, document, "reload");
    await consoleReloadAt(t, st, "at an ending");
  } else t.problem("warning", `${st.id}: no ending to reload at`);
}

/** Progress storage degrades safely: with localStorage refusing every read and write (a private window) the story
    still opens, plays a choice and shows its log; nothing throws. */
async function consoleBlockedStorage(t, st) {
  t.scene("Storage blocked");
  await consoleFresh(t, st);
  const doc = await viewFrameLoad(t, `/?story=${st.id}`, 390, 844);
  const win = doc.defaultView;
  const errors = [];
  win.addEventListener("error", (e) => errors.push(e.message));
  const api = apiOf(doc);
  await consolePrompt(t, doc, "storage blocked");
  const start = api.scene();
  // From here every localStorage call in the frame throws, as in a browser that blocks storage.
  const broken = () => { throw new win.DOMException("blocked", "SecurityError"); };
  for (const m of ["getItem", "setItem", "removeItem"]) win.Storage.prototype[m] = broken;
  try {
    await consoleHeard(t, doc, "storage blocked");
    const open = openChoices(doc)[0];
    if (!open) return t.problem("bug", `${st.id}: no choice to press with storage blocked`);
    await tapAt(t, open, "a choice (storage blocked)");
    await sleep(300);
    if (api.scene() === start) t.problem("bug", `${st.id}: with storage blocked the choice did nothing`);
    await tapAt(t, byIdIn(doc, "console-log-btn"), "Log (storage blocked)");
    if (byIdIn(doc, "console-log").hidden) t.problem("bug", `${st.id}: with storage blocked the Log doesn't open`);
    await tapAt(t, byIdIn(doc, "console-cc"), "CC (storage blocked)");
    if (errors.length) t.problem("bug", `${st.id}: with storage blocked the page threw: ${errors[0]}`);
    else t.event("storage-blocked", `${st.id}: with localStorage refusing, the story played a choice, opened the Log and toggled CC with no error`);
  } finally {
    await sleep(300);
    closeViewFrame();
  }
}

/** The story's own subtitles (on by default), the replay button and the line audio. */
async function consoleLines(t, st) {
  const where = `${st.id} lines`;
  t.scene(where);
  const original = localStorage.getItem(SUBS_KEY);
  localStorage.removeItem(SUBS_KEY);
  try {
    await consoleFresh(t, st);
    const api = apiOf();
    const first = st.scenes[st.start];
    if (!api.subtitles() || $("console-cc").getAttribute("aria-pressed") !== "true") t.problem("bug", `${where}: subtitles aren't on by default`);
    // Lines come one after the other by themselves, in the order of the data.
    const order = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 25000 && !(api.lines().done >= first.lines.length && api.lines().playing < 0)) {
      const l = api.lines();
      if (l.playing >= 0 && order[order.length - 1] !== l.playing) order.push(l.playing);
      await sleep(40);
    }
    if (!sameJson(order, first.lines.map((_, i) => i))) t.problem("bug", `${where}: the lines played in the order ${JSON.stringify(order)}, the data has ${JSON.stringify(first.lines.map((_, i) => i))}`);
    else t.event("lines-in-order", `${st.id}/${st.start}: ${first.lines.map((l) => `${l.speaker}: ${l.text}`).join(" | ")}`);
    const subs = [...document.querySelectorAll("#console-subs .sub")].map((p) => p.textContent.trim());
    if (subs.length !== first.lines.length || !shown($("console-subs"))) t.problem("bug", `${where}: ${subs.length} subtitles shown for ${first.lines.length} lines`);
    // CC off hides the subtitles (they stay for screen readers); on brings them back.
    await tapAt(t, $("console-cc"), "CC off");
    await sleep(100);
    const r = $("console-subs").getBoundingClientRect();
    if (r.width > 2 && r.height > 2) t.problem("bug", `${where}: CC off but the subtitles still show (${Math.round(r.width)}x${Math.round(r.height)})`);
    if (localStorage.getItem(SUBS_KEY) !== "off") t.problem("bug", `${where}: CC off wasn't saved`);
    await tapAt(t, $("console-cc"), "CC on");
    await sleep(100);
    if (!shown($("console-subs")) || $("console-subs").getBoundingClientRect().height < 10) t.problem("bug", `${where}: CC on but the subtitles don't show`);
    // Replay the current line: it plays again, then the choices are back.
    await consoleHeard(t, document, where, { skip: false });
    await tapAt(t, $("console-replay"), "Replay line");
    const again = await waitFor(() => api.lines().playing >= 0, 1500);
    if (!again) t.problem("bug", `${where}: Replay line didn't play a line again`);
    await consoleHeard(t, document, `${where} (after replay)`, { skip: false });
    if (!openChoices().length) t.problem("bug", `${where}: the choices didn't come back after a replay`);
    else t.event("replay", `${st.id}/${st.start}: the last line again, choices back`);
    if (!$("console-replay").offsetHeight || !$("console-skip").offsetHeight) t.problem("bug", `${where}: no Replay/Skip controls`);
  } finally {
    if (original == null) localStorage.removeItem(SUBS_KEY);
    else localStorage.setItem(SUBS_KEY, original);
  }
}

/** The big screen and the strip: nine cameras in the strip (the state the scene says), one camera on the big screen
    (the scene's focus, with what it shows written under it for a screen reader), and no press changes it. */
async function consoleWall(t, st, { fresh = true } = {}) {
  const where = `${st.id} screen`;
  t.scene(where);
  if (fresh) await consoleFresh(t, st);
  await consoleHeard(t, document, where);
  const scene = st.scenes[fresh ? st.start : apiOf().scene()];
  const feeds = rulesOf().feedsOf(st, scene);
  const tiles = [...document.querySelectorAll("#console-wall .feed")];
  t.metric("feeds", tiles.length);
  const big = $("console-big");
  if (big.hidden) return t.problem("bug", `${where}: the big screen isn't there`);
  const cam = st.cameras.find((c) => c.id === big.dataset.camera);
  if (!cam) return t.problem("bug", `${where}: the big screen shows no camera`);
  if (scene.focus && cam.id !== scene.focus) t.problem("bug", `${where}: the scene's focus is ${scene.focus}, the big screen shows ${cam.id}`);
  const desc = (cam.states[feeds[cam.id]] || cam.states.normal).desc;
  if (big.dataset.state !== feeds[cam.id]) t.problem("bug", `${where}: the big screen is ${cam.id}/${big.dataset.state}, not ${cam.id}/${feeds[cam.id]}`);
  if (!big.textContent.includes(desc)) t.problem("bug", `${where}: the big screen doesn't say what it shows ("${desc}")`);
  const marked = tiles.filter((x) => x.classList.contains("is-selected")).map((x) => x.dataset.camera);
  if (marked.length !== 1 || marked[0] !== cam.id) t.problem("bug", `${where}: the strip marks ${JSON.stringify(marked)}, the screen shows ${cam.id}`);
  const numbers = tiles.map((x) => (x.querySelector(".feed-num") || {}).textContent);
  if (numbers.join() !== tiles.map((_, i) => String(i + 1)).join()) t.problem("bug", `${where}: the strip doesn't number its cameras 1 to ${tiles.length} (${numbers.join(" ")})`);
  const tr = tiles[0].getBoundingClientRect();
  const br = big.getBoundingClientRect();
  if (br.width * br.height <= tr.width * tr.height * 4) t.problem("bug", `${where}: the big screen (${Math.round(br.width)}x${Math.round(br.height)}) isn't much bigger than a tile (${Math.round(tr.width)}x${Math.round(tr.height)})`);
  await checkNotEnlargeable(t, document, where);
  t.event("big-screen", `${st.id}: ${cam.id} (${feeds[cam.id]}) on the big screen, ${tiles.length} in the strip, none pressable: "${desc.slice(0, 60)}"`);
  await sleep(300);
}

/** The gating criterion in the open: a choice that needs a flag isn't there without it and is with it, and a choice
    sets the flag a later scene reads. */
async function consoleGates(t, st) {
  const R = rulesOf();
  const x = consoleExplore(st);
  // A scene with two different sets of open choices, and the choice that makes the difference.
  const pair = Object.entries(x.variants).map(([id, vs]) => [id, Object.values(vs)]).find(([, vs]) => vs.length > 1);
  if (!pair) return t.problem("bug", `${st.id}: no choice is gated by a flag or meter (the story has to have one)`);
  const [id, vs] = pair;
  for (const v of vs.slice(0, 2)) {
    await consoleFresh(t, st);
    const m = consoleModel(st);
    const where = `${st.id} gate at ${id}: ${v.path.join(" > ")}`;
    t.scene(where);
    await consoleHeard(t, document, where);
    for (const i of v.picks) await consoleChoose(t, st, m, i, document, where);
    const shownNow = openChoices().map((b) => b.textContent.trim());
    const all = st.scenes[id].choices.map((c) => c[0]);
    const hidden = all.filter((c) => !shownNow.includes(c));
    t.event("gate", `${id} with ${sayState(m.state) || "a fresh state"}: shows ${JSON.stringify(shownNow)}, hides ${JSON.stringify(hidden)}`);
  }
}

/* ---------------- the real Night Shift in `console` (gaps 34 to 41): from seeded runs ---------------- */

/** The model of a run that made `picks` from the start. */
function consoleModelAt(st, picks) {
  const m = consoleModel(st);
  for (const i of picks) m.choose(i);
  return m;
}

/** Every way to a scene (the explorer's variants), the shortest first. */
function consoleWays(x) {
  return Object.entries(x.variants)
    .flatMap(([id, vs]) => Object.values(vs).map((v) => ({ id, ...v })))
    .sort((a, b) => a.picks.length - b.picks.length);
}

/** A gated choice on the real story: a scene with two different sets of open choices is reached by two ways (seeded
    runs; setup shortcut), the gated choice is on the page with one and not the other, and it is pressed for real. */
async function consoleRealGate(t, st, x) {
  const R = rulesOf();
  const ways = consoleWays(x);
  const id = [...new Set(ways.map((w) => w.id))].find((i) => Object.keys(x.variants[i]).length > 1 && !st.scenes[i].ending);
  if (!id) return t.problem("bug", `${st.id}: no scene has choices gated by a flag or meter (the story has one)`);
  const openIx = (w) => consoleModelAt(st, w.picks).open().map(([, i]) => i);
  const mine = ways.filter((w) => w.id === id);
  const fewest = mine.reduce((a, b) => (openIx(b).length < openIx(a).length ? b : a));
  const most = mine.reduce((a, b) => (openIx(b).length > openIx(a).length ? b : a));
  const gated = openIx(most).filter((i) => !openIx(fewest).includes(i));
  if (!gated.length) return t.problem("bug", `${st.id}/${id}: two ways to it show the same choices (no choice is gated there)`);
  const label = st.scenes[id].choices[gated[0]][0];
  let withIt = null;
  for (const w of [fewest, most]) {
    const where = `${st.id} gate at ${id}: ${w.path.join(" > ")}`;
    t.scene(where);
    const m = await consoleSeedAt(t, st, w.picks, null);
    await consoleHeard(t, document, where);
    consoleCheck(t, st, m, document, where, null);
    const isOpen = openChoices().some((b) => Number(b.dataset.choice) === gated[0]);
    if (w === fewest && isOpen) t.problem("bug", `${where}: "${label}" (choice ${gated[0]}) is on the page without what it needs (${sayState(m.state) || "a fresh state"})`);
    if (w === most && !isOpen) t.problem("bug", `${where}: "${label}" (choice ${gated[0]}) isn't on the page though its conditions hold (${sayState(m.state)})`);
    t.event("gate", `${id} with ${sayState(m.state) || "a fresh state"}: shows ${JSON.stringify(openChoices().map((b) => b.textContent.trim()))}, ${w === fewest ? "without" : "with"} "${label}"`);
    if (w === most) withIt = m;
  }
  // What the gate reads, and the choice that set it earlier on the way (a choice sets a flag a later scene reads).
  const without = consoleModelAt(st, fewest.picks).state.flags;
  const walk = consoleModel(st);
  const setters = [];
  for (const i of most.picks) {
    const before = Object.keys(walk.state.flags);
    const by = `"${st.scenes[walk.scene].choices[i][0]}" in ${walk.scene}`;
    walk.choose(i);
    for (const f of Object.keys(walk.state.flags)) if (!before.includes(f) && !without[f]) setters.push(`${f} set by ${by}`);
  }
  const ex = R.extraOf(st.scenes[id].choices[gated[0]]);
  const reads = ex.requires && ex.requires.length ? `needs ${ex.requires.join(", ")}` : ex.forbids && ex.forbids.length ? `needs ${ex.forbids.join(", ")} not set` : "is gated by a meter";
  t.event("flag-read", `${id}: "${label}" ${reads}; on the way: ${setters.join("; ") || "(a meter, not a flag)"}`);
  if (withIt) await consoleChoose(t, st, withIt, gated[0], document, `${st.id} gate at ${id}`, null);
}

/** Settings on all four audio elements (voice, bed, effect, sting), opened in the middle of a line, in the first scene
    (a sting plays under its first line) and the next. */
async function consoleRealSound(t, st) {
  t.scene(`${st.title}: Settings on voice, ambience, effects and sting`);
  await consoleSoundCheck(t, st, `${st.id} sound`, { names: ["voice", "bed", "sfx", "sting"] });
}

/** Reload at the 40th scene (a seeded run to the 39th; the move into the 40th is a real press): in the middle of it with
    only its first line heard, and once all its lines are heard. */
async function consoleRealReload40(t, st, x) {
  const target = consoleWays(x).find((w) => w.picks.length === 39 && !st.scenes[w.id].ending);
  if (!target) return t.problem("warning", `${st.id}: no scene is the 40th of a way (39 choices) to reload at`);
  t.scene(`${st.title}: reload at the 40th scene (${target.id})`);
  const m = await consoleSeedAt(t, st, target.picks.slice(0, 38), null);
  await consoleHeard(t, document, "40th");
  consoleCheck(t, st, m, document, `${st.id}: the 39th scene (${m.scene})`, null);
  const pick = target.picks[38];
  const label = st.scenes[m.scene].choices[pick][0];
  await tapAt(t, openChoices().find((b) => Number(b.dataset.choice) === pick), `choice "${label}"`);
  m.choose(pick);
  if (m.scene !== target.id) t.problem("bug", `${st.id}: expected the 40th scene to be ${target.id}, is ${m.scene}`);
  if (st.scenes[m.scene].lines.length > 1) await waitFor(() => apiOf().lines().done >= 1 && apiOf().lines().done < st.scenes[m.scene].lines.length, 30000);
  t.event("reload-at", `${st.id}: the 40th scene is ${m.scene} (${apiOf().history().length} choices made, ${apiOf().log().length} log entries), ${apiOf().lines().done} of ${st.scenes[m.scene].lines.length} lines heard`);
  await consoleReloadAt(t, st, "the 40th scene, mid-scene");
  await consoleHeard(t, document, "40th");
  await consoleReloadAt(t, st, "the 40th scene, all lines heard");
}

/** The way, nearest the start, to a scene where the shift log holds `entries` or more entries. */
function consoleLogWay(st, x, entries = 70) {
  return Object.entries(x.scenes)
    .filter(([id]) => !st.scenes[id].ending)
    .sort((a, b) => a[1].picks.length - b[1].picks.length)
    .map(([id, w]) => ({ id, ...w, m: consoleModelAt(st, w.picks) }))
    .find((w) => w.m.log.length >= entries);
}

/** The shift log at 70 entries: a reload with it open, and at 360x640 it opens, scrolls inside itself from the first
    row to the foot, and closes. */
async function consoleRealLog(t, st, x) {
  const way = consoleLogWay(st, x, 70);
  if (!way) return t.problem("bug", `${st.id}: no way holds 70 shift log entries`);
  const where = `${st.id} log at ${way.m.log.length} entries (${way.id})`;
  t.scene(where);
  const m = await consoleSeedAt(t, st, way.picks, null);
  await consoleHeard(t, document, where);
  await tapAt(t, byIdIn(document, "console-log-btn"), `Log (${where})`);
  await sleep(300);
  if (byIdIn(document, "console-log").hidden) t.problem("bug", `${where}: the Log button didn't open the shift log`);
  await consoleReloadAt(t, st, `the Log at ${m.log.length} entries`, {
    afterReload: async (doc) => {
      await consoleLogCheck(t, st, m, doc, `${where}, after a reload`);
    },
  });
  consoleSeedWrite(st, way.picks, null);
  const doc = await viewFrameLoad(t, `/?story=${st.id}`, 360, 640);
  try {
    const fit = `${where} at small phone 360x640`;
    await consolePrompt(t, doc, fit);
    await consoleHeard(t, doc, fit);
    const win = doc.defaultView;
    const log = byIdIn(doc, "console-log");
    const button = byIdIn(doc, "console-log-btn");
    await tapAt(t, button, `Log (${fit})`);
    await sleep(300);
    if (log.hidden) return t.problem("bug", `${fit}: the Log button didn't open the shift log`);
    const rows = [...log.querySelectorAll(".dar-row")];
    const done = rows.filter((r) => !r.classList.contains("is-redacted")).length;
    if (done !== m.log.length) t.problem("bug", `${fit}: the log lists ${done} entries, the run holds ${m.log.length}`);
    const inside = (el) => {
      const a = el.getBoundingClientRect();
      const b = log.getBoundingClientRect();
      return a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
    };
    if (log.scrollHeight <= log.clientHeight + 1) t.problem("bug", `${fit}: ${rows.length} rows fit with no scroll (${log.scrollHeight} px in ${log.clientHeight}): the Log isn't the panel that scrolls`);
    if (log.scrollWidth > log.clientWidth + 1 || doc.documentElement.scrollWidth > win.innerWidth + 1) t.problem("bug", `${fit}: the Log scrolls sideways (${log.scrollWidth} px in ${log.clientWidth}, the page ${doc.documentElement.scrollWidth} in ${win.innerWidth})`);
    const br = button.getBoundingClientRect();
    if (br.bottom > win.innerHeight + 0.5 || br.top < -0.5 || br.height < 43.5 || br.width < 43.5) t.problem("bug", `${fit}: the Log button can't be pressed to close it (${Math.round(br.width)}x${Math.round(br.height)} at ${Math.round(br.top)}..${Math.round(br.bottom)} of ${win.innerHeight})`);
    log.scrollTop = 0;
    await sleep(100);
    if (!inside(rows[0])) t.problem("bug", `${fit}: the first row isn't in view at the top of the Log`);
    // A viewer's flick: down most of a screenful at a time to the foot of the page.
    let last = -1;
    let steps = 0;
    while (log.scrollTop + log.clientHeight < log.scrollHeight - 1 && steps++ < 400 && log.scrollTop !== last) {
      last = log.scrollTop;
      log.scrollTop = Math.min(log.scrollHeight, log.scrollTop + log.clientHeight * 0.8);
      await sleep(15);
    }
    const foot = log.querySelector(".dar-foot");
    if (!(log.scrollTop > 0)) t.problem("bug", `${fit}: the Log didn't scroll (${log.scrollTop} of ${log.scrollHeight - log.clientHeight} px)`);
    if (!foot || !inside(foot)) t.problem("bug", `${fit}: the end of the Log (its foot line) can't be scrolled into view`);
    t.event("log-scroll", `${fit}: ${done} entries, ${rows.length - done} redacted lines, ${log.scrollHeight} px in ${log.clientHeight} px, scrolled ${Math.round(log.scrollTop)} px to the foot in ${steps} steps, no sideways scroll`);
    await sleep(600);
    log.scrollTop = 0;
    await tapAt(t, button, `Close log (${fit})`);
    await sleep(200);
    if (!log.hidden) t.problem("bug", `${fit}: the Log button didn't close the log`);
    if (!doc.querySelector(".console-body")?.getClientRects().length) t.problem("bug", `${fit}: closing the Log didn't bring the wall and the choices back`);
    await consoleFit(t, doc, `${fit}, Log closed`);
  } finally {
    closeViewFrame();
  }
}

/** The worst layouts at the three phone sizes: the scenes with the most choices in the data, in the way that opens the
    most of them (seeded runs; setup shortcut). Every open choice is reachable (scrolling inside the words column is
    fine), 44px or more, nothing wider than the screen. The story never shows more than a few at once (they are gated),
    so the same screen is then filled to the scene's twelve (or eight) with copies of its buttons to prove the layout
    holds for all the data has. */
async function consoleRealFit(t, st, x) {
  const ids = ["okafor-reads-solid", "tour3-test"].filter((id) => st.scenes[id]);
  if (ids.length < 2) t.problem("bug", `${st.id}: the scenes okafor-reads-solid and tour3-test aren't in the story`);
  for (const id of ids) {
    const ways = consoleWays(x).filter((w) => w.id === id);
    if (!ways.length) {
      t.problem("bug", `${st.id}/${id}: no state reaches it`);
      continue;
    }
    const open = (w) => consoleModelAt(st, w.picks).open().length;
    const w = ways.reduce((a, b) => (open(b) > open(a) ? b : a));
    for (const [width, height, name] of VIEWPORTS) {
      const where = `${id} at ${name} ${width}x${height}`;
      t.scene(where);
      consoleSeedWrite(st, w.picks, null);
      const doc = await viewFrameLoad(t, `/?story=${st.id}`, width, height);
      try {
        await consolePrompt(t, doc, where);
        await consoleHeard(t, doc, where);
        consoleCheck(t, st, consoleModelAt(st, w.picks), doc, where, null);
        const real = openChoices(doc);
        await consoleFit(t, doc, `${where}, ${real.length} of ${st.scenes[id].choices.length} choices open`);
        const total = st.scenes[id].choices.length;
        const holder = byIdIn(doc, "console-choices");
        for (let i = real.length; i < total; i++) {
          const c = real[i % real.length].cloneNode(true);
          c.dataset.stress = "1";
          holder.appendChild(c);
        }
        await consoleFit(t, doc, `${where}, stress: all ${total} choices as buttons (${real.length} real, ${total - real.length} copies)`);
        holder.querySelectorAll("[data-stress]").forEach((c) => c.remove());
      } finally {
        closeViewFrame();
      }
    }
  }
}

/** Night Shift itself, not its demo: the wall of nine, a gated choice, Settings on voice, ambience, effects and sting
    (opened in the middle of a line), a reload at the 40th scene, the Log at 70 entries, and the worst layouts at three
    sizes. Every position past the start is a seeded run (consoleSeedAt: setup shortcut, event seeded-run), then real presses. */
async function consoleRealLeg(t, st) {
  const x = consoleExplore(st);
  const mostOpen = consoleWays(x).reduce((n, w) => Math.max(n, consoleModelAt(st, w.picks).open().length), 0);
  t.event("real-story", `${st.id}: ${Object.keys(st.scenes).length} scenes, ${st.cameras.length} cameras, ${x.states} states; the most choices open at once is ${mostOpen} (okafor-reads-solid holds ${st.scenes["okafor-reads-solid"]?.choices.length} in the data, tour3-test ${st.scenes["tour3-test"]?.choices.length})`);
  await consoleFresh(t, st);
  t.scene(`${st.title}: the wall of nine`);
  if (st.cameras.length !== 9) t.problem("bug", `${st.id}: ${st.cameras.length} cameras, the wall is nine`);
  await consoleWall(t, st, { fresh: false });
  if (document.querySelectorAll("#console-wall .feed").length !== 9) t.problem("bug", `${st.id}: the wall shows ${document.querySelectorAll("#console-wall .feed").length} feeds, not 9`);
  t.progress(0.1);
  await consoleRealGate(t, st, x);
  t.progress(0.25);
  await consoleRealSound(t, st);
  t.progress(0.45);
  await consoleRealReload40(t, st, x);
  t.progress(0.65);
  await consoleRealLog(t, st, x);
  t.progress(0.8);
  await consoleRealFit(t, st, x);
}

async function consoleRun(options, t) {
  rememberProgress();
  const originalSounds = localStorage.getItem(SOUND_KEY);
  const sts = consoleStories();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  if (!sts.length) throw new Error("no console story in js/story-data.js");
  await passPrompt(t);
  clearProgress();
  const st = (options && options.story && sts.find((s) => s.id === options.story)) || sts[0];
  // The real story (Night Shift) has its own leg after the demo's; {"at":"real"} plays only that leg, {"at":"demo"} only the demo's.
  const real = sts.find((s) => s.id !== st.id && s.listed && Object.keys(s.scenes).length > 50) || (Object.keys(st.scenes).length > 50 ? st : null);
  const only = options && options.at;
  try {
    if (only === "real" || (real === st && only !== "demo")) {
      if (!real) throw new Error("no real console story (more than 50 scenes) in js/story-data.js");
      await consoleOpen(t, real, { tap: false });
      await consolePrompt(t, document, real.id, { real: 2500 });
      await consoleRealLeg(t, real);
      t.progress(1);
      return;
    }
    // 1. Opens by its link with its own Tap to play, shows the wall, plays the lines in order, shows choices.
    t.scene(`${st.title}: opens`);
    await consoleOpen(t, st, { tap: false });
    await sleep(900);
    if (!soundOf().prompt()) t.problem("bug", `${st.id}: no Tap to play prompt`);
    else checkNote(t, document, st.id);
    await consolePrompt(t, document, st.id, { real: 2500 });
    t.progress(0.05);
    await consoleLines(t, st);
    t.progress(0.12);
    await consoleWall(t, st);
    t.progress(0.2);
    // 2. Gated choices and a flag a later scene reads.
    await consoleGates(t, st);
    t.progress(0.3);
    // 3. Every scene and ending, played from the build's state explorer.
    await consoleWalk(t, st);
    t.progress(0.55);
    // 4. The shift log, mid-story and at the end.
    await consoleFresh(t, st);
    const m = consoleModel(st);
    const R = rulesOf();
    const x = consoleExplore(st);
    const mid = Object.entries(x.scenes).filter(([id]) => !st.scenes[id].ending).sort((a, b) => b[1].picks.length - a[1].picks.length)[0];
    await consoleHeard(t, document, "log");
    await consoleLogCheck(t, st, m, document, `${st.id} log at the start`);
    for (const i of mid[1].picks) await consoleChoose(t, st, m, i, document, "log");
    await consoleLogCheck(t, st, m, document, `${st.id} log at ${m.scene}`);
    const ending = Object.entries(x.scenes).find(([id]) => st.scenes[id].ending);
    if (ending) {
      await consoleFresh(t, st);
      const m3 = consoleModel(st);
      await consoleHeard(t, document, "log");
      for (const i of ending[1].picks) await consoleChoose(t, st, m3, i, document, "log end");
      await consoleLogCheck(t, st, m3, document, `${st.id} log at the ending ${m3.scene}`);
    }
    t.progress(0.7);
    // 5. Settings apply to the audio.
    await consoleSoundCheck(t, st, `${st.id} sound`);
    t.progress(0.8);
    // 6. Reload mid-story.
    await consoleReload(t, st);
    await consoleBlockedStorage(t, st);
    t.progress(0.88);
    // 7. The screen sizes.
    for (const v of VIEWPORTS) await consoleView(t, st, v);
    // 8. The real story: Night Shift's wall of nine, a gated choice, Settings on four elements, reload at the 40th scene, the Log at 70 entries, the worst layouts.
    if (real && real !== st && only !== "demo") {
      t.progress(0.9);
      await consoleRealLeg(t, real);
    }
    // 9. All stories: the video stories' landing page comes back, the saved place stays.
    await consoleFresh(t, st);
    await toLanding(t);
    if (!$("console").hidden) t.problem("bug", `${st.id}: the console player stays up after All stories`);
    if (document.querySelector("#console audio, body > audio")) t.problem("bug", `${st.id}: its audio elements are still on the page after All stories`);
    t.progress(1);
  } finally {
    closeViewFrame();
    if (originalSounds == null) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, originalSounds);
  }
}

/** A console story's draft, opened by its link (the `stories` run): its title, wall, first lines and choices, and its
    saved place coming back after All stories. */
/** The fewest choices from a new run to an ending, as the state explorer gives them: { picks, id } or null. */
function consoleShortestEnding(st) {
  const x = consoleExplore(st);
  const ways = Object.entries(x.variants)
    .filter(([id]) => st.scenes[id].ending)
    .flatMap(([id, vs]) => Object.values(vs).map((v) => ({ id, ...v })))
    .sort((a, b) => a.picks.length - b.picks.length);
  return ways[0] || null;
}

/** A listed console story's card opens its player under its own Tap to play (title, first scene, lines, choices);
    All stories brings the landing page back and the card says Started. */
async function consoleListedOpen(t, st) {
  await consoleOpen(t, st);
  t.scene(`${st.title}: player`);
  if ($("console-title").textContent.trim() !== st.title.toUpperCase()) t.problem("bug", `${st.id}: the player's title is "${$("console-title").textContent}"`);
  await consoleHeard(t, document, st.id);
  const m = consoleModel(st);
  consoleCheck(t, st, m, document, `${st.id}: ${st.start}`);
  if (!openChoices().length) t.problem("bug", `${st.id}: no choices on the first scene`);
  checkHitTargets(t, document, st.title);
  // Only the first scene is found: its percent is one scene's worth.
  const text = (byIdIn(document, "console-explored").textContent || "").trim();
  const want = pctOf(1, Object.keys(st.scenes).length);
  if (text !== `${want}% explored`) t.problem("bug", `${st.id}: the first scene says "${text}", not ${want}% explored`);
  t.add("storiesOpened");
  await sleep(800);
  await toLanding(t);
  if (new URL(location.href).searchParams.has("story")) t.problem("bug", "the address still names a story on the landing page");
  if ($("title-splash")) t.problem("bug", "All stories shows the title splash again (it's for the first visit)");
  await sleep(100);
}

/** Plays the shortest way to an ending, then stays on the ending. The way is long (Night Shift: 71 choices, 389 lines),
    so the run is a seeded one (consoleSeedAt: setup shortcut) that stops `keep` choices short of the ending, and those
    last choices are real presses with their lines skipped. The `night-shift` scenario plays whole ways, start to end. */
async function consolePlayToEnding(t, st, keep = 2) {
  const way = consoleShortestEnding(st);
  if (!way) return null;
  await consoleOpen(t, st);
  const from = Math.max(0, way.picks.length - keep);
  const m = await consoleSeedAt(t, st, way.picks.slice(0, from), null);
  const where = `${st.id}: ${way.path.join(" > ")}`;
  await consoleHeard(t, document, where);
  consoleCheck(t, st, m, document, where, null);
  for (const i of way.picks.slice(from)) await consoleChoose(t, st, m, i, document, where, null);
  if (!st.scenes[m.scene].ending) t.problem("bug", `${where}: expected to end at an ending, is at ${m.scene}`);
  t.event("ending", `${st.id}/${m.scene}: ${st.scenes[m.scene].ending[0]}`);
  if (stories().run(st.id) !== "end") t.problem("bug", `${st.id}: at an ending the run says "${stories().run(st.id)}", not end`);
  return m;
}

/** Reaching an ending completes a console story; the percent follows the unlocked scenes; a reload keeps it. */
async function consoleListedEnding(t, st) {
  t.scene(`${st.title}: to an ending`);
  if (!(await consolePlayToEnding(t, st))) return t.problem("warning", `${st.id}: no ending to reach (no scene with an "ending")`);
  const want = exploredWant(st);
  const text = (byIdIn(document, "console-explored").textContent || "").trim();
  if (text !== `${want}% explored`) t.problem("bug", `${st.id}: at an ending the player says "${text}", the unlocks give ${want}%`);
  await sleep(800);
  await toLanding(t);
  checkBadge(t, cardOf(st.id), st, "completed", `after ${st.title}'s ending`);
  await badgeAfterReload(t, st, "completed", `after ${st.title}'s ending and a reload`);
  await sleep(600);
}

/** Start Over on a completed console story: only its run goes (unlocks, percent and Completed stay); it opens at its
    first scene, and its card still says Completed and Start Over. */
async function consoleListedStartOver(t, st) {
  t.scene(`${st.title}: Start Over`);
  // The ending the run above reached is still where it was left (a card at an ending says Start Over): play it again
  // only if it isn't.
  if (stories().progress(st.id) !== "completed" || stories().run(st.id) !== "end") {
    if (!(await consolePlayToEnding(t, st))) return;
  }
  await toLanding(t);
  if (!checkBadge(t, cardOf(st.id), st, "completed", `before Start Over in ${st.title}`)) return;
  const go = () => (cardOf(st.id).querySelector(".story-card-go")?.textContent || "").trim();
  if (go() !== "Start Over") t.problem("bug", `${st.id}: at an ending its card's button says "${go()}", not Start Over`);
  const unlocks = JSON.stringify(savedUnlocks(st));
  const pct = exploredWant(st);
  const others = Object.fromEntries(allStories().filter((o) => o.id !== st.id).flatMap(cookiesOf).map((name) => [name, readJsonCookie(name)]));
  await consoleOpen(t, st);
  await consoleHeard(t, document, `${st.id} (after Start Over)`);
  if (apiOf().scene() !== st.start || apiOf().history().length) t.problem("bug", `${st.id}: Start Over opened ${apiOf().scene()} (${apiOf().history().length} steps in), not its start`);
  const saved = savedPlace(st);
  if (!saved || saved.scene !== st.start) t.problem("bug", `${st.id}: after Start Over its run is ${JSON.stringify(saved)}, not the start`);
  if (JSON.stringify(savedUnlocks(st)) !== unlocks) t.problem("bug", `${st.id}: Start Over changed its unlocks (${unlocks} -> ${JSON.stringify(savedUnlocks(st))}): they must stay`);
  if (stories().progress(st.id) !== "completed") t.problem("bug", `${st.id}: after Start Over iltvStories.progress says ${stories().progress(st.id)}, not completed (an ending stays reached)`);
  for (const [name, was] of Object.entries(others)) {
    if (JSON.stringify(readJsonCookie(name)) !== JSON.stringify(was)) t.problem("bug", `Start Over in ${st.id} changed the cookie ${name}`);
  }
  // The rule (story doc "Progress on the cards"): Start Over forgets the run, not what was found, so the player's header
  // reads the same percent as the card (the unlocks), not 0%.
  const head = ($("console-explored")?.textContent || "").trim();
  if (head !== `${pct}% explored`) t.problem("bug", `${st.id}: after Start Over the player's header says "${head}", the unlocks give "${pct}% explored" (the card's)`);
  t.event("start-over", `${st.id}: at ${apiOf().scene()}, ${pct}% explored kept (header "${head}"); ${Object.keys(others).length} other cookies untouched`);
  await sleep(600);
  await toLanding(t);
  // Expected, not a bug (canon): Start Over forgets the run, never what was found, so the card stays Completed with its
  // percent and a Start Over button. A reviewer should not flag "Completed after Start Over".
  checkBadge(t, cardOf(st.id), st, "completed", `after Start Over in ${st.title} (expected: the card stays Completed with its percent and Start Over; only the run restarts)`);
  await badgeAfterReload(t, st, "completed", `after Start Over and a reload (expected: still Completed, same percent, Start Over)`);
  if (go() !== "Start Over") t.problem("bug", `${st.id}: after Start Over its card's button says "${go()}", not Start Over`);
  await sleep(600);
}

async function consoleDraft(t, st) {
  await consoleOpen(t, st);
  await consoleFresh(t, st);
  if ($("console-title").textContent.trim() !== st.title.toUpperCase()) t.problem("bug", `${st.id}: the player's title is "${$("console-title").textContent}"`);
  await consoleHeard(t, document, st.id);
  const m = consoleModel(st);
  consoleCheck(t, st, m, document, `${st.id}: ${st.start}`);
  if (!openChoices().length) t.problem("bug", `${st.id}: no choices on the first scene`);
  const open = m.open();
  await consoleChoose(t, st, m, open[0][1], document, st.id);
  const where = m.scene;
  await toLanding(t);
  checkInventory(t, "landing page, after a console draft");
  await consoleOpen(t, st);
  await waitFor(() => apiOf().scene() === where, 2000);
  if (apiOf().scene() !== where) t.problem("bug", `${st.id}: the saved place was ${where}, it opened at ${apiOf().scene()}`);
  else {
    await consoleHeard(t, document, `${st.id} (saved place)`);
    consoleCheck(t, st, m, document, `${st.id}: ${where} (saved place)`);
    t.event("saved-place", `${st.id}: ${where} (${sayState(m.state)})`);
  }
  await sleep(500);
  await toLanding(t);
}

/** A console story's branch pages: its wall, its lines (with their audio), the canonical state marked, the choices as
    links (locked ones shown locked), every link a page that exists. A big story has a page per scene (Night Shift: 228,
    1,288 recorded lines), so every page is fetched and read as a document, a few at a time, each line's recording asked
    for with a HEAD request; the pages a viewer meets first (the start and every ending) are also opened in the frame, as
    before, to pass their Tap to play prompt and load a line's recording in an audio element. */
async function crawlConsolePages(t, st, done, total) {
  const R = rulesOf();
  const x = consoleExplore(st);
  const pageOf = (id) => `/${st.scenes[id].folder}/`;
  const sceneAt = new Map(Object.keys(st.scenes).map((id) => [pageOf(id), id]));
  const first = pageOf(st.start);
  const parent = new Map([[first, null]]);
  const mine = new Set();
  const heads = new Map();
  const head = (url) => {
    if (!heads.has(url)) {
      heads.set(url, fetch(url, { method: "HEAD", cache: "no-store" }).then((r) => r.status, () => 0));
    }
    return heads.get(url);
  };
  const exists = new Map();
  const pageExists = (path) => {
    if (!exists.has(path)) exists.set(path, status(path));
    return exists.get(path);
  };
  const read = async (path) => {
    try {
      const r = await fetch(path, { cache: "no-store" });
      const text = await r.text();
      return r.status === 200 ? new DOMParser().parseFromString(text, "text/html") : null;
    } catch {
      return null;
    }
  };

  /** One page's checks; returns the links it offers. */
  const check = async (path, doc) => {
    const id = sceneAt.get(path);
    const s = st.scenes[id];
    t.note(doc.querySelector("h1")?.textContent || path);
    const canon = x.scenes[id];
    const wall = [...doc.querySelectorAll("[data-wall] .feed")];
    const feeds = R.feedsOf(st, s);
    if (wall.length !== st.cameras.length) t.problem("bug", `${path}: ${wall.length} feeds on the page, ${st.cameras.length} cameras`);
    for (const f of wall) if (f.dataset.state !== feeds[f.dataset.camera]) t.problem("bug", `${path}: camera ${f.dataset.camera} shows "${f.dataset.state}", the scene says "${feeds[f.dataset.camera]}"`);
    const marked = doc.querySelector("[data-canon]");
    if (!marked) t.problem("bug", `${path}: the canonical state isn't marked on the page`);
    else {
      const flags = (marked.querySelector(".canon-flags")?.textContent || "").replace(/^Flags:\s*/, "");
      const want = Object.keys(canon.state.flags).sort().join(", ") || "none";
      if (flags !== want) t.problem("bug", `${path}: the marked state has flags "${flags}", the shortest way gives "${want}"`);
    }
    const lines = [...doc.querySelectorAll(".passage-lines li")].map((li) => li.textContent);
    if (lines.length !== s.lines.length) t.problem("bug", `${path}: ${lines.length} lines on the page, the scene has ${s.lines.length}`);
    // The recordings are not loaded with the page (preload none): each is asked for, and must be there.
    const audio = [...doc.querySelectorAll(".passage-lines audio")].map((a) => a.getAttribute("src"));
    const codes = await Promise.all(audio.map(head));
    audio.forEach((src, i) => codes[i] !== 200 && t.problem("bug", `${path}: line ${i + 1}'s recording ${src} is missing (HTTP ${codes[i]})`));
    const links = [...doc.querySelectorAll(".spark-choices a.choice")].map((a) => ({ label: a.textContent.trim(), to: pathOf(a.getAttribute("href"), location.origin + path) }));
    const locked = [...doc.querySelectorAll(".spark-choices .choice.is-locked")];
    const open = s.choices.filter((c) => R.usable(c, canon.state)).length;
    if (links.length !== open || links.length + locked.length !== s.choices.length) t.problem("bug", `${path}: ${links.length} links and ${locked.length} locked choices, the scene has ${s.choices.length} (${open} open in the marked state)`);
    t.event("page", `${path}: ${links.length} choices, ${locked.length} locked`);
    if (!links.length && !s.ending) t.problem("warning", `${path}: no open choice in its marked state`);
    return links;
  };

  // Every page, level by level, eight at a time.
  let level = [first];
  while (level.length) {
    const batch = [...new Set(level)].filter((p) => !mine.has(p)); // a page reached from several parents is read once (without the Set the level grew with every way into a page: 13,066 pages read for 228)
    batch.forEach((p) => mine.add(p));
    level = [];
    for (let k = 0; k < batch.length; k += 8) {
      const part = batch.slice(k, k + 8);
      const docs = await Promise.all(part.map(read));
      for (let n = 0; n < part.length; n++) {
        const path = part[n];
        done.add(path);
        t.scene(path);
        t.progress(done.size / total);
        t.add("pagesOpened");
        if (!docs[n]) {
          t.problem("bug", `${path}: page missing (from ${parent.get(path) || "the home page"})`);
          continue;
        }
        if (isMissingPage(docs[n])) {
          t.problem("bug", `${path}: opened the not-found page`);
          continue;
        }
        for (const l of await check(path, docs[n])) {
          if ((await pageExists(l.to)) !== 200) {
            t.problem("bug", `${path}: choice "${l.label}" links to ${l.to}, which doesn't exist`);
            continue;
          }
          if (!parent.has(l.to)) parent.set(l.to, path);
          if (!mine.has(l.to)) level.push(l.to);
        }
      }
    }
  }
  // A page no link of the marked states leads to is an orphan only when no scene's choice points at it; one reached only
  // in another state (a gated choice, locked in the marked state) is listed as an event: its way there is played by `branches`.
  const pointedAt = new Set(Object.values(st.scenes).flatMap((sc) => sc.choices.map((c) => c[2])));
  const notLinked = Object.keys(st.scenes).filter((id) => !mine.has(pageOf(id)));
  notLinked.filter((id) => !pointedAt.has(id)).forEach((id) => t.problem("warning", `${pageOf(id)}: no choice of any scene leads here (orphan page)`));
  if (notLinked.some((id) => pointedAt.has(id))) t.event("other-state-pages", `${notLinked.filter((id) => pointedAt.has(id)).length} page(s) are reached only in other states than the marked ones (a locked choice in the marked state): ${notLinked.filter((id) => pointedAt.has(id)).slice(0, 6).map(pageOf).join(", ")}...`);
  if ((await status(`/${st.id}/`)) !== 200) t.problem("bug", `/${st.id}/ (${st.title}'s link) is missing`);

  // The pages a viewer meets first, in the frame: the start, then the endings.
  const sample = [first, ...Object.keys(st.scenes).filter((id) => st.scenes[id].ending).slice(0, 3).map(pageOf)];
  for (const path of sample) {
    t.scene(`${path} (in the frame)`);
    const doc = await openByClick(t, null, path);
    if (isMissingPage(doc)) {
      t.problem("bug", `${path}: opened the not-found page`);
      continue;
    }
    await waitFor(() => soundOf(doc), 3000);
    await passPrompt(t, doc, path);
    const a = doc.querySelector(".passage-lines audio");
    if (a) {
      a.preload = "metadata";
      a.load();
      if (!(await waitFor(() => a.readyState >= 1 || a.error, 8000)) || a.error) t.problem("bug", `${path}: a line's audio didn't load (${a.src})`);
    }
    t.add("pagesOpened");
  }
}

/* ---------------- Night Shift: the whole night (story/night-shift.json), by its numbers and by real presses ---------------- */

/** How long each way through the night is to listen to, on the shared state rules: the shortest, the longest and the
    average (every open choice equally likely). A line is its recording (the build's own `dur`) plus the player's 0.35 s gap before the next (`GAP` in js/console.js). */
const lengthsCache = new Map();
function nightLengths(st) {
  // Warmed by consoleWarm (sliced, and kept in sessionStorage); only worked out here, in one go, if nothing warmed it.
  if (!lengthsCache.has(st.id)) lengthsCache.set(st.id, lengthsStored(st) || rulesOf().lengths(st));
  return lengthsCache.get(st.id);
}
/** The lengths kept for this story's data in sessionStorage (so `console` and `night-shift-signoff` in one tab don't both
    pay for them); keyed by a sum of the story's lines so edited data is never answered from the old numbers. */
function lengthsKey(st) {
  let h = 0;
  for (const [id, sc] of Object.entries(st.scenes)) for (const c of [id, JSON.stringify(sc.choices), ...sc.lines.map((l) => l.dur)]) for (let i = 0; i < String(c).length; i++) h = (h * 31 + String(c).charCodeAt(i)) | 0;
  return `iltv.playtest.lengths.${st.id}.${h}`;
}
function lengthsStored(st) {
  try {
    const v = JSON.parse(sessionStorage.getItem(lengthsKey(st)) || "null");
    return v && typeof v.shortest === "number" ? v : null;
  } catch { return null; }
}
function lengthsStore(st, v) {
  try { sessionStorage.setItem(lengthsKey(st), JSON.stringify(v)); } catch { /* full or refused: just not kept */ }
}

/** One way through every reveal layer of the trainer (stages in the order they come in the night) that ends on "Someone to leave it to":
    every (scene, state) found at one layer is a source for the next, so a route that is shortest to a layer can't block the next one. */
function nightLayerWay(st, R, stages) {
  let sources = [{ id: st.start, state: R.fresh(st), parent: null, pick: null }];
  for (const targets of [...stages, ["end-someone"]]) {
    const seen = new Set();
    const found = new Map();
    for (let q = 0; q < sources.length; q++) {
      const at = sources[q];
      const key = `${at.id}#${R.stateKey(at.state)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (targets.includes(at.id)) { if (!found.has(key)) found.set(key, at); continue; }
      st.scenes[at.id].choices.forEach((c, i) => { if (R.usable(c, at.state)) sources.push({ id: c[2], state: R.apply(st, at.state, c), parent: at, pick: i }); });
    }
    sources = [...found.values()];
    if (!sources.length) return null;
  }
  const picks = [];
  for (let a = sources[0]; a.parent; a = a.parent) picks.unshift(a.pick);
  return picks;
}

/** A way through the night, played with real presses from a new run; the minutes of audio it holds are the data's. */
async function nightPlay(t, st, lengths, label, picks) {
  const where = `${st.id}: ${label}`;
  await consoleFresh(t, st);
  const m = consoleModel(st);
  t.scene(where);
  await consoleHeard(t, document, where);
  consoleCheck(t, st, m, document, where);
  let seconds = lengths.dur[m.scene];
  let visited = 1;
  for (const i of picks) {
    await consoleChoose(t, st, m, i, document, where);
    seconds += lengths.dur[m.scene];
    visited++;
  }
  const end = st.scenes[m.scene].ending;
  if (!end) t.problem("bug", `${where}: the way ended at ${m.scene}, which is not an ending`);
  else {
    t.event("night-path", `${label}: ${visited} scenes, ${(seconds / 60).toFixed(1)} minutes of audio, ends at "${end[0]}" (${m.scene})`);
    if (stories().run(st.id) !== "end") t.problem("bug", `${where}: at an ending the run says "${stories().run(st.id)}", not end`);
  }
  return { seconds, visited, ending: end && end[0] };
}

async function nightShiftRun(options, t) {
  rememberProgress();
  const st = consoleStories().find((s) => s.id === ((options && options.story) || "night-shift"));
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  if (!st) throw new Error("no console story night-shift in js/story-data.js");
  await passPrompt(t);
  clearProgress();
  const R = rulesOf();
  try {
    // 1. The numbers, from the data: endings, no dead ends, how long the night is, who speaks, what is never said.
    t.scene(`${st.title}: the night in numbers`);
    const x = consoleExplore(st);
    const ids = Object.keys(st.scenes);
    const endings = Object.entries(st.scenes).filter(([, sc]) => sc.ending);
    t.metric("scenes", ids.length);
    t.metric("endings", endings.length);
    t.event("explored", `${st.id}: ${x.states} states${x.capped ? " (stopped at the cap)" : ""}, ${Object.keys(x.scenes).length}/${ids.length} scenes reachable`);
    if (x.capped) t.problem("bug", `${st.id}: more than ${st.stateCap || 50000} states, so the state check below is incomplete`);
    ids.filter((id) => !x.scenes[id]).forEach((id) => t.problem("bug", `${st.id}/${id}: no state reaches this scene`));
    x.stuck.forEach((b) => t.problem("bug", `${st.id}/${b.scene}: no usable choice when ${sayState(b.state)}`));
    for (const [id, sc] of endings) {
      const way = x.scenes[id];
      if (!way) t.problem("bug", `${st.id}: the ending ${sc.ending[0]} (${id}) can't be reached`);
      else t.event("ending-reachable", `${sc.ending[0]} (${id}): ${way.picks.length} choices on its shortest way`);
    }
    if (endings.length < 8) t.problem("bug", `${st.id}: ${endings.length} endings, the night needs at least 8`);
    else t.event("criterion", `${endings.length} distinct endings, every one reached by a different mix of choices`);
    // Every choice does something: the build proves it (a flag, a meter, a scene of its own or a log line); count the ones whose only change is a scene.
    let quiet = 0;
    let silent = 0;
    for (const [id, sc] of Object.entries(st.scenes)) sc.choices.forEach((c, i) => {
      const u = x.used[`${id}#${i}`];
      if (!u || u.changes) return;
      if (!u.branch && !(c[3] && c[3].log)) silent++;
      else if (!(st.scenes[c[2]] && st.scenes[c[2]].ending)) quiet++;
    });
    t.metric("choicesThatChangeNothing", silent);
    t.event("criterion", `${silent} choices change nothing (no flag, meter, scene of their own or log line); ${quiet} more only open a scene of their own, never ending the story, and are the build's routing buttons`);
    if (silent) t.problem("bug", `${st.id}: ${silent} choices change nothing`);
    // The trainer's reveal layers: each has a scene a way reaches, and one way meets them all and ends on the spring.
    const LAYERS = [["the pencil", ["sign-why", "sign-why-44"]], ["the spring", ["drawer-notice"]], ["the four hours", ["four-hours"]], ["twelve", ["twelve"]]];
    for (const [name, ids] of LAYERS) {
      const own = ids.filter((id) => x.scenes[id]).sort((a, b) => x.scenes[a].picks.length - x.scenes[b].picks.length)[0];
      if (!own) t.problem("bug", `${st.id}: the trainer's layer "${name}" (${ids.join(" or ")}) can't be reached`);
      else t.event("reveal-layer", `${name}: ${own} is ${x.scenes[own].picks.length} choices from the start`);
    }
    const layerPicks = nightLayerWay(st, R, LAYERS.map(([, ids]) => ids));
    if (!layerPicks) t.problem("bug", `${st.id}: no one way meets every layer of the trainer and ends on "Someone to leave it to"`);
    else t.event("criterion", `one way (${layerPicks.length} choices) meets every layer of the trainer (the pencil, the spring, the four hours, twelve) and ends on "Someone to leave it to"`);
    t.progress(0.1);

    const lengths = nightLengths(st);
    const minutes = (s) => Math.round((s / 60) * 10) / 10;
    t.metric("shortestMinutes", minutes(lengths.shortest));
    t.metric("averageMinutes", minutes(lengths.mean));
    t.metric("longestMinutes", minutes(lengths.longest));
    t.event("criterion", `playing time: shortest ${minutes(lengths.shortest)} min, average ${minutes(lengths.mean)} min (every open choice equally likely), longest ${minutes(lengths.longest)} min (words at 150 a minute plus a pause per line)`);
    if (lengths.shortest < 30 * 60) t.problem("bug", `${st.id}: the shortest way through is ${minutes(lengths.shortest)} minutes, not 30`);
    if (lengths.mean < 40 * 60 || lengths.mean > 50 * 60) t.problem("warning", `${st.id}: the average way through is ${minutes(lengths.mean)} minutes, not about 45`);

    // Chapters: on the shortest path a card appears at least every 12 minutes of audio.
    const chapters = st.chapters || [];
    if (chapters.length && lengths.shortestWay) {
      t.scene(`${st.title}: chapter gaps on the shortest way`);
      const durOf = (id) => (st.scenes[id].lines || []).reduce((a, l) => a + (l.dur || 0), 0);
      let cum = 0, cur = st.start;
      const atScene = {};
      for (const pick of lengths.shortestWay) {
        cum += durOf(cur);
        atScene[cur] = cum;
        cur = st.scenes[cur].choices[pick][2];
      }
      cum += durOf(cur);
      atScene[cur] = cum;
      let prevCum = 0;
      for (const ch of chapters) {
        if (!ch.end) continue;
        const atEnd = atScene[ch.end];
        if (atEnd == null) { t.problem("warning", `${st.id}: chapter "${ch.id}" end ${ch.end} is not on the shortest way`); continue; }
        const gapMin = (atEnd - prevCum) / 60;
        t.event("chapter-gap", `${ch.id} ends at ${ch.end}: ${gapMin.toFixed(1)} min of audio since last break`);
        t.metric(`chapterGapMin.${ch.id}`, Number(gapMin.toFixed(2)));
        if (gapMin > 12) t.problem("bug", `${st.id}: chapter "${ch.id}" is ${gapMin.toFixed(1)} min of audio after the previous break (over 12)`);
        prevCum = atEnd;
      }
    }

    // Pierce Hawkes once, briefly; nothing about B3, the vat or the creature.
    const spoken = Object.entries(st.scenes).flatMap(([id, sc]) => sc.lines.map((l) => ({ id, ...l })));
    const pierce = spoken.filter((l) => l.speaker === "pierce");
    const pierceScenes = [...new Set(pierce.map((l) => l.id))];
    t.event("criterion", `Pierce Hawkes speaks ${pierce.length} line(s), in ${pierceScenes.join(" and ") || "no scene"}: ${pierce.map((l) => `"${l.text}"`).join(" / ")}`);
    if (!pierce.length) t.problem("bug", `${st.id}: Pierce Hawkes never appears`);
    if (pierce.length > 2) t.problem("bug", `${st.id}: Pierce Hawkes has ${pierce.length} lines, the cameo is two`);
    for (const id of ids) {
      const sc = st.scenes[id];
      const everything = [sc.title[0], sc.log, sc.ending && sc.ending[0], ...sc.lines.map((l) => l.text), ...sc.choices.map((c) => `${c[0]} ${(c[3] && c[3].log) || ""}`)].filter(Boolean).join(" ");
      if (/\bb3\b|\bvat\b|creature|chimera|specimen|laboratory|experiment|restricted/i.test(everything)) t.problem("bug", `${st.id}/${id}: mentions the restricted work (B3, the vat, the creature...)`);
    }
    t.event("criterion", "no scene, line, choice or log entry mentions B3, the vat, the creature or the restricted work");

    // 2. Real presses: the shortest way, the longest way, and two different endings, from a new run each.
    // {"at":"numbers"} stops here (the data's checks, about 10 s); {"at":"<scene id on the layer way>"} (e.g. "four-hours") plays only the
    // last stretch of the way through every layer, from a seeded run at that scene, and the last choices to "The wedge".
    const at = options && options.at;
    if (at === "numbers") { t.event("start-at", "numbers: the data's checks only, no way played"); return; }

    // {"at":"pace"}: first choice within 30 s (listening), ink within 2 s, chapter card + Continue — the acceptance criteria.
    if (at === "pace") {
      t.event("start-at", "pace: first choice, ink, chapter Continue");
      for (const [w, h, label] of [[1280, 720, "1280x720"], [390, 844, "390x844"]]) {
        t.scene(`${st.title}: first choice at ${label}`);
        clearProgress();
        const doc = await viewFrameLoad(t, `/?story=${st.id}`, w, h);
        const win = doc.defaultView;
        try { win.localStorage.removeItem(`iltv.run.${st.cookie}`); } catch (e) { /* none */ }
        const sound = win.hawkesSound;
        if (sound && sound.prompt && sound.prompt()) await passPrompt(t, doc, `${st.id} ${label}`);
        const t0 = performance.now();
        const ready = await waitFor(() => [...doc.querySelectorAll("#console-choices .choice")].some((b) => b.offsetParent !== null), 35000);
        const secs = (performance.now() - t0) / 1000;
        t.metric(`secondsToFirstChoice.${st.id}.${label}`, Number(secs.toFixed(2)));
        t.event("first-choice", `${label}: ${ready ? secs.toFixed(1) : "NONE"} s (listening, no Skip)`);
        if (!ready) t.problem("bug", `${st.id} @ ${label}: no choice within 35 s of Tap to play`);
        else if (secs > 30) t.problem("bug", `${st.id} @ ${label}: first choice after ${secs.toFixed(1)} s (over 30 s)`);
        else {
          const btns = [...doc.querySelectorAll("#console-choices .choice")].filter((b) => b.offsetParent !== null);
          for (const b of btns) {
            const r = b.getBoundingClientRect();
            if (r.height < 48) t.problem("bug", `${label}: choice "${(b.textContent || "").trim()}" is ${Math.round(r.height)} px tall (need 48)`);
            if (r.bottom > h + 1 || r.right > w + 1 || r.left < -1) t.problem("bug", `${label}: choice clipped`);
          }
          t.event("screenshot", `${label}: first Night Shift choices`);
          const good = btns.find((b) => /good chair/i.test(b.textContent || "")) || btns[0];
          let inkMs = null;
          const tPress = performance.now();
          const onInk = () => { if (inkMs == null) inkMs = Math.round(performance.now() - tPress); };
          doc.addEventListener("iltv:ink", onInk);
          await tapAt(t, good, `${label}: take a chair`);
          await waitFor(() => inkMs != null || (win.iltvConsole && win.iltvConsole.scene() !== st.start), 5000);
          await sleep(250);
          const inkEl = doc.getElementById("console-ink");
          if (inkEl && !inkEl.hidden) {
            const ir = inkEl.getBoundingClientRect();
            if (ir.bottom > h + 1 || ir.right > w + 1) t.problem("bug", `${label}: ink line clipped`);
            t.event("screenshot", `${label}: ink line`);
          }
          doc.removeEventListener("iltv:ink", onInk);
          if (inkMs == null) t.problem("bug", `${label}: no ink after the first trust choice`);
          else {
            t.metric("choiceInkMs", inkMs);
            t.event("choice-ink", `${label}: ink ${inkMs} ms`);
            if (inkMs > 2000) t.problem("bug", `${label}: ink took ${inkMs} ms (over 2 s)`);
          }
        }
        closeViewFrame();
      }
      if (chapters.length && chapters[0].end && x.scenes[chapters[0].end]) {
        t.scene(`${st.title}: Continue resumes at chapter after card`);
        await consoleOpen(t, st);
        const way = x.scenes[chapters[0].end].picks;
        const m = await consoleSeedAt(t, st, way.slice(0, Math.max(0, way.length - 1)), null);
        await consoleHeard(t, document, "chapter continue");
        let sawChapter = false;
        const onCh = () => { sawChapter = true; };
        document.addEventListener("iltv:chapter", onCh);
        await consoleChoose(t, st, m, way[way.length - 1], document, "chapter end", null, { hear: false });
        document.removeEventListener("iltv:chapter", onCh);
        if (!sawChapter) t.problem("bug", `${st.id}: no chapter card when leaving ${chapters[0].end}`);
        const afterScene = window.iltvConsole.scene();
        t.event("chapter-landed", `after card at ${afterScene}`);
        const chCard = document.getElementById("console-chapter");
        if (chCard && !chCard.hidden) {
          const cr = chCard.getBoundingClientRect();
          if (cr.bottom > window.innerHeight + 1 || cr.right > window.innerWidth + 1) t.problem("bug", "chapter card clipped on desktop");
        }
        await toLanding(t);
        await sleep(200);
        const go = continueControl(document, st.id);
        if (!go) t.problem("bug", `${st.id}: no Continue after chapter card`);
        else {
          await tapAt(t, go, "Continue after chapter");
          await sleep(300);
          if (soundOf().prompt()) await passPrompt(t, document, "chapter continue");
          const recap = document.getElementById("story-recap");
          if (recap && !recap.hidden) { await tapAt(t, recap, "skip Previously"); await sleep(400); }
          await waitFor(() => window.iltvConsole && window.iltvConsole.story() === st.id, 4000);
          const landed = window.iltvConsole.scene();
          t.event("chapter-continue", `Continue landed at ${landed} (left at ${afterScene})`);
          if (landed !== afterScene) t.problem("bug", `${st.id}: Continue after chapter landed at ${landed}, not ${afterScene}`);
        }
      }
      t.progress(1);
      return;
    }

    await consoleOpen(t, st);
    if (at) {
      t.event("start-at", `${at}: seeded run at that scene on the way through every layer, then real presses to the end`);
      if (!layerPicks) return;
      const m0 = consoleModel(st);
      let k = -1;
      for (let n = 0; n <= layerPicks.length; n++) {
        if (m0.scene === at) { k = n; break; }
        if (n < layerPicks.length) m0.choose(layerPicks[n]);
      }
      if (k < 0) return t.problem("bug", `${st.id}: the way through every layer never passes ${at}`);
      const where = `${st.id}: from ${at} to "Someone to leave it to"`;
      const m = await consoleSeedAt(t, st, layerPicks.slice(0, k), null);
      await consoleHeard(t, document, where);
      consoleCheck(t, st, m, document, where, null);
      let seconds = lengths.dur[m.scene];
      for (const i of layerPicks.slice(k)) { await consoleChoose(t, st, m, i, document, where, null); seconds += lengths.dur[m.scene]; }
      const end = st.scenes[m.scene].ending;
      if (!end) t.problem("bug", `${where}: the way ended at ${m.scene}, which is not an ending`);
      else t.event("night-path", `${where}: ${layerPicks.length - k} choices played, ${(seconds / 60).toFixed(1)} minutes of audio, ends at "${end[0]}" (${m.scene})`);
      if (end && stories().run(st.id) !== "end") t.problem("bug", `${where}: at an ending the run says "${stories().run(st.id)}", not end`);
      if (x.scenes["end-wedge"]) {
        const way = x.scenes["end-wedge"].picks;
        const back = Math.min(6, way.length);
        const w = `${st.id}: the last ${back} choices to "${st.scenes["end-wedge"].ending[0]}"`;
        const mw = await consoleSeedAt(t, st, way.slice(0, way.length - back), null);
        await consoleHeard(t, document, w);
        consoleCheck(t, st, mw, document, w, null);
        for (const i of way.slice(way.length - back)) await consoleChoose(t, st, mw, i, document, w, null);
        if (mw.scene !== "end-wedge") t.problem("bug", `${w}: ended at ${mw.scene}`);
        else t.event("night-path", `${w}: ends at "${st.scenes[mw.scene].ending[0]}"`);
      }
      return;
    }
    const plays = [["the shortest way", lengths.shortestWay], ["the longest way", lengths.longestWay]];
    if (layerPicks) plays.push(['the way through every layer of the trainer, to "Someone to leave it to"', layerPicks]);
    else if (x.scenes["end-someone"]) plays.push([`the way to "${st.scenes["end-someone"].ending[0]}"`, x.scenes["end-someone"].picks]);
    if (x.scenes["end-wedge"]) plays.push([`the way to "${st.scenes["end-wedge"].ending[0]}"`, x.scenes["end-wedge"].picks]);
    const results = [];
    for (const [label, picks] of plays) {
      results.push(await nightPlay(t, st, lengths, label, picks));
      t.progress(0.1 + (0.85 * results.length) / plays.length);
    }
    const endsMet = new Set(results.map((r) => r.ending).filter(Boolean));
    t.event("criterion", `played ${results.length} different ways to ${endsMet.size} different endings: ${results.map((r) => `${r.visited} scenes / ${(r.seconds / 60).toFixed(1)} min`).join(", ")}`);
    if (endsMet.size < results.length) t.problem("bug", `${st.id}: the played ways ended at only ${endsMet.size} different endings`);
  } finally {
    await sleep(300);
    await toLanding(t).catch(() => {});
  }
}

/* ---------------- Night Shift gaps audit: story/night-shift-gaps.md against the live data, after the story is opened with real presses ---------------- */

/** Opens Night Shift with real presses (its card, then its Tap to play), presses Settings, then reads story/night-shift-gaps.md
    and checks it: groups (a) to (f) with numbered gaps, the counts it states against js/story-data.js, the shortest and typical
    minutes against nightLengths, and the output of `npm run story -- --check` and of the console, stories and sound playtests
    (or an honest "not run" for each, a warning). Options: {"at":"gaps"} reads the file without opening the story (about 5 s). */
async function nightGapsRun(options, t) {
  rememberProgress();
  const st = consoleStories().find((s) => s.id === ((options && options.story) || "night-shift"));
  if (!st) throw new Error("no console story night-shift in js/story-data.js");
  const only = !!(options && options.at === "gaps");
  try {
    if (only) t.event("start-at", "gaps");
    else {
      await passPrompt(t);
      clearProgress();
      t.scene(`${st.title}: opened with real presses`);
      await consoleOpen(t, st);
      await openSettings(t, st.title);
      await tapAt(t, $("sound-done"), "Done");
      t.event("criterion", `${st.title} opened and its Settings pressed (group d's controls)`);
    }
    t.scene("story/night-shift-gaps.md");
    const res = await fetch("/story/night-shift-gaps.md", { cache: "no-store" });
    if (!res.ok) throw new Error(`story/night-shift-gaps.md: HTTP ${res.status}`);
    const doc = await res.text();
    const items = {};
    let group = null;
    for (const line of doc.split("\n")) {
      const g = line.match(/^## \(([a-f])\)/);
      if (g) { group = g[1]; items[group] = 0; continue; }
      if (/^## /.test(line)) group = null;
      if (group && /^\d+\. /.test(line)) items[group]++;
    }
    for (const g of "abcdef") {
      if (!(g in items)) t.problem("bug", `night-shift-gaps.md: group (${g}) is missing`);
      else if (!items[g]) t.problem("bug", `night-shift-gaps.md: group (${g}) has no numbered gap`);
      else t.event("criterion", `group (${g}): ${items[g]} numbered gaps`);
    }
    t.metric("gapsListed", Object.values(items).reduce((a, b) => a + b, 0));
    const scenes = Object.values(st.scenes);
    const counts = [["scenes", scenes.length], ["lines", scenes.reduce((a, s) => a + s.lines.length, 0)], ["endings", scenes.filter((s) => s.ending).length]];
    for (const [what, n] of counts) {
      const say = n.toLocaleString("en-US");
      if (!doc.includes(`${say} ${what}`)) t.problem("bug", `night-shift-gaps.md doesn't state ${say} ${what}, which is what the data has`);
      else t.event("criterion", `the file states ${say} ${what}, as the data has`);
    }
    const lengths = nightLengths(st);
    const minutes = (x) => (Math.round((x / 60) * 10) / 10).toFixed(1);
    const sm = doc.match(/[Ss]hortest[^.\n]*?\*\*([\d.]+) minutes\*\*/);
    const tm = doc.match(/[Tt]ypical[^.\n]*?\*\*([\d.]+) minutes\*\*/);
    if (!sm) t.problem("bug", "night-shift-gaps.md doesn't state the shortest path in minutes");
    else if (sm[1] !== minutes(lengths.shortest)) t.problem("bug", `night-shift-gaps.md says the shortest path is ${sm[1]} minutes, the data gives ${minutes(lengths.shortest)}`);
    else t.event("criterion", `shortest path ${sm[1]} minutes, as the data gives`);
    if (!tm) t.problem("bug", "night-shift-gaps.md doesn't state the typical path in minutes");
    else if (tm[1] !== minutes(lengths.mean)) t.problem("bug", `night-shift-gaps.md says the typical path is ${tm[1]} minutes, the data gives ${minutes(lengths.mean)}`);
    else t.event("criterion", `typical path ${tm[1]} minutes, as the data gives`);
    const appendix = doc.split(/^## Appendix/m)[1] || "";
    if (!appendix) t.problem("bug", "night-shift-gaps.md has no Appendix");
    if (!/npm run story -- --check[\s\S]*?ok\s+\d+ stories, \d+ scenes/.test(appendix)) t.problem("bug", "night-shift-gaps.md doesn't include the output of npm run story -- --check");
    else t.event("criterion", "the output of npm run story -- --check is in the file");
    const sec = (appendix.match(/### Playtests[^\n]*\n([\s\S]*)/) || [])[1] || "";
    for (const id of ["console", "stories", "sound"]) {
      // Each playtest has its own "#### <id>" section, up to the next heading: a report in another section doesn't count.
      const part = (sec.match(new RegExp(`#### ${id}\\b[^\\n]*\\n([\\s\\S]*?)(?=\\n#{3,4} |$)`)) || [])[1];
      if (!part) t.problem("bug", `night-shift-gaps.md says nothing about the ${id} playtest`);
      else if (/Not run here/i.test(part)) t.problem("warning", `night-shift-gaps.md has no report of the ${id} playtest, only that it was not run`);
      else if (/outcome \*\*\w+\*\*[\s\S]*problems/i.test(part)) t.event("criterion", `the ${id} playtest's report is in the file: ${(part.match(/outcome \*\*(\w+)\*\* in ([\d.]+) s, (\d+) problems/) || []).slice(1).join(" / ")}`);
      else t.problem("bug", `night-shift-gaps.md's ${id} section has no report (an outcome and its problems) and doesn't say it was not run`);
    }
  } finally {
    await sleep(200);
    if (!only) await toLanding(t).catch(() => {});
    restoreProgress();
  }
}

/* ---------------- Writing pass: each story's voice guide (docs/<id>/voice.md) and the diff summary (docs/voice-diff.md) ---------------- */

/** Reads docs/<id>/voice.md for every story (a "Style note: 5 rules" with exactly 5 numbered rules), checks every node's
    choices lead to a node that exists (nothing removed by the writing pass), no listed story's choice says a bare "Continue",
    and docs/voice-diff.md lists a "Changed nodes" count per story and each changed node by name. No story is played. */
async function voiceRun(options, t) {
  await passPrompt(t);
  const stories = allStories();
  for (const st of stories.filter((s) => s.listed !== false)) {
    t.scene(`${st.id}: docs/${st.id}/voice.md`);
    const res = await fetch(`/docs/${st.id}/voice.md`, { cache: "no-store" });
    if (!res.ok) { t.problem("bug", `docs/${st.id}/voice.md: HTTP ${res.status}`); continue; }
    const doc = await res.text();
    const sec = (doc.split(/^## Style note: 5 rules\s*$/m)[1] || "").split(/^## /m)[0];
    const rules = sec.split("\n").filter((l) => /^\d+\. /.test(l));
    if (!sec) t.problem("bug", `docs/${st.id}/voice.md has no "Style note: 5 rules" section`);
    else if (rules.length !== 5) t.problem("bug", `docs/${st.id}/voice.md has ${rules.length} rules, not 5`);
    else t.event("criterion", `${st.id}: a style note with 5 rules`);
    for (const h of ["Tone", "Pacing", "Choice design"]) if (!new RegExp(`^## ${h}\\s*$`, "m").test(doc)) t.problem("bug", `docs/${st.id}/voice.md has no "${h}" section`);
    const scenes = Object.values(st.scenes);
    const ids = new Set(Object.keys(st.scenes));
    let missing = 0;
    for (const s of scenes) for (const c of s.choices || []) if (!ids.has(c[2])) missing++;
    if (missing) t.problem("bug", `${st.id}: ${missing} choices lead to a node that doesn't exist`);
    else t.event("criterion", `${st.id}: ${scenes.length} nodes, every choice leads to one`);
    t.metric(`nodes_${st.id}`, scenes.length);
  }
  t.scene("docs/voice-diff.md");
  const res = await fetch("/docs/voice-diff.md", { cache: "no-store" });
  if (!res.ok) { t.problem("bug", `docs/voice-diff.md: HTTP ${res.status}`); return; }
  const diff = await res.text();
  for (const st of stories.filter((s) => s.listed !== false)) {
    const part = (diff.split(new RegExp(`^## ${st.id}\\s*$`, "m"))[1] || "").split(/^## /m)[0];
    const m = part.match(/Changed nodes: (\d+)/);
    if (!m) t.problem("bug", `docs/voice-diff.md has no changed-nodes list for ${st.id}`);
    else if ((part.match(/^\s+- `[^`]+`/gm) || []).length !== +m[1]) t.problem("bug", `docs/voice-diff.md: ${st.id} says ${m[1]} changed nodes but lists ${(part.match(/^\s+- `[^`]+`/gm) || []).length}`);
    else t.event("criterion", `${st.id}: diff summary lists ${m[1]} changed nodes`);
  }
}

/* ---------------- Night Shift sign-off: every ending, played to the end with real presses, at the desktop size and at three phone sizes ---------------- */

/** Every ending of the night, by its shortest way, played with real presses (Skip line moves the lines along) at the
    page's own size and in a frame at 390x844, 360x640 and 844x390. At each ending: the minutes of audio the way holds
    (from the recordings), the ending shown, nothing running off the side or hidden (consoleFit), and at every scene the
    choices on screen are exactly the ones whose conditions hold (consoleCheck).
    `{"at":"whole"}` plays each way whole from a new run (about 50 minutes for all 48 plays: the T4's sign-off run).
    The default, like `{"at":"last-choices"}`, starts each play nearer (about 8 minutes): a SEEDED RUN (setup shortcut, event seeded-run) at
    the scene `back` choices (default 2) before the ending, then real presses of those choices and the ending's screen,
    at all four sizes. Options: {"story":"<id>","sizes":"desktop"|"all","only":"<ending scene>","at":"last-choices","back":2}. */
const PLAY_LIMIT_FULL = 8 * 60 * 1000; // one ending from a new run (the longest shortest way holds ~400 lines, skipped)
const PLAY_LIMIT_NEAR = 90 * 1000; // one ending from a seeded run, a few choices
async function nightSignoffRun(options, t) {
  t.scene("signoff: starting");
  t.progress(0.01);
  t.scene("signoff: remembering the viewer's progress");
  rememberProgress();
  const st = consoleStories().find((s) => s.id === ((options && options.story) || "night-shift"));
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  if (!st) throw new Error("no console story night-shift in js/story-data.js");
  t.scene("signoff: waiting for the landing page's splash");
  await boxed(t, "the landing page's splash", passPrompt(t));
  t.scene("signoff: splash passed, clearing progress");
  clearProgress();
  // The quick version is the default (under 10 minutes); the whole unseeded walk is {"at":"whole"}.
  const near = !(options && options.at === "whole");
  const back = Math.max(1, Math.min(6, Number(options && options.back) || 2));
  const runStarted = performance.now();
  t.event("start-at", near ? `last-choices: each ending from a seeded run ${back} choice(s) before it` : "whole: every way pressed from a new run (about 50 minutes)");
  try {
    t.scene("signoff: working out the ways to every ending");
    t.progress(0.02);
    t.event("signoff-prepare", "working out the state explorer's ways to every ending");
    const x = consoleExplore(st); // cached by consoleWarm (sliced); only synchronous if it wasn't
    t.scene("signoff: working out how long each way is");
    const lengths = nightLengths(st);
    t.scene("signoff: ways found");
    t.event("signoff-prepared", "ways to every ending found");
    const endings = Object.entries(st.scenes).filter(([id, sc]) => sc.ending && (!(options && options.only) || options.only === id));
    const want = String((options && options.sizes) || "all").split(","); // "all", "desktop", or names ("desktop,portrait"; part of a phone size's name: portrait, small, landscape) to play just those
    const sizes = [["the desktop size", 0, 0], ...VIEWPORTS.map(([w, h, name]) => [`${name} ${w}x${h}`, w, h])].filter(([name]) => want.includes("all") || (name === "the desktop size" ? want.includes("desktop") : want.some((x) => name.includes(x))));
    t.scene(`signoff: ${endings.length} endings at ${sizes.length} sizes, first play next`);
    t.metric("endings", endings.length);
    t.metric("sizes", sizes.length);
    let done = 0;
    let skipped = 0;
    const toggled = new Set();
    for (const [id, sc] of endings) {
      const way = x.scenes[id];
      if (!way) { t.problem("bug", `${st.id}: the ending ${sc.ending[0]} (${id}) can't be reached`); continue; }
      // The minutes of audio on this way, from the recordings (the lines' dur plus the player's gap): the same for any size.
      const mm = consoleModel(st);
      let seconds = lengths.dur[mm.scene];
      for (const i of way.picks) { mm.choose(i); seconds += lengths.dur[mm.scene]; }
      const seedLen = near ? Math.max(0, way.picks.length - back) : 0;
      for (const [sizeName, w, h] of sizes) {
        const label = `${sc.ending[0]} at ${sizeName}`;
        // Every play has a deadline and says where it is: a stall names the ending, the size and the step.
        const started = performance.now();
        const limit = near ? PLAY_LIMIT_NEAR : PLAY_LIMIT_FULL;
        let step = "starting";
        let over = false; // set when this play is done or cut off: a stalled play that wakes later stops at its next step
        const at = (what) => {
          if (over) throw new Error(`${label}: cut off`);
          step = what;
          t.scene(`${label}: ${what}`); // the runner's line in Studio is this scene (and the note), so it changes at every step
          t.note(`night-shift-signoff: ${label}: ${what}`);
          t.event("signoff-step", `${label}: ${what}`); // an event is progress for the stuck detector; a note is not
          t.progress((done + skipped) / (endings.length * sizes.length));
          if (performance.now() - started > limit) throw new Error(`${label}: over ${Math.round(limit / 1000)} s, stopped at "${what}"`);
        };
        t.event("signoff-start", `${sc.ending[0]} (${id}) at ${sizeName}: ${way.picks.length} choices${seedLen ? `, ${seedLen} seeded` : ""} (play ${done + skipped + 1} of ${endings.length * sizes.length})`);
        // The step is the scene the runner shows, the share of plays done is its progress, and a heartbeat every 20 s says
        // how long this step has been going: the stuck detector (and the job's line in Studio) sees movement at least
        // that often. A play that hangs inside a step (a wait that never resolves) is cut off at its limit, named by step.
        let cut;
        const heart = setInterval(() => {
          const sec = Math.round((performance.now() - started) / 1000);
          t.scene(`${label}: ${step} (${sec} s)`); // the job line is scene + progress: it moves at least every 20 s, even inside one long step
          t.progress(Math.min(0.99, (done + skipped + Math.min(0.95, sec / (limit / 1000))) / (endings.length * sizes.length)));
          t.note(`${label}: ${step}, ${sec} s into this play`);
          t.event("signoff-heartbeat", `${label}: still at "${step}", ${sec} s into this play (limit ${Math.round(limit / 1000)} s)`);
          if (performance.now() - started > limit && cut) cut(new Error(`${label}: over ${Math.round(limit / 1000)} s, stopped at "${step}"`));
        }, 20000);
        const deadline = new Promise((_, reject) => { cut = reject; });
        deadline.catch(() => {});
        const play = async () => {
          let doc = document;
          let m;
          if (!w) {
            at(near ? "seeding the run" : "opening a new run");
            if (near) m = await consoleSeedAt(t, st, way.picks.slice(0, seedLen), null);
            else {
              await consoleFresh(t, st);
              m = consoleModel(st);
            }
          } else {
            // The desktop play left the story open on this page; two copies of the player (this page and the frame) stalled the tab, so the page goes back to the landing first.
            if (!landingShown()) { at("back to the landing page before the frame"); await toLanding(t); }
            at("preparing the saved run");
            if (near) consoleSeedWrite(st, way.picks.slice(0, seedLen), null);
            else {
              document.cookie = `${st.cookie}=; Max-Age=0; Path=/`;
              localStorage.removeItem(RUN_KEY + st.cookie);
            }
            at(`loading the ${w}x${h} frame`);
            doc = await viewFrameLoad(t, `/?story=${st.id}`, w, h, { loadMs: 20000, alive: () => !over });
            at("Tap to play in the frame");
            await consolePrompt(t, doc, label);
            m = consoleModel(st);
            for (const i of way.picks.slice(0, seedLen)) m.choose(i);
          }
          at("hearing the first scene");
          await consoleHeard(t, doc, label);
          consoleCheck(t, st, m, doc, label);
          let pressed = 0;
          for (const i of way.picks.slice(seedLen)) {
            at(`choice ${seedLen + pressed + 1} of ${way.picks.length} at ${m.scene}`);
            await consoleChoose(t, st, m, i, doc, label);
            pressed++;
          }
          at("hearing the last scene");
          await consoleHeard(t, doc, label);
          if (m.scene !== id) t.problem("bug", `${label}: the way ended at ${m.scene}, not ${id}`);
          at("checking the ending screen");
          const shown = byIdIn(doc, "console-ending");
          if (shown.hidden || shown.textContent.trim() !== sc.ending[0]) t.problem("bug", `${label}: the ending isn't shown (it says "${shown.textContent.trim()}")`);
          if (!w && stories().run(st.id) !== "end") t.problem("bug", `${label}: at an ending the run says "${stories().run(st.id)}", not end`);
          await consoleFit(t, doc, `${label}, the end screen`, { endScreen: true });
          // The big screen and the strip can't be pressed (once per size: it checks a layout, not an ending, and on every play it pushed the quick run past its 10 minutes).
          if (!(toggled.has(sizeName) && near)) {
            toggled.add(sizeName);
            at("end screen with a press on the strip and the screen");
            await checkNotEnlargeable(t, doc, label);
            await consoleFit(t, doc, `${label}, the end screen after pressing the strip and the screen`, { endScreen: true });
          }
          t.event("signoff-ending", `${sc.ending[0]} (${id}) at ${sizeName}: ${way.picks.length} choices, ${(seconds / 60).toFixed(1)} minutes of audio on this way${near ? `, the last ${way.picks.length - seedLen} choices pressed after a seeded run` : ", all pressed from a new run"}, ending shown`);
          done++;
        };
        try {
          await Promise.race([play(), deadline]);
        } catch (e) {
          // One play that stalls or fails is a finding named by ending, size and step; the next play still runs.
          skipped++;
          t.problem("bug", `${label}: the play stopped at "${step}": ${e && e.message ? e.message : e}`);
          t.event("signoff-stopped", `${sc.ending[0]} (${id}) at ${sizeName}: at "${step}" after ${Math.round((performance.now() - started) / 1000)} s`);
        } finally {
          over = true;
          clearInterval(heart);
          if (w) closeViewFrame();
        }
        t.progress((done + skipped) / (endings.length * sizes.length));
      }
    }
    t.metric("endingsPlayed", done);
    const minutes = (performance.now() - runStarted) / 60000;
    t.metric("signoffMinutes", Number(minutes.toFixed(1)));
    t.event("signoff-time", `${done} plays in ${minutes.toFixed(1)} minutes (${near ? "last-choices: under 10 minutes" : "whole ways: about 50 minutes, an explicit option"})`);
    if (near && minutes >= 10) t.problem("bug", `night-shift-signoff at last-choices took ${minutes.toFixed(1)} minutes, over the 10 it has`);
    if (skipped) t.problem("bug", `${skipped} of ${endings.length * sizes.length} sign-off plays stopped before the ending (see the signoff-stopped events)`);
    else t.event("criterion", `${endings.length} endings played to the end at ${sizes.length} sizes (${sizes.map((z) => z[0]).join(", ")}): ${done} plays`);
  } finally {
    closeViewFrame();
    await sleep(300);
    await toLanding(t).catch(() => {});
  }
}

/* ---------------- Night Shift: the voices and sounds (every line has its recording, one voice per speaker, even loudness) ---------------- */

/** Loudness of a file in dBFS RMS (a rough match of what the ear reads), decoded in the page. */
async function rmsDb(ctx, url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const audio = await ctx.decodeAudioData(buf);
  let sum = 0;
  let n = 0;
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < d.length; i += 2) { sum += d[i] * d[i]; n++; }
  }
  return { db: 10 * Math.log10(sum / Math.max(1, n) + 1e-12), seconds: audio.duration };
}

/** A loop's seam: the step from its last sample to its first against a typical step inside it, and the level of its
    last and first quarter second. A click or a jump shows in either. */
async function seamOf(ctx, url) {
  const audio = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
  const d = audio.getChannelData(0);
  let sq = 0;
  for (let i = 1; i < d.length; i++) sq += (d[i] - d[i - 1]) * (d[i] - d[i - 1]);
  const step = Math.sqrt(sq / d.length);
  const q = Math.floor(audio.sampleRate / 4);
  const rms = (a, b) => { let x = 0; for (let i = a; i < b; i++) x += d[i] * d[i]; return 10 * Math.log10(x / Math.max(1, b - a) + 1e-12); };
  return { jump: Math.abs(d[0] - d[d.length - 1]), step, levelGap: Math.abs(rms(0, q) - rms(d.length - q, d.length)), seconds: audio.duration };
}

async function nightAudioRun(options, t) {
  rememberProgress();
  const st = consoleStories().find((s) => s.id === ((options && options.story) || "night-shift"));
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  if (!st) throw new Error("no console story night-shift in js/story-data.js");
  await passPrompt(t);
  clearProgress();
  const between = options && options.at === "between"; // {"at":"between"}: only the hand-over between scenes (about 40 s)
  try {
   if (!between) {
    // 1. Every spoken line and cue has a recording that loads.
    t.scene(`${st.title}: every line and cue has its recording`);
    const lines = Object.entries(st.scenes).flatMap(([id, sc]) => sc.lines.map((l, i) => ({ id, n: i + 1, ...l })));
    const bySpeaker = {};
    for (const l of lines) (bySpeaker[l.speaker] = bySpeaker[l.speaker] || []).push(l);
    const missing = lines.filter((l) => !l.file);
    t.metric("lines", lines.length);
    t.metric("linesWithoutRecording", missing.length);
    t.event("criterion", `${lines.length - missing.length} of ${lines.length} lines have a recording; speakers: ${Object.entries(bySpeaker).map(([w, ls]) => `${(st.speakers[w] || {}).name || w} ${ls.length}`).join(", ")}`);
    if (missing.length) t.problem("bug", `${st.id}: ${missing.length} lines have no recording yet (${missing.slice(0, 5).map((l) => `${l.id}#${l.n}`).join(", ")}...)`);
    const cues = [...Object.entries(st.ambience || {}).map(([k, f]) => ["ambience", k, f]), ...Object.entries(st.sfx || {}).map(([k, f]) => ["sfx", k, f]), ...Object.entries(st.music || {}).map(([k, f]) => ["music", k, f])];
    cues.filter(([kind, , f]) => !f && kind !== "music").forEach(([kind, k]) => t.problem("bug", `${st.id}: the ${kind} cue ${k} has no recording`));
    const unmadeMusic = cues.filter(([kind, , f]) => kind === "music" && !f);
    t.metric("musicCuesUnmade", unmadeMusic.length);
    if (unmadeMusic.length) t.problem("warning", `${st.id}: ${unmadeMusic.length} music stings are designed but not made yet (GPU, waiting for J's approval): ${unmadeMusic.map((c) => c[1]).join(", ")}`);
    // A cue that is in the story's music but has no file is the one warning above; a scene naming a cue the story doesn't list is a bug.
    Object.entries(st.scenes).filter(([, sc]) => sc.music && !Object.prototype.hasOwnProperty.call(st.music || {}, sc.music)).forEach(([id, sc]) => t.problem("bug", `${st.id}/${id}: the music cue ${sc.music} isn't in the story's music`));
    const noBed = Object.entries(st.scenes).filter(([, sc]) => !sc.ambience);
    t.event("criterion", `${Object.keys(st.scenes).length - noBed.length} of ${Object.keys(st.scenes).length} scenes have an ambience bed`);
    noBed.forEach(([id]) => t.problem("bug", `${st.id}/${id}: no ambience bed, the scene would be silent between lines`));
    const usedBeds = new Set(Object.values(st.scenes).map((sc) => sc.ambience).filter(Boolean));
    const usedSfx = new Set(lines.map((l) => l.sfx).filter(Boolean));
    [...usedBeds].filter((k) => !(st.ambience || {})[k]).forEach((k) => t.problem("bug", `${st.id}: a scene uses the bed ${k}, which has no recording`));
    [...usedSfx].filter((k) => !(st.sfx || {})[k]).forEach((k) => t.problem("bug", `${st.id}: a line uses the effect ${k}, which has no recording`));
    t.progress(0.15);

    // 2. Loudness: a few lines of each speaker, every bed and every effect, decoded here.
    t.scene(`${st.title}: loudness across speakers, ambience under the voice`);
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const speakerDb = {};
    for (const [who, ls] of Object.entries(bySpeaker)) {
      const made = ls.filter((l) => l.file);
      const pick = [made[0], made[Math.floor(made.length / 2)], made[made.length - 1]].filter((x, i, a) => x && a.indexOf(x) === i);
      for (const l of pick) {
        try {
          const r = await rmsDb(ctx, l.file);
          (speakerDb[who] = speakerDb[who] || []).push(r.db);
          if (r.seconds > l.dur + 3.5) t.problem("bug", `${l.id}#${l.n}: the recording is ${r.seconds.toFixed(1)} s but its dur is ${l.dur} s, so the player would cut it off`);
        } catch (e) { t.problem("bug", `${l.id}#${l.n}: ${l.file} doesn't load or decode (${e && e.message})`); }
      }
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const voiceMeans = Object.entries(speakerDb).map(([w, a]) => [w, mean(a)]);
    voiceMeans.forEach(([w, db]) => t.event("loudness", `${(st.speakers[w] || {}).name || w}: ${db.toFixed(1)} dB RMS over ${speakerDb[w].length} lines`));
    if (voiceMeans.length) {
      const lo = Math.min(...voiceMeans.map((x) => x[1]));
      const hi = Math.max(...voiceMeans.map((x) => x[1]));
      t.metric("voiceSpreadDb", Math.round((hi - lo) * 10) / 10);
      t.event("criterion", `speakers sit within ${(hi - lo).toFixed(1)} dB of each other (${lo.toFixed(1)} to ${hi.toFixed(1)} dB RMS)`);
      if (hi - lo > 4) t.problem("bug", `${st.id}: speakers differ by ${(hi - lo).toFixed(1)} dB, more than 4`);
      const voiceDb = mean(voiceMeans.map((x) => x[1]));
      for (const [kind, k, f] of cues) {
        if (!f) continue;
        try {
          const r = await rmsDb(ctx, f);
          const under = voiceDb - r.db;
          t.event("loudness", `${kind} ${k}: ${r.db.toFixed(1)} dB RMS, ${under.toFixed(1)} dB under the voice`);
          if (kind === "ambience" && under < 12) t.problem("bug", `${st.id}: the bed ${k} is only ${under.toFixed(1)} dB under the voice, it could drown a line`);
          if (kind === "sfx" && under < 3) t.problem("bug", `${st.id}: the effect ${k} is only ${under.toFixed(1)} dB under the voice`);
          if (kind === "music" && under < 12) t.problem("bug", `${st.id}: the music ${k} is only ${under.toFixed(1)} dB under the voice, it could mask a line`);
          if (kind === "ambience") {
            const sm = await seamOf(ctx, f);
            t.event("loop", `bed ${k}: ${sm.seconds.toFixed(1)} s, seam step ${sm.jump.toFixed(4)} (typical ${sm.step.toFixed(4)}), level gap ${sm.levelGap.toFixed(1)} dB`);
            if (sm.jump > Math.max(0.02, sm.step * 8)) t.problem("bug", `${st.id}: the bed ${k} clicks where it loops (a step of ${sm.jump.toFixed(3)} against ${sm.step.toFixed(3)} typical)`);
            if (sm.levelGap > 3) t.problem("bug", `${st.id}: the bed ${k} jumps ${sm.levelGap.toFixed(1)} dB in level where it loops`);
          }
        } catch (e) { t.problem("bug", `${st.id}: ${kind} ${k} doesn't load or decode (${e && e.message})`); }
      }
    }
    ctx.close && ctx.close().catch(() => {});
    t.progress(0.5);

    // 3. Real play: the opening scene with its own voices and bed, a line at a time (not skipped).
    t.scene(`${st.title}: the opening scene is heard line by line`);
    await consoleOpen(t, st);
    await consoleFresh(t, st);
    const api = window.iltvConsole;
    const first = st.scenes[st.start];
    const want = Math.min(3, first.lines.length);
    const heard = new Set();
    const t0 = performance.now();
    while (heard.size < want && performance.now() - t0 < 40000) {
      const l = api.lines();
      const a = api.audio();
      if (l && l.playing >= 0 && !heard.has(l.playing)) {
        const line = first.lines[l.playing];
        await sleep(900);
        const a2 = api.audio();
        heard.add(l.playing);
        const ok = line.file && a2.voice && a2.voice.src.endsWith(line.file);
        if (!ok) t.problem("bug", `${st.id}/${st.start} line ${l.playing + 1}: the voice element plays ${a2.voice && a2.voice.src}, not ${line.file}`);
        else if (a2.voice.paused || a2.voice.muted) t.problem("warning", `${st.id}/${st.start} line ${l.playing + 1}: the recording is ${a2.voice.paused ? "paused" : "muted"} (autoplay blocked?)`);
        else if (a2.voice.time <= 0) t.problem("bug", `${st.id}/${st.start} line ${l.playing + 1}: the recording doesn't advance`);
        else t.event("voice", `line ${l.playing + 1} (${(st.speakers[line.speaker] || {}).name || line.speaker}) is playing its own recording at ${a2.voice.time.toFixed(1)} s, volume ${a2.voice.volume}`);
        if (a2.bed && a2.bedCue === first.ambience) t.event("ambience", `the ${first.ambience} bed is ${a2.bed.paused ? "not playing" : "playing"}, looped: ${a2.bed.loop}, volume ${a2.bed.volume}`);
        else t.problem("bug", `${st.id}/${st.start}: the bed is ${a.bedCue}, the scene says ${first.ambience}`);
      }
      await sleep(150);
    }
    if (heard.size < want) t.problem("bug", `${st.id}/${st.start}: only ${heard.size} of the first ${want} lines were heard in 40 s`);
    await consoleHeard(t, document, `${st.id}/${st.start}`);
   }
    t.progress(0.6);
    await nightAudioBetween(t, st);
    t.progress(1);
  } finally {
    await sleep(300);
    await toLanding(t).catch(() => {});
  }
}

/** The bed, effects and sting elements of the console player (they are the page's audio elements; the looping one is the bed). */
const bedElement = () => [...document.querySelectorAll("audio[data-sound-start]")].find((a) => a.loop);

/** Is the bed audible right now: playing, not muted, enough data, and the file of the scene's cue (not the silence). */
function bedAudible(file) {
  const a = bedElement();
  return !!a && !a.paused && !a.muted && a.readyState >= 3 && (a.currentSrc || a.src).endsWith(file);
}

/** Nothing is silent between scenes: for each bed the story has, one real press of the choice that leads into a scene
    with that bed (from a seeded run, setup shortcut, at the parent: the shortest way there), timing how long the bed is
    not audible from the press until the first line plays; the same bed carries on from where it was (no restart); then
    one bed is seeked to its last half second to see the real loop wrap (it keeps playing, no pause, no stall).
    A scene that names a music sting with a file must start it. */
async function nightAudioBetween(t, st) {
  t.scene(`${st.title}: the bed carries over from scene to scene, no silence, the loop wraps`);
  const x = consoleExplore(st);
  const bedOf = (id) => st.scenes[id].ambience;
  const byBed = {};
  let same = null;
  for (const [id, w] of Object.entries(x.scenes)) {
    if (w.path.length < 2) continue;
    const parent = w.path[w.path.length - 2];
    const entry = { parent, child: id, picks: w.picks, bed: bedOf(id), from: bedOf(parent) };
    if (bedOf(parent) !== bedOf(id)) { if (!byBed[entry.bed] || byBed[entry.bed].picks.length > entry.picks.length) byBed[entry.bed] = entry; }
    else if (!same || same.picks.length > entry.picks.length) same = entry;
  }
  const trips = [...Object.values(byBed).sort((a, b) => a.picks.length - b.picks.length), ...(same ? [same] : [])];
  t.metric("bedHandovers", trips.length);
  const beds = new Set(Object.values(st.scenes).map((sc) => sc.ambience));
  const missingTrips = [...beds].filter((b) => !byBed[b] && bedOf(st.start) !== b);
  if (missingTrips.length) t.note(`${st.title}: no way found into a scene with the bed ${missingTrips.join(", ")} from another bed (checked as the opening or not reached by a change)`);
  const seen = new Set();
  let worst = 0;
  for (const trip of trips) {
    const m = await consoleSeedAt(t, st, trip.picks.slice(0, -1), seen);
    if (!(await waitFor(() => bedAudible(st.ambience[trip.from]), 5000))) {
      t.problem("bug", `${st.id}/${trip.parent}: the ${trip.from} bed isn't playing before the choice`);
      continue;
    }
    const before = bedElement().currentTime;
    const file = st.ambience[trip.bed];
    const i = trip.picks[trip.picks.length - 1];
    const label = st.scenes[m.scene].choices[i][0];
    const button = openChoices()[m.open().findIndex(([, j]) => j === i)]; // the open choices show in the data's order
    if (!button || button.textContent.trim() !== label) { t.problem("bug", `${st.id}/${trip.parent}: no choice "${label}" on screen`); continue; }
    // From the press until the scene's first line is playing, count how long the bed is not audible.
    let silent = 0;
    let last = performance.now();
    let lineOn = false;
    const sampler = setInterval(() => {
      const now = performance.now();
      if (!lineOn && !bedAudible(file)) silent += now - last;
      last = now;
      const l = window.iltvConsole.lines();
      if (window.iltvConsole.scene() === trip.child && l && l.playing >= 0) lineOn = true;
    }, 25);
    await tapAt(t, button, `choice "${label}"`, { quick: true });
    m.choose(i);
    await waitFor(() => lineOn, 8000);
    await sleep(300);
    clearInterval(sampler);
    worst = Math.max(worst, silent);
    const bed = bedElement();
    if (window.iltvConsole.scene() !== trip.child) { t.problem("bug", `${st.id}: "${label}" didn't open ${trip.child}`); continue; }
    if (!bedAudible(file)) t.problem("bug", `${st.id}/${trip.child}: the ${trip.bed} bed isn't playing in the new scene (${bed && (bed.currentSrc || bed.src)}, paused ${bed && bed.paused})`);
    else if (!bed.loop) t.problem("bug", `${st.id}/${trip.child}: the ${trip.bed} bed isn't set to loop`);
    if (trip.from === trip.bed && bed.currentTime < before) t.problem("bug", `${st.id}/${trip.child}: the ${trip.bed} bed restarted at a scene with the same bed (${before.toFixed(1)} s back to ${bed.currentTime.toFixed(1)} s)`);
    t.event("bed-handover", `${trip.parent} (${trip.from}) -> ${trip.child} (${trip.bed}): the bed was not audible for ${Math.round(silent)} ms from the press to the first line${trip.from === trip.bed ? `; same bed carried on ${before.toFixed(1)} s -> ${bed.currentTime.toFixed(1)} s` : ""}`);
    if (silent > 1500) t.problem("bug", `${st.id}/${trip.child}: ${Math.round(silent)} ms of silence (no bed) between ${trip.parent} and ${trip.child}`);
    else if (silent > 500) t.problem("warning", `${st.id}/${trip.child}: ${Math.round(silent)} ms without the bed between ${trip.parent} and ${trip.child}`);
    const sc = st.scenes[trip.child];
    if (sc.music && st.music && st.music[sc.music]) {
      const sting = window.iltvConsole.audio().sting;
      if (!sting || !sting.src.endsWith(st.music[sc.music])) t.problem("bug", `${st.id}/${trip.child}: the sting ${sc.music} isn't loaded`);
    }
  }
  t.metric("worstBedSilenceMs", Math.round(worst));
  t.event("criterion", `${trips.length} scene changes by a real press (${trips.filter((x) => x.from !== x.bed).length} to a different bed); the bed was never missing for more than ${Math.round(worst)} ms`);

  // The loop as the player plays it: seek the bed to its last half second, it must wrap and keep playing.
  const bed = bedElement();
  if (bed && bed.duration > 2) {
    const cue = window.iltvConsole.audio().bedCue;
    bed.currentTime = bed.duration - 0.6;
    let dips = 0;
    let wrapped = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 2000) {
      if (bed.paused || bed.ended || bed.readyState < 3) dips++;
      if (bed.currentTime < 1) wrapped = true;
      await sleep(20);
    }
    t.event("loop-wrap", `bed ${cue}: ${bed.duration.toFixed(1)} s long, seeked to ${(bed.duration - 0.6).toFixed(1)} s, ${wrapped ? "wrapped to the start" : "did NOT wrap"}, ${dips} samples (20 ms) not playing`);
    if (!wrapped) t.problem("bug", `${st.id}: the ${cue} bed didn't wrap round at its end`);
    if (dips > 5) t.problem("bug", `${st.id}: the ${cue} bed stopped or stalled for ${dips * 20} ms where it loops`);
  }
}

/* ---------------- night-shift-card: Night Shift's landing card from Not started to Completed and Start Over ---------------- */

/** The card criteria of a listed console story, by themselves (the `stories` scenario walks every story and takes
    longer): a new visitor's card (image, logline, Not started, nothing about B3, the vat or the creature), Started once
    opened, Completed with Start Over at an ending (a seeded run two choices short of it: setup shortcut), and Start
    Over keeping Completed. Options: {"story":"<id>"} (default night-shift). */
/* ---------------- Night Shift: lines over a radio, walkie, intercom or phone sound like it (story doc "Treated lines") ---------------- */

/** How much of a recording's energy sits above 4 kHz, in dB under its total (a band-limited line is far under). */
async function highBandDb(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const probe = new (window.AudioContext || window.webkitAudioContext)();
  const audio = await probe.decodeAudioData(buf);
  probe.close && probe.close().catch(() => {});
  const d = audio.getChannelData(0);
  let total = 0;
  for (let i = 0; i < d.length; i++) total += d[i] * d[i];
  const off = new Ctx(1, audio.length, audio.sampleRate);
  const src = off.createBufferSource();
  src.buffer = audio;
  let node = src;
  for (let k = 0; k < 2; k++) { const hp = off.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 4000; node.connect(hp); node = hp; }
  node.connect(off.destination);
  src.start();
  const high = (await off.startRendering()).getChannelData(0);
  let hi = 0;
  for (let i = 0; i < high.length; i++) hi += high[i] * high[i];
  return { db: 10 * Math.log10((hi + 1e-12) / (total + 1e-12)), rms: 10 * Math.log10(total / Math.max(1, d.length) + 1e-12) };
}

async function nightTreatmentRun(options, t) {
  const id = (options && options.story) || "night-shift";
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  const st = story(id);
  if (!st || !isConsole(st)) throw new Error(`${id} is not a console story`);
  await passPrompt(t);
  clearProgress();
  try {
    // 1. The data: every line the scene puts on a radio, walkie, intercom or phone has a treatment, and the lock says it was made.
    t.scene(`${st.title}: every radio, walkie, intercom and phone line has a treatment`);
    const data = await (await fetch("/story/night-shift.json")).json();
    const lock = await (await fetch("/hawkes.assets.lock.json")).json();
    const onAir = /\b(?:over|on)(?: the| your)? (?:radio|walkie|intercom)\b|speakerphone|phone-flat/i;
    const notAir = /\b(?:off|not) the radio\b/i;
    const all = [];
    for (const sc of data.scenes) sc.lines.forEach((l, i) => all.push({ scene: sc.id, folder: sc.folder, n: i + 1, speaker: l.speaker, perform: l.perform || "", treatment: l.treatment || (data.speakers[l.speaker] || {}).treatment || "none" }));
    const treated = all.filter((l) => l.treatment !== "none");
    const bad = all.filter((l) => l.treatment !== "none" && !["radio", "walkie", "intercom", "phone"].includes(l.treatment));
    bad.forEach((l) => t.problem("bug", `${l.scene}#${l.n}: unknown treatment "${l.treatment}"`));
    const missed = all.filter((l) => l.speaker !== "narrator" && onAir.test(l.perform) && !notAir.test(l.perform) && l.treatment === "none");
    missed.forEach((l) => t.problem("bug", `${l.scene}#${l.n} (${l.speaker}, "${l.perform}") is on the air but has no treatment`));
    const kinds = {};
    treated.forEach((l) => (kinds[l.treatment] = (kinds[l.treatment] || 0) + 1));
    t.metric("treatedLines", treated.length);
    t.event("criterion", `${treated.length} lines carry a treatment (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ")}); ${missed.length} lines whose performance says radio, walkie, intercom or phone are untreated`);
    const stale = treated.filter((l) => (lock[`night-shift-${l.scene}-line-${l.n}`] || {}).treatment !== l.treatment);
    stale.slice(0, 5).forEach((l) => t.problem("bug", `${l.scene}#${l.n}: the lock says "${(lock[`night-shift-${l.scene}-line-${l.n}`] || {}).treatment || "none"}", the data says ${l.treatment} (node tools/make-audio.mjs night-shift --treat)`));
    if (stale.length > 5) t.problem("bug", `${stale.length} treated lines are out of date in the lock`);
    t.progress(0.15);

    // 2. The recordings: a treated line has next to nothing above 4 kHz; the same speakers' clean lines do. Loudness stays even.
    t.scene(`${st.title}: the treated recordings are band-limited and as loud as the rest`);
    const file = (l) => `/night-shift/${l.folder}/media/line-${l.n}.mp3`;
    const bandOf = {};
    const untreatedPick = all.filter((l) => l.treatment === "none" && ["dee", "terrell", "marisol", "okafor", "adler"].includes(l.speaker) && l.n % 4 === 0).slice(0, 40);
    const high = { clean: [], treated: [] };
    const rms = { clean: [], treated: [] };
    for (const [kind, ls] of [["clean", untreatedPick], ["treated", treated]]) {
      for (const l of ls) {
        try {
          const r = await highBandDb(file(l));
          high[kind].push(r.db);
          rms[kind].push(r.rms);
          if (kind === "treated") (bandOf[l.treatment] = bandOf[l.treatment] || []).push(r.db);
          if (kind === "treated" && r.db > -14) t.problem("bug", `${l.scene}#${l.n} (${l.treatment}) still has ${r.db.toFixed(1)} dB of its energy above 4 kHz, a clean voice's: not band-limited`);
        } catch (e) { t.problem("bug", `${l.scene}#${l.n}: ${file(l)} doesn't load or decode (${e && e.message})`); }
      }
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    Object.entries(bandOf).forEach(([k, a]) => t.event("band", `${k}: ${mean(a).toFixed(1)} dB above 4 kHz under the whole (worst ${Math.max(...a).toFixed(1)}), ${a.length} lines`));
    t.event("band", `clean voices (${high.clean.length} lines): ${mean(high.clean).toFixed(1)} dB above 4 kHz under the whole`);
    t.metric("treatedHighBandDb", Math.round(mean(high.treated) * 10) / 10);
    t.metric("cleanHighBandDb", Math.round(mean(high.clean) * 10) / 10);
    if (mean(high.clean) - mean(high.treated) < 6) t.problem("bug", `treated lines have ${mean(high.treated).toFixed(1)} dB above 4 kHz, clean ones ${mean(high.clean).toFixed(1)}: less than 6 dB apart, the treatment isn't heard`);
    const gap = Math.abs(mean(rms.treated) - mean(rms.clean));
    t.metric("treatedLoudnessGapDb", Math.round(gap * 10) / 10);
    t.event("criterion", `treated lines average ${mean(rms.treated).toFixed(1)} dB RMS, clean ones ${mean(rms.clean).toFixed(1)} (${gap.toFixed(1)} dB apart); the data side holds LUFS in -19.1 to -14.6`);
    if (gap > 3.5) t.problem("bug", `treated lines are ${gap.toFixed(1)} dB from the clean ones in RMS, over 3.5`);
    t.progress(0.4);

    // 3. Played: one scene per treatment, entered by a real press from a seeded run at its parent; the line's own (treated) file plays.
    t.scene(`${st.title}: a treated line is heard`);
    const x = consoleExplore(st);
    await consoleOpen(t, st);
    for (const kind of ["radio", "walkie", "phone", "intercom"]) {
      const cand = treated.filter((l) => l.treatment === kind && x.scenes[l.scene]).sort((a, b) => a.n - b.n || x.scenes[a.scene].picks.length - x.scenes[b.scene].picks.length)[0];
      if (!cand) { t.problem("bug", `no reachable ${kind} line to play`); continue; }
      const way = x.scenes[cand.scene];
      const where = `${st.id}: ${way.path.join(" > ")}`;
      const m = await consoleSeedAt(t, st, way.picks.slice(0, -1), null);
      await consoleChoose(t, st, m, way.picks[way.picks.length - 1], document, where, null, { hear: false });
      const api = window.iltvConsole;
      const ok = await waitFor(() => { const l = api.lines(); return l && l.playing === cand.n - 1; }, 70000);
      if (!ok) { t.problem("bug", `${cand.scene}: line ${cand.n} (${kind}) never played`); continue; }
      await sleep(900);
      const a = api.audio();
      const want = st.scenes[cand.scene].lines[cand.n - 1].file;
      if (!(want && a.voice && a.voice.src.endsWith(want))) t.problem("bug", `${cand.scene} line ${cand.n}: the voice element plays ${a.voice && a.voice.src}, not ${want}`);
      else if (a.voice.paused || a.voice.muted) t.problem("warning", `${cand.scene} line ${cand.n}: the recording is ${a.voice.paused ? "paused" : "muted"} (autoplay blocked?)`);
      else t.event("treated-line", `${cand.scene} line ${cand.n} (${cand.speaker}, ${kind}) plays ${want}, ${a.voice.time.toFixed(1)} s in`);
    }
    t.progress(1);
  } finally {
    await sleep(300);
    await toLanding(t).catch(() => {});
    // Leaving a story keeps its progress (the run is cleared at the end by restoreProgress, after this look).
    const card = cardOf(id);
    if (card && landingShown() && window.iltvStories) {
      const unlocks = readJsonCookie(unlocksCookie(st));
      t.event("badge", `after All stories: ${id} ${card.dataset.progress}, ${(card.querySelector(".story-card-explored")?.textContent || "").trim()}, unlocks cookie ${unlocks ? "kept" : "missing"}`);
      if (card.dataset.progress === "new" && unlocks) t.problem("bug", `${id}: its unlocks cookie is saved but the card says Not started after All stories`);
    }
  }
}

async function nightCardRun(options, t) {
  const id = (options && options.story) || "night-shift";
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  const st = story(id);
  if (!st || !isConsole(st)) throw new Error(`${id} is not a console story`);
  await passPrompt(t);
  if (!landingShown()) await toLanding(t);
  t.scene(`${st.title}: card, Not started`);
  const list = listedStories();
  const at = list.findIndex((x) => x.id === id);
  if (at < 0) t.problem("bug", `${id} isn't listed on the landing page`);
  else if (id === "night-shift" && list[at - 1]?.id !== "water-road") t.problem("bug", `${id}'s card follows ${list[at - 1]?.id || "nothing"}, not The Water Road`);
  clearProgress();
  await badgesAfterLoad(t, () => "new", "fresh browser");
  const card = cardOf(id);
  if (!card) throw new Error(`${id} has no card on the landing page`);
  card.scrollIntoView({ block: "center", behavior: "instant" });
  const logline = (card.querySelector("p")?.textContent || "").trim();
  if (!logline) t.problem("bug", `${id}: the card has no logline`);
  const img = card.querySelector("img");
  if (!img) t.problem("bug", `${id}: the card has no image`);
  else {
    await waitFor(() => img.complete, 10000);
    if (!img.naturalWidth) t.problem("bug", `${id}: the card's image ${pathOf(img.src)} didn't load`);
  }
  const words = `${card.textContent} ${img?.alt || ""} ${st.logline || ""}`;
  const leak = words.match(/\b(B3|vat|creature)\b/i);
  if (leak) t.problem("bug", `${id}: the card says "${leak[0]}" (the story never mentions B3, the vat or the creature)`);
  t.event("card", `${id}: "${logline}"`);
  checkBadge(t, card, st, "new", "before opening it");
  await sleep(800); // on screen for the footage

  // Opening it starts it.
  await consoleListedOpen(t, st);
  await toLanding(t);
  checkBadge(t, cardOf(id), st, "started", `after opening ${st.title} and All stories`);
  await badgeAfterReload(t, st, "started", `after opening ${st.title} and a reload`);
  t.progress(0.3);

  // An ending completes it: the percent follows the scenes seen, and the button says Start Over.
  await consoleListedEnding(t, st);
  t.progress(0.7);
  await consoleListedStartOver(t, st);
  t.progress(1);
}

/* ---------------- room: Night Shift's control room, the silhouettes and the big screen ---------------- */

const SILHOUETTE = "#050708";

/** The control room as a viewer sees it in `doc`: the stage, its people (black silhouettes in the room), the one big screen. */
function roomStage(doc) {
  const host = byIdIn(doc, "console-room");
  const api = apiOf(doc);
  const view = api.room();
  const figs = [...doc.querySelectorAll("#console-room-figs .fig")].filter((f) => f.getAttribute("data-show") === "1");
  const fill = (f) => (f.querySelector(".p-skin") || {}).getAttribute?.("fill");
  return { host, view, figs, fill, mode: host.getAttribute("data-mode"), look: host.getAttribute("data-look"), place: host.getAttribute("data-place") };
}

/** The room's acts the data gives a scene, in line order (a line's place first), as the room records them. */
function roomDataActs(st, id) {
  return st.scenes[id].lines.flatMap((l) => [...(l.place ? [`place:${l.place}`] : []), ...(l.act == null ? [] : Array.isArray(l.act) ? l.act : [l.act]).map((e) => (typeof e === 'string' ? e : e.act))]);
}

/** Plays a scene from a seeded run at its parent with a real press into it; returns the model. `hear`: skip to the end of its lines. */
async function roomEnter(t, st, x, id, seen, { hear = true } = {}) {
  const way = x.scenes[id];
  if (!way) throw new Error(`${st.id}/${id}: no way reaches it`);
  if (!way.picks.length) throw new Error(`${st.id}/${id} is the first scene`);
  const m = await consoleSeedAt(t, st, way.picks.slice(0, -1), seen);
  await consoleChoose(t, st, m, way.picks[way.picks.length - 1], document, `${st.id}: ${way.path.join(" > ")}`, seen, { hear });
  if (m.scene !== id) t.problem("bug", `${st.id}: expected to enter ${id}, is at ${m.scene}`);
  return m;
}

/** Waits (the scene plays at its own pace) for `test()` to hold, sampled every 40 ms. */
async function roomWatch(test, ms = 60000) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    let ok = false;
    try { ok = test(); } catch (e) { ok = false; }
    if (ok) return performance.now() - t0;
    await sleep(40);
  }
  return -1;
}

/** The brightest edge of a figure's layer as drawn (its CSS filter applied on a canvas): the mean luminance of the top 3% of its pixels.
    The speaker's rim is a warm bright line round the figure; the others keep a dim cool one. 0 when there is nothing to measure. */
function rimLuma(doc, img) {
  try {
    const win = doc.defaultView;
    const c = doc.createElement("canvas");
    c.width = 768; c.height = 460;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const f = win.getComputedStyle(img).filter;
    ctx.filter = f && f !== "none" ? f : "none";
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const lum = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) lum.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
    if (!lum.length) return 0;
    lum.sort((a, b) => b - a);
    const n = Math.max(1, Math.floor(lum.length * 0.03));
    return lum.slice(0, n).reduce((a, b) => a + b, 0) / n;
  } catch (e) { return 0; }
}

/** Who is marked as speaking in the room and how bright each shown figure's rim is: { speaker, rims: { who: luma } }. */
function roomRims(doc) {
  const host = byIdIn(doc, "console-room");
  const rims = {};
  let speaker = null;
  for (const w of host.querySelectorAll(".room-pose")) {
    const im = w.querySelector("img.on");
    if (!im || !im.complete || !im.naturalWidth) continue;
    rims[w.getAttribute("data-who")] = rimLuma(doc, im);
    if (w.hasAttribute("data-speaking")) speaker = w.getAttribute("data-who");
  }
  return { speaker, rims };
}

/** The speaker's rim is measurably brighter than every other figure's: returns null when it is, else what was seen. */
function speakerMarked(doc, who) {
  const { speaker, rims } = roomRims(doc);
  if (!(who in rims)) return null; // not drawn as a layer (away, or no layer for them): nothing to mark
  if (speaker !== who) return `${who} speaks but ${speaker || "nobody"} is marked`;
  const others = Object.entries(rims).filter(([k]) => k !== who);
  const best = others.length ? Math.max(...others.map(([, v]) => v)) : 0;
  if (!(rims[who] >= best + 12)) return `${who}'s rim ${Math.round(rims[who])} isn't brighter than the others' (${others.map(([k, v]) => `${k} ${Math.round(v)}`).join(", ")})`;
  return null;
}

async function nightRoomRun(options, t) {
  const st = storyOf(options.story || "night-shift");
  if (!st || st.type !== "console") throw new Error(`room: ${options.story || "night-shift"} isn't a console story`);
  await consoleWarm(t);
  const x = consoleExplore(st);
  const seen = new Set();
  document.cookie = `${unlocksCookie(st)}=; Max-Age=0; Path=/`;
  await passSplash(t);

  /* 1. Opening the story: the room, with silhouettes of the trainer and the player facing the big screen, not a grid */
  t.scene(`${st.title}: the room`);
  await consoleOpen(t, st);
  await consoleFresh(t, st);
  let r = roomStage(document);
  if (!r.host || !r.view) throw new Error("room: the control room didn't start (js/console-room.js)");
  if (r.mode !== "room" || r.look !== "sil" || r.place !== "room") t.problem("bug", `the first scene opens as ${r.mode}/${r.look}/${r.place}, not the room with silhouettes`);
  for (const who of ["you", "dee", "okafor"]) {
    const f = r.figs.find((el) => el.getAttribute("data-who") === who);
    if (!f) t.problem("bug", `the control room doesn't show ${who} at the handover`);
    else if (r.fill(f) !== SILHOUETTE) t.problem("bug", `${who} in the room isn't a black silhouette (skin fill ${r.fill(f)})`);
  }
  // The room is a photograph (night-shift/media/stage/stage.json: the plate, overlays, one silhouette layer per person): wait for it, and see each image load.
  const gotPhoto = (await roomWatch(() => r.host.getAttribute("data-art") === "photo" && !!r.host.querySelector(".room-plate"), 8000)) >= 0;
  if (!gotPhoto) t.problem("bug", "the photographed room didn't start (stage.json, the plate): the SVG room is still showing");
  r = roomStage(document);
  if (gotPhoto) {
    const plate = r.host.querySelector(".room-plate");
    if (!plate.complete || !plate.naturalWidth) t.problem("bug", "the plate (media/stage/plate.webp) didn't load");
    else if (plate.naturalWidth !== 1536 || plate.naturalHeight !== 920) t.problem("bug", `the plate is ${plate.naturalWidth}x${plate.naturalHeight}, not 1536x920`);
    await roomWatch(() => [...r.host.querySelectorAll(".room-pose img.on")].length >= 2 && [...r.host.querySelectorAll(".room-pose img.on")].every((im) => im.complete), 8000);
    const layers = [...r.host.querySelectorAll(".room-pose")].filter((w) => w.getAttribute("data-file"));
    for (const who of ["you", "dee"]) {
      const w = layers.find((el) => el.getAttribute("data-who") === who);
      const im = w && w.querySelector("img.on");
      if (!im) t.problem("bug", `the photographed room shows no layer for ${who} at the handover`);
      else if (!im.complete || !im.naturalWidth) t.problem("bug", `${who}'s layer ${w.getAttribute("data-file")} didn't load`);
      else if (im.naturalWidth !== 1536 || im.naturalHeight !== 920) t.problem("bug", `${who}'s layer is ${im.naturalWidth}x${im.naturalHeight}, not the plate's 1536x920`);
    }
    // Z-order (J, 2026-10-26: Mr. Okafor ended up behind the big screen): the people's layers come after the big screen, which comes after the plate.
    const kids = [...r.host.children];
    const at = (sel) => kids.findIndex((k) => k.matches(sel));
    if (!(at(".room-photo:not(.room-people)") >= 0 && at("#console-big") > at(".room-photo:not(.room-people)") && at(".room-people") > at("#console-big"))) t.problem("bug", `people are not drawn in front of the big screen: plate ${at(".room-photo:not(.room-people)")}, screen ${at("#console-big")}, people ${at(".room-people")}`);
    if (r.host.querySelectorAll(".room-photo img").length > 14) t.problem("bug", `${r.host.querySelectorAll(".room-photo img").length} images in the room at once: only what the scene needs should be loaded`);
  } else for (const part of [".r-door", ".r-clock", ".r-fire", ".r-access", ".r-charger", ".r-coffee", ".r-tablet", ".r-phone", ".r-shelf"]) if (!r.host.querySelector(part)) t.problem("bug", `the room has no ${part.slice(3)} (door, clock, fire panel, access terminal, charger, coffee machine, tablet, phone, shelf)`);
  if (!r.host.querySelectorAll(".chair-seat").length) t.problem("bug", "the room shows no chairs");
  if (document.querySelectorAll("#console-wall button, #console-big button").length) t.problem("bug", "the camera strip or the big screen has buttons: it is not a grid to press");
  const tiles = document.querySelectorAll("#console-wall .feed");
  if (tiles.length !== st.cameras.length) t.problem("bug", `the strip has ${tiles.length} tiles for ${st.cameras.length} cameras`);
  const hr = r.host.getBoundingClientRect();
  const br = byIdIn(document, "console-big").getBoundingClientRect();
  if (br.left < hr.left || br.right > hr.right || br.top < hr.top || br.bottom > hr.bottom) t.problem("bug", "the big screen is not inside the room");
  if (br.width < hr.width * (r.host.getAttribute("data-art") === "photo" ? 0.24 : 0.3)) t.problem("bug", `the big screen is only ${Math.round(br.width)} px of a ${Math.round(hr.width)} px room`);
  const clock = r.host.querySelector(".hand-m")?.getAttribute("transform") || "";
  if (!clock.startsWith(`rotate(${+st.scenes[st.start].time.slice(3) * 6} `)) t.problem("bug", `the wall clock's minute hand doesn't say the scene's time (${st.scenes[st.start].time}): "${clock}"`);
  t.event("room", `${st.start}: ${r.figs.length} people (${r.figs.map((f) => f.getAttribute("data-who")).join(", ")}) in silhouette, the big screen ${Math.round(br.width)}x${Math.round(br.height)} in a ${Math.round(hr.width)}x${Math.round(hr.height)} room, ${tiles.length} cameras in the strip`);
  await checkNotEnlargeable(t, document, "the first scene");
  // Reduced motion: the CRT flash and the silhouettes' motion are toned down in the stylesheet.
  let reduced = false;
  for (const sheet of document.styleSheets) {
    let rules = [];
    try { rules = [...sheet.cssRules]; } catch (e) { continue; }
    for (const rule of rules) if (rule.conditionText && /prefers-reduced-motion/.test(rule.conditionText) && /big-crt/.test(rule.cssText) && /\.fig/.test(rule.cssText)) reduced = true;
  }
  if (!reduced) t.problem("bug", "no prefers-reduced-motion rule tones down the CRT flash and the silhouettes");
  t.progress(0.1);

  /* 2. The characters change the feed: a CRT flash and the big screen on the scene's focus */
  t.scene(`${st.title}: the screen switches`);
  const flashes = ["sign-pencil", "w2-cam9", "visitor-waved"].filter((id) => x.scenes[id] && st.scenes[id].focus);
  for (const id of flashes) {
    const way = x.scenes[id];
    const m = await consoleSeedAt(t, st, way.picks.slice(0, -1), seen);
    const api = window.iltvConsole;
    const before = api.screen();
    const button = openChoices(document).find((b) => Number(b.dataset.choice) === way.picks[way.picks.length - 1]);
    if (!button) throw new Error(`${id}: no choice into it on screen`);
    await tapAt(t, button, `the choice into ${id}`, { quick: true });
    m.choose(way.picks[way.picks.length - 1]);
    const big = byIdIn(document, "console-big");
    const on = await roomWatch(() => big.classList.contains("is-flash"), 400);
    const off = await roomWatch(() => !big.classList.contains("is-flash"), 1500);
    const after = api.screen();
    const focus = st.scenes[id].focus;
    if (before.camera === focus) { t.note(`${id}: the screen was already on ${focus}`); continue; }
    const lasted = on + off + 15; // the poll for its end starts where the poll for its start ended; the press was 15 ms before
    if (on < 0) t.problem("bug", `${id}: the screen changed from ${before.camera} to ${focus} with no CRT flash`);
    else if (off < 0 || lasted < 120 || lasted > 700) t.problem("bug", `${id}: the CRT flash lasted ${Math.round(lasted)} ms (it should be a short flash, about 200-300 ms)`);
    if (after.camera !== focus || big.dataset.camera !== focus) t.problem("bug", `${id}: the big screen shows ${big.dataset.camera}, the scene's focus is ${focus}`);
    if (after.changes <= before.changes) t.problem("bug", `${id}: the screen's change count didn't rise (${before.changes} -> ${after.changes})`);
    const crt = big.querySelector(".big-crt");
    if (!crt) t.problem("bug", `${id}: the big screen has no CRT layer`);
    const said = window.iltvConsole.room().said.join(" | ");
    if (!/switches the screen to|switch the screen to/.test(said)) t.problem("bug", `${id}: nobody in the room is seen switching the screen (${said})`);
    t.event("crt-flash", `${id}: ${before.camera} -> ${focus}, a CRT flash of about ${Math.round(lasted)} ms, "${window.iltvConsole.room().said.find((s) => /switch/.test(s)) || ""}"`);
    await consoleHeard(t, document, id);
    const lineFeeds = st.scenes[id].lines.filter((l) => l.feed);
    if (lineFeeds.length) {
      const last = lineFeeds[lineFeeds.length - 1].feed;
      const want = Array.isArray(last) ? last[last.length - 1] : last;
      if (api.selected() !== want) t.problem("bug", `${id}: the lines switch the screen to ${want}, it shows ${api.selected()}`);
    }
  }
  t.progress(0.25);

  /* 3. What happens in the room, at the matching story moments */
  t.scene(`${st.title}: the moments`);
  const moments = [
    ["the-chairs", "the trainee sits down", ["you:sit"]],
    ["okafor-out", "Mr. Okafor leaves through the door", ["okafor:leave"]],
    ["radio-ok", "Terrell comes in through the door", ["terrell:enter:left"]],
    ["okafor-call", "the phone rings and is answered", ["room:ring", "you:phone"]],
    ["log-in-asked", "something is written in the log", ["you:write"]],
    ["flicker", "the lights flicker and coffee spills", ["room:flicker", "you:spill"]],
    ["w1-dead", "Dee taps the screen", ["dee:touch"]],
    ["laptop-opened", "Dee stands up and gets angry", ["dee:stand", "dee:angry"]],
    ["radio-23", "Dee takes the keys and leaves", ["dee:stand", "dee:leave"]],
    ["trouble-silenced", "the silence button on the fire panel is pressed", ["you:press:panel"]],
  ].filter(([id]) => x.scenes[id] && x.scenes[id].picks.length);
  let n = 0;
  for (const [id, what, want] of moments) {
    await roomEnter(t, st, x, id, seen);
    const v = window.iltvConsole.room();
    const acted = v.acted.join(" ");
    for (const a of want) if (!v.acted.includes(a)) t.problem("bug", `${id} (${what}): the room didn't do "${a}" (it did: ${acted || "nothing"})`);
    const data = roomDataActs(st, id);
    if (JSON.stringify(v.acted) !== JSON.stringify(data)) t.problem("bug", `${id}: the room did ${JSON.stringify(v.acted)}, the scene's data says ${JSON.stringify(data)}`);
    if (id === "okafor-out" && v.actors.okafor && v.actors.okafor.present) t.problem("bug", "okafor-out: Mr. Okafor is still in the room after he leaves");
    if (id === "radio-23" && v.actors.dee && v.actors.dee.present) t.problem("bug", "radio-23: Dee is still in the room after she leaves with the keys");
    if (id === "the-chairs" && v.actors.you.posture !== "seated") t.problem("bug", "the-chairs: the trainee never sat down");
    t.event("moment", `${id}: ${what}: ${acted}`);
    t.progress(0.25 + (0.35 * ++n) / moments.length);
  }

  /* 4. Seen in motion (nothing skipped): the door, the ring and the answer, the stand and the anger */
  t.scene(`${st.title}: in motion`);
  const live = async (id, label, steps) => {
    if (!x.scenes[id] || !x.scenes[id].picks.length) return;
    await roomEnter(t, st, x, id, seen, { hear: false });
    for (const [what, test, ms] of steps) {
      const took = await roomWatch(() => test(roomStage(document)), ms || 45000);
      if (took < 0) t.problem("bug", `${id}: ${what} never showed (${label})`);
      else t.event("motion", `${id}: ${what}, ${Math.round(took)} ms after the scene opened or the step before`);
    }
    await consoleHeard(t, document, id);
  };
  const fig = (who, attr, value) => (r) => r.host.querySelector(`.fig[data-who="${who}"][${attr}${value == null ? "" : `="${value}"`}]`);
  await live("okafor-out", "Mr. Okafor leaves", [
    ["the door opens", (r) => r.host.hasAttribute("data-door")],
    ["Mr. Okafor walks to the door", fig("okafor", "data-spot", "door")],
    ["Dee knocks twice on the wall", fig("dee", "data-pose", "knock")],
  ]);
  await live("okafor-call", "the night line", [
    ["the phone rings", (r) => r.host.hasAttribute("data-ring")],
    ["the trainee answers it", fig("you", "data-pose", "phone")],
  ]);
  await live("laptop-opened", "Dee is angry", [
    ["Dee stands up", fig("dee", "data-posture", "standing")],
    ["Dee gets angry", fig("dee", "data-angry")],
  ]);
  t.progress(0.7);

  /* 5. Out of the room: people, in the place they are in; back in the room: silhouettes again */
  t.scene(`${st.title}: out of the room`);
  for (const [id, place] of [["tour1-door", "stairwell"], ["tour2-trucks", "dock"], ["tour3-test", "roof"]].filter(([i]) => x.scenes[i])) {
    await roomEnter(t, st, x, id, seen, { hear: false });
    await sleep(500);
    const a = roomStage(document);
    if (a.mode !== "away" || a.place !== place || a.look !== "color") t.problem("bug", `${id}: out of the room it is ${a.mode}/${a.place}/${a.look}, not away/${place}/color`);
    for (const f of a.figs) if (a.fill(f) === SILHOUETTE) t.problem("bug", `${id}: ${f.getAttribute("data-who")} is still a silhouette out of the room`);
    if (!a.figs.find((f) => f.getAttribute("data-who") === "dee") || !a.figs.find((f) => f.getAttribute("data-who") === "you")) t.problem("bug", `${id}: the trainee and Dee aren't shown in the ${place}`);
    const inset = byIdIn(document, "console-big").getBoundingClientRect();
    const room = a.host.getBoundingClientRect();
    if (inset.width > room.width * 0.4) t.problem("bug", `${id}: the big screen is still the focus out of the room (${Math.round(inset.width)} of ${Math.round(room.width)} px)`);
    const still = a.host.getAttribute("data-art") === "photo" ? a.host.querySelector(".room-plate") : null;
    if (still) {
      if (!new RegExp(`/places/${place}`).test(still.getAttribute("src") || "")) t.problem("bug", `${id}: the photograph is ${still.getAttribute("src")}, not the ${place}'s still`);
      else if (!still.complete || !still.naturalWidth) t.problem("bug", `${id}: the ${place}'s still (${still.getAttribute("src")}) didn't load`);
    } else if (!a.host.querySelector("#console-room-art svg, .room-art svg") || a.host.querySelector(".r-door")) t.problem("bug", `${id}: the picture is still the control room, not the ${place}`);
    t.event("away", `${id}: ${place}, ${a.figs.map((f) => f.getAttribute("data-who")).join(" and ")} drawn as people, the screen an inset`);
  }
  if (x.scenes["visitor-desk"]) {
    await roomEnter(t, st, x, "visitor-desk", seen, { hear: false });
    const sawLobby = await roomWatch(() => roomStage(document).place === "lobby", 60000);
    if (sawLobby < 0) t.problem("bug", "visitor-desk: the trainee never went out to the lobby desk");
    else {
      const a = roomStage(document);
      if (a.look !== "color" || a.mode !== "away") t.problem("bug", `visitor-desk: in the lobby it is ${a.mode}/${a.look}, not away/color`);
    }
    const back = await roomWatch(() => roomStage(document).place === "room", 90000);
    if (back < 0) t.problem("bug", "visitor-desk: the trainee never came back to the control room");
    else {
      await sleep(400);
      const a = roomStage(document);
      if (a.mode !== "room" || a.look !== "sil") t.problem("bug", `visitor-desk: back in the room it is ${a.mode}/${a.look}, not room/sil`);
      for (const f of a.figs) if (a.fill(f) !== SILHOUETTE) t.problem("bug", `visitor-desk: ${f.getAttribute("data-who")} isn't a silhouette back in the room`);
      t.event("away", "visitor-desk: the lobby desk (people), then back in the room (silhouettes)");
    }
    await consoleHeard(t, document, "visitor-desk");
  }
  const endingId = Object.keys(st.scenes).find((id) => st.scenes[id].ending && st.scenes[id].place === "room-day" && x.scenes[id]);
  if (endingId) {
    await roomEnter(t, st, x, endingId, seen, { hear: false });
    await sleep(500);
    const a = roomStage(document);
    if (a.look !== "color" || a.mode !== "room") t.problem("bug", `${endingId}: the ending is ${a.mode}/${a.look}, not the room in daylight with people`);
    for (const f of a.figs) if (a.fill(f) === SILHOUETTE) t.problem("bug", `${endingId}: ${f.getAttribute("data-who")} is a silhouette at the end of the shift`);
    t.event("away", `${endingId}: the ending in daylight, ${a.figs.length} people drawn in colour`);
    await consoleHeard(t, document, endingId);
  }
  t.progress(0.85);

  /* 6. Phone, tablet and desktop: the room scales to the width, nothing overlaps, no sideways scroll */
  for (const [w, h, name] of [[390, 844, "phone"], [360, 640, "small phone"], [844, 390, "phone on its side"], [820, 1180, "tablet"], [1280, 800, "desktop"]]) {
    const where = `${name} ${w}x${h}`;
    t.scene(where);
    await consoleFresh(t, st);
    const doc = await viewFrameLoad(t, `/?story=${st.id}`, w, h);
    const api = apiOf(doc);
    if (!api) { t.problem("bug", `${where}: the console player didn't start in the frame`); continue; }
    await consolePrompt(t, doc, where);
    await waitFor(() => api.lines() && api.lines().playing >= 0, 4000);
    await sleep(400);
    await consoleFit(t, doc, `${where}, the room and a line playing`);
    const a = roomStage(doc);
    const room = a.host.getBoundingClientRect();
    const big = byIdIn(doc, "console-big").getBoundingClientRect();
    const win = doc.defaultView;
    if (room.right > win.innerWidth + 0.5 || room.left < -0.5) t.problem("bug", `${where}: the room runs off the side (${Math.round(room.left)}..${Math.round(room.right)})`);
    const ratio = room.height / room.width;
    if (Math.abs(ratio - 0.6) > 0.02) t.problem("bug", `${where}: the room is ${Math.round(room.width)}x${Math.round(room.height)}, not the picture's 5:3`);
    if (w < 800 && h > w && room.width < win.innerWidth * 0.85) t.problem("bug", `${where}: the room is only ${Math.round(room.width)} of ${win.innerWidth} px wide (it should scale to the width)`);
    if (big.width < 100 || big.left < room.left || big.right > room.right) t.problem("bug", `${where}: the big screen is ${Math.round(big.width)} px wide or outside the room`);
    const strip = [...doc.querySelectorAll("#console-wall .feed")].map((el) => el.getBoundingClientRect());
    if (strip.some((r2) => r2.right > win.innerWidth + 0.5 || r2.width < 20)) t.problem("bug", `${where}: the camera strip doesn't fit (${strip.map((r2) => Math.round(r2.width)).join(", ")})`);
    for (const f of a.figs) {
      const fr = f.getBoundingClientRect();
      if (fr.right < room.left || fr.left > room.right) t.problem("bug", `${where}: ${f.getAttribute("data-who")} is outside the room`);
    }
    const shot = byIdIn(doc, "console-room").getBoundingClientRect();
    t.event("layout", `${where}: room ${Math.round(shot.width)}x${Math.round(shot.height)}, big screen ${Math.round(big.width)}x${Math.round(big.height)}, ${strip.length} tiles of ${Math.round(strip[0].width)} px`);
    if (w === 390 && h === 844) {
      // [phone] the room picture is the main element: at least 50% taller than the transcript panel, which sits below it; the speaker's rim shows
      const subs = byIdIn(doc, "console-subs").getBoundingClientRect();
      t.metric("phoneRoomPx", Math.round(shot.height));
      t.metric("phoneTranscriptPx", Math.round(subs.height));
      if (shot.height < subs.height * 1.5) t.problem("bug", `${where}: the room picture is ${Math.round(shot.height)} px tall, the transcript ${Math.round(subs.height)} px: the picture must be at least 50% taller`);
      if (subs.top < shot.bottom - 1) t.problem("bug", `${where}: the transcript (top ${Math.round(subs.top)}) covers the room picture (bottom ${Math.round(shot.bottom)})`);
      const ln = api.lines();
      if (ln && ln.playing >= 0) {
        await sleep(450);
        const l = st.scenes[api.scene()].lines[ln.playing];
        const bad = l && speakerMarked(doc, l.speaker);
        t.event("phone-rim", bad ? `${where}: ${bad}` : `${where}: the speaker's rim is visible (${l ? l.speaker : "?"})`);
        if (bad) t.problem("bug", `${where}: ${bad}`);
      }
    }
    await checkNotEnlargeable(t, doc, where);
    await consoleHeard(t, doc, where);
    await consoleFit(t, doc, `${where}, the room and the choices`);
    closeViewFrame();
  }
  /* 7. Characters (J, 2026-11-11): people with moods, not cut-outs. The first ten scenes at 1280x720: poses and moods per person,
        the speaker's rim marked on every line, nobody still for 5 s, pose fades of 150-250 ms. */
  {
    t.scene("Characters: the first ten scenes");
    await consoleFresh(t, st);
    const ids = st.order ? st.order.slice(0, 10) : Object.keys(st.scenes).slice(0, 10);
    const x = consoleExplore(st);
    const seenPoses = {}, fadeMs = [];
    let marked = 0, unmarked = 0, linesSeen = 0;
    const moodsSeen = {};
    for (const id of ids) {
      if (id !== st.start && !x.scenes[id]) continue;
      if (id !== st.start) await roomEnter(t, st, x, id, null, { hear: false }); // the first scene is already open (consoleFresh)
      const doc = document;
      const api = apiOf(doc);
      await roomWatch(() => api.lines() && api.lines().total > 0, 6000);
      const lines = st.scenes[id].lines;
      const still = {}; // who -> { sig, since }
      let lastLine = -2;
      const t0 = performance.now();
      while (performance.now() - t0 < 14000) {
        const ln = api.lines();
        if (!ln || ln.done >= ln.total) break;
        const now = performance.now();
        const v = api.room();
        const ph = v && v.photo;
        if (ph && ph.on) {
          for (const w of doc.querySelectorAll("#console-room .room-pose")) {
            const who = w.getAttribute("data-who");
            if (!w.getAttribute("data-file")) continue;
            const im = w.querySelector("img.on");
            const sig = doc.defaultView.getComputedStyle(w).transform + "|" + (im ? doc.defaultView.getComputedStyle(im).transform : "");
            const prev = still[who];
            if (!prev || prev.sig !== sig) still[who] = { sig, since: now };
            else if (now - prev.since > 5000 && !doc.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches) { t.problem("bug", `${id}: ${who} stays fully still for ${Math.round((now - prev.since) / 1000)} s while a line plays`); still[who].since = now + 1e9; }
          }
          if (ln.playing >= 0 && ln.playing !== lastLine) {
            lastLine = ln.playing;
            await sleep(450); // the pose crossfade and the rim settle
            const l = lines[ln.playing];
            if (l && api.lines() && api.lines().playing === ln.playing) {
              linesSeen++;
              const bad = speakerMarked(doc, l.speaker);
              if (bad) { unmarked++; t.problem("bug", `${id} line ${ln.playing + 1}: ${bad}`); } else marked++;
            }
          }
        }
        await sleep(250);
      }
      try { await consoleHeard(t, doc, `characters ${id}`); } catch (e) { /* the scene's lines are taken as heard */ }
      const v = api.room();
      if (v && v.photo) {
        for (const [who, list] of Object.entries(v.photo.poses || {})) { seenPoses[who] = seenPoses[who] || new Set(); list.forEach((k) => seenPoses[who].add(k)); }
        for (const f of v.photo.fades || []) fadeMs.push(f.ms);
        for (const [who, mo] of Object.entries(v.photo.moods || {})) { moodsSeen[who] = moodsSeen[who] || new Set(); moodsSeen[who].add(mo); }
      }
    }
    const count = (who) => (seenPoses[who] ? seenPoses[who].size : 0);
    t.metric("poseCountDee", count("dee"));
    t.metric("poseCountOkafor", count("okafor"));
    t.metric("poseCountYou", count("you"));
    t.event("poses", `first ten scenes: Dee ${count("dee")} (${[...(moodsSeen.dee || [])].join("/")}), Okafor ${count("okafor")} (${[...(moodsSeen.okafor || [])].join("/")}), the trainee ${count("you")}`);
    if (count("dee") < 3) t.problem("bug", `Dee shows ${count("dee")} distinct poses in the first ten scenes (3 at least)`);
    if (count("okafor") < 2) t.problem("bug", `Mr. Okafor shows ${count("okafor")} distinct poses in the first ten scenes (2 at least)`);
    t.metric("speakerMarkedLines", marked);
    t.event("speaker-marked", `${marked} of ${linesSeen} lines had the speaker's rim brighter than every other figure's`);
    if (!linesSeen) t.problem("bug", "no line was checked for the speaker's rim");
    t.metric("poseFades", fadeMs.length);
    if (fadeMs.length) {
      const avg = Math.round(fadeMs.reduce((a, b) => a + b, 0) / fadeMs.length);
      t.metric("poseFadeMs", avg);
      t.event("pose-fade", `${fadeMs.length} pose fades measured, ${Math.min(...fadeMs)}-${Math.max(...fadeMs)} ms (mean ${avg})`);
      if (fadeMs.some((ms) => ms < 150 || ms > 250)) t.problem("bug", `a pose cross-fade took ${Math.min(...fadeMs)}-${Math.max(...fadeMs)} ms, not 150-250`);
    } else t.problem("warn", "no pose cross-fade was measured in the first ten scenes");
  }

  t.progress(1);
  await toLanding(t);
}

/* ---------------- first-minutes: newcomer timing at desktop and phone ---------------- */
/** As a newcomer from a fresh browser: hero motion within 2 s; per story secondsToFirstMotion / Sound /
    Choice (from Tap to play) and wordsBeforeFirstChoice; first choice after 30 s is a problem. Also reduced-motion
    posters-only, and at 390x844 a centred catalogue card starts its loop. */
async function firstMinutesRun(options, t) {
  const inSmoke = options && options.at === "smoke";
  if (!savedRuns && savedCookie == null) rememberProgress();
  clearProgress();
  const sizes = inSmoke
    ? [[1280, 720, "1280x720"], [390, 844, "390x844"]]
    : [[1280, 720, "1280x720"], [390, 844, "390x844"]];
  const ids = listedStories().map((s) => s.id);

  for (let si = 0; si < sizes.length; si++) {
    const [w, h, label] = sizes[si];
    t.scene(`First minutes at ${label}`);
    const doc = await viewFrameLoad(t, "/", w, h);
    const win = doc.defaultView;
    // Clear progress again inside the frame's origin (same as the runner page).
    try {
      for (const st of listedStories()) {
        win.localStorage.removeItem(`iltv.run.${st.cookie}`);
        win.localStorage.removeItem(`${st.cookie}`);
      }
    } catch (e) { /* none */ }
    // Wait out the title splash the way a viewer does (it fades by itself).
    await waitFor(() => {
      const sp = doc.getElementById("title-splash");
      return !sp || sp.hidden || +win.getComputedStyle(sp).opacity === 0 || !doc.documentElement.classList.contains("is-splash-pending");
    }, 6000);
    const tLand = performance.now();
    // Motion clock starts at landing paint (nav start), not after the splash wait — the criterion is "within 2 s of load".
    const nav = win.performance.getEntriesByType("navigation")[0];
    const sinceLoad = () => (nav ? win.performance.now() - nav.startTime : performance.now() - tLand);
    const heroVid = () => doc.querySelector("a.hero video.hero-trailer");
    const moving = await waitFor(() => {
      const v = heroVid();
      return v && !v.paused && v.currentTime > 0.05;
    }, 2500);
    const heroMs = Math.round(sinceLoad());
    t.metric(`secondsToFirstMotion.hero.${label}`, Number((heroMs / 1000).toFixed(2)));
    t.event("hero-motion", `${label}: ${moving ? "moving" : "STILL"} after ${heroMs} ms from load`);
    if (!moving || heroMs > 2000) t.problem("bug", `${label}: the hero trailer was not moving within 2 s of load (after ${heroMs} ms)`);

    // Phone: a catalogue card's loop starts when that card is centred (touch-shaped drag, then settle).
    if (w <= 400) {
      const card = doc.querySelector("#story-list a.story-card");
      if (card) {
        const before = win.scrollY;
        const r0 = card.getBoundingClientRect();
        const targetY = before + r0.top + r0.height / 2 - win.innerHeight / 2;
        // Touch-shaped drag: pointerdown → move → up, then a settle scroll (IntersectionObserver + scroll listener).
        const startX = Math.min(w / 2, 180), startY = Math.min(h * 0.7, 600);
        doc.body.dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true, clientX: startX, clientY: startY, pointerType: "touch", pointerId: 1, isPrimary: true }));
        for (let step = 1; step <= 4; step++) {
          doc.body.dispatchEvent(new win.PointerEvent("pointermove", { bubbles: true, clientX: startX, clientY: startY - step * 40, pointerType: "touch", pointerId: 1, isPrimary: true }));
          win.scrollTo(0, before + (targetY - before) * (step / 4));
          await sleep(40);
        }
        doc.body.dispatchEvent(new win.PointerEvent("pointerup", { bubbles: true, clientX: startX, clientY: startY - 160, pointerType: "touch", pointerId: 1, isPrimary: true }));
        win.scrollTo(0, targetY);
        card.scrollIntoView({ block: "center", behavior: "instant" });
        win.dispatchEvent(new win.Event("scroll"));
        await sleep(900);
        const loop = card.querySelector("video.card-loop");
        const L = win.iltvLiving;
        const previewing = (L && L.previewing && L.previewing() === card.dataset.story) || (loop && !loop.paused && loop.currentTime > 0.05);
        t.event("card-centre-preview", `${label}: ${card.dataset.story} ${previewing ? "playing" : "NOT playing"} (scroll ${Math.round(win.scrollY)}px)`);
        if (!previewing) t.problem("bug", `${label}: centred card ${card.dataset.story} did not start its preview loop`);
      }
    }

    // Per story from Tap to play.
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const st = story(id);
      t.scene(`First minutes: ${st.title} at ${label}`);
      // Open from this frame's landing.
      if (win.iltvStories && win.iltvStories.current()) {
        const back = doc.querySelector("#spark-stories, #console-stories");
        if (back && !back.closest("[hidden]")) await tapAt(t, back, "All stories");
        await sleep(300);
      }
      const tile =
        doc.querySelector(`#story-list a.story-card[data-story="${id}"]`) ||
        doc.querySelector(`#stories a.hero[data-story="${id}"]`);
      if (!tile) { t.problem("bug", `${label}: no tile for ${id}`); continue; }
      tile.scrollIntoView({ block: "center", behavior: "instant" });
      await sleep(150);
      await tapAt(t, tile.querySelector("h2") || tile, `${st.title} tile`);
      await sleep(200);
      const sound = win.hawkesSound;
      if (sound && sound.prompt()) await passPrompt(t, doc, `${id} (${label})`);
      const t0 = performance.now();
      let motionS = null, soundS = null, choiceS = null;
      const words = () => {
        const box = isConsole(st) ? doc.getElementById("console-subs") : doc.getElementById("spark-story");
        return ((box && box.innerText) || "").trim().split(/\s+/).filter(Boolean).length;
      };
      let wordsBefore = 0;
      // Console opens are voiced: Skip through lines so the 30 s first-choice bar measures UI readiness, not the night's open.
      const deadline = t0 + (isConsole(st) ? 90000 : 45000);
      while (performance.now() < deadline) {
        if (motionS == null) {
          if (isConsole(st)) {
            const room = doc.getElementById("console-room");
            if (room && room.getClientRects().length) motionS = (performance.now() - t0) / 1000;
          } else {
            const v = doc.querySelector("#spark-video video:not(.spark-leave)");
            if (v && !v.paused && v.currentTime > 0.05) motionS = (performance.now() - t0) / 1000;
          }
        }
        if (soundS == null) {
          if (isConsole(st)) {
            const a = doc.querySelector("#console audio, audio[data-sound-start], audio");
            if (a && !a.paused && a.currentTime > 0.05) soundS = (performance.now() - t0) / 1000;
          } else {
            const v = doc.querySelector("#spark-video video:not(.spark-leave)");
            if (v && !v.paused && v.currentTime > 0.05) {
              // First decoded audio, or any play after Tap to play unlocked sound.
              if (!v.muted || (v.webkitAudioDecodedByteCount && v.webkitAudioDecodedByteCount > 0)) soundS = (performance.now() - t0) / 1000;
            }
          }
        }
        if (isConsole(st)) {
          const skip = doc.getElementById("console-skip");
          if (skip && !skip.disabled && skip.offsetParent !== null) {
            skip.click();
            await sleep(40);
          }
        }
        if (choiceS == null) {
          const btns = isConsole(st)
            ? [...doc.querySelectorAll("#console-choices .choice")].filter((b) => b.offsetParent !== null)
            : [...doc.querySelectorAll("#spark-choices .choice")].filter((b) => b.offsetParent !== null);
          const ready = isConsole(st) || (doc.getElementById("spark-choices") && doc.getElementById("spark-choices").dataset.phase === "ready");
          if (ready && btns.length) {
            choiceS = (performance.now() - t0) / 1000;
            wordsBefore = words();
          }
        }
        if (motionS != null && choiceS != null) break;
        await sleep(80);
      }
      const round = (n) => (n == null ? null : Number(n.toFixed(2)));
      t.metric(`secondsToFirstMotion.${id}.${label}`, round(motionS));
      t.metric(`secondsToFirstSound.${id}.${label}`, round(soundS));
      t.metric(`secondsToFirstChoice.${id}.${label}`, round(choiceS));
      t.metric(`wordsBeforeFirstChoice.${id}.${label}`, wordsBefore);
      t.event("first-minutes", `${id} @ ${label}: motion ${round(motionS)}s, sound ${round(soundS)}s, choice ${round(choiceS)}s, words ${wordsBefore}${isConsole(st) ? " (console, lines skipped)" : ""}`);
      if (choiceS == null) t.problem("bug", `${id} @ ${label}: no choice appeared within ${isConsole(st) ? 90 : 45} s of Tap to play`);
      else if (choiceS > 30) t.problem("bug", `${id} @ ${label}: first choice after ${choiceS.toFixed(1)} s (over 30 s)`);
      // Back to landing for the next story.
      const back = doc.querySelector("#spark-stories, #console-stories");
      if (back) { await tapAt(t, back, "All stories"); await sleep(300); }
      t.progress((si + (i + 1) / ids.length) / sizes.length);
    }
  }

  // prefers-reduced-motion / still mode: posters only, no preview video plays.
  // `?living=still` forces the same path living.js takes when prefers-reduced-motion is set (in-page bots can't emulate media features).
  t.scene("First minutes: reduced motion");
  const stillDoc = await viewFrameLoad(t, "/?living=still", 1280, 720);
  await sleep(2000);
  const playing = [...stillDoc.querySelectorAll(".hero-trailer, .card-loop")].filter((v) => v.src && !v.paused && v.currentTime > 0);
  t.event("reduced-motion", `${playing.length} preview videos playing (want 0); living.reduced=${stillDoc.defaultView.iltvLiving && stillDoc.defaultView.iltvLiving.reduced()}`);
  if (playing.length) t.problem("bug", `prefers-reduced-motion: ${playing.length} preview video(s) still playing`);
  if (!(stillDoc.defaultView.iltvLiving && stillDoc.defaultView.iltvLiving.reduced())) t.problem("bug", "prefers-reduced-motion: living.js did not enter still mode");
  if (stillDoc.documentElement.getAttribute("data-living") !== "still") t.problem("bug", "prefers-reduced-motion: html[data-living=still] was not set");
  const posters = stillDoc.querySelectorAll("a.hero picture img, a.hero img, .story-card picture img, .story-card img");
  if (![...posters].some((img) => img.getClientRects().length)) t.problem("bug", "prefers-reduced-motion: no posters visible on the landing page");

  closeViewFrame();
  if (!inSmoke) restoreProgress();
  t.progress(1);
}

/* ---------------- living-home ---------------- */
async function livingHomeRun(options, t) {
  rememberProgress();
  await passSplash(t);
  if (!landingShown()) await toLanding(t);
  const L = window.iltvLiving;
  if (!L) throw new Error("js/living.js didn't start");
  t.scene("Living home: the house lights come up");
  const start = performance.now();
  await sleep(2600);
  t.event("lights", `${L.lit()} of ${L.cards()} cards lit`);
  if (L.lit() < L.cards()) t.problem("bug", "the house lights did not come up on every card");
  t.progress(0.3);
  t.scene("Living home: the hero trailer");
  await sleep(500);
  const heroOk = L.heroPlaying && L.heroPlaying();
  t.event("hero-play", heroOk ? "playing" : (L.reduced && L.reduced() ? "reduced-motion" : "NOT playing"));
  if (!L.reduced || !L.reduced()) {
    if (!heroOk) t.problem("bug", "the hero trailer is not playing");
    const ms = L.motionMs && L.motionMs();
    if (ms != null && ms > 2000) t.problem("bug", `the hero trailer started after ${Math.round(ms)} ms (> 2 s)`);
  }
  t.progress(0.6);
  t.scene("Living home: a card preview");
  const card = document.querySelector("#story-list a.story-card");
  if (card) {
    card.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await sleep(600);
    t.event("card-preview", `${card.dataset.story}: ${L.previewing() === card.dataset.story ? "playing" : "idle"}`);
    card.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
  }
  window.scrollTo(0, 0);
  await sleep(2000);
  const log = L.log().filter((e) => e.at >= 0);
  const times = log.map((e) => e.at / 1000).sort((a, b) => a - b);
  let max = 0;
  for (let i = 1; i < times.length; i++) max = Math.max(max, times[i] - times[i - 1]);
  max = Math.max(max, (performance.now() - start) / 1000 - (times[times.length - 1] || 0));
  const kinds = new Set(log.map((e) => e.kind));
  t.metric("quality.maxQuietSeconds", Math.round(max * 10) / 10);
  t.metric("quality.textOnlyBeats", 0);
  t.event("living-kinds", [...kinds].join(", "));
  if (max > 10) t.problem("bug", `${max.toFixed(1)} s with nothing to see, hear or do`);
  restoreProgress();
  t.progress(1);
}

/* ---------------- front-door: the landing page as a streaming service's front door ---------------- */

/** A page's width: nothing wider than the screen, and every press target on it at least 44 px each way. */
function frontDoorFit(t, doc, w, where) {
  const win = doc.defaultView;
  const wide = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth);
  if (wide > w + 1) t.problem("bug", `${where}: the page is ${wide}px wide in a ${w}px screen (sideways scroll)`);
  if (doc.querySelector(".tile-wall, .tile-screen")) t.problem("bug", `${where}: empty unlabeled scanline bars are on the landing page`);
  const small = [...doc.querySelectorAll("#stories .hero-go, #stories .continue-go, #stories .story-card-go")].filter((el) => el.getClientRects().length && (el.getBoundingClientRect().height < 30));
  for (const el of small) t.problem("bug", `${where}: "${(el.textContent || "").trim()}" is ${Math.round(el.getBoundingClientRect().height)}px tall`);
  /* First five minutes (critic, 2026-11-14): Play is the one large call to action, on the first screen. */
  const heroPlay = doc.querySelector("#stories a.hero .hero-go");
  if (heroPlay && heroPlay.getClientRects().length) {
    const pr = heroPlay.getBoundingClientRect();
    t.event("play-cta", `${where}: hero Play ${Math.round(pr.width)}x${Math.round(pr.height)}px, bottom ${Math.round(pr.bottom)} of ${win.innerHeight}px`);
    if (pr.height < 52) t.problem("bug", `${where}: the hero's Play is ${Math.round(pr.height)}px tall, not a large call to action`);
    if (pr.bottom > win.innerHeight) t.problem("bug", `${where}: the hero's Play is below the first screen (bottom ${Math.round(pr.bottom)}px of ${win.innerHeight}px)`);
  }
  for (const el of doc.querySelectorAll("#stories a.hero, #stories a.story-card, #stories a.continue-card")) {
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) t.problem("bug", `${where}: a ${el.className} is ${Math.round(r.width)}x${Math.round(r.height)}px`);
    if (r.right > w + 1 && !el.closest("#continue-list")) t.problem("bug", `${where}: a ${el.className} runs past the screen (right edge ${Math.round(r.right)}px of ${w})`);
  }
  return win.innerWidth;
}

/** The criteria of J's front door, played: every card has poster, runtime, mood and percent explored (and the hero
    the same); no Continue row before anything is started; one real choice in a story, then the row shows it with its
    percent, and its button opens the story where it was left; the page fits at 390 px. */
async function frontDoorRun(options, t) {
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passSplash(t);
  clearProgress();
  if (!landingShown()) await toLanding(t);
  await sleep(300);
  const list = listedStories();
  const row = () => document.getElementById("continue-row");
  const rowCards = () => [...document.querySelectorAll("#continue-list a.continue-card")];
  const checkFront = async (doc, where) => {
    for (const st of list) {
      const card = doc.querySelector(`#story-list a.story-card[data-story="${st.id}"]`);
      if (!card) { t.problem("bug", `${where}: no card for ${st.id}`); continue; }
      const img = card.querySelector("img, video");
      const poster = !!img && (img.tagName === "VIDEO" || (img.complete && img.naturalWidth > 0));
      const runtime = (card.querySelector(".meta-runtime")?.textContent || "").trim();
      const mood = (card.querySelector(".meta-mood")?.textContent || "").trim();
      const explored = (card.querySelector(".story-card-explored")?.textContent || "").trim();
      t.event("front-card", `${where}: ${st.id}: poster ${poster ? "loads" : "MISSING"}, runtime "${runtime}", mood "${mood}", "${explored}"`);
      if (!poster) t.problem("bug", `${where}: ${st.id}'s card has no poster that loads`);
      if (!/\d+\s*min/i.test(runtime)) t.problem("bug", `${where}: ${st.id}'s card has no runtime ("${runtime}")`);
      if (!mood) t.problem("bug", `${where}: ${st.id}'s card has no mood`);
      if (!/^\d+% explored$/.test(explored)) t.problem("bug", `${where}: ${st.id}'s card says "${explored}", not a percent explored`);
    }
    const hero = doc.querySelector("#stories a.hero");
    if (!hero) t.problem("bug", `${where}: the landing page has no hero`);
    else {
      const himg = hero.querySelector("img");
      const ok = (himg && himg.complete && himg.naturalWidth > 0) && (hero.querySelector(".meta-runtime")?.textContent || "").trim() && (hero.querySelector(".meta-mood")?.textContent || "").trim() && (hero.querySelector("h2")?.textContent || "").trim();
      t.event("front-hero", `${where}: ${hero.dataset.story}: ${ok ? "poster, title, runtime and mood" : "INCOMPLETE"}`);
      if (!ok) t.problem("bug", `${where}: the hero lacks its poster, title, runtime or mood`);
    }
  };
  t.scene("Front door: fresh browser");
  await checkFront(document, "fresh");
  if (row() && !row().hidden) t.problem("bug", "a Continue row shows before any story is started");
  t.event("continue-row", `fresh: ${row() && !row().hidden ? "shown" : "hidden"} (${rowCards().length} cards)`);
  t.progress(0.25);

  t.scene("Front door: a choice in The Final Spark");
  await openStory(t, FIRST);
  await toStart(t);
  const btns = choiceButtons();
  if (!btns.length) throw new Error("no choices on The Final Spark's first page");
  await tapAt(t, btns[0], "the first choice");
  await sleep(500);
  const pct = stories().explored(FIRST);
  await toLanding(t);
  await sleep(300);
  // The featured story is the hero: it says Continue once, and appears neither in the Continue row nor twice in the catalogue.
  const heroGo = (document.querySelector("#stories a.hero .hero-go")?.textContent || "").trim();
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const goes = [...document.querySelectorAll("#stories .hero-go, #stories .continue-go, #stories .story-card-go")]
    .filter((el) => visible(el) && /continue/i.test(el.textContent || ""));
  const dupes = [...document.querySelectorAll(`#stories [data-story="${FIRST}"]`)].filter(visible);
  t.event("continue-once", `after one choice in ${FIRST}: hero "${heroGo}", ${dupes.length} visible element(s) for it, ${goes.length} Continue button(s), row ${row() && !row().hidden ? "shown" : "hidden"}`);
  if (dupes.length !== 1) t.problem("bug", `after a choice in ${FIRST} it appears ${dupes.length} times on the landing page, not once`);
  if (goes.length !== 1 || !/continue/i.test(heroGo)) t.problem("bug", `after a choice in ${FIRST} there should be one Continue button, on the hero (found ${goes.length}, hero says "${heroGo}")`);
  if (rowCards().some((c) => c.dataset.story === FIRST)) t.problem("bug", `${FIRST} is in the Continue row as well as the hero`);
  t.progress(0.55);

  t.scene("Front door: 390 px");
  const doc = await viewFrameLoad(t, "/", 390, 844);
  await waitFor(() => doc.querySelector("#story-list a.story-card[data-progress]") && doc.getElementById("continue-row"), 8000);
  await sleep(600);
  await checkFront(doc, "390px");
  frontDoorFit(t, doc, 390, "390px");
  // Every visible card is as wide as the Featured card and its ribbon sits inside it.
  const heroBox = doc.querySelector("#stories a.hero").getBoundingClientRect();
  const wide = [...doc.querySelectorAll("#stories a.story-card, #stories a.continue-card")].filter((c) => c.getClientRects().length);
  for (const c of wide) {
    const r = c.getBoundingClientRect();
    const rb = c.querySelector(".story-card-ribbon")?.getBoundingClientRect();
    const inside = !rb || (rb.left >= r.left - 0.5 && rb.right <= r.right + 0.5 && rb.top >= r.top - 0.5 && rb.bottom <= r.bottom + 0.5);
    t.event("card-width", `390px: ${c.dataset.story} ${Math.round(r.width)}px (hero ${Math.round(heroBox.width)}px, left ${Math.round(r.left)} vs ${Math.round(heroBox.left)}), ribbon ${inside ? "inside" : "CLIPPED"}`);
    if (Math.abs(r.width - heroBox.width) > 1 || Math.abs(r.left - heroBox.left) > 1) t.problem("bug", `390px: ${c.dataset.story}'s card is ${Math.round(r.width)}px wide at ${Math.round(r.left)}, the Featured card ${Math.round(heroBox.width)}px at ${Math.round(heroBox.left)}`);
    if (!inside) t.problem("bug", `390px: ${c.dataset.story}'s ribbon runs outside its card`);
  }
  closeViewFrame();
  // The Tree at 390: the root and its first choices fully in view, on a dark field, labels inside their nodes.
  t.scene("Front door: the Tree at 390 px");
  const tdoc = await viewFrameLoad(t, `/?story=${FIRST}`, 390, 844);
  await passPrompt(t, tdoc, "tree (390px)");
  await tapAt(t, tdoc.getElementById("tab-tree"), "the Tree tab");
  await sleep(500);
  const scroller = tdoc.querySelector("#spark-tree .tree-scroll");
  const sr = scroller && scroller.getBoundingClientRect();
  const nodes = [...tdoc.querySelectorAll("#spark-tree .tree-node")];
  const cut = nodes.slice(0, 1 + (story(FIRST).scenes[story(FIRST).start].choices.length)).filter((n) => { const r = n.getBoundingClientRect(); return r.left < sr.left - 0.5 || r.right > sr.right + 0.5; });
  const bg = scroller ? tdoc.defaultView.getComputedStyle(scroller).backgroundColor : "";
  const lum = (bg.match(/\d+/g) || [255, 255, 255]).slice(0, 3).map(Number).reduce((x, y) => x + y, 0) / 3;
  const spill = nodes.filter((n) => [...n.children].some((c) => c.scrollWidth > n.clientWidth + 1));
  t.event("tree-390", `${nodes.length} nodes, ${cut.length} of the first ones cut off, backdrop ${bg} (luminance ${Math.round(lum)}), ${spill.length} labels spill`);
  if (!scroller || !nodes.length) t.problem("bug", "390px: the Tree shows no nodes");
  if (cut.length) t.problem("bug", `390px: ${cut.length} of the root and first choices are cut off at the edge of the Tree`);
  if (lum > 60) t.problem("bug", `390px: the Tree's backdrop is ${bg}, not dark`);
  if (spill.length) t.problem("bug", `390px: ${spill.length} Tree labels run outside their node`);
  closeViewFrame();
  t.progress(0.8);

  t.scene("Front door: Continue opens where it was left");
  const before = stories().explored(FIRST);
  const cont = document.querySelector("#stories a.hero");
  if (cont) {
    cont.scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(200);
    await tapAt(t, cont.querySelector(".hero-go") || cont, "the hero's Continue");
    await sleep(500);
    if (stories().current() !== FIRST) t.problem("bug", `the Continue card didn't open ${FIRST} (open: ${stories().current()})`);
    else {
      const sound = soundOf();
      if (sound.prompt()) await passPrompt(t, document, FIRST);
      if (window.finalSpark.depth() < 1) t.problem("bug", "the Continue card opened the story at its start, not where it was left");
      t.event("continue-opened", `${FIRST} at ${window.finalSpark.scene()}, depth ${window.finalSpark.depth()}, ${stories().explored(FIRST)}% (was ${before}%)`);
    }
    await toLanding(t);
  }
  t.metric("continue_cards", rowCards().length);
  t.progress(1);
}

/* ---------------- progress: one choice in each story raises the percent explored; opening a story keeps the page at the top ---------------- */

/** Samples every animation frame: the page's scroll and whether the site header is fully in view. */
function frameWatch() {
  const w = { frames: 0, scrolled: 0, hidden: 0, worst: 0, on: true };
  const tick = () => {
    if (!w.on) return;
    w.frames++;
    const top = Math.max(window.scrollY || 0, document.scrollingElement?.scrollTop || 0, $("first-screen")?.scrollTop || 0);
    if (top > 0) { w.scrolled++; w.worst = Math.max(w.worst, top); }
    const h = document.querySelector(".site-header")?.getBoundingClientRect();
    if (!h || h.top < -0.5 || h.bottom <= 0 || h.height === 0) w.hidden++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return w;
}

/** Mid-hand-off checks for a choice: glow on the chosen card, others fading, aria-busy, one vibration, exactly one
    iltv:deciding for a double input. `doc` is the page or a sized frame; `buzz` is a shared vibrate log. */
function decisiveCheck(t, doc, where, mode, btns, box, buzz, before, ui) {
  const win = doc.defaultView || window;
  const chosenBtn = btns[0];
  const chosen = chosenBtn.classList.contains("is-chosen");
  const fading = btns.length < 2 || btns.slice(1).every((b) => b.classList.contains("is-fading") && parseFloat(win.getComputedStyle(b).opacity) < 1);
  const shadow = win.getComputedStyle(chosenBtn).boxShadow || "none";
  const glow = /0px 0px 2[0-9]px|0 0 2[0-9]px/.test(shadow.replace(/,/g, ", "));
  const scale = (() => {
    const tr = win.getComputedStyle(chosenBtn).transform || "";
    if (!tr || tr === "none") return 1;
    const m = tr.match(/matrix\(([-\d.e]+)/);
    return m ? parseFloat(m[1]) : 1;
  })();
  const reduced = !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const busy = box.getAttribute("aria-busy");
  const pressed = chosenBtn.getAttribute("aria-pressed");
  const focused = doc.activeElement === chosenBtn;
  const decisions = ui - before;
  t.event("decisive", `${where} ${mode}: chosen=${chosen} others-fading=${fading} glow=${glow} scale=${scale.toFixed(2)} reduced=${reduced} busy=${busy} pressed=${pressed} focus=${focused} vibrate=${JSON.stringify(buzz)} decisions=${decisions}`);
  if (!chosen) t.problem("bug", `${where}: the ${mode} didn't mark the chosen card`);
  if (!fading) t.problem("bug", `${where}: the other cards didn't fall away`);
  if (!glow) t.problem("bug", `${where}: the chosen card has no glow (box-shadow ${shadow.slice(0, 80)})`);
  if (!reduced && scale < 1.02) t.problem("bug", `${where}: the chosen card didn't scale up (scale ${scale.toFixed(2)})`);
  if (busy !== "true") t.problem("bug", `${where}: aria-busy was not set during the hand-off`);
  if (pressed !== "true") t.problem("bug", `${where}: aria-pressed was not set on the chosen card`);
  if (decisions !== 1) t.problem("bug", `${where}: ${decisions} choices fired for a double ${mode}`);
  if (mode === "tap" && "vibrate" in (win.navigator || navigator) && buzz[0] !== 10) t.problem("bug", `${where}: no 10 ms vibration (got ${JSON.stringify(buzz)})`);
  return { chosen, fading, glow };
}

/** Presses a choice twice (tap or key) and checks the hand-off mid-animation. */
async function decisivePress(t, doc, where, mode, key = "1") {
  const win = doc.defaultView || window;
  const console_ = !!doc.getElementById("console") && !doc.getElementById("console").hidden;
  const box = doc.getElementById(console_ ? "console-choices" : "spark-choices");
  const btns = [...(box ? box.querySelectorAll(".choice") : [])];
  if (btns.length < 1) {
    t.problem("bug", `${where}: no choices`);
    return null;
  }
  const buzz = [];
  const nav = win.navigator || navigator;
  const realVibrate = nav.vibrate;
  try { nav.vibrate = (ms) => { buzz.push(ms); return true; }; } catch (e) { /* read-only */ }
  let ui = 0;
  const onDeciding = () => ui++;
  // iltvDecide fires on the frame's (or page's) document; listen only there so we don't double-count.
  doc.addEventListener("iltv:deciding", onDeciding);
  const before = ui;
  if (mode === "tap") {
    btns[0].click();
    btns[0].click();
  } else {
    // The key listener is on the page document (js/console.js); in a frame, dispatch there.
    doc.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true }));
    doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: key === "1" ? "2" : "1", bubbles: true }));
  }
  await sleep(120);
  t.event("screenshot", `${where} ${mode}: mid-animation`);
  const result = decisiveCheck(t, doc, where, mode, btns, box, buzz, before, ui);
  doc.removeEventListener("iltv:deciding", onDeciding);
  try { nav.vibrate = realVibrate; } catch (e) { /* ignore */ }
  return result;
}

/** Opens a story in a sized frame with choices ready (Night Shift: first scene's lines already heard). */
async function decisiveOpenAt(t, id, w, h) {
  const st = story(id);
  const console_ = isConsole(st);
  clearProgress();
  if (console_) consoleSeedWrite(st, [], null);
  const doc = await viewFrameLoad(t, `/?story=${id}`, w, h);
  if (console_) {
    await consolePrompt(t, doc, `${id} ${w}x${h}`);
    t.event("seeded-run", `${id} ${w}x${h}: first scene's lines counted as heard (setup shortcut)`);
    if (!(await waitFor(() => doc.querySelectorAll("#console-choices .choice").length > 0, 15000))) {
      throw new Error(`${id} at ${w}x${h}: no choices at the first scene`);
    }
  } else {
    await passPrompt(t, doc, `${id} ${w}x${h}`);
    const box = doc.getElementById("spark-choices");
    const v = () => doc.querySelector("#spark-video video:not(.spark-leave)");
    await waitFor(() => v() && (!v().paused || v().ended || (v().duration && v().currentTime > 0)), 8000);
    const vid = v();
    if (vid && vid.duration > 0.5 && isFinite(vid.duration)) vid.currentTime = Math.max(0, vid.duration - 0.12);
    else if (vid) vid.dispatchEvent(new doc.defaultView.Event("ended"));
    if (!(await waitFor(() => box && box.dataset.phase === "ready" && box.querySelectorAll(".choice").length > 0, 20000))) {
      throw new Error(`${id} at ${w}x${h}: the choices never came up`);
    }
  }
  return doc;
}

/* ---------------- water-gates: the water you kept decides which choices stay open ---------------- */

/** Every way (scene ids from the start, never through a death) to `target` whose counts and flags satisfy `ok(counts, flags)`:
    the shortest, with the gates honoured (a gated choice is taken only when the way holds what it needs). */
function gateWay(st, target, ok) {
  const kit = window.iltvKit;
  const flagsOf = (way) => {
    const out = {};
    for (let i = 0; i + 1 < way.length; i++) {
      const c = st.scenes[way[i]].choices.find((x) => x[2] === way[i + 1]);
      if (c && c[4]) Object.assign(out, c[4]);
    }
    return out;
  };
  const open = (c, way) => {
    const g = c[7]; // a choice row's gate: [say, en, next, default, set, when, matches, gate]
    if (!g) return true;
    const flags = flagsOf(way);
    for (const [k, v] of Object.entries(g.requires || {})) if ((flags[k] === undefined ? false : flags[k]) !== v) return false;
    return kit.meets(kit.counts(st.inventory, st.scenes, st.start, way), g.needs || {});
  };
  const queue = [[st.start]];
  while (queue.length) {
    const way = queue.shift();
    const id = way[way.length - 1];
    if (id === target && ok(kit.counts(st.inventory, st.scenes, st.start, way), flagsOf(way))) return way;
    if (way.length > 12 || st.scenes[id].dead || id === target) continue;
    for (const c of st.scenes[id].choices) if (open(c, way)) queue.push([...way, c[2]]);
  }
  return null;
}

function gateSeed(t, st, way, why) {
  clearProgress();
  document.cookie = `${st.cookie}=${encodeURIComponent(JSON.stringify({ scene: way[way.length - 1], history: way.slice(0, -1) }))}; Path=/`;
  t.event("seeded-run", `${st.id}: at ${way[way.length - 1]} (${way.length - 1} choices in) for ${why}`);
}

/** The fork `sid` as a viewer at 390x844 sees it (a seeded run there, a real Tap to play press): the buttons, the locked
    rows and the inventory bar, measured. Returns what was seen. */
async function gateLook(t, st, sid, way, why) {
  gateSeed(t, st, way, why);
  const doc = await viewFrameLoad(t, `/?story=${st.id}`, 390, 844);
  const win = doc.defaultView;
  await passPrompt(t, doc, `${st.id} ${sid} 390x844`);
  await waitFor(() => win.finalSpark.scene() === sid, 8000);
  await rewindEndClip(doc);
  await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready", 8000);
  await sleep(500);
  const touch = win.matchMedia("(pointer: coarse)").matches;
  const box = doc.getElementById("spark-choices");
  const buttons = [...box.querySelectorAll(".choice")];
  const locked = [...box.querySelectorAll(".choice-locked")];
  const bar = doc.querySelector(".inventory.kit");
  const water = bar && bar.querySelector('[data-item="water"]');
  const seen = {
    buttons: buttons.map(enText),
    locked: locked.map((el) => ({ label: enText(el), text: (el.querySelector(".choice-need") || {}).textContent || "", height: Math.round(el.getBoundingClientRect().height), font: parseFloat(win.getComputedStyle(el.querySelector(".choice-need") || el).fontSize), tag: el.tagName, el })),
    water: win.finalSpark.inventory().water,
    barWater: water ? Number(water.dataset.count) : null,
    story: (doc.getElementById("spark-story").textContent || "").trim(),
    shown: win.finalSpark.shown(),
    doc, win, touch
  };
  // The water count is on screen with the choices: the bar's water chip fully inside the screen, clear of the choice rows.
  if (!water) t.problem("bug", `${st.id}/${sid}: no water count in the inventory bar`);
  else {
    const wr = water.getBoundingClientRect();
    if (wr.left < 0 || wr.right > win.innerWidth || wr.top < 0 || wr.bottom > win.innerHeight) t.problem("bug", `${st.id}/${sid}: the water count is not fully on screen at 390x844 (${Math.round(wr.left)}..${Math.round(wr.right)} x ${Math.round(wr.top)}..${Math.round(wr.bottom)})`);
    const rows = [...buttons, ...locked].map((el) => el.getBoundingClientRect());
    const lowest = Math.max(...rows.map((r) => r.bottom));
    if (rows.length && lowest > wr.top + 1) t.problem("bug", `${st.id}/${sid}: the choices run under the inventory bar (their foot ${Math.round(lowest)}, the water count's top ${Math.round(wr.top)})`);
    if (seen.barWater !== seen.water) t.problem("bug", `${st.id}/${sid}: the bar says water ${seen.barWater}, the story's counts say ${seen.water}`);
  }
  for (const r of [...buttons, ...locked]) {
    const rect = r.getBoundingClientRect();
    if (rect.height < 48) t.problem("bug", `${st.id}/${sid}: "${enText(r)}" is ${Math.round(rect.height)}px tall (48px at least)`);
    if (rect.left < 0 || rect.right > win.innerWidth || rect.bottom > win.innerHeight + 1) t.problem("bug", `${st.id}/${sid}: "${enText(r)}" is not fully on screen at 390x844`);
  }
  return seen;
}

async function waterGatesRun(options, t) {
  const id = (options && options.story) || "water-road";
  const st = story(id);
  if (!st.scenes[st.start]) throw new Error(`no story ${id}`);
  if (!savedRuns && savedCookie == null) rememberProgress();
  await passPrompt(t);
  clearProgress();
  if (!landingShown()) await toLanding(t);
  const gated = [];
  for (const sid of Object.keys(st.scenes)) for (const c of st.scenes[sid].choices) if (c[5] && c[5].needs) gated.push({ sid, next: c[2], en: c[1], needs: c[5].needs });
  if (gated.length < 2) t.problem("bug", `${id}: ${gated.length} choices wait on a count (water); two forks at least must`);
  const forks = [...new Set(gated.map((g) => g.sid))];
  t.metric("waterForks", forks.length);
  t.event("water-forks", `${id}: ${gated.map((g) => `${g.sid} "${g.en}" needs ${JSON.stringify(g.needs)}`).join("; ")}`);
  t.progress(0.05);

  // 1 and 2. At each water fork, a way that keeps the water (the option is a button) and a way that doesn't (it is not a
  // button: a greyed-out row says why, 48px or taller, and a press on it does nothing); the water count is on screen both times.
  let n = 0;
  for (const g of gated) {
    const need = g.needs.water;
    const rich = gateWay(st, g.sid, (c) => c.water >= need);
    const poor = gateWay(st, g.sid, (c) => c.water < need);
    if (!rich) { t.problem("bug", `${id}/${g.sid}: no way arrives with water ${need} or more, so "${g.en}" is never open`); continue; }
    if (!poor) { t.problem("bug", `${id}/${g.sid}: no way arrives with less than ${need} water, so "${g.en}" is never locked`); continue; }
    t.scene(`${id}: ${g.sid} with water to spare`);
    const a = await gateLook(t, st, g.sid, rich, `water ${need}+ at ${g.sid}`);
    if (!a.buttons.includes(g.en)) t.problem("bug", `${id}/${g.sid}: with water ${a.water} "${g.en}" should be a button, the buttons are ${a.buttons.join(" | ")}`);
    if (a.locked.some((l) => l.label === g.en)) t.problem("bug", `${id}/${g.sid}: with water ${a.water} "${g.en}" is still shown locked`);
    t.event("water-gate-open", `${id}/${g.sid}: water ${a.water}, needs ${need}: "${g.en}" is a button (${a.buttons.length} buttons)`);
    closeViewFrame();
    t.scene(`${id}: ${g.sid} short of water`);
    const b = await gateLook(t, st, g.sid, poor, `water below ${need} at ${g.sid}`);
    if (b.buttons.includes(g.en)) t.problem("bug", `${id}/${g.sid}: with water ${b.water} "${g.en}" is still a button (needs ${need})`);
    const row = b.locked.find((l) => l.label === g.en);
    if (!row) t.problem("bug", `${id}/${g.sid}: with water ${b.water} "${g.en}" is not on screen as a locked row`);
    else {
      if (!new RegExp(`needs water ${need}\\+`, "i").test(row.text)) t.problem("bug", `${id}/${g.sid}: the locked row says "${row.text}", not "needs water ${need}+"`);
      if (row.tag === "BUTTON" || row.el.getAttribute("aria-disabled") !== "true") t.problem("bug", `${id}/${g.sid}: the locked row is a ${row.tag} that can be pressed`);
      if (row.height < 48) t.problem("bug", `${id}/${g.sid}: the locked row is ${row.height}px tall (48px at least)`);
      if (row.font < 14) t.problem("bug", `${id}/${g.sid}: the locked row's requirement is ${row.font}px type (14px at least)`);
      const before = b.win.finalSpark.scene();
      await tapAt(t, row.el, `locked "${g.en}" (${b.touch ? "touch" : "pointer"})`);
      await sleep(400);
      if (b.win.finalSpark.scene() !== before) t.problem("bug", `${id}/${g.sid}: pressing the locked row moved the story to ${b.win.finalSpark.scene()}`);
      t.event("water-gate-locked", `${id}/${g.sid}: water ${b.water}, "${g.en}" is not a button; the row says "${row.text}" (${row.height}px tall, ${row.font}px type); the bar says water ${b.barWater}; pressing it did nothing`);
    }
    t.metric(`waterGate_${g.sid}`, 1);
    await sleep(1500);
    closeViewFrame();
    t.progress(0.05 + (0.5 * ++n) / gated.length);
  }

  // 3. Helping or passing the family changes the dry wash and the night raid: other words, other choices.
  for (const sid of ["wash", "nightRaid"]) {
    if (!st.scenes[sid]) continue;
    const helped = gateWay(st, sid, (c, f) => f.gaveFlask === true);
    const passed = gateWay(st, sid, (c, f) => f.passedBy === true && !f.riderLeft);
    if (!helped || !passed) { t.problem("bug", `${id}/${sid}: no way arrives having ${helped ? "passed" : "helped"} the family`); continue; }
    t.scene(`${id}: ${sid} after helping the family`);
    const h = await gateLook(t, st, sid, helped, `helped the family, at ${sid}`);
    closeViewFrame();
    t.scene(`${id}: ${sid} after passing the family`);
    const p = await gateLook(t, st, sid, passed, `passed the family, at ${sid}`);
    closeViewFrame();
    if (h.story === p.story && h.buttons.join("|") === p.buttons.join("|")) t.problem("bug", `${id}/${sid}: helping and passing the family look the same here`);
    t.event("family-callback", `${id}/${sid}: helped → "${h.story.slice(-90)}" [${h.buttons.join(" | ")}]; passed → "${p.story.slice(-90)}" [${p.buttons.join(" | ")}]`);
  }
  t.progress(0.75);

  // 4. Each ending's narration names an earlier choice (the barrel you gave the riders).
  for (const eid of Object.keys(st.scenes).filter((x) => st.scenes[x].ending)) {
    const words = `${st.scenes[eid].story[1]}`;
    if (!/\bbarrel\b/i.test(words)) t.problem("bug", `${id}/${eid}: the ending's words name no earlier choice ("${words.slice(0, 80)}")`);
    else t.event("ending-callback", `${id}/${eid}: "${words}"`);
  }

  // 5. Deaths a viewer can see coming: at most two, none after a warning shot or the high ground; costs instead.
  const deaths = Object.keys(st.scenes).filter((x) => st.scenes[x].dead);
  t.metric("deaths", deaths.length);
  if (deaths.length > 2) t.problem("bug", `${id}: ${deaths.length} deaths (${deaths.join(", ")}); two at most`);
  for (const sid of Object.keys(st.scenes)) for (const c of st.scenes[sid].choices) {
    if (/warning shot|high ground/i.test(c[1]) && st.scenes[c[2]].dead) t.problem("bug", `${id}/${sid}: "${c[1]}" still leads to a death (${c[2]})`);
    if (/warning shot|high ground/i.test(c[1])) t.event("cost-not-death", `${id}/${sid}: "${c[1]}" → ${c[2]} (${JSON.stringify(st.scenes[c[2]].inventory || {})}, flags ${JSON.stringify(c[4] || {})})`);
  }
  t.event("deaths", `${id}: ${deaths.join(", ")}`);
  t.progress(1);
}

/* ---------------- rewind: a death goes back to the decision, a timeout never kills, one choice plays on ---------------- */

function rewindPath(st, target) {
  const from = { [st.start]: null };
  const queue = [st.start];
  while (queue.length) {
    const id = queue.shift();
    if (id === target) {
      const way = [];
      for (let at = id; at != null; at = from[at]) way.unshift(at);
      return way;
    }
    if (st.scenes[id].dead) continue;
    for (const c of st.scenes[id].choices) if (!(c[2] in from) && st.scenes[c[2]]) (from[c[2]] = id), queue.push(c[2]);
  }
  return null;
}

/** Setup shortcut (event seeded-run): the run the player would have saved for a viewer who came this way, opened by its link. */
function rewindSeed(t, st, scene, why) {
  const way = rewindPath(st, scene);
  if (!way) throw new Error(`${st.id}: no way to ${scene}`);
  clearProgress();
  document.cookie = `${st.cookie}=${encodeURIComponent(JSON.stringify({ scene, history: way.slice(0, -1) }))}; Path=/`;
  t.event("seeded-run", `${st.id}: at ${scene} (${way.length - 1} choices in) for ${why}`);
}

/** Plays the clip to its end (a skip of the wait, not of the player's logic). */
async function rewindEndClip(doc) {
  const win = doc.defaultView;
  const v = () => doc.querySelector("#spark-video video:not(.spark-leave)");
  await waitFor(() => v() && (!v().paused || v().ended || (v().duration && v().currentTime > 0)), 8000);
  const vid = v();
  if (!vid) return;
  if (vid.duration > 0.5 && isFinite(vid.duration)) vid.currentTime = Math.max(0, vid.duration - 0.12);
  else vid.dispatchEvent(new win.Event("ended"));
}

function rewindLum(rgb) {
  const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function rewindRgb(css) {
  const m = String(css).match(/rgba?\(([^)]+)\)/);
  return m ? m[1].split(",").slice(0, 3).map((n) => parseFloat(n)) : null;
}

/** The "Tried" mark on a button: present, in words, and readable against what is behind it (contrast 4.5:1). */
function rewindCheckTried(t, doc, button, where) {
  const win = doc.defaultView;
  const note = button.querySelector(".choice-tried");
  if (button.dataset.tried !== "true" || !note || !/tried/i.test(note.textContent)) {
    t.problem("bug", `${where}: the deadly option isn't marked as tried (data-tried ${button.dataset.tried}, mark "${note ? note.textContent : "none"}")`);
    return;
  }
  const r = note.getBoundingClientRect();
  const fg = rewindRgb(win.getComputedStyle(note).color);
  const bg = rewindRgb(win.getComputedStyle(note).backgroundColor);
  const ratio = fg && bg ? (Math.max(rewindLum(fg), rewindLum(bg)) + 0.05) / (Math.min(rewindLum(fg), rewindLum(bg)) + 0.05) : 0;
  const inside = r.width > 0 && r.right <= win.innerWidth + 1 && r.left >= -1 && r.right <= button.getBoundingClientRect().right + 1;
  if (!inside) t.problem("bug", `${where}: the Tried mark is cut off or outside its button`);
  if (ratio < 4.5) t.problem("bug", `${where}: the Tried mark's contrast is ${ratio.toFixed(1)}:1 (4.5:1 needed to stay readable)`);
  t.event("tried-mark", `${where}: "${note.textContent}" ${Math.round(r.width)}x${Math.round(r.height)}px, contrast ${ratio.toFixed(1)}:1`);
}

/** The two death buttons in a document: both there (Rewind first), full width of the choices, 48px tall, on screen. */
function rewindCheckButtons(t, doc, where, { phone = false } = {}) {
  const win = doc.defaultView;
  const btns = [...doc.querySelectorAll("#spark-choices [data-death]")];
  const kinds = btns.map((b) => b.dataset.death).join(",");
  if (kinds !== "rewind,start") {
    t.problem("bug", `${where}: a death should offer Rewind to the choice then Start over, it offers [${kinds}]`);
    return btns;
  }
  const texts = btns.map((b) => (b.querySelector(".spot-src") || b).textContent.trim());
  if (!/^rewind to the choice$/i.test(texts[0])) t.problem("bug", `${where}: the first death button says "${texts[0]}"`);
  if (!/start over|recommence/i.test(texts[1])) t.problem("bug", `${where}: the second death button says "${texts[1]}"`);
  const box = doc.getElementById("spark-choices").getBoundingClientRect();
  const sizes = [];
  for (const b of btns) {
    const r = b.getBoundingClientRect();
    sizes.push(`${b.dataset.death} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (r.height < 48) t.problem("bug", `${where}: the ${b.dataset.death} button is ${Math.round(r.height)}px tall (48px at least)`);
    if (r.width < box.width * 0.95) t.problem("bug", `${where}: the ${b.dataset.death} button is ${Math.round(r.width)}px wide in a ${Math.round(box.width)}px row (full width wanted)`);
    if (r.top < 0 || r.bottom > win.innerHeight + 1 || r.left < -1 || r.right > win.innerWidth + 1) t.problem("bug", `${where}: the ${b.dataset.death} button is not fully on screen (top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)} of ${win.innerHeight})`);
    if (phone && r.top + r.height / 2 < win.innerHeight * 0.5) t.problem("warning", `${where}: the ${b.dataset.death} button is in the top half of the phone screen, out of thumb reach`);
  }
  t.event("death-buttons", `${where}: ${sizes.join(", ")}`);
  return btns;
}

/* ---------------- spark-depth: the rat, the match count, forks that diverge, four endings (story doc "The Final Spark") ---------------- */

/** The Final Spark after its rewrite (J's player goal: a reason to go on). Every press is a real tap (touch on a phone);
    the only setup shortcut is a seeded run (event seeded-run): the run the player would have saved for a viewer who came
    by a named way, opened by its link, so the long way isn't replayed for each leg. Checks: the match count in the
    inventory bar drops by one per page; the rat flag (fed, followed, ignored) changes a later page's words; breaking the
    gate and picking the lock open different pages; at 2 or fewer matches the options of the last fork change; and
    four differently named endings. At 390x844 the count sits beside the choices, which fit without scrolling. */
async function sparkDepthRun(options, t) {
  const st = story(FIRST);
  if (!savedRuns && savedCookie == null) rememberProgress();
  const phone = innerWidth <= 600;
  let way = [];
  let lastCount = null;
  const countShown = () => {
    const box = $("match-count");
    return box && !box.hidden && box.dataset.count !== undefined ? Number(box.dataset.count) : null;
  };
  const want = (w) => sparkState(st, w).matches;
  const wordsOf = (el) => ((el && el.textContent) || "").trim().split(/\s+/).filter(Boolean).length;

  /** The match count shown is the data's for the way so far, and (a press) one fewer than before. */
  const checkCount = (where, fresh = false) => {
    const n = countShown();
    const exp = want(way);
    if (n === null) t.problem("bug", `${where}: no match count in the inventory bar`);
    else if (n !== exp) t.problem("bug", `${where}: the bar shows ${n} matches, the data gives ${exp} (via ${way.join(" > ")})`);
    else if (!fresh && lastCount !== null && lastCount - n !== 1) t.problem("bug", `${where}: the count went ${lastCount} -> ${n}, one page should burn one match`);
    else t.add("matchChecks");
    lastCount = n;
    t.event("matches", `${where}: ${n}`);
  };

  /** On a phone: the count is on screen beside the choices, they all fit without scrolling and are 44px tall at least. */
  const checkPhoneFit = (where) => {
    if (!phone) return;
    const box = $("match-count");
    const bar = document.querySelector(".inventory:not(.kit)");
    const rect = box.getBoundingClientRect();
    if (!shown(box) || rect.width < 1 || rect.left < 0 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1) t.problem("bug", `${where}: the match count is not fully on screen at ${innerWidth}x${innerHeight}`);
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (target && !box.contains(target) && !bar.contains(target)) t.problem("bug", `${where}: something covers the match count (${target.id || target.tagName.toLowerCase()})`);
    for (const b of choiceButtons().filter((x) => x.getClientRects().length)) {
      const r = b.getBoundingClientRect();
      if (r.height < 44) t.problem("bug", `${where}: choice "${enText(b)}" is ${Math.round(r.height)}px tall (44 at least)`);
      if (r.top < 0 || r.bottom > innerHeight - Math.min(bar.getBoundingClientRect().height, 80) + 4) t.problem("bug", `${where}: choice "${enText(b)}" is not reachable without scrolling (bottom ${Math.round(r.bottom)} of ${innerHeight})`);
      const o = !(r.right < rect.left || r.left > rect.right || r.bottom < rect.top || r.top > rect.bottom);
      if (o) t.problem("bug", `${where}: the match count overlaps choice "${enText(b)}"`);
    }
    t.event("phone-fit", `${where}: count ${Math.round(rect.width)}x${Math.round(rect.height)} at ${Math.round(rect.left)},${Math.round(rect.top)}`);
  };

  /** New pages keep their story to a few short lines: words of the English layer. */
  const checkWords = (where) => {
    const n = wordsOf($("spark-story").querySelector(".spot-en") || $("spark-story"));
    if (n > 32) t.problem("warning", `${where}: ${n} words of story (two short lines is about 25)`);
    t.event("story-words", `${where}: ${n}`);
  };

  const label = (b) => enText(b);
  const offered = () => choiceButtons().filter((b) => b.getClientRects().length).map(label);

  /** A viewer's press on the choice that leads to `next` (a one-choice page carries on by itself when its clip ends). */
  const press = async (next) => {
    const from = sceneId();
    const i = st.scenes[from].choices.findIndex((c) => c[2] === next);
    const b = choiceButtons().find((x) => Number(x.dataset.choiceIndex) === i);
    if (i < 0 || !b) throw new Error(`${FIRST}: no choice from ${from} to ${next} on offer (${offered().join(" | ")})`);
    if (!b.getClientRects().length) {
      const v = document.querySelector("#spark-video video:not(.spark-leave)");
      await waitFor(() => v && v.duration > 0.5 && isFinite(v.duration), 6000);
      if (v && v.duration > 0.5 && isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 0.12);
      if (!(await waitFor(() => sceneId() !== from, 5000))) b.click();
      t.event("auto-continue", `${from} → ${next} by itself`);
    } else {
      b.scrollIntoView({ block: "center", behavior: "instant" });
      await tapAt(t, b, `"${label(b)}"`);
    }
    if (!(await waitFor(() => sceneId() === next, 4000))) throw new Error(`${FIRST}: the press on ${from} → ${next} opened ${sceneId()}`);
    way.push(next);
    await sleep(350);
    t.scene(`${FIRST}: ${next}`);
    checkCount(`${FIRST}/${next}`);
    checkWords(`${FIRST}/${next}`);
    checkPhoneFit(`${FIRST}/${next}`);
  };
  const pressAll = async (...nexts) => { for (const n of nexts) await press(n); };

  /** Setup shortcut (event seeded-run): a saved run at the end of `w`, opened by the story's link. */
  const seed = async (w, why) => {
    clearProgress();
    if (!landingShown()) await toLanding(t);
    document.cookie = `${st.cookie}=${encodeURIComponent(JSON.stringify({ scene: w[w.length - 1], history: w.slice(0, -1) }))}; Path=/`;
    t.event("seeded-run", `${FIRST}: at ${w[w.length - 1]} (${w.length - 1} choices in) for ${why}`);
    openByLink(t, FIRST);
    await sleep(300);
    if (soundOf().prompt()) await passPrompt(t, document, FIRST);
    if (!(await waitFor(() => sceneId() === w[w.length - 1], 6000))) throw new Error(`${FIRST}: the seeded run didn't open ${w[w.length - 1]}`);
    way = w.slice();
    await sleep(300);
    lastCount = null;
    checkCount(`${FIRST}/${w[w.length - 1]} (seeded)`, true);
  };

  const storyText = () => (($("spark-story").querySelector(".spot-en") || $("spark-story")).textContent || "").trim();
  const endingName = () => enText($("spark-ending"));
  const endings = new Map();
  const reachedEnding = (id) => {
    const name = endingName();
    if ($("spark").dataset.state !== "soon" || !name) t.problem("bug", `${FIRST}/${id}: expected an ending, the player doesn't show one`);
    endings.set(id, name);
    t.event("ending", `${FIRST}/${id}: ${name}`);
  };

  await passPrompt(t);
  clearProgress();
  if (!landingShown()) await toLanding(t);

  // 1. A viewer opens the story from its card: 20 matches, one gone per page, and a fork about the rat.
  t.scene(`${FIRST}: a new run`);
  await openStory(t, FIRST);
  await toStart(t, { quiet: true });
  way = [st.start];
  lastCount = null;
  await sleep(400);
  checkCount(`${FIRST}/${st.start}`, true);
  checkPhoneFit(`${FIRST}/${st.start}`);
  await pressAll("sewerWater", "getOutWater");
  const fork = offered();
  if (fork.length !== 3) t.problem("bug", `${FIRST}/getOutWater: the rat fork offers ${fork.length} choices (${fork.join(" | ")}), three wanted: feed it, follow it, step past it`);
  t.event("rat-fork", fork.join(" | "));
  t.progress(0.1);

  // 2. The rat remembers: fed (real presses to the fog), then followed and ignored. Each leg's fog page reads differently.
  const fogs = {};
  await pressAll("ratFed", "gate", "pickLock", "readTag", "useKey", "fog");
  fogs.fed = storyText();
  t.progress(0.25);
  await seed(["start", "sewerWater", "getOutWater"], "the rat fork (followed)");
  await pressAll("ratFollowed", "ratCrawl", "fog");
  fogs.followed = storyText();
  if (spark().flags().rat !== "followed") t.problem("bug", `${FIRST}: the rat flag is "${spark().flags().rat}", not "followed"`);
  t.progress(0.35);
  await seed(["start", "sewerWater", "getOutWater"], "the rat fork (ignored)");
  await press("ratIgnored");
  await press("gate");
  const gateIgnored = storyText();
  // 3. The gate: breaking it and picking the lock open different pages.
  await pressAll("breakGate", "gotKey", "useKey");
  const keyBroke = storyText();
  await press("fog");
  fogs.ignored = storyText();
  t.progress(0.45);
  const distinct = new Set(Object.values(fogs));
  t.event("rat-variants", `fog says: fed "${fogs.fed}" | followed "${fogs.followed}" | ignored "${fogs.ignored}"`);
  if (distinct.size < 3) t.problem("bug", `${FIRST}/fog: the fog page reads the same for ${3 - distinct.size + 1} of fed, followed and ignored the rat (a later scene must differ for each)`);
  await seed(["start", "sewerWater", "getOutWater", "ratIgnored", "gate"], "the gate fork (pick the lock)");
  await pressAll("pickLock", "readTag");
  const tagText = storyText();
  await press("useKey");
  const keyPicked = storyText();
  const gotKeyText = ((st.scenes.gotKey.story || [])[1] || "").trim();
  if (tagText === gotKeyText) t.problem("bug", `${FIRST}: picking the lock and breaking the gate show the same page`);
  if (keyBroke === keyPicked) t.problem("bug", `${FIRST}/useKey: the key scene reads the same after breaking the gate and picking the lock`);
  t.event("gate-fork", `break → breakGate, gotKey; pick → pickLock, readTag ("${tagText}"); useKey: broke "${keyBroke}" | picked "${keyPicked}"; gate with the rat ignored: "${gateIgnored}"`);
  t.progress(0.55);

  // 4. The low-match fork: the same last page offers other things at 2 or fewer matches.
  const toPowers = (prefix) => [...prefix, "shadowDance", "explorePowers"];
  const high = toPowers(["start", "sewerWater", "getOutWater", "ratFed", "gate", "pickLock", "readTag", "useKey", "fog", "fireDoor", "uponTruck", "walkAway"]);
  const lowFed = toPowers(["start", "deadEnd", "direction", "sewerWater", "getOutWater", "ratFed", "gate", "pickLock", "readTag", "useKey", "fog", "knock", "oldMan", "uponTruck", "insideTruck"]);
  const lowIgnored = toPowers(["start", "deadEnd", "direction", "sewerWater", "getOutWater", "ratIgnored", "gate", "breakGate", "gotKey", "useKey", "fog", "knock", "oldMan", "uponTruck", "insideTruck"]);
  const forks = {};
  await seed(high, "a fork with matches to spare");
  await pressAll("consumeLight", "lightHunger");
  forks.high = { matches: countShown(), options: offered() };
  t.event("low-match-fork", `${countShown()} matches: ${forks.high.options.join(" | ")}`);
  await sleep(600);
  await press("refuseShadow");
  reachedEnding("refuseShadow");
  await seed(lowFed, "a fork with the matches nearly gone (rat fed)");
  await pressAll("consumeLight", "lightHunger");
  forks.low = { matches: countShown(), options: offered() };
  t.event("low-match-fork", `${countShown()} matches: ${forks.low.options.join(" | ")}`);
  await sleep(600);
  await press("ratEnding");
  reachedEnding("ratEnding");
  t.progress(0.75);
  await seed(lowIgnored, "a fork with the matches nearly gone (rat ignored, the old man's word)");
  await pressAll("shadowStitch", "threadPull");
  forks.lowIgnored = { matches: countShown(), options: offered() };
  t.event("low-match-fork", `${countShown()} matches: ${forks.lowIgnored.options.join(" | ")}`);
  await sleep(600);
  await press("lamplighterEnding");
  reachedEnding("lamplighterEnding");
  await seed(lowIgnored, "the same fork, taking the dark");
  await pressAll("consumeLight", "lightHunger");
  await press("destroyTown");
  reachedEnding("destroyTown");
  if (forks.high.matches <= 2 || forks.low.matches > 2) t.problem("bug", `${FIRST}: the forks have ${forks.high.matches} and ${forks.low.matches} matches, wanted more than 2 and 2 or fewer`);
  if (forks.high.options.join("|") === forks.low.options.join("|")) t.problem("bug", `${FIRST}: the last fork offers the same options at ${forks.high.matches} and at ${forks.low.matches} matches`);
  if (forks.low.options.some((o) => /hold up a match|strike a match/i.test(o))) t.problem("bug", `${FIRST}: at ${forks.low.matches} matches the fork still offers a match to hold up`);
  if (!forks.low.options.some((o) => /rat/i.test(o)) || forks.high.options.some((o) => /rat/i.test(o))) t.problem("bug", `${FIRST}: the rat should come only when the matches are gone (low: ${forks.low.options.join(" | ")}; high: ${forks.high.options.join(" | ")})`);
  const names = new Set(endings.values());
  t.metric("endingsReached", names.size);
  t.event("endings", [...endings].map(([id, n]) => `${id} "${n}"`).join(", "));
  if (names.size < 3) t.problem("bug", `${FIRST}: only ${names.size} differently named endings reached (3 wanted)`);
  t.progress(1);
}

async function rewindRun(options, t) {
  const id = (options && options.story) || "water-road";
  const st = story(id);
  if (!st.scenes[st.start]) throw new Error(`no story ${id}`);
  if (!savedRuns && savedCookie == null) rememberProgress();
  const dead = (sid) => !!(st.scenes[sid] && st.scenes[sid].dead);
  const forks = Object.keys(st.scenes).filter((sid) => !dead(sid) && st.scenes[sid].choices.length > 1 && st.scenes[sid].choices.some((c) => dead(c[2])));
  const firstDeath = Object.keys(st.scenes).filter(dead).sort((a, b) => rewindPath(st, a).length - rewindPath(st, b).length)[0];
  const dyingWay = rewindPath(st, firstDeath);
  await passPrompt(t);
  clearProgress();
  if (!landingShown()) await toLanding(t);
  await openStory(t, id);
  await toStart(t, { quiet: true });
  t.progress(0.05);

  // 1. Real presses to the nearest death: the clip and its line stay, and there are two buttons.
  t.scene(`${id}: to the death at ${firstDeath}`);
  const press = async (next) => {
    const i = st.scenes[sceneId()].choices.findIndex((c) => c[2] === next);
    const b = choiceButtons()[i];
    if (i < 0 || !b) throw new Error(`${id}: no choice from ${sceneId()} to ${next}`);
    b.scrollIntoView({ block: "center", behavior: "instant" });
    await tapAt(t, b, `"${enText(b)}"`);
    if (!(await waitFor(() => sceneId() === next, 3000))) throw new Error(`${id}: "${enText(b)}" didn't open ${next}`);
  };
  for (const next of dyingWay.slice(1)) {
    await press(next);
    await sleep(500);
  }
  if (sceneId() !== firstDeath) throw new Error(`${id}: expected the death ${firstDeath}, at ${sceneId()}`);
  t.event("death", `${id}: ${firstDeath}`);
  const fork = dyingWay[dyingWay.length - 2];
  await rewindEndClip(document);
  if (!(await waitFor(() => document.querySelectorAll("#spark-choices [data-death]").length >= 2, 5000))) t.problem("bug", `${id}: the death ${firstDeath} never offered its two buttons`);
  if (!document.querySelector("#spark-video video") && !document.querySelector("#spark-video .spark-video-blank")) t.problem("bug", `${id}: the death shows no clip`);
  if (!($("spark-story").textContent || "").trim()) t.problem("bug", `${id}: the death's line is gone`);
  const deathButtons = rewindCheckButtons(t, document, `${id} ${firstDeath} (${innerWidth}x${innerHeight})`);
  await sleep(1500); // on screen for the footage
  t.progress(0.2);

  // 2. Rewind: the same fork within 2 s, the deadly option marked as tried.
  const t0 = performance.now();
  const rewind = deathButtons.find((b) => b.dataset.death === "rewind");
  if (!rewind) throw new Error(`${id}: no Rewind button`);
  await tapAt(t, rewind, "Rewind to the choice");
  const back = await waitFor(() => sceneId() === fork, 2000);
  const ms = Math.round(performance.now() - t0);
  if (!back) t.problem("bug", `${id}: Rewind didn't show ${fork} within 2 s (at ${sceneId()})`);
  else t.event("rewound", `${id}: ${firstDeath} → ${fork} in ${ms} ms (history ${spark().depth()})`);
  t.metric("rewindMs", ms);
  const di = st.scenes[fork].choices.findIndex((c) => c[2] === firstDeath);
  await sleep(400);
  const marked = choiceButtons();
  rewindCheckTried(t, document, marked[di], `${id} ${fork}`);
  if (marked.some((b, i) => i !== di && b.dataset.tried === "true")) t.problem("bug", `${id}: an option that never killed anyone is marked as tried`);
  if ((spark().tried()[fork] || []).join() !== firstDeath) t.problem("bug", `${id}: the run doesn't remember ${firstDeath} as tried at ${fork}`);
  if (spark().path().join(">") !== dyingWay.slice(0, -1).join(">")) t.problem("bug", `${id}: after Rewind the way is ${spark().path().join(">")}, not ${dyingWay.slice(0, -1).join(">")}`);
  await sleep(1200);
  // The mark is saved with the run: a reload (the story's link) keeps it.
  const saved = readJsonCookie(st.cookie);
  if (!saved || !saved.tried || !saved.tried[fork]) t.problem("bug", `${id}: the tried mark isn't saved with the run cookie`);
  t.progress(0.3);

  // 3. The same death again, then Start over: the first page, a new run, nothing tried.
  await press(firstDeath);
  await rewindEndClip(document);
  await waitFor(() => document.querySelectorAll("#spark-choices [data-death]").length >= 2, 5000);
  const startBtn = document.querySelector("#spark-choices [data-death=start]");
  if (!startBtn) t.problem("bug", `${id}: the second death has no Start over`);
  else {
    await tapAt(t, startBtn, "Start over");
    await waitFor(() => sceneId() === st.start, 2000);
    if (sceneId() !== st.start || spark().depth() !== 0) t.problem("bug", `${id}: Start over didn't open ${st.start} as a new run (at ${sceneId()}, depth ${spark().depth()})`);
    if (Object.keys(spark().tried()).length) t.problem("bug", `${id}: Start over kept the tried marks`);
  }
  t.progress(0.38);

  // 4. At 390x844 both buttons are full width, 48px tall and on screen; Rewind there marks the fork too.
  t.scene(`${id}: the death at 390x844`);
  rewindSeed(t, st, firstDeath, "the phone's death");
  {
    const doc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
    await passPrompt(t, doc, `${id} 390x844`);
    await rewindEndClip(doc);
    await waitFor(() => doc.querySelectorAll("#spark-choices [data-death]").length >= 2, 8000);
    const btns = rewindCheckButtons(t, doc, `${id} ${firstDeath} (390x844)`, { phone: true });
    await sleep(1200);
    const r = btns.find((b) => b.dataset.death === "rewind");
    if (r) {
      await tapAt(t, r, "Rewind to the choice (390x844)");
      const w = doc.defaultView;
      if (!(await waitFor(() => w.finalSpark.scene() === fork, 2000))) t.problem("bug", `${id} 390x844: Rewind didn't show ${fork} within 2 s`);
      await sleep(400);
      rewindCheckTried(t, doc, [...doc.querySelectorAll("#spark-choices .choice")][di], `${id} ${fork} (390x844)`);
      await sleep(1000);
    }
    closeViewFrame();
  }
  t.progress(0.5);

  // 5. A timeout never kills: every fork with a deadly option is left to the 15 s timer.
  for (const [n, sid] of forks.entries()) {
    t.scene(`${id}: the timer runs out at ${sid}`);
    for (const c of spark().choicesOf(sid)) if (c.default && dead(c.next)) t.problem("bug", `${id}/${sid}: the default choice leads to a death (${c.next})`);
    rewindSeed(t, st, sid, `the timeout at ${sid}`);
    openByLink(t, id);
    await sleep(300);
    if (soundOf().prompt()) await passPrompt(t, document, id);
    if (!(await waitFor(() => sceneId() === sid, 5000))) throw new Error(`${id}: the saved place ${sid} didn't open (at ${sceneId()})`);
    await rewindEndClip(document);
    // The timer: 15 s from the end of the clip, then the pick glows for about a second.
    const left = await waitFor(() => sceneId() !== sid, 22000);
    const now = sceneId();
    if (!left) t.problem("bug", `${id}/${sid}: nothing happened when the timer ran out`);
    else if (dead(now)) t.problem("bug", `${id}/${sid}: letting the timer run out led to a death (${now})`);
    else t.event("timeout-safe", `${id}/${sid}: the timer chose ${now}`);
    t.progress(0.5 + (0.3 * (n + 1)) / forks.length);
  }

  // 6. One choice carries on by itself: no button, the screen fades, the next page opens.
  const fs = story(FIRST);
  const one = Object.keys(fs.scenes).find((sid) => fs.scenes[sid].choices.length === 1 && !fs.scenes[sid].dead && !fs.scenes[sid].ending && fs.scenes[sid].video && rewindPath(fs, sid));
  if (one) {
    t.scene(`${FIRST}: ${one} continues by itself`);
    if (!landingShown()) await toLanding(t);
    rewindSeed(t, fs, one, "a one-choice page");
    openByLink(t, FIRST);
    await sleep(300);
    if (soundOf().prompt()) await passPrompt(t, document, FIRST);
    if (!(await waitFor(() => sceneId() === one, 5000))) throw new Error(`${FIRST}: ${one} didn't open`);
    const box = $("spark-choices");
    const visible = [...box.querySelectorAll(".choice")].filter((b) => b.getClientRects().length);
    if (visible.length) t.problem("bug", `${FIRST}/${one}: a one-choice page shows a button ("${enText(visible[0])}")`);
    const next = fs.scenes[one].choices[0][2];
    await rewindEndClip(document);
    const t1 = performance.now();
    let faded = false;
    const watch = setInterval(() => { if ($("spark").classList.contains("is-auto-advance")) faded = true; }, 40);
    const went = await waitFor(() => sceneId() !== one, 4000);
    clearInterval(watch);
    const took = Math.round(performance.now() - t1);
    if (!went || sceneId() !== next) t.problem("bug", `${FIRST}/${one}: the page didn't carry on by itself to ${next} after its clip (at ${sceneId()})`);
    else t.event("auto-continue", `${FIRST}/${one} → ${next} ${took} ms after its clip, no press${faded ? ", with a fade" : ""}`);
    if (!faded) t.problem("warning", `${FIRST}/${one}: no fade before it carried on`);
    await sleep(800);
  }
  t.progress(1);
}

/* ---------------- trust-fall: a draft clip story on a phone, every scene by a real press, both deaths, three endings, belief gates ---------------- */

/** A scene whose clip isn't made shows the story's graded key art (.spark-still), never the text title card: it is an
    image that loaded, carries no words, the page doesn't scroll sideways, and every choice is 44px or taller. */
function checkStill(t, doc, label, W) {
  const el = doc.querySelector("#spark-video .spark-still:not(.spark-leave)");
  const blank = doc.querySelector("#spark-video .spark-video-blank");
  const root = doc.documentElement;
  const sideways = Math.max(root.scrollWidth, doc.body.scrollWidth) - root.clientWidth;
  const small = [...doc.querySelectorAll("#spark-choices .choice")].filter((b) => b.getClientRects().length && b.getBoundingClientRect().height < 43.5);
  const r = el && el.getBoundingClientRect();
  const img = el && new Image();
  const loaded = el ? new Promise((ok) => { img.onload = () => ok(true); img.onerror = () => ok(false); img.src = el.dataset.still; }) : Promise.resolve(false);
  return loaded.then((ok) => {
    const text = el ? (el.textContent || "").trim() : "";
    const filt = el ? getComputedStyle(el).filter : "none";
    if (blank || !el) t.problem("bug", `${label}: shows the placeholder text card, not a graded still`);
    else if (!ok || !r.width || !r.height) t.problem("bug", `${label}: the graded still didn't load or has no size (${el.dataset.still})`);
    else if (text) t.problem("bug", `${label}: the graded still carries text ("${text}")`);
    else if (filt === "none") t.problem("bug", `${label}: the still isn't graded (no shared filter)`);
    else if (/trust-fall/.test(label) && el.dataset.palette !== "argus") t.problem("bug", `${label}: the Trust Fall still isn't in ARGUS's amber palette`);
    else if (/trust-fall/.test(label) && !/rgba\(255, 176, 64/.test(getComputedStyle(el, "::before").backgroundImage)) t.problem("bug", `${label}: the Trust Fall still has no amber ARGUS glow`);
    else t.event("graded-still", `${label}: graded still ${el.dataset.still.split("/").pop()} ${Math.round(r.width)}x${Math.round(r.height)}, no text card`);
    if (sideways > 1) t.problem("bug", `${label}: scrolls sideways by ${sideways}px at ${W}px wide`);
    if (small.length) t.problem("bug", `${label}: ${small.length} choice(s) under 44px tall (${small.map((b) => Math.round(b.getBoundingClientRect().height)).join(", ")})`);
    if (ok && el && !blank) t.add("trustFallGradedStills");
  });
}

/** Trust Fall (story/trust-fall.md, listed: false, plays at /?story=trust-fall) at 390x844 with touch input. Setup shortcut:
    a seeded run (event seeded-run) at the parent of each scene, opened by the story's link in a frame; every scene is then
    entered by a real press (tapAt) of the choice that leads there. Options: {"story":"<id>"} (default trust-fall). */
/** Trust Fall's endings gallery on a phone (touch, 390x844 frame): a seeded run (setup shortcut, `seeded-run`) one
    choice before Live, a real tap on that choice, the ending card says "1 of 3 found", a tap on Endings opens the
    gallery: Live as a tile, Unseen and Good morning as silhouettes ("???") with their hints, no sideways scroll. */
async function trustFallEndingsRun(options, t) {
  const id = (options && options.story) || "trust-fall";
  const st = story(id);
  if (!st || !st.scenes[st.start]) throw new Error(`no story ${id}`);
  if (!savedRuns && savedCookie == null) rememberProgress();
  const ends = Object.keys(st.scenes).filter((sid) => st.scenes[sid].ending);
  const first = (options && options.ending) || "truth";
  const parent = Object.keys(st.scenes).find((sid) => st.scenes[sid].choices.some((c) => c[2] === first));
  if (!parent) throw new Error(`${id}: no scene leads to ${first}`);
  await passPrompt(t);
  try {
    clearProgress();
    // The way to the parent: the shortest, by the story's own choices (flags only matter for gated choices).
    const queue = [[st.start]];
    let way = null;
    while (queue.length && !way) {
      const w = queue.shift();
      const sid = w[w.length - 1];
      if (sid === parent) { way = w; break; }
      if (w.length > 14 || st.scenes[sid].dead || st.scenes[sid].ending) continue;
      for (const c of st.scenes[sid].choices) if (!((c[7] && c[7].requires) && Object.keys(c[7].requires).length)) queue.push([...w, c[2]]);
    }
    if (!way) throw new Error(`${id}: no way to ${parent}`);
    gateSeed(t, st, way, `${first} ending card`);
    t.scene(`${id}: reach ${first} at 390x844`);
    const doc = await viewFrameLoad(t, `/?story=${id}`, 390, 844);
    const win = doc.defaultView;
    await passPrompt(t, doc, `${id} ${parent} 390x844`);
    if (!(await waitFor(() => win.finalSpark.scene() === parent, 8000))) throw new Error(`${id}: the seeded run didn't open ${parent}`);
    await rewindEndClip(doc);
    const box = doc.getElementById("spark-choices");
    await waitFor(() => box.dataset.phase === "ready" && box.querySelectorAll(".choice").length > 0, 12000);
    await sleep(400);
    const i = st.scenes[parent].choices.findIndex((c) => c[2] === first);
    const btn = [...box.querySelectorAll(".choice")].find((b) => b.dataset.choiceIndex == null ? false : Number(b.dataset.choiceIndex) === i) || [...box.querySelectorAll(".choice")][i];
    if (!btn) throw new Error(`${id}: no button for the way to ${first}`);
    btn.scrollIntoView({ block: "center", behavior: "instant" });
    await tapAt(t, btn, `"${enText(btn)}"`);
    if (!(await waitFor(() => win.finalSpark.scene() === first, 5000))) throw new Error(`${id}: the tap didn't open ${first}`);
    const card = doc.getElementById("spark-ending");
    await waitFor(() => !card.hidden && card.classList.contains("ending-card"), 8000);
    await sleep(500);
    const countEl = doc.getElementById("spark-ending-count");
    const want = `1 of ${ends.length} found`;
    const got = countEl ? countEl.textContent.trim() : "(none)";
    t.event("ending-count", `${id}/${first}: ${got}`);
    if (got !== want) t.problem("bug", `${id}: the ending card says "${got}", want "${want}"`);
    t.event("screenshot", `${id} ending card: ${got}`);
    const open = doc.getElementById("spark-endings-open");
    if (!open) throw new Error(`${id}: no Endings button on the ending card`);
    open.scrollIntoView({ block: "center", behavior: "instant" });
    await tapAt(t, open, "Endings");
    await sleep(500);
    const pane = doc.getElementById("spark-endings");
    if (!pane || pane.hidden) throw new Error(`${id}: the Endings gallery did not open`);
    const tiles = [...pane.querySelectorAll(".ending-tile")];
    if (tiles.length !== ends.length) t.problem("bug", `${id}: gallery has ${tiles.length} tiles, want ${ends.length}`);
    const found = tiles.filter((x) => x.classList.contains("is-found"));
    const locked = tiles.filter((x) => x.classList.contains("is-locked"));
    if (found.length !== 1 || found[0].dataset.ending !== first) t.problem("bug", `${id}: want only ${first} found, got ${found.map((x) => x.dataset.ending).join(",") || "none"}`);
    for (const tile of locked) {
      const name = tile.querySelector(".ending-tile-name").textContent.trim();
      const hint = (tile.querySelector(".ending-tile-hint") || {}).textContent || "";
      const want = (st.scenes[tile.dataset.ending].hint || "").trim();
      t.event("locked-ending", `${id}/${tile.dataset.ending}: "${name}", hint "${hint.trim()}"`);
      if (name !== "???") t.problem("bug", `${id}: locked tile ${tile.dataset.ending} says "${name}", want "???"`);
      if (!want || hint.trim() !== want) t.problem("bug", `${id}: locked tile ${tile.dataset.ending} shows hint "${hint.trim()}", want "${want}"`);
      const r = tile.getBoundingClientRect();
      if (r.right > 390 + 1 || r.left < -1) t.problem("bug", `${id}: tile ${tile.dataset.ending} runs off the screen at 390x844`);
    }
    for (const sid of ["shadow", "good-morning"]) {
      const named = locked.some((x) => x.dataset.ending === sid);
      if (st.scenes[sid] && !named) t.problem("bug", `${id}: ${sid} is not a silhouette in the gallery`);
    }
    const de = doc.documentElement;
    const over = Math.max(de.scrollWidth, doc.body.scrollWidth, pane.scrollWidth) - win.innerWidth;
    t.event("gallery-fit", `${id}: ${tiles.length} tiles, scroll width over screen by ${over}px, touch ${win.matchMedia("(pointer: coarse)").matches}`);
    if (over > 1) t.problem("bug", `${id}: the gallery scrolls sideways at 390x844 (${over}px over)`);
    t.event("screenshot", `${id} endings gallery at 390x844: ${found.length} found, ${locked.length} silhouettes with hints`);
    t.metric("endingsFound", found.length);
    t.metric("endingsTotal", ends.length);
    closeViewFrame();
    t.progress(1);
  } finally {
    closeViewFrame();
  }
}

/** Text fit (J, 2026-11-14): on a phone no page's text outlasts its page or is cut off. For the story line, the question,
    the ending card, a death's line and every choice button: the box lies inside the screen; text that is taller than its box
    must scroll inside it (overflow auto/scroll), never be clipped (overflow hidden/clip) by it or by an ancestor; a button's
    words fit its button; and the page does not scroll down or sideways past the screen. Logs `text-fit`, returns the problems. */
function trustFallTextFit(t, doc, label, W, H) {
  const win = doc.defaultView;
  const bad = [];
  const shown = (e) => e && e.getClientRects().length && win.getComputedStyle(e).visibility !== "hidden" && !e.hidden;
  const clips = (v) => v === "hidden" || v === "clip";
  const parts = [["#spark-story", "story text"], ["#spark-question", "question"], ["#spark-ending", "ending card"], ["#spark-choices .choice, #spark-choices [data-death]", "choice"]];
  let boxes = 0;
  for (const [sel, what] of parts) {
    for (const e of doc.querySelectorAll(sel)) {
      if (!shown(e) || !(e.textContent || "").trim()) continue;
      boxes++;
      const r = e.getBoundingClientRect(), cs = win.getComputedStyle(e);
      const name = `${what} "${(e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28)}"`;
      if (r.left < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(`${name} lies off the ${W}x${H} screen (${Math.round(r.left)}..${Math.round(r.right)}, bottom ${Math.round(r.bottom)})`);
      if (e.scrollHeight > e.clientHeight + 2 && clips(cs.overflowY)) bad.push(`${name} is cut off (${e.scrollHeight}px of text in ${e.clientHeight}px, overflow ${cs.overflowY})`);
      if (e.scrollWidth > e.clientWidth + 2 && clips(cs.overflowX)) bad.push(`${name} is cut off sideways (${e.scrollWidth}px in ${e.clientWidth}px)`);
      // An ancestor that clips this box (the panel, the player) must still show all of it, unless this box scrolls itself.
      for (let a = e.parentElement; a && a !== doc.body; a = a.parentElement) {
        const ac = win.getComputedStyle(a);
        if (!clips(ac.overflowY) && !clips(ac.overflowX)) continue;
        const ar = a.getBoundingClientRect();
        if (r.bottom > ar.bottom + 2 || r.top < ar.top - 2 || r.right > ar.right + 2 || r.left < ar.left - 2) bad.push(`${name} is clipped by ${a.id || a.className || a.tagName} (box ${Math.round(r.top)}-${Math.round(r.bottom)}, clip ${Math.round(ar.top)}-${Math.round(ar.bottom)})`);
        break;
      }
    }
  }
  // A text box that scrolls inside itself and a page that does too: the page itself holds still.
  const de = doc.documentElement;
  if (de.scrollWidth > W + 1) bad.push(`the page scrolls sideways (${de.scrollWidth}px of ${W})`);
  if (Math.max(de.scrollHeight, doc.body.scrollHeight) > H + 1) bad.push(`the page's text outlasts the page (${Math.max(de.scrollHeight, doc.body.scrollHeight)}px of ${H})`);
  for (const b of bad) t.problem("bug", `${label}: ${b}`);
  t.event("text-fit", `${label}: ${boxes} text boxes, ${bad.length ? bad.length + " cut off or outside" : "all fit"}`);
  t.add("trustFallTextFitPages");
  return bad;
}

async function trustFallRun(options, t) {
  const id = (options && options.story) || "trust-fall";
  const st = story(id);
  if (!st || !st.scenes[st.start]) throw new Error(`no story ${id}`);
  if (!savedRuns && savedCookie == null) rememberProgress();
  const ids = Object.keys(st.scenes);
  const dead = (sid) => !!st.scenes[sid].dead;
  const ending = (sid) => !!st.scenes[sid].ending;
  if (listedStories().some((s) => s.id === id)) t.problem("bug", `${id} is listed on the landing page; it is a draft and stays unlisted`);
  // Which scenes have a made clip (<folder>/media/clip.mp4, found by a HEAD request) and so must play their real cut;
  // trustFallRealClips counts each such scene once, however often it is entered, and must equal that count.
  const clipMade = {};
  const hasFile = async (url) => { try { return (await fetch(url, { method: "HEAD", cache: "no-store" })).ok; } catch (e) { return false; } };
  const hasClip = async (sid) => (sid in clipMade ? clipMade[sid] : (clipMade[sid] = await hasFile(`${folderOf(sid, st)}media/clip.mp4`)));
  const realClips = new Set();
  const stills = new Set();
  const sawRealClip = async (sid) => {
    if (!(await hasClip(sid))) t.problem("bug", `${id}/${sid}: plays a cut (scene.mp4) but has no media/clip.mp4: it can only be a title card or a still`);
    if (!realClips.has(sid)) { realClips.add(sid); t.add("trustFallRealClips"); }
  };
  /** A scene with no clip shows its graded still and speaks its narration (recorded, narrator voice) with its music cue under it. */
  const stillNarrated = async (au, sid, doc) => {
    if (await hasClip(sid)) { t.problem("bug", `${id}/${sid}: has media/clip.mp4 but shows a still, not its real cut`); return; }
    stills.add(sid);
    if (!(await hasFile(`${folderOf(sid, st)}media/narration.mp3`))) { t.event("still-silent", `${id}/${sid}: no narration recorded for this still`); return; }
    if (!au || !au.events) return;
    if (!(await waitFor(() => au.events().some((e) => e.what === "voice" && e.speaker === "narrator" && e.key === sid), 5000))) t.problem("bug", `${id}/${sid}: a still with a narration.mp3 plays no narration`);
    else { t.event("still-narration", `${id}/${sid}: graded still, narration playing${au.bed && au.bed().playing ? ", music and bed under it" : ""}`); t.add("trustFallNarratedStills"); }
  };
  await passPrompt(t);
  clearProgress();
  if (!landingShown()) await toLanding(t);
  const W = 390, H = 844;
  const flagsOf = (way) => {
    const out = {};
    for (let i = 0; i + 1 < way.length; i++) {
      const c = st.scenes[way[i]].choices.find((x) => x[2] === way[i + 1]);
      if (c && c[4]) Object.assign(out, c[4]);
    }
    return out;
  };
  /** The shortest way (never through a death) to `target` whose flags satisfy `ok`, honouring each choice's `requires` (c[7]). */
  const wayTo = (target, ok = () => true) => {
    const queue = [[st.start]];
    while (queue.length) {
      const way = queue.shift();
      const sid = way[way.length - 1];
      if (sid === target && ok(flagsOf(way))) return way;
      if (way.length > 14 || (dead(sid) && sid !== target) || sid === target) continue;
      const flags = flagsOf(way);
      for (const c of st.scenes[sid].choices) {
        const req = (c[7] && c[7].requires) || {};
        if (Object.entries(req).every(([k, v]) => (flags[k] === undefined ? false : flags[k]) === v)) queue.push([...way, c[2]]);
      }
    }
    return null;
  };
  const open = async (way, why) => {
    gateSeed(t, st, way, why);
    return viewFrameLoad(t, `/?story=${id}`, W, H);
  };
  const ready = async (doc, sid) => {
    const win = doc.defaultView;
    await passPrompt(t, doc, `${id} ${sid} ${W}x${H}`);
    if (!(await waitFor(() => win.finalSpark.scene() === sid, 8000))) throw new Error(`${id}: the seeded run didn't open ${sid} (at ${win.finalSpark.scene()})`);
    await rewindEndClip(doc);
    const box = doc.getElementById("spark-choices");
    if (!(await waitFor(() => box.dataset.phase === "ready" && box.querySelectorAll(".choice, [data-death]").length > 0, 10000))) t.problem("bug", `${id}/${sid}: the choices never came up at ${W}x${H}`);
    await waitFor(() => !doc.getElementById("spark").dataset.beat, 6000); // a scene that opens on a beat shows its choices after it
    await sleep(350);
    return box;
  };
  const touchOn = (doc) => doc.defaultView.matchMedia("(pointer: coarse)").matches;
  const visible = (box) => [...box.querySelectorAll(".choice")].filter((b) => b.getClientRects().length);
  const label = (b) => enText(b);

  // 1. First scene on a phone: one tap on Tap to play starts the clip; the buffering ring is in the player and gone once it plays.
  t.scene(`${id}: first scene at ${W}x${H}`);
  clearProgress();
  {
    const doc = await viewFrameLoad(t, `/?story=${id}`, W, H);
    const win = doc.defaultView;
    const rings = [];
    doc.addEventListener("iltv:loading", (e) => rings.push(e.detail && e.detail.on));
    // Autostart (tap.autostart): the story's own opening press is the tap, so no Tap to play overlay is ever shown.
    const t0 = performance.now();
    const overlay = () => doc.querySelectorAll(".tap-to-play, .tap-splash").length;
    if (win.hawkesSound.prompt() || overlay()) t.problem("bug", `${id}: /?story=${id} shows a Tap to play overlay; the first scene must autostart with no overlay`);
    else t.event("autostart", `${id}: no Tap to play overlay; sound unlocked: ${win.hawkesSound.unlocked()}`);
    t.milestone && t.milestone("first-input-accepted");
    const v = () => doc.querySelector("#spark-video video:not(.spark-leave)");
    const stillOf = () => doc.querySelector("#spark-video .spark-still:not(.spark-leave)");
    const played = await waitFor(() => (v() && !v().paused && v().currentTime > 0) || stillOf(), 8000);
    const ms = Math.round(performance.now() - t0);
    if (stillOf() && !(v() && v().currentTime > 0)) { await checkStill(t, doc, `${id}/${st.start}`, W); t.milestone && t.milestone("gameplay"); }
    else if (!played) t.problem("bug", `${id}: the first clip didn't autostart (no overlay) (at ${W}x${H})`);
    else t.event("first-tap", `${id}: one tap, the clip plays after ${ms} ms${touchOn(doc) ? " (touch)" : ""}`);
    t.metric("trustFallFirstTapMs", ms);
    if (played && v()) {
      const src = decodeURI(new URL(v().currentSrc || v().src, location.href).pathname);
      if (/\/scene\.mp4$/.test(src)) { checkCut(t, v(), `${id}/${st.start}`); await sawRealClip(st.start); }
      else t.problem("bug", `${id}/${st.start}: plays a placeholder title card (${src}), not a filmed clip (its media isn't made)`);
    }
    {
      // Words on screen before the first choice (the story, the question and the choices): under 40.
      const txt = (sel) => [...doc.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => e.textContent).join(" ");
      const words = (txt("#spark-story") + " " + txt("#spark-question") + " " + txt("#spark-choices .choice")).split(/\s+/).filter(Boolean).length;
      t.metric("trustFallWordsBeforeFirstChoice", words);
      if (words >= 40) t.problem("bug", `${id}: ${words} words before the first choice (limit 40)`);
      else t.event("intro-words", `${id}: ${words} words before the first choice`);
      if (played) t.milestone && t.milestone("gameplay");
    }
    const ring = doc.querySelector(".spark-video-loading");
    if (!ring) t.problem("bug", `${id}: the player has no buffering ring over the clip`);
    else {
      // The ring is up while the clip (or the scene's still) loads and hidden once it is showing.
      if (played) await waitFor(() => ring.hidden, 6000);
      if (played && !ring.hidden) t.problem("bug", `${id}: the buffering ring is still showing while the clip plays`);
      t.event("buffering-ring", `${id}: ${rings.includes(true) ? "shown while the clip loaded" : "not needed (the clip loaded at once)"}; hidden once it plays: ${ring.hidden}`);
    }
    if (win.finalSpark.scene() !== st.start) t.problem("bug", `${id}: the first scene is ${win.finalSpark.scene()}, not ${st.start}`);
    // The player is the whole screen: no catalogue or header showing, no sideways scroll, no stray debug control.
    {
      const de = doc.documentElement;
      const vis = (e) => e && e.getClientRects().length && win.getComputedStyle(e).visibility !== "hidden";
      const sp = doc.querySelector(".spark:not([hidden])");
      const r = sp ? sp.getBoundingClientRect() : null;
      const shown = [".site-header", "body > main", ".stories", ".hero", ".story-card"].filter((q) => [...doc.querySelectorAll(q)].some(vis));
      if (shown.length) t.problem("bug", `${id}: the landing page still shows behind the player (${shown.join(", ")})`);
      if (!r || r.width < W - 2) t.problem("bug", `${id}: the player is ${r ? Math.round(r.width) : 0}px wide, not the whole ${W}px screen`);
      if (de.scrollWidth > W + 1) t.problem("bug", `${id}: sideways scroll at ${W}x${H} (${de.scrollWidth}px)`);
      const dbg = [...doc.querySelectorAll("button, a, [role=button]")].filter((e) => vis(e) && /debug|bug|report a problem/i.test((e.id || "") + (e.className || "") + (e.getAttribute("aria-label") || "") + (e.title || "")));
      if (dbg.length) t.problem("bug", `${id}: a debug control is on the page (${dbg.length})`);
      const bars = [".tile-wall", ".tile-screen"].filter((q) => doc.querySelector(q));
      if (bars.length) t.problem("bug", `${id}: empty unlabeled scanline bars are on the page (${bars.join(", ")})`);
      t.event("player-fullscreen", `${id}: player ${r ? Math.round(r.width) + "x" + Math.round(r.height) : "none"} of ${W}x${H}; landing hidden: ${!shown.length}; no sideways scroll: ${de.scrollWidth <= W + 1}`);
    }
    await sleep(800);
    closeViewFrame();
  }
  t.progress(0.05);

  // 2 and 3. Every scene by a real press from a seeded run at its parent. Forks: full-width 48px choices and a countdown.
  const entered = new Set([st.start]);
  const endingsSeen = [], deathsSeen = [];
  let n = 0;
  for (const target of ids) {
    n++;
    if (target === st.start) continue;
    const way = wayTo(target);
    if (!way) { t.problem("bug", `${id}: no way reaches ${target}`); continue; }
    const parent = way[way.length - 2];
    t.scene(`${id}: ${target}`);
    const doc = await open(way.slice(0, -1), `the press into ${target}`);
    const win = doc.defaultView;
    const box = await ready(doc, parent);
    const btns = visible(box);
    const index = st.scenes[parent].choices.findIndex((c) => c[2] === target);
    const btn = btns.find((b) => Number(b.dataset.choiceIndex) === index);
    if (!btn) { t.problem("bug", `${id}/${parent}: the choice into ${target} isn't on screen (${btns.map(label).join(" | ")})`); closeViewFrame(); continue; }
    if (btns.length > 1) {
      const timer = doc.getElementById("spark-timer");
      const timerOn = !!timer && !timer.hidden && win.getComputedStyle(timer).display !== "none";
      if (!timerOn) t.problem("bug", `${id}/${parent}: a fork with ${btns.length} choices shows no countdown`);
      const bw = box.getBoundingClientRect().width;
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (r.height < 48) t.problem("bug", `${id}/${parent}: "${label(b)}" is ${Math.round(r.height)}px tall (48px at least)`);
        if (r.width < bw * 0.95) t.problem("bug", `${id}/${parent}: "${label(b)}" is ${Math.round(r.width)}px wide in a ${Math.round(bw)}px row (full width wanted)`);
        if (r.left < 0 || r.right > W + 1 || r.bottom > H + 1) t.problem("bug", `${id}/${parent}: "${label(b)}" is not fully on screen at ${W}x${H}`);
      }
      {
        // Thumb reach: every choice sits in the lower half of the screen, the last one clear of the home bar.
        const top = Math.min(...btns.map((b) => b.getBoundingClientRect().top)), foot = Math.max(...btns.map((b) => b.getBoundingClientRect().bottom));
        if (top < H * 0.45) t.problem("bug", `${id}/${parent}: the choices start ${Math.round(top)}px down a ${H}px screen (lower half wanted, thumb reach)`);
        else t.event("thumb-reach", `${id}/${parent}: choices ${Math.round(top)}-${Math.round(foot)}px of ${H}px`);
        const bug = [...doc.querySelectorAll("button, a, [role=button]")].filter((e) => e.getClientRects().length && /bug/i.test((e.id || "") + (e.className || "") + (e.getAttribute("aria-label") || "") + (e.title || "")));
        if (bug.length) t.problem("bug", `${id}/${parent}: a bug button is on screen`);
      }
      const def = win.finalSpark.choicesOf(parent).find((c) => c.default);
      if (def && dead(def.next)) t.problem("bug", `${id}/${parent}: the countdown's default leads to a death (${def.next})`);
      t.event("fork", `${id}/${parent}: ${btns.length} choices, ${btns.map((b) => `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`).join(", ")}, countdown ${timerOn ? "on" : "off"}${touchOn(doc) ? ", touch" : ""}`);
    }
    {
      // Clarity: the story text is never cut mid-sentence under the choices; it fits, or scrolls inside itself with the
      // choices on screen right under the prompt.
      const sb = doc.getElementById("spark-story"), qb = doc.getElementById("spark-question");
      if (sb && sb.textContent.trim()) {
        const sr = sb.getBoundingClientRect(), cr = btns[0].getBoundingClientRect();
        const scrolls = sb.scrollHeight > sb.clientHeight + 1;
        const oy = win.getComputedStyle(sb).overflowY;
        if (scrolls && oy !== "auto" && oy !== "scroll") t.problem("bug", `${id}/${parent}: the story text is cut off (${sb.scrollHeight}px in ${sb.clientHeight}px) and can't scroll`);
        if (sr.bottom > cr.top + 1) t.problem("bug", `${id}/${parent}: the story text runs under the choices`);
        const qr = qb && qb.getBoundingClientRect();
        if (qr && qr.height && cr.top - qr.bottom > 140) t.problem("bug", `${id}/${parent}: the choices are ${Math.round(cr.top - qr.bottom)}px below the prompt`);
        t.event("story-text-fit", `${id}/${parent}: text ${sb.clientHeight}px of ${sb.scrollHeight}px${scrolls ? " (scrolls)" : " (fits)"}, choices ${Math.round(cr.top - sr.bottom)}px under it`);
      }
    }
    trustFallTextFit(t, doc, `${id}/${parent} fork (${W}x${H})`, W, H);
    btn.scrollIntoView({ block: "center", behavior: "instant" });
    const au = win.iltvAudio, auT0 = Date.now() - 5;
    // Swap quality: from the press on, sample every frame for 900 ms: spinners visible (expect 0), title cards with words
    // visible at once (expect 1 at most), the worst frame, and that both branches were preloaded while the countdown ran.
    const swap = { spinners: 0, titles: 0, worst: 0 };
    {
      const vb = doc.getElementById("spark-video");
      const t0s = performance.now();
      let last = t0s;
      const sample = (now) => {
        swap.worst = Math.max(swap.worst, Math.round(now - last));
        last = now;
        const vis = (e) => e.getClientRects().length && !e.hidden && win.getComputedStyle(e).visibility !== "hidden" && Number(win.getComputedStyle(e).opacity) > 0.02;
        swap.spinners = Math.max(swap.spinners, [...doc.querySelectorAll(".spark-video-loading")].filter(vis).length);
        swap.titles = Math.max(swap.titles, [...(vb ? vb.querySelectorAll(".spark-video-blank") : [])].filter((e) => e.textContent.trim() && vis(e)).length);
        if (now - t0s < 900) win.requestAnimationFrame(sample); else swap.done = true;
      };
      win.requestAnimationFrame(sample);
    }
    await tapAt(t, btn, `"${label(btn)}" (${W}x${H})`);
    await waitFor(() => swap.done, 2500);
    if (swap.spinners > 0) t.problem("bug", `${id}/${target}: a loading spinner showed on the scene change`);
    if (swap.titles > 1) t.problem("bug", `${id}/${target}: ${swap.titles} title cards were visible at once on the scene change (overlapping text)`);
    t.event("swap-quality", `${id}/${target}: spinner-visible ${swap.spinners}, max titles visible at once ${swap.titles}, worst frame ${swap.worst} ms`);
    t.metric("trustFallSwapSpinners", swap.spinners);
    t.metric("trustFallSwapMaxTitles", swap.titles);
    t.metric("trustFallSwapWorstFrameMs", swap.worst);
    if (au && au.events) {
      // Sound: every choice press answers with a UI sting, and the scene has its looping ambient bed.
      const tapEv = au.events().filter((e) => e.at >= auT0).find((e) => e.what === "ui" && e.name === "tap");
      if (!tapEv) t.problem("bug", `${id}/${parent}: pressing "${label(btn)}" made no choice sting (audio events: ${au.events().filter((e) => e.at >= auT0).map((e) => e.what).join(",") || "none"})`);
      else t.event("choice-sting", `${id}/${parent}: sting "${tapEv.name}" ${Math.max(0, tapEv.at - auT0)} ms after the press`);
    }
    if (!(await waitFor(() => win.finalSpark.scene() === target, 4000))) { t.problem("bug", `${id}: the press on "${label(btn)}" didn't open ${target} (at ${win.finalSpark.scene()})`); closeViewFrame(); continue; }
    entered.add(target);
    {
      // Reading time: a still page's choices (a death's two buttons too) stay unseen until its words have had 250 words
      // a minute, then come up. Timed from the press that opened the page.
      const box = doc.getElementById("spark-choices");
      const sb = doc.getElementById("spark-story"), qb = doc.getElementById("spark-question");
      const words = (enText(sb) + " " + enText(qb)).split(/\s+/).filter(Boolean).length;
      const want = Math.max(1500, Math.round((words / 250) * 60000));
      const t0 = performance.now();
      let early = null;
      while (box.dataset.phase !== "ready" && performance.now() - t0 < want + 6000) {
        await sleep(100);
        if (box.dataset.phase === "ready") break;
        const shownNow = [...box.querySelectorAll(".choice, [data-death]")].filter((b) => b.getClientRects().length && doc.defaultView.getComputedStyle(box).visibility !== "hidden");
        if (shownNow.length && early == null) early = Math.round(performance.now() - t0);
      }
      const took = Math.round(performance.now() - t0);
      if (box.dataset.phase !== "ready") t.problem("bug", `${id}/${target}: the choices never came up after the reading time (${want} ms for ${words} words)`);
      else if (!box.querySelectorAll(".choice, [data-death]").length) t.event("reading-time", `${id}/${target}: an ending, no choices to hold`);
      else if (early != null || took < want - 500) t.problem("bug", `${id}/${target}: the choices appeared after ${early != null ? early : took} ms, before the ${want} ms reading time of ${words} words at 250 wpm`);
      else t.event("reading-time", `${id}/${target}: ${words} words, choices held ${took} ms (reading time ${want} ms)`);
      t.metric("trustFallReadingHoldMs", took);
      await sleep(400);
    }
    {
      // A clean swap: no Tap to play / title layer left over the new scene, the clip adopted from the preload.
      const ghost = () => doc.querySelectorAll(".tap-to-play, .tap-splash").length;
      const g0 = ghost();
      await sleep(120);
      const g1 = ghost();
      if (g0 || g1) t.problem("bug", `${id}/${target}: a Tap to play / title layer is still over the scene after the press (${g0} at once, ${g1} after 120 ms)`);
      else t.event("clean-swap", `${id}/${target}: no Tap to play or title layer over the scene; ${doc.querySelectorAll("#spark-video video").length} clip element(s); preloaded clip adopted: ${doc.getElementById("spark-video").dataset.adopted || "no"}`);
    }
    {
      // A real clip, not the 'Video in production' title card: the scene plays its generated cut (scene.mp4: the
      // filmed shots, narration, talking shots and music) once its media is made (use: "gen"), 9:16, with sound.
      const v = doc.querySelector("#spark-video video:not(.spark-leave)");
      if (!v && doc.querySelector("#spark-video .spark-still:not(.spark-leave)")) { await checkStill(t, doc, `${id}/${target}`, W); await stillNarrated(au, target, doc); }
      else if (v && (await waitFor(() => v.readyState >= 2 && v.currentTime > 0.5, 6000))) {
        if (/\/scene\.mp4$/.test(decodeURI(new URL(v.currentSrc || v.src, location.href).pathname))) { checkCut(t, v, `${id}/${target}`); await sawRealClip(target); }
        else t.problem("bug", `${id}/${target}: plays a placeholder title card (${v.currentSrc || v.src}), not a filmed clip (its media isn't made: hawkes.assets.json trust-fall-${target}-*)`);
      } else t.problem("bug", `${id}/${target}: no clip is playing after the press`);
    }
    if (target === "unplug") {
      // Shown before told: the scene opens on the cord being yanked, and no story text, question or choice is visible until it ends.
      const hidden = () => ["spark-story", "spark-question", "spark-choices"].every((i) => doc.defaultView.getComputedStyle(doc.getElementById(i)).visibility === "hidden");
      const beat = doc.querySelector("#spark-video .spark-beat");
      const r = beat && beat.getBoundingClientRect();
      if (!beat) t.problem("bug", `${id}/${target}: no action beat shown (the plug being yanked) before the words`);
      else if (!hidden()) t.problem("bug", `${id}/${target}: story text, question or choices are visible while the plug beat plays`);
      else if (r.width < W * 0.9) t.problem("bug", `${id}/${target}: the plug beat does not fill the screen (${Math.round(r.width)}px of ${W})`);
      else { t.event("beat-before-text", `${id}/${target}: the plug is yanked on screen (${Math.round(r.width)}x${Math.round(r.height)}) with no text, question or choice visible`); t.add("trustFallBeats"); }
      if (!(await waitFor(() => !doc.getElementById("spark").dataset.beat && !hidden(), 5000))) t.problem("bug", `${id}/${target}: the words never appear after the plug beat`);
      else t.event("beat-ended", `${id}/${target}: the words and choices appear after the beat`);
    }
    await sleep(380);
    if (au && au.bed) {
      const bd = au.bed();
      if (!bd.playing) t.problem("bug", `${id}/${target}: no looping ambient bed is playing in the scene`);
      else t.event("scene-bed", `${id}/${target}: bed ${bd.url || "on"} loops under the scene`);
    }
    if (au && au.events) {
      // The press's click and stinger, and ARGUS speaking in the scenes where it has a line (voice at 0.9 s, so wait for it).
      const evs = () => au.events();
      if (!(await waitFor(() => evs().some((e) => e.what === "cue"), 1500))) t.problem("bug", `${id}/${target}: the choice press made no stinger (cue) after its click`);
      else t.event("choice-stinger", `${id}/${target}: a click and a stinger played on the press`);
      if (["start", "unplug", "asked", "tower", "listen", "believe", "callMarcus", "saved", "chase", "promise", "believer"].includes(target)) {
        if (!(await waitFor(() => evs().some((e) => e.what === "voice" && e.speaker === "argus"), 3000))) t.problem("bug", `${id}/${target}: ARGUS has a line here but no voice played`);
        else { t.event("argus-voice", `${id}/${target}: ARGUS speaks (bed ducks under it)`); t.add("trustFallArgusVoices"); }
      }
    }
    if (!ending(target) && !dead(target)) trustFallTextFit(t, doc, `${id}/${target} page (${W}x${H})`, W, H);
    if (ending(target)) {
      await rewindEndClip(doc);
      const nameEl = doc.getElementById("spark-ending");
      const card = nameEl && (nameEl.textContent || "").trim();
      if (doc.getElementById("spark").dataset.state !== "soon" || !card) t.problem("bug", `${id}/${target}: an ending shows no ending card`);
      else { endingsSeen.push(target); t.event("ending", `${id}/${target}: "${card}"`); }
      await sleep(800);
      trustFallTextFit(t, doc, `${id}/${target} ending card (${W}x${H})`, W, H);
    } else if (dead(target)) {
      await rewindEndClip(doc);
      await waitFor(() => doc.querySelectorAll("#spark-choices [data-death]").length >= 2, 8000);
      rewindCheckButtons(t, doc, `${id} ${target} (${W}x${H})`, { phone: true });
      for (const b of doc.querySelectorAll("#spark-choices [data-death]")) {
        const r = b.getBoundingClientRect();
        if (r.top < (H * 2) / 3 || r.bottom > H + 1 || r.width < 44 || r.height < 48) t.problem("bug", `${id}/${target}: the ${b.dataset.death} button (${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.top)}px) is not in the bottom third of a ${H}px screen with a 48px target`);
        else t.event("thumb-reach", `${id}/${target}: ${b.dataset.death} ${Math.round(r.width)}x${Math.round(r.height)}, top ${Math.round(r.top)}px of ${H}px (bottom third)`);
      }
      deathsSeen.push(target);
      t.event("death", `${id}: ${target}`);
      await sleep(800);
      trustFallTextFit(t, doc, `${id}/${target} death page (${W}x${H})`, W, H);
    }
    closeViewFrame();
    t.progress(0.05 + (0.6 * n) / ids.length);
  }
  t.metric("trustFallScenesEntered", entered.size);
  {
    const withClip = [];
    for (const sid of ids) if (await hasClip(sid)) withClip.push(sid);
    t.metric("trustFallClipScenes", withClip.length);
    t.metric("trustFallRealClipScenes", realClips.size);
    t.metric("trustFallStillScenes", stills.size);
    const missing = withClip.filter((sid) => !realClips.has(sid));
    if (missing.length) t.problem("bug", `${id}: ${missing.length} scene(s) with a clip.mp4 never played their real cut (${missing.join(", ")})`);
    else t.event("real-clips", `${id}: all ${withClip.length} scenes with a clip played their real cut (9:16, with sound); ${stills.size} without a clip showed the graded still: ${[...stills].join(", ")}`);
  }
  t.metric("trustFallEndings", endingsSeen.length);
  t.metric("trustFallDeaths", deathsSeen.length);
  if (entered.size !== ids.length) t.problem("bug", `${id}: ${entered.size} of ${ids.length} scenes entered by a press (missing ${ids.filter((x) => !entered.has(x)).join(", ")})`);
  if (endingsSeen.length !== ids.filter(ending).length) t.problem("bug", `${id}: ${endingsSeen.length} of ${ids.filter(ending).length} endings showed their ending card`);
  if (deathsSeen.length !== ids.filter(dead).length) t.problem("bug", `${id}: ${deathsSeen.length} of ${ids.filter(dead).length} deaths showed Rewind and Start over`);

  // 4. Belief gates: a choice that needs the flag `believed` is there only on a run that chose Believe it.
  const gated = [];
  for (const sid of ids) for (const c of st.scenes[sid].choices) if (c[7] && c[7].requires && c[7].requires.believed) gated.push({ sid, en: c[1], to: c[2] });
  if (gated.length < 2) t.problem("bug", `${id}: ${gated.length} choices wait on having believed ARGUS (two wanted: the promise and the thank you)`);
  for (const g of gated) {
    const yes = wayTo(g.sid, (f) => f.believed === true);
    const no = wayTo(g.sid, (f) => !f.believed);
    if (!yes || !no) { t.problem("bug", `${id}/${g.sid}: no way arrives ${yes ? "without" : "with"} having believed ARGUS`); continue; }
    t.scene(`${id}: ${g.sid}, believed`);
    let doc = await open(yes, `believed, at ${g.sid}`);
    let box = await ready(doc, g.sid);
    const withIt = visible(box).map(label);
    closeViewFrame();
    t.scene(`${id}: ${g.sid}, did not believe`);
    doc = await open(no, `not believed, at ${g.sid}`);
    box = await ready(doc, g.sid);
    const without = visible(box).map(label);
    const locked = box.querySelectorAll(".choice-locked").length;
    closeViewFrame();
    if (!withIt.includes(g.en)) t.problem("bug", `${id}/${g.sid}: after Believe it "${g.en}" isn't offered (${withIt.join(" | ")})`);
    if (without.includes(g.en)) t.problem("bug", `${id}/${g.sid}: without believing "${g.en}" is offered (${without.join(" | ")})`);
    if (locked) t.problem("bug", `${id}/${g.sid}: without believing a locked row shows (the choice should not be there at all)`);
    t.event("belief-gate", `${id}/${g.sid}: "${g.en}" - believed [${withIt.join(" | ")}]; not believed [${without.join(" | ")}]`);
    // And the gated choice is played: seeded to the fork after Believe it, a real tap on it opens its scene, text fits.
    t.scene(`${id}: press "${g.en}"`);
    doc = await open(yes, `pressing "${g.en}" at ${g.sid}`);
    box = await ready(doc, g.sid);
    trustFallTextFit(t, doc, `${id}/${g.sid} believed fork (${W}x${H})`, W, H);
    const gi = st.scenes[g.sid].choices.findIndex((c) => c[1] === g.en && c[2] === g.to);
    const gb = visible(box).find((b) => Number(b.dataset.choiceIndex) === gi);
    if (!gb) t.problem("bug", `${id}/${g.sid}: the gated choice "${g.en}" can't be pressed after Believe it`);
    else {
      gb.scrollIntoView({ block: "center", behavior: "instant" });
      await tapAt(t, gb, `gated "${g.en}" (${W}x${H})`);
      if (!(await waitFor(() => doc.defaultView.finalSpark.scene() === g.to, 5000))) t.problem("bug", `${id}/${g.sid}: pressing "${g.en}" didn't open ${g.to}`);
      else {
        await waitFor(() => doc.getElementById("spark-choices").dataset.phase === "ready", 12000);
        await rewindEndClip(doc);
        await sleep(600);
        trustFallTextFit(t, doc, `${id}/${g.to} after "${g.en}" (${W}x${H})`, W, H);
        t.event("gated-pressed", `${id}/${g.sid}: "${g.en}" pressed by touch -> ${g.to}`);
        t.add("trustFallGatedPressed");
      }
    }
    closeViewFrame();
  }
  t.progress(0.8);

  // 4b. Phone layout (Late Shift): at a fork the clip sits above the words, the words above the choices, nothing over the
  // picture, and the choices are in the lower thumb zone, all by touch at 390x844 with no sideways scroll.
  {
    const sid = ids.find((x) => !dead(x) && !ending(x) && st.scenes[x].choices.length >= 2 && x !== st.start && wayTo(x));
    if (!sid) t.problem("bug", `${id}: no fork to check the phone layout at`);
    else {
      t.scene(`${id}: phone layout at ${sid}`);
      const doc = await open(wayTo(sid), `phone layout at ${sid}`);
      const box = await ready(doc, sid);
      const win = doc.defaultView;
      const R = (el) => el.getBoundingClientRect();
      const stage = R(doc.querySelector(".spark-stage"));
      const story = doc.getElementById("spark-story");
      const panel = R(doc.querySelector(".spark-panel"));
      const btns = visible(box).map(R);
      const text = R(story);
      if (!touchOn(doc)) t.problem("bug", `${id}/${sid}: the phone frame is not a touch screen`);
      if (stage.top > 1 || stage.height < H * 0.4) t.problem("bug", `${id}/${sid}: the clip is not at the top of the phone (${Math.round(stage.top)}, ${Math.round(stage.height)}px tall)`);
      if (story.textContent.trim() && text.top < stage.bottom - 1) t.problem("bug", `${id}/${sid}: the story text (top ${Math.round(text.top)}) lies over the clip (bottom ${Math.round(stage.bottom)})`);
      if (panel.top < stage.bottom - 1) t.problem("bug", `${id}/${sid}: the panel lies over the clip`);
      if (btns.length < 2) t.problem("bug", `${id}/${sid}: ${btns.length} choices shown`);
      for (const b of btns) {
        if (b.top < text.bottom - 1 && story.textContent.trim()) t.problem("bug", `${id}/${sid}: a choice sits above the story text`);
        if (b.top < H * 0.55) t.problem("bug", `${id}/${sid}: a choice is above the thumb zone (top ${Math.round(b.top)} of ${H})`);
        if (b.height < 44 || b.left < 0 || b.right > W) t.problem("bug", `${id}/${sid}: a choice is ${Math.round(b.width)}x${Math.round(b.height)} at ${Math.round(b.left)}`);
      }
      if (doc.documentElement.scrollWidth > W) t.problem("bug", `${id}/${sid}: the page scrolls sideways (${doc.documentElement.scrollWidth}px)`);
      t.event("phone-layout", `${id}/${sid}: clip ${Math.round(stage.top)}-${Math.round(stage.bottom)}, text ${Math.round(text.top)}-${Math.round(text.bottom)}, choices ${btns.map((b) => `${Math.round(b.top)}-${Math.round(b.bottom)}`).join(", ")} of ${H}`);
      t.event("screenshot", `${id}/${sid} at ${W}x${H}: clip above the text, choices at the foot of the screen`);
      t.metric("trustFallPhoneChoiceTop", Math.round(Math.min(...btns.map((b) => b.top))));
      {
        // The check has teeth: clip the story text to 18px with overflow hidden and the same check must report it.
        const sb = doc.getElementById("spark-story");
        if (sb && sb.textContent.trim()) {
          const keep = sb.getAttribute("style");
          sb.style.cssText += ";max-height:18px;overflow:hidden;flex:none";
          const caught = [];
          trustFallTextFit({ problem: (k, m) => caught.push(m), event() {}, add() {} }, doc, `${id}/${sid} self-test`, W, H);
          if (keep == null) sb.removeAttribute("style"); else sb.setAttribute("style", keep);
          if (!caught.some((m) => /cut off/.test(m))) t.problem("bug", `${id}: the text-fit check did not catch story text clipped to 18px`);
          else t.event("text-fit-catches", `${id}/${sid}: clipped story text is reported ("${caught[0].slice(0, 90)}")`);
        }
      }
      closeViewFrame();
    }
  }

  // 4c. After the river (the death at the end of "Go back and face Juno"): both buttons by touch. Rewind returns to the
  // fork with the deadly choice marked Tried; Start over returns to First light.
  for (const dsid of ids.filter(dead)) {
    const fork = ids.find((x) => !dead(x) && st.scenes[x].choices.some((c) => c[2] === dsid) && wayTo(x));
    if (!fork) continue;
    const deadly = st.scenes[fork].choices.find((c) => c[2] === dsid);
    for (const kind of ["rewind", "start"]) {
      t.scene(`${id}: ${kind} after ${dsid}`);
      const doc = await open(wayTo(fork), `${kind} after ${dsid}`);
      const win = doc.defaultView;
      const fbox = await ready(doc, fork);
      const killer = visible(fbox).find((b) => label(b).replace(/^\d+\.\s*/, "") === deadly[1].replace(/^\d+\.\s*/, ""));
      if (!killer) { t.problem("bug", `${id}/${fork}: the deadly choice "${deadly[1]}" isn't offered`); closeViewFrame(); continue; }
      await tapAt(t, killer, `the deadly choice at ${fork}`);
      if (!(await waitFor(() => win.finalSpark.scene() === dsid, 6000))) { t.problem("bug", `${id}/${fork}: pressing "${deadly[1]}" didn't reach ${dsid}`); closeViewFrame(); continue; }
      await rewindEndClip(doc);
      const box = doc.getElementById("spark-choices");
      await waitFor(() => box.querySelectorAll("[data-death]").length >= 2, 8000);
      await sleep(350);
      const btn = box.querySelector(`[data-death="${kind}"]`);
      if (!btn) { t.problem("bug", `${id}/${dsid}: no ${kind} button`); closeViewFrame(); continue; }
      trustFallTextFit(t, doc, `${id}/${dsid} death page before ${kind} (${W}x${H})`, W, H);
      const r = btn.getBoundingClientRect();
      if (r.top < (H * 2) / 3 || r.height < 48) t.problem("bug", `${id}/${dsid}: ${kind} at ${Math.round(r.top)}px, ${Math.round(r.height)}px tall (bottom third, 48px wanted)`);
      else t.event("death-buttons-reach", `${id}/${dsid}: ${kind} top ${Math.round(r.top)} of ${H}, ${Math.round(r.width)}x${Math.round(r.height)}`);
      await tapAt(t, btn, `${kind} after ${dsid}`);
      const want = kind === "rewind" ? fork : st.start;
      if (!(await waitFor(() => win.finalSpark.scene() === want, 4000))) t.problem("bug", `${id}/${dsid}: ${kind} didn't return to ${want} (at ${win.finalSpark.scene()})`);
      else t.event(`${kind}-after-death`, `${id}/${dsid}: ${kind} -> ${want}`);
      if (kind === "rewind") {
        const rbox = doc.getElementById("spark-choices");
        await waitFor(() => rbox.dataset.phase === "ready" && rbox.querySelector(".choice"), 8000);
        await sleep(350);
        const tried = [...rbox.querySelectorAll(".choice")].find((b) => label(b).replace(/^\d+\.\s*/, "") === deadly[1].replace(/^\d+\.\s*/, ""));
        if (!tried) t.problem("bug", `${id}/${fork}: after Rewind the deadly choice "${deadly[1]}" isn't there`);
        else rewindCheckTried(t, doc, tried, `${id}/${fork} after Rewind`);
      }
      closeViewFrame();
    }
  }

  // 5. The countdown never picks a death: the forks with a deadly option are left to the 15 s timer.
  for (const sid of ids.filter((x) => !dead(x) && st.scenes[x].choices.some((c) => dead(c[2])))) {
    t.scene(`${id}: the timer runs out at ${sid}`);
    const doc = await open(wayTo(sid), `the timeout at ${sid}`);
    const win = doc.defaultView;
    await ready(doc, sid);
    const left = await waitFor(() => win.finalSpark.scene() !== sid, 22000);
    const now = win.finalSpark.scene();
    if (!left) t.problem("bug", `${id}/${sid}: nothing happened when the countdown ran out`);
    else if (dead(now)) t.problem("bug", `${id}/${sid}: the countdown picked a death (${now})`);
    else t.event("timeout-safe", `${id}/${sid}: the countdown chose ${now}`);
    closeViewFrame();
  }

  // 6. Reasons to come back: after one ending the Tree shows visited and unvisited branches and the Endings tab shows
  // the other endings as locked tiles with a hint, all by touch at 390x844.
  {
    const endIds = ids.filter(ending);
    const found = endIds.find((x) => !st.scenes[x].choices.length && wayTo(x, (f) => !f.believed));
    const wayEnd = found && wayTo(found, (f) => !f.believed);
    if (!wayEnd) t.problem("bug", `${id}: no ending reachable without believing ARGUS`);
    else {
      t.scene(`${id}: Tree and Endings after ${found}`);
      let doc = await open(wayEnd, `the Tree and Endings tabs after ${found}`);
      await ready(doc, found);
      const win = doc.defaultView;
      const tab = (n) => doc.getElementById(n);
      for (const n of ["tab-tree", "tab-endings"]) {
        const r = tab(n).getBoundingClientRect();
        if (r.height < 44 || r.width < 44) t.problem("bug", `${id}: the ${n} tab is ${Math.round(r.width)}x${Math.round(r.height)}px (44px at least)`);
      }
      await tapAt(t, tab("tab-tree"), "Tree tab");
      await sleep(300);
      const tree = doc.getElementById("spark-tree");
      const seen = tree.querySelectorAll(".tree-node:not(.is-locked)").length, hidden = tree.querySelectorAll(".tree-node.is-locked").length;
      if (seen < wayEnd.length || hidden < 1) t.problem("bug", `${id}: the Tree shows ${seen} visited and ${hidden} unvisited branches after a ${wayEnd.length}-page way (visited >= ${wayEnd.length}, unvisited >= 1 wanted)`);
      if (doc.documentElement.scrollWidth > W + 1) t.problem("bug", `${id}: the Tree scrolls the page sideways at ${W}x${H}`);
      t.event("tree-branches", `${id}: Tree shows ${seen} visited and ${hidden} unvisited branches; "${(tree.querySelector(".tree-note") || {}).textContent || ""}"`);
      await tapAt(t, tab("tab-endings"), "Endings tab");
      await sleep(300);
      const tiles = [...doc.querySelectorAll("#spark-endings .ending-tile")];
      const open1 = tiles.filter((x) => x.classList.contains("is-found")).length, lockedTiles = tiles.filter((x) => x.classList.contains("is-locked"));
      const hints = lockedTiles.filter((x) => (x.querySelector(".ending-tile-hint") || {}).textContent);
      if (tiles.length !== endIds.length) t.problem("bug", `${id}: the Endings tab has ${tiles.length} tiles for ${endIds.length} endings`);
      if (open1 !== 1) t.problem("bug", `${id}: the Endings tab shows ${open1} found endings after one (1 wanted)`);
      if (hints.length !== lockedTiles.length) t.problem("bug", `${id}: ${lockedTiles.length - hints.length} locked endings give no hint on how to chase them`);
      if (doc.documentElement.scrollWidth > W + 1) t.problem("bug", `${id}: the Endings tab scrolls the page sideways at ${W}x${H}`);
      t.event("endings-chase", `${id}: ${open1} found, ${lockedTiles.length} locked with hints [${hints.map((x) => x.querySelector(".ending-tile-hint").textContent).join(" | ")}]`);
      closeViewFrame();
    }
  }
  t.progress(1);
}

async function decisiveRun(options, t) {
  // Same guard as audioBusesRun / phoneChoicesRun: a smoke leg must not overwrite the outer snapshot.
  if (!savedRuns && savedCookie == null) rememberProgress();
  const inSmoke = options && options.at === "smoke";
  await passPrompt(t);
  clearProgress();
  if (!landingShown()) await toLanding(t);

  // Smoke leg (beta plays smoke): Final Spark tap + keys 1/2, mid-animation at 390x844, then Night Shift key 3
  // at okafor-out so all four criteria show in smoke footage.
  if (inSmoke) {
    t.scene("Decisive choice (smoke): Final Spark tap and keys");
    await openStory(t, FIRST);
    await toStart(t, { quiet: true });
    await sleep(300);
    await decisivePress(t, document, `${FIRST} desktop`, "tap");
    await sleep(1400);
    await toStart(t, { quiet: true });
    await sleep(300);
    await decisivePress(t, document, `${FIRST} desktop`, "key", "1");
    t.progress(0.35);
    {
      t.scene("Decisive choice (smoke): Final Spark at 390x844");
      const doc = await decisiveOpenAt(t, FIRST, 390, 844);
      await decisivePress(t, doc, `${FIRST} 390x844`, "tap");
      closeViewFrame();
      await sleep(200);
    }
    t.progress(0.6);
    {
      const st = story("night-shift");
      t.scene("Decisive choice (smoke): Night Shift key 3");
      clearProgress();
      consoleSeedWrite(st, [0, 0], null);
      t.event("seeded-run", "night-shift smoke: at okafor-out for key 3");
      openByLink(t, st.id);
      await waitFor(() => window.iltvConsole && window.iltvConsole.story() === st.id, 5000);
      if (soundOf().prompt()) await consolePrompt(t, document, st.id);
      if (!(await waitFor(() => document.querySelectorAll("#console-choices .choice").length >= 3, 15000))) {
        t.problem("bug", "night-shift smoke: okafor-out never showed three choices for key 3");
      } else {
        const box = $("console-choices");
        const btns = [...box.querySelectorAll(".choice")];
        const buzz = [];
        const realVibrate = navigator.vibrate;
        try { navigator.vibrate = (ms) => { buzz.push(ms); return true; }; } catch (e) { /* read-only */ }
        let ui = 0;
        const onDeciding = () => ui++;
        document.addEventListener("iltv:deciding", onDeciding);
        const before = ui;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
        await sleep(120);
        t.event("screenshot", "night-shift smoke key 3: mid-animation");
        const chosen = btns[2].classList.contains("is-chosen");
        const fading = btns.slice(0, 2).every((b) => b.classList.contains("is-fading"));
        t.event("decisive", `night-shift smoke key3: chosen=${chosen} others-fading=${fading} decisions=${ui - before} vibrate=${JSON.stringify(buzz)}`);
        if (!chosen) t.problem("bug", "night-shift smoke: key 3 didn't mark the third card");
        if (!fading) t.problem("bug", "night-shift smoke: key 3 didn't fade the other cards");
        if (ui - before !== 1) t.problem("bug", `night-shift smoke: ${ui - before} choices fired for key 3`);
        document.removeEventListener("iltv:deciding", onDeciding);
        try { navigator.vibrate = realVibrate; } catch (e) { /* ignore */ }
        await sleep(400);
      }
    }
    t.progress(1);
    return;
  }

  const ids = listedStories().map((i) => i.id);
  const sizes = [[390, 844, "390x844"], [1280, 720, "1280x720"]];
  let step = 0;
  const total = ids.length * 2 + ids.length * sizes.length + 1;

  // On the page: each listed story, double-tap then (new run) keys 1+2 together.
  // Night Shift: seed the first scene's lines as heard (setup shortcut) so the run stays under its budget.
  for (const id of ids) {
    const st = story(id);
    for (const mode of ["tap", "key"]) {
      t.scene(`${st.title}: choice by ${mode}`);
      if (isConsole(st)) {
        clearProgress();
        consoleSeedWrite(st, [], null);
        t.event("seeded-run", `${id} desktop: first scene's lines counted as heard (setup shortcut)`);
        openByLink(t, id);
        await waitFor(() => window.iltvConsole && window.iltvConsole.story() === id, 5000);
        if (soundOf().prompt()) await consolePrompt(t, document, id);
        if (!(await waitFor(() => document.querySelectorAll("#console-choices .choice").length > 0, 15000))) {
          t.problem("bug", `${id}: no choices after seeded first scene`);
          continue;
        }
      } else {
        if (stories().current() !== id) await openStory(t, id);
        await toStart(t);
      }
      await sleep(300);
      await decisivePress(t, document, `${id} desktop`, mode, "1");
      await sleep(1400);
      t.progress(++step / total);
    }
  }

  // Sized frames: mid-animation screenshots for every listed story at 390x844 and 1280x720.
  for (const id of ids) {
    for (const [w, h, tag] of sizes) {
      t.scene(`${story(id).title}: decisive at ${tag}`);
      const doc = await decisiveOpenAt(t, id, w, h);
      await decisivePress(t, doc, `${id} ${tag}`, "tap");
      closeViewFrame();
      await sleep(200);
      t.progress(++step / total);
    }
  }

  // Key 3: Night Shift seeded two choices in (okafor-out has three choices); press 3 and check the third card.
  {
    const st = story("night-shift");
    t.scene("Night Shift: key 3 picks the third choice");
    clearProgress();
    consoleSeedWrite(st, [0, 0], null); // setup shortcut: at okafor-out with lines heard
    t.event("seeded-run", "night-shift: at okafor-out (two choices in) for key 3");
    openByLink(t, st.id);
    await waitFor(() => window.iltvConsole && window.iltvConsole.story() === st.id, 5000);
    if (soundOf().prompt()) await consolePrompt(t, document, st.id);
    if (!(await waitFor(() => document.querySelectorAll("#console-choices .choice").length >= 3, 15000))) {
      t.problem("bug", "night-shift: okafor-out never showed three choices for key 3");
    } else {
      const win = window;
      const box = $("console-choices");
      const btns = [...box.querySelectorAll(".choice")];
      const buzz = [];
      const realVibrate = navigator.vibrate;
      try { navigator.vibrate = (ms) => { buzz.push(ms); return true; }; } catch (e) { /* read-only */ }
      let ui = 0;
      const onDeciding = (e) => { ui++; t.event("decisive-key", `key 3 -> index ${e.detail && e.detail.index}`); };
      document.addEventListener("iltv:deciding", onDeciding);
      const before = ui;
      // Key listener is on document (js/console.js); dispatch there, not on window.
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
      await sleep(120);
      t.event("screenshot", "night-shift key 3: mid-animation");
      const third = btns[2];
      const chosen = third.classList.contains("is-chosen");
      const fading = btns.slice(0, 2).every((b) => b.classList.contains("is-fading"));
      t.event("decisive", `night-shift key3: chosen=${chosen} others-fading=${fading} decisions=${ui - before} vibrate=${JSON.stringify(buzz)}`);
      if (!chosen) t.problem("bug", "night-shift: key 3 didn't mark the third card");
      if (!fading) t.problem("bug", "night-shift: key 3 didn't fade the other cards");
      if (ui - before !== 1) t.problem("bug", `night-shift: ${ui - before} choices fired for key 3 (with a follow-up 1)`);
      document.removeEventListener("iltv:deciding", onDeciding);
      try { navigator.vibrate = realVibrate; } catch (e) { /* ignore */ }
      await sleep(1400);
    }
    t.progress(++step / total);
  }

  t.progress(1);
}

async function progressRun(options, t) {
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  clearProgress();
  if (!landingShown()) await toLanding(t);
  const list = listedStories();
  let k = 0;
  for (const info of list) {
    const st = story(info.id);
    t.scene(`${st.title}: one choice`);
    window.scrollTo(0, 0);
    const watch = frameWatch();
    if (isConsole(st)) await consoleOpen(t, st);
    else await openStory(t, st.id);
    await sleep(600);
    watch.on = false;
    t.event("open-frames", `${st.id}: ${watch.frames} frames, ${watch.scrolled} scrolled (worst ${Math.round(watch.worst)} px), ${watch.hidden} without the header`);
    if (watch.scrolled) t.problem("bug", `${st.title}: the page was scrolled in ${watch.scrolled} of ${watch.frames} frames while it opened (up to ${Math.round(watch.worst)} px)`);
    if (watch.hidden) t.problem("bug", `${st.title}: the site header was out of view in ${watch.hidden} of ${watch.frames} frames while it opened`);
    const box = () => ($(isConsole(st) ? "console-explored" : "spark-explored")?.textContent || "").trim();
    const before = stories().explored(st.id);
    const textBefore = box();
    if (isConsole(st)) {
      await consoleFresh(t, st);
      await consoleHeard(t, document, st.id);
      const m = consoleModel(st);
      if (!m.open().length) t.problem("bug", `${st.title}: no choices to press on its first scene`);
      else await consoleChoose(t, st, m, m.open()[0][1], document, st.id, null);
    } else {
      await toStart(t);
      const btns = choiceButtons();
      if (!btns.length) t.problem("bug", `${st.title}: no choices on its first page`);
      else {
        const watchChoice = frameWatch();
        btns[0].click();
        await sleep(500);
        watchChoice.on = false;
        if (watchChoice.scrolled || watchChoice.hidden) t.problem("bug", `${st.title}: a choice moved the page (${watchChoice.scrolled} frames scrolled up to ${Math.round(watchChoice.worst)} px, ${watchChoice.hidden} without the header)`);
      }
    }
    const after = stories().explored(st.id);
    t.event("progress", `${st.id}: ${before}% -> ${after}% (${textBefore} -> ${box()}) after one choice`);
    if (!(after > 0)) t.problem("bug", `${st.title}: ${after}% explored after one choice`);
    if (!(after > before)) t.problem("bug", `${st.title}: explored went from ${before}% to ${after}% with a choice taken`);
    if (box() !== `${after}% explored`) t.problem("bug", `${st.title}: the player says "${box()}", explored() says ${after}%`);
    t.metric(`explored_${st.id}`, after);
    await toLanding(t);
    checkBadge(t, cardOf(st.id), st, "started", `after one choice in ${st.title}`);
    t.progress(++k / list.length);
  }
}

// The scenarios that use a console story's state explorer: it is worked out before they play (consoleWarm).
const NEEDS_STATES = ["stories", "branches", "pages", "console", "room", "night-shift", "night-shift-card", "night-shift-audio", "night-shift-signoff", "cctv-art", "analytics", "progress", "phone-choices"];

installPlaytest({
  product: "imaginelivetv",
  scenarios: [
    {
      id: "smoke",
      title: "First-minutes (hero motion, per-story timing), landing, each listed story, language, phone-media, swap, Continue, Endings, audio buses, decisive choice",
      seconds: 600,
      tags: ["smoke"],
      description: "First-minutes leg (fresh browser at 1280x720 and 390x844): hero trailer moving within 2 s; per story secondsToFirstMotion, secondsToFirstSound, secondsToFirstChoice, wordsBeforeFirstChoice (problem if first choice > 30 s); centred card preview at 390x844; posters-only with ?living=still. Then each listed story opens from its hero or catalogue card (Tap to play), first page or wall, one real choice, All stories. Then at 390x844 the language picker and Studio notes titles (`language`), The Water Road's poster and phone rendition (`phone-media`), scene-swap, Continue Previously (at:smoke), Endings gallery, audio buses, decisive choice.",
    },
    {
      id: "endings-gallery",
      title: "Endings gallery: reach two Water Road endings, found posters and names, locked silhouettes, count, recall, fit at 390x844 and 1280x720",
      seconds: 180,
      tags: ["full"],
      description: "Clears progress, opens The Water Road (or {\"story\":\"<id>\"}), walks the shortest way to each ending with real presses. At each ending the card shows \"N of M found\" and an Endings button; the gallery lists found endings with poster and name and locked ones as a blurred darkened silhouette with \"???\". Tapping a found ending shows its card again. The Endings tab on the story page shows the same gallery. With one ending found, a second run: choices to unseen scenes wear New, fully seen ones Seen, the Tree the same, the home card says \"1 of 2 endings\" (replay leg at 390x844: tagged choices 48 px or more, nothing cut off; events replay-marks, replay-tree, replay-phone, replay-card). Fit checks in frames at 390x844 and 1280x720 after both are found. On a phone-sized page (or {\"at\":\"replay\"}) only the replay leg plays, from a seeded run (event seeded-run: the first ending found and its way unlocked), then every ending found for the card badge; the tag sits inside the card clear of the words (replay-phone-fit). Events endings-count, endings-gallery, ending-recall, screenshot; metrics endingsFound, endingsTotal.",
    },
    {
      id: "stories",
      title: "The landing page opens every story: its card, its player, its first page, All stories, its link",
      seconds: 80,
      tags: ["full"],
      description: "Waits for the landing page's title splash (just IMAGINE LIVE TV on the prompt's background, no Tap to play, no sound line) to fade away by itself, and checks the landing page shows no inventory (the flashlight is The Final Spark's: it's there once the story is open). Checks the landing page has a card for every listed story in story/stories.json (title, logline, an image that loads) and none for the unlisted ones. Progress on the cards: with the saved places cleared (a fresh browser, the home page loaded in a frame) every card says Not started and 0% explored; opening a story makes its card say Started, one scene's percent; its Tree then shows only the first page and a locked ? per choice (nothing to press, nothing of the scene behind a ?); reaching one of its endings (the shortest way) makes it Completed, the percent follows the unlocked scenes (100% only with every scene found) and its card's button says Start Over (the run is at an ending), the story's link reopens it at that ending (with the inventory's counts of the way there), and a death and Try again keep it Completed (the button Play: the run is back at the start); the home page loaded again shows every card Completed. Then, from an ending, each card's Start Over: it forgets only that story's run (its unlocks, percent and Completed stay; the other stories' cookies are untouched) and opens it at its start with an empty history; back on the landing page its card says Completed, the same percent, and Start Over (a Completed card always offers Start Over, the same in all three stories; only an ending sets Completed). Taps each card: the player opens that story (its title, ?story=<id> in the address) under its own Tap to play prompt, which it taps; its first page's text, video and choices, and no Back button in the player; All stories brings the landing page back with the video gone (no splash again, no inventory). A draft (listed: false) opens by its link, /?story=<id>: its title, first page and inventory (a draft whose media is made plays its first page's cut, 9:16 with sound), and a saved place a few choices in comes back with the same counts. Then each story's own link, /<id>/, opens the home page straight into that story, with its own Tap to play title. Night Shift (a console story, 36 minutes of voiced lines at the shortest) is a card like the others: opened from its card it shows its wall, first lines and choices; for Completed the bot leaves the player two choices short of the shortest way's ending with a seeded run (the run and unlocks saved as a viewer who had listened that far would have them: a named setup shortcut, event seeded-run) and presses the last choices; Start Over then reuses that ending. The `night-shift` scenario plays whole ways with real presses.",
    },
    {
      id: "water-gates",
      title: "The water you kept decides which choices stay open: two water forks, a locked row that says why at 390x844, the family comes back, costs not trick deaths",
      seconds: 150,
      tags: ["full"],
      description: "The Water Road at 390x844 (a frame; each fork opened from a seeded run there, a setup shortcut, event seeded-run; the Tap to play prompt pressed). At each fork that has a choice behind a count of water (the dry wash needs 2, the night's barrel on the rocks needs 3): reached with enough water the option is a button; reached short of it the option is not a button but a greyed-out row that says why (\"needs water 3+\", 48px or taller, 14px type or more, not pressable: a touch on it does nothing), and the water count in the inventory bar is fully on screen above no choice, with the count the story holds (events water-gate-open, water-gate-locked, metric waterForks). At the dry wash and the night raid, a run that helped the family and one that passed them read and offer differently (the boy recognises the riders, the father stands with you; event family-callback). Each ending's words name an earlier choice (ending-callback). Two deaths at most, and the warning shot and the high ground cost barrels, a mule or a rider instead (events cost-not-death, deaths). Options: {\"story\":\"<id>\"}.",
    },
    {
      id: "trust-fall-endings",
      title: "Trust Fall's endings gallery on a phone: Live gives '1 of 3 found', Unseen and Good morning are silhouettes with hints, no sideways scroll",
      seconds: 90,
      tags: ["full"],
      description: "Trust Fall (draft, /?story=trust-fall) at 390x844 with touch taps in a frame. A seeded run (seeded-run) one choice before Live, a real tap on that choice, the ending card says \"1 of 3 found\", a tap on Endings opens the gallery: Live a found tile, Unseen and Good morning blurred silhouettes named \"???\" with their teaser hints, nothing off screen and no horizontal scroll. Events ending-count, locked-ending, gallery-fit, screenshot; metrics endingsFound, endingsTotal.",
    },
    {
      id: "trust-fall",
      title: "Trust Fall on a phone: one tap starts it, every scene by a real press, both deaths, three endings, the belief gates, the countdown never kills",
      seconds: 300,
      tags: ["full"],
      description: "Trust Fall (draft, listed: false, /?story=trust-fall; or {\"story\":\"<id>\"}) at 390x844 with touch presses in a frame. One tap on Tap to play starts the first clip (the buffering ring is in the player and hidden once it plays). Every one of the 20 scenes is entered by a real press of the choice that leads there, from a seeded run at its parent (a setup shortcut, event seeded-run); every fork shows full-width choice buttons 48px tall or more with a countdown whose default is never a death; the 3 endings show the ending card and the 2 deaths show Rewind to the choice and Start over. The choices gated by having believed ARGUS (Wait. ARGUS promised; Say thank you to ARGUS) are on the page only after Believe it, and not at all (no locked row) without. The two forks with a deadly option are left to the 15 s countdown, which picks a safe scene. Text fit (J, 2026-11-14): every fork, page, ending card and death page is checked (trustFallTextFit: text boxes on screen, none cut off by overflow or an ancestor, no page scroll past the screen; event text-fit, metric trustFallTextFitPages) and the two gated choices are pressed by touch after Believe it (gated-pressed); a self-test clips the story text and must see it (text-fit-catches).",
    },
    {
      id: "rewind",
      title: "A death goes back to the decision: Rewind to the choice (the deadly option marked Tried) and Start over; a timeout never kills; one-choice pages play on by themselves",
      seconds: 240,
      tags: ["full"],
      description: "The Water Road (or {\"story\":\"<id>\"}): real presses to the nearest death. The death keeps its clip and line and offers two buttons, Rewind to the choice and Start over, full width and 48px tall. Rewind shows the same fork again within 2 s (rewindMs) with the deadly option marked Tried (words, readable contrast, saved with the run); the same death again, then Start over opens the first page as a new run with nothing tried. At 390x844 (a frame, the run seeded at the death: setup shortcut, event seeded-run) both buttons are fully on screen, full width and at least 48px tall, and Rewind there marks the fork too. Then every fork that has a deadly option (the salt flats, the dry wash, the night raid) is opened from a seeded run, its clip played to the end and the 15 s timer left to run out: the timer never picks a death. Last, a one-choice page of The Final Spark (seeded) shows no button and, when its clip ends, fades and carries on to the next page by itself (event auto-continue).",
    },
    {
      id: "decisive-choice",
      title: "A choice is decisive: the chosen card glows, the others fall away, one vibration, a double tap makes one choice, keys 1/2/3 pick",
      seconds: 180,
      tags: ["full"],
      description: "In every listed story (clip and Night Shift): a double tap on choice 1, then (a new run) keys 1 and 2 pressed together; Night Shift uses a seeded first scene (setup shortcut, event seeded-run). Checks is-chosen, scale-up glow, the others fading, aria-busy/pressed, navigator.vibrate(10), and exactly one iltv:deciding per double input. Then mid-animation screenshots in frames at 390x844 and 1280x720 for each story. Last, Night Shift seeded at okafor-out (three choices) and key 3 picks the third card. Events decisive, screenshot, seeded-run. Smoke leg: Final Spark tap+keys, Final Spark at 390x844, Night Shift key 3 at okafor-out (so beta sees all four criteria).",
    },
    {
      id: "progress",
      title: "One choice in each story raises the percent explored (Night Shift above 0), and opening a story never moves the page",
      seconds: 90,
      tags: ["full"],
      description: "From a fresh browser, each listed story (The Final Spark, The Water Road, Night Shift) is opened from its card while every animation frame is sampled: the page stays at the top and the site header stays in view (open-frames event). One choice is pressed in each (a real press); the percent explored must go up and be above 0 (Night Shift is 1 of 228 scenes: at least 1%), the player's text matching explored(), and the card says Started. Event progress per story, metrics explored_<id>.",
    },
    {
      id: "living-home",
      title: "The landing page is alive: the house lights come up, cards answer the pointer, blog cards wake; never ten quiet seconds",
      seconds: 60,
      tags: ["full"],
      description: "Fresh load, splash passed. Watches the house lights come up card by card, hovers and presses each card (a pointer event, a tick synthesized in the page), scrolls to the blog so its cards wake, then reports quality.maxQuietSeconds (longest gap between two things to see, hear or do, from js/living.js's log plus the presses) and quality.textOnlyBeats (0: the beat is light and sound, no text).",
    },
    {
      id: "front-door",
      title: "The landing page as a front door: a hero, every card with poster, runtime, mood and percent explored, a Continue row once a story is started, and it fits at 390 px",
      seconds: 60,
      tags: ["full"],
      description: "From a fresh browser (the splash passed, saved places cleared): the hero shows the featured story's poster, title, runtime and mood; every listed story's card shows a poster that loads, a runtime (\"About 45 min\"), a mood and its percent explored; no Continue row is on the page. Then a real press on The Final Spark's card and its first choice, and All stories: the Continue watching row shows that story alone, with its poster, a bar and the same percent explored as the player says. The home page in a 390x844 frame shows the same (row, cards, hero), with nothing wider than the screen and tap targets of 44 px or more. A real press on the Continue card reopens the story where it was left (not at its start). Events front-card, front-hero, continue-row, continue-card, continue-opened.",
    },
    {
      id: "night-shift-card",
      title: "Night Shift's landing card: Not started with its image and logline (nothing about B3, the vat or the creature), Started once opened, Completed with Start Over at an ending",
      seconds: 90,
      tags: ["full"],
      description: "The card criteria alone, short enough to watch (the `stories` scenario covers every story). Waits for the landing page's splash, clears the saved places, and with the home page loaded in a frame checks every card says Not started. Night Shift's card follows The Water Road, has a logline and an image that loads, and says nothing about B3, the vat or the creature. Opens it from its card (a real press, then its Tap to play): its wall, first lines and choices, its card then says Started with one scene's percent. Reaching an ending (a seeded run two choices short of the shortest way: setup shortcut, event seeded-run; the last choices are real presses) makes the card say Completed with Start Over, the percent following the scenes seen; Start Over opens the story at its first scene and the card still says Completed and Start Over. Options: {\"story\":\"<id>\"}.",
    },
    {
      id: "night-shift-treatment",
      title: "Night Shift's radio, walkie, intercom and phone lines are band-limited, treated lines are in the lock and as loud as the rest, and a treated line is heard",
      seconds: 150,
      tags: ["full"],
      description: "Reads story/night-shift.json: every line whose performance says over the radio, on the walkie, over the intercom or a speakerphone has a treatment (radio, walkie, intercom, phone), and hawkes.assets.lock.json carries the same treatment for it. Decodes every treated recording in the page and checks it has next to nothing above 4 kHz (at least 6 dB less than clean voices, none within 14 dB of its total) and that treated lines are within 3.5 dB RMS of clean ones. Then for each treatment plays one scene with such a line, entered by a real press from a seeded run at its parent (setup shortcut, event seeded-run), and checks the voice element plays that line's own recording. Options: {\"story\":\"<id>\"}.",
    },
    {
      id: "night-shift-audio",
      title: "Night Shift's voices and sounds: every line and cue has a recording, each speaker keeps their voice, loudness is even, the bed sits under the voice, the opening is heard, the bed carries from scene to scene without silence and its loop wraps",
      seconds: 90,
      tags: ["full"],
      description: "Opens the Night Shift draft by its link under its own Tap to play. Checks every line of every scene has a recording (and every bed and effect a scene uses has its file), that each recording loads and decodes and is not longer than the player waits for (dur + 4 s), that a few lines of each speaker are within 4 dB of each other (RMS, decoded in the page), that every ambience bed sits at least 12 dB under the voice and every effect at least 3 dB under it. Then it plays the opening scene from a new run without skipping: each of the first three lines must play its own recording (the voice element's source is the line's file, not paused or muted, its time advancing) over the scene's ambience bed (looped, playing). Logs the loudness of each speaker, bed and effect. Then, for each ambience bed the story has, it presses the real choice that leads into a scene with that bed (from a seeded run at the parent: setup shortcut, event seeded-run) and times how long the bed is not audible from the press to the first line (never silent between scenes; a warning over 0.5 s, a bug over 1.5 s), checks the same bed carries on without restarting, and seeks the bed to its last half second to see the loop wrap and keep playing. Options: {\"at\":\"between\"} runs only that last part (about 40 s).",
    },
    { id: "branches", title: "Every story's player (drafts too): every scene, every choice, every video (The Water Road's cuts: 9:16, with sound), the inventory's counts, the percent explored rising scene by scene to 100% only at the last, the Tree locked until found (no Back: after each choice it walks again from the start, a new run). Night Shift: every one of its 228 scenes is entered by a real press from a seeded run at its parent (setup shortcut, event seeded-run), the endings and scenes with gated choices heard to the end", seconds: 330, tags: ["full"] },
    { id: "pages", title: "Every story's branch pages (one folder per branch): videos, choice links, the inventory's counts; a console story's wall, lines, marked state and open or locked choices (Night Shift: all 228 pages read, every line's recording asked for; the start and three endings also opened in the frame)", seconds: 100, tags: ["full"] },
    {
      id: "console",
      title: "Console stories (Night Shift): the camera wall, voiced lines in order, gated choices and flags, a saved run that survives a reload, the shift log, Settings on the audio, three screen sizes",
      seconds: 200,
      tags: ["full"],
      starts: ["real", "demo"],
      description: "Two legs: the demo's, then the real Night Shift's (see the end of this text). Opens the console draft (night-shift-demo, listed: false) by its link under its own Tap to play (under a runner with a real mouse it waits for a real page.mouse.click first, then taps itself; either way it records whether the press was trusted and that audio is running). Subtitles are on by default and the lines play one after the other in the order of the data; CC turns the subtitles off and on; Replay line plays the last line again. The room shows one big screen on the scene's camera (its description for a screen reader) and a strip with a feed per camera (6 to 9) in the state the scene says; pressing a tile or the screen does nothing (nobody but the people in the room switches it). Choices gated by a flag are not on the page without it and are with it, and a choice sets a flag a later scene reads. The build's state explorer (js/console-rules.js) gives every way to every scene and ending and every different set of open choices: the bot plays all of them with real presses from a new run and checks, at each scene, the flags, meters, history, shift log, wall, clock and choices against what the data says, the percent explored, and the ending. The Log button opens the shift log at the start, in the middle and at an ending: it lists exactly what was done and seen, a redacted line per way not taken, nothing in it can be pressed, and it gives away no choice that was not taken. Settings Sound off / on and Volume apply to the voice, ambience and effects elements. Reloading mid-scene (a new page load of the story's link in a frame) returns to the same scene with the same flags, meters, log and the lines already heard. At 390x844, 360x640 and 844x390 (a frame of that size) the wall, subtitles, line buttons, choices and the log fit with no sideways scroll and tap targets of 44px or more. Then the real Night Shift (night-shift, 241 scenes, nine cameras), every position past its start a seeded run (setup shortcut, event seeded-run) and then real presses: the big screen and the strip of nine cameras (the screen on the scene's camera, a press on the strip or the screen changes nothing); a gated choice (a scene reached two ways, the choice on the page with one and not the other, and pressed), with the flag that opens it and the choice that set it; Settings Sound off, Sound on and Volume 40% on the voice, ambience, effects and sting elements, opened in the middle of a line, in the first scene and the next; a reload at the 40th scene (mid-scene and with its lines heard) and with the Log open at 70 entries (the Log read again after the reload); at 360x640 the 70-entry Log opens, scrolls from its first row to its foot inside itself and closes; and okafor-reads-solid (12 choices in the data) and tour3-test (8), in the state that opens the most of them, at 390x844, 360x640 and 844x390: every open choice reachable (scrolling inside the words column is fine), 44px or more, nothing sideways, and the same screen filled to the scene's 12 or 8 buttons with copies (the story never opens more than four at once). Every ending screen must fit with no scroll at any size (the fit event names what scrolls). Frame time is logged per scene (frame-time events for scenes with a dip over 50 ms, metrics frameWorstMs, framesOver50 and slowestScenes) and the state explorer runs before anything plays (event state-explorer). Options: {\"at\":\"real\"} plays only the real story's leg, {\"at\":\"demo\"} only the demo's. Last, All stories brings the landing page back and the audio goes.",
    },
    {
      id: "room",
      title: "Night Shift's control room: silhouettes of the trainee and Dee facing one big screen, acting what the story says, the screen switching with a CRT flash, people (not silhouettes) out of the room, a layout that holds on phone, tablet and desktop",
      seconds: 420,
      tags: ["full"],
      description: "Opens Night Shift (a real press on its card, Tap to play) and checks the first scene is the security room, not a grid: the door to the lobby, wall clock (hands at the scene's time), fire panel, access terminal, radio charger, coffee machine, log tablet, desk phone, shelf and two chairs, with the trainee, Dee and Mr. Okafor as black silhouettes in front of one big screen inside the room; the nine cameras are a numbered strip under it and a press on a tile or on the screen does nothing (no buttons, no Shrink, the same camera after). A reduced-motion rule tones the flash and the motion down. Then, from a seeded run (setup shortcut, event seeded-run) and a real press into each of three scenes with a new focus, the screen changes camera with a CRT flash of about 200-300 ms on the camera the scene names, a person is seen switching it, and a line that names a camera (a tile read out, 'tile four') switches to it. Then ten story moments, each entered by a real press: the trainee sits when told to sit, Mr. Okafor leaves through the door at handover, Terrell comes in, the night line rings and is answered, something is written in the log, the lights flicker and coffee spills, Dee taps the screen, Dee stands up and gets angry, Dee takes the keys and leaves, the silence button on the fire panel is pressed: the room records exactly the acts the scene's data holds (act, place and feed fields in story/night-shift.json, in line order). Three of them are watched in motion with nothing skipped (the door opens, the phone rings then the answer, Dee stands then is angry). Out of the room (the tour: stairwell, dock, roof; the lobby desk; the endings by daylight) the people are drawn in colour in the place they are in, the screen a small inset and the room's picture gone; back in the room (visitor-desk) they are silhouettes again. Last, in a frame at 390x844, 360x640, 844x390, 820x1180 and 1280x800: the room scales to the width (5:3), the big screen sits inside it, the strip fits, nothing overlaps (the console fit checks) and no sideways scroll, with a line playing and with the choices up; at 390x844 the room picture is at least 50% taller than the transcript panel, the transcript below it, and the speaking figure's rim is visible. Then the characters (J, 2026-11-11): the first ten scenes at the page's size, each entered by a real press from a seeded run: poses per person (layer + mood from the `perform` word-to-pose map `performPoses` in the data; metrics poseCountDee, poseCountOkafor: Dee 3+, Okafor 2+), the speaker-marked check on every line (the speaking figure's rim, drawn on a canvas with its CSS filter, is brighter than every other figure's; metric speakerMarkedLines), no figure with an identical transform for over 5 s while a line plays (idle breathing), and every pose cross-fade measured from the transition itself (150-250 ms, poseFadeMs). Options: {\"story\":\"<id>\"}.",
    },
    {
      id: "night-shift",
      title: "Night Shift, the whole night: at least 8 endings, no dead ends, the shortest way through 30 minutes of audio and a typical one about 45, Pierce Hawkes once and briefly, nothing about B3, the vat or the creature",
      seconds: 180,
      tags: ["full"],
      starts: ["numbers", "pace", "four-hours"],
      description: "Opens Night Shift (night-shift) by its link under its own Tap to play. From the build's state explorer (js/console-rules.js) it checks every scene and ending can be reached, no state is left without a usable choice, and there are at least 8 distinct endings, each with its own way (logged one by one). Chapter ends on the shortest way are at most 12 minutes of audio apart (events chapter-gap). Options: {\"at\":\"pace\"} (~90 s) checks the first choice within 30 s of Tap to play at 1280x720 and 390x844 (listening, no Skip; choices ≥48 px), ink within 2 s after a trust choice (event choice-ink), a chapter card then Continue landing at that chapter; {\"at\":\"numbers\"} runs only the data's checks (about 10 s); {\"at\":\"four-hours\"} (any scene on the way through every layer) opens a seeded run (named setup shortcut, event seeded-run) at that scene and plays the rest of the way, to \"Someone to leave it to\", with real presses, then the last six choices to \"The wedge\" (about 3 minutes). It works out how long every way through is to listen to (each line is its words at 150 a minute plus a pause, the player's own timer): the shortest must be 30 minutes or more, the average (every open choice equally likely) about 45 (a warning outside 40 to 50), and it logs the longest. It lists who speaks as Pierce Hawkes (once, two lines at the most, in the cameo scenes) and that no scene, line, choice or log entry mentions B3, the vat, the creature or the restricted work. Then it plays four ways with real presses from a new run each time (Skip line moves the lines along; every scene is checked against the data: flags, meters, history, shift log, wall, clock, choices): the shortest way, the longest way, and the ways to the endings Someone to leave it to and The wedge. Each ends at an ending, with the run saved as ended and the minutes of audio it held logged.",
    },
    {
      id: "voice",
      title: "The writing pass: each story has a voice guide with a style note of 5 rules, every node still has its choices, and the diff summary lists the changed nodes per story",
      seconds: 15,
      tags: ["full"],
      description: "Waits for the landing page's splash, then reads docs/<id>/voice.md for every listed story (a \"Style note: 5 rules\" with exactly five numbered rules, plus Tone, Pacing and Choice design), checks from the story data that every choice leads to a node that exists, and reads docs/voice-diff.md (made by tools/voice-diff.mjs): each story has its changed-nodes count and the nodes named. No story is played.",
    },
    {
      id: "night-shift-gaps",
      title: "Night Shift's gaps audit: the story opened with real presses, then story/night-shift-gaps.md checked: groups a to f numbered, its counts and the shortest and typical minutes against the data, the output of npm run story -- --check and the console, stories and sound playtests",
      seconds: 10,
      tags: ["full"],
      starts: ["gaps"],
      description: "Waits for the landing page's splash, opens Night Shift (its card, a real press, then its Tap to play), presses Settings and Done, then reads story/night-shift-gaps.md: each group (a) audio, (b) art, (c) script quality, (d) engine and mobile, (e) landing, (f) docs has numbered gaps; the scenes, lines and endings it states are the data's; the shortest and typical paths in minutes match the clock (words at 150 a minute or the recording, plus the pause); the appendix holds the real output of npm run story -- --check and a report (or, as a warning, an honest 'not run') for the console, stories and sound playtests. Options: {\"at\":\"gaps\"} reads the file without opening the story.",
    },
    {
      id: "night-shift-signoff",
      title: "Night Shift sign-off: every ending played to the end with real presses at the desktop size and at 390x844, 360x640 and 844x390, with its minutes of audio, the ending shown and nothing off screen",
      seconds: 480,
      tags: ["full"],
      starts: ["last-choices"],
      description: "Opens Night Shift by its link under its own Tap to play. For each of its 12 endings it plays the shortest way with real presses (Skip line moves the lines along; every choice is a press checked against the data: the buttons on screen are exactly the choices whose conditions hold), once on the page at its own size and once in a frame at 390x844, 360x640 and 844x390. At each ending it logs the minutes of audio that way holds (from the recordings), checks the ending is shown and that nothing runs off the side, is hidden or is smaller than a 44px target. By default (and with {\"at\":\"last-choices\"}, about 8 minutes) each play starts from a seeded run (named setup shortcut, event seeded-run) 2 choices before the ending, then presses those and checks the end screen at the four sizes; {\"back\":4} makes it 4 choices. {\"at\":\"whole\"} (not offered as a start point: it runs over Studio's 45-minute stuck limit, so J or Talk asks for it by name) plays each way whole from a new run (about 50 minutes, the T4's full sign-off). Other options: {\"sizes\":\"desktop\"} for the page's own size only, {\"only\":\"end-wedge\"} for one ending.",
    },
    {
      id: "cctv-art",
      title: "Night Shift's camera wall art: every camera has a picture for every state the script uses, one look and one room per camera; every ending has an end card; the landing card has its image",
      seconds: 100,
      tags: ["full"],
      description: "Then plays real presses to scenes that show every camera state and checks each one's tile in the strip (and the big screen, for the focus) from its own picture (option {\"at\":\"wall\"} skips that). Reads Night Shift's data (draft, by its link). For each of the nine cameras it loads the picture of every state the scenes use (normal plus the changes: someone there, something off, offline) and checks they all load in one picture format, so the same room frames the same. Then every ending's end card and the landing card's image must load. Opens the story under its Tap to play and checks every tile of the wall shows its picture. Stand-in art (media/standin) counts until the real stills are made.",
    },
    {
      id: "cinema",
      title: "Cinematic player chrome: the video letterboxed to 2.39:1 on desktop, the choices showing an Up next preview while the clip plays and sliding in at the end with a visible countdown, the controls hiding after 3 s idle",
      seconds: 90,
      tags: ["full"],
      description: "Opens The Final Spark from its card (real presses, Tap to play) at the page's own size. Checks the video frame is 2.39:1 with the clip contained (desktop sizes: 900x560 and up). While the clip plays the choices show the Up next preview state (not greyed-out disabled text) and the countdown does not run yet; the clip is watched to its end, then the choices slide and fade in and a countdown (a thin bar and the seconds left) shows and runs down. Then, with no input, the bar and title controls stay for 2 s, are hidden by 3 s idle, and come back on pointer movement. A choice is pressed and the next page's choices wait for its clip again. Options: {\"story\":\"<id>\"}.",
    },
    {
      id: "phone-player",
      title: "The player on a phone: the first clip plays after one tap, a loading ring shows while a clip buffers, turned on its side the clip fills the screen and the choices stay visible",
      seconds: 90,
      tags: ["full"],
      description: "A frame at 390x844 (a phone upright) opens The Final Spark by its link. One real press on Tap to play and the first clip plays (playsinline), the Full screen button is 44px, the choices are on screen and the next clips are requested while it plays. The choices come when the clip ends; pressing one starts the next clip from nothing and the loading ring comes on (iltv:loading, from the video's loadstart/waiting/stalled events) and goes off at playing. Then the frame is turned to 844x390 (a resize and an orientationchange event): the clip keeps playing, the video fills at least 80% of the height, the choices stay on screen, no sideways scroll. Events first-clip-playing, loading-ring, landscape; metric landscapeVideoFill.",
    },
    {
      id: "phone-choices",
      title: "Unified choice cards and draining timer bar in all three stories at 390x844, 844x390 and 1280x720: Up next preview, draining Choose in N s bar with last-3-s warm pulse, default choice highlighted before playing, and Night Shift untimed by design",
      seconds: 150,
      tags: ["full"],
      description: "Frames at 390x844, 844x390 and 1280x720 open each of The Final Spark and The Water Road by its link (Tap to play pressed, the Up next preview state with soft glow and thin progress line checked while the clip plays, then active choices and the draining Choose in N s timer bar checked) and Night Shift (a seeded run at its first scene: setup shortcut, event seeded-run; choices are untimed by design with a Your move cue and no countdown bar). At 390x844 and 1280x720 in the timed stories, watches the timer enter the last 3 s (visibly pulsing warmer) and run out (highlighting the default choice for a moment before playing it). Screenshots active choices, urgent pulse, and default-choice highlight. Events waiting-choices, choice-stagger, choice-button, timer, timer-urgent-pulse, timer-default-highlight, timer-default-played, cue, phone-choices, screenshot. Options: {\"story\":\"<id>\"}, {\"at\":\"smoke\"}.",
    },
    {
      id: "phone-media",
      title: "Posters and the phone rendition: cards and clips show a poster before the video loads, a phone plays the smaller clip, the landing page's content shows within 2 s on a phone",
      seconds: 90,
      tags: ["full"],
      description: "A frame at 390x844 loads the landing page: first content within 2000 ms (metric phoneFirstContentMs), the hero's picture eager, every card with a picture that loads and the ones below the fold lazy-loaded. Then each clip story (The Final Spark, The Water Road) opens by its link: the clip has its poster (loaded) before Tap to play, the same poster is the picture behind the Tap to play prompt and the clip box's own picture (never a black box; Night Shift's prompt shows its card picture; event poster-visible), and after one real press the player plays the clip's smaller rendition (<dir>/sm/<name>.mp4, 9:16) and has not fetched the full clip; a 1280x800 frame plays the full clip. Events first-content, card-picture, poster, rendition; metrics phoneClipKB_<story>, postersShown, phoneRenditions. Options: {\"story\":\"<id>\"}.",
    },
    {
      id: "media",
      title: "Every listed story shows its video and plays with sound under iPhone Safari's rules, on a phone and a desktop: after Tap to play and after each of three choices",
      seconds: 150,
      tags: ["full"],
      description: "Each listed story opens by its link in a frame at 390x844 and 1280x800 with ?ios-rules=1 (js/hawkes-sound.js: a video or audio may start with sound only if a press started it; any other start is refused, as iPhone Safari does, and listed in iosMediaRefusals). After Tap to play and after each of three choices (real presses): a clip story's clip is playing, unmuted, with decoded sound; a console story's voice line plays unmuted, with its ambience. Tap to play coming back, a refused play, no video or a silent scene is a bug naming the story, size and scene. npm run test:media checks every scene's files (picture and sound tracks) without a browser. Events media-sound, media-refusals; metrics mediaRefusals-<story>-<size>, mediaChecks. Options: {\"story\":\"<id>\"}, {\"sizes\":\"phone\"|\"desktop\"}.",
    },
    {
      id: "language",
      title: "The Final Spark's language picker at 390px, a switch mid-story that keeps the scene and puts the screen's text in the picked language, and every blog title in one language",
      seconds: 90,
      tags: ["full"],
      description: "A frame at 390x844 opens The Final Spark by its link (Tap to play pressed): the language picker is shown, on screen, 44px tall and hit-tested. One real choice in, the picker is set to English (a native select can't be opened by a press, so the bot sets it and fires change): the scene and depth are the same, the clip was not reloaded, and the story text, question, choices, timer, buttons and the Tree show the English only; the pick is saved. Then the home page's blog list in a 390px frame: each post's title holds one language (one script, its own text has no English beside it). Events language-picker, language-switched, blog-title; metric blogTitles. Options: {\"story\":\"<id>\"}.",
    },
    { id: "crossfade", title: "Scene changes cross-fade with audio fading and the clip already moving", seconds: 40, tags: ["full", "smoke"] },
    {
      id: "continue-recap",
      title: "Continue opens with a 3 s Previously recap of the last scene (poster, title, one choice line), skippable, then the left-off scene with its choices — all three stories at desktop, 390x844, 844x390 and 1280x720",
      seconds: 200,
      tags: ["full"],
      description: "From a fresh browser: each listed story is opened, one real choice is made (Night Shift's chair choice may show the ink line first), then All stories. Pressing Continue (hero or card) shows a Previously overlay with the last scene's poster (push-in), the story title and one short line naming that choice; a tap skips it (checked on the first story) or it ends after ~3 s. After the recap the viewer is at the same scene they left, with its choices ready (Night Shift's room is already under the overlay so a short landscape never fades to a blank body). Chapter-resume after a Night Shift chapter card is covered by night-shift {\"at\":\"pace\"}. The same Continue path is checked in frames at 390x844, 844x390 and 1280x720. Screenshot events while the overlay is up and after it lands. Also run as smoke's last leg with {\"at\":\"smoke\"} (always skip, same sizes). Events recap-armed, previously, recap-landed, screenshot. Options: {\"story\":\"<id>\"}, {\"at\":\"smoke\"}.",
    },
    { id: "blog", title: "Every blog post opens, with its images and links", seconds: 15, tags: ["full"] },
    {
      id: "credits",
      title: "Powered by HAWKES GEN on every kind of page, Hawkes Biomedical on the home page",
      seconds: 45,
      tags: ["full"],
      description: "Waits for the landing page's title splash to fade, scrolls to the home page (landing page) footer and checks \"Powered by HAWKES GEN\" links to https://hawkesgen.ai and the parent company link goes to https://hawkesbiomedical.com (visible, hit-tested, not covered), and the mark again with The Final Spark open in the player. Then opens a blog post, the start's branch page and What's new and checks the mark in each footer, and that nothing lies over the story video (the mark never overlaps it). Before tapping The Final Spark's Tap to play it turns Sound off with the prompt's own Settings button: the prompt's line must then say \"Sound off.\", and so must the branch page's prompt, which loads with Sound off saved. The viewer's own hawkes.sound is put back. Then Night Shift, opened from its card: its Tap to play prompt says what the saved Sound setting says, and the footer mark is visible and not covered under the console player.",
    },
    {
      id: "sound",
      title: "Tap to play unlocks sound, Settings (Sound, Volume) that survive a reload",
      seconds: 60,
      tags: ["full", "menus"],
      description: "Waits for the landing page's title splash to fade (no prompt there), opens The Final Spark from its card: its Tap to play prompt shows and is tapped with a pointer press on the spot (hit-tested, so a covered prompt fails); the AudioContext runs and the story's video plays unmuted by itself, and so does the next scene's after a choice. Opens Settings from the header, turns Sound off and Volume to 40% (saved in hawkes.sound), reloads the page (the run carries on through ?playtest=sound), checks the page opens straight back into The Final Spark (?story=final-spark) and the prompt is back with its title, the choice was kept and the video plays muted, turns Sound on, then opens the start's branch page: its prompt, then its video with sound at 40%. The viewer's own hawkes.sound and progress are put back. The Settings then follow Night Shift (opened from its card): the voice, ambience and effects elements are muted or not and take the volume, in the first scene and the next.",
    },
    {
      id: "audio-buses",
      title: "Audio module: first-tap unlock, duck under a clip, header sound toggle (iltv.sound) at 390x844 and 1280x720",
      seconds: 90,
      tags: ["full", "menus"],
      starts: ["smoke"],
      description: "Opens The Final Spark (Tap to play): js/audio.js unlocks its Web Audio context on that first tap (event audio-unlock; nothing from the buses before it). While the unmuted clip plays, ambience and music bus gains duck (audio-duck), then lift when the clip pauses — driven by the video's play/pause/volumechange events, no polling. The header sound toggle mutes everything including the clip, saves localStorage iltv.sound, and stays in step with hawkes.sound / Tap for sound. Checked on the page and in frames at 390x844 and 1280x720. Options: {\"at\":\"smoke\"} is the short leg smoke also runs.",
    },
    {
      id: "audio-ui",
      title: "Audio: choice-appear, tap, timer ticks, ending sting and ambient beds in The Final Spark and The Water Road at 390x844, and Sound off after a reload",
      seconds: 150,
      tags: ["full", "menus"],
      starts: ["smoke"],
      description: "In a 390x844 frame per video story: Tap to play, the first clip's start (metric firstClipMs.<story>) and the ambient bed that starts only after it (event bed, never before the clip), a bed on every page of the way to the nearest ending and never two at once (bedsAtOnce), the choices' appear sound, three timer ticks in the last 3 seconds, one tap sound per press on a choice, the ending's sting, the bed stopping on the story list; a missing sound is a problem. Then Sound off saved and the frame reloaded: zero audio events through a tap on a choice. Options: {\"story\":\"<id>\"}.",
    },
    {
      id: "spark-depth",
      title: "The Final Spark: a match count that runs down, a rat that remembers, forks that diverge, four named endings",
      seconds: 240,
      tags: ["full", "phone"],
      description: "The Final Spark opened from its card (real taps; touch input on a phone): the inventory bar shows the flashlight and one number, the matches left (20 at the start), which drops by one on every new page (checked against the data at every page); at 390x844 the count is fully on screen beside the choices, nothing covers it, and every choice is at least 44px tall and reachable without scrolling; new pages keep their story to about two short lines. The rat fork (feed it, follow it, step past it) has three buttons; the fog page then reads differently for fed, followed and ignored (event rat-variants; the rat flag is in finalSpark.flags()). Breaking the gate and picking the lock open different pages (breakGate then gotKey, pickLock then readTag) and the key scene reads differently (event gate-fork). The last fork (the lamps go out or the threads pull) is reached twice from seeded runs (setup shortcut, event seeded-run): with matches to spare it offers Hold up a match; at 2 or fewer matches that choice is gone and, depending on the rat and on whether you learned who you were, Whistle for the rat, Say who you were or Put out the last match appear (event low-match-fork). Four endings are reached with real presses and named differently: THE DARK TOWN, THE FLAME HELD, THE RAT'S LIGHT, THE LAMPLIGHTER (metric endingsReached). Events matches, rat-fork, rat-variants, gate-fork, low-match-fork, ending, phone-fit, story-words."
    },
    {
      id: "analytics",
      title: "Hawkes Analytics: the events going out on a way through The Final Spark (screen, video, choice, back, Try again, the ending), the thumbs question after going back twice and the stars question at the ending",
      seconds: 180,
      tags: ["full", "analytics"],
      description: "Checks the analytics SDK is loaded with product imaginelivetv and a build (version, commit, date) and, on beta, env beta. Puts every event the page sends on the timeline as its batch goes out (the SDK's debug mode, ?hawkes-analytics-debug=1, on in a bot's tab). Opens The Final Spark from its card (fresh progress), then by tapping choices: Go back, the dead end's go back (back up the tree), the sludge (a death), Try again: the thumbs question (\"Retracing your steps…\") comes up and is answered thumbs up. Then the shortest way to the ending, a page at a time (each video plays, the next choice skips it): at Destroy the town the stars question \"How was this ending?\" comes up above the inventory bar and is answered 5 stars. Then All stories, and a check that screen, video (play, skip with seconds watched), choice (node, option, path in context), run_start, death, back, restart, run_end with the ending, both feedback answers and game_ready went out. The viewer's progress and question history are put back. Then Night Shift (a console story, no video): from its card, the big screen showing a camera (feature feed), the shift log opened (feature log), one real choice, and the last two choices of its shortest way to an ending after a seeded run (setup shortcut): story_open, screen, level_start, run_start, choice, run_end with the ending and the stars question answered went out, and no video or back event.",
    },
  ],
  isReady: () => document.readyState === "complete" && !!stories() && !!soundOf() && !!audioOf(),
  async start(id, options, t) {
    const endQuiet = id === "analytics" ? () => {} : quietAnalytics();
    try {
      probeStart();
      probe.all = [];
      probe.total = { n: 0, worst: 0, over: 0 };
      if (!t.framed) {
        t.framed = true;
        const was = t.scene;
        t.scene = (name) => {
          probeFlush(t, name);
          was(name);
        };
      }
      probeFlush(t, "start");
      t.scene(`${id}: starting`); // the first scene, so the runner's line never reads empty
      t.progress(0.005);
      if (NEEDS_STATES.includes(id)) await consoleWarm(t);
      t.scene(`${id}: setup done`);
      if (id === "smoke") await smoke(options, t);
      else if (id === "stories") await storiesRun(options, t);
      else if (id === "branches") await branches(options, t);
      else if (id === "pages") await pages(options, t);
      else if (id === "console") await consoleRun(options, t);
      else if (id === "night-shift") await nightShiftRun(options, t);
      else if (id === "progress") await progressRun(options, t);
      else if (id === "decisive-choice") await decisiveRun(options, t);
      else if (id === "rewind") await rewindRun(options, t);
      else if (id === "spark-depth") await sparkDepthRun(options, t);
      else if (id === "water-gates") await waterGatesRun(options, t);
      else if (id === "trust-fall") await trustFallRun(options, t);
      else if (id === "trust-fall-endings") await trustFallEndingsRun(options, t);
      else if (id === "living-home") await livingHomeRun(options, t);
      else if (id === "front-door") await frontDoorRun(options, t);
      else if (id === "night-shift-card") await nightCardRun(options, t);
      else if (id === "night-shift-audio") await nightAudioRun(options, t);
      else if (id === "night-shift-treatment") await nightTreatmentRun(options, t);
      else if (id === "night-shift-gaps") await nightGapsRun(options, t);
      else if (id === "voice") await voiceRun(options, t);
      else if (id === "night-shift-signoff") await nightSignoffRun(options, t);
      else if (id === "cctv-art") await cctvArt(options, t);
      else if (id === "room") await nightRoomRun(options, t);
      else if (id === "crossfade") await crossfade(options, t);
      else if (id === "continue-recap") await continueRecap(options, t);
      else if (id === "blog") await blog(options, t);
      else if (id === "sound") await sound(options, t);
      else if (id === "audio-buses") await audioBusesRun(options, t);
      else if (id === "audio-ui") await audioUiRun(options, t);
      else if (id === "credits") await credits(options, t);
      else if (id === "analytics") await analyticsRun(options, t);
      else if (id === "endings") await endingsRun(options, t);
      else if (id === "endings-gallery") await endingsGalleryRun(options, t);
      else if (id === "cinema") await cinemaRun(options, t);
      else if (id === "phone-player") await phonePlayerRun(options, t);
      else if (id === "phone-media") await phoneMediaRun(options, t);
      else if (id === "media") await mediaRun(options, t);
      else if (id === "phone-choices") await phoneChoicesRun(options, t);
      else if (id === "language") await languageRun(options, t);
    } finally {
      endQuiet();
      probeStop(t);
      stopVideos();
      closeFrame();
      closeViewFrame();
      restoreProgress();
    }
  },
  stop() {
    stopVideos();
    closeFrame();
    closeViewFrame();
    restoreProgress();
  },
});
