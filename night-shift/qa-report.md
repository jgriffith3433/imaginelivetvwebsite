# Night Shift room art: QA report (2026-10-27)

`npm run test:room-art` is green. Numbers from `node tools/room-art.mjs --write`:

- 32 pose layers checked (one blob, no holes or chunks, off the frame edge, area, solidity >= 0.50, on the stage mark): 0 failures after re-baking all 36 poses.
- 256 scenes played through the real room code: 3,183 states, **80 unique frames** (`night-shift/qa/frames.json`, scored; `storyboard.html` sorts by it).
- Presence: 0 failures. The check first found 21 real lines where someone speaks while not in the room (Terrell and Marisol on tiles, Dee and Pierce and Adler before their entry, Okafor "from the door", Terrell leaving). Fixed by `enter`/`gone` beats or marked `"offstage": true`; no story text, voice or choice changed.
- Registration: only 5 pairs of one person's layers register; every other change (273 of 274 in the story) is a dip through the plate, not a cross-fade.
- 6 permanent fixtures in `tests/room-art-known-defects.json` (checked against the old layers: they fail there).

Looked at with the contact sheets: seated figures now have the whole chair, Mr. Okafor keeps his bag and tablet, people black over the big screen.

## Not fixed / still wrong
- Layers are silhouettes cut from stills the edit made, so a pose can still look stiff; I read sheets 1-3 of 7, not all.
- `trainee-sit` reads as sitting tall at the left chair; it is consistent (the trainee always sits left) but it is the weakest seated pose.
- Terrell, Marisol and Dev have one standing layer: leaving shows them standing, then gone (no door-walk pose).
- Phone/radio lines with nobody in the room (136) show no handset or radio prop: not made.
- Dee knocking is her charger pose; no separate knock layer.
- Z-order: the `room` playtest checks DOM order only (no pixel sample); not run in a browser here.
- Part D (24 poses, phone off the hook, cup, sandwich, laptop, binder open, 4 vs 3 radios, elevator car three, corridors 44/40) is NOT made: see `.hawkes/pending-gpu.txt`.
- Spent: $0.0054 of the $3 (two SAM chair segmentations, j_01972afa1db5, j_4a947869e03a). Stills were fetched with the free `image.transform`.
