// Mobile hardening, and missing images hide themselves.

/** No zoom, callout, selection, double-tap or rubber-band scrolling. */
export function harden(): void {
  for (const type of ['contextmenu', 'gesturestart', 'dblclick', 'selectstart']) {
    document.addEventListener(type, (e) => e.preventDefault());
  }
  document.addEventListener('touchmove', (e) => {
    if (!(e.target as Element).closest?.('input[type=range]')) e.preventDefault(); // sliders still drag
  }, { passive: false });
  document.addEventListener('touchstart', () => {}, { passive: true }); // iOS only applies :active with a touch listener

  document.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement) e.target.hidden = true;
  }, true);
  document.addEventListener('load', (e) => {
    if (e.target instanceof HTMLImageElement) e.target.hidden = false;
  }, true);
}
