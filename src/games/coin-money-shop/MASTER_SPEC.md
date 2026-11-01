# MASTER_SPEC: Coin and Money Shop

Status: spec written 1 Nov 2026. Items marked **(default, confirm)** are assumptions recorded in DECISIONS.md.

## 1. Goal
Run a small shop. A customer wants an item; tap rupee coins and notes into the till until the total matches the price, then press Pay. In the last level the customer hands over a note and you give back the right change.

## 2. Success test
A 7-year-old can make Rs 17 with coins within 30 seconds of opening the game and finish a day (8 customers) in about 6 minutes. A 9-year-old can give correct change on Level 3. After a day, a child can say "5 and 2 and 10 make 17" without help.

## 3. Users
- Ages 6 to 10 (`ageMin` 6, `ageMax` 10). Primary category **Explorers**, `alsoIn` empty.
- Mascot: **Gilu**, an original squirrel shopkeeper in the shared mascot family style. Short friendly bubbles (max about 12 words). Never blocks the till; dismissible. **(default, confirm)**
- No profiles. The player picks a level; no age question.

## 4. Scope
**MVP:** engine and tests, three levels, a day of 8 customers, level picker, tutorial, "?" card, day-end result with why, Undo, Hint, sound, stats and badges, save and continue.
**Production:** settings (sound, reduce motion), accessibility pass, grown-up corner behind a gate, privacy note, `game.json`, hub integration, offline check.
**Not included:** timers, scores that punish mistakes, leaderboards, accounts, online play, voice, two-player mode, shopping baskets of several items, decimals or paise, real banknote art.

## 5. Money and the till
- Amounts are whole rupees. Display `₹17`; every amount carries an `aria-label` such as "17 rupees". If the sign fails to render on a test device, fall back to "Rs".
- A **piece** is one coin or note tapped into the till. The till holds at most **12 pieces** (`MAX_PIECES`). A 13th tap gives a soft nudge "The till is full. Tap a piece to take it out." **(default, confirm)**
- Tray per level (pieces never run out):

| Level | Coins | Notes |
|---|---|---|
| 1 Coins | 1, 2, 5, 10 | none |
| 2 Notes | 5 | 10, 20, 50, 100 |
| 3 Change | 1, 2, 5 | 10, 20, 50 |

  So Rs 10 is a coin on Level 1 and a note on Levels 2 and 3. **(default, confirm)** Both exist in India; this keeps trays short.
- Coins are round, notes are wide rectangles. A piece is told apart by **shape, a large numeral and a pattern**, never colour alone. Colours and layouts are our own and do not copy real banknotes.
- State is a plain serialisable object: `{ level, itemId, price, given, pieces, hints }` where `pieces` is the list of values tapped in order and `given` is the note the customer hands over (Level 3 only, otherwise `null`).

## 6. Levels and exact rules
Common: no timer, no failure state, a refused tap or a short Pay gets a friendly nudge, never a penalty.

| Level | Name | Ages | Customer wants | Child does | Prices |
|---|---|---|---|---|---|
| 1 | Coins | 6-8 | one item | taps coins to make the price, presses **Pay** | Rs 1 to 20 (every whole rupee) |
| 2 | Notes | 7-9 | one item | taps coins and notes to make the price, presses **Pay** | Rs 10 to 100 in fives |
| 3 | Change | 8-10 | pays with a note | taps pieces for the **change due** (`given - price`), presses **Give change** | price Rs 1 to 99, change 1 to 60 |

**Pay rules (Levels 1 and 2).** `total` = sum of `pieces`.
- `total === price`: **exact**. The sale completes, shopkeeper smiles, `success` sound.
- `total < price`: **short**. Nudge "A little more!". The sale continues; nothing is lost.
- `total > price`: **over**. **(default, confirm)** The sale completes (the shopkeeper hands back change `total - price`, shown as the fewest pieces) but it is not "exact": it does not count for the exact-sale streak or badges, and no score is lost. The result line says "You paid ₹10 for ₹7. Change ₹3."

**Give-change rules (Level 3).** `due = given - price`. `total` = sum of `pieces`.
- `total === due`: **exact**, sale completes.
- `total < due`: **short**, nudge "A bit more change!".
- `total > due`: **over**, the sale does **not** complete. Nudge "That's too much change." Tap a piece to take it out. (Giving away extra money is never accepted.)

**Generator limits for Level 3.** `given` is a note from {10, 20, 50, 100} with `given > price` and `given - price <= 60`; a price of 40 to 99 can use 100, a price under 10 uses 10, 20 or 50.

**Engine functions** (all pure, no DOM, no `Math.random` without a passed `rng`):
- `trayFor(level)` returns `[{ value, kind }]` in tap order, `kind` `'coin'` or `'note'`.
- `createSale(level, { itemId, price, given })` returns a new state.
- `addPiece(state, value)` returns `{ ok, reason, state }`. Reasons: `full` (12 pieces), `denom` (not in the tray), `done` (sale already settled).
- `removePiece(state, index)` returns the new state (any piece in the till can be taken out).
- `undo(state)` removes the last piece.
- `total(state)`, `target(state)` (price on Levels 1-2, change due on Level 3), `remaining(state)` (`target - total`, never below 0).
- `settle(state)` returns `{ done, kind, diff, change }` where `kind` is `'exact'`, `'short'` or `'over'`, `diff` is `|total - target|`, and `change` is the pieces handed back on an over sale of Level 1-2 (`[]` otherwise).
- `suggest(state)` returns the value of the next piece to try (greedy: the largest tray value not above `remaining`), used by Hint.
- `fewestPieces(amount, tray)` returns the minimum list of tray values that sum to `amount` (dynamic programming), or `null` if impossible. Used for the change handed back and for Hint.
- `makeDay(level, rng, count = 8)` returns `count` customers `{ itemId, price, given }` (see section 7).
- `recordSale(stats, level, { kind, hint, pieces })` returns updated stats (see section 8).
- `mulberry32(seed)` seeded RNG for tests.

## 7. Day generator and items
A **day** is 8 customers at the chosen level.
- The level's allowed price list is split into 8 contiguous chunks; one price is drawn from each chunk with `rng`, then the order is shuffled. So a day always mixes small and big prices and never repeats a price.
- Each customer's item is chosen from the items whose price range contains the price. No two consecutive customers want the same item. Every allowed price has at least 2 items (checked by a test).
- Items (original SVG, name, price range in rupees): Balloon 1-10, Eraser 1-8, Sweet 1-12, Pencil 2-15, Biscuit packet 5-25, Lassi 10-40, Kite 10-60, Notebook 15-80, Mango box 20-100, Toy car 30-100.
- Level 3 draws `given` with `rng` among the valid notes for the price.
- All draws use the passed `rng`.

## 8. Stats, progress and badges
- `stats` = `{ sales, exact, days, bestStreak, levels: { "1": {sales, exact}, "2": {...}, "3": {...} } }`.
- A **clean** sale is exact **without Hint**. Undo does not count against the child.
- Streak = consecutive exact sales within one day. An over sale resets it; a "short" nudge or a Hint does not. `bestStreak` is the highest ever.
- No claims such as "boosts intelligence" appear anywhere.
- Badges: **First sale** (any sale), **Five in a row** (streak of 5 exact), **Note maker** (first sale on Level 2), **Change giver** (first sale on Level 3), **Full day** (finish a day of 8), **Shopkeeper** (finish a day on each of the three levels).

## 9. Hint and Undo
- **Hint:** highlights the tray piece from `suggest(state)` and shows the amount still needed as a number (`remaining`). Counted as help for the clean sale and the no-hint stats.
- **Undo:** removes the last piece tapped. Available until the sale is settled. Tapping a piece inside the till also removes it. (This is the tap alternative; there is no dragging anywhere.)

## 10. Screen flow
Title (Gilu, name, goal, Play, How to play, sound, Settings, Home) -> first Play runs the tutorial -> Level picker (three big icon buttons: Coins, Notes, Change; remembers the last level; all open, no locks) -> Play (8 customers) -> Day-end result dialog (why, stats, badges, Play again / Change level / How to play / Home).
Play screen: customer and item with its price tag (Level 3 also shows the note they handed over), the till with its running total, the tray, **Pay** (or **Give change**), Undo, Hint, "?" and Menu. When a sale completes the item moves to the customer, a coin drops into the jar, and a big **Next customer** button appears. No auto-advance; the child sets the pace.
On Level 3 the till is labelled "Your change" and does **not** show the amount due: the child works out `given - price` from the price tag and the note handed over. Hint reveals it. On Levels 1-2 the till shows only the running total, never the amount still needed, until Hint is used.
On the first visit to Level 3 a one-card "Giving change" explainer shows once (it is not a tutorial step).

## 11. Layout and interaction (360px first)
- Page side padding 12px. Tray buttons are at least 56px high; coins are 64px circles on Levels 1-2 and 56px on Level 3 so six pieces fit; notes are 76px wide by 56px high with 8px gaps, so four notes in a row fit in 336px. All are above the 44px minimum.
- The till shows each piece as a smaller chip that is still a button: coins 44px, notes 60px by 44px, with 2px gaps (found in the mockup check, where a scaled-down chip fell to 35px). Chips wrap, so the till grows from one row to at most three rows (12 notes) without scrolling the page sideways.
- Every tray piece and every till piece is a `<button>` with a label: "5 rupee coin. Tap to add." / "20 rupee note. Tap to add." / "Piece 3 in the till, 5 rupee coin. Tap to take it out."
- Keyboard: Tab to the tray; arrow keys move across it; Enter or Space adds; Backspace or the Undo button removes the last piece; `P` or the Pay button settles.
- Live region announces "Added 5 rupees. Total 12." and on completion "Paid exactly. 17 rupees." or "Change given. 13 rupees."
- Sound (shared `sound.js`, no new sounds): `pick` when a piece is added, `tap` when removed, `success` on an exact sale, `win` at the end of a day, `hint`, `error` (very soft) for a refused tap. Plays after a user tap; mute toggle.

## 12. Tutorial (4 steps)
Led by Gilu, short bubbles. Every step is skippable and replayable. A wrong tap never dead-ends. Built from `createSale(1, { itemId: 'pencil', price: 7 })`.
1. **Goal:** a customer wants a pencil for ₹7; Gilu points at the price tag. Next.
2. **Tap a coin:** tap the glowing ₹5 coin; it drops in and the total reads ₹5. Tapping another coin gets "Try the ₹5 one!" and still works.
3. **Reach the price:** add ₹2; the total matches; press Pay; the sale completes with the success sound.
4. **Practice:** one customer on your own (a ₹9 balloon), with Hint shown as a button to try and a nudge if you tap too many.

## 13. Result screen: say why
After the 8th customer: "You served 8 customers." Plus facts built from the data: how many paid exactly on the first go, the biggest sale and how many pieces you used for it, and on Level 3 how many times you gave change. A line such as "You paid ₹10 for ₹7. Change ₹3." appears for over sales. No score and no win/loss. Offers Play again, Change level, How to play, Home.

## 14. Stored data (localStorage, `hub:coin-money-shop:<name>:v1`)
- `settings`: sound, reduceMotion, level.
- `stats`: see section 8.
- `progress`: shared hub shape `{ gameId, played, won, badges, lastPlayed }`. `played` = days started, `won` = days finished (this game has no losing).
- `saved`: level, the 8 customers, customer index, current pieces, hints used, streak, for continue.
- `tutorialDone`, `changeIntroSeen`.

## 15. Grown-up corner (children's category)
Behind the same addition-question gate as Pallanguzhi and Ten Frame Garden (for example 12 + 27). Shows what the game practises (making amounts, adding money, giving change), that it works offline, that nothing is collected, how to reset device stats, and that the notes and coins are original drawings, not real currency. No external links.

## 16. Files (planned)
`index.html` (Gilu, items, coins, notes and the till are an inline SVG sprite), `css/style.css`, `js/engine.js`, `js/items.js` (item list and price ranges, pure data), `js/view.js` (till, tray, price tag, pair panel), `js/tutorial.js`, `js/app.js`, `icon.svg`, `game.json`, `tests/engine.test.js`, `tests/tutorial.test.js`, `GAME_BRIEF.md`, `MASTER_SPEC.md`. Accent colour `#b45309` (warm amber); contrast to be checked at the Production step.

## 17. Done means
- [ ] Engine rules match section 6; tests pass (`node --test`)
- [ ] `addPiece` refuses a 13th piece, a value not in the tray, and a settled sale
- [ ] `settle` returns exact, short and over correctly on Levels 1-2; Level 3 refuses over and completes on exact
- [ ] `fewestPieces` gives a minimal list for every amount 1 to 100 on the Level 1, 2 and 3 trays (or `null` only where impossible)
- [ ] `makeDay` returns 8 customers, distinct prices, in range, no consecutive repeat item, every price has 2 or more items; Level 3 change is 1 to 60 (seeded tests)
- [ ] `recordSale` counts clean sales, streak and bestStreak; over sales do not count as exact
- [ ] Title, tutorial, "?" card, result-with-why, settings, Home, grown-up corner present
- [ ] Every piece is a labelled button; keyboard play works; 4.5:1 contrast; pieces differ by shape and numeral as well as colour
- [ ] Works at 360px with no horizontal scroll; tray buttons 56px or more
- [ ] The rupee sign renders (or the "Rs" fallback shows) and every amount has an aria-label
- [ ] Offline reload works on the live URL
- [ ] "?" card shows the rules and the level in `ruleVariant`
