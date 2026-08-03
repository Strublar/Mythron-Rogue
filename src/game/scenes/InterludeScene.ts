import Phaser from 'phaser';
import { boonAffects, rollBoons } from '../../data/boons';
import type { RunState } from '../../engine/RunState';
import { GAME_WIDTH, HERO_GROUND_DY, withSlots } from '../layout';
import { HeroInspector } from '../HeroInspector';
import { createBoonCard, type BoonCardHandle } from '../BoonCard';
import { BoonListPanel } from '../BoonListPanel';
import { createButton, type ButtonHandle } from '../ui';
import type { BoonDef } from '../../types';

export interface InterludeData {
  /** Level whose boss was just cleared. */
  clearedLevel: number;
  /** Run-long state: the picked boon lands here before the fight scene resumes. */
  run: RunState;
  /** Handed back to the fight scene once a boon is locked in. */
  onDone: () => void;
}

const BUTTON_DEPTH = 20;
const RING_DEPTH = 15;

/** Reward window, kept inside the vacated boss zone so the party rows stay clear. */
const PANEL = { y: 390, w: 640, h: 540 };
const OFFER_COUNT = 3;
const CARD = { w: 580, h: 96, gap: 10, top: 262 };
/** Locks the highlighted boon in, parked under the offers. */
const CONFIRM_Y = 612;
/** Boon list opener, parked under the back row. */
const BOONS_BUTTON_Y = 1246;

/** Ring drawn under each hero the highlighted boon would buff. */
const RING_W = 96;
const RING_COLOR = 0xffd76b;

/**
 * Between-fights screen. Launched over a frozen BossFightScene: only the boss zone
 * is covered, so the party rows stay visible, animating and inspectable. Tapping an
 * offer highlights the heroes it buffs; CONFIRM banks it for the rest of the run.
 */
export class InterludeScene extends Phaser.Scene {
  private boonList!: BoonListPanel;
  private run!: RunState;
  private onDone!: () => void;
  private cards: { boon: BoonDef; handle: BoonCardHandle }[] = [];
  private rings: Phaser.GameObjects.Ellipse[] = [];
  private confirm!: ButtonHandle;
  private selected?: BoonDef;
  private chosen = false;

  constructor() {
    super({ key: 'InterludeScene' });
  }

  create(data: InterludeData): void {
    this.run = data.run;
    this.onDone = data.onDone;
    this.chosen = false;
    this.selected = undefined;
    this.cards = [];
    this.rings = [];
    const cx = GAME_WIDTH / 2;

    this.add
      .rectangle(cx, PANEL.y, PANEL.w, PANEL.h, 0x05060f, 0.88)
      .setStrokeStyle(2, 0xffd76b, 0.5);

    this.label(cx, 165, 'BOSS DEFEATED', 46, '#ffd76b', 'bold');
    this.label(cx, 203, `LEVEL ${data.clearedLevel} CLEARED`, 22, '#f3e6c8');
    this.label(cx, 240, 'CHOOSE A BOON', 24, '#9aa3b8', 'bold');

    const party = this.run.baseDefs();
    rollBoons(OFFER_COUNT, party).forEach((boon, i) => {
      const y = CARD.top + (CARD.h + CARD.gap) * i + CARD.h / 2;
      const handle = createBoonCard(this, cx, y, CARD.w, CARD.h, boon, party, b => this.select(b), BUTTON_DEPTH);
      this.cards.push({ boon, handle });
    });

    this.confirm = createButton(this, cx, CONFIRM_Y, 'CONFIRM', () => this.pick(), BUTTON_DEPTH);
    this.confirm.setEnabled(false);

    this.boonList = new BoonListPanel(this);
    createButton(this, cx, BOONS_BUTTON_Y, 'BOONS', () => this.boonList.show(this.run.stacks(), this.run.baseDefs()), BUTTON_DEPTH);

    new HeroInspector(this).addProbes(this.run.heroDefs());
  }

  /** Tapping an offer only highlights it — nothing is banked until CONFIRM. */
  private select(boon: BoonDef): void {
    if (this.chosen) return;
    this.selected = boon;
    for (const card of this.cards) card.handle.setSelected(card.boon === boon);
    this.highlight(boon);
    this.confirm.setEnabled(true);
  }

  /** Rings every hero the offer's scope covers, so the buff's reach is visible. */
  private highlight(boon: BoonDef): void {
    for (const ring of this.rings) {
      this.tweens.killTweensOf(ring);
      ring.destroy();
    }
    this.rings = [];

    for (const { def, slot } of withSlots(this.run.heroDefs())) {
      if (!boonAffects(boon, def)) continue;
      const ring = this.add
        .ellipse(slot.x, slot.y + HERO_GROUND_DY, RING_W, RING_W * 0.38)
        .setStrokeStyle(4, RING_COLOR, 1)
        .setDepth(RING_DEPTH);
      this.rings.push(ring);
      this.tweens.add({
        targets: ring,
        scaleX: 1.18,
        scaleY: 1.18,
        alpha: 0.45,
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** Banks the boon, then hands the fight scene back — the next boss spawns buffed. */
  private pick(): void {
    if (this.chosen || !this.selected) return;
    this.chosen = true;
    this.run.addBoon(this.selected);
    this.onDone();
    this.scene.stop();
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
