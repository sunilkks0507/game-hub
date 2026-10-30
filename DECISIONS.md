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
