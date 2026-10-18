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

// Every story saves its place in its own cookie; a run puts them all back as they were (and the URL: the run
// leaves the page on the landing page or the story it was on).
let savedCookie = null; // { name: "name=value" or "" }
function rememberProgress() {
  const jar = document.cookie.split(";").map((s) => s.trim());
  savedCookie = Object.fromEntries(allStories().map((s) => [s.cookie, jar.find((c) => c.startsWith(s.cookie + "=")) ?? ""]));
}
function restoreProgress() {
  if (savedCookie == null) return;
  for (const [name, value] of Object.entries(savedCookie)) {
    document.cookie = value ? `${value}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax` : `${name}=; Max-Age=0; Path=/`;
  }
  savedCookie = null;
}

/* ---------------- the landing page ---------------- */

const landingShown = () => !$("stories").hidden && $("spark").hidden;
const cardOf = (id) => document.querySelector(`#story-list a.story-card[data-story="${id}"]`);

/** Opens a story from its card on the landing page, a viewer's tap (hit-tested). */
async function openStory(t, id) {
  if (stories().current() === id && !$("spark").hidden) return;
  if (!landingShown()) await toLanding(t);
  const card = cardOf(id);
  if (!card) throw new Error(`the landing page has no card for ${id}`);
  card.scrollIntoView({ block: "center", behavior: "instant" });
  await sleep(200);
  await tapAt(t, card.querySelector("h2") || card, `the ${story(id).title} card`);
  await sleep(300);
  if (stories().current() !== id) throw new Error(`the ${story(id).title} card didn't open the story (open: ${stories().current()})`);
  if ($("spark").hidden) t.problem("bug", `${id}: the card opened the story but the player is hidden`);
  if (new URL(location.href).searchParams.get("story") !== id) t.problem("bug", `${id}: the address doesn't say ?story=${id} (a reload would lose the story)`);
  t.event("story-open", `${id} (${story(id).title})`);
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

/** Back to the story's first page the way a viewer would: the Tree tab, then the first node. */
async function toStart(t) {
  const start = spark().start();
  $("tab-play").click();
  if (sceneId() === start && spark().depth() === 0) return;
  $("tab-tree").click();
  await sleep(200);
  const node = document.querySelector(`#spark-tree .tree-node[data-scene="${start}"]`);
  if (!node) throw new Error("the Tree view has no start node");
  node.click();
  await sleep(200);
  if (sceneId() !== start) throw new Error("the Tree's start node didn't open the start");
  t.event("reset", `${spark().story()}: ${start} (via Tree)`);
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
  await toLanding(t);
  t.progress(1);
}

async function branches(options, t) {
  rememberProgress();
  if (!stories()) throw new Error("the player (js/game.js) didn't start");
  await passPrompt(t);
  const list = listedStories();
  const total = list.reduce((n, st) => n + Object.keys(st.scenes).length, 0);
  const sums = { scenes: 0, endings: 0, deaths: 0 };
  t.metric("stories", list.length);
  t.metric("scenes", total);
  for (const st of list) {
    t.scene(st.title);
    await openStory(t, st.id);
    await walkStory(t, st, sums, total);
    await toLanding(t);
  }
  t.metric("scenesVisited", sums.scenes);
  t.metric("endings", sums.endings);
  t.metric("deaths", sums.deaths);
  t.progress(1);
}

/** Every scene of the open story, by clicking every choice and Back. */
async function walkStory(t, st, sums, total) {
  await toStart(t);
  const all = spark().scenes();
  const seen = new Map(); // id -> { state, choices, to: [] }
  const at = (id) => (st.id === FIRST ? id : `${st.id}/${id}`);

  async function visit(id, path) {
    const root = $("spark");
    const info = { state: root.dataset.state, choices: choiceButtons().map(enText), to: [] };
    seen.set(id, info);
    t.scene(at(id));
    t.note(`${st.title}: ${path.join(" > ")}`);
    t.event("scene", `${at(id)} (${info.state}, ${info.choices.length} choices)`);
    t.progress((sums.scenes + seen.size) / total);
    const video = document.querySelector("#spark-video video");
    if (video || st.scenes[id].video) await checkVideo(t, video, at(id), 2, { autoplay: true });
    else t.problem(st.listed ? "bug" : "warning", `${at(id)}: no video yet`);
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
      if (!seen.has(next)) await visit(next, [...path, label]);
      $("spark-back").click();
      await sleep(150);
      if (sceneId() !== id) {
        t.problem("bug", `${st.title}: Back from ${next} went to ${sceneId()}, not ${id}`);
        await toStart(t);
        return;
      }
      t.scene(at(id));
    }
  }
  await visit(st.start, [st.start]);
  stopVideos();

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
  await sleep(1000); // the landing page stays on screen for the footage

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
    // A finished story (status "complete" in story/stories.json) wears the Completed ribbon; the others don't.
    const ribbon = card.querySelector(".story-card-ribbon");
    if (st.status === "complete") {
      if (!ribbon || ribbon.offsetParent === null || ribbon.textContent.trim() !== "Completed") t.problem("bug", `${st.id}: the story is complete but its card shows no Completed ribbon`);
      else {
        const r = ribbon.getBoundingClientRect();
        const c = card.getBoundingClientRect();
        if (r.right < c.right - 1 && r.top > c.top + 1) t.problem("bug", `${st.id}: the Completed ribbon isn't across the card's corner`);
        t.event("completed", st.id);
      }
    } else if (ribbon) t.problem("bug", `${st.id}: the card shows a Completed ribbon, but the story isn't complete`);

    // A tap on it opens that story's player, with its title, its first page's text, video and choices.
    await openStory(t, st.id);
    t.scene(`${st.title}: player`);
    if ($("spark-title").textContent.trim() !== st.title.toUpperCase()) t.problem("bug", `${st.id}: the player's title is "${$("spark-title").textContent}"`);
    if (!st.scenes[sceneId()]) t.problem("bug", `${st.id}: the player is on ${sceneId()}, which isn't one of its scenes`);
    await toStart(t);
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
    t.progress((i + 1) / (list.length + 1));
  }

  // A shared link opens a story straight away: /?story=<id> and the story's own /<id>/.
  for (const st of list) {
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
    }
    await sleep(800);
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
    if (video || st.listed) await checkVideo(t, video, path, 2, { autoplay: true });
    else t.problem("warning", `${path}: no video yet (${st.title} isn't on the landing page)`);
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
  branchFolders(st).filter((p) => !mine.has(p)).forEach((p) => t.problem("warning", `${p}: no choice links here (orphan page)`));
  // The story's own link, /<id>/, opens its player.
  if ((await status(`/${st.id}/`)) !== 200) t.problem("bug", `/${st.id}/ (${st.title}'s link) is missing`);
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
  if (!landingShown()) await toLanding(t);
  await checkMark(t, document, "home (stories)");
  await checkLink(t, document, (a) => /hawkes biomedical/i.test(a.textContent), PARENT_URL, "Hawkes Biomedical", "home");
  await sleep(1500); // the footer stays on screen for the footage
  t.progress(0.15);

  // The same with a story open in the player: the mark is still there and nothing lies over the story video.
  t.scene("The Final Spark: footer and video");
  await openStory(t, FIRST);
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
    // The story's first video starts with sound from the card's tap (the player starts it inside the click).
    await openStory(t, FIRST);
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
    // The address kept ?story=final-spark, so the page opens straight into the story, and the prompt names it.
    if (stories().current() !== FIRST) t.problem("bug", `after the reload the page didn't open The Final Spark again (open: ${stories().current() || "the landing page"})`);
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

installPlaytest({
  product: "imaginelivetv",
  scenarios: [
    { id: "smoke", title: "The landing page, The Final Spark from its card: the first video plays, a choice appears, one step in and back, All stories", seconds: 25, tags: ["smoke"] },
    {
      id: "stories",
      title: "The landing page opens every story: its card, its player, its first page, All stories, its link",
      seconds: 40,
      tags: ["full"],
      description: "Taps Tap to play, checks the landing page has a card for every listed story in story/stories.json (title, logline, an image that loads) and none for the unlisted ones. Taps each card: the player opens that story (its title, ?story=<id> in the address), its first page's text, video and choices; All stories brings the landing page back with the video gone. Then each story's own link, /<id>/, opens the home page straight into that story, with its own Tap to play title.",
    },
    { id: "branches", title: "Every listed story's player: every scene, every choice, every video", seconds: 150, tags: ["full"] },
    { id: "pages", title: "Every story's branch pages (one folder per branch): videos and choice links", seconds: 60, tags: ["full"] },
    { id: "blog", title: "Every blog post opens, with its images and links", seconds: 40, tags: ["full"] },
    {
      id: "credits",
      title: "Powered by HAWKES GEN on every kind of page, Hawkes Biomedical on the home page",
      seconds: 30,
      tags: ["full"],
      description: "Taps Tap to play, scrolls to the home page (landing page) footer and checks \"Powered by HAWKES GEN\" links to https://hawkesgen.com and the parent company link goes to https://hawkesbiomedical.com (visible, hit-tested, not covered), and the mark again with The Final Spark open in the player. Then opens a blog post, the start's branch page and What's new and checks the mark in each footer, and that nothing lies over the story video (the mark never overlaps it). Before the first tap it turns Sound off with the prompt's own Settings button: the prompt's line must then say \"Sound off.\", and so must the branch page's prompt, which loads with Sound off saved. The viewer's own hawkes.sound is put back.",
    },
    {
      id: "sound",
      title: "Tap to play unlocks sound, Settings (Sound, Volume) that survive a reload",
      seconds: 45,
      tags: ["full", "menus"],
      description: "Shows the Tap to play prompt and taps it with a pointer press on the spot (hit-tested, so a covered prompt fails); the AudioContext runs, The Final Spark's card opens the story and its video plays unmuted by itself, and so does the next scene's after a choice. Opens Settings from the header, turns Sound off and Volume to 40% (saved in hawkes.sound), reloads the page (the run carries on through ?playtest=sound), checks the page opens straight back into The Final Spark (?story=final-spark) and the prompt is back with its title, the choice was kept and the video plays muted, turns Sound on, then opens the start's branch page: its prompt, then its video with sound at 40%. The viewer's own hawkes.sound and progress are put back.",
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
