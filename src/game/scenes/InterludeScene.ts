import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout';
import { createButton } from '../ui';
import type { BossDef } from '../../types';

export interface InterludeData {
  /** Level whose boss was just cleared. */
  clearedLevel: number;
  nextBoss: BossDef;
}

/**
 * Between-fights screen. Launched over a paused BossFightScene, so the battlefield
 * stays visible behind it; resuming the fight scene spawns the next boss.
 */
export class InterludeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'InterludeScene' });
  }

  create(data: InterludeData): void {
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05060f, 0.82);

    this.label(cx, 300, 'BOSS DEFEATED', 58, '#ffd76b', 'bold');
    this.label(cx, 366, `LEVEL ${data.clearedLevel} CLEARED`, 26, '#f3e6c8');

    // Next-boss briefing panel.
    const panelY = 620;
    this.add
      .rectangle(cx, panelY, GAME_WIDTH - 140, 250, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffd76b, 0.5);
    this.label(cx, panelY - 92, `NEXT — LEVEL ${data.clearedLevel + 1}`, 20, '#c0a060');
    this.label(cx, panelY - 44, data.nextBoss.name.toUpperCase(), 34, '#ff8a80', 'bold');
    this.label(cx, panelY + 12, `HP ${data.nextBoss.maxHp.toLocaleString()}`, 24, '#f3e6c8');
    this.label(cx, panelY + 50, `ATTACK ${data.nextBoss.attack}`, 24, '#f3e6c8');
    this.label(cx, panelY + 88, 'PARTY REVIVED AND FULLY HEALED', 18, '#8ef2a5');

    this.label(cx, 830, 'Cast an ability to start the next fight.', 20, '#c0a060');

    createButton(this, cx, 960, 'CONTINUE', () => {
      this.scene.resume('BossFightScene');
      this.scene.stop();
    });
  }

  private label(x: number, y: number, text: string, size: number, color: string, style = ''): void {
    this.add
      .text(x, y, text, {
        fontFamily: 'Lato',
        fontSize: `${size}px`,
        color,
        fontStyle: style,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
  }
}
