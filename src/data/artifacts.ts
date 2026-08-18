import type { ArtifactDef, HeroDef } from '../types';
import { growHero } from './statMath';

/**
 * The shop's gear. One artifact per character: percent stats baked into the wearer plus a
 * second owner-scoped trigger, riding the same machinery as a hero passive. Rarity is
 * price and card tint only — an `S` is a bigger effect because its numbers are bigger.
 */
export const ARTIFACT_POOL: ArtifactDef[] = [
  // ── B ─────────────────────────────────────────────────────────────────────
  {
    id: 'art_bigshield',
    iconKey: 'artifact_f1_bigshield',
    name: 'Bulwark of Light',
    rarity: 'B',
    effect: { maxHpPct: 18, armorPct: 20 },
    passive: {
      id: 'a_bulwark', name: 'Bulwark',
      text: 'Every 4th hit taken shields the bearer for 90.',
      trigger: { on: 'hero_damaged', when: { everyNth: 4 }, do: { target: 'actor', shield: 90 } },
    },
  },
  {
    id: 'art_frostplate',
    iconKey: 'artifact_f6_frostplate',
    name: 'Frostplate',
    rarity: 'B',
    effect: { armorPct: 30, hpRegenPct: 40 },
    passive: {
      id: 'a_rime', name: 'Rime',
      text: 'Being hit staggers the boss by 0.2s, once every 3s.',
      trigger: { on: 'hero_damaged', when: { internalCdMs: 3000 }, do: { bossStunMs: 200 } },
    },
  },
  {
    id: 'art_adamantineclaws',
    iconKey: 'artifact_f5_adamantineclaws',
    name: 'Adamantine Claws',
    rarity: 'B',
    effect: { attackPct: 16, attackSpeedPct: 12 },
    passive: {
      id: 'a_rend', name: 'Rend',
      text: 'Every 5th swing rends the boss for 60.',
      trigger: { on: 'hero_attack', when: { everyNth: 5 }, do: { bossDamage: 60 } },
    },
  },
  {
    id: 'art_crescentspear',
    iconKey: 'artifact_f2_crescentspear',
    name: 'Crescent Spear',
    rarity: 'B',
    effect: { attackPct: 12, manaRegenPct: 25 },
    passive: {
      id: 'a_reach', name: 'Reach',
      text: 'Each cast hands the bearer 15 mana back.',
      trigger: { on: 'hero_cast', do: { target: 'source', refundMana: 15 } },
    },
  },

  // ── A ─────────────────────────────────────────────────────────────────────
  {
    id: 'art_sunstonebracers',
    iconKey: 'artifact_f1_sunstonebracers',
    name: 'Sunstone Bracers',
    rarity: 'A',
    effect: { maxHpPct: 15, abilityPowerPct: 25 },
    passive: {
      id: 'a_sunstone', name: 'Sunstone',
      text: 'Each cast heals the lowest-HP ally for 70.',
      trigger: { on: 'hero_cast', do: { target: 'lowest', heal: 70 } },
    },
  },
  {
    id: 'art_hexblade',
    iconKey: 'artifact_f3_hexblade',
    name: 'Hexblade',
    rarity: 'A',
    effect: { abilityPowerPct: 30, critChancePct: 30 },
    passive: {
      id: 'a_hex', name: 'Hex',
      text: 'Each cast burns the boss for 30 every 1s over 4s.',
      trigger: { on: 'hero_cast', do: { dot: { damage: 30, tickMs: 1000, durationMs: 4000 } } },
    },
  },
  {
    id: 'art_spectralblade',
    iconKey: 'artifact_f4_spectralblade',
    name: 'Spectral Blade',
    rarity: 'A',
    effect: { attackPct: 22, critChancePct: 40 },
    passive: {
      id: 'a_spectral', name: 'Spectral Edge',
      text: 'Every 3rd swing whets the bearer: +18% attack for 4s.',
      trigger: {
        on: 'hero_attack',
        when: { everyNth: 3 },
        do: { target: 'source', buff: { durationMs: 4000, attackPct: 18 } },
      },
    },
  },
  {
    id: 'art_eternalheart',
    iconKey: 'artifact_f5_eternalheart',
    name: 'Eternal Heart',
    rarity: 'A',
    effect: { maxHpPct: 30, hpRegenPct: 60 },
    passive: {
      id: 'a_eternal', name: 'Second Wind',
      text: 'Once per fight, dropping below 40% HP heals the bearer for 320.',
      trigger: {
        on: 'hero_hp_below',
        when: { pct: 40, oncePerFight: true },
        do: { target: 'actor', heal: 320 },
      },
    },
  },
  {
    id: 'art_winterblade',
    iconKey: 'artifact_f6_winterblade',
    name: 'Winterblade',
    rarity: 'A',
    effect: { attackSpeedPct: 25, manaCostPct: 15 },
    passive: {
      id: 'a_winter', name: 'Coldsnap',
      text: 'Every 6th swing staggers the boss for 0.6s.',
      trigger: { on: 'hero_attack', when: { everyNth: 6 }, do: { bossStunMs: 600 } },
    },
  },

  // ── S ─────────────────────────────────────────────────────────────────────
  {
    id: 'art_arclyteregalia',
    iconKey: 'artifact_f1_arclyteregalia',
    name: 'Arclyte Regalia',
    rarity: 'S',
    effect: { maxHpPct: 25, armorPct: 25, abilityPowerPct: 25 },
    passive: {
      id: 'a_regalia', name: 'Regalia',
      text: 'On fight start the whole party gains +15% attack for 10s.',
      trigger: {
        on: 'fight_start',
        do: { target: 'party', buff: { durationMs: 10000, attackPct: 15 } },
      },
    },
  },
  {
    id: 'art_soulgrimwar',
    iconKey: 'artifact_f4_soulgrimwar',
    name: 'Soul Grimwar',
    rarity: 'S',
    effect: { attackPct: 30, abilityPowerPct: 20 },
    passive: {
      id: 'a_soulreap', name: 'Soulreap',
      text: 'Each cast heals the bearer for 25% of the damage it dealt.',
      trigger: {
        on: 'boss_damaged',
        when: { internalCdMs: 400 },
        do: { target: 'source', healPctOfAmount: 25 },
      },
    },
  },
  {
    id: 'art_godhammer',
    iconKey: 'artifact_f5_godhammer',
    name: 'Godhammer',
    rarity: 'S',
    effect: { attackPct: 25, attackSpeedPct: 20, critChancePct: 50 },
    passive: {
      id: 'a_godhammer', name: 'Skyfall',
      text: 'Every 4th swing smashes the boss for 150.',
      trigger: { on: 'hero_attack', when: { everyNth: 4 }, do: { bossDamage: 150 } },
    },
  },
];

export const ARTIFACT_BY_ID = new Map(ARTIFACT_POOL.map(a => [a.id, a]));

/**
 * The wearer as it fights: the artifact's percentages baked into the def (the same
 * `growHero` boons use) and the artifact itself carried along, so the tooltip can print
 * it and `FightEngine` can slot its passive. Never mutates `def`.
 */
export function equipArtifact(def: HeroDef, artifact: ArtifactDef): HeroDef {
  return { ...growHero(def, artifact.effect), artifact };
}
