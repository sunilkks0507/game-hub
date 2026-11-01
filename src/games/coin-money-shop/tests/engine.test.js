import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PIECES, DAY_SIZE, mulberry32, trayFor, trayValues, priceList, validGivens, createSale, total, target, remaining,
  addPiece, removePiece, undo, useHint, fewestPieces, suggest, settle, nextStreak, makeDay, normalizeStats, recordSale,
  recordDay, earnedBadges, newBadges, summarizeDay, validCustomer, restoreDay, pieceKind,
} from '../js/engine.js';
import { ITEMS, itemsForPrice } from '../js/items.js';

const sale = (level, price, given = null) => createSale(level, { itemId: 'pencil', price, given });
function tapAll(state, values) {
  for (const v of values) state = addPiece(state, v).state;
  return state;
}

/* ---------- trays and prices ---------- */
test('trays match the spec', () => {
  assert.deepEqual(trayValues(1), [1, 2, 5, 10]);
  assert.deepEqual(trayValues(2), [5, 10, 20, 50, 100]);
  assert.deepEqual(trayValues(3), [1, 2, 5, 10, 20, 50]);
  assert.ok(trayFor(1).every((p) => p.kind === 'coin'));
  assert.equal(pieceKind(1, 10), 'coin');
  assert.equal(pieceKind(2, 10), 'note');
  assert.equal(pieceKind(3, 5), 'coin');
  assert.equal(pieceKind(3, 50), 'note');
});

test('price lists are in range', () => {
  assert.deepEqual([priceList(1)[0], priceList(1).at(-1), priceList(1).length], [1, 20, 20]);
  assert.deepEqual(priceList(2).slice(0, 3), [10, 15, 20]);
  assert.equal(priceList(2).at(-1), 100);
  assert.ok(priceList(2).every((p) => p % 5 === 0));
  assert.deepEqual([priceList(3)[0], priceList(3).at(-1)], [1, 99]);
});

test('every Level 3 price has a note that gives 1 to 60 change', () => {
  for (const p of priceList(3)) {
    const g = validGivens(p);
    assert.ok(g.length > 0, `price ${p}`);
    for (const n of g) assert.ok(n > p && n - p >= 1 && n - p <= 60);
  }
});

/* ---------- a sale ---------- */
test('createSale builds a clean state and checks its input', () => {
  const s = sale(1, 17);
  assert.deepEqual(s.pieces, []);
  assert.equal(s.settled, false);
  assert.equal(s.given, null);
  assert.equal(target(s), 17);
  assert.throws(() => createSale(4, { itemId: 'pencil', price: 5 }), RangeError);
  assert.throws(() => createSale(1, { itemId: 'pencil', price: 0 }), RangeError);
  assert.throws(() => sale(3, 37, 20), RangeError); // a 20 note is less than the price, so no change
  assert.throws(() => sale(3, 37, 100), RangeError); // change 63 is too big
  assert.equal(target(sale(3, 37, 50)), 13);
});

test('addPiece adds, and refuses a wrong value, a 13th piece and a settled sale', () => {
  let s = sale(1, 17);
  const r = addPiece(s, 5);
  assert.ok(r.ok);
  assert.deepEqual(r.state.pieces, [5]);
  assert.deepEqual(s.pieces, [], 'does not change the old state');
  assert.deepEqual(addPiece(s, 20), { ok: false, reason: 'denom', state: s });
  s = tapAll(s, Array(MAX_PIECES).fill(1));
  assert.equal(s.pieces.length, 12);
  assert.equal(addPiece(s, 1).reason, 'full');
  const done = settle(tapAll(sale(1, 3), [1, 2])).state;
  assert.equal(addPiece(done, 1).reason, 'done');
});

test('removePiece and undo take pieces out', () => {
  const s = tapAll(sale(1, 17), [10, 5, 2]);
  assert.deepEqual(removePiece(s, 0).pieces, [5, 2]);
  assert.deepEqual(undo(s).pieces, [10, 5]);
  assert.equal(removePiece(s, 9), s);
  assert.equal(removePiece(s, -1), s);
  assert.deepEqual(undo(sale(1, 5)).pieces, []);
});

test('total, remaining and useHint', () => {
  let s = tapAll(sale(1, 17), [10, 5]);
  assert.equal(total(s), 15);
  assert.equal(remaining(s), 2);
  s = tapAll(s, [5]);
  assert.equal(remaining(s), 0, 'never below zero');
  assert.equal(useHint(s).hints, 1);
});

/* ---------- settle ---------- */
test('Levels 1-2: exact finishes, short keeps going, over finishes with change', () => {
  const exact = settle(tapAll(sale(1, 17), [10, 5, 2]));
  assert.deepEqual([exact.done, exact.kind, exact.diff, exact.change], [true, 'exact', 0, []]);
  assert.equal(exact.state.settled, true);

  const short = settle(tapAll(sale(1, 17), [10, 5]));
  assert.deepEqual([short.done, short.kind, short.diff], [false, 'short', 2]);
  assert.equal(short.state.settled, false);

  const over = settle(tapAll(sale(1, 7), [10]));
  assert.deepEqual([over.done, over.kind, over.diff], [true, 'over', 3]);
  assert.deepEqual(over.change, [2, 1]);
  assert.equal(over.state.settled, true);

  const over2 = settle(tapAll(sale(2, 65), [100]));
  assert.equal(over2.done, true);
  assert.deepEqual(over2.change, [20, 10, 5]);
});

test('an empty till is short', () => {
  const r = settle(sale(2, 20));
  assert.deepEqual([r.done, r.kind, r.diff], [false, 'short', 20]);
});

test('Level 3: exact finishes, short continues, over does NOT finish', () => {
  const s = sale(3, 37, 50); // change due 13
  const exact = settle(tapAll(s, [10, 2, 1]));
  assert.deepEqual([exact.done, exact.kind], [true, 'exact']);
  const short = settle(tapAll(s, [10, 2]));
  assert.deepEqual([short.done, short.kind, short.diff], [false, 'short', 1]);
  const over = settle(tapAll(s, [10, 5]));
  assert.deepEqual([over.done, over.kind, over.diff, over.change], [false, 'over', 2, []]);
  assert.equal(over.state.settled, false);
});

test('streak goes up on exact and resets on over', () => {
  assert.equal(nextStreak(2, 'exact'), 3);
  assert.equal(nextStreak(4, 'over'), 0);
});

/* ---------- fewestPieces and suggest ---------- */
test('fewestPieces is minimal and sums to the amount, for every amount on every tray', () => {
  for (const level of [1, 2, 3]) {
    const tray = trayFor(level);
    const unit = Math.min(...trayValues(level));
    for (let a = 0; a <= 100; a++) {
      const got = fewestPieces(a, tray);
      if (a % unit !== 0 && level === 2) {
        assert.equal(got, null, `L${level} ${a} should be impossible`);
        continue;
      }
      assert.ok(got, `L${level} ${a}`);
      assert.equal(got.reduce((x, y) => x + y, 0), a);
      // greedy is optimal on these canonical coin systems, so the DP must match it
      let rest = a;
      let count = 0;
      for (const v of [...trayValues(level)].sort((x, y) => y - x)) {
        count += Math.floor(rest / v);
        rest %= v;
      }
      assert.equal(got.length, count, `L${level} ${a} not minimal`);
    }
  }
});

test('fewestPieces handles zero, a plain number tray and bad input', () => {
  assert.deepEqual(fewestPieces(0, trayFor(1)), []);
  assert.deepEqual(fewestPieces(13, [1, 2, 5, 10]), [10, 2, 1]);
  assert.equal(fewestPieces(-1, [1]), null);
  assert.equal(fewestPieces(3, [5]), null);
});

test('suggest returns the biggest piece not above what is left, and eventually finishes the sale', () => {
  for (const level of [1, 2, 3]) {
    for (const price of priceList(level)) {
      const given = level === 3 ? validGivens(price)[0] : null;
      let s = createSale(level, { itemId: 'pencil', price, given });
      let guard = 0;
      while (suggest(s)) {
        const v = suggest(s);
        assert.ok(v <= remaining(s) || v === Math.min(...trayValues(level)));
        s = addPiece(s, v).state;
        assert.ok(++guard <= MAX_PIECES, `L${level} price ${price} needs too many pieces`);
      }
      assert.equal(settle(s).kind, 'exact', `L${level} price ${price}`);
    }
  }
  assert.equal(suggest(tapAll(sale(1, 5), [5])), null);
});

/* ---------- day generator ---------- */
test('makeDay returns 8 customers with distinct, in-range prices for every level (many seeds)', () => {
  for (const level of [1, 2, 3]) {
    for (let seed = 1; seed <= 200; seed++) {
      const day = makeDay(level, mulberry32(seed));
      assert.equal(day.length, DAY_SIZE);
      assert.equal(new Set(day.map((c) => c.price)).size, DAY_SIZE, `L${level} seed ${seed}: repeated price`);
      for (const c of day) assert.ok(validCustomer(level, c), `L${level} seed ${seed}: ${JSON.stringify(c)}`);
    }
  }
});

test('makeDay never gives the same item twice in a row, and the item fits the price', () => {
  for (const level of [1, 2, 3]) {
    for (let seed = 1; seed <= 200; seed++) {
      const day = makeDay(level, mulberry32(seed));
      day.forEach((c, i) => {
        if (i > 0) assert.notEqual(c.itemId, day[i - 1].itemId, `L${level} seed ${seed}`);
        const it = ITEMS.find((x) => x.id === c.itemId);
        assert.ok(c.price >= it.lo && c.price <= it.hi);
      });
    }
  }
});

test('a day mixes small and big prices (one from each stretch of the list)', () => {
  for (const level of [1, 2, 3]) {
    const list = priceList(level);
    const prices = makeDay(level, mulberry32(7)).map((c) => c.price).sort((a, b) => a - b);
    assert.ok(prices[0] <= list[Math.floor(list.length / 8)], 'has a small price');
    assert.ok(prices.at(-1) >= list[Math.floor((7 * list.length) / 8)], 'has a big price');
  }
});

test('every allowed price has at least 2 items', () => {
  for (const level of [1, 2, 3]) {
    for (const p of priceList(level)) assert.ok(itemsForPrice(p).length >= 2, `L${level} price ${p}`);
  }
});

test('Level 3 days: given note is valid and change is 1 to 60', () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (const c of makeDay(3, mulberry32(seed))) {
      const change = c.given - c.price;
      assert.ok(change >= 1 && change <= 60, `${c.price} ${c.given}`);
    }
  }
});

test('the same seed gives the same day, different seeds differ', () => {
  assert.deepEqual(makeDay(2, mulberry32(5)), makeDay(2, mulberry32(5)));
  assert.notDeepEqual(makeDay(2, mulberry32(5)), makeDay(2, mulberry32(6)));
});

/* ---------- stats and badges ---------- */
test('normalizeStats repairs bad data', () => {
  const s = normalizeStats({ sales: -3, exact: 'x', levels: { 2: { sales: 4.7 } } });
  assert.equal(s.sales, 0);
  assert.equal(s.exact, 0);
  assert.equal(s.levels[2].sales, 4);
  assert.deepEqual(s.levels[1], { sales: 0, exact: 0, days: 0 });
  assert.deepEqual(normalizeStats(null).levels[3], { sales: 0, exact: 0, days: 0 });
});

test('recordSale counts exact sales only as exact, and keeps the best streak', () => {
  let s = normalizeStats(null);
  s = recordSale(s, 1, { kind: 'exact', streak: 1 });
  s = recordSale(s, 1, { kind: 'exact', streak: 2 });
  s = recordSale(s, 1, { kind: 'over', streak: 0 });
  assert.equal(s.sales, 3);
  assert.equal(s.exact, 2);
  assert.equal(s.levels[1].sales, 3);
  assert.equal(s.levels[1].exact, 2);
  assert.equal(s.bestStreak, 2);
});

test('badges: each one is earned at the right moment', () => {
  let s = normalizeStats(null);
  assert.deepEqual(earnedBadges(s), []);
  s = recordSale(s, 1, { kind: 'over', streak: 0 });
  assert.deepEqual(earnedBadges(s), ['first_sale'], 'an over sale still counts as a sale');
  s = recordSale(s, 2, { kind: 'exact', streak: 1 });
  assert.ok(earnedBadges(s).includes('note_maker'));
  s = recordSale(s, 3, { kind: 'exact', streak: 5 });
  assert.ok(earnedBadges(s).includes('change_giver'));
  assert.ok(earnedBadges(s).includes('five_row'));
  assert.ok(!earnedBadges(s).includes('full_day'));
  s = recordDay(s, 1);
  assert.ok(earnedBadges(s).includes('full_day'));
  assert.ok(!earnedBadges(s).includes('shopkeeper'));
  s = recordDay(recordDay(s, 2), 3);
  assert.ok(earnedBadges(s).includes('shopkeeper'));
  assert.deepEqual(newBadges(['first_sale'], s).includes('first_sale'), false);
});

/* ---------- summary ---------- */
test('summarizeDay says why: exact, clean, biggest sale and over sales', () => {
  const records = [
    { price: 17, kind: 'exact', hints: 0, pieces: [10, 5, 2], paid: 17, change: [] },
    { price: 7, kind: 'over', hints: 0, pieces: [10], paid: 10, change: [2, 1] },
    { price: 9, kind: 'exact', hints: 1, pieces: [5, 2, 2], paid: 9, change: [] },
  ];
  const sum = summarizeDay(records, 1);
  assert.equal(sum.customers, 3);
  assert.equal(sum.exact, 2);
  assert.equal(sum.clean, 1);
  assert.deepEqual(sum.biggest, { price: 17, pieces: 3 });
  assert.deepEqual(sum.overs, [{ price: 7, paid: 10, change: 3 }]);
  assert.equal(summarizeDay(records, 3).changeGiven, 3);
});

/* ---------- saved day ---------- */
test('restoreDay accepts a good save and rejects bad ones', () => {
  const day = makeDay(1, mulberry32(3));
  const good = {
    level: 1, day, index: 2, pieces: [1], hints: 1, streak: 2,
    records: [{ price: day[0].price, kind: 'exact' }, { price: day[1].price, kind: 'exact' }],
  };
  const r = restoreDay(good);
  assert.ok(r);
  assert.equal(r.sale.pieces[0], 1);
  assert.equal(r.sale.hints, 1);
  assert.equal(r.streak, 2);
  assert.equal(restoreDay(null), null);
  assert.equal(restoreDay({ ...good, level: 9 }), null);
  assert.equal(restoreDay({ ...good, index: 8 }), null);
  assert.equal(restoreDay({ ...good, pieces: [3] }), null, 'a piece not in the tray');
  assert.equal(restoreDay({ ...good, records: [] }), null, 'records must match the index');
  assert.equal(restoreDay({ ...good, day: day.slice(0, 5) }), null);
  assert.equal(restoreDay({ ...good, day: day.map((c) => ({ ...c, price: 99 })) }), null);
});

test('no engine function uses Math.random', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../js/engine.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Math\.random/);
});
