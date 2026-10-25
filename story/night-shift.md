# Night Shift — story doc

**Listed on the landing page** (since #35; J's open questions are under "Waiting for J" at the end). The whole night is built as a
console story in `story/night-shift.json` (see "The built night" below): it plays at `/?story=night-shift`, its pages are under
`/night-shift/`. **The script is final** (2026-10-25: the text pass, then the script pass that fixed the gap audit's group (c), see
`story/night-shift-gaps.md`). All 1,330 lines are recorded in the locked voices, the beds and effects are made, the camera pictures and
end cards are real; only the 6 music stings are not made yet. A text change costs a new recording for each changed line (about 2.5 cents):
edit `story/night-shift.json`, run `npm run story`, then `node tools/make-audio.mjs night-shift --reuse` (every line whose voice and text
already have a recording keeps it, even when it moved) and make only the lines it lists.

## The idea

A rookie security officer works their first week of nights in a Manhattan office tower, with a trainer who has
done this job for twenty-six years. Nothing happens, and then small things do: a badge that fails, a propped
door, a light on a panel, a laptop on a bench. **You win by doing the job well and being decent to the person
teaching it to you. Nobody is a hero.** There are no monsters, no fights and no guns. The worst thing that
happens on a good night is paperwork.

- **Title:** *Night Shift*
- **Tagline:** *Say what you see.* (Not "Observe and report": nobody says that except as a flat quotation of the post orders.)
- **Logline** (its card): *Your first week of nights in a Manhattan tower. Nine cameras of nothing, one trainer
  who knows every door, and a report with your name on it.*
- **Tap to play:** *NIGHT SHIFT*, "Sound on. Radio check."

**It is a different night from PH Origins.** Same building, same company, another night and another floor of the
building's life. Nothing here is secret, strange or hidden: the story stays on the floors a guard walks, from the street entrance
and loading dock up to the roof door. See "Canon this must keep".

**The night.** A Wednesday in the middle of February, 18:45 to 07:00 (fourteen degrees in the vestibule at 04:45). The notice in the drawer
takes effect on the first of April. Dee's next shift is Thursday night, "tonight" by the time the story ends. Tuesday is the day before:
Terrell's birthday, the man in the vestibule, the air-handler man's last visit.

## 1. What the job is

*One page. Grounded in how the work is really done. Items marked **(unverified)** came from the research notes or
from general knowledge and were not checked against a primary source; check before a line leans on them.*

### The post

A night-shift security officer in a Manhattan commercial tower sits in or near the **control room** (the "wall" of
monitors, the fire panel, the access-control terminal, the radio charger, the log) and walks **tours**. The
officer **observes and reports**. They do not chase, restrain or investigate. Their power is a phone, a radio, a
flashlight, a clipboard and the right to say "I'll need to see your badge." The skill is noticing, writing it down
plainly and telling the right person.

### The paper

- **The Daily Activity Report (DAR)** is the shift's record: time, place, what was seen, who was told. It is
  written in **facts, in time order, in the past tense**. "0214 hrs. Stairwell C, 31st floor. Door propped open
  with a rubber wedge. Removed wedge, door secured. Supervisor notified 0216." Not "Someone was being lazy and
  propped the door." Opinions, guesses and adjectives get a rookie corrected, or a tenant's complaint on a
  supervisor's desk. A log entry is read later by people who weren't there, sometimes by a lawyer.
- **The post orders** are the building's rules in a binder (who may enter, which doors, what to do for which
  alarm, whom to call). The trainer's habits are older than the post orders; they don't always match. That gap is
  the story's central pressure ("trust in the trainer versus the post orders").
- **Visitor and contractor sign-in:** name, company, who they are seeing, the floor, time in, time out. ID looked
  at, not just glanced at. After hours, a tenant must have **pre-authorized** the visitor (an email or a call-up
  from the tenant); no authorization, no entry, however nice they are.
- **Badge and access rules:** one badge, one person. A failed badge is not a reason to open the door; it is a
  reason to check the list. Badges don't get lent. Nobody's badge works on a floor that isn't theirs after hours
  without a tenant's say-so.

### The rounds

- **Guard tours:** a route of checkpoints (stairwells, loading dock, roof door, mechanical rooms, floor
  corridors), walked on a schedule, each logged at the time. A tour is **not** skipped because nothing ever
  happens; that's the reason it exists. **(unverified: some buildings use tour wands/checkpoint readers; this one
  uses a paper tour sheet and a tablet.)**
- **Radio checks:** control checks each officer on the hour and half hour. Silence is an incident. Forgetting to
  answer, or forgetting to call control before leaving the wall, is the classic rookie sin.
- **Never leave the wall unattended** without telling control: someone must see the cameras and answer the phone.

### The chain

**Supervisor → building manager → 911**, in that order unless life is at risk, in which case 911 first and
everyone else after. The officer does not decide what is "serious enough" for the building manager at 3am; the
supervisor does, and the post orders list what the supervisor must be told. Under-reacting and over-reacting both
get written up.

### Fire

The **fire panel** and the fire plan belong to the **certified fire safety director (FSD)**, a licensed person
named in the building's fire safety plan, not to the guard. A guard who sees a **trouble signal** (a fault, not a
fire) at 3am reports it to the FSD and the supervisor, logs the panel's exact words and **does not silence or reset
the panel**. **(unverified: in New York City the FSD is certified by the FDNY and a high-rise has a fire safety
plan with named directors; the exact rule for who may acknowledge a trouble signal varies by building.)**

### Training

New York State requires **8 hours of pre-assignment training** and **16 hours of on-the-job training within 90
days** of hire (the "8-hour" and "16-hour" courses). **(Figures from J's research notes; the registration process
and card details not checked.)** In practice the "on-the-job" part is a senior officer who lets the rookie sit
next to them for weeks. That's the trainer. The rookie is on probation by the quality of the trainer's report.
**(unverified: whether the union contract adds its own probation. Many NYC office guards are represented by 32BJ
SEIU, per the notes; the story never names the union, it only says "the union" once.)**

### The people the guard meets at night

**Cleaning crews** (they have the run of every floor from about 6pm; their badges and their breaks are the most
common source of small incidents), **late-working tenants** (lawyers, traders, an analyst the night before a
deal), **contractors** (HVAC, elevator techs, a delivery to an empty floor), and **people who aren't supposed to
be there** (a sleeper in the vestibule, someone behind someone). **Tailgating** (walking in behind a badge) is the
oldest problem. It looks like politeness.

### What actually happens

Almost nothing, for hours. **The dead zone is 2 to 5am:** the tours are done, the tenants have gone, the phones
stop, the cameras show the same empty lobby and the body wants to sleep. Most mistakes are made there, half
asleep, by being too kind, too lazy or too sure. The typical incidents are small: a cleaner's badge that fails, a
stairwell door propped by a wedge, a trouble light on the fire panel, a stuck elevator with someone on the
intercom, a water leak, a laptop on a lobby bench, a delivery at 4am to a floor that has no one on it, a person
asleep in the vestibule, a camera that goes offline.

**Typical rookie mistakes:** writing opinions instead of facts; waving through a friendly face; forgetting a radio
check; leaving the wall without telling control; over-reacting (calling 911 for a wedge) or under-reacting
(ignoring a trouble light); lying in the log to cover a small mistake (the worst one).

### What fiction gets wrong

Guards don't chase, fight or draw weapons; most are unarmed, and in an office tower the best guard is the one
whose night is boring. Nothing is "solved" in a night. The mystery is a coincidence. The tension is boredom,
tiredness, small kindness against small rules. Guards are not stupid, not secretly cops, not secretly heroes. They
are people with bills.

## 2. The building bible

### Hawkes Tower

**Hawkes Tower, 1000 Madison Avenue, New York.** (Canon: HQ of Hawkes Biomedical.) Offices; the Chairman's floor
is the **58th**, with the boardroom (the Apex Peak). The company has a capital and investor-relations desk in
**Zurich** (so a call from Zurich can come at 3am New York time: that is the night's one international detail).
Many floors are other tenants. The elevator panel is not detailed here: the story only goes to **the floors a guard
goes to**, from the lobby and loading dock up to the roof.

The **Board** (canon): **Director Hale, Voss and Lang. No first names. Ever.** Hale (she) watches the quarter and
the valuation; Voss (he) keeps the charter; Lang keeps the date Zurich wants. They appear in this story only as
**names in the log and on the after-hours list**: a note that "Director Hale's office" has a late authorization,
that "Lang" is on a call with Zurich. Nobody sees them.

**Pierce Hawkes** (Chairman) appears **once**, in a short cameo (below).

### The control room

A windowless room behind the lobby desk: **the wall** (nine camera feeds on two monitors, each in a numbered
tile), the **fire panel** (belongs to the FSD), the **access-control terminal** (badge events and the after-hours
authorization list), the **radio charger** (four radios), the **log** (tablet + a paper tour sheet), a **coffee
machine that is wrong**, a **mini-fridge**, one chair that is good and one that is the trainer's. The **post orders
binder** sits on the shelf with a fire extinguisher. The clock on the wall runs two minutes fast. (The trainer
keeps it that way.) A door to the lobby, a door to the corridor. The room is the player's home base: every
incident comes through the wall or the radio.

### The nine cameras

*What each sees, and which events happen there. The player sees tiles on the wall; a "noticed" flag is set by
looking at the tile at the right time or by the trainer pointing it out.*

| # | Camera | What it sees | Events there |
| --- | --- | --- | --- |
| C1 | **Lobby** | The desk, the turnstiles, the revolving door, the long bench by the window. | The laptop on the bench (E3); the 4am delivery; the day supervisor's morning arrival; the person who walks in behind a badge (tailgating). |
| C2 | **Vestibule / Madison Ave entrance** | The airlock between the street and the lobby, one bench-like ledge. | A person asleep in the vestibule (E5); the cold. |
| C3 | **Loading dock** | The rollup door, the dock office, a trash compactor, the service corridor door. | The delivery; the cleaning crew's trash run; the quiet dead zone. |
| C4 | **Stairwell C, 31st floor landing** | A fire door, a landing, a painted number. | The wedge in the door (E2). |
| C5 | **Elevator lobby, floor 31** | Four cars, a call panel, a plant. | The stuck car and the intercom (E4); the cleaning crew's cart; the late tenant leaving. |
| C6 | **Floor 44 corridor (cleaning crew floor)** | A long corridor and a janitor's closet door. | The cleaner's failed badge (E1); the leak (E6) under the closet door. |
| C7 | **Floor 58 reception** | The chairman's glass doors, a low light, a security desk nobody sits at. | The after-hours authorization for a Board office; the Chairman's brief cameo. |
| C8 | **Roof door** | A steel door with a push bar, a sign, a light. | The 3am roof-door tour; the roof-door sensor that "goes quiet." |
| C9 | **Mechanical / fire command alcove, floor 2** | The fire panel's repeater and a cabinet. | The trouble signal (E7); the fire safety director's visit; **the camera that goes offline** (E8) is this one: its feed freezes at 03:41. |

Nine cameras, nine tiles. C9's freeze is the night's unexplained thing, and it is explained: a loose network
cable, found by a technician at dawn. **Nothing is hiding; the point is whether the player writes "camera 9
offline" or "something is wrong with camera 9."**

### The events (what happens on a standard night)

| ID | Event | Camera | Plain description |
| --- | --- | --- | --- |
| E1 | The cleaner's badge fails | C6 | Marisol (cleaning lead) calls: a new crew member's badge doesn't open 44. The rule: not on the list, not in. |
| E2 | The wedge | C4 | A rubber wedge holds a stairwell fire door on 31. A tenant did it to smoke. |
| E3 | The laptop | C1 | A laptop and a lanyard on the lobby bench. Whose? |
| E4 | The stuck elevator | C5 | A car stops between 30 and 31; the intercom crackles with a late tenant, Dev. |
| E5 | The sleeper | C2 | A man asleep in the vestibule; it's 14°F. |
| E6 | The leak | C6 | Water under the janitor's closet door. |
| E7 | The trouble signal | C9 | The fire panel shows a trouble light: "TROUBLE – ZONE 31 / DETECTOR – OPEN CIRCUIT." |
| E8 | The camera goes offline | C9 | At 03:41 the tile freezes. |
| E9 | The 4am delivery | C3 / C1 | A courier with a box for floor 58, "for the Chairman's office." Nobody authorized it. |

Not every event happens on every playthrough: the state model decides which fire, in which order, and how
the player's earlier choices change who calls and how.

### The shift (the night, in time order)

| Time | What happens |
| --- | --- |
| 18:45 | **Handover.** The day supervisor, Mr. Okafor, walks the player and the trainer through the day's log (a visitor flagged, a contractor coming back, a leak on 44 "monitored"). He is leaving. |
| 19:00 | Day staff go; the lobby thins. The trainer shows the wall. First **radio check**. |
| 20:00 | First **tour** with the trainer: stairwells, dock, the roof door. The player learns the sign-in sheet. |
| 21:30 | Late tenants. The cleaning crew starts floors. E1 or E2 may fire. |
| 23:00 | Radio check. Delivery, tenants out. |
| 00:30 | The trainer eats. The player is on the wall alone for the first time (optional). |
| 01:30 | Tour. Zurich calls the 58th. |
| **02:00–05:00** | **The dead zone.** E3, E4, E5, E6, E7 and E8 come here, on a slow clock. The chairman's brief walk-through is at about 03:20. |
| 04:00 | E9 the delivery. |
| 05:30 | Light. The cleaning crew leaves. The player writes up the shift. |
| 06:30 | **Morning.** The day supervisor reads the log. How it is worded is how the story ends. |
| 07:00 | The trainer goes home, or doesn't. |

### Staff and tenants

- **Mr. Okafor** (day supervisor): the paper.
- **The trainer, Dolores "Dee" Reyes**: the heart of it (sheet below).
- **Terrell** (lobby/desk officer, the "front"): evenings until 23:00.
- **Marisol Quintero** (cleaning crew lead): floors 30 to 44.
- **Dev Anand** (late-working tenant, floor 31, associate at a law firm).
- **Ms. Adler** (fire safety director): comes if called, or is on the phone.
- **The courier** (a voice on the dock intercom).
- **The sleeper** (not a speaking character; he says one thing).
- **Pierce Hawkes** (cameo).
- **The tenant directory:** a law firm on 30 to 32; an insurance broker on 33 to 36; a design agency on 37; a
  hedge fund on 40; Hawkes Biomedical on 50 to 58; a dental practice on 12.

### The cameo: Pierce Hawkes

One short, in-character moment at ~03:20, on camera **C7** and in the lobby. The Chairman crosses the 58th-floor
reception in a coat, phone in hand, and the control room hears him on the elevator call. **The player may speak
to him once**, over the radio or in person in the lobby, and the officer decides how to word what they say. He is
the Pierce of PH Origins before the night of PH Origins: assured, short, a man who tells you what is true because
he said so. He says the building is his. He never explains why he is there.

> **PIERCE** *(to the guard, not stopping)*: Evening. Don't get up. Whatever's on that screen, it's yours.
>
> (If the player stands and asks him to sign in:) **PIERCE:** *(a pause, an actual smile)* Fair. Fifty-eight. I own it.
> Put that in your log.

**Rules for the cameo.** He is polite to the player; he is never menacing, never a monster, never alone with a
secret. He says nothing about the company's business, the Board or why he is there. He is not a plot
device, only the wall's biggest name walking past it. The player's choice (sign him in, or wave him through)
sets `waved_through_big_name`.

### Canon this must keep

- The Chairman is **Pierce Hawkes**, 58th floor, Hawkes Tower, 1000 Madison Avenue.
- The Board is **Director Hale, Voss, Lang**, no first names, never invented.
- Capital and investor relations are in **Zurich**.
- Public Hawkes signage never shows the company's restricted work. **This story shows nothing of it and hints at
  nothing: it is an ordinary night in an ordinary tower.**
- This is a different night from PH Origins; nothing here changes what happens in it.

## 3. The voice sheets

*Every speaking character. Voices are made through Hawkes Gen / ElevenLabs "voice design" with the description
given; the description is the whole recipe. The media is made from these descriptions (see "Voices as made").*

### Dolores "Dee" Reyes: the trainer (the heart of the story)

- **Age:** 58. Born in the Bronx; Puerto Rican father, Irish mother; the "Dee" is from her dad, who couldn't
  say Dolores when she was small.
- **Background and the real reason she's still doing this.** She was an NYPD school safety agent, then a court
  officer, then a guard at a bank branch, then this tower for **twenty-six years**. She is two years from a
  pension that needs sixty. Her husband, Ray, was a building engineer in the tower next door, and he died eleven
  years ago of a heart attack on a night shift, in a boiler room, alone, and nobody found him for **four hours**
  because the one guard on duty that night was away from his post. **That is the real reason she is still doing
  this job, on nights, and the reason she is strict about radio checks and about never leaving the wall:** she
  can't stop checking on strangers. She'd quit years ago if it paid for the apartment; it doesn't.
- **Habits:** Counts the radios when she walks in. Taps the wall twice with a knuckle before she sits. Eats the
  same sandwich at 00:30 (pepper and egg). Writes the log in pencil first. Calls everyone by last name until she
  decides she likes them. Hums, badly, when she is worried. Won't use the elevator in a power flicker.
- **Quirks:** Keeps the clock two minutes fast "so I'm never late for myself." Has a tour route she's walked so
  often that she walks it in the dark.
- **Contradictions:** She preaches the post orders and breaks them kindly (she lets the cleaners in on a vouched
  name; she lets the sleeper stay for twenty minutes before she calls). She says she hates the job and has not
  missed a night in eleven years. She says she doesn't care about the tenants and keeps a drawer of their
  birthdays.
- **What she avoids:** talking about Ray; the word "retire"; anyone being kind to her; the stairwell on 12.
- **What she wants from tonight:** a rookie who won't leave the wall. A clean report to the day supervisor that
  doesn't need her to lie. A good last-but-one week: she has quietly told no one that the building's contractor
  is **replacing the night shift with a remote-monitoring service in the spring**, and that her job is probably gone.
  She would like to leave somebody behind who does it right.
- **The secret:** She has been **writing her own log wrong for years on purpose**: when she goes to the 12th floor
  stairwell at 03:00 she logs "tour, no incident," because she sits on the landing for ten minutes and cries.
  She has never been written up for it because nobody reads the 03:00 line. If the player's report is read
  closely, her ten minutes show up in the camera log. (There is no camera on 12.) And the real secret under
  that: Ray is not the reason for the 12th floor. The 12th floor is **a dental practice that was his old shop**:
  the engineer's room was there before the tenants fit out. She is saying goodbye to a room that no longer exists.
- **How she talks.** Short sentences. Declaratives. Drops subjects ("Doesn't matter."). Trails off when she is
  about to say something true, then says something about coffee. Interrupts when the player is about to say a
  rule she already knows. Never apologizes; says "Mm." for "I'm sorry." Never gives a speech. Never says "I care,"
  "I'm scared," "I lost," "I'm proud."
- **What she never says:** "I've seen things." "Back in my day." "Kid." "Rookie" (she says "Officer," then, in
  time, the player's last name). "You'll understand someday." "Trust me." "I'm retiring."
- **Interruptions:** She cuts off the player mid-explanation of something obvious: "Mm-hm. Next."
- **ElevenLabs voice design:** *A woman in her late fifties, Bronx accent with a worn, low alto, dry and
  unhurried, a smoker's rasp from years ago. Speaks quietly and flatly, slight humor underneath. Recorded close
  and slightly dry, as if in a small room, with faint room tone; no performance polish.*
- **Sample lines:**
  - "Radio check." / "…Mm. You're a minute late."
  - "Write what you saw. Not what you think about what you saw."
  - "Sit. It's three o'clock. Nothing is going to happen at three o'clock. That's why we're here."
  - "Don't open it. Not for him. Not for the nice one. *Especially* for the nice one."
  - "My husband used to… Forget it. Eat something."
- **Reveal layers** (what the player learns, by how they have treated her, tracked by `trainer_trust` (0 to 3) and `trainer_warmth`
  (0 to 2); the first plan had 0 to 5 and was cut to what the build can prove). Each is a scene a way reaches, and one way meets them all
  (`node tools/check-night-shift.mjs` prints the shortest way to each and the one way through all of them):
  1. **The shell (any treatment).** `handover` on. She is competent, dry, a stickler. She says the job is "watching a wall." Facts only.
     Her habit: counting the radios.
  2. **The pencil (`sign-why`, `sign-why-44`: trust 2 or more at the sign-in, 21:30).** She admits she writes the log in pencil first
     because "once it's ink, it's true." She mentions a husband, once, in the past tense, and moves on (the sandwich, `sandwich-ray`, if the
     player asked about it). It comes back at 05:56 (`hours-sheet`): with trust 2 or more the player can hand her the pen, and she signs the
     training sheet in ink.
  3. **The four hours (`four-hours`, 02:58: warmth 2, the player never left the wall, and sat by her after the leak instead of asking about
     Ray).** She says the number, "four hours," and changes the subject to the clock. Ray, a boiler room, a guard who stepped out; she never
     says more.
  4. **Twelve (`twelve`, 05:24: the player checked her page against the roof door's record, caught the 03:00 line, and asked where she goes
     at three, trust 2 or more).** The 12th-floor landing: a dentist now, "there was a room. A bench. A kettle." The player can sit with her
     (`twelve-sat`, warmth) or give her the wall (`twelve-wall`, trust). The game never says which is right. Telling her they saw the door
     (`twelve-shut`) shuts it.
  5. **The spring (`drawer-notice`, 23:25: the player opened the shelf drawer).** The night shift is replaced in April. She tells nobody.
     At the morning the player can tell the day supervisor or say nothing: `end-she-knew` (close, told), `end-someone` (close, learned, said
     nothing), `end-under-review` (not close, told).
  - **Treated badly** (mocked, lied to in the log, skipped her radio checks, left the wall): she doesn't get angry. She gets *more* formal,
    calls the player "Officer" till morning, writes the report by the book and the book is cold. She keeps layers 3 to 5 to herself and the
    story does not give them back.

### Mr. Chidi Okafor: day supervisor

- **Age:** 46. Born in Queens to Nigerian parents; ex-Army (supply), then security for twenty years.
- **Background:** Promoted for his paperwork. Careful, tired, fair; dislikes surprises; never was a "floor"
  officer for long and knows it. He is the one who has to explain things to tenants and to the building manager.
- **How he talks:** Medium sentences, complete and polite, starting with "So." Says "Let's make sure we're
  aligned" when something has gone wrong. Reads logs out loud in a flat voice. Never raises it. Never says
  "unacceptable" or "I'm disappointed."
- **Never says:** "good job" (says "That's noted"); anything about feelings; anything about the trainer's past.
- **Interrupts** with a correction of a term ("Not 'guy.' 'Individual.'").
- **ElevenLabs voice design:** *A man in his mid-forties, American English with a faint New York and West African
  lilt, a clear baritone, steady, courteous, a little weary. Clean office-room recording, slight reverb, a
  phone-call quality in the "on the radio" version.*
- **Sample lines:** "So. Let's walk through the log." / "'He seemed nervous.' How did he seem nervous?" /
  "That's noted. Thank you." / "Dolores, a word. Not now."

### Terrell Banks: lobby / desk officer

- **Age:** 24. Brooklyn. Third year of a part-time criminal justice degree. On the desk until 23:00, then the
  night staff takes over. He is friendly to everyone and likes being liked.
- **Background:** Grew up two blocks from a corner store his uncle ran; learned names, not rules. The trainer's
  opposite and her warning example: he waves people through.
- **How he talks:** Quick, jokes, finishes people's sentences, trails off with "you know?" Never swears. Fast
  speech with run-ons.
- **Never says:** "No." He says "Let me see what I can do."
- **ElevenLabs voice design:** *A young man in his mid-twenties, Brooklyn accent, light tenor, warm and
  quick, smiling while he talks. Clean desk-mic recording with a little room noise.*
- **Sample lines:** "Hey, hey, you're good, he's with the, uh, the eighth floor, I think? You know?" / "Door's
  all you." / "I'll write it up. Probably. I'll write it."

### Marisol Quintero: cleaning-crew lead

- **Age:** 51. From the Dominican Republic, in New York for thirty years; leads a crew of six; speaks English
  and Spanish and moves between them mid-sentence.
- **Background:** Union (the notes say 32BJ; the story never names it beyond "the union"). She has trained forty
  people and brought half of them in on a vouched name. Her crew is her family; the new hire on 44 is her
  nephew. She knows the building better than the building manager.
- **How she talks:** Warm, fast and direct. Short bursts, orders and jokes. Swears in Spanish. Interrupts the
  player, not out of rudeness but because she has twelve things to do. Says "mi amor" to everyone except people
  she's angry at.
- **Never says:** "I'm sorry to bother you."
- **What she wants:** the nephew in, without a fight. The player's choice: let him in on her word (breaks the
  rule), call the supervisor (follows it) or find a third way (she has his paperwork in her bag).
- **ElevenLabs voice design:** *A woman in her early fifties, Dominican-American accent, rich mezzo, fast and
  expressive, warm with a flare of impatience. Slightly noisy room recording (a vacuum cleaner far away), radio
  quality on the walkie.*
- **Sample lines:** "Ay, mi amor, the badge, it doesn't open. It's new. He's new. He's with me." / "Forty-four.
  The closet's wet. *Wet.* You hear me?" / "Tell your boss nothing. Tell him tomorrow. Okay?"

### Dev Anand: late-working tenant

- **Age:** 29. Born in New Jersey to Indian parents; a junior associate at a law firm on 31. He is in the
  building at 3am because of a deal closing at nine.
- **Background:** Exhausted, polite, over-explains. Trapped in the stuck elevator between 30 and 31 for the
  intercom scene. His bad night is the player's good chance to be kind.
- **How he talks:** Overly polite and nervous, "sorry, sorry", runs sentences into each other, apologizes for
  everything. Talks more when scared. Never says what he's afraid of.
- **Never says:** "I'm claustrophobic" (he says "It's a little close in here.").
- **ElevenLabs voice design:** *A man in his late twenties, American accent, slightly nasal tenor, tired and
  polite, speech a bit rushed. Recorded on a phone-quality intercom with a tinny filter and a light hum.*
- **Sample lines:** "Hi, sorry, hi, I think the elevator, it, it stopped? Sorry." / "No, no, it's fine. It's
  fine. It's a little close in here." / "I have a closing at nine. Sorry. That's not your problem."

### Ms. Helen Adler: fire safety director (FSD)

- **Age:** 62. Retired from the fire department; certified FSD for the tower and two others.
- **Background:** Knows the fire plan, not the guards. Exact, courteous, short on patience for the word "I
  think." A phone voice in the night; appears at the panel at ~04:00 only if called.
- **How she talks:** Formal, one idea at a time, in complete sentences. Asks for the **exact** wording on the
  panel and repeats it back. Says "Do not touch the panel" the way a doctor says "Don't scratch it."
- **Never says:** "Probably." Never raises her voice.
- **ElevenLabs voice design:** *A woman in her early sixties, crisp New York accent, low alto, formal and calm,
  slight gravel. Close, clean phone-call recording.*
- **Sample lines:** "Read me the display. Exactly. Do not paraphrase." / "Do not silence it. Do not reset it."
  / "Thank you. That is the correct answer. Please put it in the log in the same words."

### Mr. Brandt: tenant on forty

- **Age:** early forties. A hedge fund on forty, awake for a call with Singapore at four. Five lines in the whole night: the call about the
  cold (02:46), "Great. Thanks. I'll be here.", and, if the player goes up, "Oh. Hi. It's cold."
- **How he talks:** Brisk, fast, a little entitled and a little tired. Gives his name and his floor first. Says "Great. Thanks." when told
  nothing will happen. Never rude, never loud.
- **Never says:** please, or sorry.
- **ElevenLabs voice design (as made):** *A man in his early forties, brisk Manhattan voice, a little entitled and a little tired, speaking
  fast into a speakerphone in a big quiet room. Clean phone recording.*
- **Sample lines:** "Hi, Brandt, forty. It's sixty-one degrees up here." / "Great. Thanks. I'll be here."

### The courier (the dock intercom)

- **Age:** ~35. A tired delivery driver. A voice on a crackling intercom. Bored, polite, wants a signature.
- **How he talks:** "Hey, I got a thing for, uh, fifty-eight. Gotta get it to a person." Short, flat, repeated.
- **ElevenLabs voice design:** *A man in his thirties, neutral New York accent, flat and tired, recorded through a
  cheap dock intercom, tinny and clipped.*
- **Sample lines:** "Package for fifty-eight." / "It says someone's expecting it." / "I just need a signature, man."

### The sleeper (one line)

- **Age:** unknown, fifties. A man asleep on the vestibule ledge in a worn coat. Says one thing when woken:
  "I'm going. I'm going." (Or, if the player is kind: "Is it still cold out?") ElevenLabs: *A man in his fifties,
  hoarse, soft, a gravelly mumble, recorded through the vestibule's glass, muffled.*

### Pierce Hawkes (the cameo)

- **Age:** 50s. Calm, polished, absolute. In PH Origins before the night of PH Origins.
- **How he talks:** Short declaratives. Doesn't ask. Tells you the answer and then, once, listens.
- **Never says:** anything about the company's business or what he is doing at the tower.
- **ElevenLabs voice design:** *Use PH Origins' Pierce voice (the Jackson voice used in that game; do not
  redesign), unmodified.* The line is mixed lightly as if heard from across a lobby.
- **Sample lines:** "Evening. Don't get up." / "Fair. Fifty-eight. I own it. Put that in your log."

## 4. Dialogue style guide

**Voice of the page.** Second person, present tense, very short. A page is one or two sentences of what happens,
then the speaker, then the question. The grammar of a log, not of a movie. Plain words. A little dry. **No office
or work jokes in the narration** (that is Sick Of It's rule, but the same discipline: the humor here is human, not
about the work).

**Banned patterns.**

- No *"I've seen things."* No *"In my twenty years…"* as an opener to a lesson. No "back in my day."
- **No tidy speeches.** Nobody explains the meaning of the night. Nobody sums up. A character's longest line is
  three short sentences.
- **No stating feelings outright.** Nobody says "I'm scared," "I miss him," "I'm proud of you," "I'm lonely." The
  feeling is in what is changed, skipped, asked about or refused: the sandwich, the clock, the fourth hour.
- **No scene ending on a moral.** Scenes end on an object or an action: the radio, the pencil, the door, the
  next page's clock.
- **No movie-cliché heroics.** Nobody draws, chases, tackles, defuses, hacks, or decodes. No "stay here, I'll
  handle it." No slow-motion near the stairwell. No villain.
- No one says "observe and report" except as a **flat quotation of the post orders**.
- No exposition dumps between two people who both know the thing. If both know it, nobody says it.
- No therapy language. No "boundaries," "process," "closure."

**What to do instead.**

- **People interrupt.** Dee cuts the player off with "Mm-hm. Next." Marisol talks over everyone. Terrell
  finishes your sentence wrong. Dev starts again after he is cut off.
- **People trail off,** with "…" only where the character would really stop, then change the subject to
  something physical (coffee, the clock).
- **Don't explain what both already know.** "Radio check." / "Mm. A minute late." That's the whole scene.
- **Silence is a line.** A page may be only: *The tile for camera 9 doesn't change. Nobody says anything.*
- **Specifics over adjectives.** The time, the floor, the exact words on the panel.
- **Each line is written for its voice.** Test: cover the name; you should still know who is talking.
- **Humor** is people being people ("The coffee machine is wrong."), never a joke about the job.
- **Length.** A choice is two to six words ("Log it exactly", "Call Dolores"). A line is short: narration at most 42 words, a speech at most
  32 and three sentences. A page is six or seven lines, up to twelve where it is one whole exchange (Terrell's goodbye, the handover), and never
  more than about 170 words. `tools/check-night-shift.mjs` holds all of it, and runs the banned patterns over every title, log entry and ending name too.
- **A page may not name what only some ways have.** The engine has no conditional lines, so a scene that many ways reach (Mr. Okafor reading the
  log, an ending) says only what every one of those ways did: "Seemed." "Probably." are in every opinion log; "a contractor on forty" is not. Every
  ending opens on a narrator line that puts the room and the time first (07:02, who is at the desk), then the speakers.

## 5. The ending map

*Three axes, each three-valued:*

- **Competence (C):** `solid` (the log is factual, nothing missed, the chain was followed), `shaky` (small misses),
  `failed` (something important was missed or lied about).
- **Relationship with the trainer (T):** `close` (reached layer 3+), `correct` (layers 1–2, a working
  relationship), `cold` (treated badly or never opened up).
- **What the player learned about the building (B):** `learned` (noticed the wedge, the camera-9 freeze, the
  2am pattern and the 12th-floor line), `partial`, `blind` (the player never looked).

Each ending is a morning scene at 07:00 with the day supervisor reading the log, then the next sentence of the player's life.
Twelve are built (the first plan had nine; Eat something, Noted and Under review came with the build). The table is what the build
resolves; "The built night" below has the exact rules.

| # | Ending (scene) | C | T | B | Why it exists |
| --- | --- | --- | --- | --- | --- |
| 1 | **Clean report** (`end-clean`) | solid | correct | any | The "good" baseline: a boring, correct night. It proves the job is done by being unremarkable. |
| 2 | **Someone to leave it to** (`end-someone`) | solid | close | learned | The best ending: Dee's spring news, the pencil, the 12th floor. She hands over the pencil. The player read the notice and said nothing. |
| 3 | **She knew** (`end-she-knew`) | solid | close | any | The player *also* told Okafor about the notice: Dee is angry, in her way, for one day, and then isn't. The player can trade a secret for a rule, and the story lets them. |
| 4 | **Eat something** (`end-eat-something`) | solid | close | not learned, or no notice | The quiet good ending: she hands over the sandwich, not the pencil. |
| 5 | **By the book, alone** (`end-by-the-book`) | solid | cold | any | Competent and lonely: the report is perfect and the trainer hands in a one-line evaluation. Rules without people is a kind of failure. |
| 6 | **Under review** (`end-under-review`) | solid | not close | any | The player told Okafor about the notice without being trusted with it. Dee hears it from him, and leaves by the dock. |
| 7 | **The friendly one** (`end-friendly`) | shaky | close | any | The player is liked, Dee covers for a mistake, the cost is hers and the player doesn't see it until the log is read. |
| 8 | **Opinions** (`end-opinions`) | shaky | correct or cold | any | The log says "seemed", "probably". Okafor corrects every line. No catastrophe, a lesson by red pen. |
| 9 | **Noted** (`end-noted`) | shaky | correct or cold | any | Rule slips only: a contractor, a box, a call. It was in the log, in the player's hand, so it is only a conversation. |
| 10 | **Four minutes** (`end-four-hours`) | failed | close or correct | any | The player left the wall without telling control. Four minutes; Dee hears the number Ray had. She says nothing. (Renamed from "The four hours": that name is Dee's layer 3, the opposite behaviour.) |
| 11 | **The wedge** (`end-wedge`) | failed | close or correct | any | The stairwell door stayed propped or the trouble light was never reported; nobody was hurt; a near miss that cost the player the benefit of the doubt. |
| 12 | **Written up** (`end-written-up`) | failed | cold, or a lie | any | The player lied in the log, or left the wall and Dee had stopped trusting them; the player is let go at the end of the 90 days. |

*The acceptance bar is eight or more. 2, 3 and 6 are the three "spring" endings (the player read the notice); 12 is the punishment; the
rest are in-between and honest.* No ending has a moral line. Each ends on an object: a radio, a pencil, a foil, a drawer.

## 6. The state model

The first plan (nine `noticed_*` flags, `log_*` values, six meters) was cut to what the build can prove. **"The built night" below is the model**;
the axes (C, T, B) and the ending table in section 5 still describe what each ending means.

## The built night

`story/night-shift.json`: 241 scenes, 1,330 spoken lines, 12 endings. The first act (18:45 to 22:05) is the slice
(`story/night-shift-slice-notes.md`, kept as history), moved into the engine's format: the engine has no conditional lines, so a line
that read a flag now sits in a short scene that follows the choice. Playing time (words at 150 a minute plus a pause per line, the
build's own `dur`; the voices will move it, usually longer): `node tools/check-night-shift.mjs` prints the shortest, the average (every
open choice equally likely) and the longest. Now (from the recordings): shortest 38.6 minutes, average 44.7, longest 53.3.

**Acts.** 1: handover, the wall, the first tour, the sign-in, Marisol and the badge, the first log entry (to 22:05). 2: Terrell's last
hour, a man behind a badge, the first time alone on the wall, Dee covering tile five, the night-line call, the sandwich and the index
cards, the late list (to 01:35). 3: the wedge on 31, the laptop, Marisol's coffee and the water on 44, Dee up to the roof door, the lights
dipping, the stuck car, the Chairman, camera nine, the panel, Dev signing out, the box for fifty-eight, the humming, the man on the ledge,
Dee's page and the twelfth floor (to 05:30). 4: the day officer's failed badge, Marisol's plate, the log review, Dee signing the hours sheet, the
closing line, the handover ritual, the day supervisor's reading (one of six), the ending.

**Added in the script pass (2026-10-25), all on the way every player takes:** `zurich-call` and `zurich-radio` (01:42: a caller from Zurich asks
for fifty-eight; the guard takes a number, reads her the list, which is a slip, or radios Dee, who says number and name only); `day-officer`,
`day-officer-list`, `day-officer-let` (05:32: his badge fails in the cold; list first, or let him in, which is a slip); `hours-sheet`,
`hours-ink`, `hours-pencil`, `hours-refused` (05:56: the payoff of "Dolores signs your hours" and of the pen or the pencil at nine o'clock: she
initials in ink if she trusts the player and is handed the pen, in pencil if handed the pencil, in pencil and says "Not that one" if she does
not trust them); `prep-cup`, `prep-radios`, `prep-drawer`, `prep-drawer-knew` (06:12: what the last twenty minutes' three buttons actually do,
which used to be a meter the player never saw). They are at the end of `scenes`: the unlocks cookie is a bit per scene, in order.

**The state model as built** (smaller than section 6, so the build can prove it: `npm run story` explores every state, about 250,000, under
`stateCap` 300,000). Meters: `trainer_trust` 0-3 (starts 1), `trainer_warmth` 0-2, `building_known` 0-2 (what the player noticed:
almost all of it in the dead zone, plus the drawer and the list), `slips` 0-2 (rule breaks and radio misses; the third slip is not counted).
Flags that last: `left_wall` (set when the player steps off the wall, cleared by telling Dee first), `lied` (cleared by a correction),
`wedge_open`, `trouble_open` (cleared by reporting late), `noticed_notice`, `opined` (an opinion or a blank in a log entry; cleared by a
rewrite), `read_p11` (read page eleven at the handover, 18:52: it is why "Call Ms. Adler" is on the panel's page at 03:58; without it the
player is told by Mr. Okafor). Short-lived: `asked_44`, `asked_sandwich`, `met_dev`, `noticed_12th`, `lobby_clear` (watched the lobby at
01:50, so the bench can be called clear when the laptop turns up). A DAR (log) moment has up to four wordings: fact, opinion ("seemed",
"probably"), blank, and where it tempts, a lie; the choice's `log` is the entry in the shift log.

**Every choice changes something.** A button with other buttons beside it either moves a flag or a meter, or it goes straight to an ending.
Three kinds of button do not look like decisions and are not meant to be:

- **A press to go on** ("Back to the wall", "Take your seat", "Say nothing"): the only choice the scene has. It writes a shift-log line and opens
  the next scene. 46 of 241 scenes are like this, and each follows a scene that ended on an object or a silence.
- **A gated variant** (the same words four or seven times, "Hand him the tablet", "Answer the phone"): the state picks which one is on the page, so
  the player sees one button. It stands for something the player already decided (what they logged, whether they left the wall); the decision was
  made at the log entry, and the reading scene it opens says only what every way to it has in its log.
- **A log-wording choice** ("Log it exactly", "Add what you thought", "Leave it out", "Write that ..."): all four go to the same next scene, and
  the next scene's first line is Dee's reaction to the one that was chosen. Each sets `opined` or `lied` or adds trust, and each has its own log entry.
The curious ones in the first act spend trust or warmth (the latch, the lock, the compactor, the roof), none of them building knowledge.
`tools/check-night-shift.mjs` fails the build on a decision that changes neither in any state it can be made in.

**Axes at 06:30.** C: *failed* if `left_wall`, `lied`, `wedge_open` or `trouble_open`; *solid* if none of those, no `opined`, and at
most one slip; else *shaky*. T: *close* if trust 3 and warmth 2; *cold* if trust 1 or less; else *correct*. B: *learned* if
`building_known` is 2. The morning picks one of six readings by C (solid, opinions, rule slips, wall left, life safety left, a lie), then
the ending. A player who read the drawer notice has two buttons in the solid reading (tell Mr. Okafor, or say nothing); the others have one.

| Ending | C | T | Also |
| --- | --- | --- | --- |
| Clean report | solid | correct (trust 2, or trust 3 and warmth under 2) | said nothing, or no notice |
| Someone to leave it to | solid | close | read the notice, said nothing, learned |
| She knew | solid | close | told Okafor about the notice |
| Eat something | solid | close | no notice, or said nothing and not learned |
| By the book, alone | solid | cold | said nothing, or no notice |
| Under review | solid | cold or correct | told Okafor about the notice |
| The friendly one | shaky | close | |
| Opinions | shaky | correct or cold | `opined` |
| Noted | shaky | correct or cold | slips only |
| Four minutes | failed | close or correct | `left_wall` |
| The wedge | failed | close or correct | `wedge_open` or `trouble_open` |
| Written up | failed | cold, or a lie | |

**Dee's layers.** See section 3: 1 the shell (always), 2 the pencil (`sign-why`), 3 the four hours (`four-hours`), 4 twelve (`twelve`, then
`twelve-sat` or `twelve-wall`), 5 the spring (`drawer-notice`, then the morning). Every one is reached by some way, and one way (about 77
choices) meets all five and ends on "Someone to leave it to".

**Trust against the post orders.** Every incident has Dee's way and the binder's: the badge on 44 (vouch or call), the wedge (she
says hello to the smoker, the book calls the supervisor), the panel (she presses silence, the book calls the director), the box
(she signs and tags, the book refuses), the man on the ledge (twenty minutes, the book says trespass). Her way raises trust; the
book's way raises nothing or costs a little, and the endings cost both ways.

**Pierce Hawkes** speaks in `coat-lobby` (one line) and, if the player stands and asks him to sign in, `pierce-signin` (one more).
Nothing in the night says B3, the vat or the creature (`unspoken` in the data; the build and the checker both refuse them).

## Waiting for J

- The title, tagline and logline. The tagline is now *Say what you see.* (the old one is a banned phrase); the logline says nine cameras.
- The tree itself is done: J has not read it. The script is final for voicing; changes after this cost new recordings.
- The look (a grounded live-action look? the same game-render look as The Water Road?) and the narrator.
- Whether Pierce's cameo uses PH Origins' voice as written.
- The music stings: 6 of them (`hawkesgen_estimate`: 61 GPU-seconds, about $0.08, $0.70 with the idle tail). Everything else is made.

Night Shift is listed already; anything J changes here after reading it costs new recordings.

## Voices as made (2026-10-25)

Designed with ElevenLabs voice design from the descriptions above (previews of about 30 s of each character's own kind
of line, candidate 1 of 3 kept; picked by the description, not by ear, so J may swap any), saved and locked in
`story/night-shift.json`: narrator `IFbrwI7VRvX2VkoD4Y3K`, Dee `qhe779QaY6YuY9d3VGab`, Okafor `Xxe1qCvSvBHFD7OTAz9I`,
Terrell `idZn18yShmcD0ePsg1A5`, Marisol `Iok0Qd1zNVnFs3DULx6Z`, Dev `zcQcgx11ALPbj0o2PFsw`, Ms. Adler
`QJ9eYeuXwMsC2KElXT1P`, the courier `cOJkIUDUojZtwaJSfMzy`, the man in the vestibule `YSWR6wrmdI2sOa3gtoye`, Mr. Brandt
`ZyVqOeng5wFOY7UfrjR9`, Pierce Hawkes `ZthjuvLPty3kTMaNKVKb` (PH Origins' Jackson voice, unmodified). The radio, walkie,
intercom and phone treatments in the descriptions are not applied yet (the recordings are clean).
All 1,288 lines are recorded and mixed (`node tools/make-audio.mjs night-shift --mix`, `--dur`); the 6 music stings are the only unmade audio.
