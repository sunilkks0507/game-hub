import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DRAW_PLIES,
  getDefaultTarget,
  isValidSetup,
  buildBoardGraph,
  createGameState,
  cloneState,
  getLegalMoves,
  applyMove,
  undoMove,
  checkStatus
} from '../js/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const boards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/boards.json'), 'utf8'));
const getBoard = id => boards.find(b => b.id === id);

test('C1: capacity validation', () => {
  const classic = getBoard('classic');
  assert.equal(isValidSetup(classic, 3, 15), true, 'classic (3,15) ok');
  assert.equal(isValidSetup(classic, 4, 16), true, 'classic (4,16) ok');
  assert.equal(isValidSetup(classic, 2, 20), false, 'classic (2,20) rejected (22 > 20)');

  const miniTri = getBoard('mini-triangle');
  assert.equal(isValidSetup(miniTri, 1, 5), true, 'mini-triangle (1,5) ok');
  assert.equal(isValidSetup(miniTri, 3, 15), false, 'mini-triangle (3,15) rejected (18 > 7)');

  const twin = getBoard('twin-triangles');
  assert.equal(isValidSetup(twin, 6, 25), true, 'twin-triangles (6,25) ok');
});

test('C2: targets calculation', () => {
  assert.equal(getDefaultTarget(15), 5);
  assert.equal(getDefaultTarget(5), 2);
  assert.equal(getDefaultTarget(16), 6);
  assert.equal(getDefaultTarget(20), 7);
  assert.equal(getDefaultTarget(25), 9);
});

test('G1 (mini-triangle): tiger A, goat L1_1, L2_1 empty -> jump A to L2_1 over L1_1 is legal', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5 });
  state.pieces = { A: 'T', L1_1: 'G' };
  state.turn = 'T';
  state.phase = 'moving';

  const moves = getLegalMoves(state, graph);
  const jump = moves.find(m => m.type === 'jump' && m.from === 'A' && m.over === 'L1_1' && m.to === 'L2_1');
  assert.ok(jump, 'Jump A over L1_1 to L2_1 must be legal');
});

test('G2: same as G1 but L2_1 has a goat -> jump is not legal', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5 });
  state.pieces = { A: 'T', L1_1: 'G', L2_1: 'G' };
  state.turn = 'T';
  state.phase = 'moving';

  const moves = getLegalMoves(state, graph);
  const jump = moves.find(m => m.type === 'jump' && m.from === 'A' && m.over === 'L1_1' && m.to === 'L2_1');
  assert.equal(jump, undefined, 'Jump must not be legal if destination is occupied');
});

test('G3: tiger L1_0, goat L1_1, L1_2 empty -> jump to L1_2 is legal', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5 });
  state.pieces = { L1_0: 'T', L1_1: 'G' };
  state.turn = 'T';
  state.phase = 'moving';

  const moves = getLegalMoves(state, graph);
  const jump = moves.find(m => m.type === 'jump' && m.from === 'L1_0' && m.over === 'L1_1' && m.to === 'L1_2');
  assert.ok(jump, 'Jump along horizontal line L1_0 over L1_1 to L1_2 must be legal');
});

test('G4: tiger L3_0 with L2_0 and L3_1 empty -> exactly 2 step moves', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5 });
  state.pieces = { L3_0: 'T' };
  state.turn = 'T';
  state.phase = 'moving';

  const moves = getLegalMoves(state, graph);
  assert.equal(moves.length, 2, 'Must have exactly 2 step moves');
  const targets = moves.map(m => m.to).sort();
  assert.deepEqual(targets, ['L2_0', 'L3_1']);
});

test('G5: tiger L3_0, goats on L2_0, L1_0, L3_1, L3_2, tiger to move -> no legal move -> goats win', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5 });
  // L3_0 neighbours are L2_0 and L3_1.
  // Jumps would be over L2_0 to L1_0 (occupied by G) or over L3_1 to L3_2 (occupied by G).
  state.pieces = {
    L3_0: 'T',
    L2_0: 'G',
    L1_0: 'G',
    L3_1: 'G',
    L3_2: 'G'
  };
  state.turn = 'T';
  state.phase = 'moving';

  const moves = getLegalMoves(state, graph);
  assert.equal(moves.length, 0, 'Tiger has no legal moves');
  checkStatus(state, graph);
  assert.equal(state.winner, 'G', 'Goats should win when tiger has no legal move');
});

test('G6: tiger can never jump over another tiger or over an empty point', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 2, goats: 5 });
  // Case A: over another tiger
  state.pieces = { A: 'T', L1_1: 'T' };
  state.turn = 'T';
  state.phase = 'moving';
  let moves = getLegalMoves(state, graph);
  let jump = moves.find(m => m.type === 'jump' && m.from === 'A' && m.to === 'L2_1');
  assert.equal(jump, undefined, 'Tiger cannot jump over another tiger');

  // Case B: over an empty point
  state.pieces = { A: 'T' };
  moves = getLegalMoves(state, graph);
  jump = moves.find(m => m.type === 'jump');
  assert.equal(jump, undefined, 'Tiger cannot jump over empty point');
});

test('G7: goats cannot move while goatsInHand > 0; on next goat turn after last placement they can move', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5 });

  // While goatsInHand > 0
  assert.equal(state.phase, 'placing');
  assert.equal(state.goatsInHand, 5);
  const placementMoves = getLegalMoves(state, graph);
  assert.ok(placementMoves.every(m => m.type === 'place' && m.piece === 'G'));

  // Place 5 goats alternating with tiger steps
  applyMove(state, { type: 'place', to: 'L1_0', piece: 'G' }, graph); // Hand: 4, Turn: T
  applyMove(state, { type: 'step', from: 'A', to: 'L1_1', piece: 'T' }, graph); // Turn: G
  applyMove(state, { type: 'place', to: 'L1_2', piece: 'G' }, graph); // Hand: 3, Turn: T
  applyMove(state, { type: 'step', from: 'L1_1', to: 'A', piece: 'T' }, graph); // Turn: G
  applyMove(state, { type: 'place', to: 'L2_0', piece: 'G' }, graph); // Hand: 2, Turn: T
  applyMove(state, { type: 'step', from: 'A', to: 'L1_1', piece: 'T' }, graph); // Turn: G
  applyMove(state, { type: 'place', to: 'L2_2', piece: 'G' }, graph); // Hand: 1, Turn: T
  applyMove(state, { type: 'step', from: 'L1_1', to: 'A', piece: 'T' }, graph); // Turn: G
  // Last placement:
  applyMove(state, { type: 'place', to: 'L3_1', piece: 'G' }, graph); // Hand: 0, Turn: T
  assert.equal(state.goatsInHand, 0);

  // Tiger moves
  applyMove(state, { type: 'step', from: 'A', to: 'L1_1', piece: 'T' }, graph); // Turn: G

  // Now state.phase should be 'moving'
  assert.equal(state.phase, 'moving');
  assert.equal(state.turn, 'G');
  const movingMoves = getLegalMoves(state, graph);
  assert.ok(movingMoves.length > 0, 'Goats must have legal moves in moving phase');
  assert.ok(movingMoves.every(m => m.type === 'step' && m.piece === 'G'), 'All goat moves must be steps');
});

test('G8: 80 plies without a capture in moving phase -> draw; a capture resets the counter', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5 });
  state.phase = 'moving';
  state.goatsInHand = 0;
  state.pieces = { A: 'T', L3_0: 'G' };
  state.turn = 'T';

  // Make 79 non-capturing moves back and forth
  for (let i = 0; i < 79; i++) {
    const current = state.turn;
    const moves = getLegalMoves(state, graph);
    assert.ok(moves.length > 0);
    applyMove(state, moves[0], graph);
    assert.equal(state.winner, null, `Should not draw at ply ${i + 1}`);
  }

  assert.equal(state.pliesSinceCapture, 79);
  // 80th ply
  const moves = getLegalMoves(state, graph);
  applyMove(state, moves[0], graph);
  assert.equal(state.pliesSinceCapture, 80);
  assert.equal(state.winner, 'draw');
  assert.equal(state.winReason, `No capture in ${DRAW_PLIES} moves`);

  // Test capture resets counter
  const state2 = createGameState(board, { tigers: 1, goats: 5, target: 5 });
  state2.phase = 'moving';
  state2.goatsInHand = 0;
  state2.pieces = { A: 'T', L1_1: 'G' };
  state2.pliesSinceCapture = 50;
  state2.turn = 'T';
  applyMove(state2, { type: 'jump', from: 'A', over: 'L1_1', to: 'L2_1', piece: 'T' }, graph);
  assert.equal(state2.pliesSinceCapture, 0, 'Capture must reset pliesSinceCapture to 0');
});

test('G9: with 4 tigers on Classic, tiger setup uses 3 start points and 4th tiger is placed before goat moves', () => {
  const classic = getBoard('classic');
  const graph = buildBoardGraph(classic);
  const state = createGameState(classic, { tigers: 4, goats: 16 });

  assert.equal(state.phase, 'setup');
  assert.equal(state.turn, 'T');
  assert.equal(state.tigersToPlace, 1);
  assert.deepEqual(Object.keys(state.pieces).sort(), ['A', 'R1_2', 'R1_3'].sort());

  const setupMoves = getLegalMoves(state, graph);
  assert.ok(setupMoves.length > 0);
  assert.ok(setupMoves.every(m => m.type === 'place' && m.piece === 'T'));

  // Place the 4th tiger on R1_0
  applyMove(state, { type: 'place', to: 'R1_0', piece: 'T' }, graph);

  // Setup phase ends, goat starts placing
  assert.equal(state.phase, 'placing');
  assert.equal(state.turn, 'G');
  assert.equal(state.tigersToPlace, 0);
  assert.equal(state.pieces['R1_0'], 'T');
});

test('Undo functionality in engine', () => {
  const board = getBoard('mini-triangle');
  const graph = buildBoardGraph(board);
  const state = createGameState(board, { tigers: 1, goats: 5 });

  applyMove(state, { type: 'place', to: 'L1_0', piece: 'G' }, graph);
  assert.equal(state.pieces['L1_0'], 'G');
  assert.equal(state.goatsInHand, 4);

  const undone = undoMove(state);
  assert.deepEqual(undone, { type: 'place', to: 'L1_0', piece: 'G' });
  assert.equal(state.pieces['L1_0'], undefined);
  assert.equal(state.goatsInHand, 5);
  assert.equal(state.turn, 'G');
});
