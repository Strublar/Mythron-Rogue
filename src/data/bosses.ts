import type { BossDef } from '../types';

/**
 * The run's boss ladder, fought in order. Stage 1 is tuned for the starter seven — the
 * team the run opens with — and every rung after it assumes one recruit and one shop buy
 * more than the last. The team gains bodies of higher rarity, never levels, so the curve
 * climbs on the back of what the interlude hands out.
 */
export const BOSS_LADDER: BossDef[] = [
  { id: 'wraith', unitKey: 'boss_wraith', name: 'The Wraith',
    maxHp: 6800, attack: 120, attackIntervalMs: 1700 },
  { id: 'cindera', unitKey: 'boss_cindera', name: 'Cindera',
    maxHp: 9200, attack: 145, attackIntervalMs: 1650 },
  { id: 'kron', unitKey: 'boss_kron', name: 'Kron the Unyielding',
    maxHp: 12500, attack: 170, attackIntervalMs: 1600 },
  { id: 'vampire', unitKey: 'boss_vampire', name: 'Bloodbound Countess',
    maxHp: 15800, attack: 190, attackIntervalMs: 1500 },
  { id: 'grym', unitKey: 'boss_grym', name: 'Grym',
    maxHp: 19000, attack: 210, attackIntervalMs: 1450 },
  { id: 'skurge', unitKey: 'boss_skurge', name: 'Skurge',
    maxHp: 22000, attack: 228, attackIntervalMs: 1350 },
  { id: 'serpenti', unitKey: 'boss_serpenti', name: 'Serpenti',
    maxHp: 25000, attack: 245, attackIntervalMs: 1250 },
  { id: 'shadowlord', unitKey: 'boss_shadowlord', name: 'Shadowlord',
    maxHp: 28000, attack: 260, attackIntervalMs: 1150 },
];

// Past the last rung the ladder loops, harder each pass — the run has no other ending
// than a wipe, so the curve has to outrun a fully upgraded seven eventually.
const LOOP_HP_GROWTH = 1.45;
const LOOP_ATTACK_GROWTH = 1.3;
const MIN_ATTACK_INTERVAL_MS = 900;

/** Boss for a 1-based stage. Stages 1..8 are the untouched ladder; beyond it, scaled loops. */
export function bossForStage(stage: number): BossDef {
  const index = Math.max(0, stage - 1);
  const base = BOSS_LADDER[index % BOSS_LADDER.length];
  const loop = Math.floor(index / BOSS_LADDER.length);
  if (loop === 0) return base;
  return {
    ...base,
    id: `${base.id}_l${loop}`,
    name: `${base.name} +${loop}`,
    maxHp: Math.round(base.maxHp * LOOP_HP_GROWTH ** loop),
    attack: Math.round(base.attack * LOOP_ATTACK_GROWTH ** loop),
    attackIntervalMs: Math.max(MIN_ATTACK_INTERVAL_MS, base.attackIntervalMs),
  };
}

/** Gold a cleared stage banks. Spent in that stage's shop, and nowhere else. */
export function goldForStage(stage: number): number {
  return 12 + 5 * Math.max(0, stage - 1);
}
