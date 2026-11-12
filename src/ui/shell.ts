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

// Full screen. iPhone Safari has no Fullscreen API for pages: there the only route is the Home Screen (standalone).
export const isStandalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
export const canFullscreen = () => !!document.fullscreenEnabled;
export const FS_HINT = 'Tela cheia no iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”.';

/** Enter (or leave) full screen and lock landscape where the browser allows it. Call from a gesture; never throws. */
export function fullscreen(on = true): void {
  try {
    if (!on) void document.exitFullscreen?.().catch(() => {});
    else if (canFullscreen() && !document.fullscreenElement)
      void document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        .then(() => (screen.orientation as ScreenOrientation & { lock?(o: string): Promise<void> }).lock?.('landscape'))
        .catch(() => {});
  } catch {
    /* old browsers: play windowed */
  }
}
