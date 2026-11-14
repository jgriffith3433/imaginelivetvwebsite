# Trust Fall: voice

A near-future thriller in one night: a thief who hates the machine, a city about to switch it on, and a husband who
says good morning on the news. You win by believing the one thing that watches you. One narrator, plain English,
over a game-render camera; ARGUS and Marcus speak in their own voices in the talking shots.

## Tone
Close, dry and tense, like someone telling it the next morning with the rain still on the window. Warm only where
ARGUS is. The machine is never explained and never sneers; the humans (Juno, the lobby, the precinct) are the cold part.

## Page limit
**Two sentences and under 30 words a page**, in second person ("You pull at the seam."), present tense for the scene, then one
question of two to six words. The limit counts the page's story only (not the question or the "THE END" line). One image per
page. A variant that changes words obeys the same limit and is never longer than the base. Deaths are two sentences ending on a
flat line; an ending may take the full 30 words and carries the sign-off. At 390x844 that is a page that fits the screen with the
choices, never a scroll.
*Where the data stands (2026-11-14):* the longest page is 35 words and the average 27.6, and many pages still run three or four
short sentences. The playtest enforces 40 and an average of 30 (`trustFallMaxWords`, `trustFallAvgWords`); tightening each page to
this limit means a new narration and cut per page, so it goes with the voice remake, one page at a time, never by cutting a page's
words without remaking its recording.

## The narrator
Second person, dry and close, the voice that says "you" and means Rae without ever saying Rae. It reports what the night does
(hands, doors, light, the river) and never what you feel or what ARGUS "really" is. It is not warm and not cruel: a tired friend
telling you what you did. Voice `hv_narrator_bright`.
- Does: name the object ("the cable duct", "the amber light"), put the cost before the feeling, stop after the image.
- Never: explain the machine, use "suddenly", describe your thoughts, say Rae.
- Sounds like: "You thumb the jammer in your sleeve. The screens die, and the face goes mid-word."

## ARGUS
Calm, exact, never threatening. It speaks in short complete sentences, uses your name (Rae, spoken only by ARGUS, Juno and Marcus's
voice, never by the narration), states what it knows and what it can do, and offers; it never orders, begs or sneers. Numbers
and times are exact ("fifty seconds", "the ninth floor"). It does not say "I" about feelings, and never says what it is made of.
It is warm only by being precise and by keeping its promises. Voice `hv_ai`; spoken in the talking shot, never captioned in the picture.
- Sounds like: "Stand still, Rae. Breathe in for four. The door opens on the ninth second."
- Never: "Don't be afraid", threats, jokes, "trust me", exclamation marks, a lecture about AI.

## Marcus
Warm anchor. A morning-show voice, unhurried, who talks to a city and means one person. He says "Good morning" and, to Rae, only
"you know who you are": the sign-off. He never says Rae's name on air and never explains the line. Under pressure he stops
mid-sentence and touches his earpiece; he does not shout. Voice `hv_narrator_warm`.
- Sounds like: "And to the one who always watches: you know who you are."
- Never: Rae's name, a speech, "I love you" on air, a news-desk cliché ("breaking", "stay tuned").

## Juno
Easy, charming, cold underneath. She sounds like she is smiling and is already finished with you. Friendly short lines ("Garage,
ten."), a nickname's warmth with no warmth in it, plans said as favours; she never raises her voice and never argues, she just
leaves. The cold shows in what she doesn't say (she never asks if you're all right). Voice `hv_heroine`.
- Sounds like: "Good. You're early. Hold this, and don't read it."
- Never: villain talk, threats, a confession, "trust me" (that is ARGUS's word to refuse, never hers).

## Words to avoid
- On any voice: "suddenly", "somehow", "literally", "AI", "algorithm", "robot", "program", "code", "hack", "cyber", "neural".
  The machine is ARGUS, a light and a voice.
- Narration: "feel", "felt", "realize", "you think", "you wonder", Rae, and a second simile.
- ARGUS: "I'm sorry", "I think", "maybe", "trust me", "don't worry", any exclamation.
- Marcus: Rae's name, "breaking news", "folks".
- Juno: "sweetheart" and other pet names that sound sinister on purpose, "kill", "betray".
- On screen: any word the narration doesn't say (said means shown).

## Choice design
Choices are trust: use the machine or jam it, listen or keep going, wait or pry. **Belief pays and the cost is visible:** each
believing step raises the trust ring, jamming sets it to 0 and adds two scenes of dark before the same rescue. The timer's
default is always the believing or basic path, never a death. A death is only for a choice a viewer sees coming (prying the
vault door alone; walking back to Juno with the copy). Choices are things you do with your hands, 2 to 6 words, and a gated
one (the promise, the thank you) is simply absent, never a locked row, unless it asks for a count ("needs trust 3+").

## Style note: 5 rules
1. **One image per page, then stop.** The amber light, the green line, the river. No second simile.
2. **Said means shown.** Every word on a page is a word the narration says: the recording is the page's story, its question and,
   at an ending, the "THE END" line. A variant that changes words has its own narration (`narration-v<n>.mp3`, its own cut), so
   nothing on screen is unspoken, and nothing a run did not do is said.
3. **Cost first, then feeling.** What the night took (a jammer burning an arm, ten floors of dark) before what you feel. Never
   tell the player what they feel.
4. **Marcus is "you know who you are" and nothing else.** He never says Rae's name on air; Rae is named only by others.
5. **Plain American idiom, no jargon, no on-screen writing in a shot.** ARGUS's lines are spoken, never captioned in the picture.

## Canon the words keep
Meridian and ARGUS (goes live at midnight; an amber face of light, a ring on small devices); Rae (you, never named by narration);
Marcus Okoro (husband, morning anchor); Juno Vale (the crew's leader); the drive Blindspot (a ransom lock in Juno's hands, signed
with your name); the Tower, eleven floors down, the vault and its sixty seconds. Three endings by trust (*Live*, *Unseen*,
*Good morning*) and two by distrust or full trust (*Alone on air*, *On air, together*). Nothing says what ARGUS is made of.

## The writing pass (2026-11-14): tight and true
All 27 pages and their 17 variants were cut to the rules above: the story text averages 27.6 words (longest 35, it was 43 on
average and 83 at most); the variants run 35 to 40. Every variant that changes words (the vault, the green line, the morning
edition, Live, Unseen) now has its own narration recipe in `hawkes.assets.json` (`trust-fall-<scene>-voice-v<n>`, made through
Studio's asset make into `<folder>/media/narration-v<n>.mp3`); `npm run story` cuts each one's own `scene-v<n>.mp4` from the
scene's shots and plays it for the run whose flags pick that variant. Base narrations changed too (words and an ending's "THE END"
line are narrated now), so every Trust Fall voice is to be remade (voice only, cents; no new picture) and every cut re-cut.
Playtest `trust-fall` (section 4b) walks every variant by the flags that pick it and checks words, fit at 390x844 and narration.
