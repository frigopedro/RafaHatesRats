// Every screen outside the canvas: one persistent HUD, one screen layer whose content is swapped, and the CSS-only
// rotate prompt. A screen is a function that fills the layer; buttons carry data-act and run the matching action.
import { EASY_HEARTS, HAZARDS, OVERDRIVE, PRE_TICKS, TICKS_PER_BEAT as TPB } from '../config';
import { LEVELS } from '../levels';
import { getSettings, levelSave, onSettings, resetProgress, setSettings, type Settings } from '../save';
import type { BgManifest } from '../game/background';
import { checkpoints } from '../sim/sim';
import type { HazardKind, LevelDef, SimEvent, Theme } from '../types';
import { deathCard, menuLine } from './jokes';
import { canFullscreen, FS_HINT, fullscreen, isStandalone } from './shell';

type Acts = Record<string, () => void>;

/** The three levels as the player sees them, in story order; a card lights up once its id is in LEVELS.
 *  `boss`: the bossEnter cue brings a boss (angry face); otherwise it is the church's dash to the altar.
 *  Each level has its own Rafa: `faces` (HUD, game over), `phone` (pause), `winImg` / `win2Img` (victory). */
export const CARDS = [
  { id: 'gym', name: 'Campeonato Gym Rats', kit: 'rafagym_turn_34.png', sub: 'Chefe: Fabinho', side: 'fabinhogym_turn_34.png', boss: true,
    faces: 'rafagym_face_', noSad: false, phone: 'rafagym_phone.png', win: '1º LUGAR!', winImg: 'rafagym_armsup.png', win2: '…e um LCA a menos.', win2Img: 'rafagym_knee.png' },
  { id: 'church', name: 'A Madrinha', kit: 'rafamuleta_turn_34.png', sub: 'Missão: chegar ao altar', side: 'giovanni.png', boss: false, flank: ['nathalia_turn_34.png', 'murilo_turn_34.png'],
    faces: 'rafamuleta_face_', noSad: true, phone: 'rafamuleta_phone.png', win: 'CHEGOU A TEMPO, MADRINHA!', winImg: 'rafamuleta_dance.png', win2: '', win2Img: '' },
  { id: 'party', name: 'A Festa', kit: 'rafa_turn_34.png', sub: 'Chefe: O Aranha da Carreta', side: 'aranha_pose1.png', boss: true,
    faces: 'rafa_face_', noSad: false, phone: 'rafa_pose_phone.png', win: 'FIM! Rafa ainda odeia ratos.', winImg: 'rafa_pose_armsup.png', win2: '', win2Img: '' },
];
export type Card = (typeof CARDS)[number];

// Drawn heights relative to standing Rafa (sheets aren't drawn to a common scale); unlisted images (faces) = 1.
const RATIO: Record<string, number> = {
  'rafagym_turn_34.png': 1, 'rafamuleta_turn_34.png': 1, 'rafamuleta_dance.png': 1, 'rafa_turn_34.png': 0.84,
  'fabinhogym_turn_34.png': 1.18, 'giovanni.png': 1.1, 'aranha_pose1.png': 0.65,
  'aranha_pose2.png': 0.76, 'nathalia_turn_34.png': 0.95, 'murilo_turn_34.png': 1.18,
};
const ratioOf = (src: string) => RATIO[src.slice(src.lastIndexOf('/') + 1)] ?? 1;

/** One reference height R for all the figures in `sel` boxes under `root` (each drawn at R × RATIO, feet on the box
 *  bottom): the tallest fills its box height with a little headroom and the widest box's figures fit its width; `overlap` = the fraction of each partner's width that tucks behind
 *  the figure before it (CSS .overlap). Sizes are CSS (.fig): this only hands over the numbers. */
function fitFigures(root: HTMLElement, sel: string, overlap = 0): void {
  const fit = () => {
    let h = 0, w = 0;
    for (const box of root.querySelectorAll(sel)) {
      let bw = 0;
      for (const i of box.querySelectorAll('img')) {
        if (i.hidden || !i.naturalHeight) continue;
        const ov = bw ? overlap : 0;
        const f = (100 * ratioOf(i.src)) / i.naturalHeight; // the PNGs are cropped to their visible content
        i.style.setProperty('--nh', String(i.naturalHeight));
        i.style.setProperty('--f', String(f));
        i.style.setProperty('--nw', String(i.naturalWidth));
        h = Math.max(h, i.naturalHeight * f);
        bw += i.naturalWidth * f * (1 - ov);
      }
      w = Math.max(w, bw);
    }
    if (h) root.style.setProperty('--kh', String(96 / h)), root.style.setProperty('--kw', String(94 / w));
  };
  fit();
  for (const type of ['load', 'error']) root.addEventListener(type, fit, true); // art arrives (or falls back) later
}
export const levelById = (id: string) => LEVELS.find((l) => l.id === id);
export const cardOf = (d: LevelDef) => CARDS.find((c) => c.id === d.id);
const facesOf = (d: LevelDef | null) => (d && cardOf(d)?.faces) || 'rafa_face_';
export const coinTotal = (d: LevelDef) => d.chart.filter((e) => e.t === 'item' && e.kind === 'coin').length;

const FACES = ['smile', 'laugh', 'grin', 'shocked', 'sad', 'angry'] as const;
type Face = (typeof FACES)[number];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
/** An art/ui image. */
const img = (name: string, cls = '', alt = '') => `<img src="art/ui/${name}" class="${cls}" alt="${alt}" draggable="false">`;
/** A 7×6 pixel heart (HUD lives). */
const HEART = '<i class="heart"><svg viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/><rect class="gloss" x="1" y="1" width="1" height="1"/></svg></i>';

/** Fácil / Difícil, shown on the title and the Fases header; the choice is saved at once (setMode). */
const MODE_LINE = ['3 corações e checkpoints', 'Um erro e volta pro início'];
function modeSwitch(): string {
  const hard = !!getSettings().hard;
  const seg = (act: string, label: string, on: boolean) => `<button class="btn ${act}${on ? ' on' : ''}" data-act="${act}" aria-pressed="${on}">${label}</button>`;
  return `<div class="mode" role="group" aria-label="Modo"><div class="seg">${seg('facil', 'FÁCIL', !hard)}${seg('dificil', 'DIFÍCIL', hard)}</div><small>${MODE_LINE[+hard]}</small></div>`;
}
function setMode(hard: boolean): void {
  setSettings({ hard });
  for (const b of layer.querySelectorAll<HTMLElement>('.mode .btn')) {
    const on = (b.dataset.act === 'dificil') === hard;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  }
  for (const t of layer.querySelectorAll('.mode small')) t.textContent = MODE_LINE[+hard];
}
const modeActs: Acts = { facil: () => setMode(false), dificil: () => setMode(true) };

let root: HTMLElement, layer: HTMLElement, live: HTMLElement;
let bg: BgManifest | null = null; // the levels' backdrops (public/art/bg/manifest.json), for .scene
let home: LevelDef = LEVELS[0]; // the level JOGAR starts: its scene is behind the title, Fases and Ajustes
let acts: Acts = {};
let tapAct: (() => void) | null = null; // game over: a tap anywhere / Space / Enter
let tapArmedAt = 0;

export function init(el: HTMLElement, onPause: () => void, sound: (name: 'click' | 'back' | 'start') => void): void {
  root = el;
  root.innerHTML = `
    <div class="hud" hidden>
      <div class="face"><div class="face-in">${img('rafa_face_smile.png', '', '')}</div></div>
      <div class="hud-main">
        <div class="hud-name"></div>
        <div class="hud-row"><div class="bar"><i></i></div><span class="pct">0%</span></div>
      </div>
      <div class="hud-items">
        <span class="hearts" hidden>${HEART.repeat(EASY_HEARTS)}</span>
        <span class="hud-coins" title="Halteres dourados"><i class="ico ico-coin"></i><b>0</b></span>
        <i class="ico ico-whey" title="Whey: escudo" hidden></i>
      </div>
      <span class="att"></span>
      <button class="pause" type="button" aria-label="Pausar"><i></i></button>
      <div class="timers">
        <div class="timer t-gelol" title="Gelol" hidden><i class="ico ico-gelol"></i><div class="tbar"><i></i></div><b></b></div>
        <div class="timer t-pre" title="Pré-treino" hidden><i class="ico ico-pre"></i><div class="tbar"><i></i></div><b></b></div>
        <b class="cp-flash" hidden>CHECKPOINT</b>
      </div>
    </div>
    <div class="layer" hidden></div>
    <p class="sr" aria-live="polite"></p>
    <div class="rotate" role="alert">
      ${img('rafa_pose_chin.png', 'rot-rafa', '')}
      <div class="rot-phone" aria-hidden="true"><i></i></div>
      <p>Vire o celular pra jogar, campeã</p>
    </div>`;
  layer = root.querySelector('.layer')!;
  live = root.querySelector('.sr')!;
  hud.el = root.querySelector('.hud')!;
  // Item icons are cropped from the props atlas (1 CSS px per art px, pixelated); CSS shapes stand in until it loads.
  fetch('art/props.json').then((r) => r.json()).then((j) => {
    const url = new URL(`art/${j.meta.image}`, document.baseURI).href, { w, h } = j.meta.size;
    for (const k of ['gelol', 'pre', 'whey', 'star']) {
      const f = j.frames[k]?.frame;
      if (!f) continue;
      root.style.setProperty(`--spr-${k}`, `url("${url}") -${f.x}px -${f.y}px / ${w}px ${h}px no-repeat`);
      root.style.setProperty(`--spr-${k}-w`, `${f.w}px`);
      root.style.setProperty(`--spr-${k}-h`, `${f.h}px`);
    }
  }).catch(() => {});
  fetch('art/bg/manifest.json').then((r) => r.json()).then((m) => ((bg = m), fillScenes())).catch(() => {});
  document.addEventListener('fullscreenchange', () => {
    const b = layer.querySelector('[data-act=tela]');
    if (b) b.textContent = fsLabel();
  });
  for (const c of CARDS) for (const f of FACES) if (!(c.noSad && f === 'sad')) new Image().src = `art/ui/${c.faces}${f}.png`; // HUD swaps must not flash

  layer.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act!;
    sound(/^(jogar|next|repetir|reiniciar|retomar|lv-)/.test(act) ? 'start' : /^(voltar|menu|nao)$/.test(act) ? 'back' : 'click'); // also unlocks audio
    acts[act]?.();
  });
  layer.addEventListener('pointerdown', (e) => {
    if (!tapAct || (e.target as Element).closest('button')) return;
    e.preventDefault();
    if (performance.now() >= tapArmedAt) tapAct();
  });
  // Keys inside the UI belong to the focused control (native button activation, slider arrows), not to the jump
  // listener on window (src/game/input.ts preventDefaults Space/ArrowUp, which would break both).
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    const onButton = root.contains(t) && t.closest('button, input');
    if (tapAct && (e.code === 'Space' || e.code === 'Enter') && !onButton) {
      e.preventDefault();
      e.stopPropagation(); // else the jump listener sees it right after the retry and Rafa starts mid-jump
      if (!e.repeat && performance.now() >= tapArmedAt) tapAct();
    } else if (root.contains(t) && /^(Space|Enter|Arrow)/.test(e.code)) {
      if (!layer.hidden) e.stopPropagation();
      else if (e.code === 'Space' || e.code === 'ArrowUp') t.blur(); // focused pause button mid-run: it's a jump
    }
  }, true);
  hud.el.querySelector('.pause')!.addEventListener('click', () => (sound('click'), onPause()));

  const fx = (s: Settings) => document.body.classList.toggle('reduce-fx', s.reduceFx);
  fx(getSettings());
  onSettings(fx);
}

function show(cls: string, html: string, a: Acts, focus = 'button:not([disabled])'): void {
  tapAct = null;
  acts = a;
  layer.className = `layer ${cls}`;
  layer.innerHTML = html;
  layer.hidden = false;
  layer.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  fillScenes();
}

/** A level's baked backdrop (CSS .scene): the manifest's layers back→front with their overlays, then the ground. Static
 *  unless `cls` has `drift` (title: slow parallax walk + one beat-blinking detail). Filled once the manifest is in. */
const scene = (theme: Theme, cls = '', beatMs = 500) =>
  `<span class="scene ${cls}" data-theme="${theme}" style="--beat:${Math.round(beatMs)}ms" aria-hidden="true"></span>`;
// The one living detail per theme: these overlays flip to their second frame for half of each beat (--n beats).
const FLIP: Record<string, number> = { neon: 1, windows_a: 2, windows_b: 2, guests: 1 };

function fillScenes(): void {
  if (!bg) return;
  const u = (f: string) => `url('${new URL(`art/${f}`, document.baseURI).href}')`; // absolute: ui.css (in assets/) consumes these; ' not " (inside style="")
  for (const el of layer.querySelectorAll<HTMLElement>('.scene:empty')) {
    const t = bg.themes[el.dataset.theme as Theme];
    if (!t) continue;
    el.style.backgroundColor = t.skyColor;
    el.innerHTML = t.layers.map((l) => {
      // overlays sit at each `at` point in every tile repeat; the layer is one tile wider than the view, so two repeats
      const ovs = (t.overlays ?? []).filter((o) => o.layer === l.name).flatMap((o) => {
        const fr = Object.values(o.frames), n = FLIP[o.name];
        const f0 = o.name === 'windows_b' ? 'none' : u(fr[0]), f1 = fr.length > 1 ? u(fr[1]) : o.name === 'windows_b' ? u(fr[0]) : 'none';
        return o.at.flatMap(([x, y]) => [0, l.width].map((dx) =>
          `<b class="${n ? 'flip' : ''}" style="--x:${x + dx};--oy:${y};--ow:${o.width};--oh:${o.height};--f0:${f0};--f1:${f1};--n:${n ?? 1}"></b>`));
      });
      if (l.frames && FLIP[l.name]) ovs.push(`<b class="flip tile" style="--f0:none;--f1:${u(l.frames[1])}"></b>`);
      return `<i style="--w:${l.width};--h:${l.height};--y:${l.y};--p:${l.parallax};--f0:${u(l.frames?.[0] ?? l.file)}">${ovs.join('')}</i>`;
    }).join('') + (() => {
      const g = t.ground, imgs = [...(g.overlays ?? []).slice(0, 1).map((o) => u(o.file)), u(g.top.file)]; // party: one lit floor set
      return `<i class="gnd" style="--w:${g.top.width};--th:${g.top.height};--p:1;background-image:${imgs.join(',')};--fill:${u(g.fill.file)}"></i>`;
    })();
  }
}

/** Back to the game: no screen, focus off any button so Space is a jump again. */
export function hide(): void {
  tapAct = null;
  layer.hidden = true;
  layer.innerHTML = '';
  (document.activeElement as HTMLElement | null)?.blur?.();
}

export function loading(): void {
  show('dim center', `<p class="loading">Carregando…</p>`, {}, '.loading');
}

/** Golden dumbbells kept over all levels / all there are. */
const allCoins = () => LEVELS.reduce((a, d) => [a[0] + levelSave(d.id).coins, a[1] + coinTotal(d)], [0, 0]);
const coinsTag = () => `<span class="coins"><i class="ico ico-coin"></i><b>${allCoins().join('/')}</b></span>`;

/** Title: the next level's scene, drifting; the logo sign, JOGAR naming that level, the whole cast on the floor. */
export function menu(next: LevelDef, a: { jogar(): void; fases(): void; ajustes(): void }): void {
  home = next;
  const card = cardOf(next) ?? CARDS[0], n = CARDS.indexOf(card) + 1;
  const done = CARDS.filter((c) => levelSave(c.id).done).length;
  const pips = CARDS.map((c, i) => `<i class="pip${levelSave(c.id).done ? ' done' : c === card ? ' now' : ''}">${i + 1}</i>`).join('');
  // Group photo, left to right; Rafa (this level's) in front, the rest overlapping a little. Feet share one floor line.
  const cast = [img('aranha_pose1.png'), img('fabinhogym_turn_34.png'),
    `<span class="say" style="--rr:${Math.max(ratioOf(card.kit), RATIO['fabinhogym_turn_34.png'])}"><span class="bubble">${esc(menuLine(card.id))}</span></span>`,
    img(card.kit, 'rafa', 'Rafa'), img('giovanni.png'), img('nathalia_turn_34.png'), img('murilo_turn_34.png')].join('');
  const hint = !canFullscreen() && !isStandalone() ? `<p class="fs-hint">${FS_HINT}</p>` : '';
  show('menu', `
    ${scene(next.theme, 'drift title', 60000 / next.bpm)}
    <div class="menu-col">
      <div class="sign" data-theme="${next.theme}"><h1 class="logo panel"><img src="art/logo.png" alt="RafaHatesRats" draggable="false"><span>Rafa<b>Hates</b>Rats</span></h1></div>
      <button class="btn big play" data-act="jogar">JOGAR<small>Fase ${n}: ${esc(next.name)}</small></button>
      ${modeSwitch()}
      <div class="pair"><button class="btn teal" data-act="fases">FASES</button><button class="btn sage" data-act="ajustes">AJUSTES</button></div>
      <div class="trail"><span class="pips">${pips}</span>${coinsTag()}<span class="sr">${done} de ${CARDS.length} fases concluídas</span></div>
      ${hint}
    </div>
    <div class="stage"><div class="cast fig overlap">${cast}</div></div>`, { ...a, ...modeActs });
  fitFigures(layer.querySelector('.stage')!, '.cast', 0.15);
}

const header = (title: string, right = '') =>
  `<header class="top"><button class="btn small sage" data-act="voltar">◀ VOLTAR</button><h2>${title}</h2>${right}</header>`;

export function fases(a: { voltar(): void; play(d: LevelDef): void }): void {
  const cardActs: Acts = { voltar: a.voltar, ...modeActs };
  const cards = CARDS.map((c, i) => {
    const def = levelById(c.id);
    if (def) cardActs[`lv-${c.id}`] = () => a.play(def);
    const s = levelSave(c.id);
    const plaque = def
      ? `<span class="best"><span class="bar"><i style="--p:${s.best / 100}"></i></span><b>${s.best}%</b></span>
        <span class="stats"><span><i class="ico ico-coin"></i> <b>${s.coins}/${coinTotal(def)}</b></span><span>Tentativas <b>${s.attempts}</b></span></span>`
      : '<span class="soon">Em breve</span>';
    return `
      <button class="card${s.done ? ' done' : ''}" data-act="lv-${c.id}" data-theme="${def?.theme ?? c.id}"${def ? '' : ' disabled'}>
        <span class="win">${scene(def?.theme ?? (c.id as Theme))}<span class="card-art fig overlap">${img(c.kit, 'kit')}${img(c.side, 'boss')}</span></span>
        <span class="num" aria-label="Fase ${i + 1}">${i + 1}</span>
        ${s.done ? '<span class="ribbon">CONCLUÍDA</span>' : ''}${s.hard ? '<span class="ribbon hard">DIFÍCIL</span>' : ''}
        <span class="plaque">
          <span class="card-title">${esc(def?.name ?? c.name)}</span>
          <span class="card-boss">${c.sub}</span>
          ${plaque}
        </span>
      </button>`;
  }).join('');
  show('fases', `${scene(home.theme, 'dim')}${header('Fases', modeSwitch() + coinsTag())}<div class="cards">${cards}</div>`, cardActs, '.card:not([disabled])');
  fitFigures(layer.querySelector('.cards')!, '.card-art', 0.15);
}

const fsLabel = () => (document.fullscreenElement ? 'SAIR' : 'ATIVAR');

export function ajustes(a: { voltar(): void }): void {
  const s = getSettings();
  const range = (key: 'music' | 'sfx', label: string) =>
    `<label class="row"><span class="lbl">${label}</span><input type="range" min="0" max="100" step="5" value="${s[key]}" data-set="${key}" style="--v:${s[key]}%"><output>${s[key]}</output></label>`;
  const tela = isStandalone() ? '<span class="note">Já está em tela cheia.</span>'
    : canFullscreen() ? `<button class="btn small teal" data-act="tela">${fsLabel()}</button>` : `<span class="note">${FS_HINT}</span>`;
  show('ajustes', `
    ${scene(home.theme, 'dim')}
    ${header('Ajustes')}
    <div class="ajustes-body">
      <div class="panel form" data-theme="${home.theme}">
        ${range('music', 'Música')}
        ${range('sfx', 'Efeitos')}
        <label class="row check"><input type="checkbox" data-set="reduceFx"${s.reduceFx ? ' checked' : ''}><span class="lbl">Reduzir efeitos<small>menos tremor, flashes e confete</small></span></label>
        <div class="row tela"><span class="lbl">Tela cheia</span>${tela}</div>
        <div class="row erase"><button class="link" data-act="apagar">Apagar progresso</button></div>
      </div>
      ${img('rafa_pose_point.png', 'hero side', '')}
    </div>`, {
    voltar: a.voltar,
    tela: () => fullscreen(!document.fullscreenElement),
    apagar() {
      const row = layer.querySelector('.erase')!;
      row.innerHTML = `<span class="lbl">Apagar tudo?</span><button class="btn small red" data-act="sim">SIM, APAGAR</button><button class="btn small sage" data-act="nao">CANCELAR</button>`;
      row.querySelector<HTMLElement>('[data-act=nao]')!.focus();
    },
    sim() {
      resetProgress();
      const row = layer.querySelector('.erase')!;
      row.innerHTML = `<span class="lbl done" tabindex="-1">Progresso apagado.</span>`;
      live.textContent = 'Progresso apagado.';
      row.querySelector<HTMLElement>('.done')!.focus();
    },
    nao() {
      const row = layer.querySelector('.erase')!;
      row.innerHTML = `<button class="link" data-act="apagar">Apagar progresso</button>`;
      row.querySelector<HTMLElement>('button')!.focus();
    },
  }, 'input');
  layer.querySelector('.form')!.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const key = el.dataset.set as keyof Settings;
    if (key === 'reduceFx') setSettings({ reduceFx: el.checked });
    else {
      setSettings({ [key]: Number(el.value) }); // main.ts applies volumes to the audio through onSettings()
      el.nextElementSibling!.textContent = el.value;
      el.style.setProperty('--v', `${el.value}%`);
    }
  });
}

export function pause(d: LevelDef, a: { continuar(): void; reiniciar(): void; menu(): void }): void {
  show('dim center', `
    <div class="panel pausa" data-theme="${d.theme}">
      <h2 class="tab">Pausa</h2>
      ${img(cardOf(d)?.phone ?? 'rafa_pose_phone.png', 'hero small', 'Rafa no celular')}
      <div class="stack">
        <button class="btn big" data-act="continuar">CONTINUAR</button>
        <button class="btn teal" data-act="reiniciar">REINICIAR</button>
        <button class="btn sage" data-act="menu">MENU</button>
      </div>
    </div>`, a);
}

/** `checkpoint`: % of the last checkpoint passed (easy mode), which offers CONTINUAR from there; null = the classic card. */
export interface OverInfo { def: LevelDef; cause: string; pct: number; best: number; record: boolean; checkpoint: number | null }

export function gameOver(o: OverInfo, a: { retry(): void; restart(): void; menu(): void }): void {
  const c = deathCard(o.cause, HAZARDS[o.cause as HazardKind]?.size === 'big'); // kinds unknown to config are fine
  // A partner face shares her head scale; a full-figure partner (Giovanni, the Aranha) stands at the figure height.
  const faces = !!c.boss?.includes('_face_');
  show('dim center over', `
    <button class="btn small sage corner" data-act="menu">MENU</button>
    <div class="panel over-card" data-theme="${o.def.theme}" tabindex="-1">
      <h2 class="tab">${esc(o.def.name)}</h2>
      <div class="over-art${faces ? ' fig' : ''}">${img(`${facesOf(o.def)}${c.face === 'sad' && cardOf(o.def)?.noSad ? 'shocked' : c.face}.png`, 'over-face', '')}${c.boss ? img(c.boss, `over-boss${faces ? '' : ' figure'}`) : ''}</div>
      <div class="over-text">
        <p class="joke">${c.line}</p>
        <div class="run" style="--p:${o.pct / 100};--b:${o.best}%">
          <div class="bar"><i></i></div>${o.record ? '' : '<s title="Recorde"></s>'}
        </div>
        <p class="score"><span>Agora <b>${o.pct}%</b></span>${o.record ? '<span class="rec">Novo recorde!</span>' : `<span>Recorde <b>${o.best}%</b></span>`}</p>
        ${o.checkpoint === null ? '<p class="tap">Toque para tentar de novo</p>' : `<div class="btns over-btns">
          <button class="btn cont" data-act="retomar">CONTINUAR<small>do checkpoint · ${o.checkpoint}%</small></button>
          <button class="btn teal" data-act="reiniciar">DO INÍCIO</button>
        </div>`}
      </div>
    </div>`, { menu: a.menu, retomar: a.retry, reiniciar: a.restart }, '.over-card');
  if (faces) fitFigures(layer.querySelector('.over-card')!, '.over-art');
  live.textContent = `${c.line} ${o.pct}%.`;
  tapAct = a.retry;
  tapArmedAt = performance.now() + 250; // the tap that killed her must not skip the card
}

export interface WinInfo { def: LevelDef; card: Card | undefined; hard: boolean; coins: number; total: number; smashed: number; attempts: number; firstClear: boolean; coinRecord: boolean; next: LevelDef | null; last: boolean }

export function victory(w: WinInfo, a: { next(): void; repetir(): void; menu(): void }): void {
  const confetti = getSettings().reduceFx ? '' : `<div class="confetti" aria-hidden="true">${Array.from({ length: 36 }, (_, i) =>
    `<i style="--x:${Math.random() * 100}%;--dx:${(Math.random() - 0.5) * 30}vw;--r:${Math.random() * 900 - 450}deg;--d:${1.2 + Math.random()}s;--w:${Math.random() * 0.4}s;--c:${['#f5c23a', '#22a39a', '#e040c0', '#a8b6a3', '#3a6fd8', '#f26b55'][i % 6]}"></i>`).join('')}</div>`;
  const recs = [w.firstClear && 'Primeira vitória!', w.coinRecord && 'Recorde de halteres!'].filter(Boolean);
  const next = w.last ? '' : w.next ? '<button class="btn big" data-act="next">PRÓXIMA FASE</button>' : '<button class="btn" disabled>PRÓXIMA FASE · EM BREVE</button>';
  // gym: a beat after "1º LUGAR!" the knee goes — the second line and the knee-hugging Rafa appear on the beat.
  const beat = `--beat:${Math.round(60000 / w.def.bpm)}ms`;
  const c = w.card, win = img(c?.winImg ?? 'rafa_pose_armsup.png', 'hero small', 'Rafa comemorando');
  const art = c?.win2
    ? `<div class="vit-art" style="${beat}">${win.replace('hero small', 'hero small then-hide')}${img(c.win2Img, 'hero small then-show', 'Rafa abraçando o joelho')}</div>`
    : c?.flank // church: the couple beside her at the altar (each hides itself until its art exists)
      ? `<div class="vit-trio fig">${img(c.flank[0], '', 'Nathalia')}${win.replace('hero small', 'mid')}${img(c.flank[1], '', 'Murilo')}</div>`
      : win;
  show('dim center', `${confetti}
    <div class="panel vitoria" data-theme="${w.def.theme}">
      <h2 class="tab">${esc(w.def.name)}</h2>
      ${art}
      <div class="vit-body">
        <h2>${(w.card?.win ?? 'FASE CONCLUÍDA!').replace('º', '<span class="ord">º</span>')}</h2>
        ${w.card?.win2 ? `<p class="win2 then-show" style="${beat}">${w.card.win2}</p>` : ''}
        ${w.hard ? '<span class="hard-mark">MODO DIFÍCIL</span>' : ''}
        <dl class="tiles">
          <div><dt><i class="ico ico-star"></i>Pontos</dt><dd>${w.coins * 10 + w.smashed * 5}</dd></div>
          <div><dt><i class="ico ico-coin"></i>Halteres</dt><dd>${w.coins}/${w.total}</dd></div>
          <div><dt>${img(`${facesOf(w.def)}smile.png`, 'ico ico-face')}Tentativas</dt><dd>${w.attempts}</dd></div>
        </dl>
        ${recs.length ? `<p class="rec">${recs.join(' · ')}</p>` : ''}
        <div class="btns">${next}<button class="btn teal" data-act="repetir">REPETIR</button><button class="btn sage" data-act="menu">MENU</button></div>
      </div>
    </div>`, a);
  if (c?.flank) fitFigures(layer.querySelector('.vitoria')!, '.vit-trio');
  live.textContent = `${w.card?.win ?? 'Fase concluída!'} ${w.card?.win2 ?? ''} ${w.coins} de ${w.total} halteres.`;
}

/** The HUD: written only when something it shows changes (onFrame runs every frame). */
export const hud = {
  el: null as unknown as HTMLElement,
  pct: -1, att: -1, face: '' as Face | '', od: false,
  tm: { gelol: { on: false, n: -1, p: '' }, pre: { on: false, n: -1, p: '' } },
  coins: 0, shield: false, boss: false, dead: false, laughUntil: 0, odFrom: 0, odUntil: 0, preUntil: 0,
  bossFace: 'angry' as Face, shockUntil: 0, beatMs: 500, faces: 'rafa_face_', beat: 0,
  hearts: 0, maxHearts: 0, cps: [] as number[], cpTimer: 0,

  $<T extends HTMLElement>(sel: string): T {
    return this.el.querySelector(sel) as T;
  },
  show(on: boolean): void {
    this.el.hidden = !on;
  },
  /** `hearts` = 0 in Difícil: no hearts, no checkpoint ticks. `coins`: kept from the checkpoint. */
  reset(def: LevelDef, attempt: number, hearts = 0, coins = 0): void {
    Object.assign(this, { pct: -1, coins, shield: false, boss: false, dead: false, laughUntil: 0, odFrom: 0, odUntil: 0, preUntil: 0, shockUntil: 0 });
    // Church has no boss: its bossEnter is "the bride is coming" — a beat of shock, then a determined grin.
    this.bossFace = cardOf(def)?.boss === false ? 'grin' : 'angry';
    this.beatMs = 60000 / def.bpm;
    this.faces = facesOf(def);
    this.face = ''; // the face set may have changed: rewrite the image on the next frame
    this.$('.hud-name').textContent = def.name;
    this.$('.att').textContent = `Tentativa ${attempt}`;
    this.$('.hud-coins b').textContent = String(coins);
    this.$('.ico-whey').hidden = this.$('.t-gelol').hidden = this.$('.t-pre').hidden = true;
    this.el.classList.remove('od');
    this.od = false;
    this.tm = { gelol: { on: false, n: -1, p: '' }, pre: { on: false, n: -1, p: '' } };
    this.maxHearts = hearts;
    this.cps = hearts ? checkpoints(def) : [];
    this.$('.hearts').hidden = !hearts;
    this.setHearts(hearts);
    this.$('.hud-row .bar').querySelectorAll('s').forEach((t) => t.remove());
    this.$('.hud-row .bar').insertAdjacentHTML('beforeend', this.cps.map((b) => `<s style="--x:${(b / def.lengthBeats) * 100}%"></s>`).join(''));
    clearTimeout(this.cpTimer);
    this.$('.cp-flash').hidden = true;
    this.el.hidden = false;
  },
  /** Fills the first `n` hearts; `pop` animates the one just lost. */
  setHearts(n: number, pop = false): void {
    const hs = this.el.querySelectorAll<HTMLElement>('.heart');
    hs.forEach((h, i) => h.classList.toggle('empty', i >= n));
    const lost = hs[n];
    if (pop && lost) {
      lost.classList.remove('pop');
      void lost.offsetWidth; // restart the animation
      lost.classList.add('pop');
    }
    this.hearts = n;
  },
  event(e: SimEvent): void {
    if (e.type === 'pickup') {
      this.laughUntil = performance.now() + 700;
      if (e.kind === 'coin') this.$('.hud-coins b').textContent = String(++this.coins);
      else if (e.kind === 'whey') this.$('.ico-whey').hidden = !(this.shield = true);
      else if (e.kind === 'pre') this.preUntil = (e.tick + PRE_TICKS) / TPB;
      else {
        // Mirrors the sim: Gelol starts on the next whole beat; another one while it runs extends it.
        const next = Math.floor(e.tick / TPB) + 1;
        if (e.tick >= this.odUntil * TPB) this.odFrom = next;
        this.odUntil = next + OVERDRIVE.beats;
      }
    } else if (e.type === 'shieldBreak') this.$('.ico-whey').hidden = !(this.shield = false);
    else if (e.type === 'hurt') this.setHearts(this.hearts - 1, true);
    else if (e.type === 'death') {
      this.dead = true;
      if (this.maxHearts) this.setHearts(0, true);
    } else if (e.type === 'cue' && e.cue.cue === 'section' && this.cps.includes(e.cue.beat)) {
      this.setHearts(this.maxHearts); // the sim refills them here too
      const f = this.$('.cp-flash');
      f.hidden = false;
      clearTimeout(this.cpTimer);
      this.cpTimer = window.setTimeout(() => (f.hidden = true), 1400);
    }
    else if (e.type === 'cue' && (e.cue.cue === 'bossEnter' || e.cue.cue === 'bossExit')) {
      this.boss = e.cue.cue === 'bossEnter';
      if (this.boss && this.bossFace === 'grin') this.shockUntil = performance.now() + this.beatMs;
    }
  },
  /** A draining power-up timer with the beats left; red for the last `warn` beats, pulsing once per beat. */
  timer(name: 'gelol' | 'pre', beat: number, from: number, until: number, total: number, warn: number): boolean {
    const st = this.tm[name], el = this.$(`.t-${name}`);
    const on = beat >= from && beat < until;
    if (on !== st.on) el.hidden = !(st.on = on);
    if (!on) return false;
    const left = until - beat, n = Math.ceil(left), p = Math.min(1, left / total).toFixed(3); // an extension refills it
    if (p !== st.p) el.style.setProperty('--p', (st.p = p));
    if (n !== st.n) {
      st.n = n;
      el.querySelector('b')!.textContent = String(n);
      el.classList.toggle('warn', n <= warn);
      el.classList.toggle('odd', n % 2 === 1); // alternating animation names restart the pulse every beat
    }
    return true;
  },
  frame(beat: number, progress: number): void {
    this.beat = beat;
    const p = Math.floor(progress * 100);
    if (p !== this.pct) {
      this.pct = p;
      this.$('.bar > i').style.transform = `scaleX(${p / 100})`;
      this.$('.pct').textContent = `${p}%`;
    }
    const od = this.timer('gelol', beat, this.odFrom, this.odUntil, OVERDRIVE.beats, 3);
    if (od !== this.od) this.el.classList.toggle('od', (this.od = od));
    this.timer('pre', beat, this.preUntil - PRE_TICKS / TPB, this.preUntil, PRE_TICKS / TPB, 2);
    const now = performance.now();
    const face: Face = this.dead || now < this.shockUntil ? 'shocked' : now < this.laughUntil ? 'laugh' : od ? 'grin' : this.boss ? this.bossFace : 'smile';
    if (face !== this.face) this.$<HTMLImageElement>('.face img').src = `art/ui/${this.faces}${(this.face = face)}.png`;
  },
};
