// Renders the player's hand as tappable cards in the bottom bar.
// Composition mirrors Duelyst's CardNode: a neutral card frame per card type,
// a rarity strip, mana gem, and (for units) atk/hp stat gems, plus name +
// description text in Lato. Mobile-first: full-card touch targets, auto-fanning
// when the hand is wide, selected card lifts up, unaffordable cards dimmed.

import Phaser from 'phaser';
import { CardInstance, CardDefinition, CardRarity } from '../types';
import { getCardDef } from '../engine/CardDatabase';

export interface HandZone {
  /** Left edge of the area cards may occupy */
  x: number;
  /** Right edge of the area cards may occupy */
  right: number;
  /** Vertical center for cards */
  y: number;
  depth: number;
  /** UI scale factor (mobile). Cards + text scale with this. */
  scale: number;
}

// Target card height (unscaled); width derives from the frame's native aspect.
const CARD_H = 84;
const GAP = 8;
// Duelyst CONFIG colors.
const ATK_COLOR = '#fbfe00';
const HP_COLOR = '#fc0002';
const DESC_COLOR = '#90cacf'; // rgb(144,202,207)

/** Floored, scaled font-size string so card text stays legible on mobile. */
function fs(px: number, scale: number): string {
  return `${Math.max(6, Math.round(px * scale))}px`;
}

const FRAME_KEY: Record<CardDefinition['type'], string> = {
  unit: 'card_frame_unit',
  spell: 'card_frame_spell',
  artifact: 'card_frame_artifact',
};

export class HandRenderer {
  private scene: Phaser.Scene;
  private onCardTap: (instanceId: string) => void;
  private cards: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, onCardTap: (instanceId: string) => void) {
    this.scene = scene;
    this.onCardTap = onCardTap;
  }

  /** Card width for a given height, preserving the frame texture's native aspect. */
  private cardAspect(): number {
    const tex = this.scene.textures.exists('card_frame_unit')
      ? this.scene.textures.get('card_frame_unit').getSourceImage()
      : null;
    return tex && tex.height ? tex.width / tex.height : 0.72;
  }

  render(hand: CardInstance[], mana: number, selectedId: string | null, zone: HandZone): void {
    this.clear();
    if (hand.length === 0) return;

    const sc = zone.scale;
    const cardH = CARD_H * sc;
    const cardW = cardH * this.cardAspect();
    const gap = GAP * sc;
    const avail = zone.right - zone.x;
    // Fan/overlap cards so they always fit the zone.
    const step = Math.min(cardW + gap, hand.length > 1 ? (avail - cardW) / (hand.length - 1) : 0);
    const totalW = cardW + step * (hand.length - 1);
    const startX = zone.x + Math.max(0, (avail - totalW) / 2) + cardW / 2;

    hand.forEach((inst, i) => {
      const def = getCardDef(inst.definitionId);
      if (!def) return;
      const affordable = def.manaCost <= mana;
      const selected = inst.instanceId === selectedId;
      const cx = startX + i * step;
      const cy = zone.y - (selected ? 12 * sc : 0);
      this.cards.push(
        this.buildCard(def, cx, cy, cardW, cardH, zone.depth + i, affordable, selected, inst.instanceId, sc),
      );
    });
  }

  private buildCard(
    def: CardDefinition,
    cx: number,
    cy: number,
    cardW: number,
    cardH: number,
    depth: number,
    affordable: boolean,
    selected: boolean,
    instanceId: string,
    sc: number,
  ): Phaser.GameObjects.Container {
    const s = this.scene;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const pad = 6 * sc;

    // Card frame (neutral, by type) — anchor the whole composition.
    const frameKey = FRAME_KEY[def.type];
    const bg = s.add.image(0, 0, s.textures.exists(frameKey) ? frameKey : 'card_background')
      .setDisplaySize(cardW, cardH);
    if (selected) bg.setTint(0x99ddff);
    parts.push(bg);

    // Rarity strip just under the name.
    const rarityKey = `rarity_${def.rarity ?? 'common'}` as `rarity_${CardRarity}`;
    if (s.textures.exists(rarityKey)) {
      const src = s.textures.get(rarityKey).getSourceImage();
      const rw = cardW * 0.5;
      const rh = src.height ? rw * (src.height / src.width) : 6 * sc;
      parts.push(s.add.image(0, -cardH * 0.30, rarityKey).setDisplaySize(rw, rh));
    }

    // Name (Lato bold, white) near the top.
    parts.push(
      s.add.text(0, -cardH / 2 + 8 * sc, def.name, {
        fontSize: fs(8, sc), color: '#ffffff', fontFamily: 'Lato', fontStyle: 'bold',
        align: 'center', wordWrap: { width: cardW - pad * 2 },
      }).setOrigin(0.5, 0),
    );

    // Description (Duelyst cyan) in the middle-lower body.
    parts.push(
      s.add.text(0, cardH * 0.04, def.description, {
        fontSize: fs(7, sc), color: DESC_COLOR, fontFamily: 'Lato',
        align: 'center', wordWrap: { width: cardW - pad * 2 },
      }).setOrigin(0.5, 0),
    );

    // Mana gem (top-left) + cost.
    const gem = cardW * 0.34;
    const gx = -cardW / 2 + gem * 0.5 + pad * 0.5;
    const gy = -cardH / 2 + gem * 0.5 + pad * 0.5;
    if (s.textures.exists('icon_mana')) {
      parts.push(s.add.image(gx, gy, 'icon_mana').setDisplaySize(gem, gem));
    }
    parts.push(
      s.add.text(gx, gy, `${def.manaCost}`, {
        fontSize: fs(11, sc), color: '#ffffff', fontFamily: 'Lato', fontStyle: 'bold',
      }).setOrigin(0.5),
    );

    // Unit stat gems: attack (bottom-left) + health (bottom-right).
    if (def.type === 'unit' && def.effect.kind === 'summon') {
      const st = def.effect.stats;
      const gs = cardW * 0.32;
      const by = cardH / 2 - gs * 0.5 - pad * 0.4;
      this.addStat(parts, 'stats_atk_bg', -cardW / 2 + gs * 0.5 + pad * 0.4, by, gs, `${st.attack}`, ATK_COLOR, sc);
      this.addStat(parts, 'stats_hp_bg', cardW / 2 - gs * 0.5 - pad * 0.4, by, gs, `${st.maxHp}`, HP_COLOR, sc);
    }

    const container = s.add.container(cx, cy, parts).setDepth(depth);
    if (!affordable) container.setAlpha(0.6);

    // Full-card touch target (finger-friendly).
    container.setSize(cardW, cardH);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.onCardTap(instanceId);
    });
    return container;
  }

  private addStat(
    parts: Phaser.GameObjects.GameObject[],
    key: string, x: number, y: number, size: number, value: string, color: string, sc: number,
  ): void {
    const s = this.scene;
    if (s.textures.exists(key)) parts.push(s.add.image(x, y, key).setDisplaySize(size, size));
    parts.push(
      s.add.text(x, y, value, {
        fontSize: fs(10, sc), color, fontFamily: 'Lato', fontStyle: 'bold',
      }).setOrigin(0.5),
    );
  }

  clear(): void {
    for (const c of this.cards) c.destroy();
    this.cards = [];
  }
}
