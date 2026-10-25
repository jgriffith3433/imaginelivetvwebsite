# Summary

**What was wrong.** Beta's playtest crashed on `consoleStories` (fixed in #37) so nothing judged the Night Shift gaps audit. The audit in `story/night-shift-gaps.md` was also out of date: it described beta before #29 to #36 (it said 18 of 1,199 lines recorded, stand-in art, unlisted card).

**Changed.**
- `story/night-shift-gaps.md`: re-audited against beta `b0d1875`. Groups (a) to (f), 52 numbered gaps, with files, counts and fixes. Real output of `npm run story -- --check`, `check-night-shift.mjs`, `test:console` and `make-audio --list` in the appendix. Shortest path 36.4 min, typical 42.2 min, longest 50.4.
- `js/playtest.js`: new scenario `night-shift-gaps` (`.hawkes/scenario.txt`, second line `{"at":"gaps"}` = reads the file only, ~5 s). Real presses open Night Shift and Settings; it then checks the doc (groups, counts vs data, minutes vs the clock, appendix). `AGENTS.md` has its row.

**Findings in short.** Audio: 1,288/1,288 lines made, only the 6 music stings missing; treatments (radio/phone filters) not applied. Art: no stand-ins left; 4 made camera states never shown (incl. the panel's trouble light). Script: 82 of 621 choices change no state, weekday contradictions (Tuesday/Thursday), 205 of 228 scenes over the guide's 40 words. Landing: the card is listed now but the docs still say draft.

**Not done / honest limits.** This server has no browser, so the `console`, `stories` and `sound` playtests were NOT run and their output is not in the file (the appendix says so; the new scenario reports that as a warning). `night-shift-gaps` itself was only syntax-checked (`node --check`) and its doc checks were simulated in node; it has not run in a browser. Nothing in the story was fixed (audit only).

**GPU estimate (not run, needs J's OK):** the 6 music stings, `hawkesgen_estimate`: 61 GPU-seconds, $0.08 GPU, $0.70 with the idle tail, ~3 min, 1 server.
