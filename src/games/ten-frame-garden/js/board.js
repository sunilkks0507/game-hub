// Draws one ten-frame (or two stacked for Bonds to 20) as a grid of buttons.
// Every cell is a real <button>, so touch, keyboard and screen readers all work.
// Seeds differ by SHAPE and colour: round brown = from the question, leaf = the child's own.

import { EMPTY, GIVEN, MINE, AUTO } from './engine.js';

const COLUMNS = 5;

export function createBoard(root, { onTap }) {
  let size = 0;
  let cells = [];
  let focusId = 0;

  function build(n) {
    size = n;
    cells = [];
    const frames = n / 10;
    const kids = [];
    for (let f = 0; f < frames; f++) {
      const frame = document.createElement('div');
      frame.className = 'frame' + (frames > 1 ? ' small' : '');
      frame.setAttribute('role', 'group');
      frame.setAttribute('aria-label', frames > 1 ? `Frame ${f + 1} of ${frames}` : 'Ten frame, 2 rows of 5');
      for (let i = 0; i < 10; i++) {
        const id = f * 10 + i;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell';
        b.dataset.id = String(id);
        b.tabIndex = id === focusId ? 0 : -1;
        b.innerHTML = '<svg aria-hidden="true" focusable="false"><use href="#seed"/></svg>';
        frame.append(b);
        cells.push(b);
      }
      kids.push(frame);
    }
    root.replaceChildren(...kids);
  }

  root.addEventListener('click', (event) => {
    const b = event.target.closest('button.cell');
    if (!b) return;
    focusId = Number(b.dataset.id);
    onTap(focusId, b);
  });

  // Arrow keys move around the grid; Tab leaves it (only one cell is in the tab order).
  root.addEventListener('keydown', (event) => {
    const b = event.target.closest('button.cell');
    if (!b) return;
    const id = Number(b.dataset.id);
    const frameStart = Math.floor(id / 10) * 10;
    const local = id - frameStart;
    let next = null;
    if (event.key === 'ArrowRight') next = local % COLUMNS < COLUMNS - 1 ? id + 1 : null;
    else if (event.key === 'ArrowLeft') next = local % COLUMNS > 0 ? id - 1 : null;
    else if (event.key === 'ArrowDown') next = local < COLUMNS ? id + COLUMNS : frameStart + 10 < size ? frameStart + 10 + (local % COLUMNS) : null;
    else if (event.key === 'ArrowUp') next = local >= COLUMNS ? id - COLUMNS : frameStart >= 10 ? frameStart - 5 + (local % COLUMNS) : null;
    else return;
    event.preventDefault();
    if (next !== null && cells[next]) focusCell(next);
  });

  function focusCell(id) {
    focusId = id;
    cells.forEach((c, i) => {
      c.tabIndex = i === id ? 0 : -1;
    });
    cells[id].focus();
  }

  function label(id, value, n) {
    const frameNote = n > 10 ? `, frame ${Math.floor(id / 10) + 1}` : '';
    const where = `Cell ${(id % 10) + 1} of 10${frameNote}`;
    if (value === GIVEN) return `${where}, seed from the question.`;
    if (value === MINE) return `${where}, your seed.`;
    if (value === AUTO) return `${where}, filled in for you.`;
    return `${where}, empty. Tap to plant a seed.`;
  }

  // state: { size, cells }; opts: { enabled, glow: Set of ids, fresh: id or null }
  function render(state, { enabled = true, glow = new Set(), fresh = null } = {}) {
    if (state.size !== size) build(state.size);
    if (!cells[focusId]) focusId = 0;
    state.cells.forEach((value, id) => {
      const b = cells[id];
      const symbol = value === MINE ? 'leaf' : value === EMPTY ? null : 'seed';
      b.className = 'cell'
        + (value === EMPTY ? ' empty' : ' filled')
        + (value === GIVEN || value === AUTO ? ' given' : '')
        + (value === MINE ? ' mine' : '')
        + (glow.has(id) ? ' glow' : '')
        + (fresh === id ? ' fresh' : '');
      const svg = b.firstElementChild;
      if (symbol) {
        svg.style.display = '';
        svg.firstElementChild.setAttribute('href', `#${symbol}`);
      } else {
        svg.style.display = 'none';
      }
      b.setAttribute('aria-label', label(id, value, state.size));
      // Seeds from the question can't be changed; a finished frame can't be changed either.
      const locked = !enabled || value === GIVEN || value === AUTO;
      b.setAttribute('aria-disabled', locked ? 'true' : 'false');
    });
  }

  function firstEmpty(state) {
    return state.cells.indexOf(EMPTY);
  }

  return {
    render,
    focusCell,
    focusFirstEmpty(state) {
      const id = firstEmpty(state);
      if (id >= 0) focusCell(id);
    },
    cell: (id) => cells[id],
  };
}
