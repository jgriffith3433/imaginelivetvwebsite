# Night Shift: sign-off

Written 2026-10-25 (third attempt, on top of beta at `22c5b65`). **Verdict: not proven clean.** What a server with no browser can
run is clean (listed with its output below). What needs a browser (the four screen sizes, listening, the playtests) was **not
run here**, and this file says so wherever it applies. Nothing below claims a result that no command named next to it produced.

## What this attempt found and changed

| Problem | Fix | How it was checked |
| --- | --- | --- |
| Beta ran `night-shift-signoff` for 22 min 50 s (budget 10 min) | The scenario takes a start point, `{"at":"last-choices"}` (listed in its `starts`): each ending from a **seeded run** (the setup shortcut the other Night Shift scenarios use, event `seeded-run`) 2 choices before it (`{"back":4}` for more), then real presses and the end screen, at all four sizes. `.hawkes/scenario.txt` names it. No `at` still plays every way whole from a new run (the full sign-off, about 50 min) | `node --check`, `npm run test:playtest` (569 helpers defined). **Not run in a browser**, so its time is an estimate: 48 plays of 3 scenes each, about 8 minutes |
| Beta reported 14 "shows although its conditions fail" bugs per size | I could **not reproduce it**: the real player (`js/console.js`) driven by presses in jsdom, on the fewest-choices way to all 12 endings, shows exactly the choices whose conditions hold at all 988 scenes entered (`npm run test:endings`). What I did change is the check and the press: both now go by the choice's index (`data-choice`), not its label (43 scenes hold choices sharing a label, "Wait for him" up to four times, so label matching could press or count the wrong one). The message now names the choice, its index and the state, and a missing button is reported too | `npm run test:endings`, `npm run test:playtest`. If beta still reports it, the message now says which choice and state, which is what the next attempt needs |
| 844x390 end screen needed a scroll | In a short landscape screen at an ending the subtitles are capped at 3.2 rem, the end card at 24% of the height and the ending's name is smaller (`css/site.css`, console block). By arithmetic that gives back about 60 px; **not seen in a browser** | none possible here |
| `end-under-review` end card had "Under review:" baked into the picture | Cropped the bottom 16% off the 1024x576 still and scaled back to 16:9 (no generation); the other eleven cards had no caption | looked at the new picture |
| 5 voice lines from the script polish were off level (`day-officer-let` line 2 at -13.8 LUFS, `day-officer` 3 -20.4, `end-friendly` 3 -19.8, `hours-ink` 2 -22.8, `hours-refused` 1 -20.6) | Gain and a limiter on those five files | ffmpeg `ebur128` on all 1,330 lines: now every line between -22.8 and -13.8 before, **-19.1 to -14.6** after (only these five were outside -19.5 to -14); `--dur` sets 0 lines; `npm run story -- --check` up to date |
| No way to walk every ending without a browser | `tools/test-endings.mjs` (`npm run test:endings`, needs jsdom): plays each ending through the real player by button presses and checks, at every scene, the scene reached, the exact buttons, the subtitles in order, every recording, bed, camera picture and end card on disk, and the ending shown | all 12 ok (below) |

## Play time, per ending

Played by `npm run test:endings` (the way the playtest presses: the fewest choices to the ending; minutes are each line's
recording plus the player's 0.35 s gap, from the data, not timed on a clock), and the shortest and longest way to each ending
from `node tools/ending-times.mjs --md` (240,000-plus states).

| Ending | Scene | Way pressed: choices | Way pressed: min | Shortest way (min) | Longest way (min) |
| --- | --- | ---: | ---: | ---: | ---: |
| Clean report. | `end-clean` | 79 | 42.7 | 40.0 | 52.7 |
| Someone to leave it to. | `end-someone` | 79 | 42.7 | 40.2 | 52.6 |
| She knew. | `end-she-knew` | 79 | 42.8 | 40.2 | 52.6 |
| Eat something. | `end-eat-something` | 79 | 42.7 | 40.0 | 52.8 |
| By the book, alone. | `end-by-the-book` | 81 | 43.7 | 41.3 | 51.4 |
| The friendly one. | `end-friendly` | 79 | 43.0 | 39.5 | 53.3 |
| Opinions. | `end-opinions` | 79 | 42.8 | 39.3 | 53.1 |
| Four minutes. | `end-four-hours` | 78 | 41.9 | 38.6 | 52.5 |
| Written up. | `end-written-up` | 77 | 42.3 | 38.8 | 53.1 |
| The wedge. | `end-wedge` | 77 | 42.1 | 38.6 | 52.2 |
| Noted. | `end-noted` | 79 | 42.8 | 39.4 | 52.7 |
| Under review. | `end-under-review` | 79 | 42.8 | 40.3 | 52.6 |

Whole night: shortest 38.6, average 44.7 (every open choice equally likely), median 44.7 (3,000 random plays: 10% 43.3, 90% 46.2),
longest 53.3 minutes (`node tools/check-night-shift.mjs`; 241 scenes, 1,330 lines, 12 endings, 123.4 minutes of recordings in all).

## Walk of every ending

| Ending | Real player, presses (jsdom) | Desktop | 390x844 | 360x640 | 844x390 |
| --- | --- | --- | --- | --- | --- |
| all 12 | **ok, 0 problems** | not run | not run | not run | not run |

The jsdom walk is the real `js/console.js` and `js/console-rules.js` pressed button by button, with the lines ended at once. It
proves the logic: no dead end, no choice that does nothing, no wrong or missing button, subtitles are the lines in order, every
recording, bed, camera picture and end card exists, every ending is shown. It cannot see a layout, hear a voice, or tell sound from
silence. **The four-size walk with a real click and sound has not been done**: this server may not start a browser (it starved
Studio and Gen of memory). `night-shift-signoff` does it on the T4 (`{"at":"last-choices"}` about 8 minutes; without options each
ending whole, about 50 minutes), so "clean at desktop and the three phone sizes" stays **unproven** until it runs.

Not checked by anyone yet: loudness jumps in real playback, clipped or overlapping lines, subtitle sync, a wrong-sounding voice,
a wrong speaker image (the wall shows cameras, not speakers; each scene's `focus` camera was not looked at one by one).

## What the data says, from commands that were run

- **Missing or stale media:** none. `node tools/make-audio.mjs night-shift --list`: 6 of 1,364 have no file, the 6 music stings (below).
  `npm run story -- --check`: `ok 4 stories, 289 scenes, everything generated is up to date`. All 1,330 `line-*.mp3` decode with a
  length within 0.6 s of the line's `dur` and under `dur` + 4 s (the player's give-up timer). The 10 beds and 18 effects exist.
- **Stand-in images:** none. `night-shift/media/standin` is gone; the 26 camera pictures and 12 end cards are real generated stills (looked at on
  contact sheets: control-room and building cameras; nothing shows B3, a vat or a creature; the one caption is removed, above).
- **Loudness (ffmpeg `ebur128`):** voices median -16.6 LUFS, 5th percentile -18.4, 95th -15.5, after the fix none outside -19.1 to
  -14.6, loudest sample peak -1.4 dBFS. Beds -37 to -48 LUFS (roof -48.1, stairwell -43.9, vestibule -41.8, elevator -41.7 read low
  in LUFS; their RMS was set to -36 dB by `--beds` in #47, 18 dB or more under the voice), effects -25.5 to -27.7 (about 10 dB under).
- **A choice that did nothing, a dead end:** 0 decisions that change nothing, no stuck state, 12 endings, all 241 scenes reachable
  (`npm run story`, `node tools/check-night-shift.mjs`, `npm run test:endings`).
- **The trainer's reveal layers:** all four reachable: the pencil (`sign-why`, `sign-why-44`) after 12 choices, the spring
  (`drawer-notice`) 22, the four hours (`four-hours`) 44, twelve (`twelve`) 65; one way meets all four (83 choices).
- **Pierce Hawkes:** two lines in two cameo scenes only: `coat-lobby` "Evening. Don't get up." (*to the guard, not stopping, mild*) and
  `pierce-signin` "Fair. Fifty-eight. I own it. Put that in your log." (*a pause, an actual smile*), voice ZthjuvLPty3kTMaNKVKb
  (PH Origins' Jackson voice). Short, assured, no speech: in character on the page. Not heard.
- **B3, the vat, the creature:** none. A scan of every string in `story/night-shift.json` (scene titles, lines, `perform` notes, choices,
  logs, endings) and the 1,417 Night Shift recipes in `hawkes.assets.json` (voice texts, image and sound prompts) for the story's
  whole `unspoken` list (restricted, chimera, creature, experiment, b3, vat, specimen, laboratory) found 0 hits outside the `unspoken` list
  itself. `story/night-shift.md` has them only in the sentence that forbids them. Images were looked at, not read.

## Checks that were run (2026-10-25)

| Command | Result |
| --- | --- |
| `npm run story -- --check` | `ok 4 stories, 289 scenes, everything generated is up to date` |
| `node tools/check-night-shift.mjs` | `ok night-shift` (numbers above) |
| `npm run test:console` | all ok |
| `npm run test:playtest` | `ok js/playtest.js: every called helper is defined (569 names declared)` |
| `npm run test:player` (jsdom in a scratch folder) | all ok |
| `npm run test:endings` (jsdom) | all ok: 12 endings played by real presses |
| `node tools/make-audio.mjs night-shift --list` | 6 of 1,364 without a file: the music stings |
| ffmpeg `ebur128` on 1,330 lines, 10 beds, 18 effects; ffprobe on every line | see above |

## Playtests: NOT RUN

`smoke`, `stories`, `branches`, `pages`, `sound`, `blog`, `credits`, `analytics`, `console`, `night-shift`, `night-shift-audio`,
`cctv-art` and `night-shift-signoff` need a browser. None was run here, for any of the three stories (The Final Spark, The Water
Road, Night Shift), so this file has no output of them. Beta's playtest runs `night-shift-signoff` with `{"at":"last-choices"}`;
J or Talk can ask for the rest on the T4.

## Left unfixed

1. **Six music stings are not made** (`shift-begins`, `the-panel`, `fifty-eight`, `ending-plain`, `ending-warm`, `ending-cold`; recipes
   `night-shift-music-*`, 20 s each). They play on `handover`, `pierce-signin`, the four `trouble-signal-*` scenes and all 12 endings, so
   each ending plays without the sting it was designed with (the player copes: the cue is empty). `audio.music` is a GPU tool
   and this task has no GPU budget. `hawkesgen_estimate` (6 clips): 66 GPU-seconds on one ACE-Step server, **$0.09**, or **$0.71**
   counting the 20-minute idle tail if the server isn't stopped at once. Needs J's OK; then
   `node tools/make-audio.mjs night-shift --ingest <folder>` and `npm run story`.
2. **The four-size walk and every playtest are unproven** (above). The 844x390 end screen fix and the end-card crop are unseen.
3. **No listen.** Nobody has heard the voices in playback: whether a `perform` tag was read aloud, a voice drifts, two speakers sound alike.
4. **The "14 shows although" report is not explained.** The player is right in jsdom; the check was made stricter and clearer (above).
   If beta reports it again, the message now says which choice and state.
5. **Speaker treatments are not applied** (radio, walkie, intercom and phone lines are clean recordings): needs an ffmpeg step per speaker in `tools/make-audio.mjs`.
6. `story/night-shift.md` ("228 scenes") and `story/night-shift-gaps.md` still carry counts from before the script polish (now 241 scenes, 1,330 lines).
