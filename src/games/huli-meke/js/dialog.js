// Modal and Confirmation Dialog Helpers

export function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

export function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

export function showConfirmDialog({ title, message, actionLabel, onConfirm }) {
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const actionBtn = document.getElementById('btn-confirm-action');
  const cancelBtn = document.getElementById('btn-confirm-cancel');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (actionBtn) {
    actionBtn.textContent = actionLabel;
    actionBtn.onclick = () => {
      hideModal('modal-confirm');
      if (onConfirm) onConfirm();
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      hideModal('modal-confirm');
    };
  }
  showModal('modal-confirm');
}
