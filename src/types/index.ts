// Shared types for the team-vs-boss fight engine. Source of truth.

export type HeroRole = 'tank' | 'dps' | 'heal';

/** Where a dragged ability may be dropped. */
export type AbilityTargetKind = 'boss' | 'ally';

export interface Ability {
  id: string;
  name: string;
  targetKind: AbilityTargetKind;
  cooldownMs: number;
  damage?: number;      // applied to the boss
  heal?: number;        // applied to the target ally
  selfShield?: number;  // absorb granted to the caster
}

export interface HeroDef {
  id: string;
  unitKey: string;      // key into UNIT_DEFS
  name: string;
  role: HeroRole;
  maxHp: number;
  attack: number;       // auto-attack damage — heal amount for healers
  attackIntervalMs: number;
  ability: Ability;
}

export interface HeroState {
  def: HeroDef;
  hp: number;
  shield: number;
  alive: boolean;
  attackCd: number;     // ms remaining
  abilityCd: number;    // ms remaining
}

export interface BossDef {
  id: string;
  unitKey: string;
  name: string;
  maxHp: number;
  attack: number;
  attackIntervalMs: number;
}

export interface BossState {
  def: BossDef;
  hp: number;
  alive: boolean;
  attackCd: number;
}

export type FightOutcome = 'ongoing' | 'victory' | 'defeat';

export type FightEventType =
  | 'hero_attack'
  | 'hero_cast'
  | 'boss_attack'
  | 'boss_damaged'
  | 'hero_damaged'
  | 'hero_healed'
  | 'hero_death'
  | 'end';

export interface FightEvent {
  type: FightEventType;
  heroId?: string;       // actor (hero_attack / hero_cast) or victim (hero_damaged / …)
  targetHeroId?: string; // ally targeted by a heal
  amount?: number;
  outcome?: FightOutcome;
}
