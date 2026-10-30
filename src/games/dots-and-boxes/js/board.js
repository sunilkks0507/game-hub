// Draws the dots, lines and boxes as one SVG. No game rules here: it only shows what it is told.
//
//   const board = createBoard(element, { onTap(edgeId) {} });
//   board.render({ n, edges, owner }, {
//     enabled: true | false,      can the player tap lines right now?
//     hint: edgeId,               amber glow (Hint button)
//     glow: Set of edge ids,      amber glow (tutorial)
//     warn: Set of edge ids,      small "!" badge: this line would give a box away
//     last: edgeId,               the line drawn most recently
//     names: ['You', 'Rival'],    for screen readers
//   });
//
// Each undrawn line is a button with a large diamond-shaped tap area (MASTER_SPEC section 9).
// One line at a time is in the Tab order; arrow keys move to the nearest line in that direction.

import { geometry } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 328;
const PAD = 16;

function svgEl(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, tag);
  for (const k of Object.keys(attrs)) el.setAttribute(k, String(attrs[k]));
  if (parent) parent.append(el);
  return el;
}

export function createBoard(root, { onTap }) {
  let n = 0;
  let svg = null;
  let g = null;
  let S = 0; // distance between neighbouring dots
  let hits = []; // tap area per line
  let lines = []; // visible line per line
  let badges = []; // "!" badge per line
  let boxes = []; // { tint, mark } per box
  let prev = null; // what was drawn last time, to animate only what changed
  let focusEdge = -1;
  let enabled = false;

  const X = (c) => PAD + c * S;
  const Y = (r) => PAD + r * S;

  function build(size) {
    n = size;
    g = geometry(n);
    S = (SIZE - 2 * PAD) / n;
    root.replaceChildren();
    svg = svgEl('svg', { class: 'dnb-board', viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'group', focusable: 'false' });
    root.append(svg);
    hits = [];
    lines = [];
    badges = [];
    boxes = [];
    prev = null;
    focusEdge = -1;

    const layerBoxes = svgEl('g', { class: 'layer-boxes' }, svg);
    const layerLines = svgEl('g', { class: 'layer-lines' }, svg);
    const layerHits = svgEl('g', { class: 'layer-hits' }, svg);
    const layerDots = svgEl('g', { class: 'layer-dots', 'aria-hidden': 'true' }, svg);
    const layerBadges = svgEl('g', { class: 'layer-badges', 'aria-hidden': 'true' }, svg);

    for (let b = 0; b < g.B; b++) {
      const r = Math.floor(b / n);
      const c = b % n;
      const cell = svgEl('g', { class: 'box', 'data-box': b }, layerBoxes);
      svgEl('rect', { class: 'tint', x: X(c) + 2, y: Y(r) + 2, width: S - 4, height: S - 4, rx: 6 }, cell);
      const mark = svgEl('g', { class: 'mark' }, cell);
      const cx = X(c) + S / 2;
      const cy = Y(r) + S / 2;
      const k = Math.min(S * 0.22, 22);
      svgEl('circle', { class: 'mark-0', cx, cy, r: k }, mark);
      svgEl('polygon', { class: 'mark-1', points: `${cx},${cy - k * 1.2} ${cx + k * 1.2},${cy} ${cx},${cy + k * 1.2} ${cx - k * 1.2},${cy}` }, mark);
      boxes.push({ cell, tint: cell.firstChild, mark });
    }

    for (let e = 0; e < g.E; e++) {
      const info = g.edgeInfo[e];
      const x1 = X(info.c);
      const y1 = Y(info.r);
      const x2 = info.horizontal ? X(info.c + 1) : x1;
      const y2 = info.horizontal ? y1 : Y(info.r + 1);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const h = S / 2;
      const a = info.horizontal ? [mx, my - h] : [mx - h, my];
      const b2 = info.horizontal ? [mx, my + h] : [mx + h, my];
      lines.push(svgEl('line', { class: 'line', x1, y1, x2, y2, 'data-edge': e }, layerLines));
      const hit = svgEl(
        'polygon',
        { class: 'hit', points: `${x1},${y1} ${a[0]},${a[1]} ${x2},${y2} ${b2[0]},${b2[1]}`, 'data-edge': e, role: 'button', tabindex: -1 },
        layerHits,
      );
      hit.mx = mx;
      hit.my = my;
      hits.push(hit);
      const badge = svgEl('g', { class: 'badge', transform: `translate(${mx} ${my})` }, layerBadges);
      svgEl('circle', { r: 10 }, badge);
      const t = svgEl('text', { y: 5, 'text-anchor': 'middle' }, badge);
      t.textContent = '!';
      badges.push(badge);
    }

    for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) svgEl('circle', { class: 'dot', cx: X(c), cy: Y(r), r: 5.5 }, layerDots);
  }

  // ----- taps and keys -----
  root.addEventListener('click', (event) => {
    const hit = event.target.closest && event.target.closest('.hit');
    if (!hit || !root.contains(hit)) return;
    onTap(Number(hit.getAttribute('data-edge')));
  });

  function moveFocus(from, dx, dy) {
    const origin = hits[from];
    let best = -1;
    let bestScore = Infinity;
    for (let e = 0; e < hits.length; e++) {
      if (e === from || hits[e].getAttribute('aria-disabled') === 'true') continue;
      const vx = hits[e].mx - origin.mx;
      const vy = hits[e].my - origin.my;
      const along = vx * dx + vy * dy;
      if (along <= 1) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2; // prefer lines straight ahead
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  root.addEventListener('keydown', (event) => {
    const hit = event.target.closest && event.target.closest('.hit');
    if (!hit) return;
    const e = Number(hit.getAttribute('data-edge'));
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTap(e);
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!dir) return;
    event.preventDefault();
    const next = moveFocus(e, dir[0], dir[1]);
    if (next >= 0) {
      setRoving(next);
      hits[next].focus();
    }
  });

  function setRoving(edge) {
    focusEdge = edge;
    hits.forEach((h, i) => h.setAttribute('tabindex', i === edge ? '0' : '-1'));
  }

  const lineName = (e) => {
    const info = g.edgeInfo[e];
    return `${info.horizontal ? 'Horizontal' : 'Vertical'} line, row ${info.r + 1}, column ${info.c + 1}`;
  };

  function render(view, opts = {}) {
    if (view.n !== n) build(view.n);
    enabled = Boolean(opts.enabled);
    const glow = opts.glow || new Set();
    const warn = opts.warn || new Set();
    const names = opts.names || ['You', 'Rival'];
    svg.setAttribute('aria-label', `${n} by ${n} board of boxes`);

    let firstOpen = -1;
    for (let e = 0; e < g.E; e++) {
      const drawn = view.edges[e] === 1;
      const el = hits[e];
      const line = lines[e];
      const fresh = prev && drawn && prev.edges[e] !== 1;
      line.classList.toggle('drawn', drawn);
      line.classList.toggle('fresh', Boolean(fresh));
      line.classList.toggle('last', opts.last === e);
      const lit = !drawn && (opts.hint === e || glow.has(e));
      line.classList.toggle('glow', lit);
      badges[e].classList.toggle('show', !drawn && warn.has(e));

      const playable = !drawn && enabled;
      el.setAttribute('aria-disabled', playable ? 'false' : 'true');
      el.classList.toggle('off', !playable);
      if (drawn) el.setAttribute('aria-hidden', 'true');
      else el.removeAttribute('aria-hidden');
      if (!drawn) {
        let label = lineName(e);
        if (lit) label += ', suggested';
        if (warn.has(e)) label += ', gives your rival a box';
        el.setAttribute('aria-label', label);
      }
      if (playable && firstOpen < 0) firstOpen = e;
    }
    // keep one line in the Tab order
    const stillGood = focusEdge >= 0 && hits[focusEdge].getAttribute('aria-disabled') === 'false';
    if (!stillGood) setRoving(opts.hint !== undefined && opts.hint !== null && firstOpen >= 0 ? opts.hint : firstOpen);
    if (firstOpen < 0) hits.forEach((h) => h.setAttribute('tabindex', '-1'));

    for (let b = 0; b < g.B; b++) {
      const o = view.owner[b];
      const { cell, mark } = boxes[b];
      const wasOwned = prev && prev.owner[b] !== -1;
      cell.classList.toggle('own-0', o === 0);
      cell.classList.toggle('own-1', o === 1);
      cell.classList.toggle('fresh', o !== -1 && prev !== null && !wasOwned);
      if (o === -1) {
        cell.removeAttribute('role');
        cell.removeAttribute('aria-label');
      } else {
        const r = Math.floor(b / n);
        const c = b % n;
        cell.setAttribute('role', 'img');
        cell.setAttribute('aria-label', `Box row ${r + 1}, column ${c + 1}: ${names[o]}`);
      }
      mark.setAttribute('aria-hidden', 'true');
    }
    prev = { edges: view.edges.slice(), owner: view.owner.slice() };
  }

  return {
    render,
    element: root,
    // For tests in a browser.
    get hits() {
      return hits;
    },
    focusFirst() {
      const open = hits.find((h) => h.getAttribute('aria-disabled') === 'false');
      if (open) {
        setRoving(Number(open.getAttribute('data-edge')));
        open.focus();
      }
    },
  };
}
