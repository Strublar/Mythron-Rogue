import Phaser from 'phaser';
import type { ArtifactDef } from '../types';
import { ARTIFACT_POOL } from '../data/artifacts';

/** Idle loop of an artifact icon: frames `{iconKey}_000` … `_011`. */
const IDLE_FRAMES = 12;
const IDLE_FPS = 12;

/** Atlas + texture key of an artifact icon — one key for both, like the unit atlases. */
export function artifactAtlasPath(iconKey: string): { png: string; json: string } {
  return { png: `resources/icons/${iconKey}.png`, json: `resources/icons/${iconKey}_atlas.json` };
}

/** Every icon the shop can draw — what `BootScene` preloads. */
export function artifactIconKeys(): string[] {
  return ARTIFACT_POOL.map(a => a.iconKey);
}

const animKey = (iconKey: string): string => `${iconKey}_idle`;

/** One looping idle anim per icon, registered once per scene. */
function registerIdle(scene: Phaser.Scene, iconKey: string): void {
  const key = animKey(iconKey);
  if (scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: Array.from({ length: IDLE_FRAMES }, (_, i) => ({
      key: iconKey,
      frame: `${iconKey}_${String(i).padStart(3, '0')}`,
    })),
    frameRate: IDLE_FPS,
    repeat: -1,
  });
}

/**
 * The artifact's animated icon, `size` px across. Icons are uniform 48px canvases, so a
 * flat scale is all it takes — no per-icon normalisation.
 */
export function createArtifactIcon(
  scene: Phaser.Scene, artifact: ArtifactDef, x: number, y: number, size: number,
): Phaser.GameObjects.Sprite {
  const { iconKey } = artifact;
  const sprite = scene.add.sprite(x, y, iconKey, `${iconKey}_000`);
  sprite.setDisplaySize(size, size);
  registerIdle(scene, iconKey);
  sprite.play(animKey(iconKey));
  return sprite;
}
