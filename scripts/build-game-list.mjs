// Generates two files from the games folder:
//   src/games/games.json   the list the hub picker reads (every game.json, plus its path)
//   src/precache.json      the file list and version the service worker caches
//
// Run:  node scripts/build-game-list.mjs
// The deploy workflow runs it, and the tests check its output.

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

export const REQUIRED_FIELDS = [
  'id', 'name', 'tagline', 'category', 'ageMin', 'ageMax', 'skills', 'players',
  'minutesPerSession', 'accent', 'icon', 'entry', 'version',
  'goal', 'howToWin', 'controls', 'difficulty', 'ruleVariant', 'about', 'tutorialSteps', 'mascot',
];
export const CATEGORIES = ['little-ones', 'explorers', 'challengers', 'adults', 'family'];

// Files that are not part of the playable site.
const SKIP_FILE = (path) => /\.md$/i.test(path) || path.includes(`${sep}tests${sep}`) || path.endsWith('precache.json');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

export function readGames(srcDir = SRC) {
  const gamesDir = join(srcDir, 'games');
  const games = [];
  for (const name of readdirSync(gamesDir).sort()) {
    const folder = join(gamesDir, name);
    if (!statSync(folder).isDirectory()) continue;
    const file = join(folder, 'game.json');
    if (!existsSync(file)) throw new Error(`games/${name} has no game.json`);
    const game = JSON.parse(readFileSync(file, 'utf8'));
    for (const field of REQUIRED_FIELDS) {
      if (!(field in game)) throw new Error(`games/${name}/game.json is missing "${field}"`);
    }
    if (game.id !== name) throw new Error(`games/${name}/game.json id "${game.id}" must match the folder name`);
    if (!CATEGORIES.includes(game.category)) throw new Error(`games/${name}: unknown category "${game.category}"`);
    for (const extra of game.alsoIn || []) {
      if (!CATEGORIES.includes(extra)) throw new Error(`games/${name}: unknown alsoIn category "${extra}"`);
    }
    games.push({ ...game, path: `games/${name}/` });
  }
  return games;
}

export function buildPrecache(srcDir = SRC) {
  const files = walk(srcDir)
    .filter((f) => !SKIP_FILE(f))
    .map((f) => relative(srcDir, f).split(sep).join('/'))
    .filter((f) => f !== 'games/games.json' || true)
    .sort();
  const hash = createHash('sha1');
  for (const f of files) {
    hash.update(f);
    hash.update(readFileSync(join(srcDir, f)));
  }
  return { version: hash.digest('hex').slice(0, 10), files: ['./', ...files] };
}

export function build(srcDir = SRC) {
  const games = readGames(srcDir);
  writeFileSync(join(srcDir, 'games', 'games.json'), JSON.stringify(games, null, 2) + '\n');
  const precache = buildPrecache(srcDir);
  writeFileSync(join(srcDir, 'precache.json'), JSON.stringify(precache, null, 2) + '\n');
  return { games, precache };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { games, precache } = build();
  console.log(`Built ${games.length} game(s); precache version ${precache.version}, ${precache.files.length} files.`);
}
