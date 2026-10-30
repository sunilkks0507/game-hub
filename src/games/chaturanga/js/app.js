// Chaturanga app: screens, game session, bot, saved game, progress. Rules live in engine.js.

import {
  newGame, legalMoves, findMove, applyMove, inCheck, status, opposite,
  parseSquare, squareName, PIECE_NAMES,
} from './engine.js';
import { chooseMove } from './ai.js';
import { createBoard } from './board.js';
import { installSprite, pieceIconMarkup } from './pieces.js';
import { createTutorial } from './tutorial.js';
import { createStore, readProgress, writeProgress, todayString } from '../../../shared/storage.js';
import { createSound } from '../../../shared/sound.js';
import { openDialog, closeDialog, confirmDialog, toast } from '../../../shared/dialog.js';
import { registerServiceWorker } from '../../../shared/pwa.js';

const GAME_ID = 'chaturanga';
const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);

const BADGES = {
  first_win: 'First win',
  win_hard: 'Beat the Hard bot',
  promoted_win: 'Won with a promoted Padati',
  quick_win: 'Won in under 30 moves each',
};
const SIDE_NAME = { w: 'White', b: 'Black' };

/* ---------- settings and stats ---------- */
const settings = Object.assign({ sound: true, reduceMotion: false, level: 'medium' }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);
const readStats = () => store.get('stats', { easy: { p: 0, w: 0 }, medium: { p: 0, w: 0 }, hard: { p: 0, w: 0 } });

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

/* ---------- board and session ---------- */
installSprite(document);
const board = createBoard($('board'), { onTap: handleTap });

let session = null; // { state, mode, level, human, moves, flipped, selected, over, thinking, hint }
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
        done(event.data.move || null);
      }
    };
    worker.onerror = () => {
      workerBroken = true;
      worker = null;
      for (const [id, done] of pending) {
        pending.delete(id);
        done(undefined); // undefined: caller falls back to the inline bot
      }
    };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

// Ask the bot for a move. Uses the Worker, or runs inline if Workers are unavailable.
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

function humanTurn() {
  return session.mode === 'two' || session.state.turn === session.human;
}

function rebuild(moves) {
  const state = newGame();
  const applied = [];
  for (const m of moves) {
    const move = findMove(state, m.from, m.to);
    if (!move) break;
    applyMove(state, move);
    applied.push({ from: m.from, to: m.to });
  }
  return { state, applied };
}

function saveGame() {
  if (!session || session.over) return store.remove('saved');
  store.set('saved', {
    mode: session.mode, level: session.level, human: session.human,
    flipped: session.flipped, moves: session.moves,
  });
}

function startGame({ mode, level, human }) {
  botId++;
  session = {
    state: newGame(), mode, level, human, moves: [], flipped: mode === 'cpu' && human === 'b',
    selected: null, over: false, thinking: false, hint: null, promoted: false,
  };
  store.remove('saved');
  show('play');
  render();
  maybeBotMove();
  $('btn-flip').focus();
}

function resumeGame() {
  const saved = store.get('saved');
  if (!saved || !Array.isArray(saved.moves)) return false;
  const { state, applied } = rebuild(saved.moves);
  session = {
    state, mode: saved.mode === 'two' ? 'two' : 'cpu', level: saved.level || 'medium',
    human: saved.human === 'b' ? 'b' : 'w', moves: applied, flipped: Boolean(saved.flipped),
    selected: null, over: false, thinking: false, hint: null, promoted: applied.some((m) => m.promo),
  };
  botId++;
  show('play');
  render();
  maybeBotMove();
  return true;
}

function render() {
  const s = session;
  const targets = new Map();
  if (s.selected !== null && !s.over) {
    for (const m of legalMoves(s.state, s.selected)) targets.set(m.to, m.captured ? 'capture' : 'move');
  }
  const last = s.moves.length ? [s.moves[s.moves.length - 1].from, s.moves[s.moves.length - 1].to] : [];
  const checked = !s.over && inCheck(s.state, s.state.turn);
  board.render(s.state, {
    flipped: s.flipped,
    selected: s.selected,
    targets,
    lastMove: last,
    hints: s.hint || [],
    checkSq: checked ? s.state.kingSq[s.state.turn === 'w' ? 0 : 1] : null,
    disabled: s.over || s.thinking || !humanTurn(),
  });

  const el = $('status');
  el.classList.toggle('check', checked);
  if (s.over) el.textContent = 'Game over';
  else if (s.thinking) el.textContent = 'The computer is thinking…';
  else if (s.mode === 'two') el.textContent = `${SIDE_NAME[s.state.turn]}'s turn${checked ? ': Raja in check!' : ''}`;
  else el.textContent = checked ? 'Your Raja is in check! Protect it.' : 'Your turn';

  const lm = s.moves[s.moves.length - 1];
  $('last-move').textContent = lm ? `Last move: ${squareName(lm.from)} to ${squareName(lm.to)}` : '';
  $('btn-undo').disabled = s.moves.length === 0 || s.thinking;
  $('btn-hint').hidden = s.mode === 'two';
  $('btn-hint').disabled = s.over || s.thinking || !humanTurn();
}

function handleTap(sq) {
  const s = session;
  if (!s || s.over || s.thinking || !humanTurn()) return;
  sound.unlock();
  s.hint = null;
  const piece = s.state.board[sq];
  if (s.selected !== null) {
    const move = findMove(s.state, s.selected, sq);
    if (move) return playMove(move);
  }
  if (piece && piece[0] === s.state.turn) {
    s.selected = s.selected === sq ? null : sq;
    sound.play('tap');
  } else {
    if (s.selected !== null) sound.play('error');
    s.selected = null;
  }
  render();
}

function playMove(move) {
  const s = session;
  const mover = s.state.turn;
  applyMove(s.state, move);
  s.moves.push({ from: move.from, to: move.to, promo: Boolean(move.promotion) });
  if (move.promotion && (s.mode === 'two' || mover === s.human)) s.promoted = true;
  s.selected = null;
  s.hint = null;

  const st = status(s.state);
  const checked = !st.over && inCheck(s.state, s.state.turn);
  sound.play(st.over ? 'tap' : checked ? 'check' : move.captured ? 'capture' : 'move');

  if (st.over) {
    s.over = true;
    store.remove('saved');
    render();
    finishGame(st);
    return;
  }
  saveGame();
  render();
  maybeBotMove();
}

async function maybeBotMove() {
  const s = session;
  if (!s || s.over || s.mode !== 'cpu' || s.state.turn === s.human) return;
  s.thinking = true;
  render();
  const mine = session;
  const stamp = ++botId;
  const started = performance.now();
  const timeMs = s.level === 'hard' ? 1500 : 500;
  const reply = await askBot(JSON.parse(JSON.stringify(s.state)), s.level, timeMs);
  // Ignore stale answers (new game, undo, or leaving the game while the bot was thinking).
  if (session !== mine || mine.over || botId < stamp || !mine.thinking) return;
  const wait = Math.max(0, 350 - (performance.now() - started));
  await new Promise((r) => setTimeout(r, wait));
  if (session !== mine || mine.over || !mine.thinking) return;
  mine.thinking = false;
  const move = reply.move ? findMove(mine.state, reply.move.from, reply.move.to) : null;
  if (!move) {
    // Should not happen: fall back to any legal move so the game never gets stuck.
    const all = legalMoves(mine.state);
    if (!all.length) return render();
    return playMove(all[0]);
  }
  playMove(move);
}

/* ---------- undo, hint, flip ---------- */
function undoMove() {
  const s = session;
  if (!s || s.moves.length === 0) return;
  botId++; // drop any bot answer still on its way
  s.thinking = false;
  let remove = 1;
  if (s.mode === 'cpu') {
    // Go back to the player's own turn.
    remove = s.state.turn === s.human ? 2 : 1;
  }
  remove = Math.min(remove, s.moves.length);
  const kept = s.moves.slice(0, s.moves.length - remove);
  const { state, applied } = rebuild(kept);
  s.state = state;
  s.moves = applied;
  s.over = false;
  s.selected = null;
  s.hint = null;
  saveGame();
  render();
  maybeBotMove();
}

async function giveHint() {
  const s = session;
  if (!s || s.over || s.thinking || !humanTurn()) return;
  sound.unlock();
  $('btn-hint').disabled = true;
  const reply = await askBot(JSON.parse(JSON.stringify(s.state)), 'medium', 400);
  if (session !== s || s.over) return;
  if (reply.move) {
    s.hint = [reply.move.from, reply.move.to];
    s.selected = null;
    sound.play('hint');
    toast($('toast'), 'Try the glowing squares.');
  }
  render();
}

/* ---------- results, stats, badges ---------- */
function whyText(st) {
  const loser = st.loser ? SIDE_NAME[st.loser] : '';
  switch (st.reason) {
    case 'checkmate': return `Checkmate. The ${loser} Raja is attacked and has no safe square.`;
    case 'stalemate': return `${loser} has no legal move. In Chaturanga that counts as a loss, even when the Raja is not attacked.`;
    case 'bare': return `${loser} has only a Raja left. In Chaturanga a bare Raja loses.`;
    case 'bare-both': return 'Both sides have only a Raja left, so it is a draw.';
    case 'repetition': return 'The same position happened three times, so it is a draw.';
    case 'no-progress': return '100 half-moves passed with no capture and no Padati move, so it is a draw.';
    default: return '';
  }
}

function finishGame(st) {
  const s = session;
  const earned = [];
  let title;
  let line = '';
  if (s.mode === 'cpu') {
    const won = st.result === s.human;
    const draw = st.result === 'draw';
    title = won ? 'You won!' : draw ? 'A draw' : 'Good game, you lost this one';
    sound.play(won ? 'win' : draw ? 'draw' : 'lose');

    const stats = readStats();
    stats[s.level].p += 1;
    if (won) stats[s.level].w += 1;
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
    if (won) {
      award('first_win');
      if (s.level === 'hard') award('win_hard');
      if (s.promoted) award('promoted_win');
      if (s.moves.length < 60) award('quick_win');
    }
    writeProgress(progress);
    line = `Your games on ${s.level}: ${stats[s.level].w} won of ${stats[s.level].p} played.`;
  } else {
    title = st.result === 'draw' ? 'A draw' : `${SIDE_NAME[st.result]} wins!`;
    sound.play(st.result === 'draw' ? 'draw' : 'win');
    const progress = readProgress(GAME_ID);
    progress.played += 1;
    progress.lastPlayed = todayString();
    writeProgress(progress);
  }
  $('result-title').textContent = title;
  $('result-why').textContent = whyText(st);
  $('result-stats').textContent = s.mode === 'cpu' ? line : '';
  $('result-badges').replaceChildren(
    ...earned.map((name) => {
      const li = document.createElement('li');
      li.textContent = `New badge: ${name}`;
      return li;
    }),
  );
  setTimeout(() => openDialog($('dlg-result')), 450);
}

/* ---------- rules card ---------- */
const PIECE_HELP = [
  ['K', 'Raja', 'One step any way'],
  ['M', 'Mantri', 'One step diagonally'],
  ['G', 'Gaja', 'Leaps 2 squares diagonally'],
  ['A', 'Ashva', 'L-jump, like a horse'],
  ['R', 'Ratha', 'Slides along rows and columns'],
  ['P', 'Padati', 'One step forward, captures diagonally'],
];
$('rules-pieces').innerHTML = PIECE_HELP.map(
  ([code, name, how]) => `<li>${pieceIconMarkup('w', code, 40)}<span><b>${name}</b>${how}</span></li>`,
).join('');

/* ---------- tutorial ---------- */
const tutorial = createTutorial({
  ui: {
    board: $('tut-board'), feedback: $('tut-feedback'), stepLabel: $('tut-step-label'), dots: $('tut-dots'),
    text: $('tut-text'), taskCount: $('tut-count'), next: $('btn-tut-next'), skip: $('btn-tut-skip'),
    practice: $('tut-practice'), practiceButton: $('btn-tut-practice'), finishButton: $('btn-tut-finish'),
  },
  sound,
  onFinish() {
    store.set('tutorialDone', true);
    show('title');
  },
  onPractice() {
    store.set('tutorialDone', true);
    startGame({ mode: 'cpu', level: 'easy', human: 'w' });
  },
});

function openTutorial() {
  show('tutorial');
  tutorial.start();
  $('tut-text').focus();
}

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
$('btn-howto').addEventListener('click', () => { sound.unlock(); openTutorial(); });
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
  $('fs-side').hidden = two;
}
$('setup-form').addEventListener('change', syncSetup);
$('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const f = $('setup-form').elements;
  const mode = f.mode.value;
  const level = f.level.value;
  settings.level = level;
  saveSettings();
  startGame({ mode, level, human: f.side.value });
});
$('btn-setup-back').addEventListener('click', () => show('title'));

$('btn-menu').addEventListener('click', () => openDialog($('dlg-menu')));
$('menu-close').addEventListener('click', () => closeDialog($('dlg-menu')));
$('btn-rules').addEventListener('click', () => openDialog($('dlg-rules')));
$('rules-close').addEventListener('click', () => closeDialog($('dlg-rules')));
$('menu-howto').addEventListener('click', () => { closeDialog($('dlg-menu')); openTutorial(); });
$('menu-settings').addEventListener('click', () => { closeDialog($('dlg-menu')); openSettings(); });
$('menu-new').addEventListener('click', () => { closeDialog($('dlg-menu')); botId++; openSetup(); });
$('menu-resign').addEventListener('click', async () => {
  closeDialog($('dlg-menu'));
  const s = session;
  if (!s || s.over) return;
  const ok = await confirmDialog({
    title: 'Resign?', message: 'You will lose this game. Are you sure?', confirmText: 'Resign', cancelText: 'Keep playing', danger: true,
  });
  if (!ok || session !== s || s.over) return;
  botId++;
  s.thinking = false;
  s.over = true;
  store.remove('saved');
  const loser = s.mode === 'cpu' ? s.human : s.state.turn;
  render();
  finishGame({ over: true, result: opposite(loser), reason: 'resign', loser });
});
$('btn-undo').addEventListener('click', undoMove);
$('btn-hint').addEventListener('click', giveHint);
$('btn-flip').addEventListener('click', () => { session.flipped = !session.flipped; saveGame(); render(); });

$('btn-again').addEventListener('click', () => {
  closeDialog($('dlg-result'));
  if (session) startGame({ mode: session.mode, level: session.level, human: session.human });
});
$('btn-result-howto').addEventListener('click', () => { closeDialog($('dlg-result')); openTutorial(); });

function openSettings() {
  $('set-sound').checked = settings.sound;
  $('set-motion').checked = settings.reduceMotion;
  $('set-level').value = settings.level;
  openDialog($('dlg-settings'));
}
$('set-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); applySettings(); });
$('set-motion').addEventListener('change', (e) => { settings.reduceMotion = e.target.checked; saveSettings(); applySettings(); });
$('set-level').addEventListener('change', (e) => { settings.level = e.target.value; saveSettings(); });
$('settings-close').addEventListener('click', () => closeDialog($('dlg-settings')));
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
window.__chaturanga = { get session() { return session; }, parseSquare, PIECE_NAMES };
