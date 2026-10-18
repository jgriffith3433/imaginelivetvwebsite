# Imagine Live TV website — agent notes

The site for **Imagine Live TV** (imaginelivetv.com), static on GitHub Pages. In the Hawkes Biomedical line
it is sold as *live medical education*. It is a home for choose-your-path video stories: the home page is the
landing page (a card per story, from `story/stories.json`), and choosing one opens its player on the same page
(`/?story=<id>`). The first is **The Final Spark**: you wake in a sewer, found by a rat, and each choice is a page
with a video (one folder per branch at the site root, e.g. `you-turned-right/`; other stories' pages go under
`/<id>/`). Plus a blog. Planning notes and the decision tree are in `C:\Projects\TheFinalSpark`.
Local dev: `auto-start.bat` (http://localhost:8090). Publishing is pushing to `main`: ask J first.

## Generative AI: Hawkes Gen

Images, textures, video, 3D, music, voice, sound and Claude all go through **Hawkes Gen**
(`C:\Projects\hawkesgen`, dashboard http://127.0.0.1:8790; start it with `hawkesgen\auto-start.bat`). It holds
the API and AWS keys and runs the shared GPU fleet. This project never holds those keys.

- **Agents:** the `hawkesgen` MCP server is in this folder's `.mcp.json`. Use `hawkesgen_presets` (project
  `imaginelivetv`) for the art direction, then `hawkesgen_run`.
- **Command line:** `C:\Projects\hawkesgen\hawkesgen.cmd run - --project imaginelivetv --preset <name> --param prompt="..." --out <folder>`
- **Art direction:** `hawkesgen/presets/imaginelivetv.json` (style line and named presets). Edit it there.
- **Code:** copy `hawkesgen/clients/js/hawkesgen.mjs` into `tools/` and use `new HawkesGen({ project: 'imaginelivetv' })`.
- GPU tools cost money while a server runs. Ask J before starting servers or running big batches.

## Playtests

The site implements the Hawkes playtest contract v1 (spec: `C:\Projects\hawkesstudio\docs\playtest.md`), so the
daily runner in Hawkes Gen can play it. `js/hawkes-playtest.js` is a copy of the shared helper (source of truth:
`hawkesstudio/clients/web/hawkes-playtest.js`); the scenarios are in `js/playtest.js`, loaded by the home page only.
Nothing runs until the runner calls `window.hawkesPlaytest.start()` or the URL has `?playtest=<id>`.

Everything runs from the home page, so a run never has to survive a page load. The landing page and the player
(`js/game.js`) are on the home page: the bot opens a story by tapping its card, and goes back with "All stories". Branch pages and blog posts open in a full-screen frame laid over it during the run, and the bot clicks
the links inside it, the way a viewer would. The frame is removed when the run ends, and the player's saved
progress cookie is put back.

| Scenario | What it does |
| --- | --- |
| `smoke` (~8 s) | The landing page shows its cards; The Final Spark's card opens it; back to the start (Tree tab, start node), the first video loads and plays 3 s, the choices show, one choice in, Back, then All stories. |
| `stories` (~20 s) | The landing page has a card for every listed story in `story/stories.json`, in order (title, logline, an image that loads) and none for unlisted ones. Each card opens its story (title, `?story=<id>`, first page's text, video, choices); All stories brings the landing back with the video gone; each story's own link `/<id>/` opens straight into it with its own Tap to play title. |
| `branches` (~90 s) | Opens every listed story from its card and walks every scene by clicking every choice and Back. Each video must load (readyState, duration) and play 2 s. Checks every scene is reachable, that non-ending scenes have choices, and that The Final Spark's opening matches `TheFinalSpark/Decision tree.txt` (the `TREE` table in `js/playtest.js`). |
| `pages` (~30 s) | Every story's branch pages (one folder per scene, read from `js/story-data.js`, so new stories and scenes need no change here), crawled from each story's start page. Each page's video loads and plays, and each choice links to a page that exists. Reports dead ends, orphan pages and a missing `/<id>/` link. |
| `sound` (~45 s) | Every prompt's line ("Sound on."/"Sound off.") is checked against the saved setting (`tap-note` events, in every scenario). The studio's standard sound setup (`js/hawkes-sound.js`): the Tap to play prompt covers the screen, a hit-tested press on it unlocks sound, The Final Spark's card opens it and the video plays unmuted (and the next scene's after a choice); Settings (header gear) Sound off + Volume 40% are saved in `localStorage["hawkes.sound"]`, the page reloads (the run carries on through `?playtest=sound`) straight back into The Final Spark (`?story=final-spark`, its prompt title), the choice is back and applied, then a branch page's prompt and video. |
| `blog` (~5 s) | Opens every post card from the home page: the page exists, its images load, its videos play, its local links resolve. |
| `credits` (~14 s) | Every page's footer says "Powered by HAWKES GEN" linking to https://hawkesgen.com, and the home page's links to the parent company, https://hawkesbiomedical.com (each visible and hit-tested). Checks the home page (landing, then with The Final Spark open), a blog post, the start's branch page and What's new, and that nothing lies over the story video. Before the first tap it turns Sound off from the prompt's own Settings button, so the prompt's line must say "Sound off.", and so must the branch page's prompt (loaded with Off saved); the viewer's setting is put back. The footer is in `tools/build-story.mjs` for branch pages and hand-written in every other page. |

`js/game.js` exposes read-only views for the bot: `window.finalSpark`, the open story's player (`story()`, `start()`,
`scene()`, `scenes()`, `depth()`), and `window.iltvStories` (`list()`, `listed()`, `current()`, `view()`). Try it:
open http://localhost:8090/?playtest=branches and, when it's done, run `hawkesPlaytest.report()` in the console.
If the browser blocks unmuted autoplay, the bot plays the video muted and logs an `autoplay-blocked` event.
Every page with a story video loads `js/hawkes-sound.js` (the home page before `js/game.js`; the branch pages through
`tools/build-story.mjs`): a full-screen Tap to play prompt (its title and line from `<html data-tap-title data-tap-line>`:
the site's on the landing page, the story's `tap` on its pages and once the player opens it), then the video marked `data-sound-start` plays with sound
inside that tap. Every scenario taps the prompt first, like a viewer. Unmuted play from the bot's synthetic presses
works because the runner starts Chromium with `--autoplay-policy=no-user-gesture-required`; by hand in a normal
browser, tap the prompt yourself.

## Versions and What's new

Every go live is a release, made by Hawkes Studio (`hawkesstudio/src/releases.ts`): a semver version bumped at
go live (minor when players get something new, patch for fixes) plus the build (the commit), shown as
"1.4.0 (build ...)" and tagged `v<version>` in git. Studio adds the release to `releases.json` at the repo root (newest first) with the
player-facing notes J approved in the go-live plan. `whatsnew.html` and the home page footer's version read it through `hawkes-release.js` (a copy of
`hawkesstudio/clients/web/hawkes-release.js`: `[data-hawkes-version]`, `[data-hawkes-releases]`). Don't bump versions
by hand; a typo in old notes can be fixed in the file on beta.

## Making content (agents)

Stories are data. `story/stories.json` lists them (id, logline, card image, `listed`), each one's scenes are in
`story/<id>.json`, and `npm run story` builds every story: `js/story-data.js`, the landing cards in `index.html`
(between the `<!-- stories -->` markers), each story's `/<id>/` link, its branch pages and its media recipes in
`hawkes.assets.json`. A new story is a new `story/<id>.json` (copy `final-spark.json`'s shape, with its own
`cookie`, `tap` and `ui` labels) plus a listing entry: no code. Its pages go under `/<id>/`; only The Final Spark
lives at the site root, so its URLs and asset ids never changed. `"listed": false` keeps a draft off the landing page
(playable at `/?story=<id>`) until J approves it and its media is made. Story doc: `story/README.md` ("Adding a story").

New stories, new branches and their media are made end to end with the `iltv-story-branch` skill
(`.claude/skills/`, loaded by Claude Code): scenes in `story/<id>.json` → `npm run story` → the scene's assets
in `hawkes.assets.json` made through Studio (priced first, J's OK for GPU) → `use: "gen"` → `stories`, `branches`
and `pages` playtests. Anything in the story doc's "Waiting for J" stays a draft until J approves it.
