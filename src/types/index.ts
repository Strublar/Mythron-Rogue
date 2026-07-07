// TODO: Source of truth for ALL shared types. Import from here everywhere.
// Add types as features are built. Never duplicate type definitions across modules.

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

/** Column 0-8, Row 0-4. Top-left = [0,0]. */
export type Position = { col: number; row: number };

export const BOARD_COLS = 9;
export const BOARD_ROWS = 5;

// ---------------------------------------------------------------------------
// Factions / Players
// ---------------------------------------------------------------------------

export type Faction = 'player' | 'enemy';

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export interface UnitStats {
  maxHp: number;
  hp: number;
  attack: number;
  /** Movement range in tiles per turn */
  moveRange: number;
  /** Attack range in tiles (1 = melee) */
  attackRange: number;
}

export interface Unit {
  id: string;
  definitionId: string; // references UnitDefinition
  faction: Faction;
  position: Position;
  stats: UnitStats;
  /** Status effects applied this turn (stun, freeze, etc.) */
  statusEffects: StatusEffect[];
  /** Whether unit has moved this turn */
  hasMoved: boolean;
  /** Whether unit has attacked this turn */
  hasAttacked: boolean;
  /** True for general units — death ends the game */
  isGeneral?: boolean;
}

// ---------------------------------------------------------------------------
// Status Effects
// ---------------------------------------------------------------------------

export type StatusEffectType = 'stun' | 'freeze' | 'poison' | 'flying';

export interface StatusEffect {
  type: StatusEffectType;
  remainingTurns: number;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type CardType = 'unit' | 'spell' | 'artifact';

/** Summon a unit onto an empty tile next to a friendly unit */
export interface SummonEffect {
  kind: 'summon';
  /** UnitAnimator atlas key (also used as definitionId) */
  unitKey: string;
  stats: UnitStats;
}

/** Deal damage to a targeted enemy unit */
export interface DamageEffect {
  kind: 'damage';
  amount: number;
}

/** Restore HP to a targeted friendly unit (capped at maxHp) */
export interface HealEffect {
  kind: 'heal';
  amount: number;
}

export type CardEffect = SummonEffect | DamageEffect | HealEffect;

export type CardTargeting = 'emptyAdjacent' | 'enemyUnit' | 'friendlyUnit';

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  manaCost: number;
  description: string;
  effect: CardEffect;
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type ActionType = 'move' | 'attack' | 'playCard' | 'endTurn';

export interface MoveAction {
  type: 'move';
  unitId: string;
  to: Position;
}

export interface AttackAction {
  type: 'attack';
  attackerId: string;
  targetId: string;
}

export interface PlayCardAction {
  type: 'playCard';
  cardInstanceId: string;
  /** Target position or unit for the card */
  target?: Position | string;
}

export interface EndTurnAction {
  type: 'endTurn';
}

export type GameAction = MoveAction | AttackAction | PlayCardAction | EndTurnAction;

// ---------------------------------------------------------------------------
// Game State
// ---------------------------------------------------------------------------

export interface PlayerState {
  faction: Faction;
  hand: CardInstance[];
  deck: CardInstance[]; // draw pile — front is next card drawn
  mana: number;
  maxMana: number;
  general: Unit; // hero unit — death = game over
}

export interface GameState {
  turn: number;
  activePlayer: Faction;
  player: PlayerState;
  enemy: PlayerState;
  units: Unit[]; // all units on board (including generals)
}

// ---------------------------------------------------------------------------
// Roguelike / Run
// ---------------------------------------------------------------------------

export interface RunState {
  floor: number;
  playerHp: number;
  playerMaxHp: number;
  gold: number;
  deck: CardDefinition[];
  relics: RelicDefinition[];
}

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  // TODO: add passive effect hook signature
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export interface ScoredAction {
  action: GameAction;
  score: number;
}

// ---------------------------------------------------------------------------
// Events (cross-system bus)
// ---------------------------------------------------------------------------

// TODO: define typed event map for Phaser EventEmitter or a simple mitt bus
export type GameEventType =
  | 'combat:start'
  | 'combat:end'
  | 'unit:death'
  | 'card:played'
  | 'turn:end'
  | 'run:draftReady'
  | 'run:relicReady'
  | 'run:bossDefeated';

export type TurnPhase = 'PLAYER_TURN' | 'AI_TURN';

export type HighlightType = 'move' | 'attack';

export type TileState =
  | 'tile_board.png'
  | 'tile_grid.png'
  | 'tile_hover.png'
  | 'tile_large.png'
  | 'tile_merged_hover_0123.png'
  | 'tile_merged_hover_013.png'
  | 'tile_merged_hover_01.png'
  | 'tile_merged_hover_03.png'
  | 'tile_merged_hover_0.png'
  | 'tile_merged_hover_0_seam.png'
  | 'tile_merged_large_0123.png'
  | 'tile_merged_large_013.png'
  | 'tile_merged_large_01.png'
  | 'tile_merged_large_03.png'
  | 'tile_merged_large_0.png'
  | 'tile_merged_large_0_seam.png'
  | 'tile_path_move_corner.png'
  | 'tile_path_move_corner_from_start.png'
  | 'tile_path_move_end.png'
  | 'tile_path_move_end_from_start.png'
  | 'tile_path_move_start.png'
  | 'tile_path_move_straight.png'
  | 'tile_path_move_straight_from_start.png';
