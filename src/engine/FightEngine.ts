import Phaser from 'phaser';
import { ROLE_THREAT_MULTIPLIER, TAUNT_THREAT } from '../data/heroes';
import { haste } from '../data/statMath';
import type {
  Ability, BoonAction, BoonTargetKind, BoonTrigger, BoonTriggerSpec, BossDef, BossState,
  FightEvent, FightEventType, FightOutcome, HeroDef, HeroRole, HeroState, TimedBuff,
} from '../types';

/** Sentinel target id meaning "the boss" for ability casts. */
export const BOSS_TARGET = 'boss';

/**
 * The event each trigger listens on. `interval` has none — it runs off `tick`.
 * The `*_hp_below` pair rides the matching damage event and checks its threshold.
 */
const TRIGGER_EVENT: Record<BoonTrigger, FightEventType | undefined> = {
  fight_start: 'fight_start',
  interval: undefined,
  hero_cast: 'hero_cast',
  hero_attack: 'hero_attack',
  hero_taunt: 'hero_taunt',
  boss_damaged: 'boss_damaged',
  hero_damaged: 'hero_damaged',
  hero_healed: 'hero_healed',
  hero_shielded: 'hero_shielded',
  hero_death: 'hero_death',
  overheal: 'overheal',
  shield_broken: 'shield_broken',
  boss_hp_below: 'boss_damaged',
  hero_hp_below: 'hero_damaged',
};

/**
 * Per-fight bookkeeping of one hero passive: nth counter, own cooldown, once-flag.
 * `ownerId` is its hero — only that hero's events wake it, and `'scope'` is that hero.
 */
interface TriggerSlot {
  spec: BoonTriggerSpec;
  ownerId: string;
  n: number;
  cd: number;
  sinceMs: number;
  used: boolean;
}

function triggerSlot(from: Pick<TriggerSlot, 'spec' | 'ownerId'>): TriggerSlot {
  return { ...from, n: 0, cd: 0, sinceMs: 0, used: false };
}

const DEFAULT_INTERVAL_MS = 5000;

/** Tie-break when several heroes sit on the same threat (notably 0 at fight start). */
const ROLE_AGGRO_PRIORITY: Record<HeroRole, number> = { tank: 2, dps: 1, heal: 0 };

/** Stagger initial cooldowns so the whole party doesn't swing on the same frame. */
function staggeredAttackCd(def: HeroDef, index: number, partySize: number): number {
  return (def.attackIntervalMs / partySize) * index;
}

/** Running buffs stack additively on top of the def's base stats. */
function buffPct(h: HeroState, key: 'attackPct' | 'attackSpeedPct'): number {
  return h.buffs.reduce((total, b) => total + b[key], 0);
}

/** Auto-attack damage (heal, for a healer) with running buffs folded in. */
export function heroAttack(h: HeroState): number {
  return Math.round(h.def.attack * (1 + buffPct(h, 'attackPct') / 100));
}

/** Swing interval with running haste folded in. */
export function heroInterval(h: HeroState): number {
  return haste(h.def.attackIntervalMs, buffPct(h, 'attackSpeedPct'));
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
  /** 1-based index of the encounter being fought — carried on `boss_spawn` / `end`. */
  readonly level: number;
  /** The party (and the boss) hold their idle until the first ability of the fight. */
  started = false;

  /** Owned triggers: one slot per hero passive. */
  private triggers: TriggerSlot[] = [];
  /** A trigger's own payload never wakes another trigger: one level deep, no chains. */
  private firing = false;

  constructor(heroDefs: HeroDef[], bossDef: BossDef, level = 1) {
    super();
    this.level = level;
    this.heroes = heroDefs.map((def, i) => ({
      def,
      hp: def.maxHp,
      shield: 0,
      alive: true,
      attackCd: staggeredAttackCd(def, i, heroDefs.length),
      abilityCd: 0,
      threat: 0,
      buffs: [],
    }));
    this.boss = {
      def: bossDef, hp: bossDef.maxHp, alive: true, attackCd: bossDef.attackIntervalMs, dots: [],
    };
    this.rebuildTriggers();
  }

  /** One slot per passive the party's defs carry. */
  private rebuildTriggers(): void {
    this.triggers = this.heroes
      .filter(h => h.def.passive)
      .map(h => triggerSlot({ spec: h.def.passive!.trigger, ownerId: h.def.id }));
  }

  /** A slot only ever listens to its own hero's events. */
  private slotCovers(t: TriggerSlot, def: HeroDef): boolean {
    return t.ownerId === def.id;
  }

  /** Every state change leaves through here: views get the event, passives get a chance to fire. */
  private signal(ev: FightEvent): void {
    this.emit('fight', ev);
    if (this.triggers.length === 0 || this.firing) return;
    for (const t of this.triggers) {
      if (TRIGGER_EVENT[t.spec.on] === ev.type && this.passes(t, ev)) {
        this.runAction(t, t.spec.do, ev);
      }
    }
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

    this.tickTriggers(deltaMs);
    if (this.outcome !== 'ongoing') return;

    this.tickDots(deltaMs);
    if (this.outcome !== 'ongoing') return;

    for (const h of this.heroes) {
      if (!h.alive) continue;
      this.tickBuffs(h, deltaMs);
      h.abilityCd = Math.max(0, h.abilityCd - deltaMs);
      h.attackCd -= deltaMs;
      if (h.attackCd <= 0) {
        h.attackCd += heroInterval(h);
        this.autoAct(h);
        if (this.outcome !== 'ongoing') return;
      }
    }

    this.boss.attackCd -= deltaMs;
    if (this.boss.attackCd <= 0) {
      this.boss.attackCd += this.boss.def.attackIntervalMs;
      const target = this.pickBossTarget();
      if (target) {
        this.signal({ type: 'boss_attack', heroId: target.def.id });
        this.damageHero(target, this.boss.def.attack);
      }
    }

    this.checkEnd();
  }

  /** Runs every trigger's own clocks: internal cooldowns and `interval` payloads. */
  private tickTriggers(deltaMs: number): void {
    for (const t of this.triggers) {
      if (t.cd > 0) t.cd = Math.max(0, t.cd - deltaMs);
      const spec = t.spec;
      if (spec.on !== 'interval' || !this.ownerAlive(t)) continue;
      const period = spec.when?.intervalMs ?? DEFAULT_INTERVAL_MS;
      t.sinceMs += deltaMs;
      while (t.sinceMs >= period && this.outcome === 'ongoing') {
        t.sinceMs -= period;
        this.runAction(t, spec.do, {});
      }
    }
  }

  /** Expire finished buffs; the survivors keep shortening this hero's swings. */
  private tickBuffs(h: HeroState, deltaMs: number): void {
    if (h.buffs.length === 0) return;
    for (const b of h.buffs) b.remainingMs -= deltaMs;
    const live = h.buffs.filter(b => b.remainingMs > 0);
    if (live.length !== h.buffs.length) h.buffs.splice(0, h.buffs.length, ...live);
  }

  /** Bleed every running dot into the boss, crediting its caster with the threat. */
  private tickDots(deltaMs: number): void {
    if (this.boss.dots.length === 0 || !this.boss.alive) return;
    for (const dot of this.boss.dots) {
      // Only the slice of this frame the dot was still alive for counts towards its next tick.
      const alive = Math.min(deltaMs, Math.max(0, dot.remainingMs));
      dot.remainingMs -= deltaMs;
      dot.sinceTick += alive;
      while (dot.sinceTick >= dot.tickMs && this.boss.alive) {
        dot.sinceTick -= dot.tickMs;
        // damageBoss already emits `boss_damaged`, so the tick shows up like any other hit.
        this.damageBoss(dot.damage, this.hero(dot.sourceId), true);
      }
    }
    const live = this.boss.dots.filter(d => d.remainingMs > 0);
    if (live.length !== this.boss.dots.length) this.boss.dots.splice(0, this.boss.dots.length, ...live);
    this.checkEnd();
  }

  /** A hero's auto-attack: damage for tank/dps, heal the weakest ally for healers. */
  private autoAct(h: HeroState): void {
    const power = heroAttack(h);
    if (h.def.role === 'heal') {
      const target = lowestHpAlly(this.heroes);
      if (!target || target.hp >= target.def.maxHp) return;
      this.signal({ type: 'hero_attack', heroId: h.def.id, targetHeroId: target.def.id });
      this.healHero(target, power, h);
      return;
    }
    this.signal({ type: 'hero_attack', heroId: h.def.id });
    this.damageBoss(power, h);
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
      this.signal({ type: 'fight_start' });
    }
    this.signal({ type: 'hero_cast', heroId, targetHeroId: target?.def.id });

    this.resolveAbility(ability, h, target);

    this.checkEnd();
    return true;
  }

  /** Every ability primitive, applied in order. `target` is set for ally-targeted casts. */
  private resolveAbility(a: Ability, h: HeroState, target?: HeroState): void {
    if (a.taunt) this.applyTaunt(h);
    if (a.selfShield) this.shieldHero(h, a.selfShield, h);
    if (a.allyShield && target) this.shieldHero(target, a.allyShield, h);

    const dealt = this.abilityDamage(a);
    if (dealt) {
      this.damageBoss(dealt, h);
      if (a.lifestealPct) this.healHero(h, Math.round((dealt * a.lifestealPct) / 100));
    }
    if (a.dot) {
      this.boss.dots.push({
        damage: a.dot.damage, tickMs: a.dot.tickMs,
        remainingMs: a.dot.durationMs, sinceTick: 0, sourceId: h.def.id,
      });
    }
    if (a.bossStunMs) {
      this.boss.attackCd += a.bossStunMs;
      this.signal({ type: 'boss_stunned', amount: a.bossStunMs });
    }

    if (a.heal && target) this.healHero(target, a.heal, h);
    if (a.selfHeal) this.healHero(h, a.selfHeal, h);
    if (a.partyHeal) for (const ally of this.heroes) this.healHero(ally, a.partyHeal, h);
    if (a.buff) this.applyBuff(a, h, target);

    // Applied last so a fade isn't undone by the threat the cast itself generated.
    if (a.threatFlat) h.threat = Math.max(0, h.threat + a.threatFlat);
  }

  /** Base damage plus the execute bonus when the boss is under its hp threshold. */
  private abilityDamage(a: Ability): number {
    const base = a.damage ?? 0;
    if (!a.executeBonus || a.executeBelowPct === undefined) return base;
    const hpPct = (this.boss.hp / this.boss.def.maxHp) * 100;
    return hpPct <= a.executeBelowPct ? base + a.executeBonus : base;
  }

  private shieldHero(h: HeroState, amount: number, source?: HeroState): void {
    if (!h.alive) return;
    h.shield += amount;
    this.signal({ type: 'hero_shielded', heroId: h.def.id, amount, sourceHeroId: source?.def.id });
  }

  private applyBuff(a: Ability, caster: HeroState, target?: HeroState): void {
    const buff = a.buff!;
    const receivers =
      buff.target === 'party' ? this.heroes
      : buff.target === 'ally' ? [target ?? caster]
      : [caster];
    for (const h of receivers) this.grantBuff(h, buff);
  }

  /** The one place a timed buff is planted — abilities and passive triggers share it. */
  private grantBuff(h: HeroState, buff: TimedBuff): void {
    if (!h.alive) return;
    h.buffs.push({
      attackPct: buff.attackPct ?? 0,
      attackSpeedPct: buff.attackSpeedPct ?? 0,
      remainingMs: buff.durationMs,
    });
    this.signal({ type: 'hero_buffed', heroId: h.def.id, amount: buff.durationMs });
  }

  /** A dead hero's passive lies dormant. */
  private ownerAlive(t: TriggerSlot): boolean {
    return !!this.hero(t.ownerId)?.alive;
  }

  /** Conditions of one trigger slot. Counters and cooldowns are consumed only on a pass. */
  private passes(t: TriggerSlot, ev: FightEvent): boolean {
    const spec = t.spec;
    const w = spec.when ?? {};
    const subject = ev.heroId ? this.hero(ev.heroId) : undefined;
    const source = (ev.sourceHeroId ? this.hero(ev.sourceHeroId) : undefined) ?? subject;
    // Actor-less triggers (fight start) skip the gate — their targets resolve by scope.
    const gate = w.gate === 'actor' ? subject : source;
    if (!this.ownerAlive(t)) return false;
    if (gate && !this.slotCovers(t, gate.def)) return false;
    if (w.fromDot && !ev.fromDot) return false;
    if (spec.on === 'boss_hp_below') {
      if ((this.boss.hp / this.boss.def.maxHp) * 100 > (w.pct ?? 0)) return false;
    }
    if (spec.on === 'hero_hp_below') {
      if (!subject || !subject.alive) return false;
      if ((subject.hp / subject.def.maxHp) * 100 > (w.pct ?? 0)) return false;
    }
    if (t.cd > 0) return false;
    if (w.oncePerFight && t.used) return false;
    if (w.everyNth && ++t.n % w.everyNth !== 0) return false;
    if (w.internalCdMs) t.cd = w.internalCdMs;
    if (w.oncePerFight) t.used = true;
    return true;
  }

  /** Applies a trigger payload through the ordinary primitives, so views animate it as usual. */
  private runAction(t: TriggerSlot, act: BoonAction, ev: Omit<FightEvent, 'type'>): void {
    if (this.firing) return;
    this.firing = true;
    try {
      const subject = ev.heroId ? this.hero(ev.heroId) : undefined;
      const source = (ev.sourceHeroId ? this.hero(ev.sourceHeroId) : undefined) ?? subject;
      const targets = this.actionTargets(t, act.target ?? 'actor', subject, source);
      const amount = ev.amount ?? 0;

      const dmg = (act.bossDamage ?? 0) + Math.round((amount * (act.bossDamagePctOfAmount ?? 0)) / 100);
      if (dmg > 0) this.damageBoss(dmg, source);

      const heal = (act.heal ?? 0) + Math.round((amount * (act.healPctOfAmount ?? 0)) / 100);
      for (const h of targets) {
        if (heal > 0) this.healHero(h, heal);
        if (act.shield) this.shieldHero(h, act.shield);
        if (act.buff) this.grantBuff(h, act.buff);
        if (act.refundCdMs) h.abilityCd = Math.max(0, h.abilityCd - act.refundCdMs);
        if (act.taunt) this.applyTaunt(h);
      }

      if (act.dot && this.boss.alive) {
        this.boss.dots.push({
          damage: act.dot.damage, tickMs: act.dot.tickMs,
          remainingMs: act.dot.durationMs, sinceTick: 0, sourceId: source?.def.id ?? '',
        });
      }
      if (act.bossStunMs) {
        this.boss.attackCd += act.bossStunMs;
        this.signal({ type: 'boss_stunned', amount: act.bossStunMs });
      }
      if (act.repeatCast && source?.alive) {
        const ally = ev.targetHeroId ? this.hero(ev.targetHeroId) : undefined;
        this.resolveAbility(source.def.ability, source, ally);
      }
    } finally {
      this.firing = false;
    }
    this.checkEnd();
  }

  private actionTargets(
    t: TriggerSlot, kind: BoonTargetKind, subject?: HeroState, source?: HeroState,
  ): HeroState[] {
    const living = this.heroes.filter(h => h.alive);
    switch (kind) {
      case 'source': return source?.alive ? [source] : [];
      case 'others': return living.filter(h => h !== subject);
      case 'lowest': { const low = lowestHpAlly(this.heroes); return low ? [low] : []; }
      case 'party': return living;
      // A passive's scope is its owner alone.
      case 'scope': return living.filter(h => this.slotCovers(t, h.def));
      default: return subject?.alive ? [subject] : [];
    }
  }

  /** Wipes the party's threat and leaves the caster on top of the table. */
  private applyTaunt(h: HeroState): void {
    for (const other of this.heroes) other.threat = 0;
    h.threat = TAUNT_THREAT;
    this.signal({ type: 'hero_taunt', heroId: h.def.id });
  }

  private addThreat(h: HeroState, amount: number): void {
    if (!h.alive || amount <= 0) return;
    h.threat += amount * ROLE_THREAT_MULTIPLIER[h.def.role];
  }

  /** The boss swings at whoever holds the most threat. */
  private pickBossTarget(): HeroState | undefined {
    return this.topThreatHero();
  }

  private damageBoss(amount: number, source?: HeroState, fromDot = false): void {
    if (!this.boss.alive) return;
    this.boss.hp = Math.max(0, this.boss.hp - amount);
    if (source) this.addThreat(source, amount);
    if (this.boss.hp === 0) this.boss.alive = false;
    this.signal({ type: 'boss_damaged', amount, sourceHeroId: source?.def.id, fromDot });
  }

  private damageHero(h: HeroState, amount: number): void {
    const absorbed = Math.min(h.shield, amount);
    h.shield -= absorbed;
    h.hp = Math.max(0, h.hp - (amount - absorbed));
    this.signal({ type: 'hero_damaged', heroId: h.def.id, amount });
    // A shield that just ran out is its own event — passives build on the moment it pops.
    if (absorbed > 0 && h.shield === 0 && h.alive) {
      this.signal({ type: 'shield_broken', heroId: h.def.id, amount: absorbed });
    }
    if (h.hp === 0) {
      h.alive = false;
      h.shield = 0;
      this.signal({ type: 'hero_death', heroId: h.def.id });
    }
  }

  private healHero(h: HeroState, amount: number, source?: HeroState): void {
    if (!h.alive) return;
    const applied = Math.min(amount, h.def.maxHp - h.hp);
    h.hp += applied;
    if (source) this.addThreat(source, applied);
    this.signal({ type: 'hero_healed', heroId: h.def.id, amount: applied, sourceHeroId: source?.def.id });
    const wasted = amount - applied;
    if (wasted > 0) {
      this.signal({ type: 'overheal', heroId: h.def.id, amount: wasted, sourceHeroId: source?.def.id });
    }
  }

  private checkEnd(): void {
    if (this.outcome !== 'ongoing') return;
    if (!this.boss.alive) this.outcome = 'victory';
    else if (this.heroes.every(h => !h.alive)) this.outcome = 'defeat';
    else return;
    this.signal({ type: 'end', outcome: this.outcome, level: this.level });
  }
}
