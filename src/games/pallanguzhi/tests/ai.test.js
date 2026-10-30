import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyMove, legalPits, cloneState } from '../js/engine.js';
import { chooseMove, LEVELS } from '../js/ai.js';

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Play a whole game: `botSide` uses the bot at `level`, the other side plays random pits.
function playVsRandom(botSide, level, seed) {
  const rng = lcg(seed);
  const g = newGame({ first: seed % 2 });
  let guard = 0;
  while (!g.over && guard++ < 2000) {
    if (g.turn === botSide) {
      const move = chooseMove(g, { level, timeMs: 60, rng });
      assert.ok(legalPits(g).includes(move), 'bot move is legal');
      applyMove(g, move);
    } else {
      const moves = legalPits(g);
      applyMove(g, moves[Math.floor(rng() * moves.length)]);
    }
  }
  assert.ok(g.over);
  return g;
}

test('every level returns a legal pit and does not change the state it is given', () => {
  for (const level of LEVELS) {
    const g = newGame();
    const before = JSON.stringify(g);
    const move = chooseMove(g, { level, timeMs: 80, rng: lcg(7) });
    assert.ok(legalPits(g).includes(move), `${level} legal`);
    assert.equal(JSON.stringify(g), before, `${level} leaves the state alone`);
  }
});

test('returns null when there is no move, and the only move when there is one', () => {
  const over = newGame();
  over.over = true;
  assert.equal(chooseMove(over), null);
  const one = newGame();
  one.pits.fill(0);
  one.pits[3] = 4;
  one.pits[9] = 1;
  assert.equal(chooseMove(one, { level: 'hard', timeMs: 50 }), 3);
});

test('the bot takes an available capture on medium', () => {
  const g = newGame();
  g.pits.fill(0);
  g.pits[2] = 2; // 2 -> sows 3, 4; pit 5 empty; captures pit 6 (9)
  g.pits[6] = 9;
  g.pits[0] = 1; // 0 -> sows 1; next pit 2 is full, so it relays: not a capture of 9
  g.pits[10] = 3;
  const move = chooseMove(g, { level: 'medium' });
  assert.equal(move, 2);
});

test('medium beats a random player in most games from both sides', () => {
  let wins = 0;
  const games = 12;
  for (let i = 0; i < games; i++) {
    const side = i % 2;
    const g = playVsRandom(side, 'medium', 100 + i);
    if (g.result === side) wins++;
  }
  assert.ok(wins >= 9, `medium won ${wins} of ${games}`);
});

test('hard beats a random player in most games', () => {
  let wins = 0;
  const games = 6;
  for (let i = 0; i < games; i++) {
    const side = i % 2;
    const g = playVsRandom(side, 'hard', 300 + i);
    if (g.result === side) wins++;
  }
  assert.ok(wins >= 5, `hard won ${wins} of ${games}`);
});

test('easy can be beaten: it does not win every game against random', () => {
  let losses = 0;
  const games = 20;
  for (let i = 0; i < games; i++) {
    const side = i % 2;
    const g = playVsRandom(side, 'easy', 500 + i);
    if (g.result !== side) losses++;
  }
  assert.ok(losses >= 1, 'easy should lose or draw at least once in 20 games');
});

test('hard respects its time cap', () => {
  const g = newGame();
  const start = Date.now();
  chooseMove(cloneState(g), { level: 'hard', timeMs: 300 });
  assert.ok(Date.now() - start < 1500, 'hard finished well inside the cap');
});
