import Phaser from 'phaser';
import type { ArtifactDef } from '../types';
import { effectParts } from '../data/statMath';
import { createArtifactIcon } from './ArtifactIcon';
import { BOON_CREAM, BOON_GOLD, BOON_MUTED } from './BoonCard';
import { CARD_PAD, createOfferCard, type OfferCardOpts } from './OfferCard';

const ICON_SIZE = 56;
/** Gear drops on any seat, so the accent under the card is gold rather than a role colour. */
const GEAR_ACCENT = 0xffd76b;
/** Rows measured down from the card's top edge — the icon anchors, the text follows. */
const ICON_DY = 44;
const NAME_DY = 78;
const EFFECT_DY = 100;
const PASSIVE_DY = 140;

/**
 * One artifact offer on the shared offer frame: its animated icon, name, the stats it
 * grants and its passive spelled out — gear carries no stat grid, so the card says it all.
 */
export function createArtifactCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  artifact: ArtifactDef,
  opts: OfferCardOpts = {},
  depth = 0,
): Phaser.GameObjects.Container {
  const card = createOfferCard(scene, x, y, w, h, artifact.rarity, opts, depth);
  const top = -h / 2;
  const wrap = { width: w - CARD_PAD * 2 };

  card.add(createArtifactIcon(scene, artifact, 0, top + ICON_DY, ICON_SIZE));

  card.add(
    scene.add
      .text(0, top + NAME_DY, artifact.name.toUpperCase(), {
        fontFamily: 'Lato', fontSize: '14px', color: BOON_GOLD, fontStyle: 'bold',
        align: 'center', wordWrap: wrap,
      })
      .setOrigin(0.5, 0),
  );

  card.add(
    scene.add
      .text(0, top + EFFECT_DY, effectParts(artifact.effect).join('\n'), {
        fontFamily: 'Lato', fontSize: '12px', color: BOON_CREAM, align: 'center', wordWrap: wrap,
      })
      .setOrigin(0.5, 0),
  );

  card.add(
    scene.add
      .text(0, top + PASSIVE_DY, `★ ${artifact.passive.name}\n${artifact.passive.text}`, {
        fontFamily: 'Lato', fontSize: '11px', color: BOON_MUTED, align: 'center', wordWrap: wrap,
      })
      .setOrigin(0.5, 0),
  );

  card.addAt(scene.add.rectangle(0, h / 2 - 2, w - CARD_PAD * 2, 3, GEAR_ACCENT, 0.9), 1);

  return card;
}
