// The computer player. Pure functions of (state, options): no screen code, no hidden state.
//
//   chooseMove(state, { level: 'easy' | 'medium' | 'hard', timeMs, rng }) -> a line id, or null
//
// Words used below:
//   take      a line that closes a box
//   safe      a line that does not give any box a third side
//   sacrifice a line that must hand boxes over because no safe line is left
//
// Easy   plays a random line 30% of the time, otherwise plays like Medium.
// Medium takes boxes, then plays safe lines, then gives away the smallest chain.
// Hard   plays like Medium until few lines are left, then solves the rest of the game exactly
//        (including the trick of declining the last boxes of a chain to keep the move).

import { geometry, legalMoves, moveKind } from './engine.js';

export const EASY_MISTAKE_CHANCE = 0.3;
// Exact solving needs one memo slot per set of undrawn lines (2^k), so it is limited to small k.
export const MAX_EXACT_LINES = 19;

// Small seeded random numbers, so tests and replays can repeat a bot's choices.
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

// How many boxes the other player collects if you draw `edge` now and they close
// everything they can. Used to choose the smallest sacrifice.
export function cascadeSize(state, edge) {
  const g = geometry(state.n);
  const sides = Uint8Array.from(state.sides);
  const drawn = Uint8Array.from(state.edges);
  let closed = 0;
  const draw = (e) => {
    drawn[e] = 1;
    for (const b of g.edgeBoxes[e]) {
      sides[b] += 1;
      if (sides[b] === 4) closed += 1;
    }
  };
  draw(edge);
  for (let again = true; again; ) {
    again = false;
    for (let b = 0; b < g.B; b++) {
      if (sides[b] === 3) {
        draw(g.boxEdges[b].find((e) => !drawn[e]));
        again = true;
      }
    }
  }
  return closed;
}

// Boxes a line would close right now.
function closes(state, g, edge) {
  let n = 0;
  for (const b of g.edgeBoxes[edge]) if (state.sides[b] === 3) n += 1;
  return n;
}

export function mediumMove(state, rng = Math.random) {
  const g = geometry(state.n);
  const moves = legalMoves(state);
  if (moves.length === 0) return null;

  // 1. Close a box if possible (prefer a line that closes two).
  let bestClose = 0;
  let takes = [];
  for (const e of moves) {
    const c = closes(state, g, e);
    if (c > bestClose) {
      bestClose = c;
      takes = [e];
    } else if (c === bestClose && c > 0) takes.push(e);
  }
  if (takes.length) return pick(takes, rng);

  // 2. Otherwise a safe line.
  const safe = moves.filter((e) => moveKind(state, e) === 'safe');
  if (safe.length) return pick(safe, rng);

  // 3. Otherwise give away as little as possible.
  let best = [];
  let bestSize = Infinity;
  for (const e of moves) {
    const size = cascadeSize(state, e);
    if (size < bestSize) {
      bestSize = size;
      best = [e];
    } else if (size === bestSize) best.push(e);
  }
  return pick(best, rng);
}

const TIMEOUT = Symbol('timeout');

// Exact solution of the rest of the game. A position is fully described by which of the
// currently undrawn lines are drawn, so the best score difference (for whoever is to move)
// is memoised by that set. Returns the best line, or null when the position is too big
// or time ran out.
export function solveBest(state, { deadline = Infinity, maxLines = MAX_EXACT_LINES } = {}) {
  const g = geometry(state.n);
  const undrawn = legalMoves(state);
  const k = undrawn.length;
  if (k === 0 || k > maxLines) return null;
  const sides = Uint8Array.from(state.sides);
  const boxesOf = undrawn.map((e) => g.edgeBoxes[e]);
  const memo = new Int8Array(1 << k).fill(127);
  const full = (1 << k) - 1;
  let nodes = 0;

  // Best (boxes for the mover - boxes for the other player) from the rest of the game.
  function value(mask) {
    if (mask === full) return 0;
    const known = memo[mask];
    if (known !== 127) return known;
    if ((++nodes & 2047) === 0 && Date.now() > deadline) throw TIMEOUT;
    let best = -127;
    for (let i = 0; i < k; i++) {
      if (mask & (1 << i)) continue;
      const v = tryLine(i, mask);
      if (v > best) best = v;
    }
    memo[mask] = best;
    return best;
  }
  // Value of drawing undrawn[i] for the player to move.
  function tryLine(i, mask) {
    const bx = boxesOf[i];
    let gain = 0;
    for (let j = 0; j < bx.length; j++) {
      if (sides[bx[j]] === 3) gain += 1;
      sides[bx[j]] += 1;
    }
    const next = value(mask | (1 << i));
    for (let j = 0; j < bx.length; j++) sides[bx[j]] -= 1;
    return gain > 0 ? gain + next : -next; // closing a box keeps the move
  }

  try {
    let bestIndex = -1;
    let bestValue = -127;
    let bestGain = -1;
    for (let i = 0; i < k; i++) {
      const v = tryLine(i, 0);
      const gain = boxesOf[i].filter((b) => sides[b] === 3).length;
      if (v > bestValue || (v === bestValue && gain > bestGain)) {
        bestValue = v;
        bestGain = gain;
        bestIndex = i;
      }
    }
    return bestIndex < 0 ? null : undrawn[bestIndex];
  } catch (error) {
    if (error === TIMEOUT) return null;
    throw error;
  }
}

export function chooseMove(state, { level = 'medium', timeMs = 1500, rng = Math.random } = {}) {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  if (level === 'easy' && rng() < EASY_MISTAKE_CHANCE) return pick(moves, rng);
  if (level === 'hard') {
    const exact = solveBest(state, { deadline: Date.now() + timeMs });
    if (exact !== null) return exact;
  }
  return mediumMove(state, rng);
}

// The Hint button: always the Medium choice, and the same one every time for a position.
export function hintMove(state) {
  return mediumMove(state, () => 0);
}
