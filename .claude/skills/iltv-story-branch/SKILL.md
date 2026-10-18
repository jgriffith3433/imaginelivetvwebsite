---
name: iltv-story-branch
description: Add a new story to Imagine Live TV, or add or change a story's branches, end to end: the listing in story/stories.json, scenes and choices in story/<id>.json (The Final Spark is story/final-spark.json), then keyframes, clips, narration, talking shots and music through Hawkes Gen, the built pages and landing card, and the stories/branches playtests. Use for "a new story", "continue the story after the town burns", "a new branch from the fog", "generate the media for <scene>".
---

# A story or a branch, end to end

The site hosts several choose-your-path stories behind a landing page. `story/stories.json` lists them (the
landing page's cards), each story's scenes are in `story/<id>.json`, and `story/README.md` is the story doc (read its
canon, rules and "Waiting for J" first; a new story has its own `story/<id>.md`). `npm run story` builds every story
from the data. Never hand-edit `js/story-data.js`, the landing cards in `index.html`, the `/<id>/` link pages, the
branch pages, `hawkes.assets.json` or `scene.mp4` files.

## 0. A new story (no GPU, no code)

Follow "Adding a story" in `story/README.md`:
- `story/<id>.md` first (the story so far, its rules, cast and "Waiting for J"), and a row in the README's table.
- `story/<id>.json` in `final-spark.json`'s shape: `title`, `tagline`, `doc`, `start`, its own `cookie`, `tap`
  (`title`, `line`: its Tap to play screen), `ui` labels for every language its scenes use (plus `en`), `style`,
  `negative`, `characters` (no `seed` = a sheet from the `look` alone), `narrator`, `music`, `use: "gen"`, `scenes`.
- A listing entry in `story/stories.json`: `id`, `logline` (one line), `image` + `alt` (9:16, optional), and
  `"listed": false` until J approves it and every scene has a video. Its pages go under `/<id>/<folder>/` and its
  asset ids start with `<id>-`; only The Final Spark lives at the site root. `"status": "complete"` once the story
  has its ending and J calls it finished: its landing card wears a Completed ribbon.
- Then steps 1 to 3 below for its scenes. A new story is a proposal until J approves it.

## 1. Story (no GPU)

- The Final Spark's canon: you wake in a sewer, a rat, a matchbox; light is the resource; deaths go back to the sewer. What's under
  "Waiting for J" (the old man's line, a talking rat, after the town burns) is **not canon**: a request that touches it
  is a proposal for J, written as data marked `"draft": true` and listed in the README's waiting section.
- The Final Spark's rules (a new story sets its own in its doc): second person, one or two sentences then the
  question; every page in another of the world's most spoken languages (`lang`, with the English under it: `["<native>", "<English>"]`); mostly first person; cinematic
  live-action, gritty, low light, handheld, 9:16.
- A scene: `id`, `folder` (its page URL; never rename an existing one), `lang`, `title`, `story`, `question`,
  `choices` (`say`, `en`, `next`), `shot` (`scene`, `motion`, `cast` from `characters`), `music` (a cue in `music`),
  optional `talk` lines (a speaker, a line, `draft` until J approves), and `use: "gen"` once its media is made.
  Copy an existing scene's shape; every `next` must exist and every `lang` needs `ui` labels (`npm run story`
  checks every story's tree).
- `npm run story`, then `npm run story -- --check` (clean). Look at the new page locally (`auto-start.bat`, :8090).

## 2. Media (GPU: ask first)

`hawkes.assets.json` now lists the new scene's assets: `<id>-shot` (image.edit keyframe from the cast's reference
sheets, best of 3 picked by Claude, then video.i2v), `<id>-voice` (narration in the scene's language), any
`<id>-talk-<n>`, and new `music-<cue>` or `char-<id>` sheets. Measured: one scene ≈ 10 GPU-minutes (the i2v clip is
most of it, ~9 min at 544×960×81) ≈ $0.35, plus voice ~$0.02; the whole 23-scene story ≈ 3.8 GPU-hours ≈ $8–9.
Price yours with `studio_assets` (status) and `hawkesgen_estimate`; **without J's OK in your brief, stop here and ask**
with the number. Then make only what's missing, in one batch (one server start):

```
studio_make_assets  imaginelivetv  ids: ["<id>-shot", "<id>-voice", ...]
```

Takes the library already has for the same recipe come back free. Look at every keyframe yourself (Read the png):
the cast on-model with their sheets (the rat is a rat, you wear the olive canvas jacket), no fake text, 9:16. A bad
keyframe: change the `shot.scene` wording and make it again rather than forcing a pick. Then set `use: "gen"` on the
scene and `npm run story` again (it cuts `<folder>/scene.mp4`).

## 3. Playtest

`.hawkes/scenario.txt` = `branches` (`stories` for a new story or a change to the landing page). Criteria: every scene is reachable from `start` and each choice lands on its
`next` page; the new scene's page shows its text and plays its video (generated cut when `use: "gen"`); the narration
is in the scene's language; no 404s; the ending still counts as an ending. Then `pages` for the built branch pages.
