import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const boardsJsonPath = path.resolve(__dirname, '../data/boards.json');
const boards = JSON.parse(fs.readFileSync(boardsJsonPath, 'utf8'));

// Helper to extract unique undirected adjacency edges
function getAdjacentPairs(board) {
  const pairs = new Set();
  for (const line of board.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const u = line[i];
      const v = line[i + 1];
      const key = u < v ? `${u}--${v}` : `${v}--${u}`;
      pairs.add(key);
    }
  }
  return pairs;
}

// Helper to get neighbours map for a board
function getNeighboursMap(board) {
  const map = {};
  for (const nodeId of Object.keys(board.nodes)) {
    map[nodeId] = new Set();
  }
  for (const line of board.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const u = line[i];
      const v = line[i + 1];
      map[u].add(v);
      map[v].add(u);
    }
  }
  return map;
}

test('B1: 11 boards load; ids unique; every points equals number of nodes; capacity = points - 3', () => {
  assert.equal(boards.length, 11, 'Must have exactly 11 boards');
  const ids = new Set();
  for (const b of boards) {
    assert.ok(!ids.has(b.id), `Duplicate board id: ${b.id}`);
    ids.add(b.id);
    const nodeCount = Object.keys(b.nodes).length;
    assert.equal(b.points, nodeCount, `Board ${b.id} points mismatch nodes count`);
    assert.equal(b.capacity, b.points - 3, `Board ${b.id} capacity must be points - 3`);
  }
});

test('B2: every line has at least 2 points and every point in a line exists in nodes', () => {
  for (const b of boards) {
    for (const line of b.lines) {
      assert.ok(line.length >= 2, `Board ${b.id} line has fewer than 2 points: ${JSON.stringify(line)}`);
      for (const pt of line) {
        assert.ok(pt in b.nodes, `Board ${b.id} line point ${pt} not found in nodes`);
      }
    }
  }
});

test('B3: every point has at least 2 neighbours; every point in tigerStart exists', () => {
  for (const b of boards) {
    const neighbours = getNeighboursMap(b);
    for (const [nodeId, nbrs] of Object.entries(neighbours)) {
      assert.ok(nbrs.size >= 2, `Board ${b.id} node ${nodeId} has only ${nbrs.size} neighbours`);
    }
    for (const t of b.tigerStart) {
      assert.ok(t in b.nodes, `Board ${b.id} tigerStart ${t} not in nodes`);
    }
  }
});

test('B4: Classic: A has exactly 4 neighbours; Wheel: center C has 8 neighbours and no jump exists along a ring', () => {
  const classic = boards.find(b => b.id === 'classic');
  const classicNeighbours = getNeighboursMap(classic);
  assert.equal(classicNeighbours['A'].size, 4, 'Classic apex A must have 4 neighbours');

  const wheel = boards.find(b => b.id === 'wheel');
  const wheelNeighbours = getNeighboursMap(wheel);
  assert.equal(wheelNeighbours['C'].size, 8, 'Wheel center C must have 8 neighbours');

  // Verify no jump exists along a ring in Wheel:
  // Jumps only exist on lines with 3+ points. Wheel ring segments are 2-point lines.
  const ringLines = wheel.lines.filter(l => l.every(pt => pt.startsWith('W1_') || pt.startsWith('W2_') || pt.startsWith('W3_')));
  for (const l of ringLines) {
    assert.equal(l.length, 2, `Wheel ring line should have length 2 to prevent ring jumps: ${JSON.stringify(l)}`);
  }
});

test('B5: Line counts', () => {
  const expectedLineCounts = {
    'classic': 10,
    'square-diagonals': 16,
    'square-plain': 10,
    'wheel': 28,
    'cross': 16,
    'arrow-triangle': 12,
    'twin-triangles': 19,
    'mini-triangle': 6,
    'mini-square': 8,
    'mini-wheel': 15,
    'mini-arrow': 11
  };
  for (const [id, count] of Object.entries(expectedLineCounts)) {
    const b = boards.find(board => board.id === id);
    assert.ok(b, `Board ${id} not found`);
    assert.equal(b.lines.length, count, `Board ${id} expected ${count} lines, got ${b.lines.length}`);
  }
});

test('B6: Neighbour-pair counts (adjacent pairs)', () => {
  const expectedPairs = {
    'classic': 38,
    'square-diagonals': 56,
    'square-plain': 40,
    'wheel': 48,
    'cross': 44,
    'arrow-triangle': 33,
    'twin-triangles': 73,
    'mini-triangle': 15,
    'mini-square': 16,
    'mini-wheel': 24,
    'mini-arrow': 22
  };
  for (const [id, count] of Object.entries(expectedPairs)) {
    const b = boards.find(board => board.id === id);
    assert.ok(b, `Board ${id} not found`);
    const pairs = getAdjacentPairs(b);
    assert.equal(pairs.size, count, `Board ${id} expected ${count} adjacent pairs, got ${pairs.size}`);
  }
});
