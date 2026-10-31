// Pebble Pals uses plain global scripts (window.GameEngine), so the engine is loaded in a small sandbox.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = new URL('../js/', import.meta.url);
function load(file, sandbox) {
  vm.runInContext(readFileSync(new URL(file, here), 'utf8'), sandbox, { filename: file });
}
function sandbox() {
  const ctx = vm.createContext({ window: {}, console });
  load('engine.js', ctx);
  return ctx.window;
}

const two = () => [
  { id: 1, colorId: 'ocean-blue', isBot: false },
  { id: 2, colorId: 'coral-red', isBot: false },
];

test('themes exist and the engine starts with an empty board and player one to move', () => {
  const { GameEngine, THEMES } = sandbox();
  assert.ok(Object.keys(THEMES).length >= 6);
  const g = new GameEngine({ boardSize: 5, players: two() });
  assert.equal(g.stones.length, 5);
  assert.ok(g.stones.every((row) => row.length === 5 && row.every((c) => c === null)));
  assert.equal(g.getCurrentPlayer().id, 1);
});

test('a move places a pebble and passes the turn; an occupied spot is refused', () => {
  const { GameEngine } = sandbox();
  const g = new GameEngine({ boardSize: 5, players: two() });
  assert.equal(g.playMove(2, 2).success, true);
  assert.equal(g.stones[2][2].colorId, 'ocean-blue');
  assert.equal(g.getCurrentPlayer().id, 2);
  const again = g.playMove(2, 2);
  assert.equal(again.success, false);
  assert.match(again.reason, /occupied/i);
});

test('out-of-bounds moves are refused', () => {
  const { GameEngine } = sandbox();
  const g = new GameEngine({ boardSize: 5, players: two() });
  assert.equal(g.playMove(-1, 0).success, false);
  assert.equal(g.playMove(5, 5).success, false);
});

test('surrounding a pebble captures it', () => {
  const { GameEngine } = sandbox();
  const g = new GameEngine({ boardSize: 5, players: two() });
  g.playMove(0, 1); // blue
  g.playMove(0, 0); // red in the corner
  g.playMove(1, 0); // blue closes the last liberty
  assert.equal(g.stones[0][0], null, 'the red corner pebble should be gone');
  assert.equal(g.poppedCounters['ocean-blue'], 1, 'the capturer is credited');
});

test('undo takes back a move and restores whose turn it is', () => {
  const { GameEngine } = sandbox();
  const g = new GameEngine({ boardSize: 5, players: two() });
  g.playMove(1, 1);
  assert.equal(g.undo(), true);
  assert.equal(g.stones[1][1], null);
  assert.equal(g.getCurrentPlayer().id, 1);
  assert.equal(g.undo(), false, 'nothing left to undo');
});

test('everyone passing in a row ends the game and names a winner when scores differ', () => {
  const { GameEngine } = sandbox();
  const g = new GameEngine({ boardSize: 5, players: two() });
  g.playMove(2, 2); // blue has a pebble, red has none
  g.passTurn();
  const end = g.passTurn();
  assert.equal(end.isGameOver, true);
  assert.equal(g.isGameOver, true);
  assert.ok(g.winner, 'a winner or a tie result is set');
  assert.equal(g.playMove(0, 0).success, false, 'no moves after the game is over');
});

test('legal moves shrink as the board fills and never include occupied spots', () => {
  const { GameEngine } = sandbox();
  const g = new GameEngine({ boardSize: 5, players: two() });
  const before = g.getLegalMoves().length;
  g.playMove(2, 2);
  const after = g.getLegalMoves();
  assert.ok(after.length < before);
  assert.ok(!after.some((m) => (m.r ?? m[0]) === 2 && (m.c ?? m[1]) === 2));
});
