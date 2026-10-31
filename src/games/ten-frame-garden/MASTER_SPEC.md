# MASTER_SPEC: Ten Frame Garden

Status: spec written 31 Oct 2026. Items marked **(default, confirm)** are assumptions recorded in DECISIONS.md.

## 1. Goal
Fill the ten-frame so both parts make 10. Plant seeds in the empty cells until the frame is full, then see the pair (for example 6 + 4 = 10). A later level uses two frames and makes 20.

## 2. Success test
A 5-year-old can start planting within 30 seconds on the Dots level with no reading, and finish a garden (5 frames) in about 4 minutes. A 7-year-old can say "6 and 4 make 10" after the result screen. An 8-year-old can finish a Bonds to 20 garden.

## 3. Users
- Ages 4 to 8 (`ageMin` 4, `ageMax` 8). Primary category **Explorers**; `alsoIn` Little Ones.
- Mascot: **Pip**, an original green sprout with two leaf arms. Silent on the Dots level (animation and gesture only). Short bubbles (max about 12 words) on the other levels. Never blocks the frame; dismissible.
- No profiles. The player picks a level; no age question.

## 4. Scope
**MVP:** engine and tests, four levels, garden of 5 frames, level picker, tutorial, "?" card, garden result screen with why, Undo, Hint, sound, bond stats and badges, save and continue.
**Production:** settings (sound, reduce motion), accessibility pass, grown-up corner behind a gate, privacy note, `game.json`, hub integration, offline check.
**Not included:** timers, scores that punish mistakes, leaderboards, accounts, online play, voice, two-player mode, number-line mini-mode (Number Line Jumper is a separate catalogue game).

## 5. The frame and the cells
- A **frame** is 10 cells in 2 rows of 5, cell ids 0 to 9 (row 0 = 0-4, row 1 = 5-9). A **board** is 1 frame (levels 1-3) or 2 frames stacked (level 4, ids 0-19, frame 1 = 0-9, frame 2 = 10-19).
- Cell values: `0` empty, `1` given seed (part of the question), `2` child's seed, `3` auto seed (level 3 only, fills the rest after the child plants the target).
- The child may tap **any** empty cell; order is not enforced. (Shape and colour make the two parts visible wherever they sit.)
- State is a plain serialisable object: `{ level, size, cells: number[], target, given, planted }`.

## 6. Levels and exact rules
Common: no timer, no failure, a wrong tap gets a friendly nudge, never a penalty. A frame is **complete** when every cell is non-empty (levels 1, 2, 4) or when the child has planted `target` seeds (level 3). Completion shows the **pair** `[a, b, total]`.

| Level | Name | Ages | Board | What the child sees | Rule |
|---|---|---|---|---|---|
| 1 | Dots | 4-6 | 1 frame | `given` round seeds (1 to 9) already planted. **No numerals anywhere.** A small tray of dots shows how many more are needed only after Hint. | Plant until the frame is full. Pair shown as two seed groups (round vs leaf) with matching dot counts, no numerals. |
| 2 | Fill to 10 | 5-8 | 1 frame | `given` round seeds (1 to 9), question "6 + ? = 10", live counter "6 + 1". | Plant until full. Pair shown as "6 + 4 = 10". |
| 3 | Two parts | 6-8 | 1 frame | Empty frame, a big numeral `target` (1 to 9), "Plant 4". | Plant exactly `target` seeds (leaf shape). Planting one more than the target is refused with a nudge. When `target` is reached, the other `10 - target` cells fill with round auto seeds and the pair shows "4 + 6 = 10". Tapping a planted seed removes it. |
| 4 | Bonds to 20 | 7-8 | 2 frames | Frame 1 full of given seeds, frame 2 has `given - 10` given seeds, `given` in 11 to 19. Question "14 + ? = 20". | Plant until both frames are full. Pair shown as "14 + 6 = 20". **(default, confirm)** Only 11 to 19 are asked, so every frame needs 1 to 9 taps. |

**Engine functions** (all pure, no DOM, no `Math.random` without a passed `rng`):
- `createFrame(level, given)` returns a new state. For level 3, `given` is the target.
- `plant(state, cellId)` returns `{ ok, reason, state }`. Reasons: `filled` (cell not empty), `too_many` (level 3), `done` (frame already complete).
- `unplant(state, cellId)` removes a child's seed (value 2) only; given seeds cannot be removed. Used by Undo and level 3 taps.
- `isComplete(state)`, `needed(state)` (how many seeds still to plant), `pair(state)` returns `[a, b, total]`.
- `bondKey(level, given)` returns the bond id (see section 8).
- `makeGarden(level, stats, rng)` returns 5 `given` values (see section 7).
- `recordFrame(stats, level, given, { hint, undo })` returns updated stats.
- `mulberry32(seed)` seeded RNG for tests.

## 7. Garden generator
A **garden** is 5 frames at the chosen level.
- Values come from the level's range: levels 1-3 use 1 to 9; level 4 uses 11 to 19.
- No two consecutive frames repeat the same value, and a garden never repeats a value while unused values remain in the range.
- Weighting: bonds the child has not seen are drawn first, then seen-but-not-known, then known. Known bonds still appear, but least often. All draws use the passed `rng`.

## 8. Bond knowledge (stats)
- A **bond** is one value in the range of a level group: group "10" has bonds 1 to 9 (shared by levels 1, 2 and 3); group "20" has bonds 11 to 19.
- Status per bond: `0` unseen, `1` seen, `2` known. A frame completes a bond as `seen`. It becomes `known` after **2 frames of that bond completed without Hint**. Undo does not count against the child.
- Stored as `stats.bonds = { "10": [9 numbers], "20": [9 numbers] }`, plus `frames` (total frames done), `gardens` (gardens finished), `noHintGardens`.
- No claims such as "boosts intelligence" appear anywhere.

## 9. Hint and Undo
- **Hint:** pulses the next empty cell once, and shows how many seeds are still needed: a number (levels 2-4) or a tray of dots (level 1, no numerals). Counted as help for "known" and the no-hint badge.
- **Undo:** removes the last seed the child planted (not given seeds). Available any time before completion.

## 10. Screen flow
Title (Pip, name, goal, Play, How to play, sound, Settings, Home) -> first Play runs the tutorial -> Level picker (four big icon buttons: Dots, Fill to 10, Two parts, Bonds to 20; remembers the last level; all levels always open, no locks) -> Play (5 frames) -> Garden result dialog (why, stats, badges, Play again / How to play / Home).
Play screen: goal line (levels 2-4) or dot tray (level 1), garden progress (5 flower slots), the frame(s), counter line, Undo, Hint, "?" and Menu. When a frame completes: the flower grows over the frame (a fade with reduce motion), the pair appears, and a big **Next** button appears. No auto-advance; the child sets the pace.

## 11. Layout and interaction (360px first)
- Page side padding 12px. Levels 1-3: cells are 64px with 4px gaps, so a frame is 336px wide. Level 4 stacks two frames with 52px cells (still 44px or more) so both fit in view.
- Every cell is a `<button>`. Labels: "Cell 7 of 10, empty. Tap to plant a seed.", "Cell 3 of 10, seed from the question.", "Cell 7 of 10, your seed." Given and auto seeds are disabled.
- Keyboard: Tab to the grid; arrow keys move between cells; Enter or Space plants; Backspace or the Undo button removes the last seed.
- Seeds differ by **shape and colour**: given/auto = round seed (brown), child's = leaf-shaped seed (green). Never colour alone.
- Live region announces "Planted. 7 seeds. 3 more." and, on completion, "6 plus 4 makes 10."
- Sound (shared `sound.js`, no new sounds): `seed(step)` for each planted seed (pitch rises as the count grows, so counting is audible), `success` when a frame is full, `win` at the end of a garden, `hint`, `tap`, `error` for a refused tap (very soft).

## 12. Tutorial (5 steps)
Led by Pip, silent on the Dots level; on other levels short bubbles. Every step is skippable and replayable. A wrong tap never dead-ends.
1. **Goal:** the frame has some seeds and empty cells; Pip points at the empty cells. Next.
2. **Plant a seed:** tap a glowing empty cell; the seed grows with a sound and the counter reads "6 + 1". Tapping a full cell gives "Try an empty one!".
3. **Fill the frame:** keep planting; when full the flower grows and the pair "6 + 4 = 10" shows with round and leaf seeds.
4. **Practice:** one frame on your own with a nudge if you tap a full cell; Hint shown as a button to try.
5. **Badges and levels (optional):** one screen showing the four level icons and the first badge.
Tutorial positions are built with `createFrame(2, 6)`. The tutorial runs on the level 2 look, with numerals hidden when the first-time level is Dots.

## 13. Result screen: say why
After the 5th flower: "Your garden has 5 flowers." Plus facts built from the data: the new bonds seen this garden (as pairs, e.g. "7 + 3, 4 + 6"), frames done without a hint, and bonds now known of 9 (or of 9 for 20). No score, no win/loss. Level 1 shows the same facts using dot groups instead of numerals. Offers Play again, Change level, How to play, Home.

## 14. Stored data (localStorage, `hub:ten-frame-garden:<name>:v1`)
- `settings`: sound, reduceMotion, level.
- `stats`: see section 8.
- `progress`: shared hub shape `{ gameId, played, won, badges, lastPlayed }`. `played` = gardens started, `won` = gardens finished (this game has no losing).
- `saved`: level, the 5 `given` values, frame index, current cells, hints used, for continue.
- `tutorialDone`.

## 15. Badges
First flower (first frame completed), Full garden (finish a garden of 5), Every bond to 10 (all nine bonds seen at least once), No-hint garden (finish a garden without Hint), Twenty (first frame finished on Bonds to 20).

## 16. Grown-up corner (children's category)
Behind the same addition question gate as Pallanguzhi (for example 12 + 27). Shows what the game practises (number bonds to 10 and 20, the "make ten" idea), that it works offline, that nothing is collected, and how to reset device stats. No external links.

## 17. Files (planned)
`index.html`, `css/style.css`, `js/engine.js`, `js/board.js` (frame render and keyboard), `js/mascot.js` (Pip SVG), `js/tutorial.js`, `js/app.js`, `icon.svg`, `game.json`, `tests/engine.test.js`, `tests/tutorial.test.js`, `GAME_BRIEF.md`, `MASTER_SPEC.md`. Accent colour `#2f7d32` (garden green); given-seed brown `#8a5a2b`. Contrast to be checked at the Production step.

## 18. Done means
- [ ] Engine rules match section 6; tests pass (`node --test`)
- [ ] `createFrame`/`plant`/`unplant`/`pair` right for all four levels; level 3 refuses the (target + 1)th seed
- [ ] Every frame's pair sums to 10 (levels 1-3) or 20 (level 4)
- [ ] `makeGarden` returns 5 values in range, no consecutive repeats, no repeat while unused values remain, weights unseen bonds first (seeded test)
- [ ] `recordFrame` marks bonds seen then known after 2 hint-free frames
- [ ] Level 1 shows no numerals anywhere (checked in the DOM)
- [ ] Title, tutorial, "?" card, result-with-why, settings, Home, grown-up corner present
- [ ] Every cell is a labelled button; keyboard play works; 4.5:1 contrast; seeds differ by shape as well as colour
- [ ] Works at 360px with no horizontal scroll; cells 64px (levels 1-3), 52px (level 4)
- [ ] Offline reload works on the live URL
- [ ] "?" card shows the rules and the level in `ruleVariant`
