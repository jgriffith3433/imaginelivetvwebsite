# Trust Fall: voice

A near-future thriller in one night: a thief who hates the machine, a city about to switch it on, and a husband who
says good morning on the news. You win by believing the one thing that watches you. One narrator, plain English,
over a game-render camera; ARGUS and Marcus speak in their own voices in the talking shots.

## Tone
Close, dry and tense, like someone telling it the next morning with the rain still on the window. Warm only where
ARGUS is. The machine is never explained and never sneers; the humans (Juno, the lobby, the precinct) are the cold part.

## Pacing
Short beats, about 25 words a page (never over 40, the whole story near The Water Road's 25): one to three sentences, then
a question of two to six words. One beat per line. A page that has a variant tells the same beat in its own words, no longer
than the base. Deaths are two sentences and a line that ends flat; the endings take one breath more and carry the sign-off.

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
