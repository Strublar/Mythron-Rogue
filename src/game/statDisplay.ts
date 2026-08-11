import Phaser from 'phaser';
import type { HeroDef } from '../types';
import { damageReduction } from '../data/statMath';

/**
 * One hue per stat, Teamfight-Tactics style: the colour *is* the label, so a glance at a
 * tooltip reads as green hp / orange attack / violet power. Every surface that prints a
 * stat pulls its colour from here.
 */
export const STAT_COLOR = {
  hp: '#6ee07a',
  hpRegen: '#a5f0b5',
  armor: '#e8c76a',
  attack: '#ff8a5c',
  attackSpeed: '#ffe08a',
  power: '#b088ff',
  crit: '#ff6b8a',
  mana: '#4fb8ff',
} as const;

/** The glyph a stat is drawn with — no text label, so each one has to read on its own. */
export type StatIcon =
  | 'heart' | 'arrowUp' | 'shield' | 'sword' | 'cross' | 'bolt' | 'sparkle' | 'burst' | 'drop';

export interface StatRow {
  icon: StatIcon;
  value: string;
  color: string;
}

/**
 * The eight numbers a hero fights with, in tooltip reading order — the card lays them out
 * two per row, so the pairs below sit side by side (health/attack, regen/speed, …).
 */
export function heroStatRows(hero: HeroDef): StatRow[] {
  const isHealer = hero.role === 'heal';
  return [
    { icon: 'heart', value: hero.maxHp.toLocaleString(), color: STAT_COLOR.hp },
    // A healer's `attack` is the auto-heal it lands, so it takes the heal glyph.
    { icon: isHealer ? 'cross' : 'sword', value: `${hero.attack}`, color: STAT_COLOR.attack },
    { icon: 'arrowUp', value: `${hero.hpRegen}/s`, color: STAT_COLOR.hpRegen },
    { icon: 'bolt', value: `${(1000 / hero.attackIntervalMs).toFixed(2)}/s`, color: STAT_COLOR.attackSpeed },
    // Armor reads as the mitigation it buys — the raw number alone means nothing.
    { icon: 'shield', value: `${hero.armor} (${Math.round(damageReduction(hero.armor) * 100)}%)`, color: STAT_COLOR.armor },
    { icon: 'sparkle', value: `${hero.power}`, color: STAT_COLOR.power },
    { icon: 'burst', value: `${hero.critChance}%`, color: STAT_COLOR.crit },
    { icon: 'drop', value: `${hero.manaRegen}/s`, color: STAT_COLOR.mana },
  ];
}

/** Unit-square outlines, scaled and centred at draw time. */
type Pt = [number, number];
const OUTLINE: Record<StatIcon, Pt[][]> = {
  heart: [[[-0.5, -0.12], [-0.25, -0.42], [0, -0.2], [0.25, -0.42], [0.5, -0.12], [0, 0.5]]],
  arrowUp: [
    [[0, -0.5], [0.4, -0.05], [-0.4, -0.05]],
    [[-0.15, -0.08], [0.15, -0.08], [0.15, 0.46], [-0.15, 0.46]],
  ],
  shield: [[[-0.42, -0.44], [0.42, -0.44], [0.42, 0.06], [0, 0.5], [-0.42, 0.06]]],
  sword: [
    [[0, -0.5], [0.15, -0.25], [0.15, 0.16], [-0.15, 0.16], [-0.15, -0.25]],
    [[-0.36, 0.16], [0.36, 0.16], [0.36, 0.28], [-0.36, 0.28]],
    [[-0.09, 0.28], [0.09, 0.28], [0.09, 0.5], [-0.09, 0.5]],
  ],
  cross: [
    [[-0.15, -0.46], [0.15, -0.46], [0.15, 0.46], [-0.15, 0.46]],
    [[-0.46, -0.15], [0.46, -0.15], [0.46, 0.15], [-0.46, 0.15]],
  ],
  bolt: [[[0.08, -0.5], [-0.34, 0.06], [-0.04, 0.06], [-0.12, 0.5], [0.34, -0.08], [0.02, -0.08]]],
  sparkle: [[[0, -0.5], [0.15, -0.15], [0.5, 0], [0.15, 0.15], [0, 0.5], [-0.15, 0.15], [-0.5, 0], [-0.15, -0.15]]],
  burst: [star(8, 0.5, 0.22)],
  drop: [[[0, -0.5], [0.32, 0.06], [0.2, 0.38], [-0.2, 0.38], [-0.32, 0.06]]],
};

/** Alternating spike/valley ring — the crit starburst. */
function star(spikes: number, outer: number, inner: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/**
 * One stat glyph, `size` px across, centred on (x, y) and filled in the stat's own colour.
 * Graphics rather than an image: the icons have to take an arbitrary tint, and the shapes
 * are simple enough that a texture would only add a preload.
 */
export function drawStatIcon(
  scene: Phaser.Scene, icon: StatIcon, x: number, y: number, size: number, color: string,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
  for (const shape of OUTLINE[icon]) {
    g.fillPoints(shape.map(([px, py]) => new Phaser.Geom.Point(px * size, py * size)), true, true);
  }
  return g;
}
