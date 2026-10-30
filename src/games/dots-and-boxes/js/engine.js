// Dots and Boxes rules. Pure logic: no screen code, so it can be tested in Node.
//
// A board of size n has n x n boxes and (n+1) x (n+1) dots.
// Lines ("edges") are numbered like this (see MASTER_SPEC section 5):
//   horizontal line h(r, c)  r in 0..n, c in 0..n-1   id = r * n + c
//   vertical line   v(r, c)  r in 0..n-1, c in 0..n   id = n * (n + 1) + r * (n + 1) + c
// Box (r, c) has id r * n + c. Its sides are h(r, c) top, h(r + 1, c) bottom, v(r, c) left, v(r, c + 1) right.

const GEOMETRY = new Map();

// Fixed facts about a board size. Cached, and never changed by the game.
export function geometry(n) {
  if (!Number.isInteger(n) || n < 1 || n > 8) throw new RangeError('Board size must be a whole number from 1 to 8.');
  if (GEOMETRY.has(n)) return GEOMETRY.get(n);
  const hCount = n * (n + 1);
  const E = 2 * hCount;
  const B = n * n;
  const boxEdges = [];
  const edgeBoxes = Array.from({ length: E }, () => []);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = r * n + c;
      const left = hCount + r * (n + 1) + c;
      const sides = [r * n + c, (r + 1) * n + c, left, left + 1]; // top, bottom, left, right
      boxEdges[id] = sides;
      for (const e of sides) edgeBoxes[e].push(id);
    }
  }
  const edgeInfo = [];
  for (let e = 0; e < E; e++) {
    if (e < hCount) edgeInfo.push({ horizontal: true, r: Math.floor(e / n), c: e % n });
    else {
      const k = e - hCount;
      edgeInfo.push({ horizontal: false, r: Math.floor(k / (n + 1)), c: k % (n + 1) });
    }
  }
  const g = { n, E, B, hCount, boxEdges, edgeBoxes, edgeInfo };
  GEOMETRY.set(n, g);
  return g;
}

export const edgeCount = (n) => 2 * n * (n + 1);
export const boxCount = (n) => n * n;

export function newGame({ n = 3, first = 0 } = {}) {
  const g = geometry(n);
  return {
    n,
    first,
    turn: first,
    edges: new Array(g.E).fill(0),
    sides: new Array(g.B).fill(0), // how many sides of each box are drawn
    owner: new Array(g.B).fill(-1), // -1 nobody, otherwise player 0 or 1
    scores: [0, 0],
    moves: [], // edge ids in the order they were drawn
    turns: [], // finished turns: { player, boxes }
    run: 0, // boxes closed so far in the turn that is running
    over: false,
  };
}

export function cloneState(state) {
  return {
    ...state,
    edges: state.edges.slice(),
    sides: state.sides.slice(),
    owner: state.owner.slice(),
    scores: state.scores.slice(),
    moves: state.moves.slice(),
    turns: state.turns.map((t) => ({ ...t })),
  };
}

// Undrawn lines, in id order. Nothing is playable once the game is over.
export function legalMoves(state) {
  if (state.over) return [];
  const out = [];
  for (let e = 0; e < state.edges.length; e++) if (!state.edges[e]) out.push(e);
  return out;
}

// What would drawing this line do?
//   'take'   it closes at least one box
//   'danger' it gives a box a third side, so the next player can close it
//   'safe'   neither
export function moveKind(state, edge) {
  const g = geometry(state.n);
  let danger = false;
  for (const b of g.edgeBoxes[edge]) {
    if (state.sides[b] === 3) return 'take';
    if (state.sides[b] === 2) danger = true;
  }
  return danger ? 'danger' : 'safe';
}

// Boxes with three sides drawn: the player to move can close them.
export function availableBoxes(state) {
  const out = [];
  for (let b = 0; b < state.sides.length; b++) if (state.sides[b] === 3) out.push(b);
  return out;
}

// The one undrawn side of a box that has three sides.
export function missingEdge(state, box) {
  const g = geometry(state.n);
  return g.boxEdges[box].find((e) => !state.edges[e]);
}

// Draw one line. Changes the state. Returns null for an illegal move, otherwise
//   { mover, edge, completed: [box ids], extraTurn, over }
export function applyMove(state, edge) {
  if (state.over) return null;
  if (!Number.isInteger(edge) || edge < 0 || edge >= state.edges.length || state.edges[edge]) return null;
  const g = geometry(state.n);
  const mover = state.turn;
  state.edges[edge] = 1;
  state.moves.push(edge);
  const completed = [];
  for (const b of g.edgeBoxes[edge]) {
    state.sides[b] += 1;
    if (state.sides[b] === 4) {
      state.owner[b] = mover;
      completed.push(b);
    }
  }
  state.scores[mover] += completed.length;
  state.run += completed.length;
  const over = state.moves.length === g.E;
  if (completed.length === 0 || over) {
    state.turns.push({ player: mover, boxes: state.run });
    state.run = 0;
    if (!over) state.turn = 1 - mover;
  }
  state.over = over;
  return { mover, edge, completed, extraTurn: completed.length > 0 && !over, over };
}

export function status(state) {
  const [a, b] = state.scores;
  let result = null;
  if (state.over) result = a > b ? 0 : b > a ? 1 : 'draw';
  return { over: state.over, scores: state.scores.slice(), result };
}

// Replay a list of lines from the start. Stops at the first illegal move.
export function replay(n, first, moves) {
  const state = newGame({ n, first });
  const applied = [];
  for (const e of moves) {
    if (!applyMove(state, e)) break;
    applied.push(e);
  }
  return { state, applied };
}

// Build a position from lines already drawn (used by the tutorial). `current` moves next.
// A box that is already closed needs an owner: owners = { boxId: 0 | 1 }.
export function fromEdges(n, edgeIds, current = 0, owners = {}) {
  const g = geometry(n);
  const state = newGame({ n, first: current });
  for (const e of edgeIds) {
    if (!Number.isInteger(e) || e < 0 || e >= g.E || state.edges[e]) throw new RangeError(`Bad line ${e}`);
    state.edges[e] = 1;
    state.moves.push(e);
    for (const b of g.edgeBoxes[e]) state.sides[b] += 1;
  }
  for (let b = 0; b < g.B; b++) {
    if (state.sides[b] !== 4) continue;
    const who = owners[b];
    if (who !== 0 && who !== 1) throw new Error(`Box ${b} is closed but has no owner`);
    state.owner[b] = who;
    state.scores[who] += 1;
  }
  state.over = state.moves.length === g.E;
  return state;
}

// Facts for the result screen, worked out from the finished turns.
//   gifts[p]   boxes player p handed to the other player (the other closed them on the next turn)
//   bestRun[p] most boxes player p closed in one turn
//   lastLong   the last turn that closed 3 or more boxes: { player, boxes }, or null
export function summary(state) {
  const gifts = [0, 0];
  const bestRun = [0, 0];
  let lastLong = null;
  for (const t of state.turns) {
    if (t.boxes > 0) gifts[1 - t.player] += t.boxes;
    bestRun[t.player] = Math.max(bestRun[t.player], t.boxes);
    if (t.boxes >= 3) lastLong = { player: t.player, boxes: t.boxes };
  }
  return { gifts, bestRun, lastLong };
}
