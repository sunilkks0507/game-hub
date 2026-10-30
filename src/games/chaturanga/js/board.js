// The 8x8 board as a grid of buttons. It only draws and reports taps; the rules live in engine.js.
// Same component serves the game screen and the tutorial.

import { FILES, squareName, pieceLabel } from './engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function pieceSvg(code) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `piece piece-${code[0]}`);
  svg.setAttribute('viewBox', '0 0 45 45');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#piece-${code[1]}`);
  svg.append(use);
  return svg;
}

export function createBoard(root, { onTap }) {
  const cells = [];
  let order = []; // square indexes in visual order (top-left first)
  let flipped = null;
  let focusSq = 12; // e2 until the player moves the focus

  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Chaturanga board');

  for (let sq = 0; sq < 64; sq++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.sq = String(sq);
    const file = sq & 7;
    const rank = sq >> 3;
    button.className = 'sq ' + ((file + rank) % 2 === 0 ? 'dark' : 'light');
    button.tabIndex = -1;
    button.addEventListener('click', () => {
      focusSq = sq;
      onTap(sq);
    });
    cells.push(button);
  }

  function layout(isFlipped) {
    if (flipped === isFlipped) return;
    flipped = isFlipped;
    order = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const rank = isFlipped ? row : 7 - row;
        const file = isFlipped ? 7 - col : col;
        order.push(rank * 8 + file);
      }
    }
    root.replaceChildren(...order.map((sq) => cells[sq]));
  }

  function render(state, view = {}) {
    layout(Boolean(view.flipped));
    const targets = view.targets || new Map();
    const hints = new Set(view.hints || []);
    const last = view.lastMove || [];

    order.forEach((sq, i) => {
      const cell = cells[sq];
      const piece = state.board[sq];
      const classes = ['sq', (sq & 7) + (sq >> 3) & 1 ? 'light' : 'dark'];
      if (view.selected === sq) classes.push('selected');
      const kind = targets.get(sq);
      if (kind) classes.push(kind === 'capture' ? 'target-capture' : 'target-move');
      if (last.includes(sq)) classes.push('last-move');
      if (hints.has(sq)) classes.push('hint');
      if (view.checkSq === sq) classes.push('in-check');
      cell.className = classes.join(' ');

      let label = `${squareName(sq)}, ${piece ? pieceLabel(piece) : 'empty'}`;
      if (kind === 'capture') label += ', you can capture here';
      else if (kind === 'move') label += ', you can move here';
      if (view.selected === sq) label += ', selected';
      if (view.checkSq === sq) label += ', in check';
      cell.setAttribute('aria-label', label);
      cell.setAttribute('aria-pressed', view.selected === sq ? 'true' : 'false');
      cell.disabled = Boolean(view.disabled);
      cell.tabIndex = sq === focusSq ? 0 : -1;

      cell.replaceChildren();
      if (piece) cell.append(pieceSvg(piece));
      // Small coordinate labels on the outer edge (decorative, hidden from screen readers).
      const row = Math.floor(i / 8);
      const col = i % 8;
      if (col === 0) cell.append(coord('rank', String((sq >> 3) + 1)));
      if (row === 7) cell.append(coord('file', FILES[sq & 7]));
    });
  }

  function coord(kind, text) {
    const span = document.createElement('span');
    span.className = `coord coord-${kind}`;
    span.setAttribute('aria-hidden', 'true');
    span.textContent = text;
    return span;
  }

  // Arrow keys move the focus around the board as it looks on screen.
  root.addEventListener('keydown', (event) => {
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = moves[event.key];
    if (!step) return;
    const current = order.indexOf(Number(event.target.dataset.sq));
    if (current < 0) return;
    const row = Math.min(7, Math.max(0, Math.floor(current / 8) + step[0]));
    const col = Math.min(7, Math.max(0, (current % 8) + step[1]));
    focusSq = order[row * 8 + col];
    cells.forEach((c, sq) => (c.tabIndex = sq === focusSq ? 0 : -1));
    cells[focusSq].focus();
    event.preventDefault();
  });

  return {
    render,
    focus(sq) {
      focusSq = sq;
      cells.forEach((c, i) => (c.tabIndex = i === focusSq ? 0 : -1));
      cells[sq].focus();
    },
  };
}
