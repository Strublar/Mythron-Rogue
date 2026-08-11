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

export interface StatRow {
  label: string;
  value: string;
  color: string;
}

/**
 * The eight numbers a hero fights with, in tooltip reading order — the card lays them out
 * two per row, so the pairs below sit side by side (health/attack, regen/speed, …).
 */
export function heroStatRows(hero: HeroDef): StatRow[] {
  return [
    { label: 'HEALTH', value: hero.maxHp.toLocaleString(), color: STAT_COLOR.hp },
    { label: hero.role === 'heal' ? 'HEAL' : 'ATTACK', value: `${hero.attack}`, color: STAT_COLOR.attack },
    { label: 'HP REGEN', value: `${hero.hpRegen}/s`, color: STAT_COLOR.hpRegen },
    { label: 'ATK SPEED', value: `${(1000 / hero.attackIntervalMs).toFixed(2)}/s`, color: STAT_COLOR.attackSpeed },
    // Armor reads as the mitigation it buys — the raw number alone means nothing.
    { label: 'ARMOR', value: `${hero.armor} (${Math.round(damageReduction(hero.armor) * 100)}%)`, color: STAT_COLOR.armor },
    { label: 'POWER', value: `${hero.power}`, color: STAT_COLOR.power },
    { label: 'CRIT', value: `${hero.critChance}%`, color: STAT_COLOR.crit },
    { label: 'MANA REGEN', value: `${hero.manaRegen}/s`, color: STAT_COLOR.mana },
  ];
}
