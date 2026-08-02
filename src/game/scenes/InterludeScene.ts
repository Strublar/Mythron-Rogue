import Phaser from 'phaser';
import { rollBoons } from '../../data/boons';
import type { RunState } from '../../engine/RunState';
import { GAME_WIDTH, HERO_SLOTS } from '../layout';
import { HeroTooltip } from '../HeroTooltip';
import { createBoonCard } from '../BoonCard';
import { BoonListPanel } from '../BoonListPanel';
import { createButton } from '../ui';
import type { BoonDef, HeroDef } from '../../types';

export interface InterludeData {
  /** Level whose boss was just cleared. */
  clearedLevel: number;
  /** Run-long state: the picked boon lands here before the fight scene resumes. */
  run: RunState;
}

/** Hold this long on a hero before its stats card opens. */
const LONG_PRESS_MS = 300;
/** Finger-friendly probe around each slot. */
const PROBE_W = 170;
const PROBE_H = 170;
const PROBE_DEPTH = 5;
const BUTTON_DEPTH = 20;

/** Reward window, kept inside the vacated boss zone so the party rows stay clear. */
const PANEL = { y: 395, w: 640, h: 530 };
const OFFER_COUNT = 3;
const CARD = { w: 580, h: 108, gap: 12, top: 282 };
/** Boon list opener, parked under the back row. */
const BOONS_BUTTON_Y = 1246;

/**
 * Between-fights screen. Launched over a paused BossFightScene: only the boss zone
 * is covered, so the party rows stay visible and inspectable. Picking one of three
 * boons banks it for the rest of the run and resumes the fight scene.
 */
export class InterludeScene extends Phaser.Scene {
  private tooltip!: HeroTooltip;
  private boonList!: BoonListPanel;
  private pressTimer?: Phaser.Time.TimerEvent;
  private run!: RunState;
  private chosen = false;

  constructor() {
    super({ key: 'InterludeScene' });
  }

  create(data: InterludeData): void {
    this.run = data.run;
    this.chosen = false;
    const cx = GAME_WIDTH / 2;

    this.add
      .rectangle(cx, PANEL.y, PANEL.w, PANEL.h, 0x05060f, 0.88)
      .setStrokeStyle(2, 0xffd76b, 0.5);

    this.label(cx, PANEL.y - 220, 'BOSS DEFEATED', 46, '#ffd76b', 'bold');
    this.label(cx, PANEL.y - 182, `LEVEL ${data.clearedLevel} CLEARED`, 22, '#f3e6c8');
    this.label(cx, PANEL.y - 143, 'CHOOSE A BOON', 24, '#9aa3b8', 'bold');

    rollBoons(OFFER_COUNT).forEach((boon, i) => {
      const y = CARD.top + (CARD.h + CARD.gap) * i + CARD.h / 2;
      createBoonCard(this, cx, y, CARD.w, CARD.h, boon, b => this.pick(b), BUTTON_DEPTH);
    });

    this.boonList = new BoonListPanel(this);
    createButton(this, cx, BOONS_BUTTON_Y, 'BOONS', () => this.boonList.show(this.run.stacks()), BUTTON_DEPTH);

    this.buildInspector();
  }

  /** Banks the boon, then hands the fight scene back — the next boss spawns buffed. */
  private pick(boon: BoonDef): void {
    if (this.chosen) return;
    this.chosen = true;
    this.run.addBoon(boon);
    this.scene.resume('BossFightScene');
    this.scene.stop();
  }

  /** One press probe per hero slot, feeding the shared stats card. */
  private buildInspector(): void {
    this.tooltip = new HeroTooltip(this);

    const slotIndex = { tank: 0, dps: 0, heal: 0 };
    for (const def of this.run.heroDefs()) {
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
