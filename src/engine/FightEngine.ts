import Phaser from 'phaser';
import { ROLE_THREAT_MULTIPLIER, TAUNT_THREAT } from '../data/heroes';
import type { BossDef, BossState, FightEvent, FightOutcome, HeroDef, HeroRole, HeroState } from '../types';

/** Sentinel target id meaning "the boss" for ability casts. */
export const BOSS_TARGET = 'boss';

/** Tie-break when several heroes sit on the same threat (notably 0 at fight start). */
const ROLE_AGGRO_PRIORITY: Record<HeroRole, number> = { tank: 2, dps: 1, heal: 0 };

/** Stagger initial cooldowns so the whole party doesn't swing on the same frame. */
function staggeredAttackCd(def: HeroDef, index: number, partySize: number): number {
  return (def.attackIntervalMs / partySize) * index;
}

export function lowestHpAlly(heroes: HeroState[]): HeroState | undefined {
  let best: HeroState | undefined;
  for (const h of heroes) {
    if (!h.alive) continue;
    if (!best || h.hp / h.def.maxHp < best.hp / best.def.maxHp) best = h;
  }
  return best;
}

/**
 * Real-time fight simulation. Pure state + events — never touches sprites.
 * Views subscribe to FightEvent emissions and animate accordingly.
 */
export class FightEngine extends Phaser.Events.EventEmitter {
  readonly heroes: HeroState[];
  readonly boss: BossState;
  outcome: FightOutcome = 'ongoing';
  /** 1-based run level — how many bosses deep this run is. */
  level = 1;
  /** The party (and the boss) hold their idle until the first ability of the fight. */
  started = false;

  constructor(heroDefs: HeroDef[], bossDef: BossDef) {
    super();
    this.heroes = heroDefs.map((def, i) => ({
      def,
      hp: def.maxHp,
      shield: 0,
      alive: true,
      attackCd: staggeredAttackCd(def, i, heroDefs.length),
      abilityCd: 0,
      threat: 0,
    }));
    this.boss = { def: bossDef, hp: bossDef.maxHp, alive: true, attackCd: bossDef.attackIntervalMs };
  }

  /**
   * Next step of an endless run: swap in the scaled boss and restore the party
   * (revived, full hp, no shield, cooldowns rewound).
   */
  startNextBoss(bossDef: BossDef): void {
    this.level += 1;
    this.boss.def = bossDef;
    this.boss.hp = bossDef.maxHp;
    this.boss.alive = true;
    this.boss.attackCd = bossDef.attackIntervalMs;

    this.heroes.forEach((h, i) => {
      h.hp = h.def.maxHp;
      h.shield = 0;
      h.alive = true;
      h.attackCd = staggeredAttackCd(h.def, i, this.heroes.length);
      h.abilityCd = 0;
      h.threat = 0;
    });

    this.outcome = 'ongoing';
    this.started = false;
    this.emit('fight', { type: 'boss_spawn', level: this.level } as FightEvent);
  }

  hero(id: string): HeroState | undefined {
    return this.heroes.find(h => h.def.id === id);
  }

  isAbilityReady(id: string): boolean {
    const h = this.hero(id);
    return !!h && h.alive && h.abilityCd <= 0;
  }

  /** 0 = just cast, 1 = ready. */
  abilityProgress(id: string): number {
    const h = this.hero(id);
    if (!h) return 0;
    return 1 - h.abilityCd / h.def.ability.cooldownMs;
  }

  /** Highest-threat living hero — the boss's next victim, and the aggro marker's owner. */
  topThreatHero(): HeroState | undefined {
    let best: HeroState | undefined;
    for (const h of this.heroes) {
      if (!h.alive) continue;
      if (!best || this.outAggros(h, best)) best = h;
    }
    return best;
  }

  private outAggros(h: HeroState, best: HeroState): boolean {
    if (h.threat !== best.threat) return h.threat > best.threat;
    return ROLE_AGGRO_PRIORITY[h.def.role] > ROLE_AGGRO_PRIORITY[best.def.role];
  }

  /** Highest threat in the party, alive or not — the scale for threat bars. */
  maxThreat(): number {
    return this.heroes.reduce((m, h) => Math.max(m, h.threat), 0);
  }

  tick(deltaMs: number): void {
    if (this.outcome !== 'ongoing' || !this.started) return;

    for (const h of this.heroes) {
      if (!h.alive) continue;
      h.abilityCd = Math.max(0, h.abilityCd - deltaMs);
      h.attackCd -= deltaMs;
      if (h.attackCd <= 0) {
        h.attackCd += h.def.attackIntervalMs;
        this.autoAct(h);
        if (this.outcome !== 'ongoing') return;
      }
    }

    this.boss.attackCd -= deltaMs;
    if (this.boss.attackCd <= 0) {
      this.boss.attackCd += this.boss.def.attackIntervalMs;
      const target = this.pickBossTarget();
      if (target) {
        this.emit('fight', { type: 'boss_attack', heroId: target.def.id } as FightEvent);
        this.damageHero(target, this.boss.def.attack);
      }
    }

    this.checkEnd();
  }

  /** A hero's auto-attack: damage for tank/dps, heal the weakest ally for healers. */
  private autoAct(h: HeroState): void {
    if (h.def.role === 'heal') {
      const target = lowestHpAlly(this.heroes);
      if (!target || target.hp >= target.def.maxHp) return;
      this.emit('fight', { type: 'hero_attack', heroId: h.def.id, targetHeroId: target.def.id } as FightEvent);
      this.healHero(target, h.def.attack, h);
      return;
    }
    this.emit('fight', { type: 'hero_attack', heroId: h.def.id } as FightEvent);
    this.damageBoss(h.def.attack, h);
  }

  /** Returns false when the cast is rejected (dead, on cooldown, wrong target). */
  castAbility(heroId: string, targetId: string): boolean {
    if (this.outcome !== 'ongoing') return false;
    const h = this.hero(heroId);
    if (!h || !h.alive || h.abilityCd > 0) return false;

    const ability = h.def.ability;
    let target: HeroState | undefined;
    if (ability.targetKind === 'boss') {
      if (targetId !== BOSS_TARGET || !this.boss.alive) return false;
    } else {
      target = this.hero(targetId);
      if (!target || !target.alive) return false;
    }

    h.abilityCd = ability.cooldownMs;
    // The party idles until someone opens with an ability — that cast starts the fight.
    if (!this.started) {
      this.started = true;
      this.emit('fight', { type: 'fight_start' } as FightEvent);
    }
    this.emit('fight', { type: 'hero_cast', heroId, targetHeroId: target?.def.id } as FightEvent);

    if (ability.taunt) this.applyTaunt(h);
    if (ability.selfShield) h.shield += ability.selfShield;
    if (ability.damage) this.damageBoss(ability.damage, h);
    if (ability.heal && target) this.healHero(target, ability.heal, h);

    this.checkEnd();
    return true;
  }

  /** Wipes the party's threat and leaves the caster on top of the table. */
  private applyTaunt(h: HeroState): void {
    for (const other of this.heroes) other.threat = 0;
    h.threat = TAUNT_THREAT;
    this.emit('fight', { type: 'hero_taunt', heroId: h.def.id } as FightEvent);
  }

  private addThreat(h: HeroState, amount: number): void {
    if (!h.alive || amount <= 0) return;
    h.threat += amount * ROLE_THREAT_MULTIPLIER[h.def.role];
  }

  /** The boss swings at whoever holds the most threat. */
  private pickBossTarget(): HeroState | undefined {
    return this.topThreatHero();
  }

  private damageBoss(amount: number, source?: HeroState): void {
    if (!this.boss.alive) return;
    this.boss.hp = Math.max(0, this.boss.hp - amount);
    if (source) this.addThreat(source, amount);
    this.emit('fight', { type: 'boss_damaged', amount } as FightEvent);
    if (this.boss.hp === 0) this.boss.alive = false;
  }

  private damageHero(h: HeroState, amount: number): void {
    const absorbed = Math.min(h.shield, amount);
    h.shield -= absorbed;
    h.hp = Math.max(0, h.hp - (amount - absorbed));
    this.emit('fight', { type: 'hero_damaged', heroId: h.def.id, amount } as FightEvent);
    if (h.hp === 0) {
      h.alive = false;
      h.shield = 0;
      this.emit('fight', { type: 'hero_death', heroId: h.def.id } as FightEvent);
    }
  }

  private healHero(h: HeroState, amount: number, source?: HeroState): void {
    if (!h.alive) return;
    const applied = Math.min(amount, h.def.maxHp - h.hp);
    h.hp += applied;
    if (source) this.addThreat(source, applied);
    this.emit('fight', { type: 'hero_healed', heroId: h.def.id, amount: applied } as FightEvent);
  }

  private checkEnd(): void {
    if (this.outcome !== 'ongoing') return;
    if (!this.boss.alive) this.outcome = 'victory';
    else if (this.heroes.every(h => !h.alive)) this.outcome = 'defeat';
    else return;
    this.emit('fight', { type: 'end', outcome: this.outcome, level: this.level } as FightEvent);
  }
}
