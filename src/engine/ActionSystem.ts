// Legal action generation, action dispatch, and turn lifecycle.
// - generateLegalActions: returns all valid actions for current active player
// - dispatch: applies action to GameState (mutates in place), notifies listeners
// - Turn lifecycle: end-of-turn flip, per-turn flag reset, mana ramp, draw

import {
  GameState,
  GameAction,
  MoveAction,
  AttackAction,
  PlayCardAction,
  PlayerState,
  Position,
  Faction,
} from '../types';
import {
  reachableTiles,
  attackableTargets,
  manhattanDistance,
  unitAt,
  cardinalNeighbors,
} from './BoardState';
import { resolveCard } from './CardResolver';
import { getCardDef } from './CardDatabase';
import { drawCard } from './GameState';

const MANA_CAP = 9;

export class ActionSystem {
  private state: GameState;

  private listeners: Array<(action: GameAction, next: GameState) => void> = [];

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  getState(): GameState {
    return this.state;
  }

  /** All legal actions the current active player can take */
  generateLegalActions(): GameAction[] {
    const actions: GameAction[] = [];
    const { units, activePlayer } = this.state;
    const active = this.activeState();
    const friendly = units.filter(u => u.faction === activePlayer);

    for (const unit of friendly) {
      if (!unit.hasMoved) {
        const tiles = reachableTiles(unit, units);
        const moveActions: MoveAction[] = tiles.map(to => ({ type: 'move', unitId: unit.id, to }));
        actions.push(...moveActions);
      }
      if (!unit.hasAttacked) {
        const targets = attackableTargets(unit, units);
        const attackActions: AttackAction[] = targets.map(t => ({
          type: 'attack',
          attackerId: unit.id,
          targetId: t.id,
        }));
        actions.push(...attackActions);
      }
    }

    actions.push(...this.cardActions(active, friendly));

    actions.push({ type: 'endTurn' });
    return actions;
  }

  /** PlayCardActions for every affordable card in the active hand, one per legal target */
  private cardActions(active: PlayerState, friendly: GameState['units']): PlayCardAction[] {
    const { units, activePlayer } = this.state;
    const out: PlayCardAction[] = [];

    for (const card of active.hand) {
      const def = getCardDef(card.definitionId);
      if (!def || def.manaCost > active.mana) continue;

      let targets: Position[] = [];
      switch (def.effect.kind) {
        case 'summon':
          targets = this.emptyAdjacentTiles(friendly);
          break;
        case 'damage':
          targets = units.filter(u => u.faction !== activePlayer).map(u => ({ ...u.position }));
          break;
        case 'heal':
          targets = friendly.map(u => ({ ...u.position }));
          break;
      }

      for (const target of targets) {
        out.push({ type: 'playCard', cardInstanceId: card.instanceId, target });
      }
    }
    return out;
  }

  /** Empty tiles cardinally adjacent to any friendly unit (deduped) */
  private emptyAdjacentTiles(friendly: GameState['units']): Position[] {
    const { units } = this.state;
    const seen = new Set<string>();
    const out: Position[] = [];
    for (const unit of friendly) {
      for (const pos of cardinalNeighbors(unit.position)) {
        const key = `${pos.col},${pos.row}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!unitAt(units, pos)) out.push(pos);
      }
    }
    return out;
  }

  private activeState(): PlayerState {
    return this.state.activePlayer === 'player' ? this.state.player : this.state.enemy;
  }

  /** Apply action, update state, notify listeners */
  dispatch(action: GameAction): void {
    const next = this.applyAction(this.state, action);
    this.state = next;
    this.listeners.forEach(fn => fn(action, next));
  }

  on(fn: (action: GameAction, next: GameState) => void): void {
    this.listeners.push(fn);
  }

  private applyAction(state: GameState, action: GameAction): GameState {
    switch (action.type) {
      case 'move': {
        const unit = state.units.find(u => u.id === action.unitId);
        if (unit) {
          unit.position = { ...action.to };
          unit.hasMoved = true;
        }
        return state;
      }
      case 'attack': {
        const attacker = state.units.find(u => u.id === action.attackerId);
        const target = state.units.find(u => u.id === action.targetId);
        if (!attacker || !target) return state;
        target.stats.hp -= attacker.stats.attack;
        attacker.hasAttacked = true;
        // Duelyst: surviving defender in range counter-attacks
        if (
          target.stats.hp > 0 &&
          manhattanDistance(attacker.position, target.position) <= target.stats.attackRange
        ) {
          attacker.stats.hp -= target.stats.attack;
        }
        state.units = state.units.filter(u => u.stats.hp > 0);
        return state;
      }
      case 'playCard': {
        const active = state.activePlayer === 'player' ? state.player : state.enemy;
        const card = active.hand.find(c => c.instanceId === action.cardInstanceId);
        if (!card || !action.target || typeof action.target === 'string') return state;
        resolveCard(state, active, card, action.target);
        return state;
      }
      case 'endTurn': {
        return this.endTurn(state);
      }
    }
  }

  private endTurn(state: GameState): GameState {
    const nextPlayer: Faction = state.activePlayer === 'player' ? 'enemy' : 'player';
    state.activePlayer = nextPlayer;

    for (const unit of state.units.filter(u => u.faction === nextPlayer)) {
      unit.hasMoved = false;
      unit.hasAttacked = false;
    }

    const player = nextPlayer === 'player' ? state.player : state.enemy;
    player.maxMana = Math.min(MANA_CAP, player.maxMana + 1);
    player.mana = player.maxMana;
    drawCard(player);

    if (nextPlayer === 'player') state.turn += 1;
    return state;
  }
}
