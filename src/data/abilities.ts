import type { Ability } from '../types';

// One ability per hero — the roster's whole identity lives here. Every field is
// resolved by FightEngine.castAbility; HeroTooltip turns them into copy automatically.

// ── Tanks ─────────────────────────────────────────────────────────────────────
// All taunt (wipe threat, pin the boss) — they differ in what rides along.

export const SHIELD_BASH: Ability = {
  id: 'shield_bash', name: 'Shield Bash', targetKind: 'boss',
  cooldownMs: 8000, damage: 140, selfShield: 250, taunt: true,
};

export const RALLYING_ROAR: Ability = {
  id: 'rallying_roar', name: 'Rallying Roar', targetKind: 'boss',
  cooldownMs: 11000, damage: 90, selfShield: 150, partyHeal: 120, taunt: true,
};

export const BULWARK: Ability = {
  id: 'bulwark', name: 'Bulwark', targetKind: 'boss',
  cooldownMs: 9000, selfShield: 520, taunt: true,
};

export const GLACIAL_SLAM: Ability = {
  id: 'glacial_slam', name: 'Glacial Slam', targetKind: 'boss',
  cooldownMs: 13000, damage: 120, selfShield: 200, bossStunMs: 1800, taunt: true,
};

export const WHIRLING_GUARD: Ability = {
  id: 'whirling_guard', name: 'Whirling Guard', targetKind: 'boss',
  cooldownMs: 5000, damage: 110, selfShield: 140, taunt: true,
};

// ── DPS ───────────────────────────────────────────────────────────────────────

export const BURST: Ability = {
  id: 'burst', name: 'Burst', targetKind: 'boss',
  cooldownMs: 6000, damage: 320,
};

export const HEADHUNT: Ability = {
  id: 'headhunt', name: 'Headhunt', targetKind: 'boss',
  cooldownMs: 7000, damage: 240, executeBelowPct: 30, executeBonus: 380,
};

export const IMMOLATION: Ability = {
  id: 'immolation', name: 'Immolation', targetKind: 'boss',
  cooldownMs: 8000, damage: 120, dot: { damage: 70, tickMs: 1000, durationMs: 6000 },
};

export const STORMBLADE: Ability = {
  id: 'stormblade', name: 'Stormblade', targetKind: 'boss',
  cooldownMs: 7000, damage: 200, buff: { target: 'self', durationMs: 6000, attackSpeedPct: 60 },
};

export const NIGHTSORROW: Ability = {
  id: 'nightsorrow', name: "Night's Sorrow", targetKind: 'boss',
  cooldownMs: 9000, damage: 300, lifestealPct: 40,
};

export const VOID_STEP: Ability = {
  id: 'void_step', name: 'Void Step', targetKind: 'boss',
  cooldownMs: 10000, damage: 420, threatFlat: -900,
};

export const CHAIN_LIGHTNING: Ability = {
  id: 'chain_lightning', name: 'Chain Lightning', targetKind: 'boss',
  cooldownMs: 8500, damage: 180, dot: { damage: 45, tickMs: 750, durationMs: 4500 },
};

export const VENOM_SHOT: Ability = {
  id: 'venom_shot', name: 'Venom Shot', targetKind: 'boss',
  cooldownMs: 4000, damage: 150, dot: { damage: 30, tickMs: 1000, durationMs: 5000 },
};

export const WARBEAST_HOWL: Ability = {
  id: 'warbeast_howl', name: 'Warbeast Howl', targetKind: 'boss',
  cooldownMs: 12000, damage: 200, buff: { target: 'party', durationMs: 8000, attackPct: 35 },
};

// ── Healers ───────────────────────────────────────────────────────────────────

export const MEND: Ability = {
  id: 'mend', name: 'Mend', targetKind: 'ally',
  cooldownMs: 5000, heal: 260,
};

export const DAWNLIGHT: Ability = {
  id: 'dawnlight', name: 'Dawnlight', targetKind: 'ally',
  cooldownMs: 9000, heal: 140, partyHeal: 200,
};

export const SUNWARD_AEGIS: Ability = {
  id: 'sunward_aegis', name: 'Sunward Aegis', targetKind: 'ally',
  cooldownMs: 7000, heal: 160, allyShield: 300,
};

export const BLOOD_PACT: Ability = {
  id: 'blood_pact', name: 'Blood Pact', targetKind: 'ally',
  cooldownMs: 8000, heal: 420, selfHeal: 120, threatFlat: -300,
};

export const SPIRIT_SCRIBE: Ability = {
  id: 'spirit_scribe', name: 'Scribed Vigour', targetKind: 'ally',
  cooldownMs: 8500, heal: 180, buff: { target: 'ally', durationMs: 7000, attackSpeedPct: 45 },
};

export const SHIELD_ORACLE: Ability = {
  id: 'shield_oracle', name: 'Oracle Ward', targetKind: 'ally',
  cooldownMs: 6500, allyShield: 480,
};

// ── Generals ──────────────────────────────────────────────────────────────────
// A general opens the run alone, so each one carries its own sustain or safety net
// on top of its damage — no healer exists yet to cover it.

export const ROAR_OF_THE_SUN: Ability = {
  id: 'roar_of_the_sun', name: 'Roar of the Sun', targetKind: 'boss',
  cooldownMs: 7000, damage: 230, selfShield: 220,
};

export const MIST_DRAGON_SEAL: Ability = {
  id: 'mist_dragon_seal', name: 'Mist Dragon Seal', targetKind: 'boss',
  cooldownMs: 6500, damage: 190, buff: { target: 'self', durationMs: 6000, attackSpeedPct: 70 },
};

export const STARSTRIDE: Ability = {
  id: 'starstride', name: 'Starstride', targetKind: 'boss',
  cooldownMs: 8000, damage: 150, dot: { damage: 80, tickMs: 1000, durationMs: 6000 },
};

export const BLIGHT_CALL: Ability = {
  id: 'blight_call', name: 'Blight Call', targetKind: 'boss',
  cooldownMs: 8000, damage: 260, lifestealPct: 45,
};

export const IMMOLATIVE_MIGHT: Ability = {
  id: 'immolative_might', name: 'Immolative Might', targetKind: 'boss',
  cooldownMs: 9000, damage: 210, selfHeal: 140,
  buff: { target: 'self', durationMs: 8000, attackPct: 35 },
};

export const WINTERS_WAKE: Ability = {
  id: 'winters_wake', name: "Winter's Wake", targetKind: 'boss',
  cooldownMs: 10000, damage: 200, bossStunMs: 1600, selfShield: 180,
};
