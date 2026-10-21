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
      dead: !!spec.dead,
      ending: spec.ending ? spec.ending[0] : "",
      endingEn: spec.ending ? spec.ending[1] : "",
      choices: (spec.choices || []).map(function (choice) {
        return { say: choice[0], en: choice[1], next: choice[2] };
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

  if (!root || !videoBox || !storyBox || !questionBox || !choicesBox || !endingBox || !landing) {
    return;
  }

  let currentScene = null;
  let history = [];
  let fromPlayer = false;

  /** Tells js/analytics.js (Hawkes Analytics) what just happened: "iltv:<what>" on the document. The player never
      waits for it or depends on anyone listening. */
  function tell(what, detail) {
    try {
      document.dispatchEvent(new CustomEvent("iltv:" + what, { detail: detail }));
    } catch (error) {
      // Nothing listening, or an old browser: the story plays on.
    }
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
  function unlocksCookie(story) {
    return story.cookie + "Unlocked";
  }

  /** A story's current run ({ scene, history }), or null. */
  function readProgress(story, scenes) {
    const saved = readCookie(story.cookie);
    if (!saved || !scenes[saved.scene]) return null;
    return {
      scene: saved.scene,
      history: Array.isArray(saved.history)
        ? saved.history.filter(function (id) {
            return typeof id === "string" && !!scenes[id];
          })
        : []
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

  /** How much of a story has been explored: unlocked scenes / all its scenes, in whole percent, rounded down (so
      100 only once every scene has been seen). */
  function exploredOf(story, seen) {
    const all = Object.keys(story.scenes).length;
    return all ? Math.floor((Object.keys(seen).length * 100) / all) : 0;
  }

  let completed = false;
  let unlocked = {};

  /** Start Over: forgets one story's current run (its run cookie only; its unlocks and the other stories stay). */
  function clearProgress(story) {
    try {
      document.cookie = story.cookie + "=; Max-Age=0; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    } catch (error) {
      // Cookies blocked: there was nothing saved.
    }
  }

  function saveProgress() {
    writeCookie(STORY.cookie, { scene: currentScene, history: history });
    writeCookie(unlocksCookie(STORY), { seen: Object.keys(unlocked), completed: completed });
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

  function playClip(video) {
    activeClip = video;
    stopClipUnlock();
    // js/hawkes-sound.js: the first video waits for the Tap to play prompt, which starts it with sound. The next
    // ones start here, inside the viewer's click, with the saved Settings.
    var sound = window.hawkesSound;
    if (sound) {
      video.setAttribute("data-sound-start", "");
      if (sound.unlocked()) sound.play(video);
      else sound.apply(video);
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
        video.muted = false;
        if (video.paused) {
          var again = video.play();
          if (again && again.catch) again.catch(function () {});
        }
      };
      document.addEventListener("pointerdown", clipUnlock, true);
    });
  }

  function show(sceneId) {
    const scene = SCENES[sceneId];
    if (!scene) return;

    currentScene = sceneId;
    // Only the player unlocks a scene (the branch pages don't touch the cookies).
    unlocked[sceneId] = true;
    if (scene.ending) completed = true;
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

    showKit();

    videoBox.replaceChildren();
    const videoSrc = scene.video || null;
    let video = null;

    if (videoSrc) {
      video = document.createElement("video");
      video.src = videoSrc;
      // With the sound prompt, playClip starts it (autoplay would start it behind the prompt).
      video.autoplay = !window.hawkesSound;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = "auto";
      video.title = STORY.title + " story video";
      videoBox.appendChild(video);
      playClip(video);
    } else {
      // A draft story's scene before its media is made: its title on black, where the video will be.
      const blank = document.createElement("div");
      blank.className = "spark-video-blank";
      blank.textContent = scene.titleEn;
      videoBox.appendChild(blank);
    }

    fillSpot(storyBox, scene.story, scene.storyEn, scene.lang, scene.dir);
    fillSpot(questionBox, scene.question, scene.questionEn, scene.lang, scene.dir);
    choicesBox.replaceChildren();

    scene.choices.forEach(function (choice) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      fillSpot(button, choice.say, choice.en, scene.lang, scene.dir);
      button.addEventListener("click", function () {
        if (!SCENES[choice.next]) return;
        tell("choice", { story: STORY.id, from: currentScene, to: choice.next, option: choiceLabel(choice.en) });
        history.push(currentScene);
        fromPlayer = true;
        show(choice.next);
      });
      choicesBox.appendChild(button);
    });

    if (scene.choices.length === 0) {
      fillSpot(endingBox, scene.ending, scene.endingEn, scene.lang, scene.dir);
      endingBox.hidden = false;
    } else {
      endingBox.hidden = true;
      endingBox.replaceChildren();
    }

    if (fromPlayer) {
      const rect = root.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        root.scrollIntoView({ block: "nearest" });
      }
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
  const tabPlay = document.getElementById("tab-play");
  const tabTree = document.getElementById("tab-tree");

  function choiceLabel(text) {
    return String(text).replace(/^\d+\.\s*/, "");
  }

  function setView(view) {
    const playing = view !== "tree";
    const playPane = document.getElementById("spark-play");
    if (!playPane || !treeRoot || !tabPlay || !tabTree) return;

    playPane.hidden = !playing;
    treeRoot.hidden = playing;
    root.classList.toggle("is-tree", !playing);
    tabPlay.classList.toggle("is-active", playing);
    tabTree.classList.toggle("is-active", !playing);
    tabPlay.setAttribute("aria-selected", playing ? "true" : "false");
    tabTree.setAttribute("aria-selected", playing ? "false" : "true");

    if (!playing) renderTree();
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
    const padX = 48;
    const padY = 160;
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

    const nodes = Object.keys(pos).map(function (id) {
      const parent = spanParent[id] ? SCENES[spanParent[id]] : null;
      const via = parent
        ? children[spanParent[id]].filter(function (child) { return child.id === id; })[0]
        : null;
      const point = pos[id];
      const at = ' style="left:' + point.x + "px;top:" + point.y + 'px"';
      if (locked[id]) {
        // Only the choice you'd make to get there: you saw it on the page.
        return '<div class="tree-node is-locked"' + at + '>' +
          '<span class="tree-node-title">?</span>' +
          (via ? '<span class="tree-node-via">' + spotHtml(via.label, via.en, parent.lang, parent.dir) + "</span>" : "") +
          "</div>";
      }
      const scene = SCENES[id];
      const viaText = via && via.en.toLowerCase() !== String(scene.titleEn).toLowerCase()
        ? via
        : null;
      return '<div class="tree-node' +
        (scene.dead ? " is-dead" : "") +
        (id === currentScene ? " is-current" : "") +
        '" data-scene="' + id + '"' + at + '>' +
        '<span class="tree-node-title">' + spotHtml(scene.title, scene.titleEn, scene.lang, scene.dir) + "</span>" +
        (viaText ? '<span class="tree-node-via">' + spotHtml(viaText.label, viaText.en, parent.lang, parent.dir) + "</span>" : "") +
        "</div>";
    }).join("");

    treeRoot.innerHTML =
      '<p class="tree-note">What you have found: ' + exploredOf(STORY, unlocked) + '% explored. Drag sideways. A ? is a way you haven\'t taken.</p>' +
      '<div class="tree-scroll"><div class="tree-canvas" style="width:' + width + "px;height:" + height + 'px">' +
      '<svg class="tree-svg" viewBox="0 0 ' + width + " " + height + '" aria-hidden="true">' +
      paths.join("") +
      "</svg>" +
      nodes +
      "</div></div>";

    bindTreePan(treeRoot.querySelector(".tree-scroll"));
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
  }

  /* ---------------- the landing page and the stories ---------------- */

  const SITE_TITLE = document.title;
  const SITE_TAP = {
    title: document.documentElement.getAttribute("data-tap-title") || "",
    line: document.documentElement.getAttribute("data-tap-line") || ""
  };

  function stopVideo() {
    stopClipUnlock();
    activeClip = null;
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

  function prompt(words) {
    if (window.hawkesSound && window.hawkesSound.label) window.hawkesSound.label(words.title, words.line);
  }

  // js/hawkes-sound.js on the home page (<html data-tap-splash>): a story asks for its own Tap to play (that tap
  // unlocks sound); the landing page has no video, so the first time it shows the site's title splash instead.
  let splashed = false;
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
      const badge = card.querySelector(".story-card-ribbon");
      if (badge) badge.textContent = BADGES[progress];
      const explored = card.querySelector(".story-card-explored");
      if (explored) explored.textContent = exploredOf(story, readUnlocks(story).seen) + "% explored";
      const go = card.querySelector(".story-card-go");
      if (go) go.textContent = progress === "completed" ? "Start Over" : GO[run];
    });
  }

  function openStory(storyId, push) {
    const story = STORIES[storyId];
    if (!story) return showLanding(false);
    if (push) window.history.pushState({ story: storyId }, "", urlFor(storyId));
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
    document.title = story.title + " · " + SITE_TITLE;
    prompt(story.tap);
    sound("ask");
    splashed = true;

    landing.hidden = true;
    root.hidden = false;
    if (firstScreen) firstScreen.classList.remove("is-landing");
    document.documentElement.dataset.view = "story";
    if (story.inventory) document.documentElement.dataset.kit = story.id;
    else delete document.documentElement.dataset.kit;
    setView("play");
    window.scrollTo(0, 0);

    const saved = readProgress(story, SCENES);
    const unlocks = readUnlocks(story);
    history = saved ? saved.history : [];
    unlocked = unlocks.seen;
    completed = unlocks.completed;
    tell("open", { story: story.id, resumed: !!saved && saved.scene !== story.start });
    show(saved ? saved.scene : story.start);
  }

  function showLanding(push) {
    tell("landing", { story: STORY ? STORY.id : null, scene: currentScene });
    if (push) window.history.pushState({}, "", urlFor(null));
    else if (new URL(location.href).searchParams.has("story")) window.history.replaceState({}, "", urlFor(null));
    stopVideo();
    STORY = null;
    currentScene = null;
    root.hidden = true;
    landing.hidden = false;
    if (firstScreen) firstScreen.classList.add("is-landing");
    document.documentElement.dataset.view = "landing";
    delete document.documentElement.dataset.kit;
    showKit();
    document.title = SITE_TITLE;
    prompt(SITE_TAP);
    sound("dismiss");
    if (!splashed) sound("splash", SITE_TAP.title);
    splashed = true;
    markCards();
  }

  function route() {
    const id = new URL(location.href).searchParams.get("story");
    if (id && STORIES[id]) openStory(id, false);
    else showLanding(false);
  }

  if (storyList) {
    storyList.addEventListener("click", function (event) {
      const card = event.target.closest && event.target.closest("a.story-card");
      if (!card || !STORIES[card.dataset.story]) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault();
      // Once completed (or at an ending) the card says Start Over: the run goes (its unlocks stay), and it opens at the start.
      const startOver = card.dataset.progress === "completed" || card.dataset.run === "end";
      if (startOver) {
        clearProgress(STORIES[card.dataset.story]);
        tell("restart", { story: card.dataset.story, via: "start_over" });
      }
      tell("card", { story: card.dataset.story, go: startOver ? "end" : card.dataset.run, progress: card.dataset.progress });
      openStory(card.dataset.story, true);
    });
  }

  if (storiesLink) {
    storiesLink.addEventListener("click", function (event) {
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
    inventory: function () { return kitCounts(); }
  };
  window.iltvStories = {
    list: function () { return DATA.stories.map(function (story) { return story.id; }); },
    listed: function () { return DATA.stories.filter(function (story) { return story.listed; }).map(function (story) { return story.id; }); },
    current: function () { return STORY ? STORY.id : null; },
    progress: function (id) { return STORIES[id] ? progressOf(STORIES[id]) : null; },
    run: function (id) { return STORIES[id] ? runOf(STORIES[id]) : null; },
    explored: function (id) { return STORIES[id] ? exploredOf(STORIES[id], readUnlocks(STORIES[id]).seen) : null; },
    view: function () { return STORY ? "story" : "landing"; }
  };

  route();
})();
