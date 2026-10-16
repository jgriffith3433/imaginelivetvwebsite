(function () {
  const COOKIE_NAME = "finalSparkProgress";
  const COOKIE_DAYS = 30;

  // The scenes come from js/story-data.js, built from story/final-spark.json by tools/build-story.mjs.
  const STORY = window.FINAL_SPARK;
  if (!STORY) return;

  const UI = {
    zh: { back: "← 返回", mouth: "隧道口", depth: "深度" },
    hi: { back: "← वापस", mouth: "सुरंग का मुँह", depth: "गहराई" },
    es: { back: "← Atrás", mouth: "La boca del túnel", depth: "Profundidad" },
    fr: { back: "← Retour", mouth: "L'entrée du tunnel", depth: "Profondeur" },
    ar: { back: "← رجوع", mouth: "فم النفق", depth: "العمق" },
    pt: { back: "← Voltar", mouth: "A boca do túnel", depth: "Profundidade" },
    ru: { back: "← Назад", mouth: "Устье тоннеля", depth: "Глубина" },
    ja: { back: "← 戻る", mouth: "トンネルの入口", depth: "深さ" },
    bn: { back: "← ফিরে যাও", mouth: "সুড়ঙ্গের মুখ", depth: "গভীরতা" },
    de: { back: "← Zurück", mouth: "Der Tunnelmund", depth: "Tiefe" },
    ko: { back: "← 뒤로", mouth: "터널 입구", depth: "깊이" },
    tr: { back: "← Geri", mouth: "Tünelin ağzı", depth: "Derinlik" },
    vi: { back: "← Quay lại", mouth: "Miệng đường hầm", depth: "Độ sâu" },
    it: { back: "← Indietro", mouth: "La bocca del tunnel", depth: "Profondità" },
    id: { back: "← Kembali", mouth: "Mulut terowongan", depth: "Kedalaman" },
    ur: { back: "← واپس", mouth: "سرنگ کا منہ", depth: "گہرائی" },
    pl: { back: "← Wstecz", mouth: "Ujście tunelu", depth: "Głębokość" },
    th: { back: "← กลับ", mouth: "ปากอุโมงค์", depth: "ความลึก" },
    sw: { back: "← Rudi", mouth: "Mdomo wa handaki", depth: "Kina" },
    ta: { back: "← பின்", mouth: "சுரங்க வாயில்", depth: "ஆழம்" },
    te: { back: "← వెనక్కి", mouth: "సొరంగం నోరు", depth: "లోతు" },
    mr: { back: "← मागे", mouth: "बोगद्याचे तोंड", depth: "खोली" },
    pa: { back: "← ਪਿੱਛੇ", mouth: "ਸੁਰੰਗ ਦਾ ਮੂੰਹ", depth: "ਡੂੰਘਾਈ" }
  };

  function line(lang, dir, spec) {
    const ui = UI[lang];
    return {
      lang: lang,
      dir: dir || "",
      back: ui.back,
      mouth: ui.mouth,
      depth: ui.depth,
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

  const SCENES = {};
  Object.keys(STORY.scenes).forEach(function (id) {
    const s = STORY.scenes[id];
    SCENES[id] = line(s.lang, s.dir, s);
  });

  const root = document.getElementById("spark");
  const videoBox = document.getElementById("spark-video");
  const storyBox = document.getElementById("spark-story");
  const questionBox = document.getElementById("spark-question");
  const choicesBox = document.getElementById("spark-choices");
  const endingBox = document.getElementById("spark-ending");
  const backButton = document.getElementById("spark-back");
  const stepBox = document.getElementById("spark-step");

  if (!root || !videoBox || !storyBox || !questionBox || !choicesBox || !endingBox || !backButton) {
    return;
  }

  let currentScene = "start";
  let history = [];
  let fromPlayer = false;

  function readProgress() {
    try {
      const prefix = COOKIE_NAME + "=";
      const item = document.cookie
        .split(";")
        .map(function (part) { return part.trim(); })
        .find(function (part) { return part.startsWith(prefix); });

      if (!item) return null;

      const saved = JSON.parse(decodeURIComponent(item.substring(prefix.length)));
      if (!saved || !SCENES[saved.scene]) return null;

      return {
        scene: saved.scene,
        history: Array.isArray(saved.history)
          ? saved.history.filter(function (id) {
              return typeof id === "string" && !!SCENES[id];
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
        COOKIE_NAME + "=" + progress +
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
        if (el.closest && el.closest(".choice, #spark-back, .spark-tab")) return;
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
    fillSpot(backButton, scene.back, "← Back", scene.lang, scene.dir);
    fillSpot(
      stepBox,
      history.length === 0 ? scene.mouth : scene.depth + " " + history.length,
      history.length === 0 ? "The tunnel mouth" : "Depth " + history.length,
      scene.lang,
      scene.dir
    );

    videoBox.replaceChildren();
    const videoSrc = scene.video || null;

    if (videoSrc) {
      const video = document.createElement("video");
      video.src = videoSrc;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = "auto";
      video.title = "The Final Spark story video";
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

    const depthOf = { start: 0 };
    const children = { start: [] };
    const extra = [];
    spanParent = {};
    const queue = ["start"];

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

  // Read-only view for the playtest (js/playtest.js).
  window.finalSpark = {
    scene: function () { return currentScene; },
    scenes: function () { return Object.keys(SCENES); },
    depth: function () { return history.length; }
  };

  const savedProgress = readProgress();
  if (savedProgress) {
    history = savedProgress.history;
    show(savedProgress.scene);
  } else {
    show("start");
  }
})();
