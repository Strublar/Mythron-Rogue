import Phaser from 'phaser';
import { PARTY } from '../../data/heroes';
import { GAME_WIDTH, HERO_SLOTS } from '../layout';
import { HeroTooltip } from '../HeroTooltip';
import { createButton } from '../ui';
import type { HeroDef } from '../../types';

export interface InterludeData {
  /** Level whose boss was just cleared. */
  clearedLevel: number;
}

/** Hold this long on a hero before its stats card opens. */
const LONG_PRESS_MS = 300;
/** Finger-friendly probe around each slot. */
const PROBE_W = 170;
const PROBE_H = 170;
const PROBE_DEPTH = 5;
const BUTTON_DEPTH = 20;

/** Result window, kept inside the vacated boss zone so the party rows stay clear. */
const PANEL = { y: 400, w: 560, h: 300 };

/**
 * Between-fights screen. Launched over a paused BossFightScene: only the boss zone
 * is covered, so the party rows stay visible and inspectable. Resuming the fight
 * scene spawns the next boss.
 */
export class InterludeScene extends Phaser.Scene {
  private tooltip!: HeroTooltip;
  private pressTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'InterludeScene' });
  }

  create(data: InterludeData): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .rectangle(cx, PANEL.y, PANEL.w, PANEL.h, 0x05060f, 0.88)
      .setStrokeStyle(2, 0xffd76b, 0.5);

    this.label(cx, PANEL.y - 90, 'BOSS DEFEATED', 52, '#ffd76b', 'bold');
    this.label(cx, PANEL.y - 28, `LEVEL ${data.clearedLevel} CLEARED`, 26, '#f3e6c8');

    createButton(this, cx, PANEL.y + 72, 'CONTINUE', () => {
      this.scene.resume('BossFightScene');
      this.scene.stop();
    }, BUTTON_DEPTH);

    this.buildInspector();
  }

  /** One press probe per hero slot, feeding the shared stats card. */
  private buildInspector(): void {
    this.tooltip = new HeroTooltip(this);

    const slotIndex = { tank: 0, dps: 0, heal: 0 };
    for (const def of PARTY) {
      const slot = HERO_SLOTS[def.role][slotIndex[def.role]++];
      this.add
        .zone(slot.x, slot.y, PROBE_W, PROBE_H)
        .setDepth(PROBE_DEPTH)
        .setInteractive()
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.beginPress(def, slot))
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.endPress());
    }

    this.input.on(Phaser.Input.Events.POINTER_UP, () => this.endPress());
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.endPress());
  }

  private beginPress(def: HeroDef, slot: { x: number; y: number }): void {
    this.endPress();
    this.pressTimer = this.time.delayedCall(LONG_PRESS_MS, () => this.tooltip.show(def, slot.x, slot.y));
  }

  private endPress(): void {
    this.pressTimer?.remove();
    this.pressTimer = undefined;
    this.tooltip.hide();
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
