import type { HeroDef, HeroRole, HeroTag } from '../types';
import {
  BLOOD_PACT, BULWARK, BURST, CHAIN_LIGHTNING, DAWNLIGHT, GLACIAL_SLAM, HEADHUNT,
  IMMOLATION, MEND, NIGHTSORROW, RALLYING_ROAR, SHIELD_BASH, SHIELD_ORACLE,
  SPIRIT_SCRIBE, STORMBLADE, SUNWARD_AEGIS, VENOM_SHOT, VOID_STEP, WARBEAST_HOWL,
  WHIRLING_GUARD,
} from './abilities';

// Threat tuning: every point of damage dealt or hp healed converts to threat with
// this role weight, so tanks out-aggro the rest of the party without out-damaging it.
export const ROLE_THREAT_MULTIPLIER: Record<HeroRole, number> = {
  tank: 5,
  dps: 1,
  heal: 1.5,
};

/** Threat a taunt plants on its caster after wiping the party's threat. */
export const TAUNT_THREAT = 1500;

/** Every hero the player can field. Party slots cap the pick at 2 tanks / 3 dps / 2 heals. */
export const ROSTER: HeroDef[] = [
  // Tanks — high hp, slow swings, every ability taunts.
  { id: 'tank_ironcliffe', unitKey: 'f1_ironcliffeguardian', name: 'Ironcliffe Guardian',
    role: 'tank', tags: ['lyonar', 'golem'], maxHp: 900, attack: 25, attackIntervalMs: 1400, ability: SHIELD_BASH },
  { id: 'tank_silvermane', unitKey: 'f1_silvermanevanguard', name: 'Silvermane Vanguard',
    role: 'tank', tags: ['lyonar', 'blade'], maxHp: 820, attack: 34, attackIntervalMs: 1300, ability: RALLYING_ROAR },
  { id: 'tank_primus', unitKey: 'neutral_primusshieldmaster', name: 'Primus Shieldmaster',
    role: 'tank', tags: ['mercenary', 'golem'], maxHp: 1050, attack: 18, attackIntervalMs: 1600, ability: BULWARK },
  { id: 'tank_tundra', unitKey: 'f6_tundraguardian', name: 'Tundra Guardian',
    role: 'tank', tags: ['vanar', 'beast'], maxHp: 880, attack: 22, attackIntervalMs: 1500, ability: GLACIAL_SLAM },
  { id: 'tank_dervish', unitKey: 'f3_irondervish', name: 'Iron Dervish',
    role: 'tank', tags: ['vetruvian', 'golem'], maxHp: 700, attack: 40, attackIntervalMs: 1000, ability: WHIRLING_GUARD },

  // DPS — low hp, fast swings, no taunt.
  { id: 'dps_lancer', unitKey: 'f1_sunforgelancer', name: 'Sunforge Lancer',
    role: 'dps', tags: ['lyonar', 'blade'], maxHp: 450, attack: 55, attackIntervalMs: 1100, ability: BURST },
  { id: 'dps_araki', unitKey: 'neutral_arakiheadhunter', name: 'Araki Headhunter',
    role: 'dps', tags: ['mercenary', 'blade'], maxHp: 400, attack: 50, attackIntervalMs: 1050, ability: HEADHUNT },
  { id: 'dps_pyromancer', unitKey: 'f3_pyromancer', name: 'Pyromancer',
    role: 'dps', tags: ['vetruvian', 'arcanyst'], maxHp: 340, attack: 42, attackIntervalMs: 1200, ability: IMMOLATION },
  { id: 'dps_elyx', unitKey: 'f1_elyxstormblade', name: 'Elyx Stormblade',
    role: 'dps', tags: ['lyonar', 'blade'], maxHp: 430, attack: 44, attackIntervalMs: 900, ability: STORMBLADE },
  { id: 'dps_nightsorrow', unitKey: 'f4_nightsorrow', name: 'Nightsorrow Assassin',
    role: 'dps', tags: ['abyssian', 'blood'], maxHp: 360, attack: 62, attackIntervalMs: 1150, ability: NIGHTSORROW },
  { id: 'dps_voidhunter', unitKey: 'neutral_voidhunter', name: 'Void Hunter',
    role: 'dps', tags: ['mercenary', 'beast'], maxHp: 380, attack: 58, attackIntervalMs: 1250, ability: VOID_STEP },
  { id: 'dps_stormkage', unitKey: 'f2_stormkage', name: 'Storm Kage',
    role: 'dps', tags: ['songhai', 'arcanyst'], maxHp: 370, attack: 46, attackIntervalMs: 1150, ability: CHAIN_LIGHTNING },
  { id: 'dps_whitewidow', unitKey: 'neutral_whitewidow', name: 'White Widow',
    role: 'dps', tags: ['mercenary', 'beast'], maxHp: 350, attack: 36, attackIntervalMs: 800, ability: VENOM_SHOT },
  { id: 'dps_mankator', unitKey: 'f5_mankatorwarbeast', name: 'Mankator Warbeast',
    role: 'dps', tags: ['magmar', 'beast'], maxHp: 520, attack: 48, attackIntervalMs: 1350, ability: WARBEAST_HOWL },

  // Healers — `attack` is the auto-heal landed on the weakest ally.
  { id: 'heal_mystic', unitKey: 'neutral_healingmystic', name: 'Healing Mystic',
    role: 'heal', tags: ['mercenary', 'arcanyst'], maxHp: 400, attack: 45, attackIntervalMs: 1600, ability: MEND },
  { id: 'heal_sunriser', unitKey: 'f1_sunriser', name: 'Sunriser',
    role: 'heal', tags: ['lyonar', 'arcanyst'], maxHp: 380, attack: 38, attackIntervalMs: 1500, ability: DAWNLIGHT },
  { id: 'heal_aymara', unitKey: 'f3_aymarahealer', name: 'Aymara Healer',
    role: 'heal', tags: ['vetruvian', 'blood'], maxHp: 420, attack: 42, attackIntervalMs: 1700, ability: SUNWARD_AEGIS },
  { id: 'heal_bloodstone', unitKey: 'neutral_bloodstonealchemist', name: 'Bloodstone Alchemist',
    role: 'heal', tags: ['mercenary', 'blood'], maxHp: 350, attack: 52, attackIntervalMs: 1800, ability: BLOOD_PACT },
  { id: 'heal_scribe', unitKey: 'neutral_spiritscribe', name: 'Spirit Scribe',
    role: 'heal', tags: ['mercenary', 'arcanyst'], maxHp: 360, attack: 34, attackIntervalMs: 1400, ability: SPIRIT_SCRIBE },
  { id: 'heal_oracle', unitKey: 'neutral_mercshieldoracle', name: 'Shield Oracle',
    role: 'heal', tags: ['mercenary', 'golem'], maxHp: 440, attack: 28, attackIntervalMs: 1500, ability: SHIELD_ORACLE },
];

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

export function heroesByRole(role: HeroRole): HeroDef[] {
  return ROSTER.filter(h => h.role === role);
}

const byId = (id: string): HeroDef => ROSTER.find(h => h.id === id)!;

/** The 2/3/2 the selection screen opens on, so a run can start without picking. */
export const DEFAULT_PARTY: HeroDef[] = [
  'tank_ironcliffe', 'tank_silvermane',
  'dps_lancer', 'dps_araki', 'dps_pyromancer',
  'heal_mystic', 'heal_sunriser',
].map(byId);
