import type { EncounterDef } from '../types';
import { bossForLevel } from './bosses';
import { encounterGold } from './orbs';
import { encounterExp } from './progression';

/** Length of the quest chain. Encounter 1 is always unlocked; the last one has no successor. */
export const ENCOUNTER_COUNT = 8;

/** Clamps `index` inside the chain — menus step through it, so guard both ends. */
export const clampEncounter = (index: number): number =>
  Math.min(Math.max(1, Math.round(index)), ENCOUNTER_COUNT);

/**
 * The single source of what an encounter is: its boss (the scaled Shadowlord) and the
 * exp/gold beating it pays. Nothing else in the game derives rewards.
 */
export function encounterAt(index: number): EncounterDef {
  const i = clampEncounter(index);
  const boss = bossForLevel(i);
  return { index: i, name: boss.name, boss, exp: encounterExp(i), gold: encounterGold(i) };
}

export function allEncounters(): EncounterDef[] {
  return Array.from({ length: ENCOUNTER_COUNT }, (_, i) => encounterAt(i + 1));
}
