/* Imagine Live TV audio buses (window.iltvAudio).

   One Web Audio context, unlocked on the viewer's first tap (phones). Three buses (ambience, music, ui) with
   gain fades. Ambience and music duck automatically while a clip with sound is playing (video play / pause /
   ended / volumechange — no polling). A header sound toggle mutes everything including clips; the choice is
   saved in localStorage "iltv.sound" and kept in step with hawkes.sound so Settings and Tap for sound still work.

   playUi(name) and setBed(story, mood) load /assets/audio/... when the file exists and do nothing when it
   doesn't, so later tasks only add files. Playtest events: unlock, duck, toggle (also on iltv:audio).

   Plain ES5, no dependencies. Loaded after js/hawkes-sound.js, before js/game.js. */
(function () {
  "use strict";
  if (window.iltvAudio) return;

  var KEY = "iltv.sound";
  var HAWKES_KEY = "hawkes.sound";
  var NativeContext = window.AudioContext || window.webkitAudioContext;
  var BED_LEVEL = 0.32;   // beds sit under clip dialogue
  var MUSIC_LEVEL = 0.28;
  var UI_LEVEL = 0.55;
  var DUCK_LEVEL = 0.18;  // fraction of bed/music while a clip has sound
  var FADE_IN = 0.35;
  var FADE_OUT = 0.45;
  var DUCK_FADE = 0.25;

  var enabled = readOn();
  var unlocked = false;
  var context = null;
  var master = null;
  var buses = { ambience: null, music: null, ui: null };
  var busGain = { ambience: BED_LEVEL, music: MUSIC_LEVEL, ui: UI_LEVEL };
  var ducked = false;
  var duckWant = false;
  var bed = { story: null, mood: null, source: null, buffer: null, url: null };
  var watched = null;
  var toggleBtn = null;
  var log = [];
  var syncing = false;
  var bufferCache = {};
  var missingUrls = {};

  function clamp01(n, fallback) {
    n = Number(n);
    if (!isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
  }

  function readOn() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw == null) {
        var hawkes = JSON.parse(localStorage.getItem(HAWKES_KEY) || "null");
        if (hawkes && typeof hawkes.on === "boolean") return hawkes.on;
        return true;
      }
      var saved = JSON.parse(raw);
      if (typeof saved === "boolean") return saved;
      if (saved && typeof saved.on === "boolean") return saved.on;
    } catch (e) { /* storage blocked or bad JSON */ }
    return true;
  }

  function saveOn() {
    try { localStorage.setItem(KEY, JSON.stringify({ on: enabled })); } catch (e) { /* private mode */ }
  }

  function tell(what, detail) {
    var row = { what: what, at: Date.now() };
    if (detail) {
      var k;
      for (k in detail) if (Object.prototype.hasOwnProperty.call(detail, k)) row[k] = detail[k];
    }
    log.push(row);
    if (log.length > 40) log.shift();
    try {
      document.dispatchEvent(new CustomEvent("iltv:audio", { detail: row }));
    } catch (e) { /* old browsers */ }
  }

  function masterTarget() {
    if (!enabled) return 0;
    try {
      var hs = window.hawkesSound;
      if (hs && hs.settings) {
        var s = hs.settings();
        if (s && typeof s.music === "number") return clamp01(s.music, 1);
      }
    } catch (e) { /* ignore */ }
    return 1;
  }

  function ensureGraph() {
    if (!NativeContext) return null;
    if (context) return context;
    try {
      context = new NativeContext();
    } catch (e) {
      context = null;
      return null;
    }
    master = context.createGain();
    master.gain.value = masterTarget();
    master.connect(context.destination);
    ["ambience", "music", "ui"].forEach(function (name) {
      var g = context.createGain();
      g.gain.value = busGain[name];
      g.connect(master);
      buses[name] = g;
    });
    return context;
  }

  function fadeTo(gainNode, value, seconds) {
    if (!gainNode || !context) return;
    var g = gainNode.gain;
    var dur = Math.max(0.02, seconds || 0.2);
    if (gainNode._iltvFadeTimer) {
      clearTimeout(gainNode._iltvFadeTimer);
      gainNode._iltvFadeTimer = null;
    }
    if (context.state !== "running") {
      try { g.cancelScheduledValues(context.currentTime); } catch (e0) { /* ignore */ }
      g.value = value;
      return;
    }
    var now = context.currentTime;
    var target = Math.max(0.0001, value);
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(0.0001, g.value), now);
      g.exponentialRampToValueAtTime(target, now + dur);
      if (value <= 0.0001) g.setValueAtTime(0, now + dur + 0.005);
    } catch (e) {
      g.value = value;
    }
    gainNode._iltvFadeTimer = setTimeout(function () {
      gainNode._iltvFadeTimer = null;
      try { g.value = value; } catch (e2) { /* ignore */ }
    }, Math.round(dur * 1000) + 20);
  }

  function applyMaster() {
    if (master) fadeTo(master, masterTarget(), enabled ? FADE_IN : FADE_OUT);
  }

  function applyDuck() {
    var next = !!(duckWant && enabled && unlocked);
    var amb = next ? BED_LEVEL * DUCK_LEVEL : BED_LEVEL;
    var mus = next ? MUSIC_LEVEL * DUCK_LEVEL : MUSIC_LEVEL;
    busGain.ambience = amb;
    busGain.music = mus;
    if (buses.ambience) fadeTo(buses.ambience, amb, DUCK_FADE);
    if (buses.music) fadeTo(buses.music, mus, DUCK_FADE);
    if (next !== ducked) {
      ducked = next;
      tell("duck", { on: ducked, ambience: amb, music: mus });
    }
  }

  function unlock() {
    if (unlocked && context && context.state === "running") return true;
    ensureGraph();
    if (!context) return false;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* older iOS */ }
    try {
      var p = context.resume();
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* needs a gesture */ }
    try {
      var source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, 22050);
      source.connect(master || context.destination);
      source.start(0);
    } catch (e) { /* resume may still have worked */ }
    var was = unlocked;
    unlocked = true;
    applyMaster();
    if (bed.story && bed.mood) startBed(bed.story, bed.mood, true);
    applyDuck();
    if (!was) tell("unlock", { audio: context.state });
    return true;
  }

  function onGesture(event) {
    var t = event && event.target;
    if (t && t.closest && t.closest(".tap-settings, .sound-settings")) return;
    unlock();
  }

  ["pointerdown", "touchend", "keydown"].forEach(function (type) {
    window.addEventListener(type, onGesture, true);
  });

  function stopBedSource() {
    if (!bed.source) return;
    try { bed.source.stop(0); } catch (e) { /* already stopped */ }
    try { bed.source.disconnect(); } catch (e2) { /* gone */ }
    bed.source = null;
  }

  function playBufferOn(busName, buffer, loop) {
    if (!unlocked || !enabled || !context || !buses[busName] || !buffer) return null;
    try {
      var src = context.createBufferSource();
      src.buffer = buffer;
      src.loop = !!loop;
      src.connect(buses[busName]);
      src.start(0);
      return src;
    } catch (e) {
      return null;
    }
  }

  function loadBuffer(url, done) {
    if (!url || missingUrls[url] || !window.fetch || !NativeContext) {
      done(null);
      return;
    }
    if (bufferCache[url]) {
      done(bufferCache[url]);
      return;
    }
    fetch(url, { method: "GET", cache: "force-cache" })
      .then(function (res) {
        if (!res.ok) {
          missingUrls[url] = true;
          throw new Error(String(res.status));
        }
        return res.arrayBuffer();
      })
      .then(function (raw) {
        if (!unlocked) throw new Error("locked");
        ensureGraph();
        if (!context) throw new Error("no context");
        return new Promise(function (resolve, reject) {
          var ret = context.decodeAudioData(raw, resolve, reject);
          if (ret && ret.then) ret.then(resolve, reject);
        });
      })
      .then(function (buf) {
        if (buf) bufferCache[url] = buf;
        done(buf);
      })
      .catch(function () { done(null); });
  }

  function bedUrl(story, mood) {
    if (!story || !mood) return null;
    return "/assets/audio/" + encodeURIComponent(String(story)) + "/" + encodeURIComponent(String(mood)) + ".mp3";
  }

  function uiUrl(name) {
    if (!name) return null;
    return "/assets/audio/ui/" + encodeURIComponent(String(name)) + ".mp3";
  }

  function startBed(story, mood, force) {
    var url = bedUrl(story, mood);
    bed.story = story || null;
    bed.mood = mood || null;
    if (!url) {
      stopBedSource();
      bed.buffer = null;
      bed.url = null;
      return;
    }
    if (!unlocked || !enabled) {
      stopBedSource();
      bed.url = url;
      return;
    }
    if (!force && bed.url === url && bed.source) return;
    bed.url = url;
    loadBuffer(url, function (buf) {
      if (bed.url !== url) return; // a newer setBed won
      stopBedSource();
      bed.buffer = buf;
      if (!buf) return; // missing file: do nothing
      if (!unlocked || !enabled) return;
      bed.source = playBufferOn("ambience", buf, true);
    });
  }

  function setBed(story, mood) {
    startBed(story, mood, false);
  }

  function playUi(name) {
    var url = uiUrl(name);
    if (!url || !unlocked || !enabled) return;
    loadBuffer(url, function (buf) {
      if (!buf) buf = synthUi(name); // no recording yet: the torch's own sounds are made here
      if (!buf) return; // missing file: do nothing
      playBufferOn("ui", buf, false);
    });
  }

  // The flashlight's soft click and low hum (js/spot.js), made in code until recordings exist at
  // /assets/audio/ui/torch-click.mp3 and torch-hum.mp3 (a file there wins).
  var synthCache = {};
  function synthUi(name) {
    if (name !== "torch-click" && name !== "torch-hum") return null;
    if (synthCache[name]) return synthCache[name];
    if (!context) return null;
    try {
      var rate = context.sampleRate;
      var secs = name === "torch-click" ? 0.09 : 3.2;
      var buf = context.createBuffer(1, Math.floor(rate * secs), rate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        var t = i / rate;
        if (name === "torch-click") {
          var env = Math.exp(-t * 70);
          data[i] = env * (0.5 * Math.sin(2 * Math.PI * 1900 * t) + 0.25 * Math.sin(2 * Math.PI * 640 * t) + 0.2 * (Math.random() * 2 - 1)) * 0.5;
        } else {
          var fade = Math.min(1, t / 0.4) * Math.min(1, (secs - t) / 0.8);
          data[i] = fade * 0.07 * (Math.sin(2 * Math.PI * 100 * t) + 0.5 * Math.sin(2 * Math.PI * 200 * t) + 0.12 * Math.sin(2 * Math.PI * 300 * t));
        }
      }
      synthCache[name] = buf;
      return buf;
    } catch (e) {
      return null;
    }
  }

  function clipHasSound(video) {
    if (!video || !video.isConnected) return false;
    if (video.paused || video.ended) return false;
    if (video.muted) return false;
    try {
      if (typeof video.volume === "number" && video.volume <= 0.001) return false;
    } catch (e) { /* iOS */ }
    return true;
  }

  function refreshDuck() {
    duckWant = clipHasSound(watched);
    applyDuck();
  }

  function onClipEvent() {
    refreshDuck();
  }

  function unwatch() {
    if (!watched) return;
    ["play", "playing", "pause", "ended", "volumechange"].forEach(function (type) {
      watched.removeEventListener(type, onClipEvent);
    });
    watched = null;
    duckWant = false;
    applyDuck();
  }

  function watch(video) {
    unwatch();
    if (!video) return;
    watched = video;
    ["play", "playing", "pause", "ended", "volumechange"].forEach(function (type) {
      video.addEventListener(type, onClipEvent);
    });
    refreshDuck();
  }

  function setEnabled(on, via) {
    on = !!on;
    if (on === enabled && via !== "load") {
      renderToggle();
      return;
    }
    enabled = on;
    saveOn();
    applyMaster();
    if (!enabled) stopBedSource();
    else if (unlocked && bed.story && bed.mood) startBed(bed.story, bed.mood, true);
    applyDuck();
    renderToggle();
    if (via !== "hawkes" && via !== "load") {
      syncing = true;
      try {
        if (window.hawkesSound && window.hawkesSound.set) window.hawkesSound.set({ on: enabled });
      } catch (e) { /* ignore */ }
      syncing = false;
    }
    if (via !== "load") tell("toggle", { on: enabled, via: via || "toggle" });
  }

  function syncFromHawkes(on) {
    if (syncing) return;
    if (typeof on !== "boolean") return;
    if (on === enabled) return;
    setEnabled(on, "hawkes");
  }

  function hookHawkes() {
    var hs = window.hawkesSound;
    if (!hs || hs._iltvAudioHooked) return;
    var orig = hs.set;
    if (typeof orig !== "function") return;
    hs.set = function (next) {
      orig.call(hs, next);
      if (next && typeof next.on === "boolean") syncFromHawkes(next.on);
      else if (enabled) applyMaster();
    };
    hs._iltvAudioHooked = true;
    // Prefer an existing iltv.sound; otherwise adopt hawkes.sound's on.
    try {
      var had = localStorage.getItem(KEY);
      if (had == null) {
        var s = hs.settings && hs.settings();
        if (s && typeof s.on === "boolean") {
          enabled = s.on;
          saveOn();
        }
      } else if (enabled !== hs.settings().on) {
        syncing = true;
        hs.set({ on: enabled });
        syncing = false;
      }
    } catch (e) { /* storage */ }
  }

  function renderToggle() {
    if (!toggleBtn) return;
    toggleBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
    toggleBtn.setAttribute("aria-label", enabled ? "Sound on" : "Sound off");
    toggleBtn.title = enabled ? "Sound on" : "Sound off";
    toggleBtn.dataset.on = enabled ? "1" : "0";
    toggleBtn.classList.toggle("is-off", !enabled);
  }

  var TOGGLE_SVG_ON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z"/></svg>';
  var TOGGLE_SVG_OFF =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.5 12c0-1.8-1-3.3-2.5-4v2.2l2.5 2.5V12zm2.5 0c0 .9-.2 1.8-.5 2.6l1.5 1.5c.7-1.3 1-2.7 1-4.1 0-4.3-3-7.9-7-8.8v2.1c2.9.9 5 3.5 5 6.7zM4.3 3L3 4.3 7.7 9H3v6h4l5 5v-6.7l4.7 4.7c-.7.5-1.5.8-2.4 1.1v2.1c1.4-.3 2.7-.9 3.8-1.8L19.7 21 21 19.7 4.3 3zM12 4L9.9 6.1 12 8.2V4z"/></svg>';

  function paintToggleIcon() {
    if (!toggleBtn) return;
    toggleBtn.innerHTML = enabled ? TOGGLE_SVG_ON : TOGGLE_SVG_OFF;
  }

  function addToggle() {
    if (toggleBtn || !document.body) return;
    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "iltv-sound-toggle";
    toggleBtn.id = "iltv-sound-toggle";
    toggleBtn.addEventListener("click", function () {
      unlock();
      setEnabled(!enabled, "toggle");
      paintToggleIcon();
    });
    var header = document.querySelector(".site-header");
    (header || document.body).appendChild(toggleBtn);
    if (!header) toggleBtn.classList.add("is-floating");
    renderToggle();
    paintToggleIcon();
  }

  function busLevels() {
    return {
      ambience: buses.ambience ? buses.ambience.gain.value : busGain.ambience,
      music: buses.music ? buses.music.gain.value : busGain.music,
      ui: buses.ui ? buses.ui.gain.value : busGain.ui,
      master: master ? master.gain.value : masterTarget()
    };
  }

  window.iltvAudio = {
    unlock: unlock,
    unlocked: function () { return unlocked; },
    enabled: function () { return enabled; },
    setEnabled: function (on) { setEnabled(!!on, "api"); paintToggleIcon(); },
    playUi: playUi,
    setBed: setBed,
    watch: watch,
    unwatch: unwatch,
    ducked: function () { return ducked; },
    bed: function () { return { story: bed.story, mood: bed.mood, url: bed.url, playing: !!bed.source }; },
    buses: busLevels,
    events: function () { return log.slice(); },
    toggle: function () { return toggleBtn; },
    state: function () {
      return {
        unlocked: unlocked,
        on: enabled,
        ducked: ducked,
        audio: context ? context.state : "none",
        bed: { story: bed.story, mood: bed.mood, hasBuffer: !!bed.buffer },
        buses: busLevels(),
        watching: !!(watched && watched.isConnected)
      };
    }
  };

  function boot() {
    hookHawkes();
    addToggle();
    applyMaster();
    saveOn();
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
