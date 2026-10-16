# Imagine Live TV website — agent notes

The site for **Imagine Live TV** (imaginelivetv.com), static on GitHub Pages. In the Hawkes Biomedical line
it is sold as *live medical education*. It hosts **The Final Spark**, a choose-your-path video story: you
wake in a sewer, found by a rat, and each choice is a page with a video (one folder per branch, e.g.
`you-turned-right/`), plus a blog. Planning notes and the decision tree are in `C:\Projects\TheFinalSpark`.
Local dev: `auto-start.bat` (http://localhost:8090). Publishing is pushing to `main`: ask J first.

## Generative AI: Hawkes Gen

Images, textures, video, 3D, music, voice, sound and Claude all go through **Hawkes Gen**
(`C:\Projects\hawkesgen`, dashboard http://127.0.0.1:8790; start it with `hawkesgen\auto-start.bat`). It holds
the API and AWS keys and runs the shared GPU fleet. This project never holds those keys.

- **Agents:** the `hawkesgen` MCP server is in this folder's `.mcp.json`. Use `hawkesgen_presets` (project
  `imaginelivetv`) for the art direction, then `hawkesgen_run`.
- **Command line:** `C:\Projects\hawkesgen\hawkesgen.cmd run - --project imaginelivetv --preset <name> --param prompt="..." --out <folder>`
- **Art direction:** `hawkesgen/presets/imaginelivetv.json` (style line and named presets). Edit it there.
- **Code:** copy `hawkesgen/clients/js/hawkesgen.mjs` into `tools/` and use `new HawkesGen({ project: 'imaginelivetv' })`.
- GPU tools cost money while a server runs. Ask J before starting servers or running big batches.

## Playtests

The site implements the Hawkes playtest contract v1 (spec: `C:\Projects\hawkesstudio\docs\playtest.md`), so the
daily runner in Hawkes Gen can play it. `js/hawkes-playtest.js` is a copy of the shared helper (source of truth:
`hawkesstudio/clients/web/hawkes-playtest.js`); the scenarios are in `js/playtest.js`, loaded by the home page only.
Nothing runs until the runner calls `window.hawkesPlaytest.start()` or the URL has `?playtest=<id>`.

Everything runs from the home page, so a run never has to survive a page load. The player (`js/game.js`) is on the
home page. Branch pages and blog posts open in a full-screen frame laid over it during the run, and the bot clicks
the links inside it, the way a viewer would. The frame is removed when the run ends, and the player's saved
progress cookie is put back.

| Scenario | What it does |
| --- | --- |
| `smoke` (~6 s) | Go back to the start (Tree tab, start node), the first video loads and plays 3 s, the choices show, one choice in, Back. |
| `branches` (~90 s) | Walks every scene of the player by clicking every choice and Back. Each video must load (readyState, duration) and play 2 s. Checks every scene is reachable, that non-ending scenes have choices, and that the opening matches `TheFinalSpark/Decision tree.txt` (the `TREE` table in `js/playtest.js`). |
| `pages` (~30 s) | The branch pages, one folder per branch (`BRANCH_FOLDERS` in `js/playtest.js`; add new folders there). Each page's video loads and plays, and each choice links to a page that exists. Reports dead ends and orphan pages. |
| `blog` (~5 s) | Opens every post card from the home page: the page exists, its images load, its videos play, its local links resolve. |

`js/game.js` exposes a read-only `window.finalSpark` (`scene()`, `scenes()`, `depth()`) for the bot. Try it:
open http://localhost:8090/?playtest=branches and, when it's done, run `hawkesPlaytest.report()` in the console.
If the browser blocks unmuted autoplay, the bot plays the video muted and logs an `autoplay-blocked` event.
