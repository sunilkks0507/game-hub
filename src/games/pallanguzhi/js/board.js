// Draws the 2x7 pit board as 14 buttons. No game rules here: it only shows what it is told.
//
//   const board = createBoard(element, { onTap(pit) {} });
//   board.render({ pits, hand }, { enabled: Set, active, kind, hint, last, rows: ['Your row', "Rival's row"] });
//
// Bottom row is pits 0-6 left to right. Top row is pits 13-7 left to right, so seeds
// travel counter-clockwise: along the bottom, then back along the top.

const MAX_DOTS = 12;
const TOP = [13, 12, 11, 10, 9, 8, 7];
const BOTTOM = [0, 1, 2, 3, 4, 5, 6];

function makePit(pit, column) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pit';
  button.dataset.pit = String(pit);
  button.dataset.column = String(column);
  const dots = document.createElement('span');
  dots.className = 'dots';
  dots.setAttribute('aria-hidden', 'true');
  const num = document.createElement('span');
  num.className = 'num';
  num.setAttribute('aria-hidden', 'true');
  button.append(dots, num);
  return button;
}

export function createBoard(root, { onTap }) {
  root.classList.add('pboard');
  root.replaceChildren();
  const topRow = document.createElement('div');
  topRow.className = 'prow prow-top';
  topRow.setAttribute('role', 'group');
  const bottomRow = document.createElement('div');
  bottomRow.className = 'prow prow-bottom';
  bottomRow.setAttribute('role', 'group');
  const buttons = new Array(14);
  TOP.forEach((pit, i) => {
    buttons[pit] = makePit(pit, i + 1);
    topRow.append(buttons[pit]);
  });
  BOTTOM.forEach((pit, i) => {
    buttons[pit] = makePit(pit, i + 1);
    bottomRow.append(buttons[pit]);
  });
  root.append(topRow, bottomRow);

  root.addEventListener('click', (event) => {
    const button = event.target.closest('.pit');
    if (button && root.contains(button)) onTap(Number(button.dataset.pit), button);
  });

  function render(view, opts = {}) {
    const enabled = opts.enabled || new Set();
    const rows = opts.rows || ['Your row', "Rival's row"];
    bottomRow.setAttribute('aria-label', rows[0]);
    topRow.setAttribute('aria-label', rows[1]);
    for (let pit = 0; pit < 14; pit++) {
      const button = buttons[pit];
      const count = view.pits[pit];
      if (button.dataset.n !== String(count)) {
        button.dataset.n = String(count);
        const dots = button.querySelector('.dots');
        const shown = Math.min(count, MAX_DOTS);
        const frag = document.createDocumentFragment();
        for (let i = 0; i < shown; i++) frag.append(document.createElement('i'));
        dots.replaceChildren(frag);
        button.querySelector('.num').textContent = String(count);
      }
      const rowName = pit < 7 ? rows[0] : rows[1];
      button.setAttribute(
        'aria-label',
        `${rowName}, pit ${button.dataset.column}: ${count} ${count === 1 ? 'seed' : 'seeds'}`,
      );
      button.disabled = !enabled.has(pit);
      button.classList.toggle('active', opts.active === pit);
      button.classList.toggle('kind-capture', opts.active === pit && opts.kind === 'capture');
      button.classList.toggle('hint', opts.hint === pit);
      button.classList.toggle('last', opts.last === pit);
      button.classList.toggle('mine', pit < 7);
    }
  }

  return { render, element: root, buttons };
}
