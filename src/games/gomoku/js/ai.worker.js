// Runs the computer opponent off the main thread so the screen never freezes while Hard is thinking.
import { chooseMove } from './ai.js';

self.onmessage = (event) => {
  const { id, state, level, timeMs } = event.data;
  let move = -1;
  try {
    move = chooseMove(state, { level, timeMs });
  } catch (err) {
    move = -1;
  }
  self.postMessage({ id, move });
};
