import Phaser from 'phaser';
import { PARTY } from '../../data/heroes';
import { GAME_HEIGHT, GAME_WIDTH, HERO_SLOTS } from '../layout';
import { HeroTooltip } from '../HeroTooltip';
import { createButton } from '../ui';
import type { BossDef, HeroDef } from '../../types';

export interface InterludeData {
  /** Level whose boss was just cleared. */
  clearedLevel: number;
  nextBoss: BossDef;
}

/** Hold this long on a hero before its stats card opens. */
const LONG_PRESS_MS = 300;
/** Finger-friendly probe around each slot. */
const PROBE_W = 170;
const PROBE_H = 170;
const PROBE_DEPTH = 5;
const BUTTON_DEPTH = 20;

/**
 * Between-fights screen. Launched over a paused BossFightScene, so the battlefield
 * stays visible behind it; resuming the fight scene spawns the next boss.
 * The party is idle here, so a long press on a hero opens its stats card.
 */
export class InterludeScene extends Phaser.Scene {
  private tooltip!: HeroTooltip;
  private pressTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'InterludeScene' });
  }

  create(data: InterludeData): void {
    const cx = GAME_WIDTH / 2;
    // Light enough that the party still reads through it — heroes are inspectable here.
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05060f, 0.66);

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

    this.label(cx, 768, 'HOLD A HERO TO INSPECT ITS STATS', 18, '#c0a060');
    this.label(cx, 890, 'Cast an ability to start the next fight.', 20, '#c0a060');

    createButton(this, cx, 1060, 'CONTINUE', () => {
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
