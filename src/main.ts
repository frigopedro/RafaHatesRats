import '@fontsource/jersey-15/latin-400.css';
import './ui/ui.css';
import type Phaser from 'phaser';
import { createAudio } from './audio';
import { EASY_HEARTS, OVERDRIVE, TICKS_PER_BEAT as TPB } from './config';
import { BeatClock } from './game/clock';
import { createGame } from './game/createGame';
import { GameScene } from './game/GameScene';
import { createInput } from './game/input';
import { LEVELS } from './levels';
import { getSettings, levelSave, onSettings, persist, type Settings } from './save';
import { solve, type TraceInput } from './sim/solver';
import type { GameControl, LevelDef, SimEvent } from './types';
import * as ui from './ui/screens';
import { fullscreen, harden } from './ui/shell';

// Dev flags: ?level=<id or 1-based index> ?t=<start beat> ?bot=1 (autoplay the solver trace, always Difícil) ?debug=1 (hitboxes)
// ?hard=1 (Difícil for this page load, not saved). With ?bot or ?level
// the menu is skipped. Dev server only: ?screen=menu|fases|ajustes|pause|hud|over|victory (&cause=<hazard>
// &delay=1 &od=<beats> &pre=<beats>), ?notch=1.
const q = new URLSearchParams(location.search);
const qBeat = Number(q.get('t') ?? 0);
const hardMode = () => q.get('bot') === '1' || q.get('hard') === '1' || !!getSettings().hard;

type State = 'loading' | 'menu' | 'fases' | 'ajustes' | 'run' | 'paused' | 'over' | 'won';
let state: State = 'loading';
const setState = (s: State) => (document.body.dataset.state = state = s); // CSS and scripts/shots*.mjs read it

harden();
const audio = createAudio(); // the AudioContext itself is made on the first real gesture
// An audio bug must never stop the game: log it (the shot scripts fail on console errors) and play on.
const safe = (f: () => void) => {
  try {
    f();
  } catch (e) {
    console.error('audio:', e);
  }
};
const volumes = (s: Settings) => (audio.setMusicVolume(s.music / 100), audio.setSfxVolume(s.sfx / 100));
volumes(getSettings());
onSettings(volumes);
const gameEl = document.getElementById('game')!;
ui.init(document.getElementById('ui')!, () => pause(true), (n) => safe(() => audio.ui(n)));
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');

let def: LevelDef | null = null;
let control: GameControl | null = null;
let game: Phaser.Game | null = null;
let host: HTMLElement | null = null;
let gen = 0; // hooks from a game being torn down are ignored
let whenReady: (() => void) | null = null;
let clock: BeatClock | null = null;
let attempt = 0; // this session, this level
let winTimer = 0; // the victory card waits a moment so the finish is seen in the game

// One input for every game: its listeners live on #game and window for the page's lifetime.
const input = createInput(gameEl, {
  pause: () => (state === 'run' ? pause(true) : state === 'paused' ? pause(false) : (state === 'fases' || state === 'ajustes') && menu()),
  retry: () => ['run', 'paused', 'over', 'won'].includes(state) && play(state === 'over'),
});

/** Makes `d` the loaded level, then calls `then`. GameScene takes its level in the constructor, so switching levels
 *  means a new Phaser game; createGame's destroy() also frees its observer and WebGL context. */
function load(d: LevelDef, then: () => void) {
  if (d === def) {
    if (control) then();
    else whenReady = then;
    return;
  }
  safe(() => audio.stop());
  game?.destroy(true);
  host?.remove();
  def = d;
  control = null;
  whenReady = then;
  attempt = 0;
  const g = ++gen;
  const startBeat = qBeat > 0 && qBeat < d.lengthBeats ? qBeat : 0;
  clock = new BeatClock(d.bpm);
  let bot: TraceInput[] | null = null;
  if (q.get('bot') === '1') {
    const r = solve(d, { marginMs: d.marginMs, startBeat });
    if (r.ok) bot = r.inputs;
    else console.warn(`bot: no solution from beat ${startBeat}; last survivor died at beat ${r.failBeat}`);
  }
  host = gameEl.appendChild(document.createElement('div'));
  host.className = 'game-host';
  const scene = new GameScene({
    level: d, clock, input, startBeat, bot, debug: q.get('debug') === '1',
    hooks: {
      onSimEvent: (e) => g === gen && simEvent(e),
      onFrame(beat, p) {
        if (g !== gen) return;
        safe(() => audio.pump()); // every frame, paused or not: that is how the audio module hears a pause
        ui.hud.frame(beat, p);
      },
      onGameOver: (death, p) => g === gen && gameOver(death, p),
    },
    onReady(c) {
      if (g !== gen) return;
      control = c;
      const f = whenReady;
      whenReady = null;
      f?.();
    },
  });
  game = createGame(host, scene);
}

function startLevel(d: LevelDef) {
  if (d !== def || !control) {
    setState('loading');
    ui.hud.show(false);
    ui.loading();
  }
  load(d, play);
}

/** `fromCheckpoint`: easy mode's game-over retry (from the start when no checkpoint was passed). */
function play(fromCheckpoint = false) {
  if (!control || !def) return;
  attempt++;
  levelSave(def.id).attempts++;
  persist();
  clearTimeout(winTimer);
  ui.hide();
  const hearts = hardMode() ? 1 : EASY_HEARTS;
  control.start(hearts, fromCheckpoint);
  ui.hud.reset(def, attempt, hearts > 1 ? hearts : 0, control.coins);
  void audio.unlock(); // no-op unless this run was started by a real gesture; the module also self-unlocks
  safe(() => audio.startLevel(def!, clock!, control!.startBeat));
  setState('run');
  if (portrait.matches) pause(true); // loaded while the phone was upright
}

function pause(on: boolean) {
  if (on && state === 'run' && control?.running) {
    control.setPaused(true);
    setState('paused');
    ui.pause(def!, { continuar: () => pause(false), reiniciar: () => play(), menu });
  } else if (!on && state === 'paused') {
    ui.hide();
    control!.setPaused(false);
    setState('run');
  }
}

function menu() {
  safe(() => audio.stop());
  clearTimeout(winTimer);
  setState('menu'); // a paused run is simply abandoned; JOGAR restarts
  ui.hud.show(false);
  ui.menu(nextLevel(), {
    jogar() {
      void audio.unlock(); // iOS: must happen inside this click handler
      fullscreen(); // likewise needs the gesture; no-op where unsupported (iPhone: Home Screen only)
      startLevel(nextLevel());
    },
    fases() {
      setState('fases');
      ui.fases({ voltar: menu, play: (d) => (fullscreen(), startLevel(d)) });
    },
    ajustes() {
      setState('ajustes');
      ui.ajustes({ voltar: menu });
    },
  });
}

/** JOGAR: the first unfinished level in LEVELS order, else the first. */
function nextLevel(): LevelDef {
  return LEVELS.find((d) => !levelSave(d.id).done) ?? LEVELS[0];
}

function simEvent(e: SimEvent) {
  safe(() => audio.onSimEvent(e));
  ui.hud.event(e);
  if (e.type === 'win') win(control!);
}

function gameOver(death: Extract<SimEvent, { type: 'death' }>, progress: number) {
  const s = levelSave(def!.id);
  const pct = Math.floor(progress * 100), prev = s.best;
  if (pct > prev) {
    s.best = pct;
    persist();
  }
  console.info(`death at beat ${(death.tick / TPB).toFixed(2)}: ${death.cause}`);
  setState('over');
  const cp = control!.checkpoint;
  ui.gameOver({ def: def!, cause: death.cause, pct, best: s.best, record: pct > prev && prev > 0, checkpoint: cp === null ? null : Math.floor((cp / def!.lengthBeats) * 100) },
    { retry: () => play(true), restart: () => play(), menu });
}

/** Saves the win now; the card follows `delayMs` later, or at once on a tap or key. */
function win(run: { coins: number; smashed: number }, delayMs = 1200) {
  const d = def!, s = levelSave(d.id), card = ui.cardOf(d);
  const firstClear = !s.done, coinRecord = s.done && run.coins > s.coins, hard = hardMode();
  const info = { def: d, card, hard, coins: run.coins, total: ui.coinTotal(d), smashed: run.smashed, attempts: attempt, firstClear, coinRecord,
    next: LEVELS[LEVELS.indexOf(d) + 1] ?? null, last: card === ui.CARDS[ui.CARDS.length - 1] }; // last = the story's end
  Object.assign(s, { best: 100, done: true, coins: Math.max(s.coins, run.coins) }, hard && { hard: true });
  persist();
  setState('won');
  const show = (e?: Event) => {
    removeEventListener('pointerdown', show, true);
    removeEventListener('keydown', show, true);
    clearTimeout(winTimer);
    if (state !== 'won') return;
    e?.preventDefault(); // this tap/key only reveals the card; it must not also press a button on it
    e?.stopPropagation();
    ui.hud.show(false);
    ui.victory(info, { next: () => info.next && startLevel(info.next), repetir: () => play(), menu });
  };
  if (!delayMs) return show();
  winTimer = window.setTimeout(show, delayMs);
  addEventListener('pointerdown', show, true);
  addEventListener('keydown', show, true);
}

portrait.addEventListener('change', () => portrait.matches && pause(true));
document.addEventListener('visibilitychange', () => document.hidden && pause(true));

const qLevel = LEVELS.find((l) => l.id === q.get('level')) ?? LEVELS[Number(q.get('level')) - 1];
if (import.meta.env.DEV && q.get('notch') === '1') document.body.classList.add('fake-notch');
if (import.meta.env.DEV && q.has('screen')) devScreen(q.get('screen')!);
else if (q.get('bot') === '1' || q.has('level')) startLevel(qLevel ?? LEVELS[0]);
else {
  menu();
  load(nextLevel(), () => {}); // warm up behind the menu so JOGAR is instant
}

/** Dev-only jumps to a screen for scripts/shots-ui.mjs; never part of the normal flow. */
function devScreen(screen: string) {
  if (screen === 'menu' || screen === 'fases' || screen === 'ajustes') {
    menu();
    if (screen !== 'menu') document.querySelector<HTMLElement>(`[data-act=${screen}]`)!.click();
    return;
  }
  load(qLevel ?? LEVELS[0], () => {
    play();
    if (screen === 'pause') return setTimeout(() => pause(true), 600);
    if (screen === 'hud') // frozen run with power-up timers at &od= / &pre= beats left
      return setTimeout(() => {
        control!.setPaused(true);
        const b = ui.hud.beat, od = Number(q.get('od') ?? 0), pre = Number(q.get('pre') ?? 0);
        if (od) Object.assign(ui.hud, { odFrom: b + od - OVERDRIVE.beats, odUntil: b + od });
        if (pre) ui.hud.preUntil = b + pre;
      }, 600);
    control!.setPaused(true);
    const cause = (q.get('cause') ?? 'rat') as Extract<SimEvent, { type: 'death' }>['cause'];
    if (screen === 'over') gameOver({ type: 'death', tick: 900, cause, hazard: 0 }, 0.41);
    if (screen === 'victory') win({ coins: 23, smashed: 6 }, q.get('delay') ? 1200 : 0);
  });
}
