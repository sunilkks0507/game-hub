// Interactive tutorial: five steps, learn by doing. The player makes one move per task.
// The lesson positions are plain data (TUTORIAL_STEPS) so the tests can check every one.

import { newGame, fromPieces, legalMoves, findMove, applyMove, parseSquare, squareName } from './engine.js';
import { createBoard } from './board.js';

export const TUTORIAL_STEPS = [
  {
    title: 'The goal',
    tasks: [
      {
        pieces: ['wK e1', 'wR b1', 'wR a7', 'bK h8'],
        text: 'You win by trapping the enemy Raja (king) so it cannot escape. The black Raja is almost trapped. Tap your Ratha on b1, then tap b8.',
        from: 'b1',
        to: 'b8',
        success: 'Checkmate! The black Raja is under attack and has no safe square left. That wins the game.',
      },
    ],
  },
  {
    title: 'Ratha, Ashva and Raja',
    tasks: [
      {
        pieces: ['wK e1', 'wR a1', 'bK h8', 'bP a6'],
        text: 'The Ratha (tower) slides any distance along a row or column. Capture the black Padati on a6.',
        from: 'a1',
        to: 'a6',
        success: 'The Ratha stops where it captures.',
      },
      {
        pieces: ['wK e1', 'wA d4', 'bK h8', 'bP e6'],
        text: 'The Ashva (horse) jumps in an L: two squares one way, then one to the side. It can jump over pieces. Capture the Padati on e6.',
        from: 'd4',
        to: 'e6',
        success: 'That is the L-jump: two squares, then one to the side.',
      },
      {
        pieces: ['wK e4', 'bK h8', 'bP e5'],
        text: 'The Raja steps one square in any direction. Capture the Padati on e5.',
        from: 'e4',
        to: 'e5',
        success: 'The Raja is slow, but it matters most. Never leave it in danger.',
      },
    ],
  },
  {
    title: 'Mantri and Gaja',
    tasks: [
      {
        pieces: ['wK e1', 'wM d4', 'bK h8', 'bP e5'],
        text: 'The Mantri (counsellor) steps one square diagonally. Capture the Padati on e5.',
        from: 'd4',
        to: 'e5',
        success: 'One diagonal step. The Mantri is a helper, not a queen.',
      },
      {
        pieces: ['wK e1', 'wG c3', 'wP d4', 'bK h8', 'bP e5'],
        text: 'The Gaja (elephant) leaps exactly two squares diagonally, over anything in between. Capture the Padati on e5.',
        from: 'c3',
        to: 'e5',
        success: 'It jumped right over your own Padati.',
      },
    ],
  },
  {
    title: 'The Padati',
    tasks: [
      {
        pieces: ['wK e1', 'wP c2', 'bK h8'],
        text: 'The Padati (foot soldier) steps one square forward. Move it to c3.',
        from: 'c2',
        to: 'c3',
        success: 'One step at a time. There is no double step in Chaturanga.',
      },
      {
        pieces: ['wK e1', 'wP c4', 'bK h8', 'bP c5', 'bP d5'],
        text: 'A Padati captures one square diagonally forward. It cannot capture straight ahead. Capture the Padati on d5.',
        from: 'c4',
        to: 'd5',
        success: 'Diagonal captures only.',
      },
      {
        pieces: ['wK e1', 'wP g7', 'bK a8'],
        text: 'Reach the far row and the Padati becomes a Mantri. Move it to g8.',
        from: 'g7',
        to: 'g8',
        success: 'It is now a Mantri.',
      },
    ],
  },
  {
    title: 'Your turn',
    practice: true,
    text: 'That is everything. One last rule: a player with no legal move, or with only a Raja left, loses. Ready for a short practice game against the Easy bot?',
  },
];

const PIECE_WORD = { K: 'Raja', M: 'Mantri', G: 'Gaja', A: 'Ashva', R: 'Ratha', P: 'Padati' };

// Wires the tutorial screen. `ui` holds the elements; callbacks tell the app what to do next.
export function createTutorial({ ui, sound, onFinish, onPractice }) {
  let stepIndex = 0;
  let taskIndex = 0;
  let state = null;
  let selected = null;
  let done = false;
  let wrongTries = 0;
  let lastMove = null;

  const board = createBoard(ui.board, { onTap: handleTap });

  const step = () => TUTORIAL_STEPS[stepIndex];
  const task = () => (step().practice ? null : step().tasks[taskIndex]);

  function loadTask() {
    const t = task();
    selected = null;
    done = false;
    wrongTries = 0;
    lastMove = null;
    state = t ? fromPieces(t.pieces, 'w') : newGame();
    ui.feedback.textContent = '';
    ui.feedback.className = 'tutorial-feedback';
    draw();
  }

  function draw() {
    const s = step();
    const t = task();
    ui.stepLabel.textContent = `Step ${stepIndex + 1} of ${TUTORIAL_STEPS.length}: ${s.title}`;
    ui.dots.replaceChildren(
      ...TUTORIAL_STEPS.map((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'dot' + (i === stepIndex ? ' on' : i < stepIndex ? ' past' : '');
        return dot;
      }),
    );
    ui.text.textContent = s.practice ? s.text : t.text;
    ui.taskCount.textContent = !s.practice && s.tasks.length > 1 ? `Task ${taskIndex + 1} of ${s.tasks.length}` : '';

    const targets = new Map();
    if (t && selected !== null) {
      for (const m of legalMoves(state, selected)) targets.set(m.to, m.captured ? 'capture' : 'move');
    }
    const hints = [];
    if (t && !done) {
      hints.push(parseSquare(t.from));
      if (wrongTries > 0) hints.push(parseSquare(t.to));
    }
    board.render(state, { selected, targets, hints, lastMove, disabled: done || s.practice === true });

    ui.practice.hidden = !s.practice;
    ui.next.hidden = Boolean(s.practice);
    ui.next.disabled = !done;
    ui.next.textContent = isLastTask() ? 'Next step' : 'Next';
  }

  function isLastTask() {
    const s = step();
    return s.practice || taskIndex === s.tasks.length - 1;
  }

  function handleTap(sq) {
    const t = task();
    if (!t || done) return;
    sound.unlock();
    const piece = state.board[sq];
    if (selected !== null) {
      const move = findMove(state, selected, sq);
      if (move) {
        if (squareName(move.from) === t.from && squareName(move.to) === t.to) {
          applyMove(state, move);
          lastMove = [move.from, move.to];
          done = true;
          selected = null;
          sound.play(move.captured ? 'capture' : 'move');
          setTimeout(() => sound.play('success'), 140);
          ui.feedback.textContent = t.success;
          ui.feedback.className = 'tutorial-feedback good';
        } else {
          wrongTries++;
          selected = null;
          sound.play('error');
          const from = state.board[parseSquare(t.from)];
          ui.feedback.textContent = `Good try! For this task, move the ${PIECE_WORD[from[1]]} from ${t.from} to ${t.to}.`;
          ui.feedback.className = 'tutorial-feedback nudge';
        }
        draw();
        return;
      }
    }
    if (piece && piece[0] === 'w') {
      selected = sq;
      sound.play('tap');
    } else {
      selected = null;
    }
    draw();
  }

  ui.next.addEventListener('click', () => {
    sound.unlock();
    if (!done) return;
    const s = step();
    if (taskIndex < s.tasks.length - 1) {
      taskIndex++;
    } else {
      stepIndex++;
      taskIndex = 0;
    }
    loadTask();
    ui.text.focus();
  });
  ui.skip.addEventListener('click', () => onFinish());
  ui.practiceButton.addEventListener('click', () => onPractice());
  ui.finishButton.addEventListener('click', () => onFinish());

  return {
    start() {
      stepIndex = 0;
      taskIndex = 0;
      loadTask();
    },
  };
}
