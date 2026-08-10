import type { BossDef } from '../types';

export const SHADOWLORD: BossDef = {
  id: 'shadowlord',
  unitKey: 'boss_shadowlord',
  name: 'Shadowlord',
  // Level 1 is fought by the general *alone*, so the base is tuned for a single hero:
  // winnable on auto-attacks plus its ability, lethal if the ability is never cast.
  maxHp: 1600,
  attack: 55,
  attackIntervalMs: 2000,
};

// Endless run scaling: each cleared boss makes the next one tankier, hit harder and
// swing slightly faster, down to a floor so the fight stays readable. The party grows a
// unit per level up to seven, so the curve covers both the extra bodies and the difficulty.
const HP_GROWTH = 1.35;
const ATTACK_GROWTH = 1.18;
const INTERVAL_DECAY = 0.97;
const MIN_ATTACK_INTERVAL_MS = 900;

/** Boss for a 1-based run level. Level 1 is the untouched base definition. */
export function bossForLevel(level: number): BossDef {
  const steps = Math.max(0, level - 1);
  if (steps === 0) return SHADOWLORD;
  return {
    ...SHADOWLORD,
    id: `${SHADOWLORD.id}_lv${level}`,
    name: `${SHADOWLORD.name} +${steps}`,
    maxHp: Math.round(SHADOWLORD.maxHp * HP_GROWTH ** steps),
    attack: Math.round(SHADOWLORD.attack * ATTACK_GROWTH ** steps),
    attackIntervalMs: Math.max(
      MIN_ATTACK_INTERVAL_MS,
      Math.round(SHADOWLORD.attackIntervalMs * INTERVAL_DECAY ** steps),
    ),
  };
}
