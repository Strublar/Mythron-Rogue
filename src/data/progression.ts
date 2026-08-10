import type { BoonEffect, HeroDef, HeroPassive, HeroProgress } from '../types';
import { PASSIVES } from './passives';
import { growHero, scaleEffect } from './statMath';

/** Ceiling of a hero's progression. */
export const MAX_HERO_LEVEL = 10;
/** The level a hero's unique passive comes online at. */
export const PASSIVE_LEVEL = 5;

/** What one level above 1 is worth. Multiplied by the levels earned, then applied once. */
export const LEVEL_GROWTH: BoonEffect = {
  maxHpPct: 5,
  attackPct: 4,
  attackSpeedPct: 2,
  abilityPowerPct: 4,
};

/** Exp needed to leave the level at this index. Index 0 is unused; index 10 is the cap. */
const EXP_TO_NEXT = [0, 20, 30, 45, 60, 80, 100, 125, 150, 180, 0];

/** Exp an encounter hands each hero that fought it. Later encounters pay more. */
const ENCOUNTER_EXP_BASE = 10;
const ENCOUNTER_EXP_PER_STEP = 10;

export const STARTING_PROGRESS: HeroProgress = { level: 1, exp: 0 };

/** Exp still owed before the next level. 0 once maxed. */
export function expToNext(level: number): number {
  return level >= MAX_HERO_LEVEL ? 0 : EXP_TO_NEXT[level];
}

export function isMaxLevel(p: HeroProgress): boolean {
  return p.level >= MAX_HERO_LEVEL;
}

/** Exp one cleared encounter pays every hero fielded in it. */
export function encounterExp(index: number): number {
  return ENCOUNTER_EXP_BASE + ENCOUNTER_EXP_PER_STEP * Math.max(0, index - 1);
}

/** Banks `gain` exp, rolling levels over. Returns a fresh progress — never mutates. */
export function addExp(p: HeroProgress, gain: number): HeroProgress {
  let { level, exp } = p;
  exp += Math.max(0, gain);
  while (level < MAX_HERO_LEVEL && exp >= expToNext(level)) {
    exp -= expToNext(level);
    level += 1;
  }
  return { level, exp: isMaxLevel({ level, exp }) ? 0 : exp };
}

/**
 * The def a fight resolves against: base roster stats grown by the levels earned, plus
 * the passive once PASSIVE_LEVEL is reached.
 */
export function applyProgress(def: HeroDef, p: HeroProgress): HeroDef {
  const level = Math.min(Math.max(1, p.level), MAX_HERO_LEVEL);
  const grown = growHero(def, scaleEffect(LEVEL_GROWTH, level - 1));
  return {
    ...grown,
    level,
    passive: level >= PASSIVE_LEVEL ? PASSIVES[def.id] : undefined,
  };
}

/** The passive a hero will get (or has) — the collection page previews locked ones. */
export function passiveOf(heroId: string): HeroPassive | undefined {
  return PASSIVES[heroId];
}
