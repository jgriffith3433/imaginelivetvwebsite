// Gated choices in the video player (js/game.js), in jsdom, no browser: for every choice of a clip story whose gate
// `requires` flags (a row's [7], e.g. Trust Fall's "Wait. ARGUS promised" and "Say thank you to ARGUS", which need
// `believed`), the home page is loaded with a saved run that came with the flags and one that came without, and the
// player must offer the choice on the first and leave it out (not locked, not there) on the second.
// Run: npm run test:gates (exits 1 on a failure).
import { JSDOM, ResourceLoader, VirtualConsole } from "jsdom";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/story-data.js"), "utf8"), ctx);
const STORIES = ctx.window.ILTV_STORIES.stories.filter((s) => s.type !== "console");

class Files extends ResourceLoader {
  fetch(url) {
    const u = new URL(url);
    if (u.hostname !== "localhost") return Promise.resolve(Buffer.from(""));
    const p = path.join(ROOT, decodeURIComponent(u.pathname));
    return Promise.resolve(fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p) : Buffer.from(""));
  }
}

const flagsOf = (st, way) => {
  const out = {};
  for (let i = 0; i + 1 < way.length; i++) {
    const c = st.scenes[way[i]].choices.find((x) => x[2] === way[i + 1]);
    if (c && c[4]) Object.assign(out, c[4]);
  }
  return out;
};
const holds = (want, flags) => Object.entries(want || {}).every(([k, v]) => (flags[k] === undefined ? false : flags[k]) === v);

/** The shortest way (never through a death) to `target` whose flags pass `ok`, taking a gated choice only when it holds. */
function wayTo(st, target, ok) {
  const queue = [[st.start]];
  const seen = new Set();
  while (queue.length) {
    const way = queue.shift();
    const id = way[way.length - 1];
    const flags = flagsOf(st, way);
    const key = `${id} ${JSON.stringify(flags)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (id === target && ok(flags)) return way;
    if (st.scenes[id].dead || st.scenes[id].ending || way.length > 30) continue;
    for (const c of st.scenes[id].choices) if (st.scenes[c[2]] && holds(c[7] && c[7].requires, flags)) queue.push([...way, c[2]]);
  }
  return null;
}

/** The player opened at the end of `way` (the saved run a viewer who came that way has): the choices it offers. */
async function offered(st, way) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), {
    url: `http://localhost/?story=${st.id}`,
    runScripts: "dangerously",
    resources: new Files(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.document.cookie = `${st.cookie}=${encodeURIComponent(JSON.stringify({ scene: way[way.length - 1], history: way.slice(0, -1) }))}; Path=/`;
      w.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
      w.HTMLMediaElement.prototype.play = () => Promise.resolve();
      w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLMediaElement.prototype.load = () => {};
    }
  });
  const w = dom.window;
  const until = Date.now() + 8000;
  while (Date.now() < until && !(w.finalSpark && w.finalSpark.scene() === way[way.length - 1])) await new Promise((r) => setTimeout(r, 100));
  const out = {
    scene: w.finalSpark ? w.finalSpark.scene() : null,
    shown: w.finalSpark ? w.finalSpark.offered().map((o) => o.index) : [], // data indexes: two choices may share a next scene
    locked: [...w.document.querySelectorAll("#spark-choices .choice-locked")].map((el) => el.textContent),
    errors
  };
  w.close();
  return out;
}

let failed = 0, checked = 0;
const fail = (msg) => { failed++; console.log(`FAIL ${msg}`); };
for (const st of STORIES) {
  for (const sid of Object.keys(st.scenes)) {
    for (const [index, c] of st.scenes[sid].choices.entries()) {
      const req = c[7] && c[7].requires;
      if (!req) continue;
      checked++;
      const before = failed;
      const name = `${st.id}/${sid} "${c[1]}" (needs ${JSON.stringify(req)})`;
      const yes = wayTo(st, sid, (f) => holds(req, f));
      const no = wayTo(st, sid, (f) => !holds(req, f));
      if (!yes) { fail(`${name}: no way arrives with what it needs`); continue; }
      const a = await offered(st, yes);
      if (a.scene !== sid) fail(`${name}: the saved run opened ${a.scene}, not ${sid}`);
      else if (!a.shown.includes(index)) fail(`${name}: by ${yes.join(" > ")} it isn't offered (choices ${a.shown.join(", ")})`);
      a.errors.forEach((e) => fail(`${name}: ${e}`));
      if (no) {
        const b = await offered(st, no);
        if (b.scene !== sid) fail(`${name}: the saved run opened ${b.scene}, not ${sid}`);
        else if (b.shown.includes(index)) fail(`${name}: by ${no.join(" > ")} it is offered without what it needs`);
        else if (b.locked.some((text) => text.includes(c[1]))) fail(`${name}: without what it needs a locked row shows (it should not be there at all)`);
        b.errors.forEach((e) => fail(`${name}: ${e}`));
      }
      if (failed === before) console.log(`ok   ${name}: offered by ${yes.join(" > ")}${no ? `; left out by ${no.join(" > ")}` : ""}`);
    }
  }
}
console.log(`${checked} gated choice(s), ${failed} failure(s)`);
process.exit(failed || !checked ? 1 : 0);
