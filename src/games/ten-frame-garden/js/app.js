// Ten Frame Garden app: screens, garden session, hint/undo, stats, badges, save and continue.
// The rules live in engine.js; drawing a frame lives in board.js; small DOM helpers live in view.js.

import {
  EMPTY, GIVEN, MINE, AUTO, GARDEN_SIZE, LEVELS, isLevel, createFrame, isComplete, needed, plant, unplant,
  restoreFrame, normalizeStats, recordFrame, recordGarden, bondsKnown, newlySeen, makeGarden, BADGES, newBadges,
} from './engine.js';
import { createBoard } from './board.js';
import { createTutorial } from './tutorial.js';
import { renderStatus, renderTray, renderPair, dots, el } from './view.js';
import { createStore, readProgress, writeProgress, todayString } from '../../../shared/storage.js';
import { createSound } from '../../../shared/sound.js';
import { openDialog, closeDialog, confirmDialog, toast } from '../../../shared/dialog.js';
import { registerServiceWorker } from '../../../shared/pwa.js';

const GAME_ID = 'ten-frame-garden';
const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);

/* ---------- settings ---------- */
const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = Object.assign({ sound: true, reduceMotion: prefersReduced, level: 2 }, store.get('settings', {}));
if (!isLevel(settings.level)) settings.level = 2;
const saveSettings = () => store.set('settings', settings);

const sound = createSound({ muted: !settings.sound });
function applySettings() {
  sound.setMuted(!settings.sound);
  document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  $('btn-sound').textContent = `Sound: ${settings.sound ? 'on' : 'off'}`;
  $('btn-sound').setAttribute('aria-pressed', String(settings.sound));
}
const motionReduced = () => document.documentElement.classList.contains('reduce-motion');

const readStats = () => normalizeStats(store.get('stats'));
const writeStats = (stats) => store.set('stats', stats);

/* ---------- screens ---------- */
const screens = ['title', 'levels', 'play', 'tutorial'];
function show(name) {
  for (const s of screens) $(`screen-${s}`).hidden = s !== name;
  window.scrollTo(0, 0);
  if (name === 'title') $('btn-continue').hidden = !validSaved();
  if (name === 'levels') markLevel();
}
const announce = (text) => { $('live').textContent = ''; setTimeout(() => { $('live').textContent = text; }, 30); };
const numeralsOn = (level = settings.level) => LEVELS[level].numerals;

/* ---------- session ---------- */
// session: { level, garden, index, state, order, frameHint, frames, statsStart, over, glow, fresh }
let session = null;
const board = createBoard($('board'), { onTap: handleTap });

const GOOD = ['Hooray! A flower grew!', 'Well done, gardener!', 'Lovely! Look at that flower.', 'You did it! Another flower!', 'Beautiful! Keep growing.'];
const START = {
  1: '',
  2: 'Fill the frame to make ten!',
  3: "Plant just enough. I'll fill the rest!",
  4: 'Two frames make twenty. Fill them up!',
};

function say(text) {
  $('bubble').textContent = text;
}
function wiggle() {
  if (motionReduced()) return;
  const pip = $('pip-play');
  pip.classList.remove('wiggle');
  void pip.getBoundingClientRect();
  pip.classList.add('wiggle');
}

function saveGame() {
  if (!session || session.over) return store.remove('saved');
  store.set('saved', {
    level: session.level, garden: session.garden, index: session.index, cells: session.state.cells, order: session.order,
    frameHint: session.frameHint, frames: session.frames, statsStart: session.statsStart,
  });
}

function validSaved() {
  const saved = store.get('saved');
  return Boolean(saved && isLevel(saved.level) && Array.isArray(saved.garden) && saved.garden.length === GARDEN_SIZE);
}

function startGarden(level) {
  settings.level = level;
  saveSettings();
  const stats = readStats();
  const progress = readProgress(GAME_ID);
  progress.played += 1;
  progress.lastPlayed = todayString();
  writeProgress(progress);
  session = {
    level, garden: makeGarden(level, stats, Math.random), index: 0, order: [], frameHint: false, frames: [],
    statsStart: stats, over: false, glow: new Set(), fresh: null, state: null,
  };
  beginFrame(0);
  show('play');
  renderAll();
  say(START[level]);
  $('pip-play').closest('.pip-row').classList.toggle('silent', level === 1);
  announce('New garden. Tap an empty cell to plant a seed.');
  board.focusFirstEmpty(session.state);
}

function beginFrame(index) {
  session.index = index;
  session.state = createFrame(session.level, session.garden[index]);
  session.order = [];
  session.frameHint = false;
  session.glow = new Set();
  session.fresh = null;
  saveGame();
}

function resumeGarden() {
  const saved = store.get('saved');
  if (!validSaved()) return false;
  const index = Number.isInteger(saved.index) && saved.index >= 0 && saved.index < GARDEN_SIZE ? saved.index : 0;
  const state = restoreFrame(saved.level, saved.garden[index], saved.cells, saved.order);
  if (!state) {
    store.remove('saved');
    return false;
  }
  settings.level = saved.level;
  session = {
    level: saved.level, garden: saved.garden, index, state, order: saved.order || [], frameHint: Boolean(saved.frameHint),
    frames: Array.isArray(saved.frames) ? saved.frames : [], statsStart: normalizeStats(saved.statsStart), over: false,
    glow: new Set(), fresh: null,
  };
  show('play');
  renderAll();
  say(isComplete(state) ? pick(GOOD) : START[saved.level]);
  $('pip-play').closest('.pip-row').classList.toggle('silent', saved.level === 1);
  board.focusFirstEmpty(state);
  return true;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/* ---------- drawing ---------- */
function flowerSlots() {
  const holder = $('garden');
  const done = session.frames.length;
  holder.replaceChildren(
    ...Array.from({ length: GARDEN_SIZE }, (_, i) => {
      const slot = el('span', 'slot' + (i < done ? ' done' : i === session.index ? ' now' : ''));
      slot.innerHTML = `<svg aria-hidden="true" focusable="false"><use href="#${i < done ? 'flower' : i === session.index ? 'bud' : 'seed'}"/></svg>`;
      if (i >= done && i !== session.index) slot.firstElementChild.style.opacity = '0.25';
      return slot;
    }),
  );
  holder.setAttribute('aria-label', `Garden: ${done} of ${GARDEN_SIZE} flowers`);
}

function questionText(s) {
  if (s.level === 2) return `${s.state.given} + ? = 10`;
  if (s.level === 4) return `${s.state.given} + ? = 20`;
  if (s.level === 3) return `Plant ${s.state.target}`;
  return '';
}

function renderAll() {
  const s = session;
  const complete = isComplete(s.state);
  const numerals = LEVELS[s.level].numerals;
  flowerSlots();
  $('goal-line').textContent = questionText(s);
  renderStatus($('status'), s.state, numerals);
  renderTray($('tray'), s.state, s.level === 1 && s.frameHint && !complete);
  board.render(s.state, { enabled: !complete, glow: s.glow, fresh: s.fresh });
  if (complete) renderPair($('pair-panel'), s.state, numerals);
  else $('pair-panel').hidden = true;
  $('btn-undo').disabled = complete || s.order.length === 0;
  $('btn-hint').disabled = complete;
  $('btn-next').hidden = !complete;
  $('btn-next').textContent = s.index === GARDEN_SIZE - 1 ? 'See my garden' : 'Next';
  $('btn-hint').hidden = complete;
  $('btn-undo').hidden = complete;
}

/* ---------- playing ---------- */
function handleTap(id) {
  const s = session;
  if (!s || s.over || isComplete(s.state)) return;
  sound.unlock();
  const value = s.state.cells[id];

  if (value === MINE && s.level === 3) {
    removeSeed(id);
    return;
  }
  if (value === GIVEN || value === AUTO) {
    sound.play('error');
    wiggle();
    if (s.level !== 1) say('That seed was already there.');
    return;
  }
  if (value === MINE) {
    sound.play('error');
    wiggle();
    if (s.level !== 1) say('Try an empty one!');
    return;
  }

  const result = plant(s.state, id);
  if (!result.ok) return;
  s.state = result.state;
  s.order.push(id);
  s.glow = new Set();
  s.fresh = id;
  sound.play('seed', s.order.length);
  if (s.level !== 1) say('');
  if (isComplete(s.state)) frameDone();
  else {
    renderAll();
    announce(`Planted. ${needed(s.state)} more.`);
    saveGame();
  }
}

function removeSeed(id) {
  const s = session;
  const result = unplant(s.state, id);
  if (!result.ok) return;
  s.state = result.state;
  s.order = s.order.filter((x) => x !== id);
  s.glow = new Set();
  s.fresh = null;
  sound.play('tap');
  renderAll();
  announce('Seed taken back.');
  saveGame();
}

function undo() {
  const s = session;
  if (!s || s.over || isComplete(s.state) || !s.order.length) return;
  sound.unlock();
  removeSeed(s.order[s.order.length - 1]);
}

function hint() {
  const s = session;
  if (!s || s.over || isComplete(s.state)) return;
  sound.unlock();
  s.frameHint = true;
  const first = s.state.cells.indexOf(EMPTY);
  s.glow = new Set(first >= 0 ? [first] : []);
  sound.play('hint');
  const n = needed(s.state);
  if (s.level !== 1) say(n === 1 ? 'Just one more seed!' : `${n} more seeds to plant.`);
  renderAll();
  announce(`${n} more to plant. The glowing cell is a good place.`);
  saveGame();
}

function grantBadges(ids) {
  if (!ids.length) return;
  const progress = readProgress(GAME_ID);
  progress.badges = [...progress.badges, ...ids];
  writeProgress(progress);
}

function frameDone() {
  const s = session;
  const given = s.garden[s.index];
  s.frames.push({ given, hint: s.frameHint });
  const stats = recordFrame(readStats(), s.level, given, { hint: s.frameHint });
  writeStats(stats);
  const have = readProgress(GAME_ID).badges;
  const fresh = newBadges(have, { stats });
  grantBadges(fresh);
  sound.play('success');
  renderAll();
  if (!motionReduced()) {
    const holder = $('board');
    holder.classList.remove('bloom');
    void holder.offsetWidth;
    holder.classList.add('bloom');
  }
  wiggle();
  if (s.level !== 1) say(pick(GOOD));
  announce(`${pairWords(s)}. A flower grew.`);
  if (fresh.length) toast($('toast'), `New badge: ${BADGES[fresh[0]]}`, 3000);
  saveGame();
  $('btn-next').focus();
}

function pairWords(s) {
  const a = s.level === 3 ? s.state.target : s.state.given;
  const total = s.state.size;
  return `${a} plus ${total - a} makes ${total}`;
}

function nextFrame() {
  const s = session;
  if (!s || !isComplete(s.state)) return;
  sound.unlock();
  sound.play('tap');
  if (s.index >= GARDEN_SIZE - 1) {
    finishGarden();
    return;
  }
  const hadFocus = document.activeElement === $('btn-next');
  $('board').classList.remove('bloom');
  beginFrame(s.index + 1);
  renderAll();
  say(START[s.level]);
  announce(`Flower ${s.index + 1} of ${GARDEN_SIZE}. Plant seeds to fill the frame.`);
  if (hadFocus) board.focusFirstEmpty(s.state);
}

/* ---------- result ---------- */
function factRow(label, content) {
  const li = el('li');
  li.append(el('span', '', label));
  if (content) li.append(document.createTextNode(' '), content);
  return li;
}

function pairNode(level, value) {
  const total = LEVELS[level].group === '20' ? 20 : 10;
  const wrap = el('span', 'pairs');
  const one = el('span');
  if (LEVELS[level].numerals) {
    one.textContent = `${value} + ${total - value}`;
  } else {
    one.append(dots(value, 'seed'), dots(total - value, 'leaf'));
  }
  wrap.append(one);
  return wrap;
}

function finishGarden() {
  const s = session;
  s.over = true;
  const noHintAll = s.frames.every((f) => !f.hint);
  const before = s.statsStart;
  const stats = recordGarden(readStats(), { noHint: noHintAll });
  writeStats(stats);
  const progress = readProgress(GAME_ID);
  progress.won += 1;
  progress.lastPlayed = todayString();
  writeProgress(progress);
  const earned = newBadges(progress.badges, { stats, gardenDone: true, gardenNoHint: noHintAll });
  grantBadges(earned);
  store.remove('saved');
  sound.play('win');

  const group = LEVELS[s.level].group;
  const numerals = LEVELS[s.level].numerals;
  const flowers = $('result-flowers');
  flowers.replaceChildren(...Array.from({ length: GARDEN_SIZE }, () => {
    const holder = el('span');
    holder.innerHTML = '<svg aria-hidden="true" focusable="false"><use href="#flower"/></svg>';
    return holder.firstElementChild;
  }));
  flowers.setAttribute('aria-label', 'Five flowers');
  $('result-title').textContent = 'Your garden is in bloom!';

  const facts = $('result-facts');
  facts.replaceChildren();
  facts.append(factRow(numerals ? `Your garden has ${GARDEN_SIZE} flowers.` : 'Look at all your flowers!'));
  const seen = newlySeen(before, stats, group);
  if (seen.length) {
    const list = el('span', 'pairs');
    seen.forEach((v) => list.append(...pairNode(s.level, v).children));
    facts.append(factRow('New pairs you found:', list));
  }
  const clean = s.frames.filter((f) => !f.hint).length;
  if (numerals) facts.append(factRow(`Frames with no hint: ${clean} of ${GARDEN_SIZE}.`));
  else facts.append(factRow('Frames with no hint:', dots(clean, 'leaf')));
  const known = bondsKnown(stats, group);
  if (numerals) facts.append(factRow(`Pairs you know well: ${known} of 9.`));
  else facts.append(factRow('Pairs you know well:', dots(known, 'leaf')));

  const list = $('result-badges');
  list.replaceChildren(...earned.map((id) => el('li', '', `New badge: ${BADGES[id]}`)));
  openDialog($('dlg-result'));
  announce('Your garden is in bloom!');
}

let afterResult = null;
$('dlg-result').addEventListener('close', () => {
  const act = afterResult || (() => show('levels'));
  afterResult = null;
  act();
});
function closeResult(action) {
  afterResult = action;
  closeDialog($('dlg-result'));
}

/* ---------- levels ---------- */
function markLevel() {
  document.querySelectorAll('.level').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.level) === settings.level)));
}

/* ---------- tutorial ---------- */
let tutorialFrom = 'title';
const tutorial = createTutorial({
  ui: {
    stepLabel: $('tut-step-label'), dots: $('tut-dots'), text: $('tut-text'), feedback: $('tut-feedback'), status: $('tut-status'),
    pair: $('tut-pair'), board: $('tut-board'), next: $('btn-tut-next'), hint: $('btn-tut-hint'), final: $('tut-final'),
    play: $('btn-tut-play'), finish: $('btn-tut-finish'), skip: $('btn-tut-skip'),
  },
  sound,
  createBoard,
  numerals: () => numeralsOn(),
  onFinish: () => { store.set('tutorialDone', true); show(tutorialFrom === 'play' && session && !session.over ? 'play' : 'title'); },
  onPlay: () => { store.set('tutorialDone', true); show(tutorialFrom === 'play' && session && !session.over ? 'play' : 'levels'); },
});
function startTutorial(from) {
  tutorialFrom = from;
  show('tutorial');
  tutorial.start();
}

/* ---------- rules card ---------- */
const GOALS = {
  2: 'Plant seeds until the frame is full. Then the two parts make 10.',
  3: 'Plant the number of seeds you see. The rest fill in by themselves.',
  4: 'Fill both frames so the two parts make 20.',
};
function openRules() {
  if (session && session.level === 1) {
    startTutorial('play');
    return;
  }
  const level = session ? session.level : settings.level;
  $('rules-goal').textContent = GOALS[level === 1 ? 2 : level];
  $('rules-two').hidden = level !== 3;
  openDialog($('dlg-rules'));
}

/* ---------- settings, gate, grown-ups ---------- */
function openSettings() {
  $('set-sound').checked = settings.sound;
  $('set-motion').checked = settings.reduceMotion;
  openDialog($('dlg-settings'));
}

let gateAnswer = 0;
function openGate() {
  const a = 12 + Math.floor(Math.random() * 16);
  const b = 11 + Math.floor(Math.random() * 18);
  gateAnswer = a + b;
  $('gate-question').textContent = `To continue, what is ${a} + ${b}?`;
  $('gate-answer').value = '';
  $('gate-msg').textContent = '';
  closeDialog($('dlg-settings'));
  openDialog($('dlg-gate'));
  $('gate-answer').focus();
}

async function resetAll() {
  const ok = await confirmDialog({
    title: 'Reset everything?',
    message: 'This clears your garden, pairs and badges on this device.',
    confirmText: 'Reset',
    danger: true,
  });
  if (!ok) return;
  ['stats', 'progress', 'saved'].forEach((k) => store.remove(k));
  session = null;
  closeDialog($('dlg-settings'));
  show('title');
  toast($('toast'), 'Cleared.');
}

/* ---------- wiring ---------- */
function wire() {
  $('btn-play').addEventListener('click', () => {
    sound.unlock();
    sound.play('tap');
    if (!store.get('tutorialDone')) startTutorial('title');
    else show('levels');
  });
  $('btn-continue').addEventListener('click', () => {
    sound.unlock();
    if (!resumeGarden()) show('levels');
  });
  $('btn-howto').addEventListener('click', () => { sound.unlock(); startTutorial('title'); });
  $('btn-sound').addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveSettings();
    applySettings();
    sound.unlock();
    sound.play('tap');
  });
  $('btn-settings').addEventListener('click', openSettings);

  document.querySelectorAll('.level').forEach((b) => b.addEventListener('click', () => {
    settings.level = Number(b.dataset.level);
    saveSettings();
    markLevel();
    sound.unlock();
    sound.play('pick');
  }));
  $('btn-start-garden').addEventListener('click', () => { sound.unlock(); startGarden(settings.level); });
  $('btn-levels-back').addEventListener('click', () => show('title'));

  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', hint);
  $('btn-next').addEventListener('click', nextFrame);
  $('btn-rules').addEventListener('click', openRules);
  $('btn-menu').addEventListener('click', () => openDialog($('dlg-menu')));
  $('board').addEventListener('keydown', (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      undo();
    }
  });

  $('menu-close').addEventListener('click', () => closeDialog($('dlg-menu')));
  $('menu-howto').addEventListener('click', () => { closeDialog($('dlg-menu')); startTutorial('play'); });
  $('menu-settings').addEventListener('click', () => { closeDialog($('dlg-menu')); openSettings(); });
  $('menu-levels').addEventListener('click', () => { closeDialog($('dlg-menu')); show('levels'); });
  $('rules-close').addEventListener('click', () => closeDialog($('dlg-rules')));

  $('set-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); applySettings(); });
  $('set-motion').addEventListener('change', (e) => { settings.reduceMotion = e.target.checked; saveSettings(); applySettings(); });
  $('set-grownups').addEventListener('click', openGate);
  $('set-reset').addEventListener('click', resetAll);
  $('settings-close').addEventListener('click', () => closeDialog($('dlg-settings')));

  $('gate-cancel').addEventListener('click', () => closeDialog($('dlg-gate')));
  $('gate-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (Number($('gate-answer').value) === gateAnswer) {
      closeDialog($('dlg-gate'));
      openDialog($('dlg-grownups'));
    } else {
      $('gate-msg').textContent = 'Not quite. Ask a grown-up to help.';
      $('gate-answer').select();
    }
  });
  $('grownups-close').addEventListener('click', () => closeDialog($('dlg-grownups')));

  $('btn-again').addEventListener('click', () => closeResult(() => startGarden(settings.level)));
  $('btn-result-levels').addEventListener('click', () => closeResult(() => show('levels')));
  $('btn-result-howto').addEventListener('click', () => closeResult(() => startTutorial('title')));
}

applySettings();
wire();
show('title');
registerServiceWorker();
