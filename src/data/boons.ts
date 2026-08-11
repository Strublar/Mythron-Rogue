import type {
  BoonAction, BoonDef, BoonEffect, BoonScope, BoonTargetKind, BoonTrigger, HeroDef, HeroTag,
} from '../types';
import { growHero } from './statMath';

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
  hpRegenPct: 'HP regen',
  armorPct: 'armor',
  attackPct: 'attack power',
  attackSpeedPct: 'attack speed',
  abilityPowerPct: 'ability power',
  critChancePct: 'critical chance',
  manaRegenPct: 'mana regen',
  manaCostPct: 'mana efficiency',
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
  { id: 'arcane_focus', name: 'Arcane Focus', scope: 'party', effect: { manaCostPct: 15 } },
  { id: 'titans_grip', name: "Titan's Grip", scope: 'party', effect: { abilityPowerPct: 18 } },

  // Faction boons — the rarer the faction on the roster, the fatter its numbers.
  { id: 'sunsteel_faith', name: 'Sunsteel Faith', scope: 'lyonar', effect: { maxHpPct: 20, abilityPowerPct: 15 } },
  { id: 'divine_bond', name: 'Divine Bond', scope: 'lyonar', perMember: true, effect: { attackPct: 6 } },
  { id: 'mantra', name: 'Mantra', scope: 'songhai', effect: { abilityPowerPct: 55, manaCostPct: 25 } },
  { id: 'sand_sigil', name: 'Sand Sigil', scope: 'vetruvian', effect: { abilityPowerPct: 35 } },
  { id: 'obelysk_array', name: 'Obelysk Array', scope: 'vetruvian', perMember: true, effect: { maxHpPct: 9 } },
  { id: 'shadow_creep', name: 'Shadow Creep', scope: 'abyssian', effect: { attackPct: 45, attackSpeedPct: 20 } },
  { id: 'ancestral_fury', name: 'Ancestral Fury', scope: 'magmar', effect: { attackPct: 50, maxHpPct: 30 } },
  { id: 'winters_wake', name: "Winter's Wake", scope: 'vanar', effect: { abilityPowerPct: 45, manaCostPct: 30 } },
  { id: 'blood_money', name: 'Blood Money', scope: 'mercenary', perMember: true, effect: { attackPct: 5 } },
  { id: 'contract_bonus', name: 'Contract Bonus', scope: 'mercenary', effect: { attackSpeedPct: 15, manaCostPct: 12 } },

  // Archetype boons — one flat, one per-member, so stacking an archetype pays off.
  { id: 'spellweave', name: 'Spellweave', scope: 'arcanyst', effect: { abilityPowerPct: 30 } },
  { id: 'mana_vortex', name: 'Mana Vortex', scope: 'arcanyst', perMember: true, effect: { manaCostPct: 7 } },
  { id: 'whetted_edge', name: 'Whetted Edge', scope: 'blade', effect: { attackPct: 28 } },
  { id: 'bladedance', name: 'Bladedance', scope: 'blade', perMember: true, effect: { attackSpeedPct: 6 } },
  { id: 'living_stone', name: 'Living Stone', scope: 'golem', effect: { maxHpPct: 35 } },
  { id: 'forged_core', name: 'Forged Core', scope: 'golem', perMember: true, effect: { maxHpPct: 8 } },
  { id: 'feral_rage', name: 'Feral Rage', scope: 'beast', effect: { attackSpeedPct: 22 } },
  { id: 'pack_hunt', name: 'Pack Hunt', scope: 'beast', perMember: true, effect: { attackPct: 7 } },
  { id: 'crimson_pact', name: 'Crimson Pact', scope: 'blood', effect: { attackPct: 22, abilityPowerPct: 22 } },
  { id: 'blood_rite', name: 'Blood Rite', scope: 'blood', perMember: true, effect: { abilityPowerPct: 9 } },

  // ── Trigger boons ──────────────────────────────────────────────────────────
  // Six synergy webs. Each fires off a fight event instead of padding a stat line;
  // owning a boon twice fires it twice.

  // Bulwark: taunt feeds shields, shields feed damage.
  {
    id: 'oathkeeper', name: 'Oathkeeper', scope: 'lyonar',
    trigger: { on: 'hero_taunt', do: { target: 'party', shield: 40 } },
  },
  {
    id: 'riposte', name: 'Riposte', scope: 'tank',
    trigger: { on: 'hero_damaged', when: { gate: 'actor' }, do: { bossDamagePctOfAmount: 15 } },
  },
  {
    id: 'warded_might', name: 'Warded Might', scope: 'golem',
    trigger: {
      on: 'hero_shielded', when: { gate: 'actor', internalCdMs: 3000 },
      do: { buff: { attackPct: 20, durationMs: 4000 } },
    },
  },
  {
    id: 'molten_plate', name: 'Molten Plate', scope: 'golem',
    trigger: {
      on: 'shield_broken', when: { gate: 'actor' },
      do: { dot: { damage: 14, tickMs: 1000, durationMs: 5000 } },
    },
  },
  {
    id: 'last_stand', name: 'Last Stand', scope: 'tank',
    trigger: {
      on: 'hero_hp_below', when: { gate: 'actor', pct: 30, oncePerFight: true },
      do: { shield: 200, taunt: true },
    },
  },

  // Bleed: stack dots, then drink from them.
  {
    id: 'rend', name: 'Rend', scope: 'blade',
    trigger: {
      on: 'hero_attack', when: { everyNth: 3 },
      do: { dot: { damage: 12, tickMs: 1000, durationMs: 4000 } },
    },
  },
  {
    id: 'blood_tithe', name: 'Blood Tithe', scope: 'abyssian',
    trigger: { on: 'boss_damaged', do: { target: 'lowest', healPctOfAmount: 8 } },
  },
  {
    id: 'hemorrhage', name: 'Hemorrhage', scope: 'blood',
    trigger: { on: 'boss_damaged', when: { fromDot: true }, do: { target: 'source', refundMana: 12 } },
  },
  {
    id: 'crimson_harvest', name: 'Crimson Harvest', scope: 'blood',
    trigger: {
      on: 'boss_hp_below', when: { pct: 40, oncePerFight: true },
      do: { target: 'scope', buff: { attackSpeedPct: 20, durationMs: 60000 } },
    },
  },

  // Chain-cast: casts pay for the next cast.
  {
    id: 'echo', name: 'Echo', scope: 'arcanyst',
    trigger: { on: 'hero_cast', when: { everyNth: 4 }, do: { repeatCast: true } },
  },
  {
    id: 'momentum', name: 'Momentum', scope: 'songhai',
    trigger: { on: 'hero_cast', do: { buff: { attackSpeedPct: 15, durationMs: 5000 } } },
  },
  {
    id: 'flow_state', name: 'Flow State', scope: 'vanar',
    trigger: { on: 'hero_cast', do: { target: 'others', refundMana: 15 } },
  },
  {
    id: 'overload', name: 'Overload', scope: 'arcanyst',
    trigger: { on: 'hero_cast', when: { internalCdMs: 6000 }, do: { bossDamage: 60 } },
  },

  // Overheal: healers stop wasting their output.
  {
    id: 'sacred_excess', name: 'Sacred Excess', scope: 'heal',
    trigger: { on: 'overheal', do: { target: 'actor', shield: 25 } },
  },
  {
    id: 'vital_surge', name: 'Vital Surge', scope: 'heal',
    trigger: {
      on: 'hero_healed', when: { internalCdMs: 2000 },
      do: { target: 'actor', buff: { attackPct: 20, durationMs: 3000 } },
    },
  },
  {
    id: 'warchant', name: 'Warchant', scope: 'party',
    trigger: { on: 'interval', when: { intervalMs: 8000 }, do: { target: 'party', heal: 20 } },
  },

  // Desperation: losing hurts the boss.
  {
    id: 'bloodscent', name: 'Bloodscent', scope: 'dps',
    trigger: {
      on: 'boss_hp_below', when: { pct: 30, oncePerFight: true },
      do: { target: 'scope', buff: { attackPct: 25, durationMs: 60000 } },
    },
  },
  {
    id: 'vengeance', name: 'Vengeance', scope: 'party',
    trigger: {
      on: 'hero_death',
      do: { target: 'party', buff: { attackPct: 15, durationMs: 60000 } },
    },
  },
  {
    id: 'second_wind', name: 'Second Wind', scope: 'party',
    trigger: { on: 'hero_death', when: { oncePerFight: true }, do: { target: 'party', heal: 120 } },
  },

  // Opening: front-loaded tempo.
  {
    id: 'ambush', name: 'Ambush', scope: 'beast',
    trigger: { on: 'fight_start', do: { target: 'scope', buff: { attackSpeedPct: 30, durationMs: 8000 } } },
  },
  {
    id: 'down_payment', name: 'Down Payment', scope: 'mercenary',
    trigger: { on: 'fight_start', do: { bossStunMs: 1500 } },
  },
  {
    id: 'siege_engine', name: 'Siege Engine', scope: 'mercenary',
    trigger: { on: 'interval', when: { intervalMs: 6000 }, do: { bossDamage: 40 } },
  },
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
  return (b.effect?.[key] ?? 0) * (b.perMember ? members : 1);
}

const TRIGGER_LABEL: Record<BoonTrigger, string> = {
  fight_start: 'On fight start',
  interval: 'Every {n}s',
  hero_cast: 'On cast',
  hero_attack: 'On attack',
  hero_taunt: 'On taunt',
  boss_damaged: 'On boss hit',
  hero_damaged: 'When hit',
  hero_healed: 'On heal',
  hero_shielded: 'On shield',
  hero_death: 'On death',
  overheal: 'On overheal',
  shield_broken: 'On shield break',
  boss_hp_below: 'Boss under {n}%',
  hero_hp_below: 'Under {n}% HP',
};

const TARGET_LABEL: Record<BoonTargetKind, string> = {
  actor: 'them',
  source: 'caster',
  others: 'others',
  lowest: 'lowest HP',
  party: 'party',
  scope: 'them',
};

/** Cards are two lines wide at most — durations read short, never `4.0s`. */
const secs = (ms: number): string => `${Math.round(ms / 100) / 10}s`;

/** Action copy, assembled field by field — no per-boon strings anywhere. */
function actionText(a: BoonAction): string {
  const who = TARGET_LABEL[a.target ?? 'actor'];
  const parts: string[] = [];
  if (a.bossDamage) parts.push(`${a.bossDamage} dmg to boss`);
  if (a.bossDamagePctOfAmount) parts.push(`${a.bossDamagePctOfAmount}% of it to boss`);
  if (a.heal) parts.push(`heal ${who} ${a.heal}`);
  if (a.healPctOfAmount) parts.push(`heal ${who} ${a.healPctOfAmount}% of it`);
  if (a.shield) parts.push(`${a.shield} shield to ${who}`);
  if (a.buff) {
    const swings = [
      a.buff.attackPct && `+${a.buff.attackPct}% atk`,
      a.buff.attackSpeedPct && `+${a.buff.attackSpeedPct}% atk spd`,
    ].filter(Boolean).join(', ');
    parts.push(`${swings} ${secs(a.buff.durationMs)} to ${who}`);
  }
  if (a.dot) parts.push(`bleed boss ${a.dot.damage}/${secs(a.dot.tickMs)} for ${secs(a.dot.durationMs)}`);
  if (a.refundMana) parts.push(`${a.refundMana} mana back to ${who}`);
  if (a.bossStunMs) parts.push(`stagger boss ${secs(a.bossStunMs)}`);
  if (a.taunt) parts.push('taunt');
  if (a.repeatCast) parts.push('the cast fires twice');
  return parts.join(', ');
}

/** `Scope — When: what`. Built from the spec, same contract as the stat text. */
function triggerText(b: BoonDef): string {
  const t = b.trigger!;
  const w = t.when ?? {};
  let when = TRIGGER_LABEL[t.on]
    .replace('{n}', String(t.on === 'interval' ? (w.intervalMs ?? 5000) / 1000 : (w.pct ?? 0)));
  if (w.everyNth) when += ` (1 in ${w.everyNth})`;
  if (w.fromDot) when += ' from a bleed';
  if (w.oncePerFight) when += ', once/fight';
  return `${SCOPE_LABEL[b.scope]} — ${when}: ${actionText(t.do)}`;
}

/**
 * One-line effect text, built from the numeric fields — no hardcoded copy.
 * Pass the party to resolve a `perMember` boon into its real total.
 */
export function boonText(b: BoonDef, party?: HeroDef[]): string {
  if (b.trigger) return triggerText(b);
  const members = b.perMember && party ? boonMembers(b, party) : 0;
  const parts = (Object.keys(EFFECT_LABEL) as (keyof BoonEffect)[])
    .filter(k => b.effect?.[k])
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
    return growHero(def, {
      maxHpPct: pct('maxHpPct'),
      hpRegenPct: pct('hpRegenPct'),
      armorPct: pct('armorPct'),
      attackPct: pct('attackPct'),
      attackSpeedPct: pct('attackSpeedPct'),
      abilityPowerPct: pct('abilityPowerPct'),
      manaCostPct: pct('manaCostPct'),
    });
  });
}

/**
 * Owned boons collapsed to unique entries with their stack count. Boons are not part of the
 * run loop today — the between-fights reward is a unit draft — but the pool and its
 * machinery are kept intact.
 */
export interface BoonStack {
  boon: BoonDef;
  count: number;
}
