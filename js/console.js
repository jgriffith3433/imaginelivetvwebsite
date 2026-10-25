/* The player for console stories (story type "console", story doc: story/README.md, "Console stories").

   A console story is heard first: each scene is a few voiced lines that follow one another by themselves over an
   ambience bed, while a wall of camera feeds (one of which the player can enlarge) shows what the scene says is on
   the cameras. When the lines are done the choices appear; a choice can need flags or meters and sets or changes
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
  var voice = null;
  var bed = null;
  var sfx = null;
  var sting = null;
  var bedCue = null;
  var subsOn = true;

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
      });
    memory[runKey()] = text;
    try {
      localStorage.setItem(runKey(), text);
    } catch (e) { /* private mode: the run holds for this page */ }
  }

  function fresh() {
    return { scene: story.start, history: [], st: rules.fresh(story), log: [], done: 0, sel: null };
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
      };
    } catch (e) {
      return null;
    }
  }

  /* ---------------- sound ---------------- */

  function makeAudio(loop) {
    var a = document.createElement("audio");
    a.src = SILENCE;
    a.loop = !!loop;
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    a.setAttribute("data-sound-start", "");
    document.body.appendChild(a);
    if (window.hawkesSound) window.hawkesSound.apply(a);
    return a;
  }

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
    el.onerror = function () { byTimer(line.dur * 1000); };
    el.src = line.file;
    el.loop = false;
    byTimer((line.dur + 4) * 1000); // never stuck on a recording that stalls
    playEl(el).catch(function (error) {
      if (finished) return;
      if (error && error.name === "NotAllowedError") {
        // The browser wants a tap (js/hawkes-sound.js shows its prompt): hear the line again once there was one.
        clearTimeout(timer);
        el.onended = el.onerror = null;
        var wait = function () {
          if (finished || at !== flow) return; // heard (Skip) or the scene was left
          if (soundReady()) return playLine(line, done);
          timer = setTimeout(wait, 250);
        };
        wait();
      } else byTimer(line.dur * 1000);
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

  function renderWall() {
    var feeds = rules.feedsOf(story, scene());
    els.wall.replaceChildren();
    els.wall.dataset.count = String(story.cameras.length);
    story.cameras.forEach(function (cam) {
      var state = feeds[cam.id];
      var info = cam.states[state] || cam.states.normal;
      var tile = text("button", "feed" + (run.sel === cam.id ? " is-selected" : ""));
      tile.type = "button";
      tile.dataset.camera = cam.id;
      tile.dataset.state = state;
      tile.setAttribute("aria-pressed", run.sel === cam.id ? "true" : "false");
      tile.setAttribute("aria-label", cam.id.toUpperCase() + " " + cam.name + (state === "normal" ? "" : ", " + state) + ": " + info.desc + (run.sel === cam.id ? " (enlarged)" : ". Press to enlarge"));
      var pic = text("span", "feed-pic");
      pic.appendChild(picture(info, cam, state));
      var cap = text("span", "feed-cap");
      cap.appendChild(text("b", "", cam.id.toUpperCase()));
      cap.appendChild(document.createTextNode(" " + cam.name));
      tile.append(pic, cap);
      tile.addEventListener("click", function () { select(run.sel === cam.id ? null : cam.id); });
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

  function renderBig(feeds) {
    els.big.replaceChildren();
    var cam = run.sel && story.cameras.filter(function (c) { return c.id === run.sel; })[0];
    els.big.hidden = !cam;
    box.dataset.enlarged = cam ? cam.id : "";
    if (!cam) return;
    var state = feeds[cam.id];
    var info = cam.states[state] || cam.states.normal;
    els.big.dataset.camera = cam.id;
    els.big.dataset.state = state;
    var pic = text("div", "big-pic");
    pic.appendChild(picture(info, cam, state));
    var cap = text("p", "big-cap");
    cap.appendChild(text("b", "", cam.id.toUpperCase() + " " + cam.name + (state === "normal" ? "" : " · " + state)));
    cap.appendChild(document.createTextNode(" " + info.desc));
    var close = text("button", "big-close", "Shrink");
    close.type = "button";
    close.addEventListener("click", function () { select(null); });
    els.big.append(pic, cap, close);
  }

  function select(id) {
    run.sel = id;
    save();
    renderWall();
    if (hooks.tell) hooks.tell("feature", { story: story.id, feature: "feed", camera: id || "none" });
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
    els.subs.scrollTop = els.subs.scrollHeight;
  }

  function renderChoices() {
    var s = scene();
    var finished = !linePlaying && run.done >= s.lines.length;
    box.dataset.lines = finished ? "done" : "playing";
    els.choices.replaceChildren();
    els.choices.hidden = !finished || !!s.ending;
    els.ending.hidden = !(finished && s.ending);
    els.ending.textContent = s.ending ? s.ending[0] : "";
    if (s.ending && s.endcard) {
      var card = document.createElement("img");
      card.className = "console-endcard";
      card.src = s.endcard;
      card.alt = "";
      els.ending.prepend(card);
    }
    box.dataset.state = s.ending ? "soon" : "play";
    if (!finished || s.ending) return;
    s.choices.forEach(function (c, i) {
      if (!rules.usable(c, run.st)) return;
      var b = text("button", "choice", c[0]);
      b.type = "button";
      b.dataset.choice = String(i);
      b.addEventListener("click", function () { choose(i); });
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
      if (!soundReady()) {
        setTimeout(again, 250);
        return;
      }
      var i = run.done;
      linePlaying = { index: i };
      renderSubs();
      renderChoices();
      playLine(s.lines[i], function () {
        if (token !== flow) return;
        linePlaying = null;
        run.done = i + 1;
        save();
        renderSubs();
        setTimeout(again, i + 1 >= stop ? 0 : GAP);
      });
    };
    again();
  }

    function stopAudio() {
    flow++;
    linePlaying = null;
    lastFinish = null;
    [voice, sfx].forEach(function (a) {
      if (!a) return;
      a.onended = a.onerror = null;
      try { a.pause(); } catch (e) { /* gone */ }
    });
  }

  function enter(id, resumed) {
    run.scene = id;
    var s = scene();
    if (!resumed) {
      run.done = 0;
      run.sel = s.focus || null;
      if (s.log) run.log.push({ k: "s", t: s.time, text: s.log, sc: id });
    }
    var explored = hooks.visit(id);
    els.time.textContent = s.time;
    els.explored.textContent = explored + "% explored";
    box.dataset.scene = id;
    renderWall();
    setBed(s.ambience || null);
    if (!resumed) playSting(s.music);
    save();
    if (!resumed && hooks.tell) hooks.tell("scene", { story: story.id, scene: id, path: run.history.concat(id), video: null, explored: explored });
    if (!els.log.hidden) renderLog();
    runLines(run.done, false);
    els.skip.disabled = false;
  }

  function choose(i) {
    var s = scene();
    var c = s.choices[i];
    if (!c || !rules.usable(c, run.st)) return;
    stopAudio();
    var x = rules.extraOf(c);
    run.log.push({ k: "c", t: s.time, text: x.log || c[0], o: s.choices.length - 1, sc: run.scene });
    run.st = rules.apply(story, run.st, c);
    if (hooks.tell) hooks.tell("choice", { story: story.id, from: run.scene, to: c[2], option: c[0] });
    run.history.push(run.scene);
    hooks.history(run.history);
    enter(c[2], false);
    window.scrollTo(0, 0);
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
    if (linePlaying && lastFinish) lastFinish();
    else {
      stopAudio();
      run.done = s.lines.length;
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
    voice = makeAudio(false);
    bed = makeAudio(true);
    sfx = makeAudio(false);
    sting = makeAudio(false);
    bedCue = null;
    flow++;
    box.hidden = false;
    toggleLog(false);
    hooks.history(run.history);
    enter(run.scene, !!saved);
  }

  function close() {
    stopAudio();
    [voice, bed, sfx, sting].forEach(function (a) {
      if (!a) return;
      try { a.pause(); } catch (e) { /* gone */ }
      if (a.parentNode) a.parentNode.removeChild(a);
    });
    voice = bed = sfx = sting = null;
    bedCue = null;
    if (run) save();
    run = null;
    story = null;
    box.hidden = true;
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
    subtitles: function () { return subsOn; },
    audio: function () { return { voice: audioView(voice), bed: audioView(bed), sfx: audioView(sfx), sting: audioView(sting), bedCue: bedCue }; },
    saved: function () {
      try { return story ? JSON.parse(stored()) : null; } catch (e) { return null; }
    },
  };
})();
