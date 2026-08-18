import type { HeroDef, HeroRole, HeroTag } from '../types';
import {
  BAMBOO_BALM, BLOOD_PACT, BULWARK, BURST, CHAIN_LIGHTNING, DAWNLIGHT, GLACIAL_SLAM,
  HEADHUNT, IMMOLATION, MEND, NIGHTSORROW, POUNCE, RALLYING_ROAR, ROOTED_CALM, SAND_CUT,
  SCALED_HIDE, SHADOW_NIP, SHIELD_BASH, SHIELD_ORACLE, SPIRIT_SCRIBE, SQUIRE_GUARD,
  STORMBLADE, SUNWARD_AEGIS, VENOM_SHOT, VOID_STEP, WARBEAST_HOWL, WHIRLING_GUARD,
} from './abilities';
import { PASSIVES } from './passives';

// Threat tuning: every point of damage dealt or hp healed converts to threat with
// this role weight, so tanks out-aggro the rest of the party without out-damaging it.
export const ROLE_THREAT_MULTIPLIER: Record<HeroRole, number> = {
  tank: 5,
  dps: 1,
  heal: 1.5,
};

/** Threat a taunt plants on its caster after wiping the party's threat. */
export const TAUNT_THREAT = 1500;

/**
 * Every hero the player can field. Party slots cap the pick at 2 tanks / 3 dps / 2 heals.
 * Stat shape per role: tanks buy survival (armor, hp regen), dps buy crit and power,
 * healers buy power and mana regen — the cast, not the auto-attack, is their output.
 */
const ENTRIES: HeroDef[] = [
  // Tanks — high hp, heavy armor, slow swings, every ability taunts.
  { id: 'tank_ironcliffe', unitKey: 'f1_ironcliffeguardian', name: 'Ironcliffe Guardian', rarity: 'B',
    role: 'tank', tags: ['lyonar', 'golem'], maxHp: 900, hpRegen: 12, armor: 55,
    attack: 25, attackIntervalMs: 1400, power: 110, critChance: 5, manaRegen: 10,
    ability: SHIELD_BASH },
  { id: 'tank_silvermane', unitKey: 'f1_silvermanevanguard', name: 'Silvermane Vanguard', rarity: 'B',
    role: 'tank', tags: ['lyonar', 'blade'], maxHp: 820, hpRegen: 10, armor: 45,
    attack: 34, attackIntervalMs: 1300, power: 100, critChance: 10, manaRegen: 11,
    ability: RALLYING_ROAR },
  { id: 'tank_primus', unitKey: 'neutral_primusshieldmaster', name: 'Primus Shieldmaster', rarity: 'A',
    role: 'tank', tags: ['mercenary', 'golem'], maxHp: 1050, hpRegen: 14, armor: 60,
    attack: 18, attackIntervalMs: 1600, power: 120, critChance: 5, manaRegen: 9,
    ability: BULWARK },
  { id: 'tank_tundra', unitKey: 'f6_tundraguardian', name: 'Tundra Guardian', rarity: 'B',
    role: 'tank', tags: ['vanar', 'beast'], maxHp: 880, hpRegen: 11, armor: 50,
    attack: 22, attackIntervalMs: 1500, power: 105, critChance: 8, manaRegen: 12,
    ability: GLACIAL_SLAM },
  { id: 'tank_dervish', unitKey: 'f3_irondervish', name: 'Iron Dervish', rarity: 'S',
    role: 'tank', tags: ['vetruvian', 'golem'], maxHp: 700, hpRegen: 7, armor: 40,
    attack: 40, attackIntervalMs: 1000, power: 90, critChance: 15, manaRegen: 10,
    ability: WHIRLING_GUARD },

  // DPS — low hp, thin armor, fast swings, crit-heavy, no taunt.
  { id: 'dps_lancer', unitKey: 'f1_sunforgelancer', name: 'Sunforge Lancer', rarity: 'B',
    role: 'dps', tags: ['lyonar', 'blade'], maxHp: 450, hpRegen: 4, armor: 20,
    attack: 55, attackIntervalMs: 1100, power: 110, critChance: 20, manaRegen: 10,
    ability: BURST },
  { id: 'dps_araki', unitKey: 'neutral_arakiheadhunter', name: 'Araki Headhunter', rarity: 'B',
    role: 'dps', tags: ['mercenary', 'blade'], maxHp: 400, hpRegen: 3, armor: 18,
    attack: 50, attackIntervalMs: 1050, power: 105, critChance: 25, manaRegen: 10,
    ability: HEADHUNT },
  { id: 'dps_pyromancer', unitKey: 'f3_pyromancer', name: 'Pyromancer', rarity: 'B',
    role: 'dps', tags: ['vetruvian', 'arcanyst'], maxHp: 340, hpRegen: 2, armor: 12,
    attack: 42, attackIntervalMs: 1200, power: 135, critChance: 15, manaRegen: 12,
    ability: IMMOLATION },
  { id: 'dps_elyx', unitKey: 'f1_elyxstormblade', name: 'Elyx Stormblade', rarity: 'B',
    role: 'dps', tags: ['lyonar', 'blade'], maxHp: 430, hpRegen: 3, armor: 16,
    attack: 44, attackIntervalMs: 900, power: 100, critChance: 22, manaRegen: 11,
    ability: STORMBLADE },
  { id: 'dps_nightsorrow', unitKey: 'f4_nightsorrow', name: 'Nightsorrow Assassin', rarity: 'S',
    role: 'dps', tags: ['abyssian', 'blood'], maxHp: 360, hpRegen: 4, armor: 15,
    attack: 62, attackIntervalMs: 1150, power: 115, critChance: 30, manaRegen: 9,
    ability: NIGHTSORROW },
  { id: 'dps_voidhunter', unitKey: 'neutral_voidhunter', name: 'Void Hunter', rarity: 'A',
    role: 'dps', tags: ['mercenary', 'beast'], maxHp: 380, hpRegen: 3, armor: 18,
    attack: 58, attackIntervalMs: 1250, power: 125, critChance: 18, manaRegen: 9,
    ability: VOID_STEP },
  { id: 'dps_stormkage', unitKey: 'f2_stormkage', name: 'Storm Kage', rarity: 'A',
    role: 'dps', tags: ['songhai', 'arcanyst'], maxHp: 370, hpRegen: 2, armor: 14,
    attack: 46, attackIntervalMs: 1150, power: 130, critChance: 16, manaRegen: 12,
    ability: CHAIN_LIGHTNING },
  { id: 'dps_whitewidow', unitKey: 'neutral_whitewidow', name: 'White Widow', rarity: 'A',
    role: 'dps', tags: ['mercenary', 'beast'], maxHp: 350, hpRegen: 3, armor: 15,
    attack: 36, attackIntervalMs: 800, power: 110, critChance: 28, manaRegen: 13,
    ability: VENOM_SHOT },
  { id: 'dps_mankator', unitKey: 'f5_mankatorwarbeast', name: 'Mankator Warbeast', rarity: 'A',
    role: 'dps', tags: ['magmar', 'beast'], maxHp: 520, hpRegen: 5, armor: 22,
    attack: 48, attackIntervalMs: 1350, power: 110, critChance: 15, manaRegen: 8,
    ability: WARBEAST_HOWL },

  // Healers — `attack` is the auto-heal landed on the weakest ally.
  { id: 'heal_mystic', unitKey: 'neutral_healingmystic', name: 'Healing Mystic', rarity: 'B',
    role: 'heal', tags: ['mercenary', 'arcanyst'], maxHp: 400, hpRegen: 6, armor: 18,
    attack: 45, attackIntervalMs: 1600, power: 120, critChance: 10, manaRegen: 12,
    ability: MEND },
  { id: 'heal_sunriser', unitKey: 'f1_sunriser', name: 'Sunriser', rarity: 'B',
    role: 'heal', tags: ['lyonar', 'arcanyst'], maxHp: 380, hpRegen: 6, armor: 20,
    attack: 38, attackIntervalMs: 1500, power: 125, critChance: 10, manaRegen: 11,
    ability: DAWNLIGHT },
  { id: 'heal_aymara', unitKey: 'f3_aymarahealer', name: 'Aymara Healer', rarity: 'A',
    role: 'heal', tags: ['vetruvian', 'blood'], maxHp: 420, hpRegen: 5, armor: 22,
    attack: 42, attackIntervalMs: 1700, power: 130, critChance: 12, manaRegen: 10,
    ability: SUNWARD_AEGIS },
  { id: 'heal_bloodstone', unitKey: 'neutral_bloodstonealchemist', name: 'Bloodstone Alchemist', rarity: 'S',
    role: 'heal', tags: ['mercenary', 'blood'], maxHp: 350, hpRegen: 4, armor: 15,
    attack: 52, attackIntervalMs: 1800, power: 140, critChance: 15, manaRegen: 10,
    ability: BLOOD_PACT },
  { id: 'heal_scribe', unitKey: 'neutral_spiritscribe', name: 'Spirit Scribe', rarity: 'B',
    role: 'heal', tags: ['mercenary', 'arcanyst'], maxHp: 360, hpRegen: 7, armor: 18,
    attack: 34, attackIntervalMs: 1400, power: 115, critChance: 8, manaRegen: 14,
    ability: SPIRIT_SCRIBE },
  { id: 'heal_oracle', unitKey: 'neutral_mercshieldoracle', name: 'Shield Oracle', rarity: 'A',
    role: 'heal', tags: ['mercenary', 'golem'], maxHp: 440, hpRegen: 8, armor: 25,
    attack: 28, attackIntervalMs: 1500, power: 135, critChance: 8, manaRegen: 11,
    ability: SHIELD_ORACLE },

  // Starters — the seven every run opens with. Rarity 'C': never rolled, never sold,
  // and a full tier under the roster above, so any recruit is a visible upgrade.
  { id: 'start_squire', unitKey: 'f1_silverguardsquire', name: 'Silverguard Squire', rarity: 'C',
    role: 'tank', tags: ['lyonar', 'blade'], maxHp: 620, hpRegen: 8, armor: 34,
    attack: 16, attackIntervalMs: 1500, power: 80, critChance: 5, manaRegen: 10,
    ability: SQUIRE_GUARD },
  { id: 'start_silithar', unitKey: 'f5_silitharyoung', name: 'Young Silithar', rarity: 'C',
    role: 'tank', tags: ['magmar', 'beast'], maxHp: 660, hpRegen: 9, armor: 30,
    attack: 18, attackIntervalMs: 1550, power: 80, critChance: 5, manaRegen: 9,
    ability: SCALED_HIDE },
  { id: 'start_wraithling', unitKey: 'f4_gloomchaser', name: 'Wraithling', rarity: 'C',
    role: 'dps', tags: ['abyssian', 'blood'], maxHp: 260, hpRegen: 2, armor: 10,
    attack: 30, attackIntervalMs: 1100, power: 75, critChance: 12, manaRegen: 10,
    ability: SHADOW_NIP },
  { id: 'start_minijax', unitKey: 'neutral_minijax', name: 'Mini Jax', rarity: 'C',
    role: 'dps', tags: ['mercenary', 'beast'], maxHp: 300, hpRegen: 3, armor: 12,
    attack: 34, attackIntervalMs: 1200, power: 70, critChance: 10, manaRegen: 9,
    ability: POUNCE },
  { id: 'start_dervish', unitKey: 'f3_dervish', name: 'Wind Dervish', rarity: 'C',
    role: 'dps', tags: ['vetruvian', 'golem'], maxHp: 280, hpRegen: 2, armor: 10,
    attack: 28, attackIntervalMs: 950, power: 80, critChance: 14, manaRegen: 10,
    ability: SAND_CUT },
  { id: 'start_panddo', unitKey: 'f2_panddo', name: 'Panddo', rarity: 'C',
    role: 'heal', tags: ['songhai', 'beast'], maxHp: 300, hpRegen: 4, armor: 12,
    attack: 26, attackIntervalMs: 1700, power: 85, critChance: 5, manaRegen: 10,
    ability: BAMBOO_BALM },
  { id: 'start_treant', unitKey: 'f6_treant', name: 'Treant', rarity: 'C',
    role: 'heal', tags: ['vanar', 'beast'], maxHp: 340, hpRegen: 5, armor: 16,
    attack: 22, attackIntervalMs: 1600, power: 80, critChance: 5, manaRegen: 9,
    ability: ROOTED_CALM },
];

/** A run fields passives from stage 1 — there are no levels to unlock them any more. */
export const ROSTER: HeroDef[] = ENTRIES.map(def => ({ ...def, passive: PASSIVES[def.id] }));

/** Singular tag name, unlike the plural boon-scope label. */
export const TAG_LABEL: Record<HeroTag, string> = {
  lyonar: 'Lyonar', songhai: 'Songhai', vetruvian: 'Vetruvian', abyssian: 'Abyssian',
  magmar: 'Magmar', vanar: 'Vanar', mercenary: 'Mercenary',
  arcanyst: 'Arcanyst', blade: 'Blade', golem: 'Golem', beast: 'Beast', blood: 'Bloodbound',
};

/** A hero's tags on one line — the same strip on the roster card and the stats popup. */
export function tagStrip(hero: HeroDef): string {
  return hero.tags.map(t => TAG_LABEL[t].toUpperCase()).join(' · ');
}

/** Tag counts across a party, biggest first: what the boon rolls are weighted by. */
export function partyTags(party: HeroDef[]): { tag: HeroTag; count: number }[] {
  const counts = new Map<HeroTag, number>();
  for (const hero of party) {
    for (const tag of hero.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function heroesByRole(role: HeroRole, roster: HeroDef[] = ROSTER): HeroDef[] {
  return roster.filter(h => h.role === role);
}

/** The 2/3/2 every run opens with, in `PARTY_SEATS` order — index is seat. */
export const STARTER_PARTY_IDS = [
  'start_squire', 'start_silithar',
  'start_wraithling', 'start_minijax', 'start_dervish',
  'start_panddo', 'start_treant',
];

/** Those seven, seat-ordered — what `RunState` opens on. */
export function starterParty(): HeroDef[] {
  return STARTER_PARTY_IDS.map(id => ROSTER.find(h => h.id === id)!);
}

/** Everything the interlude can hand out. Starters are the floor, never an offer. */
export const RECRUIT_POOL: HeroDef[] = ROSTER.filter(h => h.rarity !== 'C');

export function heroById(id: string): HeroDef | undefined {
  return ROSTER.find(h => h.id === id);
}
