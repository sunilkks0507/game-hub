# Huli Meke: Master Spec

## 0. MOST IMPORTANT RULES (read first, obey always)
1. This file is the single source of truth. Build only what it lists. If something is missing, ask. Do not guess.
2. Board geometry comes ONLY from Appendix A (`src/data/boards.json`). Never invent, move or "fix" points or lines.
3. Game rules come ONLY from section 7. Piece limits per board come ONLY from section 7.4. The UI must make an invalid setup impossible.
4. Look and feel: match `/design/huli-meke-mockups.html` and `DESIGN_SYSTEM.md`. Project accent is `#8C3B1E`.
5. Everything is free. No backend, no logins, no paid services, no secrets. Ask before adding anything that could cost money.
6. Work in small steps. Run the app after each step, then commit (`type: summary`).
7. Do not say "done" until every item in section 11 passes. Show the results.

## 1. THE GOAL (one sentence)
A free, offline-capable mobile web app (PWA, English) for the Karnataka tiger and goat game Huli Meke (also called Aadu Huli, Huli Gatta, Aane Kuri) where one or two players play on a choice of 11 boards with Standard, Mini or Custom piece counts, against a 3-level computer opponent, with tutorial, undo, hints and local stats, published on GitHub Pages and installable on Android.

Finish line: all of section 11 "Done means" passes for MVP, then for Production, and the live GitHub Pages URL works on a phone.

## 2. Success test
The project is a success when:
1. A new player can open the live URL on an Android phone, tap Play, choose Standard, Classic Triangle, vs Computer, Tiger, Medium, and play a full game to a result screen.
2. All 11 boards in Appendix A render and play correctly with the rules in section 7, in all three modes (where the board allows).
3. The app rejects every invalid piece setup (section 7.4) and the unit tests prove the rules (section 11).
4. After the first load the app works with no internet and can be installed to the home screen.

## 3. Users and context
- Who uses it: casual players, families and kids who know or want to learn the traditional game.
- Where: Android phone browser first (360px wide), then desktop browsers. Installable PWA.
- Market: India. Language: English only. The only non-English text is the decorative Kannada title ಹುಲಿ ಮೇಕೆ on the Home screen (system font).
- Needs login? No. Nothing is sent anywhere.
- Personal or payment data? None. Only game stats and two settings stay in the browser's local storage on the phone.

## 4. Scope
**MVP (build first):**
- All 9 screens in section 5 and the 19 mockup frames, working end to end.
- Rules engine (section 7) for all 11 boards, tested.
- Modes: Standard (3 tigers, 15 goats), Mini (1 tiger, 5 lambs), Custom (stepper plus presets) with board capacity limits.
- Opponent: vs Computer (Easy, Medium, Hard; side Tiger, Goat or Random) and Two players on one phone.
- Undo, Hint, Pause, Restart, Quit; Tutorial (5 steps); Stats; Settings (sound, hints, reset stats).
- Acceptance rule for each: behaves exactly as section 5 and section 7 describe.

**Production upgrade (build second):**
- PWA: manifest, icons (192 and 512 px, plus maskable), service worker, offline play, install prompt button on Home when the browser offers it.
- Loading, empty and error states on every screen (section 6.3).
- Accessibility: keyboard play, labels, focus outline, contrast 4.5:1, reduced motion.
- Performance: AI in a Web Worker, first load under 1 MB, board redraw under 16 ms.
- Privacy page `privacy.html`, README for handover, SEO and share tags, basic tests for core logic (already in MVP), GitHub Actions deploy.
- Optional (only if I ask later): Play Store wrapper.

**Not included (do not build):**
- Online multiplayer, accounts, leaderboards, ads, in-app purchases, analytics, push notifications.
- Saving or resuming a game in progress.
- Board editor, user-made boards, themes, languages other than English.
- Multi-jump chains for tigers.

## 5. UX flow
Visual source: `/design/huli-meke-mockups.html` (19 frames, each labelled). Build every frame.

Flow: Home -> Mode -> Board -> (Custom pieces, Custom mode only) -> Opponent -> Game -> Result -> (Play again -> Game) or Home.
Side links: Home -> How to play, Stats, Settings. Game -> Pause.

Screens:
1. **Home** (frame 1). Title art with Kannada title, Classic board preview with the 3 tigers on their start points, buttons: Play, How to play, Stats, Settings.
2. **Choose mode** (frame 2). Cards: Standard ("3 tigers vs 15 goats"), Mini ("1 tiger vs 5 lambs"), Custom. One selected (default Standard). Continue.
3. **Choose board** (frames 2b and 2b-ii). Two tabs: Full size and Mini. 3-column grid of board cards (small drawing, name, point count). Continue. Rules: Standard mode greys out and disables the Mini tab. Mini and Custom modes enable both tabs. Default selection: Classic Triangle (Full size tab); in Mini mode default tab is Mini and default board is Mini Triangle. Show the board's `name` and `points`.
4. **Custom pieces** (frame 2c, Custom mode only). Shows chosen board, preset pills (Standard 3/15, Pack 4/16, Hunt 2/20, Siege 6/25), steppers for Tigers, Goats, and "Tigers win at captures", an info card with the board capacity. Rules in section 7.4.
5. **Opponent** (frames 3a and 3b). Segmented control: vs Computer / Two players. vs Computer shows "You play as" (Tiger, Goat, Random) and Difficulty (Easy, Medium, Hard; default Medium). Two players shows the text "Pass the phone after each move. Goat player moves first." Start game.
6. **Game** (frames 4a to 4g, 5). See 5.1.
7. **Result** (frame 6). See 5.2.
8. **How to play** (frame 7). Five steps with Back, Next, Skip (see 5.3).
9. **Stats** (frame 8) and **Settings** (frame 9). See 5.4.

### 5.1 Game screen
- Top bar: title = mode name (Standard, Mini or Custom), action "Pause".
- HUD, three cards: Phase ("Setup", "Placing" or "Moving"); "Goats to place" (use "Lambs to place" in Mini mode); "Captured x / target".
- Turn line (centered, semibold). Texts: "Your turn: place a goat" / "Your turn: place a tiger" / "Your turn: move a tiger" / "Your turn: move a goat" / "Computer is thinking…" / two-player: "Goats: place a goat", "Tigers: move a tiger", etc. Use "lamb" in Mini mode.
- Board in a stone panel (colours in section 6). SVG built from `boards.json`.
- Buttons: Undo, Hint (secondary, 44px tall, equal width). Under the board a note or toast ("Tap a green spot to move or jump" when a piece is selected).
- Interaction: placing = tap a green-ringed empty point. Moving = tap own piece (thick green ring), then tap a green dashed spot; tapping another own piece changes the selection; tapping elsewhere clears it. Tap picks the NEAREST point within 24 board units of the tap (points can be close together).
- Legal spots show a dashed green ring. Capture removes the goat with a fade under 300 ms.
- Hint: highlights the suggested piece and target for 2 seconds. Disabled when Settings hints is off, or it is not the human's turn.
- Undo: vs Computer, removes the human's last move and the computer's reply together (nothing happens if there is no human move yet). Two players: removes the last move. Unlimited.
- Pause sheet (frame 5): Resume, Restart, Quit to Home (danger). Restart and Quit ask for confirmation ("Leave this game? Progress will be lost." Cancel / Leave).
- When the computer plays the goat side it places first, automatically.

### 5.2 Result screen
- Hero: "Tigers win!" / "Goats win!" / "Draw" ("Lambs win!" in Mini mode). Sub text: "All tigers are trapped" / "Tigers captured N goats" / "No capture in 80 moves".
- Card: Goats captured; Moves played (total plies, placements included); Mode ("Standard, Medium" or "Standard, Two players").
- Buttons: Play again (same settings, same board), Home.

### 5.3 How to play (5 steps, all on the Classic board with scripted positions)
1. Place goats: goats are placed one per turn on any empty point. Tigers start on the marked points.
2. Move goats: after all goats are placed, a goat steps one point along a line to an empty point.
3. Tiger moves: a tiger steps one point, or jumps over an adjacent goat to the empty point right behind it on the same line. A jump removes that goat. One goat per turn.
4. Tigers win by capturing enough goats (5 in Standard).
5. Goats win by trapping every tiger so none can move.
Each step: heading, 1 to 2 sentences, board picture (mockup frame 7 shows step 2). Skip goes Home.

### 5.4 Stats and Settings
- Stats: table Played and Won for rows Standard Tiger, Standard Goat, Mini Tiger, Mini Lamb, Custom Tiger, Custom Goat. Only finished vs Computer games count (a draw counts as played). Empty state: "No games yet. Play a game against the computer to see your stats." with a Play button. Footer text: "Stats are saved only on this phone."
- Settings: Sound (default on), Hints (default on), Reset stats (danger button, confirm dialog "Reset all stats? This cannot be undone." Cancel / Reset).

## 6. Visual design
- Mockups: `/design/huli-meke-mockups.html`. Match layout, spacing, copy and states.
- Tokens: `DESIGN_SYSTEM.md`. Project accent: `--primary: #8C3B1E`.
- Project-only tokens (add to `:root`): `--stone:#D9CBB0; --stone-dark:#B9A98A; --stone-line:#5A4630; --tiger:#C2410C; --goat:#F5F0E6;`.
- Board drawing: lines `#5A4630`, width 3, round caps. Empty point radius 8 fill `#B9A98A`. Piece radius 12 with 2.5 stroke `#5A4630`; tiger fill `--tiger` with white "T"; goat fill `--goat` with dark "G". Legal ring dashed `#16A34A` r12; selection ring solid `#16A34A` width 5. Stone panel: fill `--stone`, 2px `--stone-dark` border, 12px radius.
- Board size: fit the available width, max 360px, keep the board's aspect ratio from its `viewBox`.
- Animations under 300 ms. Respect "reduce motion" (no animation).
- Sound: synthesized with the Web Audio API (short beeps for place, move, capture, win, lose). No audio files, no downloads. Only after a user tap.
- Icons and logo: simple original SVG (tiger and goat silhouettes or the Classic board). No copyrighted images. No downloaded fonts.

### 6.3 States every screen handles
Loading (spinner or "Computer is thinking…"), empty (Stats), error with retry (boards.json fails to load), success (Result), offline (works after first load; show nothing special).

## 7. Content, data and RULES
### 7.1 Board data
- `src/data/boards.json` = Appendix A, copied EXACTLY. Each board has: `id`, `name`, `group` ("full" or "mini"), `points`, `capacity`, `viewBox` [w,h], `tigerStart` (ordered ids), `nodes` (id -> [x,y]) and `lines`.
- A **line** is an ordered list of point ids along one straight run (rings of the Wheel are drawn as many 2-point lines, so there are no jumps along rings).
- **Adjacent** points: two points that are consecutive in some line.
- **Jump**: tiger on `a`, goat on `b`, empty `c`, where `a,b,c` are three consecutive points of the same line (either direction). A jump never crosses a line break.
- Draw each line as straight segments between consecutive points. Draw points on top.

### 7.2 Game state
Occupancy map (point id -> "T" or "G"), goatsInHand, goatsCaptured, tigersToPlace, target, turn ("G" or "T"), phase ("setup", "placing", "moving"), pliesSinceCapture, move history (for undo).

### 7.3 Rules (exact)
1. **Setup.** Tigers: put the first N ids of `tigerStart` on the board, where N = number of tigers. If N is more than the length of `tigerStart`, the extra tigers are placed by the tiger player on any empty points BEFORE the first goat move (phase "setup", turn "T", one tiger per tap or AI choice). Goats start in hand.
2. **Turn order.** The goat player moves first. Then turns alternate.
3. **Goat turn, placing** (goatsInHand > 0): place one goat on any empty point.
4. **Goat turn, moving** (goatsInHand = 0): move one goat one step to an adjacent empty point. Goats never jump. Goats cannot move until ALL goats are placed.
5. **Tiger turn:** move one tiger one step to an adjacent empty point, OR jump (7.1) to capture exactly one goat. The jumped goat is removed, goatsCaptured +1. Tigers cannot jump tigers or empty points. No chain jumps. Capturing is never forced. Tigers may move from the very first tiger turn.
6. **Tiger win:** goatsCaptured >= target (immediately after a capture).
7. **Goat win:** at the start of a tiger turn, no tiger has any legal move (step or jump).
8. **Goat pass:** in the moving phase, if the goat player has no legal move, the goat turn is skipped.
9. **Draw:** in the moving phase, if 80 plies (moves by either side, passes included) pass without a capture. Constant `DRAW_PLIES = 80` in one config file.
10. Check order after every move: tiger win, then (if it is now the tiger turn) goat win, then draw.

### 7.4 Piece limits per board (the app must enforce these)
- **Capacity of a board** = `points - 3` (keeps at least 3 empty points). Stored in `boards.json` as `capacity`.
- A setup (tigers T, goats G) is valid only if: 1 <= T <= 6, 5 <= G <= 25, and T + G <= capacity of the chosen board.
- Modes:
  - Standard = 3 tigers, 15 goats (18 pieces). Valid only on boards with capacity >= 18, which is every Full-size board. Mini-group boards are disabled for Standard.
  - Mini = 1 tiger, 5 lambs (6 pieces). Valid on every board.
  - Custom = player chooses within the limits above.
- Presets (Custom screen): Standard 3/15, Pack 4/16, Hunt 2/20, Siege 6/25. A preset is enabled only if T + G <= capacity; otherwise show it greyed and not tappable.
- Steppers: the "+" button is disabled when it would break any limit. If the user changes the board after choosing pieces, clamp to the nearest valid values.
- Tigers win at captures (target): default `ceil(goats / 3)`; Standard = 5, Mini = 2. In Custom the user can change it from 1 to goats. When goats change, reset the target to the default.
- Capacity table (for tests):

| Board id | Points | Capacity |
|---|---|---|
| mini-square | 9 | 6 |
| mini-triangle | 10 | 7 |
| mini-wheel | 13 | 10 |
| mini-arrow | 15 | 12 |
| cross | 21 | 18 |
| arrow-triangle | 22 | 19 |
| classic | 23 | 20 |
| square-diagonals, square-plain, wheel | 25 | 22 |
| twin-triangles | 42 | 39 |

### 7.5 Computer opponent (runs in a Web Worker, never blocks the screen)
- Evaluation from the tigers' view: `100*captured + 4*(tiger legal moves) + 20*(available captures) - 60*(trapped tigers)`. Tiger win = +10000, goat win = -10000, draw = 0.
- Easy: random legal move; a tiger takes an available capture 60% of the time.
- Medium: minimax depth 2 with the evaluation above.
- Hard: alpha-beta with iterative deepening to depth 6, stop after 900 ms, captures first in move ordering.
- Ties are broken randomly. The computer waits at least 400 ms before moving so the player can follow.
- Hint = best move for the human's side using the Medium search.

### 7.6 Stored data (localStorage, nothing else)
- `hm_settings_v1`: `{ "sound": true, "hints": true }`.
- `hm_stats_v1`: `{ "standard-tiger": {"played":0,"won":0}, "standard-goat": {...}, "mini-tiger": {...}, "mini-goat": {...}, "custom-tiger": {...}, "custom-goat": {...} }`.
- Wrap every read and write in try/catch. If storage fails, the app still works with defaults.

## 8. Stack suggestion (Gemini makes the final decision)
- Suggested: plain HTML, CSS and JavaScript (ES modules), no framework, no build step. Static files in `/src`. SVG for boards. Web Worker for the AI. Service worker and web manifest for the PWA. Node built-in test runner (`node --test`) for unit tests. Reason: free, fastest to publish, simple handover.
- Suggested structure:
```
src/index.html  src/privacy.html  src/manifest.webmanifest  src/sw.js
src/css/styles.css
src/js/main.js (screens, navigation)  src/js/engine.js (pure rules, no DOM)
src/js/ai.js (+ worker wrapper)  src/js/board-view.js  src/js/storage.js  src/js/sound.js
src/data/boards.json
src/icons/ (192, 512, maskable)
tests/engine.test.js  tests/boards.test.js
```
- `engine.js` and `ai.js` must not touch the DOM so they can be tested in Node.
- Gemini must record the final stack in `DECISIONS.md` (3 lines) before coding.
- Free-tier limits to watch: GitHub Pages (1 GB site, 100 GB/month, public repo for free). Nothing else is used.

## 9. Build steps (phase 1: MVP)
1. Read this file, AGENTS.md, DESIGN_SYSTEM.md and the mockup. Write the 10-bullet plan. Wait for "go".
2. Set up the repo, folders, `.gitignore`, `.env.example` (empty, no secrets needed), `DECISIONS.md`, first commit. Tag nothing yet.
3. Create `src/data/boards.json` from Appendix A exactly. Write `tests/boards.test.js` (section 11 checks B1 to B6). Run. Commit.
4. Write `engine.js`: adjacency and jump tables from lines, state creation, legal moves, apply move, win, pass and draw, capacity and target helpers. Write `tests/engine.test.js` with the golden tests in section 11. Run until green. Commit.
5. Build the app shell and tokens (`index.html`, `styles.css`), Home screen and navigation between screens. Run. Commit.
6. Build `board-view.js`: draw any board from `boards.json`, pieces, legal rings, selection, nearest-point tap. Show all 11 boards on a temporary test page to check against the mockup. Remove the test page. Commit.
7. Build Mode, Board (tabs, greyed rules) and Custom pieces screens with the section 7.4 limits. Run. Commit.
8. Build Opponent and Game screens for Two players first (full rules, HUD, Undo, Pause, Result). Play a full game on three boards. Commit.
9. Build `ai.js` and the worker: Easy, Medium, Hard. Wire vs Computer, side choice, Hint, "Computer is thinking…". Test each level on Classic and on Twin Triangles. Commit.
10. Build Stats, Settings, How to play, sound. Commit.
11. Run the full "Done means: MVP" checklist (section 11). Fix. Tag `v0.1-mvp`. Push to GitHub.

## 10. Build steps (phase 2: Production)
1. Re-read section 4 production list and section 11. Show a plan of at most 10 bullets. Wait for "go".
2. Add loading, empty and error states everywhere (6.3).
3. Add accessibility: keyboard play (Tab through points, Enter or Space to select, arrow keys move focus to the nearest point in that direction), aria-labels like "Point 7, empty", visible focus outline, contrast check, reduced motion.
4. Add PWA: manifest, icons, service worker (cache-first for the app shell, versioned cache name, relative paths so it works under `/<repo>/`), offline test, install button.
5. Add `privacy.html` (no data collected, what is stored locally, how to clear it) linked from Settings.
6. Add share and SEO tags (title, description, theme-color, Open Graph with a simple generated image).
7. Add GitHub Actions workflow that publishes `/src` to GitHub Pages on push to `main`.
8. Performance pass: Hard AI on Twin Triangles must answer within 1.2 s on a mid-range phone; no console errors.
9. Write README (what it is, how to run, how to test, how to deploy, how to change settings or add a board, known issues).
10. Run "Done means: Production", run `PUBLISH_AND_SECURITY.md` section 1 and 2 checklists, tag `v1.0-production`, publish, and report the live URL.

## 11. Done means (checklist)
**Board data and rules tests (all must pass with `node --test tests/`):**
- B1: 11 boards load; ids unique; every `points` equals the number of nodes; `capacity = points - 3`.
- B2: every line has at least 2 points and every point in a line exists in `nodes`.
- B3: every point has at least 2 neighbours; every point in `tigerStart` exists.
- B4: Classic: `A` has exactly 4 neighbours; Wheel: center `C` has 8 neighbours and no jump exists along a ring.
- B5: Line counts: classic 10, square-diagonals 16, square-plain 10, wheel 28, cross 16, arrow-triangle 12, twin-triangles 19, mini-triangle 6, mini-square 8, mini-wheel 15, mini-arrow 11.
- B6: Neighbour-pair counts (adjacent pairs): classic 38, square-diagonals 56, square-plain 40, wheel 48, cross 44, arrow-triangle 33, twin-triangles 73, mini-triangle 15, mini-square 16, mini-wheel 24, mini-arrow 22.
- G1 (mini-triangle): tiger `A`, goat `L1_1`, `L2_1` empty -> jump A to L2_1 over L1_1 is legal.
- G2: same but `L2_1` has a goat -> that jump is not legal.
- G3: tiger `L1_0`, goat `L1_1`, `L1_2` empty -> jump to L1_2 is legal.
- G4: tiger `L3_0` with `L2_0` and `L3_1` empty -> exactly 2 step moves.
- G5: tiger `L3_0`, goats on `L2_0`, `L1_0`, `L3_1`, `L3_2`, tiger to move -> no legal move -> goats win.
- G6: a tiger can never jump over another tiger or over an empty point.
- G7: goats cannot move while goatsInHand > 0; on the next goat turn after the last placement they can move.
- G8: 80 plies without a capture in the moving phase -> draw; a capture resets the counter.
- G9: with 4 tigers on Classic, tiger setup uses the 3 start points and the 4th tiger is placed by the tiger player before the first goat move.
- C1: capacity validation: classic (3,15) ok; (4,16) ok; (2,20) rejected; mini-triangle (1,5) ok; (3,15) rejected; twin-triangles (6,25) ok.
- C2: targets: goats 15 -> 5, 5 -> 2, 16 -> 6, 20 -> 7, 25 -> 9.
- A1: for every board and for Easy, Medium and Hard, the AI returns a legal move in the first 5 turns of a game.

**MVP:**
- [ ] Every item in section 2 passes
- [ ] All 19 mockup frames are implemented and match the mockup
- [ ] Standard, Mini and Custom work on all boards the rules allow; invalid options are greyed or capped
- [ ] A full game vs Computer (each level) and a full Two-players game reach the Result screen
- [ ] Works on a 360px wide screen and on desktop
- [ ] No console errors
- [ ] Committed and pushed to GitHub, tagged `v0.1-mvp`

**Production:**
- [ ] Loading, empty, error states on every screen
- [ ] Accessibility basics (contrast, labels, keyboard, reduced motion)
- [ ] Installs on Android as a PWA and plays offline after the first load
- [ ] `PUBLISH_AND_SECURITY.md` checklists complete
- [ ] README written for handover
- [ ] Live GitHub Pages URL opens and plays on a phone; tagged `v1.0-production`

## 12. Security notes
- No keys, no secrets, no backend, no user accounts. `.env.example` stays empty.
- No external scripts, fonts or images. Add a Content-Security-Policy meta tag: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self'`.
- Escape any text inserted into the page (use `textContent`).
- Local storage holds only settings and stats. State this on `privacy.html`.

## 13. Publish plan
- Target: GitHub Pages (free) from the `/src` folder using a GitHub Actions workflow. Follow `PUBLISH_AND_SECURITY.md` section 3 (Option A) and the pre-publish checklist in section 2. Use relative paths so the app works at `https://<username>.github.io/<repo>/`.
- Domain: free `github.io` address first.
- Play Store (optional, later, NOT part of this build): `PUBLISH_AND_SECURITY.md` section 4. Costs a one-time Google fee. Ask me before starting.

## 14. Maintenance
- Add a board: add one object to `boards.json` (nodes, lines, tigerStart), add it to the picker, run tests. No engine change needed.
- Change piece limits or the draw rule: edit the constants in one config file and update section 7.4 tests.
- Update the service worker cache name when files change.
- Handover notes for another person: README, this file, `DECISIONS.md`, the `/design` mockup.

## 15. Assumptions I made (change this file to change them)
- "Aane Kuri" is another name for the same game (you confirmed).
- Standard = 3 tigers, 15 goats, tigers win at 5 captures. Goats win by trapping all tigers.
- Classic Triangle layout follows your photos (apex, 4 lines down, 3 bars into a rectangle, base). Arrow Triangle follows your drawing. Wheel, Plain Square, Cross, Twin Triangles and all Mini boards other than Mini Triangle are original designs.
- Extra tigers beyond a board's start points are placed by the tiger player before the goats start.
- Capture is optional; one goat per jump; goats pass when blocked; draw after 80 plies without a capture; capacity = points minus 3.
- No save and resume of games in progress.

## Appendix A: `src/data/boards.json` (copy EXACTLY, do not edit)
Coordinates are in each board's own `viewBox` (width, height). Point ids are labels only.

```json
[
{"id":"classic","name":"Classic Triangle","group":"full","points":23,"capacity":20,"viewBox":[300,360],"tigerStart":["A","R1_2","R1_3"],"nodes":{"A":[150,20],"R1_0":[40,135.2],"R1_1":[110.4,135.2],"R1_2":[136.8,135.2],"R1_3":[163.2,135.2],"R1_4":[189.6,135.2],"R1_5":[260,135.2],"R2_0":[40,189.6],"R2_1":[91.7,189.6],"R2_2":[130.6,189.6],"R2_3":[169.4,189.6],"R2_4":[208.3,189.6],"R2_5":[260,189.6],"R3_0":[40,256.8],"R3_1":[68.6,256.8],"R3_2":[122.9,256.8],"R3_3":[177.1,256.8],"R3_4":[231.4,256.8],"R3_5":[260,256.8],"B_0":[40,340],"B_1":[113.3,340],"B_2":[186.7,340],"B_3":[260,340]},"lines":[["A","R1_1","R2_1","R3_1","B_0"],["A","R1_2","R2_2","R3_2","B_1"],["A","R1_3","R2_3","R3_3","B_2"],["A","R1_4","R2_4","R3_4","B_3"],["R1_0","R1_1","R1_2","R1_3","R1_4","R1_5"],["R2_0","R2_1","R2_2","R2_3","R2_4","R2_5"],["R3_0","R3_1","R3_2","R3_3","R3_4","R3_5"],["B_0","B_1","B_2","B_3"],["R1_0","R2_0","R3_0"],["R1_5","R2_5","R3_5"]]},
{"id":"square-diagonals","name":"Square with Diagonals","group":"full","points":25,"capacity":22,"viewBox":[300,300],"tigerStart":["R0C0","R0C4","R4C0","R4C4"],"nodes":{"R0C0":[30,30],"R0C1":[90,30],"R0C2":[150,30],"R0C3":[210,30],"R0C4":[270,30],"R1C0":[30,90],"R1C1":[90,90],"R1C2":[150,90],"R1C3":[210,90],"R1C4":[270,90],"R2C0":[30,150],"R2C1":[90,150],"R2C2":[150,150],"R2C3":[210,150],"R2C4":[270,150],"R3C0":[30,210],"R3C1":[90,210],"R3C2":[150,210],"R3C3":[210,210],"R3C4":[270,210],"R4C0":[30,270],"R4C1":[90,270],"R4C2":[150,270],"R4C3":[210,270],"R4C4":[270,270]},"lines":[["R0C0","R0C1","R0C2","R0C3","R0C4"],["R0C2","R1C1","R2C0"],["R1C0","R1C1","R1C2","R1C3","R1C4"],["R0C2","R1C3","R2C4"],["R2C0","R2C1","R2C2","R2C3","R2C4"],["R0C0","R1C0","R2C0","R3C0","R4C0"],["R0C4","R1C3","R2C2","R3C1","R4C0"],["R0C1","R1C1","R2C1","R3C1","R4C1"],["R2C0","R3C1","R4C2"],["R0C2","R1C2","R2C2","R3C2","R4C2"],["R2C4","R3C3","R4C2"],["R3C0","R3C1","R3C2","R3C3","R3C4"],["R0C3","R1C3","R2C3","R3C3","R4C3"],["R0C0","R1C1","R2C2","R3C3","R4C4"],["R0C4","R1C4","R2C4","R3C4","R4C4"],["R4C0","R4C1","R4C2","R4C3","R4C4"]]},
{"id":"square-plain","name":"Plain Square","group":"full","points":25,"capacity":22,"viewBox":[300,300],"tigerStart":["R0C0","R0C4","R4C0","R4C4"],"nodes":{"R0C0":[30,30],"R0C1":[90,30],"R0C2":[150,30],"R0C3":[210,30],"R0C4":[270,30],"R1C0":[30,90],"R1C1":[90,90],"R1C2":[150,90],"R1C3":[210,90],"R1C4":[270,90],"R2C0":[30,150],"R2C1":[90,150],"R2C2":[150,150],"R2C3":[210,150],"R2C4":[270,150],"R3C0":[30,210],"R3C1":[90,210],"R3C2":[150,210],"R3C3":[210,210],"R3C4":[270,210],"R4C0":[30,270],"R4C1":[90,270],"R4C2":[150,270],"R4C3":[210,270],"R4C4":[270,270]},"lines":[["R0C0","R0C1","R0C2","R0C3","R0C4"],["R1C0","R1C1","R1C2","R1C3","R1C4"],["R2C0","R2C1","R2C2","R2C3","R2C4"],["R0C0","R1C0","R2C0","R3C0","R4C0"],["R0C1","R1C1","R2C1","R3C1","R4C1"],["R0C2","R1C2","R2C2","R3C2","R4C2"],["R3C0","R3C1","R3C2","R3C3","R3C4"],["R0C3","R1C3","R2C3","R3C3","R4C3"],["R0C4","R1C4","R2C4","R3C4","R4C4"],["R4C0","R4C1","R4C2","R4C3","R4C4"]]},
{"id":"wheel","name":"Wheel","group":"full","points":25,"capacity":22,"viewBox":[300,300],"tigerStart":["C","W3_2","W3_6"],"nodes":{"C":[150,150],"W1_0":[150,105],"W1_1":[181.8,118.2],"W1_2":[195,150],"W1_3":[181.8,181.8],"W1_4":[150,195],"W1_5":[118.2,181.8],"W1_6":[105,150],"W1_7":[118.2,118.2],"W2_0":[150,60],"W2_1":[213.6,86.4],"W2_2":[240,150],"W2_3":[213.6,213.6],"W2_4":[150,240],"W2_5":[86.4,213.6],"W2_6":[60,150],"W2_7":[86.4,86.4],"W3_0":[150,15],"W3_1":[245.5,54.5],"W3_2":[285,150],"W3_3":[245.5,245.5],"W3_4":[150,285],"W3_5":[54.5,245.5],"W3_6":[15,150],"W3_7":[54.5,54.5]},"lines":[["W1_0","W1_1"],["W2_0","W2_1"],["W3_0","W3_1"],["W1_1","W1_2"],["W2_1","W2_2"],["W3_1","W3_2"],["W1_2","W1_3"],["W2_2","W2_3"],["W3_2","W3_3"],["W1_3","W1_4"],["W2_3","W2_4"],["W3_3","W3_4"],["W3_0","W2_0","W1_0","C","W1_4","W2_4","W3_4"],["W1_4","W1_5"],["W2_4","W2_5"],["W3_4","W3_5"],["W3_1","W2_1","W1_1","C","W1_5","W2_5","W3_5"],["W1_5","W1_6"],["W2_5","W2_6"],["W3_5","W3_6"],["W3_2","W2_2","W1_2","C","W1_6","W2_6","W3_6"],["W1_6","W1_7"],["W2_6","W2_7"],["W3_6","W3_7"],["W3_3","W2_3","W1_3","C","W1_7","W2_7","W3_7"],["W1_0","W1_7"],["W2_0","W2_7"],["W3_0","W3_7"]]},
{"id":"cross","name":"Cross","group":"full","points":21,"capacity":18,"viewBox":[300,300],"tigerStart":["R0C2","R2C0","R2C4","R4C2"],"nodes":{"R0C1":[90,30],"R0C2":[150,30],"R0C3":[210,30],"R1C0":[30,90],"R1C1":[90,90],"R1C2":[150,90],"R1C3":[210,90],"R1C4":[270,90],"R2C0":[30,150],"R2C1":[90,150],"R2C2":[150,150],"R2C3":[210,150],"R2C4":[270,150],"R3C0":[30,210],"R3C1":[90,210],"R3C2":[150,210],"R3C3":[210,210],"R3C4":[270,210],"R4C1":[90,270],"R4C2":[150,270],"R4C3":[210,270]},"lines":[["R0C1","R0C2","R0C3"],["R0C2","R1C1","R2C0"],["R1C0","R1C1","R1C2","R1C3","R1C4"],["R0C2","R1C3","R2C4"],["R1C0","R2C0","R3C0"],["R1C3","R2C2","R3C1"],["R1C1","R2C2","R3C3"],["R2C0","R2C1","R2C2","R2C3","R2C4"],["R1C4","R2C4","R3C4"],["R0C1","R1C1","R2C1","R3C1","R4C1"],["R2C0","R3C1","R4C2"],["R0C2","R1C2","R2C2","R3C2","R4C2"],["R2C4","R3C3","R4C2"],["R3C0","R3C1","R3C2","R3C3","R3C4"],["R0C3","R1C3","R2C3","R3C3","R4C3"],["R4C1","R4C2","R4C3"]]},
{"id":"arrow-triangle","name":"Arrow Triangle","group":"full","points":22,"capacity":19,"viewBox":[340,360],"tigerStart":["A","K1_2","K1_4","K1_3"],"nodes":{"A":[170,30],"K1_0":[14,120],"K1_1":[40,120],"K1_2":[140,120],"K1_3":[170,120],"K1_4":[200,120],"K1_5":[300,120],"K1_6":[326,120],"K2_0":[14,235],"K2_1":[40,235],"K2_2":[101.7,235],"K2_3":[170,235],"K2_4":[238.3,235],"K2_5":[300,235],"K2_6":[326,235],"B_0":[70,330],"B_1":[170,330],"B_2":[270,330],"V_TL":[40,59],"V_BL":[40,303],"V_TR":[300,59],"V_BR":[300,303]},"lines":[["A","K1_3","K2_3","B_1"],["A","K1_2","K2_2","B_0"],["A","K1_4","K2_4","B_2"],["K1_0","K1_1","K1_2","K1_3","K1_4","K1_5","K1_6"],["K2_0","K2_1","K2_2","K2_3","K2_4","K2_5","K2_6"],["B_0","B_1","B_2"],["V_TL","K1_1","K2_1","V_BL"],["V_TR","K1_5","K2_5","V_BR"],["K1_0","V_TL"],["K2_0","V_BL"],["K1_6","V_TR"],["K2_6","V_BR"]]},
{"id":"twin-triangles","name":"Twin Triangles","group":"full","points":42,"capacity":39,"viewBox":[300,456],"tigerStart":["A","R1_2","R1_3","mA","mR1_2","mR1_3"],"nodes":{"A":[150,20],"R1_0":[40,94.9],"R1_1":[110.4,94.9],"R1_2":[136.8,94.9],"R1_3":[163.2,94.9],"R1_4":[189.6,94.9],"R1_5":[260,94.9],"R2_0":[40,130.2],"R2_1":[91.7,130.2],"R2_2":[130.6,130.2],"R2_3":[169.4,130.2],"R2_4":[208.3,130.2],"R2_5":[260,130.2],"R3_0":[40,173.9],"R3_1":[68.6,173.9],"R3_2":[122.9,173.9],"R3_3":[177.1,173.9],"R3_4":[231.4,173.9],"R3_5":[260,173.9],"B_0":[40,228],"B_1":[113.3,228],"B_2":[186.7,228],"B_3":[260,228],"mA":[150,436],"mR1_0":[40,361.1],"mR1_1":[110.4,361.1],"mR1_2":[136.8,361.1],"mR1_3":[163.2,361.1],"mR1_4":[189.6,361.1],"mR1_5":[260,361.1],"mR2_0":[40,325.8],"mR2_1":[91.7,325.8],"mR2_2":[130.6,325.8],"mR2_3":[169.4,325.8],"mR2_4":[208.3,325.8],"mR2_5":[260,325.8],"mR3_0":[40,282.1],"mR3_1":[68.6,282.1],"mR3_2":[122.9,282.1],"mR3_3":[177.1,282.1],"mR3_4":[231.4,282.1],"mR3_5":[260,282.1]},"lines":[["A","R1_1","R2_1","R3_1","B_0"],["mA","mR1_1","mR2_1","mR3_1","B_0"],["A","R1_2","R2_2","R3_2","B_1"],["mA","mR1_2","mR2_2","mR3_2","B_1"],["A","R1_3","R2_3","R3_3","B_2"],["mA","mR1_3","mR2_3","mR3_3","B_2"],["A","R1_4","R2_4","R3_4","B_3"],["mA","mR1_4","mR2_4","mR3_4","B_3"],["R1_0","R1_1","R1_2","R1_3","R1_4","R1_5"],["mR1_0","mR1_1","mR1_2","mR1_3","mR1_4","mR1_5"],["R2_0","R2_1","R2_2","R2_3","R2_4","R2_5"],["mR2_0","mR2_1","mR2_2","mR2_3","mR2_4","mR2_5"],["R3_0","R3_1","R3_2","R3_3","R3_4","R3_5"],["mR3_0","mR3_1","mR3_2","mR3_3","mR3_4","mR3_5"],["B_0","B_1","B_2","B_3"],["R1_0","R2_0","R3_0"],["mR1_0","mR2_0","mR3_0"],["R1_5","R2_5","R3_5"],["mR1_5","mR2_5","mR3_5"]]},
{"id":"mini-triangle","name":"Mini Triangle","group":"mini","points":10,"capacity":7,"viewBox":[300,300],"tigerStart":["A"],"nodes":{"A":[150,22],"L1_0":[105,107],"L1_1":[150,107],"L1_2":[195,107],"L2_0":[60,192],"L2_1":[150,192],"L2_2":[240,192],"L3_0":[15,277],"L3_1":[150,277],"L3_2":[285,277]},"lines":[["A","L1_0","L2_0","L3_0"],["A","L1_1","L2_1","L3_1"],["A","L1_2","L2_2","L3_2"],["L1_0","L1_1","L1_2"],["L2_0","L2_1","L2_2"],["L3_0","L3_1","L3_2"]]},
{"id":"mini-square","name":"Mini Square","group":"mini","points":9,"capacity":6,"viewBox":[300,300],"tigerStart":["R1C1"],"nodes":{"R0C0":[50,50],"R0C1":[150,50],"R0C2":[250,50],"R1C0":[50,150],"R1C1":[150,150],"R1C2":[250,150],"R2C0":[50,250],"R2C1":[150,250],"R2C2":[250,250]},"lines":[["R0C0","R0C1","R0C2"],["R0C0","R1C0","R2C0"],["R0C2","R1C1","R2C0"],["R1C0","R1C1","R1C2"],["R0C1","R1C1","R2C1"],["R0C0","R1C1","R2C2"],["R0C2","R1C2","R2C2"],["R2C0","R2C1","R2C2"]]},
{"id":"mini-wheel","name":"Mini Wheel","group":"mini","points":13,"capacity":10,"viewBox":[300,300],"tigerStart":["C"],"nodes":{"C":[150,150],"W1_0":[150,90],"W1_1":[202,120],"W1_2":[202,180],"W1_3":[150,210],"W1_4":[98,180],"W1_5":[98,120],"W2_0":[150,30],"W2_1":[253.9,90],"W2_2":[253.9,210],"W2_3":[150,270],"W2_4":[46.1,210],"W2_5":[46.1,90]},"lines":[["W1_0","W1_1"],["W2_0","W2_1"],["W1_1","W1_2"],["W2_1","W2_2"],["W1_2","W1_3"],["W2_2","W2_3"],["W2_0","W1_0","C","W1_3","W2_3"],["W1_3","W1_4"],["W2_3","W2_4"],["W2_1","W1_1","C","W1_4","W2_4"],["W1_4","W1_5"],["W2_4","W2_5"],["W2_2","W1_2","C","W1_5","W2_5"],["W1_0","W1_5"],["W2_0","W2_5"]]},
{"id":"mini-arrow","name":"Mini Arrow","group":"mini","points":15,"capacity":12,"viewBox":[340,360],"tigerStart":["A"],"nodes":{"A":[170,30],"K1_0":[14,185],"K1_1":[40,185],"K1_2":[118.3,185],"K1_3":[170,185],"K1_4":[221.7,185],"K1_5":[300,185],"K1_6":[326,185],"B_0":[70,330],"B_1":[170,330],"B_2":[270,330],"V_TL":[40,130],"V_BL":[40,240],"V_TR":[300,130],"V_BR":[300,240]},"lines":[["A","K1_3","B_1"],["A","K1_2","B_0"],["A","K1_4","B_2"],["K1_0","K1_1","K1_2","K1_3","K1_4","K1_5","K1_6"],["B_0","B_1","B_2"],["V_TL","K1_1","V_BL"],["V_TR","K1_5","V_BR"],["K1_0","V_TL"],["K1_0","V_BL"],["K1_6","V_TR"],["K1_6","V_BR"]]}
]
```
