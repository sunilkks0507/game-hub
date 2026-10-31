// Guided tutorial: Mani the bead leads five short steps on a 9x9 board.
// Each step is a tiny position loaded into the real engine, so what the child sees is exactly what the rules do.
// A wrong tap only shows a friendly nudge and never dead-ends.

import { fromStones, place, winPoints } from './engine.js';

export const N = 9;
const at = (r, c) => r * N + c;

// Tutorial positions. Black is the learner. Stone lists are point ids.
export const SCENARIOS = {
  // Five lit up as a picture.
  goal: { black: [at(4, 2), at(4, 3), at(4, 4), at(4, 5), at(4, 6)], white: [at(1, 1), at(1, 3), at(7, 7), at(7, 5)], current: 1 },
  // An empty board with one glowing point.
  place: { black: [], white: [], current: 0, target: at(4, 4) },
  // Three in a row with both ends open. Make four, the rival blocks one end, make five on the other.
  grow: {
    black: [at(4, 3), at(4, 4), at(4, 5)],
    white: [at(1, 1), at(1, 7), at(7, 1)],
    current: 0,
    target: at(4, 6),
    rivalBlock: at(4, 7),
    finish: at(4, 2),
  },
  // The rival has four with one end already covered. Block the open end.
  block: {
    black: [at(2, 1), at(6, 6), at(6, 7), at(7, 2)],
    white: [at(2, 2), at(2, 3), at(2, 4), at(2, 5)],
    current: 0,
    target: at(2, 6),
  },
};

export const STEPS = [
  { id: 'goal', type: 'view', scenario: 'goal', text: "Hi, I'm Mani! Make five stones in a row to win." },
  { id: 'place', type: 'move', scenario: 'place', text: 'Tap the glowing point, then tap again to place a stone.' },
  { id: 'grow', type: 'move', scenario: 'grow', text: 'You have three. Place the glowing stone to make four.' },
  { id: 'block', type: 'move', scenario: 'block', text: 'Your rival has four! Block the glowing end.' },
  { id: 'practice', type: 'practice', text: "You're ready! Want a practice game against Easy?" },
];

export function scenarioState(name) {
  const s = SCENARIOS[name];
  return fromStones(N, s.black, s.white, s.current);
}

export function createTutorial({ ui, sound, createBoard, onFinish, onPractice, reduceMotion = () => false }) {
  let board = null;
  let step = 0;
  let state = null;
  let done = false;
  let tries = 0;
  let locked = false;
  let stage = 0; // 'grow' has two moves
  let preview = -1;
  let token = 0;
  let timer = null;
  let last = -1;
  let winLine = null;

  function paint(extra = {}) {
    board.render(state, {
      enabled: Boolean(extra.enabled),
      preview,
      previewColour: 0,
      glow: extra.glow || new Set(),
      last,
      winLine,
      animate: !reduceMotion(),
      names: ['Black', 'White'],
    });
    ui.place.disabled = preview < 0;
  }

  function setFeedback(text, kind = '') {
    ui.feedback.textContent = text;
    ui.feedback.className = `tutorial-feedback ${kind}`.trim();
  }

  function target() {
    const s = SCENARIOS[STEPS[step].scenario];
    return stage === 0 ? s.target : s.finish;
  }

  function show() {
    clearTimeout(timer);
    const s = STEPS[step];
    ui.stepLabel.textContent = `Step ${step + 1} of ${STEPS.length}`;
    ui.dots.replaceChildren(
      ...STEPS.map((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'dot' + (i === step ? ' on' : i < step ? ' past' : '');
        return dot;
      }),
    );
    ui.text.textContent = s.text;
    setFeedback('');
    done = false;
    locked = false;
    tries = 0;
    stage = 0;
    preview = -1;
    last = -1;
    winLine = null;
    const isMove = s.type === 'move';
    const isPractice = s.type === 'practice';
    ui.next.hidden = isPractice;
    ui.next.disabled = isMove;
    ui.practice.hidden = !isPractice;
    ui.placeRow.hidden = !isMove;
    state = isPractice ? scenarioState('place') : scenarioState(s.scenario);
    if (s.type === 'view') {
      winLine = SCENARIOS.goal.black.slice();
      last = SCENARIOS.goal.black[4];
      paint();
    } else if (isMove) paint({ enabled: true, glow: new Set([SCENARIOS[s.scenario].target]) });
    else paint();
    ui.text.focus();
  }

  function finishStep(message) {
    done = true;
    locked = false;
    preview = -1;
    paint();
    setFeedback(message, 'good');
    ui.next.disabled = false;
    ui.next.focus();
  }

  // Put the stone down for the learner (Black).
  function placeStone(p) {
    const res = place(state, p);
    if (!res) return null;
    sound.play('stone');
    preview = -1;
    last = p;
    if (res.won) winLine = state.winLine;
    return res;
  }

  function resetBlock() {
    state = scenarioState('block');
    winLine = null;
    last = -1;
    preview = -1;
    locked = false;
    paint({ enabled: true, glow: new Set([SCENARIOS.block.target]) });
    setFeedback('Try the glowing point.', 'nudge');
  }

  function commit() {
    const s = STEPS[step];
    if (s.type !== 'move' || done || locked || preview < 0) return;
    const scn = SCENARIOS[s.scenario];
    const p = preview;

    if (s.scenario === 'block' && p !== scn.target) {
      // Wrong spot: the rival really does make five, then we try again.
      tries += 1;
      placeStone(p);
      locked = true;
      paint();
      const mine = token;
      timer = setTimeout(() => {
        if (mine !== token) return;
        placeStone2(scn.target);
        paint();
        sound.play('lose');
        setFeedback('Oops, they made five. Block the glowing end.', 'nudge');
        timer = setTimeout(() => {
          if (mine !== token) return;
          if (tries >= 2) {
            setFeedback("That's okay! Always cover the end of a four.", 'good');
            done = true;
            locked = false;
            ui.next.disabled = false;
            ui.next.focus();
            return;
          }
          resetBlock();
        }, 1500);
      }, 700);
      return;
    }

    if (p !== target()) {
      sound.play('error');
      preview = -1;
      paint({ enabled: true, glow: new Set([target()]) });
      setFeedback('Try the glowing point!', 'nudge');
      return;
    }

    placeStone(p);
    if (s.scenario === 'place') {
      finishStep('Nice! A stone stays where you put it.');
    } else if (s.scenario === 'block') {
      finishStep('Blocked! Their four cannot finish.');
    } else if (stage === 0) {
      // Four made: the rival can cover only one end.
      locked = true;
      paint();
      setFeedback('Four! Both ends are open...', 'good');
      const mine = token;
      timer = setTimeout(() => {
        if (mine !== token) return;
        placeStone2(scn.rivalBlock);
        stage = 1;
        locked = false;
        paint({ enabled: true, glow: new Set([scn.finish]) });
        setFeedback('They blocked one end. The other is open. Place it!', 'nudge');
      }, 800);
    } else {
      sound.play('win');
      finishStep('Five! They could only block one end.');
      paint();
    }
  }

  // The rival's stone (White) goes down without a preview.
  function placeStone2(p) {
    const res = place(state, p);
    if (res) {
      sound.play('stone');
      last = p;
      if (res.won) winLine = state.winLine;
    }
  }

  function onTap(p) {
    const s = STEPS[step];
    if (s.type !== 'move' || done || locked) return;
    sound.unlock();
    if (state.cells[p] !== -1) return;
    if (p === preview) {
      commit();
      return;
    }
    preview = p;
    sound.play('tap');
    paint({ enabled: true, glow: new Set([target()]) });
  }

  ui.place.addEventListener('click', () => {
    sound.unlock();
    commit();
  });
  ui.next.addEventListener('click', () => {
    sound.unlock();
    if (step < STEPS.length - 1) {
      step += 1;
      show();
    }
  });
  const finish = () => {
    token += 1;
    clearTimeout(timer);
    onFinish();
  };
  ui.skip.addEventListener('click', finish);
  ui.finishButton.addEventListener('click', finish);
  ui.practiceButton.addEventListener('click', () => {
    token += 1;
    clearTimeout(timer);
    onPractice();
  });

  return {
    start() {
      token += 1;
      if (!board) board = createBoard(ui.board, { onTap, onEscape: () => { preview = -1; paint({ enabled: true, glow: new Set([target()]) }); } });
      step = 0;
      show();
    },
    get step() {
      return step;
    },
    winPoints,
  };
}
