// Guided tutorial: Pip leads five short steps on a real frame (the engine runs it, so the rules are the real rules).
// Steps 2 to 4 are done by tapping. A wrong tap only gives a friendly nudge and never dead-ends.
// The text has no digits, so it works for the Dots level too (numerals are shown only when `numerals` is true).

import { createFrame, plant, isComplete, needed, EMPTY } from './engine.js';
import { renderStatus, renderPair, el } from './view.js';

export const TUTORIAL_LEVEL = 2;
export const TUTORIAL_GIVEN = 6;

// type: 'view' (just read), 'plant' (tap `count` empty cells), 'levels' (the last screen).
// `pre` are cells already planted by the child when the step opens.
export const STEPS = [
  { id: 'goal', type: 'view', pre: [], text: "Hi, I'm Pip! Fill the frame with seeds." },
  { id: 'plant', type: 'plant', pre: [], count: 1, text: 'Tap a glowing cell to plant a seed.' },
  { id: 'fill', type: 'plant', pre: [6], count: 3, text: 'Keep planting until the frame is full.' },
  { id: 'practice', type: 'plant', pre: [], count: 6, free: true, text: 'Your turn! Fill this frame yourself.' },
  { id: 'levels', type: 'levels', pre: [], text: 'Four gardens to try. Five flowers make a garden!' },
];

export function stepState(step) {
  let state = createFrame(TUTORIAL_LEVEL, step.free ? 4 : TUTORIAL_GIVEN);
  for (const id of step.pre) state = plant(state, id).state;
  return state;
}

export function createTutorial({ ui, sound, createBoard, numerals = true, onFinish, onPlay }) {
  const showNumerals = () => (typeof numerals === 'function' ? numerals() : numerals);
  let step = 0;
  let state = null;
  let planted = 0;
  let done = false;
  let hintCell = -1;
  const board = createBoard(ui.board, { onTap });

  function setFeedback(text, kind = '') {
    ui.feedback.textContent = text;
    ui.feedback.className = `tutorial-feedback ${kind}`.trim();
  }

  function paint() {
    const s = STEPS[step];
    const isLevels = s.type === 'levels';
    ui.board.hidden = isLevels;
    ui.status.hidden = isLevels;
    if (isLevels) {
      ui.pair.hidden = true;
      return;
    }
    const glow = new Set();
    if (s.type === 'plant' && !done) {
      if (s.free) {
        if (hintCell >= 0) glow.add(hintCell);
      } else {
        state.cells.forEach((c, i) => { if (c === EMPTY) glow.add(i); });
      }
    } else if (s.type === 'view') {
      state.cells.forEach((c, i) => { if (c === EMPTY) glow.add(i); });
    }
    board.render(state, { enabled: s.type === 'plant' && !done, glow });
    renderStatus(ui.status, state, showNumerals());
    if (isComplete(state)) renderPair(ui.pair, state, showNumerals());
    else ui.pair.hidden = true;
  }

  function show() {
    const s = STEPS[step];
    ui.stepLabel.textContent = `Step ${step + 1} of ${STEPS.length}`;
    ui.dots.replaceChildren(
      ...STEPS.map((_, i) => el('span', 'pip-dot' + (i === step ? ' on' : i < step ? ' past' : ''))),
    );
    ui.text.textContent = s.text;
    setFeedback('');
    state = stepState(s);
    planted = 0;
    done = s.type !== 'plant';
    hintCell = -1;
    const last = s.type === 'levels';
    ui.next.hidden = last;
    ui.next.disabled = s.type === 'plant';
    ui.final.hidden = !last;
    ui.hint.hidden = !s.free;
    paint();
    if (last) ui.play.focus();
    else ui.text.focus();
  }

  function onTap(id, element) {
    const s = STEPS[step];
    if (s.type !== 'plant' || done) return;
    sound.unlock();
    const result = plant(state, id);
    if (!result.ok) {
      sound.play('error');
      setFeedback('That one is full. Try an empty one!', 'nudge');
      return;
    }
    state = result.state;
    planted += 1;
    hintCell = -1;
    sound.play('seed', planted);
    if (planted >= s.count || isComplete(state)) {
      done = true;
      sound.play(isComplete(state) ? 'success' : 'pick');
      setFeedback(isComplete(state) ? 'The frame is full. Well done!' : 'Nice! A seed is planted.', 'good');
      ui.next.disabled = false;
      paint();
      ui.next.focus();
    } else {
      setFeedback('');
      paint();
      const next = board.cell(id);
      if (next) next.focus();
    }
  }

  function hint() {
    if (done || !state) return;
    sound.unlock();
    hintCell = state.cells.indexOf(EMPTY);
    sound.play('hint');
    setFeedback(`${needed(state) === 1 ? 'One more seed' : 'Some more seeds'} to go. Try the glowing cell!`, 'good');
    paint();
  }

  function next() {
    if (step < STEPS.length - 1) {
      step += 1;
      show();
    }
  }

  ui.next.addEventListener('click', () => { sound.unlock(); sound.play('tap'); next(); });
  ui.hint.addEventListener('click', hint);
  ui.skip.addEventListener('click', () => onFinish());
  ui.play.addEventListener('click', () => { sound.play('tap'); onPlay(); });
  ui.finish.addEventListener('click', () => onFinish());

  return {
    start() {
      step = 0;
      show();
    },
  };
}
