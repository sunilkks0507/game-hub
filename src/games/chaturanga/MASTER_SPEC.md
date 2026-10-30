# MASTER_SPEC: Chaturanga

Version 0.1, 30 Oct 2026. Status: spec approved to build; nothing built yet.

## 1. Goal
A free, offline, installable PWA where one or two people play the ancient Indian ancestor of chess on a phone.

## 2. Success test
A first-time adult opens the game on a 360px phone with no network, and within 30 seconds understands the goal, makes a legal move and sees the bot reply. They can finish a whole game without reading a manual.

## 3. Users
- Adults who like strategy and classic or traditional games.
- Teenagers (11-16) who want real depth.
- Two people sharing one phone.

## 4. Scope
**MVP**
- Rules engine with full legal-move generation, check, checkmate, stalemate, bare Raja, promotion, draws.
- Play screen: tap a piece, see legal squares, tap a square to move. Last-move highlight. Undo.
- Vs computer (Easy / Medium / Hard) and two players on one phone.
- Settings: sound on/off, difficulty, reduced motion.
- Synthesised sound.
- Progress saved on the device.

**Production**
- 5-step tutorial, "?" rules card, result screen that says why.
- Hint button, move list, flip board for two players.
- Offline service worker, manifest, icons, `game.json`, privacy note.
- Accessibility pass, keyboard play, real-device timing.

**Not included**
- Online play, accounts, ratings, leaderboards, ads, timers (a clock may come later as an option).
- Opening books, engine analysis, puzzle packs.
- Other chess variants.

## 5. Screen flow
Title screen -> (first visit) Tutorial -> Setup (mode, difficulty, side) -> Play -> Result -> Play again / How to play / Home.
Menu from Play: How to play, Settings, Resign, Home. "?" opens the rules card.

## 6. Exact rules (the rule set chosen)
**Board:** 8x8. White at the bottom, moves first. Columns a-h, rows 1-8.

**Start position (White; Black is mirrored):**
- Row 1: Ratha a1, Ashva b1, Gaja c1, Mantri d1, Raja e1, Gaja f1, Ashva g1, Ratha h1.
- Row 2: eight Padati.

**Pieces**
| Piece | Replaces in chess | Moves |
|---|---|---|
| Raja | King | 1 square in any direction. No castling. |
| Mantri | Queen | 1 square diagonally. |
| Gaja | Bishop | Jumps exactly 2 squares diagonally. Can jump over a piece in between. |
| Ashva | Knight | Knight move (L-shape), jumps. |
| Ratha | Rook | Any number of squares along a row or column, no jumping. |
| Padati | Pawn | 1 square forward (no double step). Captures 1 square diagonally forward. |

**Capture:** move onto an enemy piece to remove it. All pieces capture the way they move, except the Padati.

**Promotion:** a Padati reaching the far row becomes a Mantri.

**Check:** a Raja attacked by an enemy piece is in check. A player must never leave their own Raja in check. No en passant. No castling.

**Ending the game**
- **Checkmate:** you are in check and have no legal move. You lose.
- **Stalemate:** you are not in check and have no legal move. You lose (the shatranj tradition). Shown clearly on the result screen, since modern chess players will expect a draw.
- **Bare Raja:** if a player has only their Raja left, that player loses. Exception: if both players have only a Raja, the game is a draw.
- **Draws:** the same position (with the same side to move) three times; or 100 half-moves with no capture and no Padati move.
- **Resign:** ends the game as a loss.

## 7. Engine design (`engine.js`, no DOM)
- State: 64-cell array, side to move, half-move counter, position history (for repetition), move history (for undo).
- API: `newGame()`, `legalMoves(state)`, `legalMovesFrom(state, square)`, `applyMove(state, move)`, `undo(state)`, `status(state)` (returns `playing`, `checkmate`, `stalemate`, `bare`, `draw-repetition`, `draw-50`, `draw-bare`), `inCheck(state, side)`, `toKey(state)`.
- Moves are plain objects: `{from, to, piece, captured, promotion}`.
- Pure and deterministic. No randomness inside the engine.

## 8. Bot (`ai.js`, runs in a Web Worker)
- Alpha-beta search with iterative deepening and a time cap (default 1.5 s).
- Evaluation: material (Ratha 5, Ashva 3, Gaja 2, Mantri 2, Padati 1, plus a promotion bonus) plus small position bonuses, plus a mobility term.
- Levels: Easy (depth 1-2, picks among the top 3 moves at random), Medium (depth 3), Hard (depth 4-5 within the time cap).
- Messages: `{type:'think', state, level}` in, `{type:'move', move}` out. Must never block the main thread.

## 9. Stored data (all keys `hub:chaturanga:<name>:v1`)
- `settings`: sound, difficulty, reducedMotion, lastMode.
- `progress`: `{gameId, played, won, badges, lastPlayed}` in the hub shape.
- `stats`: wins, losses, draws per difficulty, best win streak.
- `savedGame`: current position and history so a game can be continued.

## 10. Interaction and accessibility
- Tap a piece to select it; legal squares show a dot (and a ring for captures, so colour is not the only cue). Tap a square to move. Tap elsewhere to deselect.
- No dragging needed anywhere.
- Squares are at least 44px at 360px width (board 360px wide, squares 45px).
- Pieces use distinct shapes as well as light and dark fills. Each square has an ARIA label such as "e2, White Padati".
- Keyboard: arrow keys move focus, Enter selects, Escape deselects.
- Respect reduced motion: no sliding animation, simple fades.
- A line of text announces the last move and whose turn it is.

## 11. Visual direction
Restrained, adult look. Warm neutral board, one accent colour from the shared tokens (`--accent`), SVG pieces drawn for this project. An emblem (a small stylised Ratha) replaces a cartoon mascot, per the onboarding standard.

## 12. `game.json` (target)
```json
{
  "id": "chaturanga",
  "name": "Chaturanga",
  "tagline": "The ancient game of kings",
  "category": "adults",
  "ageMin": 11,
  "ageMax": 99,
  "skills": ["strategy", "planning", "calculation"],
  "players": "1-2",
  "minutesPerSession": 15,
  "accent": "#8C3B1E",
  "icon": "icon.svg",
  "entry": "index.html",
  "version": "0.1.0",
  "goal": "Trap the enemy Raja so it cannot escape.",
  "howToWin": "Checkmate the enemy Raja, stalemate it, or capture every other enemy piece.",
  "controls": "tap",
  "difficulty": ["easy", "medium", "hard"],
  "ruleVariant": "Shatranj-style: no queen or bishop, no castling, no pawn double step, stalemate is a win.",
  "about": "Chaturanga is the Indian ancestor of chess, played over 1,400 years ago.",
  "tutorialSteps": 5,
  "mascot": "emblem-ratha"
}
```

## 13. Build steps (commit after each)
1. Scaffold folders, `game.json`, shared tokens. (`chore:`)
2. `engine.js` and tests: piece moves, check, checkmate, stalemate, bare Raja, promotion, repetition, undo. (`feat:`)
3. Static play screen with board render and tap-to-move for two players. (`feat:`)
4. `ai.js` Worker bot, three levels, timing test. (`feat:`)
5. Result screen, settings, saved game, stats. (`feat:`)
6. Tutorial, "?" card, hint, emblem. (`feat:`)
7. Synthesised sound. (`feat:`)
8. Hub shell, root service worker, manifest, icons, offline test. (`feat:`)
9. GitHub Actions: run tests, then deploy to Pages. (`chore:`)
10. Real-phone test at 360px, notes into `DECISIONS.md`. (`docs:`)

## 14. Done means
- [ ] All engine tests pass with `node --test`.
- [ ] A full game vs each bot level can be played to the end.
- [ ] Hard bot replies in under 2 seconds on a mid-range Android phone.
- [ ] Works with the network switched off after the first load.
- [ ] Every item in the Game Onboarding Standard checklist passes.
- [ ] 360px layout, 44px+ targets, 4.5:1 contrast, keyboard play, reduced motion.
- [ ] No external requests at runtime (check the network panel).
- [ ] One new player watched, with notes in `DECISIONS.md`.
