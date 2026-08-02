import Phaser from 'phaser';
import { boonText } from '../data/boons';
import type { BoonDef } from '../types';

export const BOON_GOLD = '#ffd76b';
export const BOON_CREAM = '#f3e6c8';
export const BOON_MUTED = '#9aa3b8';

const PAD = 18;

/** Tappable offer card: boon name plus its generated effect line. */
export function createBoonCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  boon: BoonDef,
  onPick: (boon: BoonDef) => void,
  depth = 0,
): void {
  const bg = scene.add
    .rectangle(x, y, w, h, 0x11142a, 0.95)
    .setStrokeStyle(2, 0xffd76b, 0.5)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true });

  const left = x - w / 2 + PAD;
  const name = scene.add
    .text(left, y - h / 2 + PAD, boon.name.toUpperCase(), {
      fontFamily: 'Lato', fontSize: '24px', color: BOON_GOLD, fontStyle: 'bold',
    })
    .setOrigin(0, 0)
    .setDepth(depth + 1);
  scene.add
    .text(left, y - h / 2 + PAD + 34, boonText(boon), {
      fontFamily: 'Lato', fontSize: '18px', color: BOON_CREAM,
      wordWrap: { width: w - PAD * 2 },
    })
    .setOrigin(0, 0)
    .setDepth(depth + 1);

  bg.on('pointerover', () => {
    bg.setFillStyle(0x1c2140, 0.95);
    name.setColor('#ffe9a8');
  });
  bg.on('pointerout', () => {
    bg.setFillStyle(0x11142a, 0.95);
    name.setColor(BOON_GOLD);
  });
  bg.once(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => onPick(boon));
}
