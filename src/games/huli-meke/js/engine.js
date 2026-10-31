// Pure rules engine for Huli Meke (Karnataka Tiger and Goat Game)
// Zero DOM dependencies - runs both in the browser and in Node.js / Web Workers.

export const DRAW_PLIES = 80;

export function getDefaultTarget(goats) {
  return Math.ceil(goats / 3);
}

export function isValidSetup(board, numTigers, numGoats) {
  if (numTigers < 1 || numTigers > 6) return false;
  if (numGoats < 5 || numGoats > 25) return false;
  return (numTigers + numGoats) <= board.capacity;
}

// Precomputes adjacency list and jump lookup tables from board lines
export function buildBoardGraph(board) {
  const adjacency = {};
  const jumpsFrom = {};
  for (const nodeId of Object.keys(board.nodes)) {
    adjacency[nodeId] = new Set();
    jumpsFrom[nodeId] = [];
  }

  const seenJumps = new Set();
  const addJump = (from, over, to) => {
    const key = `${from}>${over}>${to}`;
    if (!seenJumps.has(key)) {
      seenJumps.add(key);
      jumpsFrom[from].push({ from, over, to });
    }
  };

  for (const line of board.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const u = line[i];
      const v = line[i + 1];
      adjacency[u].add(v);
      adjacency[v].add(u);
    }
    for (let i = 0; i < line.length - 2; i++) {
      addJump(line[i], line[i + 1], line[i + 2]);
      addJump(line[i + 2], line[i + 1], line[i]);
    }
  }

  const adjList = {};
  for (const [k, v] of Object.entries(adjacency)) {
    adjList[k] = Array.from(v);
  }

  return { adjacency: adjList, jumpsFrom };
}

export function createGameState(board, options = {}) {
  const numTigers = options.tigers ?? (board.group === 'mini' ? 1 : 3);
  const numGoats = options.goats ?? (board.group === 'mini' ? 5 : 15);
  const target = options.target ?? getDefaultTarget(numGoats);

  const startTigers = board.tigerStart.slice(0, numTigers);
  const extraTigers = Math.max(0, numTigers - startTigers.length);

  const pieces = {};
  for (const t of startTigers) {
    pieces[t] = 'T';
  }

  const isSetup = extraTigers > 0;
  return {
    boardId: board.id,
    pieces,
    goatsInHand: numGoats,
    goatsTotal: numGoats,
    goatsCaptured: 0,
    tigersTotal: numTigers,
    tigersToPlace: extraTigers,
    target,
    turn: isSetup ? 'T' : 'G',
    phase: isSetup ? 'setup' : 'placing',
    pliesSinceCapture: 0,
    totalPlies: 0,
    winner: null,
    winReason: null,
    history: []
  };
}

export function cloneState(state) {
  return {
    boardId: state.boardId,
    pieces: { ...state.pieces },
    goatsInHand: state.goatsInHand,
    goatsTotal: state.goatsTotal,
    goatsCaptured: state.goatsCaptured,
    tigersTotal: state.tigersTotal,
    tigersToPlace: state.tigersToPlace,
    target: state.target,
    turn: state.turn,
    phase: state.phase,
    pliesSinceCapture: state.pliesSinceCapture,
    totalPlies: state.totalPlies,
    winner: state.winner,
    winReason: state.winReason,
    history: []
  };
}

export function getLegalMoves(state, graph, nodeFilter = null) {
  if (state.winner) return [];
  const moves = [];
  const { pieces, turn, phase, goatsInHand, tigersToPlace } = state;

  if (phase === 'setup' && turn === 'T' && tigersToPlace > 0) {
    for (const nodeId of Object.keys(graph.adjacency)) {
      if (!pieces[nodeId]) {
        moves.push({ type: 'place', to: nodeId, piece: 'T' });
      }
    }
    return moves;
  }

  if (turn === 'G') {
    if (phase === 'placing' && goatsInHand > 0) {
      for (const nodeId of Object.keys(graph.adjacency)) {
        if (!pieces[nodeId]) {
          moves.push({ type: 'place', to: nodeId, piece: 'G' });
        }
      }
      return moves;
    }

    if (phase === 'moving') {
      const candidates = nodeFilter ? [nodeFilter] : Object.keys(pieces).filter(id => pieces[id] === 'G');
      for (const from of candidates) {
        if (pieces[from] !== 'G') continue;
        for (const to of graph.adjacency[from] || []) {
          if (!pieces[to]) {
            moves.push({ type: 'step', from, to, piece: 'G' });
          }
        }
      }
      if (!nodeFilter && moves.length === 0) {
        moves.push({ type: 'pass', piece: 'G' });
      }
      return moves;
    }
  }

  if (turn === 'T') {
    const candidates = nodeFilter ? [nodeFilter] : Object.keys(pieces).filter(id => pieces[id] === 'T');
    for (const from of candidates) {
      if (pieces[from] !== 'T') continue;
      for (const to of graph.adjacency[from] || []) {
        if (!pieces[to]) {
          moves.push({ type: 'step', from, to, piece: 'T' });
        }
      }
      for (const j of graph.jumpsFrom[from] || []) {
        if (pieces[j.over] === 'G' && !pieces[j.to]) {
          moves.push({ type: 'jump', from, over: j.over, to: j.to, piece: 'T' });
        }
      }
    }
    return moves;
  }

  return moves;
}

export function checkStatus(state, graph) {
  if (state.winner) return state.winner;

  // 1. Tiger win immediately if target captured
  if (state.goatsCaptured >= state.target) {
    state.winner = 'T';
    state.winReason = `Tigers captured ${state.goatsCaptured} goats`;
    return 'T';
  }

  // 2. Goat win if start of tiger turn and no tiger can move
  if (state.turn === 'T' && state.phase !== 'setup') {
    const tigerMoves = getLegalMoves(state, graph);
    if (tigerMoves.length === 0) {
      state.winner = 'G';
      state.winReason = 'All tigers are trapped';
      return 'G';
    }
  }

  // 3. Draw if 80 plies without capture in moving phase
  if (state.phase === 'moving' && state.pliesSinceCapture >= DRAW_PLIES) {
    state.winner = 'draw';
    state.winReason = `No capture in ${DRAW_PLIES} moves`;
    return 'draw';
  }

  return null;
}

export function applyMove(state, move, graph) {
  if (state.winner) return state;

  const snapshot = {
    pieces: { ...state.pieces },
    goatsInHand: state.goatsInHand,
    goatsCaptured: state.goatsCaptured,
    tigersToPlace: state.tigersToPlace,
    turn: state.turn,
    phase: state.phase,
    pliesSinceCapture: state.pliesSinceCapture,
    totalPlies: state.totalPlies,
    move
  };

  let captured = false;

  if (move.type === 'place') {
    state.pieces[move.to] = move.piece;
    if (move.piece === 'T') {
      state.tigersToPlace--;
      if (state.tigersToPlace === 0) {
        state.phase = 'placing';
        state.turn = 'G';
      }
    } else {
      state.goatsInHand--;
      state.turn = 'T';
    }
  } else if (move.type === 'step') {
    delete state.pieces[move.from];
    state.pieces[move.to] = move.piece;
    state.turn = move.piece === 'T' ? 'G' : 'T';
  } else if (move.type === 'jump') {
    delete state.pieces[move.from];
    delete state.pieces[move.over];
    state.pieces[move.to] = 'T';
    state.goatsCaptured++;
    captured = true;
    state.turn = 'G';
  } else if (move.type === 'pass') {
    state.turn = 'T';
  }

  state.totalPlies++;

  // Phase transition: when all goats are placed, switch to moving phase on next goat turn
  if (state.phase === 'placing' && state.goatsInHand === 0 && state.turn === 'G') {
    state.phase = 'moving';
  }

  if (captured) {
    state.pliesSinceCapture = 0;
  } else if (state.phase === 'moving') {
    state.pliesSinceCapture++;
  }

  state.history.push(snapshot);

  // Check game over
  checkStatus(state, graph);

  return state;
}

export function undoMove(state) {
  if (!state.history || state.history.length === 0) return null;
  const last = state.history.pop();
  state.pieces = last.pieces;
  state.goatsInHand = last.goatsInHand;
  state.goatsCaptured = last.goatsCaptured;
  state.tigersToPlace = last.tigersToPlace;
  state.turn = last.turn;
  state.phase = last.phase;
  state.pliesSinceCapture = last.pliesSinceCapture;
  state.totalPlies = last.totalPlies;
  state.winner = null;
  state.winReason = null;
  return last.move;
}
