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

/** Gym Rafa (level 1), drawn 1:1, standing ≈ 200 px. Frames face right; origin x = her glasses (head), y = feet.
 *  Her run is a leg rig (src/game/rafaGym.ts); the table holds her victory cheer. */
export const RAFAGYM_ATLAS = 'rafagym';
export const RAFAGYM = {
  cheer: { frames: ['cheer_0', 'cheer_1'], perBeat: 2, loop: true },
} satisfies Record<string, SheetAnim>;

/** Gym Fabinho (level-1 boss), v2 sheet (fabinho-v2-gym.PNG), scaled ×1.32 when sliced: standing ≈ 236 px, 1.18 × gym
 *  Rafa. Origin x = his face, y = feet; frames face right. `g_` frames are row-2 poses scaled to his in-game height. His run row is a genuine
 *  cycle (also drawn by src/game/fabinhoGym.ts). `defeated` is his idle pose baked turned 90° (lying on the floor);
 *  `land` is his idle pose. */
export const FABINHOGYM_ATLAS = 'fabinhogym';
const one = (frame: string): SheetAnim => ({ frames: [frame], perBeat: 1, loop: false });
export const FABINHOGYM = {
  run: { frames: ['run_0', 'run_1', 'run_2', 'run_3', 'run_4'], perBeat: 5, loop: true }, // one stride cycle per beat
  leap: { frames: ['run_0', 'g_pose_armsup'], perBeat: 2, loop: false }, // push-off, then arms up from the apex
  land: one('g_pose_idle'),
  throw: one('g_pose_wave'), // wind-up (the release pose is land / leap's last frame, bosses.ts)
  taunt_laugh: one('g_pose_laugh'), // laughing, hands on hips
  taunt_phone: one('g_pose_phone'),
  idle: one('g_pose_idle'),
  defeated: one('g_defeated'), // already lying (head to the right; flipX with him facing left)
  sulk: one('g_pose_think'),
} satisfies Record<string, SheetAnim>;

/** The crutch Rafa (level 2), from rafaela-muleta.PNG, drawn 1:1, ≈ 178 px with crutches. Origin x = her face,
 *  y = feet / crutch tips. Her walk frames are near-copies (crutches and front foot never move; only the braced back
 *  leg lifts), so src/game/rafaMuleta.ts builds the gait from them; `dance` is her victory at the altar. */
export const RAFAMULETA_ATLAS = 'rafamuleta';
export const RAFAMULETA = {
  dance: { frames: ['dance_0', 'dance_1', 'dance_2', 'dance_3', 'dance_4'], perBeat: 1, loop: true },
} satisfies Record<string, SheetAnim>;
