// Animation data for the sheet characters (atlases built by scripts/slice-sheet.mjs). Plain data plus one pure helper,
// so any view can drive an animation from the beat: frame = animFrame(anim, beat − startBeat).
// Every frame's origin (atlas `anchor`) is its ground contact, so frames swap in place on a shared ground line.

export interface SheetAnim {
  frames: string[];
  perBeat: number; // frames advanced per beat
  loop: boolean; // false: holds the last frame
}

/** Frame of `anim` at `beats` (≥ 0) after it started. */
export function animFrame(anim: SheetAnim, beats: number): string {
  const n = anim.frames.length;
  const i = Math.floor(Math.max(0, beats) * anim.perBeat);
  return anim.frames[anim.loop ? i % n : Math.min(i, n - 1)];
}

/** Fabinho, drawn 1:1 (standing ≈ 238 px ≈ 2.5 blocks). All in-game frames face right: flipX when he faces Rafa from
 *  ahead. Origin x is his head (hair centre) for standing/moving frames, the front hand for push-ups, the feet for
 *  sit-ups. Row-4 poses (wave, point, armscrossed, thinking, thumbs, phone, drinking) are bust-only, cut at the thighs:
 *  use them for HUD/cards only (the *Bust animations), never standing on the ground. */
export const FABINHO_ATLAS = 'fabinho';
export const FABINHO = {
  run: { frames: ['run_0', 'run_1', 'run_2', 'run_3', 'run_4'], perBeat: 5, loop: true }, // one stride cycle per beat
  walk: { frames: ['walk_0', 'walk_1', 'walk_2'], perBeat: 3, loop: true },
  leap: { frames: ['leap_0', 'leap_1'], perBeat: 2, loop: false }, // rising, then arms up through the fall
  land: { frames: ['crouch', 'halfsquat'], perBeat: 4, loop: false }, // impact crouch for 1/4 beat, then rises
  throw: { frames: ['halfsquat', 'squat'], perBeat: 2, loop: false }, // wind-up 1/2 beat, release = arms thrust forward
  taunt_pushup: { frames: ['pushup_0', 'pushup_1'], perBeat: 2, loop: true }, // down on the beat, up on the off-beat
  taunt_situp: { frames: ['situp_0', 'situp_1'], perBeat: 2, loop: true },
  idle: { frames: ['turn_side', 'turn_34'], perBeat: 1, loop: true }, // glances between Rafa and the camera
  defeated: { frames: ['defeated'], perBeat: 1, loop: false }, // face-down on the floor
  sulk: { frames: ['sulk'], perBeat: 1, loop: false }, // sitting, head in hand
  idleBust: { frames: ['armscrossed', 'thinking'], perBeat: 0.5, loop: true },
  throwBust: { frames: ['wave', 'point'], perBeat: 2, loop: false },
} satisfies Record<string, SheetAnim>;

/** Portrait faces for the boss HUD (row 5): laugh ×4 + smile, shocked ×2, angry ×2. */
export const FABINHO_FACES = {
  laugh: ['face_laugh', 'face_laugh2', 'face_laugh3', 'face_laugh4', 'face_smile'],
  shocked: ['face_shocked', 'face_shocked2'],
  angry: ['face_angry', 'face_angry2'],
};

/** Gym Rafa (level 1), drawn 1:1, standing ≈ 200 px. Frames face right; origin x = her glasses (head), y = feet.
 *  The 5 run frames are one step each loop (rear foot planted, both legs look alike), so 2 loops per beat = one full
 *  left-right stride cycle per beat. The other poses are extras (warm-up before the start, cards). */
export const RAFAGYM_ATLAS = 'rafagym';
export const RAFAGYM = {
  run: { frames: ['run_0', 'run_1', 'run_2', 'run_3', 'run_4'], perBeat: 10, loop: true },
  walk: { frames: ['walk_0', 'walk_1', 'walk_2', 'walk_3', 'walk_4'], perBeat: 5, loop: true },
  cheer: { frames: ['cheer_0', 'cheer_1'], perBeat: 2, loop: true },
  squat: { frames: ['squat_2', 'squat_1', 'squat_0', 'squat_1'], perBeat: 4, loop: true }, // one rep per beat
  pushup: { frames: ['pushup_0', 'pushup_1'], perBeat: 2, loop: true }, // mirrors Fabinho's taunt_pushup
  stretch: { frames: ['stretch_0', 'stretch_1'], perBeat: 0.5, loop: true },
  lunge: { frames: ['lunge'], perBeat: 1, loop: false },
  phone: { frames: ['phone_0', 'phone_1'], perBeat: 0.5, loop: true },
  asleep: { frames: ['asleep'], perBeat: 1, loop: false },
} satisfies Record<string, SheetAnim>;
