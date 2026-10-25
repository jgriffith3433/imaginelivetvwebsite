/* The rules of a console story (story type "console", story doc: story/README.md "Console stories").

   One copy of the state rules, run by the player (js/console.js), the build (tools/build-story.mjs, which uses
   explore() to check every story) and the playtest (js/playtest.js, which walks the same state space).

   A story's state is { flags: { name: true }, meters: { name: n } }. A choice in the data is
   [say, en, next, extra]; extra (all optional):
     requires: [flag]            all must be set          forbids: [flag]   none may be set
     meters:   { name: { min, max } }   the meter must be inside the range (inclusive)
     set: [flag]  clear: [flag]  add: { meter: n }   what choosing it does (meters stay inside their range)
     log: "text"                 an extra line for the shift log        cosmetic: "why"   no state effect on purpose

   ES5 apart from the two generators (exploreSteps, lengthSteps) that let the playtest work the big stories out in
   slices; the same file loads in the browser and in node (globalThis.iltvConsoleRules). */
(function (root) {
  "use strict";

  function has(list, name) {
    return !!list && list.indexOf(name) >= 0;
  }

  function extraOf(choice) {
    return choice[3] || {};
  }

  /** The state a run starts with. */
  function fresh(story) {
    var meters = {};
    var defs = (story.state && story.state.meters) || {};
    Object.keys(defs).forEach(function (name) {
      meters[name] = defs[name].start || 0;
    });
    return { flags: {}, meters: meters };
  }

  function clone(state) {
    var flags = {};
    var meters = {};
    Object.keys(state.flags).forEach(function (k) { flags[k] = true; });
    Object.keys(state.meters).forEach(function (k) { meters[k] = state.meters[k]; });
    return { flags: flags, meters: meters };
  }

  /** Can the choice be made in this state? */
  function usable(choice, state) {
    var x = extraOf(choice);
    var i;
    var req = x.requires || [];
    for (i = 0; i < req.length; i++) if (!state.flags[req[i]]) return false;
    var forb = x.forbids || [];
    for (i = 0; i < forb.length; i++) if (state.flags[forb[i]]) return false;
    var ranges = x.meters || {};
    var names = Object.keys(ranges);
    for (i = 0; i < names.length; i++) {
      var v = state.meters[names[i]] || 0;
      var r = ranges[names[i]];
      if (r.min != null && v < r.min) return false;
      if (r.max != null && v > r.max) return false;
    }
    return true;
  }

  /** The state after making the choice (a new object). */
  function apply(story, state, choice) {
    var x = extraOf(choice);
    var next = clone(state);
    (x.set || []).forEach(function (f) { next.flags[f] = true; });
    (x.clear || []).forEach(function (f) { delete next.flags[f]; });
    var defs = (story.state && story.state.meters) || {};
    Object.keys(x.add || {}).forEach(function (name) {
      var d = defs[name] || {};
      var v = (next.meters[name] || 0) + x.add[name];
      if (d.max != null) v = Math.min(d.max, v);
      v = Math.max(d.min != null ? d.min : 0, v);
      next.meters[name] = v;
    });
    return next;
  }

  /** The state as one string (what makes two runs the same state). */
  function stateKey(state) {
    return Object.keys(state.flags).sort().join(",") + "|" + Object.keys(state.meters).sort().map(function (k) { return k + "=" + state.meters[k]; }).join(",");
  }

  /** The feeds a scene shows: { camera: state }, every camera on "normal" unless the scene says. */
  function feedsOf(story, scene) {
    var out = {};
    (story.cameras || []).forEach(function (c) {
      out[c.id] = (scene.feeds && scene.feeds[c.id]) || "normal";
    });
    return out;
  }

  /** Every state the story can be in, breadth first from the start (so the first state found at a scene is on its
      shortest way). Returns
        scenes:   { id: { state, path: [scene ids], picks: [choice indexes] } }   the shortest way to each scene
        variants: { id: { "open choices": { state, path, picks, open } } }       one way per different set of open choices
        stuck:  [{ scene, state, path }]       non-ending scenes where, in some reachable state, no choice is usable
        used:   { "scene#i": { usable, changes, branch } }   what each choice does across all reachable states
        cosmetic: [{ scene, path }]            a path with more than `maxCosmetic` cosmetic choices
        capped: true if the search stopped at `cap` states (then nothing is proved unreachable) */
  function* exploreSteps(story, opts) {
    opts = opts || {};
    var cap = opts.cap || 50000;
    var maxCosmetic = opts.maxCosmetic == null ? 2 : opts.maxCosmetic;
    var out = { scenes: {}, variants: {}, stuck: [], used: {}, cosmetic: [], capped: false, states: 0 };
    var start = story.start;
    var first = fresh(story);
    var seen = {};
    var queue = [{ id: start, state: first, path: [start], picks: [], cos: 0 }];
    seen[start + "#" + stateKey(first) + "#0"] = true;
    var stuckSeen = {};
    var cosSeen = {};
    while (queue.length) {
      var at = queue.shift();
      out.states++;
      if ((out.states & 255) === 0) yield { states: out.states, queued: queue.length };
      var scene = story.scenes[at.id];
      if (!scene) continue;
      if (!out.scenes[at.id]) {
        out.scenes[at.id] = { state: at.state, path: at.path, picks: at.picks };
      }
      var open = [];
      scene.choices.forEach(function (c, i) { if (usable(c, at.state)) open.push(i); });
      // One way to each different set of open choices (a gated choice shows in one and not in another).
      var vs = out.variants[at.id] || (out.variants[at.id] = {});
      if (!vs[open.join()]) vs[open.join()] = { state: at.state, path: at.path, picks: at.picks, open: open };
      if (!scene.ending && !open.length && !stuckSeen[at.id + stateKey(at.state)]) {
        stuckSeen[at.id + stateKey(at.state)] = true;
        out.stuck.push({ scene: at.id, state: at.state, path: at.path });
      }
      open.forEach(function (i) {
        var c = scene.choices[i];
        var x = extraOf(c);
        var after = apply(story, at.state, c);
        var u = out.used[at.id + "#" + i] || (out.used[at.id + "#" + i] = { usable: true, changes: false, branch: false });
        if (stateKey(after) !== stateKey(at.state)) u.changes = true;
        // A real branch: it goes somewhere no other choice open here goes.
        var same = open.filter(function (j) { return j !== i && scene.choices[j][2] === c[2]; }).length;
        if (!same && c[2] !== at.id) u.branch = true;
        var cos = at.cos + (x.cosmetic ? 1 : 0);
        if (cos > maxCosmetic && !cosSeen[at.id + "#" + i]) {
          cosSeen[at.id + "#" + i] = true;
          out.cosmetic.push({ scene: at.id, path: at.path.concat(c[2]) });
        }
        var k = c[2] + "#" + stateKey(after) + "#" + Math.min(cos, maxCosmetic + 1);
        if (seen[k]) return;
        if (out.states + queue.length >= cap) {
          out.capped = true;
          return;
        }
        seen[k] = true;
        queue.push({ id: c[2], state: after, path: at.path.concat(c[2]), picks: at.picks.concat(i), cos: cos });
      });
    }
    return out;
  }

  /** The same search, all at once. */
  function explore(story, opts) {
    var it = exploreSteps(story, opts);
    for (var r = it.next(); !r.done; r = it.next());
    return r.value;
  }

  /** The same search in slices: it hands the thread back (`tick()`, a macrotask) whenever `sliceMs` of work has gone by
      and says how far it is through `onProgress({ states, queued })`. Same result as explore(). */
  async function exploreAsync(story, opts, run) {
    return drive(exploreSteps(story, opts), run);
  }

  async function drive(it, run) {
    run = run || {};
    var sliceMs = run.sliceMs == null ? 30 : run.sliceMs;
    var now = run.now || function () { return Date.now(); };
    var tick = run.tick || function () { return new Promise(function (ok) { setTimeout(ok, 0); }); };
    var from = now();
    for (var r = it.next(); !r.done; r = it.next()) {
      if (run.onProgress) run.onProgress(r.value);
      if (now() - from >= sliceMs) {
        await tick();
        from = now();
      }
    }
    return r.value;
  }

  /** How long each way through a story is to listen to: the shortest, the longest and the mean (every open choice
      equally likely). A line is its `dur` plus the player's 0.35 s gap. */
  function* lengthSteps(story) {
    var dur = {};
    Object.keys(story.scenes).forEach(function (id) {
      dur[id] = story.scenes[id].lines.reduce(function (a, l) { return a + (l.dur || 0) + 0.35; }, 0);
    });
    var memo = new Map();
    var work = 0;
    function* go(id, state) {
      var key = id + "#" + stateKey(state);
      if (memo.has(key)) return memo.get(key);
      if ((++work & 255) === 0) yield { states: memo.size };
      var open = [];
      story.scenes[id].choices.forEach(function (c, i) { if (usable(c, state)) open.push([c, i]); });
      var r;
      if (!open.length) r = { min: dur[id], max: dur[id], mean: dur[id] };
      else {
        var next = [];
        for (var k = 0; k < open.length; k++) {
          var sub = yield* go(open[k][0][2], apply(story, state, open[k][0]));
          next.push(Object.assign({ i: open[k][1] }, sub));
        }
        var lo = next.reduce(function (a, b) { return b.min < a.min ? b : a; });
        var hi = next.reduce(function (a, b) { return b.max > a.max ? b : a; });
        r = { min: dur[id] + lo.min, max: dur[id] + hi.max, mean: dur[id] + next.reduce(function (a, b) { return a + b.mean; }, 0) / next.length, lo: lo.i, hi: hi.i };
      }
      memo.set(key, r);
      return r;
    }
    function* wayOf(which) {
      var id = story.start;
      var state = fresh(story);
      var picks = [];
      for (;;) {
        var r = yield* go(id, state);
        var i = which === "lo" ? r.lo : r.hi;
        if (i == null) return picks;
        picks.push(i);
        var c = story.scenes[id].choices[i];
        state = apply(story, state, c);
        id = c[2];
      }
    }
    var top = yield* go(story.start, fresh(story));
    var shortestWay = yield* wayOf("lo");
    var longestWay = yield* wayOf("hi");
    return { dur: dur, shortest: top.min, longest: top.max, mean: top.mean, shortestWay: shortestWay, longestWay: longestWay, states: memo.size };
  }

  function lengths(story) {
    var it = lengthSteps(story);
    for (var r = it.next(); !r.done; r = it.next());
    return r.value;
  }

  async function lengthsAsync(story, run) {
    return drive(lengthSteps(story), run);
  }

  var api = {
    fresh: fresh,
    clone: clone,
    usable: usable,
    apply: apply,
    stateKey: stateKey,
    feedsOf: feedsOf,
    explore: explore,
    exploreAsync: exploreAsync,
    lengths: lengths,
    lengthsAsync: lengthsAsync,
    extraOf: extraOf,
    has: has,
  };
  root.iltvConsoleRules = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
