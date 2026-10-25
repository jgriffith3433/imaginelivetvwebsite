# Night Shift: sign-off

Written 2026-10-25 (third attempt, on top of beta at `22c5b65`). **Verdict: not proven clean.** What a server with no browser can
run is clean (listed with its output below). What needs a browser (the four screen sizes, listening, the playtests) was **not
run here**, and this file says so wherever it applies. (Since then the T4 has played all 12 endings at the four sizes: 48 plays, 0 console errors, the ending shown each time; see `story/night-shift-gaps.md`, item 57. The "not run" cells in the table below are the state of this attempt.) Nothing below claims a result that no command named next to it produced.

## What this attempt found and changed

| Problem | Fix | How it was checked |
| --- | --- | --- |
| Beta ran `night-shift-signoff` for 22 min 50 s (budget 10 min) | The scenario takes a start point, `{"at":"last-choices"}` (listed in its `starts`): each ending from a **seeded run** (the setup shortcut the other Night Shift scenarios use, event `seeded-run`) 2 choices before it (`{"back":4}` for more), then real presses and the end screen, at all four sizes. `.hawkes/scenario.txt` names it. No `at` still plays every way whole from a new run (the full sign-off, about 50 min) | `node --check`, `npm run test:playtest` (569 helpers defined). **Not run in a browser**, so its time is an estimate: 48 plays of 3 scenes each, about 8 minutes |
| Beta reported 14 "shows although its conditions fail" bugs per size | I could **not reproduce it**: the real player (`js/console.js`) driven by presses in jsdom, on the fewest-choices way to all 12 endings, shows exactly the choices whose conditions hold at all 957 scenes entered (`npm run test:endings`). What I did change is the check and the press: both now go by the choice's index (`data-choice`), not its label (43 scenes hold choices sharing a label, "Wait for him" up to four times, so label matching could press or count the wrong one). The message now names the choice, its index and the state, and a missing button is reported too | `npm run test:endings`, `npm run test:playtest`. If beta still reports it, the message now says which choice and state, which is what the next attempt needs |
| 844x390 end screen needed a scroll | In a short landscape screen at an ending the subtitles are capped at 3.2 rem, the end card at 24% of the height and the ending's name is smaller (`css/site.css`, console block). By arithmetic that gives back about 60 px; **not seen in a browser** | none possible here |
| `end-under-review` end card had "Under review:" baked into the picture | Cropped the bottom 16% off the 1024x576 still and scaled back to 16:9 (no generation); the other eleven cards had no caption | looked at the new picture |
| 5 voice lines from the script polish were off level (`day-officer-let` line 2 at -13.8 LUFS, `day-officer` 3 -20.4, `end-friendly` 3 -19.8, `hours-ink` 2 -22.8, `hours-refused` 1 -20.6) | Gain and a limiter on those five files | ffmpeg `ebur128` on all 1,330 lines: before: -22.8 to -13.8 (only these five were outside -19.5 to -14); after: **-19.1 to -14.6**; `--dur` sets 0 lines; `npm run story -- --check` up to date |
| No way to walk every ending without a browser | `tools/test-endings.mjs` (`npm run test:endings`, needs jsdom): plays each ending through the real player by button presses and checks, at every scene, the scene reached, the exact buttons, the subtitles in order, every recording, bed, camera picture and end card on disk, and the ending shown | all 12 ok (below) |

## Play time, per ending

Played by `npm run test:endings` (the way the playtest presses: the fewest choices to the ending; minutes are each line's
recording plus the player's 0.35 s gap, from the data, not timed on a clock), and the shortest and longest way to each ending
from `node tools/ending-times.mjs --md` (240,000-plus states).

| Ending | Scene | Shortest way (min) | Longest way (min) | Choices on the shortest way |
| --- | --- | ---: | ---: | ---: |
| Four minutes. | `end-four-hours` | 39.3 | 53.7 | 81 |
| The wedge. | `end-wedge` | 39.4 | 53.4 | 81 |
| Written up. | `end-written-up` | 39.6 | 54.3 | 81 |
| Opinions. | `end-opinions` | 40.1 | 54.3 | 83 |
| Noted. | `end-noted` | 40.1 | 53.9 | 83 |
| The friendly one. | `end-friendly` | 40.3 | 54.5 | 83 |
| Clean report. | `end-clean` | 40.7 | 53.9 | 83 |
| Eat something. | `end-eat-something` | 40.8 | 54.0 | 83 |
| Someone to leave it to. | `end-someone` | 40.9 | 53.8 | 82 |
| She knew. | `end-she-knew` | 41.0 | 53.8 | 82 |
| Under review. | `end-under-review` | 41.1 | 53.8 | 82 |
| By the book, alone. | `end-by-the-book` | 42.1 | 52.6 | 86 |

Whole night (2026-10-25, after the echo scenes): shortest 39.3, average 45.6 (every open choice equally likely), median 45.6 (3,000 random plays: 10% 44.1, 90% 47.1),
longest 54.5 minutes (`node tools/check-night-shift.mjs`; 256 scenes, 1,376 lines, 658 choices, 12 endings). The table above is from `node tools/ending-times.mjs --md`; "way pressed" minutes were last measured before the echo scenes (they add about 40 seconds to the ways that pass them).

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

- **Missing or stale media:** none. `node tools/make-audio.mjs night-shift --list`: 46 of 1,410 have no file: the 46 lines of the 15 echo scenes (the stings were made in #51).
  `npm run story -- --check`: `ok 4 stories, 304 scenes, everything generated is up to date`. 1,330 of 1,376 `line-*.mp3` decode with a
  length within 0.6 s of the line's `dur` and under `dur` + 4 s (the player's give-up timer). The 10 beds and 18 effects exist.
- **Stand-in images:** none. `night-shift/media/standin` is gone; the 26 camera pictures and 12 end cards are real generated stills (looked at on
  contact sheets: control-room and building cameras; nothing shows B3, a vat or a creature; the one caption is removed, above).
- **Loudness (ffmpeg `ebur128`):** voices median -16.6 LUFS, 5th percentile -18.4, 95th -15.5, after the fix none outside -19.1 to
  -14.6, loudest sample peak -1.4 dBFS. Beds -37 to -48 LUFS (roof -48.1, stairwell -43.9, vestibule -41.8, elevator -41.7 read low
  in LUFS; their RMS was set to -36 dB by `--beds` in #47, 18 dB or more under the voice), effects -25.5 to -27.7 (about 10 dB under).
- **A choice that did nothing, a dead end:** 0 decisions that change nothing, no stuck state, 12 endings, all 256 scenes reachable
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

## Checks that were run (2026-10-25, on `224a9f5`, #54)

| Command | Result |
| --- | --- |
| `npm run story -- --check` | `ok 4 stories, 304 scenes, everything generated is up to date` |
| `node tools/check-night-shift.mjs` | `ok night-shift`: 256 scenes, 1,376 lines, 12 endings, 0 decisions that change nothing, shortest 39.3 / average 45.6 / longest 54.5 min, Pierce in `coat-lobby` and `pierce-signin` only |
| `npm run test:console` | all ok |
| `npm run test:playtest` | `ok js/playtest.js: every called helper is defined (645 names declared)` |
| `npm run test:player` (jsdom in a scratch folder) | all ok |
| `npm run test:endings` (jsdom) | **FAILS: 75 problems.** Every ending fails the same way: "no recording" for the lines of the 15 echo scenes it passes (e.g. `end-under-review` at `lobby-exact-w`). The shown buttons, subtitles, beds, pictures and end cards are fine; only the missing recordings fail |
| `node tools/make-audio.mjs night-shift --list` | **46 of 1,410 have no file**: the 46 lines of the 15 echo scenes. No music is unmade (the six stings exist since #51) |
| `hawkesgen_run audio.voice` on one of the 46 (retried 2026-10-25) | **refused**: ElevenLabs 401 `payment_issue` ("failed or incomplete payment"), job `j_0017f2fd955e` |
| ffmpeg `ebur128` loudness | not re-run in this pass (no new recordings since the numbers above) |

## Playtests: NOT RUN for the merged commit

I looked for beta's reports for `224a9f5` and there are none: the newest Studio daily report is `r_fa49e962e7d1` (2026-10-24, before #50 to #54),
and the Gen job store holds no `playtest.run` newer than the T4 runs quoted in `story/night-shift-gaps.md` (`night-shift-signoff` `j_8e0e16c7bc4d`,
which ran before the fixes of #50 to #54). So, for the merged commit:

| Scenario | Result |
| --- | --- |
| `night-shift-signoff` at desktop, 390x844, 360x640, 844x390, 12 endings | **not run** |
| `console` (real story leg), `stories`, `branches`, `pages`, `sound`, `blog`, `credits`, `analytics`, `cctv-art`, `night-shift-audio`, `night-shift-card` | **not run** |

`.hawkes/scenario.txt` names `night-shift-signoff` with `{"at":"last-choices"}`; the other scenarios are in `js/playtest.js` and the beta list
(`AGENTS.md`). The "0 bugs" criteria are **not met by any report yet**, and nothing here claims they are.

## Status on `6182b85` (#60), 2026-10-25 (third attempt)

Nothing new is claimed. What was looked at, and what was found:

- **Reports:** the newest Studio report is still `r_fa49e962e7d1` (2026-10-24, before #50 to #60). Gen's job store holds no `playtest.run` for `6182b85`:
  `night-shift-signoff` `j_55e8a96b943b` is **cancelled** (no result), and the finished runs are older `night-shift-gaps`, `night-shift-treatment`, `console`,
  `night-shift-card` and `night-shift-audio` at desktop. Every scenario in the criteria is therefore **not run** for this commit; no run id is cited because none
  belongs to it.
- **ElevenLabs:** still blocked. The newest voice job, `j_f61bbb6b4f1e`, failed with "blocked by an unpaid invoice; J must pay it. Do not retry (401)". It was not retried.
  `node tools/make-audio.mjs night-shift --list`: **46 of 1,410 have no file** (the 15 echo scenes), so `npm run test:endings` still fails on exactly those.
- **Analytics collect 502:** no beta report shows it for this commit, so which side it comes from (this site or Studio's endpoint) is **not known**.
  The site only posts through the SDK copy and `quietAnalytics()` swallows it outside the `analytics` run; nothing was changed.
- **The beta scenario list** is `playtests` for `imaginelivetv` in `hawkesstudio/products.json` (smoke, branches, blog local, smoke live, smoke live phone). It is
  Studio's file, not this repo's, so it was not edited here. The scenarios exist in `js/playtest.js` (stories, night-shift-card, night-shift-treatment, night-shift-audio, console,
  night-shift, night-shift-gaps, night-shift-signoff, cctv-art, credits, sound, analytics, plus smoke, branches, pages, blog).
- **Checked by command today:** `npm run story -- --check` ok (4 stories, 304 scenes, nothing stale); `node tools/check-night-shift.mjs` ok (12 endings, 0 choices that change nothing).
- **GPU:** none needed, none used.

## Blocked, not done (not J's listening or reading)

1. **46 voice lines are unrecorded** (the 15 echo scenes). ElevenLabs refuses every call: the account's invoice is unpaid (J). When it is paid:
   `node tools/make-audio.mjs night-shift --reuse`, `hawkesgen_run audio.voice` per listed line (about 1.2 dollars), `--ingest`, `--mix`, `--dur`,
   `npm run story`. Until then `npm run test:endings` and `night-shift-audio` fail on the unmade lines and those lines play on a timer.
2. **Beta's playtest of the merged commit** has to run (nobody can start it from here): `night-shift-signoff` at the four sizes, then the other scenarios above.
   Fix what they report.

## Left

1. **J's own listening to the voices and reading the script.** No agent has heard a voice or read the whole night as a viewer: a `perform` tag read aloud,
   a drifting voice, two speakers alike, a wrong-sounding treatment, a line that reads badly.
