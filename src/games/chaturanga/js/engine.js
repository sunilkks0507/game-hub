// Chaturanga rules engine. Pure logic: no DOM, no randomness, no storage.
// Rule set: see MASTER_SPEC.md section 6 (shatranj-style reconstruction).
//
// Board: 64 cells, index = rank * 8 + file. Rank 0 is White's home row (row 1),
// file 0 is column a. A piece is a two-letter code: side ('w' | 'b') + type:
//   K Raja, M Mantri, G Gaja, A Ashva, R Ratha, P Padati.

export const FILES = 'abcdefgh';
export const PIECE_NAMES = {
  K: 'Raja',
  M: 'Mantri',
  G: 'Gaja',
  A: 'Ashva',
  R: 'Ratha',
  P: 'Padati',
};
export const NO_PROGRESS_LIMIT = 100; // half-moves without a capture or Padati move
export const REPETITION_LIMIT = 3;

const BACK_ROW = ['R', 'A', 'G', 'M', 'K', 'G', 'A', 'R'];

export const opposite = (side) => (side === 'w' ? 'b' : 'w');
const sideIndex = (side) => (side === 'w' ? 0 : 1);

export function squareName(i) {
  return FILES[i & 7] + ((i >> 3) + 1);
}

export function parseSquare(name) {
  const file = FILES.indexOf(name[0]);
  const rank = Number(name.slice(1)) - 1;
  if (file < 0 || !(rank >= 0 && rank < 8)) throw new Error(`Bad square: ${name}`);
  return rank * 8 + file;
}

// ---------- Precomputed move tables ----------

const inBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

function stepTable(offsets) {
  const table = [];
  for (let s = 0; s < 64; s++) {
    const f = s & 7;
    const r = s >> 3;
    const targets = [];
    for (const [df, dr] of offsets) {
      if (inBoard(f + df, r + dr)) targets.push((r + dr) * 8 + f + df);
    }
    table.push(targets);
  }
  return table;
}

const KING_T = stepTable([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
const MANTRI_T = stepTable([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
const GAJA_T = stepTable([[2, 2], [2, -2], [-2, 2], [-2, -2]]);
const KNIGHT_T = stepTable([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]);

const RAYS = [];
for (let s = 0; s < 64; s++) {
  const f = s & 7;
  const r = s >> 3;
  const rays = [];
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ray = [];
    let nf = f + df;
    let nr = r + dr;
    while (inBoard(nf, nr)) {
      ray.push(nr * 8 + nf);
      nf += df;
      nr += dr;
    }
    rays.push(ray);
  }
  RAYS.push(rays);
}

// ---------- State ----------

function emptyState(turn) {
  return {
    board: new Array(64).fill(null),
    turn,
    kingSq: [-1, -1],
    halfmove: 0, // half-moves since the last capture or Padati move
    ply: 0,
    undoStack: [], // records for makeMove / unmakeMove
    keys: [], // position keys, for repetition (applyMove / undo only)
    counts: {}, // position key -> times seen
  };
}

export function positionKey(state) {
  let out = '';
  for (let i = 0; i < 64; i++) out += state.board[i] || '..';
  return out + state.turn;
}

function recordPosition(state) {
  const key = positionKey(state);
  state.keys.push(key);
  state.counts[key] = (state.counts[key] || 0) + 1;
}

export function newGame() {
  const state = emptyState('w');
  for (let f = 0; f < 8; f++) {
    state.board[f] = 'w' + BACK_ROW[f];
    state.board[8 + f] = 'wP';
    state.board[48 + f] = 'bP';
    state.board[56 + f] = 'b' + BACK_ROW[f];
  }
  state.kingSq = [parseSquare('e1'), parseSquare('e8')];
  recordPosition(state);
  return state;
}

// Build a custom position, e.g. fromPieces(['wK e1', 'bK e8', 'wR a1'], 'w').
// Used by tests and by the tutorial. Both Rajas are required.
export function fromPieces(list, turn = 'w') {
  const state = emptyState(turn);
  for (const entry of list) {
    const [code, name] = entry.trim().split(/\s+/);
    if (!/^[wb][KMGARP]$/.test(code)) throw new Error(`Bad piece: ${entry}`);
    const s = parseSquare(name);
    if (state.board[s]) throw new Error(`Square used twice: ${name}`);
    state.board[s] = code;
    if (code[1] === 'K') state.kingSq[sideIndex(code[0])] = s;
  }
  if (state.kingSq[0] < 0 || state.kingSq[1] < 0) throw new Error('Both Rajas are required');
  recordPosition(state);
  return state;
}

export function cloneState(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    kingSq: state.kingSq.slice(),
    halfmove: state.halfmove,
    ply: state.ply,
    undoStack: state.undoStack.map((r) => ({ move: r.move, halfmove: r.halfmove })),
    keys: state.keys.slice(),
    counts: { ...state.counts },
  };
}

// ---------- Attacks and check ----------

// Is square `s` attacked by any piece of side `by`?
export function isAttacked(board, s, by) {
  const K = by + 'K';
  for (const t of KING_T[s]) if (board[t] === K) return true;
  const M = by + 'M';
  for (const t of MANTRI_T[s]) if (board[t] === M) return true;
  const G = by + 'G';
  for (const t of GAJA_T[s]) if (board[t] === G) return true;
  const A = by + 'A';
  for (const t of KNIGHT_T[s]) if (board[t] === A) return true;
  const R = by + 'R';
  for (const ray of RAYS[s]) {
    for (const t of ray) {
      const p = board[t];
      if (p) {
        if (p === R) return true;
        break;
      }
    }
  }
  // A Padati of side `by` attacks the two squares diagonally ahead of it.
  const dir = by === 'w' ? 1 : -1;
  const r = (s >> 3) - dir;
  if (r >= 0 && r < 8) {
    const P = by + 'P';
    const f = s & 7;
    if (f > 0 && board[r * 8 + f - 1] === P) return true;
    if (f < 7 && board[r * 8 + f + 1] === P) return true;
  }
  return false;
}

export function inCheck(state, side = state.turn) {
  return isAttacked(state.board, state.kingSq[sideIndex(side)], opposite(side));
}

// ---------- Move generation ----------

function pushMove(list, board, from, to, piece, promotion) {
  const move = { from, to, piece, captured: board[to] || null };
  if (promotion) move.promotion = promotion;
  list.push(move);
}

function pseudoMovesFrom(board, from, list) {
  const piece = board[from];
  const side = piece[0];
  const type = piece[1];
  if (type === 'P') {
    const dir = side === 'w' ? 1 : -1;
    const lastRank = side === 'w' ? 7 : 0;
    const f = from & 7;
    const r = (from >> 3) + dir;
    if (r < 0 || r > 7) return;
    const promo = r === lastRank ? 'M' : undefined;
    const ahead = r * 8 + f;
    if (!board[ahead]) pushMove(list, board, from, ahead, piece, promo);
    for (const df of [-1, 1]) {
      const nf = f + df;
      if (nf < 0 || nf > 7) continue;
      const to = r * 8 + nf;
      const target = board[to];
      if (target && target[0] !== side) pushMove(list, board, from, to, piece, promo);
    }
    return;
  }
  if (type === 'R') {
    for (const ray of RAYS[from]) {
      for (const to of ray) {
        const target = board[to];
        if (!target) {
          pushMove(list, board, from, to, piece);
          continue;
        }
        if (target[0] !== side) pushMove(list, board, from, to, piece);
        break;
      }
    }
    return;
  }
  const table = type === 'K' ? KING_T : type === 'M' ? MANTRI_T : type === 'G' ? GAJA_T : KNIGHT_T;
  for (const to of table[from]) {
    const target = board[to];
    if (!target || target[0] !== side) pushMove(list, board, from, to, piece);
  }
}

function makeRaw(state, m) {
  state.board[m.to] = m.promotion ? m.piece[0] + m.promotion : m.piece;
  state.board[m.from] = null;
  if (m.piece[1] === 'K') state.kingSq[sideIndex(m.piece[0])] = m.to;
}

function unmakeRaw(state, m) {
  state.board[m.from] = m.piece;
  state.board[m.to] = m.captured;
  if (m.piece[1] === 'K') state.kingSq[sideIndex(m.piece[0])] = m.from;
}

function isLegal(state, m, side) {
  makeRaw(state, m);
  const safe = !isAttacked(state.board, state.kingSq[sideIndex(side)], opposite(side));
  unmakeRaw(state, m);
  return safe;
}

// All legal moves for the side to move. Pass `fromSq` to get only that piece's moves.
export function legalMoves(state, fromSq) {
  const side = state.turn;
  const pseudo = [];
  if (fromSq !== undefined) {
    const p = state.board[fromSq];
    if (p && p[0] === side) pseudoMovesFrom(state.board, fromSq, pseudo);
  } else {
    for (let s = 0; s < 64; s++) {
      const p = state.board[s];
      if (p && p[0] === side) pseudoMovesFrom(state.board, s, pseudo);
    }
  }
  return pseudo.filter((m) => isLegal(state, m, side));
}

export function hasLegalMove(state) {
  const side = state.turn;
  const buffer = [];
  for (let s = 0; s < 64; s++) {
    const p = state.board[s];
    if (!p || p[0] !== side) continue;
    buffer.length = 0;
    pseudoMovesFrom(state.board, s, buffer);
    for (const m of buffer) if (isLegal(state, m, side)) return true;
  }
  return false;
}

// Find the legal move for a tap-from / tap-to pair, or null.
export function findMove(state, from, to) {
  return legalMoves(state, from).find((m) => m.to === to) || null;
}

// ---------- Making and undoing moves ----------

// Light version, used by the bot's search: updates board, turn and counters
// but not the repetition history.
export function makeMove(state, m) {
  makeRaw(state, m);
  state.undoStack.push({ move: m, halfmove: state.halfmove });
  state.halfmove = m.captured || m.piece[1] === 'P' ? 0 : state.halfmove + 1;
  state.turn = opposite(state.turn);
  state.ply++;
}

export function unmakeMove(state) {
  const rec = state.undoStack.pop();
  if (!rec) return null;
  unmakeRaw(state, rec.move);
  state.halfmove = rec.halfmove;
  state.turn = opposite(state.turn);
  state.ply--;
  return rec.move;
}

// Full version, used by the game screen: also tracks repetition.
export function applyMove(state, m) {
  makeMove(state, m);
  recordPosition(state);
}

export function undo(state) {
  if (state.undoStack.length === 0) return null;
  const key = state.keys.pop();
  if (--state.counts[key] <= 0) delete state.counts[key];
  return unmakeMove(state);
}

// ---------- Status ----------

function onlyRaja(board, side) {
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (p && p[0] === side && p[1] !== 'K') return false;
  }
  return true;
}

// Returns { over, result, reason }.
//   result: 'w' | 'b' | 'draw' | null (null while the game is on)
//   reason: 'checkmate' | 'stalemate' | 'bare' | 'bare-both' | 'repetition' | 'no-progress'
// For 'checkmate', 'stalemate' and 'bare', `loser` names the side that lost.
export function status(state) {
  const wBare = onlyRaja(state.board, 'w');
  const bBare = onlyRaja(state.board, 'b');
  if (wBare && bBare) return { over: true, result: 'draw', reason: 'bare-both' };
  if (wBare) return { over: true, result: 'b', reason: 'bare', loser: 'w' };
  if (bBare) return { over: true, result: 'w', reason: 'bare', loser: 'b' };

  if (!hasLegalMove(state)) {
    const loser = state.turn;
    return {
      over: true,
      result: opposite(loser),
      reason: inCheck(state, loser) ? 'checkmate' : 'stalemate',
      loser,
    };
  }
  if ((state.counts[positionKey(state)] || 0) >= REPETITION_LIMIT) {
    return { over: true, result: 'draw', reason: 'repetition' };
  }
  if (state.halfmove >= NO_PROGRESS_LIMIT) {
    return { over: true, result: 'draw', reason: 'no-progress' };
  }
  return { over: false, result: null, reason: null };
}

// ---------- Display helpers ----------

export function moveToString(m) {
  return (
    squareName(m.from) +
    (m.captured ? 'x' : '-') +
    squareName(m.to) +
    (m.promotion ? '=' + m.promotion : '')
  );
}

export function pieceLabel(code) {
  return `${code[0] === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[code[1]]}`;
}
