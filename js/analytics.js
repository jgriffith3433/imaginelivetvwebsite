/* ==========================================================================
   Hawkes Analytics on Imagine Live TV: what viewers watch, choose, leave and like.
   The SDK is js/hawkes-analytics.js (a copy of hawkesgen/clients/js/hawkes-analytics.js; the contract is
   hawkesgen/docs/analytics.md). How it's wired here, every event and its props, is in AGENTS.md "Analytics":
   keep the two in step.

   It only listens: the player (js/game.js) announces its moments as "iltv:<what>" events on the document
   (scene, choice, open, landing, restart, card), the branch pages and blog posts are read from their HTML.
   Nothing per frame, nothing personal, and nothing here can stop a story: every handler is wrapped.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.hawkesAnalytics;
  if (!A || A.framed) return;

  function safe(fn) {
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        /* analytics never breaks a page */
      }
    };
  }
  var round1 = function (n) { return Math.round((Number(n) || 0) * 10) / 10; };
  var ASK_AFTER = 2000; // ms a page has to stay on screen (and the Tap to play prompt be gone) before a question
  var THEME = { background: "#141618", color: "#e7e4df", accent: "#c98a3c", font: '"Segoe UI", "Helvetica Neue", sans-serif', radius: "10px" };

  /* ---------------- videos: play, complete, skip, and the seconds actually watched ---------------- */

  /** Follows one video: `play` the first time it plays, `complete` when it ends, else `skip` when the viewer
      leaves it (leaveVideo). `watched` counts the seconds it really played (not seeks), `at` is where it was. */
  function watchVideo(el, id) {
    var rec = { el: el, id: id, watched: 0, last: null, played: false, done: false };
    el.addEventListener("playing", safe(function () {
      rec.last = el.currentTime;
      if (rec.played || rec.done) return;
      rec.played = true;
      A.video(id, "play", el.currentTime, { muted: !!el.muted });
    }));
    el.addEventListener("timeupdate", safe(function () {
      var now = el.currentTime;
      if (rec.last != null && !el.paused) {
        var d = now - rec.last;
        if (d > 0 && d < 2) rec.watched += d;
      }
      rec.last = now;
    }));
    el.addEventListener("seeking", function () { rec.last = null; });
    el.addEventListener("ended", safe(function () {
      if (rec.done) return;
      rec.done = true;
      A.video(id, "complete", el.duration, { watched: round1(rec.watched), duration: round1(el.duration) });
    }));
    el.addEventListener("error", safe(function () {
      var code = el.error && el.error.code;
      A.error("A story video didn't load: " + id, "asset", { id: id, code: code });
    }));
    return rec;
  }

  /** The viewer moved on before the video ended: a skip, with how far in and how much they watched. */
  function leaveVideo(rec, why) {
    if (!rec || rec.done) return;
    rec.done = true;
    var el = rec.el;
    var props = { watched: round1(rec.watched), why: why };
    if (isFinite(el.duration) && el.duration > 0) props.duration = round1(el.duration);
    if (!rec.played) props.started = false; // left before it ever played (e.g. at the Tap to play prompt)
    A.video(rec.id, "skip", el.currentTime || 0, props);
  }

  /* ---------------- the feedback questions (the SDK's ask card, in the site's colours) ---------------- */

  var asking = null; // { id, host, token, timer }

  /** Asks once the page has stayed `ASK_AFTER` ms and the Tap to play prompt is gone; `still()` says whether the
      viewer is still where the question belongs. */
  function askWhenCalm(o, still) {
    cancelAsk();
    var since = Date.now();
    var job = { id: o.id, host: null, timer: null };
    asking = job;
    var tick = safe(function () {
      if (asking !== job) return;
      if (!still()) return cancelAsk();
      var prompt = window.hawkesSound && window.hawkesSound.prompt && window.hawkesSound.prompt();
      if (prompt || Date.now() - since < ASK_AFTER) {
        job.timer = setTimeout(tick, 400);
        return;
      }
      job.timer = null;
      var p = A.ask(Object.assign({ theme: THEME, comment: true }, o));
      job.host = document.querySelector('[data-hawkes-ask="' + o.id + '"]');
      if (!job.host) return; // asked already this session, or closed in the last 7 days (the SDK)
      ["pointerdown", "keydown", "focusin"].forEach(function (ev) { job.host.addEventListener(ev, function () { job.touched = true; }); });
      A.track("feedback_prompt", { action: "shown", id: o.id, context: o.context });
      p.then(safe(function (answer) {
        if (job.left) return;
        job.done = true;
        A.track("feedback_prompt", { action: answer ? "answered" : "dismissed", id: o.id, context: o.context, commented: !!(answer && answer.text) });
      }));
    });
    job.timer = setTimeout(tick, 400);
  }

  /** The viewer moved on: a question not shown yet is dropped, and one still open goes away (it belonged there),
      unless they've started answering it (a rating waiting for its comment stays until they send or close it). */
  function cancelAsk() {
    var job = asking;
    asking = null;
    if (!job) return;
    if (job.timer) clearTimeout(job.timer);
    if (job.host && job.host.isConnected && !job.done && !job.touched) {
      job.left = true;
      job.host.remove();
      A.track("feedback_prompt", { action: "ignored", id: job.id });
    }
  }

  function endingQuestion(storyId, node, context) {
    return { id: "ending-" + storyId + "-" + node, kind: "stars", question: "How was this ending?", context: context, placeholder: "What stayed with you? (optional)", thanks: "Thank you. We read every one." };
  }

  /* ---------------- small things viewers use, on every page ---------------- */

  var firstTap = Date.now();
  document.addEventListener("pointerdown", safe(function (event) {
    var t = event.target;
    if (!t || !t.closest) return;
    var sound = window.hawkesSound;
    var prompt = sound && sound.prompt && sound.prompt();
    if (prompt && prompt.contains(t) && !t.closest(".tap-settings")) {
      // The Tap to play prompt: how long the viewer looked at it before tapping.
      var wait = round1((Date.now() - firstTap) / 1000);
      setTimeout(safe(function () { if (!sound.prompt()) A.feature("tap_to_play", { wait: wait }); }), 400);
    }
    if (t.closest("#torch-slot")) flashlight();
  }), true);
  document.addEventListener("click", safe(function (event) {
    var t = event.target;
    if (!t || !t.closest) return;
    if (t.closest("#sound-on")) setTimeout(safe(function () { A.feature("sound", { value: window.hawkesSound.settings().on ? "on" : "off" }); }), 0);
    if (t.closest(".tap-settings, .sound-gear, #sound-gear")) A.feature("settings");
  }), true);
  document.addEventListener("change", safe(function (event) {
    if (event.target && event.target.id === "sound-volume") A.feature("volume", { value: Math.round(Number(event.target.value)) });
  }), true);

  var torchUsed = null;
  function flashlight() {
    // Once per page or scene: do viewers reach for the English under the words?
    var where = (cur && cur.level) || location.pathname;
    if (torchUsed === where) return;
    torchUsed = where;
    A.feature("flashlight", { where: where });
  }

  /* ---------------- the home page: the landing page and the player (js/game.js) ---------------- */

  var player = !!document.getElementById("spark");
  var cur = null; // the scene on screen: { story, scene, node, level, video, ended, dead, ending }
  var runs = {}; // per story, the run in progress this session: { t, depth } (t null when it was resumed)
  var pending = { choice: null, open: null, restart: null, card: null };
  var nav = null; // how the viewer is leaving: "all_stories" or "browser"
  var isReady = false;
  var BACKS = "iltv.backs"; // sessionStorage: times this session went back up a tree (back choices, Try again)

  function ready(view) {
    if (isReady) return;
    isReady = true;
    A.ready({ view: view });
  }

  var stories = function () { return (window.ILTV_STORIES && window.ILTV_STORIES.stories) || []; };
  function storyOf(id) {
    var list = stories();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  var nodeOf = function (st, id) { return String(st.scenes[id].folder || id).split("/").pop(); };

  /** How far each scene is from the start (fewest choices). A choice to a scene nearer the start goes back up the
      tree: The Final Spark's "dead end, go back" to the tunnel, or a death's Try again. */
  var depthCache = {};
  function depthOf(st, id) {
    if (!depthCache[st.id]) {
      var d = {};
      d[st.start] = 0;
      var queue = [st.start];
      while (queue.length) {
        var at = queue.shift();
        (st.scenes[at].choices || []).forEach(function (c) {
          if (st.scenes[c[2]] && d[c[2]] == null) {
            d[c[2]] = d[at] + 1;
            queue.push(c[2]);
          }
        });
      }
      depthCache[st.id] = d;
    }
    var v = depthCache[st.id][id];
    return v == null ? 0 : v;
  }

  /** The way the viewer came, scene ids joined by ">" (the newest end kept when it's longer than 100). */
  function pathText(ids) {
    var s = ids.join(">");
    return s.length > 100 ? "…" + s.slice(s.length - 99) : s;
  }

  function backs(add) {
    var n = 0;
    try {
      n = Number(sessionStorage.getItem(BACKS)) || 0;
      if (add) sessionStorage.setItem(BACKS, String((n += add)));
    } catch (e) {
      n += add || 0;
    }
    return n;
  }

  /** Leaving the scene on screen: its video is skipped (unless it ended) and its level ends. */
  function leaveScene(result, why, props) {
    if (!cur) return;
    leaveVideo(cur.video, why);
    if (!cur.ended) {
      cur.ended = true;
      A.levelEnd(cur.level, result, props);
    }
  }

  function endRun(storyId, props) {
    var run = runs[storyId];
    delete runs[storyId];
    if (run && run.t) props.duration = Math.round((Date.now() - run.t) / 1000);
    A.track("run_end", Object.assign({ run: storyId }, props));
  }

  if (player) {
    document.addEventListener("iltv:card", safe(function (e) { pending.card = e.detail; }));
    document.addEventListener("iltv:restart", safe(function (e) {
      pending.restart = e.detail;
      A.feature("restart", { via: e.detail.via, story: e.detail.story });
    }));
    document.addEventListener("click", safe(function (e) {
      if (e.target && e.target.closest && e.target.closest("#spark-stories, #console-stories")) nav = "all_stories";
      if (e.target && e.target.closest && e.target.closest("#tab-tree") && cur) A.feature("tree", { story: cur.story, explored: cur.explored });
    }), true);
    window.addEventListener("popstate", function () { nav = "browser"; }, true);

    // A console story's own moments (js/console.js): a camera enlarged (feed) and the shift log opened (log).
    document.addEventListener("iltv:feature", safe(function (e) {
      var d = e.detail;
      if (!d || !d.feature || !storyOf(d.story)) return;
      var props = { story: d.story };
      if (d.camera != null) props.camera = d.camera;
      if (d.entries != null) props.entries = d.entries;
      A.feature(d.feature, props);
    }));

    document.addEventListener("iltv:open", safe(function (e) {
      var d = e.detail;
      var card = pending.card && pending.card.story === d.story ? pending.card : null;
      pending.card = null;
      var via = card ? "card" : nav === "browser" ? "browser" : "link";
      nav = null;
      pending.open = d;
      firstTap = Date.now();
      A.track("story_open", { story: d.story, via: via, resumed: !!d.resumed, button: card ? { start: "play", mid: "continue", end: "start_over" }[card.go] : undefined, progress: card ? card.progress : undefined });
    }));

    document.addEventListener("iltv:choice", safe(function (e) {
      var d = e.detail;
      var st = storyOf(d.story);
      if (!st) return;
      pending.choice = d;
      A.choice(nodeOf(st, d.from), d.option, { story: d.story, to: nodeOf(st, d.to) });
    }));

    document.addEventListener("iltv:scene", safe(function (e) {
      var d = e.detail;
      var st = storyOf(d.story);
      if (!st || !st.scenes[d.scene]) return;
      var s = st.scenes[d.scene];
      var node = nodeOf(st, d.scene);
      var level = d.story + "/" + node;
      var depth = d.path.length - 1;
      var choice = pending.choice && pending.choice.story === d.story && pending.choice.to === d.scene ? pending.choice : null;
      var restart = pending.restart && pending.restart.story === d.story ? pending.restart : null;
      var open = pending.open;
      pending.choice = pending.restart = pending.open = null;
      var prev = cur && cur.story === d.story ? cur : null;
      if (cur && !prev) leaveScene("quit", "story");
      cancelAsk();

      // Leaving the scene before.
      var back = null;
      if (prev && choice) {
        if (prev.dead) back = "try_again";
        // (A console story's graph is braided: a choice to a scene nearer the start is a way round, not a step back.)
        else if (st.type !== "console" && depthOf(st, d.scene) < depthOf(st, prev.scene)) back = "choice";
        if (s.dead) A.death(node, { story: d.story, where: prev.node });
        leaveScene(s.dead ? "death" : prev.dead ? "restart" : "complete", "choice", { option: choice.option });
        if (back === "try_again") A.feature("restart", { via: "try_again", story: d.story, from: prev.node });
        else if (back) A.feature("back", { via: "choice", story: d.story, from: prev.node, to: node });
      } else if (prev) {
        leaveScene(restart ? "restart" : "quit", restart ? "restart" : "reopen");
      }

      // The run: a new one starts at the first page; an abandoned one (back at the start without an end) quits.
      var run = runs[d.story];
      if (depth === 0 && (!run || run.depth > 0)) {
        if (run) endRun(d.story, { result: "quit", depth: run.depth });
        runs[d.story] = { t: Date.now(), depth: 0 };
        A.track("run_start", { run: d.story, mode: back === "try_again" ? "try_again" : restart ? "start_over" : "new" });
      } else if (!run) {
        runs[d.story] = { t: null, depth: depth }; // a saved place, resumed
      }
      run = runs[d.story];
      run.depth = Math.max(run.depth, depth);

      A.setContext({ story: d.story, node: node, depth: depth, path: pathText(d.path), lang: s.lang, explored: d.explored });
      A.screen(level);
      cur = { story: d.story, scene: d.scene, node: node, level: level, dead: !!s.dead, ending: !!s.ending, explored: d.explored, ended: false, video: null };
      A.levelStart(level, { depth: depth, resumed: open && open.resumed ? true : undefined });
      if (d.video) cur.video = watchVideo(d.video, level);
      ready("story");

      var here = cur;
      var still = function () { return cur === here; };
      if (s.dead) {
        endRun(d.story, { result: "lose", cause: node, depth: depth, explored: d.explored });
      } else if (s.ending) {
        cur.ended = true;
        A.levelEnd(level, "complete", { ending: node });
        endRun(d.story, { result: "win", ending: node, depth: depth, explored: d.explored });
        askWhenCalm(endingQuestion(d.story, node, st.title + ": " + (s.title[1] || node)), still);
      }
      // Going back up the tree twice in a session: is the story working for them? (thumbs, once a session)
      if (back && backs(1) === 2 && !s.ending) {
        askWhenCalm({ id: "back-twice", kind: "thumbs", question: "Retracing your steps. Is the story working for you?", context: st.title + ": " + node, placeholder: "What would make it better? (optional)", thanks: "Thank you. We read every one." }, still);
      }
    }));

    document.addEventListener("iltv:landing", safe(function (e) {
      var d = e.detail;
      cancelAsk();
      if (cur) {
        var how = nav === "browser" ? "browser" : "all_stories";
        var from = cur;
        leaveScene("quit", "landing");
        A.feature(how === "browser" ? "back" : "all_stories", { via: how, story: from.story, from: from.node, depth: runs[from.story] ? runs[from.story].depth : undefined });
      }
      nav = null;
      cur = null;
      A.setContext({ story: null, node: null, depth: null, path: null, lang: null, explored: null, level: null });
      A.screen("landing");
      ready("landing");
    }));

    window.addEventListener("pagehide", safe(function () {
      if (cur) leaveVideo(cur.video, "leave");
      A.flush();
    }));
  }

  /* ---------------- a branch page (/<folder>/: one scene, its video and its choices as links) ---------------- */

  var passage = document.querySelector("main.passage[data-story]");
  if (passage) {
    var pStory = passage.getAttribute("data-story");
    var pNode = passage.getAttribute("data-node");
    var pLevel = pStory + "/" + pNode;
    var pState = passage.getAttribute("data-state") || "play";
    A.setContext({ story: pStory, node: pNode, page: "branch" });
    A.screen(pLevel);
    var pVideo = passage.querySelector("video");
    var pRec = pVideo ? watchVideo(pVideo, pLevel) : null;
    passage.addEventListener("click", safe(function (e) {
      var a = e.target && e.target.closest && e.target.closest("a.choice");
      if (!a) return;
      var en = a.querySelector(".spot-en");
      var to = String(a.getAttribute("href") || "").replace(/\/$/, "").split("/").pop();
      A.choice(pNode, ((en || a).textContent || "").trim().replace(/^\d+\.\s*/, ""), { story: pStory, to: to, page: "branch" });
      leaveVideo(pRec, "choice");
    }));
    if (pState === "dead") A.death(pNode, { story: pStory, page: "branch" });
    if (pState === "soon") {
      var title = passage.querySelector("h1 .spot-en");
      askWhenCalm(endingQuestion(pStory, pNode, pStory + ": " + ((title && title.textContent.trim()) || pNode)), function () { return true; });
    }
    window.addEventListener("pagehide", safe(function () { leaveVideo(pRec, "leave"); A.flush(); }));
    ready("branch");
  }

  /* ---------------- a blog post (/f/<post>/): how far it's read, and for how long ---------------- */

  var article = document.querySelector("main.post-layout article.post-article");
  var postMatch = location.pathname.match(/^\/f\/([^/]+)/);
  if (article && postMatch) {
    var post = decodeURIComponent(postMatch[1]).slice(0, 80);
    A.setContext({ post: post });
    A.screen("post");
    var marks = [25, 50, 75, 100];
    var reached = 0;
    var depthCheck = safe(function () {
      var r = article.getBoundingClientRect();
      var seen = Math.min(1, Math.max(0, (window.innerHeight - r.top) / Math.max(1, r.height)));
      var pct = Math.floor(seen * 100);
      while (marks.length && pct >= marks[0]) {
        reached = marks.shift();
        A.track("read_depth", { percent: reached, post: post });
      }
    });
    var scrollTimer = null;
    window.addEventListener("scroll", function () {
      if (scrollTimer) return;
      scrollTimer = setTimeout(function () { scrollTimer = null; depthCheck(); }, 250);
    }, { passive: true });
    setTimeout(depthCheck, 1500); // what's on screen without scrolling counts once they've stayed a moment

    // Time on the post: seconds it was on screen, sent when the page hides (again later if they come back).
    var seconds = 0;
    var sentSeconds = 0;
    setInterval(function () { if (!document.hidden) seconds++; }, 1000);
    var sendTime = safe(function () {
      if (seconds <= sentSeconds) return;
      sentSeconds = seconds;
      A.track("read_time", { seconds: seconds, percent: reached, post: post });
      A.flush();
    });
    window.addEventListener("visibilitychange", function () { if (document.hidden) sendTime(); }, true);
    window.addEventListener("pagehide", sendTime, true);
    [].forEach.call(article.querySelectorAll("video"), function (v, i) { watchVideo(v, "post/" + post + (i ? "/" + (i + 1) : "")); });
    ready("post");
  }

  /* ---------------- the other pages: What's new, Privacy, page not found ---------------- */

  if (!player && !passage && !(article && postMatch)) {
    var path = location.pathname;
    var name = /whatsnew/.test(path) ? "whatsnew" : /privacy/.test(path) ? "privacy" : document.querySelector("main.missing") ? "not_found" : "page";
    A.screen(name);
    ready(name);
    var optBox = document.getElementById("analytics-choice");
    if (optBox) {
      var optButton = optBox.querySelector("button");
      var optNote = optBox.querySelector("[data-analytics-state]");
      var paint = function () {
        var off = A.config().optedOut;
        optNote.textContent = off ? "Statistics are off in this browser." : "Statistics are on in this browser.";
        optButton.textContent = off ? "Turn statistics back on" : "Turn statistics off";
      };
      optButton.addEventListener("click", safe(function () {
        if (A.config().optedOut) A.optIn();
        else A.optOut();
        paint();
      }));
      safe(paint)();
      optBox.hidden = false;
    }
  }
})();
