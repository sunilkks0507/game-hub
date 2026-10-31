// AI Engine for Huli Meke (Easy, Medium, Hard) and Hint generation
// Zero DOM code - runs in Node.js and in Web Worker

import { getLegalMoves, applyMove, cloneState } from './engine.js';

export function evaluateState(state, graph) {
  if (state.winner === 'T') return 10000;
  if (state.winner === 'G') return -10000;
  if (state.winner === 'draw') return 0;

  let tigerMovesCount = 0;
  let availableCaptures = 0;
  let trappedTigers = 0;

  const tigerPositions = Object.keys(state.pieces).filter(id => state.pieces[id] === 'T');

  for (const pos of tigerPositions) {
    let pieceMoves = 0;
    // Step moves
    for (const to of graph.adjacency[pos] || []) {
      if (!state.pieces[to]) {
        pieceMoves++;
      }
    }
    // Jump moves
    for (const j of graph.jumpsFrom[pos] || []) {
      if (state.pieces[j.over] === 'G' && !state.pieces[j.to]) {
        pieceMoves++;
        availableCaptures++;
      }
    }

    if (pieceMoves === 0) {
      trappedTigers++;
    } else {
      tigerMovesCount += pieceMoves;
    }
  }

  // Formula: 100*captured + 4*(tiger legal moves) + 20*(available captures) - 60*(trapped tigers)
  return 100 * state.goatsCaptured + 4 * tigerMovesCount + 20 * availableCaptures - 60 * trappedTigers;
}

export function sortMoves(moves) {
  // Captures first for optimal alpha-beta pruning
  return moves.slice().sort((a, b) => {
    if (a.type === 'jump' && b.type !== 'jump') return -1;
    if (a.type !== 'jump' && b.type === 'jump') return 1;
    return 0;
  });
}

export function getEasyMove(state, graph) {
  const legalMoves = getLegalMoves(state, graph);
  if (legalMoves.length === 0) return null;

  if (state.turn === 'T') {
    const jumps = legalMoves.filter(m => m.type === 'jump');
    // Take an available capture 60% of the time
    if (jumps.length > 0 && Math.random() < 0.6) {
      return jumps[Math.floor(Math.random() * jumps.length)];
    }
  }

  return legalMoves[Math.floor(Math.random() * legalMoves.length)];
}

export function minimax(state, graph, depth, isMaximizing) {
  if (depth === 0 || state.winner) {
    return { score: evaluateState(state, graph) };
  }

  const legalMoves = getLegalMoves(state, graph);
  if (legalMoves.length === 0) {
    return { score: evaluateState(state, graph) };
  }

  const sorted = sortMoves(legalMoves);
  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestMoves = [];

  for (const move of sorted) {
    const nextState = cloneState(state);
    applyMove(nextState, move, graph);

    // Next turn maximizing if nextState.turn === 'T'
    const nextIsMax = nextState.turn === 'T';
    const result = minimax(nextState, graph, depth - 1, nextIsMax);

    if (isMaximizing) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMoves = [move];
      } else if (result.score === bestScore) {
        bestMoves.push(move);
      }
    } else {
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMoves = [move];
      } else if (result.score === bestScore) {
        bestMoves.push(move);
      }
    }
  }

  const pickedMove = bestMoves.length > 0 ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
  return { score: bestScore, move: pickedMove };
}

export function alphaBeta(state, graph, depth, alpha, beta, isMaximizing, startTime, timeLimitMs) {
  if (startTime && (Date.now() - startTime) > timeLimitMs) {
    return { score: evaluateState(state, graph), timeout: true };
  }

  if (depth === 0 || state.winner) {
    return { score: evaluateState(state, graph) };
  }

  const legalMoves = getLegalMoves(state, graph);
  if (legalMoves.length === 0) {
    return { score: evaluateState(state, graph) };
  }

  const sorted = sortMoves(legalMoves);
  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestMoves = [];

  for (const move of sorted) {
    const nextState = cloneState(state);
    applyMove(nextState, move, graph);

    const nextIsMax = nextState.turn === 'T';
    const result = alphaBeta(nextState, graph, depth - 1, alpha, beta, nextIsMax, startTime, timeLimitMs);

    if (result.timeout) {
      return { score: bestScore, move: bestMoves[0] || sorted[0], timeout: true };
    }

    if (isMaximizing) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMoves = [move];
      } else if (result.score === bestScore) {
        bestMoves.push(move);
      }
      alpha = Math.max(alpha, bestScore);
    } else {
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMoves = [move];
      } else if (result.score === bestScore) {
        bestMoves.push(move);
      }
      beta = Math.min(beta, bestScore);
    }

    if (beta <= alpha) {
      break; // Alpha-beta pruning
    }
  }

  const pickedMove = bestMoves.length > 0 ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
  return { score: bestScore, move: pickedMove };
}

export function getHardMove(state, graph, timeLimitMs = 900) {
  const legalMoves = getLegalMoves(state, graph);
  if (legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  const startTime = Date.now();
  const isMaximizing = state.turn === 'T';
  let bestMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];

  // Iterative deepening from depth 1 to 6
  for (let d = 1; d <= 6; d++) {
    const result = alphaBeta(state, graph, d, -Infinity, Infinity, isMaximizing, startTime, timeLimitMs);
    if (result.move) {
      bestMove = result.move;
    }
    if (result.timeout || (Date.now() - startTime) >= timeLimitMs) {
      break;
    }
  }

  return bestMove;
}

export function getBestMove(state, graph, level = 'medium') {
  if (level === 'easy') {
    return getEasyMove(state, graph);
  }
  if (level === 'hard') {
    return getHardMove(state, graph, 900);
  }
  // Medium: minimax depth 2
  const isMaximizing = state.turn === 'T';
  const result = minimax(state, graph, 2, isMaximizing);
  return result.move || getEasyMove(state, graph);
}

// Hint = best move for the human side using Medium search
export function getHint(state, graph) {
  const isMaximizing = state.turn === 'T';
  const result = minimax(state, graph, 2, isMaximizing);
  return result.move || getEasyMove(state, graph);
}
