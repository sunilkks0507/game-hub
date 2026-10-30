// Pallanguzhi bot. Pure logic: no DOM. Runs in a Web Worker in the app (see ai.worker.js)
// and in Node for tests. chooseMove returns a pit number, or null if there is no move.
//
// Method: minimax with alpha-beta pruning. Turns always alternate, so the side to move
// is either "me" (maximise) or the other player (minimise).
//
// Levels (MASTER_SPEC.md section 7):
//   easy    often a random pit, otherwise the pit that captures most right now
//   medium  looks 3 moves ahead
//   hard    iterative deepening up to 7 moves ahead within a time cap (default 1.5 s)

import { cloneState, legalPits, applyMove, rowSeeds } from './engine.js';

export const LEVELS = ['easy', 'medium', 'hard'];

const WIN = 100000;
const TIMEOUT = Symbol('timeout');
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function evaluate(state, me) {
  const you = 1 - me;
  if (state.over) {
    const diff = state.stores[me] - state.stores[you];
    return diff * 100 + (diff > 0 ? WIN : diff < 0 ? -WIN : 0);
  }
  const piles = state.stores[me] - state.stores[you];
  const rows = rowSeeds(state, me) - rowSeeds(state, you);
  return piles * 10 + rows * 2;
}

function search(state, depth, alpha, beta, me, ctx) {
  if (state.over || depth === 0) return evaluate(state, me);
  if ((++ctx.nodes & 255) === 0 && ctx.deadline && now() > ctx.deadline) throw TIMEOUT;
  const moves = legalPits(state);
  if (state.turn === me) {
    let best = -Infinity;
    for (const pit of moves) {
      const next = cloneState(state);
      applyMove(next, pit);
      const score = search(next, depth - 1, alpha, beta, me, ctx);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const pit of moves) {
    const next = cloneState(state);
    applyMove(next, pit);
    const score = search(next, depth - 1, alpha, beta, me, ctx);
    if (score < best) best = score;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Score every legal pit by searching `depth` moves ahead. Returns [{ pit, score }].
function scoreMoves(state, depth, ctx) {
  const me = state.turn;
  const out = [];
  for (const pit of legalPits(state)) {
    const next = cloneState(state);
    applyMove(next, pit);
    out.push({ pit, score: search(next, depth - 1, -Infinity, Infinity, me, ctx) });
  }
  return out;
}

function bestOf(scored) {
  let best = scored[0];
  for (const s of scored) if (s.score > best.score) best = s;
  return best.pit;
}

function immediateGain(state, pit) {
  const next = cloneState(state);
  applyMove(next, pit);
  return next.stores[state.turn] - state.stores[state.turn];
}

export function chooseMove(state, { level = 'medium', timeMs = 1500, rng = Math.random } = {}) {
  const moves = legalPits(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  if (level === 'easy') {
    if (rng() < 0.4) return moves[Math.floor(rng() * moves.length)];
    const ranked = moves
      .map((pit) => ({ pit, gain: immediateGain(state, pit) }))
      .sort((a, b) => b.gain - a.gain);
    // Sometimes take the second best, so it is not always the sharpest.
    const pick = ranked.length > 1 && rng() < 0.3 ? ranked[1] : ranked[0];
    return pick.pit;
  }

  if (level === 'medium') return bestOf(scoreMoves(state, 3, { nodes: 0, deadline: 0 }));

  // hard: iterative deepening inside the time cap
  const deadline = now() + timeMs;
  let best = bestOf(scoreMoves(state, 2, { nodes: 0, deadline: 0 }));
  for (let depth = 3; depth <= 7; depth++) {
    try {
      best = bestOf(scoreMoves(state, depth, { nodes: 0, deadline }));
    } catch (error) {
      if (error === TIMEOUT) break;
      throw error;
    }
    if (now() > deadline) break;
  }
  return best;
}
