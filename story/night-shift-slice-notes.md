# Night Shift, first slice: read this first

`story/night-shift.json` is the first ~10 minutes of the night (18:45 to 22:05 on the story clock; 17 scenes,
text only, no media, not listed in `story/stories.json`, so `npm run story` doesn't touch it). It follows
`story/night-shift.md` (bible, voice sheets, style guide, state model).

**The path:** handover (Okafor, Dee) → the binder → Okafor leaves → the two chairs → first radio check → small talk
(Terrell, food, the 7 train, the Knicks) → the wall, tiles 1-3 → tiles 4-9 → the sign-in sheet (pen or pencil) →
**the first small incident** (21:30, Marisol's nephew's badge fails on 44: let him in / call Okafor's line / ask for
his paperwork) → **the first log-wording decision** (fact, opinion, omit, lie) → `slice-end`.

## What J should judge: the trainer's lines

Dee has 83 lines in the data (40 on the shortest way, the rest depend on earlier choices). Her full list is below.
Judge these first, in this order:

1. `handover`: "Four." / "Hello. Sit anywhere that isn't mine." / "Extinguisher. Mm-hm. Your train, Okafor." Does she sound like
   someone who has done this twenty-six years without saying so?
2. `okafor-out`: "Four radios. Four on the charger when I walk in. Four when I leave." / "Doesn't matter why." The counting
   is the whole hint; nothing explains it.
3. `radio-check`: "Mm. A minute late." Is "Mm." doing the work of an apology and a verdict at once?
4. `small-talk`: the pepper-and-egg line and "Ray used to… Forget it. Drink the coffee." Is it too early to say Ray's name?
   (It is only there if the player asked about her sandwich.)
5. `the-wall-one` / `the-wall-two`: "Say what you see. Not what it is." / "Look at it till it's boring. Then look again." /
   "Seven's the fifty-eighth. It's always lit. Don't ask me why." Teaching without a speech?
6. `the-sign-in`: "Once it's ink, it's true. I write it in pencil first." (shown only if trust is already 2, layer 2 of the sheet).
7. `marisol-calls` and the three reactions: "Check the list." / "What's your call, Officer?" / "I'd have done it." Does she judge
   without judging?
8. The log scenes and `slice-end`: "Say what you did." / "Facts only. What did you see?" / "Mm." then "Officer." (the lie
   path: from here she is formal). Does the cold version hurt enough?

Full list:

- `handover`: "Four." — _to the charger, not turning around_
- `handover`: "Hello. Sit anywhere that isn't mine." — _dry, still counting_
- `handover`: "Mm." — _a sound at the charger, no more_
- `handover`: "Extinguisher. Mm-hm. Your train, Okafor." — _not unkind, she has heard this speech before_
- `the-binder`: "Read it." — _from the charger; one word, not a suggestion_
- `the-binder`: "Then it's two minutes." — _flat_
- `the-binder`: "Initial." — _when he doesn't move_
- `okafor-out` (if initialed_unread): "Mm." — _less than a word_
- `okafor-out`: "Four radios. Four on the charger when I walk in. Four when I leave." — _like reading a street sign_
- `okafor-out`: "Doesn't matter why." — _before you can ask_
- `okafor-out`: "Coffee's on the left. It's wrong. Don't tell me it's wrong." — _tapping the machine with one finger_
- `okafor-out`: "Officer. You've got a name? Say it once. I'll use it when I use it." — _looking at you for the first time_
- `the-chairs`: "Sit." — _already seated in the flat one_
- `the-chairs` (if mocked_habit): "Knocking on it again, are we." — _to the wall, not to you_
- `the-chairs` (if !took_her_chair): "No, not… That one's the good one. Take it." — _a half-gesture, then back to the wall_
- `the-chairs` (if took_her_chair): "You're in my chair, Officer. Go on, I'll live." — _deadpan, not moving_
- `the-chairs`: "The clock's two minutes fast. Leave it." — _eyes on the wall clock_
- `the-chairs`: "Radios. You've got one. Clip it on." — _holding the fourth one out_
- `radio-check`: "That's you." — _not looking up_
- `radio-check` (if answered_late): "Button's on the side. Side. The…" — _cut off by her own sigh_
- `radio-check` (if answered_late): "Mm. A minute late." — _the whole verdict_
- `radio-check` (if !answered_late): "Mm." — _the small one, the good one_
- `small-talk`: "Terrell. Desk." — _without turning_
- `small-talk`: "Where do you live?" — _to you, a real question, which surprises her_
- `small-talk` (if told_commute): "The seven? Mm. It stops. It always stops, right under Queensboro." — _like she's been stuck there_
- `small-talk` (if asked_sandwich): "Pepper and egg. Half past midnight. Don't ask for a bite." — _closing the foil_
- `small-talk` (if asked_sandwich): "Ray used to… Forget it. Drink the coffee." — _trails off, picks up the cup instead_
- `small-talk` (if sat_good_chair): "Back's all right? It's the only thing in here that is." — _a dry look at the chair_
- `small-talk`: "It's wrong. I said not to say." — _hearing you sip it_
- `the-wall-one`: "One. Lobby. Two. Vestibule. Three, dock." — _pencil moving left to right, no hurry_
- `the-wall-one`: "Say what you see. Not what it is." — _short_
- `the-wall-one` (if named_tiles): "Good. Next." — _approving the way a stamp does_
- `the-wall-one` (if asked_normal): "Nothing's normal. Same lobby all night. That's normal." — _a small shrug in the voice_
- `the-wall-one` (if said_dead): "Dead. Mm. That's the idea." — _half-amused, not warm_
- `the-wall-one`: "Look at it till it's boring. Then look again." — _tapping the glass of tile two with the pencil_
- `the-wall-one`: "Mm-hm. Next." — _before you've finished the sentence_
- `the-wall-two`: "Four. Five. Six." — _the pencil sliding down_
- `the-wall-two`: "Seven's the fifty-eighth. It's always lit. Don't ask me why." — _a pause long enough to be a comment_
- `the-wall-two`: "Nine's the quiet one. Floor two. Cabinet, the panel's repeater." — _the pencil stops on the last tile_
- `the-wall-two` (if asked_cam9): "Nine never moves. If it moves, say." — _slower, close to a rule_
- `the-wall-two` (if asked_roof): "Roof door. Eight. I do that one at three. Alone." — _too quickly, then back to the wall_
- `the-wall-two`: "That's the wall. You've seen it. Now you've seen it." — _pencil behind her ear_
- `the-sign-in`: "Name. Company. Who they're seeing. Floor. In. Out." — _tapping each column_
- `the-sign-in`: "ID, you look at it. Look. Not glance." — _flat_
- `the-sign-in`: "After hours, the tenant says yes first. Email, call-up. No yes, no entry." — _like a recipe she has said a thousand times_
- `the-sign-in`: "However nice." — _a beat, one eyebrow_
- `the-sign-in`: "Pen's for the sheet. Pencil's for… Pick one." — _holding both out_
- `the-sign-in` (if asked_pencil): "Once it's ink, it's true. I write it in pencil first." — _gives it up like a coin_
- `the-sign-in` (if wrote_pencil): "Mm. Good." — _taking the pen back_
- `marisol-calls` (if asked_44): "Forty-four. You asked about forty-four." — _to you, dry, a small nod_
- `marisol-calls`: "Check the list." — _quiet, hands in her lap_
- `marisol-calls`: "Mm-hm. I know. I know what the book says." — _cutting you off before the rule_
- `marisol-calls`: "What's your call, Officer?" — _she doesn't look away from the wall_
- `nephew-in`: "Mm." — _the whole sentence_
- `nephew-in`: "I'd have done it." — _not looking at you_
- `nephew-in`: "That's a line you write down, Officer." — _flat, the pencil already in her hand_
- `nephew-held`: "She'll be fine by Thursday." — _to the wall_
- `nephew-held`: "You called it. Fine. It's the book." — _a nod, grudging, not cold_
- `nephew-held`: "Mm-hm. I'd have… Doesn't matter." — _trailing off, reaching for the cup_
- `nephew-papers`: "Read me the name." — _quiet, hands still_
- `nephew-papers`: "That's a name. That's not the list." — _turning the paper in her head_
- `nephew-papers`: "Mm. But it's a name." — _so low it's almost the wall talking_
- `log-in`: "Say what you did." — _plain_
- `log-in` (if asked_dee_right): "I said I'd have done it. I didn't say write that I did." — _answer to a question you already asked_
- `log-in` (if kept_eyes_on_44): "Water. Under the closet. You were watching." — _a nod at tile six_
- `log-in`: "Time. Place. What you saw. What you did. Who you told." — _tapping the pencil on each word_
- `log-in`: "Nothing about how he looked." — _short_
- `log-held`: "Say what you did." — _plain_
- `log-held`: "I'd have done it differently. That doesn't go in." — _dry, to the tablet_
- `log-held`: "Not 'she got mad.' When did she say it, and what did she say?" — _tapping the pencil on each word_
- `log-held`: "Time. Place. What you saw. Who you told." — _short_
- `log-held`: "Mm. Slow. You'll want to hurry. Don't." — _while you reach for the tablet_
- `log-papers`: "Say what happened. The paper's evidence. It's not permission." — _plain, flat on the second sentence_
- `log-papers` (if read_name): "You read the name. Good. That's the first line." — _a nod at the page_
- `log-papers` (if passed_it_to_dee): "You handed it to me. It goes in your log, not mine." — _pushing the pencil an inch toward you_
- `log-papers`: "Time. Place. What was shown. What you did." — _tapping the pencil on each word_
- `slice-end` (if log_e1==fact): "Keep that one." — _reading it twice, not out loud_
- `slice-end` (if log_e1==opinion): "Facts only. What did you see?" — _reaching for the rubber on the end of the pencil_
- `slice-end` (if log_e1==omit): "Where's forty-four?" — _the tablet turned toward you_
- `slice-end` (if log_e1==lie): "Mm." — _the tablet slowly turned face down_
- `slice-end` (if log_e1==lie): "Officer." — _formal, from here on_
- `slice-end` (if asked_sandwich): "Midnight. Don't forget the sandwich." — _wrapping the foil twice_
- `slice-end`: "Two hours to the half. Eat something." — _closing the binder_

## The format (until the engine's lands)

The engine task (state-based story player) hadn't landed, so the data follows the format in `story/night-shift.md`
section 6 and is kept valid by `node tools/check-night-shift.mjs` (not part of `npm run story`; fold it in when the
engine's validators exist). Per scene: `time`, `wall_clock` (two minutes fast), `text` (≤ 40 words), `ambience`, `wall`
(all nine feeds C1-C9), `lines` (`who`, `text`, `dir` performance direction, optional `sfx`, optional `if`), `log` (the
DAR line written on entering), optional `enter` effects, `choices` (2-6 words; `requires`, `effects.set`/`add`/`log`,
`to`). Conditions are strings: `flag`, `!flag`, `meter>=n`, `log_e1==fact`. `flags_read_later` lists flags the morning scene
and endings will read (the slice ends at 22:05).

The check enforces: text ≤ 40 words, speeches ≤ 3 sentences of 4+ words and ≤ 32 words, banned patterns from the style
guide, Dee never says "kid"/"rookie", every choice changes a flag, meter, log line or the next scene, Dee ≥ 40 lines on the
shortest way, no Board first names, no Pierce, the `unspoken` words, no unreachable scene, no flag set but not declared or
declared but never set/read.

## The two passes

- **Roughening** (cut every line that states a feeling outright or tidies up): cut Dee's "I never got to the part where
  I'm late for myself" (a joke that explained the clock), the second half of "I'd have done it. Doesn't mean it's right."
  (a moral), "Never mind. Terrell, the coffee." (a redirect with nothing behind it), and the note that Marisol "seemed
  upset" from the neutral log lines. No line says a feeling; the log's opinion options ("seemed harmless", "was rude and
  upset") are the *wrong* answers on purpose.
- **Read-aloud**: every line was said aloud against its voice sheet; three speeches over 32 words were split, the longest
  line now is Terrell's run-on, which is how he talks.

## Not done / for J

- Only 1 of the 9 events (E1) plays out; the wedge (C4) and the cam-9 freeze are set up on the wall but not yet used. The
  `noticed_wedge` etc. flags belong to the next slice (01:30-05:00).
- No playtest scenario: there is no player for this format yet, so `.hawkes/scenario.txt` is empty and the criteria are
  checked by `tools/check-night-shift.mjs`. Add a scenario with the engine.
- Cost: this slice is text only, no GPU. The media (the look is still "Waiting for J") isn't designed, so there is nothing to
  price yet; voice lines for the 17 scenes would be ElevenLabs cents each.
