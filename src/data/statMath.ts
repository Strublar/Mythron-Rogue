// Percent math shared by boons (permanent, baked into HeroDef) and buffs (temporary,
// applied at tick time). One formula, two callers — keep them in sync here.

import type { BoonEffect, HeroDef } from '../types';

export function grow(v: number, pct: number): number;
export function grow(v: number | undefined, pct: number): number | undefined;
export function grow(v: number | undefined, pct: number): number | undefined {
  return v === undefined ? undefined : Math.round(v * (1 + pct / 100));
}

/** Haste: a percent bonus shortens the interval instead of lengthening it. */
export function haste(ms: number, pct: number): number {
  return Math.round(ms / (1 + pct / 100));
}

/** A critical hit multiplies the damage or healing it lands on by this. */
export const CRIT_MULT = 1.5;

/** The power every ability payload is written at — a hero's `power` scales against it. */
export const BASE_POWER = 100;

/** Armor constant: `armor` points cut incoming damage by armor/(armor + K). */
const ARMOR_K = 100;

/** Fraction of a hit that armor eats, 0–1. What the tooltip prints next to ARMOR. */
export function damageReduction(armor: number): number {
  return Math.max(0, armor) / (ARMOR_K + Math.max(0, armor));
}

/** Incoming damage once armor has taken its cut. Always leaves at least a scratch. */
export function mitigate(amount: number, armor: number): number {
  return Math.max(1, Math.round(amount * (1 - damageReduction(armor))));
}

/** An ability payload, written at BASE_POWER, scaled by the caster's power. */
export function scaleByPower(amount: number, power: number): number;
export function scaleByPower(amount: number | undefined, power: number): number | undefined;
export function scaleByPower(amount: number | undefined, power: number): number | undefined {
  return amount === undefined ? undefined : Math.round((amount * power) / BASE_POWER);
}

/**
 * Applies one collapsed `BoonEffect` to a def, ability payloads included. The single
 * place stat percentages meet a hero: boons collapse their stacks into one effect,
 * progression collapses its per-level growth into another. Never mutates `def`.
 */
export function growHero(def: HeroDef, e: BoonEffect): HeroDef {
  const a = def.ability;
  return {
    ...def,
    maxHp: grow(def.maxHp, e.maxHpPct ?? 0),
    hpRegen: grow(def.hpRegen, e.hpRegenPct ?? 0),
    armor: grow(def.armor, e.armorPct ?? 0),
    attack: grow(def.attack, e.attackPct ?? 0),
    attackIntervalMs: haste(def.attackIntervalMs, e.attackSpeedPct ?? 0),
    // Ability payloads are written at power 100 — growing `power` grows every one of
    // them at cast time, so the numbers live in exactly one place.
    power: grow(def.power, e.abilityPowerPct ?? 0),
    critChance: Math.min(100, grow(def.critChance, e.critChancePct ?? 0)),
    manaRegen: grow(def.manaRegen, e.manaRegenPct ?? 0),
    ability: { ...a, manaCost: haste(a.manaCost, e.manaCostPct ?? 0) },
  };
}

/** Every percentage of an effect multiplied by `factor` — one level's growth, times levels. */
export function scaleEffect(e: BoonEffect, factor: number): BoonEffect {
  const out: BoonEffect = {};
  for (const [key, pct] of Object.entries(e) as [keyof BoonEffect, number][]) {
    out[key] = pct * factor;
  }
  return out;
}
