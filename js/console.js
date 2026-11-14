/* The player for console stories (story type "console", story doc: story/README.md, "Console stories").

   A console story is heard first: each scene is a few voiced lines that follow one another by themselves over an
   ambience bed, in a control room (js/console-room.js: the people in it are silhouettes that act what the lines say) with
   one big screen that the people switch between the cameras, a strip of the nine cameras under it. When the lines are done the choices appear; a choice can need flags or meters and sets or changes
   them (js/console-rules.js has those rules, the build checks them). The Tree of the video stories is a shift log
   here: a ruled Daily Activity Report of what the player has done and seen, with redacted lines for the ways not taken.

   js/game.js opens it (iltvConsole.open) and hands it hooks: visit() unlocks a scene (the card's badge and percent
   explored), choice() and tell() tell Hawkes Analytics, and the cookies stay game.js's. Everything this file owns is
   the run: the scene, the way there, the flags and meters, the log, and how many lines were heard, saved whole in
   localStorage "iltv.run.<cookie>" so a returning player resumes in the same scene with the same state.

   Sound is the studio's standard setup (js/hawkes-sound.js): the voice, the ambience bed and the sound effects
   are three <audio> elements marked data-sound-start, so the Tap to play press starts (and, on iOS, unlocks) them;
   Settings (on/off, volume) applies to all three. Lines start only once sound is unlocked. */
(function () {
  "use strict";
  var rules = window.iltvConsoleRules;
  var box = document.getElementById("console");
  if (!rules || !box) return;

  var RUN_KEY = "iltv.run.";
  var SUBS_KEY = "iltv.subtitles";
  var GAP = 350; // ms between two lines
  // A silent clip, so the three audio elements can be started inside the Tap to play press (iOS) before any real line.
  var SILENCE = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    title: $("console-title"),
    time: $("console-time"),
    explored: $("console-explored"),
    cc: $("console-cc"),
    logBtn: $("console-log-btn"),
    wall: $("console-wall"),
    big: $("console-big"),
    subs: $("console-subs"),
    replay: $("console-replay"),
    skip: $("console-skip"),
    choices: $("console-choices"),
    ending: $("console-ending"),
    log: $("console-log"),
    logPage: $("console-log-page"),
  };

  var story = null;
  var hooks = null;
  var run = null; // { scene, history, st, log, done, sel }
  var flow = 0; // bumped to cancel the lines in progress
  var linePlaying = null; // { index } while a line is being heard
  var lastFinish = null; // ends the line being heard now (Skip)
  var skipped = false; // the line just ended was skipped: the next one follows with no pause
  var voice = null;
  var bed = null;
  var sfx = null;
  var sting = null;
  var bedCue = null;
  var subsOn = true;
  var inkTimer = 0; // pending ink / chapter hand-off (cleared on close)
  var chapterTimer = 0;

  try {
    subsOn = localStorage.getItem(SUBS_KEY) !== "off";
  } catch (e) { /* storage blocked: subtitles stay on */ }

  /* ---------------- the run, saved whole ---------------- */

  function runKey() { return RUN_KEY + story.cookie; }

  // With localStorage blocked (a private window) the run is kept here, so All stories and back, and the Log, still work
  // within the page; a reload then starts the story over.
  var memory = {};

  function stored() {
    try {
      return localStorage.getItem(runKey());
    } catch (e) {
      return memory[runKey()];
    }
  }

  function save() {
    if (!story || !run) return;
    var text = JSON.stringify({
        v: 1,
        scene: run.scene,
        history: run.history,
        flags: Object.keys(run.st.flags),
        meters: run.st.meters,
        log: run.log,
        done: run.done,
        sel: run.sel,
        pose: run.pose || null,
        chapter: run.chapter || null,
      });
    memory[runKey()] = text;
    try {
      localStorage.setItem(runKey(), text);
    } catch (e) { /* private mode: the run holds for this page */ }
  }

  function fresh() {
    return { scene: story.start, history: [], st: rules.fresh(story), log: [], done: 0, sel: null, pose: null, chapter: chapterOfScene(story.start) };
  }

  /** The saved run, if it is this story's and still makes sense (the scenes it names exist) and matches the cookie's place. */
  function load(cookieScene) {
    if (!cookieScene) return null;
    try {
      var saved = JSON.parse(stored());
      if (!saved || saved.v !== 1 || saved.scene !== cookieScene || !story.scenes[saved.scene]) return null;
      var st = rules.fresh(story);
      (saved.flags || []).forEach(function (f) { if (story.state.flags.indexOf(f) >= 0) st.flags[f] = true; });
      Object.keys(saved.meters || {}).forEach(function (m) { if (m in st.meters) st.meters[m] = saved.meters[m]; });
      return {
        scene: saved.scene,
        history: (saved.history || []).filter(function (id) { return !!story.scenes[id]; }),
        st: st,
        log: Array.isArray(saved.log) ? saved.log : [],
        done: Math.max(0, Math.min(saved.done | 0, story.scenes[saved.scene].lines.length)),
        sel: saved.sel && story.cameras.some(function (c) { return c.id === saved.sel; }) ? saved.sel : null,
        pose: saved.pose === "sit" || saved.pose === "stand" ? saved.pose : null,
        chapter: saved.chapter || chapterOfScene(saved.scene),
      };
    } catch (e) {
      return null;
    }
  }

  /** Which chapter a scene belongs to (authored chapter list in story order). */
  function chapterOfScene(id) {
    var list = (story && story.chapters) || [];
    if (!list.length) return null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].start === id || list[i].end === id) return list[i].id;
    }
    if (run && run.chapter) return run.chapter;
    if (run && run.history) {
      var found = list[0].id;
      for (i = 0; i < list.length; i++) {
        if (run.history.indexOf(list[i].start) >= 0) found = list[i].id;
      }
      return found;
    }
    return list[0].id;
  }

  function chapterById(id) {
    var list = (story && story.chapters) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function chapterEnding(sceneId) {
    var list = (story && story.chapters) || [];
    for (var i = 0; i < list.length; i++) if (list[i].end === sceneId) return list[i];
    return null;
  }

  /** A choice that changes trainer_trust or sets/clears a flag (the ink / "remember that" beat). */
  function choiceLands(before, after, extra) {
    if (extra && ((extra.set && extra.set.length) || (extra.clear && extra.clear.length))) return true;
    if (extra && extra.add && extra.add.trainer_trust) return true;
    if (before.meters.trainer_trust !== after.meters.trainer_trust) return true;
    var k;
    for (k in after.flags) if (after.flags[k] && !before.flags[k]) return true;
    for (k in before.flags) if (before.flags[k] && !after.flags[k]) return true;
    return false;
  }

  /* ---------------- sound ---------------- */

  // The four elements live for the page, not for one opening: a phone (iOS) lets an element play only once a press
  // has started it, so an element made after the Tap to play (a second story, All stories and back) would stay silent.
  // close() takes them off the page and open() puts the same, already unlocked, ones back.
  var pool = {};
  var POOL_KEYS = ["voice", "bed", "sfx", "sting"];
  /** One of the four page-long elements, made once (not put on the page: makeAudio does that when a story opens). */
  function poolAudio(key) {
    var a = pool[key];
    if (a) return a;
    a = pool[key] = document.createElement("audio");
    a.addEventListener("playing", function () { a._primed = true; });
    a.src = SILENCE;
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    a.setAttribute("data-sound-start", "");
    return a;
  }
  function makeAudio(loop, key) {
    var a = pool[key];
    var fresh = !a;
    a = poolAudio(key);
    if (!fresh) {
      a.onended = a.onerror = null;
      try { a.pause(); } catch (e) { /* gone */ }
      a.src = SILENCE;
    }
    a.loop = !!loop;
    document.body.appendChild(a);
    if (window.hawkesSound) window.hawkesSound.apply(a);
    return a;
  }
  // The four exist from the start, so the very first press that unlocks sound (any story's Tap to play, or a card's
  // press once sound is on) starts every one of them: a story opened later, or second, never has an element no press
  // has started (iOS refuses those, without a word, and the story plays silent).
  POOL_KEYS.forEach(poolAudio);

  /** Any press while sound is unlocked starts every element no press has started yet (a phone's unlock is per
      element), so every later line, bed and effect plays without another tap. An idle one plays its silent clip; one
      that holds a file is started and paused at once, inside the press, so nothing is heard early. */
  function prime() {
    if (!soundReady()) return;
    POOL_KEYS.forEach(function (key) {
      var a = pool[key];
      if (!a || a._primed || !a.paused) return;
      var idle = a.src === SILENCE;
      try {
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
        if (!idle) { a.pause(); a._primed = true; }
      } catch (e) { /* not now */ }
    });
  }
  ["touchend", "pointerup", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, prime, true);
  });
  // The Tap to play press itself (js/hawkes-sound.js says so inside the press): start all four, and bring back the bed
  // a refused start left paused. A line that was refused waits for this too (playLine), with no timer.
  document.addEventListener("hawkes:unlocked", function () {
    prime();
    if (story && bed && bed.paused && bed.src !== SILENCE && bedCue) playEl(bed).catch(function () {});
  });

  function soundReady() {
    return !window.hawkesSound || window.hawkesSound.unlocked();
  }

  /** A music sting (story.music): plays once as a scene opens, under its first line, never looped. */
  function playSting(cue) {
    var file = cue && story.music ? story.music[cue] : null;
    if (!sting || !file) return;
    sting.src = file;
    sting.loop = false;
    if (soundReady()) playEl(sting).catch(function () {});
  }

  function playEl(a) {
    var sound = window.hawkesSound;
    if (sound) {
      sound.apply(a);
      var p;
      try { p = a.play(); } catch (e) { return Promise.reject(e); }
      return p && p.then ? p : Promise.resolve();
    }
    var q = a.play();
    return q && q.then ? q : Promise.resolve();
  }

  /** The story's other beds are fetched a moment after it opens, so a scene that changes the bed finds it in the cache
      and the bed starts at once (nothing silent between scenes). */
  var warmed = {};
  function warmBeds() {
    setTimeout(function () {
      Object.keys((story && story.ambience) || {}).forEach(function (k) {
        var f = story.ambience[k];
        if (!f || warmed[f]) return;
        warmed[f] = true;
        try { fetch(f).catch(function () {}); } catch (e) { /* no fetch */ }
      });
    }, 1500);
  }

  function setBed(cue) {
    var file = cue && story.ambience ? story.ambience[cue] : null;
    if (cue === bedCue) return;
    bedCue = cue;
    if (!bed) return;
    if (!file) {
      try { bed.pause(); } catch (e) { /* gone */ }
      bed.src = SILENCE;
      bed.loop = false;
      return;
    }
    bed.src = file;
    bed.loop = true;
    if (soundReady()) playEl(bed).catch(function () {});
  }

  /** Plays one line: its sound effect, then its voice; calls done() once when the line has been heard. A line with no
      recording yet is read on a timer (its length in the data). */
  function playLine(line, done) {
    var finished = false;
    var timer = 0;
    var at = flow;
    var el = voice; // the story may be closed (voice gone) before this line's timer fires
    var finish = function () {
      if (finished) return;
      finished = true;
      if (lastFinish === finish) lastFinish = null;
      clearTimeout(timer);
      el.onended = el.onerror = null;
      try { el.pause(); } catch (e) { /* gone */ }
      done();
    };
    var byTimer = function (ms) {
      clearTimeout(timer);
      timer = setTimeout(finish, ms);
    };
    lastFinish = finish;
    var cue = line.sfx && story.sfx ? story.sfx[line.sfx] : null;
    if (cue) {
      sfx.src = cue;
      playEl(sfx).catch(function () {});
    }
    if (!line.file) return byTimer(line.dur * 1000);
    el.onended = finish;
    var retried = false;
    el.onerror = function () {
      // A host hiccup (a 503 on a file that exists) gets one more try a moment later; then the line is read on its timer.
      if (retried) return byTimer(line.dur * 1000);
      retried = true;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (finished || at !== flow) return;
        byTimer((line.dur + 4) * 1000);
        el.src = line.file; // setting src loads it again, even the same file
        playEl(el).catch(function () { if (!finished) byTimer(line.dur * 1000); });
      }, 600);
    };
    el.src = line.file;
    el.loop = false;
    byTimer((line.dur + 4) * 1000); // never stuck on a recording that stalls
    playEl(el).catch(function (error) {
      if (finished) return;
      if (error && error.name === "NotAllowedError") {
        // The browser wants a tap (js/hawkes-sound.js shows its prompt): hear the line again once there was one.
        clearTimeout(timer);
        el.onended = el.onerror = null;
        // Sound counts as unlocked but this element was refused (a phone): the prompt comes back, its tap starts it.
        if (soundReady() && window.hawkesSound && window.hawkesSound.relock) window.hawkesSound.relock();
        if (!window.hawkesSound) return byTimer(line.dur * 1000);
        var again = function () {
          document.removeEventListener("hawkes:unlocked", again);
          if (finished || at !== flow) return; // heard (Skip) or the scene was left
          playLine(line, done);
        };
        document.addEventListener("hawkes:unlocked", again);
      } else if (!retried) byTimer(line.dur * 1000); // a failed load: onerror's retry owns the timer
    });
  }

  /* ---------------- the scene ---------------- */

  function scene() { return story.scenes[run.scene]; }

  function text(tag, cls, content) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content != null) el.textContent = content;
    return el;
  }

  /* ---------------- the screen and the strip ---------------- */

  var room = function () { return window.iltvRoom || null; };
  var shown = null; // { cam, state } on the big screen now
  var changes = 0; // how many times the screen changed camera or picture (CRT flashes)

  function camera(id) { return story.cameras.filter(function (c) { return c.id === id; })[0] || null; }

  /** The strip under the screen: the nine cameras, each with its number and what it shows in this scene. Nothing in it is pressed:
      the people in the room choose what the screen shows. */
  function renderWall() {
    var feeds = rules.feedsOf(story, scene());
    els.wall.replaceChildren();
    els.wall.dataset.count = String(story.cameras.length);
    els.wall.style.setProperty("--cams", String(story.cameras.length));
    story.cameras.forEach(function (cam, i) {
      var state = feeds[cam.id];
      var info = cam.states[state] || cam.states.normal;
      var on = run.sel === cam.id;
      var tile = text("div", "feed" + (on ? " is-selected" : ""));
      tile.dataset.camera = cam.id;
      tile.dataset.state = state;
      if (on) tile.setAttribute("aria-current", "true");
      tile.setAttribute("aria-label", cam.id.toUpperCase() + " " + cam.name + (state === "normal" ? "" : ", " + state) + ": " + info.desc + (on ? " (on the big screen)" : ""));
      var pic = text("span", "feed-pic");
      pic.appendChild(picture(info, cam, state));
      tile.append(pic, text("b", "feed-num", String(i + 1)));
      els.wall.appendChild(tile);
    });
    renderBig(feeds);
  }

  /** A feed's picture: its image when it is made, else a placeholder tile (a dark scanned frame with its label). */
  function picture(info, cam, state) {
    if (info.image) {
      var img = document.createElement("img");
      img.src = info.image;
      img.alt = "";
      img.loading = "lazy";
      return img;
    }
    var blank = text("span", "feed-blank");
    blank.setAttribute("aria-hidden", "true");
    blank.appendChild(text("i", "", cam.id.toUpperCase()));
    if (state !== "normal") blank.appendChild(text("u", "", state));
    return blank;
  }

  /** The big screen shows the camera the scene (or a line) names. When the camera or its picture is not the one already on it,
      it does a short CRT channel change (about 260 ms) as the picture swaps. `quiet`: no flash (the story just opened or resumed). */
  function renderBig(feeds, quiet) {
    var cam = camera(run.sel);
    box.dataset.enlarged = cam ? cam.id : "";
    if (!cam) { els.big.hidden = true; shown = null; return; }
    els.big.hidden = false;
    var state = feeds[cam.id];
    var info = cam.states[state] || cam.states.normal;
    var changed = !shown || shown.cam !== cam.id || shown.state !== state;
    els.big.dataset.camera = cam.id;
    els.big.dataset.state = state;
    if (!changed && els.big.firstChild) return;
    var oldPic = els.big.querySelector(".big-pic:not(.big-leave)");
    els.big.replaceChildren();
    if (oldPic && shown && !quiet) {
      var fms = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 350;
      oldPic.classList.add("big-leave");
      oldPic.style.setProperty("--fade-ms", fms + "ms");
      els.big.appendChild(oldPic);
      setTimeout(function () { oldPic.remove(); }, fms + 40);
    }
    var pic = text("div", "big-pic");
    pic.appendChild(picture(info, cam, state));
    var tag = text("span", "big-tag", cam.id.toUpperCase() + " " + cam.name);
    var cap = text("p", "big-cap");
    cap.appendChild(text("b", "", cam.id.toUpperCase() + " " + cam.name + (state === "normal" ? "" : " · " + state)));
    cap.appendChild(document.createTextNode(" " + info.desc));
    els.big.insertBefore(pic, els.big.firstChild);
    els.big.append(text("span", "big-crt"), tag, cap);
    if (state !== "normal") els.big.appendChild(text("span", "big-mark", state));
    if (changed && shown && !quiet) flash();
    else if (changed && shown) changes++;
    shown = { cam: cam.id, state: state };
    els.big.dataset.changes = String(changes);
  }

  var flashTimer = 0;
  function flash() {
    changes++;
    els.big.dataset.changes = String(changes);
    els.big.classList.remove("is-flash");
    void els.big.offsetWidth;
    els.big.classList.add("is-flash");
    els.big.dataset.flash = String(changes);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { els.big.classList.remove("is-flash"); }, 300);
  }

  /** The people in the room change the feed (a scene's focus, or a line's `feed`): the screen flashes and shows that camera. */
  function showFeed(id, by, quiet) {
    var cam = camera(id);
    if (!cam || !run) return;
    var was = shown;
    run.sel = cam.id;
    renderWall();
    if (quiet) return;
    var moved = !was || was.cam !== cam.id;
    if (moved && room()) room().switched(cam.id.toUpperCase() + " " + cam.name, by);
    if (moved && hooks.tell) hooks.tell("feature", { story: story.id, feature: "feed", camera: cam.id });
  }

  // When the strip changes height (the end screen shrinks it, the phone turns), it stays on its newest line.
  // Its minimum height is the newest line's own height, so the strip never cuts that line off (a long line wraps to five rows on a phone).
  // The ResizeObserver watches the strip this writes to, so it must settle: a write only happens when the height needed
  // differs by more than 1px, the observer only schedules one animation frame (never writes inside its own callback),
  // and the observer's writes are capped at 5 a second until the scene changes.
  var subsWrites = [], subsCapped = false;
  function fitSubs(fromObserver) {
    var last = els.subs.lastElementChild;
    if (!last || !subsOn) { if (els.subs.style.minHeight) els.subs.style.minHeight = ""; return; }
    var cs = window.getComputedStyle(els.subs);
    var need = Math.ceil(last.offsetHeight + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0));
    var now = parseFloat(els.subs.style.minHeight);
    if (now === now && Math.abs(need - now) <= 1) return;
    if (fromObserver) {
      if (subsCapped) return;
      var t = Date.now();
      subsWrites = subsWrites.filter(function (w) { return t - w < 1000; });
      if (subsWrites.length >= 5) { subsCapped = true; return; }
      subsWrites.push(t);
    }
    els.subs.style.minHeight = need + "px";
  }

  if (window.ResizeObserver) {
    var subsH = 0, subsFrame = 0;
    var subsFrameRun = function () {
      subsFrame = 0;
      fitSubs(true);
      var h = els.subs.clientHeight;
      subsH = h;
      els.subs.scrollTop = els.subs.scrollHeight; // whatever moved the strip, it stays on its newest line
    };
    new ResizeObserver(function () {
      if (!subsFrame) subsFrame = window.requestAnimationFrame(subsFrameRun);
    }).observe(els.subs);
  }

  function renderSubs() {
    var s = scene();
    els.subs.replaceChildren();
    var shown = Math.min(s.lines.length, run.done + (linePlaying ? 1 : 0));
    for (var i = 0; i < shown; i++) {
      var p = text("p", "sub" + (linePlaying && i === shown - 1 ? " is-now" : ""));
      p.dataset.line = String(i);
      p.appendChild(text("b", "", story.speakers[s.lines[i].speaker].name));
      p.appendChild(document.createTextNode(" " + s.lines[i].text));
      els.subs.appendChild(p);
    }
    fitSubs();
    els.subs.scrollTop = els.subs.scrollHeight;
  }

  function renderChoices() {
    var s = scene();
    var finished = !linePlaying && run.done >= s.lines.length;
    box.dataset.lines = finished ? "done" : "playing";
    els.choices.replaceChildren();
    els.choices.hidden = !finished || !!s.ending;
    els.ending.hidden = !(finished && s.ending);
    els.ending.replaceChildren();
    if (finished && s.ending) {
      if (s.endcard) {
        var card = document.createElement("img");
        card.className = "console-endcard";
        card.src = s.endcard;
        card.alt = "";
        els.ending.appendChild(card);
      }
      els.ending.appendChild(document.createTextNode(s.ending[0]));
      var ends = Array.isArray(story.endings) ? story.endings : [];
      var foundN = 0;
      try {
        var raw = localStorage.getItem("iltv.endings." + story.cookie);
        var saved = raw ? JSON.parse(raw) : null;
        var ids = Array.isArray(saved) ? saved : (saved && Array.isArray(saved.ids) ? saved.ids : []);
        foundN = ids.length;
      } catch (e) { foundN = 0; }
      if (!foundN && ends.length) foundN = 1; // this ending was just reached; game.js writes the key
      if (ends.length) {
        var count = document.createElement("p");
        count.className = "ending-count";
        count.id = "console-ending-count";
        count.textContent = foundN + " of " + ends.length + " found";
        els.ending.appendChild(count);
      }
      var galleryBtn = document.createElement("button");
      galleryBtn.type = "button";
      galleryBtn.className = "console-btn ending-gallery-btn";
      galleryBtn.id = "console-ending-open";
      galleryBtn.textContent = "Endings";
      galleryBtn.addEventListener("click", function () {
        if (hooks && hooks.endingsGallery) hooks.endingsGallery();
      });
      els.ending.appendChild(galleryBtn);
    }
    box.dataset.state = s.ending ? "soon" : "play";
    if (!finished || s.ending) return;
    s.choices.forEach(function (c, i) {
      if (!rules.usable(c, run.st)) return;
      var b = text("button", "choice", c[0]);
      b.type = "button";
      b.dataset.choice = String(i);
      b.addEventListener("click", function () { window.iltvDecide(els.choices, b, function () { choose(i); }); });
      els.choices.appendChild(b);
    });
  }

  function runLines(from, single) {
    var token = ++flow;
    var s = scene();
    run.done = Math.max(0, Math.min(from, s.lines.length));
    linePlaying = null;
    renderChoices();
    renderSubs();
    var stop = single ? run.done + 1 : s.lines.length;
    var again = function () {
      if (token !== flow) return;
      if (run.done >= stop || run.done >= s.lines.length) {
        linePlaying = null;
        if (single) run.done = s.lines.length;
        save();
        renderSubs();
        renderChoices();
        return;
      }
      // Continue Previously (js/game.js): the room is already under the overlay; wait to speak until it clears.
      if (document.documentElement.getAttribute("data-recap") === "1") {
        setTimeout(again, 100);
        return;
      }
      if (!soundReady()) {
        setTimeout(again, 250);
        return;
      }
      var i = run.done;
      linePlaying = { index: i };
      renderSubs();
      renderChoices();
      lineEffects(s, i);
      playLine(s.lines[i], function () {
        if (token !== flow) return;
        if (room()) room().speaking(null);
        linePlaying = null;
        run.done = i + 1;
        save();
        renderSubs();
        var wait = skipped || i + 1 >= stop ? 0 : GAP;
        skipped = false;
        setTimeout(again, wait);
      });
    };
    again();
  }

    function stopAudio() {
    flow++;
    linePlaying = null;
    lastFinish = null;
    skipped = false;
    if (room()) room().speaking(null);
    [voice, sfx].forEach(function (a) {
      if (!a) return;
      a.onended = a.onerror = null;
      try { a.pause(); } catch (e) { /* gone */ }
    });
  }

  function enter(id, resumed) {
    run.scene = id;
    run.chapter = chapterOfScene(id) || run.chapter;
    subsCapped = false; subsWrites = [];
    var s = scene();
    if (!resumed) {
      run.done = 0;
      if (s.focus) run.sel = s.focus;
      if (s.log) run.log.push({ k: "s", t: s.time, text: s.log, sc: id });
    }
    if (!camera(run.sel)) run.sel = story.cameras[0].id;
    var explored = hooks.visit(id);
    els.time.textContent = s.time;
    els.explored.textContent = explored + "% explored";
    box.dataset.scene = id;
    var R = room();
    if (R) {
      R.scene({ id: id, time: s.time, place: s.place, cast: s.cast, away: s.away, lines: s.lines, poseMap: story.performPoses || null });
      if (resumed && run.done) R.catchUp(run.done);
      // Handover chair choice: sit or stand sticks until the next scene's cast resets it.
      if (run.pose && R.posture) R.posture("you", run.pose);
    }
    var before = shown;
    renderWall();
    if (!before && hooks.tell) hooks.tell("feature", { story: story.id, feature: "feed", camera: run.sel, via: "open" });
    if (R && !resumed && before && before.cam !== run.sel) {
      var cam = camera(run.sel);
      R.switched(cam.id.toUpperCase() + " " + cam.name);
      if (hooks.tell) hooks.tell("feature", { story: story.id, feature: "feed", camera: cam.id });
    }
    setBed(s.ambience || null);
    if (!resumed) playSting(s.music);
    save();
    if (!resumed && hooks.tell) hooks.tell("scene", { story: story.id, scene: id, path: run.history.concat(id), video: null, explored: explored });
    if (!els.log.hidden) renderLog();
    runLines(run.done, false);
    els.skip.disabled = false;
  }

  /** What the line being heard makes happen in the room: the people's acts, the one speaking, the screen they switch. */
  function lineEffects(s, i) {
    var R = room();
    var l = s.lines[i];
    if (R) {
      R.line(i);
      R.speaking(l.speaker);
    }
    var feeds = l.feed == null ? [] : Array.isArray(l.feed) ? l.feed : [l.feed];
    // Several cameras in one line (the tiles are read out one after another): the screen follows them across the line.
    feeds.forEach(function (cam, k) {
      if (k === 0) return showFeed(cam);
      var token = flow;
      setTimeout(function () { if (run && token === flow && linePlaying && linePlaying.index === i) showFeed(cam); }, (l.dur * 1000 * k) / feeds.length);
    });
  }

  /** The rest of a scene's lines were taken as heard (Skip): the room and the screen end as the lines leave them. */
  function lineSettle(s, from) {
    var R = room();
    if (R) {
      R.speaking(null);
      R.catchUp(s.lines.length);
    }
    var last = null;
    for (var i = from; i < s.lines.length; i++) {
      var f = s.lines[i].feed;
      if (f) last = Array.isArray(f) ? f[f.length - 1] : f;
    }
    if (last) showFeed(last);
  }

  /** The hand-off: the chosen card glows and grows, the others fall away (250 ms), then fn runs once.
      Shared by clip stories (js/game.js) and console stories. Double taps during the hand-off are ignored. */
  var DECIDE_MS = 250;
  window.iltvDecide = function (box, btn, fn) {
    if (!box || !btn || (box._deciding && box._deciding.isConnected)) return false;
    box._deciding = btn;
    btn.classList.add("is-chosen");
    btn.setAttribute("aria-pressed", "true");
    try { btn.focus({ preventScroll: true }); } catch (e) { try { btn.focus(); } catch (e2) { /* not focusable */ } }
    box.classList.add("is-deciding");
    box.setAttribute("aria-busy", "true");
    box.querySelectorAll(".choice").forEach(function (b) {
      if (b !== btn) { b.classList.add("is-fading"); b.setAttribute("aria-disabled", "true"); b.tabIndex = -1; }
    });
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { /* unsupported */ }
    try { if (window.iltvAudio && window.iltvAudio.playUi) window.iltvAudio.playUi("tap"); window.iltvAudio.beginBeds && window.iltvAudio.beginBeds("choice"); } catch (e) { /* no sound */ }
    document.dispatchEvent(new CustomEvent("iltv:deciding", { detail: { index: btn.dataset.choiceIndex || btn.dataset.choice } }));
    // The hand-off state belongs to this press. A scene change replaces the buttons (the chosen one leaves the page),
    // and the box must still be released, or every choice on the next page keeps pointer-events:none and a press lands
    // on the box. Not when a later press has taken over the box.
    function release() {
      if (box._deciding !== btn) return;
      box._deciding = null;
      box.classList.remove("is-deciding");
      box.removeAttribute("aria-busy");
      btn.classList.remove("is-chosen");
      btn.removeAttribute("aria-pressed");
      box.querySelectorAll(".is-fading").forEach(function (b) { b.classList.remove("is-fading"); b.removeAttribute("aria-disabled"); b.removeAttribute("tabindex"); });
    }
    setTimeout(function () {
      if (btn.isConnected) { try { fn(); } catch (e) { console.error(e); } }
      if (!btn.isConnected) { release(); return; }
      setTimeout(function () {
        if (!btn.isConnected) { release(); return; }
        box._deciding = null;
        box.classList.remove("is-deciding");
        box.removeAttribute("aria-busy");
        btn.classList.remove("is-chosen");
        btn.removeAttribute("aria-pressed");
        box.querySelectorAll(".is-fading").forEach(function (b) { b.classList.remove("is-fading"); b.removeAttribute("aria-disabled"); b.removeAttribute("tabindex"); });
      }, 1500);
    }, DECIDE_MS);
    return true;
  };

  /** A scene swap replaces the buttons: whatever press was handing off from this box is over, release it now (a clip
      story's swap can come after the 250 ms hand-off, and the new choices must be pressable at once). */
  window.iltvDecideRelease = function (box) {
    if (!box) return;
    box._deciding = null;
    box.classList.remove("is-deciding");
    box.removeAttribute("aria-busy");
  };

  document.addEventListener("keydown", function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || !/^[1-9]$/.test(event.key)) return;
    var t = event.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    var spark = document.getElementById("spark"), cons = document.getElementById("console");
    var box = spark && !spark.hidden ? document.getElementById("spark-choices") : cons && !cons.hidden ? document.getElementById("console-choices") : null;
    if (!box || box.hidden || document.querySelector(".tap-to-play:not([hidden])")) return;
    var b = box.querySelectorAll(".choice")[Number(event.key) - 1];
    if (!b || b.disabled || b.getAttribute("aria-disabled") === "true") return;
    event.preventDefault();
    b.focus();
    b.click();
  });

  function inkEl() {
    var el = document.getElementById("console-ink");
    if (el) return el;
    el = document.createElement("div");
    el.id = "console-ink";
    el.className = "console-ink";
    el.hidden = true;
    el.setAttribute("role", "status");
    el.innerHTML = '<p class="console-ink-line"></p>';
    box.appendChild(el);
    return el;
  }

  function chapterEl() {
    var el = document.getElementById("console-chapter");
    if (el) return el;
    el = document.createElement("div");
    el.id = "console-chapter";
    el.className = "console-chapter";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Chapter");
    el.innerHTML =
      '<p class="console-chapter-kicker">Chapter</p>' +
      '<p class="console-chapter-clock" id="console-chapter-clock"></p>' +
      '<h2 class="console-chapter-title" id="console-chapter-title"></h2>' +
      '<p class="console-chapter-hook" id="console-chapter-hook"></p>';
    box.appendChild(el);
    return el;
  }

  function playPencil() {
    var cue = story.sfx && story.sfx.pencil;
    if (!cue || !sfx) return;
    sfx.src = cue;
    playEl(sfx).catch(function () {});
  }

  /** Write the choice's log line on screen with the pencil SFX (and a Dee Mm / Mm-hm when one is named), then fn. */
  function showInk(line, reactId, fn) {
    var el = inkEl();
    var p = el.querySelector(".console-ink-line");
    var started = performance.now();
    p.textContent = line || "";
    el.hidden = false;
    el.classList.add("is-writing");
    box.dataset.ink = "1";
    playPencil();
    if (hooks.tell) hooks.tell("feature", { story: story.id, feature: "ink", line: line });
    // "Written" the moment the line and pencil fire (criterion: within 2 s of the choice).
    document.dispatchEvent(new CustomEvent("iltv:ink", {
      detail: { line: line, react: reactId || null, ms: Math.round(performance.now() - started) },
    }));
    var react = reactId && story.reactions ? story.reactions[reactId] : null;
    var finish = function () {
      if (inkTimer) { clearTimeout(inkTimer); inkTimer = 0; }
      el.classList.remove("is-writing");
      el.hidden = true;
      delete box.dataset.ink;
      document.dispatchEvent(new CustomEvent("iltv:ink-done", { detail: { line: line } }));
      if (!run || !story) return;
      fn();
    };
    if (react && react.file && voice) {
      var done = false;
      var once = function () {
        if (done) return;
        done = true;
        voice.onended = voice.onerror = null;
        try { voice.pause(); } catch (e) { /* gone */ }
        inkTimer = setTimeout(finish, 200);
      };
      voice.onended = once;
      voice.onerror = once;
      voice.src = react.file;
      voice.loop = false;
      playEl(voice).catch(function () { once(); });
      inkTimer = setTimeout(once, ((react.dur || 1) + 1.2) * 1000);
    } else {
      inkTimer = setTimeout(finish, 900);
    }
  }

  /** 2 s chapter card: clock jumps, sting, one-line hook; then fn. */
  function showChapterCard(ch, fn) {
    var el = chapterEl();
    var next = null;
    var list = story.chapters || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === ch.id && list[i + 1]) next = list[i + 1];
    el.querySelector(".console-chapter-clock").textContent = (next && next.clock) || ch.clock || "";
    el.querySelector(".console-chapter-title").textContent = (next && next.title) || ch.title || "";
    el.querySelector(".console-chapter-hook").textContent = ch.hook || "";
    el.hidden = false;
    el.classList.add("is-up");
    box.dataset.chapter = "1";
    if (els.time && ((next && next.clock) || ch.clock)) els.time.textContent = (next && next.clock) || ch.clock;
    playSting("shift-begins");
    if (hooks.tell) hooks.tell("feature", { story: story.id, feature: "chapter", chapter: ch.id, clock: (next && next.clock) || ch.clock });
    document.dispatchEvent(new CustomEvent("iltv:chapter", { detail: { id: ch.id, title: (next && next.title) || ch.title, clock: (next && next.clock) || ch.clock, hook: ch.hook } }));
    chapterTimer = setTimeout(function () {
      chapterTimer = 0;
      el.classList.remove("is-up");
      el.hidden = true;
      delete box.dataset.chapter;
      document.dispatchEvent(new CustomEvent("iltv:chapter-done", { detail: { id: ch.id } }));
      if (!run || !story) return;
      fn();
    }, 2000);
  }

  function choose(i) {
    if (!run || !story) return;
    var s = scene();
    if (!s) return;
    var c = s.choices[i];
    if (!c || !rules.usable(c, run.st)) return;
    stopAudio();
    var x = rules.extraOf(c);
    var before = { flags: {}, meters: {} };
    Object.keys(run.st.flags).forEach(function (k) { before.flags[k] = run.st.flags[k]; });
    Object.keys(run.st.meters).forEach(function (k) { before.meters[k] = run.st.meters[k]; });
    var from = run.scene;
    var logLine = x.log || c[0];
    run.log.push({ k: "c", t: s.time, text: logLine, o: s.choices.length - 1, sc: run.scene });
    run.st = rules.apply(story, run.st, c);
    if (x.pose === "sit" || x.pose === "stand") run.pose = x.pose;
    if (hooks.tell) hooks.tell("choice", { story: story.id, from: from, to: c[2], option: c[0] });
    var lands = choiceLands(before, run.st, x);
    var ended = chapterEnding(from);
    function goEnter() {
      run.history.push(from);
      hooks.history(run.history);
      if (ended) {
        var after = null;
        var list = story.chapters || [];
        for (var i = 0; i < list.length; i++) if (list[i].id === ended.id && list[i + 1]) after = list[i + 1];
        if (after) run.chapter = after.id;
        showChapterCard(ended, function () {
          enter(c[2], false);
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        });
        return;
      }
      enter(c[2], false);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    if (lands) showInk(logLine, x.react, goEnter);
    else goEnter();
  }

  /* ---------------- the shift log (the Tree of this story type) ---------------- */

  function renderLog() {
    var page = els.logPage;
    page.replaceChildren();
    var head = text("header", "dar-head");
    head.appendChild(text("h2", "", "Daily Activity Report"));
    head.appendChild(text("p", "", "Hawkes Tower · Control room · Night shift"));
    page.appendChild(head);
    var sheet = text("table", "dar-sheet");
    var body = document.createElement("tbody");
    var top = document.createElement("tr");
    top.className = "dar-cols";
    top.append(text("th", "", "Time"), text("th", "", "Activity"));
    var th = document.createElement("thead");
    th.appendChild(top);
    sheet.append(th, body);
    var row = function (t, content, cls) {
      var tr = document.createElement("tr");
      tr.className = cls;
      tr.append(text("td", "dar-time", t), content);
      body.appendChild(tr);
    };
    var cell = function (content) { return text("td", "dar-text", content); };
    var redacted = function (n) {
      for (var i = 0; i < n; i++) {
        var td = text("td", "dar-text");
        td.appendChild(text("span", "dar-redacted"));
        td.firstChild.setAttribute("aria-label", "redacted");
        row("", td, "dar-row is-redacted");
      }
    };
    run.log.forEach(function (e) {
      row(e.t, cell(e.text), "dar-row " + (e.k === "c" ? "is-done" : "is-seen"));
      if (e.k === "c") redacted(e.o);
    });
    var s = scene();
    if (!s.ending) redacted(s.choices.length);
    page.appendChild(sheet);
    var foot = text("p", "dar-foot", s.ending ? "Shift ended. Signed." : "Officer on post: ______________");
    page.appendChild(foot);
    box.dataset.entries = String(run.log.length);
  }

  function toggleLog(open) {
    var show = open == null ? els.log.hidden : open;
    if (show) renderLog();
    els.log.hidden = !show;
    els.logBtn.setAttribute("aria-pressed", show ? "true" : "false");
    els.logBtn.textContent = show ? "Close log" : "Log";
    box.classList.toggle("is-log", show);
    if (hooks.tell && show) hooks.tell("feature", { story: story.id, feature: "log", entries: run.log.length });
    if (show) els.log.scrollTop = 0;
  }

  /* ---------------- controls ---------------- */

  function setSubs(on) {
    subsOn = on;
    try { localStorage.setItem(SUBS_KEY, on ? "on" : "off"); } catch (e) { /* private mode */ }
    box.dataset.subs = on ? "on" : "off";
    els.cc.setAttribute("aria-pressed", on ? "true" : "false");
    fitSubs();
  }

  els.cc.addEventListener("click", function () { setSubs(!subsOn); });
  els.logBtn.addEventListener("click", function () { toggleLog(); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !box.hidden && !els.log.hidden) toggleLog(false);
  });
  els.replay.addEventListener("click", function () {
    if (!run) return;
    var s = scene();
    var at = linePlaying ? linePlaying.index : Math.max(0, Math.min(run.done, s.lines.length) - 1);
    runLines(at, !!(!linePlaying && run.done >= s.lines.length));
  });
  els.skip.addEventListener("click", function () {
    if (!run) return;
    var s = scene();
    if (run.done >= s.lines.length && !linePlaying) return;
    // The line being heard ends now; the next one follows. With none running, the rest are taken as heard.
    if (linePlaying && lastFinish) {
      skipped = true;
      lastFinish();
    }
    else {
      var from = run.done;
      stopAudio();
      run.done = s.lines.length;
      lineSettle(s, from);
      save();
      renderSubs();
      renderChoices();
    }
  });

  /* ---------------- open and close ---------------- */

  function open(def, h, cookieScene) {
    close();
    story = def;
    hooks = h;
    var saved = load(cookieScene);
    run = saved || fresh();
    els.title.textContent = def.title.toUpperCase();
    setSubs(subsOn);
    voice = makeAudio(false, "voice");
    bed = makeAudio(true, "bed");
    sfx = makeAudio(false, "sfx");
    sting = makeAudio(false, "sting");
    bedCue = null;
    shown = null;
    warmBeds();
    flow++;
    box.hidden = false;
    toggleLog(false);
    hooks.history(run.history);
    enter(run.scene, !!saved);
  }

  function close() {
    stopAudio();
    if (inkTimer) { clearTimeout(inkTimer); inkTimer = 0; }
    if (chapterTimer) { clearTimeout(chapterTimer); chapterTimer = 0; }
    delete box.dataset.ink;
    delete box.dataset.chapter;
    var ink = document.getElementById("console-ink");
    if (ink) ink.hidden = true;
    var ch = document.getElementById("console-chapter");
    if (ch) ch.hidden = true;
    [voice, bed, sfx, sting].forEach(function (a) {
      if (!a) return;
      a.onended = a.onerror = null;
      try { a.pause(); } catch (e) { /* gone */ }
      if (a.parentNode) a.parentNode.removeChild(a);
    });
    voice = bed = sfx = sting = null;
    bedCue = null;
    shown = null;
    if (room()) room().close();
    if (run) save();
    run = null;
    story = null;
    box.hidden = true;
    var endingsPane = $("console-endings");
    if (endingsPane) endingsPane.hidden = true;
    if (els.logBtn) { /* keep */ }
    var endingsBtn = $("console-endings-btn");
    if (endingsBtn) endingsBtn.setAttribute("aria-pressed", "false");
  }

  /** Start Over / a card's reset: forgets the saved run (the cookies are game.js's). */
  function forget(def) {
    delete memory[RUN_KEY + def.cookie];
    try { localStorage.removeItem(RUN_KEY + def.cookie); } catch (e) { /* nothing saved */ }
  }

  function audioView(a) {
    return a ? { muted: a.muted, volume: a.volume, paused: a.paused, src: a.currentSrc || a.src, loop: a.loop, time: a.currentTime, ended: a.ended } : null;
  }

  // Read-only views for the playtest (js/playtest.js).
  window.iltvConsole = {
    open: open,
    close: close,
    forget: forget,
    story: function () { return story ? story.id : null; },
    scene: function () { return run ? run.scene : null; },
    flags: function () { return run ? Object.keys(run.st.flags).sort() : []; },
    meters: function () { return run ? JSON.parse(JSON.stringify(run.st.meters)) : {}; },
    history: function () { return run ? run.history.slice() : []; },
    log: function () { return run ? JSON.parse(JSON.stringify(run.log)) : []; },
    lines: function () { return run ? { done: run.done, total: scene().lines.length, playing: linePlaying ? linePlaying.index : -1 } : null; },
    selected: function () { return run ? run.sel : null; },
    screen: function () { return run && shown ? { camera: shown.cam, state: shown.state, changes: changes } : null; },
    room: function () { return room() ? room().view() : null; },
    pose: function () { return run ? run.pose : null; },
    chapter: function () { return run ? run.chapter : null; },
    chapters: function () { return story && story.chapters ? story.chapters.slice() : []; },
    subtitles: function () { return subsOn; },
    audio: function () { return { voice: audioView(voice), bed: audioView(bed), sfx: audioView(sfx), sting: audioView(sting), bedCue: bedCue }; },
    saved: function () {
      try { return story ? JSON.parse(stored()) : null; } catch (e) { return null; }
    },
  };
})();
