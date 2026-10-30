# Game Brief: Dots and Boxes

```
Name:                 Dots and Boxes (generic public-domain name, no brand)
Learning goal:        Look one move ahead: count the sides of a box and avoid handing the other player a box.
                      Adults go further into chains (who is forced to open the long chain).
Age band:             Everyone from 7 up. Primary category Family (to confirm below); also shows under
                      Explorers (7-10), Challengers (11-16) and Adults.
Core loop:            Take turns drawing one line between two dots; whoever closes a box scores it and goes again;
                      most boxes wins.
Session length:       3x3 boxes: 3-5 min. 4x4: 6-10 min. 5x5: 10-15 min.
Players:              1 vs computer (Easy / Medium / Hard), or 2 on the same phone (pass-the-phone prompt).
How a child learns by doing: The tutorial board is almost full. The child taps a line, closes a box, and sees it
                      count and the turn stay with them. Next, a box with 2 sides drawn: tapping its 3rd side
                      makes the box "glow" as a gift to the rival, so the child sees the trap before reading
                      anything. No paragraphs before acting.
Tutorial plan:        1. Goal: close more boxes than your rival.
                      2. Draw a line (tap between two dots).
                      3. Close a box: it is yours, and you go again.
                      4. The trap: a 3rd side gives your rival the box. Spot the safe line.
                      5. Short practice game on 3x3 vs the Easy bot (optional).
Rewards / progress:   Wins and losses per board size and difficulty, biggest chain taken in one turn
                      (device-only), a few badges (first box, first win, win on Hard, win 5x5, take a chain of 4+).
Content needed:       No levels or question banks. Three board sizes: 3x3, 4x4, 5x5 boxes
                      (4x4, 5x5, 6x6 dots).
Offline check:        Pure rules plus a bot in a Web Worker. No server, no live data. Passes.
Risks / unknowns:     - The bot is the hard part. Hard needs chain logic (long chains, sacrifices), not just
                        "take a box if you can". Researchers disagreed on effort (S vs M), so I treat it as S-M.
                      - Thin lines are hard to tap. Each line gets a large invisible hit area (44px+); at 360px
                        a 5x5 board has about 60px between dots, which fits.
                      - Sacrifices and the "double-cross" are not intuitive; the tutorial teaches the simple trap
                        only, and the Hint button explains advanced moves in one sentence.
                      - First-move advantage exists, so we should offer fair starts (see questions below).
                      - Bot speed on a mid-range Android phone is not measured yet; needs a real-device check.
                      - Colour must not be the only cue for who owns a box: use initials or shapes as well.
Estimated size:       About 12-14 files, 1,800-2,400 lines including tests.
```

## Mascot
Original SVG in the shared family style. Working idea: **Bindu** ("dot" in several Indian languages), a small round dot character with a pencil-line smile who draws the first line in the tutorial. Short bubbles (max about 12 words). Final design at the Mockup step. Grown-ups' games get the same character kept small and dismissible, since this game is for all ages.

## Modes
- vs Computer: Easy / Medium / Hard. Easy sometimes misses a box, so a child can win.
- Two players on one phone: pass-the-phone prompt and a clear "whose turn" indicator.
- Undo and Hint buttons (vs computer only for Hint).
- Not included: online play, accounts, leaderboards, timers.

## Questions for you before the Spec
1. **Category:** I suggest **Family** as the primary home (all ages, two on one phone), with `alsoIn`: Explorers, Challengers, Adults. The alternative is Explorers primary (as in the tracker). Either way it appears in all four lists.
2. **Board sizes:** 3x3 (default for new players), 4x4, 5x5. OK?
3. **Who starts:** the player picks who goes first on 3x3; on larger boards the starter alternates each game. Or do you prefer a fixed rule?
4. **Mascot:** Bindu, OK as a working idea?

## Notes from the research catalogue
- Idea #29. Score 25/30. Effort S-M. Engine cluster A (board game + Worker bot).
- Rules are traditional (credited to Lucas), free to implement. Small boards can be fully searched; boards up to 4x5 boxes are solved as a tie (Barker and Korf, AAAI). Perfect play is not needed for a child-friendly bot, so Hard uses depth-limited search plus chain counting.
- Closest template in this repo: Pallanguzhi (engine.js, Worker bot, tutorial, animate, app.js).
- IP: public-domain pencil-and-paper game. Original art and sound only.
