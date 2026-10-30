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
