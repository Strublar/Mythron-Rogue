import type { HeroRole } from '../types';

// Portrait, mobile-only. Top half = boss, bottom half = the three party rows.
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// Duelyst atlases are untrimmed square canvases of varying size but share one art
// scale, so every combatant uses a flat multiplier rather than a normalised height.
export const HERO_SCALE = 2.0;
export const BOSS_SCALE = 3.4;

/** Per-role accent — hero health bars and the stats tooltip share it. */
export const ROLE_COLOR: Record<HeroRole, number> = {
  tank: 0x6fd08c,
  dps: 0xffb347,
  heal: 0x7fd4ff,
};

export const BOSS_ANCHOR = { x: GAME_WIDTH / 2, y: 400 };
export const BOSS_BAR_Y = 96;
export const BOSS_GROUND_Y = BOSS_ANCHOR.y + 130;

/** Offsets from a hero slot: health bar above, ground ring at the row baseline. */
export const HERO_BAR_DY = -84;
export const HERO_GROUND_DY = 52;

/** Slot centres per row, tanks nearest the boss. */
export const HERO_SLOTS: Record<HeroRole, { x: number; y: number }[]> = {
  tank: [
    { x: 250, y: 800 },
    { x: 470, y: 800 },
  ],
  dps: [
    { x: 165, y: 980 },
    { x: 360, y: 980 },
    { x: 555, y: 980 },
  ],
  heal: [
    { x: 250, y: 1165 },
    { x: 470, y: 1165 },
  ],
};

/** Pairs each def with its row slot, in roster order — the one place slots get handed out. */
export function withSlots<T extends { role: HeroRole }>(
  defs: T[],
): { def: T; slot: { x: number; y: number } }[] {
  const next = { tank: 0, dps: 0, heal: 0 };
  return defs.map(def => ({ def, slot: HERO_SLOTS[def.role][next[def.role]++] }));
}
