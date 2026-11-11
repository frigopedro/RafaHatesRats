// Level 1 gym hazards. Light from the upper left; each part on its own outlined layer.
import { OUT, P, spr, tone, lit, sphere, cylV, cylH, vgrad } from './px.mjs';

const G = P.grey, R = P.red, K = P.rubber, CH = ['#4a4956', '#7a7986', '#b4b3bd', '#e4e3ea', '#ffffff'];

/** Face-on weight plate: bevelled rim, groove, flat face with a sheen, chrome hub. */
export const disc = (ramp, hub = true) => (x, y, o) => {
  const r = Math.hypot(o.nx, o.ny), ang = r ? (-o.nx - o.ny) / r / Math.SQRT2 : 0;
  if (r > 0.8) return tone(ramp, 0.5 + 0.5 * ang, x, y, 0.05);
  if (r > 0.7) return ramp[0];
  if (hub && r < 0.16) return OUT;
  if (hub && r < 0.34) return tone(CH, lit(o.nx / 0.34, o.ny / 0.34), x, y, 0);
  if (hub && r < 0.42) return ramp[0];
  if (ang > 0.55 && r > 0.48 && r < 0.62) return ramp[ramp.length - 1];
  return tone(ramp, 0.42 + 0.2 * ang, x, y, 0.2);
};
const plateDisc = (c, cx, cy, r, ramp, hub) => c.part((l) => l.ell(cx, cy, r, r, disc(ramp, hub)));

// Hex head seen from the side: three facets, lit from above.
const hexHead = (x, y, o) => (o.v < 0.12 ? G[4] : o.v < 0.38 ? G[3] : o.v < 0.72 ? G[2] : o.v < 0.9 ? G[1] : G[0]);

export default [
  spr('dumbbell', 26, 18, 'b', (c) => {
    c.part((l) => l.rect(10, 6, 6, 5, cylH(CH, 0)).line(11, 8, 14, 8, CH[1]).set(12, 9, CH[1]).set(14, 9, CH[1]));
    for (const x of [1, 17]) {
      c.part((l) => l.poly([[x, 4], [x + 2, 1], [x + 6, 1], [x + 8, 4], [x + 8, 14], [x + 6, 17], [x + 2, 17], [x, 14]], hexHead).rect(x + 1, 2, 1, 13, (px, py) => (py < 5 ? G[4] : G[3])));
      c.part((l) => l.rect(x === 1 ? 9 : 16, 4, 1, 9, cylH(CH, 0)));
    }
  }),

  spr('kettlebell', 24, 25, 'b', (c) => {
    c.part((l) => {
      l.ell(12, 9, 8, 7.5, (x, y, o) => tone(R.slice(0, 3), 0.1 + 0.9 * lit(o.nx, o.ny), x, y, 0));
      for (let y = 0; y < 25; y++) for (let x = 0; x < 24; x++) if (((x + 0.5 - 12) / 5) ** 2 + ((y + 0.5 - 10) / 5) ** 2 <= 1) l.clear(x, y);
    });
    c.part((l) => {
      l.ell(12, 16, 11, 8, sphere(R, 0.08));
      for (let x = 0; x < 24; x++) l.clear(x, 23);
      l.rect(4, 22, 16, 1, R[0]);
      l.rect(5, 12, 2, 2, '#ffb9a0').set(7, 11, '#ffb9a0').set(4, 14, R[3]).set(8, 11, R[3]);
    });
  }),

  spr('bottle', 14, 26, 'b', (c) => {
    c.part((l) => l.rect(6, 1, 2, 3, CH[2]).set(6, 1, CH[3]));
    c.part((l) => l.rrect(3, 4, 8, 5, 1, cylV(['#9a99a6', '#d0d0d8', '#f4f4f8'], 0)).rect(3, 7, 8, 1, '#7a7986'));
    c.part((l) => {
      l.rrect(2, 9, 10, 16, 2, cylV(P.glass, 0.1));
      l.rect(2, 15, 10, 5, cylV(['#c9561c', '#f58a2e', '#ffc06a'], 0));
      l.rect(4, 10, 1, 4, '#e8f8ff').rect(4, 21, 1, 2, '#e8f8ff').set(5, 10, '#e8f8ff');
      l.set(7, 16, '#ffffff').set(6, 17, '#ffffff').set(7, 17, '#ffffff').set(8, 17, '#ffffff').set(7, 18, '#ffffff');
    });
  }),

  // Standing on edge (the falling plate tumbles in on edge); `plate_flat` is the lying-down variant.
  spr('plate', 26, 26, 'b', (c) => plateDisc(c, 13, 13, 12, P.blue)),
  spr('plate_flat', 30, 11, 'b', (c) => flatPlate(c, P.blue)),

  spr('treadmill', 62, 40, 'b', (c) => {
    // rail loop + console post (behind the deck)
    c.part((l) => {
      l.path([[50, 12], [29, 12], [26, 15], [26, 27]], CH[3]).path([[50, 13], [29, 13], [27, 15], [27, 27]], CH[2]);
    });
    c.part((l) => l.poly([[49, 9], [53, 9], [56, 27], [52, 27]], cylV(G, 0)));
    c.part((l) => {
      l.rrect(38, 1, 20, 10, 2, vgrad(G, 0, 0.8, 0.1));
      l.rect(41, 3, 13, 4, P.cyan[1]).rect(42, 4, 4, 1, P.cyan[3]).rect(47, 4, 2, 1, P.cyan[2]).rect(50, 4, 3, 1, P.cyan[3]).rect(42, 5, 11, 1, P.cyan[2]);
      l.rect(39, 8, 18, 1, G[1]).set(43, 9, P.red[2]).set(46, 9, P.green[2]).set(49, 9, P.gold[2]);
    });
    // deck
    c.part((l) => {
      l.rrect(2, 27, 52, 8, 2, vgrad(G, 0, 0.95, 0.15));
      l.rect(3, 26, 50, 2, (x, y) => (y === 26 ? K[3] : K[1]));
      for (let x = 5; x < 52; x += 4) l.set(x, 27, K[0]);
      l.rect(5, 31, 46, 1, P.cyan[2]).rect(5, 32, 46, 1, P.cyan[1]);
    });
    c.part((l) => l.rrect(46, 21, 15, 15, 4, (x, y, o) => tone(G, lit(o.nx * 0.6, o.ny), x, y)).rect(48, 30, 11, 1, P.cyan[2]).rect(48, 31, 11, 1, P.cyan[1]));
    c.part((l) => l.rect(5, 35, 6, 4, K[1]).rect(5, 35, 6, 1, K[3]).rect(48, 35, 9, 4, K[1]).rect(48, 35, 9, 1, K[3]));
  }),

  spr('bench', 54, 38, 'b', (c) => {
    // uprights + plate (barbell end-on) behind the pad
    c.part((l) => l.rect(41, 12, 3, 23, cylV(G, 0)).rect(39, 12, 3, 2, G[3]));
    plateDisc(c, 44, 11, 10, R);
    c.part((l) => l.rect(4, 22, 34, 3, vgrad(G, 0, 0.9, 0.2)));
    for (const x of [7, 32]) c.part((l) => l.rect(x, 24, 3, 10, cylV(G, 0)).rect(x - 3, 34, 9, 3, vgrad(K, 0, 1, 0.2)));
    c.part((l) => l.rect(36, 34, 13, 3, vgrad(K, 0, 1, 0.2)));
    c.part((l) => {
      l.rrect(1, 15, 38, 8, 3, vgrad(K.concat(G[2]), 0.1, 1, 0.1));
      l.rect(4, 16, 31, 1, G[2]).rect(3, 17, 2, 1, G[2]);
      for (let x = 6; x < 36; x += 6) l.set(x, 19, K[0]);
    });
  }),

  spr('plateRack', 42, 48, 'b', (c) => {
    c.part((l) => l.rect(19, 3, 4, 42, cylV(G, 0)).rect(18, 2, 6, 3, vgrad(CH, 0)));
    c.part((l) => l.poly([[4, 47], [8, 42], [34, 42], [38, 47]], vgrad(K.concat(G[2]), 0, 1, 0)));
    plateDisc(c, 12, 11, 7, P.green);
    plateDisc(c, 30, 12, 7, P.gold);
    plateDisc(c, 11, 24, 9, P.blue);
    plateDisc(c, 31, 25, 9, P.blue);
    plateDisc(c, 11, 35, 10, R);
    plateDisc(c, 31, 35, 10, R);
  }),

  // Front view squat rack: barbell across with bumper plates edge-on outside the uprights.
  spr('barbellRack', 60, 46, 'b', (c) => {
    for (const x of [12, 44]) {
      c.part((l) => {
        l.rect(x, 3, 4, 39, cylV(G, 0));
        for (let y = 8; y < 38; y += 4) l.set(x + 1, y, G[0]).set(x + 2, y, G[1]);
      });
      c.part((l) => l.rect(x - 6, 41, 16, 4, vgrad(K.concat(G[2]), 0, 1, 0)));
    }
    c.part((l) => l.rect(12, 2, 36, 3, cylH(G, 0)));
    c.part((l) => l.rect(10, 30, 40, 2, cylH(CH, 0)));
    c.part((l) => l.rect(1, 15, 58, 3, cylH(CH, 0)).rect(10, 16, 3, 4, G[2]).rect(47, 16, 3, 4, G[2]));
    for (const [x, ramp, h] of [[2, R, 30], [6, P.blue, 26], [53, P.blue, 26], [57, R, 30]]) {
      c.part((l) => l.rrect(x - 1, 16.5 - h / 2, 4, h, 1, (px, py, o) => tone(ramp, lit(o.nx * 0.8, o.ny * 0.9), px, py, 0)));
    }
    c.part((l) => l.rect(9, 14, 2, 5, cylV(CH, 0)).rect(49, 14, 2, 5, cylV(CH, 0)));
  }),

  spr('plyo', 52, 46, 'b', (c) => {
    const box = (l, x, y, w, h) => {
      l.rect(x, y, w, h, (px, py, o) => tone(P.wood, 0.75 - 0.5 * o.v + ((px * 7 + py * 3) % 11 === 0 ? -0.25 : 0), px, py, 0.06));
      l.rect(x, y, w, 2, P.wood[3]).rect(x, y + h - 2, w, 2, P.wood[0]);
      l.rect(x, y, 2, h, P.wood[2]).rect(x + w - 2, y, 2, h, P.wood[0]);
      const hx = x + w / 2 - 6, hy = y + 4;
      l.rrect(hx, hy, 12, 4, 2, OUT).rect(hx + 2, hy + 3, 8, 1, P.wood[0]);
    };
    c.part((l) => box(l, 1, 23, 50, 22));
    c.part((l) => box(l, 9, 3, 34, 21));
    c.part((l) => l.rect(21, 13, 10, 5, R[2]).rect(21, 13, 10, 1, R[3]).rect(22, 15, 8, 1, '#f9f8f8'));
  }),

  // Pivot = bottom of the bag (hitbox bottom); hang `bag_chain` tiles upward from the ring at the top centre.
  spr('bag', 24, 44, 'b', (c) => {
    c.part((l) => l.path([[5, 10], [12, 3]], G[1]).path([[19, 10], [12, 3]], G[1]).path([[9, 10], [12, 3]], G[2]).path([[15, 10], [12, 3]], G[2]));
    c.part((l) => l.rect(11, 0, 2, 3, CH[2]).set(11, 0, CH[3]));
    c.part((l) => {
      l.rrect(2, 9, 20, 34, 4, cylV(R, 0.1));
      l.rect(2, 9, 20, 4, cylV(K.concat(G[2]), 0)).rect(2, 38, 20, 4, cylV(K.concat(G[2]), 0));
      l.rect(2, 22, 20, 3, cylV(['#b9b6b3', '#dedbd8', '#f9f8f8'], 0));
      for (const y of [16, 30, 34]) for (let x = 4; x < 21; x += 2) l.set(x, y, R[1]);
    });
  }),
  spr('bag_chain', 8, 8, [4, 8], (c) => chain(c, CH[3], CH[2], CH[1])),
];

export function flatPlate(c, ramp, spin = 0) {
  // Seen almost edge-on: top face ellipse over a short side band; `spin` moves the hub sheen.
  c.part((l) => {
    l.ell(15, 6.5, 14, 3.5, (x, y, o) => tone(ramp, 0.25 + 0.35 * (1 - o.v), x, y));
    l.rect(1, 5, 28, 3, ramp[0]);
  });
  c.part((l) => {
    l.ell(15, 4.5, 14, 3.5, (x, y, o) => {
      const r = Math.hypot(o.nx, o.ny);
      if (r < 0.2) return OUT;
      if (r < 0.38) return tone(CH, 0.7 - 0.5 * o.ny, x, y, 0);
      if (r > 0.82) return tone(ramp, 0.75 - 0.4 * o.ny, x, y, 0);
      const a = Math.atan2(o.ny * 4, o.nx) + spin;
      return Math.cos(a) > 0.92 && r > 0.5 ? ramp[ramp.length - 1] : tone(ramp, 0.5 - 0.15 * o.ny, x, y);
    });
  });
}

/** 8×8 tileable chain: one face-on link and one edge-on link per tile. */
export function chain(c, L, M, D) {
  return c.grid([
  '  oLLo  ',
  ' oLMMDo ',
  'oLMooMDo',
  'oMo  oDo',
  'oMo  oDo',
  ' oDMDDo ',
  '  oMDo  ',
  '  oLDo  ',
], { o: OUT, L, M, D });
}
