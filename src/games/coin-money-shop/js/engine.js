// Coin and Money Shop rules. Pure logic: no DOM, no built-in randomness (pass in a seeded rng), easy to test in Node.
// A "sale" is one customer. A "day" is 8 customers at one level.

import { ITEMS, itemById, itemsForPrice } from './items.js';

export const MAX_PIECES = 12;
export const DAY_SIZE = 8;
export const NOTES_FOR_CHANGE = [10, 20, 50, 100];

export const LEVELS = {
  1: { id: 1, name: 'Coins', ages: '6-8', change: false },
  2: { id: 2, name: 'Notes', ages: '7-9', change: false },
  3: { id: 3, name: 'Change', ages: '8-10', change: true },
};
export const isLevel = (n) => n === 1 || n === 2 || n === 3;

/* ---------- seeded random ---------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- trays and prices ---------- */
// What the child can tap, in tap order. Pieces never run out.
export function trayFor(level) {
  if (level === 1) return [1, 2, 5, 10].map((value) => ({ value, kind: 'coin' }));
  if (level === 2) return [{ value: 5, kind: 'coin' }, ...[10, 20, 50, 100].map((value) => ({ value, kind: 'note' }))];
  if (level === 3) {
    return [
      ...[1, 2, 5].map((value) => ({ value, kind: 'coin' })),
      ...[10, 20, 50].map((value) => ({ value, kind: 'note' })),
    ];
  }
  return [];
}
export const trayValues = (level) => trayFor(level).map((p) => p.value);
export const pieceKind = (level, value) => (trayFor(level).find((p) => p.value === value) || {}).kind || null;

// Every price a level can ask for.
export function priceList(level) {
  if (level === 1) return Array.from({ length: 20 }, (_, i) => i + 1);
  if (level === 2) return Array.from({ length: 19 }, (_, i) => 10 + i * 5);
  if (level === 3) return Array.from({ length: 99 }, (_, i) => i + 1);
  return [];
}

// Level 3: notes the customer may hand over for this price (more than the price, change 1 to 60).
export function validGivens(price) {
  return NOTES_FOR_CHANGE.filter((n) => n > price && n - price <= 60);
}

/* ---------- a sale ---------- */
// State is a plain object you can save: { level, itemId, price, given, pieces, hints, settled }
export function createSale(level, { itemId, price, given = null }) {
  if (!isLevel(level)) throw new RangeError(`bad level ${level}`);
  if (!Number.isInteger(price) || price < 1) throw new RangeError(`bad price ${price}`);
  if (level === 3 && !validGivens(price).includes(given)) throw new RangeError(`bad note ${given} for price ${price}`);
  return { level, itemId, price, given: level === 3 ? given : null, pieces: [], hints: 0, settled: false };
}

export const total = (state) => state.pieces.reduce((a, b) => a + b, 0);
// The amount the child is building: the price, or on Level 3 the change due.
export const target = (state) => (state.level === 3 ? state.given - state.price : state.price);
export const remaining = (state) => Math.max(0, target(state) - total(state));

export function addPiece(state, value) {
  if (state.settled) return { ok: false, reason: 'done', state };
  if (!trayValues(state.level).includes(value)) return { ok: false, reason: 'denom', state };
  if (state.pieces.length >= MAX_PIECES) return { ok: false, reason: 'full', state };
  return { ok: true, reason: null, state: { ...state, pieces: [...state.pieces, value] } };
}

export function removePiece(state, index) {
  if (state.settled || !Number.isInteger(index) || index < 0 || index >= state.pieces.length) return state;
  return { ...state, pieces: state.pieces.filter((_, i) => i !== index) };
}

export function undo(state) {
  return state.pieces.length ? removePiece(state, state.pieces.length - 1) : state;
}

export function useHint(state) {
  return { ...state, hints: state.hints + 1 };
}

// Fewest pieces from the tray that add up to `amount` (descending), or null if impossible.
export function fewestPieces(amount, tray) {
  const values = [...new Set(tray.map((p) => (typeof p === 'number' ? p : p.value)))].sort((a, b) => a - b);
  if (!Number.isInteger(amount) || amount < 0) return null;
  const best = new Array(amount + 1).fill(Infinity);
  const pick = new Array(amount + 1).fill(0);
  best[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const v of values) {
      if (v <= a && best[a - v] + 1 < best[a]) {
        best[a] = best[a - v] + 1;
        pick[a] = v;
      }
    }
  }
  if (best[amount] === Infinity) return null;
  const out = [];
  for (let a = amount; a > 0; a -= pick[a]) out.push(pick[a]);
  return out.sort((x, y) => y - x);
}

// The next piece to try: the biggest tray value that is not more than what is still needed.
export function suggest(state) {
  const left = remaining(state);
  if (left <= 0) return null;
  const values = trayValues(state.level).sort((a, b) => b - a);
  return values.find((v) => v <= left) ?? values[values.length - 1];
}

// Press Pay (or Give change). Returns { done, kind, diff, change, state }.
//   kind: 'exact' | 'short' | 'over'
//   Levels 1-2: over still finishes the sale and the shopkeeper hands back `change`.
//   Level 3: over never finishes (you cannot give away extra money).
export function settle(state) {
  if (state.settled) return { done: true, kind: 'exact', diff: 0, change: [], state };
  const t = total(state);
  const goal = target(state);
  const diff = Math.abs(t - goal);
  let kind = 'exact';
  if (t < goal) kind = 'short';
  else if (t > goal) kind = 'over';
  const done = kind === 'exact' || (kind === 'over' && state.level < 3);
  const change = kind === 'over' && state.level < 3 ? fewestPieces(t - goal, trayFor(state.level)) || [] : [];
  return { done, kind, diff, change, state: done ? { ...state, settled: true } : state };
}

// Streak = consecutive exact sales in one day. Over resets it. Short never ends a sale, so it is not asked.
export const nextStreak = (streak, kind) => (kind === 'exact' ? streak + 1 : 0);

/* ---------- the day ---------- */
function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pickOne = (list, rng) => list[Math.floor(rng() * list.length)];

// 8 customers. The price list is cut into 8 stretches and one price comes from each,
// so a day always mixes small and big prices and never repeats a price.
export function makeDay(level, rng, count = DAY_SIZE) {
  const prices = priceList(level);
  const picked = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * prices.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * prices.length) / count));
    picked.push(pickOne(prices.slice(from, to), rng));
  }
  const day = [];
  const used = new Set();
  let last = null;
  for (const price of shuffle(picked, rng)) {
    const options = itemsForPrice(price).filter((it) => it.id !== last);
    const fresh = options.filter((it) => !used.has(it.id));
    const item = pickOne(fresh.length ? fresh : options, rng);
    used.add(item.id);
    last = item.id;
    day.push({ itemId: item.id, price, given: level === 3 ? pickOne(validGivens(price), rng) : null });
  }
  return day;
}

/* ---------- stats and badges ---------- */
const blankLevel = () => ({ sales: 0, exact: 0, days: 0 });
export function normalizeStats(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const levels = {};
  for (const l of [1, 2, 3]) {
    const r = (s.levels && s.levels[l]) || {};
    levels[l] = { sales: n(r.sales), exact: n(r.exact), days: n(r.days) };
  }
  return { sales: n(s.sales), exact: n(s.exact), days: n(s.days), bestStreak: n(s.bestStreak), levels };
}

// Count a finished sale. `streak` is the day's streak AFTER this sale.
export function recordSale(stats, level, { kind, streak = 0 }) {
  const s = normalizeStats(stats);
  s.sales += 1;
  s.levels[level].sales += 1;
  if (kind === 'exact') {
    s.exact += 1;
    s.levels[level].exact += 1;
  }
  s.bestStreak = Math.max(s.bestStreak, streak);
  return s;
}

export function recordDay(stats, level) {
  const s = normalizeStats(stats);
  s.days += 1;
  s.levels[level].days += 1;
  return s;
}

export const BADGES = [
  { id: 'first_sale', name: 'First sale', how: 'Finish a sale.' },
  { id: 'five_row', name: 'Five in a row', how: 'Pay exactly 5 times in a row.' },
  { id: 'note_maker', name: 'Note maker', how: 'Finish a sale on the Notes level.' },
  { id: 'change_giver', name: 'Change giver', how: 'Finish a sale on the Change level.' },
  { id: 'full_day', name: 'Full day', how: 'Serve all 8 customers.' },
  { id: 'shopkeeper', name: 'Shopkeeper', how: 'Finish a day on each of the three levels.' },
];

export function earnedBadges(stats) {
  const s = normalizeStats(stats);
  const out = [];
  if (s.sales >= 1) out.push('first_sale');
  if (s.bestStreak >= 5) out.push('five_row');
  if (s.levels[2].sales >= 1) out.push('note_maker');
  if (s.levels[3].sales >= 1) out.push('change_giver');
  if (s.days >= 1) out.push('full_day');
  if ([1, 2, 3].every((l) => s.levels[l].days >= 1)) out.push('shopkeeper');
  return out;
}
export const newBadges = (have, stats) => earnedBadges(stats).filter((id) => !have.includes(id));
export const badgeName = (id) => (BADGES.find((b) => b.id === id) || {}).name || id;

/* ---------- day summary (the "why" on the result screen) ---------- */
// records: [{ price, kind, hints, pieces: number[], paid, change: number[] }]
export function summarizeDay(records, level) {
  const exact = records.filter((r) => r.kind === 'exact').length;
  const clean = records.filter((r) => r.kind === 'exact' && !r.hints).length;
  let biggest = null;
  for (const r of records) if (!biggest || r.price > biggest.price) biggest = { price: r.price, pieces: r.pieces.length };
  const overs = records
    .filter((r) => r.kind === 'over')
    .map((r) => ({ price: r.price, paid: r.paid, change: r.change.reduce((a, b) => a + b, 0) }));
  return { customers: records.length, exact, clean, biggest, overs, changeGiven: level === 3 ? records.length : 0 };
}

/* ---------- saved day: check it before trusting it ---------- */
export function validCustomer(level, c) {
  if (!c || typeof c !== 'object' || !itemById(c.itemId)) return false;
  if (!priceList(level).includes(c.price)) return false;
  return level === 3 ? validGivens(c.price).includes(c.given) : c.given === null;
}

export function restoreDay(raw) {
  try {
    if (!raw || !isLevel(raw.level) || !Array.isArray(raw.day) || raw.day.length !== DAY_SIZE) return null;
    if (!raw.day.every((c) => validCustomer(raw.level, c))) return null;
    if (!Number.isInteger(raw.index) || raw.index < 0 || raw.index >= DAY_SIZE) return null;
    let sale = createSale(raw.level, raw.day[raw.index]);
    for (const v of Array.isArray(raw.pieces) ? raw.pieces : []) {
      const r = addPiece(sale, v);
      if (!r.ok) return null;
      sale = r.state;
    }
    sale = { ...sale, hints: Number.isInteger(raw.hints) && raw.hints >= 0 ? raw.hints : 0 };
    const records = (Array.isArray(raw.records) ? raw.records : []).slice(0, raw.index).filter((r) => r && typeof r === 'object');
    if (records.length !== raw.index) return null;
    return {
      level: raw.level, day: raw.day, index: raw.index, sale,
      streak: Number.isInteger(raw.streak) && raw.streak >= 0 ? raw.streak : 0, records,
    };
  } catch {
    return null;
  }
}

export { ITEMS, itemById };
