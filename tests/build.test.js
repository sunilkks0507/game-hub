import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { build, REQUIRED_FIELDS, CATEGORIES } from '../scripts/build-game-list.mjs';

const SRC = new URL('../src/', import.meta.url).pathname;

test('build produces a precache list whose files all exist', async () => {
  await build();
  const pre = JSON.parse(readFileSync(join(SRC, 'precache.json'), 'utf8'));
  assert.ok(pre.version);
  for (const f of pre.files) {
    if (f === './') continue;
    assert.ok(existsSync(join(SRC, f)), `missing precache file ${f}`);
  }
  for (const must of ['index.html', 'sw.js', 'manifest.webmanifest', 'games/games.json']) {
    assert.ok(pre.files.includes(must), `${must} not precached`);
  }
});

test('every game.json has the required fields and a valid category', () => {
  const games = JSON.parse(readFileSync(join(SRC, 'games/games.json'), 'utf8'));
  const list = Array.isArray(games) ? games : games.games;
  assert.ok(list.length >= 1);
  for (const g of list) {
    for (const k of REQUIRED_FIELDS) assert.ok(g[k] !== undefined, `${g.id}: missing ${k}`);
    assert.ok(CATEGORIES.includes(g.category), `${g.id}: bad category`);
  }
});

test('no source file loads anything from an external website', () => {
  const bad = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (['.html', '.css', '.js', '.json', '.webmanifest'].includes(extname(p))) {
        const text = readFileSync(p, 'utf8').replace(/https?:\/\/www\.w3\.org\/[\w/.]+/g, '');
        if (/https?:\/\//.test(text)) bad.push(p.replace(SRC, ''));
      }
    }
  };
  walk(SRC);
  assert.deepEqual(bad, []);
});
