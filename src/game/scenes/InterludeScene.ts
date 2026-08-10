import Phaser from 'phaser';
import { ROSTER } from '../../data/heroes';
import { rollUnitOffers } from '../../data/unitDraft';
import type { RunState } from '../../engine/RunState';
import { GAME_WIDTH, HERO_GROUND_DY, seatSlot } from '../layout';
import { HeroInspector } from '../HeroInspector';
import { createHeroCard } from '../HeroCard';
import { createButton, type ButtonHandle } from '../ui';
import type { HeroDef } from '../../types';

export interface InterludeData {
  /** Level whose boss was just cleared. */
  clearedLevel: number;
  /** Run-long state: the drafted unit is seated by the fight scene, not here. */
  run: RunState;
  /** Handed back to the fight scene, carrying the unit to seat (none once the party is full). */
  onDone: (drafted?: HeroDef) => void;
}

const BUTTON_DEPTH = 20;
const RING_DEPTH = 15;

/** Reward window, kept inside the vacated boss zone so the party rows stay clear. */
const PANEL = { y: 360, w: GAME_WIDTH - 24, h: 460 };
const OFFER_COUNT = 3;
const CARD = { w: 216, h: 150, gap: 12, y: 400 };
/** Locks the highlighted unit in, parked under the offers. */
const CONFIRM_Y = 540;

/** Ring drawn under the seat the highlighted unit would take. */
const RING_W = 96;
const RING_COLOR = 0xffd76b;

/**
 * Between-fights screen. Launched over a frozen BossFightScene: only the boss zone is
 * covered, so the party rows stay visible, animating and inspectable. Three units are
 * offered — tapping one rings the seat it would fill, CONFIRM recruits it for the run.
 * Once all seven seats are taken there is nothing left to earn: the screen just continues.
 */
export class InterludeScene extends Phaser.Scene {
  private run!: RunState;
  private onDone!: (drafted?: HeroDef) => void;
  private offers: HeroDef[] = [];
  private cardObjects: Phaser.GameObjects.GameObject[] = [];
  private rings: Phaser.GameObjects.Ellipse[] = [];
  private confirm!: ButtonHandle;
  private selected?: HeroDef;
  private chosen = false;
  private inspector!: HeroInspector;
  /** Set when a press turned into an inspect — that release must not also count as a tap. */
  private inspected = false;

  constructor() {
    super({ key: 'InterludeScene' });
  }

  create(data: InterludeData): void {
    this.run = data.run;
    this.onDone = data.onDone;
    this.chosen = false;
    this.selected = undefined;
    this.cardObjects = [];
    this.rings = [];
    const cx = GAME_WIDTH / 2;

    this.add
      .rectangle(cx, PANEL.y, PANEL.w, PANEL.h, 0x05060f, 0.88)
      .setStrokeStyle(2, 0xffd76b, 0.5);

    this.label(cx, 175, 'BOSS DEFEATED', 46, '#ffd76b', 'bold');
    this.label(cx, 213, `LEVEL ${data.clearedLevel} CLEARED`, 22, '#f3e6c8');

    this.inspector = new HeroInspector(this);
    this.inspector.onOpen = () => { this.inspected = true; };
    this.inspector.addProbes(this.run.seatArray());

    this.offers = rollUnitOffers(OFFER_COUNT, this.run.seatArray(), ROSTER);
    if (this.offers.length === 0) this.buildFullParty(cx);
    else this.buildOffers(cx);
  }

  /** Every seat taken: nothing more is earned this run. */
  private buildFullParty(cx: number): void {
    this.label(cx, 262, 'PARTY COMPLETE', 26, '#9aa3b8', 'bold');
    this.label(cx, 302, 'No more units to recruit — the run rolls on.', 18, '#f3e6c8');
    createButton(this, cx, CONFIRM_Y, 'CONTINUE', () => this.pick(), BUTTON_DEPTH);
  }

  private buildOffers(cx: number): void {
    this.label(cx, 258, 'RECRUIT A UNIT', 24, '#9aa3b8', 'bold');
    this.redrawCards();
    this.confirm = createButton(this, cx, CONFIRM_Y, 'RECRUIT', () => this.pick(), BUTTON_DEPTH);
    this.confirm.setEnabled(false);
  }

  /** Arms the shared long-press. Pair with `wasTap` on the matching release. */
  private beginPress(hero: HeroDef, x: number, y: number): void {
    this.inspected = false;
    this.inspector.press(hero, x, y);
  }

  /** True when the gesture that just ended was a tap rather than an inspect. */
  private wasTap(): boolean {
    const tap = !this.inspected;
    this.inspector.cancel();
    return tap;
  }

  /** Tapping an offer only highlights it — nothing is recruited until CONFIRM. */
  private select(hero: HeroDef): void {
    if (this.chosen) return;
    this.selected = hero;
    // The "current" frame lives on the card, so redraw the row against the new pick.
    this.redrawCards();
    this.highlight(hero);
    this.confirm.setEnabled(true);
  }

  private redrawCards(): void {
    for (const o of this.cardObjects) o.destroy();
    const before = new Set(this.children.list);
    const cx = GAME_WIDTH / 2;
    const rowW = this.offers.length * CARD.w + (this.offers.length - 1) * CARD.gap;
    const left = cx - rowW / 2 + CARD.w / 2;
    this.offers.forEach((hero, i) => {
      createHeroCard(this, left + i * (CARD.w + CARD.gap), CARD.y, CARD.w, CARD.h, hero, {
        taken: false,
        current: hero.id === this.selected?.id,
        onPressStart: (h, hx, hy) => this.beginPress(h, hx, hy),
        onPressCancel: () => this.inspector.cancel(),
        onTap: picked => { if (this.wasTap()) this.select(picked); },
      }, BUTTON_DEPTH);
    });
    this.cardObjects = this.children.list.filter(o => !before.has(o));
  }

  /** Rings the seat the offer would fill, so where it lands is visible before confirming. */
  private highlight(hero: HeroDef): void {
    for (const ring of this.rings) {
      this.tweens.killTweensOf(ring);
      ring.destroy();
    }
    this.rings = [];

    const seat = this.run.nextSeat(hero.role);
    if (seat < 0) return;
    const slot = seatSlot(seat);
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

  /** Hands the fight scene the pick — it seats the unit and spawns the next boss. */
  private pick(): void {
    if (this.chosen) return;
    if (this.offers.length > 0 && !this.selected) return;
    this.chosen = true;
    this.inspector.cancel();
    this.onDone(this.selected);
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
