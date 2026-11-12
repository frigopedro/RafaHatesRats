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

/** Gym Fabinho (level-1 boss), v2 sheet (fabinho-v2-gym.PNG), drawn 1:1, standing ≈ 170 px. Same keys as FABINHO
 *  (plus the taunt names below), so the boss view swaps atlas and table in one line. Origin x = his face, y = feet;
 *  frames face right. `g_` frames are row-2 poses scaled to his in-game height. His run row is a genuine cycle (also
 *  drawn by src/game/fabinhoGym.ts). This sheet has no push-ups, sit-ups or lying poses: the push-up/sit-up/squat
 *  taunt keys point at taunts that exist; `defeated` is his idle pose baked turned 90° (lying on the floor);
 *  `land` is his idle pose — squash it in the view. */
export const FABINHOGYM_ATLAS = 'fabinhogym';
const one = (frame: string): SheetAnim => ({ frames: [frame], perBeat: 1, loop: false });
export const FABINHOGYM = {
  run: { frames: ['run_0', 'run_1', 'run_2', 'run_3', 'run_4'], perBeat: 5, loop: true }, // one stride cycle per beat
  walk: { frames: ['walk_0', 'walk_1', 'walk_2', 'walk_3'], perBeat: 4, loop: true },
  leap: { frames: ['run_0', 'g_pose_armsup'], perBeat: 2, loop: false }, // push-off, then arms up from the apex
  land: one('g_pose_idle'),
  throw: { frames: ['g_pose_wave', 'g_pose_point'], perBeat: 2, loop: false }, // wind-up, release
  taunt_pushup: one('g_pose_laugh'), // laughing, hands on hips
  taunt_situp: one('g_pose_armscrossed'),
  taunt_squat: one('g_pose_phone'),
  taunt_laugh: one('g_pose_laugh'),
  taunt_armscrossed: one('g_pose_armscrossed'),
  taunt_phone: one('g_pose_phone'),
  idle: one('g_pose_idle'),
  defeated: one('g_defeated'), // already lying (head to the right; flipX with him facing left)
  sulk: one('g_pose_think'),
  idleBust: { frames: ['g_pose_armscrossed', 'g_pose_think'], perBeat: 0.5, loop: true },
  throwBust: { frames: ['g_pose_wave', 'g_pose_point'], perBeat: 2, loop: false },
} satisfies Record<keyof typeof FABINHO, SheetAnim> & Record<string, SheetAnim>;

/** The crutch Rafa (level 2), from rafaela-muleta.PNG, drawn 1:1, ≈ 178 px with crutches. Origin x = her face,
 *  y = feet / crutch tips. Her walk frames are near-copies (crutches and front foot never move; only the braced back
 *  leg lifts), so src/game/rafaMuleta.ts builds the gait from them; `dance` is her victory at the altar. */
export const RAFAMULETA_ATLAS = 'rafamuleta';
export const RAFAMULETA = {
  dance: { frames: ['dance_0', 'dance_1', 'dance_2', 'dance_3', 'dance_4'], perBeat: 1, loop: true },
  walk: { frames: ['walk_0', 'walk_1', 'walk_2', 'walk_3'], perBeat: 4, loop: true },
  crutch: { frames: ['crutch_0', 'crutch_1', 'crutch_2', 'crutch_3', 'crutch_4'], perBeat: 5, loop: true },
  idle: one('g_pose_idle'),
  phone: one('g_pose_phone'),
  armsup: one('g_pose_armsup'),
  point: one('g_pose_point'),
} satisfies Record<string, SheetAnim>;

/** Level-2 wedding cast, at the crutch Rafa's scale: `g_walk_*`/`g_run_*` are their sheets' small row used 1:1, and
 *  the `g_pose_*` frames are row-2 poses scaled down to the same standing height. Origin x = face centre, y = feet;
 *  frames face right. Walks are genuine 4-frame cycles (two per beat at the level's 4 blocks per beat); runs are
 *  5-frame hurries. Faces/turnarounds are 1:1. */
const wedding = (atlas: string) => ({
  atlas,
  walk: { frames: ['g_walk_0', 'g_walk_1', 'g_walk_2', 'g_walk_3'], perBeat: 8, loop: true },
  run: { frames: ['g_run_0', 'g_run_1', 'g_run_2', 'g_run_3', 'g_run_4'], perBeat: 10, loop: true },
  idle: { frames: ['g_pose_idle'], perBeat: 1, loop: false },
  phone: { frames: ['g_pose_phone'], perBeat: 1, loop: false },
  armsup: { frames: ['g_pose_armsup'], perBeat: 1, loop: false },
  laugh: { frames: ['g_pose_laugh'], perBeat: 1, loop: false },
  wave: { frames: ['g_pose_wave'], perBeat: 1, loop: false },
  think: { frames: ['g_pose_think'], perBeat: 1, loop: false },
} satisfies { atlas: string } & Record<string, SheetAnim | string>);
export const GIOVANNI = wedding('giovanni');
export const NATHALIA = wedding('nathalia');
export const MURILO = wedding('murilo');
