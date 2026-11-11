// Phaser setup: Scale.NONE with our own ResizeObserver. The backbuffer is the CSS size × DPR (capped) and zoom 1/dpr
// shows it at CSS size, so the canvas is never stretched (Phaser's own resize modes render blurry on retina).
// Phaser audio and input are off: audio is our own WebAudio, input is src/game/input.ts.
import Phaser from 'phaser';
import { VIEW } from '../config';
import type { GameScene } from './GameScene';

export function createGame(parent: HTMLElement, scene: GameScene): Phaser.Game {
  const dpr = () => Math.min(window.devicePixelRatio || 1, VIEW.maxDpr);
  const size = () => {
    const r = parent.getBoundingClientRect();
    return [Math.max(1, Math.round(r.width * dpr())), Math.max(1, Math.round(r.height * dpr()))];
  };
  const [width, height] = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: '#000000',
    banner: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr(), autoRound: false },
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    render: { antialias: true, powerPreference: 'high-performance' },
    scene,
  });
  new ResizeObserver(() => {
    const [w, h] = size();
    game.scale.setZoom(1 / dpr());
    game.scale.resize(w, h);
  }).observe(parent);
  return game;
}
