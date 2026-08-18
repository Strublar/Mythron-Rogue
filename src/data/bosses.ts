import type { BossDef } from '../types';

export const SHADOWLORD: BossDef = {
  id: 'shadowlord',
  unitKey: 'boss_shadowlord',
  name: 'Shadowlord',
  // Difficulty 1 is fought by a *full* seven at base stats: winnable on auto-attacks plus
  // abilities, lethal to a team that never casts.
  maxHp: 9600,
  attack: 150,
  attackIntervalMs: 1650,
};

// Difficulty ladder: the team never gains bodies, only account levels (LEVEL_GROWTH tops
// out around +45% hp / +36% attack at level 10, plus a passive), so the curve stays gentle
// enough that upgrading a team is what unlocks the next rung.
const HP_GROWTH = 1.1;
const ATTACK_GROWTH = 1.08;
const INTERVAL_DECAY = 0.99;
const MIN_ATTACK_INTERVAL_MS = 900;

/** Boss for a 1-based difficulty. Difficulty 1 is the untouched base definition. */
export function bossForDifficulty(difficulty: number): BossDef {
  const steps = Math.max(0, difficulty - 1);
  if (steps === 0) return SHADOWLORD;
  return {
    ...SHADOWLORD,
    id: `${SHADOWLORD.id}_d${difficulty}`,
    name: `${SHADOWLORD.name} +${steps}`,
    maxHp: Math.round(SHADOWLORD.maxHp * HP_GROWTH ** steps),
    attack: Math.round(SHADOWLORD.attack * ATTACK_GROWTH ** steps),
    attackIntervalMs: Math.max(
      MIN_ATTACK_INTERVAL_MS,
      Math.round(SHADOWLORD.attackIntervalMs * INTERVAL_DECAY ** steps),
    ),
  };
}
