// Trust Fall's clips are wired into the data and the pages (J, 2026-11-14: PR #244's conflict pass ran `npm run story` in a
// sparse checkout, which cannot see clips on disk, and blanked every scene's video). Files only, no browser:
//  - every scene whose trust-fall/<folder>/scene.mp4 git tracks has a non-null video, a poster and a small in js/story-data.js,
//    each pointing at a file git tracks, and a voice.narr (one voice at a time), and its page plays a <video> (no passage-blank);
//  - the scenes that had voice.narr when the clips were first wired keep it.
// Run: npm run test:trust-fall (exits 1 on a failure). Reads `git ls-files`, so it works in a sparse checkout.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tracked = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, maxBuffer: 1 << 28 }).toString().split("\0"));
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/story-data.js"), "utf8"), ctx);
const story = ctx.window.ILTV_STORIES.stories.find((s) => s.id === "trust-fall");

// Scenes that had voice.narr at 02de55f^1 (the 14 clips of #228-#243) and the six clips #244 made: all must keep it.
const NARRATED = ["first-light", "the-plug", "how-it-knows", "the-garage", "whats-inside", "the-river", "the-tower", "lights-out",
  "what-it-knows", "the-bait", "the-vault", "sixty-seconds", "on-the-air", "the-green-line",
  "the-bridge", "the-promise", "morning-edition", "live", "unseen", "good-morning"];

let bad = 0, withClip = 0;
const fail = (m) => { bad++; console.log(`FAIL ${m}`); };
const local = (u) => u.replace(/^\//, "");
for (const [id, s] of Object.entries(story.scenes)) {
  const name = s.folder.split("/").pop();
  if (!tracked.has(`${s.folder}/scene.mp4`)) {
    if (NARRATED.includes(name)) fail(`${id} (${name}): expected a clip in git`);
    continue;
  }
  withClip++;
  for (const key of ["video", "poster", "small"]) {
    if (!s[key]) fail(`${id} (${name}): ${s.folder}/scene.mp4 is in git but story-data has no ${key}`);
    else if (!tracked.has(local(s[key]))) fail(`${id} (${name}): ${key} ${s[key]} is not a tracked file`);
  }
  if (!(s.voice && s.voice.narr > 0)) fail(`${id} (${name}): no voice.narr`);
  const page = fs.readFileSync(path.join(ROOT, s.folder, "index.html"), "utf8");
  if (!/<video[^>]*data-src="[^"]*scene\.mp4"/.test(page) || page.includes("passage-blank")) fail(`${id} (${name}): its page has no <video>`);
}
for (const name of NARRATED) {
  const hit = Object.values(story.scenes).find((s) => s.folder === `trust-fall/${name}`);
  if (!hit) fail(`${name}: not in story-data`);
  else if (!(hit.voice && hit.voice.narr > 0)) fail(`${name}: lost voice.narr`);
}
console.log(`${withClip} scenes with a clip checked, ${bad ? bad + " problems" : "all wired"}`);
process.exit(bad ? 1 : 0);
