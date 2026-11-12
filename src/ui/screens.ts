// Every screen outside the canvas: one persistent HUD, one screen layer whose content is swapped, and the CSS-only
// rotate prompt. A screen is a function that fills the layer; buttons carry data-act and run the matching action.
import { HAZARDS, OVERDRIVE, PRE_TICKS, TICKS_PER_BEAT as TPB } from '../config';
import { LEVELS } from '../levels';
import { getSettings, levelSave, onSettings, resetProgress, setSettings, type Settings } from '../save';
import type { HazardKind, LevelDef, SimEvent } from '../types';
import { deathCard } from './jokes';

type Acts = Record<string, () => void>;

/** The three levels as the player sees them, in story order; a card lights up once its id is in LEVELS.
 *  `boss`: the bossEnter cue brings a boss (angry face); otherwise it is the church's dash to the altar.
 *  Each level has its own Rafa: `faces` (HUD, game over), `phone` (pause), `winImg` / `win2Img` (victory). */
export const CARDS = [
  { id: 'gym', name: 'Campeonato Gym Rats', kit: 'rafagym_turn_34.png', kitPx: false, sub: 'Chefe: Fabinho', side: 'fabinhogym_turn_34.png', sideFb: 'fabinho_armscrossed.png', sidePx: false, boss: true,
    faces: 'rafagym_face_', noSad: false, phone: 'rafagym_phone.png', win: '1º LUGAR!', winImg: 'rafagym_armsup.png', winPx: false, win2: '…e um LCA a menos.', win2Img: 'rafagym_knee.png' },
  { id: 'church', name: 'A Madrinha', kit: 'rafamuleta_turn_34.png', kitPx: false, sub: 'Missão: chegar ao altar', side: 'giovanni.png', sideFb: undefined, sidePx: false, boss: false, flank: ['nathalia_turn_34.png', 'murilo_turn_34.png'],
    faces: 'rafamuleta_face_', noSad: true, phone: 'rafamuleta_phone.png', win: 'CHEGOU A TEMPO, MADRINHA!', winImg: 'rafamuleta_dance.png', winPx: false, win2: '', win2Img: '' },
  { id: 'party', name: 'A Festa', kit: 'rafa_turn_34.png', kitPx: false, sub: 'Chefe: O Aranha da Carreta', side: 'aranha_pose1.png', sideFb: undefined, sidePx: true, boss: true,
    faces: 'rafa_face_', noSad: false, phone: 'rafa_pose_phone.png', win: 'FIM! Rafa ainda odeia ratos.', winImg: 'rafa_pose_armsup.png', winPx: false, win2: '', win2Img: '' },
];
export type Card = (typeof CARDS)[number];

// Drawn heights relative to standing Rafa (sheets aren't drawn to a common scale); unlisted images (faces) = 1.
const RATIO: Record<string, number> = {
  'rafagym_turn_34.png': 1, 'rafamuleta_turn_34.png': 1, 'rafamuleta_dance.png': 1, 'rafa_turn_34.png': 0.84,
  'fabinhogym_turn_34.png': 0.88, 'fabinho_armscrossed.png': 0.88, 'giovanni.png': 1.18, 'aranha_pose1.png': 0.7,
  'aranha_pose2.png': 0.8, 'nathalia_turn_34.png': 0.95, 'murilo_turn_34.png': 1.06,
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
/** `fb` = fallback image (used by the kit Rafas, which arrive later); `px` = crisp enlarged pixel art. */
const img = (name: string, cls = '', alt = '', fb?: string) =>
  `<img src="art/ui/${name}" class="${cls}" alt="${alt}"${fb ? ` data-fb="art/ui/${fb}"` : ''} draggable="false">`;

let root: HTMLElement, layer: HTMLElement, live: HTMLElement;
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
        <span class="hud-coins" title="Halteres dourados"><i class="ico ico-coin"></i><b>0</b></span>
        <i class="ico ico-whey" title="Whey: escudo" hidden></i>
      </div>
      <span class="att"></span>
      <button class="pause" type="button" aria-label="Pausar"><i></i></button>
      <div class="timers">
        <div class="timer t-gelol" title="Gelol" hidden><i class="ico ico-gelol"></i><div class="tbar"><i></i></div><b></b></div>
        <div class="timer t-pre" title="Pré-treino" hidden><i class="ico ico-pre"></i><div class="tbar"><i></i></div><b></b></div>
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
    for (const k of ['gelol', 'pre', 'whey']) {
      const f = j.frames[k]?.frame;
      if (!f) continue;
      root.style.setProperty(`--spr-${k}`, `url("${url}") -${f.x}px -${f.y}px / ${w}px ${h}px no-repeat`);
      root.style.setProperty(`--spr-${k}-w`, `${f.w}px`);
      root.style.setProperty(`--spr-${k}-h`, `${f.h}px`);
    }
  }).catch(() => {});
  for (const c of CARDS) for (const f of FACES) if (!(c.noSad && f === 'sad')) new Image().src = `art/ui/${c.faces}${f}.png`; // HUD swaps must not flash

  layer.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act!;
    sound(/^(jogar|next|repetir|reiniciar|lv-)/.test(act) ? 'start' : /^(voltar|menu|nao)$/.test(act) ? 'back' : 'click'); // also unlocks audio
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

export function menu(a: { jogar(): void; fases(): void; ajustes(): void }): void {
  show('bg menu', `
    <div class="menu-col">
      <h1 class="logo"><img src="art/logo.png" alt="RafaHatesRats" draggable="false"><span>Rafa<b>Hates</b>Rats</span></h1>
      <nav class="stack">
        <button class="btn big" data-act="jogar">JOGAR</button>
        <button class="btn teal" data-act="fases">FASES</button>
        <button class="btn sage" data-act="ajustes">AJUSTES</button>
      </nav>
    </div>
    <div class="hero-wrap">${img('rafa_pose_wave.png', 'hero bob', 'Rafa acenando')}</div>`, a);
}

const header = (title: string) =>
  `<header class="top"><button class="btn small sage" data-act="voltar">◀ VOLTAR</button><h2>${title}</h2></header>`;

export function fases(a: { voltar(): void; play(d: LevelDef): void }): void {
  const cardActs: Acts = { voltar: a.voltar };
  const cards = CARDS.map((c, i) => {
    const def = levelById(c.id);
    if (def) cardActs[`lv-${c.id}`] = () => a.play(def);
    const s = levelSave(c.id);
    const stats = def
      ? `<span class="stats"><span>Melhor <b>${s.best}%</b></span><span><i class="ico ico-coin"></i> <b>${s.coins}/${coinTotal(def)}</b></span><span>Tentativas <b>${s.attempts}</b></span></span>`
      : '';
    const badge = !def ? '<span class="badge soon">EM BREVE</span>' : s.done ? '<span class="badge">CONCLUÍDA ✓</span>' : '';
    return `
      <button class="card" data-act="lv-${c.id}"${def ? '' : ' disabled'}>
        <span class="card-n">FASE ${i + 1}</span>
        <span class="card-title">${esc(def?.name ?? c.name)}</span>
        <span class="card-art fig overlap">${img(c.kit, `kit${c.kitPx ? ' px' : ''}`, '', c.kitPx ? 'rafa_turn_34.png' : undefined)}${img(c.side, `boss${c.sidePx ? ' px' : ''}`, '', c.sideFb)}</span>
        <span class="card-boss">${c.sub}</span>
        ${stats}${badge}
      </button>`;
  }).join('');
  show('bg fases', `${header('FASES')}<div class="cards">${cards}</div>`, cardActs, '.card:not([disabled])');
  fitFigures(layer.querySelector('.cards')!, '.card-art', 0.15);
}

export function ajustes(a: { voltar(): void }): void {
  const s = getSettings();
  const range = (key: 'music' | 'sfx', label: string) =>
    `<label class="row"><span class="lbl">${label}</span><input type="range" min="0" max="100" step="5" value="${s[key]}" data-set="${key}"><output>${s[key]}</output></label>`;
  show('bg ajustes', `
    ${header('AJUSTES')}
    <div class="ajustes-body">
      <div class="panel form">
        ${range('music', 'Música')}
        ${range('sfx', 'Efeitos')}
        <label class="row check"><input type="checkbox" data-set="reduceFx"${s.reduceFx ? ' checked' : ''}><span class="lbl">Reduzir efeitos<small>menos tremor, flashes e confete</small></span></label>
        <div class="row erase"><button class="btn small red" data-act="apagar">Apagar progresso</button></div>
      </div>
      ${img('rafa_pose_point.png', 'hero side', '')}
    </div>`, {
    voltar: a.voltar,
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
      row.innerHTML = `<button class="btn small red" data-act="apagar">Apagar progresso</button>`;
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
    }
  });
}

export function pause(d: LevelDef, a: { continuar(): void; reiniciar(): void; menu(): void }): void {
  show('dim center', `
    <div class="panel pausa">
      ${img(cardOf(d)?.phone ?? 'rafa_pose_phone.png', 'hero small', 'Rafa no celular')}
      <div class="stack">
        <h2>PAUSA</h2>
        <button class="btn big" data-act="continuar">CONTINUAR</button>
        <button class="btn teal" data-act="reiniciar">REINICIAR</button>
        <button class="btn sage" data-act="menu">MENU</button>
      </div>
    </div>`, a);
}

export interface OverInfo { def: LevelDef; cause: string; pct: number; best: number; record: boolean }

export function gameOver(o: OverInfo, a: { retry(): void; menu(): void }): void {
  const c = deathCard(o.cause, HAZARDS[o.cause as HazardKind]?.size === 'big'); // kinds unknown to config are fine
  // A partner face shares her head scale; a full-figure partner (Giovanni, the Aranha) stands at the figure height.
  const faces = !!c.boss?.includes('_face_');
  show('dim center over', `
    <button class="btn small sage corner" data-act="menu">MENU</button>
    <div class="panel over-card" tabindex="-1">
      <div class="over-art${faces ? ' fig' : ''}">${img(`${facesOf(o.def)}${c.face === 'sad' && cardOf(o.def)?.noSad ? 'shocked' : c.face}.png`, 'over-face', '')}${c.boss ? img(c.boss, `over-boss${c.px ? ' px' : ''}${faces ? '' : ' figure'}`, '', c.fb) : ''}</div>
      <div class="over-text">
        <p class="joke">${c.line}</p>
        <p class="score"><b>${o.pct}%</b> ${o.record ? '<span class="rec">NOVO RECORDE!</span>' : `<span>Recorde ${o.best}%</span>`}</p>
        <p class="tap">TOQUE PARA TENTAR DE NOVO</p>
      </div>
    </div>`, { menu: a.menu }, '.over-card');
  if (faces) fitFigures(layer.querySelector('.over-card')!, '.over-art');
  live.textContent = `${c.line} ${o.pct}%.`;
  tapAct = a.retry;
  tapArmedAt = performance.now() + 250; // the tap that killed her must not skip the card
}

export interface WinInfo { def: LevelDef; card: Card | undefined; coins: number; total: number; smashed: number; attempts: number; firstClear: boolean; coinRecord: boolean; next: LevelDef | null; last: boolean }

export function victory(w: WinInfo, a: { next(): void; repetir(): void; menu(): void }): void {
  const confetti = getSettings().reduceFx ? '' : `<div class="confetti" aria-hidden="true">${Array.from({ length: 36 }, (_, i) =>
    `<i style="--x:${Math.random() * 100}%;--dx:${(Math.random() - 0.5) * 30}vw;--r:${Math.random() * 900 - 450}deg;--d:${1.2 + Math.random()}s;--w:${Math.random() * 0.4}s;--c:${['#f5c23a', '#22a39a', '#e040c0', '#a8b6a3', '#3a6fd8', '#f26b55'][i % 6]}"></i>`).join('')}</div>`;
  const recs = [w.firstClear && 'PRIMEIRA VITÓRIA!', w.coinRecord && 'RECORDE DE HALTERES!'].filter(Boolean);
  const next = w.last ? '' : w.next ? '<button class="btn big" data-act="next">PRÓXIMA FASE</button>' : '<button class="btn" disabled>PRÓXIMA FASE · EM BREVE</button>';
  // gym: a beat after "1º LUGAR!" the knee goes — the second line and the knee-hugging Rafa appear on the beat.
  const beat = `--beat:${Math.round(60000 / w.def.bpm)}ms`;
  const c = w.card, win = img(c?.winImg ?? 'rafa_pose_armsup.png', `hero small${c?.winPx ? ' px' : ''}`, 'Rafa comemorando');
  const art = c?.win2
    ? `<div class="vit-art" style="${beat}">${win.replace('hero small', 'hero small then-hide')}${img(c.win2Img, 'hero small then-show', 'Rafa abraçando o joelho')}</div>`
    : c?.flank // church: the couple beside her at the altar (each hides itself until its art exists)
      ? `<div class="vit-trio fig">${img(c.flank[0], '', 'Nathalia')}${win.replace('hero small', 'mid')}${img(c.flank[1], '', 'Murilo')}</div>`
      : win;
  show('dim center', `${confetti}
    <div class="panel vitoria">
      ${art}
      <div class="vit-body">
        <h2>${(w.card?.win ?? 'FASE CONCLUÍDA!').replace('º', '<span class="ord">º</span>')}</h2>
        ${w.card?.win2 ? `<p class="win2 then-show" style="${beat}">${w.card.win2}</p>` : ''}
        <p class="sub">${esc(w.def.name)}</p>
        <dl class="stats-big">
          <div><dt>Pontos</dt><dd>${w.coins * 10 + w.smashed * 5}</dd></div>
          <div><dt>Halteres</dt><dd>${w.coins}/${w.total}</dd></div>
          <div><dt>Tentativas</dt><dd>${w.attempts}</dd></div>
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

  $<T extends HTMLElement>(sel: string): T {
    return this.el.querySelector(sel) as T;
  },
  show(on: boolean): void {
    this.el.hidden = !on;
  },
  reset(def: LevelDef, attempt: number): void {
    Object.assign(this, { pct: -1, coins: 0, shield: false, boss: false, dead: false, laughUntil: 0, odFrom: 0, odUntil: 0, preUntil: 0, shockUntil: 0 });
    // Church has no boss: its bossEnter is "the bride is coming" — a beat of shock, then a determined grin.
    this.bossFace = cardOf(def)?.boss === false ? 'grin' : 'angry';
    this.beatMs = 60000 / def.bpm;
    this.faces = facesOf(def);
    this.face = ''; // the face set may have changed: rewrite the image on the next frame
    this.$('.hud-name').textContent = def.name;
    this.$('.att').textContent = `Tentativa ${attempt}`;
    this.$('.hud-coins b').textContent = '0';
    this.$('.ico-whey').hidden = this.$('.t-gelol').hidden = this.$('.t-pre').hidden = true;
    this.el.classList.remove('od');
    this.od = false;
    this.tm = { gelol: { on: false, n: -1, p: '' }, pre: { on: false, n: -1, p: '' } };
    this.el.hidden = false;
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
    else if (e.type === 'death') this.dead = true;
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
