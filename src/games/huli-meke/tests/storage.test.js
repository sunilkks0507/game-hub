import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSettings,
  saveSettings,
  loadStats,
  saveStats,
  recordGameResult,
  resetAllStats
} from '../js/storage.js';

// Setup in-memory global localStorage mock for Node test environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

test('Storage: default settings and saving settings', () => {
  mockStorage.clear();
  const def = loadSettings();
  assert.equal(def.sound, true);
  assert.equal(def.hints, true);

  saveSettings({ sound: false, hints: true });
  const updated = loadSettings();
  assert.equal(updated.sound, false);
  assert.equal(updated.hints, true);
});

test('Storage: default stats and recording results', () => {
  mockStorage.clear();
  const stats = loadStats();
  assert.equal(stats['standard-tiger'].played, 0);
  assert.equal(stats['standard-tiger'].won, 0);

  // Human won as Tiger on Standard
  recordGameResult('standard', 'T', 'T');
  let current = loadStats();
  assert.equal(current['standard-tiger'].played, 1);
  assert.equal(current['standard-tiger'].won, 1);

  // Human lost as Goat on Mini
  recordGameResult('mini', 'G', 'T');
  current = loadStats();
  assert.equal(current['mini-goat'].played, 1);
  assert.equal(current['mini-goat'].won, 0);

  // Reset all stats
  resetAllStats();
  const reset = loadStats();
  assert.equal(reset['standard-tiger'].played, 0);
  assert.equal(reset['mini-goat'].played, 0);
});

test('Storage: old standalone keys are read once, then hub keys take over', () => {
  mockStorage.clear();
  mockStorage.set('hm_settings_v1', JSON.stringify({ sound: false, hints: false }));
  mockStorage.set('hm_stats_v1', JSON.stringify({ 'standard-tiger': { played: 4, won: 3 } }));
  assert.equal(loadSettings().sound, false);
  assert.equal(loadStats()['standard-tiger'].won, 3);
  saveSettings({ sound: true, hints: true });
  assert.equal(mockStorage.has('hub:huli-meke:settings:v1'), true);
  assert.equal(loadSettings().sound, true);
});

test('Storage: a finished game updates the hub progress shape, reset clears it', () => {
  mockStorage.clear();
  recordGameResult('standard', 'T', 'T');
  recordGameResult('standard', 'T', 'G');
  const progress = JSON.parse(mockStorage.get('hub:huli-meke:progress:v1'));
  assert.equal(progress.gameId, 'huli-meke');
  assert.equal(progress.played, 2);
  assert.equal(progress.won, 1);
  resetAllStats();
  assert.equal(JSON.parse(mockStorage.get('hub:huli-meke:progress:v1')).played, 0);
});
