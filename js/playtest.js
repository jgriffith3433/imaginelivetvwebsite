/* Hawkes playtest hooks (contract v1, spec: C:\Projects\hawkesstudio\docs\playtest.md).
   Nothing here runs until the runner calls window.hawkesPlaytest.start() or the URL has
   ?playtest=<id>. Everything is driven from the home page, so a run never has to survive a
   page load: the player (js/game.js) lives on this page, and the branch pages and blog posts
   open in a full-screen frame laid over it while a run is going, then the frame is removed.
   The bot clicks the same buttons and links a viewer does. */
import { installPlaytest } from "./hawkes-playtest.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);

// The branch pages, one folder per scene, from js/story-data.js (built from story/final-spark.json by
// tools/build-story.mjs, the same data the player uses). The crawl starts at the start scene's page.
const story = () => window.FINAL_SPARK || { start: "start", scenes: {} };
const folderOf = (id) => `/${story().scenes[id].folder}/`;
const branchRoots = () => [folderOf(story().start)];
const branchFolders = () => Object.keys(story().scenes).map(folderOf);
// What Decision tree.txt promises for the player's opening scenes (checked by hand, not from the data).
const TREE = {
  start: { choices: 2, to: ["deadEnd", "sewerWater"] },
  deadEnd: { choices: 2, to: ["direction", "sludge"] },
  direction: { choices: 2, to: ["deadEnd", "sewerWater"] },
  sludge: { state: "dead", to: ["start"] },
  sewerWater: { choices: 2 },
};

const spark = () => window.finalSpark;
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

/** The prompt covers the whole screen, then a tap on it makes it go. Every scenario starts here, like a viewer. */
async function passPrompt(t, doc = document, where = "home") {
  const sound = soundOf(doc);
  if (!sound) {
    t.problem("bug", `${where}: no sound setup (js/hawkes-sound.js isn't loaded)`);
    return false;
  }
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

/* ---------------- the player on the home page ---------------- */

const COOKIE = "finalSparkProgress";
let savedCookie = null;
function rememberProgress() {
  savedCookie = document.cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(COOKIE + "=")) ?? "";
}
function restoreProgress() {
  if (savedCookie == null) return;
  document.cookie = savedCookie ? `${savedCookie}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax` : `${COOKIE}=; Max-Age=0; Path=/`;
  savedCookie = null;
}

/** Back to the tunnel mouth the way a viewer would: the Tree tab, then the first node. */
async function toStart(t) {
  $("tab-play").click();
  if (sceneId() === "start" && spark().depth() === 0) return;
  $("tab-tree").click();
  await sleep(200);
  const node = document.querySelector('#spark-tree .tree-node[data-scene="start"]');
  if (!node) throw new Error("the Tree view has no start node");
  node.click();
  await sleep(200);
  if (sceneId() !== "start") throw new Error("the Tree's start node didn't open the start");
  t.event("reset", "start (via Tree)");
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
  if (!spark()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  document.querySelector("#spark").scrollIntoView({ block: "start" });
  await toStart(t);
  t.scene("The sewer");
  t.progress(0.2);
  const ok = await checkVideo(t, document.querySelector("#spark-video video"), "start", 3, { autoplay: true });
  t.progress(0.6);
  const buttons = choiceButtons();
  if (!buttons.length || buttons.some((b) => b.offsetParent === null)) t.problem("bug", "start: no visible choices");
  t.metric("choices", buttons.length);
  t.note(`${buttons.length} choices: ${buttons.map(enText).join(" / ")}`);
  if (ok && buttons.length) {
    // One step in and back out again.
    const storyBefore = $("spark-story").textContent;
    buttons[0].click();
    await sleep(300);
    t.event("choice", `${enText(buttons[0])} -> ${sceneId()}`);
    if (sceneId() === "start") t.problem("bug", `start: "${enText(buttons[0])}" goes nowhere`);
    else if ($("spark-story").textContent === storyBefore) t.problem("bug", `${sceneId()}: the page text didn't change after "${enText(buttons[0])}"`);
    else await checkVideo(t, document.querySelector("#spark-video video"), sceneId(), 1, { autoplay: true });
    $("spark-back").click();
    await sleep(300);
    if (sceneId() !== "start") t.problem("bug", "Back didn't return to the start");
    else await checkVideo(t, document.querySelector("#spark-video video"), "start (after Back)", 1, { autoplay: true });
  }
  t.progress(1);
}

async function branches(options, t) {
  rememberProgress();
  t.scene("The Final Spark");
  if (!spark()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  document.querySelector("#spark").scrollIntoView({ block: "start" });
  await toStart(t);
  const all = spark().scenes();
  const seen = new Map(); // id -> { state, choices, to: [] }
  t.metric("scenes", all.length);

  async function visit(id, path) {
    const root = $("spark");
    const info = { state: root.dataset.state, choices: choiceButtons().map(enText), to: [] };
    seen.set(id, info);
    t.scene(id);
    t.note(path.join(" > "));
    t.event("scene", `${id} (${info.state}, ${info.choices.length} choices)`);
    t.progress(seen.size / all.length);
    await checkVideo(t, document.querySelector("#spark-video video"), id, 2, { autoplay: true });
    if (!info.choices.length) {
      if (info.state === "soon") t.event("ending", `${id}: ${enText($("spark-ending"))}`);
      else t.problem("bug", `${id}: dead end with no choices and no ending`);
    }
    if (info.state === "soon" && $("spark-ending").hidden) t.problem("bug", `${id}: the ending text is hidden`);

    for (let i = 0; i < info.choices.length; i++) {
      const button = choiceButtons()[i];
      const label = enText(button);
      button.click();
      await sleep(150);
      const next = sceneId();
      if (next === id) {
        t.problem("bug", `${id}: choice "${label}" goes nowhere`);
        continue;
      }
      info.to.push(next);
      t.add("choicesClicked");
      if (!seen.has(next)) await visit(next, [...path, label]);
      $("spark-back").click();
      await sleep(150);
      if (sceneId() !== id) {
        t.problem("bug", `Back from ${next} went to ${sceneId()}, not ${id}`);
        await toStart(t);
        return;
      }
      t.scene(id);
    }
  }
  await visit("start", ["start"]);
  stopVideos();

  // Every scene is reachable, and the opening matches Decision tree.txt.
  all.filter((id) => !seen.has(id)).forEach((id) => t.problem("bug", `${id}: no choice leads here (unreachable)`));
  Object.entries(TREE).forEach(([id, want]) => {
    const got = seen.get(id);
    if (!got) return t.problem("bug", `Decision tree: ${id} is missing`);
    if (want.choices != null && got.choices.length !== want.choices) {
      t.problem("bug", `Decision tree: ${id} should have ${want.choices} choices, has ${got.choices.length}`);
    }
    if (want.state && got.state !== want.state) t.problem("bug", `Decision tree: ${id} should be "${want.state}", is "${got.state}"`);
    (want.to || []).forEach((to) => !got.to.includes(to) && t.problem("bug", `Decision tree: ${id} should lead to ${to}`));
  });
  t.metric("scenesVisited", seen.size);
  t.metric("endings", [...seen.values()].filter((s) => s.state === "soon").length);
  t.metric("deaths", [...seen.values()].filter((s) => s.state === "dead").length);
  await toStart(t);
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
  const parent = new Map(branchRoots().map((p) => [p, null]));
  const queue = branchRoots();
  const done = new Set();
  while (queue.length) {
    const path = queue.shift();
    if (done.has(path)) continue;
    done.add(path);
    t.scene(path);
    t.progress(done.size / branchFolders().length);
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
    await checkVideo(t, doc.querySelector("video"), path, 2, { autoplay: true });
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
  branchFolders().filter((p) => !done.has(p)).forEach((p) => t.problem("warning", `${p}: no choice links here (orphan page)`));
  t.metric("pages", done.size);
  closeFrame();
  t.progress(1);
}

async function blog(options, t) {
  t.scene("Blog");
  await passPrompt(t); // like a viewer: the home page's Tap to play goes first, so no splash is left behind the post frame
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
  for (const v of doc.querySelectorAll("video")) {
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
  // Sound off from the prompt's own Settings: its line must say so, and so must the next page's prompt,
  // which loads with Sound off already saved.
  if (soundOf().prompt()) {
    t.scene("Tap to play");
    await sleep(800);
    await gateSound(t, document, false, "home");
    t.scene("Tap to play (Sound off)");
    checkNote(t, document, "home, after Sound off");
    await sleep(1500);
  }
  t.scene("Home footer");
  await passPrompt(t);
  await checkMark(t, document, "home");
  await checkLink(t, document, (a) => /hawkes biomedical/i.test(a.textContent), PARENT_URL, "Hawkes Biomedical", "home");
  await sleep(1500); // the footer stays on screen for the footage
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
    t.scene("Tap to play");
    if (!soundOf().prompt()) t.problem("bug", "no Tap to play prompt when the page loads");
    await sleep(1200);
    const firstVideo = document.querySelector("#spark-video video");
    if (firstVideo && !firstVideo.paused) t.problem("bug", "the video plays behind the prompt, before the tap");
    await passPrompt(t);
    const st = soundOf().state();
    if (!st.unlocked) t.problem("bug", "the tap didn't unlock sound");
    if (st.audio !== "running") t.problem("bug", `the AudioContext is "${st.audio}" after the tap, not running`);
    t.scene("The Final Spark (sound on)");
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
      await tapAt(t, $("spark-back"), "Back");
      await sleep(300);
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
    await sleep(1000);
    const back = soundOf().settings();
    if (back.on !== false || !near(back.music, 0.4)) t.problem("bug", `the setting didn't survive the reload: ${JSON.stringify(back)}`);
    else t.event("setting-survived-reload", JSON.stringify(back));
    await passPrompt(t, document, "home, after the reload");
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

installPlaytest({
  product: "imaginelivetv",
  scenarios: [
    { id: "smoke", title: "Home, the story's first video plays, a choice appears, one step in and back", seconds: 20, tags: ["smoke"] },
    { id: "branches", title: "The Final Spark player: every scene, every choice, every video", seconds: 150, tags: ["full"] },
    { id: "pages", title: "The branch pages (one folder per branch): videos and choice links", seconds: 60, tags: ["full"] },
    { id: "blog", title: "Every blog post opens, with its images and links", seconds: 40, tags: ["full"] },
    {
      id: "credits",
      title: "Powered by HAWKES GEN on every kind of page, Hawkes Biomedical on the home page",
      seconds: 30,
      tags: ["full"],
      description: "Taps Tap to play, scrolls to the home page footer and checks \"Powered by HAWKES GEN\" links to https://hawkesgen.com and the parent company link goes to https://hawkesbiomedical.com (visible, hit-tested, not covered). Then opens a blog post, the start's branch page and What's new and checks the mark in each footer, and that nothing lies over the story video (the mark never overlaps it). Before the first tap it turns Sound off with the prompt's own Settings button: the prompt's line must then say \"Sound off.\", and so must the branch page's prompt, which loads with Sound off saved. The viewer's own hawkes.sound is put back.",
    },
    {
      id: "sound",
      title: "Tap to play unlocks sound, Settings (Sound, Volume) that survive a reload",
      seconds: 45,
      tags: ["full", "menus"],
      description: "Shows the Tap to play prompt and taps it with a pointer press on the spot (hit-tested, so a covered prompt fails); the AudioContext runs and the video plays unmuted by itself, and so does the next scene's after a choice. Opens Settings from the header, turns Sound off and Volume to 40% (saved in hawkes.sound), reloads the page (the run carries on through ?playtest=sound), checks the prompt is back, the choice was kept and the video plays muted, turns Sound on, then opens the start's branch page: its prompt, then its video with sound at 40%. The viewer's own hawkes.sound and progress are put back.",
    },
  ],
  isReady: () => document.readyState === "complete" && !!spark() && !!soundOf(),
  async start(id, options, t) {
    try {
      if (id === "smoke") await smoke(options, t);
      else if (id === "branches") await branches(options, t);
      else if (id === "pages") await pages(options, t);
      else if (id === "blog") await blog(options, t);
      else if (id === "sound") await sound(options, t);
      else if (id === "credits") await credits(options, t);
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
