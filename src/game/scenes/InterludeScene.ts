import Phaser from 'phaser';
import type { ArtifactDef, HeroDef } from '../../types';
import { rollArtifactOffers, rollRecruitOffers, rollShopOffers } from '../../data/heroDraft';
import { SHOP_PRICE } from '../../data/rarity';
import type { RunState } from '../../engine/RunState';
import { createArtifactCard } from '../ArtifactCard';
import { createArtifactIcon } from '../ArtifactIcon';
import { createHeroCard } from '../HeroCard';
import { HeroInspector } from '../HeroInspector';
import { SeatDragController } from '../SeatDragController';
import { createTabBar, type TabBarHandle } from '../TabBar';
import { GAME_WIDTH, HERO_GROUND_DY, ROLE_COLOR, SEAT_COUNT } from '../layout';
import { createUnitPortrait } from '../UnitAnimator';
import { drawSceneBackground, sceneLabel, createButton } from '../ui';

export type InterludePhase = 'offer' | 'shop';

/** The shop's two counters: bodies on one tab, gear on the other. */
type ShopTab = 'heroes' | 'artifacts';
const SHOP_TABS: ShopTab[] = ['heroes', 'artifacts'];
const TAB_LABELS = ['HEROES', 'ARTIFACTS'];

export interface InterludeData {
  run: RunState;
  phase: InterludePhase;
  /** Carried from the offer phase so the shop never re-offers what was just passed up. */
  passed?: HeroDef[];
}

const OFFER_COUNT = 3;
const CARD = { w: 224, gap: 12, y: 310 };
const HERO_CARD_H = 172;
/** Gear cards carry their passive text, so they run taller than a hero's. */
const ARTIFACT_CARD_H = 200;
const HINT_Y = 432;
const TABS_Y = 196;
const BUTTON_Y = 500;
const SEAT_PORTRAIT_SCALE = 1.5;
/** Atlas canvases vary; clamp so the tall units keep the rows even. */
const SEAT_PORTRAIT_MAX_H = 130;
const CARD_DEPTH = 10;
/** Equipped-gear badge on a seat: small, up and left of the portrait's feet. */
const SEAT_BADGE = { size: 34, dx: 46, dy: 30 };
const GEAR_ACCENT = 0xffd76b;

/** The two things a card can carry. Only a hero has a role — that is the whole test. */
const isHero = (offer: HeroDef | ArtifactDef): offer is HeroDef => 'role' in offer;

/**
 * Between-stage screen, run twice per cleared boss: `offer` hands out one free recruit,
 * then `shop` sells bodies and gear out of the stage's purse, one tab each. Everything
 * works the same way — drag a card onto a seat and it lands there: a hero replaces the
 * occupant, an artifact straps onto it, one per character.
 */
export class InterludeScene extends Phaser.Scene {
  private run!: RunState;
  private phase!: InterludePhase;
  private offers: HeroDef[] = [];
  private gearOffers: ArtifactDef[] = [];
  private passed: HeroDef[] = [];
  private taken = new Set<string>();
  private tab: ShopTab = 'heroes';

  private drag!: SeatDragController<HeroDef | ArtifactDef>;
  private inspector!: HeroInspector;
  private tabs?: TabBarHandle;
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
    this.tab = 'heroes';
    this.cards = [];
    this.seatObjects = [];

    const cx = GAME_WIDTH / 2;
    drawSceneBackground(this);

    this.offers = this.phase === 'offer'
      ? rollRecruitOffers(OFFER_COUNT, this.run.seatArray())
      : rollShopOffers(OFFER_COUNT, this.run.seatArray(), this.passed);
    this.gearOffers = this.phase === 'shop'
      ? rollArtifactOffers(OFFER_COUNT, this.run.ownedArtifactIds())
      : [];

    sceneLabel(this, cx, 70, `STAGE ${this.run.stage} CLEARED`, 40, '#ffd76b', 'bold');
    sceneLabel(
      this, cx, 118,
      this.phase === 'offer' ? 'RECRUIT ONE — FREE' : 'SHOP',
      24, '#9aa3b8', 'bold',
    );
    if (this.phase === 'shop') {
      this.goldText = sceneLabel(this, cx, 156, `${this.run.gold}G`, 26, '#ffd76b', 'bold');
      this.tabs = createTabBar(
        this, cx, TABS_Y, TAB_LABELS, 0, i => this.selectTab(SHOP_TABS[i]), 180, CARD_DEPTH,
      );
      sceneLabel(this, cx, HINT_Y, 'Drag a card onto a seat.', 18, '#f3e6c8');
    } else {
      sceneLabel(this, cx, 190, 'Drag a hero onto a seat of its row.', 18, '#f3e6c8');
    }

    this.inspector = new HeroInspector(this);
    this.drag = new SeatDragController(this, (payload, seat) => this.onDrop(payload, seat));

    this.drawSeats();
    this.drawCards();

    createButton(this, cx, BUTTON_Y, 'NEXT', () => this.next(), 20);
  }

  private selectTab(tab: ShopTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.tabs?.select(SHOP_TABS.indexOf(tab));
    this.drag.cancel();
    this.inspector.cancel();
    this.drawCards();
  }

  /** The party as it stands — portraits on their battlefield slots, drag targets and all. */
  private drawSeats(): void {
    for (const o of this.seatObjects) o.destroy();
    this.seatObjects = [];

    for (const { def, seat, slot } of this.run.placed()) {
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

      // What this character already wears — a full press on the seat spells it out.
      const worn = this.run.artifactAt(seat);
      if (worn) {
        this.seatObjects.push(
          createArtifactIcon(
            this, worn, slot.x + SEAT_BADGE.dx, slot.y + SEAT_BADGE.dy, SEAT_BADGE.size,
          ).setDepth(3),
        );
      }
    }
    // Probes carry the def they were made with, so they rebuild with the seats.
    this.seatObjects.push(...this.inspector.addProbes(this.run.seatArray()));
  }

  private drawCards(): void {
    for (const card of this.cards) card.destroy();
    this.cards = [];

    const offers: (HeroDef | ArtifactDef)[] =
      this.phase === 'shop' && this.tab === 'artifacts' ? this.gearOffers : this.offers;
    const span = OFFER_COUNT * CARD.w + (OFFER_COUNT - 1) * CARD.gap;
    let x = GAME_WIDTH / 2 - span / 2 + CARD.w / 2;

    for (const offer of offers) {
      if (this.taken.has(offer.id)) {
        x += CARD.w + CARD.gap;
        continue;
      }
      const price = this.phase === 'shop' ? SHOP_PRICE[offer.rarity] : undefined;
      const locked = price !== undefined && !this.run.canAfford(price);
      // `x` advances with the loop — pin it so every card opens its tooltip on itself.
      const cardX = x;
      this.cards.push(this.drawCard(offer, cardX, { price, locked }));
      x += CARD.w + CARD.gap;
    }
  }

  /** One offer card, hero or gear, wired for its own drag and its own inspect press. */
  private drawCard(
    offer: HeroDef | ArtifactDef,
    x: number,
    opts: { price?: number; locked: boolean },
  ): Phaser.GameObjects.Container {
    const hero = isHero(offer) ? offer : undefined;
    const card = hero
      ? createHeroCard(this, x, CARD.y, CARD.w, HERO_CARD_H, hero, opts, CARD_DEPTH)
      : createArtifactCard(this, x, CARD.y, CARD.w, ARTIFACT_CARD_H, offer as ArtifactDef, opts, CARD_DEPTH);

    if (!opts.locked) {
      // Gear fits any character, so every seat lights up; a hero only takes its own row.
      const seats = hero ? this.run.seatsForRole(hero.role) : [...Array(SEAT_COUNT).keys()];
      this.drag.register(card, offer, seats, hero ? ROLE_COLOR[hero.role] : GEAR_ACCENT);
    }
    // A hold that never travels opens the stats card instead of starting a drag. Gear
    // prints its own text on the card, so only heroes have anything more to show.
    if (hero) {
      card.on(
        Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,
        () => this.inspector.press(hero, x, CARD.y),
      );
    }
    return card;
  }

  /** A card landed on a legal seat: pay for it if it is priced, then put it there. */
  private onDrop(offer: HeroDef | ArtifactDef, seat: number): void {
    const price = this.phase === 'shop' ? SHOP_PRICE[offer.rarity] : 0;
    if (price > 0 && !this.run.canAfford(price)) return;

    const placed = isHero(offer)
      ? this.run.replaceSeat(seat, offer)
      : this.run.equip(seat, offer);
    if (!placed) return;
    if (price > 0) this.run.spend(price);

    this.taken.add(offer.id);
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
