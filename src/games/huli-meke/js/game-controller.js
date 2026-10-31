// In-Game Controller: User Interaction, Turn Engine, Undo & Result flow
// Free of direct DOM HTML generation (delegated to game-view.js and board-view.js)

import { buildBoardGraph, createGameState, getLegalMoves, applyMove, undoMove } from './engine.js';
import { attachBoardInteraction } from './board-view.js';
import { showScreen } from './main.js';
import { requestAIMove, requestHint } from './ai-service.js';
import { playSound } from './sound.js';
import { loadSettings, recordGameResult } from './storage.js';
import { updateGameUI, showGameResult } from './game-view.js';

export class GameController {
  constructor(appState) {
    this.appState = appState;
    this.board = null;
    this.graph = null;
    this.state = null;
    this.selectedNode = null;
    this.legalDestinations = [];
    this.detachInteraction = null;
    this.hintActive = false;
    this.hintNodes = [];
    this.isAiThinking = false;
    this.timerDuration = 0;
    this.onTimeout = 'forfeit';
    this.timerSecondsLeft = 0;
    this.timerInterval = null;
    this.isTimerPaused = false;
  }

  startNewGame() {
    const { appState } = this;
    const board = appState.boards.find(b => b.id === appState.selectedBoardId) || appState.boards[0];
    this.board = board;
    this.graph = buildBoardGraph(board);

    let tigers, goats, target;
    if (appState.selectedMode === 'standard') {
      tigers = 3;
      goats = 15;
      target = 5;
    } else if (appState.selectedMode === 'mini') {
      tigers = 1;
      goats = 5;
      target = 2;
    } else {
      tigers = appState.customConfig.tigers;
      goats = appState.customConfig.goats;
      target = appState.customConfig.target;
    }

    this.state = createGameState(board, { tigers, goats, target });
    this.selectedNode = null;
    this.legalDestinations = [];
    this.hintActive = false;
    this.hintNodes = [];
    this.isAiThinking = false;

    // Turn timer setup
    this.stopTimer();
    this.isTimerPaused = false;
    this.timerDuration = (appState.timer && appState.timer.duration) || 0;
    this.onTimeout = (appState.timer && appState.timer.onTimeout) || 'forfeit';
    this.timerSecondsLeft = this.timerDuration;

    const modeTitle = document.getElementById('game-mode-title');
    if (modeTitle) {
      modeTitle.textContent = appState.selectedMode.charAt(0).toUpperCase() + appState.selectedMode.slice(1);
    }

    showScreen('screen-game');
    this.initInteraction();
    this.updateUI();

    this.triggerTurn();
  }

  initInteraction() {
    const container = document.getElementById('game-board-container');
    if (!container) return;

    if (this.detachInteraction) {
      this.detachInteraction();
    }

    this.detachInteraction = attachBoardInteraction(container, this.board, (nodeId) => {
      this.handlePointTap(nodeId);
    });
  }

  handlePointTap(nodeId) {
    if (!this.state || this.state.winner) return;

    if (this.isAiThinking) {
      const noteEl = document.getElementById('game-toast-note');
      if (noteEl) noteEl.textContent = 'Computer is thinking, please wait...';
      return;
    }

    if (this.appState.opponent.type === 'ai' && this.isComputerTurn()) {
      const isMini = this.appState.selectedMode === 'mini';
      const humanSide = this.appState.opponent.resolvedHumanSide || this.appState.opponent.humanSide;
      const humanRole = humanSide === 'T' ? 'Tiger' : (isMini ? 'Lamb' : 'Goat');
      const noteEl = document.getElementById('game-toast-note');
      if (noteEl) {
        noteEl.textContent = `Computer's turn. You play as ${humanRole}.`;
      }
      return;
    }

    const { pieces, turn, phase } = this.state;

    // 1. EXTRA TIGER SETUP PHASE
    if (phase === 'setup' && turn === 'T') {
      const legalMoves = getLegalMoves(this.state, this.graph);
      const move = legalMoves.find(m => m.type === 'place' && m.to === nodeId);
      if (move) {
        this.executeMove(move);
        return;
      }
    }

    // 2. GOAT PLACING PHASE
    if (phase === 'placing' && turn === 'G') {
      const legalMoves = getLegalMoves(this.state, this.graph);
      const move = legalMoves.find(m => m.type === 'place' && m.to === nodeId);
      if (move) {
        this.executeMove(move);
        return;
      }
    }

    // 3. MOVING TURN (Either Tiger in placing/moving, or Goat in moving)
    if (pieces[nodeId] === turn) {
      if (this.selectedNode === nodeId) {
        this.selectedNode = null;
        this.legalDestinations = [];
      } else {
        this.selectedNode = nodeId;
        const moves = getLegalMoves(this.state, this.graph, nodeId);
        this.legalDestinations = moves.map(m => m.to);
      }
      this.updateUI();
      return;
    }

    // Tapping a destination spot
    const legalMoves = getLegalMoves(this.state, this.graph);

    // Case A: A piece is already selected
    if (this.selectedNode && this.legalDestinations.includes(nodeId)) {
      const move = legalMoves.find(m => m.from === this.selectedNode && m.to === nodeId);
      if (move) {
        this.executeMove(move);
        return;
      }
    }

    // Case B: Direct tap on a green destination spot when only one piece can reach it
    const matchingMoves = legalMoves.filter(m => m.to === nodeId);
    if (matchingMoves.length === 1) {
      this.executeMove(matchingMoves[0]);
      return;
    }

    // Tapping elsewhere clears selection
    if (this.selectedNode) {
      this.selectedNode = null;
      this.legalDestinations = [];
      this.updateUI();
    }
  }

  executeMove(move) {
    const settings = loadSettings();
    if (move.type === 'jump') {
      playSound('capture', settings.sound);
    } else if (move.type === 'place') {
      playSound('place', settings.sound);
    } else if (move.type === 'step') {
      playSound('move', settings.sound);
    }

    applyMove(this.state, move, this.graph);
    this.selectedNode = null;
    this.legalDestinations = [];
    this.hintActive = false;
    this.hintNodes = [];
    this.updateUI();

    if (this.state.winner) {
      this.stopTimer();
      if (this.appState.opponent.type === 'ai') {
        const humanSide = this.appState.opponent.resolvedHumanSide || this.appState.opponent.humanSide;
        recordGameResult(this.appState.selectedMode, humanSide, this.state.winner);
        if (this.state.winner === humanSide) {
          playSound('win', settings.sound);
        } else if (this.state.winner !== 'draw') {
          playSound('lose', settings.sound);
        }
      } else {
        playSound('win', settings.sound);
      }
      setTimeout(() => this.showResultScreen(), 400);
      return;
    }

    this.triggerTurn();
  }

  triggerTurn() {
    if (this.state.winner) {
      this.stopTimer();
      return;
    }

    if (this.appState.opponent.type === 'ai' && this.isComputerTurn()) {
      this.stopTimer();
      this.isAiThinking = true;
      this.updateUI();

      requestAIMove(this.state, this.graph, this.appState.opponent.difficulty, 400).then(move => {
        this.isAiThinking = false;
        if (move && !this.state.winner) {
          this.executeMove(move);
        } else {
          this.updateUI();
        }
      });
    } else {
      if (this.timerDuration > 0) {
        this.startTurnTimer();
      } else {
        this.stopTimer();
        this.updateTimerBadge();
      }
    }
  }

  startTurnTimer() {
    this.stopTimer();
    this.timerSecondsLeft = this.timerDuration;
    this.isTimerPaused = false;
    this.updateTimerBadge();

    this.timerInterval = setInterval(() => {
      if (this.isTimerPaused || this.isAiThinking || !this.state || this.state.winner) return;
      this.timerSecondsLeft--;
      this.updateTimerBadge();
      if (this.timerSecondsLeft <= 0) {
        this.stopTimer();
        this.handleTimeout();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  pauseTimer() {
    this.isTimerPaused = true;
  }

  resumeTimer() {
    this.isTimerPaused = false;
  }

  handleTimeout() {
    if (!this.state || this.state.winner) return;

    if (this.onTimeout === 'forfeit') {
      const loser = this.state.turn;
      const winner = loser === 'T' ? 'G' : 'T';
      this.state.winner = winner;
      this.state.winReason = 'timeout';

      const settings = loadSettings();
      if (this.appState.opponent.type === 'ai') {
        const humanSide = this.appState.opponent.resolvedHumanSide || this.appState.opponent.humanSide;
        recordGameResult(this.appState.selectedMode, humanSide, this.state.winner);
        if (this.state.winner === humanSide) {
          playSound('win', settings.sound);
        } else {
          playSound('lose', settings.sound);
        }
      } else {
        playSound('win', settings.sound);
      }
      this.updateUI();
      setTimeout(() => this.showResultScreen(), 400);
    } else {
      // Random move fallback
      const legalMoves = getLegalMoves(this.state, this.graph);
      if (legalMoves.length > 0) {
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        const noteEl = document.getElementById('game-toast-note');
        if (noteEl) {
          noteEl.textContent = "Time's up! A random move was played.";
        }
        this.executeMove(randomMove);
      }
    }
  }

  updateTimerBadge(isAiTurn = false) {
    const badge = document.getElementById('game-timer-badge');
    const countEl = document.getElementById('timer-count');
    if (!badge || !countEl) return;

    if (this.timerDuration === 0 || !this.state || this.state.winner) {
      badge.style.display = 'none';
      return;
    }

    badge.style.display = 'inline-flex';
    if (isAiTurn) {
      badge.classList.remove('warning');
      countEl.textContent = '--';
    } else {
      const displaySec = Math.max(0, this.timerSecondsLeft);
      countEl.textContent = displaySec;
      if (displaySec <= 5) {
        badge.classList.add('warning');
      } else {
        badge.classList.remove('warning');
      }
    }
  }

  isComputerTurn() {
    if (this.appState.opponent.type !== 'ai') return false;
    const { turn } = this.state;
    const humanSide = this.appState.opponent.resolvedHumanSide || this.appState.opponent.humanSide;
    return turn !== humanSide;
  }

  handleUndo() {
    if (this.isAiThinking || !this.state || this.state.history.length === 0) return;

    if (this.appState.opponent.type === 'ai') {
      const humanSide = this.appState.opponent.resolvedHumanSide || this.appState.opponent.humanSide;
      const hasHumanMove = this.state.history.some(h => h.move.piece === humanSide);
      if (!hasHumanMove) return;

      if (this.state.turn === humanSide) {
        undoMove(this.state); // undo computer
        undoMove(this.state); // undo human
      } else {
        undoMove(this.state); // undo human
      }
    } else {
      undoMove(this.state);
    }

    this.selectedNode = null;
    this.legalDestinations = [];
    this.updateUI();

    if (this.timerDuration > 0) {
      this.startTurnTimer();
    }
  }

  handleHint() {
    if (this.isAiThinking || this.state.winner || this.isComputerTurn()) return;

    requestHint(this.state, this.graph).then(move => {
      if (!move) return;
      this.hintNodes = [move.from, move.to].filter(Boolean);
      this.updateUI();

      setTimeout(() => {
        this.hintNodes = [];
        this.updateUI();
      }, 2000);
    });
  }

  updateUI() {
    updateGameUI(this);
  }

  showResultScreen() {
    showGameResult(this);
  }
}
