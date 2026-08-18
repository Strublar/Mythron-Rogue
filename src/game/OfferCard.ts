import Phaser from 'phaser';
import type { HeroRarity } from '../types';
import { RARITY_COLOR, RARITY_LABEL } from '../data/rarity';

export const CARD_PAD = 8;
const IDLE = 0x11142a;

export interface OfferCardOpts {
  /** Shop card: draws the price badge. Absent on a free recruit offer. */
  price?: number;
  /** Priced out of reach — the card dims and refuses the drag. */
  locked?: boolean;
}

/**
 * The frame every offer shares — hero or artifact: a rarity-tinted box, its rarity label
 * and, in the shop, its price. Contents are added by the caller; gesture handling belongs
 * to `SeatDragController`, the card only draws itself.
 */
export function createOfferCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  rarity: HeroRarity,
  opts: OfferCardOpts,
  depth: number,
): Phaser.GameObjects.Container {
  // The hit area lives with the card, not with whoever wires up a gesture: a locked
  // card takes no drag but still opens its stats card, so both must hit the same box.
  // Phaser hit-tests a container in *origin space* — it adds the display origin to the
  // local point before calling Contains — so the box runs (0,0)→(w,h), not (-w/2,-h/2).
  const card = scene.add
    .container(x, y)
    .setDepth(depth)
    .setSize(w, h)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

  const bg = scene.add
    .rectangle(0, 0, w, h, opts.locked ? 0x0b0d18 : IDLE, 0.95)
    .setStrokeStyle(2, RARITY_COLOR[rarity], 0.9);
  card.add(bg);

  card.add(
    scene.add
      .text(-w / 2 + CARD_PAD, -h / 2 + CARD_PAD, RARITY_LABEL[rarity], {
        fontFamily: 'Lato', fontSize: '12px', fontStyle: 'bold',
        color: `#${RARITY_COLOR[rarity].toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0, 0),
  );

  if (opts.price !== undefined) {
    card.add(
      scene.add
        .text(w / 2 - CARD_PAD, -h / 2 + CARD_PAD, `${opts.price}G`, {
          fontFamily: 'Lato', fontSize: '20px', fontStyle: 'bold',
          color: opts.locked ? '#8a8f9e' : '#ffd76b',
        })
        .setOrigin(1, 0),
    );
  }

  if (opts.locked) card.setAlpha(0.45);

  return card;
}
