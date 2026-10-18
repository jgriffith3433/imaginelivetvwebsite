/* The Hawkes standard sound setup for the site's stories (shared memory m_d00535b22659).

   Loaded on the home page (before js/game.js) and on every branch page (tools/build-story.mjs puts it there).
   1. A full-screen "Tap to play" prompt shows as soon as the page loads, in any orientation. Its title and line
      come from <html data-tap-title data-tap-line> (a branch page: its story's; the home page: the site's), or
      label(title, line) once js/game.js knows which story is open; The Final Spark's words when neither is set.
   2. That tap unlocks sound: it resumes an AudioContext (with a silent buffer, which iOS wants) and starts the
      page's video with sound, inside the tap, so iOS plays it inline and unmuted. Videos marked
      data-sound-start wait for the tap; js/game.js marks the player's video and plays the next ones itself.
   3. Sound comes back when the tab returns, the page is restored from the back/forward cache, or iOS
      interrupts the AudioContext. If the browser refuses to resume, the prompt shows again.
   4. Settings (the button in the header): Sound on/off and Volume, saved in localStorage "hawkes.sound" as
      { on, music, sfx } (0-1) and applied to every video on the page. A scene's video carries its narration and
      music together, so the one Volume slider sets both music and sfx. iOS ignores video.volume, so there the
      video is routed through a gain node instead.

   window.hawkesSound: state(), settings(), set({ on, music, sfx }), apply(video), unlocked(), prompt(), open(),
   label(title, line).
   Plain ES5, no dependencies: it must run on old iOS Safari too. */
(function () {
  "use strict";
  if (window.hawkesSound) return;

  var KEY = "hawkes.sound";
  var NativeContext = window.AudioContext || window.webkitAudioContext;

  var settings = read();
  var unlocked = false;
  var taps = 0;
  var trusted = false;
  var context = null;
  var overlay = null;
  var panel = null;
  var gear = null;
  var wasPlaying = [];
  var words = {
    title: document.documentElement.getAttribute("data-tap-title") || "THE FINAL SPARK",
    line: document.documentElement.getAttribute("data-tap-line") || "Strike the first match."
  };

  // iOS: video.volume is read-only (always 1).
  var volumeWorks = (function () {
    try {
      var probe = document.createElement("video");
      probe.volume = 0.5;
      return Math.abs(probe.volume - 0.5) < 0.01;
    } catch (e) {
      return true;
    }
  })();

  function clamp(n, fallback) {
    n = Number(n);
    if (!isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
  }

  function read() {
    var out = { on: true, music: 1, sfx: 1 };
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && typeof saved === "object") {
        if (typeof saved.on === "boolean") out.on = saved.on;
        out.music = clamp(saved.music, 1);
        out.sfx = clamp(saved.sfx, out.music);
      }
    } catch (e) { /* storage blocked or bad JSON: the defaults */ }
    return out;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) { /* private mode: the choice holds for this page */ }
  }

  // ─── Videos ────────────────────────────────────────────────────

  function apply(video) {
    if (!video) return;
    video.muted = !settings.on;
    if (volumeWorks) {
      video.volume = settings.music;
      return;
    }
    // iOS: a gain node, made only once the volume is turned down (the routing can't be undone).
    if (!video.hawkesGain && (settings.music >= 1 || !context)) return;
    try {
      if (!video.hawkesGain) {
        var source = context.createMediaElementSource(video);
        var gain = context.createGain();
        source.connect(gain);
        gain.connect(context.destination);
        video.hawkesGain = gain;
      }
      video.hawkesGain.gain.value = settings.music;
    } catch (e) { /* not routable: plays at full volume */ }
  }

  function applyAll() {
    var videos = document.querySelectorAll("video");
    for (var i = 0; i < videos.length; i++) apply(videos[i]);
  }

  function play(video) {
    apply(video);
    var started;
    try { started = video.play(); } catch (e) { return; }
    if (started && started.catch) {
      started.catch(function (error) {
        if (error && error.name === "NotAllowedError") showPrompt();
      });
    }
  }

  // Any video that starts gets the saved sound (the player's next scenes, a video started from its controls).
  document.addEventListener("play", function (event) {
    if (event.target && event.target.tagName === "VIDEO") apply(event.target);
  }, true);

  // ─── The unlock (inside the tap) ───────────────────────────────

  function resume() {
    if (!context || context.state === "running" || context.state === "closed") return;
    try {
      var p = context.resume();
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* needs a gesture; the next touch tries again */ }
  }

  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* older iOS */ }
    if (NativeContext && !context) {
      try {
        context = new NativeContext();
        context.onstatechange = function () {
          // iOS: a call, Siri or the lock screen leaves it "interrupted".
          if (context.state !== "running" && !document.hidden) resume();
        };
      } catch (e) { context = null; }
    }
    resume();
    if (context) {
      try {
        var source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 1, 22050);
        source.connect(context.destination);
        source.start(0);
      } catch (e) { /* the resume may still have worked */ }
    }
    unlocked = true;
    var waiting = document.querySelectorAll("video[data-sound-start]");
    for (var i = 0; i < waiting.length; i++) play(waiting[i]);
    applyAll();
  }

  // ─── The prompt ────────────────────────────────────────────────

  function showPrompt() {
    if (overlay || !document.body) return;
    overlay = document.createElement("div");
    overlay.className = "tap-to-play";
    overlay.id = "tap-to-play";
    overlay.setAttribute("role", "button");
    overlay.setAttribute("tabindex", "0");
    overlay.setAttribute("aria-label", "Tap to play");
    overlay.innerHTML =
      '<p class="tap-title"></p>' +
      '<span class="tap-match" aria-hidden="true"></span>' +
      '<span class="tap-button">Tap to play</span>' +
      '<p class="tap-note"></p>' +
      '<button type="button" class="tap-settings">Settings</button>';
    document.body.appendChild(overlay);
    renderNote();
    // Settings on the first screen: it must not count as the tap.
    var opener = overlay.querySelector(".tap-settings");
    ["click", "touchend"].forEach(function (type) {
      opener.addEventListener(type, function (event) {
        event.stopPropagation();
        if (type === "touchend") event.preventDefault();
        openSettings();
      }, type === "touchend" ? { passive: false } : false);
    });
    document.documentElement.classList.add("is-tap-waiting");
    overlay.addEventListener("click", onTap);
    // touchend is a gesture on iOS; preventDefault stops the follow-up click landing on a choice underneath.
    overlay.addEventListener("touchend", function (event) {
      event.preventDefault();
      onTap(event);
    }, { passive: false });
    window.addEventListener("keydown", onKey, true);
    try { overlay.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  }

  function renderNote() {
    var title = overlay && overlay.querySelector(".tap-title");
    if (title) title.textContent = words.title;
    var note = overlay && overlay.querySelector(".tap-note");
    if (note) note.textContent = (settings.on ? "Sound on" : "Sound off") + "." + (words.line ? " " + words.line : "");
  }

  // The prompt's words for the story that's open (js/game.js, when the home page opens straight into one).
  function label(title, line) {
    if (title) words.title = String(title);
    if (line != null) words.line = String(line);
    renderNote();
  }

  function onKey(event) {
    if (!overlay || event.repeat) return;
    if (panel || (event.target && event.target.closest && event.target.closest(".tap-settings"))) return;
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      event.stopImmediatePropagation();
      onTap(event);
    }
  }

  function onTap(event) {
    if (!overlay) return;
    taps++;
    trusted = !!(event && event.isTrusted);
    var gone = overlay;
    overlay = null;
    window.removeEventListener("keydown", onKey, true);
    document.documentElement.classList.remove("is-tap-waiting");
    unlock();
    gone.classList.add("is-gone");
    setTimeout(function () {
      if (gone.parentNode) gone.parentNode.removeChild(gone);
    }, 300);
  }

  // ─── Coming back ───────────────────────────────────────────────

  function onHidden() {
    wasPlaying = [];
    var videos = document.querySelectorAll("video");
    for (var i = 0; i < videos.length; i++) {
      if (!videos[i].paused && !videos[i].ended) wasPlaying.push(videos[i]);
    }
  }

  function onVisible() {
    if (!unlocked || document.hidden) return;
    resume();
    var list = wasPlaying;
    wasPlaying = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].isConnected && list[i].paused && !list[i].ended) play(list[i]);
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) onHidden();
    else onVisible();
  });
  window.addEventListener("pagehide", onHidden);
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) onVisible();
  });
  window.addEventListener("focus", onVisible);
  ["touchend", "pointerup", "keydown"].forEach(function (type) {
    window.addEventListener(type, function () { if (unlocked) resume(); }, true);
  });

  // ─── Settings ──────────────────────────────────────────────────

  var GEAR_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>';

  function addGear() {
    gear = document.createElement("button");
    gear.type = "button";
    gear.className = "sound-gear";
    gear.id = "sound-gear";
    gear.setAttribute("aria-label", "Settings");
    gear.setAttribute("aria-haspopup", "dialog");
    gear.title = "Settings";
    gear.innerHTML = GEAR_SVG;
    gear.addEventListener("click", openSettings);
    var header = document.querySelector(".site-header");
    (header || document.body).appendChild(gear);
    if (!header) gear.classList.add("is-floating");
  }

  function percent() {
    return Math.round(settings.music * 100);
  }

  function render() {
    if (!panel) return;
    var toggle = panel.querySelector("#sound-on");
    toggle.setAttribute("aria-checked", settings.on ? "true" : "false");
    toggle.querySelector(".sound-switch-text").textContent = settings.on ? "On" : "Off";
    var slider = panel.querySelector("#sound-volume");
    slider.value = String(percent());
    slider.disabled = !settings.on;
    panel.querySelector("#sound-volume-value").textContent = percent() + "%";
  }

  function set(next) {
    if (next && typeof next.on === "boolean") settings.on = next.on;
    if (next && next.music != null) settings.music = clamp(next.music, settings.music);
    if (next && next.sfx != null) settings.sfx = clamp(next.sfx, settings.sfx);
    save();
    applyAll();
    render();
    renderNote();
  }

  function openSettings() {
    if (panel) return;
    panel = document.createElement("div");
    panel.className = "sound-settings";
    panel.id = "sound-settings";
    panel.innerHTML =
      '<div class="sound-card" role="dialog" aria-modal="true" aria-labelledby="sound-settings-title">' +
      '<h2 id="sound-settings-title">Settings</h2>' +
      '<div class="sound-row"><span class="sound-label" id="sound-on-label">Sound</span>' +
      '<button type="button" class="sound-switch" id="sound-on" role="switch" aria-labelledby="sound-on-label">' +
      '<span class="sound-switch-knob" aria-hidden="true"></span><span class="sound-switch-text"></span></button></div>' +
      '<div class="sound-row"><label class="sound-label" for="sound-volume">Volume</label>' +
      '<input type="range" id="sound-volume" min="0" max="100" step="5">' +
      '<output class="sound-value" id="sound-volume-value" for="sound-volume"></output></div>' +
      '<button type="button" class="sound-done" id="sound-done">Done</button>' +
      "</div>";
    document.body.appendChild(panel);
    render();

    panel.querySelector("#sound-on").addEventListener("click", function () {
      set({ on: !settings.on });
    });
    panel.querySelector("#sound-volume").addEventListener("input", function (event) {
      var v = Number(event.target.value) / 100;
      set({ music: v, sfx: v });
    });
    panel.querySelector("#sound-done").addEventListener("click", closeSettings);
    panel.addEventListener("click", function (event) {
      if (event.target === panel) closeSettings();
    });
    document.addEventListener("keydown", onSettingsKey, true);
    panel.querySelector("#sound-on").focus();
  }

  function onSettingsKey(event) {
    if (event.key === "Escape") closeSettings();
  }

  function closeSettings() {
    if (!panel) return;
    document.removeEventListener("keydown", onSettingsKey, true);
    panel.parentNode.removeChild(panel);
    panel = null;
    if (gear) gear.focus();
  }

  window.hawkesSound = {
    settings: function () { return { on: settings.on, music: settings.music, sfx: settings.sfx }; },
    set: set,
    apply: apply,
    /** Plays a video with the saved sound; if the browser still wants a tap, the prompt comes back. */
    play: play,
    unlocked: function () { return unlocked; },
    prompt: function () { return overlay; },
    open: openSettings,
    label: label,
    /** What the playtest reads: the prompt, the tap, the AudioContext and the Settings panel. */
    state: function () {
      return {
        prompt: overlay ? "shown" : "gone",
        unlocked: unlocked,
        taps: taps,
        trusted: trusted,
        audio: context ? context.state : "none",
        settingsOpen: !!panel,
        volumeWorks: volumeWorks
      };
    }
  };

  addGear();
  showPrompt();
})();
