// Renders the player's hand as tappable cards in the bottom bar.
// Mobile-first: full-card touch targets, auto-fanning when the hand is wide,
// selected card lifts up, unaffordable cards dimmed. Emits taps via onCardTap.

import Phaser from 'phaser';
import { CardInstance, CardDefinition } from '../types';
import { getCardDef } from '../engine/CardDatabase';

export interface HandZone {
  /** Left edge of the area cards may occupy */
  x: number;
  /** Right edge of the area cards may occupy */
  right: number;
  /** Vertical center for cards */
  y: number;
  depth: number;
}

const CARD_W = 54;
const CARD_H = 74;
const GAP = 8;

export class HandRenderer {
  private scene: Phaser.Scene;
  private onCardTap: (instanceId: string) => void;
  private cards: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, onCardTap: (instanceId: string) => void) {
    this.scene = scene;
    this.onCardTap = onCardTap;
  }

  render(hand: CardInstance[], mana: number, selectedId: string | null, zone: HandZone): void {
    this.clear();
    if (hand.length === 0) return;

    const avail = zone.right - zone.x;
    // Fan/overlap cards so they always fit the zone.
    const step = Math.min(CARD_W + GAP, hand.length > 1 ? (avail - CARD_W) / (hand.length - 1) : 0);
    const totalW = CARD_W + step * (hand.length - 1);
    const startX = zone.x + Math.max(0, (avail - totalW) / 2) + CARD_W / 2;

    hand.forEach((inst, i) => {
      const def = getCardDef(inst.definitionId);
      if (!def) return;
      const affordable = def.manaCost <= mana;
      const selected = inst.instanceId === selectedId;
      const cx = startX + i * step;
      const cy = zone.y - (selected ? 12 : 0);
      this.cards.push(this.buildCard(def, cx, cy, zone.depth + i, affordable, selected, inst.instanceId));
    });
  }

  private buildCard(
    def: CardDefinition,
    cx: number,
    cy: number,
    depth: number,
    affordable: boolean,
    selected: boolean,
    instanceId: string,
  ): Phaser.GameObjects.Container {
    const s = this.scene;
    const bgKey = affordable ? 'card_background' : 'card_background_disabled';
    const bg = s.add.image(0, 0, s.textures.exists(bgKey) ? bgKey : 'card_background')
      .setDisplaySize(CARD_W, CARD_H);
    if (selected) bg.setTint(0x99ddff);

    const name = s.add.text(0, -CARD_H / 2 + 20, def.name, {
      fontSize: '7px', color: '#ffffff', fontFamily: 'monospace',
      align: 'center', wordWrap: { width: CARD_W - 8 },
    }).setOrigin(0.5, 0);

    const desc = s.add.text(0, CARD_H / 2 - 22, def.description, {
      fontSize: '6px', color: '#cdd1e0', fontFamily: 'monospace',
      align: 'center', wordWrap: { width: CARD_W - 8 },
    }).setOrigin(0.5, 0);

    // Mana cost badge (top-left)
    const badge = s.add.circle(-CARD_W / 2 + 8, -CARD_H / 2 + 8, 8, 0x1a3a8a)
      .setStrokeStyle(1, 0x7fb6ff);
    const cost = s.add.text(-CARD_W / 2 + 8, -CARD_H / 2 + 8, `${def.manaCost}`, {
      fontSize: '9px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = s.add.container(cx, cy, [bg, name, desc, badge, cost]).setDepth(depth);
    if (!affordable) container.setAlpha(0.6);

    // Full-card touch target (finger-friendly).
    container.setSize(CARD_W, CARD_H);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.onCardTap(instanceId);
    });
    return container;
  }

  clear(): void {
    for (const c of this.cards) c.destroy();
    this.cards = [];
  }
}
