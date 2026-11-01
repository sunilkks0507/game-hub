// Guided tutorial: Gilu leads four short steps on a real sale (the engine runs it, so the rules are the real rules).
// A wrong tap only gives a friendly nudge and never dead-ends. Every step can be skipped.

import { createSale, addPiece, trayValues } from './engine.js';
import { createShop, el, money } from './shop.js';

export const TUTORIAL_LEVEL = 1;

// type: 'view' (just read), 'add' (tap any coin once), 'pay' (finish the sale).
// `pre` are pieces already in the till when the step opens. `glow` lights a tray piece.
export const STEPS = [
  { id: 'goal', type: 'view', itemId: 'pencil', price: 7, pre: [], glow: [], text: 'Hi, I am Gilu! This customer wants a pencil.' },
  { id: 'coin', type: 'add', itemId: 'pencil', price: 7, pre: [], glow: [5], text: 'Tap the glowing ₹5 coin.' },
  { id: 'pay', type: 'pay', itemId: 'pencil', price: 7, pre: [5], glow: [2], text: 'Add ₹2 to make ₹7. Then press Pay.' },
  { id: 'practice', type: 'pay', itemId: 'balloon', price: 9, pre: [], glow: [], text: 'Your turn! Pay ₹9 for the balloon.' },
];

export function stepSale(step) {
  let sale = createSale(TUTORIAL_LEVEL, { itemId: step.itemId, price: step.price });
  for (const v of step.pre) sale = addPiece(sale, v).state;
  return sale;
}

export function createTutorial({ ui, sound, announce, onFinish, onPlay }) {
  let step = 0;
  let done = false;
  const shop = createShop(ui.shop, {
    sound, announce, jar: false,
    onAdd: ({ value, ok }) => {
      const s = STEPS[step];
      if (!ok || done) return;
      if (s.type === 'add') {
        finishStep(value === 5 ? `Nice! ${money(5)} is in the till.` : 'Good try! Any coin works. Let us go on.');
      } else if (s.type === 'pay' && s.glow.length && !s.glow.includes(value)) {
        setFeedback(`Try the ${money(s.glow[0])} one!`, 'nudge');
      } else {
        setFeedback('');
      }
    },
    onSettled: () => {
      done = true;
      ui.feedback.textContent = '';
    },
    onNext: () => {
      if (step === STEPS.length - 1) showFinal();
      else next();
    },
  });

  function setFeedback(text, kind = '') {
    ui.feedback.textContent = text;
    ui.feedback.className = `tutorial-feedback ${kind}`.trim();
  }

  function finishStep(text) {
    done = true;
    setFeedback(text, 'good');
    shop.setEnabled(false);
    ui.next.disabled = false;
    ui.next.focus();
  }

  function showFinal() {
    ui.shop.hidden = true;
    ui.next.hidden = true;
    ui.final.hidden = false;
    ui.text.textContent = 'You are a shopkeeper! Ready for real customers?';
    setFeedback('');
    ui.play.focus();
  }

  function show() {
    const s = STEPS[step];
    const last = step === STEPS.length - 1;
    ui.stepLabel.textContent = `Step ${step + 1} of ${STEPS.length}`;
    ui.dots.replaceChildren(...STEPS.map((_, i) => el('span', 'pip-dot' + (i === step ? ' on' : i < step ? ' past' : ''))));
    ui.text.textContent = s.text;
    ui.shop.hidden = false;
    ui.final.hidden = true;
    setFeedback('');
    done = s.type === 'view';
    shop.load(stepSale(s), { glowValues: s.glow, nextLabel: last ? 'Finish' : 'Next' });
    shop.setEnabled(s.type !== 'view');
    // Steps 1 and 2 use the big Next button below; the pay steps use the shop's own Next after the sale.
    ui.next.hidden = s.type === 'pay';
    ui.next.disabled = s.type !== 'view';
    ui.text.focus();
  }

  function next() {
    if (step < STEPS.length - 1) {
      step += 1;
      show();
    }
  }

  ui.next.addEventListener('click', () => { sound.unlock(); sound.play('tap'); next(); });
  ui.skip.addEventListener('click', () => onFinish());
  ui.play.addEventListener('click', () => { sound.play('tap'); onPlay(); });
  ui.finish.addEventListener('click', () => onFinish());

  return {
    start() {
      step = 0;
      show();
    },
    trayValues: () => trayValues(TUTORIAL_LEVEL),
  };
}
