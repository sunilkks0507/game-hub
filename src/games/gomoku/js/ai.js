// Five in a Row computer opponent. Pure functions of (state, options): no screen code, no globals.
// Levels (see MASTER_SPEC section 7):
//   easy   - sometimes plays a random nearby point, blocks a four only most of the time, ignores open threes.
//   medium - always wins or blocks a four, stops open threes, then plays the best-scoring point.
//   hard   - medium plus a search for a forced win made of fours, plus a short look-ahead (alpha-beta).
import { DIRS, completionsAfter, makesFive } from './engine.js';

export const LEVELS = ['easy', 'medium', 'hard'];

// Value of a window of five points holding k stones of one colour and none of the other.
const W = [0, 1, 10, 100, 1000, 100000];
const WIN_SCORE = 1000000;

class Timeout extends Error {}

// ---- helpers over a plain cells array -----------------------------------------------------------------------

function centreOf(n) {
  return Math.floor(n / 2) * n + Math.floor(n / 2);
}

// Distance from the centre in whole steps, along the longer of the row or column distance.
export function centreDistance(n, i) {
  const mid = Math.floor(n / 2);
  return Math.max(Math.abs(Math.floor(i / n) - mid), Math.abs((i % n) - mid));
}

// Empty points within `radius` steps of any stone (the centre on an empty board).
function candidates(cells, n, radius = 2) {
  const seen = new Uint8Array(n * n);
  const out = [];
  let any = false;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === -1) continue;
    any = true;
    const r0 = Math.floor(i / n);
    const c0 = i % n;
    for (let r = Math.max(0, r0 - radius); r <= Math.min(n - 1, r0 + radius); r++) {
      for (let c = Math.max(0, c0 - radius); c <= Math.min(n - 1, c0 + radius); c++) {
        const j = r * n + c;
        if (cells[j] === -1 && !seen[j]) {
          seen[j] = 1;
          out.push(j);
        }
      }
    }
  }
  if (!any) return [centreOf(n)];
  return out;
}

// Empty points where colour c would make five at once. A five needs a stone next door, so radius 1 is enough.
function winningPoints(cells, n, c) {
  const out = [];
  for (const p of candidates(cells, n, 1)) if (makesFive(cells, n, p, c)) out.push(p);
  return out;
}

// Sum of window values over the windows of five that include point p. Colour 0 counts positive, colour 1 negative.
function windowsAt(cells, n, p) {
  const r0 = Math.floor(p / n);
  const c0 = p % n;
  let total = 0;
  for (const [dr, dc] of DIRS) {
    for (let k = -4; k <= 0; k++) {
      const rs = r0 + k * dr;
      const cs = c0 + k * dc;
      const re = rs + 4 * dr;
      const ce = cs + 4 * dc;
      if (rs < 0 || rs >= n || cs < 0 || cs >= n || re < 0 || re >= n || ce < 0 || ce >= n) continue;
      let b = 0;
      let w = 0;
      for (let j = 0; j < 5; j++) {
        const v = cells[(rs + j * dr) * n + cs + j * dc];
        if (v === 0) b++;
        else if (v === 1) w++;
      }
      if (b > 0 && w === 0) total += W[b];
      else if (w > 0 && b === 0) total -= W[w];
    }
  }
  return total;
}

// Value of the whole board (colour 0 positive).
function fullEval(cells, n) {
  let total = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      for (const [dr, dc] of DIRS) {
        const re = r + 4 * dr;
        const ce = c + 4 * dc;
        if (re < 0 || re >= n || ce < 0 || ce >= n) continue;
        let b = 0;
        let w = 0;
        for (let j = 0; j < 5; j++) {
          const v = cells[(r + j * dr) * n + c + j * dc];
          if (v === 0) b++;
          else if (v === 1) w++;
        }
        if (b > 0 && w === 0) total += W[b];
        else if (w > 0 && b === 0) total -= W[w];
      }
    }
  }
  return total;
}

// How much a stone of colour c on point p would add to c's own lines.
function attack(cells, n, p, c) {
  const before = windowsAt(cells, n, p);
  cells[p] = c;
  const after = windowsAt(cells, n, p);
  cells[p] = -1;
  return c === 0 ? after - before : before - after;
}

// Quick rank of a point for `me`: build my lines and spoil the rival's, a little pull to the centre.
function rank(cells, n, p, me) {
  return attack(cells, n, p, me) + 0.9 * attack(cells, n, p, 1 - me) - 0.01 * centreDistance(n, p);
}

function bestBy(points, score, rng) {
  let best = -Infinity;
  let pool = [];
  for (const p of points) {
    const s = score(p);
    if (s > best + 1e-9) {
      best = s;
      pool = [p];
    } else if (Math.abs(s - best) <= 1e-9) pool.push(p);
  }
  return pool[Math.floor(rng() * pool.length)];
}

// ---- Medium logic, shared by Easy, Medium, Hard and Hint ----------------------------------------------------

// Points where the rival would get an open four (two ways to finish) or a double four: they must be stopped now.
function rivalKeyPoints(cells, n, opp, cand) {
  return cand.filter((p) => completionsAfter(cells, n, p, opp).length >= 2);
}

// Returns { point, kind } with kind in 'win' | 'block-four' | 'open-four' | 'block-three' | 'build'.
function mediumChoice(cells, n, me, rng) {
  const opp = 1 - me;
  const cand = candidates(cells, n);
  const mine = winningPoints(cells, n, me);
  if (mine.length) return { point: mine[0], kind: 'win' };
  const theirs = winningPoints(cells, n, opp);
  if (theirs.length) return { point: theirs[0], kind: 'block-four' };
  const open = cand.filter((p) => completionsAfter(cells, n, p, me).length >= 2);
  if (open.length) return { point: bestBy(open, (p) => rank(cells, n, p, me), rng), kind: 'open-four' };
  const key = rivalKeyPoints(cells, n, opp, cand);
  if (key.length) return { point: bestBy(key, (p) => rank(cells, n, p, me), rng), kind: 'block-three' };
  return { point: bestBy(cand, (p) => rank(cells, n, p, me), rng), kind: 'build' };
}

// ---- Opening and Fair start ---------------------------------------------------------------------------------

// First stone of the game. With Fair start the stone goes on a ring one step outside the swap zone, so the
// second seat can judge a fairly balanced opening.
export function openingMove(state, rng = Math.random) {
  const n = state.n;
  if (!state.fairStart) return centreOf(n);
  const ring = [];
  const want = Math.floor(n / 4) + 1;
  for (let i = 0; i < n * n; i++) if (centreDistance(n, i) === want) ring.push(i);
  return ring[Math.floor(rng() * ring.length)];
}

// The computer is the second seat and may swap: it swaps when the first stone is close to the centre.
export function chooseSwap(state) {
  return centreDistance(state.n, state.moves[0]) <= Math.floor(state.n / 4);
}

// ---- Hard: forced win made of fours -------------------------------------------------------------------------

function makeContext(timeMs) {
  return { deadline: Date.now() + timeMs, nodes: 0 };
}

function tick(ctx) {
  if ((++ctx.nodes & 127) === 0 && Date.now() > ctx.deadline) throw new Timeout();
}

// Is there a run of fours that ends in a win for `me`, with the rival forced to answer each one? Returns the first
// move of such a run, or -1. `cells` is changed while searching and restored before returning.
function vcf(ctx, cells, n, me, depth) {
  const opp = 1 - me;
  const wins = winningPoints(cells, n, me);
  if (wins.length) return wins[0];
  if (depth === 0) return -1;
  if (winningPoints(cells, n, opp).length) return -1;
  tick(ctx);
  for (const p of candidates(cells, n)) {
    const comps = completionsAfter(cells, n, p, me);
    if (!comps.length) continue;
    if (comps.length >= 2) return p;
    const q = comps[0];
    cells[p] = me;
    cells[q] = opp;
    let r;
    try {
      r = vcf(ctx, cells, n, me, depth - 1);
    } finally {
      cells[p] = -1;
      cells[q] = -1;
    }
    if (r !== -1) return p;
  }
  return -1;
}

// ---- Hard: look-ahead --------------------------------------------------------------------------------------

function ordered(cells, n, mover, limit) {
  const cand = candidates(cells, n);
  const scored = cand.map((p) => [rank(cells, n, p, mover), p]);
  scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return scored.slice(0, limit).map((x) => x[1]);
}

// Negamax with alpha-beta. Scores are from the point of view of `mover`.
function negamax(ctx, cells, n, depth, alpha, beta, mover, ev, ply) {
  tick(ctx);
  const opp = 1 - mover;
  if (winningPoints(cells, n, mover).length) return WIN_SCORE - ply;
  const theirs = winningPoints(cells, n, opp);
  if (theirs.length >= 2) return -(WIN_SCORE - ply - 1);
  if (depth === 0) return mover === 0 ? ev : -ev;
  const moves = theirs.length === 1 ? theirs : ordered(cells, n, mover, 8);
  if (!moves.length) return 0;
  let best = -Infinity;
  for (const p of moves) {
    const before = windowsAt(cells, n, p);
    cells[p] = mover;
    const nev = ev + windowsAt(cells, n, p) - before;
    let score;
    try {
      score = -negamax(ctx, cells, n, depth - 1, -beta, -alpha, opp, nev, ply + 1);
    } finally {
      cells[p] = -1;
    }
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function hardChoice(cells, n, me, rng, timeMs, maxDepth) {
  const ctx = makeContext(timeMs);
  const opp = 1 - me;
  const mine = winningPoints(cells, n, me);
  if (mine.length) return mine[0];
  const theirs = winningPoints(cells, n, opp);
  if (theirs.length) return theirs[0];
  let fallback = null;
  try {
    const forced = vcf(ctx, cells, n, me, 8);
    if (forced !== -1) return forced;
  } catch (e) {
    if (!(e instanceof Timeout)) throw e;
  }
  const medium = mediumChoice(cells, n, me, rng);
  fallback = medium.point;
  const cand = candidates(cells, n);
  let roots;
  const key = rivalKeyPoints(cells, n, opp, cand);
  if (key.length) roots = key;
  else roots = ordered(cells, n, me, 10);
  // If the rival has a run of fours that wins, keep only moves that spoil it (when any move does).
  try {
    if (vcf(ctx, cells, n, opp, 6) !== -1) {
      const safe = roots.filter((p) => {
        cells[p] = me;
        try {
          return vcf(ctx, cells, n, opp, 6) === -1;
        } finally {
          cells[p] = -1;
        }
      });
      if (safe.length) roots = safe;
    }
  } catch (e) {
    if (!(e instanceof Timeout)) throw e;
  }
  if (roots.length === 1) return roots[0];
  let committed = roots.includes(fallback) ? fallback : roots[0];
  const ev0 = fullEval(cells, n);
  try {
    for (let depth = 2; depth <= maxDepth; depth += 2) {
      let bestScore = -Infinity;
      let pool = [];
      for (const p of roots) {
        const before = windowsAt(cells, n, p);
        cells[p] = me;
        const nev = ev0 + windowsAt(cells, n, p) - before;
        let score;
        try {
          score = -negamax(ctx, cells, n, depth - 1, -Infinity, Infinity, opp, nev, 1);
        } finally {
          cells[p] = -1;
        }
        if (score > bestScore) {
          bestScore = score;
          pool = [p];
        } else if (score === bestScore) pool.push(p);
      }
      committed = pool[Math.floor(rng() * pool.length)];
      // Put the best move first so the next, deeper pass finds cut-offs sooner.
      roots = [committed].concat(roots.filter((p) => p !== committed));
      if (Math.abs(bestScore) >= WIN_SCORE - 50) break;
    }
  } catch (e) {
    if (!(e instanceof Timeout)) throw e;
  }
  return committed;
}

// ---- Public API -------------------------------------------------------------------------------------------

// The point the computer plays for the colour that is to move in `state`.
//   options: { level: 'easy' | 'medium' | 'hard', rng: () => number in [0,1), timeMs, maxDepth }
export function chooseMove(state, options = {}) {
  const { level = 'medium', rng = Math.random, timeMs = 1500, maxDepth = 6 } = options;
  const n = state.n;
  if (state.phase !== 'play') return -1;
  const cells = state.cells.slice();
  if (cells.every((c) => c === -1)) return openingMove(state, rng);
  const me = state.current;
  if (level === 'hard') return hardChoice(cells, n, me, rng, timeMs, maxDepth);
  if (level === 'medium') return mediumChoice(cells, n, me, rng).point;

  // Easy
  const cand = candidates(cells, n);
  if (rng() < 0.3) return cand[Math.floor(rng() * cand.length)];
  const mine = winningPoints(cells, n, me);
  if (mine.length) return mine[0];
  const theirs = winningPoints(cells, n, 1 - me);
  if (theirs.length && rng() < 0.7) return theirs[0];
  return bestBy(cand, (p) => rank(cells, n, p, me) * (0.5 + rng()), rng);
}

// One suggestion for the person to move, using Medium's logic, with a short reason in words.
export function hint(state, rng = Math.random) {
  if (state.phase !== 'play') return null;
  const cells = state.cells.slice();
  if (cells.every((c) => c === -1)) return { point: openingMove(state, rng), kind: 'build', text: 'The middle is a strong start.' };
  const { point, kind } = mediumChoice(cells, state.n, state.current, rng);
  const text = {
    win: 'Make five here!',
    'open-four': 'Play here: four in a row with two open ends.',
    'block-four': 'Block here, they have four.',
    'block-three': 'Block here, their three is open at both ends.',
    build: 'This builds your line.',
  }[kind];
  return { point, kind, text };
}

// Points worth marking for the player to move (the threat helper):
//   win   - a stone here makes five now
//   block - the rival would make five here next turn (a four)
//   watch - the rival would get an open four here (an open three that needs stopping)
export function threats(state) {
  if (state.phase !== 'play') return { win: [], block: [], watch: [] };
  const cells = state.cells.slice();
  const me = state.current;
  const win = winningPoints(cells, state.n, me);
  const block = winningPoints(cells, state.n, 1 - me);
  const watch = block.length ? [] : rivalKeyPoints(cells, state.n, 1 - me, candidates(cells, state.n));
  return { win, block, watch };
}
