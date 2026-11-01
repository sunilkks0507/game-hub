# Game Brief: Coin and Money Shop

```
Name:                 Coin and Money Shop (original name; catalogue #25)
Learning goal:        Make an exact amount of money with rupee coins and notes, then give
                      change. One skill: counting and adding money.
                      Curriculum anchor: Common Core 2.MD.C.8 (word problems with money).
                      That standard uses US coins, so the rupee version is an adaptation.
                      India NCERT / NEP foundational stage mapping is NOT verified yet
                      (catalogue gap).
Age band:             6-10. Primary category Explorers (7-10); ages in game.json 6 to 10.
Core loop:            A customer picks an item with a rupee price; tap coins and notes into the
                      till until the total matches, then press Pay. Later levels reverse it:
                      the customer hands over a note and you give back the right change.
Session length:       One "day at the shop" = 8 customers, about 5-8 minutes.
Players:              1 player. No computer opponent. (Pass-the-phone Family mode is a later
                      idea, not in v0.1.0.)
How a child learns by doing:
                      The child never reads a rule. The price tag shows Rs 17; each coin tapped
                      into the till makes the till total grow (Rs 5, Rs 10, Rs 12...). When the
                      total matches, the shopkeeper smiles and the sale completes. Overpaying is
                      not a failure: the shopkeeper hands back change and shows how much.
Tutorial plan (4 steps):
                      1. Goal: meet the shopkeeper; a customer wants one item, see the price.
                      2. Tap a coin: it drops into the till and the total changes.
                      3. Reach the price: the total matches, press Pay, the sale completes.
                      4. Practice: one sale on your own, with the Hint button shown to try.
Rewards / progress:   A coin jar that fills as sales are made, plus a day-end summary.
                      Device-only stats: sales, exact sales, best streak. Badges: first sale,
                      five exact in a row, first note payment, first change given, full day,
                      all three levels.
Content needed:       No question bank file. A seeded generator builds each day from price
                      lists and an item list (about 10 original SVG items). Three levels:
                        L1 Coins:  prices Rs 1-20, coins 1, 2, 5, 10.
                        L2 Notes:  prices Rs 10-100 in fives, coin 5 and notes 10, 20, 50, 100.
                        L3 Change: customer hands over a note, give back the difference.
Offline check:        Pure rules plus a generator and inline SVG. No server, no live data, no
                      Worker needed. Passes.
Risks / unknowns:
                      - Note art must be original and abstract. No copy of real banknote designs
                        (RBI rules on reproduction are unverified), so colours, patterns and
                        layout are our own and always carry a big numeral.
                      - The rupee sign may not render on very old Android fonts; test it and
                        keep an aria-label "rupees" on every amount.
                      - Drill fatigue: vary items and prices across the day; no timer, no
                        failure state.
                      - Level 3 (change) is the hardest idea; show the difference clearly and
                        let a Hint reveal the amount.
Estimated size:       About 12 files, 1,300 lines, 30-40 engine tests. Medium build.
```
