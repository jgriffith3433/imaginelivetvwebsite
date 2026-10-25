# Night Shift: sign-off

Written 2026-10-25 on branch `task/4d3f14ab57a1-last-task-after-everything-else-is-merge`, from beta at `c0da356`.

**Verdict: not clean, and this file says why.** The script, the voices, the beds and effects, the camera pictures and the end cards are
all made now. Two things the brief asked for were **not done**, because this server never starts a browser: nobody has walked the
endings at the four sizes, and none of the browser playtests were run. One asset is still missing (6 music stings, GPU). The
"Left unfixed" section lists all of it. Nothing below claims a result that was not produced by a command named next to it.

## What was found

The log of the voice batch (`#32`, "Voice every line of the story") says every line is voiced. It was not: **1,160 of 1,322 audio
assets had no file** (1,154 voice lines, 6 music stings). Only 134 lines were voiced. Every other line fell back to the
player's timer (a 404 per line and silence), so the "clock" numbers earlier agents read (shortest 37.5, average 43.8 minutes) were
word counts, not recordings. The nine camera feeds, the 12 end cards, the 10 ambience beds and the 18 effects were all present.

## What was fixed

| Problem | Fix | How it was checked |
| --- | --- | --- |
| 1,154 voice lines (1,288 total, 89%) had no recording | Made all of them through Hawkes Gen, `audio.voice` (ElevenLabs `eleven_v4`), in the 10 locked voices of `story/night-shift.json`, with each line's `perform` tag. 851 distinct texts were generated once and shared between the scenes that repeat them (Dee's "Mm.", the radio checks). Ingested with `node tools/make-audio.mjs night-shift --ingest`, which trims silence and sets loudness to -16 LUFS | `node tools/make-audio.mjs night-shift --list`: only the 6 music stings are left. `ffprobe` on all 1,288 `line-*.mp3`: all decode, 0.65 s to 16.3 s, none under 0.4 s or over 22 s, 118.4 minutes in all |
| Every line's `dur` was a guess | `node tools/make-audio.mjs night-shift --dur` set it to the recording's length on 1,154 lines (the player gives up on a recording after `dur` + 4 s) | rebuilt with `npm run story` |
| Scene pages stale after the recordings | `npm run story` (211 files regenerated) | `npm run story -- --check` ends "everything generated is up to date" |
| The clock ignored the player's 0.35 s gap between two lines (`GAP` in `js/console.js`), so with real recordings the average was 39.8 min, under the 40 the `night-shift` playtest warns on | The clock now counts a line as its recording plus the gap: `tools/check-night-shift.mjs`, `nightLengths` in `js/playtest.js`, and the new `tools/ending-times.mjs` | `node tools/check-night-shift.mjs` ends "ok night-shift" (average 42.2 min, inside its 42 to 48 bar) |
| No way to see the per-ending numbers and no scenario for this task | `tools/ending-times.mjs` (the table below) and the playtest scenario `night-shift-signoff` (`js/playtest.js`, named in `.hawkes/scenario.txt`, listed in `AGENTS.md`) | `node --check js/playtest.js` only. **The scenario has not been run** |

Spend: the voice lines cost about $21 of ElevenLabs through Gen (851 calls at roughly $0.025 each, from the per-job costs Gen returned;
a sum I did not total exactly). No GPU job was started.

## Play time, per ending

These are the minutes of audio on the **shortest and longest way to each ending**, computed from the recordings' real lengths plus
the player's 0.35 s gap per line, on the build's own state rules (`node tools/ending-times.mjs --md`, 240,254 states). They are **not
timed from a played walk**: nobody played these endings in a browser here.

| Ending | Scene | Shortest way (min) | Longest way (min) | Choices on the shortest way |
| --- | --- | ---: | ---: | ---: |
| Four minutes. | `end-four-hours` | 36.4 | 49.6 | 72 |
| The wedge. | `end-wedge` | 36.5 | 49.3 | 72 |
| Written up. | `end-written-up` | 36.6 | 50.1 | 72 |
| Opinions. | `end-opinions` | 37.3 | 50.2 | 74 |
| Noted. | `end-noted` | 37.4 | 49.9 | 74 |
| The friendly one. | `end-friendly` | 37.5 | 50.4 | 74 |
| Clean report. | `end-clean` | 38.0 | 50.0 | 74 |
| Eat something. | `end-eat-something` | 38.0 | 50.1 | 74 |
| She knew. | `end-she-knew` | 38.0 | 49.7 | 73 |
| Under review. | `end-under-review` | 38.1 | 49.7 | 73 |
| Someone to leave it to. | `end-someone` | 38.2 | 49.8 | 73 |
| By the book, alone. | `end-by-the-book` | 38.7 | 48.8 | 76 |

Whole night: shortest 36.4, average 42.2 (every open choice equally likely), median 42.2 (3,000 random plays: 10% 40.9, 90% 43.6),
longest 50.4 minutes.

## Walk of every ending at desktop, 390x844, 360x640 and 844x390: NOT DONE

| Ending | Desktop | 390x844 | 360x640 | 844x390 |
| --- | --- | --- | --- | --- |
| all 12 | not walked | not walked | not walked | not walked |

The brief asks for a walk with sound unlocked by a real click, noting a missing or mismatched voice or sound, wrong speaker image,
clipped or overlapping lines, loudness jumps, subtitles out of sync, a stand-in image, a choice that did nothing, a dead end,
overflow and hidden controls. This server may not start a browser (it starved Studio and Gen of memory), so none of that was seen or
heard. The scenario `night-shift-signoff` plays each ending's shortest way with real presses at all four sizes, logs a
`signoff-ending` event per play with its minutes, and checks the ending is shown and nothing is wide, hidden or under 44 px
(`consoleFit`). It needs the T4 (about 50 minutes). It does not listen: loudness jumps, clipped lines, overlap, a voice that sounds
wrong and subtitle sync still need a person or `night-shift-audio` (which is not a substitute for a listen).

What the data does say about those items, from commands that were run:

- **A missing recording or sound:** none. Every line has a file; every ambience bed (10) and effect (18) a scene uses exists
  (script check of `story/night-shift.json` against `night-shift/media/`).
- **A stand-in image:** none. `night-shift/media/standin` is gone and nothing refers to it; the 22 camera states the scenes use
  all have a picture in `night-shift/media/feeds/` (26 files), all 12 endings have an end card in `media/endcards/`, and the landing
  card is `assets/images/night-shift.png`. Whether the pictures look right (wrong room, wrong person) was not looked at.
- **A choice that did nothing, a dead end:** `npm run story` (the state explorer) and `node tools/check-night-shift.mjs` report 0
  decisions that change nothing, no stuck state, all 12 endings reachable, 228 scenes all reachable.
- **Loudness:** every voice file went through the same -16 LUFS pass, effects -26, beds -38 (`tools/make-audio.mjs`). Not measured
  again after the pass, not listened to.

## The trainer and Pierce

From `node tools/check-night-shift.mjs` and the data:

- **Reveal layers:** all four are reachable. The pencil (`sign-why`, `sign-why-44`) 12 choices in, the spring (`drawer-notice`) 22, the four
  hours (`four-hours`) 43, twelve (`twelve`) 64. One way meets all four layers (77 choices).
- **Pierce Hawkes:** two lines in two scenes, both in the cameo (`coat-lobby`: "Evening. Don't get up." *to the guard, not stopping,
  mild*; `pierce-signin`: "Fair. Fifty-eight. I own it. Put that in your log." *a pause, an actual smile*), the voice ZthjuvLPty3kTMaNKVKb
  (PH Origins' Jackson voice). He has at most two lines and speaks nowhere else. Short, assured, no speech: in character on the page.
  Hearing him was not done.
- **B3, the vat, the creature:** none in `story/night-shift.json` (scene titles, lines, `perform` notes, choices, logs, endings; the
  `unspoken` word list is the only place the words appear, by design), in the 1,375 Night Shift recipes of `hawkes.assets.json` (voice
  texts, image and sound prompts), or in `story/night-shift.md` apart from the sentence that forbids them. Images were not looked at
  one by one; they are generated from those prompts.

## Checks that were run

| Command | Result |
| --- | --- |
| `npm run story -- --check` | `ok 4 stories, 276 scenes, everything generated is up to date` (warnings only about the demo story's unread flags) |
| `node tools/check-night-shift.mjs` | `ok night-shift`: 228 scenes, 1,288 lines, 12 endings, 0 decisions that change nothing |
| `npm run test:console` | all ok |
| `node tools/make-audio.mjs night-shift --list` | 6 of 1,322 without a file: the 6 music stings |
| `node tools/ending-times.mjs` | the table above |
| `node --check js/playtest.js` | syntax ok |

## Playtests: NOT RUN

`smoke`, `stories`, `branches`, `pages`, `sound`, `blog`, `credits`, `analytics`, `console`, `night-shift`, `night-shift-audio`,
`cctv-art` and `night-shift-signoff` all need a browser. None was run here, for any of the three stories, so there is no output of
them in this file. Ask for a playtest on the T4; `.hawkes/scenario.txt` names `night-shift-signoff`. `night-shift` and
`night-shift-audio` are the ones this change affects most (the recordings now exist, and the clock includes the gap).

## Left unfixed

1. **Six music stings are not made** (`shift-begins`, `the-panel`, `fifty-eight`, `ending-plain`, `ending-warm`, `ending-cold`; recipes
   `night-shift-music-*` in `hawkes.assets.json`, 20 seconds each). They are used by `handover`, `pierce-signin`, the four
   `trouble-signal-*` scenes and all 12 endings, so every ending plays no sting where one is designed. `audio.music` is a GPU tool and
   the brief gives no GPU budget. `hawkesgen_estimate`: 6 clips, 61 GPU seconds on one ACE-Step server, about **$0.08** of GPU, or
   **$0.70** counting the 20-minute idle tail if the server is not stopped at once. This needs J's OK; then
   `node tools/make-audio.mjs night-shift --ingest <folder>` and `npm run story`. The `night-shift-audio` scenario already reports
   these as a warning.
2. **The four-size walk of every ending and all playtests** (above). Until they run on the T4, "clean at desktop and the three phone
   sizes" is **unproven**, not proven clean.
3. **No listen.** Nobody has heard the 1,154 new lines: whether a `perform` tag was read aloud instead of acted, a voice drifts, a line
   clips or two speakers sound alike. `eleven_v4` was used as the earlier batches did; the first 134 lines were not remade.
4. **The speaker treatments are still not applied** (`story/night-shift.md`, "Voices as made"): the radio, walkie, intercom and phone
   lines (Okafor on the night line, Marisol on the walkie, Dev on the intercom, Adler on the phone, the courier, Pierce across the
   lobby) are clean recordings. Nobody asked for it in this task; it needs an ffmpeg filter step per speaker in `tools/make-audio.mjs`.
5. `story/night-shift-gaps.md` (the audit from before this change) is out of date: its voice, art and ambience gaps are closed by
   `#32` to `#35` and this change. It is kept as the record of what was found then.
