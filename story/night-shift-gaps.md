# Night Shift: gaps audit

Audit of Night Shift as it is on beta (commit `20f3bc1`, 2026-10-25). Nothing was fixed; this lists what is missing or wrong, where,
and what would fix it. File names are repo-relative. Counts come from `story/night-shift.json` (205 scenes, 1,199 lines, 580 choices,
11 endings), `hawkes.assets.json` (1,265 Night Shift assets) and the files on disk.

**Headline.** Night Shift is a finished script with almost no media: 18 of 1,199 lines are recorded (1.5%), 0 of 26 camera pictures,
0 of 11 end cards, 0 of 1 landing card. It is still a draft (`listed: false`). The shortest way through is **34.3 minutes**, the
**typical (median, average) way 40.2 minutes**, the longest 48.3. The story is long enough, but the average is under the 45 the
`night-shift` playtest names, and a player who plays at random ends badly every time.

## How this was checked, and what was not run

- Run here and pasted in the appendix: `npm run story -- --check`, `node tools/check-night-shift.mjs`, `npm run test:console`
  (the build's own tests), plus scripts reading the data (state explorer from `js/console-rules.js`: 142,298 states, not capped).
- **Not run here: the browser playtests `console`, `stories`, `sound`, `night-shift`, `night-shift-audio`.** This server never
  starts a browser (Playwright, Chrome), so there is no real output of them in this file and no screenshots at 390x844, 360x640 or
  844x390. Group (d) is therefore a read of the code and CSS, not a playthrough, and says so on each line. Beta's playtest runs
  `night-shift` (named in `.hawkes/scenario.txt`); the T4 run of `console`, `stories` and `sound` should be added next to the
  appendix when J or Talk asks for it. This is the first thing left to do.

## (a) Audio: lines and cues with no made file

Voices: all 11 speakers have a locked ElevenLabs id in `speakers.<id>.voice` (`story/night-shift.json`), so nothing in the cast
is unlocked. Recorded: 18 lines (`handover` 12, `coat-lobby` 3, `pierce-signin` 3). Unmade: **1,181 of 1,199 lines** in **202 of 205 scenes**.

| Speaker | Voice id | Locked | Lines | Made | Unmade |
| --- | --- | --- | --- | --- | --- |
| dee | `qhe779QaY6YuY9d3VGab` | locked | 567 | 4 | 563 |
| narrator | `IFbrwI7VRvX2VkoD4Y3K` | locked | 403 | 5 | 398 |
| okafor | `Xxe1qCvSvBHFD7OTAz9I` | locked | 93 | 7 | 86 |
| marisol | `Iok0Qd1zNVnFs3DULx6Z` | locked | 49 | 0 | 49 |
| terrell | `idZn18yShmcD0ePsg1A5` | locked | 37 | 0 | 37 |
| adler | `QJ9eYeuXwMsC2KElXT1P` | locked | 24 | 0 | 24 |
| dev | `zcQcgx11ALPbj0o2PFsw` | locked | 11 | 0 | 11 |
| brandt | `ZyVqOeng5wFOY7UfrjR9` | locked | 5 | 0 | 5 |
| courier | `cOJkIUDUojZtwaJSfMzy` | locked | 5 | 0 | 5 |
| sleeper | `YSWR6wrmdI2sOa3gtoye` | locked | 3 | 0 | 3 |
| pierce | `ZthjuvLPty3kTMaNKVKb` | locked | 2 | 2 | 0 |

Per scene, unmade lines (every scene not listed has all its lines made: `handover`, `coat-lobby`, `pierce-signin`):
binder-44 10, binder-thu 10, okafor-out 8, okafor-out-fast 8, the-chairs 6, the-chairs-knock 7, chair-good 6, chair-hers 7, chair-clock 6, radio-ok 7, radio-late 8, radio-dee 8, talk-commute 6, talk-sandwich 7, talk-game 7, w1-named 7, w1-normal 7, w1-dead 8, w2-cam9 7, w2-roof 7, w2-look 7, sign-pencil 8, sign-pencil-44 9, sign-pen 8, sign-pen-44 9, sign-why 9, sign-why-44 10, nephew-in 6, nephew-held 8, nephew-papers 7, log-in-asked 6, log-in-watch 6, log-held 7, log-papers-read 5, log-papers-pass 4, end1-fact 9, end1-opinion 9, end1-omit 9, end1-lie 10, sign-sample 10, sign-sample-44 11, tour1-door 5, tour1-wedge 6, tour1-count 5, tour2-trucks 5, tour2-lock 5, tour2-compactor 5, tour3-test 7, tour3-alone 8, tour3-sign 8, visitor-waved 7, visitor-checked 7, visitor-desk 8, terrell-goodbye 7, radio-23 5, terrell-door 11, terrell-ask 10, terrell-school 12, day-log 7, alone-ok 5, alone-late 6, alone-missed 7, drawer-notice 7, wall-alone 7, step-out 1, step-told 6, step-left 5, okafor-call 2, okafor-call-clean 6, okafor-call-opined 5, okafor-call-lied 5, sandwich 3, sandwich-ray 4, sandwich-quiet 5, sandwich-career 7, sandwich-coffee 7, birthdays-ask 7, birthdays-pencil 7, late-list 3, late-quiet 3, late-read 4, late-zurich 4, wedge-watch 5, wedge-seen 4, wedge-seen-badge 3, wedge-called 7, wedge-dee 6, wedge-wait 5, wedge-missed 6, laptop-watch-f 5, laptop-watch-o 6, laptop-watch-m 6, laptop-watch-l 6, laptop-seen 5, laptop-told 5, laptop-got 5, laptop-badge 4, laptop-opened 5, awake-0225-f 4, awake-0225-o 4, awake-0225-m 4, awake-stand 7, awake-bank 7, awake-coffee 7, marisol-thanks 9, marisol-dee 8, marisol-floors 7, tenant-log 4, tenant-promise 4, tenant-go 7, leak-watch 5, leak-marisol 5, leak-okafor 5, leak-go 6, leak-quiet-f 5, leak-quiet-o 5, leak-quiet-m 5, four-hours 5, dee-shut 3, three-oclock 6, three-no 4, dev-stuck 5, dev-stuck-met 5, dev-talk 6, dev-ok 6, dev-stay 4, dev-company 6, dev-911 4, dev-dee 8, pierce-waved 2, chairman-talk 4, dee-back-waved 5, dee-back-signed 5, cam9-seen 4, cam9-missed 4, trouble-signal-f 6, trouble-signal-o 6, trouble-signal-m 6, trouble-signal-l 7, trouble-silenced 3, okafor-trouble 4, adler-call 3, adler-exact 4, adler-short 4, adler-arrives-f 6, adler-arrives-o 7, adler-arrives-m 7, adler-arrives-l 7, courier-intercom 8, courier-who 2, courier-refused 4, courier-signed 3, courier-super 4, hum-0435-f 3, hum-0435-o 3, hum-0435-m 3, hum-along 6, hum-quiet 6, hum-ask 6, sleeper-watch 4, sleeper-wake 3, sleeper-kind 4, sleeper-sent 4, sleeper-super 4, sleeper-911 4, dawn-tablet-f 3, dawn-tablet-o 3, dawn-tablet-m 3, twelve-check 2, dee-back-0520 4, twelve 5, twelve-shut 3, light 9, write-up-clean 5, write-up-sloppy 5, write-up-lied 4, confess 3, late-okafor 5, late-adler 5, closing-line 4, shift-prep-f 7, shift-prep-o 7, shift-prep-m 7, shift-prep-l 8, six-thirty 5, okafor-reads-solid 8, okafor-reads-sloppy 8, okafor-reads-slips 8, okafor-reads-wall 7, okafor-reads-open 6, okafor-reads-lie 6, end-clean 7, end-someone 6, end-she-knew 7, end-eat-something 6, end-by-the-book 5, end-friendly 7, end-opinions 5, end-four-hours 7, end-written-up 6, end-wedge 5, end-noted 4.

1. `night-shift/*/media/line-N.mp3`, 1,181 files, 80,148 characters of text. `node tools/make-audio.mjs night-shift --list` shows each. Fix:
   make them with Hawkes Gen (`audio.voice`, the recipes are in `hawkes.assets.json`), then `--ingest` or `--mix`, `--dur`,
   `npm run story`. `hawkesgen_estimate` prices this at about **$17.36 of API cost (ElevenLabs), no GPU**, about 1,181 calls. Not made here: it is the biggest single block and J has not approved the spend.
2. Dee is 563 of the 1,181 (48%); by the unmade count the order is Dee 563, narrator 398, Okafor 86, Marisol 49, Terrell 37, Adler 24, Dev 11, Brandt 5, courier 5, sleeper 3. Dee has 4 recorded lines of 567, so the character the story is built around cannot be heard yet. Make Dee and the narrator first (82% of the lines).
3. `night-shift.json` `lines[].dur` is a guess (words / 2.5 s + 1 s) for 1,181 lines and the recording's length for 18. When the files are made, `--dur` will move every time in the story, and the timing numbers in group (c) with it (voiced lines of "perform"-tagged ElevenLabs speech usually run slower than 150 wpm, so expect the night to get longer).
4. Brandt (5 lines, the tenant on 40) has a locked voice (`ZyVqOeng5wFOY7UfrjR9`) but no voice sheet in `story/night-shift.md`, section 3 (the sheet lists 10 voices; the "Voices as made" paragraph names Brandt). Fix: add his sheet.
5. Treatments are not applied: `story/night-shift.md` ("Voices as made") says the radio, walkie, intercom and phone filters are not applied and the recordings are clean. Affected: Okafor on the night line (`okafor-call*`, `sleeper-super`), Marisol on the walkie (`sign-why`, `marisol-*`), Dev on the intercom (`dev-*`), Adler on the phone (`adler-call`, 24 lines), the courier on the dock intercom (5 lines), Pierce "heard from across a lobby" (the 2 made lines are unprocessed). Fix: an ffmpeg filter step per scene/speaker in `tools/make-audio.mjs`.
6. Ambience: all 10 beds are made and mixed (-38 LUFS), but `control-room-late` is not used by any scene (`ambience: control-room-late` appears 0 times in the data; the doc says the control room "at three in the morning, quieter"). The 3 am scenes (`three-oclock`, `four-hours`, `hum-*`, `twelve`) use the daytime bed. Fix: set `ambience: control-room-late` on the 02:00-05:00 control-room scenes.
7. Effects: all 18 cues are made, none unused. Only a line with an `sfx` plays one; no scene has an effect of its own, so a scene with only narration and no cue is silent but for the bed. No gap in files; gap in use (the panel buzzer, the elevator chime and the footsteps fire only where a line names them).
8. Music: none. The story has no music cue field and no score (The Water Road has `assets/story/music`). The doc never asks for one; listed so J can say no. Fix if wanted: a `music` cue type in the data, or leave the beds.
9. 1,181 lines have `file` set in `js/story-data.js` for recordings that do not exist (1,206 `file` entries). Every unmade line makes the player request a missing mp3 (a 404 on GitHub Pages), see `js/console.js` `playLine`: `voice.onerror` falls back to the timer. It works but makes up to 1,181 failing requests in a full run. Fix: `tools/build-story.mjs` should leave `file` out until the file exists.

## (b) Art: stand-ins

The build uses `night-shift/media/standin/*.svg` (drawn by `tools/make-standins.mjs`) for every picture. Real pictures are 0 of 38.

10. **26 camera pictures** (`night-shift/media/feeds/<cam>-<state>.png`, recipes `night-shift-feed-*`): c1 6 states, c2 3, c3 2, c4 2, c5 3, c6 4, c7 2, c8 1, c9 3. 9 are `image.generate` (3 candidates each, the `normal` ones), 17 are `image.edit` of the normal. All are flat shapes and silhouettes now. Fix: make them (priced below).
11. **4 states no scene shows**, so their recipes would be wasted money: `c1:box` (the courier's box on the lobby desk), `c2:empty-cold`, `c5:cart`, `c9:trouble`. The last matters: the panel's trouble light (the story's life-safety beat, `trouble_open`) is never shown on the wall; the player only hears it. Fix: either use the state in the scene (`feeds: {"c9": "trouble"}` on the panel scenes; `c1:box` in the 04:00 box scenes) or delete the state and its recipe.
12. **c8 (Roof door)** has only `normal`, and the roof door is only a camera that never changes; the doc has "the roof-door sensor that goes quiet" and the 03:00 roof tour. Fix: a `c8` state, or accept it and say so in the doc.
13. **135 of 205 scenes** set no `feeds`, so the wall is the all-normal stand-in grid for most of the night. Normal pictures carry the whole look. Fix: nothing needed; note that so the 9 normal stills carry the look for two thirds of the scenes: pick those by eye.
14. **11 end cards** (`night-shift/media/endcards/<ending>.png`): all stand-ins. Fix: make them; each is one `image.generate`.
15. **Landing card** `assets/images/night-shift.svg` is an SVG stand-in; the recipe `night-shift-card` writes `assets/images/night-shift.jpg`, and `story/stories.json` still points at the `.svg`. Fix: after making, change `image` to the `.jpg` and `alt` stays.
16. Cost to make all of it, priced with `hawkesgen_estimate` (project imaginelivetv): 27 + 17 + 11 + 1 = 56 images, about 478 GPU-seconds of work, 1 server about 16 minutes, **$0.47 GPU, $1.09 with the idle tail** (about $1 if the server is stopped at once). Needs J's GPU approval; none was used.

## (c) Script quality

### Timing

17. Playing time (`node tools/check-night-shift.mjs`: words at 150 a minute plus 1 s a line, or the recording's length): **shortest 34.3 min** (to `end-four-hours`), **average 40.2 min** (every open choice equally likely), **median 40.2 min** (3,000 random plays: 10% 38.8, 90% 41.6), **longest 48.3 min**. Words only at 150 wpm: shortest 28.8 min (4,324 words), average 34.0 (5,104), longest 41.0 (6,152). The pauses (1,199 lines at 1 s) add about 6 minutes.
18. Shortest way to each ending, in minutes: Four hours 34.3, Wedge 34.4, Written up 34.8, Opinions 35.2, Friendly 35.5, Noted 35.5, Eat something 35.9, Clean report 35.9, She knew 35.9, Someone to leave it to 36.0, By the book 37.7. Every ending is 62 to 69 scenes deep.
19. The `night-shift` playtest in `js/playtest.js` expects "average about 45"; the data gives 40.2. Fix: either make the playtest say about 40, or write the missing five minutes. After voice is made this will move (see a3).
20. A player who plays at random (every open choice equally likely) gets a bad ending every time: exact odds are Written up 30.9%, Friendly 23.2%, Wedge 17.6%, Opinions 16.6%, Four hours 11.6%, and **under 0.005% each for Noted, Eat something, Clean report, She knew, Someone to leave it to, By the book.** 3,000 plays met 5 of 11 endings. A bot or a distracted player never sees the good endings; a real player must do the job well. This is a design choice, but worth J knowing: 6 of 11 endings need near-perfect play. The `night-shift` playtest walks only the endings it was told to.

### Dead-feeling choices

The build counts a choice as having an effect if it changes state, branches uniquely, **or has a `log` line of its own** (575 of 580 choices have one), so the check is weak: the log line alone passes it.

21. **167 of 580 choices change no flag or meter in any state** (28.8%), spread over 105 scenes; they matter only for the shift log's wording. Examples: `tour1-door`, `tour1-wedge`, `tour1-count` (three choices each, all lead to the same three scenes, none sets anything), `tour2-*`, `binder-44`/`binder-thu` (both go to `okafor-out`), `light`. Fix: give each a flag or meter (or `cosmetic` with a reason, which the build caps at 2 a run), or merge them.
22. **16 choices neither change state nor lead anywhere another choice does** (the explorer's "no branch"): `wedge-watch` #1 "Watch the lobby", `laptop-watch-f/o/m/l` "Look at the vestibule", `dee-back-waved`, `dee-back-signed`, `chairman-talk` "Look at the lobby", `tenant-go` x2, `twelve` "Give her the wall" (it adds trust, but `twelve` is only reachable at trust 3, the cap, so it changes nothing, and it goes where "Sit with her" goes) and 5 in `okafor-reads-solid`. They pass only because of their log line.
23. `tenant-go` shows the same button twice: "Look at the wall" appears as two choices to `leak-watch` (no gate separates them, nothing differs but the log text), and its scene has two narrator lines for the same moment ("The wall settles again." with and without the coffee line) played back to back. Fix: one choice, and one of the two lines (or gate the coffee line by scene variant).
24. 15 scenes have every choice lead to the same next scene: `nephew-held`, `tenant-go`, `dev-ok`, `dev-stay`, `dev-company`, `dev-911`, `dev-dee`, `pierce-waved`, `pierce-signin`, `adler-arrives-l`, `twelve`, `shift-prep-f/o/m/l`. The log-wording ones (the three-way "Log it exactly / Add what you thought / Leave it out") are the story's best idea and set `opined`/`lied`; the `shift-prep-*` four do change a meter each (warmth, trust, building_known), so they are real, but the player is not told; `adler-arrives-l` and `twelve` (+1 trust or warmth) are small. No fix needed beyond making the effect felt in a later line.
25. `okafor-reads-solid` has 15 choices in one scene (3 button texts repeated, each gated by a meter range): correct by the engine, but a very large gate table to maintain. In the `end-by-the-book` and `end-clean` branches, "Tell him about the notice" and "Say nothing about the notice" go to the same ending, so the player's answer there changes nothing but the log line. Fix: let telling Okafor show in those two endings.

### Style guide (`story/night-shift.md`, section 4)

`tools/check-night-shift.mjs` passes. These are what it does not catch:

26. **"A page's text is ≤ 40 words"** (style guide, Length): **186 of 205 scenes exceed it** (median 72 words, longest `terrell-school`, 165). The checker only limits a single narration line to 42 words (6 lines are 41) and a speech to 32, so the guide and the checker disagree. Fix: either change the guide to say "a line", or cut the long scenes (`terrell-school`, the Act 2 chats).
27. **Dee says "Probably"** in 4 lines (`write-up-sloppy` line 3 "Seemed. Probably. Seemed.", `laptop-watch-o`, `awake-0225-o`, `hum-0435-o`): they read as deliberate (she is quoting the player's opinion back), but the checker never tests it. Adler, who never says "probably", does not. No fix needed; note kept.
28. **Ending lines that end on speech, not an object** (guide: "Scenes end on an object or an action"): `end-she-knew` last line is Dee's "I'd have told him in April. Mm. It's the book. Clip it on." The other ten end on narration (an object or the clock). Fix: move the narrator's "holds the fourth one out" line last.
29. **Tidy-speech risk lines** the regex cannot judge: `three-oclock` 2 "Nothing happens at three o'clock. That's why we're here." (Dee's own sample line in the doc, but it explains the night), `adler-call` 3 "The panel says what it means. Read it exactly." and `talk-commute` 3 "You'll learn the seven by smell." (close to the banned "you'll understand someday"). Fix: cut or rewrite those three.
30. **Feelings in the open**: `twelve` has no stated feeling, good. A scan of 567 Dee lines finds "Mm." as the whole line 29 times and as the last word 58 times; at that density "Mm." is a tic more than the sorry-substitute the guide wants. Fix: audit for lines where "Mm." carries nothing.
31. **The tagline is a banned phrase**: `story/night-shift.json` `tagline` is "Observe and report." and the doc's Tagline line says the same; the guide says nobody says it "except as a flat quotation of the post orders". It is a tagline, not a line, but J should know. The checker's banned list covers lines and choices only, not `tagline`. Fix: a different tagline, or one scene where the post orders quote it flatly.
32. **Dev**: guide says he never says "I'm claustrophobic"; none of 11 lines do. **Terrell** never says "No": none of his 37 lines start with it. **Pierce**: 2 lines, only in `coat-lobby` and `pierce-signin`; clean. **Board**: only "Hale's office", "Lang's on with Zurich"; no first names; clean. **Unspoken words**: none present.

### Continuity

33. **The weekday of the night is never fixed and the endings name different days.** `end-clean`, `end-eat-something`, `end-noted` have Dee say "Tuesday" for her next shift; `end-she-knew` says "Thursday"; `handover` and `binder-thu` have Okafor say the contractor returns "Thursday" and a man was in the vestibule "Tuesday" (Terrell's birthday was "Tuesday" too). If the night is Wednesday, "Tuesday" is six days away. Fix: choose the night (Wednesday), and write the next shift as "tomorrow" or "Thursday" everywhere.
34. **Dee's years**: Ray died "eleven years ago" (doc) and `terrell-ask` says "Eleven years? Twelve?" about her unbroken streak; `twelve` says "Nine years" since the room was taken out. Consistent, but the doc says the 12th floor was "his old shop" and the game says only "a bench, a kettle" so the player cannot tell it was Ray's. That is on purpose; no fix.
35. **The notice date**: `drawer-notice` says "Effective the first of April"; `end-someone` has Dee say "April first"; `end-she-knew` says "I'd have told him in April"; but the night has "fourteen degrees" winter ledge scenes, so April is plausible, but the date of the night is never given (see 33).
36. **Reveal layers all reach a scene**: the explorer reaches all 205 scenes in 142,298 states, so none of the layers is unreachable: layer 2 `sign-why` (shortest 13 scenes in), layer 3 `four-hours` (40), layer 4 `twelve` (57), layer 5 `drawer-notice`. The doc and the data differ on the conditions: doc layer 4 needs high trust and having caught the 03:00 line (or covered for her); the data (`dee-back-0520`, "Ask where she goes at three") needs `noticed_12th` and trust 3. The doc's meters run trust 0-5 and warmth 0-5; the build's run 0-3 and 0-2. Fix: update section 6 of the doc to the built numbers.
37. **Two meanings for "four hours"**: Dee's layer 3 scene `four-hours` (warmth 2, the player stayed on the wall) and the ending `end-four-hours` (the player left the wall) share the words for opposite behaviour. Fix: rename one.
38. **Building knowledge is thin**: `building_known` has a maximum of 2 (two `noticed_*`), and `end-someone` and `end-she-knew` need 2, while `end-eat-something` is the default "close" ending. Whether two looks are easy to miss is not measured here. Fix: measure it with the explorer, or raise the weight.
39. **Doc against data**: doc section 5 lists nine endings; the build has 11 (Eat something and Noted are added). Sections 5 and 6 are stale (see 51).

## (d) Engine and mobile (read of the code; the playtests were not run here)

40. **Not verified in a browser**: the wall, subtitles, line buttons, choices and Log at 390x844, 360x640, 844x390; the 44 px targets; the Settings sound controls; the reload at several points; the Log at the start, midway and at an ending. The `console` scenario checks all of them with real presses on a runner; its result is not in this file. Fix: run `console` on the T4 and paste its report into the appendix.
41. **Layout, from the CSS**: `css/site.css` sets `min-height: 44px` on the console buttons (lines 1593, 1596, 1619, 1743, 1787), and has a landscape rule `@media (orientation: landscape) and (min-width: 640px)` (line 1801) and a portrait rule `max-width: 559px` (line 1820). 844x390 is landscape and 360x640 is below 559 px, so both have a rule; whether the 44 px buttons plus the 3x3 wall fit in 390 px of height is not known. Likely weak spot: landscape height 390 with a 3x3 wall and 15 choices of `okafor-reads-solid`.
42. **Audio unlock**: `js/console.js` plays voice, bed and effects through three `<audio data-sound-start>` elements that `js/hawkes-sound.js` unlocks inside the Tap to play press, and a silent clip (`SILENCE`) starts them for iOS; a line rejected with `NotAllowedError` waits for the prompt and retries (`playLine`). That is the right shape. **Not tested with a real `page.mouse.click`** here; the `console` scenario records whether the press was trusted. A gap by design: `playLine` retries every 250 ms forever if the press never comes.
43. **Missing recordings are silent**: a line with no file is read on a timer with no sound, subtitles only. With 1,181 of 1,199 lines unmade a full play is about 40 minutes of bed and subtitles. Nothing tells the player the voices are not made. Fix: fine for a draft; nothing to show until the voices are made.
44. **Saved progress**: `iltv.run.nightShiftProgress` keeps the scene, history, flags, meters, log and `run.done` (lines heard). Resume code is in `enter(id, resumed)`. Not exercised here.
45. **Analytics**: `js/console.js` tells `scene`, `choice` and `feature` (`feed`, `log`) to the hooks; `AGENTS.md`'s Analytics section describes the player's events but not a console story's (no `level_start` for console scenes is documented, no `video` events, line/subtitle events none). The `analytics` playtest, per AGENTS.md, opens The Final Spark only, so a console story's events are not covered. Fix: document it, or add the console events.

## (e) Landing

46. `story/stories.json`: `night-shift` has `"listed": false`, so it has no card on the landing page and the badge and Start Over cannot be seen there; it plays at `/?story=night-shift` and `/night-shift/`. That is the intended state while it is a draft ("Waiting for J").
47. The card's `image` is `/assets/images/night-shift.svg` (a stand-in) and the logline says "Nine cameras of nothing", which matches the nine cameras (the doc's "Waiting for J" asked to fix the count: done). The title, tagline and logline are still marked waiting for J in the doc.
48. `night-shift-demo` is also unlisted and generates 4 warnings in `npm run story -- --check` (no voice for `dee` and `terrell`, 5 flags set and never read). Harmless, but the check output is noisy. Fix: give the demo no warnings or exclude it.
49. The card's badge, percent and Start Over for a console story are exercised by `stories` only for drafts by link. When the story is listed, the `stories` scenario's "a card for every listed story, in order" will check the card for the first time, with a stand-in picture: make the `.jpg` before listing (item 15).
50. The unlocks cookie keeps a bit per scene in `scenes` order ("new scenes go at the end"): 205 scenes is 26 bytes of bits; fine, but any later reorder would corrupt saved places. Not a gap now; a rule to keep.

## (f) Docs and the Studio playtest scenarios

51. `story/night-shift.md` is out of date in its header: "No media is made yet" (it is: 10 beds, 18 effects, 18 voice lines); section 5 "Nine endings" (11 built); section 6 state model (the bigger model of the first plan; the built model is under "The built night"); "The built night" says "200 scenes, about 1,150 lines" (205, 1,199). Fix: one edit pass.
52. `story/night-shift.md` "Waiting for J" still lists the media budget as open and says "No media was made", contradicting "Voices as made (2026-10-25)" two sections later. Fix: update.
53. `story/night-shift-slice-notes.md` says it is superseded. It is still in the folder; keep as history or delete.
54. `AGENTS.md` lists `console`, `night-shift` and `night-shift-audio`, but **not `cctv-art`** (`js/playtest.js` line 2844, a registered scenario), and says its `night-shift` scenario expects the average "about 45" (the data gives 40.2). Also says "11 voices ... the 11 voices are locked" (true) and "story/night-shift.json (the whole night, a draft)". Fix: add a `cctv-art` row.
55. `AGENTS.md` and `js/playtest.js` describe `night-shift-audio` as "fails while lines are still unmade (the count is a metric)": it will fail on beta now (1,181 unmade lines), so beta's playtest list is red for this scenario until the voices are made. Fix: make the audio first, or accept the failure until then.
56. `hawkes.assets.json` has 1,265 Night Shift assets; `hawkes.assets.lock.json` has 46 of them (18 voices + 10 beds + 18 effects), none stale and none whose file is missing. The other 1,219 are unmade by design. The file is 951 KB; nothing to fix.
57. `story/README.md` describes `cctv-art` in one sentence only.
58. The scenarios `console` and `night-shift` each take 240 s and about 8 minutes; they have not been run against this commit in this audit (see "not run").

## Appendix: real command output

### `npm run story -- --check`

```
> imagine-live-tv@1.0.0 story
> node tools/build-story.mjs --check

warning  night-shift-demo: dee has no voice id yet, so its lines have no voice recipe (the player reads them on a timer until they're made)
warning  night-shift-demo: terrell has no voice id yet, so its lines have no voice recipe (the player reads them on a timer until they're made)
warning  night-shift-demo: flag radio_answered is set but no choice reads it
warning  night-shift-demo: flag told_super_wedge is set but no choice reads it
warning  night-shift-demo: flag dee_read is set but no choice reads it
warning  night-shift-demo: flag log_fact is set but no choice reads it
warning  night-shift-demo: flag log_quiet is set but no choice reads it
ok       4 stories, 253 scenes, everything generated is up to date
```

### `node tools/check-night-shift.mjs`

```
205 scenes, 1199 lines (567 Dee), 11 endings, 142298 states explored
playing time: shortest 34.3 min | average 40.2 min (every open choice equally likely) | median 40.2 (3000 random plays: 10% 38.8, 90% 41.6) | longest 48.3 min
endings met in 3000 random plays: 5 of 11; Pierce speaks in: coat-lobby, pierce-signin
ok       night-shift
```

### `npm run test:console`

```
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
```

### The playtests `console`, `stories`, `sound`

Not run in this change: no browser may be started on this server (see "How this was checked"). Beta's playtest runs `night-shift` (see `.hawkes/scenario.txt`), and a `console`, `stories` and `sound` run on the T4 can be asked for; the report goes here.
