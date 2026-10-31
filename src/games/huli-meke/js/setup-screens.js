// Mode, Board selection, and Custom pieces configuration logic
// Strictly adheres to MASTER_SPEC.md sections 5, 7.4 and frames 2, 2b, 2b-ii, 2c

import { getDefaultTarget, isValidSetup } from './engine.js';
import { renderBoardSVG } from './board-view.js';

export const PRESETS = [
  { id: 'standard', name: 'Standard 3 / 15', tigers: 3, goats: 15 },
  { id: 'pack', name: 'Pack 4 / 16', tigers: 4, goats: 16 },
  { id: 'hunt', name: 'Hunt 2 / 20', tigers: 2, goats: 20 },
  { id: 'siege', name: 'Siege 6 / 25', tigers: 6, goats: 25 }
];

export function initSetupScreens(appState, onBoardSelected) {
  // 1. Mode Screen Selection
  const modeCards = document.querySelectorAll('#screen-mode .card[data-mode]');
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('sel'));
      card.classList.add('sel');
      appState.selectedMode = card.dataset.mode;
      onModeChanged(appState);
    });
  });

  // 2. Board Screen Tabs
  const tabFull = document.getElementById('tab-board-full');
  const tabMini = document.getElementById('tab-board-mini');

  tabFull?.addEventListener('click', () => {
    appState.boardTab = 'full';
    tabFull.classList.add('on');
    tabMini.classList.remove('on');
    renderBoardPicker(appState, onBoardSelected);
  });

  tabMini?.addEventListener('click', () => {
    if (tabMini.classList.contains('off')) return;
    appState.boardTab = 'mini';
    tabMini.classList.add('on');
    tabFull.classList.remove('on');
    renderBoardPicker(appState, onBoardSelected);
  });

  // 3. Custom Steppers and Presets
  setupCustomPiecesControls(appState);
}

export function onModeChanged(appState) {
  const tabMini = document.getElementById('tab-board-mini');
  const tabFull = document.getElementById('tab-board-full');
  const note = document.getElementById('board-tab-note');

  if (appState.selectedMode === 'standard') {
    tabMini.classList.add('off');
    tabMini.title = 'Mini boards are disabled for Standard mode';
    if (note) note.textContent = 'Standard mode: 3 tigers vs 15 goats (tigers win at 5 captures). Mini boards are too small for Standard, so they are greyed out.';
    appState.boardTab = 'full';
    tabFull.classList.add('on');
    tabMini.classList.remove('on');
    const currentBoard = appState.boards.find(b => b.id === appState.selectedBoardId);
    if (!currentBoard || currentBoard.group !== 'full') {
      appState.selectedBoardId = 'classic';
    }
  } else if (appState.selectedMode === 'mini') {
    tabMini.classList.remove('off');
    if (note) note.textContent = 'Mini mode: 1 tiger vs 5 lambs (tiger wins at 2 captures). Small boards for quick 3-minute games.';
    appState.boardTab = 'mini';
    tabMini.classList.add('on');
    tabFull.classList.remove('on');
    const currentBoard = appState.boards.find(b => b.id === appState.selectedBoardId);
    if (!currentBoard || currentBoard.group !== 'mini') {
      appState.selectedBoardId = 'mini-triangle';
    }
  } else { // Custom
    tabMini.classList.remove('off');
    if (note) note.textContent = 'Choose any board and pick your own number of tigers and goats.';
  }
}

export function renderBoardPicker(appState, onBoardSelected) {
  const grid = document.getElementById('board-cards-grid');
  if (!grid || !appState.boards.length) return;

  grid.innerHTML = '';
  const filteredBoards = appState.boards.filter(b => b.group === appState.boardTab);

  filteredBoards.forEach(b => {
    const card = document.createElement('div');
    const isSelected = b.id === appState.selectedBoardId;
    card.className = `bcard${isSelected ? ' sel' : ''}`;
    card.dataset.boardId = b.id;

    // Small SVG thumbnail preview
    const thumbnailPieces = {};
    b.tigerStart.forEach(t => thumbnailPieces[t] = 'T');
    const svgThumb = renderBoardSVG(b, {
      pieces: thumbnailPieces,
      size: b.viewBox[1] > 400 ? 70 : 84
    });

    card.innerHTML = `${svgThumb}${b.name}<span>${b.points} points</span>`;

    card.addEventListener('click', () => {
      grid.querySelectorAll('.bcard').forEach(c => c.classList.remove('sel'));
      card.classList.add('sel');
      appState.selectedBoardId = b.id;
      clampCustomConfig(appState);
      if (onBoardSelected) onBoardSelected(b);
    });

    grid.appendChild(card);
  });
}

function clampCustomConfig(appState) {
  const board = appState.boards.find(b => b.id === appState.selectedBoardId);
  if (!board) return;
  const cfg = appState.customConfig;
  cfg.tigers = Math.max(1, Math.min(6, cfg.tigers));
  cfg.goats = Math.max(5, Math.min(25, cfg.goats));

  while ((cfg.tigers + cfg.goats) > board.capacity && cfg.goats > 5) {
    cfg.goats--;
  }
  while ((cfg.tigers + cfg.goats) > board.capacity && cfg.tigers > 1) {
    cfg.tigers--;
  }
  cfg.target = Math.max(1, Math.min(cfg.goats, getDefaultTarget(cfg.goats)));
  updateCustomUI(appState);
}

function setupCustomPiecesControls(appState) {
  const board = () => appState.boards.find(b => b.id === appState.selectedBoardId) || appState.boards[0];

  // Presets
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      if (pill.classList.contains('off')) return;
      const preset = PRESETS.find(p => p.id === pill.dataset.preset);
      if (!preset) return;
      appState.customConfig.tigers = preset.tigers;
      appState.customConfig.goats = preset.goats;
      appState.customConfig.target = getDefaultTarget(preset.goats);
      updateCustomUI(appState);
    });
  });

  // Tigers Stepper
  document.getElementById('btn-custom-tigers-minus')?.addEventListener('click', () => {
    if (appState.customConfig.tigers > 1) {
      appState.customConfig.tigers--;
      updateCustomUI(appState);
    }
  });

  document.getElementById('btn-custom-tigers-plus')?.addEventListener('click', () => {
    const b = board();
    if (appState.customConfig.tigers < 6 && (appState.customConfig.tigers + 1 + appState.customConfig.goats) <= b.capacity) {
      appState.customConfig.tigers++;
      updateCustomUI(appState);
    }
  });

  // Goats Stepper
  document.getElementById('btn-custom-goats-minus')?.addEventListener('click', () => {
    if (appState.customConfig.goats > 5) {
      appState.customConfig.goats--;
      appState.customConfig.target = getDefaultTarget(appState.customConfig.goats);
      updateCustomUI(appState);
    }
  });

  document.getElementById('btn-custom-goats-plus')?.addEventListener('click', () => {
    const b = board();
    if (appState.customConfig.goats < 25 && (appState.customConfig.tigers + appState.customConfig.goats + 1) <= b.capacity) {
      appState.customConfig.goats++;
      appState.customConfig.target = getDefaultTarget(appState.customConfig.goats);
      updateCustomUI(appState);
    }
  });

  // Target Stepper
  document.getElementById('btn-custom-target-minus')?.addEventListener('click', () => {
    if (appState.customConfig.target > 1) {
      appState.customConfig.target--;
      updateCustomUI(appState);
    }
  });

  document.getElementById('btn-custom-target-plus')?.addEventListener('click', () => {
    if (appState.customConfig.target < appState.customConfig.goats) {
      appState.customConfig.target++;
      updateCustomUI(appState);
    }
  });
}

export function updateCustomUI(appState) {
  const board = appState.boards.find(b => b.id === appState.selectedBoardId);
  if (!board) return;

  const cfg = appState.customConfig;
  const infoEl = document.getElementById('custom-board-info');
  if (infoEl) infoEl.textContent = `Board: ${board.name} (${board.points} points)`;

  const capEl = document.getElementById('custom-capacity-note');
  if (capEl) capEl.textContent = `This board holds up to ${board.capacity} pieces in total (tigers plus goats). Current total: ${cfg.tigers + cfg.goats}.`;

  const valT = document.getElementById('val-custom-tigers');
  const valG = document.getElementById('val-custom-goats');
  const valCap = document.getElementById('val-custom-target');
  if (valT) valT.textContent = cfg.tigers;
  if (valG) valG.textContent = cfg.goats;
  if (valCap) valCap.textContent = cfg.target;

  // Stepper button disabled states
  const btnTMinus = document.getElementById('btn-custom-tigers-minus');
  const btnTPlus = document.getElementById('btn-custom-tigers-plus');
  const btnGMinus = document.getElementById('btn-custom-goats-minus');
  const btnGPlus = document.getElementById('btn-custom-goats-plus');
  const btnCapMinus = document.getElementById('btn-custom-target-minus');
  const btnCapPlus = document.getElementById('btn-custom-target-plus');

  if (btnTMinus) btnTMinus.disabled = cfg.tigers <= 1;
  if (btnTPlus) btnTPlus.disabled = cfg.tigers >= 6 || (cfg.tigers + 1 + cfg.goats) > board.capacity;
  if (btnGMinus) btnGMinus.disabled = cfg.goats <= 5;
  if (btnGPlus) btnGPlus.disabled = cfg.goats >= 25 || (cfg.tigers + cfg.goats + 1) > board.capacity;
  if (btnCapMinus) btnCapMinus.disabled = cfg.target <= 1;
  if (btnCapPlus) btnCapPlus.disabled = cfg.target >= cfg.goats;

  // Preset pills
  document.querySelectorAll('.preset-pill').forEach(pill => {
    const preset = PRESETS.find(p => p.id === pill.dataset.preset);
    if (preset) {
      const isAllowed = (preset.tigers + preset.goats) <= board.capacity;
      const isCurrent = cfg.tigers === preset.tigers && cfg.goats === preset.goats;
      pill.classList.toggle('off', !isAllowed);
      pill.classList.toggle('on', isCurrent);
    }
  });
}
