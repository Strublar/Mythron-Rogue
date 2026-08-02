// Shared types for the team-vs-boss fight engine. Source of truth.

export type HeroRole = 'tank' | 'dps' | 'heal';

/** Where a dragged ability may be dropped. */
export type AbilityTargetKind = 'boss' | 'ally';

/** Damage bleeding out of the boss over time, planted by a cast. */
export interface AbilityDot {
  damage: number;       // per tick
  tickMs: number;
  durationMs: number;
}

/** Temporary stat swing granted by a cast. Percentages, like boons. */
export interface AbilityBuff {
  target: 'self' | 'ally' | 'party';
  durationMs: number;
  attackPct?: number;
  attackSpeedPct?: number;
}

export interface Ability {
  id: string;
  name: string;
  targetKind: AbilityTargetKind;
  cooldownMs: number;
  damage?: number;          // applied to the boss
  heal?: number;            // applied to the target ally
  selfShield?: number;      // absorb granted to the caster
  taunt?: boolean;          // wipes party threat and pins the boss on the caster
  allyShield?: number;      // absorb granted to the target ally
  partyHeal?: number;       // heals every living hero
  selfHeal?: number;        // heals the caster
  lifestealPct?: number;    // % of this cast's boss damage healed back to the caster
  bossStunMs?: number;      // pushes the boss's swing timer back
  executeBelowPct?: number; // boss hp% threshold under which…
  executeBonus?: number;    // …this extra damage lands
  threatFlat?: number;      // flat threat on cast — negative fades the caster out of aggro
  dot?: AbilityDot;
  buff?: AbilityBuff;
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

/** A running buff on a hero. Percentages sum across stacks, like boons. */
export interface ActiveBuff {
  attackPct: number;
  attackSpeedPct: number;
  remainingMs: number;
}

/** A running damage-over-time on the boss. */
export interface ActiveDot {
  damage: number;
  tickMs: number;
  remainingMs: number;
  sinceTick: number;
  sourceId: string;     // hero credited with the threat
}

export interface HeroState {
  def: HeroDef;
  hp: number;
  shield: number;
  alive: boolean;
  attackCd: number;     // ms remaining
  abilityCd: number;    // ms remaining
  threat: number;       // boss aggro score — highest wins the boss's next swing
  buffs: ActiveBuff[];
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
  dots: ActiveDot[];
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
  | 'boss_stunned'
  | 'hero_damaged'
  | 'hero_healed'
  | 'hero_shielded'
  | 'hero_buffed'
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
