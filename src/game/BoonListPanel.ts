import Phaser from 'phaser';
import { boonText } from '../data/boons';
import type { BoonStack } from '../engine/RunState';
import type { HeroDef } from '../types';
import { BOON_CREAM, BOON_GOLD, BOON_MUTED } from './BoonCard';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';

const PANEL_W = 620;
const PAD = 24;
const ROW_GAP = 12;
const MAX_ROWS = 9;

/** Full-run boon list. One instance per scene; tap anywhere to dismiss. */
export class BoonListPanel {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, depth = 400) {
    this.shade = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setDepth(depth)
      .setVisible(false)
      .setInteractive();
    this.shade.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.hide());

    this.bg = scene.add
      .rectangle(0, 0, PANEL_W, 10, 0x0b0d18, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffd76b, 0.75);
    this.root = scene.add.container(0, 0, [this.bg]).setDepth(depth + 1).setVisible(false);
  }

  show(stacks: BoonStack[], party: HeroDef[]): void {
    for (const child of this.root.list.slice(1)) child.destroy();

    let y = PAD;
    y = this.line('BOONS', 30, BOON_GOLD, y, 'bold');
    y = this.line(stacks.length === 0 ? 'None yet — clear a boss to earn one.' : 'Active for the rest of the run.', 16, BOON_MUTED, y) + ROW_GAP;

    for (const { boon, count } of stacks.slice(0, MAX_ROWS)) {
      y = this.line(count > 1 ? `${boon.name} ×${count}` : boon.name, 22, BOON_CREAM, y, 'bold');
      y = this.line(this.stackedText(boon, count, party), 17, BOON_MUTED, y) + ROW_GAP;
    }
    const hidden = stacks.length - MAX_ROWS;
    if (hidden > 0) y = this.line(`+${hidden} more`, 17, BOON_MUTED, y);

    const height = y + PAD - ROW_GAP;
    this.bg.setSize(PANEL_W, height);
    this.root
      .setPosition((GAME_WIDTH - PANEL_W) / 2, Math.max(40, (GAME_HEIGHT - height) / 2))
      .setVisible(true);
    this.shade.setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
    this.shade.setVisible(false);
  }

  /** Percentages are additive per stack, so the list shows the total, not the unit value. */
  private stackedText(boon: BoonStack['boon'], count: number, party: HeroDef[]): string {
    if (count === 1) return boonText(boon, party);
    const effect = Object.fromEntries(
      Object.entries(boon.effect).map(([k, v]) => [k, (v as number) * count]),
    );
    return boonText({ ...boon, effect }, party);
  }

  private line(text: string, size: number, color: string, y: number, style = ''): number {
    const t = this.scene.add
      .text(PAD, y, text, {
        fontFamily: 'Lato',
        fontSize: `${size}px`,
        color,
        fontStyle: style,
        wordWrap: { width: PANEL_W - PAD * 2 },
      })
      .setOrigin(0, 0);
    this.root.add(t);
    return y + t.height + 4;
  }
}
