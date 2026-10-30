// Small helpers around the native <dialog> element (focus trap and Escape come built in).

export function openDialog(dialog) {
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}

export function closeDialog(dialog) {
  if (dialog.open) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
}

// Ask a yes/no question. Resolves to true when the player confirms.
export function confirmDialog({ title, message, confirmText = 'OK', cancelText = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'confirm-title');

    const h = document.createElement('h2');
    h.id = 'confirm-title';
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-quiet';
    cancel.textContent = cancelText;
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    ok.textContent = confirmText;
    actions.append(cancel, ok);

    dialog.append(h, p, actions);
    document.body.append(dialog);

    let answer = false;
    cancel.addEventListener('click', () => dialog.close());
    ok.addEventListener('click', () => {
      answer = true;
      dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(answer);
    });
    openDialog(dialog);
    cancel.focus();
  });
}

// Show a brief message that fades away. Needs an element with role="status".
export function toast(element, message, ms = 2200) {
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    element.hidden = true;
  }, ms);
}
