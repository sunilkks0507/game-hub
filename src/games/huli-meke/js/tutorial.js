// Interactive 5-step Tutorial for Huli Meke
// Strictly adheres to MASTER_SPEC.md section 5.3 and frame 7

import { renderBoardSVG } from './board-view.js';
import { showScreen } from './main.js';

export const TUTORIAL_STEPS = [
  {
    step: 1,
    indicator: 'Step 1 of 5: Place goats & lambs',
    title: 'Place pieces one per turn',
    body: 'Goats (or lambs) are placed one per turn on any empty point. Goats always move first.\n• Standard: 3 tigers vs 15 goats\n• Mini: 1 tiger vs 5 lambs',
    pieces: { A: 'T', R1_2: 'T', R1_3: 'T' },
    legalTargets: ['R1_0', 'R1_1', 'R1_4', 'R1_5', 'R2_0', 'R2_1', 'R2_2', 'R2_3', 'R2_4', 'R2_5'],
    selectedNode: null
  },
  {
    step: 2,
    indicator: 'Step 2 of 5: Moving phase',
    title: 'Slide a goat or lamb',
    body: 'After all pieces are placed (15 in Standard, 5 in Mini), a goat or lamb steps one point along a line to an adjacent empty spot. Goats cannot jump.',
    // Frame 7 mockup layout:
    pieces: { A: 'T', R1_2: 'T', R1_3: 'T', R2_2: 'G', R3_2: 'G' },
    legalTargets: ['R3_1', 'R3_3', 'B_1'],
    selectedNode: 'R3_2'
  },
  {
    step: 3,
    indicator: 'Step 3 of 5: Tiger moves',
    title: 'Tiger steps and jumps',
    body: 'A tiger steps one point, or jumps over an adjacent goat/lamb to the empty point right behind it on the same line. A jump captures that piece. No chain jumps.',
    pieces: { R2_2: 'T', R2_3: 'G', R3_1: 'T', B_3: 'T', R1_3: 'G' },
    legalTargets: ['R1_2', 'R2_4', 'R2_0'],
    selectedNode: 'R2_2'
  },
  {
    step: 4,
    indicator: 'Step 4 of 5: Tiger victory',
    title: 'Tigers win by capturing',
    body: 'Tigers win by capturing their target:\n• Standard mode: 5 captures\n• Mini mode: 2 captures',
    pieces: { R1_2: 'T', R2_3: 'T', B_2: 'T', R3_4: 'G', B_0: 'G' },
    legalTargets: [],
    selectedNode: null
  },
  {
    step: 5,
    indicator: 'Step 5 of 5: Goat victory',
    title: 'Goats & lambs win by trapping',
    body: 'Goats (or lambs) win by trapping every tiger so none has any legal move (step or jump). Goats pass their turn if blocked.',
    pieces: {
      A: 'T', R1_1: 'G', R1_2: 'G', R1_3: 'G', R1_4: 'G',
      R2_1: 'G', R2_2: 'T', R2_3: 'G', R2_4: 'G',
      R3_1: 'G', R3_2: 'G', R3_3: 'T', R3_4: 'G'
    },
    legalTargets: [],
    selectedNode: null
  }
];

export class TutorialController {
  constructor(appState) {
    this.appState = appState;
    this.currentStepIndex = 0;
  }

  start() {
    this.currentStepIndex = 0;
    this.renderStep();
    showScreen('screen-tutorial');
  }

  next() {
    if (this.currentStepIndex < TUTORIAL_STEPS.length - 1) {
      this.currentStepIndex++;
      this.renderStep();
    } else {
      showScreen('screen-home');
    }
  }

  back() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.renderStep();
    }
  }

  renderStep() {
    const step = TUTORIAL_STEPS[this.currentStepIndex];
    const classic = this.appState.boards.find(b => b.id === 'classic') || this.appState.boards[0];

    const indEl = document.getElementById('tutorial-step-indicator');
    const titleEl = document.getElementById('tutorial-step-title');
    const bodyEl = document.getElementById('tutorial-step-body');
    const boxEl = document.getElementById('tutorial-board-box');
    const backBtn = document.getElementById('btn-tutorial-back');
    const nextBtn = document.getElementById('btn-tutorial-next');

    if (indEl) indEl.textContent = step.indicator;
    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) {
      bodyEl.style.whiteSpace = 'pre-line';
      bodyEl.textContent = step.body;
    }

    if (boxEl && classic) {
      boxEl.innerHTML = renderBoardSVG(classic, {
        pieces: step.pieces,
        legalTargets: step.legalTargets,
        selectedNode: step.selectedNode,
        size: 230
      });
    }

    if (backBtn) {
      backBtn.disabled = this.currentStepIndex === 0;
    }
    if (nextBtn) {
      nextBtn.textContent = this.currentStepIndex === TUTORIAL_STEPS.length - 1 ? 'Done' : 'Next';
    }
  }
}
