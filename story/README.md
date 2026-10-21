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
