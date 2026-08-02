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
  taunt?: boolean;      // wipes party threat and pins the boss on the caster
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
  threat: number;       // boss aggro score — highest wins the boss's next swing
}

/** Who a boon buffs: one role, or every hero. */
export type BoonScope = HeroRole | 'party';

/** Every field is a percent bonus, additive across stacks of the same effect. */
export interface BoonEffect {
  maxHpPct?: number;
  attackPct?: number;        // auto-attack damage — heal amount for healers
  attackSpeedPct?: number;   // haste: shortens attackIntervalMs
  abilityPowerPct?: number;  // ability damage / heal / shield
  cooldownPct?: number;      // haste: shortens the ability cooldown
}

/** A permanent run upgrade, picked between fights. Stacks with itself. */
export interface BoonDef {
  id: string;
  name: string;
  scope: BoonScope;
  effect: BoonEffect;
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

/** 'victory' = the current boss is down; the run itself only ends on 'defeat'. */
export type FightOutcome = 'ongoing' | 'victory' | 'defeat';

export type FightEventType =
  | 'boss_spawn'
  | 'fight_start'
  | 'hero_taunt'
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
  level?: number;        // run level (boss_spawn / end)
}
