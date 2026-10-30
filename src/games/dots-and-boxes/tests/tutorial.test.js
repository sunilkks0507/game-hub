import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, STEPS, scenarioState, N } from '../js/tutorial.js';
import { applyMove, legalMoves, moveKind, availableBoxes, cloneState } from '../js/engine.js';

test('tutorial has 3 to 5 steps and ends with the practice offer', () => {
  assert.ok(STEPS.length >= 3 && STEPS.length <= 5);
  assert.equal(STEPS.at(-1).type, 'practice');
});

test('every mascot line is 12 words or fewer', () => {
  for (const s of STEPS) {
    const words = s.text.trim().split(/\s+/).length;
    assert.ok(words <= 12, `"${s.text}" has ${words} words`);
  }
});

test('every target is a playable line', () => {
  for (const [name, scn] of Object.entries(SCENARIOS)) {
    assert.ok(legalMoves(scenarioState(name)).includes(scn.target), name);
  }
});

test('"draw" draws a line and closes nothing', () => {
  const s = scenarioState('draw');
  const r = applyMove(s, SCENARIOS.draw.target);
  assert.equal(r.completed.length, 0);
});

test('"close" really closes a box and keeps the turn', () => {
  const s = scenarioState('close');
  assert.equal(moveKind(s, SCENARIOS.close.target), 'take');
  const r = applyMove(s, SCENARIOS.close.target);
  assert.equal(r.completed.length, 1);
  assert.equal(r.extraTurn, true);
  assert.equal(s.turn, 0);
});

test('"trap": the glowing line is safe, and there are lines that give a box away', () => {
  const s = scenarioState('trap');
  assert.equal(moveKind(s, SCENARIOS.trap.target), 'safe');
  const danger = legalMoves(s).filter((e) => moveKind(s, e) === 'danger');
  assert.ok(danger.length >= 2);
  const probe = cloneState(s);
  applyMove(probe, danger[0]);
  assert.equal(availableBoxes(probe).length, 1, 'the rival can take a box');
  assert.equal(N, 3);
});
