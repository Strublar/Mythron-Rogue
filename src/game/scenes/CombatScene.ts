// Main tactical combat scene (9×5 grid).
// Responsibilities:
// - Render board tiles and unit sprites
// - Handle player pointer input (tap tile → select unit → tap target → move/attack)
// - Own GameState, ActionSystem instances for this combat encounter
// - Drive AIController on enemy turn
// - Emit 'combat:end' event when a general dies
// - Spawn Phaser particle VFX on attacks/spells

import Phaser from 'phaser';
import { GameState, TurnPhase, Unit, Position, CardInstance } from '../../types';
import { createInitialGameState, drawCard } from '../../engine/GameState';
import { reachableTiles, attackableTargets, cardinalNeighbors, unitAt } from '../../engine/BoardState';
import { getCardDef, targetingFor, SUMMON_ATLASES } from '../../engine/CardDatabase';
import { resolveCard } from '../../engine/CardResolver';
import { createUnitSprite, playUnitAnim, UnitAnimKey } from '../UnitAnimator';
import { BoardTileManager } from '../BoardTileManager';
import { TileHighlightLayer } from '../TileHighlightLayer';
import { HandRenderer } from '../HandRenderer';

const COLS = 9;
const ROWS = 5;
const MAX_MANA = 9;

export class CombatScene extends Phaser.Scene {
  private gridOriginX!: number;
  private gridOriginY!: number;
  private tileW!: number;
  private tileH!: number;
  private gridLeftEdge!: number;
  private gridRightEdge!: number;
  private gameState!: GameState;
  private unitSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private unitKeyMap: Map<string, string> = new Map();
  private currentPhase: TurnPhase = 'PLAYER_TURN';
  private playerActedThisTurn: boolean = false;
  private selectedUnit: Unit | null = null;
  private boardTileManager!: BoardTileManager;
  private highlightLayer!: TileHighlightLayer;
  private highlightedPositions: Position[] = [];
  private attackablePositions: Position[] = [];
  private hpLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private hpIcons: Map<string, Phaser.GameObjects.Image> = new Map();
  private atkLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private atkIcons: Map<string, Phaser.GameObjects.Image> = new Map();
  private turnIndicator!: Phaser.GameObjects.Text;
  private endTurnImage!: Phaser.GameObjects.Image;
  private manaIcons: Phaser.GameObjects.Image[] = [];
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerHandText!: Phaser.GameObjects.Text;
  private enemyHandText!: Phaser.GameObjects.Text;
  private handRenderer!: HandRenderer;
  private selectedCard: CardInstance | null = null;
  private cardTargetPositions: Position[] = [];
  private tooltipContainer: Phaser.GameObjects.Container | null = null;
  private tooltipTimer: Phaser.Time.TimerEvent | null = null;
  private hoveredUnit: Unit | null = null;
  private gameOver = false;

  constructor() {
    super({ key: 'CombatScene' });
  }

  preload(): void {
    this.load.atlas('f1_general', 'resources/units/f1_general.png', 'resources/units/f1_general_atlas.json');
    this.load.atlas('f2_general', 'resources/units/f2_general.png', 'resources/units/f2_general_atlas.json');
    this.load.atlas('tiles_board', 'resources/tiles/tiles_board.png', 'resources/tiles/tiles_board_atlas.json');
    for (const key of SUMMON_ATLASES) {
      if (!this.textures.exists(key)) {
        this.load.atlas(key, `resources/units/${key}.png`, `resources/units/${key}_atlas.json`);
      }
    }
    if (!this.textures.exists('combat_bg')) {
      this.load.image('combat_bg',     'resources/maps/battlemap0_background.png');
      this.load.image('combat_mid',    'resources/maps/battlemap0_middleground.png');
      this.load.image('tile_attack',   'resources/tiles/tile_attack.png');
      this.load.image('bottom_bar',    'resources/ui/bottom_bar_background.png');
      this.load.image('bracket_p',     'resources/ui/bracket_friendly.png');
      this.load.image('bracket_e',     'resources/ui/bracket_enemy.png');
      this.load.image('icon_mana',     'resources/ui/icon_mana.png');
      this.load.image('icon_mana_off', 'resources/ui/icon_mana_inactive.png');
      this.load.image('icon_hp',       'resources/ui/icon_general_hp.png');
      this.load.image('btn_end_mine',  'resources/ui/button_end_turn_mine.png');
      this.load.image('btn_end_enemy', 'resources/ui/button_end_turn_enemy.png');
      this.load.image('notif_yours',   'resources/ui/notification_your_turn.png');
      this.load.image('notif_enemy',   'resources/ui/notification_enemy_turn.png');
      this.load.image('status_panel',  'resources/ui/status_panel.png');
      this.load.image('icon_atk',      'resources/ui/icon_atk.png');
      this.load.image('portrait_p',    'resources/generals/general_f1.png');
      this.load.image('portrait_e',    'resources/generals/general_f2.png');
      this.load.image('card_background',          'resources/ui/card_background.png');
      this.load.image('card_background_disabled', 'resources/ui/card_background_disabled.png');
    }
  }

  create(): void {
    const { width, height } = this.scale;

    // Square grid: uniform cell size (tileH = tileW)
    const TOP_UI_H = 55;
    const BOTTOM_BAR_H = 90;
    const availH = height - TOP_UI_H - BOTTOM_BAR_H;
    const tileWByWidth  = Math.floor(width * 0.78 / COLS);
    const tileWByHeight = Math.floor(availH / ROWS);
    this.tileW = Math.min(tileWByWidth, tileWByHeight);
    this.tileH = this.tileW;

    // Origin = screen position of the center of cell (0,0)
    this.gridOriginX = width / 2 - ((COLS - 1) / 2) * this.tileW;
    this.gridOriginY = (TOP_UI_H + availH / 2) - ((ROWS - 1) / 2) * this.tileH;

    // Left/right grid bounding edges for HUD panel placement
    this.gridLeftEdge  = this.gridOriginX - this.tileW / 2;
    this.gridRightEdge = this.gridOriginX + (COLS - 0.5) * this.tileW;

    this.drawBackground();

    const cellToPixelFn = (col: number, row: number) => this.cellToPixel(col, row);
    this.boardTileManager = new BoardTileManager(this, cellToPixelFn, this.tileW, this.tileH);
    this.highlightLayer = new TileHighlightLayer(this, cellToPixelFn, this.tileW, this.tileH);
    this.boardTileManager.show(false, 0.8);

    this.scale.on('resize', () => {
      this.boardTileManager.reposition(cellToPixelFn, this.tileW, this.tileH);
      this.highlightLayer.reposition(cellToPixelFn, this.tileW, this.tileH);
    });

    this.gameState = createInitialGameState();
    this.renderUnits();
    this.drawPlayerHUDs();
    this.drawBottomBar();
    this.handRenderer = new HandRenderer(this, id => this.onCardTap(id));
    this.renderHand();

    // Turn indicator (legacy text, kept for accessibility)
    const cx = width / 2;
    this.turnIndicator = this.add.text(cx, 6, 'YOUR TURN', {
      fontSize: '11px',
      color: '#88bbff',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(10).setAlpha(0.7);

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.handlePointerDown(ptr.x, ptr.y));
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => this.handlePointerMove(ptr.x, ptr.y));
    this.input.on('pointerup', () => this.hideTooltip());
  }

  // ---------------------------------------------------------------------------
  // Visual layer builders
  // ---------------------------------------------------------------------------

  private drawBackground(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, 'combat_bg')
      .setDisplaySize(width, height).setDepth(0);
    this.add.image(width / 2, height / 2, 'combat_mid')
      .setDisplaySize(width, height).setDepth(1).setAlpha(0.85);
  }

  private drawPlayerHUDs(): void {
    const { width, height } = this.scale;
    const gs = this.gameState;
    const depth = 10;
    const panelCx = this.gridLeftEdge / 2;
    const panelCxR = (this.gridRightEdge + width) / 2;
    const portraitSize = Math.min(panelCx * 1.4, 100);
    const portraitY = 56;
    const nameY = portraitY + portraitSize / 2 + 10;
    const hpY = nameY + 18;
    const manaY = hpY + 22;
    const deckY = manaY + 16;
    void height; // available for future vertical layout

    // --- Player (left panel) ---
    this.add.image(panelCx, portraitY, 'portrait_p')
      .setDisplaySize(portraitSize, portraitSize)
      .setDepth(depth).setTint(0x88aaff);
    this.add.text(panelCx, nameY, 'YOU', {
      fontSize: '11px', color: '#aaddff', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(depth);
    this.add.image(panelCx - 22, hpY + 7, 'icon_hp')
      .setDisplaySize(16, 16).setDepth(depth);
    this.playerHpText = this.add.text(panelCx - 6, hpY, `${gs.player.general.stats.hp}`, {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0).setDepth(depth);
    this.drawManaPips(panelCx - (gs.player.maxMana * 7), manaY, gs.player.mana, gs.player.maxMana, depth);
    this.playerHandText = this.add.text(panelCx, deckY, `HAND ${gs.player.hand.length}`, {
      fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(depth);

    // --- Enemy (right panel) ---
    this.add.image(panelCxR, portraitY, 'portrait_e')
      .setDisplaySize(portraitSize, portraitSize)
      .setDepth(depth).setTint(0xff8888).setFlipX(true);
    this.add.text(panelCxR, nameY, 'VAATH THE IMMORTAL', {
      fontSize: '9px', color: '#ffaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(depth);
    this.add.image(panelCxR - 22, hpY + 7, 'icon_hp')
      .setDisplaySize(16, 16).setDepth(depth);
    this.enemyHpText = this.add.text(panelCxR - 6, hpY, `${gs.enemy.general.stats.hp}`, {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0).setDepth(depth);
    this.drawManaPips(panelCxR - (gs.enemy.maxMana * 7), manaY, gs.enemy.mana, gs.enemy.maxMana, depth);
    this.enemyHandText = this.add.text(panelCxR, deckY, `HAND ${gs.enemy.hand.length}`, {
      fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(depth);
  }

  private drawManaPips(startX: number, y: number, mana: number, maxMana: number, depth: number): void {
    for (let i = 0; i < MAX_MANA; i++) {
      const key = i < maxMana && i < mana ? 'icon_mana' : 'icon_mana_off';
      const icon = this.add.image(startX + i * 11 + 5, y, key)
        .setDisplaySize(10, 10).setDepth(depth);
      this.manaIcons.push(icon);
    }
  }

  private drawBottomBar(): void {
    const { width, height } = this.scale;
    const barH = 80;
    const barY = height - barH / 2;
    const depth = 10;

    this.add.image(width / 2, barY, 'bottom_bar')
      .setDisplaySize(width, barH).setDepth(depth);

    // REPLACE button (left)
    const replaceBtn = this.add.text(70, barY, 'REPLACE', {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#223355', padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true });
    replaceBtn.on('pointerover', () => replaceBtn.setColor('#88ddff'));
    replaceBtn.on('pointerout', () => replaceBtn.setColor('#ffffff'));

    // Hand cards are drawn by HandRenderer (see renderHand).

    // END TURN button (right)
    this.endTurnImage = this.add.image(width - 80, barY, 'btn_end_mine')
      .setDisplaySize(130, 44).setDepth(depth + 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.endPlayerTurn())
      .on('pointerover', () => this.endTurnImage.setAlpha(0.85))
      .on('pointerout', () => this.endTurnImage.setAlpha(1));
  }

  // ---------------------------------------------------------------------------
  // HUD refresh
  // ---------------------------------------------------------------------------

  private refreshHUD(): void {
    const gs = this.gameState;
    this.playerHpText.setText(`${gs.player.general.stats.hp}`);
    this.enemyHpText.setText(`${gs.enemy.general.stats.hp}`);
    for (const icon of this.manaIcons) icon.destroy();
    this.manaIcons = [];
    const { width } = this.scale;
    const depth = 10;
    const panelCx = this.gridLeftEdge / 2;
    const panelCxR = (this.gridRightEdge + width) / 2;
    const manaY = 56 + Math.min(panelCx * 1.4, 100) / 2 + 10 + 18 + 22;
    this.drawManaPips(panelCx - (gs.player.maxMana * 7), manaY, gs.player.mana, gs.player.maxMana, depth);
    this.drawManaPips(panelCxR - (gs.enemy.maxMana * 7), manaY, gs.enemy.mana, gs.enemy.maxMana, depth);
    this.playerHandText?.setText(`HAND ${gs.player.hand.length}`);
    this.enemyHandText?.setText(`HAND ${gs.enemy.hand.length}`);
  }

  // ---------------------------------------------------------------------------
  // Hand / card play
  // ---------------------------------------------------------------------------

  private handZone(): { x: number; right: number; y: number; depth: number } {
    const { width, height } = this.scale;
    return { x: 130, right: width - 155, y: height - 40, depth: 12 };
  }

  private renderHand(): void {
    const gs = this.gameState;
    this.handRenderer.render(
      gs.player.hand,
      gs.player.mana,
      this.selectedCard?.instanceId ?? null,
      this.handZone(),
    );
  }

  private onCardTap(instanceId: string): void {
    if (this.gameOver || this.currentPhase !== 'PLAYER_TURN') return;
    // Toggle off if tapping the selected card.
    if (this.selectedCard?.instanceId === instanceId) {
      this.cancelCardSelection();
      return;
    }
    const card = this.gameState.player.hand.find(c => c.instanceId === instanceId);
    const def = card && getCardDef(card.definitionId);
    if (!card || !def || def.manaCost > this.gameState.player.mana) return;

    // Selecting a card cancels any unit selection.
    this.selectedUnit = null;
    this.clearHighlights();
    this.selectedCard = card;
    this.cardTargetPositions = this.computeCardTargets(def);
    if (this.cardTargetPositions.length > 0) {
      const type = targetingFor(def) === 'enemyUnit' ? 'attack' : 'move';
      this.highlightLayer.show(this.cardTargetPositions, type);
    }
    this.renderHand();
  }

  private computeCardTargets(def: NonNullable<ReturnType<typeof getCardDef>>): Position[] {
    const units = this.gameState.units;
    const mode = targetingFor(def);
    if (mode === 'enemyUnit') {
      return units.filter(u => u.faction !== 'player').map(u => ({ ...u.position }));
    }
    if (mode === 'friendlyUnit') {
      return units.filter(u => u.faction === 'player').map(u => ({ ...u.position }));
    }
    // emptyAdjacent: empty tiles cardinally adjacent to any friendly unit.
    const seen = new Set<string>();
    const tiles: Position[] = [];
    for (const u of units.filter(u => u.faction === 'player')) {
      for (const n of cardinalNeighbors(u.position)) {
        const k = `${n.col},${n.row}`;
        if (seen.has(k) || unitAt(units, n)) continue;
        seen.add(k);
        tiles.push(n);
      }
    }
    return tiles;
  }

  private cancelCardSelection(): void {
    this.selectedCard = null;
    this.cardTargetPositions = [];
    this.clearHighlights();
    this.renderHand();
  }

  private playCard(card: CardInstance, target: Position): void {
    const gs = this.gameState;
    const result = resolveCard(gs, gs.player, card, target);
    if (!result.ok) {
      this.cancelCardSelection();
      return;
    }
    this.playerActedThisTurn = true;

    if (result.summoned) {
      this.spawnUnitSprite(result.summoned);
    }
    if (result.affected) {
      this.updateStatDisplay(result.affected);
      if (result.affected.stats.hp <= 0) this.handleDeath(result.affected);
    }

    this.selectedCard = null;
    this.cardTargetPositions = [];
    this.clearHighlights();
    this.refreshHUD();
    this.renderHand();
  }

  private spawnUnitSprite(unit: Unit): void {
    const { x, y } = this.cellToPixel(unit.position.col, unit.position.row);
    const spriteY = y - this.tileH * 0.5;
    const sprite = createUnitSprite(this, unit.definitionId, x, spriteY)
      .setDisplaySize(this.tileW, this.tileW)
      .setDepth(unit.position.col + unit.position.row + 0.5);
    if (unit.faction === 'enemy') sprite.setFlipX(true);
    this.unitSprites.set(unit.id, sprite);
    this.unitKeyMap.set(unit.id, unit.definitionId);
    this.updateStatDisplay(unit);
    sprite.setScale(sprite.scaleX * 0.6);
    this.tweens.add({ targets: sprite, scaleX: sprite.scaleX / 0.6, scaleY: sprite.scaleY / 0.6, duration: 220, ease: 'Back.Out' });
  }

  // ---------------------------------------------------------------------------
  // Turn flow
  // ---------------------------------------------------------------------------

  endPlayerTurn(): void {
    if (this.currentPhase !== 'PLAYER_TURN') return;
    if (this.selectedCard) this.cancelCardSelection();
    this.currentPhase = 'AI_TURN';
    this.turnIndicator.setText('AI TURN').setColor('#ff8888');
    this.endTurnImage.setTexture('btn_end_enemy').setAlpha(0.55).disableInteractive();
    this.showTurnNotification('notif_enemy');
    this.runAITurn(this.playerActedThisTurn);
    this.playerActedThisTurn = false;
  }

  startPlayerTurn(): void {
    this.currentPhase = 'PLAYER_TURN';
    this.turnIndicator.setText('YOUR TURN').setColor('#88bbff');
    this.endTurnImage.setTexture('btn_end_mine').setAlpha(1).setInteractive({ useHandCursor: true });
    this.playerActedThisTurn = false;
    for (const unit of this.gameState.units) {
      if (unit.faction === 'player') {
        unit.hasMoved = false;
        unit.hasAttacked = false;
      }
    }
    // Increment mana (Duelyst: +1 per turn, cap 9)
    const ps = this.gameState.player;
    ps.maxMana = Math.min(ps.maxMana + 1, MAX_MANA);
    ps.mana = ps.maxMana;
    drawCard(ps);
    this.refreshHUD();
    this.renderHand();
    this.showTurnNotification('notif_yours');
  }

  private runAITurn(_playerActed: boolean): void {
    this.time.delayedCall(800, () => this.startPlayerTurn());
  }

  private showTurnNotification(key: 'notif_yours' | 'notif_enemy'): void {
    const { width, height } = this.scale;
    const img = this.add.image(width / 2, -80, key).setDepth(18).setScale(0.9);
    this.tweens.add({
      targets: img, y: height * 0.35, duration: 400, ease: 'Back.Out',
      onComplete: () => this.time.delayedCall(1200, () =>
        this.tweens.add({
          targets: img, y: -80, duration: 300, ease: 'Cubic.In',
          onComplete: () => img.destroy(),
        })
      ),
    });
  }

  update(_time: number, _delta: number): void {
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private handlePointerDown(x: number, y: number): void {
    if (this.gameOver) return;
    if (this.currentPhase !== 'PLAYER_TURN') return;
    const pos = this.pixelToCell(x, y);
    if (!pos) return;

    // Card-play mode: a card is selected, tap a valid target tile to play it.
    if (this.selectedCard) {
      const isTarget = this.cardTargetPositions.some(p => p.col === pos.col && p.row === pos.row);
      if (isTarget) this.playCard(this.selectedCard, pos);
      else this.cancelCardSelection();
      return;
    }

    const unit = this.gameState.units.find(u => u.position.col === pos.col && u.position.row === pos.row);
    if (this.selectedUnit) {
      const isAttackable = this.attackablePositions.some(p => p.col === pos.col && p.row === pos.row);
      if (isAttackable && unit && unit.faction !== 'player') {
        this.resolveAttack(this.selectedUnit, unit);
        this.clearHighlights();
        this.selectedUnit = null;
        return;
      }
      const isHighlighted = this.highlightedPositions.some(p => p.col === pos.col && p.row === pos.row);
      if (isHighlighted && !unit) {
        this.moveUnit(this.selectedUnit, pos);
        return;
      }
      this.clearHighlights();
      this.selectedUnit = null;
    }
    if (unit?.faction === 'player' && (!unit.hasMoved || !unit.hasAttacked)) {
      this.selectedUnit = unit;
      this.showReachableTiles(unit);
    }
  }

  private handlePointerMove(x: number, y: number): void {
    const pos = this.pixelToCell(x, y);
    const unit = pos
      ? this.gameState.units.find(u => u.position.col === pos.col && u.position.row === pos.row) ?? null
      : null;
    if (unit === this.hoveredUnit) return;
    this.hoveredUnit = unit;
    this.tooltipTimer?.remove();
    this.tooltipTimer = null;
    this.hideTooltip();
    if (unit) {
      this.tooltipTimer = this.time.delayedCall(400, () => this.showTooltip(unit));
    }
  }

  // ---------------------------------------------------------------------------
  // Tooltip
  // ---------------------------------------------------------------------------

  private showTooltip(unit: Unit): void {
    this.hideTooltip();
    const { x, y } = this.cellToPixel(unit.position.col, unit.position.row);
    const panel = this.add.image(0, 0, 'status_panel').setDisplaySize(120, 72);
    const lines = [
      unit.definitionId,
      `ATK ${unit.stats.attack}   HP ${unit.stats.hp}/${unit.stats.maxHp}`,
      `MOV ${unit.stats.moveRange}   RNG ${unit.stats.attackRange}`,
    ];
    const text = this.add.text(0, 0, lines, {
      fontSize: '9px', color: '#ffffff', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);
    const ty = y - this.tileW * 0.6;
    this.tooltipContainer = this.add.container(x, ty, [panel, text]).setDepth(15);
  }

  private hideTooltip(): void {
    this.tooltipContainer?.destroy();
    this.tooltipContainer = null;
  }

  // ---------------------------------------------------------------------------
  // Unit rendering
  // ---------------------------------------------------------------------------

  private renderUnits(): void {
    for (const unit of this.gameState.units) {
      const { x, y } = this.cellToPixel(unit.position.col, unit.position.row);
      const unitKey = unit.faction === 'player' ? 'f1_general' : 'f2_general';
      const spriteY = y - this.tileH * 0.5;
      const sprite = createUnitSprite(this, unitKey, x, spriteY)
        .setDisplaySize(this.tileW, this.tileW)
        .setDepth(unit.position.col + unit.position.row + 0.5);
      if (unit.faction === 'enemy') sprite.setFlipX(true);
      this.unitSprites.set(unit.id, sprite);
      this.unitKeyMap.set(unit.id, unitKey);
      this.updateStatDisplay(unit);
    }
  }

  // ---------------------------------------------------------------------------
  // HP display
  // ---------------------------------------------------------------------------

  private updateStatDisplay(unit: Unit): void {
    const { x, y } = this.cellToPixel(unit.position.col, unit.position.row);
    const badgeY = y + this.tileH * 0.4;
    const atkX = x - this.tileW * 0.15;
    const hpX  = x + this.tileW * 0.02;

    const existingHp  = this.hpLabels.get(unit.id);
    const existingAtk = this.atkLabels.get(unit.id);

    if (existingHp && existingAtk) {
      existingHp.setText(`${unit.stats.hp}`).setPosition(hpX + 12, badgeY);
      this.hpIcons.get(unit.id)?.setPosition(hpX, badgeY + 5);
      existingAtk.setText(`${unit.stats.attack}`).setPosition(atkX + 12, badgeY);
      this.atkIcons.get(unit.id)?.setPosition(atkX, badgeY + 5);
    } else {
      const hpIcon = this.add.image(hpX, badgeY + 5, 'icon_hp')
        .setDisplaySize(10, 10).setDepth(7);
      this.hpIcons.set(unit.id, hpIcon);
      const hpLabel = this.add.text(hpX + 12, badgeY, `${unit.stats.hp}`, {
        fontSize: '10px', color: '#ff8888', fontFamily: 'monospace',
      }).setOrigin(0, 0).setDepth(7);
      this.hpLabels.set(unit.id, hpLabel);

      const atkIcon = this.add.image(atkX, badgeY + 5, 'icon_atk')
        .setDisplaySize(10, 10).setDepth(7);
      this.atkIcons.set(unit.id, atkIcon);
      const atkLabel = this.add.text(atkX + 12, badgeY, `${unit.stats.attack}`, {
        fontSize: '10px', color: '#ffdd44', fontFamily: 'monospace',
      }).setOrigin(0, 0).setDepth(7);
      this.atkLabels.set(unit.id, atkLabel);
    }
  }

  // ---------------------------------------------------------------------------
  // Highlights
  // ---------------------------------------------------------------------------

  private showReachableTiles(unit: Unit): void {
    this.clearHighlights();
    const moveTiles: Position[] = [];
    const attackTiles: Position[] = [];

    if (!unit.hasMoved) {
      this.highlightedPositions = reachableTiles(unit, this.gameState.units);
      moveTiles.push(...this.highlightedPositions);
    }
    if (!unit.hasAttacked) {
      const targets = attackableTargets(unit, this.gameState.units);
      this.attackablePositions = targets.map(t => t.position);
      attackTiles.push(...this.attackablePositions);
    }

    if (moveTiles.length > 0) {
      this.highlightLayer.show(moveTiles, 'move', attackTiles.length > 0 ? attackTiles : undefined);
    }

    if (attackTiles.length > 0) {
      const attackLayer = new TileHighlightLayer(
        this,
        (col, row) => this.cellToPixel(col, row),
        this.tileW,
        this.tileH,
      );
      attackLayer.show(attackTiles, 'attack', moveTiles.length > 0 ? moveTiles : undefined);
      this.highlightLayer.absorb(attackLayer);
    }
  }

  private clearHighlights(): void {
    this.highlightLayer.clear();
    this.highlightedPositions = [];
    this.attackablePositions = [];
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private moveUnit(unit: Unit, pos: Position): void {
    unit.position = pos;
    unit.hasMoved = true;
    const sprite = this.unitSprites.get(unit.id);
    if (sprite) {
      const { x, y } = this.cellToPixel(pos.col, pos.row);
      const spriteY = y - this.tileH * 0.5;
      const unitKey = this.unitKeyMap.get(unit.id) ?? '';
      playUnitAnim(sprite, unitKey, 'run', false);
      this.tweens.add({
        targets: sprite, x, y: spriteY, duration: 1000, ease: 'Linear',
        onComplete: () => {
          sprite.setDepth(pos.col + pos.row + 0.5);
          playUnitAnim(sprite, unitKey, 'idle', false);
          this.updateStatDisplay(unit);
        },
      });
    }
    this.clearHighlights();
    this.selectedUnit = null;
  }

  private resolveAttack(attacker: Unit, defender: Unit): void {
    defender.stats.hp -= attacker.stats.attack;
    attacker.stats.hp -= defender.stats.attack;
    attacker.hasAttacked = true;
    this.playerActedThisTurn = true;
    this.refreshHUD();

    const attackerSprite = this.unitSprites.get(attacker.id);
    const defenderSprite = this.unitSprites.get(defender.id);
    const attackerKey = this.unitKeyMap.get(attacker.id) ?? '';
    const defenderKey = this.unitKeyMap.get(defender.id) ?? '';
    const attackerDied = attacker.stats.hp <= 0;
    const defenderDied = defender.stats.hp <= 0;

    const afterHit = () => {
      this.updateStatDisplay(attacker);
      this.updateStatDisplay(defender);
      if (defenderDied) this.handleDeath(defender);
      else if (defenderSprite) playUnitAnim(defenderSprite, defenderKey, 'idle', false);
      if (attackerDied) this.handleDeath(attacker);
      else if (attackerSprite) playUnitAnim(attackerSprite, attackerKey, 'idle', false);
    };

    const afterAttack = () => {
      if (defenderSprite) {
        this.playAnimThen(defenderSprite, defenderKey, 'hit', afterHit);
      } else {
        afterHit();
      }
    };

    if (attackerSprite) {
      this.playAnimThen(attackerSprite, attackerKey, 'attack', afterAttack);
    } else {
      afterAttack();
    }
  }

  private playAnimThen(
    sprite: Phaser.GameObjects.Sprite,
    unitKey: string,
    anim: UnitAnimKey,
    callback: () => void,
  ): void {
    const globalKey = `${unitKey}_${anim}`;
    if (sprite.scene?.anims.exists(globalKey)) {
      sprite.once('animationcomplete', callback);
      playUnitAnim(sprite, unitKey, anim, false);
    } else {
      callback();
    }
  }

  private handleDeath(unit: Unit): void {
    this.gameState.units = this.gameState.units.filter(u => u.id !== unit.id);
    const dyingSprite = this.unitSprites.get(unit.id);
    const dyingKey = this.unitKeyMap.get(unit.id) ?? '';
    if (dyingSprite) {
      const deathAnimKey = `${dyingKey}_death`;
      if (dyingSprite.scene?.anims.exists(deathAnimKey)) {
        dyingSprite.once('animationcomplete', () => dyingSprite.destroy());
        playUnitAnim(dyingSprite, dyingKey, 'death', false);
      } else {
        dyingSprite.destroy();
      }
    }
    this.unitSprites.delete(unit.id);
    this.unitKeyMap.delete(unit.id);
    this.hpLabels.get(unit.id)?.destroy();
    this.hpLabels.delete(unit.id);
    this.hpIcons.get(unit.id)?.destroy();
    this.hpIcons.delete(unit.id);
    this.atkLabels.get(unit.id)?.destroy();
    this.atkLabels.delete(unit.id);
    this.atkIcons.get(unit.id)?.destroy();
    this.atkIcons.delete(unit.id);
    if (unit.isGeneral) {
      this.showGameOver(unit.faction === 'player' ? 'DEFEAT' : 'VICTORY');
    }
  }

  private showGameOver(result: 'VICTORY' | 'DEFEAT'): void {
    this.gameOver = true;
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setDepth(20).setInteractive();
    const color = result === 'VICTORY' ? '#ffd700' : '#ff2222';
    this.add.text(width / 2, height / 2 - 40, result, {
      fontSize: '56px', color, fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5).setDepth(21);
    this.add.text(width / 2, height / 2 + 30, 'Click to restart', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5).setDepth(21);
    overlay.on('pointerdown', () => this.scene.restart());
  }

  // ---------------------------------------------------------------------------
  // Coordinate helpers
  // ---------------------------------------------------------------------------

  private pixelToCell(x: number, y: number): Position | null {
    const col = Math.round((x - this.gridOriginX) / this.tileW);
    const row = Math.round((y - this.gridOriginY) / this.tileH);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  protected cellToPixel(col: number, row: number): { x: number; y: number } {
    return {
      x: this.gridOriginX + col * this.tileW,
      y: this.gridOriginY + row * this.tileH,
    };
  }
}
