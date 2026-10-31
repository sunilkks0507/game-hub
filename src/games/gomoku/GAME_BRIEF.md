# Game Brief: Five in a Row (Gomoku)

```
Name:                 Five in a Row (also called Gomoku). Both are generic traditional names, no brand.
                      The catalogue lists it as #87, "Five in a Row (Gomoku)".
Learning goal:        Spot a line of 3 or 4 before it becomes five, and block it in time.
                      Adults go further: build two threats at once so the rival cannot block both.
Age band:             8 and up. Primary category Family (tracker); also shows under Challengers and Adults.
Core loop:            Take turns placing one stone on a grid point; the first player to make an unbroken
                      line of five (across, down or diagonal) wins.
Session length:       9x9: 2-5 min. 13x13: 5-10 min. 15x15: 8-15 min.
Players:              1 vs computer (Easy / Medium / Hard), or 2 on the same phone (pass-the-phone prompt).
How a child learns by doing: The tutorial board already holds three stones in a row. The child taps the
                      next point and sees four glow. Next, the rival has four and the child must tap the
                      one open end to block it. Nothing to read before acting.
Tutorial plan:        1. Goal: make five in a row.
                      2. Place a stone (tap a point).
                      3. Grow a line: make four, the line glows at both ends.
                      4. Block: the rival has four, cover the open end.
                      5. Short practice game on 9x9 vs the Easy bot (optional).
Rewards / progress:   Wins and losses per board size and level, longest line made, a few badges
                      (first five, first win, win on Hard, win 15x15, win with a double threat).
                      Device-only, no profile.
Content needed:       No levels or question banks. Three board sizes: 9x9, 13x13, 15x15 points.
Offline check:        Pure rules plus a bot in a Web Worker. No server, no live data. Passes.
Risks / unknowns:     - Tap size is the big one. A 15x15 board has 14 gaps; at 328px wide that is about 23px per
                        gap, well under the 44px minimum. See "Questions" 2.
                      - First player has a known advantage with free rules (the catalogue says free-style first
                        player wins with perfect play; opening limits are unresearched). See "Questions" 3.
                      - Bot strength and speed on a mid-range Android phone are not measured yet.
                        The bot only looks at points near existing stones to keep the search small.
                      - Black and white stones must be told apart without colour alone, and the winning five
                        needs a mark that is not just a colour change.
                      - Trademark status of "Gomoku" and "Five in a Row" was not checked in any registry.
                        Both are traditional generic names, so risk is judged low, but unverified.
Estimated size:       About 12-14 files, 1,800-2,300 lines including tests.
```

## Mascot
Original SVG in the shared family style. Working idea: **Mani** ("bead" in Hindi and Kannada), a small round bead on a string, who threads five beads in the tutorial. Short bubbles (max about 12 words), small and dismissible, since this game is for all ages. Final design at the Mockup step.

## Modes
- vs Computer: Easy / Medium / Hard. Easy blocks a line of four only some of the time, so a child can win.
- Two players on one phone: pass-the-phone prompt and a clear "whose turn" indicator.
- Undo, and Hint (vs computer only: shows where to block, or a point that makes a line).
- Not included: online play, accounts, leaderboards, timers, a ranked pro-tournament ruleset.

## Questions for you before the Spec
1. **Category:** the tracker has **Family** primary, `alsoIn` Challengers and Adults, ages 8+. Keep that? (Explorers is left out because 8-10 year olds can play but the game is not aimed at them first.)
2. **Board sizes and tapping:** I suggest 9x9 (default), 13x13 and 15x15. On 9x9 each gap is about 40px, close to the 44px rule. On 13x13 and 15x15 I suggest **tap to preview, tap again to place**: the first tap puts a ghost stone with a large halo, the second tap on the same point (or a Place button) confirms. A mistap just moves the ghost. Alternative: boards slide sideways inside their frame with 44px gaps, as Dots and Boxes does from 7x7, but a strategy game needs to see the whole board. OK to go with tap-twice?
3. **Opening rule:** (a) **Free**, simplest: first player plays anywhere, five or more in a row wins. (b) **Free plus Swap**: after the first stone, the second player may swap sides, which evens the game. (c) **Centre opening**: the first stone must go in the middle. I recommend (a) as the default with (b) as a Setup toggle, labelled "Fair start". I have not researched which opening rules balance best, so this is an editorial choice to record in `DECISIONS.md`.
4. **Overlines:** under Free, six or more in a row also wins (the common casual rule). Fine? The stricter "exactly five" rule is harder to explain to children.
5. **Mascot:** Mani the bead, OK as a working idea?

## Notes from the research catalogue
- Idea #87. Score 24/30. Effort S. Engine cluster A (board game + Worker bot), "High" reuse of the grid engine pattern.
- Rules are traditional and free to implement. Free-style first player wins with perfect play, so the catalogue says to use swap or opening limits (unresearched).
- Closest template in this repo: Dots and Boxes (engine.js, ai.js + ai.worker.js, tutorial.js, board.js, app.js, shared sound and storage).
- IP: traditional game. Original art and sound only.
