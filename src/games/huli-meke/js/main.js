// Main Application Flow and Screen Orchestrator for Huli Meke

import { renderBoardSVG } from './board-view.js';
import { initSetupScreens, renderBoardPicker, updateCustomUI } from './setup-screens.js';
import { GameController } from './game-controller.js';
import { TutorialController } from './tutorial.js';
import { loadSettings, saveSettings, resetAllStats } from './storage.js';
import { showModal, hideModal, showConfirmDialog } from './dialog.js';
import { registerServiceWorker } from '../../../shared/pwa.js';
import { updateOpponentUI, renderStats, updateSettingsUI } from './settings-view.js';

export { showModal, hideModal, showConfirmDialog };

export const appState = {
  currentScreen: 'screen-home',
  boards: [],
  selectedMode: 'standard',
  selectedBoardId: 'classic',
  boardTab: 'full',
  customConfig: { tigers: 3, goats: 15, target: 5 },
  opponent: {
    type: 'ai',
    humanSide: 'T',
    resolvedHumanSide: 'T',
    difficulty: 'medium'
  },
  timer: {
    duration: 0,
    onTimeout: 'forfeit'
  }
};

if (typeof window !== 'undefined') {
  window.appState = appState;
}

export let gameController = null;
export let tutorialController = null;
let isInitialized = false;

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    appState.currentScreen = screenId;
    window.scrollTo(0, 0);

    if (screenId === 'screen-board') {
      renderBoardPicker(appState);
    } else if (screenId === 'screen-custom') {
      updateCustomUI(appState);
    } else if (screenId === 'screen-opponent') {
      updateOpponentUI(appState);
    } else if (screenId === 'screen-stats') {
      renderStats();
    } else if (screenId === 'screen-settings') {
      updateSettingsUI();
    }
  }
}

export async function initApp() {
  try {
    const res = await fetch('data/boards.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    appState.boards = await res.json();
  } catch (err) {
    console.error('Failed to load board data:', err);
    showScreen('screen-error');
    const retryBtn = document.getElementById('btn-app-retry');
    if (retryBtn) {
      retryBtn.onclick = () => initApp();
    }
    return;
  }

  gameController = new GameController(appState);
  tutorialController = new TutorialController(appState);

  if (typeof window !== 'undefined') {
    window.gameController = gameController;
    window.tutorialController = tutorialController;
  }

  // Home preview
  const classic = appState.boards.find(b => b.id === 'classic');
  const homeBox = document.getElementById('home-preview-box');
  if (classic && homeBox) {
    const pieces = {};
    classic.tigerStart.forEach(t => pieces[t] = 'T');
    homeBox.innerHTML = renderBoardSVG(classic, { pieces, size: 200 });
  }

  if (!isInitialized) {
    attachAppEventListeners();
    isInitialized = true;
  }

  showScreen('screen-home');
}

function attachAppEventListeners() {
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.back));
  });

  document.getElementById('btn-home-play')?.addEventListener('click', () => showScreen('screen-mode'));
  document.getElementById('btn-home-tutorial')?.addEventListener('click', () => tutorialController.start());
  document.getElementById('btn-tutorial-back')?.addEventListener('click', () => tutorialController.back());
  document.getElementById('btn-tutorial-next')?.addEventListener('click', () => tutorialController.next());
  document.getElementById('btn-home-stats')?.addEventListener('click', () => showScreen('screen-stats'));
  document.getElementById('btn-stats-play')?.addEventListener('click', () => showScreen('screen-mode'));
  document.getElementById('btn-home-settings')?.addEventListener('click', () => showScreen('screen-settings'));
  document.getElementById('btn-mode-continue')?.addEventListener('click', () => showScreen('screen-board'));

  document.getElementById('btn-board-continue')?.addEventListener('click', () => {
    showScreen(appState.selectedMode === 'custom' ? 'screen-custom' : 'screen-opponent');
  });

  document.getElementById('btn-custom-continue')?.addEventListener('click', () => showScreen('screen-opponent'));
  document.getElementById('btn-opponent-back')?.addEventListener('click', () => {
    showScreen(appState.selectedMode === 'custom' ? 'screen-custom' : 'screen-board');
  });

  initSetupScreens(appState, () => {
    if (appState.selectedMode === 'custom') updateCustomUI(appState);
  });

  initOpponentScreen();

  // In-Game Buttons
  document.getElementById('btn-opponent-start')?.addEventListener('click', () => {
    if (appState.opponent.humanSide === 'random') {
      appState.opponent.resolvedHumanSide = Math.random() < 0.5 ? 'T' : 'G';
    } else {
      appState.opponent.resolvedHumanSide = appState.opponent.humanSide;
    }
    gameController.startNewGame();
  });

  document.getElementById('btn-game-undo')?.addEventListener('click', () => gameController.handleUndo());
  document.getElementById('btn-game-hint')?.addEventListener('click', () => gameController.handleHint());
  document.getElementById('btn-game-pause')?.addEventListener('click', () => {
    gameController?.pauseTimer();
    showModal('modal-pause');
  });
  document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
    hideModal('modal-pause');
    gameController?.resumeTimer();
  });

  document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
    showConfirmDialog({
      title: 'Restart game?',
      message: 'Current game progress will be lost.',
      actionLabel: 'Restart',
      onConfirm: () => {
        hideModal('modal-pause');
        gameController?.stopTimer();
        gameController.startNewGame();
      }
    });
  });

  document.getElementById('btn-pause-quit')?.addEventListener('click', () => {
    showConfirmDialog({
      title: 'Quit to Home?',
      message: 'Leave this game? Progress will be lost.',
      actionLabel: 'Quit',
      onConfirm: () => {
        hideModal('modal-pause');
        gameController?.stopTimer();
        showScreen('screen-home');
      }
    });
  });

  document.getElementById('btn-result-again')?.addEventListener('click', () => gameController.startNewGame());
  document.getElementById('btn-result-home')?.addEventListener('click', () => showScreen('screen-home'));

  // Settings
  document.getElementById('toggle-sound')?.addEventListener('click', () => {
    const s = loadSettings();
    s.sound = !s.sound;
    saveSettings(s);
    updateSettingsUI();
  });

  document.getElementById('toggle-hints')?.addEventListener('click', () => {
    const s = loadSettings();
    s.hints = !s.hints;
    saveSettings(s);
    updateSettingsUI();
  });

  document.getElementById('btn-settings-reset')?.addEventListener('click', () => {
    showConfirmDialog({
      title: 'Reset all stats?',
      message: 'This cannot be undone.',
      actionLabel: 'Reset',
      onConfirm: () => resetAllStats()
    });
  });
}

function initOpponentScreen() {
  const pillAi = document.getElementById('pill-opp-ai');
  const pillHuman = document.getElementById('pill-opp-human');
  const aiPanel = document.getElementById('ai-options-panel');
  const humanPanel = document.getElementById('human-options-panel');

  pillAi?.addEventListener('click', () => {
    pillAi.classList.add('on');
    pillHuman.classList.remove('on');
    aiPanel.style.display = 'flex';
    humanPanel.style.display = 'none';
    appState.opponent.type = 'ai';
  });

  pillHuman?.addEventListener('click', () => {
    pillHuman.classList.add('on');
    pillAi.classList.remove('on');
    aiPanel.style.display = 'none';
    humanPanel.style.display = 'block';
    appState.opponent.type = 'human';
  });

  document.querySelectorAll('.side-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.side-pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
      appState.opponent.humanSide = pill.dataset.side;
    });
  });

  document.querySelectorAll('.diff-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.diff-pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
      appState.opponent.difficulty = pill.dataset.diff;
    });
  });

  document.querySelectorAll('.timer-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.timer-pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
      appState.timer.duration = parseInt(pill.dataset.timer, 10);
      const timeoutPanel = document.getElementById('timeout-action-panel');
      if (timeoutPanel) {
        timeoutPanel.style.display = appState.timer.duration > 0 ? 'flex' : 'none';
      }
    });
  });

  document.querySelectorAll('.timeout-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.timeout-pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
      appState.timer.onTimeout = pill.dataset.timeout;
      const descEl = document.getElementById('timeout-action-desc');
      if (descEl) {
        descEl.textContent = appState.timer.onTimeout === 'random'
          ? 'Random move: A random legal move will be played automatically.'
          : 'Forfeit: The player whose time runs out loses immediately.';
      }
    });
  });
}

// Offline support: the hub's one service worker (src/sw.js) caches this game.
registerServiceWorker();

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initApp();
  });
}
