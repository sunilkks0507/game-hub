# Game Brief: Chaturanga

```
Name:                 Chaturanga (working title; "Chaturanga" is the traditional name, not a brand)
Learning goal:        Plan ahead and calculate threats: look 2-3 moves deep, spot checks, forks and traps.
Age band:             Adults (17+). Also fits Challengers (11-16) and Family (two players on one phone).
Core loop:            Move one piece per turn on an 8x8 board to trap the opponent's Raja, against a bot or a friend.
Session length:       10-25 minutes per game.
Players:              1 vs computer (Easy / Medium / Hard), or 2 on the same phone.
How you learn by doing: The tutorial adds one piece at a time. You tap the piece, see its legal squares light up,
                      and make the move. No paragraphs to read before acting.
Tutorial plan:        1. Goal: trap the enemy Raja.  2. The Raja, Ratha and Ashva move.
                      3. The odd pieces: Mantri (1 step diagonal) and Gaja (2-square diagonal jump).
                      4. The Padati (foot soldier): moves 1, captures diagonally, promotes to Mantri.
                      5. A short practice game vs the Easy bot (optional).
Rewards / progress:   Wins and losses per difficulty, best streak (device-only), and a few badges
                      (first win, win on Hard, win with a promoted Padati, win in under 30 moves).
Content needed:       One starting position. No levels or question banks.
Offline check:        Pure rules plus a bot that runs in a Web Worker. No server, no live data. Passes.
Risks / unknowns:     - Rule variants: many reconstructions of the early game exist. We fix one (see DECISIONS.md).
                      - Bot speed on a mid-range Android phone. Needs real-device timing.
                      - Easy bot must lose sometimes without feeling random.
                      - Touch ergonomics of an 8x8 board at 360px (45px squares). Test on a real phone.
Estimated size:       About 12-15 files, 1,800-2,500 lines including tests.
```

## Notes from the research catalogue
- Idea #76 in the catalogue. Total score 23/30. India fit 5/5. Effort M-L.
- Catalogue caveat: any ruleset is a reconstruction, so the choice is editorial and must be shown on the rules card.
- IP: the rules of an ancient game are free to use. We use original art and our own names for the pieces' icons.
- Existing apps: unverified. Search both stores before the production pass.
