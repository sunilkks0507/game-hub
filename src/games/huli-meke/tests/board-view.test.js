import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNearestPoint, renderBoardSVG } from '../js/board-view.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const boards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/boards.json'), 'utf8'));

test('getNearestPoint returns exact point if within 24 units', () => {
  const classic = boards.find(b => b.id === 'classic');
  const [ax, ay] = classic.nodes['A'];

  // Exact coordinates
  assert.equal(getNearestPoint(classic, ax, ay), 'A');

  // Offset by 10 units
  assert.equal(getNearestPoint(classic, ax + 10, ay + 10), 'A');

  // Far away (top-left corner, no points near 0,0)
  assert.equal(getNearestPoint(classic, 0, 0), null);
});

test('renderBoardSVG renders valid SVG for all 11 boards with start tigers', () => {
  for (const b of boards) {
    const pieces = {};
    for (const t of b.tigerStart) pieces[t] = 'T';
    const svg = renderBoardSVG(b, { pieces, size: 280 });
    assert.ok(svg.startsWith('<svg'), `Board ${b.id} must start with <svg`);
    assert.ok(svg.endsWith('</svg>'), `Board ${b.id} must end with </svg>`);
    assert.ok(svg.includes('role="img"'));
    assert.ok(svg.includes(`aria-label="${b.name}"`));
    // Verify each line is drawn
    assert.ok(svg.includes('<line'));
    // Verify tiger circle is rendered
    assert.ok(svg.includes('fill="#C2410C"'));
  }
});
