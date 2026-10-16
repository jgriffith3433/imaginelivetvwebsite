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

/** The video loads (metadata and a frame), then plays for `seconds`. Returns true when it did. */
async function checkVideo(t, video, where, seconds = 2) {
  if (!video) {
    t.problem("bug", `${where}: no video`);
    return false;
  }
  const src = decodeURI(new URL(video.currentSrc || video.src, location.href).pathname);
  const t0 = performance.now();
  const loaded = await waitFor(() => video.error || (video.readyState >= 2 && isFinite(video.duration) && video.duration > 0), 20000);
  if (video.error || !loaded) {
    const why = video.error ? MEDIA_ERR[video.error.code] || `error ${video.error.code}` : `readyState ${video.readyState} after 20 s`;
    t.problem("bug", `${where}: video ${src} didn't load (${why})`);
    return false;
  }
  t.add("videosLoaded");
  t.metric("lastVideoLoadMs", Math.round(performance.now() - t0));
  t.log(`${where}: ${src} ${video.duration.toFixed(1)} s, loaded in ${Math.round(performance.now() - t0)} ms`);

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

/* ---------------- the flashlight (js/spot.js) ---------------- */

// Every scene is in another language on purpose (story/README.md); the flashlight shows the English under the words.
const TORCH_KEY = "finalSparkTorchUsed";
let savedTorch;
function rememberTorch() {
  try {
    savedTorch = localStorage.getItem(TORCH_KEY);
  } catch {}
}
function restoreTorch() {
  if (savedTorch === undefined) return;
  try {
    if (savedTorch == null) localStorage.removeItem(TORCH_KEY);
    else localStorage.setItem(TORCH_KEY, savedTorch);
  } catch {}
  if (savedTorch == null) document.querySelector(".inventory")?.classList.remove("is-known");
  savedTorch = undefined;
}

const BEAM_LIFT = 168; // spot.js holds the beam this far above the pointer
const mouse = (type, x, y, target = window) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y }));

/** Read the hint, pick up the flashlight, sweep it over the story and the question, then put it back. */
async function readWithFlashlight(t) {
  const bar = document.querySelector(".inventory");
  const slot = $("torch-slot");
  if (!bar || !slot) {
    t.problem("bug", "no flashlight in the inventory");
    return;
  }
  const hint = bar.querySelector(".inventory-hint");
  if (hint && getComputedStyle(hint).display !== "none") t.event("hint", bar.querySelector(".inventory-label").textContent.trim());
  else if (bar.classList.contains("is-known")) t.note("the flashlight hint was already dismissed in this browser");
  else t.problem("bug", "the inventory doesn't say how to read the words");

  t.scene("The flashlight");
  $("spark-story").scrollIntoView({ block: "center" });
  await sleep(300);
  const s = slot.getBoundingClientRect();
  mouse("pointerdown", s.left + s.width / 2, s.top + s.height / 2, slot);
  await sleep(400);

  for (const id of ["spark-story", "spark-question"]) {
    const el = $(id);
    const r = el.getBoundingClientRect();
    const y = r.top + Math.min(r.height / 2, 40) + BEAM_LIFT;
    // Sweep left to right over the line, the way a viewer reads with the light.
    for (let i = 0; i <= 8; i++) {
      mouse("pointermove", r.left + (r.width * i) / 8, y);
      await sleep(120);
    }
    mouse("pointermove", r.left + r.width / 2, y);
    await sleep(1500); // hold so the footage shows the English
    const lit = el.classList.contains("is-lit");
    const shown = `"${enText(el)}" (under "${(el.querySelector(".spot-src") || el).textContent.trim()}")`;
    if (lit) t.event("flashlight", `${id.replace("spark-", "")}: ${shown}`);
    else t.problem("bug", `the flashlight didn't light the ${id.replace("spark-", "")}`);
  }

  // Click to put it back (pointerdown and click, as a mouse does).
  mouse("pointerdown", 4, 4, document.body);
  document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 4, clientY: 4 }));
  await sleep(300);
  if (document.querySelector(".torch.is-docked")) t.event("flashlight", "back in the inventory");
  else t.problem("bug", "the flashlight didn't go back to the inventory");
  t.scene("The sewer");
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
  rememberTorch();
  t.scene("Home");
  if (!spark()) throw new Error("the player (js/game.js) didn't start");
  document.querySelector("#spark").scrollIntoView({ block: "start" });
  await toStart(t);
  t.scene("The sewer");
  t.progress(0.2);
  const ok = await checkVideo(t, document.querySelector("#spark-video video"), "start", 3);
  t.progress(0.4);
  await readWithFlashlight(t);
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
    else await checkVideo(t, document.querySelector("#spark-video video"), sceneId(), 1);
    $("spark-back").click();
    await sleep(300);
    if (sceneId() !== "start") t.problem("bug", "Back didn't return to the start");
  }
  t.progress(1);
}

async function branches(options, t) {
  rememberProgress();
  t.scene("The Final Spark");
  if (!spark()) throw new Error("the player (js/game.js) didn't start");
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
    await checkVideo(t, document.querySelector("#spark-video video"), id, 2);
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
    await checkVideo(t, doc.querySelector("video"), path, 2);
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

installPlaytest({
  product: "imaginelivetv",
  scenarios: [
    { id: "smoke", title: "Home, the story's first video plays, the flashlight shows the English under the words, a choice appears, one step in and back", seconds: 30, tags: ["smoke"] },
    { id: "branches", title: "The Final Spark player: every scene, every choice, every video", seconds: 150, tags: ["full"] },
    { id: "pages", title: "The branch pages (one folder per branch): videos and choice links", seconds: 60, tags: ["full"] },
    { id: "blog", title: "Every blog post opens, with its images and links", seconds: 40, tags: ["full"] },
  ],
  isReady: () => document.readyState === "complete" && !!spark(),
  async start(id, options, t) {
    try {
      if (id === "smoke") await smoke(options, t);
      else if (id === "branches") await branches(options, t);
      else if (id === "pages") await pages(options, t);
      else if (id === "blog") await blog(options, t);
    } finally {
      stopVideos();
      closeFrame();
      restoreProgress();
      restoreTorch();
    }
  },
  stop() {
    stopVideos();
    closeFrame();
    restoreProgress();
    restoreTorch();
  },
});
