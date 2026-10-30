import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  geometry, edgeCount, boxCount, newGame, cloneState, legalMoves, moveKind, availableBoxes, missingEdge,
  applyMove, status, replay, fromEdges, summary,
} from '../js/engine.js';

// Small seeded random numbers so a failing test can be repeated.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playRandom(n, seed, first = 0) {
  const r = rng(seed);
  const s = newGame({ n, first });
  while (!s.over) {
    const moves = legalMoves(s);
    applyMove(s, moves[Math.floor(r() * moves.length)]);
  }
  return s;
}

test('line and box counts for 3, 4 and 5', () => {
  assert.deepEqual([3, 4, 5].map(edgeCount), [24, 40, 60]);
  assert.deepEqual([3, 4, 5].map(boxCount), [9, 16, 25]);
  for (const n of [3, 4, 5]) {
    const g = geometry(n);
    assert.equal(g.E, edgeCount(n));
    assert.equal(g.B, boxCount(n));
  }
});

test('bad board sizes are refused', () => {
  assert.throws(() => geometry(0));
  assert.throws(() => geometry(2.5));
  assert.throws(() => geometry(9));
});

test('line numbering matches the spec', () => {
  const g = geometry(3);
  assert.deepEqual(g.edgeInfo[0], { horizontal: true, r: 0, c: 0 });
  assert.deepEqual(g.edgeInfo[11], { horizontal: true, r: 3, c: 2 });
  assert.deepEqual(g.edgeInfo[12], { horizontal: false, r: 0, c: 0 });
  assert.deepEqual(g.edgeInfo[23], { horizontal: false, r: 2, c: 3 });
  // the centre box of a 3x3 board: top h(1,1)=4, bottom h(2,1)=7, left v(1,1)=17, right v(1,2)=18
  assert.deepEqual(g.boxEdges[4], [4, 7, 17, 18]);
});

test('every box has 4 different lines; interior lines touch 2 boxes, border lines 1', () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const g = geometry(n);
    for (const sides of g.boxEdges) assert.equal(new Set(sides).size, 4);
    const border = g.edgeBoxes.filter((b) => b.length === 1).length;
    const inner = g.edgeBoxes.filter((b) => b.length === 2).length;
    assert.equal(border, 4 * n);
    assert.equal(inner, g.E - 4 * n);
    assert.ok(g.edgeBoxes.every((b) => b.length === 1 || b.length === 2));
  }
});

test('a line that closes no box passes the turn', () => {
  const s = newGame({ n: 3 });
  const r = applyMove(s, 0);
  assert.equal(r.mover, 0);
  assert.deepEqual(r.completed, []);
  assert.equal(r.extraTurn, false);
  assert.equal(s.turn, 1);
});

test('closing a box scores it and keeps the turn', () => {
  const s = newGame({ n: 1 });
  applyMove(s, 0); // p0
  applyMove(s, 1); // p1
  applyMove(s, 2); // p0, third side
  assert.equal(s.turn, 1);
  assert.deepEqual(availableBoxes(s), [0]);
  assert.equal(missingEdge(s, 0), 3);
  const r = applyMove(s, 3); // p1 closes it and the game ends
  assert.deepEqual(r.completed, [0]);
  assert.equal(r.over, true);
  assert.deepEqual(s.scores, [0, 1]);
  assert.equal(s.owner[0], 1);
});

test('closing a box mid-game gives another turn', () => {
  const s = newGame({ n: 2 });
  // Build up three sides of box 0 (edges: top 0, bottom 2, left 6, right 7 for n=2)
  const g = geometry(2);
  const [top, bottom, left, right] = g.boxEdges[0];
  applyMove(s, top); // p0
  applyMove(s, bottom); // p1
  applyMove(s, left); // p0
  assert.equal(s.turn, 1);
  const r = applyMove(s, right); // p1 closes box 0
  assert.deepEqual(r.completed, [0]);
  assert.equal(r.extraTurn, true);
  assert.equal(s.turn, 1, 'same player moves again');
  assert.deepEqual(s.scores, [0, 1]);
});

test('one line can close two boxes at once', () => {
  const s = newGame({ n: 2 });
  const g = geometry(2);
  // Boxes 0 and 1 share the vertical line between them: v(0,1).
  const shared = g.boxEdges[0][3];
  assert.equal(shared, g.boxEdges[1][2]);
  const others = [...g.boxEdges[0].slice(0, 3), ...g.boxEdges[1].slice(0, 2).concat(g.boxEdges[1][3])];
  // Draw 3 sides of each box (everything except the shared line), then close both.
  const moves = [...new Set(others)];
  const mover = [];
  for (const e of moves) mover.push(applyMove(s, e));
  // Nobody could close a box yet: every box only has 3 sides.
  assert.ok(mover.every((r) => r.completed.length === 0));
  const who = s.turn;
  const r = applyMove(s, shared);
  assert.deepEqual(r.completed.sort(), [0, 1]);
  assert.equal(s.scores[who], 2);
  assert.equal(s.turn, who);
});

test('illegal moves are refused and change nothing', () => {
  const s = newGame({ n: 3 });
  applyMove(s, 5);
  const before = JSON.stringify(s);
  assert.equal(applyMove(s, 5), null, 'already drawn');
  assert.equal(applyMove(s, -1), null);
  assert.equal(applyMove(s, 24), null);
  assert.equal(applyMove(s, 1.5), null);
  assert.equal(applyMove(s, '3'), null);
  assert.equal(JSON.stringify(s), before);
});

test('nothing can be played after the game is over', () => {
  const s = playRandom(2, 1);
  assert.equal(s.over, true);
  assert.deepEqual(legalMoves(s), []);
  assert.equal(applyMove(s, 0), null);
});

test('moveKind tells take, danger and safe apart', () => {
  const g = geometry(3);
  const s = newGame({ n: 3 });
  assert.equal(moveKind(s, 0), 'safe');
  applyMove(s, g.boxEdges[0][0]); // top of box 0
  applyMove(s, g.boxEdges[0][2]); // left of box 0 (2 sides now)
  assert.equal(moveKind(s, g.boxEdges[0][1]), 'danger'); // would make a third side
  assert.equal(moveKind(s, g.boxEdges[0][3]), 'danger');
  assert.equal(moveKind(s, 23), 'safe'); // far away
  applyMove(s, g.boxEdges[0][1]); // third side (by whoever)
  assert.equal(moveKind(s, g.boxEdges[0][3]), 'take');
});

test('random games end with every line drawn and all boxes owned', () => {
  for (const n of [3, 4, 5]) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = playRandom(n, seed * 7 + n, seed % 2);
      assert.equal(s.over, true);
      assert.equal(s.moves.length, edgeCount(n));
      assert.ok(s.edges.every((e) => e === 1));
      assert.ok(s.owner.every((o) => o === 0 || o === 1));
      assert.ok(s.sides.every((x) => x === 4));
      assert.equal(s.scores[0] + s.scores[1], boxCount(n));
      assert.equal(s.owner.filter((o) => o === 0).length, s.scores[0]);
      assert.equal(s.turns.reduce((sum, t) => sum + t.boxes, 0), boxCount(n));
    }
  }
});

test('3x3 and 5x5 can never be drawn (odd number of boxes); 4x4 can', () => {
  for (const n of [3, 5]) {
    for (let seed = 1; seed <= 40; seed++) {
      const st = status(playRandom(n, seed));
      assert.ok(st.result === 0 || st.result === 1);
    }
  }
  let draws = 0;
  for (let seed = 1; seed <= 400; seed++) if (status(playRandom(4, seed)).result === 'draw') draws += 1;
  assert.ok(draws > 0, 'a 4x4 game can end level');
});

test('status reports the winner only when the game is over', () => {
  const s = newGame({ n: 3 });
  assert.equal(status(s).result, null);
  const done = playRandom(3, 5);
  const st = status(done);
  assert.equal(st.over, true);
  assert.equal(st.result, done.scores[0] > done.scores[1] ? 0 : 1);
});

test('turns alternate and a turn only ends when no box was closed (or the game ends)', () => {
  const s = playRandom(4, 11);
  for (let i = 1; i < s.turns.length; i++) assert.notEqual(s.turns[i].player, s.turns[i - 1].player);
  // every finished turn except possibly the last ends with a line that closes nothing
  const rebuilt = newGame({ n: 4 });
  let seen = 0;
  for (const e of s.moves) {
    const r = applyMove(rebuilt, e);
    if (!r.extraTurn) seen += 1;
  }
  assert.equal(seen, s.turns.length);
});

test('replay rebuilds the same game', () => {
  const s = playRandom(4, 99, 1);
  const { state, applied } = replay(4, 1, s.moves);
  assert.deepEqual(applied, s.moves);
  assert.deepEqual(state, s);
  const partial = replay(4, 1, s.moves.slice(0, 10));
  assert.equal(partial.state.moves.length, 10);
  assert.equal(partial.state.over, false);
});

test('replay stops at an illegal move', () => {
  const { applied } = replay(3, 0, [1, 2, 2, 3]);
  assert.deepEqual(applied, [1, 2]);
});

test('cloneState is a deep copy', () => {
  const s = newGame({ n: 3 });
  applyMove(s, 4);
  const c = cloneState(s);
  applyMove(c, 5);
  assert.equal(s.moves.length, 1);
  assert.equal(c.moves.length, 2);
  assert.equal(s.edges[5], 0);
  assert.notEqual(s.scores, c.scores);
});

test('fromEdges builds a position and counts the sides', () => {
  const s = fromEdges(3, [0, 12], 1);
  assert.equal(s.turn, 1);
  assert.equal(s.sides[0], 2);
  assert.equal(s.over, false);
  assert.equal(moveKind(s, 3), 'danger');
  assert.equal(moveKind(s, 2), 'safe');
});

test('fromEdges needs an owner for a closed box and rejects bad lines', () => {
  const g = geometry(2);
  const box = g.boxEdges[0];
  assert.throws(() => fromEdges(2, box, 0));
  const s = fromEdges(2, box, 0, { 0: 1 });
  assert.deepEqual(s.scores, [0, 1]);
  assert.throws(() => fromEdges(2, [0, 0], 0));
  assert.throws(() => fromEdges(2, [99], 0));
});

test('summary counts gifts, best runs and the last long chain', () => {
  // 1x1 board: p0, p1, p0 each draw a line, p1 closes the box: p0 gave p1 one box.
  const s = newGame({ n: 1 });
  [0, 1, 2, 3].forEach((e) => applyMove(s, e));
  const sum = summary(s);
  assert.deepEqual(sum.gifts, [1, 0]);
  assert.deepEqual(sum.bestRun, [0, 1]);
  assert.equal(sum.lastLong, null);
});

test('summary matches the final score in random games', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = playRandom(4, seed);
    const sum = summary(s);
    // every closed box was a gift from the other player, so gifts to p1 are what p1 closed, and so on
    assert.equal(sum.gifts[0], s.scores[1]);
    assert.equal(sum.gifts[1], s.scores[0]);
    assert.ok(sum.bestRun[0] <= s.scores[0] && sum.bestRun[1] <= s.scores[1]);
  }
});
