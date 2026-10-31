// Settings, Stats & Opponent Screen UI helpers

import { loadSettings, loadStats } from './storage.js';

export function updateOpponentUI(state) {
  const isMini = state.selectedMode === 'mini';
  const goatPill = document.querySelector('.side-pill[data-side="G"]');
  if (goatPill) goatPill.textContent = isMini ? 'Lamb' : 'Goat';

  const humanCardNote = document.querySelector('#human-options-panel .muted');
  if (humanCardNote) {
    humanCardNote.textContent = isMini
      ? 'Pass the phone after each move. Lamb player moves first.'
      : 'Pass the phone after each move. Goat player moves first.';
  }

  // Update turn timer pills & timeout panel
  const timer = state.timer || { duration: 0, onTimeout: 'forfeit' };
  document.querySelectorAll('.timer-pill').forEach(pill => {
    const val = parseInt(pill.dataset.timer, 10);
    pill.classList.toggle('on', val === timer.duration);
  });

  const timeoutPanel = document.getElementById('timeout-action-panel');
  if (timeoutPanel) {
    timeoutPanel.style.display = timer.duration > 0 ? 'flex' : 'none';
  }

  document.querySelectorAll('.timeout-pill').forEach(pill => {
    pill.classList.toggle('on', pill.dataset.timeout === timer.onTimeout);
  });

  const descEl = document.getElementById('timeout-action-desc');
  if (descEl) {
    descEl.textContent = timer.onTimeout === 'random'
      ? 'Random move: A random legal move will be played automatically.'
      : 'Forfeit: The player whose time runs out loses immediately.';
  }
}

export function renderStats() {
  const stats = loadStats();
  const tbody = document.getElementById('stats-table-body');
  const tableCard = document.getElementById('stats-table-card');
  const emptyCard = document.getElementById('stats-empty-state');
  if (!tbody) return;

  const rows = [
    { label: 'Standard, Tiger', data: stats['standard-tiger'] },
    { label: 'Standard, Goat', data: stats['standard-goat'] },
    { label: 'Mini, Tiger', data: stats['mini-tiger'] },
    { label: 'Mini, Lamb', data: stats['mini-goat'] },
    { label: 'Custom, Tiger', data: stats['custom-tiger'] },
    { label: 'Custom, Goat', data: stats['custom-goat'] }
  ];

  const totalPlayed = rows.reduce((sum, r) => sum + (r.data?.played || 0), 0);
  if (totalPlayed === 0) {
    if (tableCard) tableCard.style.display = 'none';
    if (emptyCard) emptyCard.style.display = 'block';
  } else {
    if (tableCard) tableCard.style.display = 'block';
    if (emptyCard) emptyCard.style.display = 'none';
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.label}</td>
        <td>${r.data ? r.data.played : 0}</td>
        <td>${r.data ? r.data.won : 0}</td>
      </tr>
    `).join('');
  }
}

export function updateSettingsUI() {
  const settings = loadSettings();
  const toggleSound = document.getElementById('toggle-sound');
  const toggleHints = document.getElementById('toggle-hints');
  if (toggleSound) {
    toggleSound.classList.toggle('on', !!settings.sound);
    toggleSound.setAttribute('aria-checked', String(!!settings.sound));
  }
  if (toggleHints) {
    toggleHints.classList.toggle('on', !!settings.hints);
    toggleHints.setAttribute('aria-checked', String(!!settings.hints));
  }
}
