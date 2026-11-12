// Offline audio check: headless Chromium renders every section of every song (16 bars, real voices and patterns,
// through the real master chain), each Gelol section also in overdrive, and every SFX. Checks: no NaN, not silent,
// no clipping, sane loudness, energy in bass/mid/high, and kick onsets on the beat grid (kick soloed, compared with
// the pattern data). Writes WAV previews to shots/audio/ (git-ignored). Exit code 1 on any failure.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const OUT = 'shots/audio';
const RATE = 44100;
const RMS_DB = [-30, -9]; // per section, dBFS
// Min share of 40 Hz–10 kHz energy per band: "not all sub, not all fizz". Hats are clearly heard at well under 1% of
// the energy, so the high floor only catches a missing top end.
const BANDS = [['low', 40, 250, 0.08], ['mid', 250, 2000, 0.1], ['high', 2000, 10000, 0.005]];
const MAX_ONSET_MS = 3;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// no HMR/watch: other lanes edit files the page imports, and a reload would kill the renders mid-run
const server = await createServer({ server: { port: 5184, strictPort: true, hmr: false, watch: null }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch();
const fails = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => fails.push(`page: ${e}`));
  await page.goto('http://localhost:5184/audio.html');
  await page.waitForFunction(() => window.audioDev);
  const { songs, sfx } = await page.evaluate(() => ({ songs: window.audioDev.songs, sfx: window.audioDev.sfx }));

  const save = (name, r) => {
    fs.writeFileSync(`${OUT}/${name}.wav`, Buffer.from(r.wav, 'base64'));
    return decode(r.wav);
  };
  const db = (x) => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
  const rms = (x, from = 0, to = x.length) => {
    let s = 0;
    for (let i = from; i < to; i++) s += x[i] * x[i];
    return Math.sqrt(s / Math.max(1, to - from));
  };

  console.log('name                       peak dB  rms dB  low% mid% high%  kicks  err mean/max ms');
  for (const [id, song] of Object.entries(songs)) {
    for (const part of Object.keys(song.parts)) {
      for (const od of part === 'gelol' || part === 'finale' ? [false, true] : [false]) {
        const name = `${id}-${part}${od ? '-od' : ''}`;
        const r = await page.evaluate(([s, p, o]) => window.audioDev.renderPart(s, p, { od: o }), [id, part, od]);
        const x = save(name, r);
        const end = Math.round((r.leadIn + 64 * r.spb) * RATE);
        const level = rms(x, 0, end);
        const bands = bandShares(x.subarray(0, end));
        const k = await page.evaluate(([s, p, o]) => window.audioDev.renderPart(s, p, { od: o, only: 'kick' }), [id, part, od]);
        const on = onsets(decode(k.wav), expectedKicks(song.parts[part], r));
        const why = [];
        if (r.nan) why.push('NaN');
        if (r.peak >= 1) why.push(`clips (peak ${r.peak.toFixed(3)})`);
        if (+db(level) < RMS_DB[0] || +db(level) > RMS_DB[1]) why.push(`rms ${db(level)} dB outside ${RMS_DB}`);
        BANDS.forEach(([b, , , min], i) => bands[i] < min && why.push(`${b} band ${(bands[i] * 100).toFixed(1)}% < ${min * 100}%`));
        if (on.missing || on.extra) why.push(`kicks: ${on.missing} missing, ${on.extra} extra`);
        if (on.max > MAX_ONSET_MS) why.push(`kick onset off by ${on.max.toFixed(2)} ms`);
        if (why.length) fails.push(`${name}: ${why.join(', ')}`);
        console.log(
          `${name.padEnd(26)} ${db(r.peak).padStart(6)} ${db(level).padStart(7)}  ${bands.map((b) => (b * 100).toFixed(0).padStart(4)).join(' ')}  ` +
          `${String(on.n).padStart(5)}  ${on.mean.toFixed(2)}/${on.max.toFixed(2)}${why.length ? '  ✗ ' + why.join(', ') : ''}`,
        );
      }
    }
  }
  // Gelol ending: overdrive until beat 8 of a 4-bar render; the countdown alone must hit beats 5, 6, 7 (3, 2, 1).
  for (const id of Object.keys(songs)) {
    const name = `${id}-gelol-od-end`;
    const opts = { bars: 4, od: true, odUntil: 8 };
    save(name, await page.evaluate(([s, o]) => window.audioDev.renderPart(s, 'gelol', o), [id, opts]));
    const r = await page.evaluate(([s, o]) => window.audioDev.renderPart(s, 'gelol', { ...o, only: 'countdown' }), [id, opts]);
    const on = onsets(decode(r.wav), [5, 6, 7].map((b) => r.leadIn + b * r.spb));
    const why = [];
    if (r.peak >= 1 || r.nan) why.push('clips/NaN');
    if (on.missing || on.extra) why.push(`ticks: ${on.missing} missing, ${on.extra} extra`);
    if (on.max > MAX_ONSET_MS) why.push(`tick off by ${on.max.toFixed(2)} ms`);
    if (why.length) fails.push(`${name}: ${why.join(', ')}`);
    console.log(`${name.padEnd(26)} countdown ticks ${on.n - on.missing}/3, extra ${on.extra}, err ${on.mean.toFixed(2)}/${on.max.toFixed(2)} ms${why.length ? '  ✗ ' + why.join(', ') : ''}`);
  }
  for (const name of sfx) {
    const r = await page.evaluate((n) => window.audioDev.renderSfx(n), name);
    const x = save(`sfx-${name}`, r);
    const level = rms(x);
    const why = [];
    if (r.nan) why.push('NaN');
    if (r.peak >= 1) why.push('clips');
    if (r.peak < 0.02) why.push('silent');
    if (why.length) fails.push(`sfx ${name}: ${why.join(', ')}`);
    console.log(`sfx-${name.padEnd(22)} ${db(r.peak).padStart(6)} ${db(level).padStart(7)}${why.length ? '  ✗ ' + why.join(', ') : ''}`);
  }
  await realGame();
} finally {
  await browser.close();
  await server.close();
}
console.log(`\nWAVs in ${OUT}/`);
if (fails.length) {
  console.error(`\n${fails.length} problem(s):\n  ${fails.join('\n  ')}`);
  process.exitCode = 1;
} else console.log('audio check OK');

/** The real game: click JOGAR (a real click, like the first tap on a phone) and watch what WebAudio is asked to do
 *  for 2.5 s. No audio console errors; within 1.5 s the level-1 downbeat kick (180 Hz sine), the count-in blips on
 *  beats 0, 1, 2 (E5 squares half a second apart) and the pad chord must have been started. */
async function realGame() {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && /audio|RangeError|AudioParam|AudioContext/i.test(m.text()) && errs.push(m.text()));
  page.on('pageerror', (e) => /audio|RangeError|AudioParam/i.test(String(e)) && errs.push(String(e)));
  await page.addInitScript(() => {
    const log = (window.__alog = []);
    for (const C of [OscillatorNode, AudioBufferSourceNode]) {
      const start = C.prototype.start;
      C.prototype.start = function (when = 0, ...r) {
        log.push({ osc: C === OscillatorNode, type: this.type, f: this.__f, when, ms: performance.now() - (window.__click ?? 0) });
        return start.call(this, when, ...r);
      };
    }
    const get = Object.getOwnPropertyDescriptor(OscillatorNode.prototype, 'frequency').get;
    Object.defineProperty(OscillatorNode.prototype, 'frequency', {
      get() {
        const p = get.call(this), o = this;
        if (!p.__w) {
          const set = p.setValueAtTime.bind(p);
          p.__w = true;
          p.setValueAtTime = (v, t) => ((o.__f ??= v), set(v, t));
        }
        return p;
      },
    });
  });
  await page.goto('http://localhost:5184/');
  await page.waitForSelector('[data-act="jogar"]', { timeout: 30000 });
  await page.evaluate(() => addEventListener('click', () => (window.__click ??= performance.now()), { capture: true }));
  await page.click('[data-act="jogar"]');
  await page.waitForTimeout(2500);
  const log = (await page.evaluate(() => window.__alog)).filter((l) => l.ms >= 0 && l.ms < 1500);
  const kick = log.find((l) => l.osc && l.type === 'sine' && Math.round(l.f) === 180);
  // beat 0 starts with the kick (a little late: nothing reaches the speaker before the output latency, so it plays at
  // once); beats 1 and 2 are on the clock, half a second apart
  const e5 = kick ? log.filter((l) => l.type === 'square' && Math.round(l.f) === 659) : [];
  const later = e5.filter((l) => l.when > kick.when + 0.3);
  const blips = [
    ...e5.filter((l) => Math.abs(l.when - kick.when) < 0.005).slice(0, 1),
    ...later.filter((l, i) => i < 2 && (i === 0 || Math.abs(l.when - later[0].when - 0.5) < 0.005)),
  ];
  const pad = kick ? log.filter((l) => l.type === 'sawtooth' && Math.abs(l.when - kick.when) < 0.005) : [];
  const why = [];
  if (errs.length) why.push(`${errs.length} audio console error(s): ${errs[0]}`);
  if (!kick) why.push('no downbeat kick within 1.5 s');
  if (blips.length < 3) why.push(`${blips.length}/3 count-in blips`);
  if (pad.length < 2) why.push('no pad chord on the downbeat');
  if (why.length) fails.push(`real game: ${why.join(', ')}`);
  const late = kick && later.length ? (later[0].when - 0.5 - kick.when) * -1000 : NaN;
  console.log(`real game (JOGAR)          ${log.length} sources started in 1.5 s; downbeat kick ${kick ? `sent +${kick.ms.toFixed(0)} ms after the click, ${late.toFixed(0)} ms behind the grid` : 'MISSING'}, ` +
    `count-in ${blips.length}/3, pad ${pad.length} oscillators, audio errors ${errs.length}${why.length ? '  ✗ ' + why.join(', ') : ''}`);
  await page.close();
}

function decode(b64) {
  const bytes = Buffer.from(b64, 'base64');
  const pcm = new Int16Array(bytes.buffer.slice(bytes.byteOffset + 44, bytes.byteOffset + bytes.length));
  return Float32Array.from(pcm, (v) => v / 32767);
}

/** Kick steps of a part over 16 bars (last bar from `end`), as seconds into the render. */
function expectedKicks(part, r) {
  const clean = (s) => (s ?? '').replace(/[\s|]/g, '');
  const kick = clean(part.kick), last = clean(part.end?.kick);
  const out = [];
  for (let s = 0; s < 64 * 4; s++) {
    const lb = s - 60 * 4;
    const c = lb >= 0 && last ? last[lb % last.length] : kick ? kick[s % kick.length] : '.';
    if (c && c !== '.') out.push(r.leadIn + (s / 4) * r.spb);
  }
  return out;
}

/** Onsets: 1 ms max-abs envelope jumping well above the recent level; refined to the first sample over 20% of the
 *  local peak. Matched to the expected times within 20 ms. */
function onsets(x, expected) {
  const W = 44, env = [];
  for (let i = 0; i + W <= x.length; i += W) {
    let m = 0;
    for (let j = i; j < i + W; j++) m = Math.max(m, Math.abs(x[j]));
    env.push(m);
  }
  const found = [];
  for (let i = 12; i < env.length; i++) {
    let base = 0;
    for (let j = i - 12; j < i - 2; j++) base = Math.max(base, env[j]);
    if (env[i] > 0.03 && env[i] > 3 * base && (!found.length || i * W - found.at(-1) > 0.05 * RATE)) {
      let peak = 0;
      for (let j = (i - 1) * W; j < (i + 5) * W && j < x.length; j++) peak = Math.max(peak, Math.abs(x[j]));
      let k = (i - 1) * W;
      while (Math.abs(x[k]) < 0.2 * peak) k++;
      found.push(k);
    }
  }
  const times = found.map((k) => k / RATE);
  const errs = [];
  let missing = 0;
  const used = new Set();
  for (const e of expected) {
    let best = -1;
    for (let i = 0; i < times.length; i++) if (!used.has(i) && Math.abs(times[i] - e) < 0.02 && (best < 0 || Math.abs(times[i] - e) < Math.abs(times[best] - e))) best = i;
    if (best < 0) missing++;
    else used.add(best), errs.push(Math.abs(times[best] - e) * 1000);
  }
  return {
    n: expected.length, missing, extra: times.length - used.size,
    mean: errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0, max: errs.length ? Math.max(...errs) : 0,
  };
}

/** Share of spectral energy (40 Hz–10 kHz) in each of BANDS, Hann-windowed 4096-point FFT frames. */
function bandShares(x) {
  const N = 4096, acc = BANDS.map(() => 0);
  let total = 0;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let off = 0; off + N <= x.length; off += N) {
    for (let i = 0; i < N; i++) (re[i] = x[off + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))), (im[i] = 0);
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * RATE) / N, p = re[k] * re[k] + im[k] * im[k];
      if (f < 40 || f > 10000) continue;
      total += p;
      BANDS.forEach(([, lo, hi], i) => f >= lo && f < hi && (acc[i] += p));
    }
  }
  return acc.map((a) => a / (total || 1));
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]], [im[i], im[j]] = [im[j], im[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}
