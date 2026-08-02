import type { Ability, HeroDef } from '../types';

// Three archetype abilities, shared across the roster — one per role.
export const TANK_ABILITY: Ability = {
  id: 'shield_bash',
  name: 'Shield Bash',
  targetKind: 'boss',
  cooldownMs: 8000,
  damage: 140,
  selfShield: 250,
};

export const DPS_ABILITY: Ability = {
  id: 'burst',
  name: 'Burst',
  targetKind: 'boss',
  cooldownMs: 6000,
  damage: 320,
};

export const HEAL_ABILITY: Ability = {
  id: 'mend',
  name: 'Mend',
  targetKind: 'ally',
  cooldownMs: 5000,
  heal: 260,
};

const TANK_BASE = { role: 'tank', maxHp: 900, attack: 25, attackIntervalMs: 1400, ability: TANK_ABILITY } as const;
const DPS_BASE = { role: 'dps', maxHp: 450, attack: 55, attackIntervalMs: 1100, ability: DPS_ABILITY } as const;
const HEAL_BASE = { role: 'heal', maxHp: 400, attack: 45, attackIntervalMs: 1600, ability: HEAL_ABILITY } as const;

export const PARTY: HeroDef[] = [
  { ...TANK_BASE, id: 'tank1', unitKey: 'f1_ironcliffeguardian', name: 'Ironcliffe Guardian' },
  { ...TANK_BASE, id: 'tank2', unitKey: 'f1_silvermanevanguard', name: 'Silvermane Vanguard' },
  { ...DPS_BASE, id: 'dps1', unitKey: 'f1_sunforgelancer', name: 'Sunforge Lancer' },
  { ...DPS_BASE, id: 'dps2', unitKey: 'neutral_arakiheadhunter', name: 'Araki Headhunter' },
  { ...DPS_BASE, id: 'dps3', unitKey: 'f3_pyromancer', name: 'Pyromancer' },
  { ...HEAL_BASE, id: 'heal1', unitKey: 'neutral_healingmystic', name: 'Healing Mystic' },
  { ...HEAL_BASE, id: 'heal2', unitKey: 'f1_sunriser', name: 'Sunriser' },
];
