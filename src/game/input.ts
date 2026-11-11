// Jump input: any finger on #game, Space or ArrowUp. "Held" = any pointer or jump key down. Edges are queued with
// their event timestamps so the scene can apply each one on the sim tick it actually happened in.

export interface Edge {
  time: number; // performance.now() ms
  down: boolean;
}

export interface Input {
  take(): Edge[]; // edges since the last call
  clear(): void; // drop queued edges (start/retry)
}

const JUMP_KEYS = new Set(['Space', 'ArrowUp']);

export function createInput(el: HTMLElement, on: { pause(): void; retry(): void }): Input {
  const pointers = new Set<number>();
  const keys = new Set<string>();
  let held = false;
  let queue: Edge[] = [];

  const update = (time: number) => {
    const now = pointers.size + keys.size > 0;
    if (now !== held) queue.push({ time, down: (held = now) });
  };

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointers.add(e.pointerId);
    el.setPointerCapture?.(e.pointerId); // keep getting its pointerup if the finger slides off
    update(e.timeStamp);
  });
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    update(e.timeStamp);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  window.addEventListener('keydown', (e) => {
    if (JUMP_KEYS.has(e.code)) {
      e.preventDefault(); // no page scroll
      if (!e.repeat) keys.add(e.code);
      update(e.timeStamp);
    } else if (!e.repeat && (e.code === 'KeyP' || e.code === 'Escape')) on.pause();
    else if (!e.repeat && e.code === 'KeyR') on.retry();
  });
  window.addEventListener('keyup', (e) => {
    if (keys.delete(e.code)) update(e.timeStamp);
  });
  window.addEventListener('blur', () => {
    pointers.clear();
    keys.clear();
    update(performance.now());
  });

  return {
    take() {
      const q = queue;
      queue = [];
      return q;
    },
    clear() {
      queue = [];
    },
  };
}
