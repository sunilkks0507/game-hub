# Five in a Row (Gomoku)

Make five stones in a line before your rival. Offline, no ads, nothing collected.

- Rules and decisions: `MASTER_SPEC.md`, `GAME_BRIEF.md`, and the "Fifth game" section of `/DECISIONS.md`.
- `js/engine.js` rules (pure, no screen code), `js/ai.js` computer opponent (Easy, Medium, Hard), `js/ai.worker.js` runs it off the main thread, `js/board.js` draws the SVG board, `js/tutorial.js` the 5-step guide, `js/app.js` screens and saved game.
- Tests: `node --test src/games/gomoku/tests/*.test.js` (or `npm test` from the repo root).
- Stored on the device only: `hub:gomoku:settings|stats|progress|saved|tutorialDone|lastColour:v1`.
