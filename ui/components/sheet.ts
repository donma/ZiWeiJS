let bound = false;

export function initSheet(): void {
  const backdrop = document.getElementById('sheet-backdrop');
  if (bound) return;
  bound = true;
  backdrop?.addEventListener('click', () => {
    document.getElementById('bottom-sheet')?.classList.remove('show');
    document.getElementById('drawer')?.classList.remove('show');
    backdrop.classList.remove('show');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('bottom-sheet')?.classList.remove('show');
      document.getElementById('drawer')?.classList.remove('show');
      backdrop?.classList.remove('show');
    }
  });
}
