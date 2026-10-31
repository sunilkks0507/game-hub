// Game HUD and Result Screen Renderer

import { renderBoardSVG } from './board-view.js';
import { loadSettings } from './storage.js';
import { getLegalMoves } from './engine.js';
import { showScreen } from './main.js';

export function updateGameUI(controller) {
  const { state, board, appState } = controller;
  if (!state || !board) return;

  const isMini = appState.selectedMode === 'mini';
  const isVsComputer = appState.opponent.type === 'ai';

  // HUD: Phase
  const hudPhase = document.getElementById('hud-phase');
  if (hudPhase) {
    hudPhase.textContent = state.phase.charAt(0).toUpperCase() + state.phase.slice(1);
  }

  // HUD: Unplaced
  const hudUnplaced = document.getElementById('hud-unplaced');
  const hudUnplacedLabel = document.getElementById('hud-unplaced-label');
  if (hudUnplaced) {
    hudUnplaced.textContent = state.phase === 'setup' ? state.tigersToPlace : state.goatsInHand;
  }
  if (hudUnplacedLabel) {
    if (state.phase === 'setup') {
      hudUnplacedLabel.textContent = 'Tigers to place';
    } else {
      hudUnplacedLabel.textContent = isMini ? 'Lambs to place' : 'Goats to place';
    }
  }

  // HUD: Captured
  const hudCaptured = document.getElementById('hud-captured');
  if (hudCaptured) {
    hudCaptured.textContent = `${state.goatsCaptured} / ${state.target}`;
  }

  // Turn line
  const turnTextEl = document.getElementById('game-turn-text');
  if (turnTextEl) {
    if (isVsComputer && controller.isComputerTurn()) {
      turnTextEl.textContent = 'Computer is thinking…';
    } else if (isVsComputer) {
      if (state.phase === 'setup') {
        turnTextEl.textContent = 'Your turn: place a tiger';
      } else if (state.turn === 'G') {
        turnTextEl.textContent = state.phase === 'placing'
          ? (isMini ? 'Your turn: place a lamb' : 'Your turn: place a goat')
          : (isMini ? 'Your turn: move a lamb' : 'Your turn: move a goat');
      } else {
        turnTextEl.textContent = 'Your turn: move a tiger';
      }
    } else {
      if (state.phase === 'setup') {
        turnTextEl.textContent = 'Tigers: place a tiger';
      } else if (state.turn === 'G') {
        turnTextEl.textContent = state.phase === 'placing'
          ? (isMini ? 'Lambs: place a lamb' : 'Goats: place a goat')
          : (isMini ? 'Lambs: move a lamb' : 'Goats: move a goat');
      } else {
        turnTextEl.textContent = 'Tigers: move a tiger';
      }
    }
  }

  // Note/Toast
  const noteEl = document.getElementById('game-toast-note');
  if (noteEl) {
    if (controller.selectedNode) {
      noteEl.textContent = 'Tap a green ring to move or jump';
    } else if (state.turn === 'G' && state.phase === 'placing') {
      noteEl.textContent = isMini
        ? 'Tap a green ring to place a lamb (5 lambs total).'
        : 'Tap a green ring to place a goat (15 goats total).';
    } else if (state.turn === 'T') {
      noteEl.textContent = isMini
        ? 'Tap your tiger or tap a green ring to move or jump.'
        : 'Tap a tiger to select, then tap a green ring to move or jump.';
    } else {
      noteEl.textContent = isMini ? 'Tap a lamb to see legal moves' : 'Tap a goat to see legal moves';
    }
  }

  // Board SVG
  const container = document.getElementById('game-board-container');
  if (container) {
    let legalSpots = [];
    if (!controller.isComputerTurn()) {
      if (state.turn === 'G' && state.phase === 'placing') {
        const moves = getLegalMoves(state, controller.graph);
        legalSpots = moves.map(m => m.to);
      } else if (controller.selectedNode) {
        legalSpots = controller.legalDestinations;
      } else if (state.turn === 'T') {
        const moves = getLegalMoves(state, controller.graph);
        legalSpots = Array.from(new Set(moves.map(m => m.to)));
      }
    }

    container.innerHTML = renderBoardSVG(board, {
      pieces: state.pieces,
      legalTargets: legalSpots,
      selectedNode: controller.selectedNode,
      hintNodes: controller.hintNodes,
      size: 260
    });
  }

  // Timer badge update
  if (controller.updateTimerBadge) {
    controller.updateTimerBadge(controller.isComputerTurn());
  }

  // Undo & Hint buttons
  const undoBtn = document.getElementById('btn-game-undo');
  if (undoBtn) {
    undoBtn.disabled = controller.isAiThinking || state.history.length === 0;
  }
  const hintBtn = document.getElementById('btn-game-hint');
  if (hintBtn) {
    const settings = loadSettings();
    hintBtn.disabled = !settings.hints || controller.isAiThinking || controller.isComputerTurn() || !!state.winner;
  }
}

export function showGameResult(controller) {
  const { state, appState } = controller;
  const isMini = appState.selectedMode === 'mini';
  const heroTitle = document.getElementById('result-hero-title');
  const heroSub = document.getElementById('result-hero-sub');
  const valCaptured = document.getElementById('result-val-captured');
  const valMoves = document.getElementById('result-val-moves');
  const valMode = document.getElementById('result-val-mode');
  const capturedLabel = document.getElementById('result-captured-label');

  if (capturedLabel) {
    capturedLabel.textContent = isMini ? 'Lambs captured' : 'Goats captured';
  }

  if (heroTitle && heroSub) {
    if (state.winner === 'T') {
      heroTitle.textContent = 'Tigers win!';
      heroSub.textContent = state.winReason === 'timeout'
        ? (isMini ? 'Lambs ran out of time (Forfeit)' : 'Goats ran out of time (Forfeit)')
        : `Tigers captured ${state.goatsCaptured} ${isMini ? 'lambs' : 'goats'}`;
    } else if (state.winner === 'G') {
      heroTitle.textContent = isMini ? 'Lambs win!' : 'Goats win!';
      heroSub.textContent = state.winReason === 'timeout'
        ? 'Tigers ran out of time (Forfeit)'
        : 'All tigers are trapped';
    } else {
      heroTitle.textContent = 'Draw';
      heroSub.textContent = `No capture in ${state.pliesSinceCapture} moves`;
    }
  }

  if (valCaptured) valCaptured.textContent = state.goatsCaptured;
  if (valMoves) valMoves.textContent = state.totalPlies;
  if (valMode) {
    const modeName = appState.selectedMode.charAt(0).toUpperCase() + appState.selectedMode.slice(1);
    const oppName = appState.opponent.type === 'human'
      ? 'Two players'
      : (appState.opponent.difficulty.charAt(0).toUpperCase() + appState.opponent.difficulty.slice(1));
    const timerSuffix = controller.timerDuration > 0 ? ` (${controller.timerDuration}s timer)` : '';
    valMode.textContent = `${modeName}, ${oppName}${timerSuffix}`;
  }

  showScreen('screen-result');
}
