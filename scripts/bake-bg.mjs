// Bake the code-drawn level backgrounds, ground pieces and logo (art-src/bg/*) → public/art/bg/ + manifest.json and
// public/art/logo.png, then composite mock game screenshots into shots/bg/ (layers + the level's Rafa + hazards)
// so the art can be judged at game scale. Run: npm run bake:bg
import fs from 'node:fs';
import { blit, canvas, crop, load, px, rect, save, scale, ellipse } from '../art-src/bg/lib.mjs';
import gym from '../art-src/bg/gym.mjs';
import church from '../art-src/bg/church.mjs';
import party from '../art-src/bg/party.mjs';
import logo from '../art-src/bg/logo.mjs';

const OUT = 'public/art/bg', SHOTS = 'shots/bg';
const S = 3, VIEW_H = 360, GROUND_Y = 296, BLOCK = 32;
fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const manifest = {
  _doc: [
    'File paths are relative to public/art/ (served at art/...).',
    'All sizes/positions are art px (1 block = 32 art px); draw everything ×scale with nearest filtering.',
    'View: 360 art px tall (1080 logical); groundY = 296 is the ground line (top of ground_top) = world y 0. A layer `y` is measured from the view top, so its world y = (y - groundY) × scale. If the view is ever taller than 360, the extra is above: fill it with skyColor.',
    'Layers are listed back to front. Horizontal: with camLeft = world x of the view left edge in art px (logical / scale), a layer is drawn at screen x = -(camLeft × parallax) mod width, repeated rightwards while tileX; tileX=false layers are drawn once at x = 0 (wide enough for 21:9). Animated layers have `frames` (file = frames[0]).',
    'Overlays sit inside a layer at each `at` point (x, y) = overlay top-left relative to that layer\'s top-left, in every tile repeat, drawn right after their layer with the same offset. `frames` maps state → file; `beat` says how to drive them.',
    'Ground: ground_top (y = groundY) and ground_fill below it (y = groundY + top.height, repeat downward), both tiled by world x (u = worldX mod width). ground.overlays are drawn over ground_top with the same tiling, shown/hidden per their `beat`. No level has holes, so there are no gap pieces.',
    'Sprites: pivot = anchor point in sprite px (rotation centre for cones). Mounted sprites sit at each mount point of their layer (layer coords, every tile repeat): blend "normal" ones are drawn right after that layer, blend "add" (additive cones) after all layers and the ground, before hazards and characters. `frames` = animation frames (file = frames[0]). `once` sprites are not mounted: they are placed once in the world (see their note).',
  ],
  scale: S, view: { height: VIEW_H, groundY: GROUND_Y, block: BLOCK, maxWidth: 840 },
  logo: { file: 'logo.png', scale: 4, note: 'DOM image, already enlarged; draw at 1:1 CSS (or smaller) with image-rendering: pixelated.' },
  themes: {},
};

function write(c, rel) {
  fs.mkdirSync(`${OUT}/${rel.split('/').slice(0, -1).join('/')}`, { recursive: true });
  save(c, `${OUT}/${rel}`);
  return `bg/${rel}`;
}

const themes = [gym(), church(), party()];
for (const t of themes) {
  const f = (name, c) => ({ file: write(c, `${t.name}/${name}.png`), width: c.w, height: c.h });
  const anim = (name, frames) => ({ ...f(`${name}_0`, frames[0]), frames: frames.map((c, i) => write(c, `${t.name}/${name}_${i}.png`)) });
  const m = { title: t.title, skyColor: t.skyColor, layers: [], ground: {}, overlays: [], sprites: [] };
  for (const L of t.layers) {
    const frames = L.frames ?? [L.canvas];
    const files = frames.map((c, i) => write(c, `${t.name}/${L.name}${L.frames ? `_${i}` : ''}.png`));
    m.layers.push({ name: L.name, file: files[0], ...(L.frames && { frames: files, beat: L.beat }), width: frames[0].w,
      height: frames[0].h, y: L.y, parallax: L.parallax, tileX: L.tileX, ...(L.note && { note: L.note }) });
  }
  m.ground = { top: f('ground_top', t.ground.top), fill: f('ground_fill', t.ground.fill),
    ...(t.ground.overlays && { overlays: t.ground.overlays.map((o) => ({ name: o.name, ...f(o.name, o.canvas), beat: o.beat })) }),
    note: 'Tile seams sit every 32 px (one per block); keep u = worldX mod width so they stay on the block grid.' };
  for (const o of t.overlays) {
    const frames = Object.fromEntries(Object.entries(o.frames).map(([k, c]) => [k, write(c, `${t.name}/${o.name}_${k}.png`)]));
    const c0 = Object.values(o.frames)[0];
    m.overlays.push({ name: o.name, layer: o.layer, at: o.at, width: c0.w, height: c0.h, frames, beat: o.beat, ...(o.note && { note: o.note }) });
  }
  for (const s of t.sprites ?? []) {
    m.sprites.push({ name: s.name, ...(s.frames ? anim(s.name, s.frames) : f(s.name, s.canvas)), pivot: s.pivot, blend: s.blend,
      ...(s.mount && { mount: s.mount }), ...(s.once && { once: true }), ...(s.spots && { spots: s.spots }), ...(s.beat && { beat: s.beat }), ...(s.note && { note: s.note }) });
  }
  manifest.themes[t.name] = m;
}

// Self-check: tiles keep the 4-px Bayer period (seamless dither) and overlays/mounts land inside their layer.
for (const [name, m] of Object.entries(manifest.themes)) {
  const layer = (n) => m.layers.find((l) => l.name === n);
  for (const l of m.layers) if (l.tileX && l.width % 4) throw new Error(`${name}/${l.name}: width not a multiple of 4`);
  for (const o of [...m.overlays, ...m.sprites.filter((s) => s.mount).map((s) => ({ ...s, layer: s.mount.layer, at: s.mount.points, width: 0, height: 0 }))])
    for (const [x, y] of o.at) if (x < 0 || y < 0 || x + o.width > layer(o.layer).width || y + o.height > layer(o.layer).height + 80)
      throw new Error(`${name}/${o.name}: anchor (${x}, ${y}) outside layer ${o.layer}`);
}

const L = logo();
save(L.big, 'public/art/logo.png');
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1).replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, a) => `[${a.replace(/\s+/g, ' ')}]`) + '\n');

// ---------- mock screenshots ----------
const atlas = (name) => ({ img: load(`public/art/${name}.png`), json: JSON.parse(fs.readFileSync(`public/art/${name}.json`, 'utf8')) });
const frame = (a, name) => { const f = a.json.frames[name].frame; return crop(a.img, f.x, f.y, f.w, f.h); };
const rafaAtlas = atlas('rafa'), props = atlas('props'), bosses = fs.existsSync('public/art/bosses.json') ? atlas('bosses') : null;
const push0 = { c: frame(rafaAtlas, 'push_0'), ax: rafaAtlas.json.frames.push_0.anchor.x * rafaAtlas.json.frames.push_0.frame.w, ay: rafaAtlas.json.frames.push_0.anchor.y * rafaAtlas.json.frames.push_0.frame.h };
const GYM_PROPS = ['kettlebell', 'treadmill', 'dumbbell', 'bench', 'plateRack'];
const mod = (a, n) => ((a % n) + n) % n;

/** Layer instance x positions (art px, screen space) covering [0, w). */
function instances(L, camLeft, w) {
  if (!L.tileX) return [0];
  const lw = (L.canvas ?? L.frames[0]).w, out = [];
  for (let x = -mod(Math.round(camLeft * L.parallax), lw); x < w; x += lw) out.push(x);
  return out;
}

function mock(t, w, camLeft, phase, altarAt = null) {
  const c = canvas(w, VIEW_H);
  rect(c, 0, 0, w, VIEW_H, t.skyColor);
  const inst = {};
  for (const L of t.layers) {
    const img = L.frames ? L.frames[phase % L.frames.length] : L.canvas;
    inst[L.name] = instances(L, camLeft, w);
    for (const x of inst[L.name]) {
      blit(c, img, x, L.y);
      for (const o of t.overlays) if (o.layer === L.name) {
        const key = o.mock ? o.mock(phase) : Object.keys(o.frames)[phase % Object.keys(o.frames).length];
        if (key) for (const [ox, oy] of o.at) blit(c, o.frames[key], x + ox, L.y + oy);
      }
      for (const s of t.sprites ?? []) if (s.blend === 'normal' && s.mount?.layer === L.name)
        for (const [mx, my] of s.mount.points) blit(c, s.frames[phase % s.frames.length], x + mx - s.pivot.x, L.y + my - s.pivot.y);
    }
  }
  const { top, fill } = t.ground;
  const tiles = [top, ...(t.ground.overlays ?? []).filter((o) => o.mock(phase)).map((o) => o.canvas)];
  for (let sx = 0; sx < w; sx++) {
    const wx = camLeft + sx;
    for (const g of tiles) for (let y = 0; y < g.h; y++) { const k = (y * g.w + mod(wx, g.w)) * 4; if (g.d[k + 3]) px(c, sx, GROUND_Y + y, [g.d[k], g.d[k + 1], g.d[k + 2], g.d[k + 3]]); }
    for (let y = GROUND_Y + top.h; y < VIEW_H; y++) { const k = (mod(y - GROUND_Y - top.h, fill.h) * fill.w + mod(wx, fill.w)) * 4; px(c, sx, y, [fill.d[k], fill.d[k + 1], fill.d[k + 2], 255]); }
  }
  const altar = t.sprites?.find((s) => s.once);
  if (altarAt !== null) blit(c, altar.canvas, altarAt - altar.pivot.x, GROUND_Y - altar.pivot.y);
  const big = scale(c, S);
  for (const s of t.sprites ?? []) if (s.blend === 'add') {
    const L = t.layers.find((l) => l.name === s.mount.layer);
    s.mount.points.forEach(([mx, my], i) => {
      for (const x of inst[L.name]) addRotated(big, s.canvas, (x + mx) * S, (L.y + my) * S, s.pivot, (i % 2 ? 1 : -1) * (0.25 + 0.2 * phase) * (s.name.includes('cyan') ? -1 : 1));
    });
  }
  const gy = GROUND_Y * S, B = BLOCK * S, rx = Math.round(0.28 * w * S), ol = '#140b09';
  const box = (dx, wb, hb, yb, col) => { const x = Math.round(rx + dx * B), y = gy - (yb + hb) * B; rect(big, x - 4, y - 4, wb * B + 8, hb * B + 8, ol); rect(big, x, y, wb * B, hb * B, col); rect(big, x, y, wb * B, 6, '#ffffff', 0.35); };
  if (altarAt !== null) {
    // the couple's spots, outlined where the couple artist's sprites will stand
    for (const k of ['bride', 'groom']) { const x = (altarAt + altar.spots[k].x) * S; for (let y = gy - 2.4 * B; y < gy; y += 12) { rect(big, x - 34, y, 4, 6, '#ffffff'); rect(big, x + 30, y, 4, 6, '#ffffff'); } }
    blit(big, push0.c, Math.round((altarAt + altar.spots.rafa.x) * S - push0.ax), Math.round(gy - push0.ay));
    return big;
  }
  blit(big, push0.c, Math.round(rx - push0.ax), Math.round(gy - push0.ay));
  if (t.name === 'gym') {
    // real hazard sprites (props atlas, ×3, pivot bottom-centre) at block offsets from Rafa
    [1.8, 4.4, 6.0, 8.2, 9.8].forEach((dx, i) => {
      const f = props.json.frames[GYM_PROPS[i]].frame;
      blit(big, scale(frame(props, GYM_PROPS[i]), S), Math.round(rx + dx * B - (f.w * S) / 2), gy - f.h * S);
    });
    rect(big, Math.round(rx + 7 * B) - 4, gy - 0.4 * B - 4, 0.6 * B + 8, 0.4 * B + 4, ol); rect(big, Math.round(rx + 7 * B), gy - 0.4 * B, 0.6 * B, 0.4 * B, '#857c82');
  } else {
    // stand-ins in the grey-box colours: small 0.6, big 1.2, and a high one with its bottom at 1.8 blocks
    box(1.8, 0.6, 0.6, 0, '#f2a03a'); box(3.4, 1.2, 1.2, 0, '#d8433f'); box(5.4, 0.7, 0.4, 1.8, '#a25ce8');
  }
  if (t.name === 'party' && bosses?.json.frames.train_body) {
    // the party train ~9 blocks ahead with the Aranha in pose 1 on its roof (90 art px up, stage x −94…+24)
    const tb = bosses.json.frames.train_body, ap = bosses.json.frames.aranha_pose1, tx = rx + 9 * B;
    blit(big, scale(frame(bosses, 'train_body'), S), Math.round(tx - tb.anchor.x * tb.frame.w * S), Math.round(gy - tb.anchor.y * tb.frame.h * S));
    blit(big, scale(frame(bosses, 'aranha_pose1'), S), Math.round(tx - 35 * S - ap.anchor.x * ap.frame.w * S), Math.round(gy - 90 * S - ap.anchor.y * ap.frame.h * S));
  }
  // a golden-dumbbell stand-in at hop-apex height
  ellipse(big, Math.round(rx + 1.2 * B), gy - 2.2 * B, 24, 24, ol); ellipse(big, Math.round(rx + 1.2 * B), gy - 2.2 * B, 20, 20, '#f5c23a');
  return big;
}

function addRotated(dst, src, ox, oy, pivot, ang) {
  const cs = Math.cos(ang), sn = Math.sin(ang), R = Math.hypot(src.w, src.h) * S;
  for (let y = Math.max(0, Math.floor(oy - R)); y < Math.min(dst.h, oy + R); y++) for (let x = Math.max(0, Math.floor(ox - R)); x < Math.min(dst.w, ox + R); x++) {
    const dx = x - ox, dy = y - oy;
    const u = Math.floor((cs * dx + sn * dy) / S + pivot.x), v = Math.floor((-sn * dx + cs * dy) / S + pivot.y);
    if (u < 0 || v < 0 || u >= src.w || v >= src.h) continue;
    const k = (v * src.w + u) * 4, a = src.d[k + 3] / 255;
    if (!a) continue;
    const d = (y * dst.w + x) * 4;
    for (let ch = 0; ch < 3; ch++) dst.d[d + ch] = Math.min(255, dst.d[d + ch] + src.d[k + ch] * a);
  }
}

/** Box-filter downscale to `w` px wide (phone-size check). */
function shrink(src, w) {
  const f = src.w / w, h = Math.round(src.h / f), c = canvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const acc = [0, 0, 0]; let n = 0;
    for (let j = Math.floor(y * f); j < Math.floor((y + 1) * f); j++) for (let i = Math.floor(x * f); i < Math.floor((x + 1) * f); i++) {
      const k = (j * src.w + i) * 4; acc[0] += src.d[k]; acc[1] += src.d[k + 1]; acc[2] += src.d[k + 2]; n++;
    }
    px(c, x, y, [acc[0] / n, acc[1] / n, acc[2] / n, 255]);
  }
  return c;
}

let n = 0;
for (const t of themes) {
  for (const [aspect, w] of [['21x9', 840], ['4x3', 480]]) {
    for (const [tag, camLeft, phase] of [['a', 1000, 0], ['b', 2717, 1]]) {
      const shot = mock(t, w, camLeft, phase);
      const name = `${SHOTS}/${String(++n).padStart(2, '0')}-${t.name}-${aspect}-${tag}`;
      save(shot, `${name}.png`);
      if (aspect === '21x9' && tag === 'a') save(shrink(shot, 844), `${name}-phone.png`);
    }
  }
  if (t.sprites?.some((s) => s.once)) for (const [aspect, w] of [['21x9', 840], ['4x3', 480]]) {
    const at = Math.round(0.28 * w) - t.sprites.find((s) => s.once).spots.rafa.x; // Rafa standing on her spot
    const shot = mock(t, w, 5000, 0, at);
    save(shot, `${SHOTS}/${String(++n).padStart(2, '0')}-${t.name}-${aspect}-altar.png`);
    if (aspect === '21x9') save(shrink(shot, 844), `${SHOTS}/${String(n).padStart(2, '0')}-${t.name}-${aspect}-altar-phone.png`);
  }
}
for (const [bg, tag] of [['#140b09', 'dark'], ['#1d4b52', 'teal']]) {
  const c = canvas(L.big.w + 80, L.big.h + 80);
  rect(c, 0, 0, c.w, c.h, bg);
  blit(c, L.big, 40, 40);
  save(c, `${SHOTS}/logo-${tag}.png`);
  save(shrink(c, Math.round(c.w * 300 * 3 / L.big.w / 3)), `${SHOTS}/logo-${tag}-phone.png`);
}
console.log(`baked ${themes.length} themes + logo → ${OUT}, mocks → ${SHOTS}`);
