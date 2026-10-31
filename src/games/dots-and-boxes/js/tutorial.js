// Guided tutorial: Bindu the dot leads five short steps on a 3x3 board.
// Each step is a tiny position loaded into the real engine, so what the child sees is exactly what the rules do.
// A wrong tap only shows a friendly nudge and never dead-ends.

import { fromEdges, applyMove, legalMoves, moveKind, availableBoxes, missingEdge, cloneState } from './engine.js';

export const N = 3;

// Edge ids on 3x3: horizontal r*3+c (0..11), vertical 12 + r*4 + c.
export const SCENARIOS = {
  draw: { edges: [], target: 4, any: true },
  close: { edges: [0, 3, 12], target: 13 },
  trap: { edges: [0, 12], target: 8 },
};

export const STEPS = [
  { id: 'goal', type: 'view', text: "Hi, I'm Bindu! Close more boxes than your rival." },
  { id: 'draw', type: 'move', scenario: 'draw', text: 'Tap the glowing line to draw it.' },
  { id: 'close', type: 'move', scenario: 'close', text: 'This box has three sides. Tap the glowing fourth side!' },
  { id: 'trap', type: 'move', scenario: 'trap', text: "Don't give a third side! Tap the glowing safe line." },
  { id: 'practice', type: 'practice', text: "You're ready! Want a practice game against Easy?" },
];

export function scenarioState(name) {
  return fromEdges(N, SCENARIOS[name].edges, 0);
}

export function createTutorial({ ui, sound, createBoard, onFinish, onPractice }) {
  let board = null;
  let step = 0;
  let state = null;
  let done = false;
  let tries = 0;
  let locked = false;
  let token = 0;
  let timer = null;
  let owners = []; // who drew each line, for colour

  const view = () => ({ n: N, edges: state.edges, owner: state.owner });

  function paint(extra = {}) {
    board.render(view(), {
      enabled: Boolean(extra.enabled),
      glow: extra.glow || new Set(),
      warn: extra.warn || new Set(),
      owners,
      last: extra.last,
      names: ['You', 'Rival'],
    });
    ui.score.textContent = `Your boxes: ${state.scores[0]}`;
  }

  function dangerLines() {
    return new Set(legalMoves(state).filter((e) => moveKind(state, e) === 'danger'));
  }

  function setFeedback(text, kind = '') {
    ui.feedback.textContent = text;
    ui.feedback.className = `tutorial-feedback ${kind}`.trim();
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
    const isMove = s.type === 'move';
    const isPractice = s.type === 'practice';
    ui.next.hidden = isPractice;
    ui.next.disabled = isMove;
    ui.practice.hidden = !isPractice;
    state = isMove ? scenarioState(s.scenario) : fromEdges(N, [], 0);
    owners = [];
    if (isMove) SCENARIOS[s.scenario].edges.forEach((e, i) => { owners[e] = i % 2; });
    if (isMove) paint({ enabled: true, glow: new Set([SCENARIOS[s.scenario].target]) });
    else paint();
    ui.text.focus();
  }

  function finishStep(message, last) {
    done = true;
    locked = false;
    paint({ last });
    setFeedback(message, 'good');
    ui.next.disabled = false;
    ui.next.focus();
  }

  function onTap(edge) {
    const s = STEPS[step];
    if (s.type !== 'move' || done || locked) return;
    sound.unlock();
    const scn = SCENARIOS[s.scenario];

    if (s.scenario === 'trap' && edge !== scn.target && moveKind(state, edge) === 'danger') {
      // The child gave a box away: show the rival taking it, then try again.
      tries += 1;
      applyMove(state, edge);
      owners[edge] = 0;
      sound.play('line');
      locked = true;
      paint({ last: edge });
      setFeedback('Oops, that gave them a box.', 'nudge');
      const mine = token;
      timer = setTimeout(() => {
        if (mine !== token) return;
        const taken = availableBoxes(state);
        if (taken.length) {
          const take = missingEdge(state, taken[0]);
          applyMove(state, take);
          owners[take] = 1;
          sound.play('box', 0);
        }
        state.owner = state.owner.slice();
        paint({ last: undefined, warn: new Set() });
        if (tries >= 2) {
          setFeedback("That's okay! Avoid a box with three sides.", 'good');
          done = true;
          locked = false;
          ui.next.disabled = false;
          ui.next.focus();
          return;
        }
        timer = setTimeout(() => {
          if (mine !== token) return;
          state = scenarioState('trap');
          owners = [];
          SCENARIOS.trap.edges.forEach((e, i) => { owners[e] = i % 2; });
          locked = false;
          paint({ enabled: true, glow: new Set([scn.target]), warn: dangerLines() });
          setFeedback('Try the glowing line.', 'nudge');
        }, 1400);
      }, 900);
      return;
    }

    if (!scn.any && edge !== scn.target) {
      sound.play('error');
      setFeedback('Try the glowing line!', 'nudge');
      return;
    }

    const result = applyMove(state, edge);
    if (!result) return;
    owners[edge] = 0;
    sound.play('line');
    if (s.scenario === 'draw') {
      finishStep('Nice! One line drawn. Players take turns.', edge);
    } else if (s.scenario === 'close') {
      sound.play('box', 0);
      finishStep('Box closed! It is yours, and you go again.', edge);
    } else {
      finishStep('Safe! No box for your rival.', edge);
    }
  }

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
      if (!board) board = createBoard(ui.board, { onTap });
      step = 0;
      show();
    },
    get step() {
      return step;
    },
    cloneState,
  };
}
