# Imagine Live TV: world bible

Imagine Live TV (imaginelivetv.com) is not one world with a map. It is a **home** (the landing page, the player, the blog)
that opens onto **three story worlds**, each its own universe with its own rules:

| World | Kind | Universe | Size now |
| --- | --- | --- | --- |
| **The Final Spark** | video choose-your-path | a sewer, a fog, a town; a villain origin, told in the dark | 34 pages, 4 endings, 2 deaths |
| **The Water Road** | video choose-your-path | the Old West; a hero origin, the mirror of the Spark | 20 pages, 2 endings, 2 deaths |
| **Night Shift** | console story (a camera wall, voiced lines) | Hawkes Tower, Manhattan, one night in February | 256 scenes, 12 endings, 1,376 lines, 11 voices |

Read with: `AGENTS.md`, `story/README.md`, `story/night-shift.md`, `story/water-road.md`, `docs/*/voice.md`. This bible
does not replace them. It sets the bar every agent builds to and says where the three worlds fall short of it. Names,
voices and rules in those docs are canon; what is added here is marked **(new)**.

**What the "walk" rule means here.** Nobody walks. The player *watches, listens and chooses*. So the rule "never more than
about 10 seconds without something to see, hear or do" is read as: **in a scene, a new picture change, sound, line,
object or press arrives at least every 10 seconds.** A held shot with only a drone under it for 15 seconds is the empty
corridor of this medium. Every area below is held to that, and the **Gap budget** in each says what fills it.

**The ground rule for beats.** A story beat is never a sentence on screen. It is a clip, a cutscene with real events
(something moves, breaks, rings, arrives), a sound, or a voice line. On-screen text is one line at most, and only when
nothing else can carry it (the ending card is the one allowed line).

**Tone of the house.** Each world keeps its own voice (Spark: cold, close, plain; Water Road: parched, quiet, morally
heavy; Night Shift: slow-burn, dry, decent). The home is the one place with no story voice: it is calm, dark, and gets out
of the way.

---

## Areas

### The home (the shell around the stories)

**A. The landing page.** Mood: a late-night TV lobby, a dark room with screens glowing, one of them yours to pick.
Looks like: the title splash (*IMAGINE LIVE TV*, 0.7 s hold, 0.4 s fade), a hero for the featured story that plays its
muted trailer within 2 s (Sound unmutes it), then a catalogue card per other listed story (the featured one is not
repeated) with its image, a 3 s muted loop on hover or when centred on a phone, logline, runtime, three-word mood and
progress badge (Not started, Started, Completed). Sounds like: the hero trailer is muted until Sound; a story's own
Tap to play unlocks sound inside it. Size: one scroll, hero plus catalogue cards and footer (no blog on the home page).
In/out: the URL; a card press enters a story; "All stories" returns with no splash. Studio notes live at `/notes/`.
With `prefers-reduced-motion`, posters only. **(new)** Trailers and loops are cut from existing clips (Night Shift:
CCTV stills with a slow push) by `tools/make-trailers.mjs`.

**B. The player (story screen).** Mood: the same room, now one screen filling it. Looks like: the page's video (or the
console room), the question, the choices, the inventory bar, the Tree, Settings, the `Tap to play` prompt. Size: the
viewport. In/out: card, `/?story=<id>`, `/<id>/` links; leave by All stories, or a death's Try again, or Start Over at an
ending. There is **no Back button** (canon: a choice stands).
**(new) House audio buses** (`js/audio.js`, `window.iltvAudio`): one Web Audio context unlocked on the first tap; three
buses (ambience, music, ui) with gain fades; ambience and music duck under a clip that has sound; a header sound toggle
mutes everything (saved in `iltv.sound`, kept in step with Settings / `hawkes.sound`). `setBed(story, mood)` and
`playUi(name)` play `/assets/audio/...` when those files exist and stay quiet when they don't. Playtest: `audio-buses`.
**(new) Choosing sounds and beds** (`js/audio.js`, made in code until recordings replace them): *appear* (the choices come up, a soft
two-note lift), *tap* (the lock-in on a press: a tape-deck clunk, 3 variants), *tick* (the last 3 s of the timer, 3 variants), all at
±7% pitch with no repeat of the same variant+pitch back to back, and never two UI sounds at once (a louder kind cuts a quieter one).
One ending sting per story: The Final Spark a low minor drop and one last drip; The Water Road a hollow open fifth under a swell of
wind and one creak; Night Shift a cold fluorescent hum that cuts out. One bed per story, 8 s seamless loop: the sewer (50 Hz hum, thin
trickle, four drips with echo) and the dust (gusting wind, deep rumble, two creaks of old wood); Night Shift keeps its own beds. A bed
starts only after the first clip plays (or on an image page, or at the first tap on a choice), carries across scenes without a
restart, ducks under clip dialogue and fades out on the story list. Sound off: no sound is made and no audio event is logged.
Playtest: `audio-ui` (also in `smoke`).

**C. The Tree.** A map of the story as found: only unlocked scenes show, a locked "?" per way not taken, nothing pressable.
It is the home's one *map*: it is how a player sees how big a world they have not seen.

**D. The Endings gallery (new).** Each story's found endings, reachable from the ending card and from an Endings tab
(or Night Shift's Endings button). Found tiles show that ending's poster and name; unfound ones show a blurred,
darkened silhouette of the same poster and "???". A count reads "2 of 5 found" and rises when a new ending is
reached (kept in localStorage `iltv.endings.<cookie>` next to the unlocks). Tapping a found ending shows its card
again. Playtest `endings-gallery` (and smoke's trimmed leg) checks it at 390x844 and 1280x720.
On a replay (an ending found or a death met) a choice to a never-reached scene wears a small gold "New" tag, one
whose whole way is seen a quiet "Seen" tick, and the Tree's nodes carry the same (`data-mark`); a home card says "2 of 5
endings" and turns gold when every ending is found. The home only ever shows; it never talks. Video stories only: a
console story's choices depend on flags, so it has the card count but no per-choice tags yet.

**E. Studio notes (`/notes/`).** The studio's noticeboard, off the home page: English titles with a small language chip
for the language each post was written in; the posts themselves stay under `/f/`. One footer link ("Studio notes") opens
the list.

### The Final Spark: the sewer and the town

- **A1. The sewer (start, dead end, passage, sludge, sewer water, trench foot).** Mood: dread from what is left out.
  Looks: black brick, a lit match, rust, a drain's reflection; the light is the clock. Sounds: drip, low cello, a metal hum.
  Size: six pages, no loop (the passage only goes on). In: waking (page 1). Out: the ledge. Deaths: the sludge, trench foot.
- **A1b. The ledge and the rat (get out of the water, the rat eats, follow the rat, step past it, the rat's pipe).**
  Mood: small and wet. The rat climbs out after you, shivering. Three things your hands can do about it: feed it a crust,
  follow it into a side pipe that lets out behind the gate, or step past it. Size: five pages. The pipe skips the gate.
- **A2. The gate (gate, break the gate, pick the lock, the key, the tag, unlock).** Mood: tense, ticking. Looks: an iron
  gate, a skeleton chained to the wall with a key in its hand and a brass tag at its neck. Sound: pulsing strings, a lock's
  small noise. Size: six pages. Breaking the gate bends it and gives only the key; picking the lock is quiet and the
  skeleton's tag reads LAMPLIGHTER, with your name scratched on the back (who you were).
- **A3. The fog and the house (fog, burn the door, knock, the old man speaks).** Mood: eerie, music box. Looks: fog,
  one lit window, a door. The old man in round wire glasses lives behind it. If you knock and ask about your hands he
  reads the soot: you lit these lamps (who you were, the second way to learn it). Size: four pages.
- **A4. The street and the white truck (upon the truck, inside, walk away).** Mood: cold daylight after the dark. The
  street remembers the door: it burns behind you, or the old man has shut it. Size: three pages.
- **A5. The shadow (shadow dance, new powers, Consume Light, Shadow Stitch, the lamps go out, the threads pull).** Mood:
  quiet, awful, intimate. The shadow is "a towering, thin, smoke-black humanoid shadow with long clawed fingers". It wants
  the town because the town lit every lamp to keep it down in the sewers. Eating light and stitching shadows are two
  different pages with the same last question. Size: six pages.
- **A6. The town (four endings).** THE DARK TOWN (the lamps go out), THE FLAME HELD (you hold a match up and refuse),
  THE RAT'S LIGHT (the rat brings a candle stub when your matches are gone), THE LAMPLIGHTER (you say who you were).

### The Water Road: the caravan and Dry Fork

- **W1. The caravan (the water road, the salt flats).** Dawn, six wagons, forty barrels. Heat shimmer, creak of wheels,
  hooves, a baritone guitar. Death: the heat (pushing on at noon: a viewer sees it coming).
- **W2. Under the mesa (mesa, rockslide, lookout, the broken wagon).** Rock shade, a glint of spyglass, the family at
  the empty cask. A warning shot costs four barrels and a lame mule, never the cliff on you.
- **W3. The night and the dust (under the stars, the dust, the high ground, the dry wash).** Cold stars; a dust wall; a
  wash that floods nothing. Riding for the high ground costs a lost day, four barrels and a driver who turns for home.
  At the wash the water you kept opens or closes a choice, and the family you helped (the boy names the riders' leader)
  or passed shows up in what you can say.
- **W4. The raid (the gunfight, over their heads, they come back, a drink for strangers).** The only place with
  gunfire. The gun is never the answer. Death: drawing on five riders. The father of the family stands at your
  shoulder at night if you helped them; a barrel left on the rocks (water 3 or more) can end the raid before it starts.
- **W5. Dry Fork (the cottonwoods, Dry Fork, the price of water).** Green at last; a town on its knees. Two endings.

### Night Shift: Hawkes Tower, 18:45 to 07:00

- **N1. The control room.** The player's home base. A windowless room behind the lobby desk. See *Landmarks*. Looks:
  the wall (nine tiles on two monitors), fire panel, access terminal, radio charger (four radios), log tablet and
  tour sheet, a coffee machine that is wrong, mini-fridge, one good chair and Dee's chair, the post-orders binder and
  an extinguisher, a door to the lobby and a door to the corridor, a clock two minutes fast. Sound: HVAC, the charger's
  click, the clock. The room's people are black silhouettes before one big screen.
- **N2. The lobby and the vestibule (C1, C2).** Long desk, turnstiles, revolving door, the bench by the window; the glass
  airlock to Madison Avenue with its ledge. Fourteen degrees at 04:45.
- **N3. The loading dock (C3).** Rollup door, dock office window, caged bulb, a trash compactor, the service corridor.
- **N4. The stairwell and the floors (C4, C5, C6).** Stairwell C at 31 (the fire door, the painted number), the 31
  elevator lobby (four cars, a plant), floor 44 (the cleaning crew floor, the janitor's closet).
- **N5. The 58th (C7).** The Chairman's glass doors and a desk nobody sits at.
- **N6. The roof (C8).** A push-bar steel door, a sign, a light.
- **N7. Fire command, floor 2 (C9).** The panel's repeater and a cabinet. The camera that freezes at 03:41.
- **N8. The morning (07:00).** Daylight: the day staff, a revolving door in grey light, twelve endings by daylight.

---

### Trust Fall: Meridian, 6 a.m. to 6 a.m. (draft, new, J 2026-11-13; canon `story/trust-fall.md`)
Near-future game render (rain, glass towers, teal shadow, amber light). Six places: **T1 the kitchen** (the free speaker on
the counter, Marcus on the TV), **T2 Juno's garage** (solder, rain, the drive), **T3 the Tower lobby** (a wall of screens),
**T4 the vault** (cold blue racks, the door that seals), **T5 the plaza and the bridge** (the van, the streetlights),
**T6 the precinct** (a bench, a wall TV, a ceiling camera). Gap budget: every scene is 2 shots plus a voiced line plus a
music cue, so a picture change or voice arrives well inside 10 s; ARGUS's amber light is the one constant that moves.


## Landmarks

One per area, something a player can see in the first second and steer by.

- **Landing page:** the featured hero card, a full-width image with a slow light drift. The three tiles of the title splash
  are the studio's mark.
- **Player:** the lit video itself, and the **inventory bar** at the foot (the flashlight in The Final Spark; the barrels
  and bullets in The Water Road).
- **Tree:** the single lit node at its root, with "?" nodes branching.
- **Blog:** the newest post's hero image.
- **Sewer (A1):** the match flame. Everything is seen by it, and when it dies, so does the page.
- **Gate (A2):** the iron gate and the skeleton with the key.
- **Fog (A3):** the one lit window in the house.
- **Street (A4):** the white truck.
- **Shadow (A5):** the shadow itself, twice a person's height.
- **Town (A6):** the town's lights, the last thing you will switch off.
- **Caravan (W1):** the six wagons in a line, the lead lantern at the head.
- **Mesa (W2):** the mesa itself, and the glint of the spyglass on its rim.
- **Night and dust (W3):** the dust wall; at night the star road.
- **Raid (W4):** the ridge the raiders come over.
- **Dry Fork (W5):** the cottonwoods, the first green in the story, visible from far off.
- **Control room (N1):** the wall of nine tiles, lit blue, with the clock beside it.
- **Lobby (N2):** the revolving door, a bright circle at the dark's edge; **vestibule:** the sleeping man's coat on the ledge.
- **Dock (N3):** the caged bulb. **Stairwell (N4):** the painted "31". **58th (N5):** the glass doors and their low
  light. **Roof (N6):** the sign on the push-bar door. **Fire command (N7):** the panel's amber trouble light.
  **Morning (N8):** the grey light in the revolving door.

- **Trust Fall:** T1 the amber-lit speaker on the counter. T2 the drive in Juno's hand. T3 the one screen whose face turns to look at you. T4 the vault door and the small amber light that comes on above it. T5 the streetlights flaring white. T6 the ceiling camera's amber blink.

---

## Who lives here

### The home
- **The studio mark / the house voice** (new): no character; the home only ever *shows* (cards, tiles, badges). It never talks.

### The Final Spark
- **You:** a young person with messy dark hair and dirt on the face, an olive canvas jacket over a grey hoodie. No name,
  no past. The player's hands are the matches.
- **The rat:** a brown sewer rat with glossy black eyes. First thing that sees you. Routine: watches from a pipe, leaves
  when the match dies, returns when the next one is lit. It reacts to the player by its distance. (Talks only if J
  approves "the talking rat", still in Waiting for J.)
- **The old man:** swept-back grey hair, round wire glasses, a dark wool coat. Behind the door in the fog. Sends you
  away, then, if you ask about your hands, says what they are: lamplighter's hands. He knew you.
- **The shadow:** smoke-black, long clawed fingers. It comes only where there is no light and it mirrors you. Its reason:
  the town lit its lamps to keep it down; it wants them out.
- **The skeleton:** chained to the wall at the gate, holds the key and wears a brass lamplighter's tag, your name on the back.
- **Who you were (the player's want):** a lamplighter of the town, who lit every lamp and locked the dark under it. You
  learn it at the gate (pick the lock and read the tag) or from the old man (knock, then ask about your hands), and it
  opens the ending THE LAMPLIGHTER. Burn the door and break the gate and you never learn it.
- **Matches (the clock):** a box of 20; every new page burns one (a number beside the flashlight in the inventory bar,
  red at 2 or fewer). Shortcuts and burning save matches; wandering and talking spend them.

### The Water Road
- **You:** a young trail hand of about twenty, boyish, sun-browned, flat-brimmed tan hat, red bandana, revolver unfired.
- **The dove:** a small mourning dove (black spot on the cheek, black spots on each wing, pale-blue ringed eyes). It is only
  in the pictures, never in the words (the playtest enforces it). Routine: rides on the lead wagon at dawn, goes ahead of
  the caravan toward water.
- **The trail boss:** a lean old woman, grey braid, battered black hat, duster, coiled bullwhip. She sets the water rule.
- **The lookout boy** with the spyglass; **the family** (mother, father, little girl); **the raiders**; **the townsfolk** of
  Dry Fork.

### Night Shift (canon: `story/night-shift.md`, voices locked)
- **You:** the rookie; the player; decides how the log reads.
- **Dolores "Dee" Reyes** (trainer, 26 years): Bronx, low alto, dry, a smoker's rasp from years ago. Routine: counts under
  her breath at the charger, eats at 00:30, walks tours with the pencil in her shirt pocket, keeps the clock fast. Reacts
  to the player's honesty and to what they write. The heart of the story: layers of reveal (the pencil, the spring, the four
  hours, twelve).
- **Mr. Okafor** (day supervisor): courteous, weary baritone. Leaves at 18:50 for a train; the night line rings in his kitchen.
  Returns at 06:30 and reads the log.
- **Terrell Banks** (lobby desk until 23:00): warm, quick. His birthday was Tuesday.
- **Marisol Quintero** (cleaning lead, floors 30 to 44): fast, warm, a vacuum cleaner far away. Calls about the new crew
  member's failed badge.
- **Dev Anand** (31st-floor lawyer): tired, polite, on the elevator intercom.
- **Ms. Adler** (fire safety director): crisp, formal, comes if called.
- **The courier** (dock intercom), **the sleeper in the vestibule** (one line), **Mr. Brandt** (tenant on 40).
- **Pierce Hawkes** (cameo at 03:20, once): the Chairman; assured, never menacing. **The Board** (Director Hale, Voss and
  Lang, no first names ever) is names in a log, never seen.

---

### Trust Fall (draft; characters carry their locked Gen voice id and clip set)
- **Rae (you)** (never named by you; only by others). *Want:* to stay unwatched and unowned. *Arc:* from hating the machine to
  being caught by it. *Moment:* at the vault, Believe it earlier makes "Wait. ARGUS promised" appear, and the door opens on
  the ninth second. *Words:* wary, proud, tired. *Voice:* narrator `hv_narrator_bright` (seen from behind). *Clips:* idle,
  walk (cleaning cart), talk (hands only).
- **ARGUS** (amber face of light, a ring on small devices). *Want:* to be trusted before it is needed. *Arc:* villain on the
  surface, protector in the end. *Moment:* it says "Please stop walking" in the lobby, then keeps its promise in the vault
  and on the next clip says "I told you I'd be there". *Words:* calm, patient, shy. *Voice:* `hv_ai`. *Clips:* idle (slow
  ring pulse), walk (the green line leads you), talk (lines drawn in light).
- **Marcus Hale** (your husband, the morning anchor). *Want:* for you to come home. *Arc:* from a voice on the TV to the one
  who hears your call live. *Moment:* he stops mid-sentence on air when you call from the vault; his sign-off is "you know who
  you are". *Words:* warm, steady, exhausted. *Voice:* `hv_narrator_warm`. *Clips:* idle (desk), walk (plaza), talk (to camera).
- **Juno Vale** (the crew's leader). *Want:* a face to blame for Blindspot. *Arc:* friend, betrayer, in custody. *Moment:* "Somebody has to be the face of it" as the door seals. *Words:* confident, easy, cold. *Voice:* `hv_heroine`. *Clips:* idle (coat), walk (van), talk (earpiece).


## Characters

Every named character's want, arc, moment, three words, voice id and clip set sits under its world in *Who lives here* (Trust Fall's four: Rae, ARGUS, Marcus Hale, Juno Vale).

## What happens

Per area: interactions (several kinds), self-running events, ambient sound, what changes over time. "Gap budget" says
what fills any hold longer than ten seconds.

### The home
- **Landing page.** *Interactions:* press a card; press Start Over / Continue; scroll to the blog; switch language; open
  Settings (sound, volume); press a footer link. *Self-running:* the hero light drifts; badges update; hover loops (new).
  *Ambient:* none by design before sound is on; after Tap to play, the story's own bed. *Changes over time:* a card
  moves from Not started to Started to Completed; percent explored climbs. Continue opens beat 3b (Previously), not a
  cold jump into the left-off scene.
- **Player.** *Interactions:* choose; Tree tab; flashlight (Spark); Settings; CC; subtitles; skip Previously. *Self-running:*
  video plays; in video stories (*The Final Spark*, *The Water Road*) a 15 s draining timer bar (`"Choose in N s"`) runs across
  the top of the choice group once the clip ends, pulses warmer in the last 3 s, and briefly highlights the default choice
  before playing it when time runs out (*Night Shift* choices are untimed by design); the Previously poster pushes in for 3 s.
  *Changes:* the inventory bar loses water/bullets/matches; the Tree fills in.
- **Blog.** *Interactions:* open a post, play its video, scroll. *Self-running:* none. *Falls short:* a bare document list;
  **(new)** each post card shows a still that animates once on scroll-in.

### The Final Spark
Every page is one lit match: a page holds one video, one beat, one question. Gap budget: a page's clip is 8 to 12
seconds; something must move or sound every ~5 seconds (a drip, the match's flicker, the rat's whisker, the shadow's
edge).
- **A1 Sewer.** *Interactions:* choose a way; light the next match; the flashlight overlay reveals the English under the
  words. *Events:* water rising a hand's width a page; the rat appears, leaves and returns; a far metal clang that does
  not repeat. *Ambient:* drip, low cello, metallic hum. *Changes:* matches burn down; the dark gets closer.
- **A2 Gate.** *Interactions:* break, pick, or find the key (the skeleton's hand). *Events:* the gate's bars ring when
  struck; a skull's jaw settles; the lock clicks. *Ambient:* pulsing low strings, ticking. *Changes:* the key, once taken,
  is in the inventory and the skeleton's hand is open from then on.
- **A3 Fog.** *Interactions:* burn the door or knock. *Events:* the window's light flickers once per page; a door bolt
  slides when you knock. *Ambient:* music box, wind. *Changes:* the fog thickens each page.
- **A4 Street.** *Interactions:* climb the truck, enter, or walk away. *Events:* the truck's engine ticks as it cools;
  a distant dog. *Ambient:* wind and one streetlight's hum. *Changes:* dawn lightens by one step.
- **A5 Shadow.** *Interactions:* dance, explore powers, Consume Light, Shadow Stitch. *Events:* every lit thing nearby
  dims as the player's power grows; shadows on the wall move when the player does not. *Ambient:* sub-bass, silence
  where sound was. *Changes:* the lights go out one by one.
- **A6 Town.** *Interactions:* the last fork (the lamps go out, or the threads pull). With matches to spare: Destroy the
  town, Hold up a match, and Say who you were if you learned it. At 2 or fewer: no match to hold; Whistle for the rat if
  you fed or followed it, Put out the last match if you did not, and Say who you were. *Events:* every window goes dark,
  house by house; or the lamps come back one by one. *Ambient:* the silence is the sound; at THE RAT'S LIGHT a small drag
  of a candle stub.
- **The rat across the story.** Fed: it rides in your pocket and gnaws a last crumb at the end. Followed: it runs ahead,
  and its pipe skips the gate. Ignored: no rat feet in the fog, no rat at the end. It comes back only to someone it knows.

### The Water Road
Gap budget: a clip runs ~10 s with narration and music under it; wheels, hooves, wind and the guitar keep sound moving;
the dove crosses frame once per page.
- **W1 Caravan.** *Interactions:* take the flats or the mesa; *Events:* a wagon lurches; barrels slosh (water level
  visible in the inventory); a canteen is passed. *Ambient:* creak, hooves, harmonica. *Changes:* the sun climbs, the
  shadows shorten.
- **W2 Mesa.** *Interactions:* warning shot or wave; *Events:* the glint; the spyglass boy waves back; the cliff comes
  down on a bad choice (a death). *Ambient:* echo, stone ticking in the heat.
- **W3 Night and dust.** *Interactions:* mend the wheel, ride on; *Events:* dust wall crossing the frame; stars wheel.
  *Ambient:* cricket silence, then wind.
- **W4 Raid.** *Interactions:* shoot, shoot over heads, hold fire, share water; *Events:* hooves on the ridge, a
  revolver cocked, a kettle thrown; bullets in the inventory drop. *Ambient:* the spaghetti-western standoff cue.
- **W5 Dry Fork.** *Interactions:* the two ending choices; *Events:* the first cottonwood leaf; the town's bell. *Ambient:*
  running water for the first time in the film. *Changes:* the water inventory is set to four for the last stretch.

### Night Shift
Gap budget: a line every ~3 to 9 seconds; a scene's `act`s and `feed` changes (the big screen's CRT flash 200 to 300 ms)
keep the eye moving; ambience beds under every scene; stings at turns. Nothing is silent between scenes.
- **N1 Control room.** *Interactions:* choose what to say, log or do at each scene (up to 12 choices, gated by flags);
  sit or stand at handover; open the shift log; replay a line; toggle CC; Settings. *Events on their own:* the phone
  rings; the radio charger clicks; the clock ticks fast; Dee counts; a choice writes itself in pencil on screen; a
  chapter card jumps the clock; Okafor leaves by the door; the lights flicker and coffee spills; Dee taps the screen,
  stands, angrily leaves with the keys; someone writes in the log; the silence button is pressed. *Ambient:*
  `control-room`, later `control-room-late`. *Changes:* the bed shifts at 02:00; slips and trust move a meter; a wedge
  stays propped until dealt with.
- **N2 Lobby and vestibule.** *Interactions:* look at the laptop, call the bench owner, check the sleeper, offer a
  coffee. *Events:* the revolving door turns; the laptop's lock light blinks; the sleeper breathes; the frost grows.
  *Ambient:* `lobby`, `vestibule` (wind, glass). *Changes:* the lobby thins at 19:00; frost at 04:45.
- **N3 Dock.** *Interactions:* take the courier's name, refuse the box, sign it in. *Events:* the rollup door rattles; the
  van's headlights; intercom buzz. *Ambient:* `dock`.
- **N4 Stairwell and floors.** *Interactions:* remove the wedge, call the FSD, answer Marisol's badge call, answer
  Dev's intercom. *Events:* a rubber wedge, a door that sighs; the elevator chimes; water creeping under the closet
  door. *Ambient:* `stairwell`, `elevator`, `corridor`; footsteps on stairs.
- **N5 The 58th.** *Interactions:* sign Pierce in, or wave him through (sets `waved_through_big_name`). *Events:* the
  Chairman crosses with a phone. *Ambient:* low room tone.
- **N6 Roof.** *Interactions:* the 3am tour. *Events:* the roof-door sensor goes quiet. *Ambient:* `roof` (wind).
- **N7 Fire command.** *Interactions:* report the trouble light, leave the panel alone, write the panel's exact words.
  *Events:* panel buzzer; camera 9 freezes at 03:41. *Ambient:* the panel's buzz.
- **N8 Morning.** *Interactions:* the last choice before the log is read. *Events:* Okafor reads the log; the day staff
  arrive. *Ambient:* `morning`. *Changes:* twelve different mornings, each ends on an object.

### Deaths, memory and mercy in the clip stories (new, J 2026-11-11)

A death keeps its clip and its line, then offers Rewind to the choice (the fork again, the deadly way marked Tried) and
Start over; a choice can be remembered (flags) and called back by a later page's text; the 15 s timer rides the story's
basic path and never kills a viewer who looked away; a page with one choice plays on by itself after its clip. The
Water Road's callback is at the cottonwoods (the flask given, the family passed). Rules: `story/README.md`.

### The look-around layer (new, the fix for the clip stories' empty holds)

The fun review judged The Final Spark and The Water Road thin: inside a page the only verb is "choose". Every event and
sound listed under those two worlds above is **new (specified, not built)** unless a beat below marks it *exists*; the
clips themselves, their music, narration and choices exist. To fix it, each page gets **hotspots** on the held part of
the clip (after ~4 s, a soft pulse on 2 to 3 objects). A press plays one sound or voice line and a small reaction in the
picture, no text, and never costs a match, water or a choice:

| Page | Hotspots (press, hear, see) |
| --- | --- |
| Sewer | the rat (a squeak, it turns its head); a drip (a plink, ripples); the match (a flare, shadows swing) |
| Gate | the bars (a ring, dust falls); the skeleton's hand (a dry rattle, the key glints) |
| Fog | the lit window (a curtain moves, a chair scrapes); the door (a knock echoes) |
| Truck | the engine (it ticks); the dog (a bark far off) |
| Caravan / wagon | a barrel (a slosh, the water bar pulses); the dove (a coo, it hops); the lead lantern (a chime) |
| Mesa | the glint (the spyglass boy waves); the cliff (a loose pebble falls) |
| Dry Fork | the bell (it rings once); a cottonwood leaf (it falls with a rustle) |

Night Shift already has its verbs (log, replay, gated choices, the big screen); add one more, **press a camera tile to
hear that room's bed for 2 s** only if J lifts the "nothing on the screen or strip can be pressed" rule, otherwise leave it.
Voice for the old man's line and the rat is the next content task (cents each; the talking rat needs J's call).

---

### Trust Fall (draft)
Belief is a flag, `believed`, set by "Believe it" in the lobby, and the world answers it on screen. At the vault the door
shuts "just like ARGUS said" and a small amber light comes on above it; "Wait. ARGUS promised" is offered only with
`believed` (nothing locked, nothing greyed). Begging ARGUS afterwards plays a different green-line clip: the lock opens
before you finish asking and ARGUS says it said it would be there. The morning edition shows the ceiling camera watching
over you, and "Say thank you to ARGUS" is offered only with `believed`; without it that ending cannot be reached.
Twenty pages, three endings, two deaths; Rewind marks the tried death.


## Story beats

Each beat is an event the player lives through. "Where / when" is the page or scene and the point in the run. Each is
carried by sound, picture or a voice, never text alone. Beats marked **(exists)** are built; **(new)** are specified
here for an agent to build next, within the existing scene data.

### Home
1. **The house lights come up (exists/new).** *Where/when:* first load. The title splash holds 0.7 s as the tile wall
   flickers and a soft tone sounds; it fades into the landing page. Event: the three world cards light one after another.
2. **A world wakes under the pointer (new).** *Where/when:* hovering a card. A muted 3-second loop of that world plays;
   with sound on, one note of its bed.
3. **The first match (exists).** *Where/when:* press Play on The Final Spark. The Tap to play prompt covers the screen;
   the press unlocks sound and the sewer video starts with a match's strike.
3b. **Previously on Continue (exists).** *Where/when:* press Continue on a mid-run (hero, Continue row or card). After
   Tap to play (if needed), a 3 s push-in on the last scene's poster (card image for Night Shift), the story title and
   one short line naming the last choice; a tap skips; then a cross-fade into the scene where they left off with its
   choices ready. Play and Start Over never show it. Event: the house remembers the cut, not a cold jump.

### The Final Spark
4. **Waking (exists).** *Page start.* Dripping water, the rat's glossy eyes in the match's light; the first choice.
5. **The sludge (exists).** *First death, early.* The player steps into the sludge; the clip ends on a gulp and the dark;
   "You have died." (spoken once, flat; deaths are two or three sentences).
6. **The key (exists).** *Gate.* The skeleton's fingers open; the key falls and rings on the stone.
7. **The fog door (exists).** *House.* A knock; the bolt slides back; the old man looks out and sends the player away.
   **(new)** His one line is spoken (pending "Waiting for J").
8. **The white truck (exists).** *Street.* The player rides under or walks away; a diesel idles, a dog barks.
9. **The first light goes out (exists).** *Shadow.* Consume Light: the nearest lamp dies with a soft pop.
10. **The town goes dark (exists).** *Ending.* House by house the windows go black. The ending's name is the single allowed line.
11. **The crust (new).** *Page the rat eats.* The rat gnaws what you set down and looks up; the camera stays at its height.
12. **The tag (new).** *Gate.* A thumb turns the brass tag over: LAMPLIGHTER on the front, your name on the back.
13. **The soot (new).** *The old man speaks.* He looks from your hands to your face and says what they are; he shuts the door slowly.
14. **The last match (new).** *The last fork, at 2 or fewer matches.* The flame is too small to hold up; a rat's feet, a candle stub dragged over cobbles.

### The Water Road
11. **Dawn on the water road (exists).** *Start.* Wagon wheels and harmonica; the dove leaves the lead wagon.
12. **The flask (exists).** *The broken wagon.* The player gives their flask; the girl drinks first; the trail boss opens
    a barrel. (Acted, not told.)
13. **The warning shot (exists).** *Mesa.* Gun crack; the echo; the cliff.
14. **The standoff (exists).** *Dry wash.* Ticking percussion and a cocked hammer; whoever fires first loses water.
15. **A drink for strangers (exists).** *Night raid.* The raiders come back for water and are given it. The ridge's silence.
16. **The cottonwoods (exists).** *Spring.* The first running water sound in the story, a leaf shaken loose.
17. **Dry Fork (exists).** *Hero ending.* The bell; THE END. This is how it started. (Or **the price of water**, the
    other ending: the same bell, but only after the barrels are counted.)

### Night Shift
18. **Handover (exists).** *18:45, control room.* Okafor opens the log; Dee counts under her breath; "Sit anywhere
    that isn't mine." Within ~20 s of Tap to play the viewer picks a chair or stays standing (trust or pose lands at
    once); then the day log finishes and he leaves for his train.
18a. **The choice lands in ink (exists/new).** *After any trust or flag choice.* The shift-log line writes on screen
    with the pencil SFX within 2 s, and Dee answers with a recorded "Mm." or "Mm-hm." when one fits (Telltale beat).
18b. **Chapter cards (exists/new).** *About every 10–12 minutes of audio on the shortest path.* A 2 s card: the clock
    jumps, a sting, a one-line hook; home Continue resumes in that chapter.
19. **The first radio check (exists).** *19:00.* A squelch, "Control to unit one." The player answers (or does not).
20. **The cleaner's badge (exists).** *21:30, 44.* Marisol on the walkie, a vacuum far away; the badge reader refuses
    on camera 6.
21. **The wedge (exists).** *Stairwell C, 31.* A rubber wedge holding a fire door; the door sighs when the player
    removes it.
22. **Dee eats (exists).** *00:30.* The player alone on the wall for the first time; Dee's wrapper in the foil; the
    clock ticks; the phone rings.
23. **The sleeper (exists).** *~03:00, camera 2.* A man on the ledge at 14 degrees; the player decides what to do; a
    breath on the glass.
24. **Camera 9 freezes (exists).** *03:41.* The tile stops; the panel buzzes once; the player must write "offline", not
    "something is wrong".
25. **The Chairman (exists).** *~03:20.* Pierce crosses the 58th in a coat; the elevator chime; "Evening. Don't get up."
26. **The delivery (exists).** *04:00.* Dock intercom, a box for the 58th, nobody authorized it.
27. **Dee's spring (exists).** *Late.* The pencil is handed over, or the sandwich, or the one-line evaluation, by the
    player's earlier honesty. (Eat something / Someone to leave it to / By the book, alone.)
28. **The morning read (exists).** *06:30 to 07:00.* Okafor reads the log; the day staff come through the revolving
    door; the ending ends on an object (a radio, a pencil, a foil, a drawer).

---

### Trust Fall (draft)
1. Kitchen, 6 a.m.: the speaker says your name; unplug it or ask. 2. Garage: Juno gives you Blindspot (event: the drive
changes hands). 3. Lobby: every screen cuts from Marcus to ARGUS's face (event). Believe it, or not. 4. Vault: the door
seals; the choice set differs with belief (event). 5. Rescue: the green line, the call on air, or the promise; belief changes
the clip. 6. Morning edition: Marcus's "you know who you are"; three endings, one reserved for belief (reward). Told by
clips, ARGUS's and Marcus's voice and music cues; the only on-screen line is the ending card.


## Where it falls short today, and what is next (honest)

1. **The home is silent and still.** Landing page has no motion or sound before a story opens (beats 1 and 2 above).
   Continue no longer drops cold into a scene (beat 3b exists); hover loops (beat 2) are still new.
2. **Final Spark and Water Road are only clips with choices.** Between choices there are no interactions except the
   choice itself. Next: a "look around" ring on selected pages (the rat, the gate, the skeleton, the wagon barrels)
   that the player can press to hear one sound or line (cheap, CPU or voice cents).
3. **The Final Spark has no voice** other than the narration clip; the old man and the rat are silent. Voice lines
   for both are the next content task (cents each; needs J's call on the talking rat).
4. **Night Shift is the model for density.** Every scene has a bed, lines, acts and a camera feed. Fifteen echo scenes
   (46 lines) are unvoiced until the ElevenLabs account is paid; 6 music stings are unmade (GPU, $0.08 to $0.70).
5. **No world links the three.** They are separate universes (Night Shift is explicitly "another night" from PH Origins).
   That is the rule, not a gap: do not cross-reference them.
6. **The blog is a plain list.**

## Rules for any agent adding to this world

- New scenes, pages, characters and places go **here first**, in the matching section.
- Canon is the story docs: Hale, Voss and Lang are never given first names; Pierce Hawkes is the Chairman on the
  58th floor; the Spark and the Water Road are separate universes; Night Shift shows nothing of the restricted work
  (no B3, no vat, no creature); the dove is only in pictures.
- Every beat is carried by a clip, an event, a sound or a voice. A new beat told only in text is rejected.

## Vertical slice: the home's landing page (built, `js/living.js`)

The slice is the home's landing page (the world bible's first area). **Landmark:** the hero card, with a slow light drift.
**Life:** the house lights come up card by card (beat 1); a wall of three screens flickers on its own every 2.5 to 5 s;
blog cards wake as they scroll in. **Interactions:** a card under the pointer glows and ticks; a press clicks and opens the
story; scroll to the blog. **Ambient sound:** synthesized ticks and tones (no assets), only after the first press and
never when Sound is off. **Beat as an event:** the house lights come up with a rising tone, no text. Playtest `living-home`
reports quality.maxQuietSeconds and quality.textOnlyBeats. Left: hover loops of each world, voice lines for the Spark.
