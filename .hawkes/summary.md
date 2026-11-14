Critic: first five minutes 2/10 (Play never pressed, 44 words in minute one).
Changed: Play is now the single large call to action. The hero's Play is a full-width 56 px light button on the first screen at 390x844, over the already-moving trailer. The hero picture is shorter on phones so Play sits above the fold. The word trimming from earlier passes is unchanged.
Files: css/site.css (end), js/playtest.js (frontDoorFit: logs `play-cta`, fails if the hero Play is under 52 px or off the first screen; covered by smoke/front-door).
Not done: autostarting the first scene behind the hero. Sound needs a press, so the first choice still takes Play plus Tap to play. No GPU used.
Checks: npm run story, npm run test:console (see exit status above in the log); no playtest run, per rules.
