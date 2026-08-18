import Phaser from 'phaser';
import type { HeroDef } from '../types';
import { tagStrip } from '../data/heroes';
import { createUnitPortrait } from './UnitAnimator';
import { BOON_CREAM, BOON_GOLD, BOON_MUTED } from './BoonCard';
import { CARD_PAD, createOfferCard, type OfferCardOpts } from './OfferCard';
import { ROLE_COLOR } from './layout';

/** Portrait scale — offer cards run smaller than the battlefield. */
const PORTRAIT_SCALE = 1.2;
/** Atlas canvases vary (80–110px); clamp so the tall ones don't spill out of the card. */
const PORTRAIT_MAX_H = 84;

export type HeroCardOpts = OfferCardOpts;

/**
 * One hero offer on the shared offer frame: static idle portrait, name, tag strip, stat
 * strip and the role accent that says which row it may be dropped on.
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
  const card = createOfferCard(scene, x, y, w, h, hero.rarity, opts, depth);

  card.add(createUnitPortrait(scene, hero.unitKey, 0, -32, PORTRAIT_SCALE, PORTRAIT_MAX_H));

  card.add(
    scene.add
      .text(0, h / 2 - CARD_PAD - 52, hero.name.toUpperCase(), {
        fontFamily: 'Lato', fontSize: '14px', color: BOON_GOLD, fontStyle: 'bold',
        align: 'center', wordWrap: { width: w - CARD_PAD * 2 },
      })
      .setOrigin(0.5, 0),
  );

  // Tags are the synergy axis the recruit roll anchors on, so they ride the card.
  card.add(
    scene.add
      .text(0, h / 2 - CARD_PAD - 33, tagStrip(hero), {
        fontFamily: 'Lato', fontSize: '12px', color: BOON_MUTED, fontStyle: 'bold',
      })
      .setOrigin(0.5, 0),
  );

  card.add(
    scene.add
      .text(0, h / 2 - CARD_PAD - 14, statStrip(hero), {
        fontFamily: 'Lato', fontSize: '13px', color: BOON_CREAM,
      })
      .setOrigin(0.5, 0),
  );

  // A star marks the passive; the hold-to-inspect card spells it out.
  if (hero.passive) {
    card.add(
      scene.add
        .text(w / 2 - CARD_PAD - (opts.price !== undefined ? 46 : 0), -h / 2 + CARD_PAD, '★', {
          fontFamily: 'Lato', fontSize: '18px', color: BOON_GOLD,
        })
        .setOrigin(1, 0),
    );
  }

  // The role accent under the card is the only cue for where it may be dropped.
  card.addAt(
    scene.add.rectangle(0, h / 2 - 2, w - CARD_PAD * 2, 3, ROLE_COLOR[hero.role], 0.9),
    1,
  );

  return card;
}

/** HP / attack-or-heal / swing interval, the three numbers that decide a pick. */
function statStrip(hero: HeroDef): string {
  const per = hero.role === 'heal' ? 'HEAL' : 'ATK';
  return `${hero.maxHp} HP  ·  ${hero.attack} ${per}  ·  ${(hero.attackIntervalMs / 1000).toFixed(1)}s`;
}
