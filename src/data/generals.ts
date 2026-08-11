import type { HeroDef } from '../types';
import {
  BLIGHT_CALL, IMMOLATIVE_MIGHT, MIST_DRAGON_SEAL, ROAR_OF_THE_SUN, STARSTRIDE, WINTERS_WAKE,
} from './abilities';

/**
 * The six faction generals — one is picked before the run and opens it alone. A general is
 * an ordinary unit that happens to be `dps`: it takes the centre dps seat and counts toward
 * the party's three dps. Kept out of `ROSTER`, so it never shows up in a draft offer, the
 * collection, or an orb pull. Rarity is card tint only and never gates anything here.
 */
export const GENERALS: HeroDef[] = [
  { id: 'gen_argeon', unitKey: 'f1_general', name: 'Argeon Highmayne', rarity: 'S',
    role: 'dps', tags: ['lyonar', 'blade'], maxHp: 660, hpRegen: 8, armor: 32,
    attack: 50, attackIntervalMs: 1150, power: 120, critChance: 18, manaRegen: 12,
    ability: ROAR_OF_THE_SUN },
  { id: 'gen_kaleos', unitKey: 'f2_general', name: 'Kaleos Xaan', rarity: 'S',
    role: 'dps', tags: ['songhai', 'blade'], maxHp: 580, hpRegen: 6, armor: 26,
    attack: 48, attackIntervalMs: 950, power: 115, critChance: 25, manaRegen: 13,
    ability: MIST_DRAGON_SEAL },
  { id: 'gen_zirix', unitKey: 'f3_general', name: 'Zirix Starstrider', rarity: 'S',
    role: 'dps', tags: ['vetruvian', 'arcanyst'], maxHp: 600, hpRegen: 6, armor: 28,
    attack: 46, attackIntervalMs: 1100, power: 130, critChance: 15, manaRegen: 12,
    ability: STARSTRIDE },
  { id: 'gen_lilithe', unitKey: 'f4_general', name: 'Lilithe Blightchaser', rarity: 'S',
    role: 'dps', tags: ['abyssian', 'blood'], maxHp: 590, hpRegen: 7, armor: 27,
    attack: 54, attackIntervalMs: 1150, power: 125, critChance: 22, manaRegen: 12,
    ability: BLIGHT_CALL },
  { id: 'gen_vaath', unitKey: 'f5_general', name: 'Vaath the Immortal', rarity: 'S',
    role: 'dps', tags: ['magmar', 'beast'], maxHp: 700, hpRegen: 9, armor: 35,
    attack: 52, attackIntervalMs: 1250, power: 120, critChance: 18, manaRegen: 11,
    ability: IMMOLATIVE_MIGHT },
  { id: 'gen_faie', unitKey: 'f6_general', name: 'Faie Bloodwing', rarity: 'S',
    role: 'dps', tags: ['vanar', 'arcanyst'], maxHp: 620, hpRegen: 7, armor: 30,
    attack: 49, attackIntervalMs: 1100, power: 128, critChance: 16, manaRegen: 12,
    ability: WINTERS_WAKE },
];
