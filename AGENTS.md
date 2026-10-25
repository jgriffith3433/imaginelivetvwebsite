# Imagine Live TV website — agent notes

The site for **Imagine Live TV** (imaginelivetv.com), static on GitHub Pages. In the Hawkes Biomedical line
it is sold as *live medical education*. It is a home for choose-your-path video stories: the home page is the
landing page (a card per story, from `story/stories.json`), and choosing one opens its player on the same page
(`/?story=<id>`). The first is **The Final Spark**: you wake in a sewer, found by a rat, and each choice is a page
with a video (one folder per branch at the site root, e.g. `you-turned-right/`; other stories' pages go under
`/<id>/`). Plus a blog. A second kind of story, the **console story** (`"type": "console"`: a camera wall, voiced lines, flags and meters, a shift log; story doc `story/README.md`, "Console stories"), has its own player. Planning notes and the decision tree are in `C:\Projects\TheFinalSpark`.
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
| `smoke` (~40 s) | The title splash fades; the landing page shows its cards; The Final Spark's card opens it (its Tap to play prompt, tapped); back to the start (a new run), its Tree shows only what's found with nothing to press, the first video loads and plays 3 s, the choices show, one choice in, no Back button in the player, then All stories; then The Water Road (video plays, a choice in, no Back) and Night Shift (wall, first lines, a choice) from their cards. |
| `stories` (~1 min) | The landing page's title splash is just the site's title (no Tap to play, no sound line) and fades by itself; no inventory on the landing page (there once The Final Spark is open). The landing page has a card for every listed story in `story/stories.json`, in order (title, logline, an image that loads) and none for unlisted ones. Every card wears the viewer's progress badge across its corner and its percent explored (story doc "Progress on the cards"): with the saved places cleared (the home page loaded in a frame) every card says Not started, 0% explored; opening a story makes it Started, and its Tree shows only the first page and a locked "?" per choice; reaching one of its endings (scenes with an `ending`; deaths aren't) Completed, the percent follows the unlocked scenes, and its button says Start Over; it stays Completed through a death and Try again (the ending reopened by the story's link) and a reload. Night Shift (a console story, 36 minutes of voiced lines at the shortest) is a card like the others and reaches its ending through a **seeded run** (below). Then, from an ending, each card's Start Over: only that story's run cookie is cleared (its unlocks, percent and Completed stay; the others' cookies untouched), it opens at its start (empty history), and its card says Completed and Start Over. Each card opens its story under its own Tap to play (title, `?story=<id>`, first page's text, video, choices; no Back button in the player); All stories brings the landing back with the video gone (no splash again); a draft (`"listed": false`) opens by its link `/?story=<id>` (title, first page, its inventory; a few choices in, All stories and back, the saved place returns with the same counts; a draft whose media is made plays its first page's cut, 9:16 with sound, and still has no card); each story's own link `/<id>/` opens straight into it with its own Tap to play title. |
| `branches` (~200 s) | Opens every story (a listed one from its card, a draft by its link) and walks every scene by clicking every choice, from a fresh browser (nothing unlocked); the player has no Back and the Tree can't be pressed, so after each choice it walks the same way again from a new run (the run cookie cleared, as Start Over does, then the choices). The percent explored must follow the scenes reached, 100% only at the last, and the Tree must show the found scenes and a locked "?" per way not taken (nothing to press), then the whole tree. Each video must load (readyState, duration) and play 2 s (a draft's missing videos are one warning). A story with its own inventory (`js/kit.js`) shows its bar, not the flashlight, and the counts on it match the data for the way the bot came, at every scene, every time. A story whose media is made (`MADE` in `js/playtest.js`: The Water Road) must play a video on every scene, its own generated cut (`scene.mp4`), 9:16 and with sound (narration and music); none of its pages' words may say an `unspoken` word (the dove is only in the pictures). A console story (Night Shift, 228 scenes) is not walked way by way: each scene is entered by a real press of the choice that leads there, from a seeded run at its parent (the state explorer's shortest way), in the order of that way's length, so the percent explored must follow the count; the endings and the scenes with gated choices are heard to the end. Checks every scene is reachable, that non-ending scenes have choices, and that The Final Spark's opening matches `TheFinalSpark/Decision tree.txt` (the `TREE` table in `js/playtest.js`). |
| `pages` (~40 s) | Night Shift's 228 pages are read as documents (fetched a few at a time, every line's recording asked for with a HEAD request: the lines are `preload="none"`, so they never load by themselves), and its start and three endings are opened in the frame. Every story's branch pages (one folder per scene, read from `js/story-data.js`, so new stories and scenes need no change here), crawled from each story's start page. Each page's video loads and plays, and each choice links to a page that exists; a story with its own inventory shows it with the counts of the shortest way there. Reports dead ends, orphan pages and a missing `/<id>/` link. |
| `sound` (~60 s) | Every prompt's line ("Sound on."/"Sound off.") is checked against the saved setting (`tap-note` events, in every scenario). The studio's standard sound setup (`js/hawkes-sound.js`): the landing page's title splash fades with no prompt, The Final Spark's card opens it under its Tap to play prompt, which covers the screen, a hit-tested press on it unlocks sound and the video plays unmuted (and the next scene's after a choice); Settings (header gear) Sound off + Volume 40% are saved in `localStorage["hawkes.sound"]`, the page reloads (the run carries on through `?playtest=sound`) straight back into The Final Spark (`?story=final-spark`, its prompt title), the choice is back and applied, then a branch page's prompt and video. Last, Night Shift from its card: the voice, ambience and effects elements follow Settings (Sound off, Volume 40%) in its first scene and the next. |
| `blog` (~5 s) | Opens every post card from the home page: the page exists, its images load, its videos play, its local links resolve. |
| `credits` (~25 s) | Every page's footer says "Powered by HAWKES GEN" linking to https://hawkesgen.com, and the home page's links to the parent company, https://hawkesbiomedical.com (each visible and hit-tested). Checks the home page (landing, then with The Final Spark open, then Night Shift open from its card: its prompt's line follows the saved Sound setting too), a blog post, the start's branch page and What's new, and that nothing lies over the story video. Before tapping The Final Spark's prompt it turns Sound off from the prompt's own Settings button, so the prompt's line must say "Sound off.", and so must the branch page's prompt (loaded with Off saved); the viewer's setting is put back. The footer is in `tools/build-story.mjs` for branch pages and hand-written in every other page. |
| `console` (~200 s; two legs, the demo's then the real Night Shift's) | Console stories (`story/README.md`, "Console stories"): the draft demo `night-shift-demo` (or `{"story":"<id>"}`) opens by its link under its own Tap to play (under Playwright it waits for a real `page.mouse.click`, then taps itself, and records whether the press was trusted); subtitles on by default, lines in order, Replay, CC; the camera wall (6 to 9 feeds in the scene's states) and a feed enlarged by a press; flag-gated choices appear only with their flag and a choice sets a flag a later scene reads; every scene and ending from the build's state explorer (`explore()` in `js/console-rules.js`) with real presses, checking flags, meters, history, log, wall and choices at each scene; the Log (shift log) at the start, midway and at an ending: exactly what was done and seen, a redacted line per way not taken, nothing pressable; Settings Sound off/on and Volume on the voice, ambience and effects; a reload (a frame loading the story's link) at the start, mid-scene, right after a choice and at an ending returns to the same scene, flags, meters, log and heard lines (and the ending screen); with `localStorage` refusing every call the story still plays a choice, opens the Log and toggles CC without an error; the wall, subtitles, choices, log and the end screen fit at 390x844, 360x640 and 844x390 (a frame of that size) with no sideways scroll and 44px targets. **Second leg: the real Night Shift** (`{"at":"real"}` plays only it, `{"at":"demo"}` only the demo's), every position past the start a **seeded run**: the wall of nine feeds; a gated choice (the scene reached two ways, the choice there with one and not the other, then pressed; the event `flag-read` names the choice that set what it needs); Settings Sound off/on and Volume 40% on the voice, ambience, effects and **sting** elements, opened mid-line, in the first scene and the next; reload at the 40th scene (mid-scene, then heard) and with the Log open at 70 entries; at 360x640 that Log opens, scrolls to its foot inside itself and closes; `okafor-reads-solid` (12 choices in the data) and `tour3-test` (8) at 390x844, 360x640 and 844x390 in the state that opens most (no state opens more than four at once), then the same screen filled with copies of its buttons to the data's 12 or 8; every ending screen fits with no scroll (`consoleFit` names what scrolls and the sizes inside it in its `fit` event). `stories`, `branches`, `pages` and `sound` also cover console stories (draft by its link and saved place; the state explorer's walk; its branch pages with the marked canonical state; its audio under Settings). |
| `night-shift` (~2.5 min; `{"at":"numbers"}` ~10 s; `{"at":"four-hours"}` ~3 min) | Night Shift (`story/night-shift.json`, the whole night, listed on the landing page): from the state explorer, every scene and ending reachable, no stuck state, at least 8 endings (each logged with its shortest way); how long every way through is (each line's recording plus the player's pause): shortest 30 minutes or more, average about 45 (a warning outside 40 to 50), longest logged; Pierce Hawkes's lines (two at most, cameo scenes) and no mention of B3, the vat or the creature. No choice that changes nothing, and each reveal layer of the trainer (the pencil, the spring, the four hours, twelve) reachable. Then four ways played with real presses: shortest, longest, one that meets every layer of the trainer and ends on Someone to leave it to, and The wedge. Options: `{"story":"<id>"}`; `{"at":"numbers"}` stops after the data's checks; `{"at":"<a scene on the way through every layer>"}` (e.g. `four-hours`) plays only the rest of that way, from a **seeded run** at that scene, and the last six choices to The wedge. |
| `night-shift-card` (~60 s) | Night Shift's landing card alone, for a quick check of the card criteria: with fresh progress every card says Not started; its card follows The Water Road, has a logline and an image that loads, and never says B3, the vat or the creature; opened from its card (a real press, then Tap to play) it says Started; at an ending (a **seeded run** two choices short, then real presses) Completed with Start Over, the percent following the scenes seen; Start Over opens its first scene and the card keeps Completed. Options: `{"story":"<id>"}`. |
| `night-shift-signoff` (default = `last-choices`, ~8 min, declared 480 s, a bug if over 10; `{"at":"whole"}` ~50 min) | Night Shift's every ending, played with real presses (the fewest-choices way to each) at the page's own size and in a frame at 390x844, 360x640 and 844x390: the minutes of audio each way holds (`signoff-ending`, from the recordings), the ending shown, at every scene the buttons on screen are exactly the choices whose conditions hold (by choice index), nothing wider than the screen, hidden or under 44px (`consoleFit`). By default (`{"at":"last-choices"}`) each play is a **seeded run** (setup shortcut, `seeded-run`) 2 choices before each ending (`{"back":4}` for more), then real presses and the end screen at all four sizes; `{"at":"whole"}` plays each way whole from a new run (the T4's full sign-off). Every step is a `signoff-step` event and sets the runner's scene and progress (Gen's job line is `<id>: <scene> <progress>% (<note>)`, and Studio calls a run stuck when that line stays the same for 10 min: events alone don't change it); a heartbeat every 20 s updates the note, and a play that hangs inside a step is cut off at its limit (90 s seeded, 8 min whole) and named by step. Options: `{"sizes":"desktop"}`, `{"only":"end-wedge"}`. The sign-off itself is `story/night-shift-signoff.md`; `npm run test:endings` (jsdom) plays every ending through the real player by presses without a browser. |
| `night-shift-audio` (~1.5 min; `{"at":"between"}` ~40 s) | Night Shift's voices and sounds (`tools/make-audio.mjs`): every line of every scene has a recording and every bed/effect a scene uses has its file; each recording loads, decodes and is shorter than `dur` + 4 s (the player's give-up timer); a few lines of each speaker are within 4 dB RMS of each other, every bed at least 12 dB and every effect at least 3 dB under the voice; then the opening scene is played unskipped, each of the first lines playing its own file over the looped bed. Fails while lines are still unmade (the count is a metric; none are now: only the 6 music stings are missing, a warning). Options: `{"story":"<id>"}`. Then, for each ambience bed, a real press of the choice that leads into a scene with that bed (a **seeded run** at the parent) times how long the bed is not audible until the first line (nothing silent between scenes), the same bed carries on without restarting, and a bed seeked to its end must wrap and keep playing. |
| `night-shift-gaps` (~5 s) | Night Shift's gaps audit (`story/night-shift-gaps.md`): opens the story with real presses (its card, Tap to play, Settings), then checks the file: groups (a) to (f) numbered, the scenes/lines/endings it states match the data, the shortest and typical minutes match the clock, the appendix holds `npm run story -- --check` and a report (or a warning: not run) of `console`, `stories`, `sound`. Option `{"at":"gaps"}` (~5 s) reads the file only. |
| `cctv-art` (~75 s) | Night Shift's camera art (`night-shift`, a draft by its link): each of the nine cameras has a picture for every state the scenes use, all in one picture format; every ending's end card and the landing card's image load; the wall's tiles show their pictures. Stand-in art (`media/standin`) counts until the real stills are made. |
| `analytics` (~120 s) | Hawkes Analytics (section "Analytics"): the SDK with product `imaginelivetv`, a build with its commit and, on beta, env `beta`; every event the page sends goes on the timeline as its batch goes out. With fresh progress and question history it opens The Final Spark from its card and taps choices: Go back, the dead end's go back, the sludge (a death), Try again, so the thumbs question shows and is answered; then the shortest way to Destroy the town, where "How was this ending?" (stars, above the inventory bar) shows and is answered. Checks screen, video (play, skip with seconds watched), choice (with node, depth and path), run_start, death, back, restart, run_end with the ending, both answers and game_ready went out. Then Night Shift (a console story): from its card, a camera enlarged (`feature` feed) and the shift log opened (`feature` log), one choice, then the last two choices of its shortest way after a seeded run: story_open (card, play), screen, level_start, run_start, choice, run_end with the ending, "How was this ending?" answered; no video or back event. |

**Analytics traffic.** Only the `analytics` scenario sends to Gen's collect endpoint. `quietAnalytics()` in `js/playtest.js` swallows the page's batches (sendBeacon true, fetch 202) in every other run and puts the real calls back when it ends, so a Gen 502 can't show as a console error there.

**Frame time and the state explorer.** Every scenario times the page's frames (`probe` in `js/playtest.js`): a `frame-time` event for each scene that had a frame over 50 ms (frames, mean, worst) and the metrics `frameWorstMs`, `framesOver50` and `slowestScenes`. The scenarios that use a console story's state explorer (257,606 states for Night Shift) work it out before anything plays (`consoleWarm`, event `state-explorer` with its milliseconds), so a dip inside a scene is the scene's (pictures decoding, audio starting) and not the explorer's. A story's own link, `/<id>/`, shows its card (picture, title, logline, Play) while it forwards; the `stories` run taps the opened story in the frame before it holds, so the runner never holds on a flat dark screen.

**Seeded run (the one setup shortcut for console stories).** Night Shift is 1,288 voiced lines; its shortest way is 36 minutes
and 389 lines, more than a check can sit through, and the playtest's Skip taps are real presses that still cost a tap
each. `consoleSeedAt` in `js/playtest.js` closes the story, writes what the player would have saved for a viewer who had
listened to the first N choices (the run in `localStorage["iltv.run.<cookie>"]` with its state, history, shift log and
the scene's lines heard, the place cookie, and the unlocks cookie with the scenes of the way) and opens the story by its
link, so the player itself resumes it; everything after is real presses, and `consoleCheck` compares the player with the
model of the same way. Scenarios that use it say so (event `seeded-run`): `stories` (two choices short of the ending),
`branches` (each scene from its parent), `analytics` (two choices short of an ending). `night-shift` with `{"at":...}` (the rest of a way, from a seeded run at that scene); `night-shift` without it and
`night-shift-signoff` play whole ways with no shortcut. Don't add a way to play Night Shift to an ending from the start in
a scenario that has a time budget; seed it.

The player has no Back button (story doc "No going back"): a choice stands; a death's Try again or the card's Start
Over at an ending (story doc "Progress on the cards") are the ways to start over. Scenes are unlockable (story doc
"Unlocked scenes"): each story's `<cookie>Unlocked` cookie keeps every scene reached in the player, the Tree shows only
those (a "?" per way not taken; no node can be pressed), and the cards and the player show the percent explored.

`js/game.js` exposes read-only views for the bot: `window.finalSpark`, the open story's player (`story()`, `start()`,
`scene()`, `scenes()`, `depth()`, `path()`, `inventory()`, `unlocked()`, `explored()`), and `window.iltvStories` (`list()`, `listed()`, `current()`, `view()`, `progress(id)`: `new`, `started` or `completed`; `run(id)`: `start`, `mid` or `end`; `explored(id)`: the percent). Try it:
open http://localhost:8090/?playtest=branches and, when it's done, run `hawkesPlaytest.report()` in the console.
If the browser blocks unmuted autoplay, the bot plays the video muted and logs an `autoplay-blocked` event.
Every page with a story video loads `js/hawkes-sound.js` (the home page before `js/game.js`; the branch pages through
`tools/build-story.mjs`): a full-screen Tap to play prompt (its title and line from `<html data-tap-title data-tap-line>`,
the story's `tap` on its pages and once the player opens it), then the video marked `data-sound-start` plays with sound
inside that tap. The home page (`<html data-tap-splash>`) shows no prompt at load: the landing page gets a title splash
(*IMAGINE LIVE TV*, the prompt's background) that fades by itself, and the prompt comes when a story opens. Every
scenario starts like a viewer: it waits for the splash on the home page (`passPrompt`/`passSplash`) and taps each
story's prompt when it opens it (`openStory`). Unmuted play from the bot's synthetic presses
works because the runner starts Chromium with `--autoplay-policy=no-user-gesture-required`; by hand in a normal
browser, tap the prompt yourself.

## Versions and What's new

Every go live is a release, made by Hawkes Studio (`hawkesstudio/src/releases.ts`): a semver version bumped at
go live (minor when players get something new, patch for fixes) plus the build (the commit), shown as
"1.4.0 (build ...)" and tagged `v<version>` in git. Studio adds the release to `releases.json` at the repo root (newest first) with the
player-facing notes J approved in the go-live plan. `whatsnew.html` and the home page footer's version read it through `hawkes-release.js` (a copy of
`hawkesstudio/clients/web/hawkes-release.js`: `[data-hawkes-version]`, `[data-hawkes-releases]`). Don't bump versions
by hand; a typo in old notes can be fixed in the file on beta.

## Analytics (Hawkes Analytics)

Hawkes Analytics is the only analytics here (J, 2026-10-18): never add another tracker. The contract is
`hawkesgen/docs/analytics.md`; the product id is `imaginelivetv` (`hawkesgen/analytics/products.json`, beta
`imaginelivetv`). Events go to `https://gen.hawkesgen.com/v1/analytics/collect`.

**Loaded on every page people see**, at the end of `<body>`, in this order: `js/hawkes-build.js`,
`js/hawkes-analytics.js` (`data-product="imaginelivetv"`), `js/analytics.js`. That's `index.html` (before
`js/hawkes-sound.js` and `js/game.js`, so it hears the first scene), `whatsnew.html`, `privacy.html`, `404.html`,
every blog post (`f/*/index.html`, by hand: a new post needs the three lines) and every branch page (the template in
`tools/build-story.mjs`). Not on the `/<id>/` link pages: they forward to `/?story=<id>` at once, where the home page
counts the visit. `js/hawkes-analytics.js` is a copy of `hawkesgen/clients/js/hawkes-analytics.js`: don't edit it,
copy it again from Gen.

**The build.** `js/hawkes-build.js` sets `window.HAWKES_BUILD = { version, commit, date }`: version from
`releases.json`'s current, the commit and its date. The site has no build step, so `npm run stamp`
(`tools/stamp-build.mjs`) writes that line: run it and commit `js/hawkes-build.js` before a change is published. It
names the newest commit that changed anything but that file, so stamping twice changes nothing. (Studio could run it
as the product's `deploy.prebuild`, like I Can Be; until then the agent keeps it current.) The same file turns on the
SDK's debug mode in a bot's tab (`navigator.webdriver` or `?playtest=`: it adds `?hawkes-analytics-debug=1`) and, in a
page of this site framed by this site (the playtest's frame), puts a do-nothing stand-in in the SDK's place so the
framed page doesn't share and garble the home page's session.

**Console stories** send the player events through the same `iltv:` hooks (`js/console.js`): `scene` (a scene entered, not on a resume), `choice`, and `feature` with `feed` (a camera enlarged) or `log` (the shift log opened). `js/analytics.js` listens to `iltv:feature` for them (`feature` feed with the camera, `feature` log with the entries) and never calls a choice to a scene nearer the start a `back` in a console story: its graph is braided, and a false back would show the "Retracing your steps" question. They have no video, so no `video` events; lines and subtitles send nothing, and the `analytics` playtest covers The Final Spark, then Night Shift's events.

**What's sent** (`js/analytics.js`). It only listens. The player (`js/game.js`) announces its moments as
`iltv:<what>` events on the document (`landing`, `card`, `restart`, `open`, `choice`, `scene`): if you change how the
player moves, keep those `tell(...)` calls where they are. Names: a scene's **node** is its folder's last part
(`the-sewer`, `the-dust`); its **level** and **screen** are `<story>/<node>`.
- Automatic (the SDK): `session_start`, `page_view`, `page_load`, `perf`, `error`, `rage_click`, `outbound`, `exit`,
  `session_end`; browser, device, country and city are added by Gen.
- `game_ready` (`view`: landing, story, branch, post, whatsnew, privacy, not_found) when the page can be used.
- Context on every player event: `story`, `node`, `depth` (choices since the start: `history.length`), `path` (the
  scene ids of the run so far joined by `>`, the newest end kept past 100 characters), `lang` (the page's language),
  `explored` (the story's percent explored), and `level`. On the landing page they're cleared. Branch pages: `story`,
  `node`, `page: "branch"`. Blog posts: `post` (the folder name).
- `screen`: `landing`, `<story>/<node>` for each story page (player and branch pages), `post`, `whatsnew`,
  `privacy`, `not_found`.
- `story_open` {story, via: card, link or browser, resumed, button: play, continue or start_over, progress}.
- Every scene is a level: `level_start` {depth} when it shows, `level_end` when it's left: `complete` (a choice),
  `death` (the choice led to a death page), `restart` (Try again, Start Over), `quit` (All stories, the browser,
  another story). An ending's level completes at once. That's what the funnel and the drop-off by level read.
- `choice` {node, option (the English words), to, story} for every choice, player and branch pages.
- `video` {id: the level, action, at} for each page's video: `play` the first time it plays (`muted`), `complete`
  when it ends (`watched`, `duration`), `skip` when the viewer moves on first (`watched`: seconds really played,
  `why`: choice, landing, restart, reopen, leave; `started: false` if it never played). A video that fails to load
  is an `error` (source `asset`).
- `death` {cause: the death page's node, where: the page the choice was made on}.
- `run_start` {run: story, mode: new, try_again or start_over} at the first page of a new run; `run_end` {result:
  `win` with `ending` (each ending reached), `lose` with `cause` (a death), `quit` (back at the start without an end),
  depth, explored, duration}.
- `feature`: `back` {via: choice, from, to} for a choice to a scene nearer the start than this one (going back up the
  tree, e.g. the dead end's "go back"), `back` {via: browser} and `all_stories` when the story is left for the landing
  page, `restart` {via: try_again or start_over}, `tree` (the Tree tab), `flashlight` (once per page), `tap_to_play`
  {wait: seconds on the prompt}, `settings`, `sound` {on/off}, `volume` {0–100}.
- Blog posts: `read_depth` {percent: 25, 50, 75, 100, post} once each as the post is scrolled (what fits on screen
  counts after 1.5 s), `read_time` {seconds on screen, percent, post} when the page hides; videos as above.
- Questions (the SDK's `ask` card, the site's colours, above the inventory bar: `[data-hawkes-ask]` in
  `css/site.css`), both shown only after the page has stayed 2 s with the Tap to play prompt gone, once a session per
  id and not for 7 days after a close; an unanswered card goes when the viewer leaves that page:
  - at each ending (player and branch pages): "How was this ending?", 1–5 stars and a comment, id
    `ending-<story>-<node>`;
  - the second time a session goes back up a tree (a back choice or a death's Try again; sessionStorage `iltv.backs`):
    "Retracing your steps. Is the story working for you?", thumbs and a comment, id `back-twice`.
  - `feedback_prompt` {action: shown, answered, dismissed or ignored (left unanswered), id} around each, and the SDK's
    `feedback` with the answer.

No per-frame events and nothing personal. A new kind of moment in the player: add a `tell()` in `js/game.js`, its
event in `js/analytics.js` and its line here.

**Privacy.** Every page's footer says "Anonymous viewing statistics (no cookies, no personal data, no IP stored) help
us improve the stories." with a link to `privacy.html`, which says what is collected (and that the story progress
cookies stay on the device) and has a switch to turn statistics off in that browser (the SDK's `optOut`/`optIn`).

**Seeing it.** `?hawkes-analytics-debug=1` logs each event to the console and keeps it on
`hawkesAnalytics.debugLog` (each with `sent` once its batch went out). The `analytics` playtest (below) puts the sent
events on the timeline. Open any page once with `?hawkes-internal=1` to mark J's own browser.

## Making content (agents)

**Console stories** (type `console`) are a second kind of story with their own player (`js/console.js`, rules shared in
`js/console-rules.js`), data format, build checks (`npm run story` explores the state space and fails on a choice with no
effect or a state with no usable choice; `npm run test:console` proves it) and playtest (`console`). The format, the
saved run (`localStorage["iltv.run.<cookie>"]`, with the two cookies kept for the badges) and the assets are in
`story/README.md`, "Console stories". `js/hawkes-sound.js` also owns `<audio data-sound-start>` elements. New scenes of a
console story go at the end of `scenes` (the unlocks cookie is a bit per scene, in that order). The demo is
`story/night-shift-demo.json` (a `placeholder`, so the build doesn't warn about its voices and flags); the real story is `story/night-shift.json` (the whole night, listed on the landing page since #35; `node tools/check-night-shift.mjs` checks its voice rules and prints how long it is; world, voices and state in `story/night-shift.md`). A big story sets `stateCap` in its data (the state explorer's limit, the playtest honors it); `branches` and `console` then play the fewest ways that reach every scene.

Stories are data. `story/stories.json` lists them (id, logline, card image, `listed`), each one's scenes are in
`story/<id>.json`, and `npm run story` builds every story: `js/story-data.js`, the landing cards in `index.html`
(between the `<!-- stories -->` markers), each story's `/<id>/` link, its branch pages and its media recipes in
`hawkes.assets.json`. A new story is a new `story/<id>.json` (copy `final-spark.json`'s shape, with its own
`cookie`, `tap` and `ui` labels) plus a listing entry: no code. Its pages go under `/<id>/`; only The Final Spark
lives at the site root, so its URLs and asset ids never changed. A story can have its own inventory (items and
per-scene counts in its JSON, drawn by `js/kit.js`; story doc "A story's inventory"); The Final Spark's is the flashlight. `"listed": false` keeps a draft off the landing page
(playable at `/?story=<id>`) until J approves it and its media is made. Story doc: `story/README.md` ("Adding a story").

New stories, new branches and their media are made end to end with the `iltv-story-branch` skill
(`.claude/skills/`, loaded by Claude Code): scenes in `story/<id>.json` → `npm run story` → the scene's assets
in `hawkes.assets.json` made through Studio (priced first, J's OK for GPU) → `use: "gen"` → `stories`, `branches`
and `pages` playtests. Anything in the story doc's "Waiting for J" stays a draft until J approves it.

**Night Shift audio.** The 11 voices are locked in `story/night-shift.json` (`speakers.<id>.voice`, ElevenLabs ids from
voice design; Pierce is PH Origins' Jackson voice). The recipes are in `hawkes.assets.json` (`npm run story`); Studio's
asset make writes the raw files, then `node tools/make-audio.mjs night-shift --mix` trims silence and sets loudness
(voices -19 LUFS, effects -26, beds -38 so a bed never covers a line), `--dur` sets each line's `dur` to its recording
(the player gives up on a recording after `dur` + 4 s), `--list` shows what is still unmade, `--ingest <folder>` takes
files from `hawkesgen_run save_to`. Run `--mix` and `--dur`, then `npm run story`, after every batch. After a text edit, `node tools/make-audio.mjs night-shift --reuse` first: a line whose voice and text already have a recording keeps it, even when it moved, and it lists only the lines to make (`hawkesgen_run` `audio.voice`, then `--ingest`).
