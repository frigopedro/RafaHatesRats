// Bare-minimum DOM HUD + one full-screen tap overlay (PT-BR). Replaced by the UI milestone.

/** Mobile hardening: no zoom, callout, selection, double-tap or rubber-band scrolling. */
export function harden(): void {
  for (const type of ['contextmenu', 'gesturestart', 'dblclick', 'selectstart']) {
    document.addEventListener(type, (e) => e.preventDefault());
  }
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}

export interface Shell {
  hud(progress: number, attempt: number): void;
  /** Shows the overlay; `onTap` (if any) runs on a tap / Enter / Space once `armMs` has passed. */
  overlay(title: string, sub: string, onTap: (() => void) | null, armMs?: number): void;
  hide(): void;
  readonly visible: boolean;
}

export function createShell(root: HTMLElement): Shell {
  root.innerHTML = `
    <div class="hud" aria-hidden="true"><div class="bar"><i></i></div><span class="pct">0%</span><span class="att"></span></div>
    <div class="overlay" role="button" tabindex="0" aria-live="polite" hidden><h1></h1><p></p></div>`;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const bar = $('.bar > i'), pct = $('.pct'), att = $('.att'), ov = $('.overlay');
  let action: (() => void) | null = null;
  let armedAt = 0;
  let lastPct = -1, lastAtt = -1;

  const fire = () => {
    if (action && performance.now() >= armedAt) action();
  };
  ov.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fire();
  });
  window.addEventListener('keydown', (e) => {
    if (!ov.hidden && !e.repeat && (e.code === 'Enter' || e.code === 'Space')) fire();
  });

  return {
    hud(progress, attempt) {
      const p = Math.floor(progress * 100);
      if (p !== lastPct) {
        bar.style.width = `${p}%`;
        pct.textContent = `${p}%`;
        lastPct = p;
      }
      if (attempt !== lastAtt) att.textContent = (lastAtt = attempt) ? `Tentativa ${attempt}` : '';
    },
    overlay(title, sub, onTap, armMs = 0) {
      $('.overlay h1').textContent = title;
      $('.overlay p').textContent = sub;
      action = onTap;
      armedAt = performance.now() + armMs;
      ov.hidden = false;
      ov.focus({ preventScroll: true });
    },
    hide() {
      ov.hidden = true;
      action = null;
    },
    get visible() {
      return !ov.hidden;
    },
  };
}
