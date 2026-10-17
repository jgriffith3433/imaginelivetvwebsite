# The Final Spark — story doc

The design document for the choose-your-path story on imaginelivetv.com. **`story/final-spark.json` is the source
of truth**: every page, its text, its choices and how its media is made. `npm run story` builds the rest from it
(see "Build" below). Never hand-edit the generated files.

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
   Either one ends with you destroying the town. *More of the story coming soon.*

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
  the story.

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
Until then the filmed clip plays.

## Build

```
npm run story          # js/story-data.js, every branch page, hawkes.assets.json, gen cuts
npm run story -- --check   # fails if anything generated is out of date
```

Then make the media through Hawkes Studio (costs GPU time: ask J first):
`studio.cmd assets imaginelivetv` (status) and `studio.cmd assets imaginelivetv make`.
