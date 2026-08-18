import Phaser from 'phaser';
import type { HeroDef } from '../types';
import { tagStrip } from '../data/heroes';
import { RARITY_COLOR, RARITY_LABEL } from '../data/rarity';
import { createUnitPortrait } from './UnitAnimator';
import { BOON_CREAM, BOON_GOLD, BOON_MUTED } from './BoonCard';
import { ROLE_COLOR } from './layout';

const PAD = 8;
/** Portrait scale — offer cards run smaller than the battlefield. */
const PORTRAIT_SCALE = 1.2;
/** Atlas canvases vary (80–110px); clamp so the tall ones don't spill out of the card. */
const PORTRAIT_MAX_H = 84;
const IDLE = 0x11142a;

export interface HeroCardOpts {
  /** Shop card: draws the price badge. Absent on a free recruit offer. */
  price?: number;
  /** Priced out of reach — the card dims and refuses the drag. */
  locked?: boolean;
}

/**
 * One offer: static idle portrait, name, tag strip, stat strip, rarity and (in the shop)
 * a price. Returned as a container so the interlude can drag the whole card onto a seat —
 * gesture handling belongs to `SeatDragController`, the card only draws itself.
 */
export function createHeroCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  hero: HeroDef,
  opts: HeroCardOpts = {},
  depth = 0,
): Phaser.GameObjects.Container {
  // The hit area lives with the card, not with whoever wires up a gesture: a locked
  // card takes no drag but still opens its stats card, so both must hit the same box.
  const card = scene.add
    .container(x, y)
    .setDepth(depth)
    .setSize(w, h)
    .setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);

  const bg = scene.add
    .rectangle(0, 0, w, h, IDLE, 0.95)
    .setStrokeStyle(2, RARITY_COLOR[hero.rarity], 0.9);
  card.add(bg);

  card.add(createUnitPortrait(scene, hero.unitKey, 0, -32, PORTRAIT_SCALE, PORTRAIT_MAX_H));

  card.add(
    scene.add
      .text(0, h / 2 - PAD - 52, hero.name.toUpperCase(), {
        fontFamily: 'Lato', fontSize: '14px', color: BOON_GOLD, fontStyle: 'bold',
        align: 'center', wordWrap: { width: w - PAD * 2 },
      })
      .setOrigin(0.5, 0),
  );

  // Tags are the synergy axis the recruit roll anchors on, so they ride the card.
  card.add(
    scene.add
      .text(0, h / 2 - PAD - 33, tagStrip(hero), {
        fontFamily: 'Lato', fontSize: '12px', color: BOON_MUTED, fontStyle: 'bold',
      })
      .setOrigin(0.5, 0),
  );

  card.add(
    scene.add
      .text(0, h / 2 - PAD - 14, statStrip(hero), {
        fontFamily: 'Lato', fontSize: '13px', color: BOON_CREAM,
      })
      .setOrigin(0.5, 0),
  );

  card.add(
    scene.add
      .text(-w / 2 + PAD, -h / 2 + PAD, RARITY_LABEL[hero.rarity], {
        fontFamily: 'Lato', fontSize: '12px', fontStyle: 'bold',
        color: `#${RARITY_COLOR[hero.rarity].toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0, 0),
  );

  // The price owns the top-right corner; the passive star steps aside for it.
  if (opts.price !== undefined) {
    card.add(
      scene.add
        .text(w / 2 - PAD, -h / 2 + PAD, `${opts.price}G`, {
          fontFamily: 'Lato', fontSize: '20px', fontStyle: 'bold',
          color: opts.locked ? '#8a8f9e' : '#ffd76b',
        })
        .setOrigin(1, 0),
    );
  }

  // A star marks the passive; the hold-to-inspect card spells it out.
  if (hero.passive) {
    card.add(
      scene.add
        .text(w / 2 - PAD - (opts.price !== undefined ? 46 : 0), -h / 2 + PAD, '★', {
          fontFamily: 'Lato', fontSize: '18px', color: BOON_GOLD,
        })
        .setOrigin(1, 0),
    );
  }

  if (opts.locked) {
    card.setAlpha(0.45);
    bg.setFillStyle(0x0b0d18, 0.95);
  }

  // The role accent under the card is the only cue for where it may be dropped.
  card.addAt(
    scene.add.rectangle(0, h / 2 - 2, w - PAD * 2, 3, ROLE_COLOR[hero.role], 0.9),
    1,
  );

  return card;
}

/** HP / attack-or-heal / swing interval, the three numbers that decide a pick. */
function statStrip(hero: HeroDef): string {
  const per = hero.role === 'heal' ? 'HEAL' : 'ATK';
  return `${hero.maxHp} HP  ·  ${hero.attack} ${per}  ·  ${(hero.attackIntervalMs / 1000).toFixed(1)}s`;
}
