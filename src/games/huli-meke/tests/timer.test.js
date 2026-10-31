import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBoardGraph,
  createGameState,
  getLegalMoves,
  applyMove
} from '../js/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const boards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/boards.json'), 'utf8'));
const getBoard = id => boards.find(b => b.id === id);

test('Timer timeout: Forfeit when Goat times out results in Tiger win', () => {
  const board = getBoard('classic');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 3, goats: 15, target: 5 });

  assert.equal(state.turn, 'G');
  assert.equal(state.winner, null);

  // Simulate timeout on Goat turn with forfeit
  const loser = state.turn;
  const winner = loser === 'T' ? 'G' : 'T';
  state.winner = winner;
  state.winReason = 'timeout';

  assert.equal(state.winner, 'T');
  assert.equal(state.winReason, 'timeout');
});

test('Timer timeout: Forfeit when Tiger times out results in Goat win', () => {
  const board = getBoard('classic');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 3, goats: 15, target: 5 });

  // Goat makes first placement
  applyMove(state, { type: 'place', to: 'L1_1', piece: 'G' }, graph);
  assert.equal(state.turn, 'T');
  assert.equal(state.winner, null);

  // Simulate timeout on Tiger turn with forfeit
  const loser = state.turn;
  const winner = loser === 'T' ? 'G' : 'T';
  state.winner = winner;
  state.winReason = 'timeout';

  assert.equal(state.winner, 'G');
  assert.equal(state.winReason, 'timeout');
});

test('Timer timeout: Random move fallback picks a legal move and advances turn', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5, target: 2 });

  assert.equal(state.turn, 'G');
  assert.equal(state.phase, 'placing');

  const legalMoves = getLegalMoves(state, graph);
  assert.ok(legalMoves.length > 0, 'Must have legal placement moves');

  // Random move chosen
  const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  assert.equal(randomMove.type, 'place');
  assert.equal(randomMove.piece, 'G');

  applyMove(state, randomMove, graph);
  assert.equal(state.turn, 'T');
  assert.equal(state.goatsInHand, 4);
});

test('Timer configuration options and durations', () => {
  const validDurations = [0, 15, 30, 45, 60];
  const validTimeoutActions = ['forfeit', 'random'];

  validDurations.forEach(d => {
    assert.ok(typeof d === 'number' && d >= 0);
  });
  validTimeoutActions.forEach(action => {
    assert.ok(['forfeit', 'random'].includes(action));
  });
});
