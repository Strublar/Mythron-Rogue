import Phaser from 'phaser';
import type { BossDef, BossState, FightEvent, FightOutcome, HeroDef, HeroRole, HeroState } from '../types';

/** Sentinel target id meaning "the boss" for ability casts. */
export const BOSS_TARGET = 'boss';

export function livingByRole(heroes: HeroState[], role: HeroRole): HeroState[] {
  return heroes.filter(h => h.alive && h.def.role === role);
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

  constructor(heroDefs: HeroDef[], bossDef: BossDef) {
    super();
    // Stagger initial cooldowns so the whole party doesn't swing on the same frame.
    this.heroes = heroDefs.map((def, i) => ({
      def,
      hp: def.maxHp,
      shield: 0,
      alive: true,
      attackCd: (def.attackIntervalMs / heroDefs.length) * i,
      abilityCd: 0,
    }));
    this.boss = { def: bossDef, hp: bossDef.maxHp, alive: true, attackCd: bossDef.attackIntervalMs };
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

  tick(deltaMs: number): void {
    if (this.outcome !== 'ongoing') return;

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
      this.healHero(target, h.def.attack);
      return;
    }
    this.emit('fight', { type: 'hero_attack', heroId: h.def.id } as FightEvent);
    this.damageBoss(h.def.attack);
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
    this.emit('fight', { type: 'hero_cast', heroId, targetHeroId: target?.def.id } as FightEvent);

    if (ability.selfShield) h.shield += ability.selfShield;
    if (ability.damage) this.damageBoss(ability.damage);
    if (ability.heal && target) this.healHero(target, ability.heal);

    this.checkEnd();
    return true;
  }

  /** Random living tank; falls back to any living hero once the front row is gone. */
  private pickBossTarget(): HeroState | undefined {
    const tanks = livingByRole(this.heroes, 'tank');
    const pool = tanks.length > 0 ? tanks : this.heroes.filter(h => h.alive);
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private damageBoss(amount: number): void {
    if (!this.boss.alive) return;
    this.boss.hp = Math.max(0, this.boss.hp - amount);
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

  private healHero(h: HeroState, amount: number): void {
    if (!h.alive) return;
    const applied = Math.min(amount, h.def.maxHp - h.hp);
    h.hp += applied;
    this.emit('fight', { type: 'hero_healed', heroId: h.def.id, amount: applied } as FightEvent);
  }

  private checkEnd(): void {
    if (this.outcome !== 'ongoing') return;
    if (!this.boss.alive) this.outcome = 'victory';
    else if (this.heroes.every(h => !h.alive)) this.outcome = 'defeat';
    else return;
    this.emit('fight', { type: 'end', outcome: this.outcome } as FightEvent);
  }
}
