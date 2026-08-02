import Phaser from 'phaser';

export type UnitAnimKey = 'idle' | 'run' | 'attack' | 'hit' | 'death' | 'breathing' | 'cast' | 'caststart' | 'castloop' | 'castend';

export interface UnitAnimConfig {
  key: UnitAnimKey;
  frameRate: number;
  repeat: number; // -1 = loop, 0 = once
}

const ANIM_DEFAULTS: Record<UnitAnimKey, Omit<UnitAnimConfig, 'key'>> = {
  idle:       { frameRate: 8,  repeat: -1 },
  run:        { frameRate: 10, repeat: -1 },
  attack:     { frameRate: 14, repeat: 0  },
  hit:        { frameRate: 12, repeat: 0  },
  death:      { frameRate: 10, repeat: 0  },
  breathing:  { frameRate: 6,  repeat: -1 },
  cast:       { frameRate: 12, repeat: 0  },
  caststart:  { frameRate: 12, repeat: 0  },
  castloop:   { frameRate: 8,  repeat: -1 },
  castend:    { frameRate: 12, repeat: 0  },
};

export interface UnitDef {
  atlasKey: string;       // Phaser atlas key (e.g. 'f5_general')
  framePrefix: string;    // frame name prefix (e.g. 'f5_general')
  availableAnims: UnitAnimKey[];
}

// Every Duelyst atlas in public/resources/units ships the same six animations.
const STANDARD_ANIMS: UnitAnimKey[] = ['idle', 'run', 'attack', 'hit', 'death', 'breathing'];

function standardUnit(key: string): UnitDef {
  return { atlasKey: key, framePrefix: key, availableAnims: STANDARD_ANIMS };
}

// Registry of unit definitions — the party roster plus the bosses. Add new units here.
// BootScene preloads exactly these atlases, so keep it to what the fight actually uses.
export const UNIT_DEFS: Record<string, UnitDef> = Object.fromEntries(
  [
    'f1_ironcliffeguardian',
    'f1_silvermanevanguard',
    'f1_sunforgelancer',
    'neutral_arakiheadhunter',
    'f3_pyromancer',
    'neutral_healingmystic',
    'f1_sunriser',
    'boss_shadowlord',
  ].map(key => [key, standardUnit(key)]),
);

function animGlobalKey(unitKey: string, anim: UnitAnimKey): string {
  return `${unitKey}_${anim}`;
}

/** Register all animations for a unit into the Phaser animation manager. Idempotent. */
export function registerUnitAnims(scene: Phaser.Scene, unitKey: string): void {
  const def = UNIT_DEFS[unitKey];
  if (!def) return;

  for (const animKey of def.availableAnims) {
    const globalKey = animGlobalKey(unitKey, animKey);
    if (scene.anims.exists(globalKey)) continue;

    const frames = scene.anims.generateFrameNames(def.atlasKey, {
      prefix: `${def.framePrefix}_${animKey}_`,
      start: 0,
      end: 999,
      zeroPad: 3,
      suffix: '',
    }).filter(f => {
      // generateFrameNames includes frames that don't exist — filter to atlas frames only
      const texture = scene.textures.get(def.atlasKey);
      return texture.has(f.frame as string);
    });

    if (frames.length === 0) continue;

    const { frameRate, repeat } = ANIM_DEFAULTS[animKey];
    scene.anims.create({ key: globalKey, frames, frameRate, repeat });
  }
}

/** True when the unit has that animation registered (some atlases lack cast/hit). */
export function hasUnitAnim(scene: Phaser.Scene, unitKey: string, anim: UnitAnimKey): boolean {
  return scene.anims.exists(animGlobalKey(unitKey, anim));
}

/** Play a unit animation on a sprite. Resolves correct global key. */
export function playUnitAnim(
  sprite: Phaser.GameObjects.Sprite,
  unitKey: string,
  anim: UnitAnimKey,
  ignoreIfPlaying = true,
): void {
  const globalKey = animGlobalKey(unitKey, anim);
  if (sprite.scene.anims.exists(globalKey)) {
    sprite.play(globalKey, ignoreIfPlaying);
  }
}

/** Create a unit sprite and immediately play its idle animation. */
export function createUnitSprite(
  scene: Phaser.Scene,
  unitKey: string,
  x: number,
  y: number,
): Phaser.GameObjects.Sprite {
  const def = UNIT_DEFS[unitKey];
  const firstFrame = `${def.framePrefix}_idle_000`;
  const sprite = scene.add.sprite(x, y, def.atlasKey, firstFrame);
  registerUnitAnims(scene, unitKey);
  playUnitAnim(sprite, unitKey, 'idle');
  return sprite;
}
