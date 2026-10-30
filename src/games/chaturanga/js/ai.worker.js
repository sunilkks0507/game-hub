// Web Worker wrapper around the bot, so thinking never freezes the screen.
//
// Start it from the page with:
//   const worker = new Worker('./js/ai.worker.js', { type: 'module' });
//   worker.postMessage({ id: 1, state, level: 'medium' });
//   worker.onmessage = (e) => { /* e.data = { id, move } */ };
//
// `state` is the plain game state object from engine.js (it survives structured cloning).

import { chooseMove } from './ai.js';

self.onmessage = (event) => {
  const { id, state, level, timeMs } = event.data;
  try {
    const move = chooseMove(state, { level, timeMs });
    self.postMessage({ id, move });
  } catch (error) {
    self.postMessage({ id, move: null, error: String(error && error.message ? error.message : error) });
  }
};
