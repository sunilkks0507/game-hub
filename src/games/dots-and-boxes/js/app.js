// Dots and Boxes app: screens, game session, bot, saved game, progress. Rules live in engine.js.

import {
  newGame, legalMoves, moveKind, applyMove, cloneState, status, replay, summary,
} from './engine.js';
import { chooseMove, hintMove } from './ai.js';
import { createBoard } from './board.js';
import { createTutorial } from './tutorial.js';
import { createStore, readProgress, writeProgress, todayString } from '../../../shared/storage.js';
import { createSound } from '../../../shared/sound.js';
import { openDialog, closeDialog, confirmDialog, toast } from '../../../shared/dialog.js';
import { registerServiceWorker } from '../../../shared/pwa.js';

const GAME_ID = 'dots-and-boxes';
const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);

const BADGES = {
  first_box: 'First box',
  first_win: 'First win',
  win_hard: 'Beat the Hard bot',
  win_5x5: 'Won on the 5 by 5 board',
  run_4: 'Closed 4 or more boxes in one turn',
  clean_win: 'Clean win: you never gave a box away',
};

/* ---------- settings and stats ---------- */
const settings = Object.assign(
  { sound: true, reduceMotion: false, level: 'medium', helper: 'auto' },
  store.get('settings', {}),
);
const saveSettings = () => store.set('settings', settings);
const readStats = () => Object.assign({ games: {}, bestRun: 0 }, store.get('stats', {}));

const sound = createSound({ muted: !settings.sound });
function applySettings() {
  sound.setMuted(!settings.sound);
  document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  $('btn-sound').textContent = `Sound: ${settings.sound ? 'on' : 'off'}`;
  $('btn-sound').setAttribute('aria-pressed', String(settings.sound));
}
const motionReduced = () => document.documentElement.classList.contains('reduce-motion');

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
// session: { state, mode, n, level, first, moves, over, thinking, hint, note, last, run, resigned }
let session = null;
const board = createBoard($('board'), { onTap: handleTap });

const namesFor = (s) => (s.mode === 'two' ? ['Player 1', 'Player 2'] : ['You', 'Computer']);
const humanTurn = () => session.mode === 'two' || session.state.turn === 0;
const plural = (k) => `${k} ${k === 1 ? 'box' : 'boxes'}`;

function blankSession(base) {
  return Object.assign({ over: false, thinking: false, hint: null, note: '', last: null, run: 0, again: false, resigned: null }, base);
}

function helperOn(s) {
  if (s.mode === 'two') return settings.helper === 'on';
  return settings.helper === 'on' || (settings.helper === 'auto' && s.level === 'easy');
}

function saveGame() {
  if (!session || session.over) return store.remove('saved');
  store.set('saved', { mode: session.mode, n: session.n, level: session.level, first: session.first, moves: session.moves });
}

// Starter: on 3x3 the player chooses; on bigger boards it swaps every game.
function pickFirst(mode, n, chosen) {
  if (n === 3) return mode === 'cpu' ? chosen : 0;
  const starters = store.get('starters', {});
  const first = starters[n] === 0 ? 1 : 0;
  store.set('starters', Object.assign(starters, { [n]: first }));
  return first;
}

function startGame({ mode, n, level, first }) {
  botId++;
  session = blankSession({ state: newGame({ n, first }), mode, n, level, first, moves: [] });
  store.remove('saved');
  show('play');
  render();
  maybeBotMove();
  $('btn-undo').focus();
}

function resumeGame() {
  const saved = store.get('saved');
  if (!saved || !Array.isArray(saved.moves)) return false;
  const n = [3, 4, 5].includes(saved.n) ? saved.n : 3;
  const first = saved.first === 1 ? 1 : 0;
  const { state, applied } = replay(n, first, saved.moves);
  if (state.over) {
    store.remove('saved');
    return false;
  }
  session = blankSession({
    state, mode: saved.mode === 'two' ? 'two' : 'cpu', n, level: saved.level || 'medium', first, moves: applied,
  });
  botId++;
  show('play');
  render();
  maybeBotMove();
  return true;
}

function turnText(s) {
  const again = s.again ? 'Go again: ' : '';
  if (s.mode === 'two') {
    const passed = !s.again && s.moves.length ? ' Pass the phone!' : '';
    return `${namesFor(s)[s.state.turn]}'s turn: ${again ? 'go again, ' : ''}tap a dotted line.${passed}`;
  }
  return `${again}${again ? 'tap a dotted line.' : 'Your turn: tap a dotted line.'}`;
}

function render() {
  const s = session;
  const names = namesFor(s);
  const enabled = !s.over && !s.thinking && humanTurn();
  const warn = new Set();
  if (enabled && helperOn(s)) for (const e of legalMoves(s.state)) if (moveKind(s.state, e) === 'danger') warn.add(e);
  board.render({ n: s.n, edges: s.state.edges, owner: s.state.owner }, {
    enabled, hint: s.hint, warn, last: s.moves.length ? s.moves[s.moves.length - 1] : undefined, names,
  });

  for (const p of [0, 1]) {
    const el = $(`score-${p}`);
    el.querySelector('.score-name').textContent = names[p];
    el.querySelector('.score-count').textContent = String(s.state.scores[p]);
    el.classList.toggle('turn', !s.over && s.state.turn === p);
  }

  const el = $('status');
  if (s.over) el.textContent = 'Game over';
  else if (s.thinking) el.textContent = `${s.note ? s.note + ' ' : ''}The computer is thinking…`;
  else el.textContent = `${s.note ? s.note + ' ' : ''}${turnText(s)}`;

  const lm = $('last-move');
  if (s.last) {
    const who = names[s.last.mover];
    lm.textContent = `Last move: ${who} drew a line${s.last.boxes ? ` and closed ${plural(s.last.boxes)}` : ''}.`;
  } else lm.textContent = '';

  $('btn-undo').disabled = s.moves.length === 0 || s.over;
  $('btn-hint').hidden = s.mode === 'two';
  $('btn-hint').disabled = s.over || s.thinking || !humanTurn();
}

function handleTap(edge) {
  const s = session;
  if (!s || s.over || s.thinking || !humanTurn()) return;
  sound.unlock();
  playEdge(edge);
}

function playEdge(edge) {
  const s = session;
  if (!s || s.over) return;
  const mover = s.state.turn;
  const result = applyMove(s.state, edge);
  if (!result) {
    sound.play('error');
    return;
  }
  s.moves.push(edge);
  s.hint = null;
  const boxes = result.completed.length;
  s.last = { mover, boxes };
  sound.play('line');
  if (boxes) {
    sound.play('box', s.run);
    s.run += boxes;
  }
  if (!result.extraTurn) s.run = 0;
  s.again = Boolean(result.extraTurn) && !result.over;
  const names = namesFor(s);
  if (boxes) {
    const who = mover === 0 && s.mode === 'cpu' ? 'You' : names[mover];
    s.note = `${who} closed ${plural(boxes)}!`;
    const sc = $(`score-${mover}`);
    sc.classList.remove('gain');
    void sc.offsetWidth;
    sc.classList.add('gain');
  } else s.note = '';

  if (result.over) {
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
  if (!s || s.over || s.mode !== 'cpu' || s.state.turn === 0) return;
  s.thinking = true;
  render();
  const stamp = ++botId;
  const started = performance.now();
  const timeMs = s.level === 'hard' ? 1500 : 500;
  const reply = await askBot(cloneState(s.state), s.level, timeMs);
  // Ignore stale answers (new game, undo, or leaving while the bot was thinking).
  if (session !== s || s.over || botId < stamp || !s.thinking) return;
  const wait = motionReduced() ? 150 : s.again ? 250 : 450;
  await new Promise((r) => setTimeout(r, Math.max(0, wait - (performance.now() - started))));
  if (session !== s || s.over || !s.thinking) return;
  s.thinking = false;
  const legal = legalMoves(s.state);
  const move = legal.includes(reply.move) ? reply.move : legal[0]; // never get stuck
  if (move === undefined) return render();
  playEdge(move);
}

/* ---------- undo and hint ---------- */
function undoMove() {
  const s = session;
  if (!s || s.moves.length === 0 || s.over) return;
  botId++;
  s.thinking = false;
  const kept = s.moves.slice();
  do {
    kept.pop();
    const probe = replay(s.n, s.first, kept);
    if (s.mode === 'two' || probe.state.turn === 0 || kept.length === 0) break;
  } while (kept.length);
  const { state, applied } = replay(s.n, s.first, kept);
  s.state = state;
  s.moves = applied;
  s.hint = null;
  s.note = '';
  s.last = null;
  s.run = state.run;
  s.again = false;
  saveGame();
  render();
  maybeBotMove();
}

function giveHint() {
  const s = session;
  if (!s || s.over || s.thinking || !humanTurn()) return;
  sound.unlock();
  const edge = hintMove(s.state);
  if (edge === null || edge === undefined) return;
  s.hint = edge;
  sound.play('hint');
  const kind = moveKind(s.state, edge);
  toast($('toast'), kind === 'danger' ? 'Every line gives a box away. Pick the smallest gift.' : kind === 'take' ? 'You can close a box here!' : 'Try the glowing line.');
  render();
}

/* ---------- results, stats, badges ---------- */
function whyText(s, st, result, facts) {
  const names = namesFor(s);
  const [a, b] = st.scores;
  const parts = [];
  if (s.resigned !== null) {
    parts.push(`${s.mode === 'cpu' ? 'You' : names[s.resigned]} gave up the game.`);
  } else if (result === 'draw') {
    parts.push(`Both players closed ${a} boxes.`);
  } else {
    const w = result;
    const win = Math.max(a, b);
    const lose = Math.min(a, b);
    parts.push(`${names[w]} won ${win} to ${lose}.`);
  }
  for (const p of [0, 1]) {
    if (facts.gifts[p] > 0) parts.push(`${names[p]} gave ${names[1 - p]} ${plural(facts.gifts[p])}.`);
    else if (s.resigned === null) parts.push(`${names[p]} never gave a box away.`);
  }
  const top = facts.bestRun[0] >= facts.bestRun[1] ? 0 : 1;
  if (facts.bestRun[top] >= 3) parts.push(`${names[top]} closed ${facts.bestRun[top]} boxes in one turn.`);
  return parts.join(' ');
}

function finishGame() {
  const s = session;
  const st = status(s.state);
  const names = namesFor(s);
  const facts = summary(s.state);
  const result = s.resigned !== null ? 1 - s.resigned : st.result;
  const earned = [];
  let title;
  let line = '';

  if (s.mode === 'cpu') {
    const won = result === 0;
    const draw = result === 'draw';
    title = won ? 'You won!' : draw ? 'A draw' : 'Good game, you lost this one';
    sound.play(won ? 'win' : draw ? 'draw' : 'lose');

    const stats = readStats();
    const key = `${s.n}-${s.level}`;
    const row = stats.games[key] || { p: 0, w: 0 };
    row.p += 1;
    if (won) row.w += 1;
    stats.games[key] = row;
    stats.bestRun = Math.max(stats.bestRun || 0, facts.bestRun[0]);
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
    if (s.state.scores[0] > 0) award('first_box');
    if (facts.bestRun[0] >= 4) award('run_4');
    if (won) {
      award('first_win');
      if (s.level === 'hard') award('win_hard');
      if (s.n === 5) award('win_5x5');
      if (facts.gifts[0] === 0 && s.resigned === null) award('clean_win');
    }
    writeProgress(progress);
    line = `On ${s.n} by ${s.n} (${s.level}): ${row.w} won of ${row.p} played. Longest run in one turn: ${stats.bestRun}.`;
  } else {
    title = result === 'draw' ? 'A draw' : `${names[result]} wins!`;
    sound.play(result === 'draw' ? 'draw' : 'win');
    const progress = readProgress(GAME_ID);
    progress.played += 1;
    progress.lastPlayed = todayString();
    writeProgress(progress);
  }

  $('result-title').textContent = title;
  $('result-score').textContent = `${names[0]}: ${st.scores[0]}   ${names[1]}: ${st.scores[1]}`;
  $('result-why').textContent = whyText(s, st, result, facts);
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
    text: $('tut-text'), score: $('tut-score'), next: $('btn-tut-next'), skip: $('btn-tut-skip'),
    practice: $('tut-practice'), practiceButton: $('btn-tut-practice'), finishButton: $('btn-tut-finish'),
  },
  sound,
  createBoard,
  onFinish() {
    store.set('tutorialDone', true);
    show('title');
  },
  onPractice() {
    store.set('tutorialDone', true);
    startGame({ mode: 'cpu', n: 3, level: 'easy', first: 0 });
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
  $('first-note').textContent = 'On 4 by 4 and 5 by 5 boards the starter swaps every game.';
  syncSetup();
  show('setup');
  form.querySelector('input:checked').focus();
}
function syncSetup() {
  const f = $('setup-form').elements;
  const two = f.mode.value === 'two';
  $('fs-level').hidden = two;
  $('fs-first').hidden = two || f.size.value !== '3';
}
$('setup-form').addEventListener('change', syncSetup);
$('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const f = $('setup-form').elements;
  settings.level = f.level.value;
  saveSettings();
  const n = Number(f.size.value);
  const mode = f.mode.value;
  startGame({ mode, n, level: f.level.value, first: pickFirst(mode, n, Number(f.first.value)) });
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
  if (session) session.thinking = false;
  openSetup();
});
$('menu-resign').addEventListener('click', async () => {
  closeDialog($('dlg-menu'));
  const s = session;
  if (!s || s.over) return;
  const ok = await confirmDialog({
    title: 'Give up?', message: s.mode === 'cpu' ? 'You will lose this game. Are you sure?' : 'The other player will win. Are you sure?',
    confirmText: 'Give up', cancelText: 'Keep playing', danger: true,
  });
  if (!ok || session !== s || s.over) return;
  botId++;
  s.thinking = false;
  s.resigned = s.mode === 'cpu' ? 0 : s.state.turn;
  s.over = true;
  store.remove('saved');
  render();
  finishGame();
});
$('btn-undo').addEventListener('click', undoMove);
$('btn-hint').addEventListener('click', giveHint);

$('btn-again').addEventListener('click', () => {
  closeDialog($('dlg-result'));
  if (!session) return;
  const { mode, n, level } = session;
  startGame({ mode, n, level, first: n === 3 ? session.first : pickFirst(mode, n, 0) });
});
$('btn-result-howto').addEventListener('click', () => {
  closeDialog($('dlg-result'));
  openTutorial();
});

function openSettings() {
  $('set-sound').checked = settings.sound;
  $('set-motion').checked = settings.reduceMotion;
  $('set-level').value = settings.level;
  $('set-helper').value = settings.helper;
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
$('set-helper').addEventListener('change', (e) => {
  settings.helper = e.target.value;
  saveSettings();
  if (session && !$('screen-play').hidden) render();
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
window.__dnb = {
  get session() { return session; },
};
