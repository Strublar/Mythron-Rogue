// Resolve card effects against GameState. Cards are data objects (CardDefinition);
// this reads the effect payload and applies it via a lookup table (no switch factory).
// Mutates the passed GameState in place to match CombatScene's imperative flow, and
// returns which units were spawned/affected so the scene can sync sprites.

import { GameState, PlayerState, CardInstance, Position, Unit, CardEffect } from '../types';
import { getCardDef } from './CardDatabase';
import { unitAt } from './BoardState';

export interface ResolveResult {
  ok: boolean;
  reason?: string;
  /** Newly summoned unit (needs a sprite created) */
  summoned?: Unit;
  /** Unit whose stats changed (damage/heal) — needs display refresh + death check */
  affected?: Unit;
}

let summonCounter = 0;

type EffectHandler = (
  state: GameState,
  player: PlayerState,
  effect: CardEffect,
  target: Position,
) => ResolveResult;

const HANDLERS: Record<CardEffect['kind'], EffectHandler> = {
  summon: (state, player, effect, target) => {
    if (effect.kind !== 'summon') return { ok: false };
    if (unitAt(state.units, target)) return { ok: false, reason: 'occupied' };
    const unit: Unit = {
      id: `summon-${summonCounter++}`,
      definitionId: effect.unitKey,
      faction: player.faction,
      position: { ...target },
      stats: { ...effect.stats },
      statusEffects: [],
      hasMoved: true,   // summoning sickness — cannot act the turn it lands
      hasAttacked: true,
    };
    state.units.push(unit);
    return { ok: true, summoned: unit };
  },
  damage: (state, player, effect, target) => {
    if (effect.kind !== 'damage') return { ok: false };
    const victim = unitAt(state.units, target);
    if (!victim || victim.faction === player.faction) return { ok: false, reason: 'no enemy' };
    victim.stats.hp -= effect.amount;
    return { ok: true, affected: victim };
  },
  heal: (state, player, effect, target) => {
    if (effect.kind !== 'heal') return { ok: false };
    const ally = unitAt(state.units, target);
    if (!ally || ally.faction !== player.faction) return { ok: false, reason: 'no ally' };
    ally.stats.hp = Math.min(ally.stats.maxHp, ally.stats.hp + effect.amount);
    return { ok: true, affected: ally };
  },
};

/**
 * Play a card from `player`'s hand at `target`. On success, deducts mana and
 * removes the card from hand. Mutates state in place.
 */
export function resolveCard(
  state: GameState,
  player: PlayerState,
  card: CardInstance,
  target: Position,
): ResolveResult {
  const def = getCardDef(card.definitionId);
  if (!def) return { ok: false, reason: 'unknown card' };
  if (def.manaCost > player.mana) return { ok: false, reason: 'not enough mana' };

  const result = HANDLERS[def.effect.kind](state, player, def.effect, target);
  if (!result.ok) return result;

  player.mana -= def.manaCost;
  player.hand = player.hand.filter(c => c.instanceId !== card.instanceId);
  return result;
}
