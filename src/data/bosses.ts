import type { BossDef } from '../types';

export const SHADOWLORD: BossDef = {
  id: 'shadowlord',
  unitKey: 'boss_shadowlord',
  name: 'Shadowlord',
  // Tuned so idle auto-attacks alone lose the tank line: winning needs abilities.
  maxHp: 12000,
  attack: 200,
  attackIntervalMs: 1800,
};
