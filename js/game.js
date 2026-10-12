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
    shadowStitch: "4OLvCW0jlp4"
  };

  const SCENES = {
    start: {
      story: "You wake up in a dark sewer. The air smells terrible, and water drips somewhere in the darkness.",
      question: "What will you do?",
      video: "start",
      choices: [
        { text: "1. Go back", next: "deadEnd" },
        { text: "2. Go right", next: "sewerWater" }
      ]
    },
    deadEnd: {
      story: "You reach a dead end. Something dark and disgusting is covering the floor.",
      question: "What will you do?",
      video: "deadEnd",
      choices: [
        { text: "1. Go back", next: "direction" },
        { text: "2. Touch the sludge", next: "sludge" }
      ]
    },
    direction: {
      story: "You return to the passage. The sewer stretches into the darkness.",
      question: "Which way will you go?",
      video: "direction",
      choices: [
        { text: "1. Go back", next: "deadEnd" },
        { text: "2. Go right", next: "sewerWater" }
      ]
    },
    sludge: {
      story: "You touch the sludge. The disgusting substance gets all over your skin, and you begin to feel seriously ill.",
      question: "You have died.",
      video: "sludge",
      choices: [
        { text: "1. Try again in another life", next: "start" }
      ]
    },
    sewerWater: {
      story: "You enter a flooded section of the sewer. The water looks filthy.",
      question: "What will you do?",
      video: "sewerWater",
      choices: [
        { text: "1. Get out of the water", next: "getOutWater" },
        { text: "2. Ignore it and continue", next: "disease" }
      ]
    },
    getOutWater: {
      story: "You manage to get out of the water and continue through the sewer.",
      question: "You discover a locked gate ahead.",
      video: "getOutWater",
      choices: [
        { text: "Continue", next: "gate" }
      ]
    },
    disease: {
      story: "After spending too long in the contaminated water, you develop trench foot. Your condition worsens until you can no longer continue.",
      question: "You have died.",
      video: "disease",
      choices: [
        { text: "1. Try again in another life", next: "start" }
      ]
    },
    gate: {
      story: "A locked gate blocks your way. You need to find a way through.",
      question: "What will you do?",
      video: "continue",
      choices: [
        { text: "1. Break the gate", next: "breakGate" },
        { text: "2. Pick the lock", next: "pickLock" }
      ]
    },
    breakGate: {
      story: "You try to break the gate, but getting through won't be easy.",
      question: "What will you do next?",
      video: "breakGate",
      choices: [
        { text: "1. Search for a key", next: "gotKey" }
      ]
    },
    pickLock: {
      story: "You try to pick the lock. You may need something more than your bare hands.",
      question: "What will you do next?",
      video: "pickLock",
      choices: [
        { text: "1. Search for a key", next: "gotKey" }
      ]
    },
    gotKey: {
      story: "You found a key!",
      question: "What will you do with it?",
      video: "gotKey",
      choices: [
        { text: "1. Use the key", next: "useKey" }
      ]
    },
    useKey: {
      story: "You use the key to unlock the gate. Beyond it, a thick fog fills the passage.",
      question: "Will you enter the fog?",
      video: "useKey",
      choices: [
        { text: "Continue in the fog", next: "fog" }
      ]
    },
    fog: {
      story: "You step through the gate and enter the fog. You can barely see what lies ahead.",
      question: "What will you do?",
      video: "fog",
      choices: [
        { text: "1. Set the door on fire", next: "fireDoor" },
        { text: "2. Knock", next: "knock" }
      ]
    },
    fireDoor: {
      story: "You decide to set the door on fire.",
      question: "What happens next?",
      video: "fireDoor",
      choices: [
        { text: "Continue", next: "uponTruck" }
      ]
    },
    knock: {
      story: "You approach the door and knock.",
      question: "What happens next?",
      video: "knock",
      choices: [
        { text: "Continue", next: "uponTruck" }
      ]
    },
    uponTruck: {
      story: "You find yourself standing before a truck.",
      question: "What will you do?",
      video: "uponTruck",
      choices: [
        { text: "1. Get inside truck", next: "insideTruck" },
        { text: "2. Walk away from truck", next: "walkAway" }
      ]
    },
    insideTruck: {
      story: "You get inside the truck.",
      question: "What happens next?",
      video: "insideTruck",
      choices: [
        { text: "Dance with the shadow", next: "shadowDance" }
      ]
    },
    walkAway: {
      story: "You decide to walk away from the truck.",
      question: "What will you do?",
      video: "walkAway",
      choices: [
        { text: "Dance with the shadow", next: "shadowDance" }
      ]
    },
    shadowDance: {
      story: "You dance with the shadow. As you move together, something awakens within you. A surge of strange energy courses through your body, and you discover that you have gained new powers.",
      question: "Your new powers have awakened.",
      video: "shadowDance",
      choices: [
        { text: "Explore new powers", next: "explorePowers" }
      ]
    },
    explorePowers: {
      story: "You haven't figured out how to use them properly yet.\n\nYou have 2 new powers:\n\n• Consume Light\n• Shadow Stitch",
      question: "Which power will you explore?",
      video: "explorePowers",
      choices: [
        { text: "1. Consume Light", next: "consumeLight" },
        { text: "2. Shadow Stitch", next: "shadowStitch" }
      ]
    },
    consumeLight: {
      story: "You attempt to use Consume Light.",
      question: "What happens next?",
      video: "consumeLight",
      choices: [],
      endingMessage: "MORE OF THE STORY COMING SOON..."
    },
    shadowStitch: {
      story: "You attempt to use Shadow Stitch.",
      question: "What happens next?",
      video: "shadowStitch",
      choices: [],
      endingMessage: "MORE OF THE STORY COMING SOON..."
    }
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
    if (scene.endingMessage) return "soon";
    if (scene.question === "You have died.") return "dead";
    return "play";
  }

  function show(sceneId) {
    const scene = SCENES[sceneId];
    if (!scene) return;

    currentScene = sceneId;
    saveProgress();
    root.dataset.state = sceneState(scene);
    backButton.disabled = history.length === 0;
    stepBox.textContent = history.length === 0
      ? "The tunnel mouth"
      : "Depth " + history.length;

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

    storyBox.textContent = scene.story;
    questionBox.textContent = scene.question;
    choicesBox.replaceChildren();

    scene.choices.forEach(function (choice) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = choice.text;
      button.addEventListener("click", function () {
        if (!SCENES[choice.next]) return;
        history.push(currentScene);
        fromPlayer = true;
        show(choice.next);
      });
      choicesBox.appendChild(button);
    });

    if (scene.choices.length === 0) {
      endingBox.textContent = scene.endingMessage || "MORE OF THE STORY COMING SOON...";
      endingBox.hidden = false;
    } else {
      endingBox.hidden = true;
      endingBox.textContent = "";
    }

    if (fromPlayer) {
      root.scrollIntoView({ block: "start" });
      fromPlayer = false;
    }
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
