# MASTER_SPEC: Five in a Row (Gomoku)

Status: spec written 31 Oct 2026. Items marked **(default, confirm)** are assumptions recorded in DECISIONS.md. The five brief questions were answered "go with the recommendations" on 31 Oct 2026.

## 1. Goal
Make an unbroken line of five of your stones, across, down or diagonally, before your rival does.

## 2. Success test
An 8-year-old can start playing within 30 seconds (tutorial: 5 guided steps, skippable), finish a 9x9 game in 2-5 minutes, and say why they won or lost from the result screen. An adult finds the 15x15 Hard bot a real contest.

## 3. Users
- All ages from 8. Primary category **Family**; `alsoIn` Challengers and Adults. `ageMin` 8, `ageMax` 99.
- Mascot: **Mani**, an original bead-on-a-string character. Short speech (max about 12 words). Small and dismissible; hidden during play except for tutorial and hints.
- Game id: `gomoku`. Display name: **Five in a Row**, with "Gomoku" shown as the other name on the title screen and in `about`.

## 4. Scope
**MVP:** engine and tests, play vs computer (Easy/Medium/Hard), two players on one phone, three board sizes, Fair start (swap) toggle, tutorial, "?" card, result screen with why, Undo, Hint, sound, stats and badges, save and continue.
**Production:** settings (sound, reduce motion, threat helper, placing style, level), accessibility pass, grown-up corner, privacy note, `game.json`, hub integration, offline check.
**Not included:** online play, accounts, leaderboards, timers, non-square boards, "exactly five" or Renju restrictions, Swap2.

## 5. Board and numbering
Board size `n` = points per side: 9, 13 or 15 (default 9).
- Point id = `r*n + c`, `r` and `c` in 0..n-1, row 0 at the top. Labels: column letter A-O, row number 1-n counted from the top ("E3").
- Colours: player 0 is **Black** and always moves first; player 1 is **White**. Seats (who is you, who is the rival) are mapped by the app and can swap (see section 6).
- State is a plain serialisable object: `{ n, cells: Int8Array-like array of -1 (empty) / 0 / 1, current, phase: 'play' | 'swap' | 'over', winner: -1 | 0 | 1, winLine: [ids] | null, moves: [point ids], swapped: bool, fairStart: bool }`.
- Five-in-a-row check runs only around the last stone: four directions, count each way, `>= 5` wins. Cost is constant, not a full-board scan.

## 6. Exact rules (rule set "Free-style Five in a Row")
1. Start: empty board, Black to move.
2. Your turn: place **one** stone on an empty point. Stones never move and are never captured.
3. Five **or more** of your stones in an unbroken line (row, column or diagonal) wins at once. Six or seven in a row also wins. **(default, confirm)**
4. If every point is filled and nobody has five, the game is a draw.
5. No timers. No forbidden moves.
6. **Fair start (setting, off by default) (default, confirm):** after Black's first stone, the second seat chooses **Play on** (stay White, White moves next) or **Swap** (take the Black stone and become Black; the first seat becomes White and moves next). Only the first stone triggers this. With Fair start off, Black just plays anywhere.
7. Who moves first in vs-computer: the player picks **You play: Black / White** in Setup. On Play again the colours alternate (default, confirm). With two players on one phone, Black goes first and the pass-the-phone prompt shows each turn.
8. First move vs computer with Fair start off: if the bot is Black it plays the centre point.

**Fair start with the bot (default, confirm).** Let `d` = how far a point is from the centre, counted in whole steps along the longer of the row or column distance, and `T = floor(n / 4)` (2 on 9x9, 3 on 13x13 and 15x15).
- Bot is the second seat: it swaps if the human's first stone has `d <= T`, otherwise it plays on.
- Bot is the first seat: it places its stone at a random point with `d = T + 1`, so the human can judge a fairly balanced opening.

## 7. Bot levels
Terms: a **four** is four of one colour in a line of five points with exactly one empty point to finish it. An **open four** has two finishing points, so it cannot be blocked. An **open three** is three in a row that can become an open four. A **double threat** is one stone that creates two fours, or four plus an open three, so the rival cannot stop both.
Candidate points are empty points within 2 steps of any stone (the centre on an empty board). Each candidate is scored by pattern: what it builds for the bot plus what it stops for the rival.
- **Easy:** 30% of the time plays a random candidate. Otherwise wins if it can, blocks a four 70% of the time, then plays the best-scoring candidate with a little noise. It misses open threes, so a child can win.
- **Medium:** always wins if it can, always blocks a four, blocks an open three, then plays the best-scoring candidate. Looks no further ahead than one move.
- **Hard:** Medium plus a search. First looks for a forced win made only of fours (the rival must answer each one). Then iterative deepening alpha-beta over the best 10 candidates, up to 6 plies, inside a 1.5 s budget. If time runs out it plays the best move found so far, or Medium's choice.
- Bots are pure functions of `(state, level, rng)`, run in a Web Worker, and fall back to inline calls if Workers are unavailable. Seeded RNG makes tests repeatable.
- **Hint:** vs computer only. Uses Medium logic and shows one point with one sentence: "Make five here!", "Block here, they have four", "Block here, their three is open at both ends", or "This builds your line".
- **Threat helper (setting):** puts a small "!" badge on a point where the rival must be stopped next turn, and a "+" on a point that gives you five. Setting is Auto (on for Easy only, the default), Always or Never.
- Phone speed is not measured. The Hard budget is a cap, and the 1.5 s figure is checked in Node only.

## 8. Screen flow
Title (Mani, name, goal, Play, How to play, sound, Settings, Home) -> first Play runs the tutorial -> Setup (opponent: computer or friend; board size; level; You play Black or White; Fair start toggle) -> Play -> Result dialog (why, stats, badges, Play again / How to play / Home).
Play screen: goal line ("Make 5 in a row"), turn banner (stone icon plus words, "Your turn, Black"), the board, a large **Place** button (shown while a preview is pending), Undo, Hint, "?" and Menu. In two-player mode a pass-the-phone prompt appears when the turn changes. In the swap phase a card asks "Play on or Swap?" with the stone shown.

## 9. Board interaction and layout (360px first)
- The board is one square SVG, full width minus 16px side padding (328px), points on the grid lines with a half-gap margin, so the gap is board width divided by n. The gap between points is about **36px on 9x9, 25px on 13x13 and 22px on 15x15**. All three are under the 44px target rule, so a bare tap on a point is not forgiving enough.
- **Placing style (default, confirm):** **Preview** on every board size. First tap on a point puts a ghost stone with a halo of at least 22px radius, so it stays visible beside a thumb. Tapping another point moves the ghost; tapping the ghost again, or the **Place** button (at least 44px tall, full width), places the stone. A setting **One tap to place** is available for players who want speed.
- Each point has an invisible hit area the size of its grid cell, so no gaps. Nothing needs dragging, so no separate tap alternative is needed.
- Keyboard: one tab stop on the board (roving focus); arrow keys move the cursor, Enter or Space previews then places, Escape clears the preview. Cells carry labels like "Column E, row 3, empty" or "Column E, row 3, Black stone".
- **Stones are told apart by more than colour:** Black is a solid dark stone; White is a light stone with a hollow ring mark. Both have a 2px dark outline so their edge meets 3:1 against the board. The last stone placed carries a small square marker.
- **The winning five** gets a line drawn through it, a ring on each stone, and a result-card sentence, so it is not shown by colour alone.
- Live region announces each move, the threat helper's messages and the result.
- Stone placement uses a 120 ms scale-in; bot moves wait about 450 ms (150 ms with reduce motion, no scale-in).

## 10. Tutorial (5 steps)
Led by Mani on a 9x9 board. Every step is skippable and replayable; a wrong tap never dead-ends.
1. **Goal:** a line of five stones lights up as a demo (a still image with reduce motion). Next.
2. **Place a stone:** one point glows. Tap it to preview, then tap again to place, with a sound.
3. **Grow a line:** three Black stones in a row, open at both ends. Tap the glowing point to make four. The rival can block only one end; the child places the other end and makes five. Mani: "Two open ends. They can only block one!"
4. **Block:** the rival has four in a row with one end already blocked. One point glows. If the child taps elsewhere, the rival completes five on screen, Mani says "Oops, they made five. Block the glowing end," and the step resets (after two tries the step moves on).
5. **Practice (optional):** a short 9x9 game vs Easy with the threat helper on.
Tutorial positions are built by loading stone lists into the engine (`fromStones(n, blackIds, whiteIds, current)`).

## 11. Result screen: say why
Shows the result and a short reason built from facts in the move log:
- how the five was made (across, down, diagonal) and on which move;
- whether it came from a double threat or an open four;
- how many fours the winner blocked in the game;
- when the rival won, which four was left open and where.
Examples: "You won on move 23 with five across. You made an open four, so your rival could not block both ends." / "Your rival made five on move 31. A four was left open at G6." / "Draw: the board filled up with no five."
Offers Play again, How to play, Home.

## 12. Stored data (localStorage, `hub:gomoku:<name>:v1`)
- `settings`: sound, reduceMotion, level, size, threatHelper, placing (`preview` or `one-tap`), fairStart, youPlay.
- `stats`: played/won/drawn per `"<n>-<level>"` key, most fours blocked in one game.
- `progress`: shared hub shape `{ gameId, played, won, badges, lastPlayed }`.
- `saved`: mode, size, level, fairStart, youPlay, swapped, moves (point ids) for continue.
- `tutorialDone`, `lastColour`.

## 13. Badges
First win, Win with an open four, Block 3 fours in one game, Win on 15x15, Beat the Hard bot.

## 14. Files (planned)
`index.html`, `css/style.css`, `js/engine.js` (rules, five check, threat scan, `explain`), `js/ai.js`, `js/ai.worker.js`, `js/board.js`, `js/tutorial.js`, `js/app.js`, `icon.svg`, `game.json`, `tests/engine.test.js`, `tests/ai.test.js`, `tests/tutorial.test.js`. Accent colour to confirm at the Mockup step (proposal `#6b3fa0`, needs 4.5:1 against white); board colour and stone outlines settled there too.
Reuse: shared `sound.js`, `storage.js`, `dialog.js`, `tokens.css`, `base.css`, and the Dots and Boxes engine + Worker pattern. New sounds `stone` and `swap` go into `src/shared/sound.js` without changing existing ones.

## 15. Done means
- [ ] Engine rules match section 6; tests pass (`node --test`)
- [ ] Five in a row wins in all four directions, including at the edges and corners; six or seven in a row also wins; four does not
- [ ] A full board with no five is a draw (scripted fill test); every random playout ends with a win or a draw
- [ ] Swap phase: only after the first stone, only when Fair start is on; Play on and Swap both leave White to move; seats map correctly after a swap
- [ ] Easy sometimes loses; Medium and Hard beat a random player in seeded playouts on 9x9; Medium and Hard always make five when they can and always block a four
- [ ] Hard finds a forced win made of fours in a test position and answers within about 1.5 s on 15x15 in Node (real phone not yet measured)
- [ ] Undo vs computer removes the bot reply and your stone; in two-player removes one stone; disabled in the swap phase and after the game ends
- [ ] Tutorial scenarios really produce a placed stone, an open four that wins, and the missed block
- [ ] Title, tutorial, "?" card, result-with-why, settings, Home, grown-up corner present
- [ ] Preview-then-place works by touch and by keyboard; Place button is 44px or taller; stones differ by shape and mark, not colour alone; 4.5:1 text contrast
- [ ] Works at 360px with no horizontal scroll on all three board sizes
- [ ] Offline reload works on the live URL
- [ ] Rule set (free-style, six or more wins, Fair start) shown on the "?" card and in `ruleVariant`
