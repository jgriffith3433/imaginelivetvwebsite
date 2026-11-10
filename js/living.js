/* The landing page's living layer (world bible, "The home"): the house lights come up card by card, a wall of three
   screens flickers on its own, a card under the pointer ticks and glows, blog cards wake as they scroll in.
   Sounds are synthesized (no assets); they start only after the viewer's first press. Read-only view: window.iltvLiving. */
(function () {
  var stories = document.getElementById("stories");
  if (!stories) return;
  var t0 = performance.now();
  var log = [];
  var ctx = null;
  function note(kind, what) { log.push({ at: performance.now() - t0, kind: kind, what: what || "" }); }
  function muted() { try { return JSON.parse(localStorage.getItem("hawkes.sound") || "{}").on === false; } catch (e) { return false; } }
  function audio() {
    if (ctx) return ctx;
    var C = window.AudioContext || window.webkitAudioContext;
    if (C) { try { ctx = new C(); } catch (e) { ctx = null; } }
    return ctx;
  }
  function tone(freq, dur, gain, type) {
    var c = ctx;
    if (!c || c.state !== "running" || muted()) return false;
    var o = c.createOscillator(), g = c.createGain(), n = c.currentTime;
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(gain, n + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    o.connect(g); g.connect(c.destination); o.start(n); o.stop(n + dur + 0.05);
    return true;
  }
  var unlock = function () {
    var c = audio();
    if (c && c.state === "suspended") c.resume();
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
  };
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);

  // Beat 1: the house lights come up, a card at a time.
  var cards = [].slice.call(stories.querySelectorAll(".hero, .story-card"));
  cards.forEach(function (card, i) {
    card.classList.add("dim");
    setTimeout(function () {
      card.classList.remove("dim"); card.classList.add("lit");
      note("light", card.getAttribute("data-story"));
      tone(220 * Math.pow(1.25, i), 0.5, 0.04, "triangle");
    }, 900 + i * 450);
  });

  // The wall of three screens, each flickering at its own pace.
  var wall = document.createElement("div");
  wall.className = "tile-wall"; wall.setAttribute("aria-hidden", "true");
  for (var k = 0; k < 3; k++) { var s = document.createElement("span"); s.className = "tile-screen"; wall.appendChild(s); }
  var sub = stories.querySelector(".stories-sub");
  if (sub) sub.insertAdjacentElement("afterend", wall);
  var screens = [].slice.call(wall.children);
  function flicker() {
    var s = screens[Math.floor(Math.random() * screens.length)];
    s.classList.remove("flick"); void s.offsetWidth; s.classList.add("flick");
    note("flicker", String(screens.indexOf(s)));
    tone(90 + 40 * screens.indexOf(s), 0.12, 0.02, "square");
    setTimeout(flicker, 2500 + Math.random() * 2500);
  }
  setTimeout(flicker, 1200);

  // A card under the pointer or finger ticks and glows; a press is its own small click.
  stories.addEventListener("pointerover", function (e) {
    var card = e.target.closest && e.target.closest(".hero, .story-card");
    if (!card || card.contains(e.relatedTarget)) return;
    card.classList.add("hot"); note("hover", card.getAttribute("data-story"));
    tone(520, 0.08, 0.03, "sine");
  });
  stories.addEventListener("pointerout", function (e) {
    var card = e.target.closest && e.target.closest(".hero, .story-card");
    if (card && !card.contains(e.relatedTarget)) card.classList.remove("hot");
  });
  stories.addEventListener("pointerdown", function (e) {
    var card = e.target.closest && e.target.closest(".hero, .story-card");
    if (card) { note("press", card.getAttribute("data-story")); tone(330, 0.1, 0.04, "triangle"); }
  });

  // Blog cards wake once as they scroll in.
  var posts = [].slice.call(document.querySelectorAll(".post-card"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("awake"); io.unobserve(en.target); note("reveal", "post"); tone(660, 0.07, 0.02, "sine");
      });
    }, { threshold: 0.4 });
    posts.forEach(function (p) { p.classList.add("sleepy"); io.observe(p); });
  }

  window.iltvLiving = {
    log: function () { return log.slice(); },
    cards: function () { return cards.length; },
    lit: function () { return stories.querySelectorAll(".lit").length; },
    screens: function () { return screens.length; },
    audioRunning: function () { return !!ctx && ctx.state === "running"; }
  };
})();
