// Shared card-face composition (Duelyst CardNode): frame + rarity strip + name +
// description + mana gem + (unit) atk/hp stat gems. Used by the hand and by the
// on-board hover tooltip so both render an identical card. Returns the visual
// parts; callers wrap them in a container and add interactivity/selection.

import Phaser from 'phaser';
import { CardDefinition, CardRarity } from '../types';

// Duelyst CONFIG colors.
const ATK_COLOR = '#fbfe00';
const HP_COLOR = '#fc0002';
const DESC_COLOR = '#90cacf'; // rgb(144,202,207)

const FRAME_KEY: Record<CardDefinition['type'], string> = {
  unit: 'card_frame_unit',
  spell: 'card_frame_spell',
  artifact: 'card_frame_artifact',
};

/** Floored, scaled font-size string so card text stays legible on mobile. */
function fs(px: number, scale: number): string {
  return `${Math.max(6, Math.round(px * scale))}px`;
}

/** Card width for a given height, preserving the frame texture's native aspect. */
export function cardAspect(scene: Phaser.Scene): number {
  const tex = scene.textures.exists('card_frame_unit')
    ? scene.textures.get('card_frame_unit').getSourceImage()
    : null;
  return tex && tex.height ? tex.width / tex.height : 0.72;
}

/** Live stats to display instead of the card's base stats (board hover). */
export interface CardStatOverride {
  attack: number;
  hp: number;
}

/** Builds the card visual parts, centered on (0,0). */
export function buildCardFace(
  scene: Phaser.Scene,
  def: CardDefinition,
  cardW: number,
  cardH: number,
  sc: number,
  statsOverride?: CardStatOverride,
): Phaser.GameObjects.GameObject[] {
  const s = scene;
  const parts: Phaser.GameObjects.GameObject[] = [];
  const pad = 6 * sc;

  // Card frame (neutral, by type) — anchor the whole composition.
  const frameKey = FRAME_KEY[def.type];
  parts.push(
    s.add.image(0, 0, s.textures.exists(frameKey) ? frameKey : 'card_background')
      .setDisplaySize(cardW, cardH),
  );

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
    const atk = statsOverride?.attack ?? st.attack;
    const hp = statsOverride?.hp ?? st.maxHp;
    const gs = cardW * 0.32;
    const by = cardH / 2 - gs * 0.5 - pad * 0.4;
    addStat(s, parts, 'stats_atk_bg', -cardW / 2 + gs * 0.5 + pad * 0.4, by, gs, `${atk}`, ATK_COLOR, sc);
    addStat(s, parts, 'stats_hp_bg', cardW / 2 - gs * 0.5 - pad * 0.4, by, gs, `${hp}`, HP_COLOR, sc);
  }

  return parts;
}

function addStat(
  s: Phaser.Scene,
  parts: Phaser.GameObjects.GameObject[],
  key: string, x: number, y: number, size: number, value: string, color: string, sc: number,
): void {
  if (s.textures.exists(key)) parts.push(s.add.image(x, y, key).setDisplaySize(size, size));
  parts.push(
    s.add.text(x, y, value, {
      fontSize: fs(10, sc), color, fontFamily: 'Lato', fontStyle: 'bold',
    }).setOrigin(0.5),
  );
}
