(function () {
  const COOKIE_NAME = "finalSparkProgress";
  const COOKIE_DAYS = 30;

  const VIDEOS = {
    start: "O5S27YawM7A",
    deadEnd: "EgWjbPEmdkQ",
    sludge: "YcH0wyTQOts",
    direction: "9TcxLtdIZ_E",
    sewerWater: "tzJQruzWStY",
    disease: "zglR2L61w80",
    getOutWater: "vnyvGqEH3tQ",
    continue: "PdzHVIt_kec",
    breakGate: "QqWqNT8EEZI",
    pickLock: "MNdrBO2FoIs",
    gotKey: "nu9v_DkgHjY",
    useKey: "L8BinuAL0DU",
    fog: "6OY9GQBNwuQ",
    fireDoor: "DiQS2Itt6ZY",
    knock: "6EHeRETttjA",
    uponTruck: "jLGDNVfgvpE",
    insideTruck: "Vq0GJULfI3g",
    walkAway: "kI0wB7lxp5I",
    shadowDance: "ZeJMYw19_9A",
    explorePowers: "aNJmIrKdSEI",
    consumeLight: "dEaB1FN9HTE",
    shadowStitch: "4OLvCW0jlp4",
    destroyTown: "SVmUanmBCGg"
  };

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

  const SCENES = {
    start: line("zh", "", {
      title: ["下水道", "The sewer"],
      story: ["你在黑暗的下水道里醒来。空气很难闻，黑暗里不知哪里在滴水。", "You wake up in a dark sewer. The air smells terrible, and water drips somewhere in the darkness."],
      question: ["你要做什么？", "What will you do?"],
      video: "start",
      choices: [
        ["1. 往回走", "1. Go back", "deadEnd"],
        ["2. 往右走", "2. Go right", "sewerWater"]
      ]
    }),
    deadEnd: line("hi", "", {
      title: ["बंद सिरा", "Dead end"],
      story: ["तुम एक बंद सिरे पर पहुँच गए। फर्श पर कुछ काला और घिनौना पसरा है।", "You reach a dead end. Something dark and disgusting is covering the floor."],
      question: ["तुम क्या करोगे?", "What will you do?"],
      video: "deadEnd",
      choices: [
        ["1. वापस जाओ", "1. Go back", "direction"],
        ["2. कीचड़ को छुओ", "2. Touch the sludge", "sludge"]
      ]
    }),
    direction: line("es", "", {
      title: ["El pasadizo", "The passage"],
      story: ["Vuelves al pasadizo. La cloaca se alarga hacia la oscuridad.", "You return to the passage. The sewer stretches into the darkness."],
      question: ["¿Hacia dónde irás?", "Which way will you go?"],
      video: "direction",
      choices: [
        ["1. Vuelve atrás", "1. Go back", "deadEnd"],
        ["2. Ve a la derecha", "2. Go right", "sewerWater"]
      ]
    }),
    sludge: line("fr", "", {
      title: ["La boue", "The sludge"],
      story: ["Tu touches la boue. La substance dégoûtante te couvre la peau, et tu commences à te sentir gravement malade.", "You touch the sludge. The disgusting substance gets all over your skin, and you begin to feel seriously ill."],
      question: ["Tu es mort.", "You have died."],
      video: "sludge",
      dead: true,
      choices: [
        ["1. Réessaie dans une autre vie", "1. Try again in another life", "start"]
      ]
    }),
    sewerWater: line("ar", "rtl", {
      title: ["ماء المجاري", "Sewer water"],
      story: ["تدخل قسمًا مغمورًا من المجاري. الماء يبدو قذرًا.", "You enter a flooded section of the sewer. The water looks filthy."],
      question: ["ماذا ستفعل؟", "What will you do?"],
      video: "sewerWater",
      choices: [
        ["1. اخرج من الماء", "1. Get out of the water", "getOutWater"],
        ["2. تجاهله وتابع", "2. Ignore it and continue", "disease"]
      ]
    }),
    getOutWater: line("pt", "", {
      title: ["Fora da água", "Out of the water"],
      story: ["Você consegue sair da água e continua pela cloaca.", "You manage to get out of the water and continue through the sewer."],
      question: ["Você descobre um portão trancado à frente.", "You discover a locked gate ahead."],
      video: "getOutWater",
      choices: [
        ["Continuar", "Continue", "gate"]
      ]
    }),
    disease: line("ru", "", {
      title: ["Окопная стопа", "Trench foot"],
      story: ["Пробыв слишком долго в грязной воде, ты заболеваешь окопной стопой. Тебе становится всё хуже, пока ты уже не можешь идти дальше.", "After spending too long in the contaminated water, you develop trench foot. Your condition worsens until you can no longer continue."],
      question: ["Ты умер.", "You have died."],
      video: "disease",
      dead: true,
      choices: [
        ["1. Попробуй снова в другой жизни", "1. Try again in another life", "start"]
      ]
    }),
    gate: line("ja", "", {
      title: ["門", "The gate"],
      story: ["錠のかかった門が道をふさいでいる。通り抜ける方法を見つけなければならない。", "A locked gate blocks your way. You need to find a way through."],
      question: ["どうする？", "What will you do?"],
      video: "continue",
      choices: [
        ["1. 門を壊す", "1. Break the gate", "breakGate"],
        ["2. 錠をこじる", "2. Pick the lock", "pickLock"]
      ]
    }),
    breakGate: line("bn", "", {
      title: ["গেট ভাঙো", "Break the gate"],
      story: ["তুমি গেট ভাঙতে চেষ্টা করো, কিন্তু পার হওয়া সহজ হবে না।", "You try to break the gate, but getting through won't be easy."],
      question: ["এরপর কী করবে?", "What will you do next?"],
      video: "breakGate",
      choices: [
        ["1. একটা চাবি খোঁজো", "1. Search for a key", "gotKey"]
      ]
    }),
    pickLock: line("de", "", {
      title: ["Das Schloss knacken", "Pick the lock"],
      story: ["Du versuchst, das Schloss zu knacken. Mit bloßen Händen reicht es vielleicht nicht.", "You try to pick the lock. You may need something more than your bare hands."],
      question: ["Was machst du als Nächstes?", "What will you do next?"],
      video: "pickLock",
      choices: [
        ["1. Nach einem Schlüssel suchen", "1. Search for a key", "gotKey"]
      ]
    }),
    gotKey: line("ko", "", {
      title: ["열쇠", "The key"],
      story: ["열쇠를 찾았다!", "You found a key!"],
      question: ["그걸로 무엇을 할 거야?", "What will you do with it?"],
      video: "gotKey",
      choices: [
        ["1. 열쇠를 쓴다", "1. Use the key", "useKey"]
      ]
    }),
    useKey: line("tr", "", {
      title: ["Kilidi aç", "Unlock"],
      story: ["Anahtarla kapının kilidini açarsın. Ötesini kalın bir sis doldurur.", "You use the key to unlock the gate. Beyond it, a thick fog fills the passage."],
      question: ["Sisin içine girecek misin?", "Will you enter the fog?"],
      video: "useKey",
      choices: [
        ["Siste devam et", "Continue in the fog", "fog"]
      ]
    }),
    fog: line("vi", "", {
      title: ["Sương mù", "The fog"],
      story: ["Bạn bước qua cổng và đi vào sương mù. Bạn hầu như không thấy phía trước có gì.", "You step through the gate and enter the fog. You can barely see what lies ahead."],
      question: ["Bạn sẽ làm gì?", "What will you do?"],
      video: "fog",
      choices: [
        ["1. Đốt cánh cửa", "1. Set the door on fire", "fireDoor"],
        ["2. Gõ cửa", "2. Knock", "knock"]
      ]
    }),
    fireDoor: line("it", "", {
      title: ["Brucia la porta", "Burn the door"],
      story: ["Decidi di dare fuoco alla porta.", "You decide to set the door on fire."],
      question: ["Che cosa succede dopo?", "What happens next?"],
      video: "fireDoor",
      choices: [
        ["Continua", "Continue", "uponTruck"]
      ]
    }),
    knock: line("id", "", {
      title: ["Ketuk", "Knock"],
      story: ["Kamu mendekati pintu dan mengetuk.", "You approach the door and knock."],
      question: ["Apa yang terjadi selanjutnya?", "What happens next?"],
      video: "knock",
      choices: [
        ["Lanjutkan", "Continue", "uponTruck"]
      ]
    }),
    uponTruck: line("ur", "rtl", {
      title: ["ٹرک", "The truck"],
      story: ["تم اپنے آپ کو ایک ٹرک کے سامنے کھڑا پاتے ہو۔", "You find yourself standing before a truck."],
      question: ["تم کیا کرو گے؟", "What will you do?"],
      video: "uponTruck",
      choices: [
        ["1. ٹرک کے اندر جاؤ", "1. Get inside truck", "insideTruck"],
        ["2. ٹرک سے دور چل دو", "2. Walk away from truck", "walkAway"]
      ]
    }),
    insideTruck: line("pl", "", {
      title: ["W środku", "Inside"],
      story: ["Wchodzisz do ciężarówki.", "You get inside the truck."],
      question: ["Co dzieje się dalej?", "What happens next?"],
      video: "insideTruck",
      choices: [
        ["Zatańcz z cieniem", "Dance with the shadow", "shadowDance"]
      ]
    }),
    walkAway: line("th", "", {
      title: ["เดินจากไป", "Walk away"],
      story: ["เจ้าตัดสินใจเดินหนีจากรถบรรทุก", "You decide to walk away from the truck."],
      question: ["เจ้าจะทำอะไร?", "What will you do?"],
      video: "walkAway",
      choices: [
        ["เต้นกับเงา", "Dance with the shadow", "shadowDance"]
      ]
    }),
    shadowDance: line("sw", "", {
      title: ["Densi ya kivuli", "Shadow dance"],
      story: ["Unacheza na kivuli. Mnapoenda pamoja, kitu kinaamka ndani yako. Mwanguko wa nguvu ya ajabu unapita mwilini mwako, na unagundua umepata nguvu mpya.", "You dance with the shadow. As you move together, something awakens within you. A surge of strange energy courses through your body, and you discover that you have gained new powers."],
      question: ["Nguvu zako mpya zimeamka.", "Your new powers have awakened."],
      video: "shadowDance",
      choices: [
        ["Chunguza nguvu mpya", "Explore new powers", "explorePowers"]
      ]
    }),
    explorePowers: line("ta", "", {
      title: ["புதிய சக்திகள்", "New powers"],
      story: ["அவற்றை சரியாகப் பயன்படுத்த இன்னும் தெரியவில்லை.\n\nஉனக்கு 2 புதிய சக்திகள் உள்ளன:\n\n• ஒளியை விழுங்கு\n• நிழல் தையல்", "You haven't figured out how to use them properly yet.\n\nYou have 2 new powers:\n\n• Consume Light\n• Shadow Stitch"],
      question: ["எந்த சக்தியை ஆராய்வாய்?", "Which power will you explore?"],
      video: "explorePowers",
      choices: [
        ["1. ஒளியை விழுங்கு", "1. Consume Light", "consumeLight"],
        ["2. நிழல் தையல்", "2. Shadow Stitch", "shadowStitch"]
      ]
    }),
    consumeLight: line("te", "", {
      title: ["కాంతిని మింగు", "Consume Light"],
      story: ["నువ్వు కాంతిని మింగడానికి ప్రయత్నిస్తావు.", "You attempt to use Consume Light."],
      question: ["తర్వాత ఏం జరుగుతుంది?", "What happens next?"],
      video: "consumeLight",
      choices: [
        ["పట్టణాన్ని నాశనం చేయి", "Destroy town", "destroyTown"]
      ]
    }),
    shadowStitch: line("mr", "", {
      title: ["सावली शिवणे", "Shadow Stitch"],
      story: ["तू सावली शिवण्याचा प्रयत्न करतोस.", "You attempt to use Shadow Stitch."],
      question: ["पुढे काय होते?", "What happens next?"],
      video: "shadowStitch",
      choices: [
        ["शहर उद्ध्वस्त कर", "Destroy town", "destroyTown"]
      ]
    }),
    destroyTown: line("pa", "", {
      title: ["ਸ਼ਹਿਰ ਤਬਾਹ ਕਰੋ", "Destroy town"],
      story: ["ਤੂੰ ਸਾਰਾ ਸ਼ਹਿਰ ਤਬਾਹ ਕਰਨ ਦਾ ਫੈਸਲਾ ਕੀਤਾ।", "You decided to destroy the whole town."],
      question: ["ਅੱਗੇ ਕੀ ਹੁੰਦਾ ਹੈ?", "What happens next?"],
      video: "destroyTown",
      choices: [],
      ending: ["ਹੋਰ ਕਹਾਣੀ ਜਲਦੀ ਆ ਰਹੀ ਹੈ...", "MORE OF THE STORY COMING SOON..."]
    })
  };

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
    const videoId = scene.video ? VIDEOS[scene.video] : null;

    if (videoId) {
      const iframe = document.createElement("iframe");
      iframe.src =
        "https://www.youtube-nocookie.com/embed/" +
        videoId +
        "?autoplay=0&controls=0&playsinline=1&rel=0&iv_load_policy=3";
      iframe.title = "The Final Spark story video";
      iframe.setAttribute("allow", "encrypted-media; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      videoBox.appendChild(iframe);
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

  const savedProgress = readProgress();
  if (savedProgress) {
    history = savedProgress.history;
    show(savedProgress.scene);
  } else {
    show("start");
  }
})();
