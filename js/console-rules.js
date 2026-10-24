/* The rules of a console story (story type "console", story doc: story/README.md "Console stories").

   One copy of the state rules, run by the player (js/console.js), the build (tools/build-story.mjs, which uses
   explore() to check every story) and the playtest (js/playtest.js, which walks the same state space).

   A story's state is { flags: { name: true }, meters: { name: n } }. A choice in the data is
   [say, en, next, extra]; extra (all optional):
     requires: [flag]            all must be set          forbids: [flag]   none may be set
     meters:   { name: { min, max } }   the meter must be inside the range (inclusive)
     set: [flag]  clear: [flag]  add: { meter: n }   what choosing it does (meters stay inside their range)
     log: "text"                 an extra line for the shift log        cosmetic: "why"   no state effect on purpose

   Plain ES5 so the same file loads in the browser and in node (globalThis.iltvConsoleRules). */
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
        scenes: { id: { state, path: [scene ids], choices: [indexes usable in that first state] } }
        stuck:  [{ scene, state, path }]       non-ending scenes where, in some reachable state, no choice is usable
        used:   { "scene#i": { usable, changes, branch } }   what each choice does across all reachable states
        cosmetic: [{ scene, path }]            a path with more than `maxCosmetic` cosmetic choices
        capped: true if the search stopped at `cap` states (then nothing is proved unreachable) */
  function explore(story, opts) {
    opts = opts || {};
    var cap = opts.cap || 50000;
    var maxCosmetic = opts.maxCosmetic == null ? 2 : opts.maxCosmetic;
    var out = { scenes: {}, stuck: [], used: {}, cosmetic: [], capped: false, states: 0 };
    var start = story.start;
    var first = fresh(story);
    var seen = {};
    var queue = [{ id: start, state: first, path: [start], cos: 0 }];
    seen[start + "#" + stateKey(first) + "#0"] = true;
    var stuckSeen = {};
    var cosSeen = {};
    while (queue.length) {
      var at = queue.shift();
      out.states++;
      var scene = story.scenes[at.id];
      if (!scene) continue;
      if (!out.scenes[at.id]) {
        out.scenes[at.id] = { state: at.state, path: at.path, choices: [] };
        scene.choices.forEach(function (c, i) { if (usable(c, at.state)) out.scenes[at.id].choices.push(i); });
      }
      var open = [];
      scene.choices.forEach(function (c, i) { if (usable(c, at.state)) open.push(i); });
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
        queue.push({ id: c[2], state: after, path: at.path.concat(c[2]), cos: cos });
      });
    }
    return out;
  }

  var api = {
    fresh: fresh,
    clone: clone,
    usable: usable,
    apply: apply,
    stateKey: stateKey,
    feedsOf: feedsOf,
    explore: explore,
    extraOf: extraOf,
    has: has,
  };
  root.iltvConsoleRules = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
