// Score each legal action for the AI. No lookahead — pure greedy.
// AI personality is controlled by tuning the weight constants below.
// Higher weight = AI prioritizes that type of action more.
// Example: boss has high generalDamage weight → aggressively targets player general.

import { GameAction, GameState, Position, ScoredAction } from '../types';
import { manhattanDistance, unitAt } from '../engine/BoardState';
import { getCardDef } from '../engine/CardDatabase';

// Tunable weights — adjust per enemy type / boss personality
export interface ScoreWeights {
  generalDamage: number;    // reward for damaging player general
  unitDamage: number;       // reward for damaging player units
  unitKill: number;         // reward for killing a unit
  generalKill: number;      // reward for killing player general (win)
  positioning: number;      // reward for moving closer to player general
  summonValue: number;      // reward per (attack + maxHp) of a summoned minion
  healValue: number;        // reward per HP effectively restored
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  generalDamage: 3,
  unitDamage: 1,
  unitKill: 4,
  generalKill: 1000,
  positioning: 0.5,
  summonValue: 0.6,
  healValue: 0.8,
};

export function scoreAction(
  action: GameAction,
  state: GameState,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  switch (action.type) {
    case 'endTurn':
      return 0;

    case 'move': {
      const unit = state.units.find(u => u.id === action.unitId);
      if (!unit) return 0;
      const before = manhattanDistance(unit.position, state.player.general.position);
      const after = manhattanDistance(action.to, state.player.general.position);
      return (before - after) * weights.positioning;
    }

    case 'attack': {
      const target = state.units.find(u => u.id === action.targetId);
      const attacker = state.units.find(u => u.id === action.attackerId);
      if (!target || !attacker) return 0;
      const isGeneral = target.id === state.player.general.id;
      const damage = attacker.stats.attack;
      const kills = damage >= target.stats.hp;
      let score = damage * (isGeneral ? weights.generalDamage : weights.unitDamage);
      if (kills) {
        score += isGeneral ? weights.generalKill : weights.unitKill;
      } else if (manhattanDistance(attacker.position, target.position) <= target.stats.attackRange) {
        // penalize trades where the survivor counter-attacks us
        score -= target.stats.attack * weights.unitDamage;
      }
      return score;
    }

    case 'playCard':
      return scorePlayCard(action.cardInstanceId, action.target, state, weights);
  }
}

function scorePlayCard(
  cardInstanceId: string,
  target: Position | string | undefined,
  state: GameState,
  weights: ScoreWeights,
): number {
  const active = state.activePlayer === 'player' ? state.player : state.enemy;
  const card = active.hand.find(c => c.instanceId === cardInstanceId);
  if (!card) return 0;
  const def = getCardDef(card.definitionId);
  if (!def) return 0;
  const pos = typeof target === 'object' ? target : undefined;

  switch (def.effect.kind) {
    case 'summon':
      return (def.effect.stats.attack + def.effect.stats.maxHp) * weights.summonValue;

    case 'damage': {
      if (!pos) return 0;
      const victim = unitAt(state.units, pos);
      if (!victim) return 0;
      const isGeneral = victim.id === state.player.general.id;
      const amount = def.effect.amount;
      let score = amount * (isGeneral ? weights.generalDamage : weights.unitDamage);
      if (amount >= victim.stats.hp) score += isGeneral ? weights.generalKill : weights.unitKill;
      return score;
    }

    case 'heal': {
      if (!pos) return 0;
      const ally = unitAt(state.units, pos);
      if (!ally) return 0;
      const restored = Math.min(def.effect.amount, ally.stats.maxHp - ally.stats.hp);
      return restored * weights.healValue;
    }
  }
}

/** Score all legal actions and return them sorted best-first */
export function scoreAllActions(
  actions: GameAction[],
  state: GameState,
  weights?: ScoreWeights,
): ScoredAction[] {
  return actions
    .map(action => ({ action, score: scoreAction(action, state, weights) }))
    .sort((a, b) => b.score - a.score);
}
