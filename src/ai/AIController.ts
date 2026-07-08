// Drives the enemy turn using greedy scoring.
// Algorithm: generate all legal actions → score each → dispatch best → repeat until endTurn is best.
// CombatScene calls takeTurn() at the start of each enemy turn; pass a delay for readable playback.

import { ActionSystem } from '../engine/ActionSystem';
import { GameAction, GameState } from '../types';
import { scoreAllActions, ScoreWeights } from './GreedyScorer';

export interface TakeTurnOptions {
  /** Pause between actions (ms) so the player can follow the AI. Default 0. */
  delayMs?: number;
  /** Called after each dispatched action (for VFX / sprite sync). */
  onAction?: (action: GameAction, state: GameState) => void;
}

const SAFETY_LIMIT = 50; // guard against pathological infinite loops

export class AIController {
  private actionSystem: ActionSystem;
  private weights: ScoreWeights | undefined;

  constructor(actionSystem: ActionSystem, weights?: ScoreWeights) {
    this.actionSystem = actionSystem;
    this.weights = weights;
  }

  /** Execute the full enemy turn. Returns the ordered actions taken. */
  async takeTurn(opts: TakeTurnOptions = {}): Promise<GameAction[]> {
    const { delayMs = 0, onAction } = opts;
    const taken: GameAction[] = [];

    if (this.actionSystem.getState().activePlayer !== 'enemy') return taken;

    let safety = SAFETY_LIMIT;
    while (safety-- > 0) {
      const state = this.actionSystem.getState();
      if (this.generalDead(state)) break;

      const legal = this.actionSystem.generateLegalActions();
      const best = scoreAllActions(legal, state, this.weights)[0];

      if (!best || best.action.type === 'endTurn') break;

      this.actionSystem.dispatch(best.action);
      taken.push(best.action);
      onAction?.(best.action, this.actionSystem.getState());
      if (delayMs > 0) await delay(delayMs);
    }

    // Don't hand the turn back if the game is already decided.
    if (!this.generalDead(this.actionSystem.getState())) {
      this.actionSystem.dispatch({ type: 'endTurn' });
    }
    return taken;
  }

  private generalDead(state: GameState): boolean {
    return state.player.general.stats.hp <= 0 || state.enemy.general.stats.hp <= 0;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
