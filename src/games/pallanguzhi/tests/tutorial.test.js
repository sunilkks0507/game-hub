import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, STEPS, scenarioKinds, scenarioState } from '../js/tutorial.js';
import { legalPits, totalSeeds } from '../js/engine.js';

test('tutorial has 3 to 5 steps, ends with the practice offer', () => {
  assert.ok(STEPS.length >= 3 && STEPS.length <= 5);
  assert.equal(STEPS.at(-1).type, 'practice');
});

test('every mascot line is 12 words or fewer', () => {
  for (const s of STEPS) {
    const words = s.text.trim().split(/\s+/).length;
    assert.ok(words <= 12, `"${s.text}" has ${words} words`);
  }
});

test('each scenario target is a legal pit for the child', () => {
  for (const [name, scn] of Object.entries(SCENARIOS)) {
    const state = scenarioState(name);
    assert.ok(legalPits(state).includes(scn.target), `${name}: target is playable`);
  }
});

test('each scenario really shows the rule it teaches', () => {
  for (const [name, scn] of Object.entries(SCENARIOS)) {
    const { kinds, captured } = scenarioKinds(name);
    assert.ok(kinds.has('sow'), `${name} sows`);
    if (scn.expect === 'relay') assert.ok(kinds.has('relay'), `${name} relays`);
    else assert.ok(!kinds.has('relay'), `${name} has no relay`);
    if (scn.expect === 'capture') {
      assert.ok(kinds.has('capture') && captured > 0, `${name} captures`);
    } else {
      assert.equal(captured, 0, `${name} captures nothing`);
    }
  }
});

test('scenario positions are small and the game they start is still live', () => {
  for (const name of Object.keys(SCENARIOS)) {
    const state = scenarioState(name);
    assert.ok(totalSeeds(state) <= 20);
    assert.equal(state.over, false);
  }
});
