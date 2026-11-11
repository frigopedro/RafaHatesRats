// Small gym rats (the hazard everywhere): scurrying left in a 4-frame cycle, and punted spread-eagled by Gelol.
// Hitbox 0.6 × 0.4 blocks; the sprite is ~0.9 × 0.6.
import { Sprite, OUT } from './raster.mjs';

const F = 'ratFur', PK = 'pink';
// Run cycle: front/back foot positions, body bob, tail wave per frame.
const RUN = [
  { fF: [-8.5, -1], fB: [11, -1], bob: 0, w: 0 },
  { fF: [-4, -1], fB: [6, -1.5], bob: -1, w: 1 },
  { fF: [-1, -1.5], fB: [2.5, -1], bob: 0, w: 0 },
  { fF: [-7, -3], fB: [9, -1], bob: -1, w: -1 },
];

function smallRat({ phase = 0, punted = false } = {}) {
  const s = new Sprite({ w: 80, h: 60, ox: 40, oy: 45 });
  const R = RUN[phase], b = R.bob, z0 = { z: 1, g: 'body', m: F };
  if (punted) {
    // Flying belly-up toward the camera: limbs splayed, tail straight back.
    s.cap([6, -12], [20, -16], [2, 0.8], { m: PK, z: 0, g: 'tail' });
    for (const [a, c] of [[[-3, -14], [-8, -20]], [[4, -14], [9, -20]], [[-3, -6], [-8, -1]], [[4, -6], [10, -2]]])
      s.cap(a, c, [2, 1.4], { m: F, z: 0.5, g: 'limb' }).ell(c, 1.6, 1.4, { m: PK, z: 0.6, g: 'limb' });
    s.ell([1, -10], 7.5, 6, { ...z0, m: F });
    s.ell([1, -9], 4.5, 3.6, { z: 1.1, g: 'body', m: 'grey', lift: 0.2 }); // pale belly
    s.ell([-7, -12], 4.6, 4.2, { z: 2, g: 'head', m: F });
    s.cap([-9, -11], [-14, -10], [2.6, 1.2], { z: 2, g: 'head', m: F, lift: 0.1 });
    s.ell([-4, -16.5], 2.6, 2.6, { z: 1.8, g: 'ear', m: F }).ell([-4, -16.5], 1.4, 1.4, { z: 1.9, g: 'ear', m: PK });
    s.cap([-10, -15], [-5, -15.5], 1.1, { z: 2.4, g: 'band', m: 'red', lift: 0.3 });
    s.resolve();
    s.stroke([[-10, -13], [-8, -11]], OUT).stroke([[-8, -13], [-10, -11]], OUT); // knocked-out eye
    s.set(-14.5, -10.5, PK, 2).set(-12, -8.5, OUT);
    return s.finish();
  }
  const tw = R.w;
  s.chain([[7, -6 + b], [12, -7 + b], [16, -6 + tw], [19, -8 + tw], [21, -10 + tw]], [1.4, 1.2, 1, 0.8, 0.6],
    { m: PK, z: 0, g: 'tail' });
  // Far legs share the body group (no contour, just darker) so the small sprite stays clean.
  s.cap([-3, -4 + b], add(R.fF, [2.5, 0]), [1.7, 1.2], { m: F, z: 0.5, g: 'body', dim: 0.8 });
  s.cap([6, -5 + b], add(R.fB, [-2.5, 0]), [2.4, 1.3], { m: F, z: 0.5, g: 'body', dim: 0.8 });
  s.ell([1.5, -7.5 + b], 8, 6, z0);
  s.ell([6, -7.5 + b], 5.2, 5.4, z0);
  s.cap([-3, -4 + b], R.fF, [1.8, 1.2], { m: F, z: 1.5, g: 'legN' }).ell(add(R.fF, [-0.8, 0]), 1.7, 1.1, { m: PK, z: 1.6, g: 'legN' });
  s.cap([6, -5 + b], R.fB, [2.8, 1.3], { m: F, z: 1.5, g: 'legN' }).ell(add(R.fB, [-1, 0]), 2, 1.1, { m: PK, z: 1.6, g: 'legN' });
  s.ell([-6, -9.5 + b], 5.4, 5, { z: 2, g: 'head', m: F });
  s.cap([-8, -8.6 + b], [-13.5, -7 + b], [3, 1.3], { z: 2, g: 'head', m: F, lift: 0.1 });
  s.ell([-3, -14 + b], 3.3, 3.4, { z: 2.6, g: 'ear', m: F }).ell([-2.8, -13.8 + b], 2, 2.1, { z: 2.7, g: 'ear', m: PK });
  // Tiny sweatband round the head, behind the eye.
  s.cap([-6.6, -14.3 + b], [-4.6, -8.2 + b], 1.15, { z: 2.4, g: 'band', m: 'red', lift: 0.35 });
  s.resolve();
  s.set(-10, -11 + b, OUT).set(-9, -11 + b, OUT).set(-10, -10 + b, OUT).set(-9, -10 + b, OUT).set(-10, -11 + b, 'white', 2); // beady eye
  s.set(-14, -7.5 + b, PK, 2).set(-11.5, -5.5 + b, 'white', 2); // nose, buck tooth
  s.set(-5.3, -12 + b, 'white', 2).set(-5, -11 + b, 'white', 2); // band stripe
  s.lateLine([-12, -8 + b], [-17, -10 + b], 'grey', 3);
  s.lateLine([-12, -7 + b], [-17, -6 + b], 'grey', 3);
  return s.finish();
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

export default [
  ...RUN.map((_, i) => ({ name: `rat_run_${i}`, ...smallRat({ phase: i }) })),
  { name: 'rat_punted', ...smallRat({ punted: true }) },
];
