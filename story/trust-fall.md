# Trust Fall — story doc

`story/trust-fall.json`: every page, its text, its choices and how its media is made. Its pages are under
`/trust-fall/` (`/trust-fall/first-light/`, …), its asset ids start with `trust-fall-`, and it plays at
`/?story=trust-fall`.

**A draft (`"listed": false` in `story/stories.json`), asked for by J on 2026-11-13:** "a brand new story for imagine
live tv ... about believing in "the AI system" and getting rewarded for it (you play as anti hero, AI is villain but
then turned hero and you turn victim and saved by AI with a third character being your husband who is a news reporter
who you watch every morning)". Every scene plays a placeholder title card (`film`, `assets/video/trust-fall/`) until its
generated media is made; the media waits for J's OK on the spend.

## The idea

The city of Meridian is about to switch on ARGUS, an AI in every camera, light and door. You are a thief who hates it.
ARGUS reads as the villain: it knows your name before breakfast and watches you walk into its Tower. Then the crew you
trusted betrays you and seals you in a vault to take the blame, and ARGUS is the one that gets you out. The more you
believed it before you needed it, the more the ending gives back. Your husband, Marcus Hale, anchors the morning news
you watch every day; his three broadcasts (the morning before, the go-live at midnight, the morning after) frame the
story, and his sign-off ("you know who you are") is a line only the two of you understand.

- **Title:** *Trust Fall*
- **Tagline:** *Fall, and see who catches you.*
- **Logline** (its card): *A thief who hates the machine, a city it's about to switch on, and a husband who says good
  morning on the news. Who catches you when you fall?*
- **Tap to play:** *TRUST FALL*, "Sound on. It's already watching."
- **Look:** a modern 3D near-future thriller game render (rain, glass towers, teal shadows, amber light), the same
  game-render family as The Water Road. You are seen from behind or by your hands.
- **Language:** English only. **Cast:** you (Rae, only ever named by others), Marcus Hale, ARGUS (an amber face of light
  on screens, a ring on small devices), Juno Vale (the crew's leader).

## The story (20 pages)

1. **First light** (`start`). 6 a.m., Marcus on the kitchen TV: ARGUS goes live at midnight. The city's free speaker
   on the counter says good morning to you by name. Pull its plug (**the plug**), or ask how it knows you (**how it
   knows**: it warns you someone will hurt you tonight; sets `listened`). Both end with Juno's text: the Tower tonight.
2. **The garage.** Juno hands you Blindspot, a drive to blind ARGUS at the go-live. Take it and go, or copy it and read
   it first (**what's inside**: it's a ransom lock on the city's power signed with your name; sets `readWorm`). Then go
   anyway and play along, or go back and face Juno (**the river**, a death).
3. **The Tower.** 11:50 p.m. Every lobby screen shows Marcus live on the plaza, then cuts to ARGUS's face, looking at
   you: "Rae. Please stop walking." Jam it and keep going (**lights out**), or stop and listen (**what it knows**: Juno
   sold you two hours ago). Believe it (**the bait**: it tells you to go down and let the trap close; sets `believed`),
   or call it a liar and keep going.
4. **The vault.** You plug in Blindspot; the door seals; Juno in your earpiece: somebody has to be the face of it.
   Fire suppression in sixty seconds. Beg ARGUS for help (**the green line**), call Marcus (**on the air**: he hears
   you live on the plaza, and ARGUS opens the doors; sets `calledMarcus`), pry the door (**sixty seconds**, a death),
   or, only if you believed it, wait because it promised (**the promise**: the door opens on the ninth second with
   Juno's whole confession recorded).
5. **The green line.** ARGUS walks you out door by door; Blindspot never had a chance. Juno's van pulls away. Let ARGUS
   handle Juno, or chase the van (**the bridge**: every streetlight flares in Juno's eyes; sets `chased`).
6. **Morning edition.** 6 a.m. at the precinct, Marcus on air, Juno in custody: "If you're watching, you know who you
   are. Come home." The question changes with what you did (believed, listened, called Marcus, chased).

**Endings** (three; reaching one makes the card say Completed):
- *Live* (`truth`, the timer's default): you tell the whole city on Marcus's show; ARGUS vouches for you and asks you
  to help keep it honest. *THE END. You were the story.*
- *Unseen* (`shadow`): you walk out before anyone learns your name; ARGUS keeps it; Marcus's sign-off gets a new line.
  *THE END. Some heroes stay in the dark.*
- *Good morning* (`believer`, only if you believed ARGUS in the lobby): you thank it; record cleared, Juno's reward
  in your name, and every morning the speaker says good morning and you say it back. *THE END. It was always on your
  side.* This is the reward for belief.

**Deaths** (two, both seen coming): facing Juno with the copy (the river), prying the vault door alone (sixty seconds).
Each offers Rewind to the choice or Start over. The timer never picks a death: every fork's default is the believing
or basic path.

## Belief shows on the next clip (2026-11-14)

World bible: `docs/world-bible.md` (Trust Fall in every section). `believed` (set by Believe it) is read by scene
variants: the vault (an amber light comes on above the door), the green line (ARGUS: "I told you I'd be there"), and the
morning edition (the ceiling camera watches over you). "Wait. ARGUS promised" and "Say thank you to ARGUS" are `requires`
choices: on offer only with `believed`, not shown locked otherwise. The variants change the words now; their clips follow
when the media is made.

## Media plan (waiting for J's OK: it spends GPU)

From `hawkes.assets.json` (`trust-fall-*`, 77 recipes):

| Kind | Count | Tools |
| --- | --- | --- |
| Character sheets (you, Marcus, ARGUS, Juno) | 4 (3 candidates each) | image.generate |
| Shot clips (keyframe, then video) | 29 shots over 20 scenes | image.edit / image.generate, video.i2v |
| Narration, one per scene | 20 (voice `hv_narrator_bright`) | audio.voice |
| Talking shots (portrait, line, lip sync) | 17: Marcus 5 (`hv_narrator_warm`), ARGUS 10 (`hv_ai`), Juno 2 (`hv_heroine`) | image.edit, audio.voice, video.talk |
| Music cues | 7: morning, hum, heist, trapped, rescue, death, end | audio.music |

Hawkes Gen's estimate (2026-11-14, from its past jobs): about 3.7 GPU hours on 4 servers, about 56 minutes, **$6.86**
($14.30 if the servers are left idling for their hour afterwards). video.talk has no history yet, so its share is the
tool's own guess. Make it with `studio.cmd assets imaginelivetv make` (or Studio's asset run) once J says yes; then
`npm run story` cuts every scene, `node tools/make-posters.mjs` makes posters and phone renditions, the placeholder
`film`s come out of the data and `listed` comes out of the entry.

## Waiting for J (not canon until approved)

- The story itself (title, cast, the three endings).
- The media spend above.
