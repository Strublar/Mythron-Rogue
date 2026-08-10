import type { HeroPassive } from '../types';

/**
 * One passive per hero, unlocked at PASSIVE_LEVEL. Rides the engine's trigger machinery,
 * owner-scoped: only the owner's events wake it, and a `'scope'` target means the owner
 * alone. `text` is hand-written — a passive is identity, not a stat line.
 */
export const PASSIVES: Record<string, HeroPassive> = {
  // ── Tanks ─────────────────────────────────────────────────────────────────
  tank_ironcliffe: {
    id: 'p_bastion', name: 'Bastion',
    text: 'Every 3rd hit taken shields him for 70.',
    trigger: { on: 'hero_damaged', when: { everyNth: 3 }, do: { target: 'actor', shield: 70 } },
  },
  tank_silvermane: {
    id: 'p_warhorn', name: 'Warhorn',
    text: 'His taunt grants the party +12% attack for 4s.',
    trigger: {
      on: 'hero_taunt',
      do: { target: 'party', buff: { durationMs: 4000, attackPct: 12 } },
    },
  },
  tank_primus: {
    id: 'p_unbreakable', name: 'Unbreakable',
    text: 'Once per fight, dropping below 35% HP shields him for 300.',
    trigger: {
      on: 'hero_hp_below',
      when: { pct: 35, oncePerFight: true },
      do: { target: 'actor', shield: 300 },
    },
  },
  tank_tundra: {
    id: 'p_permafrost', name: 'Permafrost',
    text: 'Each of his casts staggers the boss for another 0.7s.',
    trigger: { on: 'hero_cast', do: { bossStunMs: 700 } },
  },
  tank_dervish: {
    id: 'p_whirlwind', name: 'Whirlwind',
    text: 'Every 3rd swing carves an extra 40 off the boss.',
    trigger: { on: 'hero_attack', when: { everyNth: 3 }, do: { bossDamage: 40 } },
  },

  // ── DPS ───────────────────────────────────────────────────────────────────
  dps_lancer: {
    id: 'p_sunbrand', name: 'Sunbrand',
    text: 'His casts brand the boss for 25 every 1s over 4s.',
    trigger: {
      on: 'hero_cast',
      do: { dot: { damage: 25, tickMs: 1000, durationMs: 4000 } },
    },
  },
  dps_araki: {
    id: 'p_bounty', name: 'Bounty',
    text: 'Each cast whets her blades: +20% attack for 5s.',
    trigger: {
      on: 'hero_cast',
      do: { target: 'source', buff: { durationMs: 5000, attackPct: 20 } },
    },
  },
  dps_pyromancer: {
    id: 'p_combustion', name: 'Combustion',
    text: 'Embers burst every 5s, dealing 30 to the boss.',
    trigger: { on: 'interval', when: { intervalMs: 5000 }, do: { bossDamage: 30 } },
  },
  dps_elyx: {
    id: 'p_stormcharged', name: 'Stormcharged',
    text: 'Every 4th swing grants him +25% attack speed for 3s.',
    trigger: {
      on: 'hero_attack',
      when: { everyNth: 4 },
      do: { target: 'source', buff: { durationMs: 3000, attackSpeedPct: 25 } },
    },
  },
  dps_nightsorrow: {
    id: 'p_killing_edge', name: 'Killing Edge',
    text: 'While the boss is under 40% HP, gains +25% attack for 5s (every 6s).',
    trigger: {
      on: 'boss_hp_below',
      when: { pct: 40, internalCdMs: 6000 },
      do: { target: 'scope', buff: { durationMs: 5000, attackPct: 25 } },
    },
  },
  dps_voidhunter: {
    id: 'p_void_echo', name: 'Void Echo',
    text: 'Every cast echoes for another 40 damage.',
    trigger: { on: 'hero_cast', do: { bossDamage: 40 } },
  },
  dps_stormkage: {
    id: 'p_chain_reaction', name: 'Chain Reaction',
    text: 'Every 3rd cast resolves a second time, free.',
    trigger: { on: 'hero_cast', when: { everyNth: 3 }, do: { repeatCast: true } },
  },
  dps_whitewidow: {
    id: 'p_venom_coat', name: 'Venom Coating',
    text: 'Every 4th shot poisons the boss for 12 every 1s over 4s.',
    trigger: {
      on: 'hero_attack',
      when: { everyNth: 4 },
      do: { dot: { damage: 12, tickMs: 1000, durationMs: 4000 } },
    },
  },
  dps_mankator: {
    id: 'p_feral_rage', name: 'Feral Rage',
    text: 'Under 50% HP it rages: +30% attack for 6s (every 10s).',
    trigger: {
      on: 'hero_hp_below',
      when: { pct: 50, internalCdMs: 10000 },
      do: { target: 'actor', buff: { durationMs: 6000, attackPct: 30 } },
    },
  },

  // ── Healers ───────────────────────────────────────────────────────────────
  heal_mystic: {
    id: 'p_gentle_hands', name: 'Gentle Hands',
    text: 'Every 3rd heal she lands spills 45 onto the weakest ally.',
    trigger: { on: 'hero_healed', when: { everyNth: 3 }, do: { target: 'lowest', heal: 45 } },
  },
  heal_sunriser: {
    id: 'p_radiance', name: 'Radiance',
    text: 'Healing wasted on a full ally burns the boss instead.',
    trigger: { on: 'overheal', do: { bossDamagePctOfAmount: 100 } },
  },
  heal_aymara: {
    id: 'p_sunward_ward', name: 'Sunward Ward',
    text: 'Every 4th heal she lands also shields its target for 60.',
    trigger: { on: 'hero_healed', when: { everyNth: 4 }, do: { target: 'actor', shield: 60 } },
  },
  heal_bloodstone: {
    id: 'p_blood_price', name: 'Blood Price',
    text: 'Every 3rd heal she lands costs the boss 35 HP.',
    trigger: { on: 'hero_healed', when: { everyNth: 3 }, do: { bossDamage: 35 } },
  },
  heal_scribe: {
    id: 'p_spirit_bond', name: 'Spirit Bond',
    text: 'Every 4th heal he lands hands the party 0.8s of cooldown back.',
    trigger: { on: 'hero_healed', when: { everyNth: 4 }, do: { target: 'party', refundCdMs: 800 } },
  },
  heal_oracle: {
    id: 'p_aegis_weave', name: 'Aegis Weave',
    text: 'When his own shield breaks, it reforms for 60.',
    trigger: { on: 'shield_broken', do: { target: 'actor', shield: 60 } },
  },
};
