// Every screen outside the canvas: one persistent HUD, one screen layer whose content is swapped, and the CSS-only
// rotate prompt. A screen is a function that fills the layer; buttons carry data-act and run the matching action.
import { HAZARDS, OVERDRIVE, PRE_TICKS, TICKS_PER_BEAT as TPB } from '../config';
import { LEVELS } from '../levels';
import { getSettings, levelSave, onSettings, resetProgress, setSettings, type Settings } from '../save';
import type { HazardKind, LevelDef, SimEvent } from '../types';
import { deathCard } from './jokes';

type Acts = Record<string, () => void>;

/** The three levels as the player sees them, in story order; a card lights up once its id is in LEVELS.
 *  `boss`: the bossEnter cue brings a boss (angry face); otherwise it is the church's dash to the altar. */
export const CARDS = [
  { id: 'gym', name: 'Campeonato Gym Rats', kit: 'rafakit_standing.png', kitPx: true, sub: 'Chefe: Fabinho', side: 'fabinho_armscrossed.png', sidePx: false, boss: true, win: '1º LUGAR!', win2: '…e um LCA a menos.' },
  { id: 'church', name: 'A Madrinha', kit: 'rafakit_crutches.png', kitPx: true, sub: 'Missão: chegar ao altar', side: 'giovanni.png', sidePx: false, boss: false, win: 'CHEGOU A TEMPO, MADRINHA!', win2: '' },
  { id: 'party', name: 'A Festa', kit: 'rafa_turn_34.png', kitPx: false, sub: 'Chefe: O Aranha da Carreta', side: 'aranha_pose1.png', sidePx: true, boss: true, win: 'FIM! Rafa ainda odeia ratos.', win2: '' },
];
export type Card = (typeof CARDS)[number];
// shortcut: falls back to songId ('gym') while LevelDef.id is still the old number; drop once types.ts has string ids.
export const levelKey = (l: LevelDef): string => (typeof l.id === 'string' ? l.id : l.songId);
export const levelById = (id: string) => LEVELS.find((l) => levelKey(l) === id);
export const cardOf = (d: LevelDef) => CARDS.find((c) => c.id === levelKey(d));
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

export function init(el: HTMLElement, onPause: () => void): void {
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
        <i class="ico ico-pre" title="Pré-treino: pulo duplo" hidden></i>
      </div>
      <span class="att"></span>
      <button class="pause" type="button" aria-label="Pausar"><i></i></button>
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
  for (const f of FACES) new Image().src = `art/ui/rafa_face_${f}.png`; // HUD swaps must not flash

  layer.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-act]');
    if (!b || b.disabled) return;
    // AUDIO HOOK (UI click): sfx('click') — every menu button passes here, inside a real click handler.
    acts[b.dataset.act!]?.();
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
  hud.el.querySelector('.pause')!.addEventListener('click', onPause); // AUDIO HOOK (UI click) here too

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
        <span class="card-art">${img(c.kit, `kit${c.kitPx ? ' px' : ''}`, '', c.kitPx ? 'rafa_turn_34.png' : undefined)}${img(c.side, `boss${c.sidePx ? ' px' : ''}`, '')}</span>
        <span class="card-boss">${c.sub}</span>
        ${stats}${badge}
      </button>`;
  }).join('');
  show('bg fases', `${header('FASES')}<div class="cards">${cards}</div>`, cardActs, '.card:not([disabled])');
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
      setSettings({ [key]: Number(el.value) }); // AUDIO HOOK (volume): audio subscribes with onSettings() in src/save.ts
      el.nextElementSibling!.textContent = el.value;
    }
  });
}

export function pause(a: { continuar(): void; reiniciar(): void; menu(): void }): void {
  show('dim center', `
    <div class="panel pausa">
      ${img('rafa_pose_phone.png', 'hero small', 'Rafa no celular')}
      <div class="stack">
        <h2>PAUSA</h2>
        <button class="btn big" data-act="continuar">CONTINUAR</button>
        <button class="btn teal" data-act="reiniciar">REINICIAR</button>
        <button class="btn sage" data-act="menu">MENU</button>
      </div>
    </div>`, a);
}

export interface OverInfo { cause: string; pct: number; best: number; record: boolean }

export function gameOver(o: OverInfo, a: { retry(): void; menu(): void }): void {
  const c = deathCard(o.cause, HAZARDS[o.cause as HazardKind]?.size === 'big'); // kinds unknown to config are fine
  show('dim center over', `
    <button class="btn small sage corner" data-act="menu">MENU</button>
    <div class="panel over-card" tabindex="-1">
      <div class="over-art">${img(`rafa_face_${c.face}.png`, 'over-face', '')}${c.boss ? img(c.boss, `over-boss${c.px ? ' px' : ''}`, '') : ''}</div>
      <div class="over-text">
        <p class="joke">${c.line}</p>
        <p class="score"><b>${o.pct}%</b> ${o.record ? '<span class="rec">NOVO RECORDE!</span>' : `<span>Recorde ${o.best}%</span>`}</p>
        <p class="tap">TOQUE PARA TENTAR DE NOVO</p>
      </div>
    </div>`, { menu: a.menu }, '.over-card');
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
  // gym: a beat after "1º LUGAR!" the knee goes — second line and the shocked face appear on the beat (--beat).
  const beat = `--beat:${Math.round(60000 / w.def.bpm)}ms`;
  const art = w.card?.win2
    ? `<div class="vit-art" style="${beat}">${img('rafa_pose_armsup.png', 'hero small then-hide', 'Rafa comemorando')}${img('rafa_face_shocked.png', 'then-show vit-shock', 'Rafa em choque')}</div>`
    : img('rafa_pose_armsup.png', 'hero small', 'Rafa comemorando');
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
  live.textContent = `${w.card?.win ?? 'Fase concluída!'} ${w.card?.win2 ?? ''} ${w.coins} de ${w.total} halteres.`;
}

/** The HUD: written only when something it shows changes (onFrame runs every frame). */
export const hud = {
  el: null as unknown as HTMLElement,
  pct: -1, att: -1, face: '' as Face | '', od: false, pre: false, odP: '', preP: '',
  coins: 0, shield: false, boss: false, dead: false, laughUntil: 0, odFrom: 0, odUntil: 0, preUntil: 0,
  bossFace: 'angry' as Face, shockUntil: 0, beatMs: 500,

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
    this.$('.hud-name').textContent = def.name;
    this.$('.att').textContent = `Tentativa ${attempt}`;
    this.$('.hud-coins b').textContent = '0';
    this.$('.ico-whey').hidden = this.$('.ico-pre').hidden = true;
    this.el.classList.remove('od');
    this.od = this.pre = false;
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
  frame(beat: number, progress: number): void {
    const p = Math.floor(progress * 100);
    if (p !== this.pct) {
      this.pct = p;
      this.$('.bar > i').style.transform = `scaleX(${p / 100})`;
      this.$('.pct').textContent = `${p}%`;
    }
    const od = beat >= this.odFrom && beat < this.odUntil;
    if (od !== this.od) this.el.classList.toggle('od', (this.od = od));
    if (od) {
      const v = ((this.odUntil - beat) / (this.odUntil - this.odFrom)).toFixed(2);
      if (v !== this.odP) this.el.style.setProperty('--od', (this.odP = v));
    }
    const pre = beat < this.preUntil;
    if (pre !== this.pre) this.$('.ico-pre').hidden = !(this.pre = pre);
    if (pre) {
      const v = ((this.preUntil - beat) / (PRE_TICKS / TPB)).toFixed(2);
      if (v !== this.preP) this.el.style.setProperty('--pre', (this.preP = v));
    }
    const now = performance.now();
    const face: Face = this.dead || now < this.shockUntil ? 'shocked' : now < this.laughUntil ? 'laugh' : od ? 'grin' : this.boss ? this.bossFace : 'smile';
    if (face !== this.face) this.$<HTMLImageElement>('.face img').src = `art/ui/rafa_face_${(this.face = face)}.png`;
  },
};
