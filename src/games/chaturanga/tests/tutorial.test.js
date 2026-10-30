import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromPieces, findMove, applyMove, legalMoves, inCheck, parseSquare } from '../js/engine.js';
import { TUTORIAL_STEPS } from '../js/tutorial.js';

const tasks = TUTORIAL_STEPS.flatMap((step) => step.tasks || []);

test('the tutorial has 5 steps, within the 3-5 step limit', () => {
  assert.equal(TUTORIAL_STEPS.length, 5);
});

test('every lesson position is valid and its expected move is legal', () => {
  for (const t of tasks) {
    const state = fromPieces(t.pieces, 'w');
    const move = findMove(state, parseSquare(t.from), parseSquare(t.to));
    assert.ok(move, `expected ${t.from}-${t.to} to be legal in: ${t.pieces.join(', ')}`);
  }
});

test('the lessons never start with White in check', () => {
  for (const t of tasks) {
    assert.equal(inCheck(fromPieces(t.pieces, 'w'), 'w'), false, t.pieces.join(', '));
  }
});

test('step 1 ends in a real checkmate', () => {
  const t = TUTORIAL_STEPS[0].tasks[0];
  const state = fromPieces(t.pieces, 'w');
  applyMove(state, findMove(state, parseSquare(t.from), parseSquare(t.to)));
  assert.equal(inCheck(state, 'b'), true);
  assert.equal(legalMoves(state).length, 0);
});

test('the promotion lesson really promotes', () => {
  const t = TUTORIAL_STEPS[3].tasks[2];
  const state = fromPieces(t.pieces, 'w');
  const move = findMove(state, parseSquare(t.from), parseSquare(t.to));
  assert.equal(move.promotion, 'M');
});

test('every lesson has instruction and success text', () => {
  for (const t of tasks) {
    assert.ok(t.text.length > 10);
    assert.ok(t.success.length > 5);
  }
});
