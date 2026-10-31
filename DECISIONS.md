# DECISIONS

Three lines each: what, why, date.

## Hub
- **Repo:** new repo `game-hub`, separate from Huli Meke and Pebble Pals.
  Keeps the hub clean; existing games join later after their clean-up.
  30 Oct 2026

- **Delivery:** PWA now, Google Play later (wrap the PWA).
  Designed for the wrapper from day one: valid manifest, root service worker, no popups.
  30 Oct 2026

- **Integration: Option A, separate pages.** Each game is a standalone page under `/games/<id>/`; the hub links to it.
  Lowest risk and easiest to add one game at a time. Revisit only if switching speed or shared state hurts.
  30 Oct 2026

- **No profiles or accounts.** Progress is per game, per device, in `localStorage`.
  Keeps the app compliant with children's privacy rules by construction.
  30 Oct 2026

- **Build here, not locally.** Spec, engine, tests, bot and deploy workflow are built in the cloud session and pushed to GitHub.
  Move to local Claude Code only for real-device debugging or the Play Store wrapper.
  30 Oct 2026

## First game: Chaturanga
- **Game choice:** Chaturanga (ancient Indian chess, catalogue #76), a pure thinking game.
  Most complex strategy build in the catalogue (M-L) and the strongest India heritage fit.
  30 Oct 2026

- **Category:** Adults (also fits Challengers and Family). Restrained emblem, no cartoon mascot.
  Follows the onboarding standard for adults.
  30 Oct 2026

- **Rule set (default, confirm):** 8x8 shatranj-style reconstruction. No queen, no bishop, no castling, no en passant, no pawn double step.
  Many reconstructions exist, so this is an editorial choice. Full rules in `src/games/chaturanga/MASTER_SPEC.md`.
  30 Oct 2026

- **Result rules (default, confirm):** win by checkmate, by stalemating the opponent, or by leaving the opponent with only a Raja. Draw by repetition, 100 half-moves without a capture or Padati move, or both sides bare.
  Matches the historical shatranj tradition. Counter-bare-king draw is left out for simplicity.
  30 Oct 2026

## Second game: Pallanguzhi
- **Game choice:** Pallanguzhi (catalogue #27), the traditional South Indian seed-sowing game. Chosen by Sunil from three options.
  Best India fit (26/30), reuses the engine + Worker bot pattern, and teaches counting ahead.
  30 Oct 2026

- **Category:** Explorers (7-14), also Challengers and Family. Mascot Bija, an original seed character.
  Modes: vs computer (Easy/Medium/Hard) and two players on one phone. No online play.
  30 Oct 2026

- **Rule set (default, confirm):** "Simple classic": 7 pits each, 5 seeds per pit, sow counter-clockwise, relay when the next pit is full, capture the pit after an empty pit, one game with no refill rounds.
  Regional versions differ (start seeds, capture, refill rounds). Full rules in `src/games/pallanguzhi/MASTER_SPEC.md` section 6 and on the "?" card. Confirm or change before child-testing.
  30 Oct 2026

- **Game end and safety limits:** the game ends when the player to move has no seeds; leftover seeds go to the row's owner. Also ends after 60 turns with no capture, and a relay chain stops after 300 relays.
  Stops endless games. Never seen in 150 random playouts, but the limits keep the game from getting stuck.
  30 Oct 2026

- **Bot levels:** Easy plays a random pit 40% of the time, otherwise greedy; Medium looks 3 moves ahead; Hard looks up to 7 moves ahead within 1.5 s.
  Tests show Medium and Hard beat a random player; Easy sometimes loses so a child can win.
  30 Oct 2026

- **Slow sowing, with a speed-up:** seeds drop one by one with a running count (the learning goal is counting). Tapping the board speeds it up, long chains speed up on their own, and reduce motion skips it.
  Keeps the counting visible without making long relay chains tedious.
  30 Oct 2026

- **Grown-up gate:** a simple addition question (for example 12 + 27) in front of the "For grown-ups" corner.
  Works with keyboard and screen readers, unlike press-and-hold. The corner has no external links.
  30 Oct 2026

- **No separate mockup file:** the real screens were built directly and checked at 360px with screenshots.
  The game is small enough that a throwaway mockup would duplicate the work. Sunil asked for the full game in one go.
  30 Oct 2026

- **Shared sound:** added `seed` and `pick` sounds to `src/shared/sound.js`; `play(name, arg)` now passes an optional argument.
  Existing sounds are unchanged, so Chaturanga is not affected.
  30 Oct 2026

## Third game: Dots and Boxes
- **Game choice:** Dots and Boxes (catalogue #29), chosen by Sunil from three options (with Nim and Four in a Row) as a game both children and adults enjoy.
  Simple to start, real chain strategy for adults, and it reuses the engine + Worker bot pattern.
  31 Oct 2026

- **Category:** Family primary, also Explorers, Challengers and Adults. Ages 7 and up. Mascot Bindu, small and dismissible.
  Sunil asked for a game for both audiences, so the all-ages category leads. Agreed with the recommendation.
  31 Oct 2026

- **Boards and start:** 3x3, 4x4 and 5x5 boxes. On 3x3 the player picks who starts; on larger boards the starter alternates each game.
  Moving first changes the odds on this game, so the choice is kept fair and simple.
  31 Oct 2026

- **Rule set (default, confirm):** classic rules. Close a box and go again; most boxes wins; no pie rule, no timers. Full rules in `src/games/dots-and-boxes/MASTER_SPEC.md` section 6.
  3x3 and 5x5 cannot tie; 4x4 can.
  31 Oct 2026

- **Bot levels (default, confirm):** Easy plays a random line 30% of the time; Medium takes boxes, avoids third sides and gives away the smallest chain; Hard adds chain control and a 1.5 s search.
  Easy must be beatable by a child; Hard should challenge an adult. Phone timings are not measured yet.
  31 Oct 2026

- **Tap areas:** each line has a diamond-shaped hit area of at least 44px; keyboard play with arrow keys.
  Thin lines are hard to tap, especially at 5x5 on a 360px screen.
  31 Oct 2026

- 31 Oct 2026: Dropped `chains.js`. Hard is an exact memoised solver once 19 or fewer lines are left; before that it plays Medium. Reason: simpler, provably best at the end, about 200 ms on 5x5.
- 31 Oct 2026: Safe-line helper setting is Auto/Always/Never; Auto means on for Easy only. Reason: lets a child learn the "third side" idea, then turn it off.
- 31 Oct 2026: Verified (Dots and Boxes v0.1.0): 125 tests pass (`npm test`); played in Chromium at 360px (tutorial, vs computer to a finished game, two-player 5x5, undo, keyboard arrows, save and continue, hint, rules): no console errors, no horizontal scroll. NOT tested: a real phone, a real child, Hard speed on a slow phone.
- 31 Oct 2026: Added boards 6x6 to 10x10 (asked by Sunil). Dot gap never goes below 44px, so boards from 7x7 slide sideways inside their frame; the page never scrolls sideways. Hard still only solves the last 19 lines, so on big boards it plays like Medium until the end.

## Fourth game: Ten Frame Garden
- **Game choice:** Ten Frame Garden (catalogue #2, launch order 1), chosen by Sunil from four options.
  Highest score (27/30), small build, Common Core K.OA.A.4 anchor, proves the question-bank engine and Little Ones design rules.
  31 Oct 2026

- **Category and levels:** Explorers primary, also Little Ones, ages 4-8. Four levels: Dots (no numerals), Fill to 10, Two parts, Bonds to 20. All open, no locks.
  Sunil said to go with the recommendations. A locked level would block a child who is ready, and there are no profiles to unlock against.
  31 Oct 2026

- **Level picker, mascot, scope:** four big icon buttons on the title flow, no age question. Mascot Pip, a green sprout, silent on the Dots level. Number Line Jumper stays out of v0.1.0.
  Keeps one game usable from 4 to 8 with no profile and no reading on the youngest level.
  31 Oct 2026

- **Bonds to 20 range (default, confirm):** only 11 to 19 are asked, so each frame needs 1 to 9 taps. Cells are 64px on levels 1-3 and 52px on level 4 so two frames fit at 360px.
  Asking 1 to 9 on two frames would need up to 19 taps and tire the child. 52px is still above the 44px minimum and level 4 is for ages 7-8.
  31 Oct 2026

- **Bond knowledge (default, confirm):** a bond is "known" after 2 frames without a hint; the generator draws unseen bonds first.
  Practice goes to the weak bonds without a score or a failure state. Device-only, no profile.
  31 Oct 2026

- **Mockup step kept:** a 360px mockup is built and shown before the engine, because this game is for the youngest children and the tap size and frame layout are the risk.
  Unlike Pallanguzhi, where the screens were built directly.
  31 Oct 2026

## Watching real players
Notes from watching a new player try each game go here (Step 7 of the workflow).

## 2026-10-30 Precache everything
The hub precaches the shell and every game on first load (about 30 files, well under 1 MB), so a game works offline immediately. Revisit with a "Download for offline" button once games get large.

## 2026-10-30 One game, two categories
Chaturanga is listed under Adults, and also shows under Challengers and Family via `alsoIn` in game.json.

## 2026-10-30 Coordinate letters on the board
The small a-h and 1-8 labels on the board edge are decorative and hidden from screen readers. They are an exception to the 16px text rule because they sit inside squares.

## 2026-10-30 Verified
Live at https://sunilkks0507.github.io/game-hub/. 51 tests pass and gate the deploy. 29 files precached; offline reload and tutorial board checked in Chromium. 360px layout has no horizontal scroll. Not yet tested on a real phone.

## 2026-10-30 Service worker must change to update
Found while checking the live site: sw.js never changed between deploys, so a browser that already had the hub kept its old game list and never saw Pallanguzhi. The build now stamps a fingerprint line into sw.js, so every content change makes browsers reinstall. A test checks the stamp.

## 2026-10-30 Verified (Pallanguzhi)
Live at https://sunilkks0507.github.io/game-hub/games/pallanguzhi/index.html. 81 tests pass and gate the deploy. In Chromium at 360px: no horizontal scroll, tutorial, full game vs computer, two-player, undo, hint, give up, grown-up gate, continue after reload, and offline play all worked with no console errors. Live hub list and game page confirmed after clearing the old cache. NOT tested: a real phone, a real child (Step 7 stays unticked), the update path for a browser holding the old service worker (fixed above, check after deploy).
