// TODO: Factory + mutators for GameState.
// - createInitialGameState: builds a fresh state for a combat encounter
// - applyAction: pure reducer — returns new GameState given current state + action
// GameState is the single source of truth; CombatScene reads it to render.

import { GameState, Unit, PlayerState, BOARD_COLS, BOARD_ROWS } from '../types';
import { buildStarterDeck } from './CardDatabase';

const OPENING_HAND_SIZE = 3;

/** Build a player's draw pile and deal an opening hand off the top. */
function dealStartingCards(): Pick<PlayerState, 'hand' | 'deck'> {
  const deck = buildStarterDeck();
  const hand = deck.splice(0, OPENING_HAND_SIZE);
  return { hand, deck };
}

/** Draw one card from the deck into hand (capped). Mutates player. */
export function drawCard(player: PlayerState, handCap = 8): void {
  if (player.deck.length === 0) return;
  if (player.hand.length >= handCap) return;
  player.hand.push(player.deck.shift()!);
}

export function createInitialGameState(): GameState {
  // TODO: accept an EncounterDefinition param so each floor has different enemy loadout
  const playerGeneral: Unit = {
    id: 'player-general',
    definitionId: 'general_lyonar', // TODO: derive from run's chosen faction
    faction: 'player',
    position: { col: 0, row: 2 }, // player general starts left-center
    stats: { maxHp: 25, hp: 25, attack: 2, moveRange: 2, attackRange: 1 },
    statusEffects: [],
    hasMoved: false,
    hasAttacked: false,
    isGeneral: true,
  };

  const enemyGeneral: Unit = {
    id: 'enemy-general',
    definitionId: 'general_abyssian', // TODO: vary per floor/boss
    faction: 'enemy',
    position: { col: BOARD_COLS - 1, row: 2 }, // enemy starts right-center
    stats: { maxHp: 25, hp: 25, attack: 2, moveRange: 2, attackRange: 1 },
    statusEffects: [],
    hasMoved: false,
    hasAttacked: false,
    isGeneral: true,
  };

  // TODO: validate board dimensions are BOARD_COLS × BOARD_ROWS
  void BOARD_ROWS;

  return {
    turn: 1,
    activePlayer: 'player',
    player: {
      faction: 'player',
      ...dealStartingCards(),
      mana: 2,       // turn 1 mana (Duelyst: starts at 2, +1 per turn, cap 9)
      maxMana: 2,
      general: playerGeneral,
    },
    enemy: {
      faction: 'enemy',
      ...dealStartingCards(),
      mana: 2,
      maxMana: 2,
      general: enemyGeneral,
    },
    units: [playerGeneral, enemyGeneral],
  };
}
