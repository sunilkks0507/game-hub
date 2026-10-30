// Pallanguzhi app: screens, game session, bot, saved game, progress. Rules live in engine.js.

import { newGame, legalPits, applyMove, cloneState, status, resign } from './engine.js';
import { chooseMove } from './ai.js';
import { animate } from './animate.js';
import { createBoard } from './board.js';
import { createTutorial } from './tutorial.js';
import { createStore, readProgress, writeProgress, todayString } from '../../../shared/storage.js';
import { createSound } from '../../../shared/sound.js';
import { openDialog, closeDialog, confirmDialog, toast } from '../../../shared/dialog.js';
import { registerServiceWorker } from '../../../shared/pwa.js';

const GAME_ID = 'pallanguzhi';
const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);

const BADGES = {
  first_win: 'First win',
  win_hard: 'Beat the Hard bot',
  first_capture: 'First capture',
  big_haul: 'Big haul: 10 or more seeds in one capture',
  won_by_20: 'Won by 20 seeds or more',
};

/* ---------- settings and stats ---------- */
const settings = Object.assign({ sound: true, reduceMotion: false, level: 'medium' }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);
const emptyStats = () => ({ easy: { p: 0, w: 0 }, medium: { p: 0, w: 0 }, hard: { p: 0, w: 0 }, bestCapture: 0 });
const readStats = () => Object.assign(emptyStats(), store.get('stats', {}));

const sound = createSound({ muted: !settings.sound });
function applySettings() {
  sound.setMuted(!settings.sound);
  document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  $('btn-sound').textContent = `Sound: ${settings.sound ? 'on' : 'off'}`;
  $('btn-sound').setAttribute('aria-pressed', String(settings.sound));
}

/* ---------- screens ---------- */
const screens = ['title', 'setup', 'play', 'tutorial'];
function show(name) {
  for (const s of screens) $(`screen-${s}`).hidden = s !== name;
  window.scrollTo(0, 0);
  if (name === 'title') updateContinue();
}
function updateContinue() {
  $('btn-continue').hidden = !store.get('saved');
}

/* ---------- bot (Worker with an inline fallback) ---------- */
let botId = 0;
let worker = null;
let workerBroken = false;
const pending = new Map();

function getWorker() {
  if (worker || workerBroken || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const done = pending.get(event.data.id);
      if (done) {
        pending.delete(event.data.id);
        done(event.data.move === null || event.data.move === undefined ? null : event.data.move);
      }
    };
    worker.onerror = () => {
      workerBroken = true;
      worker = null;
      for (const [id, done] of pending) {
        pending.delete(id);
        done(undefined); // undefined: the caller falls back to the inline bot
      }
    };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

function askBot(state, level, timeMs) {
  const id = ++botId;
  const inline = () => new Promise((resolve) => setTimeout(() => resolve(chooseMove(state, { level, timeMs })), 30));
  const w = getWorker();
  if (!w) return inline().then((move) => ({ id, move }));
  return new Promise((resolve) => {
    pending.set(id, (move) => {
      if (move === undefined) inline().then((m) => resolve({ id, move: m }));
      else resolve({ id, move });
    });
    w.postMessage({ id, state, level, timeMs });
  });
}

/* ---------- session ---------- */
// session: { state, mode, level, first, moves, over, thinking, animating, skip, view, info,
//            hint, note, last, caps, best }
let session = null;
const board = createBoard($('board'), { onTap: handleTap });

const namesFor = (s) => (s.mode === 'two' ? ['Player 1', 'Player 2'] : ['You', 'Computer']);
const rowsFor = (s) => (s.mode === 'two' ? ['Player 1 row', 'Player 2 row'] : ['Your row', "Computer's row"]);
const humanTurn = () => session.mode === 'two' || session.state.turn === 0;

// Replay a list of pits from the start. Also counts captures for the badges.
function rebuild(moves, first) {
  const state = newGame({ first });
  const applied = [];
  const caps = [0, 0];
  const best = [0, 0];
  for (const pit of moves) {
    const mover = state.turn;
    const r = applyMove(state, pit);
    if (!r) break;
    applied.push(pit);
    if (r.captured) {
      caps[mover] += 1;
      best[mover] = Math.max(best[mover], r.captured);
    }
  }
  return { state, applied, caps, best };
}

function blankSession(base) {
  return Object.assign(
    { over: false, thinking: false, animating: false, skip: false, view: null, info: null, hint: null, note: '', last: null },
    base,
  );
}

function saveGame() {
  if (!session || session.over) return store.remove('saved');
  store.set('saved', { mode: session.mode, level: session.level, first: session.first, moves: session.moves });
}

function startGame({ mode, level, first }) {
  botId++;
  session = blankSession({
    state: newGame({ first: mode === 'cpu' ? first : 0 }),
    mode, level, first: mode === 'cpu' ? first : 0, moves: [], caps: [0, 0], best: [0, 0],
  });
  store.remove('saved');
  show('play');
  render();
  maybeBotMove();
  $('btn-undo').focus();
}

function resumeGame() {
  const saved = store.get('saved');
  if (!saved || !Array.isArray(saved.moves)) return false;
  const first = saved.first === 1 ? 1 : 0;
  const { state, applied, caps, best } = rebuild(saved.moves, first);
  if (state.over) {
    store.remove('saved');
    return false;
  }
  session = blankSession({
    state, mode: saved.mode === 'two' ? 'two' : 'cpu', level: saved.level || 'medium', first, moves: applied, caps, best,
  });
  botId++;
  show('play');
  render();
  maybeBotMove();
  return true;
}

function turnText(s) {
  if (s.mode === 'two') return `${namesFor(s)[s.state.turn]}'s turn.${s.moves.length ? ' Pass the phone!' : ''}`;
  return 'Your turn: tap one of your pits.';
}

function render() {
  const s = session;
  const names = namesFor(s);
  const busy = s.over || s.thinking || s.animating;
  const enabled = !busy && humanTurn() ? new Set(legalPits(s.state)) : new Set();
  const view = s.view || { pits: s.state.pits, stores: s.state.stores, hand: 0 };
  board.render(view, {
    enabled,
    active: s.info ? s.info.active : undefined,
    kind: s.info ? s.info.kind : undefined,
    hint: s.hint,
    last: !s.animating && s.moves.length ? s.moves[s.moves.length - 1] : undefined,
    rows: rowsFor(s),
  });

  // piles
  const top = $('pile-top');
  const bottom = $('pile-bottom');
  top.querySelector('.pile-name').textContent = `${names[1]}'s pile`;
  bottom.querySelector('.pile-name').textContent = s.mode === 'two' ? `${names[0]}'s pile` : 'Your pile';
  top.querySelector('.pile-count').textContent = String(view.stores[1]);
  bottom.querySelector('.pile-count').textContent = String(view.stores[0]);
  const turn = s.animating ? s.mover : s.state.turn; // the engine has already moved on while animating
  top.classList.toggle('turn', !s.over && turn === 1);
  bottom.classList.toggle('turn', !s.over && turn === 0);
  const gaining = Boolean(s.info && s.info.kind === 'capture');
  top.classList.toggle('gain', gaining && s.mover === 1);
  bottom.classList.toggle('gain', gaining && s.mover === 0);

  // status line (live region) and a quiet line for the running count
  const el = $('status');
  if (s.over) el.textContent = 'Game over';
  else if (s.animating) el.textContent = 'Sowing…';
  else if (s.thinking) el.textContent = 'The computer is thinking…';
  else el.textContent = `${s.note ? s.note + ' ' : ''}${turnText(s)}`;

  const lm = $('last-move');
  if (s.animating) lm.textContent = view.hand > 0 ? `Seeds in hand: ${view.hand}  (tap to speed up)` : 'Tap to speed up';
  else if (s.last) {
    const who = names[s.last.mover];
    lm.textContent = `Last move: ${who} sowed ${s.last.n} ${s.last.n === 1 ? 'seed' : 'seeds'}${s.last.captured ? ` and captured ${s.last.captured}` : ''}.`;
  } else lm.textContent = '';

  $('btn-undo').disabled = s.moves.length === 0 || s.animating;
  $('btn-hint').hidden = s.mode === 'two';
  $('btn-hint').disabled = busy || !humanTurn();
}

function handleTap(pit) {
  const s = session;
  if (!s || s.over) return;
  sound.unlock();
  if (s.animating) {
    s.skip = true;
    return;
  }
  if (s.thinking || !humanTurn()) return;
  playPit(pit);
}

async function playPit(pit) {
  const s = session;
  if (!s || s.over || s.animating) return;
  const mover = s.state.turn;
  const start = { pits: s.state.pits.slice(), stores: s.state.stores.slice() };
  const seeds = start.pits[pit];
  const result = applyMove(s.state, pit, { record: true });
  if (!result) {
    sound.play('error');
    return;
  }
  s.moves.push(pit);
  s.hint = null;
  s.mover = mover;
  s.animating = true;
  s.skip = settings.reduceMotion || document.documentElement.classList.contains('reduce-motion');
  s.view = null;
  s.info = null;
  s.note = '';
  render();

  const finished = await animate({
    start,
    events: result.events,
    mover,
    sound,
    isSkipped: () => s.skip,
    isCancelled: () => session !== s,
    render: (view, info) => {
      s.view = view;
      s.info = info;
      render();
    },
  });
  if (!finished || session !== s) return;

  s.animating = false;
  s.view = null;
  s.info = null;
  if (result.captured) {
    s.caps[mover] += 1;
    s.best[mover] = Math.max(s.best[mover], result.captured);
  }
  s.last = { mover, n: seeds, captured: result.captured };
  const names = namesFor(s);
  s.note = result.captured ? `${names[mover]} captured ${result.captured}.` : '';

  if (s.state.over) {
    s.over = true;
    store.remove('saved');
    render();
    finishGame();
    return;
  }
  saveGame();
  render();
  maybeBotMove();
}

async function maybeBotMove() {
  const s = session;
  if (!s || s.over || s.animating || s.mode !== 'cpu' || s.state.turn === 0) return;
  s.thinking = true;
  render();
  const stamp = ++botId;
  const started = performance.now();
  const timeMs = s.level === 'hard' ? 1500 : 500;
  const reply = await askBot(cloneState(s.state), s.level, timeMs);
  // Ignore stale answers (new game, undo, or leaving while the bot was thinking).
  if (session !== s || s.over || botId < stamp || !s.thinking) return;
  await new Promise((r) => setTimeout(r, Math.max(0, 450 - (performance.now() - started))));
  if (session !== s || s.over || !s.thinking) return;
  s.thinking = false;
  const legal = legalPits(s.state);
  const move = legal.includes(reply.move) ? reply.move : legal[0]; // never get stuck
  if (move === undefined) return render();
  playPit(move);
}

/* ---------- undo and hint ---------- */
function undoMove() {
  const s = session;
  if (!s || s.moves.length === 0 || s.animating) return;
  botId++;
  s.thinking = false;
  const kept = s.moves.slice();
  do {
    kept.pop();
    const probe = rebuild(kept, s.first);
    if (s.mode === 'two' || probe.state.turn === 0 || kept.length === 0) break;
  } while (kept.length);
  const { state, applied, caps, best } = rebuild(kept, s.first);
  s.state = state;
  s.moves = applied;
  s.caps = caps;
  s.best = best;
  s.over = false;
  s.hint = null;
  s.note = '';
  s.last = null;
  saveGame();
  render();
  maybeBotMove();
}

async function giveHint() {
  const s = session;
  if (!s || s.over || s.thinking || s.animating || !humanTurn()) return;
  sound.unlock();
  $('btn-hint').disabled = true;
  const reply = await askBot(cloneState(s.state), 'medium', 400);
  if (session !== s || s.over) return;
  if (reply.move !== null && reply.move !== undefined) {
    s.hint = reply.move;
    sound.play('hint');
    toast($('toast'), 'Try the glowing pit.');
  }
  render();
}

/* ---------- results, stats, badges ---------- */
function whyText(s, st) {
  const names = namesFor(s);
  const [a, b] = st.scores;
  const score = `${names[0]} ${a}, ${names[1]} ${b}.`;
  if (st.reason === 'resign') return `${names[st.loser]} gave up the game.`;
  if (st.reason === 'stall') {
    return `Nobody captured for 60 turns, so the game ended and each player kept the seeds on their own row. Final piles: ${score}`;
  }
  const stuck = s.state.turn; // the player who had no seeds left to sow
  const who = s.mode === 'two' ? names[stuck] : stuck === 0 ? 'You' : 'The computer';
  const keeper = s.mode === 'two' ? names[1 - stuck] : stuck === 0 ? 'the computer' : 'you';
  const verb = s.mode === 'cpu' && stuck === 0 ? 'have' : 'has';
  return `${who} ${verb} no seeds left to sow, so the game ended. The seeds still on their row went to ${keeper}. Final piles: ${score}`;
}

function finishGame() {
  const s = session;
  const st = status(s.state);
  const names = namesFor(s);
  const earned = [];
  let title;
  let line = '';

  if (s.mode === 'cpu') {
    const won = st.result === 0;
    const draw = st.result === 'draw';
    title = won ? 'You won!' : draw ? 'A draw' : 'Good game, you lost this one';
    sound.play(won ? 'win' : draw ? 'draw' : 'lose');

    const stats = readStats();
    stats[s.level].p += 1;
    if (won) stats[s.level].w += 1;
    stats.bestCapture = Math.max(stats.bestCapture || 0, s.best[0]);
    store.set('stats', stats);

    const progress = readProgress(GAME_ID);
    progress.played += 1;
    if (won) progress.won += 1;
    progress.lastPlayed = todayString();
    const award = (id) => {
      if (!progress.badges.includes(id)) {
        progress.badges.push(id);
        earned.push(BADGES[id]);
      }
    };
    if (s.caps[0] > 0) award('first_capture');
    if (s.best[0] >= 10) award('big_haul');
    if (won) {
      award('first_win');
      if (s.level === 'hard') award('win_hard');
      if (st.scores[0] - st.scores[1] >= 20) award('won_by_20');
    }
    writeProgress(progress);
    line = `Your games on ${s.level}: ${stats[s.level].w} won of ${stats[s.level].p} played. Biggest capture: ${stats.bestCapture}.`;
  } else {
    title = st.result === 'draw' ? 'A draw' : `${names[st.result]} wins!`;
    sound.play(st.result === 'draw' ? 'draw' : 'win');
    const progress = readProgress(GAME_ID);
    progress.played += 1;
    progress.lastPlayed = todayString();
    writeProgress(progress);
  }

  $('result-title').textContent = title;
  $('result-score').textContent = `${names[0]}: ${st.scores[0]}   ${names[1]}: ${st.scores[1]}`;
  $('result-why').textContent = whyText(s, st);
  $('result-stats').textContent = line;
  $('result-badges').replaceChildren(
    ...earned.map((name) => {
      const li = document.createElement('li');
      li.textContent = `New badge: ${name}`;
      return li;
    }),
  );
  setTimeout(() => openDialog($('dlg-result')), 450);
}

/* ---------- tutorial ---------- */
const tutorial = createTutorial({
  ui: {
    board: $('tut-board'), feedback: $('tut-feedback'), stepLabel: $('tut-step-label'), dots: $('tut-dots'),
    text: $('tut-text'), taskCount: $('tut-count'), next: $('btn-tut-next'), skip: $('btn-tut-skip'),
    practice: $('tut-practice'), practiceButton: $('btn-tut-practice'), finishButton: $('btn-tut-finish'),
    pile: $('tut-pile'),
  },
  sound,
  createBoard,
  onFinish() {
    store.set('tutorialDone', true);
    show('title');
  },
  onPractice() {
    store.set('tutorialDone', true);
    startGame({ mode: 'cpu', level: 'easy', first: 0 });
  },
});

function openTutorial() {
  show('tutorial');
  tutorial.start();
}

/* ---------- grown-up gate ---------- */
let gateAnswer = 0;
function openGate() {
  const a = 11 + Math.floor(Math.random() * 9);
  const b = 12 + Math.floor(Math.random() * 18);
  gateAnswer = a + b;
  $('gate-question').textContent = `To continue, type the answer: ${a} + ${b}`;
  $('gate-answer').value = '';
  $('gate-msg').textContent = '';
  openDialog($('dlg-gate'));
  $('gate-answer').focus();
}
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
$('gate-cancel').addEventListener('click', () => closeDialog($('dlg-gate')));
$('grownups-close').addEventListener('click', () => closeDialog($('dlg-grownups')));

/* ---------- wiring ---------- */
$('btn-play').addEventListener('click', () => {
  sound.unlock();
  if (!store.get('tutorialDone')) return openTutorial();
  openSetup();
});
$('btn-continue').addEventListener('click', () => {
  sound.unlock();
  if (!resumeGame()) updateContinue();
});
$('btn-howto').addEventListener('click', () => {
  sound.unlock();
  openTutorial();
});
$('btn-sound').addEventListener('click', () => {
  settings.sound = !settings.sound;
  saveSettings();
  applySettings();
  sound.unlock();
  sound.play('tap');
});
$('btn-settings').addEventListener('click', openSettings);

function openSetup() {
  const form = $('setup-form');
  form.elements.level.value = settings.level;
  syncSetup();
  show('setup');
  form.querySelector('input:checked').focus();
}
function syncSetup() {
  const two = $('setup-form').elements.mode.value === 'two';
  $('fs-level').hidden = two;
  $('fs-first').hidden = two;
}
$('setup-form').addEventListener('change', syncSetup);
$('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const f = $('setup-form').elements;
  settings.level = f.level.value;
  saveSettings();
  startGame({ mode: f.mode.value, level: f.level.value, first: Number(f.first.value) });
});
$('btn-setup-back').addEventListener('click', () => show('title'));

$('btn-menu').addEventListener('click', () => openDialog($('dlg-menu')));
$('menu-close').addEventListener('click', () => closeDialog($('dlg-menu')));
$('btn-rules').addEventListener('click', () => openDialog($('dlg-rules')));
$('rules-close').addEventListener('click', () => closeDialog($('dlg-rules')));
$('menu-howto').addEventListener('click', () => {
  closeDialog($('dlg-menu'));
  openTutorial();
});
$('menu-settings').addEventListener('click', () => {
  closeDialog($('dlg-menu'));
  openSettings();
});
$('menu-new').addEventListener('click', () => {
  closeDialog($('dlg-menu'));
  botId++;
  openSetup();
});
$('menu-resign').addEventListener('click', async () => {
  closeDialog($('dlg-menu'));
  const s = session;
  if (!s || s.over) return;
  const ok = await confirmDialog({
    title: 'Give up?', message: 'You will lose this game. Are you sure?', confirmText: 'Give up', cancelText: 'Keep playing', danger: true,
  });
  if (!ok || session !== s || s.over) return;
  botId++;
  s.thinking = false;
  s.animating = false;
  s.view = null;
  s.info = null;
  resign(s.state, s.mode === 'cpu' ? 0 : s.state.turn);
  s.over = true;
  store.remove('saved');
  render();
  finishGame();
});
$('btn-undo').addEventListener('click', undoMove);
$('btn-hint').addEventListener('click', giveHint);

$('btn-again').addEventListener('click', () => {
  closeDialog($('dlg-result'));
  if (session) startGame({ mode: session.mode, level: session.level, first: session.first });
});
$('btn-result-howto').addEventListener('click', () => {
  closeDialog($('dlg-result'));
  openTutorial();
});

function openSettings() {
  $('set-sound').checked = settings.sound;
  $('set-motion').checked = settings.reduceMotion;
  $('set-level').value = settings.level;
  openDialog($('dlg-settings'));
}
$('set-sound').addEventListener('change', (e) => {
  settings.sound = e.target.checked;
  saveSettings();
  applySettings();
});
$('set-motion').addEventListener('change', (e) => {
  settings.reduceMotion = e.target.checked;
  saveSettings();
  applySettings();
});
$('set-level').addEventListener('change', (e) => {
  settings.level = e.target.value;
  saveSettings();
});
$('settings-close').addEventListener('click', () => closeDialog($('dlg-settings')));
$('set-grownups').addEventListener('click', () => {
  closeDialog($('dlg-settings'));
  openGate();
});
$('set-reset').addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Reset scores and badges?', message: 'This clears your wins and badges on this device. It cannot be undone.',
    confirmText: 'Reset', cancelText: 'Keep them', danger: true,
  });
  if (!ok) return;
  store.remove('stats');
  store.remove('progress');
  toast($('toast'), 'Scores and badges cleared.');
});

if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('reduce-motion');
}
applySettings();
show('title');
registerServiceWorker();

// Used by browser tests to inspect the running game.
window.__pallanguzhi = {
  get session() { return session; },
};
