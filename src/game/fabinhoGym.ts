// Gym Fabinho's run (level-1 boss). His v2 sheet's run row is a genuine 5-frame cycle (push-off, flight, knee drive),
// so this is just that cycle phase-locked to the beat; the exports stay as they were when it was a leg rig, so the
// boss actor uses it only while his move is a run and keeps atlas frames for everything else.
import type Phaser from 'phaser';
import { animFrame, FABINHOGYM, FABINHOGYM_ATLAS } from '../art/sheets';

export interface FabinhoGymRun {
  root: Phaser.GameObjects.Container; // origin = his face x / feet y, like the atlas frames' pivots
  parts: Phaser.GameObjects.Image[];
}

/** The `fabinhogym` atlas must already be loaded. */
export function createFabinhoGymRun(scene: Phaser.Scene): FabinhoGymRun {
  const parts = [scene.add.image(0, 0, FABINHOGYM_ATLAS, FABINHOGYM.run.frames[0])];
  return { root: scene.add.container(0, 0, parts), parts };
}

/** Poses the run at `phase` (cycles: one per beat at Rafa's pace, so pass beat × rate) with his feet at (x, y).
 *  `flip` mirrors him to face left (toward Rafa when he is ahead of her), about his face, like setFlipX on his frames. */
export function drawFabinhoGymRun(r: FabinhoGymRun, phase: number, x: number, y: number, flip = false): void {
  // Half a cycle off hers, so beside her they are not in lockstep.
  r.parts[0].setFrame(animFrame(FABINHOGYM.run, phase + 0.5)); // the table runs one cycle per beat
  r.root.setPosition(x, y).setScale(flip ? -1 : 1, 1);
}
