// The shop: draws one sale (customer, till, tray, buttons) and handles taps.
// The rules are in engine.js; this file only draws and listens. The play screen and the tutorial both use it.

import {
  trayFor, addPiece, removePiece, undo, useHint, total, target, remaining, settle, suggest, pieceKind, MAX_PIECES,
} from './engine.js';
import { itemById } from './items.js';

const R = '₹';
export const money = (n) => `${R}${n}`;
export const words = (n) => `${n} ${n === 1 ? 'rupee' : 'rupees'}`;

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A coin (round) or note (wide). Always a big numeral, so colour is never the only clue.
export function piece(kind, value, { tag = 'button', small = false, label = '' } = {}) {
  const node = el(tag, `piece ${kind} ${kind === 'coin' ? `c${value}` : `n${value}`}${small ? ' sm' : ''}`);
  if (tag === 'button') node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.append(el('b', '', money(value)));
  return node;
}

export function createShop(root, opts) {
  const {
    sound, announce = () => {}, onAdd = () => {}, onSettled = () => {}, onNext = () => {},
    jar: showJar = true, undoHint = true, onChange = () => {},
  } = opts;
  let sale = null;
  let glow = new Set();
  let enabled = true;
  let handback = [];

  root.classList.add('shop');
  const customer = el('div', 'customer');
  const jar = el('div', 'jar');
  jar.setAttribute('role', 'img');
  const till = el('div', 'till');
  const tillLabel = el('span', 'lbl');
  const tillTotal = el('span', 'total');
  const chips = el('div', 'chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Pieces in the till');
  till.append(el('div', 'till-top'), chips);
  till.firstChild.append(tillLabel, tillTotal);
  const say = el('p', 'say');
  const tray = el('div', 'tray');
  const back = el('div', 'handback');
  back.hidden = true;
  const actions = el('div', 'actions');
  const btnUndo = el('button', 'btn btn-quiet', 'Undo');
  const btnHint = el('button', 'btn btn-quiet', 'Hint');
  const btnPay = el('button', 'btn btn-primary', 'Pay');
  for (const b of [btnUndo, btnHint, btnPay]) b.type = 'button';
  if (undoHint) actions.append(btnUndo, btnHint);
  actions.append(btnPay);
  const nextRow = el('div', 'next-row');
  const btnNext = el('button', 'btn btn-primary big', 'Next customer');
  btnNext.type = 'button';
  nextRow.append(btnNext);
  nextRow.hidden = true;
  root.append(customer, jar, till, say, tray, back, actions, nextRow);
  if (!showJar) jar.hidden = true;

  /* ---------- drawing ---------- */
  function drawCustomer() {
    const item = itemById(sale.itemId);
    customer.replaceChildren();
    const gilu = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    gilu.setAttribute('class', 'gilu');
    gilu.setAttribute('width', '72');
    gilu.setAttribute('height', '72');
    gilu.setAttribute('aria-hidden', 'true');
    gilu.innerHTML = '<use href="#gilu"/>';
    const tag = el('div', 'tag');
    const row = el('div', 'item');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '36');
    icon.setAttribute('height', '36');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<use href="#${sale.itemId}"/>`;
    row.append(icon, el('span', '', item ? item.name : 'Item'));
    const price = el('div', 'price', sale.level === 3 ? `Price ${money(sale.price)}` : money(sale.price));
    price.setAttribute('aria-label', `${sale.level === 3 ? 'Price ' : ''}${words(sale.price)}`);
    tag.append(row, price);
    if (sale.level === 3) {
      const g = el('div', 'given', `Customer gave you ${money(sale.given)}`);
      g.setAttribute('aria-label', `The customer gave you ${words(sale.given)}`);
      tag.append(g);
    }
    customer.append(gilu, tag);
  }

  function drawTray() {
    tray.replaceChildren();
    const all = trayFor(sale.level);
    const groups = [['coin', 'Coins'], ['note', 'Notes']].map(([kind, name]) => [kind, name, all.filter((p) => p.kind === kind)]).filter((g) => g[2].length);
    for (const [kind, name, list] of groups) {
      if (groups.length > 1) tray.append(el('div', 'lab', name));
      const row = el('div', 'pieces');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', name);
      for (const p of list) {
        const b = piece(kind, p.value, { small: sale.level === 3 && kind === 'coin', label: `${p.value} rupee ${kind}. Tap to add.` });
        b.dataset.value = String(p.value);
        b.addEventListener('click', () => add(p.value));
        row.append(b);
      }
      tray.append(row);
    }
  }

  function drawChips(lastAdded = -1) {
    chips.replaceChildren();
    sale.pieces.forEach((v, i) => {
      const kind = pieceKind(sale.level, v);
      const b = piece(kind, v, { label: `Piece ${i + 1} in the till, ${v} rupee ${kind}. Tap to take it out.` });
      b.classList.add('till-chip');
      if (i === lastAdded) b.classList.add('pop');
      b.disabled = !enabled || sale.settled;
      b.addEventListener('click', () => take(i));
      chips.append(b);
    });
  }

  function refresh(lastAdded = -1) {
    tillLabel.textContent = sale.level === 3 ? 'Your change' : 'Till';
    tillTotal.textContent = money(total(sale));
    tillTotal.setAttribute('aria-label', words(total(sale)));
    btnPay.textContent = sale.level === 3 ? 'Give change' : 'Pay';
    drawChips(lastAdded);
    const locked = !enabled || sale.settled;
    for (const b of tray.querySelectorAll('.piece')) {
      b.disabled = locked;
      b.classList.toggle('glow', !locked && glow.has(Number(b.dataset.value)));
    }
    btnUndo.disabled = locked || sale.pieces.length === 0;
    btnHint.disabled = locked;
    btnPay.disabled = locked;
    actions.hidden = sale.settled;
    nextRow.hidden = !sale.settled;
    back.hidden = handback.length === 0;
  }

  function drawJar(done) {
    jar.replaceChildren();
    jar.setAttribute('aria-label', `Customer ${Math.min(done + 1, 8)} of 8`);
    for (let i = 0; i < 8; i++) jar.append(el('span', `slot${i < done ? ' done' : i === done ? ' now' : ''}`));
  }

  function setSay(text, kind = '') {
    say.textContent = text;
    say.className = `say ${kind}`.trim();
  }

  /* ---------- actions ---------- */
  function add(value) {
    if (!enabled || !sale || sale.settled) return;
    sound.unlock();
    const r = addPiece(sale, value);
    if (!r.ok) {
      sound.play('error');
      if (r.reason === 'full') setSay('The till is full. Tap a piece to take it out.', 'nudge');
      onAdd({ value, ok: false, reason: r.reason, sale });
      return;
    }
    sale = r.state;
    glow = new Set();
    setSay('');
    sound.play('pick');
    refresh(sale.pieces.length - 1);
    announce(`Added ${words(value)}. Total ${words(total(sale))}.`);
    onChange(sale);
    onAdd({ value, ok: true, reason: null, sale });
  }

  function take(index) {
    if (!enabled || !sale || sale.settled) return;
    sound.unlock();
    const value = sale.pieces[index];
    sale = removePiece(sale, index);
    setSay('');
    sound.play('tap');
    refresh();
    announce(`Took out ${words(value)}. Total ${words(total(sale))}.`);
    onChange(sale);
    const nextChip = chips.children[Math.min(index, chips.children.length - 1)];
    if (nextChip) nextChip.focus();
    else tray.querySelector('.piece:not(:disabled)')?.focus();
  }

  function doUndo() {
    if (!enabled || !sale || sale.settled || !sale.pieces.length) return;
    take(sale.pieces.length - 1);
  }

  function doHint() {
    if (!enabled || !sale || sale.settled) return;
    sound.unlock();
    sale = useHint(sale);
    const left = remaining(sale);
    const t = total(sale);
    const goal = target(sale);
    const next = suggest(sale);
    glow = new Set(next ? [next] : []);
    sound.play('hint');
    if (t > goal) {
      setSay(sale.level === 3 ? 'Too much change. Tap a piece to take it out.' : `That is more than ${money(goal)}. Press Pay, or take a piece out.`, 'nudge');
    } else if (left === 0) {
      setSay(sale.level === 3 ? 'That is the right change. Press Give change!' : 'That is the price. Press Pay!', 'good');
    } else {
      setSay(`${sale.level === 3 ? 'Change to give' : 'Still needed'}: ${money(left)}. Try the glowing piece.`, 'good');
    }
    refresh();
    announce(say.textContent);
    onChange(sale);
  }

  function pay() {
    if (!enabled || !sale || sale.settled) return;
    sound.unlock();
    const res = settle(sale);
    if (!res.done) {
      sound.play('error');
      setSay(res.kind === 'short'
        ? (sale.level === 3 ? 'A bit more change!' : 'A little more!')
        : "That's too much change. Tap a piece to take it out.", 'nudge');
      announce(say.textContent);
      return;
    }
    sale = res.state;
    handback = res.change;
    back.replaceChildren();
    if (handback.length) {
      const lab = el('div', 'lab', 'Gilu hands back');
      const row = el('div', 'pieces');
      row.setAttribute('aria-hidden', 'true');
      for (const v of handback) row.append(piece(pieceKind(sale.level, v), v, { tag: 'span' }));
      back.append(lab, row);
    }
    const paid = total(sale);
    let text;
    if (res.kind === 'exact') text = sale.level === 3 ? 'Right change! Well done.' : 'Paid exactly. Thank you!';
    else text = `You paid ${money(paid)} for ${money(sale.price)}. Change ${money(res.change.reduce((a, b) => a + b, 0))}.`;
    setSay(text, 'ok');
    sound.play(res.kind === 'exact' ? 'success' : 'pick');
    refresh();
    announce(text);
    btnNext.focus();
    onSettled({ ...res, paid }, sale);
  }

  btnUndo.addEventListener('click', doUndo);
  btnHint.addEventListener('click', doHint);
  btnPay.addEventListener('click', pay);
  btnNext.addEventListener('click', () => { sound.unlock(); sound.play('tap'); onNext(); });

  // Keyboard: arrows move along the tray, Backspace takes the last piece out, P presses Pay.
  root.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const inTray = e.target.closest && e.target.closest('.tray');
    if (inTray && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const list = [...tray.querySelectorAll('.piece:not(:disabled)')];
      const at = list.indexOf(e.target);
      if (at < 0 || !list.length) return;
      const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      list[(at + step + list.length) % list.length].focus();
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      doUndo();
      e.preventDefault();
    } else if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      pay();
    }
  });

  return {
    // `jarDone`: customers already served (0 to 7); glowValues: tray values to light up.
    load(newSale, { jarDone = 0, glowValues = [], nextLabel = 'Next customer', note = '' } = {}) {
      sale = newSale;
      glow = new Set(glowValues);
      handback = [];
      back.replaceChildren();
      btnNext.textContent = nextLabel;
      drawCustomer();
      drawJar(jarDone);
      drawTray();
      setSay(note);
      refresh();
    },
    get sale() { return sale; },
    get say() { return say.textContent; },
    setGlow(values) { glow = new Set(values); if (sale) refresh(); },
    setSay,
    setEnabled(flag) { enabled = Boolean(flag); if (sale) refresh(); },
    doHint,
    pay,
    focusFirst() { tray.querySelector('.piece:not(:disabled)')?.focus(); },
    MAX_PIECES,
  };
}
