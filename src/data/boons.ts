import type { BoonDef, BoonEffect, BoonScope, HeroDef, HeroTag } from '../types';
import { grow, haste } from './statMath';

export const SCOPE_LABEL: Record<BoonScope, string> = {
  tank: 'Tanks',
  dps: 'DPS',
  heal: 'Healers',
  party: 'Whole party',
  // Factions
  lyonar: 'Lyonar',
  songhai: 'Songhai',
  vetruvian: 'Vetruvian',
  abyssian: 'Abyssian',
  magmar: 'Magmar',
  vanar: 'Vanar',
  mercenary: 'Mercenaries',
  // Archetypes
  arcanyst: 'Arcanysts',
  blade: 'Blades',
  golem: 'Golems',
  beast: 'Beasts',
  blood: 'Bloodbound',
};

const EFFECT_LABEL: Record<keyof BoonEffect, string> = {
  maxHpPct: 'max HP',
  attackPct: 'attack power',
  attackSpeedPct: 'attack speed',
  abilityPowerPct: 'ability power',
  cooldownPct: 'ability haste',
};

/** Weight 'party' rolls with, so party-wide boons keep showing next to the tag rolls. */
const PARTY_WEIGHT = 3;

export const BOON_POOL: BoonDef[] = [
  // Role boons.
  { id: 'ironhide', name: 'Ironhide', scope: 'tank', effect: { maxHpPct: 25 } },
  { id: 'vanguard_oath', name: 'Vanguard Oath', scope: 'tank', effect: { abilityPowerPct: 30 } },
  { id: 'whetstone', name: 'Whetstone', scope: 'dps', effect: { attackPct: 20 } },
  { id: 'swift_blades', name: 'Swift Blades', scope: 'dps', effect: { attackSpeedPct: 18 } },
  { id: 'stoneskin', name: 'Stoneskin', scope: 'dps', effect: { maxHpPct: 25 } },
  { id: 'verdant_grace', name: 'Verdant Grace', scope: 'heal', effect: { attackPct: 25 } },
  { id: 'lifebloom', name: 'Lifebloom', scope: 'heal', effect: { abilityPowerPct: 30 } },

  // Party boons.
  { id: 'aegis', name: 'Aegis', scope: 'party', effect: { maxHpPct: 12 } },
  { id: 'warcry', name: 'Warcry', scope: 'party', effect: { attackPct: 10 } },
  { id: 'bloodfrenzy', name: 'Bloodfrenzy', scope: 'party', effect: { attackSpeedPct: 12 } },
  { id: 'arcane_focus', name: 'Arcane Focus', scope: 'party', effect: { cooldownPct: 15 } },
  { id: 'titans_grip', name: "Titan's Grip", scope: 'party', effect: { abilityPowerPct: 18 } },

  // Faction boons — the rarer the faction on the roster, the fatter its numbers.
  { id: 'sunsteel_faith', name: 'Sunsteel Faith', scope: 'lyonar', effect: { maxHpPct: 20, abilityPowerPct: 15 } },
  { id: 'divine_bond', name: 'Divine Bond', scope: 'lyonar', perMember: true, effect: { attackPct: 6 } },
  { id: 'mantra', name: 'Mantra', scope: 'songhai', effect: { abilityPowerPct: 55, cooldownPct: 25 } },
  { id: 'sand_sigil', name: 'Sand Sigil', scope: 'vetruvian', effect: { abilityPowerPct: 35 } },
  { id: 'obelysk_array', name: 'Obelysk Array', scope: 'vetruvian', perMember: true, effect: { maxHpPct: 9 } },
  { id: 'shadow_creep', name: 'Shadow Creep', scope: 'abyssian', effect: { attackPct: 45, attackSpeedPct: 20 } },
  { id: 'ancestral_fury', name: 'Ancestral Fury', scope: 'magmar', effect: { attackPct: 50, maxHpPct: 30 } },
  { id: 'winters_wake', name: "Winter's Wake", scope: 'vanar', effect: { abilityPowerPct: 45, cooldownPct: 30 } },
  { id: 'blood_money', name: 'Blood Money', scope: 'mercenary', perMember: true, effect: { attackPct: 5 } },
  { id: 'contract_bonus', name: 'Contract Bonus', scope: 'mercenary', effect: { attackSpeedPct: 15, cooldownPct: 12 } },

  // Archetype boons — one flat, one per-member, so stacking an archetype pays off.
  { id: 'spellweave', name: 'Spellweave', scope: 'arcanyst', effect: { abilityPowerPct: 30 } },
  { id: 'mana_vortex', name: 'Mana Vortex', scope: 'arcanyst', perMember: true, effect: { cooldownPct: 7 } },
  { id: 'whetted_edge', name: 'Whetted Edge', scope: 'blade', effect: { attackPct: 28 } },
  { id: 'bladedance', name: 'Bladedance', scope: 'blade', perMember: true, effect: { attackSpeedPct: 6 } },
  { id: 'living_stone', name: 'Living Stone', scope: 'golem', effect: { maxHpPct: 35 } },
  { id: 'forged_core', name: 'Forged Core', scope: 'golem', perMember: true, effect: { maxHpPct: 8 } },
  { id: 'feral_rage', name: 'Feral Rage', scope: 'beast', effect: { attackSpeedPct: 22 } },
  { id: 'pack_hunt', name: 'Pack Hunt', scope: 'beast', perMember: true, effect: { attackPct: 7 } },
  { id: 'crimson_pact', name: 'Crimson Pact', scope: 'blood', effect: { attackPct: 22, abilityPowerPct: 22 } },
  { id: 'blood_rite', name: 'Blood Rite', scope: 'blood', perMember: true, effect: { abilityPowerPct: 9 } },
];

/** Does this boon's scope cover `hero`? Drives the maths, the offer highlight and the rolls. */
export function boonAffects(b: BoonDef, hero: HeroDef): boolean {
  return b.scope === 'party' || b.scope === hero.role || hero.tags.includes(b.scope as HeroTag);
}

/** How many heroes of `party` the boon covers — the multiplier of a `perMember` boon. */
export function boonMembers(b: BoonDef, party: HeroDef[]): number {
  return party.filter(hero => boonAffects(b, hero)).length;
}

/** Percent an effect actually lands for, once `perMember` scaling is folded in. */
function effectPct(b: BoonDef, key: keyof BoonEffect, members: number): number {
  return (b.effect[key] ?? 0) * (b.perMember ? members : 1);
}

/**
 * One-line effect text, built from the numeric fields — no hardcoded copy.
 * Pass the party to resolve a `perMember` boon into its real total.
 */
export function boonText(b: BoonDef, party?: HeroDef[]): string {
  const members = b.perMember && party ? boonMembers(b, party) : 0;
  const parts = (Object.keys(EFFECT_LABEL) as (keyof BoonEffect)[])
    .filter(k => b.effect[k])
    .map(k => {
      const label = k === 'attackPct' && b.scope === 'heal' ? 'healing' : EFFECT_LABEL[k];
      return `+${effectPct(b, k, members || 1)}% ${label}`;
    });
  const tail = b.perMember
    ? members
      ? ` (×${members} in party)`
      : ` per ${SCOPE_LABEL[b.scope]} hero`
    : '';
  return `${SCOPE_LABEL[b.scope]}: ${parts.join(', ')}${tail}`;
}

/**
 * Every scope the party can draw, weighted by how many heroes carry it: role counts,
 * tag counts, plus a flat weight for party-wide boons. 4 Magmar to 2 Arcanysts means
 * twice the Magmar offers.
 */
export function scopeWeights(party: HeroDef[]): Map<BoonScope, number> {
  const weights = new Map<BoonScope, number>([['party', PARTY_WEIGHT]]);
  for (const hero of party) {
    for (const scope of [hero.role, ...hero.tags] as BoonScope[]) {
      weights.set(scope, (weights.get(scope) ?? 0) + 1);
    }
  }
  return weights;
}

function pickWeighted(weights: Map<BoonScope, number>): BoonScope | undefined {
  let total = 0;
  for (const weight of weights.values()) total += weight;
  if (total <= 0) return undefined;
  let roll = Math.random() * total;
  for (const [scope, weight] of weights) {
    roll -= weight;
    if (roll < 0) return scope;
  }
  return undefined;
}

/**
 * `count` distinct offers. Each slot rolls a scope weighted by the party's tags, then a
 * boon of that scope. Boons already owned can roll again; a scope with nothing left to
 * offer drops out of the draw.
 */
export function rollBoons(count: number, party: HeroDef[]): BoonDef[] {
  const weights = scopeWeights(party);
  const offers: BoonDef[] = [];
  const taken = new Set<string>();
  while (offers.length < count) {
    const scope = pickWeighted(weights);
    if (scope === undefined) break;
    const pool = BOON_POOL.filter(b => b.scope === scope && !taken.has(b.id));
    if (pool.length === 0) {
      weights.delete(scope);
      continue;
    }
    const boon = pool[Math.floor(Math.random() * pool.length)];
    taken.add(boon.id);
    offers.push(boon);
  }
  return offers;
}

/** Derives the buffed roster. Never mutates the base defs — returns fresh objects. */
export function applyBoons(party: HeroDef[], boons: BoonDef[]): HeroDef[] {
  if (boons.length === 0) return party;
  // Member counts come from the party, not the hero — one lookup per distinct boon.
  const members = new Map<string, number>();
  for (const b of boons) {
    if (b.perMember && !members.has(b.id)) members.set(b.id, boonMembers(b, party));
  }
  return party.map(def => {
    const pct = (key: keyof BoonEffect): number =>
      boons.reduce(
        (total, b) => (boonAffects(b, def) ? total + effectPct(b, key, members.get(b.id) ?? 0) : total),
        0,
      );
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
