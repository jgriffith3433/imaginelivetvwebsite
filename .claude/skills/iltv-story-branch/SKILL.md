---
name: iltv-story-branch
description: Add or change Imagine Live TV's "The Final Spark" story branches end to end: scenes and choices in story/final-spark.json, then keyframes, clips, narration, talking shots and music through Hawkes Gen, the built pages, and a branches playtest. Use for "continue the story after the town burns", "a new branch from the fog", "generate the media for <scene>".
---

# A Final Spark branch, end to end

`story/final-spark.json` is the source of truth; `story/README.md` is the story doc (read its canon, rules and
"Waiting for J" first). `npm run story` builds everything else from the data. Never hand-edit `js/story-data.js`,
the branch pages, `hawkes.assets.json` or `scene.mp4` files.

## 1. Story (no GPU)

- Canon: you wake in a sewer, a rat, a matchbox; light is the resource; deaths go back to the sewer. What's under
  "Waiting for J" (the old man's line, a talking rat, after the town burns) is **not canon**: a request that touches it
  is a proposal for J, written as data marked `"draft": true` and listed in the README's waiting section.
- Rules: second person, one or two sentences then the question; every page in another of the world's most spoken
  languages (`lang`, with the English under it: `["<native>", "<English>"]`); mostly first person; cinematic
  live-action, gritty, low light, handheld, 9:16.
- A scene: `id`, `folder` (its page URL; never rename an existing one), `lang`, `title`, `story`, `question`,
  `choices` (`say`, `en`, `next`), `shot` (`scene`, `motion`, `cast` from `characters`), `music` (a cue in `music`),
  optional `talk` lines (a speaker, a line, `draft` until J approves), and `use: "gen"` once its media is made.
  Copy an existing scene's shape; every `next` must exist (`npm run story` checks the tree).
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

`.hawkes/scenario.txt` = `branches`. Criteria: every scene is reachable from `start` and each choice lands on its
`next` page; the new scene's page shows its text and plays its video (generated cut when `use: "gen"`); the narration
is in the scene's language; no 404s; the ending still counts as an ending. Then `pages` for the built branch pages.
