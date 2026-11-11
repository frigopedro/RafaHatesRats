import './ui/ui.css';
import { TICKS_PER_BEAT as TPB } from './config';
import { BeatClock } from './game/clock';
import { createGame } from './game/createGame';
import { GameScene } from './game/GameScene';
import { createInput } from './game/input';
import { LEVELS } from './levels';
import { solve, type TraceInput } from './sim/solver';
import type { GameControl } from './types';
import { createShell, harden } from './ui/shell';

// Dev flags: ?level=<n> ?t=<start beat> ?bot=1 (autoplay the solver trace) ?debug=1 (hitboxes).
const q = new URLSearchParams(location.search);
const levelNo = Number(q.get('level') ?? 1);
const def = LEVELS[Number.isInteger(levelNo) && levelNo >= 1 && levelNo <= LEVELS.length ? levelNo - 1 : 0];
const t = Number(q.get('t') ?? 0);
const startBeat = Number.isFinite(t) && t >= 0 && t < def.lengthBeats ? t : 0;
let bot: TraceInput[] | null = null;
if (q.get('bot') === '1') {
  const r = solve(def, { marginMs: def.marginMs, startBeat });
  if (r.ok) bot = r.inputs;
  else console.warn(`bot: no solution from beat ${startBeat}; last survivor died at beat ${r.failBeat}`);
}

const JOKES = [
  'Pelo menos você ganhou a competição.', 'LCA destruído.', 'Devia ter pulado o dia de perna.',
  'O Gelol não cobre isso.', 'A fisio mandou lembranças.', 'Ratos 1 × 0 Rafa.', 'Até o Fabinho pulava essa.',
];

harden();
const gameEl = document.getElementById('game')!;
const shell = createShell(document.getElementById('ui')!);
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
let control: GameControl | null = null;
let attempt = 0;
let paused = false;
const setState = (s: string) => (document.body.dataset.state = s); // for CSS and scripts/shots.mjs

function play() {
  if (!control || portrait.matches) return;
  attempt++;
  paused = false;
  shell.hide();
  control.start();
  setState('run');
}
function pause(on: boolean) {
  if (!control?.running || on === paused) return;
  paused = on;
  control.setPaused(on);
  if (on) {
    setState('paused');
    if (portrait.matches) shell.overlay('Vire o celular', 'Jogue com o celular deitado', null);
    else shell.overlay('Pausado', 'TOQUE PARA CONTINUAR', () => pause(false));
  } else {
    shell.hide();
    setState('run');
  }
}
function onRotate() {
  if (portrait.matches) {
    if (control?.running) pause(true);
    else shell.overlay('Vire o celular', 'Jogue com o celular deitado', null);
  } else if (paused) shell.overlay('Pausado', 'TOQUE PARA CONTINUAR', () => pause(false));
  else if (control && !control.running) ready();
}
function ready() {
  setState('ready');
  shell.overlay(def.name, 'TOQUE PARA COMEÇAR', play);
}

const clock = new BeatClock(def.bpm);
const input = createInput(gameEl, {
  pause: () => pause(!paused),
  retry: () => attempt > 0 && play(),
});
const scene = new GameScene({
  level: def, clock, input, startBeat, bot, debug: q.get('debug') === '1',
  hooks: {
    onSimEvent(e) {
      if (e.type === 'win') {
        setState('won');
        shell.overlay('VOCÊ VENCEU!', 'TOQUE PARA JOGAR DE NOVO', play, 250);
      }
    },
    onFrame(_beat, progress) {
      shell.hud(progress, attempt);
    },
    onGameOver(death, progress) {
      setState('over');
      const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
      console.info(`death at beat ${(death.tick / TPB).toFixed(2)}: ${death.cause}`);
      shell.overlay(`${joke} ${Math.floor(progress * 100)}%`, 'TOQUE PARA TENTAR DE NOVO', play, 250);
    },
  },
  onReady(c) {
    control = c;
    if (portrait.matches) onRotate();
    else ready();
  },
});
createGame(gameEl, scene);

portrait.addEventListener('change', onRotate);
document.addEventListener('visibilitychange', () => document.hidden && pause(true));
