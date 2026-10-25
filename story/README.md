# The stories on Imagine Live TV — story doc

imaginelivetv.com is a home for choose-your-path video stories. The home page is the landing page: a card per story
(its title, its key image, one line of logline), and choosing one opens that story's player on the same page
(`/?story=<id>`). Every choice is a page with a video. The blog is below the stories.

**The data is the source of truth.** `story/stories.json` is the listing (which stories, in what order, each card),
and each story's scenes, cast, music and labels are in `story/<id>.json`. `npm run story` builds the rest from them
(see "Build" below). Never hand-edit the generated files.

| Story | Data | Pages | Doc |
| --- | --- | --- | --- |
| **The Final Spark** | `story/final-spark.json` | the site root, as they always were: `/the-sewer/`, `/you-turned-right/`, … | this file, below |
| **The Water Road** (approved by J 2026-10-18, on the landing page) | `story/water-road.json` | `/water-road/the-water-road/`, … | `story/water-road.md` |
| **Night Shift** (listed; its demo, `night-shift-demo`, is the unlisted placeholder the console playtests use) | `story/night-shift-demo.json` (the real story: `story/night-shift.json`) | `/night-shift-demo/radio-check/`, … | `story/night-shift.md` |

## Adding a story (a data job, no code)

1. **Its doc first.** Write `story/<id>.md` in this file's style: the story so far, the rules of the piece (voice,
   languages, look, cast) and its "Waiting for J". Add a row to the table above. A new story is a proposal until J
   approves it.
2. **Its data:** `story/<id>.json`, the same shape as `final-spark.json`:
   - `title`, `tagline` (the line under the title in the player), `doc`, `start` (the first scene's id);
   - `cookie`: the name its progress is saved under (each story keeps its own place);
   - `tap`: the Tap to play screen's `title` and `line` on its pages ("Sound on." + the line);
   - `ui`: the player's labels per language (`mouth` = where you start, `depth`), with `en` for the English
     under them; every scene's `lang` needs an entry;
   - `style`, `negative`, `characters`, `narrator`, `music`, `use`, and `scenes`, each as described below under
     "How a page's media is made". A character without a filmed `seed` gets its reference sheet from its `look`
     alone, and a shot with nobody in it gets its keyframe from the words alone (`image.generate`).
3. **Its listing entry** in `story/stories.json`: `id` (= the file name), `logline` (one line for its card), `image`
   and `alt` (a 9:16 key image; without one the card shows the first video's opening frame). Leave `pages` out:
   its pages go under `/<id>/<folder>/` (only The Final Spark lives at the site root). Set `"listed": false` while
   it is a draft: it builds and plays at `/?story=<id>` but has no card, and its scenes may have no video yet.
   Every card wears the viewer's own **progress badge** across its corner (below, "Progress on the cards"); there
   is no status to set.
   Optional: `inventory` (the story's own inventory, below), `unspoken` (words no page may say: the build fails
   if a scene's text has one), `camera` (how the camera moves in its clips; default "Slow, tense handheld camera")
   and `avoid` (a line added to every `image.generate` prompt: that tool has no negative prompt, so what matters of
   `negative` is said there in positive words, e.g. "A modern 3D game render, not a photograph").
4. `npm run story`, then `npm run story -- --check`. It checks every story's tree, writes the card into
   `index.html`, the story's link page `/<id>/` (it opens `/?story=<id>`), its branch pages and its media recipes
   in `hawkes.assets.json` (ids `<id>-<scene>-shot`, `<id>-char-<who>`, `<id>-music-<cue>`; files under
   `<id>/<folder>/media/` and `assets/story/<id>/music/`).
5. Media through Studio (GPU: J's OK first), then `listed` comes out of the entry once every scene has a video,
   and the `stories`, `branches` and `pages` playtests cover it.

## Progress on the cards

Every story card on the landing page wears a ribbon across its top right corner with the viewer's own progress in
that story (J, 2026-10-18):

- **Not started**: nothing of it reached in this browser.
- **Started**: they have opened it (its first page is the first scene unlocked).
- **Completed**: they have reached one of its **endings** once. An ending is a scene with an `ending` line in
  `story/<id>.json` (no choices, not a death): The Final Spark's is Destroy the town; The Water Road's are Dry Fork
  and The price of water. Deaths are not endings.

Under the button the card says how much of the story they have **explored** ("42% explored", below "Unlocked
scenes"). Completed is kept with the unlocks, so it survives a reload, a death, Try again and Start Over: once
Completed, always Completed (only an ending sets it). `js/game.js` draws the cards whenever the landing page shows.
A story with no ending yet builds with a warning: its badge can't say Completed.

The card's button says **Start Over** once the story is **Completed** (or when the run is at an ending); otherwise it
follows the current **run**: **Play** (no run, or at the first page) or **Continue** (somewhere further in). Pressing
Start Over forgets that story's run only, its run cookie (the other stories keep theirs), and opens it at its first
page with an empty history; its unlocked scenes, its percent and Completed stay. The `stories` playtest checks the
badges, the percent, the buttons and Start Over.

## Console stories

A second kind of story (J, 2026-10-24): `"type": "console"` in `story/<id>.json`. It is *heard* before it is seen: a
night in a control room. Each scene is a few voiced lines that follow one another by themselves over an ambience
bed, while a **wall** of camera feeds shows what the scene says is on the cameras. When the lines are done the
choices appear. The story remembers **flags and meters**; a choice can need them and can change them. The graph is
braided (many choices lead to the same later scene); the state is what makes the same scene different. The video
stories are untouched: a console story has its own player (`js/console.js`, `<section id="console">` on the home
page), its own rules (`js/console-rules.js`, shared by the player, the build and the playtest) and its own pages.
**How a viewer finds Night Shift:** it has a card on the landing page after The Water Road (`story/stories.json`, no
`listed: false`), with the same badge (Not started / Started / Completed), percent explored and Play / Continue /
Start Over as the video stories, and its own Tap to play title. Completed means any ending was reached; the percent is
scenes seen out of all its scenes (the build proves every scene reachable), kept as a bit per scene in the unlocks
cookie. `night-shift-card` is the short check of just this card (about a minute). The `stories` playtest opens it from its card, reaches the ending of its shortest way (a seeded run two choices short
of it, then real presses; see AGENTS.md, "Seeded run"), checks Completed and Start Over; `branches` enters every scene
by a press from a seeded run at its parent, `pages` reads all its pages, `sound`, `credits` and `analytics` open it from
its card, and `night-shift` and `console` play whole ways.

Its demo, `night-shift-demo` (5 scenes, `listed: false`, silent placeholder audio), is what the `console` playtest plays.

### The data (`story/<id>.json`, `"type": "console"`)

Top level: `title`, `tagline`, `doc`, `cookie`, `tap`, `start` (as in "Adding a story"), plus

- `state`: `flags` (every flag name the story uses) and `meters` (`{ name: { min, max, start } }`, whole numbers).
- `cameras`: the **wall**, 6 to 9 of them: `{ id, name, states: { normal: "what it sees", <state>: "what it sees now" } }`.
  Every camera has a `normal` state. The wall is always three columns (2x3 for six cameras, 3x3 for nine).
- `speakers`: `{ id: { name, voice (an ElevenLabs voice id, once the voice is made), design (the voice design) } }`.
- `ambience` and `sfx`: `{ cue: "prompt for audio.sfx" }`, the beds (looped) and the one-shot effects.
- `style`, `negative`, `avoid`: the look of the camera stills; `narrator.model` (default `eleven_v4`); `unspoken`
  (words no page may say); `stateCap` (states the build explores, default 50000; the playtest uses it too, so keep the state small: every meter
  and flag multiplies the states, and `lines` can't depend on state, so a state-dependent line is a short scene the choice leads to).

A **scene**: `id`, `folder`, `time` ("HH:MM", the shift log's timestamp and the clock on screen), `title`, `ambience`
(a cue), `feeds` (`{ camera: state }`; a camera not named shows `normal`), `focus` (a camera enlarged when the scene
opens), `lines`, `log`, `choices`, or `ending` (a string, no choices; reaching one completes the story).

- `lines`: in order, each `{ speaker, text, perform, sfx, dur, file }`. `text` is what is said and what the
  subtitles show; `perform` is the performance tags for `eleven_v4` ("flat, dry" is sent as `[flat][dry] text`); `sfx`
  is a cue played just before the line; `dur` (seconds) is how long the line takes when it has no recording; `file`
  is a recording to use (the demo's silent placeholder). Without `file`, the player uses
  `<id>/<folder>/media/line-<n>.mp3` once it is made, and until then reads the line on a timer.
- `log`: the line this scene writes in the shift log when the player reaches it.
- `treatment` (on a line, or on a speaker as the default for all their lines; a line's own wins): how the line sounds
  when it is spoken over a **radio**, **walkie**, **intercom** or **phone**, or `none` (the default). It is post-processing
  of the recording, never a new voice (the `perform` tags and the voice design are unchanged, so the recipe is too):
  `radio` and `walkie` are band-limited (350 to 3200 Hz, 450 to 2800 Hz), compressed, a touch of noise and end on a short
  squelch burst (the walkie harder and a little overdriven); `intercom` is tinny (500 to 2600 Hz) with a faint 120 Hz hum
  and no squelch; `phone` is 300 to 3400 Hz, lightly compressed, with a hint of noise. Treated lines are set back to the
  voices' -16 LUFS (the window is -19.1 to -14.6). Mark a line when the scene has it on the air: the `perform` says "over the
  radio", "on the walkie", "over the intercom", the narrator has the night line ring, or the voice is a tile's speaker.
  A person in the room is `none` even in a scene that has a radio in it. `tools/make-audio.mjs` does the work (below).
- a **choice**: `say` (the words on the button), `next`, and any of `requires` (flags that must be set), `forbids`
  (flags that must not be), `meters` (`{ name: { min, max } }` ranges the meters must be in), `set` / `clear` (flags),
  `add` (`{ meter: n }`, kept inside its range), `log` (the shift log line for having done it; without one the log
  shows the choice's words) and `cosmetic` (a reason: this choice does nothing on purpose; at most two on one run).
  A choice whose conditions fail is **not on the page**.

### Treated lines (radio, walkie, intercom, phone)

`node tools/make-audio.mjs <story> --treat` puts every voice line through its `treatment` with ffmpeg (`--mix`, `--ingest`
and `--reuse` do it for the lines they touch; `--treat --check` lists the lines out of date and exits 1 if any). The clean
recording of a treated line is kept in `<story>/media/clean/<scene folder>-line-N.mp3` and the played `line-N.mp3` is made
from it, so no voice is made again and a treatment can be changed or taken off at any time. The lock entry
(`hawkes.assets.lock.json`) of a treated line adds `treatment` and `clean` (the clean file's hash): change a line's
treatment in the data and only that line is stale and redone. Afterwards run `--dur` (the squelch tail adds a tenth of a
second) and `npm run story`. `--level` brings any untreated voice outside -18.9 to -14.8 LUFS to -16. The treatments and
their settings are `TREATMENTS` in the tool.

### What the player does

Audio first: `js/console.js` plays each line's recording through three `<audio>` elements (voice, ambience bed,
effects) that `js/hawkes-sound.js` owns like it owns the videos: they are marked `data-sound-start`, so the **Tap to
play** press starts them (and unlocks them on iOS); Settings (Sound on/off, Volume) applies to all three. Lines start
only once sound is unlocked, then follow each other. **Replay line** plays the current (or last) line again, **Skip
line** moves on. **Subtitles are on by default** (CC in the bar turns them off, kept in `localStorage["iltv.subtitles"]`;
off, they stay for screen readers). Tapping a **feed** enlarges it (its description under it); another replaces it, the
same again, or Shrink, puts it back.

**Saving.** The whole run is in `localStorage["iltv.run.<cookie>"]`: the scene, the way there, the flags and meters, the
log and how many lines were heard, so a returning player resumes in the same scene with the same state. The two
cookies of every story stay (the card's badge and percent explored work as for every story; Start Over on the card
clears the run cookie and the saved run, and keeps the unlocks): the run cookie is `{ scene, history: [] }`, and the
unlocks cookie keeps a bit per scene (`{ ix, completed }`, in the order of `scenes`, so **new scenes go at the end**) to stay
well under 4 KB.

**The Log** (the Tree of this type) is a **Daily Activity Report**: ruled paper, a time and an entry for everything the
player has done (the choice's `log`) and seen (the scene's `log`), and a redacted bar for every way not taken (every
other choice of a scene they decided at, and all the choices of the scene they are in). Nothing in it can be pressed. The
Log button in the bar opens and closes it at any time.

**Layout.** Mobile first: in portrait the wall (3 columns) is on top, then the enlarged feed, the subtitles, the
line buttons and the choices; every tap target is 44 px or more, safe-area insets are respected, nothing scrolls
sideways (works at 360x640); in landscape (640 px and wider) the wall and the enlarged feed are on the left and the words on the right.

### The build (`npm run story`)

Beyond the usual (folders, language, unspoken words) it **explores the state space** (`explore()` in
`js/console-rules.js`, up to `stateCap` states, in order from the start) and fails when:

- a `next` doesn't exist, or a scene can't be reached under any state, or an ending is never reached;
- **a state has no usable choice**: a scene that isn't an ending where, in some reachable state, every choice's conditions fail;
- **a choice has no visible effect**: it changes no flag or meter in any state it can be made in, has no `log` line of its
  own, and goes where another choice open in the same state also goes (or back to its own scene), unless it is `cosmetic`
  with a reason (and a run has at most two);
- a choice can never be made, uses a flag or meter the story doesn't declare, or reads a flag nothing sets (a flag that is
  set and never read is a warning);
- the wall isn't 6 to 9 cameras, a camera has no `normal` state, or a scene names a camera or state that isn't there.

`node tools/test-console.mjs` (`npm run test:console`) builds broken copies of the demo and checks the build refuses each.

It writes, for a console story, `js/story-data.js` (with `type: "console"`), the `/<id>/` link and a **branch page** per
scene (`/<id>/<folder>/`: the wall, every line with its audio, the scene's log line, and the choices; the
**canonical state** is marked in a dashed box: the flags and meters you have on the *shortest way* there, and a
choice that state doesn't open is shown locked with what it needs), and the media recipes in `hawkes.assets.json`:

| Asset | Chain | Files |
| --- | --- | --- |
| `<id>-feed-<camera>-normal` | `image.generate`, 3 candidates, Claude picks | `<id>/media/feeds/<camera>-normal.png` |
| `<id>-feed-<camera>-<state>` | `image.edit` of the normal picture (only the change) | `<id>/media/feeds/<camera>-<state>.png` |
| `<id>-ambience-<cue>` | `audio.sfx`, 30 s, looped | `<id>/media/ambience/<cue>.mp3` |
| `<id>-sfx-<cue>` | `audio.sfx`, 2 s | `<id>/media/sfx/<cue>.mp3` |
| `<id>-<scene>-line-<n>` | `audio.voice`, `eleven_v4`, the line's `perform` tags in front (needs the speaker's `voice`) | `<id>/<folder>/media/line-<n>.mp3` |

Pictures that aren't made yet are drawn as placeholder tiles (a dark scanned frame with the camera's name and state), lines
without a recording are read on a timer: a console story is playable from the first draft. Nothing here uses the GPU
except the camera stills (`image.generate`, `image.edit`); the voices and sounds are cents each.

### Playtests

> **The console scenarios.** `console` plays the draft demo `night-shift-demo` first and then the real Night Shift (`{"at":"real"}` only the real one); it is not the demo alone any more. `night-shift` (~2.5 min) plays four whole ways, `night-shift-signoff` every ending
> at four sizes (~23 min; `{"at":"last-choices"}` seeds the run 2 choices short, under 10 min), `night-shift-audio` checks every line and bed. Night Shift today: 256 scenes, 1,376 lines, 12 endings, shortest way 39.3 minutes, average 45.6, longest 54.5.

The `console` scenario plays the demo (or `{"story":"<id>"}`): opens it by its link under its own Tap to play, subtitles
and lines in order, Replay, the wall and the enlarged feed, gated choices, every scene and ending from the state explorer
(real presses), the Log (at the start, in the middle and at an ending), Settings on the audio, a reload mid-scene, and three
screen sizes (a frame of 390x844, 360x640 and 844x390). The `stories`, `branches`, `pages` and `sound` scenarios cover
console stories next to the video ones (a console draft opens by its link and keeps its saved place; `branches` walks it;
`pages` crawls its branch pages; `sound` checks its audio under Settings).

## Unlocked scenes

Scenes are unlockable (J, 2026-10-18: "so the user doesn't know if decisions continue down the path... they can't
cheat"). Every story keeps two cookies, both named from `cookie` in its data:

- the **run**, `<cookie>`: `{ scene, history }`, where they are and the way they came (the inventory's counts come
  from it). Start Over clears it.
- the **unlocks**, `<cookie>Unlocked`: `{ seen, completed }`, every scene ever reached in the player (by id, once)
  and whether an ending was. Nothing in the game clears it: deaths, Try again and Start Over keep it.

Only the player unlocks a scene: the branch pages (`/<folder>/`) never touch the cookies. A story's percent explored
is its unlocked scenes over all its scenes, rounded down, so it is 100% only when every scene has been seen (a new
scene added to a story lowers everyone's percent until they find it). It shows on the card and in the player, next
to the depth.

**The Tree tab is a map of what you've found**, not a way around: it draws the unlocked scenes, the current one
marked, and for each choice from one of them to a scene not reached yet a locked **?** (with the choice's words,
which the page showed anyway) and nothing below it. One "?" per choice, so it never tells whether a choice leads on,
how deep it goes, its title or video, whether two ways meet, or whether it's a death or an ending. Nothing in the
tree can be pressed. (A choice between two scenes you have both reached draws its branch even if you never took it.)

## No going back

Players own their choices (J, 2026-10-18): the player has no Back button, in every story. A choice stands; the
only ways to another path are a death (its Try again goes back to the start) or Start Over on a completed story's
card. The history is still kept (the way you came), for the inventory's counts and the saved place. The Tree tab can't
open scenes either (above, "Unlocked scenes").

## A story's inventory

The Final Spark's inventory is the flashlight (`js/spot.js`), and it stays its own. Another story can have its own
bar of items instead (`js/kit.js`; The Water Road's revolver, bullets and flask), all data in `story/<id>.json`:

- `inventory.items`: each with `id`, `name`, `icon` (one `js/kit.js` draws: `revolver`, `rounds`, `flask`), and for
  a counted item `start` and `max`; `note` is its tooltip. `"empty": "dead"` says running out of it ends the run.
- On a scene, `inventory` is what it does: `{ "water": -1 }` takes one, `{ "water": { "set": 4 } }` sets it.

The counts at a scene come from the way you came: the start, then every scene since (the player's history), kept
between 0 and `max`; back at the start they start over. So a saved place brings them back.
A branch page shows the counts on the shortest way to it. `npm run story` checks every way through the story: no
count goes below none except on a death page, and an `"empty": "dead"` item runs out only on a death page. The
player and its pages set `<html data-kit>`, which swaps the flashlight for the story's bar; the landing page has
neither. The `branches` playtest checks the bar against the data on every scene (walking each way again from the start), `stories` a
saved place, `pages` every branch page.

# The Final Spark

`story/final-spark.json`: every page, its text, its choices and how its media is made.

## The story so far (canon, as played on the site)

You wake in a sewer with no name and no past. A rat is watching you, and beside it is a matchbox. Every page is
lit by a match, and the matches run out (the title is the last one).

1. **The sewer.** Go back to a dead end smeared with sludge (touch it and you die), or go right into the water.
2. **The water.** Climb out, or wade on and die of trench foot.
3. **The gate.** A locked iron gate. Breaking it and picking the lock both fail; either way you search and find a
   key on a skeleton chained to the wall.
4. **The fog.** Beyond the gate is an old town drowned in white fog, and a house. Set its door on fire, or knock:
   an old man answers and sends you away.
5. **The truck.** A white van stands open in the street. Get in or walk away; either way you meet the shadow.
6. **The shadow.** You dance with it and it wakes something in you: two powers, Consume Light and Shadow Stitch.
   Either one ends with you destroying the town. That is the end of the story.

Deaths send you back to the sewer ("try again in another life").

## The rules of the piece

- **Second person, short.** One or two sentences of story, then the question.
- **Every page speaks another language.** The words are in one of the world's most spoken languages and the
  flashlight (`js/spot.js`) reveals the English under them. Each scene's `lang` is fixed in the data; narration is
  spoken in that language.
- **Light is the resource.** Matches, candles, the light beyond the gate, and finally a power that eats light.
- **Look:** cinematic live-action, gritty, low light, handheld; vertical 9:16 like the filmed shorts. Mostly
  first-person (your hand and the match); you are seen from behind or far away.
- **Cast** (`characters` in the data; each has a reference sheet made from a frame of the filmed clips, so every
  generated shot keeps the same faces): **you** (a young person in a worn olive canvas jacket), **the rat**, **the old
  man** at the door, **the shadow**.

- **Sound.** Every story page opens on a black "Tap to play" screen (*THE FINAL SPARK*, one lit match, "Sound on.
  Strike the first match."). The tap is the first match: it unlocks sound, and the page's video starts with it. The
  gear in the header is Settings (Sound on/off, Volume), kept for every page (`js/hawkes-sound.js`, the studio's
  standard sound setup). The prompt and Settings are in English, like the Play/Tree tabs: they are the site, not
  the story. (The words come from `tap` in the data.) Opening the story from its card on the landing page shows the
  same prompt, and so does a link straight into it, `/?story=final-spark` or `/final-spark/`.
- **The landing page has no prompt.** It has no video, so nothing to unlock: on a first visit it opens on a title
  splash, just *IMAGINE LIVE TV* on the prompt's black background, that holds a moment and fades away by itself
  into "Choose your story". Each story's own Tap to play is where its sound starts. (`splash()` in
  `js/hawkes-sound.js`; the home page's `<html data-tap-splash>`.)
- **The inventory is the story's.** The flashlight bar (`js/spot.js`) shows in a story's player and on its pages,
  never on the landing page.

## Waiting for J (not canon until approved)

- **The old man's line** at the door (`knock`, marked `draft`): *"Do you know what time it is? Go away. Nobody comes
  out of that fog."* It is the only spoken line, and the only talking shot (`video.talk`).
- **Does the rat talk?** A line at the start ("You're awake. Took you long enough.") would add a second talking
  shot. Not in the data.
- **What happens after the town burns?** Not started.

## How a page's media is made

Each scene has `film` (J's filmed clip in `assets/video/`, what the site plays today) and a `shot` (what the camera
sees, how it moves, who is in it). `hawkes.assets.json` (built from the data) has, per scene:

| Asset | Chain | Files |
| --- | --- | --- |
| `<id>-shot` | `image.edit` keyframe from the cast's reference sheets (3 candidates, Claude picks) → `video.i2v` | `<folder>/media/keyframe.png`, `<folder>/media/clip.mp4` |
| `<id>-voice` | `audio.voice`, the story and question in the scene's language | `<folder>/media/narration.mp3` |
| `<id>-talk-<n>` | `image.edit` close-up of the speaker → `audio.voice` line → `video.talk` | `<folder>/media/talk-<n>.mp4` (+ portrait, line) |

plus one reference sheet per character (`char-<id>`) and one music cue per mood (`music-<cue>`, `audio.music`).

A scene plays its generated cut only when its `use` (or the story's `use`) is `"gen"`. The build then joins the
clip (looped under the narration), any talking shot and the mood music into `<folder>/scene.mp4` with ffmpeg.
Until then the filmed clip plays. A draft (`"listed": false`) whose music cue isn't made yet is cut without it (a
warning), and cut again with it once the cue is made; a listed story waits for its music.

# Build

```
npm run story          # every story: js/story-data.js, the landing cards in index.html, /<id>/ links,
                       # every branch page, hawkes.assets.json, gen cuts
npm run story -- --check   # fails if a tree is broken or anything generated is out of date
```

Then make the media through Hawkes Studio (costs GPU time: ask J first):
`studio.cmd assets imaginelivetv` (status) and `studio.cmd assets imaginelivetv make`.

### Camera art for console stories

`style` is written as positive wording (image.generate ignores negatives): a CCTV still, fisheye, low-res, grain, scanlines, a clear strip for the timestamp. Until the real stills exist, `tools/make-standins.mjs` draws SVG stand-ins (`<id>/media/standin/`): one per camera state on that camera's fixed room, one end card per ending, and the landing card; the build uses them only while `media/feeds/<camera>-<state>.png` / `media/endcards/<scene>.png` is missing. Recipes: `<id>-feed-*`, `<id>-endcard-<scene>`, `<id>-card`. The `cctv-art` playtest checks them.
