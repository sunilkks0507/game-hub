// AI Service Wrapper: Web Worker communication with resilient fallback and 1.5s watchdog timer

import { getBestMove, getHint } from './ai.js';

let worker = null;
let msgId = 0;
const pendingCallbacks = new Map();

function initWorker() {
  if (typeof window !== 'undefined' && window.Worker) {
    try {
      worker = new Worker('js/ai-worker.js', { type: 'module' });
      worker.onmessage = (e) => {
        const { id, move, error } = e.data;
        const cb = pendingCallbacks.get(id);
        if (cb) {
          pendingCallbacks.delete(id);
          cb(error ? null : move);
        }
      };
      worker.onerror = (err) => {
        console.warn('Worker error, falling back to main thread:', err);
        worker = null;
        for (const [id, cb] of pendingCallbacks.entries()) {
          pendingCallbacks.delete(id);
          cb(null);
        }
      };
    } catch (e) {
      console.warn('Worker initialization failed, using main thread fallback:', e);
      worker = null;
    }
  }
}

export function requestAIMove(state, graph, level, minDelayMs = 400) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const handleResult = (move) => {
      // If move is null or failed, generate synchronously as fallback
      const finalMove = move || getBestMove(state, graph, level);
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, minDelayMs - elapsed);
      setTimeout(() => {
        resolve(finalMove);
      }, remainingDelay);
    };

    if (!worker) initWorker();

    if (worker) {
      const id = ++msgId;
      // 1.5s watchdog timeout: if worker doesn't respond, execute on main thread
      const watchdog = setTimeout(() => {
        if (pendingCallbacks.has(id)) {
          pendingCallbacks.delete(id);
          console.warn('AI worker timeout reached, computing move on main thread');
          const fallback = getBestMove(state, graph, level);
          handleResult(fallback);
        }
      }, 1500);

      pendingCallbacks.set(id, (move) => {
        clearTimeout(watchdog);
        handleResult(move);
      });

      worker.postMessage({ id, type: 'getBestMove', state, graph, level });
    } else {
      setTimeout(() => {
        const move = getBestMove(state, graph, level);
        handleResult(move);
      }, 50);
    }
  });
}

export function requestHint(state, graph) {
  return new Promise((resolve) => {
    if (!worker) initWorker();

    if (worker) {
      const id = ++msgId;
      const watchdog = setTimeout(() => {
        if (pendingCallbacks.has(id)) {
          pendingCallbacks.delete(id);
          resolve(getHint(state, graph));
        }
      }, 1000);

      pendingCallbacks.set(id, (move) => {
        clearTimeout(watchdog);
        resolve(move || getHint(state, graph));
      });

      worker.postMessage({ id, type: 'getHint', state, graph });
    } else {
      resolve(getHint(state, graph));
    }
  });
}
