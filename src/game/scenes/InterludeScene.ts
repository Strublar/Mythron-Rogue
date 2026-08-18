import Phaser from 'phaser';
import type { HeroDef } from '../../types';
import { rollRecruitOffers, rollShopOffers } from '../../data/heroDraft';
import { SHOP_PRICE } from '../../data/rarity';
import type { RunState } from '../../engine/RunState';
import { createHeroCard } from '../HeroCard';
import { HeroInspector } from '../HeroInspector';
import { SeatDragController } from '../SeatDragController';
import { GAME_WIDTH, HERO_GROUND_DY, ROLE_COLOR } from '../layout';
import { createUnitPortrait } from '../UnitAnimator';
import { drawSceneBackground, sceneLabel, createButton } from '../ui';

export type InterludePhase = 'offer' | 'shop';

export interface InterludeData {
  run: RunState;
  phase: InterludePhase;
  /** Carried from the offer phase so the shop never re-offers what was just passed up. */
  passed?: HeroDef[];
}

const OFFER_COUNT = 3;
const CARD = { w: 224, h: 172, gap: 12, y: 300 };
const BUTTON_Y = 500;
const SEAT_PORTRAIT_SCALE = 1.5;
/** Atlas canvases vary; clamp so the tall units keep the rows even. */
const SEAT_PORTRAIT_MAX_H = 130;
const CARD_DEPTH = 10;

/**
 * Between-stage screen, run twice per cleared boss: `offer` hands out one free recruit,
 * then `shop` sells up to three more out of the stage's gold. Both work the same way —
 * drag a card onto a seat of its role and it replaces whoever sits there. The party is
 * always seven, so every pick is a swap, never a gap being filled.
 */
export class InterludeScene extends Phaser.Scene {
  private run!: RunState;
  private phase!: InterludePhase;
  private offers: HeroDef[] = [];
  private passed: HeroDef[] = [];
  private taken = new Set<string>();

  private drag!: SeatDragController;
  private inspector!: HeroInspector;
  private cards: Phaser.GameObjects.Container[] = [];
  private seatObjects: Phaser.GameObjects.GameObject[] = [];
  private goldText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'InterludeScene' });
  }

  create(data: InterludeData): void {
    this.run = data.run;
    this.phase = data.phase;
    this.passed = data.passed ?? [];
    this.taken = new Set();
    this.cards = [];
    this.seatObjects = [];

    const cx = GAME_WIDTH / 2;
    drawSceneBackground(this);

    this.offers = this.phase === 'offer'
      ? rollRecruitOffers(OFFER_COUNT, this.run.seatArray())
      : rollShopOffers(OFFER_COUNT, this.run.seatArray(), this.passed);

    sceneLabel(this, cx, 70, `STAGE ${this.run.stage} CLEARED`, 40, '#ffd76b', 'bold');
    sceneLabel(
      this, cx, 118,
      this.phase === 'offer' ? 'RECRUIT ONE — FREE' : 'SHOP',
      24, '#9aa3b8', 'bold',
    );
    if (this.phase === 'shop') {
      this.goldText = sceneLabel(this, cx, 156, `${this.run.gold}G`, 26, '#ffd76b', 'bold');
    }
    sceneLabel(this, cx, 190, 'Drag a hero onto a seat of its row.', 18, '#f3e6c8');

    this.inspector = new HeroInspector(this);
    this.drag = new SeatDragController(this, (hero, seat) => this.onDrop(hero, seat));

    this.drawSeats();
    this.drawCards();

    createButton(this, cx, BUTTON_Y, 'NEXT', () => this.next(), 20);
  }

  /** The party as it stands — portraits on their battlefield slots, drag targets and all. */
  private drawSeats(): void {
    for (const o of this.seatObjects) o.destroy();
    this.seatObjects = [];

    for (const { def, slot } of this.run.placed()) {
      const ground = this.add
        .ellipse(slot.x, slot.y + HERO_GROUND_DY, 110, 34, ROLE_COLOR[def.role], 0.18)
        .setDepth(1);
      const portrait = createUnitPortrait(
        this, def.unitKey, slot.x, slot.y, SEAT_PORTRAIT_SCALE, SEAT_PORTRAIT_MAX_H,
      ).setDepth(2);
      const name = this.add
        .text(slot.x, slot.y + HERO_GROUND_DY + 16, def.name.toUpperCase(), {
          fontFamily: 'Lato', fontSize: '13px', color: '#f3e6c8', fontStyle: 'bold',
        })
        .setOrigin(0.5, 0)
        .setDepth(2);
      this.seatObjects.push(ground, portrait, name);
    }
    // Probes carry the def they were made with, so they rebuild with the seats.
    this.seatObjects.push(...this.inspector.addProbes(this.run.seatArray()));
  }

  private drawCards(): void {
    for (const card of this.cards) card.destroy();
    this.cards = [];

    const span = OFFER_COUNT * CARD.w + (OFFER_COUNT - 1) * CARD.gap;
    let x = GAME_WIDTH / 2 - span / 2 + CARD.w / 2;

    for (const hero of this.offers) {
      if (this.taken.has(hero.id)) {
        x += CARD.w + CARD.gap;
        continue;
      }
      const price = this.phase === 'shop' ? SHOP_PRICE[hero.rarity] : undefined;
      const locked = price !== undefined && !this.run.canAfford(price);
      // `x` advances with the loop — pin it so every card opens its tooltip on itself.
      const cardX = x;
      const card = createHeroCard(
        this, cardX, CARD.y, CARD.w, CARD.h, hero, { price, locked }, CARD_DEPTH,
      );
      if (!locked) this.drag.register(card, hero, this.run.seatsForRole(hero.role));
      // A hold that never travels opens the stats card instead of starting a drag.
      card.on(
        Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,
        () => this.inspector.press(hero, cardX, CARD.y),
      );
      this.cards.push(card);
      x += CARD.w + CARD.gap;
    }
  }

  /** A card landed on a legal seat: pay for it if it is priced, then swap it in. */
  private onDrop(hero: HeroDef, seat: number): void {
    const price = this.phase === 'shop' ? SHOP_PRICE[hero.rarity] : 0;
    if (price > 0 && !this.run.spend(price)) return;
    if (!this.run.replaceSeat(seat, hero)) return;

    this.taken.add(hero.id);
    this.goldText?.setText(`${this.run.gold}G`);
    this.drawSeats();
    this.drawCards();

    // The free recruit is one pick — the shop keeps selling while the purse holds out.
    if (this.phase === 'offer') this.next();
  }

  /** Offer → shop → next stage. */
  private next(): void {
    this.drag.cancel();
    this.inspector.cancel();
    if (this.phase === 'offer') {
      const passed = this.offers.filter(h => !this.taken.has(h.id));
      this.scene.start('InterludeScene', { run: this.run, phase: 'shop', passed });
      return;
    }
    this.run.advance();
    this.scene.start('BossFightScene', { run: this.run });
  }
}
