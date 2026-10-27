/* The build these pages are, for Hawkes Analytics (AGENTS.md "Analytics"). Loaded right before
   Gen's analytics SDK on every page people see. The HAWKES_BUILD line is written by `npm run stamp`
   (tools/stamp-build.mjs): don't edit it by hand. */
window.HAWKES_BUILD = {"version":"1.7.0","commit":"010595e539","date":"2026-10-26T18:30:39Z"};

(function () {
  var framed = false;
  try {
    // A page of this site inside a frame of this site is the playtest's frame (js/playtest.js): the home page's
    // own analytics already counts that run, and a second copy in the frame would share its session.
    framed = window.top !== window && window.top.location.host === location.host;
  } catch (e) { /* a frame on another site: count it */ }
  if (framed) {
    var off = { version: 1, debugLog: [], framed: true };
    ["init", "config", "track", "screen", "setContext", "loadStart", "ready", "levelStart", "levelEnd", "death", "choice",
      "feature", "video", "feedback", "error", "optOut", "optIn", "internal", "flush"].forEach(function (m) { off[m] = function () {}; });
    off.ask = function () { return Promise.resolve(null); };
    window.hawkesAnalytics = off; // Gen's SDK sees it and stays out
    return;
  }
  try {
    var q = new URLSearchParams(location.search);
    // A playtest bot's tab logs what it sends (the SDK's debug mode), so a playtest can show the events going out.
    if ((navigator.webdriver || q.get("playtest")) && !q.get("hawkes-analytics-debug")) {
      q.set("hawkes-analytics-debug", "1");
      history.replaceState(history.state, "", location.pathname + "?" + q.toString() + location.hash);
    }
  } catch (e) { /* never break the page */ }
})();
