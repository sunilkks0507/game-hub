# Game Brief: Ten Frame Garden

```
Name:                 Ten Frame Garden (original name; "ten frame" is a generic teaching tool)
Learning goal:        Number bonds to 10: see how many are there and how many more make 10
                      (7 and 3, 4 and 6). Later: bonds to 20 using two frames.
                      Curriculum anchor: Common Core K.OA.A.4 (find the number that makes 10 when
                      added to the given number). UK EYFS and India NCERT/NCF mappings are not
                      verified yet (catalogue gap).
Age band:             4-8. Primary category Explorers (7-10), also fits Little Ones (4-6) through an
                      easy "dots only" level. Ages in game.json: 4 to 8.
Core loop:            A ten-frame shows some seeds already planted; tap the empty cells to plant the
                      rest until the frame is full, then a flower grows and the number pair is shown.
Session length:       One garden = 5 frames, about 3-5 minutes. Play as many gardens as you like.
Players:              1 player. No computer opponent, no two-player mode.
How a child learns by doing:
                      The child never reads a rule. The frame shows 6 seeds; the empty cells pulse
                      softly; a tap plants a seed and a small counter shows "6 + 1". When the frame
                      is full, the flower grows and the pair "6 + 4 = 10" lights up. The child has
                      discovered the bond by filling the gap, not by being told.
Tutorial plan:        1. Goal: fill the whole frame (mascot waves at the empty cells).
                      2. Tap an empty cell to plant a seed.
                      3. The pair appears: "6 + 4 = 10" with the seeds in two colours.
                      4. A short practice frame on your own (a nudge if you tap a full cell).
                      5. Optional: how to earn badges and unlock "Bonds to 20".
Rewards / progress:   A flower per finished frame in a garden that fills up on screen. Device-only
                      stats: frames done, which bonds you know (a 0-10 grid of number pairs),
                      streak of frames without help. Badges: first flower, a full garden, all bonds
                      to 10 once, no-hint garden, bonds to 20 unlocked.
Content needed:       No levels file, no question bank. A seeded question generator (pure engine)
                      builds frames. Four levels:
                        L1 "Dots": frame shows dots only, no numerals (ages 4-6).
                        L2 "Fill to 10": numerals shown ("6 + ? = 10").
                        L3 "Two parts": split 10 seeds into two colours and see the pair.
                        L4 "Bonds to 20": two frames, make 20 (unlocks after L2 or on request).
Offline check:        Pure rules plus a generator. No server, no live data, no Worker needed.
                      Passes.
Risks / unknowns:
                      - Drill fatigue. Keep gardens short, vary the starting numbers, let flowers
                        and the garden be the reward. No timers, no failure states.
                      - No voice, so the Little Ones level has no text at all: dots and numerals
                        only, silent mascot. The mascot tone for Explorers uses short bubbles
                        (max about 12 words).
                      - Tap target size: a 5-column frame with 64px cells is 336px wide with 4px
                        gaps, which just fits 360px with 12px page padding. To be checked at the
                        mockup step. Bonds to 20 stacks two frames, so it needs vertical room.
                      - One game spans two age bands (4-6 and 7-8). Decision needed on how the
                        player picks a level (see questions). 64px targets everywhere keeps the
                        younger band safe.
                      - Learning evidence is modest. Practising one named skill is supported;
                        no claims of "boosting intelligence" anywhere in the copy.
                      - Colour must not be the only cue: the two parts of a bond differ by seed
                        shape (round vs. leaf) as well as colour.
Estimated size:       About 12 files, 1,200-1,600 lines including tests.
```

## Mascot
Original SVG in the shared family style. Working idea: **Pip**, a small green sprout with two leaf arms and a cheerful face. Silent in Little Ones level (animation and gesture only); short friendly bubbles in the Explorers levels. Never blocks the frame and can be dismissed. Final design at the Mockup step.

## Modes
- Garden of 5 frames at the chosen level, repeat as often as wanted.
- Hint: highlights how many cells are still empty (no spoken answer).
- Undo: take back the last seed.
- Not included: timers, scores that punish mistakes, leaderboards, accounts, online play, voice.

## Questions for you before the Spec
1. **Category:** Explorers primary, `alsoIn` Little Ones, as in the tracker. OK? (This means the "Dots" level must work with no reading at all.)
2. **Levels:** four levels as above (Dots, Fill to 10, Two parts, Bonds to 20). Or ship only bonds to 10 first (L1-L3) and add bonds to 20 later?
3. **Choosing a level:** a simple level picker on the title screen (four big icon buttons), no age question and no profile. OK?
4. **Mascot:** Pip the sprout, OK as a working idea?
5. **Number Line Jumper (#31)** was suggested in the catalogue as a mini-mode inside this game. I suggest leaving it out of v0.1.0 and treating it as its own game later. OK?

## Notes from the research catalogue
- Idea #2. Score 27/30 (highest). Effort S. Engine cluster E (question bank).
- Existing similar apps: Todo Math covers counting and addition; drill fatigue is the known weakness.
- IP: original name and art. No known owner.
- Closest template in this repo: Dots and Boxes (shell, tutorial, mascot, badges, app.js). No bot to copy; the generator replaces it.
