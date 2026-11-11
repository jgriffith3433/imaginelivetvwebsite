(function () {
  const COOKIE_DAYS = 30;

  // Every story comes from js/story-data.js, built from story/stories.json and story/<id>.json by
  // tools/build-story.mjs. The home page is the landing page (one card per story); choosing one opens it here,
  // at /?story=<id>, without a page load.
  const DATA = window.ILTV_STORIES;
  if (!DATA || !DATA.stories || !DATA.stories.length) return;
  const STORIES = {};
  DATA.stories.forEach(function (story) { STORIES[story.id] = story; });

  let STORY = null;
  let SCENES = {};

  function line(ui, en, spec) {
    return {
      lang: spec.lang,
      dir: spec.dir || "",
      mouth: ui.mouth,
      depth: ui.depth,
      mouthEn: en.mouth,
      depthEn: en.depth,
      title: spec.title[0],
      titleEn: spec.title[1],
      story: spec.story[0],
      storyEn: spec.story[1],
      question: spec.question[0],
      questionEn: spec.question[1],
      video: spec.video,
      // The poster frame and the phone rendition of the clip (tools/make-posters.mjs); clipSrc() and show() read them.
      poster: spec.poster || "",
      small: spec.small || "",
      live: spec.live || 0,
      dead: !!spec.dead,
      ending: spec.ending ? spec.ending[0] : "",
      endingEn: spec.ending ? spec.ending[1] : "",
      choices: (spec.choices || []).map(function (choice) {
        return { say: choice[0], en: choice[1], next: choice[2], default: !!choice[3], set: choice[4] || null };
      }),
      // Alternate story text, question or clip chosen by flags (story doc "Flags and variants").
      variants: (spec.variants || []).map(function (v) {
        return {
          when: v.when || {},
          story: v.story || null,
          question: v.question || null,
          video: v.video || null,
          poster: v.poster || "",
          small: v.small || ""
        };
      })
    };
  }

  function scenesOf(story) {
    const scenes = {};
    const en = story.ui.en;
    Object.keys(story.scenes).forEach(function (id) {
      const s = story.scenes[id];
      scenes[id] = line(story.ui[s.lang] || en, en, s);
    });
    return scenes;
  }

  const root = document.getElementById("spark");
  const videoBox = document.getElementById("spark-video");
  const storyBox = document.getElementById("spark-story");
  const questionBox = document.getElementById("spark-question");
  const choicesBox = document.getElementById("spark-choices");
  const endingBox = document.getElementById("spark-ending");
  const stepBox = document.getElementById("spark-step");
  const landing = document.getElementById("stories");
  const storyList = document.getElementById("story-list");
  const firstScreen = document.getElementById("first-screen");
  const titleBox = document.getElementById("spark-title");
  const taglineBox = document.getElementById("spark-tagline");
  const storiesLink = document.getElementById("spark-stories");
  const consoleBox = document.getElementById("console");
  const consoleLink = document.getElementById("console-stories");

  if (!root || !videoBox || !storyBox || !questionBox || !choicesBox || !endingBox || !landing) {
    return;
  }

  // Language picker (the story's pages are each in another language): "mixed" = as written, the English under the
  // flashlight; "en" = the English plainly. Kept in localStorage; switching re-renders nothing, so the scene, its
  // video and the run carry on.
  const READING_KEY = "iltv.reading";
  const langBox = document.getElementById("spark-lang-box");
  const langSelect = document.getElementById("spark-lang");
  let reading = "mixed";
  try { if (localStorage.getItem(READING_KEY) === "en") reading = "en"; } catch (error) { /* no saved choice */ }

  /** What the screen reader hears follows the picked language (the hidden half is aria-hidden). */
  function syncReading() {
    root.dataset.reading = reading;
    root.querySelectorAll(".spot-src").forEach(function (el) { el.setAttribute("aria-hidden", reading === "en" ? "true" : "false"); });
    root.querySelectorAll(".spot-en").forEach(function (el) { el.setAttribute("aria-hidden", reading === "en" ? "false" : "true"); });
    // The blog list on the home page follows too: each title is in one language at a time.
    document.querySelectorAll("#blog .spot-src").forEach(function (el) { el.setAttribute("aria-hidden", reading === "en" ? "true" : "false"); });
    document.querySelectorAll("#blog .spot-en").forEach(function (el) { el.setAttribute("aria-hidden", reading === "en" ? "false" : "true"); });
    document.documentElement.dataset.reading = reading;
    if (langSelect) langSelect.value = reading;
  }
  new MutationObserver(syncReading).observe(root, { childList: true, subtree: true });
  // At load too: the landing page's blog list must follow a saved English before any story is opened.
  syncReading();
  if (langSelect) {
    langSelect.addEventListener("change", function () {
      reading = langSelect.value === "en" ? "en" : "mixed";
      try { localStorage.setItem(READING_KEY, reading); } catch (error) { /* not saved */ }
      syncReading();
      tell("feature", { feature: "language", story: STORY ? STORY.id : null, value: reading, scene: currentScene });
    });
  }

  let currentScene = null;
  let history = [];
  // What the run remembers (video stories): `flags` are set by choices (`set`) and read by a scene's `variants`; they
  // are worked out from the way you came, so a rewind or a saved place always has the right ones. `tried` is, per
  // fork, the options that ended in a death and were rewound from (marked "Tried" when the fork comes back).
  let flags = {};
  let tried = {};
  let rewindFlag = false; // set by a Rewind, read by the show() that follows it

  function choiceTo(story, fromId, toId) {
    const from = story.scenes[fromId];
    return from && from.choices ? from.choices.filter(function (c) { return c.next === toId; })[0] : null;
  }

  /** The flags of a way (scene ids, the last one where you are): each step applies its choice's `set`. */
  function flagsOfWay(story, way) {
    const out = {};
    for (let i = 0; i + 1 < way.length; i++) {
      const c = choiceTo(story, way[i], way[i + 1]);
      if (c && c.set) Object.keys(c.set).forEach(function (k) { out[k] = c.set[k]; });
    }
    return out;
  }

  /** A scene as it plays with these flags: the first variant whose `when` holds replaces the base's text and clip. */
  function sceneWith(base, flagMap) {
    const vs = base && base.variants;
    if (!vs || !vs.length) return base;
    const hit = vs.filter(function (v) {
      return Object.keys(v.when).every(function (k) {
        const have = flagMap[k] === undefined ? false : flagMap[k];
        return have === v.when[k];
      });
    })[0];
    if (!hit) return base;
    const out = Object.assign({}, base);
    if (hit.story) { out.story = hit.story[0]; out.storyEn = hit.story[1]; }
    if (hit.question) { out.question = hit.question[0]; out.questionEn = hit.question[1]; }
    if (hit.video) { out.video = hit.video; out.poster = hit.poster; out.small = hit.small; out.live = 0; }
    return out;
  }
  let fromPlayer = false;

  /** Tells js/analytics.js (Hawkes Analytics) what just happened: "iltv:<what>" on the document. The player never
      waits for it or depends on anyone listening. A choice also remembers the recap for Continue (last scene, label,
      poster), saved with the run. */
  let lastRecap = null; // { from, choice, poster }
  let wantRecap = false; // set when the viewer presses Continue on the landing page
  let recapTimer = null;
  let recapRaf = null;
  let recapGuard = null;

  function tell(what, detail) {
    if (what === "choice" && detail && STORY && detail.from && detail.option) {
      lastRecap = {
        from: detail.from,
        choice: String(detail.option),
        poster: posterOfScene(STORY, detail.from)
      };
    }
    try {
      document.dispatchEvent(new CustomEvent("iltv:" + what, { detail: detail }));
    } catch (error) {
      // Nothing listening, or an old browser: the story plays on.
    }
  }

  /** The picture for a Continue recap: a video scene's poster, else the story's card image. */
  function posterOfScene(story, sceneId) {
    if (!story) return "";
    const raw = story.scenes && story.scenes[sceneId];
    if (raw && raw.poster) return raw.poster;
    if (STORY === story && SCENES[sceneId] && SCENES[sceneId].poster) return SCENES[sceneId].poster;
    return story.image ? story.image.replace(/\.jpg$/, ".webp") : "";
  }

  /** One of a story's cookies, parsed (JSON), or null. */
  function readCookie(name) {
    try {
      const prefix = name + "=";
      const item = document.cookie
        .split(";")
        .map(function (part) { return part.trim(); })
        .find(function (part) { return part.startsWith(prefix); });
      return item ? JSON.parse(decodeURIComponent(item.substring(prefix.length))) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCookie(name, value) {
    try {
      document.cookie = name + "=" + encodeURIComponent(JSON.stringify(value)) +
        "; Max-Age=" + (COOKIE_DAYS * 24 * 60 * 60) +
        "; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    } catch (error) {
      // The game stays playable if cookies are blocked.
    }
  }

  // Every story keeps two cookies: its run (`cookie` in its data: { scene, history }, the place you're at and the
  // way you came) and its unlocks (`<cookie>Unlocked`: { seen, completed }, every scene ever reached in the player
  // and whether an ending was). Start Over clears the run only; deaths, Try again and Start Over keep the unlocks.
  // Found endings live in localStorage "iltv.endings.<cookie>" (ids once found), next to the unlocks; nothing clears them.
  function unlocksCookie(story) {
    return story.cookie + "Unlocked";
  }

  function endingsKey(story) {
    return "iltv.endings." + story.cookie;
  }

  /** Ending nodes listed by the build (`story.endings`), or derived from scenes that carry an `ending` line. */
  function endingsOf(story) {
    if (Array.isArray(story.endings) && story.endings.length) return story.endings;
    return Object.keys(story.scenes).filter(function (id) {
      return !!story.scenes[id].ending;
    }).map(function (id) {
      const s = story.scenes[id];
      return {
        id: id,
        title: s.title,
        ending: s.ending,
        poster: s.poster || s.endcard || "",
        endcard: s.endcard || ""
      };
    });
  }

  /** Found ending ids for a story (localStorage). Seeds from unlocks.seen when the key is empty so older runs count. */
  function readFoundEndings(story) {
    const found = {};
    const ends = endingsOf(story);
    const endIds = {};
    ends.forEach(function (e) { endIds[e.id] = true; });
    try {
      const raw = localStorage.getItem(endingsKey(story));
      const saved = raw ? JSON.parse(raw) : null;
      const list = Array.isArray(saved) ? saved : (saved && Array.isArray(saved.ids) ? saved.ids : []);
      list.forEach(function (id) { if (typeof id === "string" && endIds[id]) found[id] = true; });
    } catch (error) { /* storage blocked or bad JSON */ }
    if (!Object.keys(found).length) {
      const unlocks = readUnlocks(story);
      ends.forEach(function (e) { if (unlocks.seen[e.id]) found[e.id] = true; });
      if (Object.keys(found).length) writeFoundEndings(story, found);
    }
    return found;
  }

  function writeFoundEndings(story, found) {
    try {
      localStorage.setItem(endingsKey(story), JSON.stringify({ ids: Object.keys(found) }));
    } catch (error) { /* storage blocked: gallery still works for this page load */ }
  }

  function markEndingFound(story, sceneId) {
    if (!story || !sceneId) return;
    const ends = endingsOf(story);
    if (!ends.some(function (e) { return e.id === sceneId; })) return;
    const found = readFoundEndings(story);
    if (found[sceneId]) return;
    found[sceneId] = true;
    writeFoundEndings(story, found);
  }

  function endingTitleOf(entry) {
    if (!entry) return "";
    const t = entry.title;
    if (Array.isArray(t)) return String(t[1] || t[0] || "");
    return String(t || "");
  }

  function endingPosterOf(entry, story) {
    if (!entry) return "";
    return entry.poster || entry.endcard || (story && story.image) || "";
  }

  function endingsCountText(foundN, total) {
    return foundN + " of " + total + " found";
  }

  /** Home-card wording: "2 of 5 endings". */
  function endingsCardText(foundN, total) {
    return foundN + " of " + total + (total === 1 ? " ending" : " endings");
  }

  /** A replay: the viewer has already finished a run of this story (an ending found, or a death met), so the
      choices can say which ways are still new. On a first run nothing is tagged (everything would be). */
  function isReplay(story) {
    if (Object.keys(readFoundEndings(story)).length) return true;
    const seen = readUnlocks(story).seen;
    return Object.keys(seen).some(function (id) { return story.scenes[id] && story.scenes[id].dead; });
  }

  /** Whether every scene a choice can lead to is seen: its target and all below it. Only forward edges count (to a
      scene further from the start than the one the choice is on), so a "go back" never drags the whole story in. */
  function subtreeSeen(story, seen, fromId, nextId) {
    const depth = {};
    depth[story.start] = 0;
    const queue = [story.start];
    while (queue.length) {
      const id = queue.shift();
      (story.scenes[id].choices || []).forEach(function (c) {
        if (story.scenes[c.next] && depth[c.next] == null) { depth[c.next] = depth[id] + 1; queue.push(c.next); }
      });
    }
    if (depth[nextId] == null || depth[fromId] == null || depth[nextId] <= depth[fromId]) {
      return !!seen[nextId];
    }
    const stack = [nextId];
    const visited = {};
    while (stack.length) {
      const id = stack.pop();
      if (visited[id]) continue;
      visited[id] = true;
      if (!seen[id]) return false;
      (story.scenes[id].choices || []).forEach(function (c) {
        if (story.scenes[c.next] && depth[c.next] > depth[id]) stack.push(c.next);
      });
    }
    return true;
  }

  /** "new" (leads to a scene never reached), "seen" (it and everything it can lead on to are reached), or "" (some
      of it found, some not, or not a replay). */
  function choiceMark(story, seen, fromId, nextId, replay) {
    if (!replay || !story.scenes[nextId]) return "";
    if (!seen[nextId]) return "new";
    return subtreeSeen(story, seen, fromId, nextId) ? "seen" : "";
  }

  /** A story's current run ({ scene, history, from, choice, poster }), or null. from/choice/poster are the Continue
      recap (the last scene left, the choice that led here, its poster); older cookies omit them. */
  function readProgress(story, scenes) {
    const saved = readCookie(story.cookie);
    if (!saved || !scenes[saved.scene]) return null;
    const from = typeof saved.from === "string" && scenes[saved.from] ? saved.from : null;
    const choice = typeof saved.choice === "string" && saved.choice ? saved.choice : null;
    const poster = typeof saved.poster === "string" && saved.poster
      ? saved.poster
      : (from ? posterOfScene(story, from) : "");
    return {
      scene: saved.scene,
      history: Array.isArray(saved.history)
        ? saved.history.filter(function (id) {
            return typeof id === "string" && !!scenes[id];
          })
        : [],
      from: from,
      choice: choice,
      poster: poster,
      tried: saved.tried && typeof saved.tried === "object" && !Array.isArray(saved.tried) ? saved.tried : {}
    };
  }

  /** A story's unlocks: `seen` (each scene reached in the player, once, as an id → true map) and `completed` (an
      ending reached once: only an ending sets it, nothing clears it). A run saved before unlocks existed counts the
      way it came. */
  function readUnlocks(story) {
    const seen = {};
    let done = false;
    const saved = readCookie(unlocksCookie(story));
    const add = function (id) { if (typeof id === "string" && story.scenes[id]) seen[id] = true; };
    if (saved) {
      (Array.isArray(saved.seen) ? saved.seen : []).forEach(add);
      if (typeof saved.ix === "string") unpackSeen(story, saved.ix).forEach(add);
      done = saved.completed === true;
    } else {
      const old = readCookie(story.cookie);
      if (old && story.scenes[old.scene]) {
        (Array.isArray(old.history) ? old.history : []).forEach(add);
        add(old.scene);
        done = old.completed === true;
      }
    }
    return { seen: seen, completed: done };
  }

  // A console story can have a hundred scenes or more, too many ids for a 4 KB cookie: its unlocks are kept as a bit
  // per scene, in the order of its data (new scenes go at the end of `scenes`, so nobody's bits move).
  function packSeen(story, seen) {
    const ids = Object.keys(story.scenes);
    let hex = "";
    for (let i = 0; i < ids.length; i += 4) {
      let n = 0;
      for (let j = 0; j < 4; j++) if (ids[i + j] && seen[ids[i + j]]) n |= 1 << j;
      hex += n.toString(16);
    }
    return hex;
  }

  function unpackSeen(story, hex) {
    return Object.keys(story.scenes).filter(function (id, i) {
      return (parseInt(hex.charAt(Math.floor(i / 4)) || "0", 16) & (1 << (i % 4))) !== 0;
    });
  }

  /** How much of a story has been explored: unlocked scenes / all its scenes, in whole percent, rounded down (so
      100 only once every scene has been seen). */
  function exploredOf(story, seen) {
    const all = Object.keys(story.scenes).length;
    const n = Object.keys(seen).length;
    if (!all || !n) return 0;
    // Whole percent, rounded down, but never 0 once a scene is seen (one of Night Shift's 228 is 0.4%) and 100 only
    // with every scene.
    return n >= all ? 100 : Math.min(99, Math.max(1, Math.floor((n * 100) / all)));
  }

  let completed = false;
  let unlocked = {};

  /** Start Over: forgets one story's current run (its run cookie only; its unlocks and the other stories stay). */
  function clearProgress(story) {
    if (story.type === "console" && window.iltvConsole) window.iltvConsole.forget(story);
    if (STORY === story) { lastRecap = null; tried = {}; }
    try {
      document.cookie = story.cookie + "=; Max-Age=0; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    } catch (error) {
      // Cookies blocked: there was nothing saved.
    }
  }

  /** The run cookie payload, including the Continue recap fields when a choice has been made. */
  function runPayload(historyIds) {
    const payload = { scene: currentScene, history: historyIds };
    if (STORY && STORY.type !== "console") {
      if (Object.keys(flags).length) payload.flags = flags;
      if (Object.keys(tried).length) payload.tried = tried;
    }
    if (lastRecap && lastRecap.from && lastRecap.choice) {
      payload.from = lastRecap.from;
      payload.choice = lastRecap.choice;
      payload.poster = lastRecap.poster || posterOfScene(STORY, lastRecap.from);
    }
    return payload;
  }

  function saveProgress() {
    if (STORY.type === "console") {
      // The run itself (the state, the log, the lines heard) is in localStorage (js/console.js); the cookies keep the
      // card's badge, the place, the Continue recap and the unlocks, small.
      writeCookie(STORY.cookie, runPayload([]));
      writeCookie(unlocksCookie(STORY), { ix: packSeen(STORY, unlocked), completed: completed });
      return;
    }
    writeCookie(STORY.cookie, runPayload(history));
    writeCookie(unlocksCookie(STORY), { seen: Object.keys(unlocked), completed: completed });
  }

  // The page's language, by its own name, where the location label is: about 1.5 s on every page, so the change of
  // language from page to page reads as a rule (J, 2026-11-11). No words are added: it is the language itself.
  const LANG_NAMES = {
    ar: "العربية", bn: "বাংলা", de: "Deutsch", en: "English", es: "Español", fr: "Français", hi: "हिन्दी",
    id: "Bahasa Indonesia", it: "Italiano", ja: "日本語", ko: "한국어", mr: "मराठी", pa: "ਪੰਜਾਬੀ", pt: "Português",
    ru: "Русский", sw: "Kiswahili", ta: "தமிழ்", te: "తెలుగు", th: "ไทย", tr: "Türkçe", ur: "اردو",
    vi: "Tiếng Việt", zh: "中文"
  };
  const LANG_FLASH_MS = 1500;
  let langFlashTimer = null;

  function flashLanguage(scene) {
    if (!stepBox) return;
    clearTimeout(langFlashTimer);
    stepBox.querySelectorAll(".step-lang").forEach(function (el) { el.remove(); });
    const code = scene.lang;
    if (!code || !LANG_NAMES[code]) return;
    const el = document.createElement("span");
    el.className = "step-lang";
    el.dataset.langCode = reading === "en" ? "en" : code;
    el.lang = reading === "en" ? "en" : code;
    if (scene.dir === "rtl" && reading !== "en") el.dir = "rtl";
    el.textContent = LANG_NAMES[reading === "en" ? "en" : code];
    stepBox.appendChild(el);
    stepBox.dataset.langFlash = el.dataset.langCode;
    langFlashTimer = setTimeout(function () {
      el.remove();
      delete stepBox.dataset.langFlash;
    }, LANG_FLASH_MS);
  }

  // A viewer's first visit: as the first clip ends the flashlight sweeps once (js/spot.js). Not on a run that is
  // already going, and never again once it has been seen (localStorage, per viewer).
  function maybeSweep(sceneId) {
    if (!window.iltvTorch || !STORY || STORY.type === "console") return;
    if (history.length !== 0 || sceneId !== STORY.start || window.iltvTorch.swept()) return;
    if (Object.keys(unlocked).length > 1) return;
    setTimeout(function () {
      if (currentScene !== sceneId || history.length !== 0) return;
      window.iltvTorch.sweep();
    }, 350);
  }

  function sceneState(scene) {
    if (scene.ending) return "soon";
    if (scene.dead) return "dead";
    return "play";
  }

  function fillSpot(el, say, en, lang, dir) {
    el.classList.add("spot");
    el.replaceChildren();
    const src = document.createElement("span");
    src.className = "spot-src";
    if (lang) src.lang = lang;
    src.textContent = say;
    const english = document.createElement("span");
    english.className = "spot-en";
    english.lang = "en";
    english.setAttribute("aria-hidden", "true");
    english.textContent = en;
    el.append(src, english);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function spotHtml(say, en, lang, dir) {
    const langAttr = lang ? ' lang="' + lang + '"' : "";
    return '<span class="spot">' +
      '<span class="spot-src"' + langAttr + ">" + escapeHtml(say) + "</span>" +
      '<span class="spot-en" lang="en" aria-hidden="true">' + escapeHtml(en) + "</span>" +
      "</span>";
  }

  var activeClip = null;
  var clipUnlock = null;

  function stopClipUnlock() {
    if (!clipUnlock) return;
    document.removeEventListener("pointerdown", clipUnlock, true);
    clipUnlock = null;
  }

  /** A scene video the host fails to serve (a 503): load it again twice, then say so with a Retry button. */
  function watchVideo(video, src) {
    let tries = 0;
    video.addEventListener("error", function () {
      if (activeClip !== video) return;
      tries += 1;
      if (tries <= 2) {
        setTimeout(function () {
          if (activeClip !== video) return;
          video.src = src + "?retry=" + tries;
          video.load();
          playClip(video);
        }, 1000 * tries);
        return;
      }
      const note = document.createElement("div");
      note.className = "spark-video-blank";
      note.setAttribute("role", "alert");
      note.textContent = "The video didn't load. ";
      const again = document.createElement("button");
      again.type = "button";
      again.className = "choice";
      again.textContent = "Retry";
      again.addEventListener("click", function () {
        tries = 0;
        note.remove();
        video.src = src + "?retry=" + Date.now();
        video.load();
        playClip(video);
      });
      note.appendChild(again);
      videoBox.appendChild(note);
    });
  }

  /* ---- Phones: loading state, tap to unmute, fullscreen, next clips ready (media events only, no polling) ---- */

  var preloaded = {};

  /** A phone-sized screen (or a phone on its side) plays the smaller rendition of a clip (<dir>/sm/<name>.mp4, made by
      tools/make-posters.mjs); everything else plays the clip. The branch pages make the same choice (build-story.mjs). */
  var COARSE = window.matchMedia("(pointer: coarse)");
  /** Reads the page's own laid-out size (documentElement.clientWidth/Height), not the width media queries: a 1280x800
      frame inside a phone browser (the playtest's desktop view, or device emulation) must count as desktop, and a
      media query there can answer for the outer phone screen. Same rule as the branch pages' inline script. */
  function isPhone() {
    var el = document.documentElement;
    var w = el.clientWidth, h = el.clientHeight;
    return w <= 600 || (h <= 500 && COARSE.matches);
  }
  function clipSrc(scene) {
    return (isPhone() && scene.small) || scene.video;
  }

  var posters = {};
  var pendingTap = null;

  /** Choices shown: every target's poster is decoded and its clip rendition (sm on phones, via clipSrc) buffered;
      those no longer offered are cancelled. A tap then swaps to a scene that is ready (see goTo). */
  function preloadNext(scene) {
    var want = {};
    var wantNext = function (id) {
      var next = SCENES[id];
      if (next) want[id] = sceneWith(next, flagsOfWay(STORY, history.concat(currentScene, id)));
    };
    scene.choices.forEach(function (c) { wantNext(c.next); });
    // A death's Rewind goes back to its fork: have it ready.
    if (scene.dead && history.length) {
      var fork = history[history.length - 1];
      if (SCENES[fork]) want[fork] = SCENES[fork];
    }
    Object.keys(preloaded).forEach(function (id) {
      if (want[id]) return;
      preloaded[id].removeAttribute("src");
      preloaded[id].load();
      delete preloaded[id];
    });
    Object.keys(posters).forEach(function (id) { if (!want[id]) delete posters[id]; });
    Object.keys(want).forEach(function (id) {
      var next = want[id];
      if (next.poster && !posters[id]) {
        var img = new Image();
        img.src = next.poster;
        var done = { ready: false };
        posters[id] = done;
        var fin = function () { done.ready = true; };
        if (img.decode) img.decode().then(fin, fin); else img.onload = img.onerror = fin;
      }
      if (next.video && !preloaded[id]) {
        var v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.playsInline = true;
        v.src = clipSrc(next);
        v.load();
        preloaded[id] = v;
      }
    });
  }

  function targetReady(id) {
    var p = posters[id], v = preloaded[id];
    return (!p || p.ready) && (!v || v.readyState >= 3 || v.error);
  }

  /** The current scene stays up until the target can show; after 300 ms it swaps anyway (the box paints the
      target's poster, never black). Taps during the wait are ignored, so the scene shown is always the one chosen. */
  function goTo(choice, how) {
    if (pendingTap || !SCENES[choice.next]) return;
    stopChoiceWindow();
    var from = currentScene, story = STORY;
    var token = pendingTap = {};
    var t0 = performance.now();
    var go = function () {
      if (pendingTap !== token) return;
      pendingTap = null;
      if (STORY !== story || currentScene !== from) return;
      tell("choice", { story: STORY.id, from: from, to: choice.next, option: choiceLabel(choice.en), waited: Math.round(performance.now() - t0), ready: targetReady(choice.next) });
      if (how === "rewind") {
        // Back to the fork the death came from: the deadly option stays marked as tried.
        rewindFlag = true;
        const fork = history.pop();
        tried[fork] = (tried[fork] || []).filter(function (id) { return id !== from; }).concat(from);
        tell("feature", { feature: "rewind", story: STORY.id, from: from, to: fork });
      } else if (how === "start_over") {
        history = [];
        tried = {};
      } else {
        history.push(from);
      }
      fromPlayer = true;
      show(choice.next);
    };
    var poll = function () {
      if (pendingTap !== token) return;
      if (targetReady(choice.next) || performance.now() - t0 >= 300) go();
      else setTimeout(poll, 20);
    };
    poll();
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  /** Loading ring, Tap for sound and Full screen over the clip. */
  function addClipControls(video) {
    var ring = document.createElement("div");
    ring.className = "spark-video-loading";
    ring.setAttribute("role", "status");
    ring.setAttribute("aria-label", "Loading");
    ring.hidden = true;
    var unmute = document.createElement("button");
    unmute.type = "button";
    unmute.className = "spark-unmute";
    unmute.hidden = true;
    unmute.textContent = "Tap for sound";
    var full = document.createElement("button");
    full.type = "button";
    full.className = "spark-fullscreen";
    full.setAttribute("aria-label", "Full screen");
    full.textContent = "\u26F6";
    videoBox.appendChild(ring);
    videoBox.appendChild(unmute);
    videoBox.appendChild(full);

    function loading(on) {
      if (ring.hidden === !on) return;
      ring.hidden = !on;
      root.dataset.loading = on ? "true" : "false";
      tell("loading", { story: STORY ? STORY.id : null, scene: currentScene, on: on });
    }
    function sync() {
      unmute.hidden = !(video.muted && !video.paused && !video.ended);
    }
    ["waiting", "stalled", "loadstart"].forEach(function (type) {
      video.addEventListener(type, function () { if (!video.ended && video.readyState < 3) loading(true); });
    });
    ["playing", "canplay", "seeked", "ended", "error"].forEach(function (type) {
      video.addEventListener(type, function () { loading(false); });
    });
    ["playing", "pause", "volumechange", "ended"].forEach(function (type) { video.addEventListener(type, sync); });
    unmute.addEventListener("click", function () {
      if (window.hawkesSound) window.hawkesSound.set({ on: true });
      if (window.iltvAudio) {
        window.iltvAudio.unlock();
        window.iltvAudio.setEnabled(true);
      }
      video.muted = false;
      if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
      sync();
    });
    full.addEventListener("click", function () {
      if (fullscreenElement()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        return;
      }
      // Android and desktop: the whole player, so the choices stay on screen. iPhone has no element fullscreen: the video's own.
      var ask = root.requestFullscreen || root.webkitRequestFullscreen;
      if (ask) {
        var r = ask.call(root);
        if (r && r.catch) r.catch(function () { if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); });
      } else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    });
    sync();
  }

  /** Turning the phone must not leave the clip frozen: when the screen changes shape the clip carries on. */
  function onTurned() {
    var v = activeClip;
    if (!v || !v.isConnected || v.ended || !v.paused) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  window.addEventListener("orientationchange", onTurned);
  if (window.matchMedia) {
    var turn = window.matchMedia("(orientation: landscape)");
    if (turn.addEventListener) turn.addEventListener("change", onTurned);
  }
  document.addEventListener("fullscreenchange", function () { root.dataset.fullscreen = fullscreenElement() ? "true" : "false"; });

  /** Short bed mood per story for js/audio.js setBed(story, mood). Files live at /assets/audio/<id>/<mood>.mp3 when made. */
  function storyMood(story) {
    if (!story) return "default";
    if (story.id === "final-spark") return "sewer";
    if (story.id === "water-road") return "dust";
    if (story.id === "night-shift" || story.id === "night-shift-demo") return "room";
    return "default";
  }

  function audioBed(story) {
    if (!window.iltvAudio || !story) return;
    // Console stories already loop their own ambience beds in js/console.js — don't stack a second house bed.
    if (story.type === "console") {
      window.iltvAudio.setBed(null, null);
      return;
    }
    window.iltvAudio.setBed(story.id, storyMood(story));
  }

  function playClip(video) {
    activeClip = video;
    stopClipUnlock();
    if (window.iltvAudio) window.iltvAudio.watch(video);
    // js/hawkes-sound.js: the first video waits for the Tap to play prompt, which starts it with sound. The next
    // ones start here, inside the viewer's click, with the saved Settings.
    var sound = window.hawkesSound;
    if (sound) {
      video.setAttribute("data-sound-start", "");
      if (sound.unlocked()) {
        if (window.iltvAudio) window.iltvAudio.unlock();
        sound.play(video);
      } else sound.apply(video);
      return;
    }
    video.muted = false;
    var started = video.play();
    if (!started || !started.catch) return;
    started.catch(function () {
      if (activeClip !== video) return;
      // No sound before the viewer's first tap: play muted so the picture moves, unmute on the tap.
      video.muted = true;
      var quiet = video.play();
      if (quiet && quiet.catch) quiet.catch(function () {});
      clipUnlock = function (event) {
        var el = event.target;
        if (el.closest && el.closest(".choice, .spark-tab, .stories-back")) return;
        stopClipUnlock();
        if (activeClip !== video) return;
        if (window.iltvAudio) window.iltvAudio.unlock();
        video.muted = false;
        if (video.paused) {
          var again = video.play();
          if (again && again.catch) again.catch(function () {});
        }
      };
      document.addEventListener("pointerdown", clipUnlock, true);
    });
  }

  // A reload or Back must not restore an old scroll position (down in the blog) under an opening story.
  try { if ("scrollRestoration" in history && !location.hash) history.scrollRestoration = "manual"; } catch (e) { /* ignore */ }

  /** The story screen never scrolls: the page at the top (header in view) and the screen itself at 0. */
  function keepAtTop() {
    if (firstScreen) { firstScreen.scrollTop = 0; firstScreen.scrollLeft = 0; }
    if (window.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop)) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  // The path of the run you just finished, kept for "Try another path": the next run marks where it went last time
  // (the choice you took on each page of that path, and its nodes in the Tree). sessionStorage only.
  let lastWay = null;
  const lastWayKey = function (story) { return "iltv.lastpath." + story.cookie; };

  function readLastWay(story, scenes) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(lastWayKey(story)));
      if (Array.isArray(saved) && saved.length > 1 && saved.every(function (id) { return !!scenes[id]; })) return saved;
    } catch (error) {
      // No session storage, no marks.
    }
    return null;
  }

  function writeLastWay(story, way) {
    try {
      sessionStorage.setItem(lastWayKey(story), JSON.stringify(way));
    } catch (error) {
      // The game stays playable.
    }
  }

  /** The recap of a run: for each step of the way, the page it was on and the choice taken there. */
  function recapOf(way) {
    const steps = [];
    for (let i = 0; i + 1 < way.length; i++) {
      const from = SCENES[way[i]];
      const choice = from.choices.filter(function (c) { return c.next === way[i + 1]; })[0];
      if (choice) steps.push({ from: from, choice: choice });
    }
    return steps;
  }

  /** The card at an ending: its kicker (THE END), its own name, the choices made, how many endings are found,
      a link into the Endings gallery, and Try another path (a new run from the start with this way marked). */
  function showEndingCard(sceneId, scene, opts) {
    const options = opts || {};
    const way = options.way || history.concat(sceneId);
    const steps = options.skipRecap ? [] : recapOf(way);
    const ends = endingsOf(STORY);
    const foundMap = readFoundEndings(STORY);
    markEndingFound(STORY, sceneId);
    foundMap[sceneId] = true;
    const foundN = Object.keys(foundMap).length;
    endingBox.className = "spark-ending ending-card";
    endingBox.dataset.ending = sceneId;
    endingBox.replaceChildren();

    const kicker = document.createElement("p");
    kicker.className = "ending-kicker";
    fillSpot(kicker, scene.ending, scene.endingEn, scene.lang, scene.dir);
    const name = document.createElement("h2");
    name.className = "ending-name";
    fillSpot(name, scene.title, scene.titleEn, scene.lang, scene.dir);
    const count = document.createElement("p");
    count.className = "ending-count";
    count.id = "spark-ending-count";
    count.textContent = endingsCountText(foundN, ends.length);
    endingBox.append(kicker, name, count);

    if (!options.skipRecap) {
      const head = document.createElement("p");
      head.className = "ending-recap-head";
      head.textContent = steps.length ? "The choices you made" : "You made no choices";
      endingBox.appendChild(head);
      const list = document.createElement("ol");
      list.className = "ending-recap";
      steps.forEach(function (step) {
        const li = document.createElement("li");
        fillSpot(li, choiceLabel(step.choice.say), choiceLabel(step.choice.en), step.from.lang, step.from.dir);
        list.appendChild(li);
      });
      endingBox.appendChild(list);
    }

    const galleryBtn = document.createElement("button");
    galleryBtn.type = "button";
    galleryBtn.className = "choice ending-gallery-btn";
    galleryBtn.id = "spark-endings-open";
    galleryBtn.textContent = "Endings";
    galleryBtn.addEventListener("click", function () { openEndingsGallery(STORY); });
    endingBox.appendChild(galleryBtn);

    if (!options.skipAgain) {
      const again = document.createElement("button");
      again.type = "button";
      again.className = "choice ending-again";
      again.id = "spark-try-another";
      again.textContent = "Try another path";
      again.addEventListener("click", function () {
        writeLastWay(STORY, way);
        lastWay = way;
        clearProgress(STORY);
        tell("restart", { story: STORY.id, via: "start_over", from: "ending_card" });
        history = [];
        fromPlayer = true;
        if (treeRoot) treeRoot.replaceChildren();
        setView("play");
        show(STORY.start);
      });
      endingBox.appendChild(again);
    }
  }

  // Choice-card chrome (J, 2026-11-06; unified across all three stories for f_32e426e8a75b): while a clip plays,
  // choices show an "up next" preview state (soft glow, thin progress line, never greyed-out disabled text); when the
  // clip ends (or in Night Shift when lines finish), active choices slide and fade in one after another (70 ms apart)
  // with a 15 s countdown window, and the bar and title controls fade away after 3 s idle.
  const CHOICE_WINDOW = 15;
  const IDLE_MS = 3000;
  const timerBox = document.getElementById("spark-timer");
  const consoleChoicesBox = document.getElementById("console-choices");
  let windowTick = null;
  let defaultTimer = null;
  let autoTimer = null;
  const AUTO_FADE_MS = 450;
  let idleTimer = null;

  function tagChoiceStagger(container) {
    if (!container) return;
    const buttons = container.querySelectorAll(".choice");
    buttons.forEach(function (btn, idx) {
      btn.style.setProperty("--choice-i", String(idx));
      btn.dataset.choiceIndex = String(idx);
    });
  }

  if (consoleChoicesBox && typeof MutationObserver !== "undefined") {
    const syncConsoleChoices = function () {
      const has = consoleChoicesBox.querySelectorAll(".choice").length > 0;
      consoleChoicesBox.dataset.phase = has ? "ready" : "waiting";
      if (has) tagChoiceStagger(consoleChoicesBox);
    };
    new MutationObserver(syncConsoleChoices).observe(consoleChoicesBox, { childList: true });
    syncConsoleChoices();
  }

  /** Where the choices come up in a clip: a generated cut keeps `live` seconds of moving picture after the narration
      (tools/build-story.mjs), so the buttons appear over footage that is still playing, never over a held last frame. */
  function revealPoint(video) {
    const live = video && video._iltvLive ? video._iltvLive : 0;
    return video && video.duration > 0 && isFinite(video.duration) ? Math.max(0.5, video.duration - live) : 0;
  }

  function syncWaitingProgress(video) {
    let pct = 24;
    const at = revealPoint(video);
    if (at > 0) {
      pct = Math.max(16, Math.min(100, Math.round((video.currentTime / at) * 84 + 16)));
    }
    const val = pct + "%";
    if (choicesBox) choicesBox.style.setProperty("--clip-progress", val);
    if (timerBox) timerBox.style.setProperty("--clip-progress", val);
  }

  function stopChoiceWindow() {
    if (windowTick) cancelAnimationFrame(windowTick);
    windowTick = null;
    if (defaultTimer) clearTimeout(defaultTimer);
    defaultTimer = null;
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = null;
    root.classList.remove("is-auto-advance");
    choicesBox.querySelectorAll(".is-default-pick").forEach(function (b) {
      b.classList.remove("is-default-pick");
      delete b.dataset.defaultPick;
    });
    if (timerBox) {
      const bar = timerBox.querySelector(".choice-timer-bar");
      if (bar) {
        bar.style.animation = "";
        bar.style.transform = "";
      }
      timerBox.dataset.urgent = "false";
      timerBox.hidden = true;
      timerBox.dataset.state = "off";
    }
  }

  function setChoicePhase(phase) {
    choicesBox.dataset.phase = phase;
    root.dataset.choices = phase;
    if (phase === "ready") {
      choicesBox.style.setProperty("--clip-progress", "100%");
      if (timerBox) timerBox.style.setProperty("--clip-progress", "100%");
      tagChoiceStagger(choicesBox);
      choicesBox.querySelectorAll(".choice").forEach(function (btn) {
        btn.style.animation = "none";
        void btn.offsetWidth;
        btn.style.animation = "";
      });
    }
  }

  /** While the clip plays, the cue row and choice cards show an "Up next" preview state with a thin progress line
      and soft glow (never dim disabled text). Pressing a choice is allowed at any time. */
  function showWaitingCue(hasChoices, video) {
    if (!hasChoices || !timerBox) return;
    const label = timerBox.querySelector(".choice-timer-label");
    const bar = timerBox.querySelector(".choice-timer-bar");
    if (label) label.textContent = "Up next";
    if (bar) {
      bar.style.animation = "none";
      bar.style.transform = "";
    }
    timerBox.dataset.urgent = "false";
    timerBox.hidden = false;
    timerBox.dataset.state = "waiting";
    syncWaitingProgress(video);
    if (video) {
      const onProgress = function () {
        if (activeClip === video && choicesBox.dataset.phase === "waiting") syncWaitingProgress(video);
      };
      ["loadedmetadata", "durationchange", "timeupdate", "playing"].forEach(function (ev) {
        video.addEventListener(ev, onProgress);
      });
    }
  }

  /** A death keeps its clip and its line and offers two buttons: Rewind to the choice (the last fork, with the deadly
      option marked as tried) and Start over (the story's own start). */
  function addDeathButtons(scene) {
    const make = function (kind, idx, say, en, run) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice death-choice";
      button.dataset.death = kind;
      button.dataset.choiceIndex = String(idx);
      button.style.setProperty("--choice-i", String(idx));
      fillSpot(button, say, en, kind === "rewind" ? "en" : scene.lang, scene.dir);
      button.addEventListener("click", function () {
        if (pendingTap) return;
        window.iltvDecide(choicesBox, button, run);
      });
      choicesBox.appendChild(button);
    };
    const fork = history.length ? history[history.length - 1] : null;
    let n = 0;
    if (fork && SCENES[fork]) {
      make("rewind", n++, "Rewind to the choice", "Rewind to the choice", function () {
        goTo({ next: fork, en: "Rewind to the choice" }, "rewind");
      });
    }
    const start = scene.choices.filter(function (c) { return c.next === STORY.start; })[0] || scene.choices[0] || { say: "1. Start over", en: "1. Start over", next: STORY.start };
    make("start", n++, choiceLabel(start.say), choiceLabel(start.en), function () { goTo(start, "start_over"); });
  }

  /** A page with one choice: when its clip ends the screen fades a moment and the story goes on by itself. */
  function autoContinue(sceneId) {
    const sc = SCENES[sceneId];
    if (!sc || sc.choices.length !== 1 || currentScene !== sceneId) return;
    root.classList.add("is-auto-advance");
    tell("feature", { feature: "auto_continue", story: STORY.id, node: sceneId });
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    autoTimer = setTimeout(function () {
      autoTimer = null;
      root.classList.remove("is-auto-advance");
      if (currentScene === sceneId && !pendingTap) goTo(sc.choices[0]);
    }, reduce ? 0 : AUTO_FADE_MS);
  }

  /** The clip is over (or there is none): the choices come up and, if there are any, the countdown starts. */
  function revealChoices(hasChoices) {
    setChoicePhase("ready");
    maybeSweep(currentScene);
    stopChoiceWindow();
    if (!hasChoices || !timerBox) return;
    const label = timerBox.querySelector(".choice-timer-label");
    const bar = timerBox.querySelector(".choice-timer-bar");
    timerBox.hidden = false;
    timerBox.dataset.state = "running";
    timerBox.dataset.urgent = "false";
    bar.style.animation = "";
    bar.style.transform = "scaleX(1)";
    const total = CHOICE_WINDOW * 1000;
    const t0 = performance.now();
    const scene = currentScene;
    let shown = CHOICE_WINDOW;
    label.textContent = "Choose in " + CHOICE_WINDOW + " s";
    const frame = function (now) {
      if (currentScene !== scene || root.hidden) return;
      const left = Math.max(0, total - (now - t0));
      const ratio = left / total;
      bar.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
      const secs = Math.ceil(left / 1000);
      if (secs > 0 && secs !== shown) {
        shown = secs;
        label.textContent = "Choose in " + secs + " s";
        if (secs <= 3) timerBox.dataset.urgent = "true";
      }
      if (left > 0) { windowTick = requestAnimationFrame(frame); return; }
      windowTick = null;
      bar.style.transform = "scaleX(0)";
      timerBox.dataset.urgent = "false";
      timerBox.dataset.state = "done";
      label.textContent = "Choosing...";
      pickDefault(scene);
    };
    windowTick = requestAnimationFrame(frame);
  }

  /** Time ran out: the first choice (or the one marked default) is lit for a moment, then played. */
  function pickDefault(scene) {
    const sc = SCENES[scene];
    if (!sc || !sc.choices.length) return;
    // Never a death: a viewer who looked away isn't killed by the timer (npm run story -- --check fails a default that is).
    const safe = function (c) { return !(SCENES[c.next] && SCENES[c.next].dead); };
    let idx = sc.choices.findIndex(function (c) { return c.default && safe(c); });
    if (idx < 0) idx = sc.choices.findIndex(safe);
    if (idx < 0) return;
    const btn = choicesBox.querySelectorAll(".choice")[idx];
    if (!btn) return;
    btn.classList.add("is-default-pick");
    btn.dataset.defaultPick = "true";
    tell("feature", { feature: "timeout_default", story: STORY.id, node: scene, choice: choiceLabel(sc.choices[idx].en) });
    defaultTimer = setTimeout(function () {
      defaultTimer = null;
      if (currentScene === scene && !pendingTap) goTo(sc.choices[idx]);
    }, 1100);
  }

  /** Any movement brings the controls back; 3 s without any hides them (never in the Tree). */
  function wakeChrome() {
    root.classList.remove("is-idle");
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (root.hidden || root.classList.contains("is-tree") || root.classList.contains("is-endings")) return;
      root.classList.add("is-idle");
    }, IDLE_MS);
  }
  ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"].forEach(function (name) {
    document.addEventListener(name, function () { if (!root.hidden) wakeChrome(); }, { passive: true, capture: true });
  });

  function show(sceneId) {
    if (!SCENES[sceneId]) return;
    // The flags are the way you came (a choice's `set`), and they pick the scene's variant.
    flags = flagsOfWay(STORY, history.concat(sceneId));
    const scene = sceneWith(SCENES[sceneId], flags);
    // A scene with exactly one choice (and a clip) plays through by itself when the clip ends, with no button.
    const rewound = rewindFlag;
    rewindFlag = false;
    const auto = scene.choices.length === 1 && !scene.dead && !scene.ending && !!scene.video;
    const timed = scene.choices.length > 0 && !scene.dead && !auto;

    currentScene = sceneId;
    // Only the player unlocks a scene (the branch pages don't touch the cookies).
    unlocked[sceneId] = true;
    if (scene.ending) {
      completed = true;
      markEndingFound(STORY, sceneId);
    }
    saveProgress();
    showExplored();
    root.dataset.state = sceneState(scene);
    fillSpot(
      stepBox,
      history.length === 0 ? scene.mouth : scene.depth + " " + history.length,
      history.length === 0 ? scene.mouthEn : scene.depthEn + " " + history.length,
      scene.lang,
      scene.dir
    );

    flashLanguage(scene);
    if (window.iltvTorch) window.iltvTorch.stop();
    showKit();
    wakeChrome();
    stopChoiceWindow();

    crossfadeOut();
    // The poster is also the box's own picture, so it stays under the loading ring and between clips: never a black box.
    const newBg = scene.poster ? 'url("' + scene.poster + '")' : "";
    if (videoBox.querySelector(".spark-leave")) setTimeout(function () { videoBox.style.backgroundImage = newBg; }, fadeMs() + 40);
    else videoBox.style.backgroundImage = newBg;
    const videoSrc = scene.video ? clipSrc(scene) : null;
    let video = null;

    if (videoSrc) {
      video = document.createElement("video");
      // The poster shows from the first paint, before any of the clip has loaded.
      if (scene.poster) video.poster = scene.poster;
      video.src = videoSrc;
      // With the sound prompt, playClip starts it (autoplay would start it behind the prompt).
      video.autoplay = !window.hawkesSound;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = "auto";
      video.title = STORY.title + " story video";
      videoBox.appendChild(video);
      addClipControls(video);
      playClip(video);
      // The incoming clip must never sit paused under the cross-fade: resume it when it can play and when the fade ends.
      const resume = function () {
        if (activeClip !== video || !video.isConnected || video.ended || !video.paused) return;
        const p = video.play();
        if (p && p.catch) p.catch(function () { video.muted = true; const q = video.play(); if (q && q.catch) q.catch(function () {}); });
      };
      if (!(window.hawkesSound && window.hawkesSound.prompt())) {
        video.addEventListener("canplay", resume, { once: true });
        setTimeout(resume, fadeMs() + 60);
      }
      watchVideo(video, videoSrc);
      setChoicePhase("waiting");
      showWaitingCue(timed, video);
      video._iltvLive = scene.live || 0;
      if (video._iltvLive) {
        // The cut's last seconds are a slow push-in on its final frame: the choices (and their timer) come up as it starts,
        // and the video keeps playing under them. It is never paused, and never looped back to its first frame.
        video.addEventListener("timeupdate", function () {
          if (activeClip !== video || currentScene !== sceneId || choicesBox.dataset.phase !== "waiting") return;
          const at = revealPoint(video);
          if (at > 0 && video.currentTime >= at) revealChoices(timed);
        });
      }
      video.addEventListener("ended", function () {
        if (activeClip !== video || currentScene !== sceneId) return;
        if (auto) autoContinue(sceneId);
        else if (choicesBox.dataset.phase === "waiting") revealChoices(timed);
      });
      video.addEventListener("error", function () {
        // A clip that won't load must not keep the choices dim (watchVideo retries and then offers Retry).
        if (activeClip === video && choicesBox.dataset.phase === "waiting") {
          delete choicesBox.dataset.auto; // a one-choice page gets its button back
          setChoicePhase("ready");
          stopChoiceWindow();
        }
      });
    } else {
      setChoicePhase("ready");
      // A draft story's scene before its media is made: its title on black, where the video will be.
      const blank = document.createElement("div");
      blank.className = "spark-video-blank";
      blank.textContent = scene.titleEn;
      videoBox.appendChild(blank);
    }

    fillSpot(storyBox, scene.story, scene.storyEn, scene.lang, scene.dir);
    fillSpot(questionBox, scene.question, scene.questionEn, scene.lang, scene.dir);
    choicesBox.replaceChildren();
    if (window.iltvDecideRelease) window.iltvDecideRelease(choicesBox);
    if (auto) choicesBox.dataset.auto = "true";
    else delete choicesBox.dataset.auto;

    const replayNow = isReplay(STORY);
    const triedHere = tried[sceneId] || [];
    if (scene.dead) addDeathButtons(scene);
    else scene.choices.forEach(function (choice, idx) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.style.setProperty("--choice-i", String(idx));
      button.dataset.choiceIndex = String(idx);
      fillSpot(button, choice.say, choice.en, scene.lang, scene.dir);
      const mark = choiceMark(STORY, unlocked, sceneId, choice.next, replayNow);
      if (triedHere.indexOf(choice.next) >= 0) {
        // A way that ended in a death, rewound from: marked in words as well as colour.
        button.classList.add("is-tried");
        button.dataset.tried = "true";
        button.title = "You tried this way and it ended badly";
        const note = document.createElement("span");
        note.className = "choice-tried";
        note.textContent = "Tried";
        button.appendChild(note);
      } else if (mark) {
        button.dataset.mark = mark;
        button.title = mark === "new" ? "A way you haven't found yet" : "You've seen everything this way leads to";
        const tag = document.createElement("span");
        tag.className = "choice-mark";
        tag.textContent = mark === "new" ? "New" : "\u2713 Seen";
        button.appendChild(tag);
      }
      if (lastWay && lastWay[history.length] === sceneId && lastWay[history.length + 1] === choice.next) {
        button.classList.add("was-taken");
        button.dataset.lastTime = "true";
      }
      button.addEventListener("click", function () {
        if (pendingTap) return;
        window.iltvDecide(choicesBox, button, function () { goTo(choice); });
      });
      choicesBox.appendChild(button);
    });
    if (!videoSrc) setChoicePhase("ready");
    // Back from a death, the fork is playable at once: the clip plays, the choices don't wait for it.
    if (rewound && scene.choices.length > 1) { setChoicePhase("ready"); stopChoiceWindow(); }

    pendingTap = null;
    preloadNext(scene);

    if (scene.choices.length === 0) {
      showEndingCard(sceneId, scene);
      endingBox.hidden = false;
    } else {
      endingBox.hidden = true;
      endingBox.replaceChildren();
    }

    if (fromPlayer) {
      // The player is a fixed-height, overflow-hidden screen: scrollIntoView would scroll it inside itself and push
      // the header out of sight, so only the page moves, back to the top.
      keepAtTop();
      fromPlayer = false;
    }

    markTreeCurrent();
    tell("scene", { story: STORY.id, scene: sceneId, path: history.concat(sceneId), video: video, explored: exploredOf(STORY, unlocked) });
  }

  /** The open story's own inventory (js/kit.js), counted along the way you came: the start, then every scene
      since (history), so a saved place gives the same counts. The Final Spark's is the flashlight. */
  function kitCounts() {
    if (!STORY || !STORY.inventory || !window.iltvKit || !currentScene) return null;
    return window.iltvKit.counts(STORY.inventory, STORY.scenes, STORY.start, history.concat(currentScene));
  }

  const exploredBox = document.getElementById("spark-explored");

  function showExplored() {
    if (exploredBox) exploredBox.textContent = exploredOf(STORY, unlocked) + "% explored";
  }

  function showKit() {
    if (window.iltvKit) window.iltvKit.show(STORY && STORY.inventory ? STORY.inventory : null, kitCounts() || {});
  }

  const treeRoot = document.getElementById("spark-tree");
  const endingsRoot = document.getElementById("spark-endings");
  const tabPlay = document.getElementById("tab-play");
  const tabTree = document.getElementById("tab-tree");
  const tabEndings = document.getElementById("tab-endings");

  function choiceLabel(text) {
    return String(text).replace(/^\d+\.\s*/, "");
  }

  function setView(view) {
    const playPane = document.getElementById("spark-play");
    if (!playPane || !treeRoot || !tabPlay || !tabTree) return;
    const mode = view === "tree" ? "tree" : (view === "endings" ? "endings" : "play");

    playPane.hidden = mode !== "play";
    treeRoot.hidden = mode !== "tree";
    if (endingsRoot) endingsRoot.hidden = mode !== "endings";
    root.classList.toggle("is-tree", mode === "tree");
    root.classList.toggle("is-endings", mode === "endings");
    tabPlay.classList.toggle("is-active", mode === "play");
    tabTree.classList.toggle("is-active", mode === "tree");
    if (tabEndings) {
      tabEndings.classList.toggle("is-active", mode === "endings");
      tabEndings.setAttribute("aria-selected", mode === "endings" ? "true" : "false");
    }
    tabPlay.setAttribute("aria-selected", mode === "play" ? "true" : "false");
    tabTree.setAttribute("aria-selected", mode === "tree" ? "true" : "false");

    if (mode === "tree") renderTree();
    if (mode === "endings") renderEndingsGallery(endingsRoot, STORY);
  }

  /** Fill an Endings gallery pane: found tiles show poster + name; locked ones a blurred poster and "???". */
  function renderEndingsGallery(pane, story) {
    if (!pane || !story) return;
    const ends = endingsOf(story);
    const found = readFoundEndings(story);
    const foundN = Object.keys(found).length;
    pane.replaceChildren();
    pane.dataset.story = story.id;

    const head = document.createElement("div");
    head.className = "endings-head";
    const title = document.createElement("h2");
    title.className = "endings-title";
    title.textContent = "Endings";
    const count = document.createElement("p");
    count.className = "endings-count";
    count.id = pane.id === "console-endings" ? "console-endings-count" : "spark-endings-count";
    count.textContent = endingsCountText(foundN, ends.length);
    head.append(title, count);
    pane.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "endings-grid";
    grid.setAttribute("role", "list");
    ends.forEach(function (entry) {
      const known = !!found[entry.id];
      const tile = document.createElement(known ? "button" : "div");
      tile.className = "ending-tile" + (known ? " is-found" : " is-locked");
      tile.dataset.ending = entry.id;
      tile.setAttribute("role", "listitem");
      if (known) {
        tile.type = "button";
        tile.setAttribute("aria-label", endingTitleOf(entry));
      } else {
        tile.setAttribute("aria-label", "Locked ending");
      }

      const media = document.createElement("div");
      media.className = "ending-tile-media";
      const poster = endingPosterOf(entry, story);
      if (poster) {
        const img = document.createElement("img");
        img.src = poster;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        media.appendChild(img);
      } else {
        media.classList.add("is-blank");
      }
      const label = document.createElement("span");
      label.className = "ending-tile-name";
      label.textContent = known ? endingTitleOf(entry) : "???";
      tile.append(media, label);
      if (known) {
        tile.addEventListener("click", function () {
          showFoundEndingCard(story, entry.id);
        });
      }
      grid.appendChild(tile);
    });
    pane.appendChild(grid);
    // Quiet lobby tick when the wall opens (no GPU: a short oscillator), skipped under reduced motion.
    try {
      if (!window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = 660;
          g.gain.value = 0.0001;
          g.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.2);
          setTimeout(function () { try { ctx.close(); } catch (e) { /* gone */ } }, 280);
        }
      }
    } catch (e) { /* autoplay / blocked */ }
    tell("feature", { name: "endings_gallery", story: story.id, found: foundN, total: ends.length });
  }

  function openEndingsGallery(story) {
    if (!story) return;
    if (story.type === "console") {
      const pane = document.getElementById("console-endings");
      const btn = document.getElementById("console-endings-btn");
      if (!pane) return;
      const open = pane.hidden;
      pane.hidden = !open;
      if (btn) btn.setAttribute("aria-pressed", open ? "true" : "false");
      if (open) renderEndingsGallery(pane, story);
      return;
    }
    setView("endings");
  }

  /** Tapping a found ending: show its ending card again (no teleport; recap of the live run only when it is the current scene). */
  function showFoundEndingCard(story, endingId) {
    const entry = endingsOf(story).filter(function (e) { return e.id === endingId; })[0];
    if (!entry || !readFoundEndings(story)[endingId]) return;
    tell("feature", { name: "ending_recall", story: story.id, ending: endingId });
    if (story.type === "console") {
      const pane = document.getElementById("console-endings");
      if (!pane) return;
      pane.replaceChildren();
      const card = document.createElement("div");
      card.className = "ending-card endings-recall";
      card.dataset.ending = endingId;
      const poster = endingPosterOf(entry, story);
      if (poster) {
        const img = document.createElement("img");
        img.className = "console-endcard";
        img.src = poster;
        img.alt = "";
        card.appendChild(img);
      }
      const kicker = document.createElement("p");
      kicker.className = "ending-kicker";
      const kick = Array.isArray(entry.ending) ? entry.ending[0] : entry.ending;
      kicker.textContent = kick || "THE END";
      const name = document.createElement("h2");
      name.className = "ending-name";
      name.textContent = endingTitleOf(entry);
      const found = readFoundEndings(story);
      const count = document.createElement("p");
      count.className = "ending-count";
      count.textContent = endingsCountText(Object.keys(found).length, endingsOf(story).length);
      const back = document.createElement("button");
      back.type = "button";
      back.className = "choice ending-gallery-btn";
      back.textContent = "Back to Endings";
      back.addEventListener("click", function () { renderEndingsGallery(pane, story); });
      card.append(kicker, name, count, back);
      pane.appendChild(card);
      return;
    }
    // Video story: switch to Play and show the card (live recap only when this ending is the current scene).
    setView("play");
    endingBox.hidden = false;
    const scene = SCENES[endingId];
    if (scene) {
      const live = currentScene === endingId;
      showEndingCard(endingId, scene, { skipRecap: !live, skipAgain: !live, way: live ? history.concat(endingId) : [endingId] });
    }
  }

  function markTreeCurrent() {
    if (!treeRoot) return;
    treeRoot.querySelectorAll(".tree-node").forEach(function (node) {
      node.classList.toggle("is-current", node.dataset.scene === currentScene);
    });
  }

  /** The Tree tab: a map of what you've found, not a way to get around. It draws only the scenes you have unlocked;
      a choice from one of them to a scene you haven't reached is a locked "?" with nothing below it (one per
      choice, so it never tells whether two ways meet, where they go, how deep it goes, or if it's a death or an
      ending). Nothing in it can be pressed; the current scene is marked. */
  function renderTree() {
    if (!treeRoot) return;

    const depthOf = {};
    const children = {};
    const spanParent = {};
    const locked = {};
    depthOf[STORY.start] = 0;
    children[STORY.start] = [];
    const extra = [];
    const queue = unlocked[STORY.start] ? [STORY.start] : [];

    while (queue.length) {
      const id = queue.shift();
      SCENES[id].choices.forEach(function (choice) {
        let next = choice.next;
        if (!SCENES[next]) return;
        if (!unlocked[next]) {
          // A locked "?": its key says nothing about the scene behind it.
          next = "?" + Object.keys(locked).length;
          locked[next] = true;
        }
        if (depthOf[next] == null) {
          depthOf[next] = depthOf[id] + 1;
          spanParent[next] = id;
          children[id].push({
            id: next,
            label: choice.say,
            en: choiceLabel(choice.en)
          });
          children[next] = [];
          if (!locked[next]) queue.push(next);
        } else {
          extra.push({
            from: id,
            to: next,
            label: choice.say
          });
        }
      });
    }

    const columns = [];
    Object.keys(depthOf).forEach(function (id) {
      const depth = depthOf[id];
      columns[depth] = columns[depth] || [];
      columns[depth].push(id);
    });

    const nodeW = 150;
    const nodeH = 68;
    const colGap = 92;
    const rowGap = 34;
    const padX = 24;
    const padY = 56;
    let maxRows = 1;
    columns.forEach(function (col) {
      if (col && col.length > maxRows) maxRows = col.length;
    });

    const columnHeight = maxRows * nodeH + (maxRows - 1) * rowGap;
    const pos = {};
    columns.forEach(function (col, depth) {
      const stack = col.length * nodeH + (col.length - 1) * rowGap;
      const offset = (columnHeight - stack) / 2;
      col.forEach(function (id, index) {
        pos[id] = {
          x: padX + depth * (nodeW + colGap),
          y: padY + offset + index * (nodeH + rowGap)
        };
      });
    });

    const width = padX * 2 + columns.length * (nodeW + colGap) - colGap;
    const height = padY * 2 + columnHeight;

    function center(id) {
      const point = pos[id];
      return {
        x: point.x + nodeW / 2,
        y: point.y + nodeH / 2
      };
    }

    const paths = [];

    function addSpan(fromId, toId) {
      const a = center(fromId);
      const b = center(toId);
      const x1 = a.x + nodeW / 2 - 4;
      const y1 = a.y;
      const x2 = b.x - nodeW / 2 + 4;
      const y2 = b.y;
      const sway = ((fromId.length * 13 + toId.length * 7) % 28) - 14;
      const d = "M " + x1 + " " + y1 +
        " C " + (x1 + 46) + " " + (y1 + sway) +
        ", " + (x2 - 46) + " " + (y2 - sway * 0.4) +
        ", " + x2 + " " + y2;
      paths.push('<path class="tendril" d="' + d + '"></path>');
    }

    Object.keys(children).forEach(function (fromId) {
      children[fromId].forEach(function (child) {
        addSpan(fromId, child.id);
      });
    });

    extra.forEach(function (edge, index) {
      const a = center(edge.from);
      const b = center(edge.to);
      const lift = 54 + Math.abs(depthOf[edge.from] - depthOf[edge.to]) * 10 + (index % 3) * 16;
      const y = Math.min(a.y, b.y) - lift;
      const d = "M " + a.x + " " + (a.y - 8) +
        " Q " + ((a.x + b.x) / 2) + " " + y +
        ", " + b.x + " " + (b.y - 8);
      paths.push('<path class="tendril-return" d="' + d + '"></path>');
    });

    const treeReplay = isReplay(STORY);
    const nodes = Object.keys(pos).map(function (id) {
      const parent = spanParent[id] ? SCENES[spanParent[id]] : null;
      const via = parent
        ? children[spanParent[id]].filter(function (child) { return child.id === id; })[0]
        : null;
      const point = pos[id];
      const at = ' style="left:' + point.x + "px;top:" + point.y + 'px"';
      const treeMark = !spanParent[id] ? "" : (locked[id] ? (treeReplay ? "new" : "")
        : (treeReplay && subtreeSeen(STORY, unlocked, spanParent[id], id) ? "seen" : ""));
      const markAttr = treeMark ? ' data-mark="' + treeMark + '"' : "";
      if (locked[id]) {
        // Only the choice you'd make to get there: you saw it on the page.
        return '<div class="tree-node is-locked"' + markAttr + at + '>' +
          '<span class="tree-node-title">?</span>' +
          (via ? '<span class="tree-node-via">' + spotHtml(via.label, via.en, parent.lang, parent.dir) + "</span>" : "") +
          "</div>";
      }
      const scene = SCENES[id];
      const viaText = via && via.en.toLowerCase() !== String(scene.titleEn).toLowerCase()
        ? via
        : null;
      return '<div class="tree-node' +
        (lastWay && lastWay.indexOf(id) >= 0 ? " is-walked" : "") +
        (scene.dead ? " is-dead" : "") +
        (id === currentScene ? " is-current" : "") +
        '" data-scene="' + id + '"' + markAttr + at + '>' +
        '<span class="tree-node-title">' + spotHtml(scene.title, scene.titleEn, scene.lang, scene.dir) + "</span>" +
        (viaText ? '<span class="tree-node-via">' + spotHtml(viaText.label, viaText.en, parent.lang, parent.dir) + "</span>" : "") +
        "</div>";
    }).join("");

    treeRoot.innerHTML =
      '<p class="tree-note">What you have found: ' + exploredOf(STORY, unlocked) + '% explored. Drag sideways. A ? is a way you haven\'t taken.' + (treeReplay ? ' New: a way you haven\'t found. A tick: everything down that way is seen.' : '') + (lastWay ? ' Marked: the path of your last run.' : '') + '</p>' +
      '<div class="tree-scroll"><div class="tree-canvas" style="width:' + width + "px;height:" + height + 'px">' +
      '<svg class="tree-svg" viewBox="0 0 ' + width + " " + height + '" aria-hidden="true">' +
      paths.join("") +
      "</svg>" +
      nodes +
      "</div></div>";

    const scroller = treeRoot.querySelector(".tree-scroll");
    // Open fitted: the root and its first children (two columns) always fully in view, however narrow the screen
    // (a phone shrinks the map, at most to 60%); the viewer pans from there.
    const canvas = scroller.querySelector(".tree-canvas");
    const firstTwo = padX * 2 + 2 * nodeW + colGap;
    const room = scroller.clientWidth;
    if (room > 0 && room < firstTwo) canvas.style.zoom = String(Math.max(0.6, room / firstTwo));
    scroller.scrollLeft = 0;
    scroller.scrollTop = 0;
    bindTreePan(scroller);
  }

  function bindTreePan(scroller) {
    if (!scroller) return;
    let active = false;
    let moved = false;
    let suppressClick = false;
    let suppressTimer = 0;
    let pointerId = null;
    let originX = 0;
    let originY = 0;
    let originLeft = 0;
    let originTop = 0;

    scroller.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      active = true;
      moved = false;
      pointerId = event.pointerId;
      originX = event.clientX;
      originY = event.clientY;
      originLeft = scroller.scrollLeft;
      originTop = scroller.scrollTop;
      scroller.classList.add("is-dragging");
      scroller.setPointerCapture(event.pointerId);
      if (event.pointerType === "mouse") event.preventDefault();
    });

    scroller.addEventListener("pointermove", function (event) {
      if (!active || event.pointerId !== pointerId) return;
      const dx = event.clientX - originX;
      const dy = event.clientY - originY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      scroller.scrollLeft = originLeft - dx;
      scroller.scrollTop = originTop - dy;
    });

    function stopPan(event) {
      if (!active || event.pointerId !== pointerId) return;
      active = false;
      scroller.classList.remove("is-dragging");
      if (scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId);
      }
      if (moved) {
        suppressClick = true;
        clearTimeout(suppressTimer);
        suppressTimer = setTimeout(function () { suppressClick = false; }, 80);
      }
    }

    scroller.addEventListener("pointerup", stopPan);
    scroller.addEventListener("pointercancel", stopPan);

    scroller.addEventListener("click", function (event) {
      if (!suppressClick) return;
      suppressClick = false;
      clearTimeout(suppressTimer);
      event.preventDefault();
      event.stopPropagation();
    }, true);

    scroller.addEventListener("wheel", function (event) {
      const maxX = scroller.scrollWidth - scroller.clientWidth;
      const maxY = scroller.scrollHeight - scroller.clientHeight;
      if (maxY > 8 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) return;
      if (maxX <= 1) return;
      event.preventDefault();
      scroller.scrollLeft += event.deltaX !== 0 ? event.deltaX : event.deltaY;
    }, { passive: false });
  }

  if (tabPlay && tabTree) {
    tabPlay.addEventListener("click", function () { setView("play"); });
    tabTree.addEventListener("click", function () { setView("tree"); });
    if (tabEndings) tabEndings.addEventListener("click", function () { setView("endings"); });
  }

  /* ---------------- the landing page and the stories ---------------- */

  const SITE_TITLE = document.title;
  const SITE_TAP = {
    title: document.documentElement.getAttribute("data-tap-title") || "",
    line: document.documentElement.getAttribute("data-tap-line") || ""
  };

  /** Scene changes cross-fade (J, 2026-11-10): the outgoing clip or card stays as a layer above the incoming one,
      fading out over FADE ms while its audio fades with it; the incoming clip is already playing under it. */
  function fadeMs() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 350;
  }

  const RECAP_MS = 3000;

  /** The Continue "Previously" overlay: built once, shown over the player for ~3 s (tap skips). */
  function recapEl() {
    let el = document.getElementById("story-recap");
    if (el) return el;
    el = document.createElement("div");
    el.id = "story-recap";
    el.className = "story-recap";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Previously");
    el.innerHTML =
      '<div class="story-recap-stage" aria-hidden="true"><img class="story-recap-poster" alt=""></div>' +
      '<div class="story-recap-copy">' +
      '<p class="story-recap-kicker">Previously</p>' +
      '<h2 class="story-recap-title"></h2>' +
      '<p class="story-recap-line"></p>' +
      "</div>" +
      '<p class="story-recap-skip">Tap to skip</p>';
    document.body.appendChild(el);
    return el;
  }

  function canRecap(saved) {
    return !!(saved && saved.from && saved.choice && (saved.poster || posterOfScene(STORY, saved.from)));
  }

  /** Runs after the Tap to play prompt is gone (or at once if sound is already unlocked).
      Failsafe: if the prompt never clears (observer miss, stuck overlay), dismiss it and continue so
      Continue never leaves a blank page under a forever-waiting handoff. */
  function afterPrompt(fn) {
    if (!window.hawkesSound || !window.hawkesSound.prompt()) {
      fn();
      return;
    }
    let done = false;
    function go() {
      if (done) return;
      done = true;
      try { obs.disconnect(); } catch (error) { /* gone */ }
      document.body.removeEventListener("click", onAct, true);
      document.body.removeEventListener("keydown", onAct, true);
      clearTimeout(fail);
      fn();
    }
    function ready() {
      return !window.hawkesSound || !window.hawkesSound.prompt();
    }
    function onAct() {
      if (ready()) go();
    }
    const obs = new MutationObserver(function () {
      if (ready()) go();
    });
    // class "is-gone" is set before the node is removed; overlay is nulled on tap before either.
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    document.body.addEventListener("click", onAct, true);
    document.body.addEventListener("keydown", onAct, true);
    const fail = setTimeout(function () {
      const prompt = window.hawkesSound && window.hawkesSound.prompt();
      if (prompt) {
        try { prompt.click(); } catch (error) { /* ignore */ }
      }
      go();
    }, 8000);
  }

  function stopRecapTimers() {
    if (recapTimer) { clearTimeout(recapTimer); recapTimer = null; }
    if (recapRaf) { cancelAnimationFrame(recapRaf); recapRaf = null; }
    if (recapGuard) { clearTimeout(recapGuard); recapGuard = null; }
  }

  function pauseClipsForRecap() {
    videoBox.querySelectorAll("video").forEach(function (video) {
      try { video.pause(); } catch (error) { /* gone */ }
    });
  }

  function resumeClipsAfterRecap() {
    videoBox.querySelectorAll("video:not(.spark-leave)").forEach(function (video) {
      if (video.ended) return;
      const play = video.play();
      if (play && play.catch) play.catch(function () {});
    });
  }

  /** 3 s Previously moment on Continue: last scene's poster with a slow push-in, the story title, one short line
      naming the last choice; a tap skips; then a cross-fade into the scene already waiting underneath. */
  function playRecap(story, saved, then) {
    stopRecapTimers();
    const el = recapEl();
    const img = el.querySelector(".story-recap-poster");
    const title = el.querySelector(".story-recap-title");
    const line = el.querySelector(".story-recap-line");
    const poster = saved.poster || posterOfScene(story, saved.from);
    img.removeAttribute("src");
    if (poster) img.src = poster;
    title.textContent = story.title;
    line.textContent = saved.choice;
    el.dataset.story = story.id;
    el.dataset.from = saved.from;
    el.dataset.choice = saved.choice;
    el.dataset.poster = poster || "";
    el.classList.remove("is-leaving");
    el.hidden = false;
    document.documentElement.dataset.recap = "1";
    pauseClipsForRecap();
    tell("feature", { feature: "recap", story: story.id, from: saved.from, choice: saved.choice });

    const ms = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1200 : RECAP_MS;
    const fade = fadeMs();
    el.style.setProperty("--recap-ms", ms + "ms");
    el.style.setProperty("--fade-ms", fade + "ms");

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      stopRecapTimers();
      el.removeEventListener("click", skip);
      el.classList.add("is-leaving");
      recapTimer = setTimeout(function () {
        el.hidden = true;
        el.classList.remove("is-leaving");
        delete document.documentElement.dataset.recap;
        delete el.dataset.story;
        delete el.dataset.from;
        delete el.dataset.choice;
        delete el.dataset.poster;
        resumeClipsAfterRecap();
        tell("feature", { feature: "recap_done", story: story.id, skipped: finish.skipped || false });
        if (typeof then === "function") then();
      }, fade + 20);
    }
    function skip() {
      finish.skipped = true;
      finish();
    }
    el.addEventListener("click", skip);
    recapTimer = setTimeout(finish, ms);
    // Hard cap: never leave Previously up (or data-recap held) if a timer is lost — show the scene underneath.
    recapGuard = setTimeout(function () {
      if (!done) {
        finish.skipped = true;
        finish();
      }
    }, ms + fade + 1500);
  }

  function queueRecap(story, saved, then) {
    if (!canRecap(saved)) {
      delete document.documentElement.dataset.recap;
      if (typeof then === "function") then();
      return;
    }
    afterPrompt(function () {
      // Failsafe may fire after All stories: never show Previously over the landing page.
      if (STORY !== story || document.documentElement.dataset.view !== "story") {
        delete document.documentElement.dataset.recap;
        return;
      }
      playRecap(story, saved, then);
    });
  }

  function crossfadeOut() {
    const ms = fadeMs();
    const old = Array.prototype.slice.call(videoBox.children);
    old.forEach(function (node) {
      const keep = node.tagName === "VIDEO" || node.classList.contains("spark-video-blank");
      if (!keep || node.classList.contains("spark-leave")) { node.remove(); return; }
      node.classList.add("spark-leave");
      node.style.setProperty("--fade-ms", ms + "ms");
      node.removeAttribute("data-sound-start");
      const started = performance.now();
      const from = node.tagName === "VIDEO" ? node.volume : 0;
      (function step(now) {
        const t = Math.min(1, ((now || performance.now()) - started) / ms);
        if (node.tagName === "VIDEO") { try { node.volume = from * (1 - t); } catch (error) { /* ignore */ } }
        if (t < 1 && node.isConnected) requestAnimationFrame(step);
      })();
      setTimeout(function () {
        if (node.tagName === "VIDEO") { try { node.pause(); } catch (error) { /* gone */ } }
        node.remove();
      }, ms + 40);
    });
    videoBox.dataset.fadeMs = String(ms);
    videoBox.dataset.fadedAt = String(Math.round(performance.now()));
  }

  function stopVideo() {
    stopClipUnlock();
    activeClip = null;
    if (window.iltvAudio) window.iltvAudio.unwatch();
    videoBox.querySelectorAll("video").forEach(function (video) {
      try { video.pause(); } catch (error) { /* already gone */ }
    });
    videoBox.replaceChildren();
  }

  function urlFor(storyId) {
    const url = new URL(location.href);
    if (storyId) url.searchParams.set("story", storyId);
    else url.searchParams.delete("story");
    url.hash = "";
    return url.pathname + url.search;
  }

  function prompt(words, poster) {
    if (window.hawkesSound && window.hawkesSound.label) window.hawkesSound.label(words.title, words.line, poster || "");
  }

  /** The picture behind a story's Tap to play: its first clip's poster, or (a console story has no clip) its card image. */
  function posterOfStory(story) {
    const first = story.scenes && story.scenes[story.start];
    if (first && first.poster) return first.poster;
    return story.image ? story.image.replace(/\.jpg$/, ".webp") : "";
  }

  // js/hawkes-sound.js on the home page (<html data-tap-splash>): a story asks for its own Tap to play (that tap
  // unlocks sound); the landing page has no video, so the first time in a session it shows the site's title splash instead.
  const SPLASH_KEY = "iltv.splashed";
  let splashed = false;
  try {
    splashed = sessionStorage.getItem(SPLASH_KEY) === "1";
  } catch (error) { /* storage blocked */ }
  function markSplashed() {
    splashed = true;
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch (error) { /* storage blocked */ }
  }
  function sound(what, arg) {
    if (window.hawkesSound && window.hawkesSound[what]) window.hawkesSound[what](arg);
  }

  // The badge on a story's card: the viewer's own progress, from its saved place (opening a story saves one).
  const BADGES = { "new": "Not started", started: "Started", completed: "Completed" };

  /** A story's progress: "new" (nothing reached yet), "started" or "completed" (an ending reached once). */
  function progressOf(story) {
    const unlocks = readUnlocks(story);
    if (unlocks.completed) return "completed";
    return Object.keys(unlocks.seen).length || readProgress(story, story.scenes) ? "started" : "new";
  }

  /** Where a story's current run is: "start" (none, or at its first page), "end" (at an ending) or "mid". */
  function runOf(story) {
    const run = readProgress(story, story.scenes);
    if (!run || run.scene === story.start) return "start";
    return story.scenes[run.scene].ending ? "end" : "mid";
  }

  const GO = { start: "Play", mid: "Continue", end: "Start Over" };

  /** Each card's badge (Not started, Started, Completed), how much of it is explored, and its button: Start Over
      once completed (or at an ending), Play (no run, or at the start) or Continue (mid-run). */
  function markCards() {
    if (!storyList) return;
    storyList.querySelectorAll(".story-card").forEach(function (card) {
      const story = STORIES[card.dataset.story];
      if (!story) return;
      const progress = progressOf(story);
      const run = runOf(story);
      card.dataset.progress = progress;
      card.dataset.run = run;
      const heroEl = landing.querySelector(".hero");
      if (heroEl && heroEl.dataset.story === story.id) card.dataset.featured = "";
      const badge = card.querySelector(".story-card-ribbon");
      if (badge) badge.textContent = BADGES[progress];
      const explored = card.querySelector(".story-card-explored");
      if (explored) explored.textContent = exploredOf(story, readUnlocks(story).seen) + "% explored";
      const endsEl = card.querySelector(".story-card-endings");
      if (endsEl) {
        const total = endingsOf(story).length;
        const foundN = Object.keys(readFoundEndings(story)).length;
        endsEl.hidden = !total;
        endsEl.textContent = endingsCardText(foundN, total);
        endsEl.dataset.found = String(foundN);
        endsEl.dataset.total = String(total);
        card.dataset.allEndings = total && foundN >= total ? "true" : "false";
      }
      const go = card.querySelector(".story-card-go");
      if (go) go.textContent = progress === "completed" ? "Start Over" : GO[run];
    });
    markHero();
    markContinue();
  }

  /** The hero already shows the featured story (and its Continue button). */
  function isFeatured(story) {
    const hero = landing.querySelector(".hero");
    return !!hero && hero.dataset.story === story.id;
  }

  /** The hero's button follows the run the way a card's does. */
  function markHero() {
    const hero = landing.querySelector(".hero");
    const story = hero && STORIES[hero.dataset.story];
    if (!story) return;
    const progress = progressOf(story);
    const run = runOf(story);
    hero.dataset.progress = progress;
    hero.dataset.run = run;
    const go = hero.querySelector(".hero-go");
    if (go) go.textContent = progress === "completed" ? "Start Over" : GO[run];
  }

  /** Continue watching: a card for every listed story whose run is somewhere in the middle (in the catalogue's
      order), with its percent explored. Hidden when there is none. */
  function markContinue() {
    const row = document.getElementById("continue-row");
    const list = document.getElementById("continue-list");
    if (!row || !list) return;
    list.replaceChildren();
    DATA.stories.filter(function (story) { return story.listed && runOf(story) === "mid" && !isFeatured(story); }).forEach(function (story) {
      const src = storyList.querySelector('.story-card[data-story="' + story.id + '"]');
      if (!src) return;
      const a = document.createElement("a");
      a.className = "continue-card";
      a.href = "/?story=" + story.id;
      a.dataset.story = story.id;
      a.dataset.run = "mid";
      const img = src.querySelector("img, video");
      if (img) a.appendChild(img.cloneNode(true));
      const text = document.createElement("div");
      text.className = "continue-card-text";
      const h = document.createElement("h3");
      h.textContent = story.title;
      const pct = exploredOf(story, readUnlocks(story).seen);
      const bar = document.createElement("span");
      bar.className = "continue-bar";
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", pct + "% explored");
      const fill = document.createElement("span");
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      const meta = document.createElement("span");
      meta.className = "continue-meta";
      meta.textContent = pct + "% explored";
      const go = document.createElement("span");
      go.className = "continue-go";
      go.textContent = "Continue";
      text.append(h, bar, meta, go);
      a.appendChild(text);
      list.appendChild(a);
    });
    row.hidden = !list.children.length;
  }

  /** A console story (js/console.js) has its own player, not the video one. */
  function closeConsole() {
    if (window.iltvConsole) window.iltvConsole.close();
    if (consoleBox) consoleBox.hidden = true;
    delete document.documentElement.dataset.type;
  }

  const consoleHooks = {
    visit: function (sceneId) {
      currentScene = sceneId;
      unlocked[sceneId] = true;
      if (STORY.scenes[sceneId].ending) {
        completed = true;
        markEndingFound(STORY, sceneId);
      }
      saveProgress();
      return exploredOf(STORY, unlocked);
    },
    history: function (ids) { history = ids.slice(); },
    tell: tell,
    endingsGallery: function () { openEndingsGallery(STORY); }
  };

  function openConsole(story, withRecap) {
    stopChoiceWindow();
    stopVideo();
    STORY = story;
    SCENES = story.scenes;
    document.title = story.title + " · " + SITE_TITLE;
    prompt(story.tap, posterOfStory(story));
    sound("ask");
    markSplashed();
    landing.hidden = true;
    root.hidden = true;
    if (firstScreen) firstScreen.classList.remove("is-landing");
    document.documentElement.dataset.view = "story";
    document.documentElement.dataset.type = "console";
    audioBed(story);
    delete document.documentElement.dataset.kit;
    showKit();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const saved = readProgress(story, story.scenes);
    const unlocks = readUnlocks(story);
    history = [];
    unlocked = unlocks.seen;
    completed = unlocks.completed;
    if (saved && saved.from && saved.choice) {
      lastRecap = { from: saved.from, choice: saved.choice, poster: saved.poster || posterOfScene(story, saved.from) };
    } else {
      lastRecap = null;
    }
    tell("open", { story: story.id, resumed: !!saved && saved.scene !== story.start });
    function startConsole() {
      window.iltvConsole.open(story, consoleHooks, saved ? saved.scene : null);
    }
    // Continue: open the left-off scene under the overlay (same as video stories), hold voiced lines while
    // Previously is up (html[data-recap], js/console.js), then cross-fade the overlay away. Opening only after
    // the overlay left a blank body at short landscape sizes (844x390) once it faded.
    if (withRecap && canRecap(saved)) {
      document.documentElement.dataset.recap = "1";
      startConsole();
      queueRecap(story, saved, null);
    } else {
      startConsole();
    }
  }

  function openStory(storyId, push, withRecap) {
    const story = STORIES[storyId];
    if (!story) return showLanding(false);
    if (push) window.history.pushState({ story: storyId }, "", urlFor(storyId));
    closeConsole();
    if (story.type === "console" && window.iltvConsole) return openConsole(story, withRecap);
    if (STORY !== story) {
      stopVideo();
      STORY = story;
      SCENES = scenesOf(story);
      if (treeRoot) treeRoot.replaceChildren();
    }
    titleBox.textContent = story.title.toUpperCase();
    taglineBox.textContent = story.tagline;
    taglineBox.hidden = !story.tagline;
    const tabs = root.querySelector(".spark-tabs");
    if (tabs) tabs.setAttribute("aria-label", story.title);
    if (langBox) {
      const langs = {};
      Object.keys(SCENES).forEach(function (id) { langs[SCENES[id].lang] = true; });
      langBox.hidden = Object.keys(langs).filter(function (l) { return l && l !== "en"; }).length < 1;
    }
    syncReading();
    document.title = story.title + " · " + SITE_TITLE;
    prompt(story.tap, posterOfStory(story));
    sound("ask");
    markSplashed();

    landing.hidden = true;
    root.hidden = false;
    if (firstScreen) firstScreen.classList.remove("is-landing");
    document.documentElement.dataset.view = "story";
    if (story.inventory) document.documentElement.dataset.kit = story.id;
    else delete document.documentElement.dataset.kit;
    setView("play");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    keepAtTop();

    const saved = readProgress(story, SCENES);
    const unlocks = readUnlocks(story);
    history = saved ? saved.history : [];
    tried = saved ? saved.tried : {};
    lastWay = readLastWay(story, SCENES);
    unlocked = unlocks.seen;
    completed = unlocks.completed;
    if (saved && saved.from && saved.choice) {
      lastRecap = { from: saved.from, choice: saved.choice, poster: saved.poster || posterOfScene(story, saved.from) };
    } else if (!(saved && saved.scene !== story.start)) {
      lastRecap = null;
    }
    tell("open", { story: story.id, resumed: !!saved && saved.scene !== story.start });
    audioBed(story);
    show(saved ? saved.scene : story.start);
    keepAtTop();
    requestAnimationFrame(function () { requestAnimationFrame(keepAtTop); });
    // Continue: the scene is already under the overlay; Previously holds 3 s (or a tap), then reveals it.
    if (withRecap && canRecap(saved)) queueRecap(story, saved, null);
  }

  function hideRecap() {
    stopRecapTimers();
    const el = document.getElementById("story-recap");
    if (el) {
      el.hidden = true;
      el.classList.remove("is-leaving");
      delete el.dataset.story;
      delete el.dataset.from;
      delete el.dataset.choice;
      delete el.dataset.poster;
    }
    delete document.documentElement.dataset.recap;
  }

  function showLanding(push) {
    tell("landing", { story: STORY ? STORY.id : null, scene: currentScene });
    hideRecap();
    closeConsole();
    if (push) window.history.pushState({}, "", urlFor(null));
    else if (new URL(location.href).searchParams.has("story")) window.history.replaceState({}, "", urlFor(null));
    stopChoiceWindow();
    stopVideo();
    if (window.iltvAudio) {
      window.iltvAudio.unwatch();
      window.iltvAudio.setBed(null, null);
    }
    STORY = null;
    currentScene = null;
    lastRecap = null;
    wantRecap = false;
    root.hidden = true;
    landing.hidden = false;
    if (firstScreen) firstScreen.classList.add("is-landing");
    document.documentElement.dataset.view = "landing";
    delete document.documentElement.dataset.kit;
    delete document.documentElement.dataset.type;
    showKit();
    document.title = SITE_TITLE;
    prompt(SITE_TAP);
    sound("dismiss");
    if (!splashed && location.hash !== "#blog") sound("splash", SITE_TAP.title);
    markSplashed();
    markCards();
  }

  function route() {
    const id = new URL(location.href).searchParams.get("story");
    if (id && STORIES[id]) openStory(id, false);
    else showLanding(false);
  }

  if (storyList) {
    landing.addEventListener("click", function (event) {
      const card = event.target.closest && event.target.closest("a.story-card, a.hero, a.continue-card");
      if (!card || !STORIES[card.dataset.story]) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault();
      // Once completed (or at an ending) the card says Start Over: the run goes (its unlocks stay), and it opens at the start.
      const startOver = card.dataset.progress === "completed" || card.dataset.run === "end";
      if (startOver) {
        clearProgress(STORIES[card.dataset.story]);
        tell("restart", { story: card.dataset.story, via: "start_over" });
      }
      const go = startOver ? "end" : card.dataset.run;
      // Continue (mid-run) opens with a short Previously recap; Play and Start Over go straight in.
      wantRecap = go === "mid";
      tell("card", { story: card.dataset.story, go: go, progress: card.dataset.progress });
      openStory(card.dataset.story, true, wantRecap);
      wantRecap = false;
    });
  }

  if (storiesLink) {
    storiesLink.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault();
      showLanding(true);
    });
  }

  if (consoleLink) {
    consoleLink.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault();
      showLanding(true);
    });
  }

  window.addEventListener("popstate", route);
  // Back to the landing page from another page or tab (the browser's back cache, a story played in another tab):
  // the badges follow the saved places.
  window.addEventListener("pageshow", function () { if (!STORY) markCards(); });
  document.addEventListener("visibilitychange", function () { if (!STORY && document.visibilityState === "visible") markCards(); });

  // Read-only views for the playtest (js/playtest.js): the open story's player, and the stories.
  window.finalSpark = {
    story: function () { return STORY ? STORY.id : null; },
    start: function () { return STORY ? STORY.start : null; },
    scene: function () { return currentScene; },
    scenes: function () { return Object.keys(SCENES); },
    depth: function () { return history.length; },
    path: function () { return currentScene ? history.concat(currentScene) : []; },
    unlocked: function () { return STORY ? Object.keys(unlocked) : []; },
    explored: function () { return STORY ? exploredOf(STORY, unlocked) : null; },
    inventory: function () { return kitCounts(); },
    /** The run's flags (a choice's `set`) and, per fork, the options rewound from after a death. */
    flags: function () { return Object.assign({}, flags); },
    tried: function () { return JSON.parse(JSON.stringify(tried)); },
    /** Every scene's choices as the player has them (next, default, set). */
    choicesOf: function (id) { return SCENES[id] ? SCENES[id].choices.map(function (c) { return { next: c.next, default: c.default, set: c.set }; }) : []; },
    /** Ending nodes from the build, and which of them this browser has found. */
    endings: function () { return STORY ? endingsOf(STORY).map(function (e) { return e.id; }) : []; },
    foundEndings: function () { return STORY ? Object.keys(readFoundEndings(STORY)) : []; }
  };
  window.iltvStories = {
    list: function () { return DATA.stories.map(function (story) { return story.id; }); },
    listed: function () { return DATA.stories.filter(function (story) { return story.listed; }).map(function (story) { return story.id; }); },
    current: function () { return STORY ? STORY.id : null; },
    progress: function (id) { return STORIES[id] ? progressOf(STORIES[id]) : null; },
    run: function (id) { return STORIES[id] ? runOf(STORIES[id]) : null; },
    explored: function (id) { return STORIES[id] ? exploredOf(STORIES[id], readUnlocks(STORIES[id]).seen) : null; },
    view: function () { return STORY ? "story" : "landing"; },
    endings: function (id) {
      const story = STORIES[id];
      return story ? endingsOf(story).map(function (e) {
        return { id: e.id, title: endingTitleOf(e), poster: endingPosterOf(e, story) || "", found: !!readFoundEndings(story)[e.id] };
      }) : null;
    },
    endingsCount: function (id) {
      const story = STORIES[id];
      return story ? { found: Object.keys(readFoundEndings(story)).length, total: endingsOf(story).length } : null;
    },
    foundEndings: function (id) {
      return STORIES[id] ? Object.keys(readFoundEndings(STORIES[id])) : null;
    },
    /** The Continue Previously overlay while it is up: { story, from, choice, poster }, or null. */
    recap: function () {
      const el = document.getElementById("story-recap");
      if (!el || el.hidden || !el.dataset.story) return null;
      return { story: el.dataset.story, from: el.dataset.from, choice: el.dataset.choice, poster: el.dataset.poster || "" };
    }
  };

  // Console Endings button (same gallery as the video player's Endings tab).
  const consoleEndingsBtn = document.getElementById("console-endings-btn");
  if (consoleEndingsBtn) {
    consoleEndingsBtn.addEventListener("click", function () {
      if (STORY && STORY.type === "console") openEndingsGallery(STORY);
    });
  }

  route();
})();
