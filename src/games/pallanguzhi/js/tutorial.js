// Guided tutorial: Bija the seed leads four short steps, then offers a practice game.
// Each step is a tiny hand-made position played with the real engine, so what the child
// sees is exactly what the rules do. A wrong tap only shows a friendly nudge.

import { newGame, applyMove, legalPits } from './engine.js';
import { animate } from './animate.js';

// pits[0-6] is the child's row, pits[7-13] the rival's row.
export const SCENARIOS = {
  sow: {
    pits: [3, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0],
    target: 0,
    expect: 'sow',
    good: 'Three seeds, three pits: one seed in each!',
  },
  relay: {
    pits: [2, 0, 0, 3, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    target: 0,
    expect: 'relay',
    good: 'The last seed met a full pit, so I picked it up and kept going!',
  },
  capture: {
    pits: [0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0],
    target: 2,
    expect: 'capture',
    good: 'The last seed met an empty pit, so I took the pit after it!',
  },
};

export const STEPS = [
  { id: 'goal', type: 'view', text: "Hi, I'm Bija! Collect more seeds in your pile than your rival." },
  { id: 'sow', type: 'move', scenario: 'sow', text: "Tap the glowing pit. I'll sow its seeds, one in each pit." },
  { id: 'relay', type: 'move', scenario: 'relay', text: 'Tap the glowing pit. Watch what happens at the end!' },
  { id: 'capture', type: 'move', scenario: 'capture', text: 'Tap the glowing pit. Can you spot the capture?' },
  { id: 'practice', type: 'practice', text: "You're ready! Want a practice game against Easy?" },
];

export function scenarioState(name) {
  const state = newGame();
  state.pits = SCENARIOS[name].pits.slice();
  return state;
}

// Used by tests: which kinds of events a scenario produces when its target pit is played.
export function scenarioKinds(name) {
  const state = scenarioState(name);
  const result = applyMove(state, SCENARIOS[name].target, { record: true });
  return { kinds: new Set(result.events.map((e) => e.t)), captured: result.captured };
}

export function createTutorial({ ui, sound, createBoard, onFinish, onPractice }) {
  let board = null;
  let step = 0;
  let busy = false;
  let done = false; // the current move step has been completed
  let token = 0;
  let skipAnimation = false;

  const startPits = () => newGame().pits;

  function paintBoard(view, extra = {}) {
    board.render(view, {
      enabled: extra.enabled || new Set(),
      hint: extra.hint,
      active: extra.active,
      kind: extra.kind,
      rows: ['Your row', "Rival's row"],
    });
    ui.pile.textContent = String(view.stores[0]);
  }

  function show() {
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
    ui.feedback.textContent = '';
    ui.feedback.className = 'tutorial-feedback';
    ui.taskCount.textContent = '';
    done = false;
    busy = false;
    skipAnimation = false;
    const isMove = s.type === 'move';
    const isPractice = s.type === 'practice';
    ui.next.hidden = isPractice;
    ui.next.disabled = isMove;
    ui.next.textContent = 'Next';
    ui.practice.hidden = !isPractice;

    if (isMove) {
      const scn = SCENARIOS[s.scenario];
      const state = scenarioState(s.scenario);
      paintBoard({ pits: state.pits, stores: [0, 0], hand: 0 }, { enabled: new Set(legalPits(state)), hint: scn.target });
    } else {
      paintBoard({ pits: startPits(), stores: [0, 0], hand: 0 });
    }
    ui.text.focus();
  }

  async function onTap(pit) {
    const s = STEPS[step];
    if (s.type !== 'move') return;
    if (busy) {
      skipAnimation = true;
      return;
    }
    if (done) return;
    sound.unlock();
    const scn = SCENARIOS[s.scenario];
    if (pit !== scn.target) {
      sound.play('error');
      ui.feedback.textContent = 'Try the glowing pit!';
      ui.feedback.className = 'tutorial-feedback nudge';
      return;
    }
    busy = true;
    const mine = token;
    const state = scenarioState(s.scenario);
    const start = { pits: state.pits.slice(), stores: [0, 0] };
    const result = applyMove(state, pit, { record: true });
    ui.feedback.textContent = '';
    const finished = await animate({
      start,
      events: result.events,
      mover: 0,
      sound,
      isSkipped: () => skipAnimation || document.documentElement.classList.contains('reduce-motion'),
      isCancelled: () => mine !== token,
      render: (view, info) => {
        paintBoard(view, { active: info.active, kind: info.kind });
        ui.taskCount.textContent = view.hand > 0 ? `Seeds in hand: ${view.hand}` : '';
      },
    });
    if (!finished || mine !== token) return;
    busy = false;
    done = true;
    paintBoard({ pits: state.pits, stores: state.stores, hand: 0 });
    ui.taskCount.textContent = '';
    ui.feedback.textContent = scn.good;
    ui.feedback.className = 'tutorial-feedback good';
    sound.play('success');
    ui.next.disabled = false;
    ui.next.focus();
  }

  function advance() {
    if (step < STEPS.length - 1) {
      step += 1;
      show();
    }
  }

  function finish() {
    token += 1;
    onFinish();
  }

  ui.next.addEventListener('click', () => {
    sound.unlock();
    advance();
  });
  ui.skip.addEventListener('click', finish);
  ui.finishButton.addEventListener('click', finish);
  ui.practiceButton.addEventListener('click', () => {
    token += 1;
    onPractice();
  });

  return {
    start() {
      token += 1;
      if (!board) board = createBoard(ui.board, { onTap });
      step = 0;
      show();
    },
    // for tests in a browser
    get step() {
      return step;
    },
    legalPits,
  };
}
