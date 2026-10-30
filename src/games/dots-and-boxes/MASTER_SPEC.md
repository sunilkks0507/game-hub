# MASTER_SPEC: Dots and Boxes

Status: spec written 31 Oct 2026. Items marked **(default, confirm)** are assumptions recorded in DECISIONS.md.

## 1. Goal
Close more boxes than your rival. Take turns drawing one line between two dots; closing a box scores it and gives you another turn.

## 2. Success test
A 7-year-old can start playing within 30 seconds (tutorial: 5 guided steps, skippable), finish a 3x3 game in 3-5 minutes, and say why they won or lost from the result screen. An adult finds the 5x5 Hard bot a real contest.

## 3. Users
- All ages from 7. Primary category **Family**; `alsoIn` Explorers, Challengers, Adults. `ageMin` 7, `ageMax` 99.
- Mascot: **Bindu**, an original round dot character with a pencil-line smile. Short speech (max about 12 words). Small and dismissible; hidden during play except for tutorial and hints.

## 4. Scope
**MVP:** engine and tests, play vs computer (Easy/Medium/Hard), two players on one phone, three board sizes, tutorial, "?" card, result screen with why, Undo, Hint, sound, stats and badges, save and continue.
**Production:** settings (sound, reduce motion, safe-line helper, level), accessibility pass, grown-up corner, privacy note, `game.json`, hub integration, offline check.
**Not included:** online play, accounts, leaderboards, timers, non-square boards, pie rule.

## 5. Board and numbering
Board size `n` = boxes per side: 3, 4 or 5 (so 4x4, 5x5 or 6x6 dots).
- **Edges** (lines), `E = 2n(n+1)`: 24, 40 or 60.
  - Horizontal edge `h(r,c)`, `r` in 0..n, `c` in 0..n-1: id `r*n + c`.
  - Vertical edge `v(r,c)`, `r` in 0..n-1, `c` in 0..n: id `n(n+1) + r*(n+1) + c`.
- **Boxes**, `n*n`: 9, 16 or 25. Box `(r,c)` id `r*n + c`; its sides are `h(r,c)` top, `h(r+1,c)` bottom, `v(r,c)` left, `v(r,c+1)` right.
- An interior edge borders two boxes; a border edge borders one.
- Players are 0 and 1. In vs-computer mode the child is player 0.
- State is a plain serialisable object: `{ n, edges: Uint8Array-like array of 0/1, owner: array of -1/0/1 per box, current, scores: [a,b], moves: [edge ids], turnLog }`.

## 6. Exact rules (rule set "Classic Dots and Boxes")
1. Start: no lines drawn, no boxes owned.
2. Your turn: draw **one** line that is not yet drawn.
3. If that line completes the fourth side of one box, or of two boxes at once, you own those boxes (score +1 each) and **you move again**.
4. If it completes no box, the turn passes to the other player.
5. The game ends when every line is drawn. The player with more boxes wins.
6. A draw is only possible on 4x4 (16 boxes); 3x3 (9) and 5x5 (25) always have a winner.
7. You must always draw a line on your turn. Taking an available box is allowed but never forced: leaving a box on purpose is a real strategy move, and the Hard bot uses it.
8. **Who starts (default, confirm):** on 3x3 the player chooses who goes first. On 4x4 and 5x5 the starter alternates each game, tracked per device.

## 7. Bot levels
Terms: a *third side* is a box with 3 sides drawn after a move. A *safe line* is an undrawn line that leaves no box with 3 sides. A *sacrifice* is a forced move when no safe line exists.
- **Easy:** 30% of the time plays a random undrawn line (so it sometimes misses boxes or gives them away). Otherwise takes any available box, then a random safe line, then the line that gives away the fewest boxes.
- **Medium:** always takes available boxes, then plays a safe line, and when none exists gives away the smallest chain. Does not plan control.
- **Hard:** Medium plus chain control: counts chains and loops, and may decline the last two boxes of a long chain ("double-deal") to keep the move. Searches exact turns (a turn = box takes plus one final line) with iterative deepening inside a 1.5 s budget, falling back to Medium's choice if time runs out.
- Bots are pure functions of `(state, level, rng)`, run in a Web Worker, and fall back to inline calls if Workers are unavailable. Seeded RNG makes tests repeatable.
- **Hint:** vs computer only. Uses Medium logic: shows an available box if there is one, otherwise a safe line, otherwise says "Every line gives a box away. Pick the smallest gift."
- **Safe-line helper (setting):** marks lines that would create a third side with a small "!" badge. Setting is Auto (on for Easy only, the default), Always or Never.
- **Hard (as built):** plays like Medium until 19 lines are left, then solves the rest of the game exactly within 1.5 s (this includes double-dealing), falling back to Medium if time runs out.

## 8. Screen flow
Title (Bindu, name, goal, Play, How to play, sound, Settings, Home) -> first Play runs the tutorial -> Setup (opponent: computer or friend; board size; level; who starts on 3x3) -> Play -> Result dialog (why, stats, badges, Play again / How to play / Home).
Play screen: goal line, scoreboard (You / Rival with counts), status line (whose turn; "Go again!" after a box), the board, Undo, Hint, "?" and Menu. In two-player mode a pass-the-phone prompt appears when the turn changes.

## 9. Board interaction and layout (360px first)
- Board is one square SVG, full width minus 16px side padding (328px). Dot spacing is about 100px (3x3), 78px (4x4), 60px (5x5).
- Each undrawn line is a focusable `<button>` with a large invisible hit area: a diamond with the two dots as end vertices and the two neighbouring box centres as side vertices. Hit areas tile the board with no gaps and reach at least 44px across on every board size.
- Keyboard: Tab through lines in id order; arrow keys move between neighbouring lines; Enter or Space draws.
- Labels read like "Horizontal line, row 2, column 3" (undrawn) or "Drawn" (disabled).
- Ownership is shown by **symbol and colour**: player 0 = circle mark with blue tint, player 1 = diamond mark with orange tint. The last line drawn is thicker and pulses once (a fade with reduce motion).
- Live region announces the score and whose turn after each move.
- Lines draw in about 150 ms; a closed box fills with a pop. Bot moves wait about 450 ms, 250 ms inside a chain. With reduce motion, no pop and a 150 ms wait.

## 10. Tutorial (5 steps)
Led by Bindu on a 3x3 board. Every step is skippable and replayable; a wrong tap never dead-ends.
1. **Goal:** close more boxes than your rival. Next.
2. **Draw a line:** tap the glowing line; it draws with a sound.
3. **Close a box:** a box has 3 sides; tap the glowing 4th side. The box becomes yours, the score counts, and "you go again" appears.
4. **The trap:** several lines are drawn; one glowing safe line and some lines that would make a 3rd side. Tap the glowing line. If the child taps a trap line, the rival takes the box on screen, Bindu says "Oops, that gave them a box. Try the glowing line," and the step resets (after two tries the step moves on).
5. **Practice (optional):** a short 3x3 game vs Easy with the safe-line helper on.
Tutorial positions are built by loading a list of drawn edges into the engine (`fromEdges(n, edgeIds, current)`).

## 11. Result screen: say why
Shows the final score and a short reason built from facts:
- boxes you gave away by drawing a third side, and boxes the rival gave away;
- biggest run of boxes closed in one turn, and who took it;
- who had to open the last long chain, when that decided the game.
Example: "You won 14 to 11. Your rival gave you 6 boxes. You closed a run of 5 in one turn."
Offers Play again, How to play, Home.

## 12. Stored data (localStorage, `hub:dots-and-boxes:<name>:v1`)
- `settings`: sound, reduceMotion, level, size, safeHelper.
- `stats`: played/won per `"<n>-<level>"` key, best run of boxes in one turn.
- `progress`: shared hub shape `{ gameId, played, won, badges, lastPlayed }`.
- `saved`: mode, size, level, first player, moves (edge ids) for continue.
- `tutorialDone`, `lastStarter` per size.

## 13. Badges
First box, First win, Beat the Hard bot, Win on 5x5, Run of 4+ boxes in one turn, Clean win (win without giving away a box).

## 14. Files (planned)
`index.html`, `css/style.css`, `js/engine.js`, `js/ai.js` (includes `cascadeSize`; no separate chains file), `js/ai.worker.js`, `js/board.js` (SVG), `js/tutorial.js`, `js/app.js`, `icon.svg`, `game.json`, `tests/engine.test.js`, `tests/ai.test.js`, `tests/tutorial.test.js`. Accent colour `#2f55a4`; player 1 tint `#b4540a`.

## 15. Done means
- [ ] Engine rules match section 6; tests pass (`node --test`)
- [ ] Edge and box counts are right for 3, 4 and 5 (24/40/60 edges; 9/16/25 boxes); every random playout ends with all edges drawn and scores summing to the box count
- [ ] Completing two boxes with one line scores both and keeps the turn
- [ ] Medium and Hard never draw a third side when a safe line exists; take a box when one is available (Hard may double-deal only when the test position proves it keeps control)
- [ ] Medium and Hard beat a random player in seeded playouts on 3x3 and 4x4; Easy sometimes loses
- [ ] Hard answers within about 1.5 s on 5x5 in Node (real phone not yet measured)
- [ ] Tutorial scenarios really produce a drawn line, a closed box, and the trap
- [ ] Title, tutorial, "?" card, result-with-why, settings, Home, grown-up corner present
- [ ] Every line is a labelled button; keyboard play works; 4.5:1 contrast; ownership not by colour alone
- [ ] Works at 360px with no horizontal scroll; hit areas 44px or more
- [ ] Offline reload works on the live URL
- [ ] Rule set shown on the "?" card and in `ruleVariant`
