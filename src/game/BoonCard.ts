import Phaser from 'phaser';
import { boonText } from '../data/boons';
import type { BoonDef, HeroDef } from '../types';

export const BOON_GOLD = '#ffd76b';
export const BOON_CREAM = '#f3e6c8';
export const BOON_MUTED = '#9aa3b8';

const PAD = 18;

export interface BoonCardHandle {
  setSelected(on: boolean): void;
}

/**
 * Tappable offer card: boon name plus its generated effect line. Tap selects, never commits.
 * `party` resolves per-member boons into the total they land for on this exact party.
 */
export function createBoonCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  boon: BoonDef,
  party: HeroDef[],
  onSelect: (boon: BoonDef) => void,
  depth = 0,
): BoonCardHandle {
  const bg = scene.add
    .rectangle(x, y, w, h, 0x11142a, 0.95)
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
    .text(left, y - h / 2 + PAD + 34, boonText(boon, party), {
      fontFamily: 'Lato', fontSize: '18px', color: BOON_CREAM,
      wordWrap: { width: w - PAD * 2 },
    })
    .setOrigin(0, 0)
    .setDepth(depth + 1);

  let selected = false;
  let hovered = false;

  /** One place decides the look, so hovering never wipes the selected state. */
  const paint = (): void => {
    bg.setFillStyle(selected || hovered ? 0x1c2140 : 0x11142a, 0.95);
    bg.setStrokeStyle(selected ? 3 : 2, 0xffd76b, selected ? 1 : 0.5);
    name.setColor(selected || hovered ? '#ffe9a8' : BOON_GOLD);
  };
  paint();

  bg.on('pointerover', () => { hovered = true; paint(); });
  bg.on('pointerout', () => { hovered = false; paint(); });
  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => onSelect(boon));

  return {
    setSelected(on: boolean): void {
      selected = on;
      paint();
    },
  };
}
