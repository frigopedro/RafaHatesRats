// Dev page (kits.html): both standing rigs in every state, 8 phases across one beat per row (jump heights shown at 0.12× to fit), at game scale next to
// wheelchair push_0 and Fabinho for proportion. ?still=crutches|standing renders one idle rig on transparent for the UI.
// ?live=crutches|standing&bpm=132 runs one rig in real time over ground marks scrolling at world speed (window.kitBeat,
// if set, freezes it on that beat). scripts/bake-kits.mjs captures all of it.
import Phaser from 'phaser';
import { TICKS_PER_BEAT as TPB, VIEW } from './config';
import { createRafaKit, drawRafaKit, KITS_ATLAS, type StandingKit } from './game/rafaKits';
import { RAFA_ATLAS, type RafaFx } from './game/rafaView';
import type { SimState } from './types';

const q = new URLSearchParams(location.search);
const still = q.get('still') as StandingKit | null;
const live = q.get('live') as StandingKit | null;
const bpm = Number(q.get('bpm') ?? 132);
declare global { interface Window { kitBeat?: number } }
const STATES = ['idle', 'move', 'jump', 'fall', 'land', 'gelol', 'death'] as const;
const KITS: StandingKit[] = ['crutches', 'standing'];
const PHASES = 8, COL = 170, ROW = 300, REF = 330, GROUND = 285;
const hasFab = await fetch('art/fabinho.json', { method: 'HEAD' }).then((r) => r.ok && !!r.headers.get('content-type')?.includes('json'), () => false);

/** Sim snapshot + fx for phase i/PHASES of a state (one beat of it, or the 250 ms crash for death). */
function sample(state: (typeof STATES)[number], i: number) {
  const t = i / PHASES;
  let beat = 8 + t, vy = 0, support = 0, y = 0, now = 0;
  const fx: RafaFx = { jumpTick: -1e9, landTick: -1e9, deadTick: -1 };
  if (state === 'jump' || state === 'fall') {
    const a = state === 'jump' ? t * 0.5 : 0.5 + t * 0.5; // big jump: 1 beat airtime, 3 blocks apex
    beat = 8 + a; vy = 12 - 24 * a; y = 12 * a - 12 * a * a; support = -1;
    fx.jumpTick = 8 * TPB;
  }
  if (state === 'land') { fx.landTick = 8 * TPB; beat = 8 + t * 0.25; }
  if (state === 'death') { fx.deadTick = 8 * TPB; now = t * 285; }
  const s = { tick: Math.round(beat * TPB), vy, support, y } as SimState;
  return { s, fx, beat, y, now, overdrive: state === 'gelol', idle: state === 'idle' };
}

class Preview extends Phaser.Scene {
  preload(): void {
    this.load.atlas(KITS_ATLAS, 'art/kits.png', 'art/kits.json');
    this.load.atlas(RAFA_ATLAS, 'art/rafa.png', 'art/rafa.json');
    if (hasFab) this.load.atlas('fabinho', 'art/fabinho.png', 'art/fabinho.json');
  }

  private tick?: () => void;

  update(): void {
    this.tick?.();
  }

  create(): void {
    if (live) {
      const rig = createRafaKit(this, live), g = this.add.graphics(), t0 = performance.now(), gy = 290;
      const s = { tick: 0, vy: 0, support: 0, y: 0 } as SimState, fx: RafaFx = { jumpTick: -1e9, landTick: -1e9, deadTick: -1 };
      this.tick = () => {
        const beat = window.kitBeat ?? ((performance.now() - t0) / 60000) * bpm;
        s.tick = Math.round(beat * TPB);
        g.clear().fillStyle(0x6c7570).fillRect(0, gy, 600, 3);
        for (let i = -1; i < 8; i++) g.fillRect(i * 96 - ((beat * 4 * VIEW.block) % 96), gy + 3, 40, 6); // marks move with the world
        drawRafaKit(rig, s, fx, beat, 220, gy, false, 0, 0);
      };
      document.body.dataset.ready = '1';
      return;
    }
    if (still) {
      const rig = createRafaKit(this, still);
      const { s, fx } = sample('idle', 0);
      drawRafaKit(rig, s, fx, 8, this.scale.width / 2, this.scale.height - 6, false, 0, 0, true);
      return;
    }
    const g = this.add.graphics();
    KITS.forEach((kit, k) => STATES.forEach((state, r) => {
      const top = (k * STATES.length + r) * ROW, gy = top + GROUND;
      g.fillStyle(0x6c7570).fillRect(0, gy, this.scale.width, 3);
      this.add.text(6, top + 6, `${kit} · ${state}`, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' });
      this.add.image(70, gy, RAFA_ATLAS, 'push_0');
      if (hasFab) this.add.image(230, gy, 'fabinho', 'turn_side').setOrigin(0.5, 1);
      for (let i = 0; i < PHASES; i++) {
        const sm = sample(state, i), cx = REF + COL * i + COL / 2;
        drawRafaKit(createRafaKit(this, kit), sm.s, sm.fx, sm.beat, cx, gy - sm.y * VIEW.block * 0.12, sm.overdrive, sm.now, 0, sm.idle);
        this.add.text(cx - 30, top + 6, sm.idle || state === 'death' ? `${i}` : `${(sm.beat - 8).toFixed(3)}`, { fontFamily: 'monospace', fontSize: '12px', color: '#e8e8e8' });
      }
    }));
    document.body.dataset.ready = '1';
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  width: still ? 240 : live ? 600 : REF + COL * PHASES,
  height: still ? 280 : live ? 320 : ROW * STATES.length * KITS.length,
  transparent: !!still,
  backgroundColor: '#8d958f',
  banner: false,
  audio: { noAudio: true },
  scene: Preview,
  callbacks: { postBoot: () => { if (still) setTimeout(() => (document.body.dataset.ready = '1'), 300); } },
});
if (still) document.documentElement.style.background = document.body.style.background = 'transparent';
