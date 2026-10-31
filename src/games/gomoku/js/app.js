// Five in a Row app: screens, game session, bot, saved game, progress. Rules live in engine.js.

import {
  newGame, place, decideSwap, cloneState, replay, explain, pointLabel,
} from './engine.js';
import { chooseMove, chooseSwap, hint as hintFor, threats } from './ai.js';
import { createBoard } from './board.js';
import { createTutorial } from './tutorial.js';
import { createStore, readProgress, writeProgress, todayString } from '../../../shared/storage.js';
import { createSound } from '../../../shared/sound.js';
import { openDialog, closeDialog, confirmDialog, toast } from '../../../shared/dialog.js';
import { registerServiceWorker } from '../../../shared/pwa.js';

const GAME_ID = 'gomoku';
const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);

const BADGES = {
  first_win: 'First win',
  open_four: 'Won with an open four',
  block_3: 'Blocked 3 fours in one game',
  win_15: 'Won on the 15 by 15 board',
  win_hard: 'Beat the Hard bot',
};

const COLOUR_WORD = ['Black', 'White'];

/* ---------- settings and stats ---------- */
const settings = Object.assign(
  { sound: true, reduceMotion: false, level: 'medium', size: 9, threatHelper: 'auto', placing: 'preview', fairStart: false, youPlay: 0 },
  store.get('settings', {}),
);
const saveSettings = () => store.set('settings', settings);
const readStats = () => Object.assign({ games: {}, bestBlocks: 0 }, store.get('stats', {}));

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
let reqId = 0;
let epoch = 0; // bump to ignore any bot answer still on its way
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
        done(event.data.move);
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
  const id = ++reqId;
  const inline = () => new Promise((resolve) => setTimeout(() => resolve(chooseMove(state, { level, timeMs })), 30));
  const w = getWorker();
  if (!w) return inline();
  return new Promise((resolve) => {
    pending.set(id, (move) => {
      if (move === undefined) inline().then(resolve);
      else resolve(move);
    });
    w.postMessage({ id, state, level, timeMs });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- session ---------- */
// session: { state, mode, n, level, fairStart, youPlay, swapped, moves, over, thinking, hint, preview, last, practice, resigned }
let session = null;
const board = createBoard($('board'), {
  onTap: handleTap,
  onEscape() {
    if (session && session.preview >= 0) {
      session.preview = -1;
      render();
    }
  },
});

function blankSession(base) {
  return Object.assign({ over: false, thinking: false, hint: -1, preview: -1, last: -1, swapped: false, practice: false, resigned: null }, base);
}

// Seats: the first seat starts as Black. After a Fair-start swap the seats trade colours.
const humanColour = (s) => (s.swapped ? 1 - s.youPlay : s.youPlay);
const seatOf = (s, colour) => (s.swapped ? 1 - colour : colour);
function nameOf(s, colour) {
  if (s.mode === 'cpu') return colour === humanColour(s) ? 'You' : 'The computer';
  return `Player ${seatOf(s, colour) + 1}`;
}
const lower = (name) => (name === 'You' ? 'you' : name.charAt(0).toLowerCase() + name.slice(1));
const humanTurn = (s) => s.mode === 'two' || s.state.current === humanColour(s);
// Who chooses at the Fair-start swap: the second seat.
const humanDecidesSwap = (s) => s.mode === 'two' || s.youPlay === 1;

function helperOn(s) {
  if (s.practice) return true;
  if (settings.threatHelper === 'always') return true;
  return settings.threatHelper === 'auto' && s.mode === 'cpu' && s.level === 'easy';
}

function announce(text) {
  $('announce').textContent = text;
}

function saveGame() {
  if (!session || session.over || session.practice) return store.remove('saved');
  store.set('saved', {
    mode: session.mode, n: session.n, level: session.level, fairStart: session.fairStart,
    youPlay: session.youPlay, swapped: session.swapped, moves: session.moves,
  });
}

function startGame({ mode, n, level, fairStart, youPlay, practice = false }) {
  epoch++;
  session = blankSession({
    state: newGame({ n, fairStart }), mode, n, level, fairStart, youPlay: mode === 'cpu' ? youPlay : 0, moves: [], practice,
  });
  store.remove('saved');
  store.set('lastColour', session.youPlay);
  show('play');
  render();
  announce('New game. Black moves first.');
  maybeBotMove();
  $('btn-undo').focus();
}

function resumeGame() {
  const saved = store.get('saved');
  if (!saved || !Array.isArray(saved.moves)) return false;
  const n = [9, 13, 15].includes(saved.n) ? saved.n : 9;
  const { state, applied } = replay(n, saved.moves, { fairStart: Boolean(saved.fairStart), swapped: Boolean(saved.swapped) });
  if (state.phase === 'over') {
    store.remove('saved');
    return false;
  }
  epoch++;
  session = blankSession({
    state, mode: saved.mode === 'two' ? 'two' : 'cpu', n, level: saved.level || 'medium', fairStart: Boolean(saved.fairStart),
    youPlay: saved.youPlay === 1 ? 1 : 0, swapped: Boolean(saved.swapped) && applied.length >= 2, moves: applied,
    last: applied.length ? applied[applied.length - 1] : -1,
  });
  show('play');
  render();
  maybeBotMove();
  return true;
}

function statusParts(s) {
  const st = s.state;
  if (s.over) return { mark: '', text: 'Game over' };
  if (st.phase === 'swap') {
    if (humanDecidesSwap(s)) return { mark: '', text: s.mode === 'two' ? 'Player 2: play on or swap sides?' : 'Choose: play on or swap sides.' };
    return { mark: '', text: 'The computer is deciding whether to swap…' };
  }
  const c = st.current;
  const mark = c === 0 ? '●' : '○';
  if (s.thinking) return { mark, text: 'The computer is thinking…' };
  const how = settings.placing === 'one-tap' ? 'Tap a point to place.' : 'Tap a point to preview.';
  if (s.mode === 'two') {
    const passed = s.moves.length ? ' Pass the phone!' : '';
    return { mark, text: `${nameOf(s, c)} (${COLOUR_WORD[c]}), your turn.${passed}` };
  }
  return { mark, text: `Your turn, ${COLOUR_WORD[c]}. ${how}` };
}

function render() {
  const s = session;
  const st = s.state;
  const enabled = !s.over && !s.thinking && st.phase === 'play' && humanTurn(s);
  const view = {
    enabled, preview: s.preview, previewColour: st.current, last: s.last, animate: !motionReduced(),
    winLine: s.over ? st.winLine : null, glow: s.hint >= 0 ? new Set([s.hint]) : new Set(), hint: s.hint,
    names: COLOUR_WORD,
  };
  if (enabled && helperOn(s)) {
    const t = threats(st);
    view.win = t.win;
    view.block = t.block;
    view.watch = t.watch;
  }
  board.render(st, view);

  const { mark, text } = statusParts(s);
  const el = $('status');
  el.replaceChildren();
  if (mark) {
    const m = document.createElement('span');
    m.className = 'chip-stone';
    m.setAttribute('aria-hidden', 'true');
    m.textContent = mark;
    el.append(m);
  }
  el.append(document.createTextNode(text));

  const onePlace = settings.placing === 'one-tap';
  $('place-row').hidden = onePlace || st.phase === 'swap';
  $('btn-place').disabled = !enabled || s.preview < 0;
  $('btn-place').textContent = s.preview >= 0 ? `Place stone at ${pointLabel(s.n, s.preview)}` : 'Tap a point to preview';

  const swapVisible = !s.over && st.phase === 'swap' && humanDecidesSwap(s);
  $('swap-card').hidden = !swapVisible;
  if (swapVisible) {
    $('swap-text').textContent = s.mode === 'two'
      ? 'Player 2: keep White and play on, or swap and take the Black stone? The stone stays where it is.'
      : 'Play on as White, or swap and take the Black stone? The stone stays where it is.';
  }

  const lm = $('last-move');
  lm.textContent = s.last >= 0 && s.moves.length
    ? `Last move: ${COLOUR_WORD[s.state.cells[s.last]]} at ${pointLabel(s.n, s.last)}. Move ${s.moves.length}.`
    : '';
  $('btn-undo').disabled = s.moves.length === 0 || s.over || st.phase === 'swap';
  $('btn-hint').hidden = s.mode === 'two';
  $('btn-hint').disabled = !enabled;
}

function handleTap(p) {
  const s = session;
  if (!s || s.over || s.thinking || s.state.phase !== 'play' || !humanTurn(s)) return;
  if (s.state.cells[p] !== -1) return;
  sound.unlock();
  if (settings.placing === 'one-tap' || p === s.preview) {
    placeStone(p);
    return;
  }
  s.preview = p;
  s.hint = -1;
  sound.play('tap');
  announce(`Preview at ${pointLabel(s.n, p)}. Tap again or press Place.`);
  render();
}

function placeStone(p) {
  const s = session;
  if (!s || s.over) return;
  const mover = s.state.current;
  const res = place(s.state, p);
  if (!res) {
    sound.play('error');
    return;
  }
  s.moves.push(p);
  s.preview = -1;
  s.hint = -1;
  s.last = p;
  sound.play('stone');
  announce(`${COLOUR_WORD[mover]} stone at ${pointLabel(s.n, p)}.`);
  if (res.won || res.draw) {
    s.over = true;
    store.remove('saved');
    render();
    finishGame();
    return;
  }
  if (res.swapPhase) sound.play('tap');
  saveGame();
  render();
  maybeBotMove();
}

function applySwap(swap) {
  const s = session;
  if (!s || s.over || s.state.phase !== 'swap') return;
  decideSwap(s.state, swap);
  s.swapped = swap;
  sound.play(swap ? 'swap' : 'tap');
  announce(swap ? 'Sides swapped. White to move.' : 'Playing on. White to move.');
  if (s.mode === 'cpu') toast($('toast'), swap ? (humanDecidesSwap(s) ? 'You swapped sides.' : 'The computer swapped sides.') : (humanDecidesSwap(s) ? 'You play on.' : 'The computer plays on.'));
  saveGame();
  render();
  maybeBotMove();
}

async function maybeBotMove() {
  const s = session;
  if (!s || s.over || s.mode !== 'cpu') return;
  const mine = epoch;
  if (s.state.phase === 'swap') {
    if (humanDecidesSwap(s)) return;
    s.thinking = true;
    render();
    await wait(motionReduced() ? 200 : 800);
    if (session !== s || epoch !== mine || s.over) return;
    s.thinking = false;
    applySwap(chooseSwap(s.state));
    return;
  }
  if (s.state.phase !== 'play' || s.state.current === humanColour(s)) return;
  s.thinking = true;
  s.preview = -1;
  render();
  const started = performance.now();
  const timeMs = s.level === 'hard' ? 1500 : 400;
  const move = await askBot(cloneState(s.state), s.level, timeMs);
  if (session !== s || epoch !== mine || s.over || !s.thinking) return;
  await wait(Math.max(0, (motionReduced() ? 150 : 450) - (performance.now() - started)));
  if (session !== s || epoch !== mine || s.over || !s.thinking) return;
  s.thinking = false;
  const legal = s.state.cells.reduce((a, c, i) => (c === -1 ? a.concat(i) : a), []);
  const pick = legal.includes(move) ? move : legal[0]; // never get stuck
  if (pick === undefined) return render();
  placeStone(pick);
}

/* ---------- undo and hint ---------- */
function undoMove() {
  const s = session;
  if (!s || s.moves.length === 0 || s.over || s.state.phase === 'swap') return;
  epoch++;
  s.thinking = false;
  const kept = s.moves.slice();
  const opts = (len) => ({ fairStart: s.fairStart, swapped: len >= 2 ? s.swapped : false });
  do {
    kept.pop();
    if (s.mode === 'two' || kept.length === 0) break;
    const probe = replay(s.n, kept, opts(kept.length)).state;
    const hc = kept.length >= 2 ? humanColour(s) : s.youPlay;
    if (probe.phase === 'play' && probe.current === hc) break;
    if (probe.phase === 'swap' && humanDecidesSwap(s)) break;
  } while (kept.length);
  const { state, applied } = replay(s.n, kept, opts(kept.length));
  s.state = state;
  s.moves = applied;
  s.swapped = applied.length >= 2 ? s.swapped : false;
  s.preview = -1;
  s.hint = -1;
  s.last = applied.length ? applied[applied.length - 1] : -1;
  announce('Move undone.');
  saveGame();
  render();
  maybeBotMove();
}

function giveHint() {
  const s = session;
  if (!s || s.over || s.thinking || s.state.phase !== 'play' || !humanTurn(s)) return;
  sound.unlock();
  const h = hintFor(s.state);
  if (!h) return;
  s.hint = h.point;
  s.preview = h.point;
  sound.play('hint');
  toast($('toast'), h.text);
  announce(`${h.text} Suggested point ${pointLabel(s.n, h.point)}.`);
  render();
}

/* ---------- results, stats, badges ---------- */
const dirText = { across: 'five across', down: 'five down', diagonal: 'five on a diagonal' };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function whyText(s, ex) {
  if (s.resigned !== null) return `${cap(s.mode === 'cpu' ? 'you' : nameOf(s, s.resigned))} gave up the game.`;
  if (ex.draw) return 'Draw: the board filled up with no five.';
  const w = ex.winner;
  const wn = nameOf(s, w);
  const ln = nameOf(s, 1 - w);
  const parts = [`${wn} won on move ${ex.movesCount} with ${dirText[ex.dir] || 'five'}.`];
  if (ex.doubleThreat) parts.push(`${wn} made an open four, so ${lower(ln)} could not block both ends.`);
  else if (ex.unblockedFour) parts.push(`${ln} did not block the four at ${pointLabel(s.n, ex.finalPoint)}.`);
  const blocked = ex.blocks[w];
  if (blocked > 0) parts.push(`${wn} blocked ${blocked} ${blocked === 1 ? 'four' : 'fours'} on the way.`);
  return parts.join(' ');
}

function finishGame() {
  const s = session;
  const ex = explain(s.state);
  const earned = [];
  let title;
  let line = '';
  const hc = humanColour(s);
  const resultWinner = s.resigned !== null
    ? (s.mode === 'cpu' ? 1 - hc : 1 - s.state.current)
    : ex.winner;

  if (s.mode === 'cpu') {
    const won = resultWinner === hc;
    const draw = s.resigned === null && ex.draw;
    title = won ? 'You won!' : draw ? 'A draw' : 'Good game, you lost this one';
    sound.play(won ? 'win' : draw ? 'draw' : 'lose');

    if (!s.practice) {
      const stats = readStats();
      const key = `${s.n}-${s.level}`;
      const row = stats.games[key] || { p: 0, w: 0, d: 0 };
      row.p += 1;
      if (won) row.w += 1;
      if (draw) row.d += 1;
      stats.games[key] = row;
      stats.bestBlocks = Math.max(stats.bestBlocks || 0, ex.blocks[hc]);
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
        if (ex.doubleThreat && s.resigned === null) award('open_four');
        if (s.n === 15) award('win_15');
        if (s.level === 'hard') award('win_hard');
      }
      if (ex.blocks[hc] >= 3) award('block_3');
      writeProgress(progress);
      line = `On ${s.n} by ${s.n} (${s.level}): ${row.w} won of ${row.p} played.`;
    }
  } else {
    title = s.resigned === null && ex.draw ? 'A draw' : `${nameOf(s, resultWinner)} wins!`;
    sound.play(ex.draw && s.resigned === null ? 'draw' : 'win');
    const progress = readProgress(GAME_ID);
    progress.played += 1;
    progress.lastPlayed = todayString();
    writeProgress(progress);
  }

  $('result-title').textContent = title;
  $('result-why').textContent = whyText(s, ex);
  $('result-stats').textContent = line;
  $('result-badges').replaceChildren(
    ...earned.map((name) => {
      const li = document.createElement('li');
      li.textContent = `New badge: ${name}`;
      return li;
    }),
  );
  announce(`${title} ${whyText(s, ex)}`);
  setTimeout(() => openDialog($('dlg-result')), 450);
}

/* ---------- tutorial ---------- */
const tutorial = createTutorial({
  ui: {
    board: $('tut-board'), feedback: $('tut-feedback'), stepLabel: $('tut-step-label'), dots: $('tut-dots'),
    text: $('tut-text'), next: $('btn-tut-next'), skip: $('btn-tut-skip'), place: $('btn-tut-place'), placeRow: $('tut-place-row'),
    practice: $('tut-practice'), practiceButton: $('btn-tut-practice'), finishButton: $('btn-tut-finish'),
  },
  sound,
  createBoard,
  reduceMotion: motionReduced,
  onFinish() {
    store.set('tutorialDone', true);
    show('title');
  },
  onPractice() {
    store.set('tutorialDone', true);
    startGame({ mode: 'cpu', n: 9, level: 'easy', fairStart: false, youPlay: 0, practice: true });
  },
});

function openTutorial() {
  epoch++;
  if (session) session.thinking = false;
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
  const f = $('setup-form').elements;
  f.level.value = settings.level;
  f.size.value = String(settings.size);
  f.youPlay.value = String(settings.youPlay);
  f.fairStart.checked = Boolean(settings.fairStart);
  syncSetup();
  show('setup');
  $('setup-form').querySelector('input:checked').focus();
}
function syncSetup() {
  const two = $('setup-form').elements.mode.value === 'two';
  $('fs-level').hidden = two;
  $('fs-colour').hidden = two;
}
$('setup-form').addEventListener('change', syncSetup);
$('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const f = $('setup-form').elements;
  settings.level = f.level.value;
  settings.size = Number(f.size.value);
  settings.youPlay = Number(f.youPlay.value);
  settings.fairStart = f.fairStart.checked;
  saveSettings();
  startGame({
    mode: f.mode.value, n: settings.size, level: settings.level, fairStart: settings.fairStart, youPlay: settings.youPlay,
  });
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
  epoch++;
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
  epoch++;
  s.thinking = false;
  s.resigned = s.mode === 'cpu' ? humanColour(s) : s.state.current;
  s.over = true;
  store.remove('saved');
  render();
  finishGame();
});
$('btn-undo').addEventListener('click', undoMove);
$('btn-hint').addEventListener('click', giveHint);
$('btn-place').addEventListener('click', () => {
  const s = session;
  if (!s || s.preview < 0) return;
  sound.unlock();
  placeStone(s.preview);
});
$('btn-playon').addEventListener('click', () => {
  sound.unlock();
  applySwap(false);
});
$('btn-swap').addEventListener('click', () => {
  sound.unlock();
  applySwap(true);
});

$('btn-again').addEventListener('click', () => {
  closeDialog($('dlg-result'));
  if (!session) return;
  const { mode, n, level, fairStart, practice } = session;
  // Colours alternate between games against the computer.
  const youPlay = mode === 'cpu' && !practice ? 1 - session.youPlay : 0;
  startGame({ mode, n: practice ? 9 : n, level: practice ? 'easy' : level, fairStart: practice ? false : fairStart, youPlay, practice });
});
$('btn-result-howto').addEventListener('click', () => {
  closeDialog($('dlg-result'));
  openTutorial();
});

function openSettings() {
  $('set-sound').checked = settings.sound;
  $('set-motion').checked = settings.reduceMotion;
  $('set-onetap').checked = settings.placing === 'one-tap';
  $('set-level').value = settings.level;
  $('set-helper').value = settings.threatHelper;
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
$('set-onetap').addEventListener('change', (e) => {
  settings.placing = e.target.checked ? 'one-tap' : 'preview';
  saveSettings();
  if (session && !$('screen-play').hidden) {
    session.preview = -1;
    render();
  }
});
$('set-level').addEventListener('change', (e) => {
  settings.level = e.target.value;
  saveSettings();
});
$('set-helper').addEventListener('change', (e) => {
  settings.threatHelper = e.target.value;
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
window.__gm = {
  get session() { return session; },
};
