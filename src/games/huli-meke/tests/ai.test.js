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
import {
  getBestMove,
  getHint,
  evaluateState
} from '../js/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const boards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/boards.json'), 'utf8'));

test('A1: for every board and for Easy, Medium and Hard, AI returns a legal move in first 5 turns', () => {
  for (const b of boards) {
    const graph = buildBoardGraph(b);
    for (const level of ['easy', 'medium', 'hard']) {
      const state = createGameState(b);
      for (let turn = 0; turn < 5 && !state.winner; turn++) {
        const legalMoves = getLegalMoves(state, graph);
        assert.ok(legalMoves.length > 0, `Board ${b.id} must have legal moves at turn ${turn}`);
        const aiMove = getBestMove(state, graph, level);
        assert.ok(aiMove, `AI (${level}) must return a move on board ${b.id}`);
        const isLegal = legalMoves.some(m =>
          m.type === aiMove.type &&
          m.from === aiMove.from &&
          m.to === aiMove.to &&
          m.piece === aiMove.piece
        );
        assert.ok(isLegal, `AI (${level}) move must be legal on board ${b.id}`);
        applyMove(state, aiMove, graph);
      }
    }
  }
});

test('Classic Board: test each level (Easy, Medium, Hard)', () => {
  const classic = boards.find(b => b.id === 'classic');
  const graph = buildBoardGraph(classic);

  for (const level of ['easy', 'medium', 'hard']) {
    const state = createGameState(classic, { tigers: 3, goats: 15 });
    const legalMoves = getLegalMoves(state, graph);
    const start = Date.now();
    const move = getBestMove(state, graph, level);
    const duration = Date.now() - start;

    assert.ok(move, `Move must be returned for ${level}`);
    assert.ok(duration < 1500, `AI ${level} must return under 1.5s on Classic`);
    const isLegal = legalMoves.some(m => m.type === move.type && m.to === move.to);
    assert.ok(isLegal, `Move for ${level} must be legal`);
  }
});

test('Twin Triangles (largest board): test Hard AI performance and legality', () => {
  const twin = boards.find(b => b.id === 'twin-triangles');
  const graph = buildBoardGraph(twin);
  const state = createGameState(twin, { tigers: 6, goats: 25 });

  const start = Date.now();
  const move = getBestMove(state, graph, 'hard');
  const duration = Date.now() - start;

  assert.ok(move, 'Hard AI must return move for Twin Triangles');
  assert.ok(duration < 1200, `Hard AI took ${duration}ms, must be under 1200ms`);
  const legalMoves = getLegalMoves(state, graph);
  const isLegal = legalMoves.some(m => m.type === move.type && m.to === move.to);
  assert.ok(isLegal, 'Move must be legal on Twin Triangles');
});

test('Hint generation returns a valid legal move for the current player', () => {
  const classic = boards.find(b => b.id === 'classic');
  const graph = buildBoardGraph(classic);
  const state = createGameState(classic, { tigers: 3, goats: 15 });

  const hint = getHint(state, graph);
  assert.ok(hint);
  const legalMoves = getLegalMoves(state, graph);
  const isLegal = legalMoves.some(m => m.type === hint.type && m.to === hint.to);
  assert.ok(isLegal, 'Hint must be a legal move');
});
