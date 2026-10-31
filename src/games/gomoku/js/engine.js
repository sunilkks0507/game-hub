// Five in a Row (Gomoku) rules. Pure logic: no screen code, so it can be tested in Node.
//
// A board of size n has n x n points. Point id = row * n + column, row 0 at the top (see MASTER_SPEC section 5).
// Player 0 is Black and always moves first; player 1 is White. Cells hold -1 (empty), 0 or 1.
// Rule set "Free-style Five in a Row": five or more in an unbroken line wins, a full board is a draw.
// Optional Fair start: after Black's first stone, the second seat may swap sides (the app maps seats; the engine
// only records the choice and who is to move).

export const SIZES = [9, 13, 15];
export const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // across, down, diagonal, anti-diagonal
export const NEED = 5;

export const isSize = (n) => SIZES.includes(n);

// "E3": column letter, then row number counted from the top.
export function pointLabel(n, i) {
  return String.fromCharCode(65 + (i % n)) + (Math.floor(i / n) + 1);
}

export function newGame({ n = 9, fairStart = false } = {}) {
  if (!isSize(n)) throw new RangeError(`Board size must be one of ${SIZES.join(', ')}.`);
  return {
    n,
    cells: new Array(n * n).fill(-1),
    current: 0,
    phase: 'play', // 'play' | 'swap' | 'over'
    winner: -1,
    winLine: null,
    draw: false,
    moves: [],
    swapped: false,
    fairStart: Boolean(fairStart),
  };
}

export function cloneState(s) {
  return { ...s, cells: s.cells.slice(), moves: s.moves.slice(), winLine: s.winLine ? s.winLine.slice() : null };
}

// How many stones of colour c are in a row through point i in direction d, counting point i itself as c.
export function runLength(cells, n, i, c, d) {
  const [dr, dc] = DIRS[d];
  const r0 = Math.floor(i / n);
  const c0 = i % n;
  let count = 1;
  for (const sign of [-1, 1]) {
    let r = r0 + sign * dr;
    let k = c0 + sign * dc;
    while (r >= 0 && r < n && k >= 0 && k < n && cells[r * n + k] === c) {
      count += 1;
      r += sign * dr;
      k += sign * dc;
    }
  }
  return count;
}

// The point ids of that run, in order along the line.
export function runThrough(cells, n, i, c, d) {
  const [dr, dc] = DIRS[d];
  const r0 = Math.floor(i / n);
  const c0 = i % n;
  const back = [];
  const fwd = [];
  let r = r0 - dr;
  let k = c0 - dc;
  while (r >= 0 && r < n && k >= 0 && k < n && cells[r * n + k] === c) {
    back.push(r * n + k);
    r -= dr;
    k -= dc;
  }
  r = r0 + dr;
  k = c0 + dc;
  while (r >= 0 && r < n && k >= 0 && k < n && cells[r * n + k] === c) {
    fwd.push(r * n + k);
    r += dr;
    k += dc;
  }
  return back.reverse().concat([i], fwd);
}

// Would a stone of colour c on empty point i make five or more?
export function makesFive(cells, n, i, c) {
  for (let d = 0; d < 4; d++) if (runLength(cells, n, i, c, d) >= NEED) return true;
  return false;
}

// The winning line through point i (the longest run of five or more), or null.
export function winningLine(cells, n, i, c) {
  let best = null;
  for (let d = 0; d < 4; d++) {
    if (runLength(cells, n, i, c, d) >= NEED) {
      const ids = runThrough(cells, n, i, c, d);
      if (!best || ids.length > best.length) best = ids;
    }
  }
  return best;
}

// Every empty point where colour c would make five right now.
export function winPoints(cells, n, c) {
  const out = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] === -1 && makesFive(cells, n, i, c)) out.push(i);
  return out;
}

// After colour c puts a stone on p, which empty points would finish a five? One point is a "four"; two or more
// cannot all be blocked. Only lines through p can be new, so only those are scanned. cells is restored afterwards.
export function completionsAfter(cells, n, p, c) {
  const out = [];
  const before = cells[p];
  cells[p] = c;
  const r0 = Math.floor(p / n);
  const c0 = p % n;
  for (let d = 0; d < 4; d++) {
    const [dr, dc] = DIRS[d];
    for (let k = -4; k <= 4; k++) {
      if (k === 0) continue;
      const r = r0 + k * dr;
      const q = c0 + k * dc;
      if (r < 0 || r >= n || q < 0 || q >= n) continue;
      const j = r * n + q;
      if (cells[j] === -1 && !out.includes(j) && makesFive(cells, n, j, c)) out.push(j);
    }
  }
  cells[p] = before;
  return out;
}

export function legalMoves(s) {
  if (s.phase !== 'play') return [];
  const out = [];
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i] === -1) out.push(i);
  return out;
}

// Place a stone for the player to move. Returns null for an illegal move, otherwise a small report.
export function place(s, i) {
  if (s.phase !== 'play' || !Number.isInteger(i) || i < 0 || i >= s.cells.length || s.cells[i] !== -1) return null;
  const mover = s.current;
  s.cells[i] = mover;
  s.moves.push(i);
  const line = winningLine(s.cells, s.n, i, mover);
  if (line) {
    s.phase = 'over';
    s.winner = mover;
    s.winLine = line;
    return { point: i, mover, won: true, draw: false, swapPhase: false };
  }
  if (s.moves.length === s.cells.length) {
    s.phase = 'over';
    s.draw = true;
    return { point: i, mover, won: false, draw: true, swapPhase: false };
  }
  if (s.fairStart && s.moves.length === 1) {
    s.phase = 'swap';
    s.current = 1;
    return { point: i, mover, won: false, draw: false, swapPhase: true };
  }
  s.current = 1 - mover;
  return { point: i, mover, won: false, draw: false, swapPhase: false };
}

// Fair start: the second seat chose to swap (true) or play on (false). White is to move either way.
export function decideSwap(s, swap) {
  if (s.phase !== 'swap') return false;
  s.swapped = Boolean(swap);
  s.phase = 'play';
  return true;
}

export function status(s) {
  return { over: s.phase === 'over', phase: s.phase, winner: s.winner, draw: s.draw, current: s.current };
}

// Rebuild a game from its list of stones (used to continue a saved game and to undo).
// With Fair start the swap choice comes after the first stone; if more stones follow, it is applied.
export function replay(n, moves, { fairStart = false, swapped = false } = {}) {
  const state = newGame({ n, fairStart });
  const applied = [];
  for (let k = 0; k < moves.length; k++) {
    if (state.phase === 'swap') decideSwap(state, swapped);
    if (!place(state, moves[k])) break;
    applied.push(moves[k]);
  }
  return { state, applied };
}

// A position for the tutorial: stones are loaded straight in. `current` says who is to move.
export function fromStones(n, black, white, current = 0) {
  const s = newGame({ n });
  for (const i of black) s.cells[i] = 0;
  for (const i of white) s.cells[i] = 1;
  const order = [];
  for (let k = 0; k < Math.max(black.length, white.length); k++) {
    if (k < black.length) order.push(black[k]);
    if (k < white.length) order.push(white[k]);
  }
  s.moves = order;
  s.current = current;
  return s;
}

function directionWord(n, line) {
  if (line.every((i) => Math.floor(i / n) === Math.floor(line[0] / n))) return 'across';
  if (line.every((i) => i % n === line[0] % n)) return 'down';
  return 'diagonal';
}

// Facts for the result screen, worked out by replaying the stones (see MASTER_SPEC section 11).
//   dir            'across' | 'down' | 'diagonal' for the winning line
//   doubleThreat   the winner had two or more ways to finish after their previous stone, so the rival could not block all
//   unblockedFour  the winner had exactly one way to finish and the rival did not block it
//   blocks         [black, white]: how many times each colour put a stone on a point where the other could make five
export function explain(s) {
  const g = newGame({ n: s.n });
  const blocks = [0, 0];
  const last = s.moves.length - 1;
  const winner = s.winner;
  let afterPrev = [];
  for (let k = 0; k < s.moves.length; k++) {
    const colour = k % 2;
    const point = s.moves[k];
    if (winPoints(g.cells, g.n, 1 - colour).includes(point)) blocks[colour] += 1;
    place(g, point);
    if (winner >= 0 && k === last - 2) afterPrev = winPoints(g.cells, g.n, winner);
  }
  const finalPoint = last >= 0 ? s.moves[last] : -1;
  return {
    over: s.phase === 'over',
    winner,
    draw: s.draw,
    movesCount: s.moves.length,
    dir: s.winLine ? directionWord(s.n, s.winLine) : null,
    winLine: s.winLine,
    finalPoint,
    doubleThreat: afterPrev.length >= 2,
    unblockedFour: afterPrev.length === 1 && afterPrev[0] === finalPoint,
    blocks,
  };
}
