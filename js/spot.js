(function () {
  var holding = false;
  var following = false;
  var pointerId = null;
  var moved = false;
  var swallowClick = false;
  var lastX = 0;
  var lastY = 0;
  var BEAM_LIFT = 168;
  var LENS_GAP = 62;

  var bar = document.createElement("div");
  bar.className = "inventory";
  bar.innerHTML =
    '<p class="inventory-label">Inventory</p>' +
    '<button type="button" class="torch-slot" id="torch-slot" aria-label="Flashlight. Click to carry it over the words."></button>';
  document.body.appendChild(bar);

  var torch = document.createElement("div");
  torch.className = "torch is-docked";
  torch.id = "torch";
  torch.setAttribute("aria-hidden", "true");
  torch.innerHTML = '<span class="torch-lens"></span><span class="torch-grip"></span>';
  document.body.appendChild(torch);

  var beam = document.createElement("div");
  beam.className = "torch-beam";
  beam.id = "torch-beam";
  document.body.appendChild(beam);

  var slot = bar.querySelector("#torch-slot");

  // The match count (story doc "A story's inventory", `keepFlashlight`): one number beside the flashlight, set by the
  // player (js/game.js) for a story whose inventory keeps the flashlight, or read from <html data-matches> on a branch page.
  var matchBox = document.createElement("p");
  matchBox.className = "match-count";
  matchBox.id = "match-count";
  matchBox.hidden = true;
  matchBox.innerHTML =
    '<span class="match-icon" aria-hidden="true"><svg viewBox="0 0 12 28"><rect x="5" y="7" width="2" height="20" rx="1" fill="#c9a36b"/><ellipse cx="6" cy="6" rx="3.2" ry="4.6" fill="#c8402a"/></svg></span>' +
    '<span class="match-n" id="match-n"></span>';
  bar.appendChild(matchBox);

  /** Shows the number of matches left (null hides the counter). */
  function setMatches(n) {
    var low = typeof n === "number" && n <= 2;
    matchBox.hidden = typeof n !== "number";
    if (typeof n !== "number") { delete matchBox.dataset.count; return; }
    matchBox.dataset.count = String(n);
    matchBox.classList.toggle("is-low", low);
    matchBox.setAttribute("role", "img");
    matchBox.setAttribute("aria-label", "Matches left: " + n);
    matchBox.title = "Matches left: " + n;
    matchBox.querySelector(".match-n").textContent = String(n);
  }
  window.iltvMatches = { set: setMatches };
  var fromPage = parseInt(document.documentElement.getAttribute("data-matches"), 10);
  if (!isNaN(fromPage)) setMatches(fromPage);

  function beamRadius() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue("--beam");
    var size = parseFloat(raw) * parseFloat(getComputedStyle(document.documentElement).fontSize);
    return size || 90;
  }

  function clearSpots() {
    document.querySelectorAll(".spot").forEach(function (spot) {
      spot.classList.remove("is-lit");
      spot.style.setProperty("--spot-x", "-20rem");
      spot.style.setProperty("--spot-y", "-20rem");
    });
  }

  function paintSpots(x, y) {
    var radius = beamRadius();
    document.querySelectorAll(".spot").forEach(function (spot) {
      var rect = spot.getBoundingClientRect();
      var near = x >= rect.left - radius && x <= rect.right + radius &&
        y >= rect.top - radius && y <= rect.bottom + radius;
      if (!near) {
        spot.classList.remove("is-lit");
        spot.style.setProperty("--spot-x", "-20rem");
        spot.style.setProperty("--spot-y", "-20rem");
        return;
      }
      spot.classList.add("is-lit");
      spot.style.setProperty("--spot-x", (x - rect.left) + "px");
      spot.style.setProperty("--spot-y", (y - rect.top) + "px");
    });
  }

  function placeTorch(beamX, beamY, lensY) {
    torch.style.left = beamX + "px";
    torch.style.top = (lensY - 13) + "px";
    beam.style.left = beamX + "px";
    beam.style.top = beamY + "px";
  }

  function dock() {
    var rect = slot.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    holding = false;
    following = false;
    pointerId = null;
    torch.classList.add("is-docked");
    torch.classList.remove("is-held");
    beam.classList.remove("is-on");
    document.body.classList.remove("is-holding");
    placeTorch(x, y, y + 13);
    clearSpots();
  }

  function hold(x, y) {
    lastX = x;
    lastY = y;
    var beamY = Math.max(52, y - BEAM_LIFT);
    var beamX = Math.min(window.innerWidth - 18, Math.max(18, x));
    torch.classList.remove("is-docked");
    torch.classList.add("is-held");
    beam.classList.add("is-on");
    document.body.classList.add("is-holding");
    placeTorch(beamX, beamY, beamY + LENS_GAP);
    paintSpots(beamX, beamY);
  }

  slot.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    if (event.pointerType === "mouse") {
      following = true;
      moved = false;
      hold(event.clientX, event.clientY);
      return;
    }
    holding = true;
    moved = false;
    pointerId = event.pointerId;
    try { slot.setPointerCapture(event.pointerId); } catch (err) { /* synthetic pointers */ }
    hold(event.clientX, event.clientY);
  });

  window.addEventListener("pointermove", function (event) {
    if (following && event.pointerType === "mouse") {
      hold(event.clientX, event.clientY);
      return;
    }
    if (!holding || event.pointerId !== pointerId) return;
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 0) moved = true;
    hold(event.clientX, event.clientY);
  });

  window.addEventListener("pointerdown", function (event) {
    if (!following || event.pointerType !== "mouse" || event.button !== 0) return;
    swallowClick = true;
    event.preventDefault();
    event.stopPropagation();
    dock();
  }, true);

  window.addEventListener("click", function (event) {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  function drop(event) {
    if (following) return;
    if (!holding || (event && event.pointerId !== pointerId)) return;
    if (slot.hasPointerCapture && event && slot.hasPointerCapture(event.pointerId)) {
      slot.releasePointerCapture(event.pointerId);
    }
    dock();
  }

  slot.addEventListener("pointerup", drop);
  slot.addEventListener("pointercancel", drop);

  slot.addEventListener("click", function (event) {
    if (!moved) return;
    event.preventDefault();
    event.stopPropagation();
  });

  window.addEventListener("touchmove", function (event) {
    if (holding) event.preventDefault();
  }, { passive: false });

  window.addEventListener("resize", function () {
    if (following || holding) hold(lastX, lastY);
    else dock();
  });

  window.addEventListener("scroll", function () {
    if (following || holding) hold(lastX, lastY);
    else dock();
  }, true);


  // ---- The first visit's sweep and the tap-to-light (J, 2026-11-11) -------------------------------------------
  // Per viewer, kept in localStorage["iltv.torch"]: absent = never shown, "swept" = it swept once and the viewer has
  // not moved the light yet (it keeps pulsing), "moved" = the viewer has used it. No words are ever added.
  var TORCH_KEY = "iltv.torch";
  var torchState = null;
  function readTorch() {
    if (torchState !== null) return torchState;
    try { torchState = localStorage.getItem(TORCH_KEY) || ""; } catch (e) { torchState = ""; }
    return torchState;
  }
  function writeTorch(value) {
    torchState = value;
    try { localStorage.setItem(TORCH_KEY, value); } catch (e) { /* not saved: this page only */ }
  }
  function beckon(on) {
    document.body.classList.toggle("torch-beckon", !!on);
  }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  var sweeping = false;
  var sweepToken = 0;

  function ui(name) {
    try { if (window.iltvAudio && window.iltvAudio.playUi) window.iltvAudio.playUi(name); } catch (e) { /* no sound */ }
  }

  function usable() {
    return getComputedStyle(torch).display !== "none" && slot.getBoundingClientRect().width > 0;
  }

  function sweepPath() {
    var pts = [];
    var h = window.innerHeight;
    var w = window.innerWidth;
    function add(id) {
      var el = document.getElementById(id);
      if (!el || el.hidden) return;
      var r = el.getBoundingClientRect();
      if (r.height < 4 || r.bottom < 60 || r.top > h - 80) return;
      var top = Math.max(r.top, 70);
      var bottom = Math.min(r.bottom, h - 90);
      var left = Math.max(r.left, 14);
      var right = Math.min(r.right, w - 14);
      if (bottom <= top || right <= left) return;
      var mid = (top + bottom) / 2;
      pts.push([left + 10, mid], [right - 10, mid]);
    }
    add("spark-story");
    add("spark-question");
    document.querySelectorAll("#spark-choices .choice").forEach(function (c, i) {
      var r = c.getBoundingClientRect();
      if (r.height < 4 || r.bottom > h - 70 || r.top < 60) return;
      var y = r.top + r.height / 2;
      pts.push(i % 2 === 0 ? [r.left + 12, y] : [r.right - 12, y]);
    });
    return pts;
  }

  /** The torch lifts out of the slot, sweeps once across the story line and the choices, and settles back. */
  function sweep(done) {
    if (sweeping || holding || following || !usable()) { if (done) done(false); return false; }
    var path = sweepPath();
    if (path.length < 2) { if (done) done(false); return false; }
    sweeping = true;
    var token = ++sweepToken;
    var from = slot.getBoundingClientRect();
    var start = [from.left + from.width / 2, from.top + BEAM_LIFT * 0.4];
    path.unshift(start);
    // Lengths, so the speed along the path is steady (about 3.4 s for the whole sweep).
    var lens = [0];
    for (var i = 1; i < path.length; i++) {
      lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    }
    var total = lens[lens.length - 1] || 1;
    var ms = reduced() ? 2200 : 3400;
    var t0 = performance.now();
    ui("torch-click");
    ui("torch-hum");
    document.body.classList.add("torch-sweeping");
    function finish(completed) {
      sweeping = false;
      document.body.classList.remove("torch-sweeping");
      if (!holding && !following) dock();
      if (completed) {
        ui("torch-click");
        writeTorch("swept");
        beckon(true);
      }
      if (done) done(completed);
    }
    function frame(now) {
      if (token !== sweepToken || !sweeping) return;
      if (holding || following) { sweeping = false; document.body.classList.remove("torch-sweeping"); return; }
      var k = Math.min(1, (now - t0) / ms);
      var eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var d = eased * total;
      var j = 1;
      while (j < lens.length - 1 && lens[j] < d) j++;
      var seg = (lens[j] - lens[j - 1]) || 1;
      var f = Math.min(1, Math.max(0, (d - lens[j - 1]) / seg));
      var x = path[j - 1][0] + (path[j][0] - path[j - 1][0]) * f;
      var y = path[j - 1][1] + (path[j][1] - path[j - 1][1]) * f;
      hold(x, y + BEAM_LIFT);
      if (k < 1) requestAnimationFrame(frame);
      else finish(true);
    }
    requestAnimationFrame(frame);
    return true;
  }

  function stopSweep() {
    if (!sweeping) return;
    sweepToken++;
    sweeping = false;
    document.body.classList.remove("torch-sweeping");
  }

  /** The viewer takes the torch: the sweep and the pulse are over for good. */
  function taken() {
    stopSweep();
    if (readTorch() !== "moved") writeTorch("moved");
    beckon(false);
  }
  slot.addEventListener("pointerdown", taken, true);
  slot.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") taken(); }, true);

  // Tap any word: its English shows for about 2 s, no drag needed (a phone has no hover and the torch is a drag).
  var TAP_MS = 2000;
  var tapTimers = new WeakMap();
  function lightSpot(spot) {
    if (!spot || spot.closest(".tree-node")) return;
    spot.classList.add("is-tapped");
    clearTimeout(tapTimers.get(spot));
    tapTimers.set(spot, setTimeout(function () { spot.classList.remove("is-tapped"); }, TAP_MS));
  }
  document.addEventListener("pointerdown", function (event) {
    if (holding || following || event.pointerType === "mouse" && event.target.closest && event.target.closest("#torch-slot")) return;
    if (event.pointerType === "mouse") return; // a mouse has the torch; touch and pen tap
    var target = event.target;
    if (!target || !target.closest) return;
    var spot = target.closest(".spot");
    if (!spot || !document.getElementById("spark") || !document.getElementById("spark").contains(spot)) return;
    lightSpot(spot);
  }, true);

  window.iltvTorch = {
    sweep: sweep,
    stop: stopSweep,
    state: function () { return readTorch(); },
    swept: function () { return readTorch() !== ""; },
    reset: function () { stopSweep(); torchState = ""; try { localStorage.removeItem(TORCH_KEY); } catch (e) { /* none */ } beckon(false); },
    sweeping: function () { return sweeping; },
    tapMs: TAP_MS
  };
  if (readTorch() === "swept") beckon(true);

  dock();
  requestAnimationFrame(function () {
    torch.classList.add("can-slide");
  });

  // The home page hides the inventory on its landing page (<html data-view>, css/site.css); when a story opens
  // it comes back, docked in its slot straight away rather than sliding in from the corner.
  if (window.MutationObserver) {
    new MutationObserver(function () {
      torch.classList.remove("can-slide");
      dock();
      requestAnimationFrame(function () {
        torch.classList.add("can-slide");
      });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-view"] });
  }
})();
