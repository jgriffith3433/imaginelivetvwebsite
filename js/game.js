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
      back: ui.back,
      mouth: ui.mouth,
      depth: ui.depth,
      backEn: en.back,
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
  const backButton = document.getElementById("spark-back");
  const stepBox = document.getElementById("spark-step");
  const landing = document.getElementById("stories");
  const storyList = document.getElementById("story-list");
  const firstScreen = document.getElementById("first-screen");
  const titleBox = document.getElementById("spark-title");
  const taglineBox = document.getElementById("spark-tagline");
  const storiesLink = document.getElementById("spark-stories");

  if (!root || !videoBox || !storyBox || !questionBox || !choicesBox || !endingBox || !backButton || !landing) {
    return;
  }

  let currentScene = null;
  let history = [];
  let fromPlayer = false;

  /** A story's saved place ({ scene, history }), from its own cookie. */
  function readProgress(story, scenes) {
    try {
      const prefix = story.cookie + "=";
      const item = document.cookie
        .split(";")
        .map(function (part) { return part.trim(); })
        .find(function (part) { return part.startsWith(prefix); });

      if (!item) return null;

      const saved = JSON.parse(decodeURIComponent(item.substring(prefix.length)));
      if (!saved || !scenes[saved.scene]) return null;

      return {
        scene: saved.scene,
        history: Array.isArray(saved.history)
          ? saved.history.filter(function (id) {
              return typeof id === "string" && !!scenes[id];
            })
          : []
      };
    } catch (error) {
      return null;
    }
  }

  function saveProgress() {
    try {
      const progress = encodeURIComponent(JSON.stringify({
        scene: currentScene,
        history: history
      }));

      let cookie =
        STORY.cookie + "=" + progress +
        "; Max-Age=" + (COOKIE_DAYS * 24 * 60 * 60) +
        "; Path=/; SameSite=Lax";

      if (location.protocol === "https:") {
        cookie += "; Secure";
      }

      document.cookie = cookie;
    } catch (error) {
      // The game stays playable if cookies are blocked.
    }
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
        if (el.closest && el.closest(".choice, #spark-back, .spark-tab, .stories-back")) return;
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
    saveProgress();
    root.dataset.state = sceneState(scene);
    backButton.disabled = history.length === 0;
    fillSpot(backButton, scene.back, scene.backEn, scene.lang, scene.dir);
    fillSpot(
      stepBox,
      history.length === 0 ? scene.mouth : scene.depth + " " + history.length,
      history.length === 0 ? scene.mouthEn : scene.depthEn + " " + history.length,
      scene.lang,
      scene.dir
    );

    videoBox.replaceChildren();
    const videoSrc = scene.video || null;

    if (videoSrc) {
      const video = document.createElement("video");
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
  }

  const treeRoot = document.getElementById("spark-tree");
  const tabPlay = document.getElementById("tab-play");
  const tabTree = document.getElementById("tab-tree");
  let spanParent = {};

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

  function openFromTree(sceneId) {
    if (!SCENES[sceneId]) return;
    const trail = [];
    let cursor = sceneId;
    const seen = {};
    while (spanParent[cursor] && !seen[cursor]) {
      seen[cursor] = true;
      trail.push(spanParent[cursor]);
      cursor = spanParent[cursor];
    }
    history = trail.reverse();
    fromPlayer = true;
    show(sceneId);
    setView("play");
  }

  function renderTree() {
    if (!treeRoot) return;

    const depthOf = {};
    const children = {};
    depthOf[STORY.start] = 0;
    children[STORY.start] = [];
    const extra = [];
    spanParent = {};
    const queue = [STORY.start];

    while (queue.length) {
      const id = queue.shift();
      SCENES[id].choices.forEach(function (choice) {
        const next = choice.next;
        if (!SCENES[next]) return;
        if (depthOf[next] == null) {
          depthOf[next] = depthOf[id] + 1;
          spanParent[next] = id;
          children[id].push({
            id: next,
            label: choice.say,
            en: choiceLabel(choice.en)
          });
          children[next] = [];
          queue.push(next);
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
    Object.keys(SCENES).forEach(function (id) {
      const depth = depthOf[id];
      if (depth == null) return;
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
      const scene = SCENES[id];
      const parent = spanParent[id] ? SCENES[spanParent[id]] : null;
      const via = parent
        ? children[spanParent[id]].filter(function (child) { return child.id === id; })[0]
        : null;
      const viaText = via && via.en.toLowerCase() !== String(scene.titleEn).toLowerCase()
        ? via
        : null;
      const point = pos[id];
      return '<button type="button" class="tree-node' +
        (scene.dead ? " is-dead" : "") +
        (id === currentScene ? " is-current" : "") +
        '" data-scene="' + id + '" style="left:' + point.x + "px;top:" + point.y + 'px">' +
        '<span class="tree-node-title">' + spotHtml(scene.title, scene.titleEn, scene.lang, scene.dir) + "</span>" +
        (viaText ? '<span class="tree-node-via">' + spotHtml(viaText.label, viaText.en, parent.lang, parent.dir) + "</span>" : "") +
        "</button>";
    }).join("");

    treeRoot.innerHTML =
      '<p class="tree-note">Drag sideways. The black branches are the choices.</p>' +
      '<div class="tree-scroll"><div class="tree-canvas" style="width:' + width + "px;height:" + height + 'px">' +
      '<svg class="tree-svg" viewBox="0 0 ' + width + " " + height + '" aria-hidden="true">' +
      paths.join("") +
      "</svg>" +
      nodes +
      "</div></div>";

    treeRoot.querySelectorAll(".tree-node").forEach(function (node) {
      node.addEventListener("click", function () {
        openFromTree(node.dataset.scene);
      });
    });

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

  backButton.addEventListener("click", function () {
    if (history.length === 0) return;
    fromPlayer = true;
    show(history.pop());
  });

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

  /** The cards say Continue for a story with a saved place past its start. */
  function markCards() {
    if (!storyList) return;
    storyList.querySelectorAll(".story-card").forEach(function (card) {
      const story = STORIES[card.dataset.story];
      const go = card.querySelector(".story-card-go");
      if (!story || !go) return;
      const saved = readProgress(story, story.scenes);
      go.textContent = saved && saved.scene !== story.start ? "Continue" : "Play";
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
    setView("play");
    window.scrollTo(0, 0);

    const saved = readProgress(story, SCENES);
    history = saved ? saved.history : [];
    show(saved ? saved.scene : story.start);
  }

  function showLanding(push) {
    if (push) window.history.pushState({}, "", urlFor(null));
    else if (new URL(location.href).searchParams.has("story")) window.history.replaceState({}, "", urlFor(null));
    stopVideo();
    STORY = null;
    currentScene = null;
    root.hidden = true;
    landing.hidden = false;
    if (firstScreen) firstScreen.classList.add("is-landing");
    document.documentElement.dataset.view = "landing";
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

  // Read-only views for the playtest (js/playtest.js): the open story's player, and the stories.
  window.finalSpark = {
    story: function () { return STORY ? STORY.id : null; },
    start: function () { return STORY ? STORY.start : null; },
    scene: function () { return currentScene; },
    scenes: function () { return Object.keys(SCENES); },
    depth: function () { return history.length; }
  };
  window.iltvStories = {
    list: function () { return DATA.stories.map(function (story) { return story.id; }); },
    listed: function () { return DATA.stories.filter(function (story) { return story.listed; }).map(function (story) { return story.id; }); },
    current: function () { return STORY ? STORY.id : null; },
    view: function () { return STORY ? "story" : "landing"; }
  };

  route();
})();
