import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, fromPieces, legalMoves, applyMove, status, parseSquare, squareName } from '../js/engine.js';
import { chooseMove, LEVELS } from '../js/ai.js';

const sq = parseSquare;

// Small repeatable random generator so tests do not depend on luck.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sameMove = (a, b) => a.from === b.from && a.to === b.to;
const label = (m) => `${squareName(m.from)}-${squareName(m.to)}`;

test('every level returns a legal move from the start position', () => {
  for (const level of LEVELS) {
    const state = newGame();
    const move = chooseMove(state, { level, rng: seeded(1), timeMs: 300 });
    assert.ok(move, `${level} returned no move`);
    assert.ok(legalMoves(state).some((m) => sameMove(m, move)), `${level} chose an illegal move ${label(move)}`);
  }
});

test('returns null when there is no legal move', () => {
  const state = fromPieces(['wK e1', 'wP e2', 'wR b8', 'wR a7', 'bK h8', 'bP e3'], 'b');
  assert.equal(chooseMove(state, { level: 'medium' }), null);
});

test('does not change the state it is given', () => {
  const state = newGame();
  const snapshot = JSON.stringify(state);
  chooseMove(state, { level: 'medium', rng: seeded(2) });
  assert.equal(JSON.stringify(state), snapshot);
});

test('every level finds mate in one', () => {
  // White plays Ratha b1-b8, a checkmate.
  const pieces = ['wK e1', 'wP e2', 'wR b1', 'wR a7', 'bK h8', 'bP e3'];
  for (const level of LEVELS) {
    const state = fromPieces(pieces, 'w');
    const move = chooseMove(state, { level, rng: seeded(3), timeMs: 500 });
    assert.equal(label(move), 'b1-b8', `${level} missed mate in one`);
  }
});

test('medium and hard capture an undefended Ratha', () => {
  for (const level of ['medium', 'hard']) {
    const state = fromPieces(['wK a1', 'wR e1', 'bK h8', 'bR e5', 'bP h7'], 'w');
    const move = chooseMove(state, { level, rng: seeded(4), timeMs: 500 });
    assert.equal(label(move), 'e1-e5', `${level} did not take the free Ratha`);
  }
});

test('easy does not give away a Ratha for nothing', () => {
  // The Ratha on e1 is attacked by the black Ratha; easy must take it or move away, not leave it.
  for (let seed = 1; seed <= 20; seed++) {
    const state = fromPieces(['wK a1', 'wR e1', 'bK h8', 'bR e5', 'bP h7'], 'w');
    const move = chooseMove(state, { level: 'easy', rng: seeded(seed) });
    assert.equal(label(move), 'e1-e5', `easy missed the free Ratha with seed ${seed}`);
  }
});

test('hard respects its time cap', () => {
  const state = newGame();
  const start = performance.now();
  const move = chooseMove(state, { level: 'hard', timeMs: 400, rng: seeded(5) });
  const elapsed = performance.now() - start;
  assert.ok(move);
  assert.ok(elapsed < 1500, `hard took ${Math.round(elapsed)} ms`);
});

test('medium answers the opening in a reasonable time', () => {
  const state = newGame();
  const start = performance.now();
  chooseMove(state, { level: 'medium', rng: seeded(6) });
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 5000, `medium took ${Math.round(elapsed)} ms`);
});

test('two easy bots can play a whole game with only legal moves', () => {
  const state = newGame();
  const rng = seeded(7);
  let plies = 0;
  while (!status(state).over && plies < 400) {
    const move = chooseMove(state, { level: 'easy', rng });
    assert.ok(move, 'bot returned no move in a live game');
    assert.ok(legalMoves(state).some((m) => sameMove(m, move)), `illegal move ${label(move)} at ply ${plies}`);
    applyMove(state, move);
    plies++;
  }
  assert.ok(plies > 10);
});

test('medium beats easy more often than not', () => {
  let mediumWins = 0;
  let easyWins = 0;
  for (let g = 0; g < 4; g++) {
    const state = newGame();
    const rng = seeded(100 + g);
    const mediumIsWhite = g % 2 === 0;
    let plies = 0;
    while (!status(state).over && plies < 160) {
      const mediumToMove = (state.turn === 'w') === mediumIsWhite;
      const move = chooseMove(state, { level: mediumToMove ? 'medium' : 'easy', rng });
      applyMove(state, move);
      plies++;
    }
    const result = status(state);
    if (result.result === 'draw' || !result.over) continue;
    const mediumWon = (result.result === 'w') === mediumIsWhite;
    if (mediumWon) mediumWins++;
    else easyWins++;
  }
  assert.ok(mediumWins >= easyWins, `medium ${mediumWins} vs easy ${easyWins}`);
});
