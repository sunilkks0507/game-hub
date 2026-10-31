// Draws the Five in a Row board as one SVG. No game rules here: it only shows what it is told.
//
//   const board = createBoard(element, { onTap(pointId) {}, onEscape() {} });
//   board.render({ n, cells, moves }, {
//     enabled: true | false,   can the player tap right now?
//     preview: pointId,        ghost stone waiting for a second tap (or -1)
//     previewColour: 0 | 1,    which colour the ghost is
//     last: pointId,           most recent stone (small square marker)
//     winLine: [ids] | null,   the winning five: a line and a ring on each stone
//     glow: Set of ids,        amber glow (tutorial, Hint)
//     win: Set, block: Set, watch: Set    threat helper badges ("+", "!", "!")
//     animate: true,           pop the newest stone in (off with reduced motion)
//     names: ['Black', 'White'],
//   });
//
// Points sit on the grid lines with a half-gap margin, so the gap between points is board width divided by n
// (36px on 9x9, 25px on 13x13, 22px on 15x15 at 360px). Each point has an invisible hit area the size of its grid
// cell. One point is in the Tab order; arrow keys move; Enter or Space taps; Escape clears the preview.

import { pointLabel } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 328; // board width in screen pixels on a 360px phone
const STARS = { 9: [2, 4, 6], 13: [3, 6, 9], 15: [3, 7, 11] };

function svgEl(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, tag);
  for (const k of Object.keys(attrs)) el.setAttribute(k, String(attrs[k]));
  if (parent) parent.append(el);
  return el;
}

export function createBoard(root, { onTap, onEscape = () => {} }) {
  let n = 0;
  let gap = 0;
  let svg = null;
  let layerStones = null;
  let layerOver = null;
  let hits = [];
  let focusPoint = 0;
  let enabled = false;

  const X = (c) => gap / 2 + c * gap;
  const Y = (r) => gap / 2 + r * gap;
  const px = (p) => X(p % n);
  const py = (p) => Y(Math.floor(p / n));

  function build(size) {
    n = size;
    gap = SIZE / n;
    root.replaceChildren();
    svg = svgEl('svg', { class: 'gm-board', viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'group', focusable: 'false' });
    root.append(svg);
    svgEl('rect', { class: 'wood', x: 0, y: 0, width: SIZE, height: SIZE, rx: 8 }, svg);
    const grid = svgEl('g', { class: 'grid', 'aria-hidden': 'true' }, svg);
    for (let i = 0; i < n; i++) {
      svgEl('line', { x1: X(0), y1: Y(i), x2: X(n - 1), y2: Y(i) }, grid);
      svgEl('line', { x1: X(i), y1: Y(0), x2: X(i), y2: Y(n - 1) }, grid);
    }
    const stars = STARS[n] || [];
    for (const r of stars) for (const c of stars) svgEl('circle', { class: 'star', cx: X(c), cy: Y(r), r: 2.6 }, grid);
    layerStones = svgEl('g', { class: 'stones', 'aria-hidden': 'true' }, svg);
    layerOver = svgEl('g', { class: 'over', 'aria-hidden': 'true' }, svg);
    const layerHits = svgEl('g', { class: 'hits' }, svg);
    hits = [];
    for (let p = 0; p < n * n; p++) {
      const h = svgEl(
        'rect',
        { class: 'hit', x: X(p % n) - gap / 2, y: Y(Math.floor(p / n)) - gap / 2, width: gap, height: gap, role: 'button', tabindex: -1, 'data-p': p },
        layerHits,
      );
      hits.push(h);
    }
    focusPoint = Math.floor(n / 2) * n + Math.floor(n / 2);
    hits[focusPoint].setAttribute('tabindex', '0');
  }

  function moveFocus(p) {
    hits[focusPoint].setAttribute('tabindex', '-1');
    focusPoint = p;
    hits[p].setAttribute('tabindex', '0');
    hits[p].focus();
  }

  function stoneGroup(p, colour, extra = '') {
    const r = gap * 0.44;
    const g = svgEl('g', { class: `stone s${colour} ${extra}`.trim(), transform: `translate(${px(p)} ${py(p)})` });
    const body = svgEl('g', { class: 'body' }, g);
    svgEl('circle', { class: 'disc', r }, body);
    if (colour === 0) svgEl('circle', { class: 'shine', cx: -r * 0.3, cy: -r * 0.32, r: r * 0.22 }, body);
    // White carries a hollow ring so it differs from Black by shape, not colour alone.
    else svgEl('circle', { class: 'ring-mark', r: r * 0.5 }, body);
    return g;
  }

  function badge(p, text, cls) {
    const r = Math.max(6, gap * 0.26);
    const g = svgEl('g', { class: `badge ${cls}`, transform: `translate(${px(p) + gap * 0.3} ${py(p) - gap * 0.3})` }, layerOver);
    svgEl('circle', { r }, g);
    const t = svgEl('text', { y: r * 0.38, 'text-anchor': 'middle', 'font-size': r * 1.25 }, g);
    t.textContent = text;
  }

  function render(state, view = {}) {
    if (!svg || n !== state.n) build(state.n);
    enabled = Boolean(view.enabled);
    const names = view.names || ['Black', 'White'];
    const last = view.last ?? -1;
    const preview = view.preview ?? -1;
    const glow = view.glow || new Set();
    layerStones.replaceChildren();
    layerOver.replaceChildren();

    for (let p = 0; p < state.cells.length; p++) {
      const c = state.cells[p];
      if (c === -1) continue;
      const g = stoneGroup(p, c, view.animate && p === last ? 'pop' : '');
      layerStones.append(g);
      if (p === last) {
        const s = Math.max(4, gap * 0.14);
        svgEl('rect', { class: `last l${c}`, x: -s / 2, y: -s / 2, width: s, height: s }, g);
      }
    }

    for (const p of glow) {
      const ring = svgEl('circle', { class: 'glow', cx: px(p), cy: py(p), r: Math.max(13, gap * 0.5) }, layerOver);
      ring.setAttribute('fill', 'none');
    }

    if (view.winLine && view.winLine.length >= 5) {
      const a = view.winLine[0];
      const b = view.winLine[view.winLine.length - 1];
      svgEl('line', { class: 'win-line', x1: px(a), y1: py(a), x2: px(b), y2: py(b) }, layerOver);
      for (const p of view.winLine) svgEl('circle', { class: 'win-ring', cx: px(p), cy: py(p), r: gap * 0.44 + 3 }, layerOver);
    }

    if (preview >= 0 && state.cells[preview] === -1) {
      const colour = view.previewColour ?? 0;
      const halo = Math.max(22, gap * 0.44 + 8);
      const g = svgEl('g', { class: `ghost s${colour}`, transform: `translate(${px(preview)} ${py(preview)})` }, layerOver);
      svgEl('circle', { class: 'halo', r: halo }, g);
      const disc = svgEl('circle', { class: 'disc', r: gap * 0.44 }, g);
      disc.setAttribute('stroke-dasharray', '3 3');
      if (colour === 1) svgEl('circle', { class: 'ring-mark', r: gap * 0.44 * 0.5 }, g);
    }

    if (view.showThreats !== false) {
      for (const p of view.win || []) badge(p, '+', 'b-win');
      for (const p of view.block || []) badge(p, '!', 'b-block');
      for (const p of view.watch || []) badge(p, '!', 'b-watch');
    }

    for (let p = 0; p < hits.length; p++) {
      const c = state.cells[p];
      let label = `Column ${pointLabel(n, p)[0]}, row ${Math.floor(p / n) + 1}, `;
      if (c === -1) label += p === preview ? 'preview stone, press again to place' : 'empty';
      else label += `${names[c]} stone`;
      if (p === last) label += ', last move';
      if (view.hint === p) label += ', suggested';
      if (view.winLine && view.winLine.includes(p)) label += ', part of the five';
      hits[p].setAttribute('aria-label', label);
      hits[p].setAttribute('aria-disabled', enabled && c === -1 ? 'false' : 'true');
      hits[p].classList.toggle('taken', c !== -1);
    }
    svg.setAttribute('aria-label', `Board, ${n} by ${n} points`);
  }

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-p]');
    if (!el || !enabled) return;
    const p = Number(el.getAttribute('data-p'));
    focusPoint = p;
    onTap(p);
  });

  root.addEventListener('keydown', (ev) => {
    if (!svg) return;
    const el = ev.target.closest && ev.target.closest('[data-p]');
    if (!el) return;
    const p = Number(el.getAttribute('data-p'));
    const r = Math.floor(p / n);
    const c = p % n;
    const move = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[ev.key];
    if (move) {
      ev.preventDefault();
      const nr = Math.min(n - 1, Math.max(0, r + move[0]));
      const nc = Math.min(n - 1, Math.max(0, c + move[1]));
      moveFocus(nr * n + nc);
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      if (enabled) onTap(p);
    } else if (ev.key === 'Escape') {
      onEscape();
    }
  });

  return {
    render,
    focusPoint(p) {
      if (hits[p]) moveFocus(p);
    },
  };
}
