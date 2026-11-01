import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, stepSale, TUTORIAL_LEVEL } from '../js/tutorial.js';
import { addPiece, settle, trayValues, total, target } from '../js/engine.js';

test('the tutorial has 3 to 5 steps', () => {
  assert.ok(STEPS.length >= 3 && STEPS.length <= 5);
  assert.equal(STEPS.length, 4);
});

test('every bubble is 12 words or fewer', () => {
  for (const s of STEPS) assert.ok(s.text.split(/\s+/).length <= 12, `${s.id}: too long`);
});

test('every step opens on a real, unfinished sale', () => {
  for (const s of STEPS) {
    const sale = stepSale(s);
    assert.equal(sale.level, TUTORIAL_LEVEL);
    assert.equal(sale.settled, false);
    assert.equal(sale.pieces.length, s.pre.length);
    assert.ok(total(sale) < target(sale), `${s.id}: starts already paid`);
  }
});

test('glowing pieces are really in the tray', () => {
  for (const s of STEPS) for (const v of s.glow) assert.ok(trayValues(TUTORIAL_LEVEL).includes(v), `${s.id}: ${v}`);
});

test('the guided pay step finishes exactly by following the glow, and "add" step takes any coin', () => {
  const pay = STEPS.find((s) => s.id === 'pay');
  let sale = stepSale(pay);
  for (const v of pay.glow) sale = addPiece(sale, v).state;
  assert.equal(settle(sale).kind, 'exact');
  const coin = STEPS.find((s) => s.id === 'coin');
  for (const v of trayValues(TUTORIAL_LEVEL)) assert.ok(addPiece(stepSale(coin), v).ok);
});

test('the practice step can be finished with the fewest pieces', () => {
  const p = STEPS.find((s) => s.id === 'practice');
  let sale = stepSale(p);
  for (const v of [5, 2, 2]) sale = addPiece(sale, v).state;
  assert.equal(settle(sale).kind, 'exact');
});
