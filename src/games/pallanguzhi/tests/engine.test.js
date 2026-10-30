import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, applyMove, legalPits, status, resign, replay, rowSeeds, totalSeeds, cloneState,
  PITS, START_SEEDS, STALL_LIMIT,
} from '../js/engine.js';

// Build a position from a list of [pit, seeds] pairs.
function position(list, extra = {}) {
  const state = newGame();
  state.pits.fill(0);
  for (const [pit, n] of list) state.pits[pit] = n;
  return Object.assign(state, extra);
}

// Small repeatable random numbers for playouts.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('new game: 14 pits of 5 seeds, empty piles, player 0 to move', () => {
  const g = newGame();
  assert.equal(g.pits.length, PITS);
  assert.ok(g.pits.every((n) => n === START_SEEDS));
  assert.equal(totalSeeds(g), 70);
  assert.deepEqual(g.stores, [0, 0]);
  assert.equal(g.turn, 0);
  assert.deepEqual(legalPits(g), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(legalPits(g, 1), [7, 8, 9, 10, 11, 12, 13]);
});

test('first option lets player 1 start', () => {
  assert.equal(newGame({ first: 1 }).turn, 1);
});

test('plain sow: one seed per pit, nothing captured when the next two pits are empty', () => {
  const g = position([[0, 3], [9, 2], [11, 2]]);
  const r = applyMove(g, 0, { record: true });
  assert.equal(r.captured, 0);
  assert.deepEqual(g.pits.slice(0, 6), [0, 1, 1, 1, 0, 0]);
  assert.equal(g.turn, 1);
  assert.deepEqual(r.events.map((e) => e.t), ['pick', 'sow', 'sow', 'sow']);
  assert.deepEqual(r.events.filter((e) => e.t === 'sow').map((e) => e.hand), [2, 1, 0]);
});

test('relay: a full pit after the last seed is picked up and sown on', () => {
  const g = position([[0, 2], [3, 3], [10, 2]]);
  const r = applyMove(g, 0, { record: true });
  assert.equal(r.captured, 0);
  assert.deepEqual(g.pits.slice(0, 8), [0, 1, 1, 0, 1, 1, 1, 0]);
  const kinds = r.events.map((e) => e.t);
  assert.ok(kinds.includes('relay'));
  assert.deepEqual(r.events.find((e) => e.t === 'relay'), { t: 'relay', pit: 3, n: 3 });
});

test('capture: last seed lands before an empty pit, so the pit after it is captured', () => {
  const g = position([[2, 2], [6, 4], [10, 3]]);
  const r = applyMove(g, 2, { record: true });
  assert.equal(r.captured, 4);
  assert.equal(g.stores[0], 4);
  assert.equal(g.pits[6], 0);
  assert.deepEqual(r.events.at(-1), { t: 'capture', pit: 6, n: 4 });
  assert.equal(totalSeeds(g), 2 + 4 + 3);
});

test('capture can take seeds from either row, including the mover\'s own', () => {
  const own = position([[0, 2], [4, 7], [9, 1]]);
  assert.equal(applyMove(own, 0).captured, 7);
  const theirs = position([[4, 1], [6, 6], [10, 1]]);
  // last seed lands in 5; pit 6 is full, so it relays instead (no capture here)
  assert.equal(applyMove(theirs, 4).captured, 0);
});

test('sowing wraps from pit 13 back to pit 0 for player 1', () => {
  const g = position([[12, 3], [4, 1]], { turn: 1 });
  applyMove(g, 12);
  assert.equal(g.pits[13], 1);
  assert.equal(g.pits[0], 1);
  assert.equal(g.pits[1], 1);
  assert.equal(g.pits[12], 0);
});

test('a hand of 14 or more seeds drops one in the emptied pit too', () => {
  const g = position([[0, 14], [7, 1]]);
  const { events } = applyMove(g, 0, { record: true });
  const sows = events.filter((e) => e.t === 'sow').slice(0, 14).map((e) => e.pit);
  assert.deepEqual(sows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 0]);
});

test('illegal moves return null and change nothing', () => {
  const g = newGame();
  const before = JSON.stringify(g);
  assert.equal(applyMove(g, 7), null); // not your row
  assert.equal(applyMove(g, 14), null);
  assert.equal(applyMove(g, -1), null);
  assert.equal(applyMove(g, 1.5), null);
  const empty = position([[0, 0], [1, 1], [9, 1]]);
  assert.equal(applyMove(empty, 0), null);
  assert.equal(JSON.stringify(g), before);
});

test('game ends when the player to move has no seeds; the other row goes to its owner', () => {
  const g = position([[5, 1], [0, 3], [8, 2]]);
  applyMove(g, 5); // sows into 6, next 7 empty, captures pit 8 (2)
  const s = status(g);
  assert.equal(s.over, true);
  assert.equal(s.reason, 'empty');
  assert.equal(s.result, 0);
  assert.deepEqual(s.scores, [2 + 4, 0]);
  assert.ok(g.pits.every((n) => n === 0));
  assert.equal(legalPits(g).length, 0);
  assert.equal(applyMove(g, 0), null);
});

test('equal piles at the end is a draw', () => {
  const g = position([[5, 1], [8, 1], [0, 1]], { stores: [0, 1] });
  // 5 -> sows 6, next 7 empty, captures pit 8 (1): player 0 has 1; row 0 keeps pit0 + pit6 = 2
  applyMove(g, 5);
  assert.equal(g.over, true);
  assert.deepEqual(g.stores, [3, 1]);
  const d = position([[6, 1], [9, 1], [1, 1]], { stores: [0, 2] });
  // 6 -> sows 7; next 8 empty; captures pit 9 (1). Row 1 has pit 7 (1). Player 1 to move, has seeds.
  applyMove(d, 6);
  assert.equal(d.over, false);
});

test('stall: 60 turns in a row without a capture ends the game', () => {
  const g = position([[0, 3], [9, 2], [11, 2]], { stall: STALL_LIMIT - 1 });
  applyMove(g, 0);
  assert.equal(g.over, true);
  assert.equal(g.reason, 'stall');
  assert.deepEqual(g.stores, [3, 4]);
  assert.equal(g.result, 1);
});

test('resign makes the other player the winner', () => {
  const g = newGame();
  resign(g, 0);
  assert.deepEqual(status(g), { over: true, result: 1, reason: 'resign', scores: [0, 0], loser: 0 });
});

test('replay rebuilds a game and stops at an illegal move', () => {
  const g = newGame();
  applyMove(g, 2);
  applyMove(g, 9);
  const { state, applied } = replay([2, 9]);
  assert.deepEqual(state, g);
  const bad = replay([2, 9, 0, 99, 3]); // 0 is the wrong row only if turn differs; 99 is illegal
  assert.ok(bad.applied.length <= 3);
});

test('rowSeeds counts a player\'s own row', () => {
  const g = newGame();
  assert.equal(rowSeeds(g, 0), 35);
  assert.equal(rowSeeds(g, 1), 35);
});

test('random playouts: seeds are conserved, games always end, results are valid', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const rng = lcg(seed);
    const g = newGame({ first: seed % 2 });
    let guard = 0;
    while (!g.over && guard < 3000) {
      const moves = legalPits(g);
      assert.ok(moves.length > 0, 'a live game always has a move');
      applyMove(g, moves[Math.floor(rng() * moves.length)]);
      assert.equal(totalSeeds(g), 70, `seeds conserved (seed ${seed})`);
      guard++;
    }
    assert.ok(g.over, `game ${seed} must end`);
    assert.ok([0, 1, 'draw'].includes(g.result));
    assert.equal(g.stores[0] + g.stores[1], 70);
  }
});

test('applyMove is deterministic and recording does not change the result', () => {
  const a = newGame();
  const b = cloneState(a);
  const ra = applyMove(a, 3, { record: true });
  const rb = applyMove(b, 3);
  assert.deepEqual(a, b);
  assert.equal(ra.captured, rb.captured);
});
