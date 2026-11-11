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
  var bed = { story: null, mood: null, source: null, buffer: null, url: null, key: null, gain: null };
  var beds = [];          // live bed sources (the current one, plus one fading out for under a second)
  var bedsGo = false;     // beds start only after the first clip plays (or on an image page, or the first choice tap)
  var uiNow = null;       // the one UI sound that may play at a time: { src, priority, ends }
  var lastVariant = {};
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
    // Sound off: nothing is made, so nothing is logged (the toggle's own event aside).
    if (!enabled && what !== "toggle") return;
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
    if (bed.story && bed.mood) startBed(bed.story, bed.mood, false, "unlock");
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

  /* ---- The sounds (made here, in code: no files to fetch, nothing 404s) ----
     When recordings exist at /assets/audio/ they can replace these; until then every UI sound, ending sting and
     ambient bed is built from oscillators and filtered noise the first time it is needed (after unlock). */

  function rand(seed) { // small deterministic generator so a bed is the same every load
    var x = seed >>> 0 || 1;
    return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  }

  function mono(secs, fn) {
    var rate = context.sampleRate;
    var buf = context.createBuffer(1, Math.max(1, Math.floor(rate * secs)), rate);
    fn(buf.getChannelData(0), rate);
    return buf;
  }

  function normalise(d, peak) {
    var m = 0, i;
    for (i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
    if (m > 0) for (i = 0; i < d.length; i++) d[i] *= peak / m;
  }

  var TAU = Math.PI * 2;

  /** Loops are seamless by construction: tones sit on whole cycles of the loop length, and the noise is made a
      little longer than the loop, its extra tail cross-faded (equal power) into the head so there is no click. */
  function loopNoise(d, rnd, k1, k2, amp) {
    var n = d.length, xf = Math.min(Math.floor(n / 8), 16000), total = n + xf, y1 = 0, y2 = 0, i;
    var x = new Float32Array(total);
    for (i = 0; i < 4000; i++) { var w0 = rnd() * 2 - 1; y1 += k1 * (w0 - y1); y2 += k2 * (w0 - y2); }
    for (i = 0; i < total; i++) {
      var w = rnd() * 2 - 1;
      y1 += k1 * (w - y1);
      y2 += k2 * (w - y2);
      x[i] = (y1 - y2) * amp;
    }
    for (i = 0; i < n; i++) d[i] += x[i];
    for (i = 0; i < xf; i++) {
      var f = i / xf;
      d[i] = x[i] * Math.sin(f * Math.PI / 2) + x[n + i] * Math.cos(f * Math.PI / 2);
    }
  }

  var LOOP = 8;

  function makeBed(story, mood) {
    var key = story + "/" + mood;
    if (bufferCache[key]) return bufferCache[key];
    if (!context) return null;
    var buf = null;
    if (mood === "sewer") {
      // Sewer: a low electrical hum (whole cycles of the 8 s loop), a thin trickle, and the odd drip with its echo.
      buf = mono(LOOP, function (d, rate) {
        var i, t, rnd = rand(7);
        loopNoise(d, rnd, 0.35, 0.04, 0.5);
        for (i = 0; i < d.length; i++) {
          t = i / rate;
          d[i] *= 0.55 + 0.25 * Math.sin(TAU * t / LOOP * 3);
          d[i] += 0.07 * Math.sin(TAU * 50 * t) + 0.04 * Math.sin(TAU * 100 * t) + 0.015 * Math.sin(TAU * 150 * t);
        }
        [[1.3, 1500], [3.9, 1250], [5.2, 1700], [6.7, 1400]].forEach(function (dr) {
          for (var e = 0; e < 2; e++) {
            var start = Math.floor((dr[0] + e * 0.21) * rate), amp = e ? 0.22 : 0.55;
            for (var k = 0; k < rate * 0.3 && start + k < d.length; k++) {
              var tt = k / rate;
              d[start + k] += amp * 0.18 * Math.exp(-tt * 45) * Math.sin(TAU * (dr[1] * (1 + 0.6 * Math.exp(-tt * 30))) * tt);
            }
          }
        });
        normalise(d, 0.6);
      });
    } else if (mood === "dust") {
      // Desert: wind in gusts that return to where they began, a deep rumble, and a creak of old wood twice a loop.
      buf = mono(LOOP, function (d, rate) {
        var i, t, rnd = rand(11);
        loopNoise(d, rnd, 0.2, 0.012, 1.2);
        for (i = 0; i < d.length; i++) {
          t = i / rate;
          var gust = 0.55 + 0.3 * Math.sin(TAU * t / LOOP) + 0.15 * Math.sin(TAU * 3 * t / LOOP + 1);
          d[i] = d[i] * gust + 0.03 * Math.sin(TAU * 42 * t) * gust;
        }
        [[2.6, 150], [6.0, 118]].forEach(function (cr) {
          var start = Math.floor(cr[0] * rate), len = Math.floor(rate * 0.8);
          for (var k = 0; k < len && start + k < d.length; k++) {
            var tt = k / rate, env = Math.sin(Math.PI * k / len);
            var f = cr[1] * (1 + 0.08 * Math.sin(TAU * 6 * tt)) * (1 - 0.15 * tt);
            var ph = TAU * f * tt;
            d[start + k] += 0.12 * env * env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph + 1));
          }
        });
        normalise(d, 0.6);
      });
    }
    if (buf) bufferCache[key] = buf;
    return buf;
  }

  /** One-shot UI sounds and stings: name -> { priority, variants: [builder...], rates }. A louder kind may cut a quieter one. */
  function tone(d, rate, at, secs, f0, f1, amp, decay, harm) {
    var s = Math.floor(at * rate), n = Math.floor(secs * rate), ph = 0;
    for (var k = 0; k < n && s + k < d.length; k++) {
      var t = k / rate, f = f0 + (f1 - f0) * Math.min(1, t / secs);
      ph += TAU * f / rate;
      var v = Math.sin(ph) + (harm ? harm * Math.sin(2 * ph) : 0);
      d[s + k] += amp * Math.exp(-t * decay) * Math.min(1, k / 40) * v;
    }
  }

  function noiseBurst(d, rate, at, secs, amp, decay, seed, lp) {
    var rnd = rand(seed), s = Math.floor(at * rate), n = Math.floor(secs * rate), y = 0;
    for (var k = 0; k < n && s + k < d.length; k++) {
      y += lp * ((rnd() * 2 - 1) - y);
      d[s + k] += amp * Math.exp(-(k / rate) * decay) * y;
    }
  }

  var UI = {
    appear: { priority: 1, variants: [880, 932, 988].map(function (f, i) { return function () {
      // the choices come up: a soft two-note lift
      return mono(0.32, function (d, r) { tone(d, r, 0, 0.3, f, f * 1.01, 0.22, 11, 0.2); tone(d, r, 0.07, 0.25, f * 1.5, f * 1.5, 0.14, 13, 0); noiseBurst(d, r, 0, 0.03, 0.05, 90, 3 + i, 0.5); });
    }; }) },
    tap: { priority: 3, variants: [1, 2, 3].map(function (n) { return function () {
      // lock-in: a tape-deck clunk, a dull thump under a short click
      return mono(0.3, function (d, r) {
        tone(d, r, 0, 0.18, 220 - n * 12, 70, 0.55, 22, 0.3);
        noiseBurst(d, r, 0, 0.012, 0.5, 400, 20 + n, 0.7);
        noiseBurst(d, r, 0.03, 0.08, 0.18, 55, 40 + n, 0.12);
        normalise(d, 0.7);
      });
    }; }) },
    tick: { priority: 2, variants: [1, 2, 3].map(function (n) { return function () {
      // the last three seconds: a dry wooden tick
      return mono(0.12, function (d, r) { tone(d, r, 0, 0.06, 1500 + n * 90, 900, 0.3, 70, 0); noiseBurst(d, r, 0, 0.008, 0.25, 500, 60 + n, 0.6); });
    }; }) },
    "sting-final-spark": { priority: 4, variants: [function () {
      // a low minor drop and a long breath: the sewer takes the light
      return mono(3.2, function (d, r) {
        tone(d, r, 0, 3.2, 98, 92, 0.34, 1.1, 0.25); tone(d, r, 0.02, 3.0, 116.5, 110, 0.22, 1.3, 0.2); tone(d, r, 0.5, 2.5, 174.6, 164, 0.1, 1.6, 0);
        noiseBurst(d, r, 0, 0.4, 0.12, 6, 77, 0.05);
        tone(d, r, 1.9, 0.3, 1400, 1100, 0.12, 12, 0); // one last drip
        normalise(d, 0.7);
      });
    }] },
    "sting-water-road": { priority: 4, variants: [function () {
      // a hollow open fifth over a swell of wind and one creak of wood
      return mono(3.4, function (d, r) {
        tone(d, r, 0, 3.4, 146.8, 146.8, 0.3, 0.9, 0.35); tone(d, r, 0.05, 3.2, 220, 220, 0.2, 1.0, 0.2);
        var rnd = rand(5), y1 = 0, y2 = 0, n = d.length;
        for (var i = 0; i < n; i++) { var w = rnd() * 2 - 1; y1 += 0.18 * (w - y1); y2 += 0.01 * (w - y2); d[i] += (y1 - y2) * 0.9 * Math.sin(Math.PI * Math.min(1, i / n)) * 0.5; }
        tone(d, r, 1.2, 0.7, 130, 108, 0.1, 3, 0.5);
        normalise(d, 0.7);
      });
    }] },
    "sting-night-shift": { priority: 4, variants: [function () {
      // a cold fluorescent hum that cuts out
      return mono(2.6, function (d, r) {
        tone(d, r, 0, 2.2, 120, 120, 0.3, 1.2, 0.5); tone(d, r, 0, 2.2, 240, 240, 0.12, 1.0, 0); noiseBurst(d, r, 2.2, 0.05, 0.3, 80, 9, 0.5);
        normalise(d, 0.65);
      });
    }] }
  };
  UI.choose = UI.tap;

  /** The torch's soft click and low hum (js/spot.js). */
  UI["torch-click"] = { priority: 1, variants: [function () {
    return mono(0.09, function (d, r) { tone(d, r, 0, 0.09, 1900, 1900, 0.25, 70, 0); tone(d, r, 0, 0.09, 640, 640, 0.12, 70, 0); noiseBurst(d, r, 0, 0.09, 0.1, 70, 2, 0.8); });
  }] };
  UI["torch-hum"] = { priority: 1, variants: [function () {
    return mono(3.2, function (d, r) {
      for (var i = 0; i < d.length; i++) {
        var t = i / r, fade = Math.min(1, t / 0.4) * Math.min(1, (3.2 - t) / 0.8);
        d[i] = fade * 0.07 * (Math.sin(TAU * 100 * t) + 0.5 * Math.sin(TAU * 200 * t) + 0.12 * Math.sin(TAU * 300 * t));
      }
    });
  }] };

  var RATES = [0.93, 1, 1.07]; // pitch variants, +-7%

  function stopUiNow(fadeSecs) {
    if (!uiNow) return;
    var cur = uiNow;
    uiNow = null;
    try {
      cur.gain.gain.cancelScheduledValues(context.currentTime);
      cur.gain.gain.setValueAtTime(cur.gain.gain.value, context.currentTime);
      cur.gain.gain.linearRampToValueAtTime(0, context.currentTime + fadeSecs);
      cur.src.stop(context.currentTime + fadeSecs + 0.01);
    } catch (e) { /* already ended */ }
  }

  /* Recordings (assets/audio/, made through Hawkes Gen) replace the synthesized sounds once decoded; until then,
     or when a file is missing, the synthesized one plays. Nothing is fetched before the first tap (unlock). */
  var FILES = {
    appear: ["ui/appear.mp3"],
    tap: ["ui/tap-1.mp3", "ui/tap-2.mp3", "ui/tap-3.mp3"],
    "sting-final-spark": ["ui/sting-final-spark.mp3"],
    "sting-water-road": ["ui/sting-water-road.mp3"],
    "sting-night-shift": ["ui/sting-night-shift.mp3"]
  };
  var BED_FILES = { "final-spark/sewer": "final-spark/sewer.mp3", "water-road/dust": "water-road/dust.mp3" };
  var fileState = {};

  function loadFile(rel, then) {
    var st = fileState[rel];
    if (st) { if (st.buf) { if (then) then(st.buf); } else if (then && !st.failed) st.wait.push(then); return st.buf || null; }
    if (!context || !window.fetch) return null;
    st = fileState[rel] = { buf: null, failed: false, wait: then ? [then] : [] };
    fetch("/assets/audio/" + rel).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.arrayBuffer();
    }).then(function (ab) {
      return new Promise(function (ok, no) { context.decodeAudioData(ab, ok, no); });
    }).then(function (b) {
      st.buf = b;
      st.wait.forEach(function (f) { f(b); });
      st.wait = [];
    }).catch(function () { st.failed = true; st.wait = []; });
    return null;
  }

  function preloadFiles() {
    Object.keys(FILES).forEach(function (k) { FILES[k].forEach(function (rel) { loadFile(rel); }); });
  }

  function playUi(name) {
    if (!unlocked || !enabled) return;
    ensureGraph();
    if (!context || !buses.ui) return;
    var def = UI[name];
    if (!def) { tell("ui-missing", { name: String(name) }); return; }
    var now = context.currentTime;
    if (uiNow && uiNow.ends > now) {
      if (def.priority < uiNow.priority) return; // a quieter sound never cuts a louder one
      stopUiNow(0.02);                           // never two UI sounds at once
    }
    var files = FILES[name], fbuf = null, fi = -1;
    if (files) {
      var ready = files.filter(function (rel) { return fileState[rel] && fileState[rel].buf; });
      if (ready.length) { fi = Math.floor(Math.random() * ready.length); fbuf = fileState[ready[fi]].buf; fi = files.indexOf(ready[fi]); }
    }
    var vi = Math.floor(Math.random() * def.variants.length);
    var ri = def.variants.length > 1 || name === "tap" || name === "tick" || name === "appear" ? Math.floor(Math.random() * RATES.length) : 1;
    if (def.variants.length > 1 || RATES.length > 1) {
      var tries = 0;
      while (lastVariant[name] === vi + ":" + ri && tries++ < 6 && (def.variants.length > 1 || name === "tap" || name === "tick" || name === "appear")) {
        vi = Math.floor(Math.random() * def.variants.length);
        ri = Math.floor(Math.random() * RATES.length);
      }
    }
    lastVariant[name] = vi + ":" + ri;
    var ck = "ui/" + name + "/" + vi;
    var buf = fbuf || bufferCache[ck] || (bufferCache[ck] = def.variants[vi]());
    if (!buf) return;
    if (fbuf) vi = fi;
    var rate = (name.indexOf("sting") === 0 || name.indexOf("torch") === 0) ? 1 : RATES[ri];
    try {
      var src = context.createBufferSource(), g = context.createGain();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(g);
      g.connect(buses.ui);
      src.start(0);
      uiNow = { src: src, gain: g, priority: def.priority, ends: now + buf.duration / rate };
      src.onended = function () { if (uiNow && uiNow.src === src) uiNow = null; try { g.disconnect(); } catch (e) { /* gone */ } };
      if (name.indexOf("sting") === 0) tell("sting", { name: name, story: name.slice(6) });
      else if (name.indexOf("torch") !== 0) tell("ui", { name: name === "choose" ? "tap" : name, variant: vi, rate: rate });
    } catch (e) { /* no sound */ }
  }

  /* ---- Beds: one at a time, started only after the first clip plays, cross-faded, ducked, stopped on the list ---- */

  function liveBeds() {
    return beds.filter(function (b) { return !b.fading; });
  }

  function dropBed(b, secs) {
    if (!b || b.fading) return;
    b.fading = true;
    try {
      var t = context.currentTime;
      b.gain.gain.cancelScheduledValues(t);
      b.gain.gain.setValueAtTime(b.gain.gain.value, t);
      b.gain.gain.linearRampToValueAtTime(0, t + secs);
      b.src.stop(t + secs + 0.02);
    } catch (e) { /* already stopped */ }
    setTimeout(function () {
      try { b.src.disconnect(); b.gain.disconnect(); } catch (e2) { /* gone */ }
      beds = beds.filter(function (x) { return x !== b; });
    }, Math.round(secs * 1000) + 60);
  }

  function stopBedSource(secs) {
    beds.slice().forEach(function (b) { dropBed(b, secs == null ? 0.05 : secs); });
    bed.source = null;
    bed.gain = null;
    bed.key = null;
  }

  function startBed(story, mood, force, via) {
    bed.story = story || null;
    bed.mood = mood || null;
    var key = story && mood ? story + "/" + mood : null;
    bed.url = key;
    if (!key) {
      // the story list (or a story with its own beds): fade out and forget
      var had = !!bed.source;
      stopBedSource(0.5);
      bedsGo = false;
      if (had) tell("bed", { on: false, story: null, via: via || "stop" });
      return;
    }
    if (!unlocked || !enabled || !bedsGo) return;
    if (!force && bed.key === key && bed.source) return; // the same bed carries on across scenes: no restart
    ensureGraph();
    var rel = BED_FILES[key], fb = rel && fileState[rel] && fileState[rel].buf;
    if (rel && !fb && !(fileState[rel] && fileState[rel].failed)) {
      // the recording is on its way: start it when decoded (if this is still the wanted bed), no synth flash first
      loadFile(rel, function () { if (bed.key !== key && bed.url === key && bedsGo && enabled && !liveBeds().some(function (b) { return b.key === key; })) startBed(story, mood, false, via); });
      return;
    }
    var buf = fb || makeBed(story, mood);
    if (!buf) return;
    var old = liveBeds();
    old.forEach(function (b) { dropBed(b, 0.6); });
    try {
      var src = context.createBufferSource(), g = context.createGain();
      src.buffer = buf;
      src.loop = true;
      g.gain.value = 0.0001;
      src.connect(g);
      g.connect(buses.ambience);
      src.start(0);
      g.gain.setValueAtTime(0.0001, context.currentTime);
      g.gain.linearRampToValueAtTime(1, context.currentTime + 1.2);
      var entry = { src: src, gain: g, key: key, fading: false };
      beds.push(entry);
      bed.source = src;
      bed.gain = g;
      bed.key = key;
      bed.buffer = buf;
      tell("bed", { on: true, story: story, mood: mood, via: via || "scene", beds: liveBeds().length });
    } catch (e) { /* no sound */ }
  }

  function setBed(story, mood) {
    startBed(story, mood, false, "scene");
  }

  /** The beds may start (once): the first clip is playing, or this is an image page, or the viewer tapped a choice. */
  function beginBeds(via) {
    if (bedsGo) return;
    bedsGo = true;
    if (unlocked && context) preloadFiles(); // recordings load only after the first clip has started
    if (bed.story && bed.mood && unlocked && enabled) startBed(bed.story, bed.mood, false, via || "clip");
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
    if (!bedsGo) {
      // the beds load only after the first clip is playing, so they never delay it
      video.addEventListener("playing", function () { beginBeds("clip"); }, { once: true });
      if (!video.paused && video.readyState >= 3) beginBeds("clip");
    }
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
    if (!enabled) stopBedSource(0.05);
    else if (unlocked && bed.story && bed.mood) startBed(bed.story, bed.mood, true, "toggle");
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
    beginBeds: beginBeds,
    sounds: function () { return Object.keys(UI); },
    beds: function () { return liveBeds().map(function (b) { return b.key; }); },
    watch: watch,
    unwatch: unwatch,
    ducked: function () { return ducked; },
    bed: function () { return { story: bed.story, mood: bed.mood, url: bed.url, playing: liveBeds().length > 0 }; },
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
