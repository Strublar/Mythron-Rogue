import type { BoonDef, BoonEffect, BoonScope, HeroDef, HeroRole } from '../types';
import { grow, haste } from './statMath';

export const SCOPE_LABEL: Record<BoonScope, string> = {
  tank: 'Tanks',
  dps: 'DPS',
  heal: 'Healers',
  party: 'Whole party',
};

const EFFECT_LABEL: Record<keyof BoonEffect, string> = {
  maxHpPct: 'max HP',
  attackPct: 'attack power',
  attackSpeedPct: 'attack speed',
  abilityPowerPct: 'ability power',
  cooldownPct: 'ability haste',
};

export const BOON_POOL: BoonDef[] = [
  { id: 'ironhide', name: 'Ironhide', scope: 'tank', effect: { maxHpPct: 25 } },
  { id: 'vanguard_oath', name: 'Vanguard Oath', scope: 'tank', effect: { abilityPowerPct: 30 } },
  { id: 'whetstone', name: 'Whetstone', scope: 'dps', effect: { attackPct: 20 } },
  { id: 'swift_blades', name: 'Swift Blades', scope: 'dps', effect: { attackSpeedPct: 18 } },
  { id: 'stoneskin', name: 'Stoneskin', scope: 'dps', effect: { maxHpPct: 25 } },
  { id: 'verdant_grace', name: 'Verdant Grace', scope: 'heal', effect: { attackPct: 25 } },
  { id: 'lifebloom', name: 'Lifebloom', scope: 'heal', effect: { abilityPowerPct: 30 } },
  { id: 'aegis', name: 'Aegis', scope: 'party', effect: { maxHpPct: 12 } },
  { id: 'warcry', name: 'Warcry', scope: 'party', effect: { attackPct: 10 } },
  { id: 'bloodfrenzy', name: 'Bloodfrenzy', scope: 'party', effect: { attackSpeedPct: 12 } },
  { id: 'arcane_focus', name: 'Arcane Focus', scope: 'party', effect: { cooldownPct: 15 } },
  { id: 'titans_grip', name: "Titan's Grip", scope: 'party', effect: { abilityPowerPct: 18 } },
];

/** One-line effect text, built from the numeric fields — no hardcoded copy. */
export function boonText(b: BoonDef): string {
  const parts = (Object.keys(EFFECT_LABEL) as (keyof BoonEffect)[])
    .filter(k => b.effect[k])
    .map(k => `+${b.effect[k]}% ${k === 'attackPct' && b.scope === 'heal' ? 'healing' : EFFECT_LABEL[k]}`);
  return `${SCOPE_LABEL[b.scope]}: ${parts.join(', ')}`;
}

/** `count` distinct offers drawn from the pool. Boons already owned can roll again. */
export function rollBoons(count: number): BoonDef[] {
  const pool = [...BOON_POOL];
  const offers: BoonDef[] = [];
  while (offers.length < count && pool.length > 0) {
    offers.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return offers;
}

/** Does this boon's scope cover `role`? Drives both the maths and the offer highlight. */
export function boonAffects(b: BoonDef, role: HeroRole): boolean {
  return b.scope === 'party' || b.scope === role;
}

/** Percent total of one effect across every owned boon that covers `role`. */
function sumPct(boons: BoonDef[], role: HeroRole, key: keyof BoonEffect): number {
  return boons.reduce(
    (total, b) => (boonAffects(b, role) ? total + (b.effect[key] ?? 0) : total),
    0,
  );
}

/** Derives the buffed roster. Never mutates the base defs — returns fresh objects. */
export function applyBoons(party: HeroDef[], boons: BoonDef[]): HeroDef[] {
  if (boons.length === 0) return party;
  return party.map(def => {
    const pct = (key: keyof BoonEffect): number => sumPct(boons, def.role, key);
    const power = pct('abilityPowerPct');
    const a = def.ability;
    return {
      ...def,
      maxHp: grow(def.maxHp, pct('maxHpPct')),
      attack: grow(def.attack, pct('attackPct')),
      attackIntervalMs: haste(def.attackIntervalMs, pct('attackSpeedPct')),
      ability: {
        ...a,
        cooldownMs: haste(a.cooldownMs, pct('cooldownPct')),
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
  });
}
