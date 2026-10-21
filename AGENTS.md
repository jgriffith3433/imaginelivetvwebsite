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
| `smoke` (~10 s) | The title splash fades; the landing page shows its cards; The Final Spark's card opens it (its Tap to play prompt, tapped); back to the start (a new run), its Tree shows only what's found with nothing to press, the first video loads and plays 3 s, the choices show, one choice in, no Back button in the player, then All stories. |
| `stories` (~60 s) | The landing page's title splash is just the site's title (no Tap to play, no sound line) and fades by itself; no inventory on the landing page (there once The Final Spark is open). The landing page has a card for every listed story in `story/stories.json`, in order (title, logline, an image that loads) and none for unlisted ones. Every card wears the viewer's progress badge across its corner and its percent explored (story doc "Progress on the cards"): with the saved places cleared (the home page loaded in a frame) every card says Not started, 0% explored; opening a story makes it Started, and its Tree shows only the first page and a locked "?" per choice; reaching one of its endings (scenes with an `ending`; deaths aren't) Completed, the percent follows the unlocked scenes, and its button says Start Over; it stays Completed through a death and Try again (the ending reopened by the story's link) and a reload. Then, from an ending, each card's Start Over: only that story's run cookie is cleared (its unlocks, percent and Completed stay; the others' cookies untouched), it opens at its start (empty history), and its card says Completed and Start Over. Each card opens its story under its own Tap to play (title, `?story=<id>`, first page's text, video, choices; no Back button in the player); All stories brings the landing back with the video gone (no splash again); a draft (`"listed": false`) opens by its link `/?story=<id>` (title, first page, its inventory; a few choices in, All stories and back, the saved place returns with the same counts; a draft whose media is made plays its first page's cut, 9:16 with sound, and still has no card); each story's own link `/<id>/` opens straight into it with its own Tap to play title. |
| `branches` (~200 s) | Opens every story (a listed one from its card, a draft by its link) and walks every scene by clicking every choice, from a fresh browser (nothing unlocked); the player has no Back and the Tree can't be pressed, so after each choice it walks the same way again from a new run (the run cookie cleared, as Start Over does, then the choices). The percent explored must follow the scenes reached, 100% only at the last, and the Tree must show the found scenes and a locked "?" per way not taken (nothing to press), then the whole tree. Each video must load (readyState, duration) and play 2 s (a draft's missing videos are one warning). A story with its own inventory (`js/kit.js`) shows its bar, not the flashlight, and the counts on it match the data for the way the bot came, at every scene, every time. A story whose media is made (`MADE` in `js/playtest.js`: The Water Road) must play a video on every scene, its own generated cut (`scene.mp4`), 9:16 and with sound (narration and music); none of its pages' words may say an `unspoken` word (the dove is only in the pictures). Checks every scene is reachable, that non-ending scenes have choices, and that The Final Spark's opening matches `TheFinalSpark/Decision tree.txt` (the `TREE` table in `js/playtest.js`). |
| `pages` (~30 s) | Every story's branch pages (one folder per scene, read from `js/story-data.js`, so new stories and scenes need no change here), crawled from each story's start page. Each page's video loads and plays, and each choice links to a page that exists; a story with its own inventory shows it with the counts of the shortest way there. Reports dead ends, orphan pages and a missing `/<id>/` link. |
| `sound` (~45 s) | Every prompt's line ("Sound on."/"Sound off.") is checked against the saved setting (`tap-note` events, in every scenario). The studio's standard sound setup (`js/hawkes-sound.js`): the landing page's title splash fades with no prompt, The Final Spark's card opens it under its Tap to play prompt, which covers the screen, a hit-tested press on it unlocks sound and the video plays unmuted (and the next scene's after a choice); Settings (header gear) Sound off + Volume 40% are saved in `localStorage["hawkes.sound"]`, the page reloads (the run carries on through `?playtest=sound`) straight back into The Final Spark (`?story=final-spark`, its prompt title), the choice is back and applied, then a branch page's prompt and video. |
| `blog` (~5 s) | Opens every post card from the home page: the page exists, its images load, its videos play, its local links resolve. |
| `credits` (~14 s) | Every page's footer says "Powered by HAWKES GEN" linking to https://hawkesgen.com, and the home page's links to the parent company, https://hawkesbiomedical.com (each visible and hit-tested). Checks the home page (landing, then with The Final Spark open), a blog post, the start's branch page and What's new, and that nothing lies over the story video. Before tapping The Final Spark's prompt it turns Sound off from the prompt's own Settings button, so the prompt's line must say "Sound off.", and so must the branch page's prompt (loaded with Off saved); the viewer's setting is put back. The footer is in `tools/build-story.mjs` for branch pages and hand-written in every other page. |
| `analytics` (~75 s) | Hawkes Analytics (section "Analytics"): the SDK with product `imaginelivetv`, a build with its commit and, on beta, env `beta`; every event the page sends goes on the timeline as its batch goes out. With fresh progress and question history it opens The Final Spark from its card and taps choices: Go back, the dead end's go back, the sludge (a death), Try again, so the thumbs question shows and is answered; then the shortest way to Destroy the town, where "How was this ending?" (stars, above the inventory bar) shows and is answered. Checks screen, video (play, skip with seconds watched), choice (with node, depth and path), run_start, death, back, restart, run_end with the ending, both answers and game_ready went out. |

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
