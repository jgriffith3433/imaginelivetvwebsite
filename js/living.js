/* The landing page's living layer (world bible, "The home"): the featured hero plays its muted trailer within 2 s,
   each catalogue card plays a 3 s loop on hover (desktop) or when centred (phone), Sound unmutes the hero, and
   prefers-reduced-motion keeps posters only. Read-only view: window.iltvLiving. */
(function () {
  var stories = document.getElementById("stories");
  if (!stories) return;
  var t0 = performance.now();
  var log = [];
  var reduced = false;
  try {
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches ||
      /[?&]living=still(?:&|$)/.test(location.search);
  } catch (e) { /* none */ }
  var phone = false;
  try { phone = matchMedia("(max-width: 600px), (max-height: 500px) and (pointer: coarse)").matches; } catch (e) { /* none */ }
  function note(kind, what) { log.push({ at: performance.now() - t0, kind: kind, what: what || "" }); }
  function pickSrc(el) {
    if (!el) return "";
    return phone && el.dataset.small ? el.dataset.small : (el.dataset.src || "");
  }
  function arm(el) {
    if (!el || el.src) return;
    var src = pickSrc(el);
    if (src) el.src = src;
  }
  function play(el) {
    if (!el || reduced) return false;
    arm(el);
    el.muted = true;
    var p = el.play();
    if (p && p.catch) p.catch(function () {});
    return true;
  }
  function stop(el) {
    if (!el) return;
    try { el.pause(); el.currentTime = 0; } catch (e) { /* none */ }
  }

  var hero = stories.querySelector("a.hero");
  var heroVideo = hero && hero.querySelector("video.hero-trailer");
  var soundBtn = hero && hero.querySelector("button.hero-sound");
  var cards = [].slice.call(stories.querySelectorAll(".story-card"));
  var motionAt = null;

  // Reduced motion: posters only, never start a preview.
  if (reduced) {
    document.documentElement.setAttribute("data-living", "still");
    if (heroVideo) { heroVideo.removeAttribute("src"); heroVideo.removeAttribute("data-src"); heroVideo.hidden = true; }
    cards.forEach(function (card) {
      var v = card.querySelector("video.card-loop");
      if (v) { v.removeAttribute("src"); v.removeAttribute("data-src"); v.hidden = true; }
    });
    if (soundBtn) soundBtn.hidden = true;
    note("reduced", "posters only");
  } else if (heroVideo) {
    // Hero trailer: muted, looped, within 2 s of load. Start under the splash so motion is ready when it lifts.
    function startHero() {
      if (!heroVideo || heroVideo.dataset.started) return;
      heroVideo.dataset.started = "1";
      arm(heroVideo);
      heroVideo.muted = true;
      var p = heroVideo.play();
      if (p && p.then) {
        p.then(function () {
          motionAt = performance.now() - t0;
          note("hero-play", hero.getAttribute("data-story"));
          hero.classList.add("is-playing");
        }).catch(function () { note("hero-blocked", hero.getAttribute("data-story")); });
      }
    }
    // Prefetch immediately; play on the next frame so the first paint isn't blocked.
    arm(heroVideo);
    requestAnimationFrame(function () { setTimeout(startHero, 50); });
    // Failsafe: force a start attempt by 1.5 s so the criterion "moving within 2 s" can hold.
    setTimeout(startHero, 1500);

    if (soundBtn) {
      soundBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!heroVideo) return;
        arm(heroVideo);
        var on = heroVideo.muted;
        heroVideo.muted = !on;
        soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
        soundBtn.textContent = on ? "Mute" : "Sound";
        soundBtn.setAttribute("aria-label", on ? "Mute trailer" : "Unmute trailer");
        if (on) {
          var p = heroVideo.play();
          if (p && p.catch) p.catch(function () {});
        }
        note("hero-sound", on ? "on" : "off");
      });
    }
  }

  // Card loops: hover on fine pointer (desktop); centred on screen on phone / coarse pointer.
  function cardVideo(card) { return card.querySelector("video.card-loop"); }
  var activeCard = null;
  function playCard(card) {
    if (reduced || !card) return;
    if (activeCard && activeCard !== card) stop(cardVideo(activeCard));
    activeCard = card;
    var v = cardVideo(card);
    if (v && play(v)) {
      card.classList.add("is-previewing");
      note("card-play", card.getAttribute("data-story"));
    }
  }
  function stopCard(card) {
    if (!card) return;
    card.classList.remove("is-previewing");
    stop(cardVideo(card));
    if (activeCard === card) activeCard = null;
  }

  var fine = true;
  try { fine = matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { /* none */ }
  // Desktop with a fine pointer: hover. Phone layout (narrow / coarse) or no-hover: play the centred card.
  // Use the same phone query as the trailer's sm pick so a 390x844 playtest frame gets centre-preview even when
  // the host Chromium still reports (hover: hover) and (pointer: fine).
  if (!reduced && fine && !phone) {
    cards.forEach(function (card) {
      card.addEventListener("pointerenter", function () { playCard(card); });
      card.addEventListener("pointerleave", function () { stopCard(card); });
    });
  } else if (!reduced && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      // Play the card whose centre is nearest the viewport centre and mostly visible.
      var best = null, bestDist = Infinity;
      entries.forEach(function (en) {
        if (!en.isIntersecting || en.intersectionRatio < 0.55) return;
        var r = en.boundingClientRect;
        var mid = r.top + r.height / 2;
        var dist = Math.abs(mid - (window.innerHeight / 2));
        if (dist < bestDist) { bestDist = dist; best = en.target; }
      });
      // Also re-score every observed card against the viewport centre (scrollIntoView may not re-fire entries).
      cards.forEach(function (c) {
        var r = c.getBoundingClientRect();
        if (r.height <= 0) return;
        var mid = r.top + r.height / 2;
        var vis = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        if (vis / r.height < 0.55) return;
        var dist = Math.abs(mid - (window.innerHeight / 2));
        if (dist < bestDist) { bestDist = dist; best = c; }
      });
      if (best) playCard(best);
      cards.forEach(function (c) { if (c !== best && c.classList.contains("is-previewing")) stopCard(c); });
    }, { threshold: [0.55, 0.75, 0.9], rootMargin: "0px" });
    cards.forEach(function (c) { io.observe(c); });
    // After a programmatic centre scroll (playtest / hash), re-evaluate.
    window.addEventListener("scroll", function () {
      if (phone || !fine) {
        var best = null, bestDist = Infinity;
        cards.forEach(function (c) {
          var r = c.getBoundingClientRect();
          if (r.height <= 0) return;
          var mid = r.top + r.height / 2;
          var vis = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
          if (vis / r.height < 0.55) return;
          var dist = Math.abs(mid - (window.innerHeight / 2));
          if (dist < bestDist) { bestDist = dist; best = c; }
        });
        if (best) playCard(best);
      }
    }, { passive: true });
  }

  // Soft light-up on load; a small wall of three screens that flickers on its own (lobby breath).
  var litTargets = [].slice.call(stories.querySelectorAll(".hero, .story-card"));
  litTargets.forEach(function (card, i) {
    card.classList.add("dim");
    setTimeout(function () {
      card.classList.remove("dim"); card.classList.add("lit");
      note("light", card.getAttribute("data-story"));
    }, 400 + i * 280);
  });
  if (!reduced) {
    var wall = document.createElement("div");
    wall.className = "tile-wall"; wall.setAttribute("aria-hidden", "true");
    for (var k = 0; k < 3; k++) { var s = document.createElement("span"); s.className = "tile-screen"; wall.appendChild(s); }
    var sub = stories.querySelector(".stories-sub");
    if (sub) sub.insertAdjacentElement("afterend", wall);
    var screens = [].slice.call(wall.children);
    function flicker() {
      if (!screens.length) return;
      var s = screens[Math.floor(Math.random() * screens.length)];
      s.classList.remove("flick"); void s.offsetWidth; s.classList.add("flick");
      note("flicker", String(screens.indexOf(s)));
      setTimeout(flicker, 2500 + Math.random() * 2500);
    }
    setTimeout(flicker, 1200);
  }

  window.iltvLiving = {
    log: function () { return log.slice(); },
    cards: function () { return litTargets.length; },
    lit: function () { return stories.querySelectorAll(".lit").length; },
    screens: function () { return document.querySelectorAll(".tile-screen").length; },
    heroPlaying: function () { return !!(heroVideo && !heroVideo.paused && !heroVideo.ended && heroVideo.currentTime > 0); },
    heroMuted: function () { return !heroVideo || heroVideo.muted; },
    reduced: function () { return reduced; },
    motionMs: function () { return motionAt; },
    previewing: function () { return activeCard ? activeCard.getAttribute("data-story") : null; }
  };
})();
