import Phaser from 'phaser';
import { expToNext } from '../data/progression';
import type { HeroProgress } from '../types';
import { UI_MUTED } from './ui';

export const EXP_BAR_H = 6;

export interface ExpBarHandle {
  /** Redraws the fill and its caption for a new progress — the result screen tweens through it. */
  setProgress(p: HeroProgress): void;
}

/**
 * Progress toward the next level: a track, a fill and a `x / y EXP` caption. A maxed hero
 * gets a full gold bar and no numbers. Shared by the roster cards and the result screen.
 */
export function drawExpBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  p: HeroProgress,
  depth: number,
  barHeight = EXP_BAR_H,
): ExpBarHandle {
  scene.add.rectangle(x, y, w, barHeight, 0x000000, 0.55).setDepth(depth);
  const fill = scene.add
    .rectangle(x - w / 2, y, 0, barHeight, 0x7fd4ff, 0.9)
    .setOrigin(0, 0.5)
    .setDepth(depth + 1);
  const caption = scene.add
    .text(x, y + barHeight, '', { fontFamily: 'Lato', fontSize: '11px', color: UI_MUTED })
    .setOrigin(0.5, 0)
    .setDepth(depth);

  const handle: ExpBarHandle = {
    setProgress(next: HeroProgress): void {
      const need = expToNext(next.level);
      const ratio = need === 0 ? 1 : Phaser.Math.Clamp(next.exp / need, 0, 1);
      fill.setSize(w * ratio, barHeight);
      fill.setFillStyle(need === 0 ? 0xffd76b : 0x7fd4ff, 0.9);
      caption.setText(need === 0 ? 'MAX LEVEL' : `${next.exp} / ${need} EXP`);
    },
  };
  handle.setProgress(p);
  return handle;
}
