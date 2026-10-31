import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, place, legalMoves, fromStones, SIZES } from '../js/engine.js';
import { chooseMove, chooseSwap, openingMove, hint, threats, centreDistance, LEVELS } from '../js/ai.js';

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
const at = (n, r, c) => r * n + c;
const opts = (level, seed = 1, extra = {}) => ({ level, rng: rng(seed), timeMs: 200, ...extra });

// Black has four in row 4 (columns 0-3), White has scattered stones; it is `turn`'s move.
function fourPosition(blackToMove) {
  const n = 9;
  const black = [at(n, 4, 0), at(n, 4, 1), at(n, 4, 2), at(n, 4, 3)];
  const white = [at(n, 0, 0), at(n, 0, 2), at(n, 0, 4), at(n, 8, 8)];
  return { n, state: fromStones(n, black, white, blackToMove ? 0 : 1) };
}

test('every level makes five when it can', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 10; seed++) {
      const { state, n } = fourPosition(true);
      // Easy plays a random nearby point 30% of the time; check the non-random draws and the others always.
      const mv = chooseMove(state, opts(level, seed));
      if (level !== 'easy') assert.equal(mv, at(n, 4, 4), `${level} seed ${seed}`);
    }
  }
  let wins = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const { state, n } = fourPosition(true);
    if (chooseMove(state, opts('easy', seed)) === at(n, 4, 4)) wins++;
  }
  assert.ok(wins >= 60, `easy finished the five ${wins}/100`);
});

test('Medium and Hard always block a four; Easy blocks most of the time but not always', () => {
  for (const level of ['medium', 'hard']) {
    for (let seed = 1; seed <= 10; seed++) {
      const { state, n } = fourPosition(false);
      assert.equal(chooseMove(state, opts(level, seed)), at(n, 4, 4), level);
    }
  }
  let blocks = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { state, n } = fourPosition(false);
    if (chooseMove(state, opts('easy', seed)) === at(n, 4, 4)) blocks++;
  }
  assert.ok(blocks > 100 && blocks < 200, `easy blocked ${blocks}/200`);
});

test('Medium and Hard stop an open three; both ends are valid answers', () => {
  const n = 9;
  const black = [at(n, 4, 3), at(n, 4, 4), at(n, 4, 5)];
  const white = [at(n, 0, 0), at(n, 0, 2), at(n, 8, 8)];
  for (const level of ['medium', 'hard']) {
    const state = fromStones(n, black, white, 1);
    const mv = chooseMove(state, opts(level, 3));
    assert.ok([at(n, 4, 2), at(n, 4, 6)].includes(mv), `${level} played ${mv}`);
  }
});

test('Medium makes an open four when it can', () => {
  const n = 9;
  const state = fromStones(n, [at(n, 4, 3), at(n, 4, 4), at(n, 4, 5)], [at(n, 0, 0), at(n, 0, 2), at(n, 8, 8)], 0);
  const mv = chooseMove(state, opts('medium', 2));
  assert.ok([at(n, 4, 2), at(n, 4, 6)].includes(mv));
});

test('Hard finds a forced win made of fours (a four, then an open four)', () => {
  const n = 9;
  const black = [at(n, 4, 3), at(n, 4, 4), at(n, 4, 5), at(n, 6, 6), at(n, 7, 6)];
  const white = [at(n, 4, 2), at(n, 0, 0), at(n, 0, 2), at(n, 8, 0), at(n, 8, 2)];
  const state = fromStones(n, black, white, 0);
  assert.equal(chooseMove(state, opts('hard', 5)), at(n, 4, 6));
});

test('Hard answers within about 1.5 s on a busy 15x15 board', () => {
  const n = 15;
  const r = rng(99);
  const s = newGame({ n });
  const centre = at(n, 7, 7);
  place(s, centre);
  for (let k = 0; k < 24; k++) {
    const near = legalMoves(s).filter((p) => Math.abs(Math.floor(p / n) - 7) <= 3 && Math.abs((p % n) - 7) <= 3);
    const res = place(s, near[Math.floor(r() * near.length)]);
    if (res.won) break;
  }
  assert.equal(s.phase, 'play');
  const t0 = Date.now();
  const mv = chooseMove(s, { level: 'hard', rng: rng(7), timeMs: 1500 });
  const took = Date.now() - t0;
  assert.ok(legalMoves(s).includes(mv));
  assert.ok(took < 2200, `took ${took} ms`);
});

test('the computer only ever plays legal moves, at every level and size', () => {
  for (const level of LEVELS) {
    for (const n of SIZES) {
      const s = newGame({ n });
      const r = rng(n * 31);
      let turns = 0;
      while (s.phase !== 'over' && turns < 14) {
        const mv = chooseMove(s, { level, rng: r, timeMs: 60, maxDepth: 4 });
        assert.ok(place(s, mv), `${level} ${n}: ${mv} not legal`);
        turns++;
      }
    }
  }
});

function playOut(botBlack, botWhite, seed, n = 9) {
  const r = rng(seed);
  const s = newGame({ n });
  while (s.phase !== 'over') {
    const who = s.current === 0 ? botBlack : botWhite;
    let mv;
    if (who === 'random') {
      const m = legalMoves(s);
      mv = m[Math.floor(r() * m.length)];
    } else mv = chooseMove(s, { level: who, rng: r, timeMs: 60, maxDepth: 4 });
    assert.ok(place(s, mv));
  }
  return s;
}

test('Medium and Hard beat a random player in seeded games (as either colour)', () => {
  for (const level of ['medium', 'hard']) {
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const asBlack = seed % 2 === 1;
      const s = playOut(asBlack ? level : 'random', asBlack ? 'random' : level, seed);
      if (s.winner === (asBlack ? 0 : 1)) wins++;
    }
    assert.equal(wins, 10, `${level} won ${wins}/10`);
  }
});

test('Easy beats a random player most of the time, but Medium beats Easy more often', () => {
  let easyWins = 0;
  let mediumWins = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const easyBlack = seed % 2 === 1;
    const a = playOut(easyBlack ? 'easy' : 'random', easyBlack ? 'random' : 'easy', seed);
    if (a.winner === (easyBlack ? 0 : 1)) easyWins++;
    const medBlack = seed % 2 === 1;
    const b = playOut(medBlack ? 'medium' : 'easy', medBlack ? 'easy' : 'medium', 100 + seed);
    if (b.winner === (medBlack ? 0 : 1)) mediumWins++;
  }
  assert.ok(easyWins >= 14, `easy beat random ${easyWins}/20`);
  assert.ok(mediumWins >= 14, `medium beat easy ${mediumWins}/20`);
});

test('Hard beats Medium more often than not', () => {
  let hardWins = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const hardBlack = seed % 2 === 1;
    const s = playOut(hardBlack ? 'hard' : 'medium', hardBlack ? 'medium' : 'hard', 300 + seed);
    if (s.winner === (hardBlack ? 0 : 1)) hardWins++;
  }
  assert.ok(hardWins >= 3, `hard beat medium ${hardWins}/6`);
});

test('same seed, same move', () => {
  const s = newGame();
  place(s, 40);
  place(s, 41);
  for (const level of ['easy', 'medium']) {
    assert.equal(chooseMove(s, opts(level, 11)), chooseMove(s, opts(level, 11)));
  }
});

test('opening: centre normally, a ring outside the swap zone with Fair start', () => {
  for (const n of SIZES) {
    const plain = newGame({ n });
    assert.equal(chooseMove(plain, opts('medium')), at(n, Math.floor(n / 2), Math.floor(n / 2)));
    const fair = newGame({ n, fairStart: true });
    for (let seed = 1; seed <= 20; seed++) {
      const p = openingMove(fair, rng(seed));
      assert.equal(centreDistance(n, p), Math.floor(n / 4) + 1);
    }
  }
});

test('the computer swaps when the first stone is close to the centre, not when it is far', () => {
  const near = newGame({ fairStart: true });
  place(near, at(9, 4, 4));
  assert.equal(chooseSwap(near), true);
  const edge = newGame({ fairStart: true });
  place(edge, at(9, 0, 0));
  assert.equal(chooseSwap(edge), false);
  const ring = newGame({ fairStart: true });
  place(ring, at(9, 1, 4)); // distance 3 = first seat's own ring
  assert.equal(chooseSwap(ring), false);
});

test('hint names a reason', () => {
  const { state, n } = fourPosition(true);
  const h = hint(state, rng(1));
  assert.equal(h.point, at(n, 4, 4));
  assert.equal(h.kind, 'win');
  const { state: s2 } = fourPosition(false);
  assert.equal(hint(s2, rng(1)).kind, 'block-four');
  assert.equal(hint(newGame(), rng(1)).kind, 'build');
});

test('threats: win, block and watch points', () => {
  const { state, n } = fourPosition(true);
  assert.deepEqual(threats(state).win, [at(n, 4, 4)]);
  const { state: s2 } = fourPosition(false);
  assert.deepEqual(threats(s2).block, [at(n, 4, 4)]);
  const three = fromStones(n, [at(n, 4, 3), at(n, 4, 4), at(n, 4, 5)], [at(n, 0, 0), at(n, 0, 2), at(n, 8, 8)], 1);
  const t = threats(three);
  assert.deepEqual(t.block, []);
  assert.ok(t.watch.includes(at(n, 4, 2)) && t.watch.includes(at(n, 4, 6)));
  const done = newGame();
  done.phase = 'over';
  assert.deepEqual(threats(done), { win: [], block: [], watch: [] });
});
