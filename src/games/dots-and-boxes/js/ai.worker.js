// Web Worker wrapper around the bot, so thinking never freezes the screen.
//
//   const worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
//   worker.postMessage({ id: 1, state, level: 'medium', timeMs: 500 });
//   worker.onmessage = (e) => { /* e.data = { id, move } */ };

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
