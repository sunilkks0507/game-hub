import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZES, newGame, cloneState, legalMoves, place, decideSwap, status, replay, fromStones, explain,
  pointLabel, winPoints, completionsAfter, makesFive, runLength, winningLine,
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

// Play moves one after the other, alternating colours as the engine does.
function play(state, moves) {
  for (const m of moves) assert.ok(place(state, m), `move ${m} should be legal`);
  return state;
}

const at = (n, r, c) => r * n + c;

test('board sizes are 9, 13 and 15; others are refused', () => {
  assert.deepEqual(SIZES, [9, 13, 15]);
  for (const n of SIZES) assert.equal(newGame({ n }).cells.length, n * n);
  assert.throws(() => newGame({ n: 10 }), RangeError);
  assert.throws(() => newGame({ n: 3 }), RangeError);
});

test('new game: empty board, Black to move, playing phase', () => {
  const s = newGame();
  assert.equal(s.n, 9);
  assert.equal(s.current, 0);
  assert.equal(s.phase, 'play');
  assert.ok(s.cells.every((c) => c === -1));
  assert.equal(legalMoves(s).length, 81);
});

test('point labels: column letter, row number from the top', () => {
  assert.equal(pointLabel(9, 0), 'A1');
  assert.equal(pointLabel(9, 40), 'E5');
  assert.equal(pointLabel(15, 15 * 14 + 14), 'O15');
  assert.equal(pointLabel(9, 4 * 9 + 7), 'H5');
});

test('illegal moves are refused: occupied, out of range, not a whole number, after the game is over', () => {
  const s = newGame();
  assert.ok(place(s, 40));
  assert.equal(place(s, 40), null);
  assert.equal(place(s, -1), null);
  assert.equal(place(s, 81), null);
  assert.equal(place(s, 1.5), null);
  assert.equal(place(s, '3'), null);
  const t = newGame();
  // Black row 0, columns 0-4; White fills row 2 columns 0-3 on the way.
  play(t, [0, 18, 1, 19, 2, 20, 3, 21, 4]);
  assert.equal(t.phase, 'over');
  assert.equal(place(t, 60), null);
  assert.deepEqual(legalMoves(t), []);
});

test('turns alternate and a stone is never removed', () => {
  const s = newGame();
  place(s, 0);
  assert.equal(s.current, 1);
  place(s, 1);
  assert.equal(s.current, 0);
  assert.deepEqual(s.cells.slice(0, 2), [0, 1]);
  assert.deepEqual(s.moves, [0, 1]);
});

test('five wins in all four directions', () => {
  for (const n of SIZES) {
    const lines = {
      across: [0, 1, 2, 3, 4].map((k) => at(n, 3, 2 + k)),
      down: [0, 1, 2, 3, 4].map((k) => at(n, 1 + k, 4)),
      diagonal: [0, 1, 2, 3, 4].map((k) => at(n, 1 + k, 1 + k)),
      anti: [0, 1, 2, 3, 4].map((k) => at(n, 1 + k, 6 - k)),
    };
    for (const [name, line] of Object.entries(lines)) {
      const s = newGame({ n });
      // White stones on row n-1 (far from every test line) never make a line of their own.
      const whites = [at(n, n - 1, 0), at(n, n - 1, 2), at(n, n - 1, 4), at(n, n - 1, 6)];
      const order = [];
      for (let k = 0; k < 4; k++) order.push(line[k], whites[k]);
      order.push(line[4]);
      play(s, order);
      assert.equal(s.phase, 'over', `${name} on ${n}`);
      assert.equal(s.winner, 0, `${name} on ${n}`);
      assert.deepEqual([...s.winLine].sort((a, b) => a - b), [...line].sort((a, b) => a - b));
    }
  }
});

test('five wins at the edges and corners', () => {
  const n = 9;
  const edge = [0, 1, 2, 3, 4]; // top row, corner start
  const corner = [0, 10, 20, 30, 40]; // main diagonal from the corner
  const anti = [8, 16, 24, 32, 40]; // anti-diagonal from the top-right corner
  const bottom = [76, 77, 78, 79, 80];
  for (const line of [edge, corner, anti, bottom]) {
    const s = newGame({ n });
    const whites = [at(n, 8, 0), at(n, 8, 2), at(n, 7, 0), at(n, 7, 2)].filter((w) => !line.includes(w));
    const order = [];
    for (let k = 0; k < 4; k++) order.push(line[k], whites[k]);
    order.push(line[4]);
    play(s, order);
    assert.equal(s.winner, 0, `line ${line}`);
  }
});

test('four in a row does not win; White can win too', () => {
  const s = newGame();
  play(s, [0, 9, 1, 10, 2, 11, 3, 12]);
  assert.equal(s.phase, 'play');
  assert.equal(s.winner, -1);
  place(s, 40); // Black elsewhere
  place(s, 13); // White: 9, 10, 11, 12, 13 in row 1
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 1);
});

test('six in a row also wins (free-style)', () => {
  const n = 13;
  const s = newGame({ n });
  const row = (c) => at(n, 5, c);
  const w = [0, 2, 4, 6, 8].map((c) => at(n, 12, c));
  // Black: columns 0, 1, 2, 4, 5 (no five yet), then column 3 joins them into a run of six.
  play(s, [row(0), w[0], row(1), w[1], row(2), w[2], row(4), w[3], row(5), w[4]]);
  assert.equal(s.phase, 'play');
  play(s, [row(3)]);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 0);
  assert.equal(s.winLine.length, 6);
});

test('seven in a row also wins', () => {
  const n = 13;
  const s = newGame({ n });
  const row = (c) => at(n, 5, c);
  const w = [0, 2, 4, 6, 8, 10].map((c) => at(n, 12, c));
  play(s, [row(0), w[0], row(1), w[1], row(2), w[2], row(4), w[3], row(5), w[4], row(6), w[5]]);
  assert.equal(s.phase, 'play');
  play(s, [row(3)]);
  assert.equal(s.winLine.length, 7);
});

test('a full board with no five is a draw', () => {
  const n = 9;
  const s = newGame({ n });
  const colourAt = (i) => (Math.floor((i % n) / 2) + Math.floor(i / n)) % 2;
  for (let i = 1; i < n * n; i++) s.cells[i] = colourAt(i);
  // No colour may have five anywhere in this fill.
  for (let i = 1; i < n * n; i++) {
    for (let d = 0; d < 4; d++) assert.ok(runLength(s.cells, n, i, s.cells[i], d) < 5);
  }
  s.moves = new Array(n * n - 1).fill(0);
  s.current = colourAt(0);
  const report = place(s, 0);
  assert.ok(report);
  assert.equal(s.phase, 'over');
  assert.equal(s.draw, true);
  assert.equal(s.winner, -1);
  assert.equal(report.draw, true);
  assert.equal(s.winLine, null);
});

test('Fair start: swap phase only after the first stone, only when switched on', () => {
  const off = newGame({ fairStart: false });
  place(off, 40);
  assert.equal(off.phase, 'play');
  assert.equal(off.current, 1);

  const on = newGame({ fairStart: true });
  assert.equal(decideSwap(on, true), false, 'no swap before the first stone');
  const r = place(on, 40);
  assert.equal(r.swapPhase, true);
  assert.equal(on.phase, 'swap');
  assert.equal(on.current, 1);
  assert.equal(place(on, 41), null, 'no stones during the swap decision');
  assert.deepEqual(legalMoves(on), []);
  assert.equal(decideSwap(on, true), true);
  assert.equal(on.swapped, true);
  assert.equal(on.phase, 'play');
  assert.equal(on.current, 1, 'White moves next after a swap');
  assert.ok(place(on, 41));
  assert.equal(on.current, 0);
  assert.equal(decideSwap(on, false), false, 'only the first stone triggers it');

  const keep = newGame({ fairStart: true });
  place(keep, 40);
  decideSwap(keep, false);
  assert.equal(keep.swapped, false);
  assert.equal(keep.current, 1, 'White moves next when playing on');
});

test('replay rebuilds a game, with and without Fair start', () => {
  const s = newGame({ n: 13 });
  play(s, [84, 85, 86, 70]);
  const { state, applied } = replay(13, s.moves);
  assert.deepEqual(state.cells, s.cells);
  assert.deepEqual(applied, s.moves);
  assert.equal(state.current, s.current);

  const f = replay(9, [40, 41, 42], { fairStart: true, swapped: true });
  assert.equal(f.state.swapped, true);
  assert.equal(f.state.moves.length, 3);
  const f1 = replay(9, [40], { fairStart: true });
  assert.equal(f1.state.phase, 'swap');
});

test('undo by replaying all but the last stone', () => {
  const s = newGame();
  play(s, [10, 11, 12]);
  const back = replay(9, s.moves.slice(0, -1)).state;
  assert.equal(back.cells[12], -1);
  assert.equal(back.current, 0);
});

test('cloneState is a deep copy', () => {
  const s = newGame();
  play(s, [10]);
  const c = cloneState(s);
  place(c, 11);
  assert.equal(s.cells[11], -1);
  assert.equal(s.moves.length, 1);
});

test('fromStones loads a tutorial position', () => {
  const s = fromStones(9, [31, 32, 33], [0, 2], 0);
  assert.equal(s.cells[32], 0);
  assert.equal(s.cells[2], 1);
  assert.equal(s.current, 0);
  assert.equal(s.phase, 'play');
  assert.ok(place(s, 34));
  assert.equal(status(s).over, false);
});

test('winPoints and completionsAfter find fours and open fours', () => {
  const n = 9;
  const s = fromStones(n, [at(n, 4, 2), at(n, 4, 3), at(n, 4, 4)], [], 0);
  assert.deepEqual(completionsAfter(s.cells, n, at(n, 4, 5), 0).sort((a, b) => a - b), [at(n, 4, 1), at(n, 4, 6)]);
  assert.equal(s.cells[at(n, 4, 5)], -1, 'cells restored');
  const edge = fromStones(n, [at(n, 4, 0), at(n, 4, 1), at(n, 4, 2)], [], 0);
  assert.deepEqual(completionsAfter(edge.cells, n, at(n, 4, 3), 0), [at(n, 4, 4)]);
  const four = fromStones(n, [at(n, 4, 0), at(n, 4, 1), at(n, 4, 2), at(n, 4, 3)], [], 0);
  assert.deepEqual(winPoints(four.cells, n, 0), [at(n, 4, 4)]);
  assert.deepEqual(winPoints(four.cells, n, 1), []);
  assert.equal(makesFive(four.cells, n, at(n, 4, 4), 0), true);
  assert.deepEqual(winningLine(four.cells, n, at(n, 4, 3), 0), null);
});

test('explain: open four win is a double threat', () => {
  const n = 9;
  const s = newGame({ n });
  play(s, [at(n, 4, 2), at(n, 0, 0), at(n, 4, 3), at(n, 0, 2), at(n, 4, 4), at(n, 0, 4), at(n, 4, 5), at(n, 0, 6), at(n, 4, 6)]);
  const e = explain(s);
  assert.equal(e.winner, 0);
  assert.equal(e.dir, 'across');
  assert.equal(e.doubleThreat, true);
  assert.equal(e.unblockedFour, false);
  assert.equal(e.movesCount, 9);
  assert.equal(e.finalPoint, at(n, 4, 6));
});

test('explain: an unblocked single four is reported', () => {
  const n = 9;
  const s = newGame({ n });
  play(s, [at(n, 4, 0), at(n, 0, 0), at(n, 4, 1), at(n, 0, 2), at(n, 4, 2), at(n, 0, 4), at(n, 4, 3), at(n, 0, 6), at(n, 4, 4)]);
  const e = explain(s);
  assert.equal(e.doubleThreat, false);
  assert.equal(e.unblockedFour, true);
});

test('explain: counts blocks of a four', () => {
  const n = 9;
  const s = newGame({ n });
  play(s, [at(n, 4, 0), at(n, 0, 0), at(n, 4, 1), at(n, 0, 2), at(n, 4, 2), at(n, 0, 4), at(n, 4, 3), at(n, 4, 4)]);
  const e = explain(s);
  assert.equal(e.over, false);
  assert.equal(e.winner, -1);
  assert.deepEqual(e.blocks, [0, 1]);
});

test('diagonal winners are described as diagonal, columns as down', () => {
  const n = 9;
  const d = newGame({ n });
  play(d, [0, 72, 10, 74, 20, 76, 30, 78, 40]);
  assert.equal(explain(d).dir, 'diagonal');
  const c = newGame({ n });
  play(c, [8, 72, 16, 74, 24, 76, 32, 78, 40]); // anti-diagonal from the top-right corner
  const col = newGame({ n });
  play(col, [3, 72, 12, 74, 21, 76, 30, 78, 39]);
  assert.equal(explain(col).dir, 'down');
  assert.equal(explain(c).dir, 'diagonal');
});

test('every random playout ends with a legal win or a draw', () => {
  for (const n of SIZES) {
    for (let seed = 1; seed <= 25; seed++) {
      const rand = rng(seed * 7919 + n);
      const s = newGame({ n });
      let guard = 0;
      while (s.phase !== 'over') {
        const moves = legalMoves(s);
        assert.ok(moves.length > 0);
        const m = moves[Math.floor(rand() * moves.length)];
        assert.ok(place(s, m));
        assert.ok(++guard <= n * n);
      }
      assert.ok(s.draw || s.winner >= 0);
      if (s.winner >= 0) {
        assert.ok(s.winLine.length >= 5);
        assert.ok(s.winLine.every((i) => s.cells[i] === s.winner));
        assert.ok(s.winLine.includes(s.moves[s.moves.length - 1]));
      } else {
        assert.equal(s.moves.length, n * n);
      }
    }
  }
});
