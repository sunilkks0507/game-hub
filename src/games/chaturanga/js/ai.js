// Chaturanga bot. Pure logic: no DOM. Runs inside a Web Worker in the app
// (see ai.worker.js) but also runs in Node for tests.
//
// Method: negamax with alpha-beta pruning, capture-only quiescence search,
// iterative deepening and a time cap for the Hard level.
//
// Levels (MASTER_SPEC.md section 8):
//   easy   looks 2 plies ahead, then picks one of its top 3 moves, but only among
//          moves that are not clearly worse (so it makes small mistakes, never gifts a Ratha)
//   medium fixed depth 3
//   hard   iterative deepening up to depth 6 within a time cap (default 1.5 s)

import {
  cloneState,
  legalMoves,
  makeMove,
  unmakeMove,
  NO_PROGRESS_LIMIT,
} from './engine.js';

export const LEVELS = ['easy', 'medium', 'hard'];

const VALUE = { K: 0, M: 200, G: 200, A: 300, R: 500, P: 100 };
const MATE = 100000;
const PAWN_ADVANCE = [0, 0, 5, 10, 20, 35, 60, 0]; // bonus by rows advanced (row index from own side)
const EASY_TOLERANCE = 250; // easy may only choose moves within this many points of its best
const QUIESCE_DEPTH = 4;
const TIMEOUT = Symbol('timeout');

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---------- Evaluation ----------

// Score from the point of view of the side to move.
function evaluate(state) {
  const board = state.board;
  let score = 0;
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (!p) continue;
    const side = p[0];
    const type = p[1];
    const file = s & 7;
    const rank = s >> 3;
    const own = side === 'w' ? rank : 7 - rank; // rows advanced
    let v = VALUE[type];
    if (type === 'P') {
      v += PAWN_ADVANCE[own];
    } else if (type === 'A' || type === 'G' || type === 'M') {
      const centre = Math.min(file, 7 - file) + Math.min(rank, 7 - rank); // 0..6
      v += (type === 'A' ? 6 : 3) * centre;
    }
    score += side === state.turn ? v : -v;
  }
  return score;
}

// Game-ending "bare Raja" rule, scored for the side to move. Returns null if not applicable.
function bareScore(state, ply) {
  let own = 0;
  let opp = 0;
  const board = state.board;
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (!p || p[1] === 'K') continue;
    if (p[0] === state.turn) own++;
    else opp++;
  }
  if (own === 0 && opp === 0) return 0;
  if (own === 0) return -(MATE - ply);
  if (opp === 0) return MATE - ply;
  return null;
}

// ---------- Move ordering ----------

function orderScore(m) {
  let s = 0;
  if (m.captured) s += 10 * VALUE[m.captured[1]] - VALUE[m.piece[1]] + 1000;
  if (m.promotion) s += 800;
  return s;
}

function ordered(moves, first) {
  const list = moves.slice();
  list.sort((a, b) => orderScore(b) - orderScore(a));
  if (first) {
    const i = list.findIndex((m) => m.from === first.from && m.to === first.to);
    if (i > 0) list.unshift(list.splice(i, 1)[0]);
  }
  return list;
}

// ---------- Search ----------

function checkTime(ctx) {
  if ((++ctx.nodes & 511) === 0 && ctx.deadline && now() > ctx.deadline) throw TIMEOUT;
}

function quiesce(state, alpha, beta, ply, ctx, depth) {
  checkTime(ctx);
  const bare = bareScore(state, ply);
  if (bare !== null) return bare;
  const stand = evaluate(state);
  if (depth === 0) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const tactical = legalMoves(state).filter((m) => m.captured || m.promotion);
  let best = stand;
  for (const m of ordered(tactical)) {
    makeMove(state, m);
    const score = -quiesce(state, -beta, -alpha, ply + 1, ctx, depth - 1);
    unmakeMove(state);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function search(state, depth, alpha, beta, ply, ctx) {
  checkTime(ctx);
  const bare = bareScore(state, ply);
  if (bare !== null) return bare;
  if (state.halfmove >= NO_PROGRESS_LIMIT) return 0;
  if (depth <= 0) return quiesce(state, alpha, beta, ply, ctx, QUIESCE_DEPTH);
  const moves = legalMoves(state);
  // No legal move: checkmate, or stalemate, which loses under these rules.
  if (moves.length === 0) return -(MATE - ply);
  let best = -Infinity;
  for (const m of ordered(moves)) {
    makeMove(state, m);
    const score = -search(state, depth - 1, -beta, -alpha, ply + 1, ctx);
    unmakeMove(state);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Search every root move to `depth`. Returns [{ move, score }] best first, or throws TIMEOUT.
// With `exact`, every move gets a full window so scores are comparable (used by Easy).
function searchRoot(state, moves, depth, ctx, exact) {
  const results = [];
  let alpha = -Infinity;
  for (const m of moves) {
    makeMove(state, m);
    const window = exact ? [-Infinity, Infinity] : [-Infinity, -alpha];
    const score = -search(state, depth - 1, window[0], window[1], 1, ctx);
    unmakeMove(state);
    results.push({ move: m, score });
    if (!exact && score > alpha) alpha = score;
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

function shuffled(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Public API ----------

// Choose a move for the side to move. Returns a move object or null if there is none.
//   opts.level   'easy' | 'medium' | 'hard' (default 'medium')
//   opts.timeMs  time cap for Hard (default 1500)
//   opts.rng     function returning [0,1), for repeatable tests (default Math.random)
export function chooseMove(state, opts = {}) {
  const level = LEVELS.includes(opts.level) ? opts.level : 'medium';
  const rng = opts.rng || Math.random;
  const work = cloneState(state); // the search mutates its copy only
  const all = legalMoves(work);
  if (all.length === 0) return null;
  if (all.length === 1) return all[0];

  // Shuffle first so equal-looking moves vary between games, then order by tactics.
  const base = ordered(shuffled(all, rng));

  if (level === 'easy') {
    const ctx = { nodes: 0, deadline: 0 };
    const results = searchRoot(work, base, 2, ctx, true);
    const top = results[0].score;
    const pool = results.slice(0, 3).filter((r) => r.score >= top - EASY_TOLERANCE);
    return pool[Math.floor(rng() * pool.length)].move;
  }

  if (level === 'medium') {
    const ctx = { nodes: 0, deadline: 0 };
    return searchRoot(work, base, 3, ctx, false)[0].move;
  }

  // hard: iterative deepening within a time cap
  const timeMs = opts.timeMs || 1500;
  const ctx = { nodes: 0, deadline: now() + timeMs };
  let best = base[0];
  let rootOrder = base;
  for (let depth = 1; depth <= 6; depth++) {
    try {
      const results = searchRoot(work, rootOrder, depth, ctx, false);
      best = results[0].move;
      rootOrder = ordered(
        results.map((r) => r.move),
        best,
      );
      if (results[0].score > MATE - 100) break; // forced win found
    } catch (e) {
      if (e !== TIMEOUT) throw e;
      break; // out of time: keep the last finished depth
    }
  }
  return best;
}
