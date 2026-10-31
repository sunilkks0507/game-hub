// Web Worker for AI computation in Huli Meke
// Offloads all heavy minimax & alpha-beta computations from the UI thread

import { getBestMove, getHint } from './ai.js';

self.onmessage = (event) => {
  const { id, type, state, graph, level } = event.data;

  try {
    if (type === 'getBestMove') {
      const move = getBestMove(state, graph, level);
      self.postMessage({ id, type: 'bestMove', move });
    } else if (type === 'getHint') {
      const move = getHint(state, graph);
      self.postMessage({ id, type: 'hint', move });
    }
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
