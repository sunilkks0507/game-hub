// Small DOM helpers shared by the game and the tutorial: the counter line, the "pair" panel and the dot tray.
// On the Dots level (numerals: false) none of these put a digit on screen; they use groups of dots instead.

import { pair, needed } from './engine.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function dots(count, kind) {
  const group = el('span', 'group');
  group.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) group.append(el('i', 'dot' + (kind === 'leaf' ? ' leaf' : '')));
  return group;
}

// Which part is the round seed and which is the leaf. Levels 1, 2, 4: the first part is given (round).
// Level 3: the first part is what the child planted (leaf).
function kinds(level) {
  return level === 3 ? ['leaf', 'seed'] : ['seed', 'leaf'];
}

// The line above the frame while playing: "6 + 1" or "Planted 2 of 4". Empty on the Dots level.
export function renderStatus(node, state, numerals) {
  node.replaceChildren();
  if (!numerals) return;
  if (state.level === 3) {
    node.append(el('span', 'part-b', `Planted ${state.planted} of ${state.target}`));
    return;
  }
  const mine = state.cells.filter((c) => c === 2).length;
  node.append(el('span', 'part-a', String(state.given)), document.createTextNode(' + '), el('span', 'part-b', String(mine)));
}

// The dot tray shown on the Dots level after Hint: one dot for every seed still to plant.
export function renderTray(node, state, show) {
  node.replaceChildren();
  node.hidden = !show;
  if (!show) return;
  const n = needed(state);
  for (let i = 0; i < n; i++) node.append(el('i', 'dot leaf'));
  node.setAttribute('aria-label', `${n} more to plant`);
}

// The finished pair. With numerals: "6 + 4 = 10". Without: a group of round seeds and a group of leaves.
export function renderPair(node, state, numerals) {
  const [a, b, total] = pair(state);
  node.replaceChildren();
  const [ka, kb] = kinds(state.level);
  if (numerals) {
    const eq = el('span', 'eq');
    eq.append(
      el('span', ka === 'seed' ? 'part-a' : 'part-b', String(a)),
      document.createTextNode(' + '),
      el('span', kb === 'seed' ? 'part-a' : 'part-b', String(b)),
      document.createTextNode(` = ${total}`),
    );
    node.append(eq);
    node.setAttribute('aria-label', `${a} plus ${b} makes ${total}`);
  } else {
    const plus = el('span', 'plus', '+');
    plus.setAttribute('aria-hidden', 'true');
    node.append(dots(a, ka), plus, dots(b, kb));
    node.setAttribute('aria-label', `${a} and ${b} fill the frame`);
  }
  node.hidden = false;
}

export { dots, el };
