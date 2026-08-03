import Phaser from 'phaser';
import type { HeroDef } from '../types';
import { tagStrip } from '../data/heroes';
import { UNIT_DEFS } from './UnitAnimator';
import { BOON_CREAM, BOON_GOLD, BOON_MUTED } from './BoonCard';
import { ROLE_COLOR } from './layout';

const PAD = 8;
/** Portrait scale — the grid is dense, so cards run smaller than the battlefield. */
const PORTRAIT_SCALE = 1.2;
/** Atlas canvases vary (80–110px); clamp so the tall ones don't spill out of the card. */
const PORTRAIT_MAX_H = 84;
const IDLE = 0x11142a;
const HOVER = 0x1c2140;

export interface HeroCardOpts {
  /** Already fielded elsewhere in the party — dimmed and labelled instead of pickable. */
  taken: boolean;
  /** Currently occupying the slot being edited. */
  current: boolean;
  /** Pointer down: arm the scene's long-press inspect. */
  onPressStart: (hero: HeroDef, x: number, y: number) => void;
  /** The gesture left the card without releasing on it. */
  onPressCancel: () => void;
  /** Released on the card. The scene decides whether that was a tap or an inspect. */
  onTap: (hero: HeroDef) => void;
}

/**
 * Grid entry for one hero: static idle portrait, name, tag strip, and a stat strip.
 * Press handling belongs to the scene's HeroInspector — the card only reports gestures.
 */
export function createHeroCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  hero: HeroDef,
  opts: HeroCardOpts,
  depth = 0,
): void {
  const accent = ROLE_COLOR[hero.role];
  const bg = scene.add
    .rectangle(x, y, w, h, IDLE, 0.95)
    .setStrokeStyle(2, opts.current ? accent : 0xffd76b, opts.current ? 1 : 0.45)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true });

  const def = UNIT_DEFS[hero.unitKey];
  const portrait = scene.add
    .sprite(x, y - 32, def.atlasKey, `${def.framePrefix}_idle_000`)
    .setDepth(depth + 1);
  portrait.setScale(Math.min(PORTRAIT_SCALE, PORTRAIT_MAX_H / portrait.height));

  const label = scene.add
    .text(x, y + h / 2 - PAD - 52, hero.name.toUpperCase(), {
      fontFamily: 'Lato', fontSize: '14px', color: BOON_GOLD, fontStyle: 'bold',
      align: 'center', wordWrap: { width: w - PAD * 2 },
    })
    .setOrigin(0.5, 0)
    .setDepth(depth + 1);

  // Tags decide which boons the party draws, so they sit on the card, not just the popup.
  scene.add
    .text(x, y + h / 2 - PAD - 33, tagStrip(hero), {
      fontFamily: 'Lato', fontSize: '12px', color: BOON_MUTED, fontStyle: 'bold',
    })
    .setOrigin(0.5, 0)
    .setDepth(depth + 1);

  scene.add
    .text(x, y + h / 2 - PAD - 14, statStrip(hero), {
      fontFamily: 'Lato', fontSize: '13px', color: BOON_CREAM,
    })
    .setOrigin(0.5, 0)
    .setDepth(depth + 1);

  if (opts.taken) {
    // Fielded elsewhere: still inspectable, but tapping it would duplicate the hero.
    for (const o of [portrait, label]) o.setAlpha(0.35);
    bg.setFillStyle(0x0b0d18, 0.95);
    scene.add
      .text(x, y - h / 2 + PAD, 'IN PARTY', {
        fontFamily: 'Lato', fontSize: '12px', color: BOON_MUTED, fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(depth + 2);
  }

  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
    if (!opts.taken) bg.setFillStyle(HOVER, 0.95);
  });
  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
    if (!opts.taken) bg.setFillStyle(IDLE, 0.95);
    opts.onPressCancel();
  });
  // Every card is inspectable, including the ones already fielded.
  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => opts.onPressStart(hero, x, y));
  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
    // A fielded hero cannot be picked twice, but its release still clears the press.
    if (opts.taken) opts.onPressCancel();
    else opts.onTap(hero);
  });
}

/** HP / attack-or-heal / swing interval, the three numbers that decide a pick. */
function statStrip(hero: HeroDef): string {
  const per = hero.role === 'heal' ? 'HEAL' : 'ATK';
  return `${hero.maxHp} HP  ·  ${hero.attack} ${per}  ·  ${(hero.attackIntervalMs / 1000).toFixed(1)}s`;
}
