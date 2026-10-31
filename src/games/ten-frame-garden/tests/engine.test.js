import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY, GIVEN, MINE, AUTO, GARDEN_SIZE, LEVELS,
  createFrame, plant, unplant, isComplete, needed, pair, restoreFrame, bondKey,
  emptyStats, normalizeStats, recordFrame, recordGarden, bondsSeen, bondsKnown, newlySeen,
  mulberry32, makeGarden, summarizeGarden, newBadges, BADGES,
} from '../js/engine.js';

const count = (cells, v) => cells.filter((c) => c === v).length;

/* ---------- frames ---------- */
test('level 2: given seeds fill the first cells and the rest are empty', () => {
  const f = createFrame(2, 6);
  assert.equal(f.cells.length, 10);
  assert.equal(count(f.cells, GIVEN), 6);
  assert.equal(count(f.cells, EMPTY), 4);
  assert.deepEqual(f.cells.slice(0, 6), [1, 1, 1, 1, 1, 1]);
  assert.equal(needed(f), 4);
  assert.equal(isComplete(f), false);
});

test('level 1 uses the same rules as level 2', () => {
  const a = createFrame(1, 3);
  const b = createFrame(2, 3);
  assert.deepEqual(a.cells, b.cells);
});

test('level 4: two frames of ten, given seeds from 11 to 19', () => {
  const f = createFrame(4, 14);
  assert.equal(f.cells.length, 20);
  assert.equal(count(f.cells, GIVEN), 14);
  assert.equal(needed(f), 6);
  assert.throws(() => createFrame(4, 9), RangeError);
  assert.throws(() => createFrame(4, 20), RangeError);
});

test('createFrame rejects bad levels and values', () => {
  assert.throws(() => createFrame(5, 3), RangeError);
  assert.throws(() => createFrame(2, 0), RangeError);
  assert.throws(() => createFrame(2, 10), RangeError);
  assert.throws(() => createFrame(2, 2.5), RangeError);
});

test('level 3 starts empty and needs target seeds', () => {
  const f = createFrame(3, 4);
  assert.equal(count(f.cells, EMPTY), 10);
  assert.equal(needed(f), 4);
  assert.equal(f.target, 4);
});

/* ---------- planting ---------- */
test('planting puts a child seed in the tapped cell and never changes the old state', () => {
  const f = createFrame(2, 6);
  const r = plant(f, 8);
  assert.equal(r.ok, true);
  assert.equal(r.state.cells[8], MINE);
  assert.equal(f.cells[8], EMPTY);
  assert.equal(needed(r.state), 3);
});

test('the child may tap any empty cell, in any order', () => {
  let s = createFrame(2, 6);
  for (const id of [9, 7, 6, 8]) {
    const r = plant(s, id);
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(isComplete(s), true);
});

test('tapping a full cell is refused with reason "filled"', () => {
  const f = createFrame(2, 6);
  const r = plant(f, 2);
  assert.deepEqual([r.ok, r.reason], [false, 'filled']);
  const again = plant(plant(f, 7).state, 7);
  assert.equal(again.reason, 'filled');
});

test('out of range taps are refused', () => {
  const f = createFrame(2, 6);
  assert.equal(plant(f, -1).reason, 'range');
  assert.equal(plant(f, 10).reason, 'range');
  assert.equal(plant(f, 1.5).reason, 'range');
});

test('a complete frame accepts no more seeds', () => {
  let s = createFrame(2, 9);
  s = plant(s, 9).state;
  assert.equal(isComplete(s), true);
  assert.equal(plant(s, 0).reason, 'done');
});

test('every frame of every level can be completed, and the pair adds up', () => {
  for (const level of [1, 2, 3, 4]) {
    const { min, max, size } = LEVELS[level];
    for (let given = min; given <= max; given++) {
      let s = createFrame(level, given);
      let guard = 0;
      while (!isComplete(s) && guard++ < 40) {
        const id = s.cells.indexOf(EMPTY);
        const r = plant(s, id);
        assert.equal(r.ok, true, `level ${level} given ${given}`);
        s = r.state;
      }
      assert.equal(isComplete(s), true);
      const [a, b, total] = pair(s);
      assert.equal(a + b, total);
      assert.equal(total, size);
      assert.equal(total, level === 4 ? 20 : 10);
      assert.equal(s.cells.includes(EMPTY), false, 'a finished frame has no empty cell');
    }
  }
});

/* ---------- level 3 ---------- */
test('level 3 fills the rest with auto seeds the moment the target is planted', () => {
  let s = createFrame(3, 4);
  for (const id of [0, 1, 2]) s = plant(s, id).state;
  assert.equal(isComplete(s), false);
  const last = plant(s, 3);
  assert.equal(last.ok, true);
  assert.equal(isComplete(last.state), true);
  assert.equal(count(last.state.cells, MINE), 4);
  assert.equal(count(last.state.cells, AUTO), 6);
  assert.deepEqual(pair(last.state), [4, 6, 10]);
  assert.equal(plant(last.state, 5).reason, 'done');
});

test('level 3: planting the target completes the frame at once, so one seed too many cannot happen', () => {
  let s = createFrame(3, 1);
  s = plant(s, 5).state;
  assert.equal(isComplete(s), true);
  assert.equal(plant(s, 0).reason, 'done');
  assert.equal(count(s.cells, EMPTY), 0);
});

/* ---------- unplant ---------- */
test('unplant removes only the child\'s own seed', () => {
  const f = createFrame(2, 6);
  const s = plant(f, 7).state;
  assert.equal(unplant(s, 2).reason, 'not_mine');
  const back = unplant(s, 7);
  assert.equal(back.ok, true);
  assert.deepEqual(back.state.cells, f.cells);
  assert.equal(back.state.planted, 0);
});

test('unplant on level 3 lowers the count and an empty cell is "not_mine"', () => {
  let s = createFrame(3, 3);
  s = plant(s, 4).state;
  assert.equal(unplant(s, 0).reason, 'not_mine');
  s = unplant(s, 4).state;
  assert.equal(needed(s), 3);
});

test('unplant is refused once the frame is complete', () => {
  let s = createFrame(2, 9);
  s = plant(s, 9).state;
  assert.equal(unplant(s, 9).reason, 'done');
});

/* ---------- restore ---------- */
test('restoreFrame rebuilds a half-done frame', () => {
  let s = createFrame(2, 6);
  s = plant(plant(s, 7).state, 9).state;
  const back = restoreFrame(2, 6, s.cells, [7, 9]);
  assert.deepEqual(back.cells, s.cells);
  assert.equal(back.planted, 2);
});

test('restoreFrame rebuilds level 3 and rejects damaged data', () => {
  let s = createFrame(3, 3);
  s = plant(s, 1).state;
  assert.deepEqual(restoreFrame(3, 3, s.cells).cells, s.cells);
  assert.equal(restoreFrame(3, 3, s.cells.slice(0, 5)), null);
  assert.equal(restoreFrame(9, 3, s.cells), null);
  assert.equal(restoreFrame(2, 6, 'nope'), null);
  assert.equal(restoreFrame(2, 6, [1, 1, 1, 1, 1, 1, 2, 2, 2, 2], [6, 7]), null);
});

/* ---------- bonds and stats ---------- */
test('bondKey maps levels to groups', () => {
  assert.deepEqual(bondKey(2, 7), { group: '10', index: 6, value: 7 });
  assert.deepEqual(bondKey(3, 1), { group: '10', index: 0, value: 1 });
  assert.deepEqual(bondKey(4, 14), { group: '20', index: 3, value: 14 });
});

test('a finished frame marks the bond seen; two hint-free frames make it known', () => {
  let st = emptyStats();
  st = recordFrame(st, 2, 7, { hint: true });
  assert.equal(st.bonds[10][6], 1);
  st = recordFrame(st, 2, 7, { hint: false });
  assert.equal(st.bonds[10][6], 1, 'only one hint-free frame so far');
  st = recordFrame(st, 1, 7, { hint: false });
  assert.equal(st.bonds[10][6], 2, 'level 1 and level 2 share the bonds to 10');
  assert.equal(st.frames, 3);
});

test('level 4 records into group 20 and leaves group 10 alone', () => {
  const st = recordFrame(emptyStats(), 4, 12, { hint: false });
  assert.equal(st.bonds[20][1], 1);
  assert.equal(bondsSeen(st, '10'), 0);
  assert.equal(bondsSeen(st, '20'), 1);
});

test('recordFrame does not change its input', () => {
  const st = emptyStats();
  recordFrame(st, 2, 3);
  assert.equal(st.frames, 0);
  assert.equal(st.bonds[10][2], 0);
});

test('recordGarden counts gardens and hint-free gardens', () => {
  let st = recordGarden(emptyStats(), { noHint: true });
  st = recordGarden(st, { noHint: false });
  assert.equal(st.gardens, 2);
  assert.equal(st.noHintGardens, 1);
});

test('normalizeStats repairs damaged data', () => {
  assert.deepEqual(normalizeStats(null), emptyStats());
  assert.deepEqual(normalizeStats('x'), emptyStats());
  const st = normalizeStats({ bonds: { 10: [9, 9, -4, 'a'] }, frames: -2, gardens: 'q' });
  assert.deepEqual(st.bonds[10], [2, 2, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(st.frames, 0);
  assert.equal(st.gardens, 0);
});

test('bondsKnown and newlySeen', () => {
  let a = emptyStats();
  let b = recordFrame(a, 2, 3);
  b = recordFrame(b, 2, 3);
  b = recordFrame(b, 2, 8, { hint: true });
  assert.equal(bondsKnown(b, '10'), 1);
  assert.deepEqual(newlySeen(a, b, '10'), [3, 8]);
  assert.deepEqual(newlySeen(b, b, '10'), []);
});

/* ---------- gardens ---------- */
test('mulberry32 repeats for the same seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('a garden has 5 distinct values in range, for every level and many seeds', () => {
  for (const level of [1, 2, 3, 4]) {
    const { min, max } = LEVELS[level];
    for (let seed = 1; seed <= 200; seed++) {
      const g = makeGarden(level, emptyStats(), mulberry32(seed));
      assert.equal(g.length, GARDEN_SIZE);
      assert.equal(new Set(g).size, GARDEN_SIZE);
      for (const v of g) assert.ok(v >= min && v <= max, `${v} out of range for level ${level}`);
      for (const v of g) assert.doesNotThrow(() => createFrame(level, v));
    }
  }
});

test('a garden never repeats a value in a row', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const g = makeGarden(2, emptyStats(), mulberry32(seed));
    for (let i = 1; i < g.length; i++) assert.notEqual(g[i], g[i - 1]);
  }
});

test('makeGarden is repeatable with the same seed', () => {
  const st = emptyStats();
  assert.deepEqual(makeGarden(2, st, mulberry32(7)), makeGarden(2, st, mulberry32(7)));
});

test('unseen bonds are drawn first most of the time', () => {
  // Bonds 1-5 are known; 6-9 are unseen. Over many gardens the first pick should be unseen far more often.
  let st = emptyStats();
  for (const v of [1, 2, 3, 4, 5]) {
    st = recordFrame(st, 2, v);
    st = recordFrame(st, 2, v);
  }
  let unseenFirst = 0;
  const runs = 400;
  for (let seed = 1; seed <= runs; seed++) {
    const g = makeGarden(2, st, mulberry32(seed));
    if (g[0] >= 6) unseenFirst++;
  }
  // Expected share of unseen: 4*6 / (4*6 + 5*1) = about 83%. Allow wide margin.
  assert.ok(unseenFirst / runs > 0.7, `unseen first only ${unseenFirst} of ${runs}`);
});

test('known bonds still appear', () => {
  let st = emptyStats();
  for (let v = 1; v <= 9; v++) {
    st = recordFrame(st, 2, v);
    st = recordFrame(st, 2, v);
  }
  const seen = new Set();
  for (let seed = 1; seed <= 50; seed++) makeGarden(2, st, mulberry32(seed)).forEach((v) => seen.add(v));
  assert.equal(seen.size, 9);
});

test('summarizeGarden counts hint-free frames', () => {
  const s = summarizeGarden([{ given: 1, hint: false }, { given: 2, hint: true }, { given: 3, hint: false }]);
  assert.deepEqual(s, { count: 3, noHint: 2, anyHint: true });
});

/* ---------- badges ---------- */
test('badges: first flower, full garden, no-hint garden, twenty, every pair', () => {
  let st = recordFrame(emptyStats(), 2, 4);
  assert.deepEqual(newBadges([], { stats: st }), ['first_flower']);
  assert.deepEqual(newBadges(['first_flower'], { stats: st, gardenDone: true, gardenNoHint: true }), ['full_garden', 'no_hint_garden']);
  assert.deepEqual(newBadges([], { stats: st, gardenDone: true, gardenNoHint: false }), ['first_flower', 'full_garden']);
  const st20 = recordFrame(emptyStats(), 4, 15);
  assert.ok(newBadges([], { stats: st20 }).includes('twenty'));
  let all = emptyStats();
  for (let v = 1; v <= 9; v++) all = recordFrame(all, 2, v);
  assert.ok(newBadges([], { stats: all }).includes('all_bonds_10'));
  assert.ok(!newBadges([], { stats: st }).includes('all_bonds_10'));
});

test('every badge id has a name', () => {
  for (const id of ['first_flower', 'full_garden', 'all_bonds_10', 'no_hint_garden', 'twenty']) assert.ok(BADGES[id]);
});
