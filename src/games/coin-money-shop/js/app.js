// Coin and Money Shop app: screens, a day of 8 customers, hint/undo, stats, badges, save and continue.
// The rules live in engine.js; drawing a sale lives in shop.js; the tutorial lives in tutorial.js.

import {
  LEVELS, DAY_SIZE, isLevel, createSale, makeDay, mulberry32, nextStreak, normalizeStats, recordSale, recordDay,
  newBadges, earnedBadges, badgeName, summarizeDay, restoreDay,
} from './engine.js';
import { createShop, money } from './shop.js';
import { createTutorial } from './tutorial.js';
import { createStore, readProgress, writeProgress, todayString } from '../../../shared/storage.js';
import { createSound } from '../../../shared/sound.js';
import { openDialog, closeDialog, confirmDialog, toast } from '../../../shared/dialog.js';
import { registerServiceWorker } from '../../../shared/pwa.js';

const GAME_ID = 'coin-money-shop';
const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);

/* ---------- settings ---------- */
const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = Object.assign({ sound: true, reduceMotion: prefersReduced, level: 1 }, store.get('settings', {}));
if (!isLevel(settings.level)) settings.level = 1;
const saveSettings = () => store.set('settings', settings);

const sound = createSound({ muted: !settings.sound });
function applySettings() {
  sound.setMuted(!settings.sound);
  document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  $('btn-sound').textContent = `Sound: ${settings.sound ? 'on' : 'off'}`;
  $('btn-sound').setAttribute('aria-pressed', String(settings.sound));
}

const readStats = () => normalizeStats(store.get('stats'));
const writeStats = (stats) => store.set('stats', stats);

/* ---------- screens ---------- */
const screens = ['title', 'levels', 'play', 'tutorial'];
let current = 'title';
function show(name) {
  current = name;
  for (const s of screens) $(`screen-${s}`).hidden = s !== name;
  window.scrollTo(0, 0);
  if (name === 'title') $('btn-continue').hidden = !validSaved();
  if (name === 'levels') markLevel();
}
const announce = (text) => { $('live').textContent = ''; setTimeout(() => { $('live').textContent = text; }, 30); };

/* ---------- a day at the shop ---------- */
// session: { level, day, index, records, streak, pendingResult, over }
let session = null;
const shop = createShop($('shop'), {
  sound, announce,
  onChange: () => saveGame(),
  onSettled: handleSettled,
  onNext: handleNext,
});

function validSaved() {
  return restoreDay(store.get('saved')) !== null;
}

function saveGame() {
  if (!session || session.over || !shop.sale || shop.sale.settled) return;
  store.set('saved', {
    level: session.level, day: session.day, index: session.index, pieces: shop.sale.pieces, hints: shop.sale.hints,
    streak: session.streak, records: session.records,
  });
}

// After a sale is done, remember the next customer (or clear the save at the end of the day).
function saveBetween() {
  if (!session || session.over) return store.remove('saved');
  store.set('saved', {
    level: session.level, day: session.day, index: session.index, pieces: [], hints: 0,
    streak: session.streak, records: session.records,
  });
}

function loadCustomer(restoredSale = null) {
  const c = session.day[session.index];
  const sale = restoredSale || createSale(session.level, c);
  shop.load(sale, {
    jarDone: session.index,
    nextLabel: session.index === DAY_SIZE - 1 ? 'See my day' : 'Next customer',
  });
  $('play-title').textContent = LEVELS[session.level].name;
  announce(`Customer ${session.index + 1} of ${DAY_SIZE}. ${sale.level === 3 ? `Price ${sale.price} rupees. The customer gave you ${sale.given} rupees.` : `Price ${sale.price} rupees.`}`);
  shop.focusFirst();
}

function startDay(level, resume = null) {
  settings.level = level;
  saveSettings();
  if (resume) {
    session = { level, day: resume.day, index: resume.index, records: resume.records, streak: resume.streak, pendingResult: null, over: false };
    show('play');
    loadCustomer(resume.sale);
    return;
  }
  const seed = (Date.now() ^ Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000)) >>> 0;
  session = { level, day: makeDay(level, mulberry32(seed)), index: 0, records: [], streak: 0, pendingResult: null, over: false };
  const progress = readProgress(GAME_ID);
  progress.played += 1;
  progress.lastPlayed = todayString();
  writeProgress(progress);
  saveBetween();
  show('play');
  loadCustomer();
}

function handleSettled(res, sale) {
  const level = session.level;
  session.streak = nextStreak(session.streak, res.kind);
  session.records.push({
    price: sale.price, kind: res.kind, hints: sale.hints, pieces: [...sale.pieces], paid: res.paid, change: res.change,
  });
  let stats = recordSale(readStats(), level, { kind: res.kind, streak: session.streak });
  const lastCustomer = session.index === DAY_SIZE - 1;
  const progress = readProgress(GAME_ID);
  progress.lastPlayed = todayString();
  if (lastCustomer) {
    stats = recordDay(stats, level);
    progress.won += 1;
    session.over = true;
    session.pendingResult = summarizeDay(session.records, level);
  }
  const fresh = newBadges(progress.badges, stats);
  if (fresh.length) {
    progress.badges = earnedBadges(stats);
    if (session.pendingResult) session.pendingResult.newBadges = fresh;
    else toast($('toast'), `Badge: ${fresh.map(badgeName).join(', ')}`);
  }
  writeStats(stats);
  writeProgress(progress);
  if (res.kind === 'exact' && session.streak >= 3) announce(`${session.streak} exact sales in a row!`);
  if (lastCustomer) saveBetween();
  else {
    session.index += 1;
    saveBetween();
    session.index -= 1; // the screen still shows this customer until Next is pressed
  }
}

function handleNext() {
  if (!session) return;
  if (session.over) return showResult();
  session.index += 1;
  loadCustomer();
}

function showResult() {
  const sum = session.pendingResult;
  $('result-title').textContent = `You served ${sum.customers} customers`;
  const facts = $('result-facts');
  facts.replaceChildren();
  const add = (text) => { const li = document.createElement('li'); li.textContent = text; facts.append(li); };
  add(sum.exact === sum.customers ? 'Everyone paid exactly. Perfect!' : `${sum.exact} of ${sum.customers} paid exactly.`);
  if (sum.biggest) add(`Biggest sale: ${money(sum.biggest.price)}, using ${sum.biggest.pieces} ${sum.biggest.pieces === 1 ? 'piece' : 'pieces'}.`);
  if (session.level === 3) add(`You gave change ${sum.changeGiven} times.`);
  for (const o of sum.overs.slice(0, 2)) add(`You paid ${money(o.paid)} for ${money(o.price)}. Change ${money(o.change)}.`);
  const badgeList = $('result-badges');
  badgeList.replaceChildren();
  for (const id of sum.newBadges || []) { const li = document.createElement('li'); li.textContent = `New badge: ${badgeName(id)}`; badgeList.append(li); }
  sound.play('win');
  openDialog($('dlg-result'));
  announce($('result-title').textContent);
}

/* ---------- level picker ---------- */
let pickedLevel = settings.level;
function markLevel() {
  pickedLevel = settings.level;
  for (const b of document.querySelectorAll('.level')) b.setAttribute('aria-pressed', String(Number(b.dataset.level) === pickedLevel));
}
for (const b of document.querySelectorAll('.level')) {
  b.addEventListener('click', () => {
    sound.unlock();
    sound.play('tap');
    pickedLevel = Number(b.dataset.level);
    for (const o of document.querySelectorAll('.level')) o.setAttribute('aria-pressed', String(o === b));
  });
}
function openShop(level) {
  if (level === 3 && !store.get('changeIntroSeen', false)) {
    store.set('changeIntroSeen', true);
    openDialog($('dlg-change-intro'));
    $('ci-close').onclick = () => { closeDialog($('dlg-change-intro')); startDay(level); };
    return;
  }
  startDay(level);
}
$('btn-start-day').addEventListener('click', () => { sound.unlock(); sound.play('tap'); openShop(pickedLevel); });
$('btn-levels-back').addEventListener('click', () => show('title'));

/* ---------- tutorial ---------- */
let tutorialReturn = 'title';
const tutorial = createTutorial({
  sound, announce,
  ui: {
    shop: $('tut-shop'), next: $('btn-tut-next'), skip: $('btn-tut-skip'), play: $('btn-tut-play'), finish: $('btn-tut-finish'),
    final: $('tut-final'), text: $('tut-text'), feedback: $('tut-feedback'), stepLabel: $('tut-step-label'), dots: $('tut-dots'),
  },
  onFinish: () => { store.set('tutorialDone', true); show(tutorialReturn === 'play' && session ? 'play' : tutorialReturn === 'play' ? 'title' : 'title'); },
  onPlay: () => { store.set('tutorialDone', true); show('levels'); },
});
function openTutorial(returnTo) {
  tutorialReturn = returnTo;
  show('tutorial');
  tutorial.start();
}

/* ---------- title and menu ---------- */
$('btn-play').addEventListener('click', () => {
  sound.unlock();
  sound.play('tap');
  if (!store.get('tutorialDone', false)) openTutorial('levels');
  else show('levels');
});
$('btn-continue').addEventListener('click', () => {
  sound.unlock();
  const saved = restoreDay(store.get('saved'));
  if (saved) startDay(saved.level, saved);
});
$('btn-howto').addEventListener('click', () => { sound.unlock(); sound.play('tap'); openTutorial('title'); });
$('btn-sound').addEventListener('click', () => { settings.sound = !settings.sound; saveSettings(); applySettings(); if (settings.sound) sound.play('tap'); });
$('btn-settings').addEventListener('click', () => openSettings());

$('btn-menu').addEventListener('click', () => openDialog($('dlg-menu')));
$('menu-close').addEventListener('click', () => closeDialog($('dlg-menu')));
$('menu-howto').addEventListener('click', () => { closeDialog($('dlg-menu')); openTutorial('play'); });
$('menu-settings').addEventListener('click', () => { closeDialog($('dlg-menu')); openSettings(); });
$('menu-levels').addEventListener('click', () => { closeDialog($('dlg-menu')); show('levels'); });

/* ---------- rules ---------- */
const RULES = {
  1: { goal: 'Pay the exact price using coins.', turn: 'Tap coins to put them in the till. When the total matches the price, press Pay.', over: 'Paying too much is allowed: Gilu hands back change. But paying exactly is best!' },
  2: { goal: 'Pay the exact price using coins and notes.', turn: 'Tap coins and notes to put them in the till. When the total matches the price, press Pay.', over: 'Paying too much is allowed: Gilu hands back change. But paying exactly is best!' },
  3: { goal: 'Give back the right change.', turn: 'The customer hands you a note. Work out the difference, tap coins and notes for the change, then press Give change.', over: 'Giving too much change is not allowed. Tap a piece to take it out.' },
};
function openRules() {
  const r = RULES[session ? session.level : settings.level];
  $('rules-goal').textContent = r.goal;
  $('rules-turn').textContent = r.turn;
  $('rules-over').textContent = r.over;
  openDialog($('dlg-rules'));
}
$('btn-rules').addEventListener('click', openRules);
$('rules-close').addEventListener('click', () => closeDialog($('dlg-rules')));

/* ---------- settings, gate, grown-ups, reset ---------- */
function openSettings() {
  $('set-sound').checked = settings.sound;
  $('set-motion').checked = settings.reduceMotion;
  openDialog($('dlg-settings'));
}
$('set-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); applySettings(); });
$('set-motion').addEventListener('change', (e) => { settings.reduceMotion = e.target.checked; saveSettings(); applySettings(); });
$('settings-close').addEventListener('click', () => closeDialog($('dlg-settings')));

let gateAnswer = 0;
function openGate() {
  const a = 10 + Math.floor(Math.random() * 30);
  const b = 10 + Math.floor(Math.random() * 30);
  gateAnswer = a + b;
  $('gate-question').textContent = `To continue, what is ${a} + ${b}?`;
  $('gate-answer').value = '';
  $('gate-msg').textContent = '';
  openDialog($('dlg-gate'));
  $('gate-answer').focus();
}
$('set-grownups').addEventListener('click', () => { closeDialog($('dlg-settings')); openGate(); });
$('gate-cancel').addEventListener('click', () => closeDialog($('dlg-gate')));
$('gate-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (Number($('gate-answer').value) === gateAnswer) {
    closeDialog($('dlg-gate'));
    openDialog($('dlg-grownups'));
  } else {
    $('gate-msg').textContent = 'Not quite. Try again, or Cancel.';
    $('gate-answer').select();
  }
});
$('grownups-close').addEventListener('click', () => closeDialog($('dlg-grownups')));

$('set-reset').addEventListener('click', async () => {
  closeDialog($('dlg-settings'));
  const ok = await confirmDialog({
    title: 'Reset the shop?', message: 'This clears your saved day, badges and stats on this device. It cannot be undone.',
    confirmText: 'Reset', danger: true,
  });
  if (!ok) return openSettings();
  for (const name of ['stats', 'progress', 'saved', 'tutorialDone', 'changeIntroSeen']) store.remove(name);
  session = null;
  show('title');
  toast($('toast'), 'Shop reset.');
});

/* ---------- result dialog ---------- */
$('btn-again').addEventListener('click', () => { closeDialog($('dlg-result')); openShop(session ? session.level : settings.level); });
$('btn-result-levels').addEventListener('click', () => { closeDialog($('dlg-result')); show('levels'); });
$('btn-result-howto').addEventListener('click', () => { closeDialog($('dlg-result')); openTutorial('title'); });

/* ---------- start ---------- */
applySettings();
show('title');
registerServiceWorker();
