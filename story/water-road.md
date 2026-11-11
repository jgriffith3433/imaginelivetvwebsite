# The Water Road — story doc

`story/water-road.json`: every page, its text, its choices, its inventory and how its media is made. Its pages are
under `/water-road/` (`/water-road/the-water-road/`, …), its asset ids start with `water-road-`, and it plays at
`/?story=water-road`.

**Approved by J, 2026-10-18: canon.** (J's direction on a call that day; he approved it the same day: "Add it to
the landing page".) It is listed in `story/stories.json` and has its card on the landing page, after The Final
Spark's, with its key image and its progress badge (Not started, Started, Completed: story/README.md, "Progress on
the cards"). Every page plays its own video, narration and music (made 2026-10-18).

## The idea

A hero origin, the mirror of The Final Spark's villain origin, in its own universe: nothing of the sewer, the rat or
the matches is here. **The Old West.** A water caravan crosses the desert to a town whose wells have failed. The
desert takes from everybody; the hero is the one who gives. You win by keeping people alive with water, never by
taking it, and never by the gun.

- **Title:** *The Water Road*
- **Tagline** (under the title in the player): *Every drop has to go somewhere.*
- **Logline** (its card): *Forty barrels of water, a dying town on the far side of the desert, and
  a revolver you've never fired. Every page costs water.*
- **Tap to play:** *THE WATER ROAD*, "Sound on. Fill your flask."

## The story (the full decision tree, 20 pages; changed 2026-11-11, see "Water decides, and the road remembers")

You ride guard on the last wagon of a water caravan bound for Dry Fork, a mining town whose wells have gone dry.

1. **The water road** (`start`). Dawn, six wagons, forty barrels. Cut across the salt flats, or take the long trail
   under the mesa.
2. **The salt flats.** Noon; a wheel cracks in the heat. Push on (**the heat**: you drink the last of your flask and
   die) or wait for dark and mend it (**under the stars**). At sunrise a wagon lies on its side ahead: ride over to
   it, or ride on by.
3. **Under the mesa.** Something glints up on the rocks, the way a rifle does. Fire a warning shot (**the
   rockslide**: the echo brings the cliff down, and you die), or wave and wait: it is **the lookout**, a boy with a
   spyglass whose family's wagon broke down a mile on. Follow him, or ride on by.
4. **The broken wagon.** A mother, a father and a little girl sit by an empty cask. Nobody asks you for anything.
   Give them your flask (**your flask**: the girl drinks first, the trail boss opens a barrel, and the family rides
   with the caravan), or tell them the water is spoken for (**ride on by**: the barrels slosh behind you like church
   bells; turn around, or keep riding).
5. **The dust.** A dust storm swallows the trail and splits two barrels. Follow the dry wash, or ride for the high
   ground (**the high ground**: lost for two days, your flask runs dry, and you die).
6. **The dry wash.** Five riders block the way, guns out; they want the water. Draw your revolver (**the gunfight**:
   they are faster, and you die), fire over their heads (**over their heads**: they scatter, and come back that night,
   **they come back**: shoot it out, the gunfight; or open a barrel and call them in), or open a barrel for them.
7. **A drink for strangers.** Their leader drinks slowly, puts his gun away, and his men ride with you.
8. **The cottonwoods.** Where the wash ends: green trees, and a spring that is on nobody's map. You fill your flask.
   Bring Dry Fork the way here (**Dry Fork**, the hero's ending), or keep the spring a secret and sell the water
   (**the price of water**, the other ending).

**Endings** (the scenes with an `ending` in the data: reaching either makes its card say Completed). *Dry Fork*: you ride in with full barrels, then lead the whole town back to the spring, and by the end
of summer they call you by a name you didn't have before. *THE END. This is how it started.* *The price of water*:
Dry Fork pays what you ask, you are rich by fall, and nobody in town will look you in the eye. *THE END. Not every
story makes a hero.*

**Deaths** (two, both seen coming: the heat, the gunfight) send you back to the choice (Rewind) or the water road (Start
over). The rockslide and the high ground are no longer deaths: they cost barrels, a mule and a driver (below).

## The bird (never mentioned)

A mourning dove befriends you, and nobody ever says so: no page's words name it (the build fails if a scene's text
says *bird* or *dove*: `unspoken` in the data). It is only in the pictures:

- **The opening** (`start`) shows the dove first, alone on a dead branch at dawn; then the camera finds the caravan
  behind it.
- It is on the tailgate at sunrise (**under the stars**), on the rim of your flask as the girl drinks (**your
  flask**), riding out the dust in the lee of a wagon (**the dust**).
- **The payoff:** in **the dry wash** it flies low along the wash ahead of the mules, the way you are about to go
  (doves fly to water at dusk: the old desert saying); at **the cottonwoods** it is drinking at the spring before you
  get there; at **Dry Fork** it sits on the water tower.

So a viewer who watches can see where the water is before the words say so ("Follow the dry wash").

## The inventory

The Final Spark's inventory is its flashlight. The Water Road's is **a revolver, its bullets and your flask**, in the
bar along the bottom of the player and of its pages (never on the landing page):

- **Revolver**: a Colt Single Action Army ("Peacemaker", 1873), six shots. It is always there.
- **Bullets**: six to start, shown as six rounds and a count.
- **Water**: your flask, four swallows to start, shown as how full it is and a count.

It is data (`inventory` in `story/water-road.json`): the items with their start and most, and on each scene what it
does to them: `"inventory": { "water": -1 }` takes one, `{ "water": { "set": 4 } }` fills it. The counts are worked
out from the way you came (the start, then every page since), so a saved place comes back with them. There is no
going back a page to win a swallow back: a choice stands. Coming back to the start (dying, "Try again") starts the counts
over. A branch page (`/water-road/<folder>/`) is a page on its own, so it shows the counts as you would have them on
the shortest way there.

**Running out (changed 2026-11-11).** Water is the resource, and an empty flask no longer ends the run: it closes
doors. Some choices need water kept (below), shown locked with their requirement in words when you are short. **Barrels**
(40 at the start, a barrel icon in the bar) are what the desert and your choices take. **Bullets don't end anything**: the
hero wins without them, and the two times you shoot (the warning shot under the mesa, the shots over the riders' heads)
are as many as anyone fires. No way through the story leaves you with fewer than none (the build checks that too).

| Page | Bullets | Water | Barrels |
| --- | --- | --- | --- |
| The water road | 6 (start) | 4 (start) | 40 (start) |
| The salt flats, under the mesa |  | −1 |  |
| The heat (death) |  | −3 |  |
| The rockslide | −1 |  | −4 |
| Your flask (giving it) |  | −2 | −1 (the trail boss opens one) |
| The dust |  |  | −2 |
| The high ground |  | −1 | −4 |
| The gunfight (death) | −6 |  |  |
| Over their heads | −2 |  |  |
| A drink for strangers |  |  | −2 |
| The cottonwoods |  | filled (4) |  |

## The rules of the piece

- **Second person, short.** One or two sentences of story, then the question. Plain words, the way a trail hand
  talks; no jokes.
- **English.** The Final Spark's pages each speak another of the world's languages, with the flashlight showing the
  English: that is its own thing. Every page here is in English (`lang: "en"`), and the flashlight is not here.
- **Look: a modern 3D western video game** (Red Dead Redemption 2's look): a real-time game render, not live action
  and not a cartoon. Wide desert light, dust in the air, warm sun and long shadows, the camera mostly behind or beside
  you on your horse. Vertical 9:16. It is in the story's `style` and `negative` (and `avoid`, for the sheets made from words alone, whose tool has no negative), so every recipe carries it.
- **Cast** (no filmed clips: every reference sheet is made from its `look` alone): **you** (a young trail hand),
  **the dove**, **the trail boss** (an old woman who runs the caravan), **the family** (a mother, a father, a boy and a
  little girl), **the riders' leader**. Nobody speaks on camera; the narrator tells it.
- **Sound.** Its own Tap to play (*THE WATER ROAD*, "Sound on. Fill your flask."), the studio's standard Settings.
  Narration by a weathered western voice (ElevenLabs "Wyatt – Wise Rustic Cowboy", `YXpFCvM1S3JbWEJhoskW`: an old,
  deep American cowboy voice, "weathered wisdom from a cowboy who's lived a hard life on the range"); music by mood (`music` in the data: trail, heat, danger, death, hope, end).

## Approved (J, 2026-10-18)

Everything that was waiting for J, approved with "Add it to the landing page": the title, tagline, logline and the
whole tree above (twenty pages, two endings, four deaths); the mourning dove; running out (an empty flask is death,
an empty gun isn't); the second ending, *The price of water*; the narrator's voice, "Wyatt – Wise Rustic Cowboy"
(`narrator.voice`, `YXpFCvM1S3JbWEJhoskW`, a weathered western voice; another would remake the 20 narrations, about
$0.80); and the media as made.

Nothing is waiting for J.

## Media

Made 2026-10-18 within J's $8: the five character sheets (`story/characters/water-road/`), a keyframe per page
(best of 3, picked by Claude and looked at before its clip), a 9:16 clip per page, the 20 narrations and the six
music cues; `npm run story` cuts each page's `scene.mp4`. The card image is `/assets/images/water-road.jpg`, the
opening's dove on the dead branch.

## Memory and mercy (J, 2026-11-11)

The road remembers what you did and is kind to someone who looks away. Giving the girl your flask sets `gaveFlask`;
riding past the family sets `passedBy` (giving it later clears it): at the cottonwoods the question calls it back
("A little girl drank from your flask once. What do you do with this water?" / "You rode past a family once. What do you
do with this water?"; text only, so the narration in the clip stays true). A death keeps its clip and its line and
offers Rewind to the choice (the fork again, the deadly way marked Tried) and Start over. When the 15 s run out on the
salt flats, under the mesa, in the dust, in the dry wash and at the night raid, the timer rides the basic path
(`default`: wait for dark, wave and wait, fire over their heads, open a barrel), never into a death. Not made yet: a
variant clip with its own narration for the callback (needs GPU; priced in the change's summary).

## Water decides, and the road remembers (J, 2026-11-11)

Player goal: the water you kept decides which choices stay open; helping the family comes back later; a bad choice costs
barrels, a mule or a rider, not a trick death. Reference: Bandersnatch's cereal choice called back in the advert, Late
Shift's choices that change the chapter you reach, Telltale's visible consequence. No new scenes and no new clips: every
page keeps its folder and its picture; only words, gates and flags changed.

**Water gates** (`needs`, story doc "Water and gated choices"; a locked choice stays on screen, greyed, "needs water 3+"):

- **The dry wash** (`wash`): *Open a barrel for them* needs **water 2**. A viewer who gave the girl the flask (water 1
  there) sees it locked, and gets *Call their leader by name* instead (`requires gaveFlask`): the boy knows the riders'
  leader, Hale, who dug the family's well. A viewer who passed the family keeps the water and the barrel option, but not the name.
- **Over their heads** (`warningShots`): *Leave them a barrel on the rocks* needs **water 3**: with it, you skip the night
  raid (the riders find the barrel, `leftBarrel`, and ride with the caravan); short of it the row is locked and you keep watch.

**The family comes back.** `gaveFlask` and `passedBy` already changed the spring's question. Now: at the dry wash the boy
whispers who the riders are (helped), or you face them with nobody who knows their faces (passed: no variant, the base
page); at the night raid the girl's father is up already, lantern in one hand and the other held out empty, at your
shoulder (helped). The text of a variant is on screen only: the clip's narration is the base page's.

**Costs instead of trick deaths.** *Fire a warning shot* (`mesa`) is no longer the cliff on you: the rock answers and takes
four barrels and lays a mule down lame (`firedAtMesa`, `muleLame`); the boy then comes down with both hands up (a lookout
variant). *Ride for the high ground* (`dustStorm`) costs a day, four barrels, a swallow of water and **a driver who turns
for home** (`riderLeft`; the dry wash and the night raid say you are a rider short). Deaths left, both of the kind a viewer
sees coming: **the heat** (pushing on across the salt at noon) and **the gunfight** (drawing on five riders).

**Defaults.** Every fork marks the safe `default` the 15 s timer takes (never gated, never a death): mesa, ride over,
follow him, give them your flask, keep riding, follow the dry wash, fire over their heads, keep watch, open a barrel and
call them in, bring Dry Fork the way here, wait for dark, wave and wait.

**The endings name an earlier choice.** *Dry Fork*: "...and the riders you gave a barrel to ride in beside you." *The
price of water*: "...and the riders you once gave a barrel to ride out without a word." Every way to the spring passes the
barrel given to the riders (opened at the wash, called in at night, or left on the rocks), so the line is true on every road.

**Media.** No new picture is needed. Four narrations changed text and are remade (rockslide, high ground, both endings):
voice only, cut over the existing clips (`npm run story` recipes; Studio's asset make, then `tools/make-audio.mjs`-style
cut). Variant text (the lookout, wash, night raid, a drink for strangers) is shown on screen over the base narration; a
variant clip is a GPU job (not made).

## Edited openings: coverage on the five pages every path crosses (2026-11-11)

Player goal: the opening reads as cut film, not one shot per page. `start`, `flats`, `mesa`, `family` and `wash` each list
`shots` (the build lays them end to end, never looped): a **wide** that establishes, a **close-up** that acts the beat, then
the page's original shot last.

| Page | 1. wide | 2. close-up | 3. original |
| --- | --- | --- | --- |
| `start` | the wagon train in dawn haze, the dove in the foreground | the rider's hand resting on the unfired revolver | dove branch, rack focus to the train |
| `flats` | six wagons on the white salt, one tilted on a cracked wheel | the rider's face and the flask he doesn't drink | the tilted wagon, the rider looks up |
| `mesa` | the caravan under the mesa, the glint | the hand on the holster grip, thumb on the hammer | rider slows and looks up |
| `family` | the family in the broken wagon's shade, the caravan behind | the trail boss's measuring look (the girl drinks on the next page, `giveFlask`) | the little girl looks up |
| `wash` | the dry wash, five riders blocking it | the riders' leader's face | the dove skims over the riders |

Characters are cast from their sheets (`hero`, `boss`, `leader`, `family`, `dove`): same faces and clothes as every other shot.
**Status:** data only. None of the ten new clips is made (no GPU approved); the cut skips a shot that isn't made, with a
warning, so nothing changes for the viewer until they are. To make them: `studio.cmd assets imaginelivetv make` (10 keyframes
x 3 candidates, 10 `video.i2v`). Shot order in the file is play order, so the original shot is now `clip-3.mp4`, not `clip.mp4`:
remake it with the others (or rename its files) before the cut is rebuilt.
