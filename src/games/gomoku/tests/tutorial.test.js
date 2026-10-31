import { test } from 'node:test';
import assert from 'node:assert/strict';
import { place, completionsAfter, winPoints, legalMoves } from '../js/engine.js';
import { SCENARIOS, STEPS, scenarioState, N } from '../js/tutorial.js';

test('there are five steps in the planned order', () => {
  assert.deepEqual(STEPS.map((s) => s.id), ['goal', 'place', 'grow', 'block', 'practice']);
});

test('goal: the picture holds a real five', () => {
  const s = scenarioState('goal');
  const stones = SCENARIOS.goal.black;
  assert.equal(stones.length, 5);
  // Five stones in one row.
  assert.ok(stones.every((p) => Math.floor(p / N) === 4));
  const cols = stones.map((p) => p % N).sort((a, b) => a - b);
  assert.deepEqual(cols, [2, 3, 4, 5, 6]);
  assert.equal(s.current, 1);
});

test('place: tapping the glowing point really puts a Black stone there', () => {
  const s = scenarioState('place');
  assert.ok(legalMoves(s).includes(SCENARIOS.place.target));
  assert.ok(place(s, SCENARIOS.place.target));
  assert.equal(s.cells[SCENARIOS.place.target], 0);
});

test('grow: the glowing stone makes an open four, one end gets blocked, the other end makes five', () => {
  const g = SCENARIOS.grow;
  const s = scenarioState('grow');
  assert.equal(s.current, 0);
  assert.equal(completionsAfter(s.cells, N, g.target, 0).length, 2, 'two open ends');
  place(s, g.target);
  assert.equal(s.phase, 'play');
  place(s, g.rivalBlock);
  assert.equal(s.phase, 'play');
  assert.deepEqual(winPoints(s.cells, N, 0), [g.finish]);
  const r = place(s, g.finish);
  assert.equal(r.won, true);
  assert.equal(s.winner, 0);
  assert.equal(s.winLine.length, 5);
});

test('block: the rival has a four with one open end; blocking stops it, anywhere else lets them win', () => {
  const b = SCENARIOS.block;
  const s = scenarioState('block');
  assert.deepEqual(winPoints(s.cells, N, 1), [b.target]);
  assert.deepEqual(winPoints(s.cells, N, 0), []);
  const good = scenarioState('block');
  place(good, b.target);
  assert.deepEqual(winPoints(good.cells, N, 1), []);
  const bad = scenarioState('block');
  place(bad, 80);
  const r = place(bad, b.target);
  assert.equal(r.won, true);
  assert.equal(bad.winner, 1);
});

test('every scenario position is legal: stones are on empty points and inside the board', () => {
  for (const name of Object.keys(SCENARIOS)) {
    const sc = SCENARIOS[name];
    const all = sc.black.concat(sc.white);
    assert.equal(new Set(all).size, all.length, name);
    assert.ok(all.every((p) => p >= 0 && p < N * N), name);
  }
});
