# Night Shift: voice

A rookie guard's first week of nights in a Manhattan tower, and a trainer who has done it for twenty-six years.
Nothing is a monster; the worst thing that happens on a good night is paperwork. Eleven locked voices,
1,376 lines. The longer notes are in `story/night-shift.md`; this is the short version the writer holds.

## Tone
Flat, dry, kind underneath. People talk like people on a night post: short, practical, interrupted, a little
funny by accident. Nobody explains the building; nobody makes a speech. The tagline is the method: *Say what you see.*

## Pacing
A scene is five or six lines (never more than twelve) and one decision. Silence and small business (a badge, a
door, a cup) carry the time. The shortest way through is about 36 minutes; no scene is padding for that.

## Choice design
A choice is two to six words in the trainee's voice, and each one changes something the story keeps: a flag, a
meter (trainer trust) or a line of the shift log. The build fails on a choice that changes nothing. Choices
are the job's real tension: do it by the post orders, or by the trainer's habit, or write it plainly and
let the page decide.

## Style note: 5 rules
1. **Say what you see.** Facts, in time order, past tense in the log; no adjectives, no guesses. ("Door propped open with a rubber wedge.")
2. **People talk in short turns.** A line is one thought; Dee answers in flat fragments ("Read it." / "Initial.").
3. **Nobody is a hero, and nobody is a villain.** No guns, no chases, no monsters; the stakes are trust and what goes in the log.
4. **Nothing about B3, the vat or the creature,** and Pierce Hawkes speaks in two cameo scenes at most. (`tools/check-night-shift.mjs`)
5. **Choices are 2 to 6 words, spoken by the trainee, and each changes a flag, a meter or the log.** No "Continue", no joke options.

## Canon the words keep
The control room and its nine cameras; Dee (the trainer), Mr. Okafor, Terrell, Marisol, Dev, Adler; a Wednesday in
February, 18:45 to 07:00; the notice in the drawer that takes effect on April first; twelve endings.

## The writing pass (2026-11-06)
The script was declared final on 2026-10-25 after its text and script passes. This pass audited all 658 choice
labels (2 to 6 words each, none a bare "Continue") and the 256 scenes (at most 12 lines each) against the rules
above and changed no node. A changed line costs a new recording (about 2.5 cents), and the 1,330 recorded lines are
the product, so this guide is for new and reworded lines: edit `story/night-shift.json`, `npm run story`, then
`node tools/make-audio.mjs night-shift --reuse`.
