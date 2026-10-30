# Game Brief: Pallanguzhi

```
Name:                 Pallanguzhi (traditional South Indian name, not a brand)
Learning goal:        Counting seeds ahead of time: work out where a handful will land, and plan captures.
Age band:             Explorers (7-10). Also fits Challengers (11-14) and Family (two players on one phone).
Core loop:            Pick a pit, sow its seeds one by one round the board, and capture seeds by the rules, against a bot or a friend.
Session length:       8-15 minutes per game.
Players:              1 vs computer (Easy / Medium / Hard), or 2 on the same phone.
How a child learns by doing: The tutorial starts with a board of a few seeds. The child taps a pit, watches the
                      seeds drop one by one (with a count), and sees where the last seed lands.
                      No paragraphs to read before acting.
Tutorial plan:        1. Goal: collect more seeds than the other player.
                      2. Tap a pit and watch the seeds sow, one per pit, with a counter.
                      3. Where the last seed lands decides what happens next (continue or capture).
                      4. Capture: make a capture on a guided board.
                      5. A short practice game vs the Easy bot (optional).
Rewards / progress:   Wins and losses per difficulty, most seeds captured in one turn (device-only), and a few badges
                      (first win, win on Hard, first capture, win by 20+ seeds).
Content needed:       One starting position. No levels or question banks.
Offline check:        Pure rules plus a bot in a Web Worker. No server, no live data. Passes.
Risks / unknowns:     - Rule variants: starting seeds, capture and refill rules differ by region. We fix one rule set and
                        show it on the "?" card. See "Rule set to confirm" below.
                      - Bot speed on a mid-range Android phone. Needs real-device timing.
                      - Easy bot must lose sometimes without feeling random.
                      - Sowing animation must be clear at 360px but skippable, and respect reduced motion.
                      - Counting is the learning goal, so show a running count while sowing.
Estimated size:       About 12-14 files, 1,500-2,200 lines including tests.
```

## Mascot
Explorers game, so a friendly original SVG mascot in the shared family style, with short bubbles (max about 12 words). Working idea: a small seed-keeper character. Final design at the Mockup step.

## Rule set to confirm (needed at the Spec step)
Regional versions differ, and the catalogue flags this as the main risk. I will propose one simple, well-known 2x7 rule set in the Spec, record it in `DECISIONS.md`, and show it on the "?" card and in `ruleVariant`. Nothing is decided until you approve it there.

## Modes
- vs Computer: Easy / Medium / Hard.
- Two players on one phone: pass-the-phone prompt and a clear "whose turn" indicator.
- Not included: online play, accounts, leaderboards.

## Notes from the research catalogue
- Idea #27. Total score 26/30. India fit 5/5. Effort M. Engine cluster A (board game + Worker bot).
- Reuses the Huli Meke `engine.js` plus Worker `ai.js` pattern; this repo's Chaturanga game is the closest template.
- IP: traditional game, rules are free. Original art and sound only.
