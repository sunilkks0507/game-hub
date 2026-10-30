// Pallanguzhi rules. Pure logic: no DOM, no randomness. Runs in the browser, in a
// Web Worker (via ai.js) and in Node for tests.
//
// Board: 14 pits. Pits 0-6 belong to player 0 (bottom row, left to right).
// Pits 7-13 belong to player 1 (top row, right to left). Sowing goes 0 -> 13 -> 0.
// The rule set is described in MASTER_SPEC.md section 6.

export const PITS = 14;
export const ROW = 7;
export const START_SEEDS = 5;
export const RELAY_LIMIT = 300;
export const STALL_LIMIT = 60;

export const ownerOf = (pit) => (pit < ROW ? 0 : 1);
export const opposite = (player) => 1 - player;

export function newGame({ seeds = START_SEEDS, first = 0 } = {}) {
  return {
    pits: new Array(PITS).fill(seeds),
    stores: [0, 0],
    turn: first === 1 ? 1 : 0,
    turns: 0,
    stall: 0, // turns in a row with no capture
    over: false,
    result: null, // 0, 1 or 'draw' once over
    reason: null, // 'empty' | 'stall' | 'resign'
  };
}

export function cloneState(state) {
  return {
    pits: state.pits.slice(),
    stores: state.stores.slice(),
    turn: state.turn,
    turns: state.turns,
    stall: state.stall,
    over: state.over,
    result: state.result,
    reason: state.reason,
  };
}

export function rowSeeds(state, player) {
  const start = player === 0 ? 0 : ROW;
  let total = 0;
  for (let i = start; i < start + ROW; i++) total += state.pits[i];
  return total;
}

export function legalPits(state, player = state.turn) {
  if (state.over) return [];
  const out = [];
  const start = player === 0 ? 0 : ROW;
  for (let i = start; i < start + ROW; i++) if (state.pits[i] > 0) out.push(i);
  return out;
}

function decide(state) {
  const [a, b] = state.stores;
  state.result = a > b ? 0 : b > a ? 1 : 'draw';
}

// Ends the game: each row's seeds go to that row's owner.
function finish(state, reason) {
  for (const p of [0, 1]) {
    state.stores[p] += rowSeeds(state, p);
  }
  state.pits.fill(0);
  state.over = true;
  state.reason = reason;
  decide(state);
}

// Play one pit for the player whose turn it is. Changes `state` and returns
// { captured, events } or null if the move is not legal.
// events (only when record is true) describe what happened, in order, for the screen:
//   { t: 'pick',    pit, n }      seeds lifted from a pit into the hand
//   { t: 'sow',     pit, hand }   one seed dropped; `hand` seeds are still in the hand
//   { t: 'relay',   pit, n }      the next pit was full, so its seeds are lifted too
//   { t: 'capture', pit, n }      seeds moved to the mover's pile
//   { t: 'stop' }                 relay limit reached
export function applyMove(state, pit, { record = false } = {}) {
  if (state.over || !Number.isInteger(pit) || pit < 0 || pit >= PITS) return null;
  if (ownerOf(pit) !== state.turn || state.pits[pit] === 0) return null;

  const pits = state.pits;
  const events = record ? [] : null;
  const mover = state.turn;
  let hand = pits[pit];
  pits[pit] = 0;
  if (events) events.push({ t: 'pick', pit, n: hand });

  let pos = pit;
  let relays = 0;
  let captured = 0;
  for (;;) {
    while (hand > 0) {
      pos = (pos + 1) % PITS;
      pits[pos] += 1;
      hand -= 1;
      if (events) events.push({ t: 'sow', pit: pos, hand });
    }
    const next = (pos + 1) % PITS;
    if (pits[next] > 0) {
      relays += 1;
      if (relays > RELAY_LIMIT) {
        if (events) events.push({ t: 'stop' });
        break;
      }
      hand = pits[next];
      pits[next] = 0;
      pos = next;
      if (events) events.push({ t: 'relay', pit: next, n: hand });
      continue;
    }
    const target = (next + 1) % PITS;
    if (pits[target] > 0) {
      captured = pits[target];
      state.stores[mover] += captured;
      pits[target] = 0;
      if (events) events.push({ t: 'capture', pit: target, n: captured });
    }
    break;
  }

  state.turns += 1;
  state.stall = captured > 0 ? 0 : state.stall + 1;
  state.turn = opposite(mover);

  if (rowSeeds(state, state.turn) === 0) finish(state, 'empty');
  else if (state.stall >= STALL_LIMIT) finish(state, 'stall');

  return { captured, events };
}

export function resign(state, loser) {
  if (state.over) return;
  state.over = true;
  state.reason = 'resign';
  state.result = opposite(loser);
}

export function status(state) {
  return {
    over: state.over,
    result: state.result,
    reason: state.reason,
    scores: state.stores.slice(),
    loser: state.over && state.result !== 'draw' ? opposite(state.result) : null,
  };
}

// Rebuild a game by replaying a list of pit numbers. Stops at the first illegal move.
export function replay(moves, options) {
  const state = newGame(options);
  const applied = [];
  for (const pit of moves) {
    if (!applyMove(state, pit)) break;
    applied.push(pit);
  }
  return { state, applied };
}

export function totalSeeds(state) {
  return state.pits.reduce((a, b) => a + b, 0) + state.stores[0] + state.stores[1];
}
