// Shared types for the team-vs-boss fight engine. Source of truth.

export type HeroRole = 'tank' | 'dps' | 'heal';

/** Identity tags every hero carries: one faction, one archetype. Flavour and card copy. */
export type HeroFaction =
  | 'lyonar' | 'songhai' | 'vetruvian' | 'abyssian' | 'magmar' | 'vanar' | 'mercenary';
export type HeroArchetype = 'arcanyst' | 'blade' | 'golem' | 'beast' | 'blood';
export type HeroTag = HeroFaction | HeroArchetype;

/** Where a dragged ability may be dropped. */
export type AbilityTargetKind = 'boss' | 'ally';

/** Damage bleeding out of the boss over time, planted by a cast. */
export interface AbilityDot {
  damage: number;       // per tick
  tickMs: number;
  durationMs: number;
}

/** A timed stat swing, in percent. Granted by casts and by passive triggers. */
export interface TimedBuff {
  durationMs: number;
  attackPct?: number;
  attackSpeedPct?: number;
}

/** Temporary stat swing granted by a cast. */
export interface AbilityBuff extends TimedBuff {
  target: 'self' | 'ally' | 'party';
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

/** Collection tier. Sets how often an orb rolls the hero, nothing else. */
export type HeroRarity = 'B' | 'A' | 'S';

export interface HeroDef {
  id: string;
  unitKey: string;      // key into UNIT_DEFS
  name: string;
  role: HeroRole;
  tags: HeroTag[];      // faction + archetype — identity and card copy
  rarity: HeroRarity;   // orb pull weight and card tint — never touches stats
  maxHp: number;
  attack: number;       // auto-attack damage — heal amount for healers
  attackIntervalMs: number;
  ability: Ability;
  /** Progression level, 1…MAX_HERO_LEVEL. Absent on the raw roster entries. */
  level?: number;
  /** Set by `applyProgress` once the hero reaches PASSIVE_LEVEL. */
  passive?: HeroPassive;
}

/**
 * A hero's account-wide progression: levels earned across encounters. Persisted, never
 * part of a fight — `applyProgress` folds it into the `HeroDef` the fight starts from.
 */
export interface HeroProgress {
  level: number;
  exp: number;          // toward the next level
}

/**
 * Everything that survives an encounter: per-hero levels, the heroes owned, the purse,
 * the saved roster and how far the quest chain has been cleared.
 */
export interface AccountState {
  heroes: Record<string, HeroProgress>;
  owned: string[];
  gold: number;
  /** Hero ids of the saved party, in tank → dps → heal slot order. */
  party: string[];
  /** How many encounters of the chain are beaten. `cleared + 1` is the next one. */
  cleared: number;
}

/** The result of one orb, for the shop's reveal panel. */
export interface OrbPull {
  hero: HeroDef;
  rarity: HeroRarity;
  /** Already owned — the pull paid `exp` to that hero instead of unlocking it. */
  duplicate: boolean;
  exp: number;
  /** The duplicated hero's progress after the exp landed. Absent on a new hero. */
  progress?: HeroProgress;
}

/**
 * The one thing a hero unlocks at PASSIVE_LEVEL. Always on, no cooldown bar, no cast —
 * it rides the shared trigger machinery, owned by a single hero.
 */
export interface HeroPassive {
  id: string;
  name: string;
  /** Player-facing copy — passives are hand-written, unlike generated ability text. */
  text: string;
  trigger: BoonTriggerSpec;
}

/** A running buff on a hero. Percentages sum across stacks. */
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

/** Every field is a percent bonus, additive across stacks of the same effect. */
export interface BoonEffect {
  maxHpPct?: number;
  attackPct?: number;        // auto-attack damage — heal amount for healers
  attackSpeedPct?: number;   // haste: shortens attackIntervalMs
  abilityPowerPct?: number;  // ability damage / heal / shield
  cooldownPct?: number;      // haste: shortens the ability cooldown
}

/**
 * What wakes a trigger up. All but `interval` ride a `FightEvent`;
 * the `*_hp_below` pair listens on damage and checks a threshold.
 */
export type BoonTrigger =
  | 'fight_start' | 'interval' | 'hero_cast' | 'hero_attack' | 'hero_taunt'
  | 'boss_damaged' | 'hero_damaged' | 'hero_healed' | 'hero_shielded'
  | 'hero_death' | 'overheal' | 'shield_broken'
  | 'boss_hp_below' | 'hero_hp_below';

/**
 * Who a trigger's payload lands on. `actor` is the hero the event happened *to*,
 * `source` the hero that caused it, `scope` every living hero the trigger covers.
 */
export type BoonTargetKind = 'actor' | 'source' | 'others' | 'lowest' | 'party' | 'scope';

/** Gates a trigger. Every field is optional — an absent field never blocks. */
export interface BoonCondition {
  pct?: number;              // hp% threshold for boss_hp_below / hero_hp_below
  everyNth?: number;         // fires one time in N
  intervalMs?: number;       // period of an `interval` trigger
  internalCdMs?: number;     // own cooldown, ms
  oncePerFight?: boolean;
  fromDot?: boolean;         // boss_damaged: dot ticks only
  /** Whose role/tags the scope is checked against. Default 'source'. */
  gate?: 'source' | 'actor';
}

/** What a trigger does once it passes. Resolved through the engine's own primitives. */
export interface BoonAction {
  target?: BoonTargetKind;      // default 'actor'
  bossDamage?: number;
  bossDamagePctOfAmount?: number; // % of the triggering amount, dealt to the boss
  heal?: number;
  healPctOfAmount?: number;
  shield?: number;
  buff?: TimedBuff;
  dot?: AbilityDot;
  refundCdMs?: number;          // ability cooldown handed back
  bossStunMs?: number;
  taunt?: boolean;
  repeatCast?: boolean;         // resolve the caster's ability a second time, free
}

export interface BoonTriggerSpec {
  on: BoonTrigger;
  when?: BoonCondition;
  do: BoonAction;
}

export interface BossDef {
  id: string;
  unitKey: string;
  name: string;
  maxHp: number;
  attack: number;
  attackIntervalMs: number;
}

/**
 * One fight of the quest chain: the boss it fields and what beating it pays. Encounter 1
 * is the base boss; each step up scales it and pays more.
 */
export interface EncounterDef {
  index: number;        // 1-based position in the chain
  name: string;
  boss: BossDef;
  /** Exp handed to every hero fielded. */
  exp: number;
  gold: number;
}

export interface BossState {
  def: BossDef;
  hp: number;
  alive: boolean;
  attackCd: number;
  dots: ActiveDot[];
}

/** 'victory' = the boss is down, 'defeat' = the party is wiped. Either ends the encounter. */
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
  | 'overheal'
  | 'shield_broken'
  | 'end';

export interface FightEvent {
  type: FightEventType;
  heroId?: string;       // actor (hero_attack / hero_cast) or victim (hero_damaged / …)
  targetHeroId?: string; // ally targeted by a heal
  sourceHeroId?: string; // hero that caused it — the healer, shielder or damage dealer
  fromDot?: boolean;     // boss_damaged: this hit is a dot tick
  amount?: number;
  outcome?: FightOutcome;
  level?: number;        // encounter index (boss_spawn / end)
}
