import { ROSTER } from './heroes';
import type { HeroDef, HeroRarity } from '../types';

/** Fixed orb price. Gold is what a run pays out on top of exp. */
export const ORB_PRICE = 5;

/** Pull odds in percent: a tier is drawn first, then a hero uniformly inside it. */
export const RARITY_WEIGHT: Record<HeroRarity, number> = { B: 70, A: 25, S: 5 };

export const RARITY_LABEL: Record<HeroRarity, string> = {
  B: 'COMMON', A: 'RARE', S: 'LEGENDARY',
};

export const RARITY_COLOR: Record<HeroRarity, number> = {
  B: 0x9aa3b8, A: 0x7fd4ff, S: 0xffd76b,
};

/** Exp a duplicate pays the hero it rolled, so no pull is ever wasted. */
export const DUPE_EXP: Record<HeroRarity, number> = { B: 20, A: 50, S: 120 };

/** Odds any pull comes out prismatic, rolled independently of the rarity tier. */
export const PRISMATIC_CHANCE = 0.1;

/** A prismatic duplicate is still a win — it pays this multiple of the normal dupe exp. */
export const PRISMATIC_EXP_MULT = 2;

/** Ascending, so the reveal and the odds list read in the same order everywhere. */
export const RARITY_ORDER: HeroRarity[] = ['B', 'A', 'S'];

/** A run pays this much for its first boss, before any level is cleared. */
const GOLD_BASE = 25;
/** Each cleared level pays GOLD_PER_LEVEL × its depth — later bosses are worth more. */
const GOLD_PER_LEVEL = 10;

/**
 * Gold a run that reached `runLevel` banks. `runLevel` is the boss it died on, so it
 * cleared `runLevel - 1` of them; the payout is the triangular sum over those depths.
 */
export function runGold(runLevel: number): number {
  const cleared = Math.max(0, runLevel - 1);
  return GOLD_BASE + (GOLD_PER_LEVEL * cleared * (cleared + 1)) / 2;
}

export function heroesByRarity(rarity: HeroRarity): HeroDef[] {
  return ROSTER.filter(h => h.rarity === rarity);
}

/**
 * One orb: a rarity drawn on RARITY_WEIGHT, then a hero uniformly inside that tier.
 * Rolls the whole roster — an already-owned hero comes back as a duplicate and the
 * store pays it exp instead of unlocking anything.
 */
export function rollOrb(rng: () => number = Math.random): HeroDef {
  const total = RARITY_ORDER.reduce((sum, r) => sum + RARITY_WEIGHT[r], 0);
  let ticket = rng() * total;
  for (const rarity of RARITY_ORDER) {
    ticket -= RARITY_WEIGHT[rarity];
    if (ticket < 0) {
      const pool = heroesByRarity(rarity);
      return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
    }
  }
  // Unreachable while every tier has members — rounding only, never a real branch.
  const pool = heroesByRarity('B');
  return pool[pool.length - 1];
}

/**
 * The prismatic coin, drawn independently of `rollOrb` so the rarity odds stay untouched.
 * Any hero can come out prismatic — the variant is cosmetic, not a fourth tier.
 */
export function rollPrismatic(rng: () => number = Math.random): boolean {
  return rng() < PRISMATIC_CHANCE;
}
