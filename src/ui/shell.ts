// Mobile hardening and the page-wide image fallback.

/** No zoom, callout, selection, double-tap or rubber-band scrolling. */
export function harden(): void {
  for (const type of ['contextmenu', 'gesturestart', 'dblclick', 'selectstart']) {
    document.addEventListener(type, (e) => e.preventDefault());
  }
  document.addEventListener('touchmove', (e) => {
    if (!(e.target as Element).closest?.('input[type=range]')) e.preventDefault(); // sliders still drag
  }, { passive: false });
  document.addEventListener('touchstart', () => {}, { passive: true }); // iOS only applies :active with a touch listener

  // Art is being produced in parallel: a missing image tries its data-fb fallback once, then hides itself.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const fb = img.dataset.fb;
    if (fb) {
      delete img.dataset.fb;
      img.classList.remove('px');
      img.src = fb;
    } else img.hidden = true;
  }, true);
  document.addEventListener('load', (e) => {
    if (e.target instanceof HTMLImageElement) e.target.hidden = false;
  }, true);
}
