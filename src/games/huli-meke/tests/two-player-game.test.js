import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBoardGraph,
  createGameState,
  getLegalMoves,
  applyMove,
  undoMove,
  checkStatus
} from '../js/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const boards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/boards.json'), 'utf8'));
const getBoard = id => boards.find(b => b.id === id);

test('Play full game on Board 1: Mini Triangle to Tiger victory', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5, target: 2 });

  assert.equal(state.phase, 'placing');
  assert.equal(state.turn, 'G');

  // G places on L1_1
  applyMove(state, { type: 'place', to: 'L1_1', piece: 'G' }, graph);
  assert.equal(state.turn, 'T');

  // T jumps over L1_1 to L2_1 (Capture 1!)
  applyMove(state, { type: 'jump', from: 'A', over: 'L1_1', to: 'L2_1', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 1);
  assert.equal(state.turn, 'G');
  assert.equal(state.winner, null);

  // G places on L2_2
  applyMove(state, { type: 'place', to: 'L2_2', piece: 'G' }, graph);

  // T moves L2_1 to L1_2
  applyMove(state, { type: 'step', from: 'L2_1', to: 'L1_2', piece: 'T' }, graph);

  // G places on L3_2
  applyMove(state, { type: 'place', to: 'L3_2', piece: 'G' }, graph);

  // T jumps from L1_2 over L2_2 to L3_2 is blocked since L3_2 is occupied
  // T steps from L1_2 to A
  applyMove(state, { type: 'step', from: 'L1_2', to: 'A', piece: 'T' }, graph);

  // G places on L1_0
  applyMove(state, { type: 'place', to: 'L1_0', piece: 'G' }, graph);

  // T jumps from A over L1_0 to L2_0 (Capture 2!)
  applyMove(state, { type: 'jump', from: 'A', over: 'L1_0', to: 'L2_0', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 2);
  assert.equal(state.winner, 'T');
  assert.ok(state.winReason.includes('2 goats'));
});

test('Play full game on Board 2: Mini Square to Goat victory (trapping tiger)', () => {
  const board = getBoard('mini-square');
  const graph = buildBoardGraph(board);
  // Tiger starts at R1C1 (center of 3x3)
  const state = createGameState(board, { tigers: 1, goats: 5, target: 2 });

  // Surround tiger at R1C1 with goats on orthogonal and diagonal neighbours
  // Neighbours of R1C1: R0C0, R0C1, R0C2, R1C0, R1C2, R2C0, R2C1, R2C2
  // Let's place 4 goats on R0C1, R1C0, R1C2, R2C1
  applyMove(state, { type: 'place', to: 'R0C1', piece: 'G' }, graph); // G1
  applyMove(state, { type: 'step', from: 'R1C1', to: 'R0C0', piece: 'T' }, graph); // T steps to corner R0C0

  // Trap tiger at R0C0!
  // Neighbours of R0C0 are R0C1 (already has G), R1C0, and R1C1
  // Jumps from R0C0:
  // - along R0C0-R0C1-R0C2 (if R0C2 has G, jump blocked)
  // - along R0C0-R1C0-R2C0 (if R2C0 has G, jump blocked)
  // - along R0C0-R1C1-R2C2 (if R2C2 has G, jump blocked)
  applyMove(state, { type: 'place', to: 'R0C2', piece: 'G' }, graph); // G2
  applyMove(state, { type: 'step', from: 'R0C0', to: 'R1C1', piece: 'T' }, graph); // T steps back to R1C1

  applyMove(state, { type: 'place', to: 'R2C0', piece: 'G' }, graph); // G3
  applyMove(state, { type: 'step', from: 'R1C1', to: 'R0C0', piece: 'T' }, graph); // T steps to R0C0

  applyMove(state, { type: 'place', to: 'R1C0', piece: 'G' }, graph); // G4
  // Now from R0C0:
  // Neighbour R0C1 has G (jump to R0C2 blocked by G2)
  // Neighbour R1C0 has G (jump to R2C0 blocked by G3)
  // Only empty neighbour is R1C1!
  applyMove(state, { type: 'step', from: 'R0C0', to: 'R1C1', piece: 'T' }, graph); // T steps to R1C1

  // Place 5th goat on R2C2
  applyMove(state, { type: 'place', to: 'R2C2', piece: 'G' }, graph); // G5 (all 5 goats placed!)

  // Now from R1C1:
  // Empty points are: R0C0, R1C2, R2C1
  applyMove(state, { type: 'step', from: 'R1C1', to: 'R0C0', piece: 'T' }, graph);

  // Now phase is 'moving'!
  assert.equal(state.phase, 'moving');
  assert.equal(state.turn, 'G');

  // Goat moves from R2C2 to R1C1!
  applyMove(state, { type: 'step', from: 'R2C2', to: 'R1C1', piece: 'G' }, graph);

  // Now Tiger turn at R0C0:
  // Neighbours of R0C0:
  // R0C1 has G, and R0C2 has G (jump blocked!)
  // R1C0 has G, and R2C0 has G (jump blocked!)
  // R1C1 has G (jump over R1C1 along R0C0-R1C1-R2C2 to R2C2 is legal!)
  // Tiger jumps to R2C2 capturing R1C1
  applyMove(state, { type: 'jump', from: 'R0C0', over: 'R1C1', to: 'R2C2', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 1);
  assert.equal(state.pieces['R2C2'], 'T');
  assert.equal(state.pieces['R1C1'], undefined);

  // Goat turn: goat at R0C2 steps to R1C1
  applyMove(state, { type: 'step', from: 'R0C2', to: 'R1C1', piece: 'G' }, graph);

  // Tiger at R2C2:
  // Neighbours of R2C2: R2C1 (empty), R1C2 (empty), R1C1 (has G).
  // Jump from R2C2 over R1C1 to R0C0 (empty):
  applyMove(state, { type: 'jump', from: 'R2C2', over: 'R1C1', to: 'R0C0', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 2);
  assert.equal(state.winner, 'T');
});

test('Play full game on Board 3: Classic Triangle to Result', () => {
  const board = getBoard('classic');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 3, goats: 15, target: 5 });

  // Simulate moves reaching 5 captures
  // Tigers start at A, R1_2, R1_3
  assert.equal(state.phase, 'placing');

  // Let tigers capture 5 goats
  // Capture 1: goat on R1_1, tiger A jumps over R1_1 to R2_1
  applyMove(state, { type: 'place', to: 'R1_1', piece: 'G' }, graph);
  applyMove(state, { type: 'jump', from: 'A', over: 'R1_1', to: 'R2_1', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 1);

  // Capture 2: goat on R2_2, tiger R1_2 jumps over R2_2 to R3_2
  applyMove(state, { type: 'place', to: 'R2_2', piece: 'G' }, graph);
  applyMove(state, { type: 'jump', from: 'R1_2', over: 'R2_2', to: 'R3_2', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 2);

  // Capture 3: goat on R2_3, tiger R1_3 jumps over R2_3 to R3_3
  applyMove(state, { type: 'place', to: 'R2_3', piece: 'G' }, graph);
  applyMove(state, { type: 'jump', from: 'R1_3', over: 'R2_3', to: 'R3_3', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 3);

  // Capture 4: goat on R3_1, tiger R2_1 jumps over R3_1 to B_0
  applyMove(state, { type: 'place', to: 'R3_1', piece: 'G' }, graph);
  applyMove(state, { type: 'jump', from: 'R2_1', over: 'R3_1', to: 'B_0', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 4);

  // Capture 5: goat on B_1, tiger B_0 jumps over B_1 to B_2
  applyMove(state, { type: 'place', to: 'B_1', piece: 'G' }, graph);
  applyMove(state, { type: 'jump', from: 'B_0', over: 'B_1', to: 'B_2', piece: 'T' }, graph);
  assert.equal(state.goatsCaptured, 5);

  // Immediately Tiger wins!
  assert.equal(state.winner, 'T');
  assert.ok(state.winReason.includes('5 goats'));
  assert.ok(state.totalPlies > 0);
});
