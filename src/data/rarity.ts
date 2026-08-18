import type { HeroRarity } from '../types';

/**
 * Rarity is the run's economy: what a shop roll draws and what it charges. `C` is the
 * starter tier — the seven a run opens with. It is never rolled and never sold, so its
 * weight is 0 and its price is meaningless.
 */
export const RARITY_WEIGHT: Record<HeroRarity, number> = { C: 0, B: 70, A: 25, S: 5 };

export const RARITY_LABEL: Record<HeroRarity, string> = {
  C: 'STARTER', B: 'COMMON', A: 'RARE', S: 'LEGENDARY',
};

export const RARITY_COLOR: Record<HeroRarity, number> = {
  C: 0x6f7789, B: 0x9aa3b8, A: 0x7fd4ff, S: 0xffd76b,
};

/** Shop price in gold. A stage pays enough for one B; an S is worth saving two stages for. */
export const SHOP_PRICE: Record<HeroRarity, number> = { C: 0, B: 10, A: 20, S: 35 };

/** Ascending, so the odds list and the shop read in the same order everywhere. */
export const RARITY_ORDER: HeroRarity[] = ['C', 'B', 'A', 'S'];
