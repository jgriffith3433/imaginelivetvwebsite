/* The control room of a console story (story doc: story/README.md, "The control room").

   What a scene says is drawn here: the room itself (the one big screen, the desk and its controls, the fire panel,
   the access terminal, the radio charger, the coffee machine, the log tablet, the wall clock, the door to the lobby)
   and the people in it, as black silhouettes in front of the screen. The story's data says what they do:

   - a scene's `cast` (who is in the room when it opens, default you and Dee), `place` (where it opens: room, room-day,
     lobby, vestibule, dock, stairwell, corridor, roof) and `away` (who is with you when the place isn't the room);
   - a line's `act` (a string or a list of "who:verb[:where]", e.g. "dee:stand", "okafor:enter:left", "you:write",
     "room:ring"), its `place` (the place changes when the line starts) and its `feed` (a camera the characters switch the
     screen to, js/console.js). An entry of `act` may also be a beat, { "act": "okafor:leave", "at": 0.25 }: it happens
     when that fraction (0 to 1) of the line's own `dur` (the recording's length, so it follows a new recording) has
     passed; a plain string happens as the line starts. `leave` walks a person to the door; `gone` takes them out of the
     room (their layer is removed, the door closes) and they stay out until an `enter` or a scene's `cast` brings them back.

   Silhouettes are the night shift in the room. When people are out of the room (the tour, a call-up to a floor, the
   lobby at dawn) they are drawn as people, in the place they are in, and the screen is a small inset; in the room by day
   (`room-day`) they are people too. Everything is SVG and CSS: no images, nothing from the GPU. js/console.js owns the
   screen (its picture and the CRT flash) and the strip of cameras; this file never reads the story's state, only the
   scene it is given. It never throws: the story plays without it. */
(function () {
  "use strict";
  var host = document.getElementById("console-room");
  var artEl = document.getElementById("console-room-art");
  var figsEl = document.getElementById("console-room-figs");
  var actionEl = document.getElementById("console-action");
  if (!host || !artEl || !figsEl) return;

  var NS = "http://www.w3.org/2000/svg";
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var NAMES = { you: "You", dee: "Dee", okafor: "Mr. Okafor", terrell: "Terrell", marisol: "Marisol", dev: "Dev", adler: "Ms. Adler", brandt: "Mr. Brandt", courier: "The courier", sleeper: "The man", pierce: "Pierce Hawkes" };
  var LABELS = { you: "YOU", dee: "DEE", okafor: "OKAFOR", terrell: "TERRELL", marisol: "MARISOL", dev: "DEV", adler: "ADLER", brandt: "BRANDT", courier: "COURIER", sleeper: "MAN", pierce: "PIERCE" };
  var PLACES = { room: "in the control room", "room-day": "in the control room, in daylight", lobby: "in the lobby", vestibule: "in the vestibule", dock: "on the loading dock", stairwell: "in stairwell C", corridor: "in a corridor upstairs", roof: "on the roof" };
  var AWAY = { lobby: 1, vestibule: 1, dock: 1, stairwell: 1, corridor: 1, roof: 1 };
  var VERBS = ["sit", "stand", "point", "touch", "write", "phone", "hangup", "spill", "angry", "knock", "count", "lean", "hand", "drink", "eat", "press", "read", "enter", "leave", "gone", "charger", "rest", "ring", "buzz", "door", "flicker"];
  var HOLD = { touch: 1900, write: 2800, spill: 2600, knock: 1700, count: 2800, charger: 3600, angry: 2000, drink: 2000, eat: 2600, press: 1500, read: 3000, hand: 2000, point: 3000, lean: 2600, console: 700 };

  /* What each person looks like. Silhouettes keep the shape (hair, hat, bag, coat, height); in daylight and out of the room the colours show. */
  var LOOKS = {
    you: { s: 1.0, skin: "#c8a07c", hair: "#2a2320", top: "#3e5b6e", bottom: "#2a2f3a", style: "short", bag: 0, coat: 0 },
    dee: { s: 0.93, skin: "#a9785a", hair: "#8d8f93", top: "#4a4f57", bottom: "#23262c", style: "bun", bag: 0, coat: 0, radio: 1 },
    okafor: { s: 1.1, skin: "#8c5e45", hair: "#1c1a19", top: "#2c2f3a", bottom: "#23252d", style: "neat", bag: 1, coat: 0, tie: 1 },
    terrell: { s: 1.0, w: 1.2, skin: "#b98862", hair: "#202020", top: "#3b4a63", bottom: "#2a2d36", style: "beanie", bag: 1, coat: 0 },
    marisol: { s: 0.92, w: 1.1, skin: "#b27c58", hair: "#3a2a22", top: "#9a4f6e", bottom: "#2f3340", style: "curls", bag: 0, coat: 0 },
    dev: { s: 1.0, skin: "#b9896a", hair: "#241d1a", top: "#d8d4c8", bottom: "#33384a", style: "messy", bag: 2, coat: 0 },
    adler: { s: 1.05, skin: "#d2a98b", hair: "#b8b2a8", top: "#2e3f3a", bottom: "#2e3f3a", style: "lowbun", bag: 0, coat: 1 },
    brandt: { s: 1.0, skin: "#d8b394", hair: "#2a2622", top: "#555c66", bottom: "#2a2d34", style: "hood", bag: 0, coat: 0 },
    courier: { s: 1.0, skin: "#a47856", hair: "#201c1a", top: "#a8402f", bottom: "#2a2d34", style: "cap", bag: 0, coat: 0 },
    sleeper: { s: 0.96, skin: "#a98a70", hair: "#6c6a66", top: "#5a5448", bottom: "#3a3a40", style: "beanie", bag: 0, coat: 1 },
    pierce: { s: 1.08, skin: "#d4aa8a", hair: "#8a8a8c", top: "#1f2228", bottom: "#1f2228", style: "neat", bag: 0, coat: 1 },
  };

  /* Where people stand. The room is 400 x 240; the people are drawn at 0.85 of their size there, at 1.25 out of it. */
  var ROOM_Y = 204, ROOM_S = 0.85, AWAY_Y = 228, AWAY_S = 1.22;
  var SEAT = { dee: 168, you: 232 };
  var SPOTS = { left: { x: 100, y: 206, s: 1 }, right: { x: 326, y: 206, s: 1 }, door: { x: 38, y: 154, s: 0.66 } };
  var AWAY_X = [138, 214, 292];

  var state = null; // the scene on stage
  var timers = [];
  var chairs = {}; // who -> the empty-or-not chair at their seat
  var figs = {}; // who -> { el, who, posture, spot, present, pose, hold }
  var lastAction = "";
  var trail = []; // everything said about the room since the scene opened (the playtest and the tests read it)
  var counter = 0;

  /* ---------------- the photographed room ---------------- */

  /* When night-shift/media/stage/stage.json loads, the room (place "room") is a photograph, not the SVG: the plate (the empty
     control room, 1536 x 920), room-state overlays (the door open, the tablet lit, spilled coffee, the fire panel's lights) and
     one black silhouette layer per person (a full-plate WebP with alpha, cut from a generated still: tools/pose-bake.mjs),
     each crossfaded about 250 ms at the line its `act` is tied to. Layers are chosen by the same state the SVG people use
     (who, posture, pose, spot): the first key found of  posture.pose.arg, posture.pose, spot.pose, spot, door, posture, *.
     A person with no layer isn't drawn (the caption still says what they do). Other places (the tour, the lobby, the endings
     by daylight) stay the SVG places until their stills are made. Only the layers a scene needs are ever requested. */
  var STAGE_URL = "/night-shift/media/stage/";
  var stage = null;
  var photoEl = null;
  var peopleEl = null; // the people's layers: above the big screen, which is above the plate
  var poseWraps = {}; // who -> the person's layer holder
  var pending = []; // beats of the line on stage that have not happened yet
  var doorT = null;
  var ovMade = {};

  /** The still behind the people for a place, or null (the SVG place stays). The room is the plate; the other places are stills
     with their people in them (stage.places: "<place>@<scene id>", "<place>:<who is with you>", "<place>"). */
  function stillFor(place) {
    if (!stage || !place) return null;
    if (place === "room") return stage.plate;
    var pl = stage.places;
    if (!pl) return null;
    var who = state && state.awayList ? state.awayList.filter(function (w) { return w !== "you"; }).sort().join("+") : "";
    var keys = [place + "@" + (state ? state.id : ""), place + ":" + who, place];
    for (var i = 0; i < keys.length; i++) if (pl[keys[i]]) return pl[keys[i]];
    return null;
  }

  function photoOn(place) { return !!stillFor(place || (state && state.place)); }

  function photoReset() {
    if (photoEl && photoEl.parentNode) photoEl.parentNode.removeChild(photoEl);
    if (peopleEl && peopleEl.parentNode) peopleEl.parentNode.removeChild(peopleEl);
    photoEl = null;
    peopleEl = null;
    poseWraps = {};
    ovMade = {};
  }

  /** The photographed room's base: the plate (or the place's still) and, in the room, the clock's hands. Called whenever the art is (re)drawn. */
  function photoBase() {
    var file = state ? stillFor(state.place) : null;
    host.setAttribute("data-art", file ? "photo" : "svg");
    if (!file) { photoReset(); return; }
    if (photoEl && photoEl.getAttribute("data-still") === file) return;
    photoReset();
    photoEl = document.createElement("div");
    photoEl.className = "room-photo";
    photoEl.setAttribute("aria-hidden", "true");
    photoEl.setAttribute("data-still", file);
    var plate = document.createElement("img");
    plate.className = "room-plate";
    plate.alt = "";
    plate.decoding = "async";
    plate.src = STAGE_URL + file;
    photoEl.appendChild(plate);
    if (state.place === "room") {
      var cx = stage.clock ? stage.clock.x / stage.width * 100 : 74.7, cy = stage.clock ? stage.clock.y / stage.height * 100 : 25.5;
      var clock = document.createElement("div");
      clock.className = "room-clock";
      clock.style.left = cx + "%";
      clock.style.top = cy + "%";
      clock.innerHTML = '<svg viewBox="-50 -50 100 100" focusable="false"><circle r="46" fill="#dcd9cf" stroke="#15191b" stroke-width="5"/>'
        + '<g stroke="#15191b" stroke-width="2.4"><line x1="0" y1="-40" x2="0" y2="-34"/><line x1="40" y1="0" x2="34" y2="0"/><line x1="0" y1="40" x2="0" y2="34"/><line x1="-40" y1="0" x2="-34" y2="0"/></g>'
        + '<line class="hand-h" x1="0" y1="2" x2="0" y2="-22" stroke="#15191b" stroke-width="5" stroke-linecap="round"/>'
        + '<line class="hand-m" x1="0" y1="3" x2="0" y2="-34" stroke="#15191b" stroke-width="3" stroke-linecap="round"/></svg>';
      photoEl.appendChild(clock);
    }
    host.insertBefore(photoEl, artEl.nextSibling);
    // People are drawn in front of the big screen (an element over the plate's screen), never behind it.
    peopleEl = document.createElement("div");
    peopleEl.className = "room-photo room-people";
    peopleEl.setAttribute("aria-hidden", "true");
    var big = document.getElementById("console-big");
    host.insertBefore(peopleEl, big && big.parentNode === host ? big.nextSibling : photoEl.nextSibling);
    setClock();
  }

  /** An overlay (a layer over the plate) is requested the first time its flag is raised. */
  function photoOverlay(name) {
    if (!photoEl || !state || state.place !== "room" || ovMade[name] || !stage.overlays || !stage.overlays[name]) return;
    ovMade[name] = 1;
    var im = document.createElement("img");
    im.className = "room-ov ov-" + name;
    im.alt = "";
    im.decoding = "async";
    im.src = STAGE_URL + stage.overlays[name];
    photoEl.appendChild(im);
  }

  function poseFile(f) {
    var table = stage && stage.poses && stage.poses[f.who];
    if (!table) return null;
    var base = f.posture === "seated" ? "seated" : "standing";
    var keys = [base + "." + f.pose + "." + (f.arg || ""), base + "." + f.pose, f.spot + "." + f.pose, f.spot, base, "*"];
    for (var i = 0; i < keys.length; i++) if (table[keys[i]]) return table[keys[i]];
    return null;
  }

  /* Two layers of one person that line up (stage.reg.fade lists the pairs, measured by tools/room-art.mjs) cross-fade; any other
     pair is a swap through the plate, because cross-fading two poses that don't register shows two people at once: the old one
     fades out in about 80 ms, the new one in over about 120 ms after it. */
  function fadesTogether(a, b) {
    var list = stage && stage.reg && stage.reg.fade;
    if (!list || !a || !b) return false;
    return list.indexOf(a < b ? a + "|" + b : b + "|" + a) >= 0;
  }

  /** The person's layer for the state they are in: crossfaded or swapped (or set at once for a resume and Skip). */
  function photoFig(f, instant) {
    if (!photoEl || !peopleEl || !state || state.place !== "room") return;
    var wrap = poseWraps[f.who];
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "room-pose";
      wrap.setAttribute("data-who", f.who);
      peopleEl.appendChild(wrap);
      poseWraps[f.who] = wrap;
    }
    var file = here(f) ? poseFile(f) : null;
    var cur = wrap.querySelector("img.on");
    if ((cur ? cur.getAttribute("data-f") : "") === (file || "")) return;
    wrap.setAttribute("data-file", file || "");
    var quick = instant || reduced;
    var together = !quick && cur && file && fadesTogether(cur.getAttribute("data-f"), file);
    [].forEach.call(wrap.querySelectorAll("img"), function (stale) { if (stale !== cur && stale.parentNode) stale.parentNode.removeChild(stale); });
    if (cur) {
      cur.classList.remove("on");
      var old = cur;
      if (quick) { if (old.parentNode) old.parentNode.removeChild(old); }
      else {
        old.style.transitionDuration = together ? "" : "80ms";
        later(function () { if (old.parentNode) old.parentNode.removeChild(old); }, together ? 320 : 100);
      }
    }
    if (!file) return;
    var im = document.createElement("img");
    im.className = "pose";
    im.alt = "";
    im.decoding = "async";
    im.setAttribute("data-f", file);
    im.src = STAGE_URL + file;
    if (!quick && cur && !together) { im.style.transitionDuration = "120ms"; im.style.transitionDelay = "80ms"; }
    wrap.appendChild(im);
    if (quick) im.classList.add("on");
    else (window.requestAnimationFrame || setTimeout)(function () { im.classList.add("on"); });
  }

  function photoView() {
    var o = { on: photoOn(), plate: stage ? stage.plate : null, still: state ? stillFor(state.place) : null, layers: {}, overlays: Object.keys(ovMade), door: host.hasAttribute("data-door") ? host.getAttribute("data-door-side") : "" };
    Object.keys(poseWraps).forEach(function (k) { o.layers[k] = poseWraps[k].getAttribute("data-file") || ""; });
    return o;
  }

  function loadStage(json) {
    stage = json && json.plate && json.poses ? json : null;
    if (state) { artEl.innerHTML = artFor(state.place); photoBase(); setClock(); render(true); }
  }

  function artFor(place) { return AWAY[place] ? placeArt(place, dawn()) : (photoOn(place) ? "" : roomArt()); }

  if (typeof fetch === "function" && host.getAttribute("data-stage") !== "off") {
    try {
      fetch(STAGE_URL + "stage.json").then(function (r) { return r.ok ? r.json() : null; }).then(loadStage).catch(function () {});
    } catch (e) { /* the SVG room stays */ }
  }

  /* ---------------- the room, drawn ---------------- */

  function roomArt() {
    var buttons = "";
    var cols = ["#d9c58a", "#7fb89a", "#8a949a", "#c9604f", "#8a949a", "#7fb89a", "#d9c58a"];
    for (var r = 0; r < 2; r++) for (var c = 0; c < 15; c++) buttons += '<rect x="' + (112 + c * 10.6 - r * 1.2) + '" y="' + (103 + r * 6.4) + '" width="7" height="4" rx="1" fill="' + cols[(c + r * 3) % cols.length] + '" opacity="0.85"/>';
    var tiles = "";
    for (var i = 0; i < 9; i++) tiles += '<line x1="' + (i * 50 - 10) + '" y1="240" x2="' + (i * 50 + 25) + '" y2="150" stroke="#34433f" stroke-width="1"/>';
    return '<svg class="art" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" focusable="false">'
      + '<defs><radialGradient id="rg-glow" cx="50%" cy="38%" r="60%"><stop offset="0" stop-color="#8fb8a8" stop-opacity="0.32"/><stop offset="1" stop-color="#8fb8a8" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="rg-spill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0e2a8" stop-opacity="0.55"/><stop offset="1" stop-color="#f0e2a8" stop-opacity="0"/></linearGradient></defs>'
      + '<rect width="400" height="240" fill="#1b2326"/>'
      + '<rect y="0" width="400" height="150" fill="#1f282c"/><rect y="96" width="400" height="2" fill="#2c3a3f"/>'
      + '<rect y="150" width="400" height="90" fill="#2a3835"/>' + tiles
      + '<rect y="150" width="400" height="3" fill="#141a1c"/>'
      /* the door to the lobby */
      + '<g class="r-door"><rect x="12" y="58" width="52" height="96" fill="#10161a"/>'
      + '<polygon class="door-light" points="14,154 62,154 106,214 -4,214" fill="url(#rg-spill)"/>'
      + '<g class="door-leaf"><rect x="16" y="62" width="44" height="92" fill="#3b474c"/><rect x="22" y="70" width="32" height="26" fill="#1d2a2e" stroke="#59686d" stroke-width="1"/><circle cx="55" cy="112" r="2.4" fill="#d9c58a"/></g>'
      + '<rect x="18" y="46" width="40" height="10" rx="1.5" fill="#101417" stroke="#59686d" stroke-width="0.8"/><text x="38" y="53.6" text-anchor="middle" font-size="6.6" font-family="Consolas,monospace" fill="#7fb89a" letter-spacing="0.8">LOBBY</text></g>'
      /* the wall clock (its hands are set from the scene's time) */
      + '<g class="r-clock"><circle cx="90" cy="38" r="14" fill="#e6e1d0" stroke="#10151a" stroke-width="2.5"/>'
      + '<g class="tick" stroke="#2a2a2a" stroke-width="1"><line x1="90" y1="26.5" x2="90" y2="29"/><line x1="101.5" y1="38" x2="99" y2="38"/><line x1="90" y1="49.5" x2="90" y2="47"/><line x1="78.5" y1="38" x2="81" y2="38"/></g>'
      + '<line class="hand-h" x1="90" y1="38" x2="90" y2="30" stroke="#151515" stroke-width="2.2" stroke-linecap="round"/>'
      + '<line class="hand-m" x1="90" y1="38" x2="90" y2="27.5" stroke="#151515" stroke-width="1.4" stroke-linecap="round"/><circle cx="90" cy="38" r="1.6" fill="#c9604f"/></g>'
      /* the screen's housing (the picture itself is the HTML element on top) */
      + '<rect x="116" y="5" width="168" height="98" rx="5" fill="#0c1114" stroke="#46555b" stroke-width="2"/>'
      + '<circle cx="124" cy="99" r="1.6" fill="#7fb89a" class="r-led"/><rect x="156" y="102" width="88" height="5" fill="#161d21"/>'
      + '<ellipse cx="200" cy="56" rx="160" ry="74" fill="url(#rg-glow)"/>'
      /* the fire panel and the access terminal */
      + '<g class="r-fire"><rect x="298" y="20" width="44" height="52" rx="3" fill="#8f2f27" stroke="#4a1511" stroke-width="2"/><rect x="304" y="26" width="32" height="12" fill="#1a0f0e"/>'
      + '<text x="320" y="35.4" text-anchor="middle" font-size="7" font-family="Consolas,monospace" fill="#e8c46a" letter-spacing="1">FIRE</text>'
      + '<g class="fire-leds"><circle cx="308" cy="48" r="3" fill="#6bd18a"/><circle cx="320" cy="48" r="3" fill="#6bd18a"/><circle cx="332" cy="48" r="3" fill="#6bd18a"/><circle class="fire-trouble" cx="308" cy="60" r="3" fill="#6a5a2a"/><circle cx="320" cy="60" r="3" fill="#6bd18a"/><circle cx="332" cy="60" r="3" fill="#6bd18a"/></g></g>'
      + '<g class="r-access"><rect x="352" y="24" width="36" height="52" rx="3" fill="#2d363b" stroke="#566469" stroke-width="1.5"/><rect x="357" y="29" width="26" height="16" fill="#0f2a1e"/><text x="370" y="40" text-anchor="middle" font-size="6" font-family="Consolas,monospace" fill="#6bd18a">BADGE</text>'
      + '<g fill="#8a949a"><rect x="358" y="51" width="6" height="5"/><rect x="367" y="51" width="6" height="5"/><rect x="376" y="51" width="6" height="5"/><rect x="358" y="59" width="6" height="5"/><rect x="367" y="59" width="6" height="5"/><rect x="376" y="59" width="6" height="5"/></g><circle cx="370" cy="70" r="2" fill="#d9c58a"/></g>'
      /* the shelf: binder and extinguisher */
      + '<g class="r-shelf"><rect x="336" y="94" width="56" height="3" fill="#59686d"/><rect x="342" y="80" width="8" height="14" fill="#35516b"/><rect x="351" y="82" width="7" height="12" fill="#6b4a2f"/><rect x="359" y="79" width="9" height="15" fill="#3a6b4e"/>'
      + '<rect x="296" y="82" width="10" height="34" rx="4" fill="#b83a2e"/><rect x="298" y="78" width="6" height="5" fill="#222"/></g>'
      /* the counter: coffee machine, radio charger */
      + '<rect x="300" y="122" width="100" height="52" fill="#2a3338"/><rect x="300" y="120" width="100" height="4" fill="#4a585e"/><line x1="350" y1="124" x2="350" y2="174" stroke="#171d20" stroke-width="1.5"/><rect x="368" y="140" width="22" height="3" fill="#59686d"/>'
      + '<g class="r-coffee"><rect x="306" y="96" width="26" height="24" rx="2" fill="#1a1f22" stroke="#59686d" stroke-width="1.5"/><rect x="311" y="101" width="16" height="6" fill="#0d1215"/><circle class="coffee-led" cx="319" cy="112" r="2" fill="#c9604f"/><rect x="313" y="114" width="12" height="6" fill="#d8d4c8"/></g>'
      + '<g class="r-charger"><rect x="342" y="108" width="52" height="12" rx="2" fill="#10151a" stroke="#59686d" stroke-width="1.2"/>'
      + [0, 1, 2, 3].map(function (k) { return '<g class="radio radio-' + (k + 1) + '"><rect x="' + (347 + k * 12) + '" y="97" width="7" height="14" rx="1.6" fill="#252c31"/><rect x="' + (348.4 + k * 12) + '" y="98.5" width="4" height="3" fill="#59686d"/><circle class="radio-led" cx="' + (350.5 + k * 12) + '" cy="116" r="1.7" fill="#6bd18a"/></g>'; }).join("")
      + '</g>'
      /* the desk and its controls */
      + '<polygon points="96,100 274,100 292,152 78,152" fill="#37434a"/><polygon points="96,100 274,100 275,103 95,103" fill="#566469"/><polygon points="78,152 292,152 292,156 78,156" fill="#222b30"/>'
      + '<rect x="108" y="102" width="156" height="17" fill="#1d262b" opacity="0.7"/>' + buttons
      + '<g class="r-faders" fill="#0e1417"><rect x="244" y="120" width="2" height="12"/><rect x="252" y="120" width="2" height="12"/><rect x="260" y="120" width="2" height="12"/><rect x="268" y="120" width="2" height="12"/></g>'
      + '<g fill="#d9c58a"><rect x="242" y="124" width="6" height="3" rx="1"/><rect x="250" y="129" width="6" height="3" rx="1"/><rect x="258" y="122" width="6" height="3" rx="1"/><rect x="266" y="127" width="6" height="3" rx="1"/></g>'
      + '<rect x="108" y="128" width="40" height="11" rx="1.5" fill="#222b30" stroke="#566469" stroke-width="0.8"/><g fill="#566469"><rect x="111" y="131" width="32" height="1.2"/><rect x="111" y="134" width="32" height="1.2"/></g>'
      + '<circle cx="200" cy="130" r="5" fill="#222b30" stroke="#566469" stroke-width="0.8"/><rect x="198.5" y="119" width="3" height="11" rx="1.5" fill="#8a949a"/>'
      /* things on the desk */
      + '<g class="r-tablet"><polygon points="196,112 222,112 224,124 194,124" fill="#10161a" stroke="#8a949a" stroke-width="1"/><polygon class="tablet-screen" points="198,113.5 220,113.5 221.6,122.5 196.4,122.5" fill="#cfd8c6"/>'
      + '<g class="tablet-lines" stroke="#1d2a2e" stroke-width="1"><line x1="200" y1="116" x2="217" y2="116"/><line x1="199.5" y1="118.4" x2="219" y2="118.4"/><line x1="199" y1="120.8" x2="213" y2="120.8"/></g></g>'
      + '<g class="r-phone"><rect x="258" y="110" width="22" height="11" rx="2" fill="#10151a" stroke="#8a949a" stroke-width="1"/><rect x="260" y="106" width="18" height="5" rx="2.5" fill="#222b30" stroke="#8a949a" stroke-width="0.8"/><g class="ring" fill="none" stroke="#e8c46a" stroke-width="1.6" stroke-linecap="round"><path d="M284,106 q5,4 0,8"/><path d="M289,102 q8,8 0,16"/><path d="M254,106 q-5,4 0,8"/><path d="M249,102 q-8,8 0,16"/></g></g>'
      + '<g class="r-cup"><ellipse class="puddle" cx="128" cy="116" rx="2" ry="1" fill="#4a2f1c"/><g class="cup"><rect x="108" y="107" width="8" height="9" rx="1.5" fill="#e9e5d8"/><rect x="108" y="107" width="8" height="2.2" fill="#6b4328"/></g><path class="drip" d="M116,112 q6,2 12,4" stroke="#4a2f1c" stroke-width="2" fill="none" stroke-linecap="round"/></g>'
      + '<g class="r-walkie"><rect x="154" y="108" width="6" height="11" rx="1.5" fill="#252c31" stroke="#59686d" stroke-width="0.8"/><circle cx="157" cy="110" r="1" fill="#6bd18a"/></g>'
      + '</svg>';
  }

  /* The places away from the room. Each is one flat picture in the same palette, with the floor at y 205 or so. */
  function placeArt(place, dawn) {
    var o = '<svg class="art" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" focusable="false">';
    var c = "</svg>";
    if (place === "lobby") {
      var sky = dawn ? "#d9a98a" : "#0f1620";
      return o + '<rect width="400" height="240" fill="#222c30"/><rect x="130" y="20" width="140" height="150" fill="' + sky + '"/>'
        + (dawn ? '<polygon points="130,20 270,20 340,170 60,170" fill="#f3d9a0" opacity="0.18"/>' : "")
        + '<g fill="none" stroke="#59686d" stroke-width="3"><rect x="130" y="20" width="140" height="150"/><line x1="200" y1="20" x2="200" y2="170"/><line x1="130" y1="95" x2="270" y2="95"/></g>'
        + '<g transform="translate(200 128)"><circle r="40" fill="#0e1417" opacity="0.5" stroke="#8a949a" stroke-width="3"/><line x1="-40" y1="0" x2="40" y2="0" stroke="#8a949a" stroke-width="3"/><line x1="0" y1="-40" x2="0" y2="40" stroke="#8a949a" stroke-width="3"/></g>'
        + '<g><rect x="12" y="44" width="92" height="126" fill="#394349"/><rect x="18" y="52" width="38" height="118" fill="#7d8b90"/><rect x="60" y="52" width="38" height="118" fill="#7d8b90"/><rect x="52" y="30" width="12" height="9" fill="#e8c46a"/></g>'
        + '<rect x="0" y="170" width="400" height="70" fill="#8a9296"/><g stroke="#6d777b" stroke-width="1"><line x1="0" y1="200" x2="400" y2="200"/><line x1="100" y1="170" x2="40" y2="240"/><line x1="200" y1="170" x2="200" y2="240"/><line x1="300" y1="170" x2="360" y2="240"/></g>'
        + '<rect x="290" y="146" width="104" height="46" fill="#3b2f26"/><rect x="286" y="140" width="112" height="8" fill="#5a4636"/><rect x="342" y="126" width="30" height="16" rx="2" fill="#10151a"/>'
        + '<rect x="20" y="186" width="70" height="8" fill="#59432f"/><rect x="26" y="194" width="4" height="12" fill="#59432f"/><rect x="80" y="194" width="4" height="12" fill="#59432f"/>' + c;
    }
    if (place === "vestibule") {
      return o + '<rect width="400" height="240" fill="#1c2a33"/><rect x="0" y="170" width="400" height="70" fill="#47555c"/>'
        + '<g fill="#6f8a96" opacity="0.5"><rect x="40" y="26" width="140" height="144"/><rect x="220" y="26" width="140" height="144"/></g><g fill="#dfeaf0" opacity="0.26"><rect x="40" y="26" width="140" height="30"/><rect x="220" y="26" width="140" height="30"/><rect x="40" y="140" width="140" height="30"/><rect x="220" y="140" width="140" height="30"/></g>'
        + '<g fill="none" stroke="#8a949a" stroke-width="4"><rect x="40" y="26" width="140" height="144"/><rect x="220" y="26" width="140" height="144"/><line x1="110" y1="26" x2="110" y2="170"/><line x1="290" y1="26" x2="290" y2="170"/></g>'
        + '<rect x="188" y="40" width="26" height="46" rx="3" fill="#10151a" stroke="#8a949a" stroke-width="1.5"/><rect x="194" y="46" width="14" height="8" fill="#0f2a1e"/><circle cx="201" cy="62" r="3" fill="#c9604f"/>'
        + '<g><rect x="198" y="100" width="8" height="36" rx="3" fill="#e9e5d8"/><rect x="200" y="118" width="4" height="16" fill="#c9604f"/></g>'
        + '<rect x="20" y="176" width="130" height="14" fill="#2c353a"/><rect x="20" y="190" width="130" height="5" fill="#1d252a"/>' + c;
    }
    if (place === "dock") {
      return o + '<rect width="400" height="240" fill="#1a1f22"/><rect x="0" y="170" width="400" height="70" fill="#3a4044"/>'
        + '<rect x="170" y="20" width="210" height="150" fill="#272d31" stroke="#59686d" stroke-width="3"/><g stroke="#363d42" stroke-width="2">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (k) { return '<line x1="172" y1="' + (60 + k * 13) + '" x2="378" y2="' + (60 + k * 13) + '"/>'; }).join("") + '</g>'
        + '<rect x="172" y="132" width="206" height="38" fill="#0e1417"/><rect x="236" y="118" width="86" height="40" rx="3" fill="#c9d4d6" opacity="0.22"/><circle cx="279" cy="148" r="14" fill="#c9d4d6" opacity="0.2"/>'
        + '<g><rect x="16" y="86" width="104" height="84" fill="#42514f" stroke="#59686d" stroke-width="2"/><rect x="26" y="96" width="84" height="50" fill="#222c2a"/><g stroke="#8a949a" stroke-width="2">' + [0, 1, 2, 3, 4].map(function (k) { return '<line x1="' + (36 + k * 16) + '" y1="96" x2="' + (36 + k * 16) + '" y2="146"/>'; }).join("") + '</g><circle cx="68" cy="78" r="5" fill="#f0e2a8"/><line x1="68" y1="64" x2="68" y2="73" stroke="#8a949a" stroke-width="2"/></g>'
        + '<rect x="130" y="130" width="30" height="40" fill="#5a4636"/><rect x="134" y="106" width="22" height="24" fill="#6b5640"/>' + c;
    }
    if (place === "stairwell") {
      var steps = "";
      for (var i = 0; i < 9; i++) steps += '<polygon points="' + (150 + i * 28) + "," + (205 - i * 16) + " " + (178 + i * 28) + "," + (205 - i * 16) + " " + (178 + i * 28) + ",240 " + (150 + i * 28) + ',240" fill="' + (i % 2 ? "#4a5359" : "#556067") + '"/><rect x="' + (150 + i * 28) + '" y="' + (205 - i * 16) + '" width="28" height="3" fill="#7f8c92"/>';
      return o + '<rect width="400" height="240" fill="#2a3135"/><rect x="0" y="205" width="150" height="35" fill="#3f484d"/>' + steps
        + '<g stroke="#9aa6ab" stroke-width="3" fill="none"><line x1="140" y1="150" x2="380" y2="14"/><line x1="172" y1="196" x2="172" y2="146"/><line x1="256" y1="148" x2="256" y2="98"/><line x1="340" y1="100" x2="340" y2="50"/></g>'
        + '<rect x="14" y="40" width="96" height="165" fill="#8a3a2e" stroke="#2a1411" stroke-width="3"/><rect x="24" y="54" width="76" height="18" fill="#e8c46a"/><text x="62" y="68" text-anchor="middle" font-size="14" font-family="Consolas,monospace" font-weight="700" fill="#2a1411">31</text><rect x="24" y="118" width="60" height="6" fill="#d8d4c8"/>'
        + '<polygon points="116,205 140,205 140,194" fill="#e0782a"/><rect x="0" y="0" width="400" height="8" fill="#171c1f"/><circle cx="262" cy="22" r="6" fill="#f0e2a8"/>' + c;
    }
    if (place === "corridor") {
      return o + '<rect width="400" height="240" fill="#222a2e"/><polygon points="0,0 120,60 120,170 0,240" fill="#2d383c"/><polygon points="400,0 280,60 280,170 400,240" fill="#2d383c"/>'
        + '<polygon points="0,240 120,170 280,170 400,240" fill="#4b3a36"/><polygon points="0,0 120,60 280,60 400,0" fill="#31403f"/>'
        + '<rect x="120" y="60" width="160" height="110" fill="#1c2427"/><rect x="172" y="84" width="56" height="86" fill="#3a4a4d" stroke="#59686d" stroke-width="2"/><rect x="172" y="164" width="56" height="6" fill="#0e1417" opacity="0.8"/><text x="200" y="98" text-anchor="middle" font-size="6.5" font-family="Consolas,monospace" fill="#e8c46a">CLOSET</text>'
        + '<g fill="#3a4a4d" stroke="#59686d" stroke-width="1.5"><polygon points="20,40 60,60 60,190 20,210"/><polygon points="380,40 340,60 340,190 380,210"/><polygon points="80,70 104,82 104,172 80,186"/><polygon points="320,70 296,82 296,172 320,186"/></g>'
        + '<g fill="#f0e2a8" opacity="0.8"><rect x="176" y="62" width="48" height="3"/><rect x="60" y="10" width="40" height="3"/><rect x="300" y="10" width="40" height="3"/></g>' + c;
    }
    /* roof */
    var stars = "";
    for (var s = 0; s < 22; s++) stars += '<circle cx="' + ((s * 53) % 400) + '" cy="' + ((s * 29) % 100 + 6) + '" r="' + (s % 3 ? 0.8 : 1.4) + '" fill="#e8ecf0" opacity="0.7"/>';
    return o + '<rect width="400" height="240" fill="#0d1420"/>' + stars
      + '<g fill="#18222f"><rect x="0" y="120" width="40" height="70"/><rect x="48" y="96" width="30" height="94"/><rect x="86" y="130" width="46" height="60"/><rect x="140" y="80" width="34" height="110"/><rect x="182" y="112" width="40" height="78"/><rect x="232" y="100" width="28" height="90"/><rect x="268" y="136" width="50" height="54"/><rect x="326" y="90" width="34" height="100"/><rect x="366" y="122" width="34" height="68"/></g>'
      + '<g fill="#e8c46a" opacity="0.55"><rect x="54" y="106" width="3" height="3"/><rect x="62" y="122" width="3" height="3"/><rect x="146" y="96" width="3" height="3"/><rect x="156" y="120" width="3" height="3"/><rect x="190" y="126" width="3" height="3"/><rect x="334" y="108" width="3" height="3"/><rect x="342" y="132" width="3" height="3"/></g>'
      + '<rect x="0" y="190" width="400" height="50" fill="#2a3036"/><rect x="0" y="182" width="400" height="10" fill="#3a4248"/>'
      + '<g><rect x="304" y="70" width="70" height="112" fill="#3b4348" stroke="#59686d" stroke-width="2"/><rect x="316" y="84" width="46" height="98" fill="#2a3135"/><rect x="354" y="124" width="6" height="6" fill="#d9c58a"/><circle cx="339" cy="60" r="5" fill="#f0e2a8"/><rect x="326" y="92" width="26" height="18" fill="#e8c46a"/><text x="339" y="104" text-anchor="middle" font-size="5" font-family="Consolas,monospace" fill="#2a1411">ALARMED</text></g>'
      + '<g stroke="#8a949a" stroke-width="1.5" opacity="0.4" fill="none"><path d="M10,60 q40,-6 80,0"/><path d="M60,80 q40,-6 80,0"/><path d="M250,50 q30,-6 70,0"/></g>' + c;
  }

  /* ---------------- a person ---------------- */

  function hairBack(look) {
    var h = look.hair;
    switch (look.style) {
      case "bun": return '<circle class="p-hair" cx="0" cy="-118" r="11.4" fill="' + h + '"/><circle class="p-hair" cx="0" cy="-131.5" r="6" fill="' + h + '"/>';
      case "lowbun": return '<circle class="p-hair" cx="0" cy="-118" r="11.4" fill="' + h + '"/><circle class="p-hair" cx="0" cy="-107.5" r="5.2" fill="' + h + '"/>';
      case "beanie": return '<circle class="p-hair" cx="0" cy="-118" r="11.2" fill="' + h + '"/><path class="p-hat" d="M-11.8,-119 a11.8,11.8 0 0 1 23.6,0 z" fill="' + look.top + '"/><circle class="p-hat" cx="0" cy="-130.4" r="2.6" fill="' + look.top + '"/>';
      case "cap": return '<circle class="p-hair" cx="0" cy="-118" r="11.2" fill="' + h + '"/><path class="p-hat" d="M-11.8,-118 a11.8,11.8 0 0 1 23.6,0 z" fill="' + look.top + '"/><rect class="p-hat" x="-3" y="-112.4" width="0.1" height="0.1" fill="none"/>';
      case "curls": return '<circle class="p-hair" cx="0" cy="-118" r="11.6" fill="' + h + '"/><circle class="p-hair" cx="-10" cy="-123" r="5.6" fill="' + h + '"/><circle class="p-hair" cx="10" cy="-123" r="5.6" fill="' + h + '"/><circle class="p-hair" cx="-6" cy="-129" r="5.6" fill="' + h + '"/><circle class="p-hair" cx="6" cy="-129" r="5.6" fill="' + h + '"/><circle class="p-hair" cx="0" cy="-131" r="5.2" fill="' + h + '"/>';
      case "hood": return '<circle class="p-hair" cx="0" cy="-118" r="14" fill="' + look.top + '"/><circle class="p-hair" cx="0" cy="-118" r="11" fill="' + h + '"/>';
      case "messy": return '<circle class="p-hair" cx="0" cy="-118" r="11.4" fill="' + h + '"/><path class="p-hair" d="M-9,-126 l-3,-6 l6,3 l2,-7 l4,6 l5,-5 l1,7 l5,-1 l-3,6z" fill="' + h + '"/>';
      case "neat": return '<circle class="p-hair" cx="0" cy="-118" r="11.2" fill="' + h + '"/><path class="p-hair" d="M-11,-122 q11,-12 22,0 q-11,-4 -22,0z" fill="' + h + '"/>';
      default: return '<circle class="p-hair" cx="0" cy="-118" r="11.2" fill="' + h + '"/>';
    }
  }

  function faceFront(look) {
    var cap = "";
    if (look.style === "beanie" || look.style === "cap") cap = '<path class="p-hat" d="M-11.8,-121 a11.8,11.8 0 0 1 23.6,0 z" fill="' + look.top + '"/>' + (look.style === "cap" ? '<rect class="p-hat" x="-12" y="-122" width="24" height="3" rx="1.5" fill="' + look.top + '"/>' : "");
    else if (look.style === "hood") cap = '<path class="p-hat" d="M-14,-116 a14,14 0 0 1 28,0 q-3,-6 -14,-6 q-11,0 -14,6z" fill="' + look.top + '"/>';
    else cap = '<path class="p-hair" d="M-11.4,-119 a11.4,11.4 0 0 1 22.8,0 q-11,-6 -22.8,0z" fill="' + look.hair + '"/>' + (look.style === "bun" ? '<circle class="p-hair" cx="0" cy="-131.5" r="6" fill="' + look.hair + '"/>' : "") + (look.style === "curls" ? '<circle class="p-hair" cx="-8" cy="-126" r="5" fill="' + look.hair + '"/><circle class="p-hair" cx="8" cy="-126" r="5" fill="' + look.hair + '"/>' : "");
    return '<circle class="p-skin" cx="0" cy="-118" r="10.4" fill="' + look.skin + '"/>' + cap + '<circle cx="-3.8" cy="-117" r="1.1" fill="#1a1a1a"/><circle cx="3.8" cy="-117" r="1.1" fill="#1a1a1a"/><path d="M-3,-111.6 q3,2 6,0" stroke="#2a1a14" stroke-width="0.9" fill="none" stroke-linecap="round"/>';
  }

  function chair() {
    return '<rect x="-3" y="-24" width="6" height="17" fill="#1a2227"/><rect x="-24" y="-9" width="48" height="4" rx="2" fill="#1a2227"/>'
      + '<circle cx="-21" cy="-3" r="3" fill="#10161a"/><circle cx="0" cy="-3" r="3" fill="#10161a"/><circle cx="21" cy="-3" r="3" fill="#10161a"/>'
      + '<rect x="-24" y="-32" width="48" height="8" rx="4" fill="#27323a" stroke="#3e4f59" stroke-width="1"/>';
  }

  function chairBack() {
    return '<rect x="-21" y="-56" width="42" height="26" rx="8" fill="#27323a" stroke="#3e4f59" stroke-width="1.2"/><rect x="-14" y="-52" width="28" height="3" rx="1.5" fill="#3e4f59" opacity="0.6"/>';
  }

  /* What the right hand holds: the handset, the cup, the pencil (shown for the pose that uses it). */
  var HELD = '<rect class="held held-phone" x="-2.8" y="8" width="5.6" height="20" rx="2.8" fill="#10151a" stroke="#9aa6ab" stroke-width="0.9"/>'
    + '<g class="held held-cup"><rect x="-4.4" y="14" width="8.8" height="10" rx="1.6" fill="#e9e5d8" stroke="#2b3a3f" stroke-width="0.6"/><rect x="-4.4" y="14" width="8.8" height="2.6" fill="#6b4328"/></g>'
    + '<line class="held held-pencil" x1="1" y1="21" x2="5.4" y2="31" stroke="#e8c46a" stroke-width="2.2" stroke-linecap="round"/>';

  function arm(side, look) {
    var x = side === "l" ? -17 : 17;
    return '<g transform="translate(' + x + ' -98)"><g class="arm ' + side + '"><g class="a">'
      + '<rect class="p-top" x="-4.2" y="-2" width="8.4" height="23" rx="4.2" fill="' + look.top + '"/>'
      + '<g class="f"><g class="fw"><rect class="p-top" x="-3.8" y="-2" width="7.6" height="21" rx="3.8" fill="' + look.top + '"/><circle class="p-skin" cx="0" cy="19.5" r="4.4" fill="' + look.skin + '"/>' + (side === "r" ? HELD : "") + '</g></g>'
      + '</g></g></g>';
  }

  function personSvg(who, look) {
    var w = look.w || 1;
    var coat = look.coat ? '<path class="p-top" d="M-19,-60 L19,-60 L24,-4 L-24,-4 z" fill="' + look.top + '"/>' : "";
    var bag = look.bag === 1 ? '<rect class="p-bag" x="-24" y="-74" width="9" height="20" rx="3" fill="#5a4636"/><line class="p-bag" x1="-16" y1="-98" x2="14" y2="-56" stroke="#5a4636" stroke-width="2.4"/>'
      : look.bag === 2 ? '<rect class="p-bag" x="-15" y="-96" width="30" height="36" rx="8" fill="#46556b"/>' : "";
    var tie = look.tie ? '<path class="p-tie" d="M-2.4,-104 l4.8,0 l1.6,18 l-8,0 z" fill="#8a2f2f"/>' : "";
    var radio = look.radio ? '<rect class="p-bag" x="12" y="-66" width="6" height="11" rx="1.6" fill="#252c31"/>' : "";
    return '<g class="clipw"><g class="rig">'
      + '<g class="legs"><g transform="translate(-6.5 -52)"><g class="leg l"><rect class="p-bottom" x="-5" y="-2" width="10" height="54" rx="4.4" fill="' + look.bottom + '"/><rect class="p-shoe" x="-5.6" y="49" width="12" height="5" rx="2.4" fill="#14181b"/></g></g>'
      + '<g transform="translate(6.5 -52)"><g class="leg r"><rect class="p-bottom" x="-5" y="-2" width="10" height="54" rx="4.4" fill="' + look.bottom + '"/><rect class="p-shoe" x="-5.6" y="49" width="12" height="5" rx="2.4" fill="#14181b"/></g></g></g>'
      + '<g class="torso">' + coat
      + '<path class="p-top" d="M-18.5,-100 q18.5,-7 37,0 l3.4,48 l-43.8,0 z" fill="' + look.top + '"/>' + tie + bag + radio
      + arm("l", look) + arm("r", look)
      + '<rect class="p-skin" x="-3.6" y="-108" width="7.2" height="9" rx="2.8" fill="' + look.skin + '"/>'
      + '<g class="head"><g class="back">' + hairBack(look) + '</g><g class="front">' + faceFront(look) + '</g></g>'
      + '</g></g></g>'
      + '<g class="chair-front">' + chairBack() + '</g>'
      + '<g class="fx-anger"><text x="14" y="-134" font-size="17" font-weight="900" font-family="Consolas,monospace" fill="#ff5a4a">!!</text></g>'
      + '<g class="fx-knock" fill="none" stroke="#e8c46a" stroke-width="2" stroke-linecap="round"><path d="M-40,-118 q-5,6 0,12"/><path d="M-46,-124 q-9,12 0,24"/></g>'
      + '<g class="fx-talk"><circle cx="0" cy="-140" r="2" fill="#f3f1ec"/><circle cx="7" cy="-140" r="2" fill="#f3f1ec"/><circle cx="-7" cy="-140" r="2" fill="#f3f1ec"/></g>'
      + '<text class="tag" x="0" y="22" text-anchor="middle" font-size="9.5" font-weight="700" font-family="Consolas,monospace" fill="#f3f1ec">' + LABELS[who] + '</text>';
  }

  function makeFig(who) {
    var look = LOOKS[who];
    var g = document.createElementNS(NS, "g");
    g.setAttribute("class", "fig");
    g.setAttribute("data-who", who);
    g.innerHTML = personSvg(who, look);
    var q = function (sel) { return g.querySelector(sel); };
    var parts = [];
    [].forEach.call(g.querySelectorAll("[class^='p-']"), function (el) { el.setAttribute("data-c", el.getAttribute("fill")); parts.push(el); });
    var refs = {
      parts: parts, rig: q(".rig"), clipw: q(".clipw"), head: q(".head"), back: q(".back"), tie: q(".p-tie") || document.createElementNS(NS, "g"), front: q(".front"), tag: q(".tag"),
      chairFront: q(".chair-front"), legs: g.querySelectorAll(".leg"),
      al: q(".arm.l .a"), fl: q(".arm.l .f"), ar: q(".arm.r .a"), fr: q(".arm.r .f"),
    };
    return { el: g, q: refs };
  }

  /* ---------------- the stage ---------------- */

  function seatOf(who) { return SEAT[who] != null; }

  function clearTimers() {
    timers.forEach(function (t) { clearTimeout(t); });
    timers = [];
    pending = [];
    doorT = null;
  }

  function later(fn, ms) {
    var t = setTimeout(function () {
      timers = timers.filter(function (x) { return x !== t; });
      try { fn(); } catch (e) { /* the story plays without the room */ }
    }, ms);
    timers.push(t);
  }

  function placeIsAway() { return !!AWAY[state.place]; }
  /** Is this person on stage? In the room: when they are in it; out of it: when they are with you. */
  function here(f) { return placeIsAway() ? state.awayList.indexOf(f.who) >= 0 : f.present || !!f.leaving; }
  function looksColor() { return state.place === "room-day" || placeIsAway(); }

  /** Where a figure stands for the place on stage now: { x, y, s }. */
  function spotFor(f) {
    var w = f.who;
    var look = LOOKS[w];
    if (placeIsAway()) {
      var list = state.awayList;
      var i = Math.max(0, list.indexOf(w));
      return { x: AWAY_X[Math.min(i, AWAY_X.length - 1)], y: AWAY_Y, s: AWAY_S * look.s };
    }
    if (f.spot === "door") return { x: SPOTS.door.x, y: SPOTS.door.y, s: ROOM_S * SPOTS.door.s * look.s };
    if (f.spot === "left" || f.spot === "right") return { x: SPOTS[f.spot].x, y: SPOTS[f.spot].y, s: ROOM_S * look.s };
    return { x: SEAT[w] != null ? SEAT[w] : SPOTS.left.x, y: ROOM_Y, s: ROOM_S * look.s };
  }

  /* How each pose bends the arms: [left upper, left fore, right upper, right fore] in degrees (0 = hanging down; the
     left arm lifts with a positive angle, the right with a negative one). The right arm does most things; pointing and
     touching use the arm on the side of the screen. */
  var POSES = {
    rest: [3, -2, -3, 2], desk: [16, -38, -16, 38], point: [3, -2, -150, -6], touch: [3, -2, -170, -4], write: [14, -30, -75, -35],
    phone: [3, -2, -125, -95], hand: [3, -2, -80, -10], angry: [40, -80, -40, 80], knock: [3, -2, -100, -30], count: [3, -2, -100, -15],
    drink: [3, -2, -140, -85], eat: [3, -2, -140, -85], press: [3, -2, -105, -12], read: [3, -2, -52, -92], pointside: [3, -2, -125, -5], spill: [64, -18, -64, 18], console: [16, -38, -44, 34], lean: [16, -38, -16, 38],
  };

  /** Dresses a person for the place, the look and the pose: every motion is an inline transform (transitions are in the CSS). */
  function dress(f) {
    var q = f.q, away = placeIsAway(), color = looksColor();
    var seated = f.posture === "seated";
    var sil = !color;
    q.parts.forEach(function (el) {
      if (sil) { el.setAttribute("fill", "#050708"); el.setAttribute("stroke", "#2b3a3f"); el.setAttribute("stroke-width", "0.8"); }
      else { el.setAttribute("fill", el.getAttribute("data-c")); el.removeAttribute("stroke"); el.removeAttribute("stroke-width"); }
    });
    q.tie.setAttribute("display", away ? "inline" : "none");
    q.back.setAttribute("display", away ? "none" : "inline");
    q.front.setAttribute("display", away ? "inline" : "none");
    var chaired = seatOf(f.who) && !away && f.spot === "seat";
    q.chairFront.setAttribute("display", chaired && seated ? "inline" : "none");
    q.clipw.setAttribute("clip-path", chaired && seated ? "url(#rg-seatclip)" : "");
    if (seatOf(f.who)) {
      if (f.present && f.spot === "seat") f.pushed = !seated;
      var c = chairs[f.who];
      if (c) {
        c.setAttribute("display", away ? "none" : "inline");
        c.firstChild.style.transform = f.pushed ? "translate(" + (SEAT[f.who] > 200 ? 36 : -36) + "px,3px) rotate(" + (SEAT[f.who] > 200 ? 16 : -16) + "deg)" : "translate(0px,0px)";
      }
    }
    var drop = seated ? (away ? 30 : 40) : 0;
    if (f.pose === "lean") drop -= 6;
    q.rig.style.transform = "translateY(" + drop + "px)";
    [].forEach.call(q.legs, function (leg) { leg.style.transform = seated && away ? "scaleY(0.55)" : "scaleY(1)"; });
    var p = POSES[f.pose] || POSES.rest;
    if ((f.pose === "point" || f.pose === "touch" || f.pose === "console") && f.x > 200) p = [-p[2], -p[3], -p[0], -p[1]];
    q.al.style.transform = "rotate(" + p[0] + "deg)";
    q.fl.style.transform = "translate(0px,20px) rotate(" + p[1] + "deg)";
    q.ar.style.transform = "rotate(" + p[2] + "deg)";
    q.fr.style.transform = "translate(0px,20px) rotate(" + p[3] + "deg)";
    q.head.style.transformOrigin = "0px -108px";
    q.head.style.transform = f.pose === "write" ? "rotate(9deg)" : f.pose === "phone" ? "rotate(-6deg)" : "rotate(0deg)";
    q.tag.setAttribute("y", away ? "-150" : "24");
    q.tag.setAttribute("display", f.who === "you" || !away ? "inline" : "inline");
    photoFig(f, f.instantPhoto);
  }

  function applyPos(f, instant) {
    var p = spotFor(f);
    var el = f.el;
    f.x = p.x;
    if (instant) el.classList.add("no-tx");
    el.style.transform = "translate(" + p.x + "px," + p.y + "px) scale(" + p.s + ")";
    el.setAttribute("data-spot", f.spot);
    el.setAttribute("data-posture", f.posture);
    el.setAttribute("data-pose", f.pose);
    el.setAttribute("data-present", f.present || f.leaving ? "1" : "0");
    f.instantPhoto = !!instant;
    dress(f);
    f.instantPhoto = false;
    if (instant) {
      void el.getBoundingClientRect();
      el.classList.remove("no-tx");
    }
  }

  function ensure(who) {
    if (!LOOKS[who]) return null;
    if (figs[who]) return figs[who];
    var made = makeFig(who);
    var f = { who: who, el: made.el, q: made.q, posture: seatOf(who) ? "seated" : "standing", spot: seatOf(who) ? "seat" : "left", present: false, pose: "rest", hold: 0 };
    figsEl.querySelector("g.figs").appendChild(f.el);
    figs[who] = f;
    return f;
  }

  function takeSpot(f) {
    if (seatOf(f.who)) return "seat";
    var taken = {};
    Object.keys(figs).forEach(function (k) { if (figs[k] !== f && figs[k].present && !seatOf(k)) taken[figs[k].spot] = 1; });
    return taken.left ? "right" : "left";
  }

  function render(instant) {
    host.setAttribute("data-place", state.place);
    host.setAttribute("data-look", looksColor() ? "color" : "sil");
    host.setAttribute("data-mode", placeIsAway() ? "away" : "room");
    Object.keys(figs).forEach(function (k) {
      var f = figs[k];
      var show = here(f);
      f.el.setAttribute("data-show", show ? "1" : "0");
      applyPos(f, instant);
    });
  }

  function settled(f) { return f.posture === "seated" ? "desk" : "rest"; }

  function setPose(f, pose, ms) {
    f.pose = pose;
    f.el.setAttribute("data-pose", pose);
    dress(f);
    f.hold++;
    var token = f.hold;
    if (ms) later(function () { if (f.hold === token) { f.pose = settled(f); f.arg = ""; f.el.setAttribute("data-pose", f.pose); dress(f); if (f.returnSeat) sitBack(f); } }, ms);
  }

  /** Back to their seat after getting up for a moment (the radio on the charger). */
  function sitBack(f) {
    f.returnSeat = false;
    if (!seatOf(f.who) || !f.present) return;
    f.posture = "seated";
    f.spot = "seat";
    f.pose = "desk";
    applyPos(f, false);
  }

  function say(text) {
    lastAction = text;
    trail.push(text);
    if (actionEl) {
      actionEl.textContent = text;
      actionEl.setAttribute("data-key", String(++counter));
    }
    host.setAttribute("aria-label", "Control room. " + text);
  }

  function nameOf(who) { return NAMES[who] || who; }

  function flag(name, ms) {
    host.setAttribute("data-" + name, "1");
    photoOverlay(name === "writing" ? "writing" : name === "buzz" ? "buzz" : name === "spill" ? "spill" : "");
    later(function () { host.removeAttribute("data-" + name); }, ms);
  }

  /** The door opens (and shuts again after `ms`, or stays open when ms is 0: `gone` shuts it). */
  function door(ms, side) {
    host.setAttribute("data-door-side", side === "right" ? "right" : "left");
    host.setAttribute("data-door", "1");
    photoOverlay(host.getAttribute("data-door-side") === "right" ? "door-right" : "door-left");
    if (doorT) clearTimeout(doorT);
    doorT = null;
    if (ms) {
      var t = setTimeout(function () { if (doorT === t) shut(); }, ms);
      doorT = t;
      timers.push(t);
    }
  }
  function shut() {
    if (doorT) clearTimeout(doorT);
    doorT = null;
    host.removeAttribute("data-door");
  }

  /* ---------------- acts ---------------- */

  /** Out of the room for good (until an `enter` or a scene's cast): no layer, the door shut. */
  function goneNow(f) {
    f.leaveToken = (f.leaveToken || 0) + 1;
    f.leaving = false;
    f.present = false;
    f.el.classList.remove("is-walking");
    f.el.setAttribute("data-show", "0");
    f.el.setAttribute("data-present", "0");
    shut();
    photoFig(f, false);
  }

  /** Does a `gone` for this person still come in the scene (a later beat of this line or a later line, before they enter again)? Then the leave waits for it. */
  function goneComing(who) {
    for (var i = state.at; i < state.lines.length; i++) {
      var list = actsOf(state.lines[i]);
      for (var k = 0; k < list.length; k++) {
        var p = list[k].spec.split(":");
        if (p[0] !== who || (i === state.at && list[k].at <= 0)) continue;
        if (p[1] === "gone") return true;
        if (p[1] === "enter") return false;
      }
    }
    return false;
  }

  function act(spec, instant) {
    var parts = String(spec).split(":");
    var who = parts[0], verb = parts[1], arg = parts[2];
    if (VERBS.indexOf(verb) < 0) return;
    if (who === "room") return roomAct(verb, instant);
    var f = ensure(who);
    if (!f) return;
    var away = placeIsAway();
    if (verb === "enter") {
      var was = f.present;
      f.present = true;
      f.leaving = false;
      f.leaveToken = (f.leaveToken || 0) + 1;
      f.spot = arg && SPOTS[arg] && arg !== "door" ? arg : takeSpot(f);
      f.posture = seatOf(who) && !(arg && SPOTS[arg]) ? "seated" : "standing";
      f.pose = f.posture === "seated" ? "desk" : "rest";
      if (away && state.awayList.indexOf(who) < 0) state.awayList.push(who);
      if (instant || was || reduced || away) { render(true); if (!was && !instant) say(nameOf(who) + " comes in"); return; }
      var dest = f.spot;
      f.spot = "door";
      f.el.setAttribute("data-show", "0");
      applyPos(f, true);
      f.el.setAttribute("data-show", "1");
      door(1900, arg === "right" ? "right" : "left");
      say(nameOf(who) + " comes in through the door");
      later(function () {
        f.spot = dest;
        f.el.classList.add("is-walking");
        applyPos(f, false);
        later(function () { f.el.classList.remove("is-walking"); }, 1300);
      }, 350);
      return;
    }
    if (verb === "leave") {
      if (!f.present && !here(f)) return;
      if (instant || reduced || away) {
        f.present = false;
        f.leaving = false;
        if (away) state.awayList = state.awayList.filter(function (w) { return w !== who; });
        if (!instant) shut();
        render(true);
        if (!instant) say(nameOf(who) + " leaves");
        return;
      }
      f.posture = "standing";
      f.spot = "door";
      f.present = false;
      f.leaving = true;
      f.leaveToken = (f.leaveToken || 0) + 1;
      f.el.classList.add("is-walking");
      applyPos(f, false);
      // with a `gone` beat later in the line the door stays open until it; without one he is out of the room 1.4 s after
      var held = goneComing(who);
      door(held ? 0 : 1900);
      say(nameOf(who) + " leaves the room");
      if (!held) { var tok = f.leaveToken; later(function () { if (f.leaveToken === tok) goneNow(f); }, 1400); }
      return;
    }
    if (verb === "gone") {
      if (!f.leaving && f.present) return; // gone is only the end of a leave
      goneNow(f);
      if (!instant) say(nameOf(who) + " is out of the room");
      return;
    }
    if (!here(f)) return;
    if (verb === "stand" || verb === "sit") f.returnSeat = false;
    if (verb === "stand") {
      if (f.posture === "standing") return;
      f.posture = "standing";
      f.pose = "rest";
      applyPos(f, !!instant);
      if (!instant) say(nameOf(who) + (who === "you" ? " stand up" : " stands up"));
      return;
    }
    if (verb === "sit") {
      if (f.posture === "seated") return;
      f.posture = "seated";
      f.pose = "desk";
      if (!seatOf(who) && !away) { f.posture = "standing"; return; }
      if (seatOf(who)) f.spot = "seat";
      applyPos(f, !!instant);
      if (!instant) say(nameOf(who) + (who === "you" ? " sit down" : " sits down"));
      return;
    }
    if (verb === "rest" || verb === "hangup") {
      f.pose = settled(f);
      f.arg = "";
      f.hold++;
      f.el.setAttribute("data-pose", f.pose);
      dress(f);
      if (verb === "hangup" && !instant) { host.removeAttribute("data-ring"); say(nameOf(who) + (who === "you" ? " hang up" : " hangs up")); }
      return;
    }
    if (instant) return; // the rest are moments, not states
    f.arg = arg || "";
    var you = who === "you";
    var n = nameOf(who);
    if (verb === "phone") {
      host.removeAttribute("data-ring");
      setPose(f, "phone", 0);
      say(n + (you ? " answer the phone" : " answers the phone"));
    } else if (verb === "write") {
      setPose(f, "write", HOLD.write);
      flag("writing", HOLD.write);
      say(n + (you ? " write in the log" : " writes in the log"));
    } else if (verb === "touch") {
      setPose(f, "touch", HOLD.touch);
      if (!arg && !away) {
        flag("touch", HOLD.touch);
        host.style.setProperty("--touch-x", (spotFor(f).x / 4) + "%");
      }
      say(n + (you ? " touch the " : " touches the ") + (arg || "screen"));
    } else if (verb === "point") {
      setPose(f, arg || away ? "pointside" : "point", HOLD.point);
      say(n + (you ? " point " : " points ") + (arg ? (away || arg === "ahead" ? arg : "at the " + arg) : "at the screen"));
    } else if (verb === "press") {
      setPose(f, "press", HOLD.press);
      if (arg === "panel") {
        host.removeAttribute("data-buzz");
        say(n + (you ? " press" : " presses") + " the silence button on the fire panel");
      } else {
        flag("press", HOLD.press);
        say(n + (you ? " press the door release" : " presses the door release"));
      }
    } else if (verb === "read") {
      setPose(f, "read", HOLD.read);
      flag("writing", HOLD.read);
      say(n + (you ? " read the log" : " reads the log"));
    } else if (verb === "eat") {
      setPose(f, "eat", HOLD.eat);
      say(n + (you ? " eat" : " eats"));
    } else if (verb === "spill") {
      setPose(f, "spill", HOLD.spill);
      flag("spill", 12000);
      say("Coffee spills across the desk");
    } else if (verb === "angry") {
      setPose(f, "angry", HOLD.angry);
      f.el.setAttribute("data-angry", "1");
      later(function () { f.el.removeAttribute("data-angry"); }, HOLD.angry);
      say(n + (you ? " get angry" : " gets angry"));
    } else if (verb === "knock") {
      setPose(f, "knock", HOLD.knock);
      flag("knock", HOLD.knock);
      say(n + " knocks twice on the wall");
    } else if (verb === "count") {
      setPose(f, "count", HOLD.count);
      flag("count", HOLD.count);
      say(n + (you ? " count the radios" : " counts the radios"));
    } else if (verb === "lean") {
      setPose(f, "lean", HOLD.lean);
      say(n + (you ? " lean in to the screen" : " leans in to the screen"));
    } else if (verb === "hand") {
      setPose(f, "hand", HOLD.hand);
      say(n + (you ? " hand it over" : " hands it over"));
    } else if (verb === "charger") {
      if (f.posture === "seated" && seatOf(who)) { f.posture = "standing"; f.spot = "right"; f.returnSeat = true; }
      setPose(f, "charger", f.returnSeat ? 0 : HOLD.charger);
      applyPos(f, false);
      if (f.returnSeat) { var tk = f.hold; later(function () { if (f.hold === tk && f.returnSeat) sitBack(f); }, HOLD.charger); }
      say(n + (you ? " put the radio on the charger" : " puts the radio on the charger"));
    } else if (verb === "drink") {
      setPose(f, "drink", HOLD.drink);
      say(n + (you ? " drink the coffee" : " drinks the coffee"));
    }
  }

  function roomAct(verb, instant) {
    if (instant) return;
    if (verb === "ring") { flag("ring", 3200); say("The phone rings"); }
    else if (verb === "buzz") { flag("buzz", 2600); say("The fire panel buzzes"); }
    else if (verb === "door") { door(1700); say("The door opens"); }
    else if (verb === "flicker") { flag("flicker", 900); say("The lights flicker"); }
  }

  function setPlace(place, instant) {
    if (!place || place === state.place) return;
    var toAway = !!AWAY[place];
    state.place = place;
    if (instant) { artEl.innerHTML = artFor(place); photoBase(); render(true); setClock(); return; }
    host.setAttribute("data-swap", "1");
    later(function () {
      artEl.innerHTML = artFor(place);
      photoBase();
      setClock();
      render(true);
      host.removeAttribute("data-swap");
    }, reduced ? 0 : 220);
    say(toAway ? "Out of the room, " + PLACES[place] : "Back " + PLACES[place]);
  }

  function dawn() {
    var h = state && state.time ? +state.time.slice(0, 2) : 0;
    return h >= 5 && h < 9;
  }

  function setClock() {
    var t = state && state.time ? state.time.split(":") : null;
    var svg = photoEl ? photoEl.querySelector(".room-clock svg") : artEl.querySelector("svg");
    if (!t || !svg) return;
    var hh = (+t[0] % 12) + (+t[1]) / 60, mm = +t[1];
    var h = svg.querySelector(".hand-h"), m = svg.querySelector(".hand-m");
    var pv = svg.parentNode && svg.parentNode.className === "room-clock" ? " 0 0)" : " 90 38)";
    if (h) h.setAttribute("transform", "rotate(" + (hh * 30) + pv);
    if (m) m.setAttribute("transform", "rotate(" + (mm * 6) + pv);
  }

  /* ---------------- the scene ---------------- */

  /** A line's beats, in the order the data gives them: { spec, at } (at 0 = as the line starts; a plain string has no `at`). */
  function actsOf(line) {
    if (!line || !line.act) return [];
    return (Array.isArray(line.act) ? line.act : [line.act]).map(function (a) {
      return typeof a === "string" ? { spec: a, at: 0 } : { spec: String(a.act), at: Math.max(0, Math.min(1, +a.at || 0)) };
    });
  }

  /** A scene opens: who is where, in which place. `def` = { id, time, place, look, cast, away, lines }. */
  function scene(def) {
    try {
      clearTimers();
      host.removeAttribute("data-door");
      ["ring", "buzz", "writing", "touch", "spill", "knock", "count", "flicker", "swap", "door-side"].forEach(function (k) { host.removeAttribute("data-" + k); });
      var cast = def.cast && def.cast.length ? def.cast : ["you", "dee"];
      var place = def.place || "room";
      state = { id: def.id, time: def.time, place: place, castList: cast, awayList: (def.away && def.away.length ? def.away : cast), lines: def.lines || [], at: -1, acted: {} };
      figsEl.innerHTML = '<svg class="figs-svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" focusable="false"><defs><clipPath id="rg-seatclip" clipPathUnits="userSpaceOnUse"><rect x="-80" y="-220" width="160" height="186"/></clipPath></defs><g class="chairs"></g><g class="figs"></g></svg>';
      figs = {};
      chairs = {};
      Object.keys(SEAT).forEach(function (w) {
        var c = document.createElementNS(NS, "g");
        c.setAttribute("class", "chair-seat");
        c.setAttribute("data-who", w);
        c.style.transform = "translate(" + SEAT[w] + "px," + ROOM_Y + "px) scale(" + ROOM_S + ")";
        c.innerHTML = '<g class="push">' + chair() + chairBack() + '</g>';
        figsEl.querySelector("g.chairs").appendChild(c);
        chairs[w] = c;
      });
      photoReset();
      artEl.innerHTML = artFor(place);
      photoBase();
      var spots = {};
      cast = cast.map(function (e) {
        var parts = String(e).split("@");
        if (parts[1]) spots[parts[0]] = parts[1];
        return parts[0];
      });
      state.castList = cast;
      state.awayList = state.awayList.map(function (e) { return String(e).split("@")[0]; });
      cast.concat(state.awayList).forEach(function (w) {
        var f = ensure(w);
        if (!f) return;
        var entry = String(w);
        f.present = true;
        var standing = !seatOf(entry) || !!spots[entry];
        f.posture = standing ? "standing" : "seated";
        f.spot = standing ? spots[entry] || "left" : "seat";
        f.pose = f.posture === "seated" ? "desk" : "rest";
      });
      // those who are not in the room's cast aren't in the room until something brings them in
      Object.keys(figs).forEach(function (k) { if (cast.indexOf(k) < 0) figs[k].present = false; });
      var order = [];
      cast.forEach(function (w) { if (!seatOf(w) && !spots[w] && figs[w]) { figs[w].spot = order.length ? "right" : "left"; order.push(w); } });
      setClock();
      lastAction = "";
      trail = [];
      if (actionEl) actionEl.textContent = "";
      render(true);
      host.setAttribute("aria-label", "Control room" + (AWAY[place] ? ", " + PLACES[place] : ""));
      if (AWAY[place]) say("Out of the room, " + PLACES[place]);
    } catch (e) { /* the story plays without the room */ }
  }

  /** Beats of earlier lines that have not happened yet happen now, with no motion (the line was skipped, or the next began). */
  function flushBeats() {
    var left = pending;
    pending = [];
    left.forEach(function (e) {
      clearTimeout(e.t);
      try { act(e.spec, true); } catch (e2) { /* the story plays without the room */ }
    });
  }

  /** The beats still to come in the line on stage happen now, in order and with their motion (the tests and the storyboard use it instead of waiting). */
  function runBeats() {
    try {
      var left = pending;
      pending = [];
      left.forEach(function (e) { clearTimeout(e.t); act(e.spec, false); });
    } catch (e) { /* the story plays without the room */ }
  }

  /** The line `i` starts: its place, then its acts; a beat with an `at` happens that fraction of the line's `dur` later. */
  function line(i, instant) {
    try {
      if (!state) return;
      var l = state.lines[i];
      state.at = i;
      flushBeats();
      if (!l) return;
      var beats = actsOf(l);
      state.acted[i] = beats.map(function (b) { return b.spec; });
      if (l.place) { setPlace(l.place, instant); state.acted[i].unshift("place:" + l.place); }
      var ms = (+l.dur > 0 ? +l.dur : 3) * 1000;
      beats.forEach(function (b) {
        if (instant || b.at <= 0) { act(b.spec, instant); return; }
        var e = { spec: b.spec };
        e.t = setTimeout(function () {
          pending = pending.filter(function (x) { return x !== e; });
          try { act(e.spec, false); } catch (e2) { /* the story plays without the room */ }
        }, Math.round(b.at * ms));
        pending.push(e);
        timers.push(e.t);
      });
    } catch (e) { /* the story plays without the room */ }
  }

  /** The first `n` lines were already heard (a resume, Skip): their states, with no motion. */
  function catchUp(n) {
    try {
      if (!state) return;
      for (var i = 0; i < n; i++) line(i, true);
      render(true);
    } catch (e) { /* the story plays without the room */ }
  }

  /** The person speaking now (a halo over them), or none. */
  function speaking(who) {
    try {
      Object.keys(figs).forEach(function (k) { figs[k].el.removeAttribute("data-speaking"); });
      Object.keys(poseWraps).forEach(function (k) { poseWraps[k].removeAttribute("data-speaking"); });
      if (who && figs[who] && figs[who].present) {
        figs[who].el.setAttribute("data-speaking", "1");
        if (poseWraps[who]) poseWraps[who].setAttribute("data-speaking", "1");
      }
    } catch (e) { /* nothing to show */ }
  }

  /** Somebody switches the screen (the picture is js/console.js's): the one at the desk reaches for the controls. */
  function switched(label, by) {
    try {
      if (!state || placeIsAway()) { say("The screen shows " + label); return; }
      var who = by && figs[by] && figs[by].present ? by : (figs.dee && figs.dee.present && figs.dee.posture === "seated" ? "dee" : (figs.you && figs.you.present ? "you" : null));
      if (!who) { say("The screen shows " + label); return; }
      var f = figs[who];
      if (f.pose === "rest" || f.pose === "desk") setPose(f, "console", HOLD.console);
      flag("switching", 600);
      say(nameOf(who) + (who === "you" ? " switch" : " switches") + " the screen to " + label);
    } catch (e) { /* nothing to show */ }
  }

  function view() {
    var away = state ? placeIsAway() : false;
    var o = { place: state ? state.place : null, look: state ? (looksColor() ? "color" : "sil") : null, mode: state ? (away ? "away" : "room") : null, action: lastAction, said: trail.slice(), acted: state ? Object.keys(state.acted).map(Number).sort(function (a, b) { return a - b; }).reduce(function (all, k) { return all.concat(state.acted[k]); }, []) : [], line: state ? state.at : -1, actors: {} };
    Object.keys(figs).forEach(function (k) {
      var f = figs[k];
      o.actors[k] = { present: f.present, shown: !!state && here(f), posture: f.posture, spot: f.spot, pose: f.pose };
    });
    o.photo = photoView();
    return o;
  }

  function close() {
    clearTimers();
    state = null;
    photoReset();
    figs = {};
    figsEl.innerHTML = "";
    artEl.innerHTML = "";
  }

  window.iltvRoom = {
    scene: scene,
    line: line,
    catchUp: catchUp,
    runBeats: runBeats,
    speaking: speaking,
    switched: switched,
    view: view,
    close: close,
    useStage: loadStage,
    verbs: VERBS.slice(),
    places: Object.keys(PLACES),
    actors: Object.keys(LOOKS),
  };
})();
