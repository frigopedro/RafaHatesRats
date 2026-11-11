import { DROP_FALL_BEATS } from '../config';
import type { HazardEvent, PlatformEvent } from '../types';

/** Hazard placement at a beat: bottom-centre x/y in blocks; `on` = present and solid. */
export interface Pos {
  x: number;
  y: number;
  on: boolean;
}

const frac = (v: number) => v - Math.floor(v);

/** Beat at which a drop/lob hazard touches down (Rafa still arrives at h.beat). */
export function landBeat(h: HazardEvent): number {
  return h.b === 'drop' || h.b === 'lob' ? h.beat - (h.lead ?? 1) : h.beat;
}

/** Horizontal speed toward Rafa, blocks/beat. */
export function hazardSpeed(h: HazardEvent): number {
  return h.b === 'run' || h.b === 'bounce' || h.b === 'fly' ? h.speed : 0;
}

/** Writes the hazard's position at `beat` into `out` (no allocation). */
export function hazardPos(h: HazardEvent, beat: number, bpb: number, out: Pos): Pos {
  const home = h.beat * bpb; // where Rafa meets it
  out.on = true;
  switch (h.b) {
    case 'static':
      out.x = home;
      out.y = h.y ?? 0;
      break;
    case 'drop': {
      const land = landBeat(h);
      const u = (beat - (land - DROP_FALL_BEATS)) / DROP_FALL_BEATS; // 0 → released, 1 → landed
      out.x = home;
      out.y = u >= 1 ? 0 : (h.from ?? 12) * (1 - u * u);
      out.on = u >= 0;
      break;
    }
    case 'run':
      out.x = home + h.speed * (h.beat - beat);
      out.y = 0;
      break;
    case 'bounce':
      out.x = home + h.speed * (h.beat - beat);
      {
        const f = frac((beat - h.beat) / h.period + (h.phase ?? 0));
        out.y = 4 * h.height * f * (1 - f);
      }
      break;
    case 'lob': {
      const land = landBeat(h);
      const flight = h.flight ?? 1;
      const u = (beat - (land - flight)) / flight; // 0 → thrown, 1 → landed
      if (u >= 1) {
        out.x = home;
        out.y = 0;
      } else {
        out.x = home + (h.dx ?? 6) * (1 - u);
        out.y = (1 - u) * ((h.dy ?? 4) + 4 * u); // falls from dy with a one-block hump
      }
      out.on = u >= 0;
      break;
    }
    case 'fly':
      out.x = home + h.speed * (h.beat - beat);
      out.y = h.y;
      break;
    case 'pulse':
      out.x = home;
      out.y = h.y ?? 0;
      out.on = frac((beat - (h.phase ?? 0)) / h.period) * h.period < h.on;
      break;
  }
  return out;
}

/** Platform offset (dx, dy) in blocks at `beat`; static platforms return 0. */
export function platformOffset(p: PlatformEvent, beat: number, axis: 'dx' | 'dy'): number {
  const m = p.move;
  if (!m) return 0;
  return (m[axis] * (1 - Math.cos((2 * Math.PI * (beat - (m.phase ?? 0))) / m.period))) / 2;
}
