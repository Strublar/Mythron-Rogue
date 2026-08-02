import type { HeroDef, HeroRole } from '../types';
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
    role: 'tank', maxHp: 900, attack: 25, attackIntervalMs: 1400, ability: SHIELD_BASH },
  { id: 'tank_silvermane', unitKey: 'f1_silvermanevanguard', name: 'Silvermane Vanguard',
    role: 'tank', maxHp: 820, attack: 34, attackIntervalMs: 1300, ability: RALLYING_ROAR },
  { id: 'tank_primus', unitKey: 'neutral_primusshieldmaster', name: 'Primus Shieldmaster',
    role: 'tank', maxHp: 1050, attack: 18, attackIntervalMs: 1600, ability: BULWARK },
  { id: 'tank_tundra', unitKey: 'f6_tundraguardian', name: 'Tundra Guardian',
    role: 'tank', maxHp: 880, attack: 22, attackIntervalMs: 1500, ability: GLACIAL_SLAM },
  { id: 'tank_dervish', unitKey: 'f3_irondervish', name: 'Iron Dervish',
    role: 'tank', maxHp: 700, attack: 40, attackIntervalMs: 1000, ability: WHIRLING_GUARD },

  // DPS — low hp, fast swings, no taunt.
  { id: 'dps_lancer', unitKey: 'f1_sunforgelancer', name: 'Sunforge Lancer',
    role: 'dps', maxHp: 450, attack: 55, attackIntervalMs: 1100, ability: BURST },
  { id: 'dps_araki', unitKey: 'neutral_arakiheadhunter', name: 'Araki Headhunter',
    role: 'dps', maxHp: 400, attack: 50, attackIntervalMs: 1050, ability: HEADHUNT },
  { id: 'dps_pyromancer', unitKey: 'f3_pyromancer', name: 'Pyromancer',
    role: 'dps', maxHp: 340, attack: 42, attackIntervalMs: 1200, ability: IMMOLATION },
  { id: 'dps_elyx', unitKey: 'f1_elyxstormblade', name: 'Elyx Stormblade',
    role: 'dps', maxHp: 430, attack: 44, attackIntervalMs: 900, ability: STORMBLADE },
  { id: 'dps_nightsorrow', unitKey: 'f4_nightsorrow', name: 'Nightsorrow Assassin',
    role: 'dps', maxHp: 360, attack: 62, attackIntervalMs: 1150, ability: NIGHTSORROW },
  { id: 'dps_voidhunter', unitKey: 'neutral_voidhunter', name: 'Void Hunter',
    role: 'dps', maxHp: 380, attack: 58, attackIntervalMs: 1250, ability: VOID_STEP },
  { id: 'dps_stormkage', unitKey: 'f2_stormkage', name: 'Storm Kage',
    role: 'dps', maxHp: 370, attack: 46, attackIntervalMs: 1150, ability: CHAIN_LIGHTNING },
  { id: 'dps_whitewidow', unitKey: 'neutral_whitewidow', name: 'White Widow',
    role: 'dps', maxHp: 350, attack: 36, attackIntervalMs: 800, ability: VENOM_SHOT },
  { id: 'dps_mankator', unitKey: 'f5_mankatorwarbeast', name: 'Mankator Warbeast',
    role: 'dps', maxHp: 520, attack: 48, attackIntervalMs: 1350, ability: WARBEAST_HOWL },

  // Healers — `attack` is the auto-heal landed on the weakest ally.
  { id: 'heal_mystic', unitKey: 'neutral_healingmystic', name: 'Healing Mystic',
    role: 'heal', maxHp: 400, attack: 45, attackIntervalMs: 1600, ability: MEND },
  { id: 'heal_sunriser', unitKey: 'f1_sunriser', name: 'Sunriser',
    role: 'heal', maxHp: 380, attack: 38, attackIntervalMs: 1500, ability: DAWNLIGHT },
  { id: 'heal_aymara', unitKey: 'f3_aymarahealer', name: 'Aymara Healer',
    role: 'heal', maxHp: 420, attack: 42, attackIntervalMs: 1700, ability: SUNWARD_AEGIS },
  { id: 'heal_bloodstone', unitKey: 'neutral_bloodstonealchemist', name: 'Bloodstone Alchemist',
    role: 'heal', maxHp: 350, attack: 52, attackIntervalMs: 1800, ability: BLOOD_PACT },
  { id: 'heal_scribe', unitKey: 'neutral_spiritscribe', name: 'Spirit Scribe',
    role: 'heal', maxHp: 360, attack: 34, attackIntervalMs: 1400, ability: SPIRIT_SCRIBE },
  { id: 'heal_oracle', unitKey: 'neutral_mercshieldoracle', name: 'Shield Oracle',
    role: 'heal', maxHp: 440, attack: 28, attackIntervalMs: 1500, ability: SHIELD_ORACLE },
];

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
