# Night Shift: gaps audit

Audit of Night Shift as it is on beta at `d3408c0` (#43), 2026-10-25. **The numbered items below are the audit as written; "Script pass" right after
the headline says what each script finding (group c and the text items of the other groups) became.** It replaces the two earlier audits of this file, which were written
before the voices, the camera art, the listing and the engine fixes (#29 to #43) and were partly out of date (their repairs were pasted under
a "Status" section; those items are now folded in or withdrawn). **Nothing was fixed in the audit itself**: it is a list. File names are
repo-relative. Counts are from `story/night-shift.json` as audited (228 scenes, 1,288 lines, 621 choices, 12 endings; now 256 scenes, 1,376 lines, 658 choices, 12 endings), `hawkes.assets.json` (1,375
Night Shift assets) and the files on disk, by scripts named in the text.

**Headline (after the second script pass, 2026-10-25).** Shortest way through: **39.3 minutes**. Typical way (average, equal to the median): **45.6 minutes**. Longest: 54.5 minutes
(each line's recording plus the player's 0.35 s gap; `node tools/check-night-shift.mjs`). By the brief's other clock, words at 150 a minute plus
one second of pause per line, the ways are 40.6 (shortest), 47.4 (typical) and 56.4 minutes (item 17: before the pass they were 38.2, 44.6 and 53.2). 1,330 of 1,376 lines are recorded, all 10
beds, 18 effects, 6 stings (made in #51), 26 camera pictures, 12 end cards and the landing card exist. **Unmade: the 46 lines of the 15 echo scenes** (ElevenLabs refused the calls: failed payment on the account).
What is open is mostly *proof*: the browser playtests that did run on beta's T4 (job ids in the appendix) show the story plays, and also
show that **most of their red flags are the bot's own mistakes** (items 51 and 52), that `console` plays only the 5-scene demo, and that
`sound`, `branches`, `pages`, `analytics`, `credits` and `blog` have no T4 run at all.

## Script pass (2026-10-25): what each script finding became

Every script finding is **fixed** (the data changed), **explained** (it is the design, now written in `story/night-shift.md`), or **left** (art, audio
treatment or proof: not script). Checks: `npm run story -- --check`, `node tools/check-night-shift.mjs` (now also page length and the banned
patterns over titles, logs and ending names), the state explorer (257,606 states, 0 stuck, 241 of 241 scenes and 12 of 12 endings reachable).
New recordings: 64 lines (about $2), every other line kept its file (`node tools/make-audio.mjs night-shift --reuse`).

| Item | What it became |
| --- | --- |
| 16, 17 timing | Fixed: shortest 38.6 (was 36.4), typical 44.7 (was 42.2), longest 53.3, from the recordings. Real scenes added on the way every player takes: the Zurich call (01:42), the day officer's badge (05:32), Dee signing the hours sheet (05:56), the last-twenty-minutes reactions (06:12). |
| 18 | Left: the sign-off table lists least audio, the played walk the fewest choices; both are right. |
| 19, 20 random player meets 5 of 12, best endings sit on few states | Explained: the good endings are meant to be earned (`story/night-shift.md`, the ending table). Each of the 12 is reached under conditions no other ending shares (`check-night-shift.mjs` fails on a duplicate). |
| 21 the 53 "routing" buttons | Explained: a press to go on, a gated variant or a log-wording choice (`story/night-shift.md`, "Every choice changes something"). Each writes its own shift-log line, and the build and the checker prove that no button that sits beside a differently worded one changes nothing. |
| 22 nine "Open the log" buttons with no log line | Fixed: each of `rice-split`, `rice-hers`, `rice-log` now writes its own line. |
| 23 one button hides several outcomes | Explained, and fixed where it misled: the reading scenes (`okafor-reads-*`) no longer name events only some ways have, and the endings that followed them open on the room. |
| 24 scenes with one button | Explained (a press to go on). |
| 25 scenes that send every choice to the same scene | Fixed for the four `shift-prep-*`: the cup, the radios and the drawer now each have a scene (`prep-cup`, `prep-radios`, `prep-drawer`, `prep-drawer-knew`). The rest are the log-wording choices, explained. |
| 26 repeated labels | Explained (gated variants). |
| 27 pages over seven lines | Explained and enforced: the guide says up to twelve where a page is one whole exchange; the checker fails above twelve lines or 170 words. |
| 28 Dee's "Mm." | Fixed: eight bare "Mm." that carried nothing are cut (it stays where it is her "I'm sorry": after Okafor reads the log, after a lie, at the ledge). |
| 29 titles, logs, tagline not linted | Fixed: `check-night-shift.mjs` runs the banned patterns and stated feelings over them (0 hits). |
| 30 not read in full | Done once: the whole script was read for this pass. Found and fixed: `end-by-the-book` said 06:52 at 07:02; `okafor-reads-slips`, `okafor-reads-sloppy`, `end-opinions` and `end-friendly` named a contractor, a box, "seemed harmless", an initial at 2224 that not every way has; `end-wedge` said the player read page eleven when the way may have skipped it. Four Dee lines that read as written were said plainly. |
| 31 two endings open on the same words | Fixed: `end-under-review` has its own Okafor (he has not seen the notice and asks for it). |
| 32 nine endings open mid-conversation | Fixed: each opens on a narrator line (time, who is at the desk, one object). |
| 33 scene `four-hours` and ending `end-four-hours` share a stem | Explained: the id stays (the recipes and folders are keyed by it); the ending's title is "Four minutes." and its scene says so. |
| 56 `story/night-shift.md` stale | Fixed: section 6 is a pointer, "Waiting for J" no longer asks about money already spent, the new scenes and the three kinds of button are written down. |
| 10 camera pictures no scene shows | Left (art): `c9:trouble` would contradict the frozen tile nine in the same scenes. |
| 8, 9 effects, copies, 1 to 7 audio, (b) art, (d) engine, (e) landing, 53 to 55, 57 to 60 | Left: not script. |

## Second script pass (2026-10-25): echo scenes, the nine endings, the docs

Run after the speaker treatments (#53). Checks: `npm run story -- --check` ok (4 stories, 304 scenes), `node tools/check-night-shift.mjs` (0 problems; 256 scenes, 1,376 lines, 658 choices, 12 endings,
274,590 states, 0 stuck, 0 decisions that change nothing; shortest 39.3 minutes, average 45.6, longest 54.5).

**Item 25, the scenes that send every choice to the same next scene.** The audit listed 14; four (`shift-prep-*`) were fixed in the first pass, so ten were left.
Each button now goes to a scene of its own that answers what the player did, then on to the old next scene. The old flags, meters and
shift-log lines are untouched (they still gate what they gated; `opined` is still read by `okafor-call`, `late-okafor` and the rest). The trace, per scene:

| Scene | Button | New scene (then on to) | What the player hears afterwards |
| --- | --- | --- | --- |
| `okafor-out-fast` | Count them with her | `out-counted` (`the-chairs`) | Dee: "You count with your finger." Do it again at six. |
| | Ask what she's counting | `out-asked` (`the-chairs`) | Dee: "Radios." If it is three, that is a log. |
| `nephew-held` | Tell Marisol: tomorrow | `held-tomorrow` (`log-held`) | Marisol on the walkie: "I hold you to tomorrow." |
| | Ask Dee to talk to her | `held-dee` (`log-held`) | Dee: "It was yours to say." She keys the walkie herself. |
| `dev-ok`, `dev-stay`, `dev-company`, `dev-911`, `dev-dee` | Log it exactly | `entry-exact` (`coat-lobby`) | Dee reads the field: "Times. Floor. Name." |
| | Add what you thought | `entry-thought` (`coat-lobby`) | Dee: "'Seemed.' He will circle that." |
| | Leave it out | `entry-blank` (`coat-lobby`) | Dee: "Blank is a line too. He reads those first." |
| `pierce-waved` | the same three | `lobby-exact-w`, `lobby-thought-w`, `lobby-blank-w` (`dee-back-waved`) | Dee on the lobby field: what the camera says against what the tablet says |
| `pierce-signin` | the same three | `lobby-exact-s`, `lobby-thought-s`, `lobby-blank-s` (`dee-back-signed`) | the same, for the visitor sheet |
| `adler-arrives-l` | Correct the entry now | `adler-corrected` (`dev-signout`) | Adler: "That is the entry." She initials beneath it. |
| | Initial the log beside hers | `adler-initialed` (`dev-signout`) | Adler: "Yours is above it. I did not read yours." (the `lied` flag stays set) |

Fifteen new scenes at the end of `scenes` (46 lines, about 40 seconds on the ways that pass them). The two `dee-back-*` scenes moved from 03:30 to 03:34, after the new scenes.

**Item 32, nine endings that open mid-conversation.** Already fixed in the first pass: each of the nine endings opens on a narrator line (time, who is at the desk, one object). Checked now: the nine first-line recordings
(`night-shift/end-*/media/line-1.mp3`) exist, are in the narrator's locked voice (`IFbrwI7VRvX2VkoD4Y3K`), and measure -16.5 to -17.5 LUFS (window -19.1 to -14.6). Nothing to record.

**Items 26 to 33 that were left.** 26 (repeated labels), 27 (long pages), 28, 29, 30, 31, 33: fixed or explained in the first pass's table above; nothing further is open. The echo scenes pass the checker's voice rules.

**Unrecorded: the 46 lines of the echo scenes.** The `audio.voice` runs (estimate 1.2 dollars, approved) all failed with ElevenLabs 401 `payment_issue` (failed or incomplete payment). Nothing was spent. When the account is paid:
`node tools/make-audio.mjs night-shift --list`, one `hawkesgen_run audio.voice` per recipe in `hawkes.assets.json`, `--ingest`, `--mix`, `--dur`, `npm run story`. Until then the lines play on a timer.

**Items 55 to 58 (docs).** `story/night-shift.md`, `story/night-shift-signoff.md` and this file carry the current counts; the signoff's stale "not done" list was brought up to date; `story/README.md` has the lines on the console scenarios;
`story/night-shift-slice-notes.md` says it is history. `AGENTS.md` was not touched (an agent's brief does not edit it).

## How this was checked, and what was not

- Run here, output pasted in the appendix: `npm run story -- --check`, `node tools/check-night-shift.mjs`, `npm run test:console`,
  `npm run test:playtest`, `node tools/make-audio.mjs night-shift --list`, `node tools/ending-times.mjs`, and `hawkesgen_estimate` for the
  music. Scripts of this audit read `story/night-shift.json` and the media folders directly and ran the state explorer
  (`js/console-rules.js`: 240,254 states, uncapped, 0 stuck).
- **No browser was started on this server** (it starved Studio and Gen of memory). The playtest reports in the appendix are the **real reports
  of earlier T4 runs of `console`, `stories`, `night-shift`, `night-shift-audio`, `night-shift-signoff`, `cctv-art` and
  `night-shift-gaps`**, read out of Hawkes Gen's job store (`hawkesgen_jobs`, project `imaginelivetv`, the 500 newest jobs) and pasted as
  they are, with the job id. Gen does not record the commit a job ran on; they are the runs of 2026-10-25 after Night Shift was listed
  (#42), the newest of each scenario.
- **`sound` has never run on the T4** (and neither have `branches`, `pages`, `analytics`, `credits`, `blog`: none appears in the 500 newest
  jobs). There is no report of it to paste; the appendix says so under `#### sound` and lists the sound evidence the other runs do hold.
  Asking Talk for a `sound` playtest closes it (item 59).
- Group (d) has real browser numbers where a T4 run covered the point and says "not measured" where none did.
- Where this audit says "false positive", it traced the bot's check against the data (items 51, 52).

## (a) Audio: lines and cues with no made file

Lines (data against the files `night-shift/<folder>/media/line-N.mp3`): **1,288 of 1,288 made, 0 unmade, in 0 of 228 scenes.** Per speaker,
lines / made / unmade, and whether the voice is locked (`speakers.<id>.voice` in `story/night-shift.json`; all 11 are **locked**, none unlocked):

| Speaker | Lines | Made | Unmade | Voice |
| --- | ---: | ---: | ---: | --- |
| dee | 606 | 606 | 0 | locked |
| narrator | 445 | 445 | 0 | locked |
| okafor | 95 | 95 | 0 | locked |
| marisol | 49 | 49 | 0 | locked |
| terrell | 40 | 40 | 0 | locked |
| adler | 24 | 24 | 0 | locked |
| dev | 14 | 14 | 0 | locked |
| brandt | 5 | 5 | 0 | locked |
| courier | 5 | 5 | 0 | locked |
| sleeper | 3 | 3 | 0 | locked |
| pierce | 2 | 2 | 0 | locked (PH Origins' Jackson voice, unmodified) |

Cues: ambience beds 10 of 10 made and used (`control-room` 93 scenes, `control-room-late` 62, `morning` 18, `lobby` 14, `vestibule` 9, `stairwell` 8,
`dock` 8, `elevator` 8, `corridor` 5, `roof` 3). Effects 18 of 18 made and used (159 lines play one). Music stings: **0 of 6 made**.

1. **Music: 6 of 6 stings have no file.** `night-shift/media/music/{shift-begins,the-panel,fifty-eight,ending-plain,ending-warm,ending-cold}.mp3`;
   recipes `night-shift-music-*` in `hawkes.assets.json` (`audio.music`, 20 s, ACE-Step); `node tools/make-audio.mjs night-shift --list`
   lists exactly these 6. 18 scenes name a cue: `shift-begins` in `handover`; `fifty-eight` in `pierce-signin`; `the-panel` in the four
   `trouble-signal-*`; `ending-plain` in 6 endings (clean, by-the-book, opinions, noted, under-review, written-up), `ending-cold` in 4
   (someone, she-knew, four-hours, wedge), `ending-warm` in 2 (eat-something, friendly). `hawkesgen_estimate` (project imaginelivetv):
   **61 GPU-seconds, $0.08 GPU, $0.70 with the idle tail (stopping the server at once avoids it), about 3 minutes, 1 server**. Needs J's GPU
   approval; none was used. Fix: approve, make them, then `node tools/make-audio.mjs night-shift --mix` and `npm run story`.
2. **(Fixed 2026-10-25: `night-shift-audio` reports one warning.) One missing file was reported 19 times.** On the T4 `night-shift-audio` run (`j_a4a2b9c3d15c`) the 6 unmade stings are 18 `bug`s ("the music cue
   ending-plain isn't in the story's music", one per scene that names it) plus one `warning` ("6 music stings are designed but not made yet"). A
   reviewer reads 18 bugs for one known cause. Fix: report one warning in `js/playtest.js` (`night-shift-audio`) while the stings are unmade, or leave the
   `music` field off those scenes until the files exist.
3. **(Fixed 2026-10-25, `--beds`.) The bed `control-room-late` jumped 6.4 dB where it loops** (`night-shift-audio`, T4). It is the most used bed (62 scenes, the whole small hours), so
   the loop point is heard every time the bed repeats. Fix: re-cut the file `night-shift/media/ambience/control-room-late.mp3` with a crossfade at the
   loop, then `--mix`.
4. **(Fixed 2026-10-25, `--beds`: every bed is at -36 dB RMS or lower.) Two beds were too loud under the voice**: `roof` is 8.7 dB under the voice (3 scenes), `stairwell` 11.5 dB (8 scenes); the scenario's bar and the
   story rule are 12 dB (`night-shift-audio`, T4). The other 8 beds pass. Fix: `--mix` them 3.3 dB and 0.5 dB lower.
5. **Treatments are not applied** (`story/night-shift.md` "Voices as made": "the recordings are clean"). The voice sheets ask for a radio, walkie, intercom
   or phone sound: Okafor on the night line (7 lines in `okafor-call*`, plus `sleeper-super`), Marisol on the walkie (6 lines in `sign-why`/`sign-why-44`,
   and her `marisol-*` scenes), Dev on a tinny intercom (all 14 of his lines), Adler on the phone (24 lines, `adler-call` and her `adler-*` scenes),
   the courier on the dock intercom (5), Pierce "heard from across a lobby" (2). Fix: an ffmpeg filter step per scene and speaker in `tools/make-audio.mjs`.
6. **No one has listened, and nothing checks that a recording says its text.** `night-shift-audio` proves each file loads, decodes, fits `dur` + 4 s and
   sits within 4 dB of its speaker's other lines (measured: spread 3 dB); it cannot hear a dropped or invented word, a wrong `perform` reading, or an
   odd take in 851 distinct generated texts. The sign-off (`story/night-shift-signoff.md`) says it did not listen either. Gen has no speech-to-text tool
   (`hawkesgen_tools` finds only `audio.voice`, `audio.voice-change`, `video.perform`). Fix: a local transcription pass comparing each file with its `text`, then one
   listen of the 12 endings and the 4 reveal layers.
7. **The voices were picked by description, not by ear, and J has not auditioned them** (`story/night-shift.md` "Voices as made": "candidate 1 of 3 kept ...
   so J may swap any"). Swapping a voice re-records its lines: Dee 606, narrator 445, Okafor 95 (the sign-off put a line at about $0.025). Fix: J listens to
   one scene per speaker (`handover`, `end-someone`, `okafor-call`) before more is built on them.
8. **Effects are rare**: only the 159 lines with an `sfx` play one; **103 of 228 scenes have no effect at all** and play bed and voice only. Gap in use, not
   in files. Fix: only if J wants more; add `sfx` to lines.
9. **437 of the 1,288 recordings are copies** (851 distinct texts, shared by the scenes that repeat them, each stored again in its scene folder:
   71 MB of mp3 across 228 pages). It adds to the site's weight (item 50). Fix: let a repeated line point at one file in `tools/build-story.mjs`.

## (b) Art: camera states, end cards, stand-ins

**Stand-in pictures: 0.** `night-shift/media/standin/` and `tools/make-standins.mjs` are gone and nothing refers to them. Real and on disk: 26 camera
pictures `night-shift/media/feeds/` (1024x576 PNG, 17.2 MB: c1 6 states, c2 3, c3 2, c4 2, c5 3, c6 4, c7 2, c8 1, c9 3), 12 end cards
`night-shift/media/endcards/` (7.9 MB, all different), the landing card `assets/images/night-shift.jpg` (720x1280, 80 KB). T4 `cctv-art` (`j_15f953a7f97f`):
22 of 22 states the scenes use shown enlarged from their own picture, 9 tiles on the wall, 12 end cards and the landing card load.

10. **4 camera pictures are made and no scene shows them**: `c1:box` (the courier's box), `c2:empty-cold`, `c5:cart`, **`c9:trouble`**. The last matters:
    the fire panel's trouble light (the story's life-safety beat: `trouble_open`, the four `trouble-signal-*` scenes and the wedge ending) is **never shown on the
    wall, only heard**. Fix: `feeds: {"c9": "trouble"}` on the `trouble-signal-*` scenes, `c1:box` on the courier scenes, or delete the files.
11. **Camera 8 (Roof door) has one state** (`normal`) in a story with a 03:00 roof tour and "the roof-door sensor that goes quiet". Fix: an `offline` state for c8.
12. **155 of 228 scenes set no `feeds`**, so the nine `normal` pictures carry two thirds of the night; 73 do (c1:dawn 14, c6:reader 9, c6:leak 9, c5:stuck 9,
    c2:sleeper 7, c4:wedge 6, c9:frozen 6 are the used ones). Fix: none required; pick the unset scenes by eye.
13. **This audit looked at 3 pictures of 38** (`c4-normal`, `c9-trouble`, `end-clean`): good, grey-green fisheye with a visible room number and a red light on the
    panel. The end card shows **six** monitors on a wall the story calls nine tiles (`end-clean`). Nothing checks pictures against the doc; `cctv-art` checks they load and
    one format (1024x576), not what they show. Fix: someone looks at all 26 and 12 (a contact sheet), and the end card gets nine screens or the line "nine cameras" gets
    softened.
14. **The pictures are heavy**: 26 feeds at about 660 KB each and 12 end cards at about 650 KB, all PNG. Fix: `.webp` or `.jpg` (about a tenth), in
    `hawkes.assets.json` and the player's paths.
15. **Stills only**: a camera changes by swapping a picture; nothing moves, so "nine cameras of nothing" is nine photographs. Design choice; J should know
    before the wall is judged.

## (c) Script quality

### Timing

16. **Shortest way 36.4 minutes, typical way 42.2 minutes, longest 50.4** (recordings plus the 0.35 s gap; average and median 42.2; 3,000 random plays: 10% 40.9, 90% 43.6).
    The T4 `night-shift` run **played** four ways with real presses: shortest 73 scenes / 36.4 min (ends on Four minutes), longest 90 scenes / 50.4 (The friendly one),
    the way through every trainer layer 78 scenes / 42.4 (Someone to leave it to), the wedge's way 72 scenes / 39.8. Per ending, shortest to longest:
    Four minutes 36.4 to 49.6, The wedge 36.5 to 49.3, Written up 36.6 to 50.1, Opinions 37.3 to 50.2, Noted 37.4 to 49.9, The friendly one 37.5 to 50.4, Clean report 38.0 to 50.0,
    Eat something 38.0 to 50.1, She knew 38.0 to 49.7, Under review 38.1 to 49.7, Someone to leave it to 38.2 to 49.8, By the book, alone 38.7 to 48.8 (`node tools/ending-times.mjs`).
17. **By words, not recordings**: words at 150 a minute plus one second of pause per line gives shortest 38.2, typical 44.6, longest 53.2 minutes (words alone: 31.8, 37.5, 45.0).
    The recordings are faster than the 150 wpm estimate by about two minutes on the shortest way; the clock that matters is the recordings (the player waits for the file). 16,829
    words, 1,288 lines, 119.5 minutes of recording in all.
18. **The sign-off table and the played ways disagree on what "shortest" means.** `story/night-shift-signoff.md` lists the *least audio* to each ending (36.4 to 38.7 min); the T4
    `night-shift-signoff` run (`j_8e0e16c7bc4d`) played the *fewest choices* to each ending, and logged **39.6 to 41.1 minutes of audio** for all 12 (48 plays, 4 sizes). Both are right; the
    doc shows only the computed one and says "not timed from a played walk". Fix: put the played minutes beside them.
19. **A random player meets only 5 of 12 endings.** 20,000 uniform random plays: Written up 32.5%, The friendly one 21.2%, The wedge 18.2%, Opinions 16.7%, Four minutes 11.3%, and **0%
    for the other seven** (Clean report, Someone to leave it to, She knew, Eat something, By the book alone, Noted, Under review). The good endings need near-deliberate play.
20. **The best endings sit on very few states.** Of 240,254 reachable states, the number that arrive at each ending: Written up 1,254, The wedge 762, Four minutes 690, Opinions 132, Clean
    report 38, Noted 25, The friendly one 20, Under review 18, By the book alone 12, Eat something 8, She knew 4, **Someone to leave it to 2**. The story's best ending needs an exact path (77 choices
    through every layer). A design choice; J should know.

### Dead-feeling choices

`npm run story` passes (a choice counts as live if it changes state, branches or has its own log line). Re-measured with the explorer, of 621 choices **82 change no flag or meter in any
state (13%, in 45 scenes)**; 29 of them lead straight to an ending (the ending is the change), **53 do not**; 73 of the 82 have their own shift-log line.

21. **The 53 that only open a scene of their own** (the T4 `night-shift` run calls them "the build's routing buttons"), in 39 scenes: `six-thirty` 7, `okafor-call` 3, `rice-split` 3, `rice-hers` 3, `rice-log` 3, then one each in `visitor-desk`,
    `day-log`, `drawer-notice`, `step-told`, `step-left`, `okafor-call-clean`, `late-quiet`, `late-read`, `late-zurich`, `tenant-log`, `tenant-promise`, `tenant-go`, `four-hours`, `dee-shut`, `trouble-silenced`,
    `okafor-trouble`, `twelve-check`, `twelve-shut`, `light`, `write-up-clean`, `write-up-sloppy`, `twelve-sat`, `twelve-wall`, `tailgate-radio`, `tailgate-watch`, `tailgate-quiet`, `cover-right`, `cover-vague`,
    `cover-hint`, `flicker-look`, `flicker-panel`, `flicker-ask`, `dev-out-sign`, `dev-out-ask`. Fix: give each a flag or meter, or accept them as the log-wording choices and say so in the doc.
22. **9 buttons change nothing and write nothing**: the three scenes `rice-split`, `rice-hers`, `rice-log` each show "Open the log" three times (to `write-up-clean`, `write-up-sloppy`, `write-up-lied`);
    no state change, no log line of their own. Fix: one button, one outcome chosen by state; or three different buttons.
23. **16 scenes show one button that hides several outcomes** (every choice has the same words, the state picks): `okafor-reads-sloppy`, `okafor-reads-slips`, `okafor-reads-wall`, `okafor-reads-open`
    (each four times "Say nothing", **the state picks the ending**), `six-thirty` (7 times "Hand him the tablet"), `okafor-call` 3, `okafor-call-clean` 2, `confess` 2, `late-okafor` 3, `late-adler` 3,
    `flicker-look`, `flicker-panel`, `flicker-ask` 2 each, `rice-split`, `rice-hers`, `rice-log` 3 each. The viewer sees a press that is not a decision. Fix: say it in the doc, or give the player a real
    choice at the ending's door.
24. **36 scenes have exactly one choice** ("Back to the wall", "Stay on the wall", "Look at the wall", "Take your seat", "Say nothing", "Call Ms. Adler", 17 different labels in all). A press
    to go on is correct as an engine; 36 of 228 is one scene in six. Fix: none required; cut where it follows a 1-line scene.
25. **14 scenes send every choice to the same next scene**: `okafor-out-fast`, `nephew-held`, `dev-ok`, `dev-stay`, `dev-company`, `dev-911`, `dev-dee`, `pierce-waved`, `pierce-signin`, `adler-arrives-l`, and
    `shift-prep-f/o/m/l`. The four `shift-prep-*` change a meter the player is never told about. Fix: a later line that shows it.
26. **25 scenes repeat a button's words** (`tour3-test` 8 choices, `tour3-alone` 8, `tour3-sign` 8, `okafor-reads-solid` **12**, `okafor-call*`, `write-up-*`, `late-*`, `flicker-*`, `rice-*`): gated variants of one
    button, correct for the engine; `okafor-reads-solid` can show 12 at once. Fix: none for the data; see items 35 (layout) and 51 (the bot).

### Style guide (`story/night-shift.md`, section 4)

`node tools/check-night-shift.mjs` passes ("ok night-shift": narration at most 42 words, a speech at most 32 words and three sentences, a choice 2 to 6 words, the banned patterns, Dee, Okafor,
Terrell and Pierce limits). What it does not test:

27. **"A page is six or seven lines": 37 of 228 scenes have more than 7 lines** (longest `terrell-school` 12 lines, 165 words; `terrell-door` 11, 160; `okafor-out` 8, 145; `visitor-desk` 8, 141;
    `terrell-ask` 10, 137). The guide's other limit (about 170 words) holds: the longest page is 165, median 70. The old "40 words a page" claim of the first audit is withdrawn: the guide no longer says it.
    Fix: cut the 37, or write "up to twelve" in the guide.
28. **Dee's "Mm."**: 29 of her 606 lines are only "Mm.", 70 start with it, 43 end on it. Her voice sheet says she says "Mm." for "I'm sorry" (`story/night-shift.md` line 283); 29 bare apologies and a third of her lines touching it
    is a lot for one night; the 29 bare "Mm." recordings are one shared file. Fix: audit where it carries nothing.
29. **The checker lints lines and choices only.** 1,067 other strings (every scene `title` and `log`, every choice `log`, the tagline) are not tested for the banned patterns or stated feelings. This audit ran the
    checker's patterns over them by hand: **0 hits**. Fix: add them to `tools/check-night-shift.mjs` so it stays true.
30. **Not machine-checkable and not read in full**: "no scene ending on a moral", "no exposition between two who both know", "no office or work jokes", "each line is written for its voice". This audit read
    the 12 ending scenes and the lines of `visitor-desk`, `handover`'s opening; it did not read 1,288 lines. The 12 endings each end on the narrator and an object (radio, pencil, foil, binder, clock, badge), none on a moral.
    Fix: one read of the whole script by a person with the guide beside it.
### Continuity between endings, and the reveal layers

31. **Two endings open on the same words.** `end-she-knew` and `end-under-review` both begin with Okafor's "Thank you for telling me. That's noted. I will raise it with the contractor." and "Ms. Reyes's post is
    under review. I did not know." (the wording differs by one word: "That's"/"That is"). The player told Okafor in both; what differs is whether Dee forgives it. A viewer who sees both reads one ending twice. Fix:
    give `end-under-review` its own Okafor lines.
32. **Nine of the 12 endings open on a speaker with no scene-setting line.** Three open on the narrator giving the time and who is at the desk ("07:02. The day officer is at the desk ...": `end-clean`, `end-someone`, `end-eat-something`);
    nine open straight on Okafor or Dee (`end-she-knew`, `end-by-the-book`, `end-friendly`, `end-opinions`, `end-four-hours`, `end-written-up`, `end-wedge`, `end-noted`, `end-under-review`), and the 07:02 shows only in the clock.
    A viewer who has just left the last scene of the night is dropped into a conversation. Fix: a first narrator line in the nine (one more recording each).
33. **A scene and an ending share a name for two things.** The scene `four-hours` (title "Four hours", 02:58, Dee's third layer) and the ending `end-four-hours` (title "Four minutes.", which `story/night-shift.md` says was renamed) have the same stem in
    ids, the playtest events ("Four minutes. (end-four-hours)") and this file. A maintenance trap, not a viewer's. Fix: rename the ending's id.
Checked and **not** gaps (so the next reader does not chase them):

- **Trainer reveal layers: none is unreachable.** The pencil (`sign-why`/`sign-why-44`) is 12 choices from the start, the spring (`drawer-notice`) 22, the four hours (`four-hours`) 43, twelve (`twelve`) 64; one way (77 choices)
  meets all four and ends on Someone to leave it to, and the T4 `night-shift` run played it with real presses (78 scenes, 42.4 min). The flags that carry them (`read_p11` set in `binder-44`/`binder-thu`, `asked_44`,
  `asked_sandwich`, `noticed_12th`, `met_dev`, `lobby_clear`) are each set and cleared by named scenes.
- **The weekday is fixed**: the doc says Wednesday night in the middle of February, Tuesday the day before, Dee's next shift Thursday "tonight" by morning. Tuesday (14 scenes) and Thursday (6) agree with it; no scene
  says Wednesday. The earlier audits' "weekday unfixed" item is withdrawn.
- **"Probably" in four Dee lines** (`laptop-watch-o`, `awake-0225-o`, `hum-0435-o`, `write-up-sloppy`) is her correcting the player's wording ("Seemed. Probably. Seemed."), the lesson of the *Opinions* ending; withdrawn.
- **Banned patterns, Pierce and the restricted work**: Pierce speaks 2 lines (`coat-lobby`, `pierce-signin`); no mention of B3, the vat or the creature; no board member has a first name; Dev never says "claustrophobic"; Terrell
  never starts "No"; `check-night-shift.mjs` is clean.
- **Stuck states: 0**; decisions that change nothing: 0 by the build's definition; every one of 621 choices is usable in some state; 228 of 228 scenes and 12 of 12 endings reachable.
- **Brandt's voice sheet exists** (`story/night-shift.md`, "Mr. Brandt: tenant on forty"); the first audit's item is withdrawn.

## (d) Engine and mobile

What the T4 runs showed works (`console` `j_8ccc03bd1780`, 49.6 s, 0 problems; `night-shift-signoff` `j_8e0e16c7bc4d`, 1,370 s, 0 console errors, 0 failed requests): subtitles on, lines in order, Replay, CC; the wall of 6 feeds (demo) and
9 feeds (real story); a feed enlarged by a press; flag-gated choices appear only with their flag; the Log at the start, mid-way and at an ending with a redacted line per way not taken; Settings Sound off, Sound on,
Volume 40% on voice, bed and effects; a reload at the start, mid-scene, after a choice and at an ending returns to the same scene, flags, log and heard lines; with `localStorage` refusing every call the story still plays; the
demo at 390x844, 360x640 and 844x390 with no sideways scroll; all 12 endings played to the end at the desktop size and at the three phone sizes (48 plays), the ending screen shown each time. Gaps:

34. **`console` plays the 5-scene demo, not Night Shift.** Its title says Night Shift but it opens `night-shift-demo` (17 states, at most 2 choices at once, 6 feeds). Every claim about the wall, the Log, Settings,
    reload and the three phone sizes in the `console` report is about the demo; the real story (228 scenes, 9 feeds, up to 12 choices, a Log of 70+ entries) has only the sign-off's ending-screen fits behind it.
    Fix: a second leg in `console` on the real story from a seeded run (`consoleSeedAt`), a few scenes long.
35. **The hardest layout was never measured on a phone.** The most choices at once is `okafor-reads-solid` (12) and `tour3-*` (8); at 390x844, 360x640 and 844x390 no T4 run has measured a scene with more than 2
    choices: the sign-off's 48 `fit` events are all at the ending screen (0 choices), the demo's at 2. Whether 12 buttons of 44 px plus the 9-tile wall fit in 390 px of height is unknown (`css/site.css` has rules for landscape at 640 px and up, a short landscape at 520 px high and up to 559 px wide, lines 1801, 1818 and 1832). Fix: `consoleFit` at `okafor-reads-solid` seeded, three sizes.
36. **At 844x390 the ending screen "needed a scroll" in 11 of 12 endings** (the `fit` events of `night-shift-signoff`: "844x390, wall 9 feeds, 0 choices, 1 needed a scroll, no sideways scroll"; the other 36 plays: 0). It is not
    wide or hidden, and the scenario does not call it a bug. Fix: look at the screenshot to see what scrolls; a short landscape ending that needs a scroll to read its last line is a defect.
37. **A real `page.mouse.click` has never been delivered.** `realClick` is 0 in every T4 run: `console` logs "waiting up to 2500 ms for a real mouse click on Tap to play", then taps itself, "sound-unlocked: a synthetic press,
    audio running". Gen's runner only calls `page.mouse.click` in its generic smoke (`hawkesgen/src/tools/playtest.ts` line 1234), not for a contract scenario, so the "audio unlock under a real click"
    the story depends on is not proved here. Fix: a runner hook that clicks the element the scenario names, or the scenario asks for it through the contract.
38. **iOS-like sound is untested.** Every run is Chromium on a GPU server (`ANGLE (NVIDIA ... L40S)`), none is WebKit. On iOS `audio.volume` is read-only, so `js/hawkes-sound.js` routes an element through a gain node
    once the volume is turned down (lines 120 to 131), and "the routing can't be undone", and a phone call or lock interrupts the AudioContext. The console's voice, bed, effect and sting elements all go through it. Fix: a WebKit
    run (Playwright WebKit with an iPhone profile), or one hand test on a phone.
39. **Settings sound is proved on the demo only**: Sound off, Sound on, Volume 40% and "the next scene" held on voice, bed and effect (all 1.00, all muted, all 0.40). The real story's four elements (voice, bed, effect, sting)
    and Settings opened in the middle of a long line are not measured. Fix: the same leg on the real story.
40. **Saved progress**: the demo's four reloads pass and the real story's saved run is about 9 KB at 73 choices (about 110 bytes a log entry): not a risk. But the real story's reload at its 40th scene, or at the Log with 70
    entries, was not exercised in a browser; `tools/test-console-player.mjs` (`npm run test:player`, the real `js/console.js` in jsdom) checks the logic, **was not run in this pass** (jsdom is not installed: it is not in `package.json`) and
    cannot be run from a clean checkout. Fix: add jsdom to `devDependencies` or document `JSDOM_DIR` in `package.json`'s script.
41. **The Log of a full night was never looked at.** A 73-choice night writes 73 entries plus redacted lines; at 360x640 the Log is a scrolling panel that nobody has opened at that length. Fix: seeded run to 60 choices, open the Log, `consoleFit`.
42. **Frame-rate dips**: `fpsWorst` is 7 in `night-shift` (130 s run), 12 in `stories`, 20 in `cctv-art`, 39 in the sign-off, 45 in `console` (averages 59 to 60). Not attributed: the scenario's own state explorer (240,254
    states, about 2 s at the start) runs in the page and may be the cause, or the 1024x576 PNG decodes. Fix: log the frame time per scene to see which.
43. **Blank screens at the story links.** `stories` raises "the screen looks blank" warnings at 5.1, 54.5, 55.9 and 58.9 s (and another `stories` run at 56.3 s); at least two coincide with the `/water-road/`, `/night-shift-demo/` and
    `/night-shift/` link checks (51 to 57 s), each forwarding to `/?story=<id>`. A viewer following a shared Night Shift link sees a blank page while it forwards. Fix: have the link page show its title, or forward with a `<meta refresh>` and a poster.
44. **No keyboard, screen-reader or reduced-motion check exists** for the console player; its buttons are `button`s with 44 px targets, subtitles are on by default and the lines are text, but focus order after a choice,
    live regions for a new scene and `prefers-reduced-motion` were not examined. Fix: a scenario step pressing Tab, Enter and Space through a scene.
45. **A console story's analytics have never been seen.** The `analytics` scenario's second leg plays Night Shift (story_open, level_start, choice, run_end, "How was this ending?"); no T4 run of `analytics` exists in the job store, so
    `scene`, `choice` and `feature` events from `js/console.js` are untested on beta.
46. **Skip is the only way the bot ever hears a line**: 19,001 Skip presses in the sign-off, 1,682 in `night-shift`. A viewer who listens to a 36-minute night, lets lines end by themselves and Replays, was not simulated
    end to end; `night-shift-audio` plays the opening unskipped (3 lines). Fix: one unskipped scene per recorded scene type.

## (e) Landing: card, badge, Start Over, listed state

T4 `stories` (`j_568dbeb5353e`, 63.4 s) shows the card behaving as the house rules say: three cards (The Final Spark, The Water Road, Night Shift) in order; fresh browser "Not started, 0% explored, Play"; after opening "Started, 0% explored, Play";
after a seeded run two choices short of the ending and the last two presses "Completed, 31% explored, Start Over"; the same after a reload; Start Over opens `handover`, keeps the 31% and Completed, and leaves 6 other cookies untouched; the
story's link `/night-shift/` forwards to `/?story=night-shift`. `story/stories.json`: `night-shift` is listed, after `water-road`, image `/assets/images/night-shift.jpg`, alt "A wall of nine security camera tiles in a dark control room", logline "Your first
week of nights in a Manhattan tower. Nine cameras of nothing, one trainer who knows every door, and a report with your name on it." (no B3, vat or creature). Gaps:

47. **"Completed" with 31% explored.** The percent counts scenes found; the longest way is 90 of 228 scenes (39%), the shortest 73 (32%), so a viewer who finishes the night sees "Completed, 31%" and never more than about 40% on one way; the card
    reaches 100% only after several different runs of 36 to 50 minutes. It is by design (the video stories' percent works the same) but a console story is far longer. Fix: for console stories show "endings found 1 of 12" on the card.
48. **The unlisted demo is public.** `night-shift-demo` is `"listed": false` (no card) but its page `/night-shift-demo/` and `/?story=night-shift-demo` are built and published and play (the T4 `stories` run opens it by link); it is a placeholder with 5 scenes and no recordings. Fix: keep it out of the published site, or accept it.
49. **The landing page loads every story's whole data.** `index.html` loads `js/story-data.js` (575 KB, 322 KB of it Night Shift's 228 scenes and 1,288 lines) before the landing page can show a card. Fix: load a story's scenes when it opens.
50. **The working tree is 765 MB** (`assets` 549 MB, `night-shift` 102 MB, `water-road` 98 MB; Pages publishes it) against GitHub Pages' 1 GB limit for a published site; Night Shift adds about 100 MB (items 9, 14). The next story or the 6 stings plus a re-cut will need the room. Fix: shrink
    the PNGs, share the repeated recordings, check the size in `npm run story`.

## (f) Docs and the Studio playtest scenarios

51. **The `consoleCheck` "shows although its conditions fail" bug is the bot's, and it makes beta's review red.** `js/playtest.js` line 2114 to 2115 compares the labels of gated choices with the labels on screen; in a scene that repeats a label
    (25 scenes: `okafor-reads-*` four times "Say nothing", `six-thirty` seven times "Hand him the tablet") the one open choice has the label of a gated one. Result on the T4: **616 false bugs in `night-shift-signoff`**, 50 in `night-shift`, 11 in one `stories` run, 2 in the
    current one. The review of the sign-off (`j_bff8f13fe0be`) took them for a game bug ("14 choices appear although their conditions fail") and gave "fix-first". The data says the player is right: `okafor-reads-open` has four "Say nothing" choices
    with different `meters` gates, and the player shows exactly the open one. Fix: compare by choice index, not by label.
52. **`cctv-art` raises 86 false bugs** ("the player says 28% explored, the scenes reached give 0%"): it passes `new Set()` as the scenes-seen set (`js/playtest.js`, `cctvStates`, the `consoleChoose` call) while the player counts the seeded unlocks. The player is
    right. Fix: pass the seeded unlocks or `null`.
53. **Declared times are two to five times too long.** `seconds` (what the runner allows 2x of): `console` 240 against 47 to 50 measured, `stories` 150 against 62, `night-shift` 480 against 130 to 134, `night-shift-audio` 120 against 24 to 31, `cctv-art` 480
    against 73, `night-shift-signoff` 3000 against 1,364 to 1,370, `night-shift-gaps` 40 against 5. `AGENTS.md`'s table repeats the old ones (`~240 s`, `~50 min`, `~40 s`). Fix: the measured values, so the PM's budget is true.
54. **Six scenarios that touch Night Shift have no T4 run in the job store**: `sound`, `branches`, `pages`, `analytics`, `credits`, `blog` (the 500 newest `imaginelivetv` jobs hold 4 `stories`, 3 `console`, 3 `night-shift`, 3 `night-shift-audio`, 3 `night-shift-signoff`,
    3 `cctv-art`, 2 `night-shift-gaps`, 1 `smoke`). The sound scenario's Night Shift leg, the branch pages of 228 scenes and the credits footer on a console story have never been seen. Fix: ask Talk for each.
55. **`AGENTS.md` is stale in two places.** The `console` row says the scenario plays "the draft demo `night-shift-demo`" (true, and the reason for item 34, but nothing says it does *not* cover Night Shift); the `cctv-art` row says "Stand-in art
    (`media/standin`) counts until the real stills are made" (there is no stand-in folder). Its rows' times are also old (item 53). Fix: one edit pass.
56. **`story/night-shift.md`**: "Waiting for J" still lists "The media budget: about 1,200 voiced lines (the estimate is in the PR/summary), the camera stills and 12 end cards" (all made, so the line asks J about money already spent). Section 6 "The state model"
    is the first plan (it says so, and the built model is under "The built night"), 50 lines a reader can mistake for the rules. Fix: one edit pass; cut section 6 down to a pointer.
57. **`story/night-shift-signoff.md`** says the endings were "NOT DONE" at the four sizes and the playtests were not run; the T4 has since played all 12 at four sizes (48 plays, 0 console errors, ending shown each time, minutes 39.6 to 41.1: item 18). The
    walk half of its verdict is out of date (the listen, item 6, is still not done). Fix: update the table and the verdict from `j_8e0e16c7bc4d`.
58. **`story/night-shift-slice-notes.md`** is superseded and says so, and is still in the folder; `story/README.md` ("Console stories") has no sentence on the console scenarios' times or on `console` being the demo. Fix: keep the notes as history; add three lines to the README.
59. **`sound` was never run, so this file cannot paste its report.** The previous version of this audit gave "not run" and beta's `night-shift-gaps` run (`j_f39f0b6794f5`) raised three warnings for it; its check was also loose (a word "problems" anywhere later in the file
    satisfied it). In this pass the scenario checks each playtest section on its own (`js/playtest.js`, `nightGapsRun`), and the file reports `sound` as not run, as a warning, because it is true. Fix: a `sound` playtest on the T4, then paste its report under `#### sound` and delete the warning.
60. **`hawkes.assets.json` (988 KB, 1,375 Night Shift assets) and the lock (384 KB)** are consistent with the files except the 6 music stings; `npm run story -- --check` ends "everything generated is up to date". Nothing to fix; the size is why diffs of it are hard to review.

Update (task c_02b57f9eb45e): items 51 and 52 are fixed in the bot (51 was already by choice index; `cctvStates` now counts the scenes it enters from no unlocks, across ways, instead of `new Set()` per way). Item 54: `smoke`, `credits`, `sound` and `analytics` now play The Water Road and Night Shift as well as The Final Spark, and `analytics` is tagged `full`, so beta's run plays them; their first T4 reports are still to be pasted. The card after Start Over (Completed, same percent, Start Over) is the house rule (story doc "Progress on the cards"), the same in all three stories; the `stories` description that said "Play" there was wrong and is fixed.

Update (task c_c4ffb03144e4, nothing run in a browser: the checks are written, the first beta run is their first reading):
- **34, 39, 40, 41** (`console` on the real story): `console` has a second leg on the real Night Shift (`consoleRealLeg` in `js/playtest.js`), every position past the start a seeded run: the wall of 9 feeds, a gated choice with the choice that set what it needs, Settings Sound off/on and Volume 40% on voice, bed, effect **and sting** opened mid-line (first scene and the next), a reload at the 40th scene (mid-scene and heard) and with the Log open at 70 entries, and at 360x640 the 70-entry Log opens, scrolls to its foot inside itself and closes. `{"at":"real"}` plays only that leg.
- **35**: `consoleRealFit` measures `okafor-reads-solid` and `tour3-test` at 390x844, 360x640 and 844x390. **The data holds 12 and 8 choices in those scenes but no state ever opens more than 4 at once** (`tour3-*`; `okafor-reads-solid` opens 2): the real buttons are measured, then the same screen is filled to 12 or 8 with copies of its buttons to prove the layout holds for all the data has. `consoleFit` now also checks that nothing lies over a choice once it is scrolled into view. CSS: in a short landscape the wall's width follows the height left, and the end screen is tighter (`css/site.css`).
- **36**: the 844x390 end screen. The T4's `fit` event did not say what needed the scroll and no screenshot came back, so the cause was not seen. `consoleFit` now names every element that needed a scroll (with its rect) and every part that is taller inside than shown, with the layout's rects; and an end screen that needs any scroll is a bug (`endScreen`), at every size. CSS tightened blind (end card 20dvh, the wall capped by height). If beta still reports it, the `fit` event says what.
- **42**: every scenario times frames (`frame-time` events for scenes with a frame over 50 ms; metrics `frameWorstMs`, `framesOver50`, `slowestScenes`), and the state explorer and the lengths of every way run before anything plays (`state-explorer` event with its ms). Not moved to a worker: before play is enough to keep it out of a scene; if the dips stay, the `frame-time` events say which scenes.
- **43**: the `/<id>/` link pages were a flat dark page (header, title, Play) that forwarded at once, and the opened story is a flat dark Tap to play prompt, under the runner's 9 KB screenshot test. The link page now shows the story's card (picture, title, logline, Play), and the `stories` run taps the opened story in the frame before it holds.
- **51, 52**: already fixed in the bot (see above). **53**: declared `seconds` are now the measured times plus a margin (`stories` 80, `night-shift` 180, `night-shift-audio` 90, `cctv-art` 100, `night-shift-gaps` 10, `night-shift-signoff` 1500, `console` 200, `blog` 15); `night-shift-signoff` with `{"at":"last-choices"}` reports `signoffMinutes` and is a bug over 10 minutes. `AGENTS.md`'s table has the same numbers.
- **40**: `jsdom` is in `devDependencies`: `npm ci` then `npm run test:player` and `npm run test:endings` run from a clean checkout.

## What is left, in order

Status 2026-10-25 on `224a9f5` (#54). Real results only; "not run" means no report exists for that commit.

Re-checked on `6182b85` (#60): still no beta report for it (newest is Studio `r_fa49e962e7d1`; `night-shift-signoff` `j_55e8a96b943b` was cancelled with no result), ElevenLabs still refuses (`j_f61bbb6b4f1e`, 401). Every item below is unchanged.

1. **Beta's playtest of the merged commit: not run** (no report newer than Studio's `r_fa49e962e7d1` of 2026-10-24 and Gen's T4 runs quoted below, which predate #50 to #54): `night-shift-signoff` (4 sizes, 12 endings), `console` (real story leg), `stories`, `branches`, `pages`, `sound`, `blog`, `credits`, `analytics`, `cctv-art`, `night-shift-audio`, `night-shift-card`. Read them when they exist and fix what they show.
2. **46 voice lines are unrecorded** (15 echo scenes; item 1's stings are done, #51). ElevenLabs answers 401 `payment_issue` (re-tried today, job `j_0017f2fd955e`): J pays the invoice, then `--reuse`, `audio.voice` per line (about 1.2 dollars), `--ingest`, `--mix`, `--dur`, `npm run story`. `npm run test:endings` fails on exactly these (75 problems, all "no recording"); `npm run story -- --check`: ok, 304 scenes, nothing stale.
3. J listens to the voices (item 7) and reads the script (item 30); then treatments (item 5). Only J can.

Done and checked by command today: `npm run story -- --check`, `check-night-shift` (256 scenes, 12 endings, 0 no-op choices), `test:console`, `test:playtest` (645 helpers), `test:player`.

## Appendix: real command output

Run at `d3408c0` on 2026-10-25. The playtest reports below are the real reports of T4 runs found in Hawkes Gen's job store; their events are copied as the report holds them (taps and repeated sound notes left out, marked).

### Commands run here
```
$ npm run story -- --check

> imagine-live-tv@1.0.0 story
> node tools/build-story.mjs --check

ok       4 stories, 289 scenes, everything generated is up to date
$ node tools/check-night-shift.mjs
228 scenes, 1288 lines (606 Dee), 12 endings, 240254 states explored
playing time: shortest 36.4 min | average 42.2 min (every open choice equally likely) | median 42.2 (3000 random plays: 10% 40.9, 90% 43.6) | longest 50.4 min
endings met in 3000 random plays: 5 of 12; Pierce speaks in: coat-lobby, pierce-signin
decisions that change nothing: 0
reveal layers: 2 the pencil (sign-why/sign-why-44): 12 choices | 5 the spring (drawer-notice): 22 choices | 3 the four hours (four-hours): 43 choices | 4 twelve (twelve): 64 choices | one way through all of them: yes, 77 choices
endings (shortest way, in choices): Clean report 73, Someone to leave it to 73, She knew 73, Eat something 73, By the book, alone 75, The friendly one 73, Opinions 73, Four minutes 72, Written up 71, The wedge 71, Noted 73, Under review 73
ok       night-shift

$ npm run test:console

> imagine-live-tv@1.0.0 test:console
> node tools/test-console.mjs

ok   the demo builds
ok   a choice with no effect fails
ok   a cosmetic choice passes (two at most)
ok   a state with no usable choice fails
ok   a next target that does not exist fails
ok   an unreachable ending fails
ok   a flag nothing declared fails
ok   a choice that can never be made fails
ok   too few cameras fails

$ npm run test:playtest

> imagine-live-tv@1.0.0 test:playtest
> node tools/test-playtest.mjs

ok   js/playtest.js: every called helper is defined (540 names declared)

$ node tools/make-audio.mjs night-shift --list
6 of 1322 have no file
night-shift-music-shift-begins
night-shift-music-the-panel
night-shift-music-fifty-eight
night-shift-music-ending-plain
night-shift-music-ending-warm
night-shift-music-ending-cold

$ hawkesgen_estimate (project imaginelivetv, audio.music x6, 20 s each)
gpuSeconds 61, family ace-step (median of 40 past jobs), modelLoads 100 s, boots 0, 1 server at $1.861/h
cost: gpu $0.08, api $0, idle tail $0.62, total $0.08, with idle tail $0.70, wall about 3 minutes
```

### Playtests `console`, `stories`, `sound` (T4 reports)

#### console

Gen job `j_8ccc03bd1780` (playtest.run, project imaginelivetv, 2026-10-25, GPU server i-0682602c987747b0d (us-west-2), 1280x720): outcome **done** in 49.6 s, 0 problems (0 bug, 0 warning), console errors 0, warnings 0, failed requests 0. Report and video: `s3://hawkes-playtests-028793236279/imaginelivetv/2026-10-25/j_8ccc03bd1780/`.

```
metrics {"splashMs":2600,"realClick":0,"linesSkipped":96,"feeds":6,"choicesClicked":35,"audioContext":1,"fpsAverage":59,"fpsWorst":45}
problems:
  none
events:
  0 start console
  0 splash home: "IMAGINE LIVE TV"
  1.7 splash-gone home: held 1600 ms, faded 1000 ms
  1.7 no-inventory home: landing page
  1.7 scene Night Shift (demo): opens
  2 story-open night-shift-demo (Night Shift (demo), console)
  2.9 real-click-wait night-shift-demo: waiting up to 2500 ms for a real mouse click on Tap to play
  5.6 scene night-shift-demo lines
  8.4 lines-in-order night-shift-demo/radio-check: dee: Radio check. | dee: Mm. You're a minute late. Sit.
  10.4 replay night-shift-demo/radio-check: the last line again, choices back
  10.4 scene night-shift-demo wall
  10.9 feed-enlarged night-shift-demo: c4 (wedge): "The same fire door on the 31st floor landing held open a han"
  11.8 scene night-shift-demo gate at the-wall: radio-check > the-wall
  12.1 gate the-wall with radio_answered, trainer_trust 2, post_orders 1: shows ["Point at camera 4","Keep your eyes on the lobby"], hides ["Call it in: wedge on 31"]
  12.5 gate the-wall with noticed_wedge, trainer_trust 1, post_orders 2: shows ["Call it in: wedge on 31","Keep your eyes on the lobby"], hides ["Point at camera 4"]
  12.5 explored night-shift-demo: 17 states, 5/5 scenes reachable, 8 different sets of choices
  12.5 scene night-shift-demo: radio-check
  12.6 scene night-shift-demo: radio-check > the-wall
  13.3 scene night-shift-demo: radio-check > the-wall > the-report
  14.7 scene night-shift-demo: radio-check > the-wall > the-report > clean-report
  15.3 ending night-shift-demo/clean-report: Clean report.
  15.3 scene night-shift-demo: radio-check > the-wall > the-report > quiet-report
  15.9 ending night-shift-demo/quiet-report: All quiet.
  16.5 shift-log night-shift-demo log at the start: 1 entries, 2 redacted lines
  18.4 shift-log night-shift-demo log at the-report: 5 entries, 6 redacted lines
  20.5 shift-log night-shift-demo log at the ending clean-report: 7 entries, 5 redacted lines
  21.5 audio-settings night-shift-demo sound: sound on: voice sound 1.00, bed sound 1.00, sfx sound 1.00
  21.7 scene Settings (night-shift-demo sound)
  22.7 audio-settings night-shift-demo sound: Sound off: voice muted 1.00, bed muted 1.00, sfx muted 1.00
  23.4 audio-settings night-shift-demo sound: Sound on, volume 40%: voice sound 0.40, bed sound 0.40, sfx sound 0.40
  24.2 audio-settings night-shift-demo sound: the next scene, volume 40%: voice sound 0.40, bed sound 0.40, sfx sound 0.40
  24.2 scene Reload: start, mid-scene, after a choice, at an ending
  24.2 run-saved night-shift-demo (start): radio-check, flags none, 1 log entries, 0 line(s) heard, 226 bytes
  25.5 reloaded night-shift-demo (start): back at radio-check with flags none, 1 log entries, 1 line(s) already heard (same)
  26.5 run-saved night-shift-demo (after a choice): the-wall, flags radio_answered, 3 log entries, 2 line(s) heard, 439 bytes
  27.4 reloaded night-shift-demo (after a choice): back at the-wall with flags radio_answered, 3 log entries, 2 line(s) already heard (same)
  28.6 run-saved night-shift-demo (mid-scene): the-report, flags radio_answered, noticed_wedge, 5 log entries, 0 line(s) heard, 635 bytes
  29.6 reloaded night-shift-demo (mid-scene): back at the-report with flags noticed_wedge, radio_answered, 5 log entries, 1 line(s) already heard (same)
  30.9 run-saved night-shift-demo (at an ending): clean-report, flags radio_answered, noticed_wedge, log_fact, 7 log entries, 1 line(s) heard, 826 bytes
  31.8 fit at an ending, reloaded at the ending: 390x844, wall 6 feeds, 0 choices, 0 needed a scroll, no sideways scroll
  31.8 reloaded night-shift-demo (at an ending): back at clean-report with flags log_fact, noticed_wedge, radio_answered, 7 log entries, 1 line(s) already heard (same)
  32.5 scene Storage blocked
  34.1 storage-blocked night-shift-demo: with localStorage refusing, the story played a choice, opened the Log and toggled CC with no error
  34.4 scene portrait phone 390x844
  34.9 fit portrait phone 390x844, a line playing: 390x844, wall 6 feeds, 0 choices, 0 needed a scroll, no sideways scroll
  35.4 fit portrait phone 390x844, a feed enlarged, the choices shown: 390x844, wall 6 feeds, 2 choices, 0 needed a scroll, no sideways scroll
  37.2 fit portrait phone 390x844, the end screen: 390x844, wall 6 feeds, 0 choices, 0 needed a scroll, no sideways scroll
  37.7 scene small phone 360x640
  38.2 fit small phone 360x640, a line playing: 360x640, wall 6 feeds, 0 choices, 0 needed a scroll, no sideways scroll
  38.7 fit small phone 360x640, a feed enlarged, the choices shown: 360x640, wall 6 feeds, 2 choices, 0 needed a scroll, no sideways scroll
  40.4 fit small phone 360x640, the end screen: 360x640, wall 6 feeds, 0 choices, 0 needed a scroll, no sideways scroll
  40.9 scene landscape phone 844x390
  41.5 fit landscape phone 844x390, a line playing: 844x390, wall 6 feeds, 0 choices, 0 needed a scroll, no sideways scroll
  42 fit landscape phone 844x390, a feed enlarged, the choices shown: 844x390, wall 6 feeds, 2 choices, 0 needed a scroll, no sideways scroll
  43.7 fit landscape phone 844x390, the end screen: 844x390, wall 6 feeds, 0 choices, 0 needed a scroll, no sideways scroll
  44.7 landing All stories
  44.7 finish done
```

#### stories

Gen job `j_568dbeb5353e` (playtest.run, project imaginelivetv, 2026-10-25, GPU server i-0682602c987747b0d (us-west-2), 1280x720): outcome **done** in 63.4 s, 6 problems (2 bug, 4 warning), console errors 0, warnings 0, failed requests 0. Report and video: `s3://hawkes-playtests-028793236279/imaginelivetv/2026-10-25/j_568dbeb5353e/`.

```
metrics {"splashMs":2601,"stories":3,"cards":3,"videosLoaded":2,"videosPlayed":2,"lastVideoTime":2.9,"storiesOpened":3,"linesSkipped":39,"inventoryChecked":2,"choicesClicked":3,"fpsAverage":59,"fpsWorst":12}
problems:
  1x bug (game): "Hand him the tablet" shows although its conditions fail
  1x bug (game): "Say nothing" shows although its conditions fail
  1x warning (runner): the screen looks blank at 5.1 s (scene)
  1x warning (runner): the screen looks blank at 54.5 s (scene)
  1x warning (runner): the screen looks blank at 55.9 s (scene)
  1x warning (runner): the screen looks blank at 58.9 s (scene)
events:
  0 start stories
  0 splash home: "IMAGINE LIVE TV"
  1.6 splash-gone home: held 1601 ms, faded 1000 ms
  1.6 no-inventory home: landing page
  1.6 scene Choose your story
  1.6 no-inventory landing page: landing page
  2.6 scene Progress: a fresh browser
  3.4 badge fresh browser: final-spark Not started, 0% explored, Play
  3.4 badge fresh browser: water-road Not started, 0% explored, Play
  3.4 badge fresh browser: night-shift Not started, 0% explored, Play
  4 scene The Final Spark: card
  4.7 story-open final-spark (The Final Spark)
  4.8 scene The Final Spark: player
  4.8 inventory The Final Spark: final-spark
  4.8 hit-targets The Final Spark: PLAY tab 68x44px, TREE tab 70x44px, Settings gear 44x44px
  5.2 tree The Final Spark's Tree on its first page: 1 found, 2 locked
  8.9 landing All stories
  9 no-inventory landing page, after All stories: landing page
  9 badge after opening The Final Spark: final-spark Started, 4% explored, Play
  9 badge after opening The Final Spark: water-road Not started, 0% explored, Play
  9 badge after opening The Final Spark: night-shift Not started, 0% explored, Play
  9 scene The Water Road: card
  9 badge before opening it: water-road Not started, 0% explored, Play
  9.7 story-open water-road (The Water Road)
  9.7 scene The Water Road: player
  9.7 inventory The Water Road: water-road (bullets 6, water 4)
  9.7 hit-targets The Water Road: PLAY tab 68x44px, TREE tab 70x44px, Settings gear 44x44px
  10 tree The Water Road's Tree on its first page: 1 found, 2 locked
  13.7 landing All stories
  13.8 no-inventory landing page, after All stories: landing page
  13.8 badge after opening The Water Road: final-spark Started, 4% explored, Play
  13.8 badge after opening The Water Road: water-road Started, 5% explored, Play
  13.8 badge after opening The Water Road: night-shift Not started, 0% explored, Play
  13.8 scene Night Shift: card
  13.8 badge before opening it: night-shift Not started, 0% explored, Play
  14.3 story-open night-shift (Night Shift, console)
  14.3 scene Night Shift: player
  15 hit-targets Night Shift: Settings gear 44x44px
  16.3 landing All stories
  16.4 badge after opening Night Shift: final-spark Started, 4% explored, Play
  16.4 badge after opening Night Shift: water-road Started, 5% explored, Play
  16.4 badge after opening Night Shift: night-shift Started, 0% explored, Play
  16.4 scene The Final Spark: to an ending
  17.1 story-open final-spark (The Final Spark)
  19.2 ending final-spark: start > sewerWater > getOutWater > gate > breakGate > gotKey > useKey > fog > fireDoor > uponTruck > insideTruck > shadowDance > explorePowers > consumeLight > destroyTown
  19.6 tree The Final Spark's Tree at an ending: 15 found, 6 locked
  21 landing All stories
  21 badge after The Final Spark's ending: final-spark Completed, 65% explored, Start Over
  22.1 reset final-spark: start (a new run, unlocks kept)
  22.4 death final-spark: sludge
  23.1 landing All stories
  23.1 badge after a death and Try again in The Final Spark: final-spark Completed, 73% explored, Start Over
  23.1 scene The Water Road: to an ending
  23.8 story-open water-road (The Water Road)
  25 ending water-road: start > flats > nightCrossing > passBy > dustStorm > wash > shareWater > spring > heroEnding
  25.3 tree The Water Road's Tree at an ending: 9 found, 8 locked
  26.7 landing All stories
  26.7 badge after The Water Road's ending: water-road Completed, 45% explored, Start Over
  27.8 reset water-road: start (a new run, unlocks kept)
  28.1 death water-road: sunstroke
  28.8 landing All stories
  28.8 badge after a death and Try again in The Water Road: water-road Completed, 50% explored, Start Over
  28.8 scene Night Shift: to an ending
  31.4 story-open night-shift (Night Shift, console)
  31.4 seeded-run night-shift: resumed at six-thirty after 69 choice(s) (setup shortcut: 69 scene(s) of the way unlocked, this one's lines heard)
  32.2 ending night-shift/end-wedge: The wedge.
  33.5 landing All stories
  33.5 badge after Night Shift's ending: night-shift Completed, 31% explored, Start Over
  34.1 scene Progress: after a reload
  35.1 badge after a reload: final-spark Completed, 73% explored, Start Over
  35.1 badge after a reload: water-road Completed, 50% explored, Start Over
  35.1 badge after a reload: night-shift Completed, 31% explored, Start Over
  35.7 scene The Final Spark: Start Over
  36.3 story-open final-spark (The Final Spark)
  39 landing All stories
  39 badge before Start Over in The Final Spark: final-spark Completed, 73% explored, Start Over
  39.7 story-open final-spark (The Final Spark)
  39.7 start-over final-spark: at start, 73% explored kept; 6 other cookies untouched
  40.7 landing All stories
  40.7 badge after Start Over in The Final Spark: final-spark Completed, 73% explored, Start Over
  41.3 scene The Water Road: Start Over
  42 story-open water-road (The Water Road)
  43.7 landing All stories
  43.7 badge before Start Over in The Water Road: water-road Completed, 50% explored, Start Over
  44.4 story-open water-road (The Water Road)
  44.4 start-over water-road: at start, 50% explored kept; 6 other cookies untouched
  45.5 landing All stories
  45.5 badge after Start Over in The Water Road: water-road Completed, 50% explored, Start Over
  46.1 scene Night Shift: Start Over
  46.1 badge before Start Over in Night Shift: night-shift Completed, 31% explored, Start Over
  … 21 more events of the 115 in the report
```
#### sound

**Not run here: no T4 run of `sound` exists.** The 500 newest `imaginelivetv` jobs in Hawkes Gen hold no `sound` run (nor `branches`, `pages`, `analytics`, `credits`, `blog`), and this server starts no browser, so there is no outcome and no list of problems to paste. Paste its report here after a T4 run (about 60 s) and delete this paragraph.

What the other T4 runs hold about sound (events as reported): the prompt line follows the saved setting every time ("Sound on. Radio check." in `console`, `night-shift`, `cctv-art`), `tap-to-play ... audio running` and `sound-unlocked ... a synthetic press, audio running` in every run (`realClick` 0), and in `console` (demo): `sound on: voice sound 1.00, bed sound 1.00, sfx sound 1.00`; `Sound off: voice muted 1.00, bed muted 1.00, sfx muted 1.00`; `Sound on, volume 40%: voice sound 0.40, bed sound 0.40, sfx sound 0.40`; `the next scene, volume 40%: ... 0.40`. `night-shift-audio` (`j_a4a2b9c3d15c`) metrics: lines 1288, linesWithoutRecording 0, musicCuesUnmade 6, voiceSpreadDb 3.

### Other playtests (T4 reports)

#### night-shift-audio

Gen job `j_a4a2b9c3d15c` (playtest.run, project imaginelivetv, 2026-10-25, GPU server i-0682602c987747b0d (us-west-2), 1280x720): outcome **done** in 30.8 s, 22 problems (21 bug, 1 warning), console errors 0, warnings 0, failed requests 0. Report and video: `s3://hawkes-playtests-028793236279/imaginelivetv/2026-10-25/j_a4a2b9c3d15c/`.

```
metrics {"splashMs":2600,"lines":1288,"linesWithoutRecording":0,"musicCuesUnmade":6,"voiceSpreadDb":3,"realClick":0,"linesSkipped":10,"fpsAverage":60,"fpsWorst":48}
problems:
  1x warning (game): night-shift: 6 music stings are designed but not made yet (GPU, waiting for J's approval): shift-begins, the-panel, fifty-eight, ending-plain, ending-warm, ending-cold
  1x bug (game): night-shift/<scene>: the music cue shift-begins isn't in the story's music
  1x bug (game): night-shift/<scene>: the music cue fifty-eight isn't in the story's music
  4x bug (game): night-shift/<scene>: the music cue the-panel isn't in the story's music
  6x bug (game): night-shift/<scene>: the music cue ending-plain isn't in the story's music
  4x bug (game): night-shift/<scene>: the music cue ending-cold isn't in the story's music
  2x bug (game): night-shift/<scene>: the music cue ending-warm isn't in the story's music
  1x bug (game): night-shift: the bed control-room-late jumps 6.4 dB in level where it loops
  1x bug (game): night-shift: the bed stairwell is only 11.5 dB under the voice, it could drown a line
  1x bug (game): night-shift: the bed roof is only 8.7 dB under the voice, it could drown a line
events:
  0 start night-shift-audio
  0 splash home: "IMAGINE LIVE TV"
  1.6 splash-gone home: held 1600 ms, faded 1000 ms
  1.6 no-inventory home: landing page
  1.6 scene Night Shift: every line and cue has its recording
  1.6 criterion 1288 of 1288 lines have a recording; speakers: Narrator 445, Mr. Okafor 95, Dee 606, Terrell 40, Marisol 49, Mr. Brandt 5, Dev 14, Pierce Hawkes 2, Ms. Adler 24, Courier 5, The man in the vestibule 3
  1.6 criterion 228 of 228 scenes have an ambience bed
  1.6 scene Night Shift: loudness across speakers, ambience under the voice
  5.2 loudness Narrator: -17.8 dB RMS over 3 lines
  5.2 loudness Mr. Okafor: -18.6 dB RMS over 3 lines
  5.2 loudness Dee: -19.0 dB RMS over 3 lines
  5.2 loudness Terrell: -17.1 dB RMS over 3 lines
  5.2 loudness Marisol: -17.3 dB RMS over 3 lines
  5.2 loudness Mr. Brandt: -19.5 dB RMS over 3 lines
  5.2 loudness Dev: -18.7 dB RMS over 3 lines
  5.2 loudness Pierce Hawkes: -19.6 dB RMS over 2 lines
  5.2 loudness Ms. Adler: -17.4 dB RMS over 3 lines
  5.2 loudness Courier: -20.1 dB RMS over 3 lines
  5.2 loudness The man in the vestibule: -20.0 dB RMS over 3 lines
  5.2 criterion speakers sit within 3.0 dB of each other (-20.1 to -17.1 dB RMS)
  5.4 loudness ambience control-room: -35.8 dB RMS, 17.2 dB under the voice
  5.5 loop bed control-room: 28.0 s, seam step 0.0010 (typical 0.0012), level gap 0.0 dB
  5.6 loudness ambience control-room-late: -38.2 dB RMS, 19.5 dB under the voice
  5.7 loop bed control-room-late: 28.0 s, seam step 0.0023 (typical 0.0034), level gap 6.4 dB
  5.8 loudness ambience lobby: -37.1 dB RMS, 18.5 dB under the voice
  … 43 more events of the 93 in the report
```

#### night-shift

Gen job `j_85026c19bd3a` (playtest.run, project imaginelivetv, 2026-10-25, GPU server i-0682602c987747b0d (us-west-2), 1280x720): outcome **done** in 130.1 s, 50 problems (50 bug, 0 warning), console errors 0, warnings 0, failed requests 0. Report and video: `s3://hawkes-playtests-028793236279/imaginelivetv/2026-10-25/j_85026c19bd3a/`.

```
metrics {"splashMs":2601,"scenes":228,"endings":12,"choicesThatChangeNothing":0,"shortestMinutes":36.4,"averageMinutes":42.2,"longestMinutes":50.4,"realClick":0,"linesSkipped":1682,"choicesClicked":309,"fpsAverage":59,"fpsWorst":7}
problems:
  4x bug (game): "Take the pencil" shows although its conditions fail
  4x bug (game): "Take the pen" shows although its conditions fail
  3x bug (game): "Ask why the pencil" shows although its conditions fail
  4x bug (game): "Ask for an example line" shows although its conditions fail
  4x bug (game): "Answer the phone" shows although its conditions fail
  1x bug (game): "Rewrite it now" shows although its conditions fail
  1x bug (game): "Tell him you'll fix it later" shows although its conditions fail
  4x bug (game): "Back to the wall" shows although its conditions fail
  4x bug (game): "Open the log" shows although its conditions fail
  6x bug (game): "Write the closing line" shows although its conditions fail
  4x bug (game): "Hand him the tablet" shows although its conditions fail
  2x bug (game): "Say nothing" shows although its conditions fail
  1x bug (game): "Correct it now" shows although its conditions fail
  1x bug (game): "Tell him it's right" shows although its conditions fail
  2x bug (game): "Back to the log" shows although its conditions fail
  1x bug (game): "Wait for him" shows although its conditions fail
  2x bug (game): "Hand the phone back" shows although its conditions fail
  1x bug (game): "Tell him about the notice" shows although its conditions fail
  1x bug (game): "Say nothing about the notice" shows although its conditions fail
events:
  0 start night-shift
  0 splash home: "IMAGINE LIVE TV"
  2 splash-gone home: held 1600 ms, faded 1001 ms
  2 no-inventory home: landing page
  2 scene Night Shift: the night in numbers
  3.9 explored night-shift: 240254 states, 228/228 scenes reachable
  3.9 ending-reachable Clean report. (end-clean): 73 choices on its shortest way
  3.9 ending-reachable Someone to leave it to. (end-someone): 73 choices on its shortest way
  3.9 ending-reachable She knew. (end-she-knew): 73 choices on its shortest way
  3.9 ending-reachable Eat something. (end-eat-something): 73 choices on its shortest way
  3.9 ending-reachable By the book, alone. (end-by-the-book): 75 choices on its shortest way
  3.9 ending-reachable The friendly one. (end-friendly): 73 choices on its shortest way
  3.9 ending-reachable Opinions. (end-opinions): 73 choices on its shortest way
  3.9 ending-reachable Four minutes. (end-four-hours): 72 choices on its shortest way
  3.9 ending-reachable Written up. (end-written-up): 71 choices on its shortest way
  3.9 ending-reachable The wedge. (end-wedge): 71 choices on its shortest way
  3.9 ending-reachable Noted. (end-noted): 73 choices on its shortest way
  3.9 ending-reachable Under review. (end-under-review): 73 choices on its shortest way
  3.9 criterion 12 distinct endings, every one reached by a different mix of choices
  3.9 criterion 0 choices change nothing (no flag, meter, scene of their own or log line); 53 more only open a scene of their own, never ending the story, and are the build's routing buttons
  3.9 reveal-layer the pencil: sign-why is 12 choices from the start
  3.9 reveal-layer the spring: drawer-notice is 22 choices from the start
  3.9 reveal-layer the four hours: four-hours is 43 choices from the start
  3.9 reveal-layer twelve: twelve is 64 choices from the start
  5.6 criterion one way (77 choices) meets every layer of the trainer (the pencil, the spring, the four hours, twelve) and ends on "Someone to leave it to"
  6.6 criterion playing time: shortest 36.4 min, average 42.2 min (every open choice equally likely), longest 50.4 min (words at 150 a minute plus a pause per line)
  6.6 criterion Pierce Hawkes speaks 2 line(s), in coat-lobby and pierce-signin: "Evening. Don't get up." / "Fair. Fifty-eight. I own it. Put that in your log."
  6.6 criterion no scene, line, choice or log entry mentions B3, the vat, the creature or the restricted work
  7 story-open night-shift (Night Shift, console)
  7.2 scene night-shift: the shortest way
  34 night-path the shortest way: 73 scenes, 36.4 minutes of audio, ends at "Four minutes." (end-four-hours)
  34 scene night-shift: the longest way
  68.4 night-path the longest way: 90 scenes, 50.4 minutes of audio, ends at "The friendly one." (end-friendly)
  68.4 scene night-shift: the way through every layer of the trainer, to "Someone to leave it to"
  97.7 night-path the way through every layer of the trainer, to "Someone to leave it to": 78 scenes, 42.4 minutes of audio, ends at "Someone to leave it to." (end-someone)
  97.7 scene night-shift: the way to "The wedge."
  125 night-path the way to "The wedge.": 72 scenes, 39.8 minutes of audio, ends at "The wedge." (end-wedge)
  125 criterion played 4 different ways to 4 different endings: 73 scenes / 36.4 min, 90 scenes / 50.4 min, 78 scenes / 42.4 min, 72 scenes / 39.8 min
  125.7 landing All stories
  125.7 finish done
```

#### night-shift-signoff

Gen job `j_8e0e16c7bc4d` (playtest.run, project imaginelivetv, 2026-10-25, GPU server i-0682602c987747b0d (us-west-2), 1280x720): outcome **done** in 1370.2 s, 616 problems (616 bug, 0 warning), console errors 0, warnings 0, failed requests 0. Report and video: `s3://hawkes-playtests-028793236279/imaginelivetv/2026-10-25/j_8e0e16c7bc4d/`.

```
metrics {"splashMs":2600,"endings":12,"sizes":4,"realClick":0,"linesSkipped":19001,"choicesClicked":3492,"endingsPlayed":48,"fpsAverage":60,"fpsWorst":39}
problems:
  48x bug (game): "Take the pencil" shows although its conditions fail
  48x bug (game): "Take the pen" shows although its conditions fail
  48x bug (game): "Ask why the pencil" shows although its conditions fail
  48x bug (game): "Ask for an example line" shows although its conditions fail
  48x bug (game): "Answer the phone" shows although its conditions fail
  48x bug (game): "Hand the phone back" shows although its conditions fail
  48x bug (game): "Back to the wall" shows although its conditions fail
  48x bug (game): "Open the log" shows although its conditions fail
  80x bug (game): "Write the closing line" shows although its conditions fail
  32x bug (game): "Back to the log" shows although its conditions fail
  48x bug (game): "Hand him the tablet" shows although its conditions fail
  24x bug (game): "Tell him about the notice" shows although its conditions fail
  24x bug (game): "Say nothing about the notice" shows although its conditions fail
  12x bug (game): "Wait for him" shows although its conditions fail
  12x bug (game): "Say nothing" shows although its conditions fail
events:
  0 start night-shift-signoff
  34.1 signoff-ending Clean report. (end-clean) at the desktop size: 73 choices, 40.5 minutes of audio, ending shown
  63 signoff-ending Clean report. (end-clean) at portrait phone 390x844: 73 choices, 40.5 minutes of audio, ending shown
  91.9 signoff-ending Clean report. (end-clean) at small phone 360x640: 73 choices, 40.5 minutes of audio, ending shown
  120.2 signoff-ending Clean report. (end-clean) at landscape phone 844x390: 73 choices, 40.5 minutes of audio, ending shown
  148.3 signoff-ending Someone to leave it to. (end-someone) at the desktop size: 73 choices, 40.6 minutes of audio, ending shown
  177.1 signoff-ending Someone to leave it to. (end-someone) at portrait phone 390x844: 73 choices, 40.6 minutes of audio, ending shown
  205.2 signoff-ending Someone to leave it to. (end-someone) at small phone 360x640: 73 choices, 40.6 minutes of audio, ending shown
  234.2 signoff-ending Someone to leave it to. (end-someone) at landscape phone 844x390: 73 choices, 40.6 minutes of audio, ending shown
  262.4 signoff-ending She knew. (end-she-knew) at the desktop size: 73 choices, 40.5 minutes of audio, ending shown
  291.3 signoff-ending She knew. (end-she-knew) at portrait phone 390x844: 73 choices, 40.5 minutes of audio, ending shown
  320.3 signoff-ending She knew. (end-she-knew) at small phone 360x640: 73 choices, 40.5 minutes of audio, ending shown
  348.6 signoff-ending She knew. (end-she-knew) at landscape phone 844x390: 73 choices, 40.5 minutes of audio, ending shown
  376.8 signoff-ending Eat something. (end-eat-something) at the desktop size: 73 choices, 40.6 minutes of audio, ending shown
  405.1 signoff-ending Eat something. (end-eat-something) at portrait phone 390x844: 73 choices, 40.6 minutes of audio, ending shown
  434.1 signoff-ending Eat something. (end-eat-something) at small phone 360x640: 73 choices, 40.6 minutes of audio, ending shown
  462.5 signoff-ending Eat something. (end-eat-something) at landscape phone 844x390: 73 choices, 40.6 minutes of audio, ending shown
  491.1 signoff-ending By the book, alone. (end-by-the-book) at the desktop size: 75 choices, 41.1 minutes of audio, ending shown
  519.8 signoff-ending By the book, alone. (end-by-the-book) at portrait phone 390x844: 75 choices, 41.1 minutes of audio, ending shown
  549.2 signoff-ending By the book, alone. (end-by-the-book) at small phone 360x640: 75 choices, 41.1 minutes of audio, ending shown
  578.5 signoff-ending By the book, alone. (end-by-the-book) at landscape phone 844x390: 75 choices, 41.1 minutes of audio, ending shown
  606.7 signoff-ending The friendly one. (end-friendly) at the desktop size: 73 choices, 40.9 minutes of audio, ending shown
  635 signoff-ending The friendly one. (end-friendly) at portrait phone 390x844: 73 choices, 40.9 minutes of audio, ending shown
  664 signoff-ending The friendly one. (end-friendly) at small phone 360x640: 73 choices, 40.9 minutes of audio, ending shown
  692.2 signoff-ending The friendly one. (end-friendly) at landscape phone 844x390: 73 choices, 40.9 minutes of audio, ending shown
  720.3 signoff-ending Opinions. (end-opinions) at the desktop size: 73 choices, 40.6 minutes of audio, ending shown
  749.1 signoff-ending Opinions. (end-opinions) at portrait phone 390x844: 73 choices, 40.6 minutes of audio, ending shown
  777.2 signoff-ending Opinions. (end-opinions) at small phone 360x640: 73 choices, 40.6 minutes of audio, ending shown
  805.9 signoff-ending Opinions. (end-opinions) at landscape phone 844x390: 73 choices, 40.6 minutes of audio, ending shown
  833.4 signoff-ending Four minutes. (end-four-hours) at the desktop size: 72 choices, 39.6 minutes of audio, ending shown
  861.6 signoff-ending Four minutes. (end-four-hours) at portrait phone 390x844: 72 choices, 39.6 minutes of audio, ending shown
  889.1 signoff-ending Four minutes. (end-four-hours) at small phone 360x640: 72 choices, 39.6 minutes of audio, ending shown
  916.6 signoff-ending Four minutes. (end-four-hours) at landscape phone 844x390: 72 choices, 39.6 minutes of audio, ending shown
  944 signoff-ending Written up. (end-written-up) at the desktop size: 71 choices, 40.0 minutes of audio, ending shown
  971.4 signoff-ending Written up. (end-written-up) at portrait phone 390x844: 71 choices, 40.0 minutes of audio, ending shown
  999.6 signoff-ending Written up. (end-written-up) at small phone 360x640: 71 choices, 40.0 minutes of audio, ending shown
  1027 signoff-ending Written up. (end-written-up) at landscape phone 844x390: 71 choices, 40.0 minutes of audio, ending shown
  1054.3 signoff-ending The wedge. (end-wedge) at the desktop size: 71 choices, 39.8 minutes of audio, ending shown
  1082.2 signoff-ending The wedge. (end-wedge) at portrait phone 390x844: 71 choices, 39.8 minutes of audio, ending shown
  1110.2 signoff-ending The wedge. (end-wedge) at small phone 360x640: 71 choices, 39.8 minutes of audio, ending shown
  1138.4 signoff-ending The wedge. (end-wedge) at landscape phone 844x390: 71 choices, 39.8 minutes of audio, ending shown
  1166.4 signoff-ending Noted. (end-noted) at the desktop size: 73 choices, 40.6 minutes of audio, ending shown
  1195.2 signoff-ending Noted. (end-noted) at portrait phone 390x844: 73 choices, 40.6 minutes of audio, ending shown
  1223.3 signoff-ending Noted. (end-noted) at small phone 360x640: 73 choices, 40.6 minutes of audio, ending shown
  1252.1 signoff-ending Noted. (end-noted) at landscape phone 844x390: 73 choices, 40.6 minutes of audio, ending shown
  1280.1 signoff-ending Under review. (end-under-review) at the desktop size: 73 choices, 40.5 minutes of audio, ending shown
  1308.2 signoff-ending Under review. (end-under-review) at portrait phone 390x844: 73 choices, 40.5 minutes of audio, ending shown
  1336.3 signoff-ending Under review. (end-under-review) at small phone 360x640: 73 choices, 40.5 minutes of audio, ending shown
  1365.2 signoff-ending Under review. (end-under-review) at landscape phone 844x390: 73 choices, 40.5 minutes of audio, ending shown
  1365.2 criterion 12 endings played to the end at 4 sizes (the desktop size, portrait phone 390x844, small phone 360x640, landscape phone 844x390): 48 plays
  1366 finish done
```

#### cctv-art

Gen job `j_15f953a7f97f` (playtest.run, project imaginelivetv, 2026-10-25, GPU server i-0682602c987747b0d (us-west-2), 1280x720): outcome **done** in 73.1 s, 86 problems (86 bug, 0 warning), console errors 0, warnings 0, failed requests 0. Report and video: `s3://hawkes-playtests-028793236279/imaginelivetv/2026-10-25/j_15f953a7f97f/`.

```
metrics {"splashMs":2601,"realClick":0,"linesSkipped":453,"choicesClicked":76,"fpsAverage":59,"fpsWorst":20}
problems:
  86x bug (game): "night-shift: <way> > <scene>: the player says 'N% explored', the scenes reached give 0%" (one per scene entered; the player is right, see gap in group (f))
events:
  0 start cctv-art
  0 splash home: "IMAGINE LIVE TV"
  1.9 splash-gone home: held 1600 ms, faded 1001 ms
  1.9 no-inventory home: landing page
  2.5 camera c1 1 Lobby: 5 states with pictures [normal, desk-visitor, laptop, coat, dawn]
  2.8 camera c2 2 Vestibule: 2 states with pictures [normal, sleeper]
  3 camera c3 3 Loading dock: 2 states with pictures [normal, van]
  3.3 camera c4 4 Stairwell C, 31: 2 states with pictures [normal, wedge]
  3.5 camera c5 5 Elevator lobby, 31: 2 states with pictures [normal, stuck]
  4 camera c6 6 Floor 44 corridor: 4 states with pictures [normal, reader, papers, leak]
  4.2 camera c7 7 58 reception: 2 states with pictures [normal, coat]
  4.3 camera c8 8 Roof door: 1 states with pictures [normal]
  4.6 camera c9 9 Floor 2 alcove: 2 states with pictures [normal, frozen]
  4.6 pictures 22 camera pictures load, 9 cameras
  … 31 more events of the 134 in the report
```

#### night-shift-gaps (the earlier version of this file)

Gen job `j_f39f0b6794f5` (playtest.run, project imaginelivetv, 2026-10-25, GPU server i-0682602c987747b0d (us-west-2), 1280x720): outcome **done** in 5.7 s, 3 problems (0 bug, 3 warning), console errors 0, warnings 0, failed requests 0. Report and video: `s3://hawkes-playtests-028793236279/imaginelivetv/2026-10-25/j_f39f0b6794f5/`.

```
metrics {"gapsListed":53,"fpsAverage":45,"fpsWorst":30}
problems:
  warning (game): night-shift-gaps.md has no report of the console playtest, only that it was not run
  warning (game): night-shift-gaps.md has no report of the stories playtest, only that it was not run
  warning (game): night-shift-gaps.md has no report of the sound playtest, only that it was not run
events:
  0 start night-shift-gaps
  0 start-at gaps
  0 scene story/night-shift-gaps.md
  0.1 criterion group (a): 7 numbered gaps
  0.1 criterion group (b): 4 numbered gaps
  0.1 criterion group (c): 19 numbered gaps
  0.1 criterion group (d): 7 numbered gaps
  0.1 criterion group (e): 6 numbered gaps
  0.1 criterion group (f): 10 numbered gaps
  0.1 criterion the file states 228 scenes, as the data has
  0.1 criterion the file states 1,288 lines, as the data has
  0.1 criterion the file states 12 endings, as the data has
  1.1 criterion shortest path 36.4 minutes, as the data gives
  1.1 criterion typical path 42.2 minutes, as the data gives
  1.1 criterion the output of npm run story -- --check is in the file
  1.3 finish done
```
