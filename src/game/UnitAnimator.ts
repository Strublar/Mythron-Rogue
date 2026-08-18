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
  /** Atlases that name an animation differently — 'hit' shipped as 'hurt', and so on. */
  frameAliases?: Partial<Record<UnitAnimKey, string>>;
}

// Every Duelyst atlas in public/resources/units ships the same six animations.
const STANDARD_ANIMS: UnitAnimKey[] = ['idle', 'run', 'attack', 'hit', 'death', 'breathing'];

function standardUnit(key: string): UnitDef {
  return { atlasKey: key, framePrefix: key, availableAnims: STANDARD_ANIMS };
}

// A handful of Duelyst atlases name the same six animations differently. The alias maps
// them back onto the shared keys, so nothing downstream needs to know.
const FRAME_ALIASES: Record<string, Partial<Record<UnitAnimKey, string>>> = {
  f5_silitharyoung: { breathing: 'breathe', hit: 'hurt', run: 'move' },
  f4_gloomchaser: { hit: 'damage' },
};

// Registry of unit definitions — the party roster plus the bosses. Add new units here.
// BootScene preloads exactly these atlases, so keep it to what the fight actually uses.
export const UNIT_DEFS: Record<string, UnitDef> = Object.fromEntries(
  [
    // tanks
    'f1_ironcliffeguardian',
    'f1_silvermanevanguard',
    'neutral_primusshieldmaster',
    'f6_tundraguardian',
    'f3_irondervish',
    // dps
    'f1_sunforgelancer',
    'neutral_arakiheadhunter',
    'f3_pyromancer',
    'f1_elyxstormblade',
    'f4_nightsorrow',
    'neutral_voidhunter',
    'f2_stormkage',
    'neutral_whitewidow',
    'f5_mankatorwarbeast',
    // healers
    'neutral_healingmystic',
    'f1_sunriser',
    'f3_aymarahealer',
    'neutral_bloodstonealchemist',
    'neutral_spiritscribe',
    'neutral_mercshieldoracle',
    // starters — the seven a run opens with
    'f1_silverguardsquire',
    'f5_silitharyoung',
    'f4_gloomchaser',
    'neutral_minijax',
    'f3_dervish',
    'f2_panddo',
    'f6_treant',
    // bosses — the stage ladder, in order
    'boss_wraith',
    'boss_cindera',
    'boss_kron',
    'boss_vampire',
    'boss_grym',
    'boss_skurge',
    'boss_serpenti',
    'boss_shadowlord',
  ].map(key => [
    key,
    { ...standardUnit(key), frameAliases: FRAME_ALIASES[key] } satisfies UnitDef,
  ]),
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
      prefix: `${def.framePrefix}_${def.frameAliases?.[animKey] ?? animKey}_`,
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

/**
 * A still idle portrait, scaled to fit a box. Atlas canvases run 80–110px tall, so the
 * cap is what keeps the tall ones inside their card — grids and the shop share it.
 */
export function createUnitPortrait(
  scene: Phaser.Scene,
  unitKey: string,
  x: number,
  y: number,
  scale: number,
  maxHeight: number,
): Phaser.GameObjects.Sprite {
  const def = UNIT_DEFS[unitKey];
  const portrait = scene.add.sprite(x, y, def.atlasKey, `${def.framePrefix}_idle_000`);
  portrait.setScale(Math.min(scale, maxHeight / portrait.height));
  return portrait;
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
