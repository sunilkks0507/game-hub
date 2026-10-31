// Ten Frame Garden rules. Pure logic: no DOM, no timers, no Math.random (pass an rng).
// A frame is 10 cells (levels 1-3) or 20 cells (level 4, two frames of 10).
// Cell values: 0 empty, 1 given seed (part of the question), 2 the child's seed, 3 auto seed (level 3 only).

export const EMPTY = 0;
export const GIVEN = 1;
export const MINE = 2;
export const AUTO = 3;

export const GARDEN_SIZE = 5;

// group "10" is shared by levels 1-3; group "20" is level 4.
export const LEVELS = {
  1: { id: 1, name: 'Dots', group: '10', size: 10, min: 1, max: 9, numerals: false },
  2: { id: 2, name: 'Fill to 10', group: '10', size: 10, min: 1, max: 9, numerals: true },
  3: { id: 3, name: 'Two parts', group: '10', size: 10, min: 1, max: 9, numerals: true },
  4: { id: 4, name: 'Bonds to 20', group: '20', size: 20, min: 11, max: 19, numerals: true },
};

const GROUPS = {
  10: { total: 10, min: 1, max: 9 },
  20: { total: 20, min: 11, max: 19 },
};

export function isLevel(level) {
  return Object.prototype.hasOwnProperty.call(LEVELS, level);
}

/* ---------- a single frame ---------- */

// For levels 1, 2 and 4, `given` is how many seeds are already planted.
// For level 3, `given` is the target: how many seeds the child must plant.
export function createFrame(level, given) {
  if (!isLevel(level)) throw new RangeError(`Unknown level: ${level}`);
  const spec = LEVELS[level];
  if (!Number.isInteger(given) || given < spec.min || given > spec.max) {
    throw new RangeError(`Level ${level} needs a number from ${spec.min} to ${spec.max}, got ${given}`);
  }
  const cells = new Array(spec.size).fill(EMPTY);
  if (level !== 3) for (let i = 0; i < given; i++) cells[i] = GIVEN;
  return { level, size: spec.size, cells, given, target: level === 3 ? given : null, planted: 0 };
}

export function isComplete(state) {
  if (state.level === 3) return state.planted === state.target;
  return !state.cells.includes(EMPTY);
}

// How many seeds the child still has to plant.
export function needed(state) {
  if (state.level === 3) return state.target - state.planted;
  return state.cells.filter((c) => c === EMPTY).length;
}

// Plant a seed in cell `id`. Returns { ok, reason, state }; the old state is never changed.
export function plant(state, id) {
  if (isComplete(state)) return { ok: false, reason: 'done', state };
  if (!Number.isInteger(id) || id < 0 || id >= state.size) return { ok: false, reason: 'range', state };
  if (state.cells[id] !== EMPTY) return { ok: false, reason: 'filled', state };

  const cells = state.cells.slice();
  cells[id] = MINE;
  const planted = state.planted + 1;
  if (state.level === 3 && planted === state.target) {
    for (let i = 0; i < cells.length; i++) if (cells[i] === EMPTY) cells[i] = AUTO;
  }
  return { ok: true, reason: null, state: { ...state, cells, planted } };
}

// Take back one of the child's own seeds. Given seeds cannot be removed.
export function unplant(state, id) {
  if (isComplete(state)) return { ok: false, reason: 'done', state };
  if (!Number.isInteger(id) || id < 0 || id >= state.size) return { ok: false, reason: 'range', state };
  if (state.cells[id] !== MINE) return { ok: false, reason: 'not_mine', state };
  const cells = state.cells.slice();
  cells[id] = EMPTY;
  return { ok: true, reason: null, state: { ...state, cells, planted: state.planted - 1 } };
}

// The id of the child's most recently planted seed is tracked by the caller (a list of ids).
// This helper returns the highest-numbered child seed, a fallback when no history is kept.
export function lastPlanted(state) {
  return state.cells.lastIndexOf(MINE);
}

// [part one, part two, total]. Level 3: the target and the rest. Others: the given seeds and the rest.
export function pair(state) {
  const a = state.level === 3 ? state.target : state.given;
  return [a, state.size - a, state.size];
}

// Rebuild a frame from saved data. Returns null if the data does not fit this frame.
export function restoreFrame(level, given, cells, order = null) {
  let state;
  try {
    state = createFrame(level, given);
  } catch {
    return null;
  }
  if (!Array.isArray(cells) || cells.length !== state.size) return null;
  const ids = Array.isArray(order) ? order : cells.map((c, i) => (c === MINE ? i : -1)).filter((i) => i >= 0);
  const wanted = new Set(cells.map((c, i) => (c === MINE ? i : -1)).filter((i) => i >= 0));
  if (ids.length !== wanted.size || !ids.every((i) => wanted.has(i))) return null;
  for (const id of ids) {
    const r = plant(state, id);
    if (!r.ok) return null;
    state = r.state;
  }
  return state;
}

/* ---------- bonds and stats ---------- */

// A bond is one value in a level group. Returns { group: '10' | '20', index: 0..8, value }.
export function bondKey(level, given) {
  const spec = LEVELS[level];
  if (!spec) throw new RangeError(`Unknown level: ${level}`);
  return { group: spec.group, index: given - spec.min, value: given };
}

export function emptyStats() {
  return {
    bonds: { 10: new Array(9).fill(0), 20: new Array(9).fill(0) },
    clean: { 10: new Array(9).fill(0), 20: new Array(9).fill(0) },
    frames: 0,
    gardens: 0,
    noHintGardens: 0,
  };
}

function cleanNumberList(list) {
  const out = new Array(9).fill(0);
  if (Array.isArray(list)) for (let i = 0; i < 9; i++) out[i] = Math.max(0, Math.min(2, Number(list[i]) | 0));
  return out;
}

// Make stored stats safe to use even if they are missing or damaged.
export function normalizeStats(raw) {
  const base = emptyStats();
  if (!raw || typeof raw !== 'object') return base;
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  return {
    bonds: { 10: cleanNumberList(raw.bonds && raw.bonds[10]), 20: cleanNumberList(raw.bonds && raw.bonds[20]) },
    clean: { 10: cleanNumberList(raw.clean && raw.clean[10]), 20: cleanNumberList(raw.clean && raw.clean[20]) },
    frames: num(raw.frames),
    gardens: num(raw.gardens),
    noHintGardens: num(raw.noHintGardens),
  };
}

// A finished frame marks the bond "seen" (1). After 2 frames without a hint it is "known" (2).
// Undo is never held against the child.
export function recordFrame(stats, level, given, { hint = false } = {}) {
  const next = normalizeStats(stats);
  const { group, index } = bondKey(level, given);
  next.frames += 1;
  next.bonds[group][index] = Math.max(next.bonds[group][index], 1);
  if (!hint) next.clean[group][index] = Math.min(2, next.clean[group][index] + 1);
  if (next.clean[group][index] >= 2) next.bonds[group][index] = 2;
  return next;
}

export function recordGarden(stats, { noHint = false } = {}) {
  const next = normalizeStats(stats);
  next.gardens += 1;
  if (noHint) next.noHintGardens += 1;
  return next;
}

export const bondsSeen = (stats, group) => normalizeStats(stats).bonds[group].filter((s) => s >= 1).length;
export const bondsKnown = (stats, group) => normalizeStats(stats).bonds[group].filter((s) => s >= 2).length;

// Values of a group that went from unseen to seen between two stats objects.
export function newlySeen(before, after, group) {
  const b = normalizeStats(before).bonds[group];
  const a = normalizeStats(after).bonds[group];
  const out = [];
  for (let i = 0; i < 9; i++) if (b[i] === 0 && a[i] >= 1) out.push(GROUPS[group].min + i);
  return out;
}

/* ---------- gardens ---------- */

// Small seeded random numbers, so tests repeat. Returns a function giving numbers from 0 up to 1.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEIGHT = [6, 3, 1]; // unseen, seen, known

// Five values for one garden. Unseen bonds come first most of the time, known bonds least.
// Values are drawn without replacement, so a garden never repeats a value (and so never repeats twice in a row).
export function makeGarden(level, stats, rng = Math.random) {
  const spec = LEVELS[level];
  if (!spec) throw new RangeError(`Unknown level: ${level}`);
  const status = normalizeStats(stats).bonds[spec.group];
  const pool = [];
  for (let v = spec.min; v <= spec.max; v++) pool.push({ value: v, weight: WEIGHT[status[v - spec.min]] });
  const garden = [];
  while (garden.length < GARDEN_SIZE && pool.length) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let pick = rng() * total;
    let i = 0;
    while (i < pool.length - 1 && pick >= pool[i].weight) {
      pick -= pool[i].weight;
      i++;
    }
    garden.push(pool[i].value);
    pool.splice(i, 1);
  }
  return garden;
}

// Facts for the result screen. `frames` is a list of { given, hint }.
export function summarizeGarden(frames) {
  return {
    count: frames.length,
    noHint: frames.filter((f) => !f.hint).length,
    anyHint: frames.some((f) => f.hint),
  };
}

/* ---------- badges ---------- */

export const BADGES = {
  first_flower: 'First flower',
  full_garden: 'Full garden',
  all_bonds_10: 'Every pair to 10',
  no_hint_garden: 'A garden with no hints',
  twenty: 'Twenty!',
};

// Returns the ids of badges that are newly earned (not already in `have`).
export function newBadges(have, { stats, gardenDone = false, gardenNoHint = false }) {
  const s = normalizeStats(stats);
  const earned = [];
  if (s.frames >= 1) earned.push('first_flower');
  if (gardenDone) earned.push('full_garden');
  if (bondsSeen(s, '10') === 9) earned.push('all_bonds_10');
  if (gardenDone && gardenNoHint) earned.push('no_hint_garden');
  if (s.bonds[20].some((v) => v >= 1)) earned.push('twenty');
  const owned = new Set(have);
  return earned.filter((id) => !owned.has(id));
}
