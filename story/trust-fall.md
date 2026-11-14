# Trust Fall — story doc

`story/trust-fall.json`: every page, its text, its choices and how its media is made. Its pages are under
`/trust-fall/` (`/trust-fall/first-light/`, …), its asset ids start with `trust-fall-`, and it plays at
`/?story=trust-fall`. **Voice and page rules:** [`docs/trust-fall/voice.md`](../docs/trust-fall/voice.md) (narrator, ARGUS,
Marcus, Juno; two sentences and under 30 words a page; words to avoid).

**A draft (`"listed": false` in `story/stories.json`), asked for by J on 2026-11-13:** "a brand new story for imagine
live tv ... about believing in "the AI system" and getting rewarded for it (you play as anti hero, AI is villain but
then turned hero and you turn victim and saved by AI with a third character being your husband who is a news reporter
who you watch every morning)". Fourteen of the 20 scenes play their generated cut (see "Media made", below); the other six show
the graded still with their narration until their clips are made.

## The idea

The city of Meridian is about to switch on ARGUS, an AI in every camera, light and door. You are a thief who hates it.
ARGUS reads as the villain: it knows your name before breakfast and watches you walk into its Tower. Then the crew you
trusted betrays you and seals you in a vault to take the blame, and ARGUS is the one that gets you out. The more you
believed it before you needed it, the more the ending gives back. Your husband, Marcus Okoro, anchors the morning news
you watch every day; his three broadcasts (the morning before, the go-live at midnight, the morning after) frame the
story, and his sign-off ("you know who you are") is a line only the two of you understand.

- **Title:** *Trust Fall*
- **Tagline:** *Fall, and see who catches you.*
- **Logline** (its card): *A thief who hates the machine, a city it's about to switch on, and a husband who says good
  morning on the news. Who catches you when you fall?*
- **Tap to play:** *TRUST FALL*, "Sound on. It's already watching."
- **Look:** a modern 3D near-future thriller game render (rain, glass towers, teal shadows, amber light), the same
  game-render family as The Water Road. You are seen from behind or by your hands.
- **Language:** English only. **Cast:** you (Rae, only ever named by others), Marcus Okoro, ARGUS (an amber face of light
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
   or call it a liar and keep going. Only if you read the drive on the train (`readWorm`), a third choice: **Show ARGUS
   your copy** (**your copy**): ARGUS confirms at once what Blindspot is, you believe it (sets `believed`, +1 trust), and the
   road joins **the bait**. It is a faster road to trusting ARGUS: the reader skips the question.
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
Each offers Rewind (labelled with the choice it returns to, e.g. "Rewind: go back and face Juno") or Start over. The timer never picks a death: every fork's default is the believing
or basic path.

## The news frame (2026-11-14, J: "a husband who is a news reporter they watch every morning")

Marcus's *Meridian Morning* frames the night like a TV broadcast. All of it is data in `story/trust-fall.json` (`news`:
station, anchor, role; per scene `time`, optional `chapter`, an ending's `signoff`), built by `npm run story` into each
scene's `news` (`js/story-data.js`) and drawn by the player (`js/game.js` "The news frame", `css/site.css`). Nothing
changes a choice or the branching.
- **Clock and lower-third.** Every scene shows its broadcast time in a clock bug in the top band of the picture; on
  Marcus's scenes (any line of his) his name plate (*Marcus Okoro, Anchor, Meridian Morning*) sits beside it for the whole scene.
- **Chapter cards** by the clock, full screen, a press (or 4 s) moves on, the clip waits under it: 6:00 AM *First light*
  (`start`), 10:00 PM *The garage* (`crew`), 11:50 PM *The Tower* (`tower`), 6:00 AM *Morning edition* (`broadcast`).
  Shown when the viewer arrives by a choice, a start over or a new run, not on a resume or a Rewind.
- **Captions.** Each `lines` entry shows under its speaker's name in the panel above the choices (never over a button),
  in order, about 0.4 s a word. A page with no `lines` is the narrator's story, which is already the page's text.
- **Sign-off.** Every ending closes on Marcus's card (*Marcus Okoro signs off*, his line, ending on "You know who you
  are"), shown when the ending's clip ends (or after 14 s / 6 s on a still); the ending card is already under it.
- Playtest `trust-fall-news` (touch, 390x844) plays all of it. Story times: morning 6:00 to 6:03 AM, the garage 10:00 to
  10:25 PM, the Tower and vault 11:50 PM to 12:05 AM, the morning after 6:00 and 6:14 AM.

## Belief shows on the next clip (2026-11-14)

World bible: `docs/world-bible.md` (Trust Fall in every section). `believed` (set by Believe it) is read by scene
variants: the vault (an amber light comes on above the door), the green line (ARGUS: "I told you I'd be there"), and the
morning edition (the ceiling camera watches over you). "Wait. ARGUS promised" is a `requires` choice: on offer only with `believed`, not shown
locked otherwise. "Say thank you to ARGUS" (Morning edition) is gated on **trust 3 or more** (`needs`, J 2026-11-14): trust
is asked, listened, believed (+ waited), so it takes asking, listening and believing; with 2 it is a greyed-out
"needs trust 3+ (you have 2)" row, not a button. The variants change the words now; their clips follow
when the media is made.

## Trust, counted (2026-11-14, J: "belief that pays off")

`inventory` in `story/trust-fall.json` has one counted item, `trust` (icon `ring`, 0 to 4, shown in the kit bar). Scenes that
add to it: `asked`, `listen`, `believe`, `promise` (+1 each); `jam` sets it to 0 (so jamming visibly costs what you earned;
the build forbids a count below zero). "It's lying. Keep going" at the lobby leads to `jam` too, and both set `jammed`.
- **The jam road** (`jam` > `blackout` > `breaker` > `crawl` > `coreDark` > `saved`): a jammed run never meets ARGUS's
  amber light in the vault. `coreDark` is `core` for jammed runs (same three ways out); Beg the dead air leads to the green
  line (`saved`), whose `jammed` variant ("onto pitch black", ARGUS finds you in the dark first, the dead jammer and "I could
  not see you, I could only wait") is the rescue; both "Jam it and keep going" and "It's lying. Keep going" set `jammed`, so
  both read it. (The old page *The long way out*, `jamRescue`, was folded into that variant.) It is 6 scenes after the lobby,
  the believing road's rescue (`promise` or `saved`) is 4: two more.
- **The broadcast splits by trust** with `when` flags (no gated default): low `jammed` > `unvouched` (*Alone on air*, "THE END.
  Nobody vouched for you."), mid (believed, but not asked or waited) > `truth` (*Live*), high (believed and asked, or believed
  and waited: trust 3 or more) > `vouched` (*On air, together*, "THE END. It answered for you."). "Say thank you to ARGUS"
  (Good morning) is `requires` the same high flags (and `needs` trust 3): absent below, never a locked row.
- A video story's choices have no `forbids`: use a `requires` flag set to `false`.
- The six new scenes (blackout, breaker, crawl, coreDark, unvouched, vouched) show a graded still until
  their clips are made (GPU, priced in the change's summary). Playtest `trust-fall` section 4a plays the meter, the cost,
  the rescue depth, the Good morning gate and the three endings by touch at 390x844.

## Tight and true (2026-11-14, J: "Trust Fall: tight and true on every path")

Voice doc: `docs/trust-fall/voice.md`. Every page (story, question and ending line, as narrated, variants included) is 35 words or fewer; `npm run story` warns over 40 (27.6 on average, was 43; The Water Road 25) and
each of the 17 variants 40 or fewer. A narration is the page's story, its question and, at an ending, the "THE END" line, so
nothing shown is unsaid. **Each variant that changes words has its own narration**: the build writes the recipe
`trust-fall-<scene>-voice-v<n>` (file `<folder>/media/narration-v<n>.mp3`; `n` is the variant's place in the scene's `variants`)
and, once that is made, cuts `<folder>/scene-v<n>.mp4` from the scene's shots and plays it for the run whose flags pick the
variant (`js/game.js` `sceneWith`; a still page speaks the variant's `narration`). Until it is made the base cut plays: the
`trust-fall` playtest (section 4b) says so by variant. Remake the base voices too (their words changed), then `npm run story`.

## Media plan (waiting for J's OK: it spends GPU)

From `hawkes.assets.json` (`trust-fall-*`, 77 recipes):

| Kind | Count | Tools |
| --- | --- | --- |
| Character sheets (you, Marcus, ARGUS, Juno) | 4 (3 candidates each) | image.generate |
| Shot clips (keyframe, then video) | 29 shots over 20 scenes | image.edit / image.generate, video.i2v |
| Narration, one per scene | 20 (voice `hv_narrator_bright`) | audio.voice |
| Talking shots (portrait, line, lip sync) | 19: Marcus 6 (`hv_narrator_warm`), ARGUS 11 (`hv_ai`), Juno 2 (`hv_heroine`) (two added 2026-11-14: about $0.60 more than the estimate below) | image.edit, audio.voice, video.talk |
| Music cues | 7: morning, hum, heist, trapped, rescue, death, end | audio.music |

Hawkes Gen's estimate (2026-11-14, from its past jobs): about 3.7 GPU hours on 4 servers, about 56 minutes, **$6.86**
($14.30 if the servers are left idling for their hour afterwards). video.talk has no history yet, so its share is the
tool's own guess. Make it with `studio.cmd assets imaginelivetv make` (or Studio's asset run) once J says yes; then
`npm run story` cuts every scene, `node tools/make-posters.mjs` makes posters and phone renditions, the placeholder
`film`s came out of the data (done 2026-11-14) and `listed` comes out of the entry.

## Waiting for J (not canon until approved)

- The story itself (title, cast, the three endings).
- The media spend above.

## Path-true lines (2026-11-14)

- The timer's defaults now walk the believing path: `start` defaults to Ask how it knows you, `tower` to Stop and listen.
- Marcus is "your husband" on the first page, speaks live at midnight on `tower` before ARGUS cuts in (on one screen,
  not the whole wall), and every ending ends on his sign-off. He is Marcus **Okoro** (Hale is taken in two other worlds).
- `unplug`: ARGUS speaks under the news ("I'm not your enemy, Rae.") instead of words on screen (no writing in a shot).
- `callMarcus`: Marcus doesn't say your name live on air, so Unseen stays true.
- `waited` (set by Wait. ARGUS promised) keys the morning's "the recording you stood still for"; the `broadcast` variants
  run most specific first (chased, calledMarcus, waited, believed, listened), so every flag is heard.
- Endings gallery hints tease instead of giving the route. Runtime on the card: about 8 minutes.
- Still to come (roadmap): the remade voices and cuts for the tightened pages and variants.

## Sound (2026-11-14)

- **Beds per place** (`sceneMood` in `js/game.js`, built in `js/audio.js`): `dawn` (the flat and the morning: soft rain, a wall clock), `city` (rain and traffic: the garage, the river), `server` (the Tower, the lobby: fans, relay ticks), `vault` (the sealed vault and the core: slow alarm pulse, sub drone).
- **Every choice** plays the click (`tap`) and 110 ms later a short rising stinger (`cue-trust-fall`, three pitches so no sample repeats), layered so it never cuts the click.
- **ARGUS speaks** its line in each scene that has one (`ARGUS_LINES`, 0.9 s after the scene shows; beds and music duck under it). A recording at `assets/audio/voice/trust-fall-<scene>.mp3` (Gen voice `hv_ai`) is used when it exists; until then a synthetic phrase plus the browser's own speech. The recordings wait on Gen access.

## Shown before told (2026-11-14, critic: story through play 4/10)

The plug is the first thing the player does, so it is shown, not told. `unplug` (the plug) opens on a drawn cutaway
(`BEATS` / `playBeat` in `js/game.js`, `.spark-beat` in `css/site.css`, no GPU): the speaker's amber ring pulsing, a
gloved yank, the cord whipping out of the wall socket with a spark, the ring dying, the TV breaking into static and
coming back with an amber edge, the phone lighting up. Sound `plug-yank` (`js/audio.js`) lands with it. For 2.6 s
(1 s under reduced motion) the story text, the question and the choices stay hidden; then they appear. The clip, when
its media is made, takes the beat's place and keeps the order: action first, words after. A new beat is one entry in
`BEATS`. The `trust-fall` playtest checks it (`beat-before-text`, `beat-ended`, metric `trustFallBeats`).

## Media made (2026-11-14, from PR #203's media; no new generation)

- **14 scenes play a real cut** (`<folder>/scene.mp4`: the shots end to end under the narration, over the mood music, 9:16,
  with sound; poster and phone rendition from `tools/make-posters.mjs`): first-light, the-plug, how-it-knows, the-garage,
  whats-inside, the-river, the-tower, lights-out, what-it-knows, the-bait, the-vault, sixty-seconds, on-the-air,
  the-green-line.
- **6 scenes have no clip yet**: the-bridge, the-promise, morning-edition, live, unseen, good-morning. Each shows #193's
  graded still (the story's key art, ARGUS amber) and the player speaks its `narration.mp3` over it with its music cue
  looped under (`iltvAudio.playNarration`; the data's `narration` and `score`), the choices held for the reading time.
  Their clips (and the talking shots, 19 in the recipes) are the media still to make.
- The build cuts a scene as soon as its shots, narration and music exist; a talking shot is cut in only once both its
  video and its recording are made. A scene whose lines have no talking shots yet keeps the live tail under its choices.

## The trust ring and what you carry (J, 2026-11-14)

The kit bar ("Carrying", `js/kit.js`) shows ARGUS's amber ring with a count, **Trust**, 0 to 4: +1 on arriving at How it knows (Ask how it knows you), What it knows (Stop and listen), The bait (Believe it) and The promise (Wait. ARGUS promised); it never goes below 0. On the believing way it reads 3 at the vault and 4 once you Wait. Carried items appear only once you have them, with no count: **Blindspot** (from the garage), **the copy** (Copy it and read it first) and **the jammer** (Jam it and keep going). Playtest `trust-meter`.

## Endings that name the choice (J, 2026-11-14)

Live (`truth`) and Unseen (`shadow`) have story variants, most specific first like the morning edition: **chased** (the
bridge, alone), **calledMarcus** (Marcus heard the call; in Unseen he knows only that someone called), **believed** (the
amber light above the camera; in Unseen ARGUS keeps your name because you asked). Someone who did none of them reads the
base text. The timer's default stays Live. Good morning (`believer`) is the reward for trust 3 and has one text.
