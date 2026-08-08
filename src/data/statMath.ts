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

/**
 * Applies one collapsed `BoonEffect` to a def, ability payloads included. The single
 * place stat percentages meet a hero: boons collapse their stacks into one effect,
 * progression collapses its per-level growth into another. Never mutates `def`.
 */
export function growHero(def: HeroDef, e: BoonEffect): HeroDef {
  const power = e.abilityPowerPct ?? 0;
  const a = def.ability;
  return {
    ...def,
    maxHp: grow(def.maxHp, e.maxHpPct ?? 0),
    attack: grow(def.attack, e.attackPct ?? 0),
    attackIntervalMs: haste(def.attackIntervalMs, e.attackSpeedPct ?? 0),
    ability: {
      ...a,
      cooldownMs: haste(a.cooldownMs, e.cooldownPct ?? 0),
      damage: grow(a.damage, power),
      heal: grow(a.heal, power),
      selfShield: grow(a.selfShield, power),
      allyShield: grow(a.allyShield, power),
      partyHeal: grow(a.partyHeal, power),
      selfHeal: grow(a.selfHeal, power),
      executeBonus: grow(a.executeBonus, power),
      dot: a.dot && { ...a.dot, damage: grow(a.dot.damage, power) },
    },
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
