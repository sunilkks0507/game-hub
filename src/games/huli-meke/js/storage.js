// LocalStorage persistence for Settings and Statistics
// Strictly adheres to MASTER_SPEC.md section 7.6

import { createStore, readProgress, writeProgress, emptyProgress, todayString } from '../../../shared/storage.js';

const GAME_ID = 'huli-meke';
const store = createStore(GAME_ID);
// Keys used by the standalone Huli Meke site. It lived on the same origin, so players keep their stats.
const LEGACY_SETTINGS_KEY = 'hm_settings_v1';
const LEGACY_STATS_KEY = 'hm_stats_v1';

function readLegacy(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

const DEFAULT_SETTINGS = {
  sound: true,
  hints: true
};

const DEFAULT_STATS = {
  'standard-tiger': { played: 0, won: 0 },
  'standard-goat': { played: 0, won: 0 },
  'mini-tiger': { played: 0, won: 0 },
  'mini-goat': { played: 0, won: 0 },
  'custom-tiger': { played: 0, won: 0 },
  'custom-goat': { played: 0, won: 0 }
};

export function loadSettings() {
  try {
    const saved = store.get('settings') || readLegacy(LEGACY_SETTINGS_KEY);
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  store.set('settings', settings);
}

export function loadStats() {
  try {
    const saved = store.get('stats') || readLegacy(LEGACY_STATS_KEY);
    if (!saved || typeof saved !== 'object') return JSON.parse(JSON.stringify(DEFAULT_STATS));
    return { ...DEFAULT_STATS, ...saved };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_STATS));
  }
}

export function saveStats(stats) {
  store.set('stats', stats);
}

export function recordGameResult(mode, humanSide, winner) {
  const stats = loadStats();
  const sideKey = humanSide === 'T' ? 'tiger' : 'goat';
  const key = `${mode}-${sideKey}`;

  if (stats[key]) {
    stats[key].played++;
    if (winner === humanSide) {
      stats[key].won++;
    }
    saveStats(stats);
    // Tell the hub, in the shared shape, so it can show "played" and "won".
    const progress = readProgress(GAME_ID);
    progress.played += 1;
    if (winner === humanSide) progress.won += 1;
    progress.lastPlayed = todayString();
    writeProgress(progress);
  }
  return stats;
}

export function resetAllStats() {
  const stats = JSON.parse(JSON.stringify(DEFAULT_STATS));
  saveStats(stats);
  writeProgress(emptyProgress(GAME_ID));
  return stats;
}
