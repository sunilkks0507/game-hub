import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame,
  fromPieces,
  legalMoves,
  findMove,
  applyMove,
  undo,
  makeMove,
  unmakeMove,
  status,
  inCheck,
  positionKey,
  parseSquare,
  squareName,
  moveToString,
} from '../js/engine.js';

const sq = parseSquare;
const names = (moves) => moves.map((m) => squareName(m.to)).sort();

function play(state, from, to) {
  const move = findMove(state, sq(from), sq(to));
  assert.ok(move, `expected ${from}-${to} to be legal`);
  applyMove(state, move);
  return move;
}

// ---------- Start position ----------

test('start position has 16 legal moves for White', () => {
  const state = newGame();
  assert.equal(legalMoves(state).length, 16);
  assert.equal(state.turn, 'w');
});

test('start position: Rajas face each other on the e file, Mantri on d', () => {
  const state = newGame();
  assert.equal(state.board[sq('e1')], 'wK');
  assert.equal(state.board[sq('d1')], 'wM');
  assert.equal(state.board[sq('e8')], 'bK');
  assert.equal(state.board[sq('d8')], 'bM');
  assert.equal(state.board[sq('c1')], 'wG');
  assert.equal(state.board[sq('b1')], 'wA');
  assert.equal(state.board[sq('a1')], 'wR');
});

test('moveToString writes plain notation', () => {
  const state = newGame();
  const move = findMove(state, sq('e2'), sq('e3'));
  assert.equal(moveToString(move), 'e2-e3');
});

// ---------- Piece movement ----------

test('Raja moves one square in any direction', () => {
  const state = fromPieces(['wK e4', 'bK a8']);
  assert.deepEqual(names(legalMoves(state, sq('e4'))), ['d3', 'd4', 'd5', 'e3', 'e5', 'f3', 'f4', 'f5']);
});

test('Mantri moves one square diagonally only', () => {
  const state = fromPieces(['wK a1', 'wM d4', 'bK h8']);
  assert.deepEqual(names(legalMoves(state, sq('d4'))), ['c3', 'c5', 'e3', 'e5']);
});

test('Gaja jumps exactly two squares diagonally and ignores the piece in between', () => {
  const state = fromPieces(['wK h1', 'wG c3', 'wP d4', 'bK a8']);
  assert.deepEqual(names(legalMoves(state, sq('c3'))), ['a1', 'a5', 'e1', 'e5']);
});

test('Ashva moves like a knight and jumps', () => {
  const state = newGame();
  assert.deepEqual(names(legalMoves(state, sq('b1'))), ['a3', 'c3']);
  assert.deepEqual(names(legalMoves(state, sq('g1'))), ['f3', 'h3']);
});

test('Ratha slides, stops at own pieces and captures the first enemy piece', () => {
  const state = fromPieces(['wK h1', 'wR a1', 'bP a3', 'bK h8']);
  const moves = legalMoves(state, sq('a1'));
  assert.deepEqual(names(moves), ['a2', 'a3', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1']);
  assert.ok(moves.find((m) => squareName(m.to) === 'a3').captured);
});

test('Ratha is blocked by its own piece', () => {
  const state = fromPieces(['wK h1', 'wR a1', 'wP a4', 'bK h8']);
  assert.deepEqual(names(legalMoves(state, sq('a1'))), ['a2', 'a3', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1']);
});

test('Padati moves one square only (no double step)', () => {
  const state = newGame();
  assert.deepEqual(names(legalMoves(state, sq('e2'))), ['e3']);
  assert.equal(findMove(state, sq('e2'), sq('e4')), null);
});

test('Black Padati moves down the board', () => {
  const state = newGame();
  play(state, 'e2', 'e3');
  assert.deepEqual(names(legalMoves(state, sq('e7'))), ['e6']);
});

test('Padati captures diagonally forward only and cannot capture straight ahead', () => {
  const state = fromPieces(['wK e1', 'bK e8', 'wP d4', 'bP e5', 'bP c5', 'bP d5']);
  assert.deepEqual(names(legalMoves(state, sq('d4'))), ['c5', 'e5']);
});

// ---------- Promotion ----------

test('Padati promotes to Mantri on the far row', () => {
  const state = fromPieces(['wK e1', 'bK e8', 'wP a7', 'bP h6']);
  const move = play(state, 'a7', 'a8');
  assert.equal(move.promotion, 'M');
  assert.equal(state.board[sq('a8')], 'wM');
});

test('Padati promotes when capturing on the far row', () => {
  const state = fromPieces(['wK e1', 'bK e8', 'wP a7', 'bA b8']);
  assert.deepEqual(names(legalMoves(state, sq('a7'))), ['a8', 'b8']);
  const move = play(state, 'a7', 'b8');
  assert.equal(move.promotion, 'M');
  assert.equal(state.board[sq('b8')], 'wM');
});

test('Black Padati promotes on row 1', () => {
  const state = fromPieces(['wK e1', 'bK e8', 'bP h2', 'wP a2'], 'b');
  play(state, 'h2', 'h1');
  assert.equal(state.board[sq('h1')], 'bM');
});

// ---------- Check and legality ----------

test('Raja cannot step into an attacked square', () => {
  const state = fromPieces(['wK e1', 'bK e8', 'bR d8']);
  assert.deepEqual(names(legalMoves(state, sq('e1'))), ['e2', 'f1', 'f2']);
});

test('Raja cannot step next to the enemy Padati capture squares', () => {
  const state = fromPieces(['wK e1', 'bK a8', 'bP e3']);
  // Black Padati on e3 attacks d2 and f2.
  assert.deepEqual(names(legalMoves(state, sq('e1'))), ['d1', 'e2', 'f1']);
});

test('a pinned piece can only move along the pin line', () => {
  const state = fromPieces(['wK e1', 'wR e2', 'bR e8', 'bK a8']);
  assert.deepEqual(names(legalMoves(state, sq('e2'))), ['e3', 'e4', 'e5', 'e6', 'e7', 'e8']);
});

test('when in check, only moves that remove the check are legal', () => {
  const state = fromPieces(['wK e1', 'bK a8', 'bR e8', 'wR h5']);
  assert.equal(inCheck(state, 'w'), true);
  const moves = legalMoves(state);
  assert.equal(moves.length, 5);
  assert.ok(moves.some((m) => squareName(m.from) === 'h5' && squareName(m.to) === 'e5'));
});

test('findMove returns null for an illegal move', () => {
  const state = newGame();
  assert.equal(findMove(state, sq('e2'), sq('e5')), null);
  assert.equal(findMove(state, sq('e7'), sq('e6')), null); // not Black's turn
});

// ---------- Game end ----------

test('checkmate: the side with no legal move while in check loses', () => {
  const state = fromPieces(['wK e1', 'wP e2', 'wR b8', 'wR a7', 'bK h8', 'bP e3'], 'b');
  assert.equal(inCheck(state, 'b'), true);
  assert.equal(legalMoves(state).length, 0);
  assert.deepEqual(status(state), { over: true, result: 'w', reason: 'checkmate', loser: 'b' });
});

test('stalemate is a loss for the stalemated side', () => {
  const state = fromPieces(['wK c7', 'wM b6', 'wP e2', 'bK a8', 'bP e3'], 'b');
  assert.equal(inCheck(state, 'b'), false);
  assert.equal(legalMoves(state).length, 0);
  assert.deepEqual(status(state), { over: true, result: 'w', reason: 'stalemate', loser: 'b' });
});

test('a bare Raja loses', () => {
  const state = fromPieces(['wK a1', 'wR e1', 'bK h8', 'bR e5']);
  assert.equal(status(state).over, false);
  play(state, 'e1', 'e5');
  assert.deepEqual(status(state), { over: true, result: 'w', reason: 'bare', loser: 'b' });
});

test('both sides bare is a draw', () => {
  const state = fromPieces(['wK a1', 'bK h8']);
  assert.deepEqual(status(state), { over: true, result: 'draw', reason: 'bare-both' });
});

test('threefold repetition is a draw', () => {
  const state = fromPieces(['wK e1', 'wR a1', 'bK e8', 'bR a8']);
  const cycle = [['a1', 'a2'], ['a8', 'a7'], ['a2', 'a1'], ['a7', 'a8']];
  for (const [from, to] of cycle) play(state, from, to);
  assert.equal(status(state).over, false); // position seen twice
  for (const [from, to] of cycle) play(state, from, to);
  assert.deepEqual(status(state), { over: true, result: 'draw', reason: 'repetition' });
});

test('100 half-moves without a capture or Padati move is a draw', () => {
  const state = fromPieces(['wK e1', 'wR a1', 'bK e8', 'bR a8']);
  state.halfmove = 99;
  play(state, 'a1', 'a2');
  assert.deepEqual(status(state), { over: true, result: 'draw', reason: 'no-progress' });
});

test('a capture resets the no-progress counter', () => {
  const state = fromPieces(['wK e1', 'wR a1', 'bK e8', 'bR a5', 'bP h7']);
  state.halfmove = 50;
  play(state, 'a1', 'a5');
  assert.equal(state.halfmove, 0);
});

test('a Padati move resets the no-progress counter', () => {
  const state = newGame();
  state.halfmove = 40;
  play(state, 'e2', 'e3');
  assert.equal(state.halfmove, 0);
});

// ---------- Undo and consistency ----------

test('undo of three moves returns to the exact start', () => {
  const state = newGame();
  const before = positionKey(state);
  const countsBefore = JSON.stringify(state.counts);
  play(state, 'e2', 'e3');
  play(state, 'b8', 'a6');
  play(state, 'b1', 'c3');
  undo(state);
  undo(state);
  undo(state);
  assert.equal(positionKey(state), before);
  assert.equal(JSON.stringify(state.counts), countsBefore);
  assert.equal(state.turn, 'w');
  assert.equal(state.halfmove, 0);
  assert.equal(state.kingSq[0], sq('e1'));
});

test('undo restores a captured piece and a promotion', () => {
  const state = fromPieces(['wK e1', 'bK e8', 'wP a7', 'bA b8']);
  const before = positionKey(state);
  play(state, 'a7', 'b8');
  undo(state);
  assert.equal(positionKey(state), before);
  assert.equal(state.board[sq('a7')], 'wP');
  assert.equal(state.board[sq('b8')], 'bA');
});

test('make/unmake over every line to depth 3 leaves the position unchanged', () => {
  const state = newGame();
  const before = positionKey(state);
  const kings = state.kingSq.slice();
  let nodes = 0;
  function walk(depth) {
    if (depth === 0) return;
    for (const move of legalMoves(state)) {
      makeMove(state, move);
      nodes++;
      walk(depth - 1);
      unmakeMove(state);
    }
  }
  walk(3);
  assert.ok(nodes > 1000);
  assert.equal(positionKey(state), before);
  assert.deepEqual(state.kingSq, kings);
  assert.equal(state.undoStack.length, 0);
});

test('no legal move ever leaves the mover in check (depth 3 from start)', () => {
  const state = newGame();
  function walk(depth) {
    if (depth === 0) return;
    for (const move of legalMoves(state)) {
      const mover = state.turn;
      makeMove(state, move);
      assert.equal(inCheck(state, mover), false);
      walk(depth - 1);
      unmakeMove(state);
    }
  }
  walk(3);
});
