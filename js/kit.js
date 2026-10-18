/* A story's own inventory (story doc: story/README.md, "A story's inventory"): the items in its data
   (`inventory.items`: a revolver, its bullets, a flask...) and what each scene does to them (`inventory` on a
   scene: { "water": -1 } takes one, { "water": { "set": 4 } } fills it). The counts at a scene are worked out from
   the way you came: the start, then every scene since (the player's history, so Back and a saved place give the
   same counts); coming back to the start starts them over.

   The same file runs in three places: the home page's player (js/game.js calls iltvKit.show), a story's branch
   pages (the build writes <div class="inventory kit" data-kit="..."> with the counts on the shortest way there) and
   the build itself (tools/build-story.mjs imports it for counts() and its checks). The Final Spark has no
   `inventory`: its inventory is the flashlight (js/spot.js). */
(function (root) {
  var ICONS = {
    revolver:
      // A Colt Single Action Army from the side: barrel and front sight, ejector rod, cylinder, hammer, grip, trigger guard.
      '<svg viewBox="0 0 48 28" aria-hidden="true"><g fill="currentColor"><path d="M20 6H45V4.5h1.5V10H20z"/><path d="M22 10h15v2H22z"/><path d="M12 5h9v10h-9z"/><path d="M12 6L9 2l2-.5L14 5z"/><path d="M12 13c-3 4-6 8-6.5 13l6 1c.5-5 2.5-9 5-12z" fill="#8a5a33"/></g><path d="M14 7.5h5v1h-5zM14 10.5h5v1h-5z" fill="#17140f"/><path d="M15 15c0 5 5 5 5 0M17.2 15l-.6 3" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
    rounds:
      '<svg viewBox="0 0 12 28" aria-hidden="true"><rect x="2" y="9" width="8" height="17" rx="1" fill="currentColor"/><path d="M2 10c0-5 2-8 4-9 2 1 4 4 4 9z" fill="#b8874a"/><rect x="1" y="24" width="10" height="3" rx="1" fill="currentColor"/></svg>',
    flask:
      '<svg viewBox="0 0 28 36" aria-hidden="true"><defs><clipPath id="kit-flask-clip"><path d="M10 2h8v6c5 2 8 6 8 12 0 8-5 14-12 14S2 28 2 20c0-6 3-10 8-12z"/></clipPath></defs><path d="M10 2h8v6c5 2 8 6 8 12 0 8-5 14-12 14S2 28 2 20c0-6 3-10 8-12z" fill="#1b1d20" stroke="currentColor" stroke-width="1.6"/><rect class="kit-flask-water" x="0" y="34" width="28" height="0" clip-path="url(#kit-flask-clip)" fill="#5aa6c8"/></svg>'
  };

  function isSet(change) {
    return !!change && typeof change === "object" && typeof change.set === "number";
  }

  /** The counts at the start: every item with a `start`. */
  function fresh(def) {
    var counts = {};
    (def.items || []).forEach(function (item) {
      if (typeof item.start === "number") counts[item.id] = item.start;
    });
    return counts;
  }

  /** What a scene does to the counts: { counts (kept between 0 and each item's max), raw (before that) }. */
  function apply(def, counts, scene) {
    var raw = {};
    var out = {};
    var changes = (scene && scene.inventory) || {};
    (def.items || []).forEach(function (item) {
      if (!(item.id in counts)) return;
      var change = changes[item.id];
      var value = counts[item.id];
      if (isSet(change)) value = change.set;
      else if (typeof change === "number") value += change;
      raw[item.id] = value;
      var max = typeof item.max === "number" ? item.max : Infinity;
      out[item.id] = Math.max(0, Math.min(max, value));
    });
    return { counts: out, raw: raw };
  }

  /** The counts after walking `path` (scene ids, the start first), in `scenes` (id -> scene). */
  function counts(def, scenes, start, path) {
    var now = fresh(def);
    (path || []).forEach(function (id) {
      if (id === start) now = fresh(def);
      if (scenes[id]) now = apply(def, now, scenes[id]).counts;
    });
    return now;
  }

  function esc(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** The bar's items as HTML: an icon, a name, and a count for the items that have one. */
  function html(def, now) {
    return '<p class="inventory-label">' + esc(def.label || "Inventory") + "</p>" +
      '<div class="kit-items">' +
      (def.items || []).map(function (item) {
        var has = item.id in now;
        var n = has ? now[item.id] : null;
        var max = typeof item.max === "number" ? item.max : null;
        var label = item.name + (has ? ": " + n + (max != null ? " of " + max : "") : "");
        var icon = ICONS[item.icon] || "";
        var body;
        if (item.icon === "rounds" && max != null) {
          var pips = "";
          for (var i = 0; i < max; i++) pips += '<span class="kit-round' + (i < n ? "" : " is-spent") + '">' + icon + "</span>";
          body = '<span class="kit-rounds">' + pips + "</span>";
        } else body = '<span class="kit-icon">' + icon + "</span>";
        return '<span class="kit-item kit-' + esc(item.icon || "item") + '" data-item="' + esc(item.id) + '"' +
          (has ? ' data-count="' + n + '"' : "") + ' role="img" aria-label="' + esc(label) + '" title="' + esc(item.note || item.name) + '">' +
          body +
          '<span class="kit-name">' + esc(item.name) + "</span>" +
          (has ? '<span class="kit-count">' + n + (max != null ? "/" + max : "") + "</span>" : "") +
          "</span>";
      }).join("") +
      "</div>";
  }

  /** Fills the flask's water to its count. */
  function level(bar, def, now) {
    (def.items || []).forEach(function (item) {
      if (item.icon !== "flask" || !(item.id in now)) return;
      var water = bar.querySelector('[data-item="' + item.id + '"] .kit-flask-water');
      if (!water) return;
      var max = typeof item.max === "number" && item.max > 0 ? item.max : 1;
      var h = Math.round((26 * now[item.id]) / max);
      water.setAttribute("y", String(34 - h));
      water.setAttribute("height", String(h));
    });
  }

  function render(bar, def, now) {
    bar.innerHTML = html(def, now);
    level(bar, def, now);
  }

  var bar = null;
  /** The player (js/game.js): the open story's inventory with these counts, or none (def null). */
  function show(def, now) {
    if (typeof document === "undefined") return;
    if (!def) {
      if (bar) bar.replaceChildren();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "inventory kit";
      document.body.appendChild(bar);
    }
    render(bar, def, now);
  }

  root.iltvKit = { icons: Object.keys(ICONS), fresh: fresh, apply: apply, counts: counts, html: html, show: show };

  // A branch page: the build wrote the story's items and the counts into the bar.
  if (typeof document !== "undefined") {
    var ready = function () {
      document.querySelectorAll(".inventory.kit[data-kit]").forEach(function (el) {
        try {
          var data = JSON.parse(el.getAttribute("data-kit"));
          render(el, data.inventory, data.counts);
        } catch (error) {
          // A broken bar stays empty; the page still plays.
        }
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
    else ready();
  }
})(typeof window !== "undefined" ? window : globalThis);
