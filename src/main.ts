import '@fontsource/jersey-15/latin-400.css';
import './ui/ui.css';
import type Phaser from 'phaser';
import { TICKS_PER_BEAT as TPB } from './config';
import { BeatClock } from './game/clock';
import { createGame } from './game/createGame';
import { GameScene } from './game/GameScene';
import { createInput } from './game/input';
import { LEVELS } from './levels';
import { levelSave, persist } from './save';
import { solve, type TraceInput } from './sim/solver';
import type { GameControl, LevelDef, SimEvent } from './types';
import * as ui from './ui/screens';
import { harden } from './ui/shell';

// Dev flags: ?level=<id or 1-based index> ?t=<start beat> ?bot=1 (autoplay the solver trace) ?debug=1 (hitboxes). With ?bot or ?level
// the menu is skipped. Dev server only: ?screen=menu|fases|ajustes|pause|over|victory (&cause=<hazard> &as=<level id>), ?notch=1.
const q = new URLSearchParams(location.search);
const qBeat = Number(q.get('t') ?? 0);

type State = 'loading' | 'menu' | 'fases' | 'ajustes' | 'run' | 'paused' | 'over' | 'won';
let state: State = 'loading';
const setState = (s: State) => (document.body.dataset.state = state = s); // CSS and scripts/shots*.mjs read it

harden();
const gameEl = document.getElementById('game')!;
ui.init(document.getElementById('ui')!, () => pause(true));
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');

let def: LevelDef | null = null;
let control: GameControl | null = null;
let game: Phaser.Game | null = null;
let host: HTMLElement | null = null;
let gen = 0; // hooks from a game being torn down are ignored
let whenReady: (() => void) | null = null;
let attempt = 0; // this session, this level
let run = { coins: 0, smashed: 0 };

// One input for every game: its listeners live on #game and window for the page's lifetime.
const input = createInput(gameEl, {
  pause: () => (state === 'run' ? pause(true) : state === 'paused' ? pause(false) : (state === 'fases' || state === 'ajustes') && menu()),
  retry: () => ['run', 'paused', 'over', 'won'].includes(state) && play(),
});

/** Makes `d` the loaded level, then calls `then`. GameScene takes its level in the constructor, so switching levels
 *  means a new Phaser game (see report: a GameControl.load(level) would avoid this). */
function load(d: LevelDef, then: () => void) {
  if (d === def) {
    if (control) then();
    else whenReady = then;
    return;
  }
  if (game) retire(game, host!);
  def = d;
  control = null;
  whenReady = then;
  attempt = 0;
  const g = ++gen;
  const startBeat = qBeat > 0 && qBeat < d.lengthBeats ? qBeat : 0;
  let bot: TraceInput[] | null = null;
  if (q.get('bot') === '1') {
    const r = solve(d, { marginMs: d.marginMs, startBeat });
    if (r.ok) bot = r.inputs;
    else console.warn(`bot: no solution from beat ${startBeat}; last survivor died at beat ${r.failBeat}`);
  }
  host = gameEl.appendChild(document.createElement('div'));
  host.className = 'game-host';
  const scene = new GameScene({
    level: d, clock: new BeatClock(d.bpm), input, startBeat, bot, debug: q.get('debug') === '1',
    hooks: {
      onSimEvent: (e) => g === gen && simEvent(e),
      onFrame: (beat, p) => g === gen && ui.hud.frame(beat, p),
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

// createGame's ResizeObserver can't be disconnected: detach the host first so its last callback (0×0) lands while the
// game is still alive, destroy two frames later, then free the WebGL context (Phaser doesn't; iOS caps contexts).
function retire(g: Phaser.Game, el: HTMLElement) {
  el.remove();
  const gl = (g.renderer as { gl?: WebGLRenderingContext } | null)?.gl;
  g.events.once('destroy', () => setTimeout(() => gl?.getExtension('WEBGL_lose_context')?.loseContext()));
  requestAnimationFrame(() => requestAnimationFrame(() => g.destroy(true)));
}

function startLevel(d: LevelDef) {
  if (d !== def || !control) {
    setState('loading');
    ui.hud.show(false);
    ui.loading();
  }
  load(d, play);
}

function play() {
  if (!control || !def) return;
  attempt++;
  levelSave(ui.levelKey(def)).attempts++;
  persist();
  run = { coins: 0, smashed: 0 };
  ui.hide();
  ui.hud.reset(def, attempt);
  control.start();
  setState('run');
  if (portrait.matches) pause(true); // loaded while the phone was upright
}

function pause(on: boolean) {
  if (on && state === 'run' && control?.running) {
    control.setPaused(true);
    setState('paused');
    ui.pause({ continuar: () => pause(false), reiniciar: play, menu });
  } else if (!on && state === 'paused') {
    ui.hide();
    control!.setPaused(false);
    setState('run');
  }
}

function menu() {
  setState('menu'); // a paused run is simply abandoned; JOGAR restarts
  ui.hud.show(false);
  ui.menu({
    jogar() {
      // AUDIO HOOK (unlock): audio.unlock() — must stay inside this click handler for iOS.
      startLevel(nextLevel());
    },
    fases() {
      setState('fases');
      ui.fases({ voltar: menu, play: startLevel });
    },
    ajustes() {
      setState('ajustes');
      ui.ajustes({ voltar: menu });
    },
  });
}

/** JOGAR: the first unfinished level in LEVELS order, else the first. */
function nextLevel(): LevelDef {
  return LEVELS.find((d) => !levelSave(ui.levelKey(d)).done) ?? LEVELS[0];
}

function simEvent(e: SimEvent) {
  if (e.type === 'pickup' && e.kind === 'coin') run.coins++;
  else if (e.type === 'smash') run.smashed++;
  ui.hud.event(e);
  if (e.type === 'win') win();
}

function gameOver(death: Extract<SimEvent, { type: 'death' }>, progress: number) {
  const s = levelSave(ui.levelKey(def!));
  const pct = Math.floor(progress * 100), prev = s.best;
  if (pct > prev) {
    s.best = pct;
    persist();
  }
  console.info(`death at beat ${(death.tick / TPB).toFixed(2)}: ${death.cause}`);
  setState('over');
  ui.gameOver({ cause: death.cause, pct, best: s.best, record: pct > prev && prev > 0 }, { retry: play, menu });
}

function win() {
  const d = def!, s = levelSave(ui.levelKey(d)), card = ui.cardOf(d);
  const firstClear = !s.done, coinRecord = s.done && run.coins > s.coins;
  Object.assign(s, { best: 100, done: true, coins: Math.max(s.coins, run.coins) });
  persist();
  const next = LEVELS[LEVELS.indexOf(d) + 1] ?? null;
  const last = card === ui.CARDS[ui.CARDS.length - 1]; // the story's last level, wherever it sits in LEVELS
  setState('won');
  ui.hud.show(false);
  ui.victory(
    { def: d, card, coins: run.coins, total: ui.coinTotal(d), smashed: run.smashed, attempts: attempt, firstClear, coinRecord, next, last },
    { next: () => next && startLevel(next), repetir: play, menu },
  );
}

portrait.addEventListener('change', () => portrait.matches && pause(true));
document.addEventListener('visibilitychange', () => document.hidden && pause(true));

const qLevel = ui.levelById(q.get('level') ?? '') ?? LEVELS[Number(q.get('level')) - 1];
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
  // &as=church|party dresses level 1 up as a level that isn't in LEVELS yet (name, card, victory text).
  const as = ui.CARDS.find((c) => c.id === q.get('as'));
  load(as ? Object.assign({ ...LEVELS[0], songId: as.id, name: as.name }, { id: as.id }) : qLevel ?? LEVELS[0], () => { // id set either way: LevelDef.id is moving from number to string
    play();
    if (screen === 'pause') return setTimeout(() => pause(true), 600);
    control!.setPaused(true);
    const cause = (q.get('cause') ?? 'rat') as Extract<SimEvent, { type: 'death' }>['cause'];
    if (screen === 'over') gameOver({ type: 'death', tick: 900, cause, hazard: 0 }, 0.41);
    if (screen === 'victory') {
      run = { coins: 23, smashed: 6 };
      win();
    }
  });
}
