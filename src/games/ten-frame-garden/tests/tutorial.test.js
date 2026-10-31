import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, stepState } from '../js/tutorial.js';
import { isComplete, needed, plant, EMPTY } from '../js/engine.js';

test('the tutorial has 3 to 5 steps and ends on the levels screen', () => {
  assert.ok(STEPS.length >= 3 && STEPS.length <= 5);
  assert.equal(STEPS[STEPS.length - 1].type, 'levels');
});

test('every bubble is 12 words or fewer and has no digits (so it fits the Dots level)', () => {
  for (const s of STEPS) {
    assert.ok(s.text.split(/\s+/).length <= 12, `${s.id}: too long`);
    assert.doesNotMatch(s.text, /\d/, `${s.id}: has a digit`);
  }
});

test('every planting step can be finished by tapping empty cells', () => {
  for (const s of STEPS.filter((x) => x.type === 'plant')) {
    let state = stepState(s);
    assert.ok(!isComplete(state), `${s.id}: starts finished`);
    assert.ok(s.count <= needed(state), `${s.id}: asks for more seeds than there is room for`);
    for (let i = 0; i < s.count; i++) {
      const id = state.cells.indexOf(EMPTY);
      const r = plant(state, id);
      assert.ok(r.ok, `${s.id}: could not plant`);
      state = r.state;
    }
  }
});

test('the "fill" step ends with a full frame and the practice frame fills too', () => {
  for (const id of ['fill', 'practice']) {
    const s = STEPS.find((x) => x.id === id);
    let state = stepState(s);
    for (let i = 0; i < s.count; i++) state = plant(state, state.cells.indexOf(EMPTY)).state;
    assert.ok(isComplete(state), `${id} should end full`);
  }
});
