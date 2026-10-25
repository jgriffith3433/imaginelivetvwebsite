# Night Shift: gaps audit

Re-done 2026-10-25 against beta at `b0d1875` (the first audit, #28, was written before the script polish, voices, art and engine
fixes of #29 to #36 and was out of date; this replaces it). Nothing was fixed here. File names are repo-relative. Counts are from
`story/night-shift.json` (228 scenes, 1,288 lines, 621 choices, 12 endings), `hawkes.assets.json` (1,375 Night Shift assets) and the
files on disk, by scripts named in the text.

**Headline.** Night Shift is now almost fully made: **1,288 of 1,288 lines are recorded (0 unmade)**, 10 of 10 ambience beds, 18 of 18
effects, 26 of 26 camera pictures, 12 of 12 end cards and the landing card exist. What is missing is the **6 music stings** (the only
unmade assets: `6 of 1322 have no file`) and everything that needs a browser to prove. Shortest way through: **36.4 minutes**.
Typical way (average = median): **42.2 minutes**. Longest: 50.4 minutes.

## How this was checked, and what was not run

- Run here, output pasted in the appendix: `npm run story -- --check`, `node tools/check-night-shift.mjs`, `npm run test:console`,
  `node tools/make-audio.mjs night-shift --list`, `node tools/ending-times.mjs`, plus scripts reading the data and the state explorer
  (`js/console-rules.js`: 240,254 states, not capped, 0 stuck).
- **Not run here: the browser playtests `console`, `stories` and `sound`** (and `night-shift-audio`, `night-shift-signoff`, `cctv-art`).
  This server never starts a browser, so there is no real output of them in this file. The brief asked for it; it cannot be honestly
  produced here. They run on the T4 (Studio's playtest). To close this gap, ask Talk for a playtest of `console`, `stories` and `sound` and paste
  the reports under "Appendix" (item 40). The new scenario `night-shift-gaps` (item 58) checks that this file has them.
- Group (d) is therefore a read of the code and CSS, not a playthrough, and says so on each line.

## (a) Audio: lines and cues with no made file

Voices: all 11 speakers have a locked ElevenLabs id in `speakers.<id>.voice` (`story/night-shift.json`): narrator, dee, okafor, terrell,
marisol, dev, adler, courier, sleeper, pierce, brandt. **None is unlocked.** Per speaker (lines / made / unmade):
narrator 445 / 445 / 0, dee 606 / 606 / 0, okafor 95 / 95 / 0, marisol 49 / 49 / 0, terrell 40 / 40 / 0, adler 24 / 24 / 0, dev 14 / 14 / 0,
brandt 5 / 5 / 0, courier 5 / 5 / 0, sleeper 3 / 3 / 0, pierce 2 / 2 / 0. Per scene: 228 scenes, every `<folder>/media/line-N.mp3` exists,
**0 scenes with an unmade line**.

1. **Music: 0 of 6 stings made** (`night-shift/media/music/{shift-begins,the-panel,fifty-eight,ending-plain,ending-warm,ending-cold}.mp3`,
   recipes `night-shift-music-*` in `hawkes.assets.json`; `node tools/make-audio.mjs night-shift --list` lists exactly these 6). 18 scenes
   name a cue (`handover`, `pierce-signin`, the four `trouble-signal-*`, the 12 endings). Each is an `audio.music` of 20 s, ACE-Step on
   the GPU. `hawkesgen_estimate` (project imaginelivetv): 61 GPU-seconds, **$0.08 GPU, $0.70 with the idle tail (about $0.08 if the
   server is stopped at once), 3 minutes, 1 server**. Needs J's GPU approval; none was used. Fix: approve and make them, then `--mix`, `npm run story`.
2. **Treatments are not applied.** `story/night-shift.md` ("Voices as made") says the radio, walkie, intercom and phone filters are not
   applied and the recordings are clean. Affected: Okafor on the night line (`okafor-call*`, `sleeper-super`), Marisol on the walkie
   (`sign-why`, `marisol-*`), Dev on the intercom (`dev-*`, 14 lines), Adler on the phone (`adler-call`, 24 lines), the courier on the dock
   intercom (5), Pierce "heard from across a lobby" (2). Fix: an ffmpeg filter step per scene and speaker in `tools/make-audio.mjs`.
3. **Brandt (5 lines, the tenant on 40) has a locked voice but the doc's voice sheet (section 3) lists ten voices without him.** Fix: add his sheet to `story/night-shift.md`.
4. **Effects exist (18 of 18, all used) but only a line with an `sfx` plays one**; a scene has no effect of its own, so a scene of narration alone is bed only.
   Gap in use, not files. Fix: only if J wants more; add `sfx` to the lines.
5. **Beds**: 10 of 10 made, all used (`control-room-late` in 62 scenes, `control-room` 93, `morning` 18, `lobby` 14, `vestibule` 9, `stairwell` 8, `dock` 8,
   `elevator` 8, `corridor` 5, `roof` 3). The old gap "late bed unused" is fixed. No gap.
6. **Recorded lengths fix the clock**: `dur` is set from the recordings (`--dur`), so the numbers in (c) are the real ones; any re-record needs
   `--mix`, `--dur`, `npm run story` again (the build says "everything generated is up to date" now).
7. The recordings have not been listened to in this audit: only that they exist (`night-shift-audio` checks decode, length and loudness on the T4; not run here).

## (b) Art: stand-ins

The stand-in SVGs are gone (`tools/make-standins.mjs` and `night-shift/media/standin/` do not exist; no `.svg` in `js/story-data.js`). **Stand-in
pictures: 0.** Real: 26 camera pictures in `night-shift/media/feeds/` (c1 6 states, c2 3, c3 2, c4 2, c5 3, c6 4, c7 2, c8 1, c9 3), 12 end cards in
`night-shift/media/endcards/`, the landing card `assets/images/night-shift.png`.

8. **4 camera states are made but no scene shows them**: `c1:box` (the courier's box), `c2:empty-cold`, `c5:cart`, `c9:trouble`. The last matters: the panel's
   trouble light (`trouble_open`, the story's life-safety beat) is never shown on the wall, only heard. Fix: set `feeds: {"c9": "trouble"}` on the `trouble-signal-*`
   scenes, `c1:box` on the courier scenes, or delete the states.
9. **c8 (Roof door) has one state** (`normal`) for a story with a 03:00 roof tour and "the roof-door sensor that goes quiet". Fix: a `c8` offline state, or accept it.
10. **155 of 228 scenes set no `feeds`** (73 do), so the nine `normal` pictures carry two thirds of the night. Fix: nothing needed; pick those nine by eye.
11. The pictures' look has not been judged by eye in this audit (a file exists; `cctv-art` checks load, format and one look per camera, not run here).

## (c) Script quality

### Timing

12. Shortest way **36.4 minutes** (`end-four-hours`, 72 choices); **typical way 42.2 minutes** (average with every open choice equally likely; median 42.2,
    3,000 random plays: 10% 40.9, 90% 43.6); longest 50.4. (`node tools/check-night-shift.mjs`: each line's recording length plus the player's 0.35 s gap.)
    Per ending, shortest to longest minutes: Four minutes 36.4 to 49.6, Wedge 36.5 to 49.3, Written up 36.6 to 50.1, Opinions 37.3 to 50.2, Noted 37.4 to 49.9,
    Friendly 37.5 to 50.4, Clean 38.0 to 50.0, Eat something 38.0 to 50.1, She knew 38.0 to 49.7, Under review 38.1 to 49.7, Someone to leave it to 38.2 to 49.8,
    By the book 38.7 to 48.8 (`node tools/ending-times.mjs`). These are computed, **not timed from a played walk**.
13. The brief's "about 45" for the average is not met (42.2); `js/playtest.js` `night-shift` warns outside 40 to 50, so it passes. Fix: say "about 42" in the scenario's
    title and `AGENTS.md`, or add three minutes.
14. **A random player ends badly**: 3,000 random plays met **5 of 12 endings** (`check-night-shift.mjs`); the good endings need near-perfect play. A design choice; J should know.

### Dead-feeling choices

The build counts a choice as live if it changes state, branches uniquely or has its own log line. Re-measured with the explorer: of 621 choices, **82 change no flag or
meter in any state (13%), in 45 scenes**, 0 are unreachable, 0 neither change nor branch (the old list of 16 "no branch" choices is fixed).

15. The 82 matter only for the shift log's wording or the scene they pick: `six-thirty` 7, `okafor-reads-solid` 12, `okafor-reads-sloppy/slips/wall/open` 4 each, `okafor-call` 3, then one each in
    `visitor-desk day-log drawer-notice step-told step-left okafor-call-clean late-quiet late-read late-zurich tenant-log tenant-promise tenant-go four-hours dee-shut
    trouble-silenced okafor-trouble twelve-check twelve-shut light write-up-clean write-up-sloppy okafor-reads-lie twelve-sat twelve-wall tailgate-*, cover-*, flicker-*`.
    Fix: give each a flag or meter, or accept them as the log-wording choices (the story's best idea) and say so.
16. **14 scenes send every choice to the same next scene**: `okafor-out-fast nephew-held dev-ok dev-stay dev-company dev-911 dev-dee pierce-waved pierce-signin adler-arrives-l
    shift-prep-f/o/m/l`. `shift-prep-*` change a meter the player is never told about. Fix: a later line that shows it.
17. **Repeated button texts in 25 scenes** (`tour3-*`, `okafor-call*`, `write-up-*`, `confess`, `late-*`, `six-thirty`, `okafor-reads-*`, `flicker-*`, `rice-*`): gated variants of one button.
    Correct by the engine; `okafor-reads-solid` shows up to 12 choices. Fix: none; keep the gate table documented.
18. `tenant-go` has one choice ("Look at the wall") and six lines, the last two ("Come on down." then "The wall settles again.") back to back; the duplicate button of the first audit is fixed.

### Style guide (`story/night-shift.md`, section 4)

`check-night-shift.mjs` passes ("ok night-shift"). What it does not catch:

19. **"A page's text is 40 words or fewer"**: **205 of 228 scenes exceed it** (median 70 words, longest `terrell-school` 165, `terrell-door` 160, `okafor-out` 145, `visitor-desk` 141, `terrell-ask` 137).
    The checker limits only single lines. Fix: change the guide to "a line", or cut those scenes.
20. **Dee's "Mm."**: 29 lines are only "Mm." and 43 end on it, of 606; a tic more than the sorry-substitute the guide wants. Fix: audit where it carries nothing.
21. **Dee says "Probably"** in 4 lines (`laptop-watch-o`#2, `awake-0225-o`#1, `hum-0435-o`#1, `write-up-sloppy`#3): reads as quoting the player's opinion back. The checker never tests it. No fix needed.
22. **Tidy-speech risk lines**: `three-oclock` ("Three o'clock. Mm. Nothing happens.") and `adler-call` ("Word for word, please.") were rewritten; `talk-commute` now says "The seven smells like pennies." These now read fine.
23. **The tagline "Say what you see."** replaced "Observe and report." (banned except as a flat quote); `check-night-shift.mjs` lints lines and choices, not `tagline`. Fix: add the tagline to the lint.
24. `end-she-knew` now ends on narration ("You clip it on."); all 12 endings end on the narrator. Fixed.
25. Dev never says "I'm claustrophobic", Terrell never starts a line "No", Pierce speaks only in `coat-lobby` and `pierce-signin` (2 lines), no board member has a first name, no `unspoken` word appears. Clean (checker).

### Continuity and reveal layers

26. **The weekday is still unfixed.** "Tuesday" appears in 13 scenes (`binder-44 binder-thu end1-* visitor-checked birthdays-ask awake-bank hum-* tailgate-radio`), "Thursday" in 5
    (`handover binder-thu nephew-held day-log end-she-knew`). Without a fixed night, "Tuesday" and "Thursday" cannot both be next or last. Fix: choose the night in the doc and make every day word agree.
27. **Two meanings for "four hours"**: the scene `four-hours` (Dee's layer 3, the player stayed on the wall), `late-okafor` and the ending `end-four-hours` ("Four minutes.") share the words for opposite behaviour. Fix: rename one.
28. **Reveal layers all reach a scene** (`check-night-shift.mjs`): the pencil (`sign-why`/`sign-why-44`) 12 choices in, the spring (`drawer-notice`) 22, the four hours (`four-hours`) 43,
    twelve (`twelve`) 64; one way through all of them exists (77 choices) and it can end on Someone to leave it to. **None is unreachable.**
29. **Doc against data**: section 5 still lists nine endings (12 built) and section 6 the bigger first state model (the built meters: trust 0 to 3, warmth 0 to 2, slips 0 to 2, building_known 0 to 2). See (f).
30. `building_known` tops out at 2 and `end-someone`, `end-she-knew` need 2, while `end-eat-something` is the default close: how easy two looks are to miss was not measured. Fix: measure with the explorer.

## (d) Engine and mobile (read of the code; the playtests were not run here)

31. **Not verified in a browser**: the wall, subtitles, line buttons, choices and Log at 390x844, 360x640, 844x390; 44 px targets; the Settings sound controls; the reload at several points;
    the Log at the start, midway and at an ending. The `console` scenario (240 s) checks all of them with real presses; the `night-shift-signoff` sign-off (#36) says it was not run either. Fix: run `console` on the T4 and paste the report in the appendix.
32. **Layout, from the CSS** (`css/site.css`): `min-height: 44px` on the console buttons (lines 1593, 1596, 1620, 1744, 1787), `@media (orientation: landscape) and (min-width: 640px)` (1801),
    a short-landscape rule `(orientation: landscape) and (max-height: 520px)` (1818, new since the first audit) and `max-width: 559px` (1832). 844x390 and 360x640 each have a rule.
    Whether 12 choices of `okafor-reads-solid` plus the wall fit in 390 px of height is unknown. Likely weak spot.
33. **Audio unlock**: `js/console.js` plays voice, bed and effects through `<audio data-sound-start>` elements unlocked inside the Tap to play press; a `NotAllowedError` waits and retries every 250 ms (line 211 to 218).
    Right shape. **Not tested with a real `page.mouse.click`** here (the `console` scenario records whether the press was trusted). By design it retries forever if the press never comes.
34. **Missing recordings** are no longer an issue (0 unmade), and the old 404s are gone. Music `file` entries are not in the player; the 6 unmade stings are skipped for a draft (`later` in `tools/build-story.mjs` line 226), but now that Night Shift is listed, check that the build does not hold back a scene for a missing sting.
35. **Saved progress** (`iltv.run.nightShiftProgress`: scene, history, flags, meters, log, lines heard): resume in `enter(id, resumed)`. Not exercised here.
36. **Analytics**: `js/console.js` tells `scene`, `choice`, `feature` (`feed`, `log`); `AGENTS.md` documents them. The `analytics` playtest covers The Final Spark only, so a console story's events have no test. Fix: a second leg in `analytics`.
37. A reload mid-long-line, a screen reader pass and keyboard play were not examined.

## (e) Landing

38. `story/stories.json`: `night-shift` has **no `listed: false`**, so it is **listed** (since #35) and has a card with the badge, percent and Start Over. The card's image is the real `assets/images/night-shift.png` (1.1 MB), alt "A wall of nine security camera tiles in a dark control room",
    logline "Your first week of nights in a Manhattan tower. Nine cameras of nothing, one trainer who knows every door, and a report with your name on it."
39. The `stories` scenario's "a card for every listed story, in order" therefore checks Night Shift's card for the first time, and its **Start Over / Completed / Not started** states for a console story were only ever exercised for drafts by link. Not run here.
40. **The story doc and `AGENTS.md` still say Night Shift is a draft** ("a draft", `listed: false`, "Draft. Waiting for J"), contradicting `stories.json`. Fix: update both, or unlist it (J's call).
41. `night-shift-demo` is still unlisted and gives 7 warnings in `npm run story -- --check` (no voice for `dee` and `terrell`, 5 flags set and never read). Harmless noise. Fix: no warnings, or exclude the demo.
42. The card is 1.1 MB PNG (the others are `.jpg`). Fix: a smaller `.jpg` for the landing page's load time.
43. The unlocks cookie keeps a bit per scene in `scenes` order (228 now): a reorder would corrupt saved places. A rule to keep, not a gap.

## (f) Docs and the Studio playtest scenarios

44. `story/night-shift.md` header says "the pictures are still stand-ins and most lines are read on a timer until they are voiced" (line 7): false now. Section 5 lists nine endings (12), section 6 the old state model,
    "The built night" the old counts. Line 249: "No media is made by this doc". "Waiting for J" (line 644) is still open. Fix: one edit pass.
45. `story/night-shift.md` line 662 (Voices as made) still says the treatments are not applied (true, item 2) and does not mention that all 1,288 lines were recorded.
46. `story/night-shift-slice-notes.md` says it is superseded and is still in the folder. Keep as history or delete.
47. `story/night-shift-signoff.md` says "Verdict: not clean": two things were not done (browser walks of the endings, the playtests) and the music is missing. Same gap as here; closing it means one T4 run of `night-shift-signoff` (about 50 minutes) and one of `console`.
48. `AGENTS.md` lists `console`, `night-shift`, `night-shift-signoff`, `night-shift-audio` and `cctv-art`, and still says `night-shift` expects the average "about 45" (42.2) and that `night-shift-audio` "fails while lines are still unmade" (it can pass now except the music).
    It does not list `night-shift-gaps` yet (added with this file).
49. `story/README.md` describes `cctv-art` in one sentence.
50. `hawkes.assets.json` has 1,375 Night Shift assets (the 851 distinct voice texts are shared between scenes); `hawkes.assets.lock.json` has all but the 6 music stings. 951 KB+ file; nothing to fix.
51. The scenarios `console` (240 s), `night-shift` (about 480 s), `night-shift-signoff` (3,000 s) and `night-shift-audio` (120 s) have not been run against this commit by this audit. `night-shift` crashed on beta
    (`consoleStories is not defined`) until #37, so beta's playtest `r_4bb90e9b7b5e` never judged any of it.
52. The `at` start point (playtest contract) is not implemented in `js/playtest.js` for any scenario. `night-shift-gaps` takes `{"at":"gaps"}` (this file only, about 10 s) and `{"at":"story"}`.
53. `night-shift` scenario text still names "about 45" in its title (item 13).

## Status after the fixes of groups (d), (e), (f)

Fixed in this pass (2026-10-25, on top of `1801b98`), item by item. "Checked" means `node tools/test-console-player.mjs` (the real `js/console.js` run in
jsdom: no layout, no real audio, no real taps) and the static checks; everything that needs a browser is still the T4's `console` run.

- **31, 37 (not verified in a browser).** Not fixable on this server (no browser). What can be proved here is now proved, in `tools/test-console-player.mjs` (`npm run test:player`, needs jsdom):
  a reload at the start, mid-scene, right after a choice and at an ending restores scene, flags, meters, history, log, lines heard, the subtitles and the end screen; Skip and Replay;
  the Log is a Daily Activity Report with one redacted, text-free row per way not taken and nothing pressable, closed again by its button; localStorage, sessionStorage and cookies refusing
  every call still lets the story play a choice, open the Log, toggle CC and survive All stories and back. 17 checks, all ok.
- **32 (layout).** The CSS is unchanged (it already has a rule for 360x640, 390x844 and 844x390; targets are `min-height: 44px`; the words column scrolls by itself on a short landscape screen, so 12 choices never push the Log button off). Left for the `console` run.
- **33 (audio unlock).** Reviewed: voice, bed, effect and sting are `data-sound-start` elements started inside the Tap to play press; Settings on/off and volume reach all four (`hawkes-sound.js` `apply`); a refused `play()` waits for the tap. One bug found and fixed: a line's timer or its tap-wait could still fire after the story was closed
  (All stories) and throw on the removed audio element; `playLine` now holds its own element and stops when the scene is left (`js/console.js`). Real `page.mouse.click` still needs the T4 (`console` records whether the press was trusted).
- **Skip.** A skipped line now lets the next one follow at once (no 350 ms pause, which a viewer who pressed Skip does not want) and the bot's Skip loop waits 40 ms, not 150: with 72 choices and about 400 lines, a way to an ending is about 2 minutes of presses, not 5, so `stories` (it plays Night Shift to an ending twice) fits in about 10 minutes; its listed length is now 600 s.
- **34 (music stings).** Reviewed: `later` in `tools/build-story.mjs` belongs to the video stories' cuts. For a console story the build writes each cue's file only `urlIfMade` (line 802), so an unmade sting is `null` and `playSting` skips it; no scene is held back and nothing 404s. Making the 6 stings is still item 1.
- **35 (saved progress).** Checked as above. Storage blocked: the run is kept in the page (`memory`), a reload starts the story over, no error.
- **36 (analytics for console stories).** Not done: the `analytics` scenario still covers The Final Spark only and a second leg cannot be tried without a browser. Left, on purpose.
- **38, 39 (landing).** Unchanged: the card is listed, its badge, percent and Start Over come from the same code as the video stories; `stories` plays Night Shift's card, its player, its shortest way to an ending and Start Over (`consoleListed*`), not run here.
- **40 (docs say draft).** Fixed: `AGENTS.md` and `story/night-shift.md` say Night Shift is listed.
- **41 (demo warnings).** Fixed: `night-shift-demo.json` has `placeholder`, and `npm run story -- --check` is now silent for it (0 warnings).
- **42 (1.1 MB PNG card).** Fixed: `assets/images/night-shift.jpg` (80 KB, 720x1280), the PNG is gone, `stories.json` and the built card point at the jpg.
- **44, 45, 48, 53 (docs and scenario text).** Fixed: header, "No media is made by this doc", the built-night minutes (36.4 / 42.2 / 50.4), Voices as made (all 1,288 lines recorded), `AGENTS.md`'s `night-shift` row ("about 42"), `night-shift-audio` row and the scenario's title, description and warning text.
- **46 (slice notes).** Kept as history; the file says it is superseded.
- **47, 51 (sign-off and playtests not run).** Still open: they need the T4 (`night-shift-signoff` about 50 minutes, `console` about 4).
- **49 (`cctv-art` in `story/README.md`).** Unchanged (one sentence is enough).
- **52 (`at` start points).** Not done: only `night-shift-gaps` has one; the others need no mid-way start while they run in minutes.

## What is left, in order

1. Run `console`, `stories`, `sound` and `night-shift-signoff` on the T4, paste the reports below (items 31 to 39, 47).
2. Make the 6 music stings ($0.08 GPU, J's approval; item 1).
3. Fix the weekday and the "four hours" names (items 26, 27); show the c9 trouble light (item 8).
4. Edit the story doc and `AGENTS.md` (items 40, 44 to 48).

## Appendix: real command output

Run at `b0d1875`, 2026-10-25 (`npm run story -- --check` re-run after the fixes above: no warnings).

### `npm run story -- --check`

```

> imagine-live-tv@1.0.0 story
> node tools/build-story.mjs --check

ok       4 stories, 276 scenes, everything generated is up to date
```

### `node tools/check-night-shift.mjs`

```
228 scenes, 1288 lines (606 Dee), 12 endings, 240254 states explored
playing time: shortest 36.4 min | average 42.2 min (every open choice equally likely) | median 42.2 (3000 random plays: 10% 40.9, 90% 43.6) | longest 50.4 min
endings met in 3000 random plays: 5 of 12; Pierce speaks in: coat-lobby, pierce-signin
decisions that change nothing: 0
reveal layers: 2 the pencil (sign-why/sign-why-44): 12 choices | 5 the spring (drawer-notice): 22 choices | 3 the four hours (four-hours): 43 choices | 4 twelve (twelve): 64 choices | one way through all of them: yes, 77 choices
endings (shortest way, in choices): Clean report 73, Someone to leave it to 73, She knew 73, Eat something 73, By the book, alone 75, The friendly one 73, Opinions 73, Four minutes 72, Written up 71, The wedge 71, Noted 73, Under review 73
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

### `node tools/make-audio.mjs night-shift --list`

```
6 of 1322 have no file
night-shift-music-shift-begins
night-shift-music-the-panel
night-shift-music-fifty-eight
night-shift-music-ending-plain
night-shift-music-ending-warm
night-shift-music-ending-cold
```

### Playtests `console`, `stories`, `sound`

**Not run here, no output to paste.** This server starts no browser (Playwright or Chrome); the first attempt at this audit also could not, and beta's run `r_4bb90e9b7b5e` crashed on
`consoleStories` before any scenario ran (fixed in #37). Paste each report here after a T4 run: `console` (about 240 s), `stories` (about 75 s), `sound` (about 45 s).
