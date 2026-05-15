/**
 * Modal Component — Reusable modal dialog
 */

/**
 * Returns a Promise<boolean> — resolves true on confirm, false on cancel/dismiss.
 */
export function showConfirmDialog({ title, message, confirmLabel = 'Ya, Hapus', cancelLabel = 'Batal', danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop confirm-dialog-backdrop';
    backdrop.innerHTML = `
      <div class="modal confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-message">
        <div class="confirm-dialog-icon ${danger ? 'confirm-dialog-icon--danger' : ''}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 class="confirm-dialog-title" id="cd-title">${title}</h3>
        <p class="confirm-dialog-message" id="cd-message">${message}</p>
        <div class="confirm-dialog-actions">
          <button class="btn confirm-dialog-cancel" id="cd-cancel">${cancelLabel}</button>
          <button class="btn confirm-dialog-confirm ${danger ? 'confirm-dialog-confirm--danger' : ''}" id="cd-confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Focus the cancel button by default (safer default)
    setTimeout(() => backdrop.querySelector('#cd-cancel')?.focus(), 50);

    function close(result) {
      backdrop.classList.add('modal-exit');
      backdrop.addEventListener('animationend', () => {
        backdrop.remove();
        resolve(result);
      }, { once: true });
    }

    backdrop.querySelector('#cd-confirm').addEventListener('click', () => close(true));
    backdrop.querySelector('#cd-cancel').addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });

    const handleKey = (e) => {
      if (e.key === 'Escape') { document.removeEventListener('keydown', handleKey); close(false); }
      if (e.key === 'Enter' && document.activeElement?.id === 'cd-confirm') { document.removeEventListener('keydown', handleKey); close(true); }
    };
    document.addEventListener('keydown', handleKey);
  });
}

export function showModal({ title, content, onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" aria-label="Tutup" id="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  `;

  const modalBody = backdrop.querySelector('#modal-body');
  if (typeof content === 'string') {
    modalBody.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    modalBody.appendChild(content);
  }

  document.body.appendChild(backdrop);

  function close() {
    backdrop.classList.add('modal-exit');
    backdrop.addEventListener('animationend', () => {
      backdrop.remove();
      if (onClose) onClose();
    });
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector('#modal-close-btn').addEventListener('click', close);

  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  return { close, element: backdrop };
}
