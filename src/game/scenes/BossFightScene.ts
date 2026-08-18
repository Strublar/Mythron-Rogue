import Phaser from 'phaser';
import { bossForStage, goldForStage } from '../../data/bosses';
import { FightEngine } from '../../engine/FightEngine';
import type { RunState } from '../../engine/RunState';
import type { FightEvent, FightOutcome, HeroDef } from '../../types';
import { CombatantView } from '../CombatantView';
import { DragCastController } from '../DragCastController';
import { HeroInspector } from '../HeroInspector';
import { STAT_COLOR } from '../statDisplay';
import { createButton } from '../ui';
import {
  BOSS_ANCHOR, BOSS_BAR_Y, BOSS_GROUND_Y, BOSS_SCALE, GAME_HEIGHT, GAME_WIDTH,
  HERO_BAR_DY, HERO_GROUND_DY, HERO_SCALE, ROLE_COLOR, seatSlot,
} from '../layout';

/** Pause between the boss dying and the result screen, so the death animation plays out. */
const RESULT_DELAY_MS = 1400;

/** One stage of a run. The run carries the team, the stage number and the purse. */
export interface BossFightData {
  run: RunState;
}

export class BossFightScene extends Phaser.Scene {
  private engine!: FightEngine;
  private run!: RunState;
  private team!: HeroDef[];
  private bossView!: CombatantView;
  private heroViews!: Map<string, CombatantView>;
  private dragCast!: DragCastController;
  private inspector!: HeroInspector;
  private startHint!: Phaser.GameObjects.Text;
  private ended = false;

  constructor() {
    super({ key: 'BossFightScene' });
  }

  init(data: BossFightData): void {
    this.run = data.run;
    this.team = this.run.party();
  }

  create(): void {
    this.ended = false;
    this.drawBackground();

    // The team is whatever the interlude left in the seats; a stage is one fresh engine.
    const boss = bossForStage(this.run.stage);
    this.engine = new FightEngine(this.team, boss);

    this.bossView = new CombatantView(this, {
      unitKey: boss.unitKey,
      x: BOSS_ANCHOR.x,
      y: BOSS_ANCHOR.y,
      scale: BOSS_SCALE,
      flipX: true,
      barWidth: GAME_WIDTH - 80,
      barY: BOSS_BAR_Y,
      groundY: BOSS_GROUND_Y,
      barFill: 0xd7443e,
      barText: true,
    });
    // Neither caption changes during a fight, so neither needs keeping.
    this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y - 34, boss.name.toUpperCase(), {
        fontFamily: 'Lato', fontSize: '28px', color: '#f3e6c8', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y - 66, `STAGE ${this.run.stage}`, {
        fontFamily: 'Lato', fontSize: '20px', color: '#ffd76b', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.heroViews = new Map();
    this.buildStartHint();
    this.dragCast = new DragCastController(this, this.engine, this.heroViews, this.bossView);
    this.inspector = new HeroInspector(this);
    // Opening the card kills the pending drag, so releasing over the boss never casts.
    this.inspector.onOpen = () => this.dragCast.cancel();

    // The team arrives in seat order, so its index *is* its seat.
    this.team.forEach((def, seat) => this.addHeroView(def, seatSlot(seat)));

    this.engine.on('fight', (e: FightEvent) => this.onFightEvent(e));
    this.refreshViews();
    this.announceStage();
  }

  /**
   * Seats one hero on the battlefield: sprite, bars, drag-cast and the long-press stats
   * card. Until the opening cast nobody is swinging, so a hold reads the card instead of
   * dragging.
   */
  private addHeroView(def: HeroDef, slot: { x: number; y: number }): void {
    const view = new CombatantView(this, {
      unitKey: def.unitKey,
      x: slot.x,
      y: slot.y,
      scale: HERO_SCALE,
      barWidth: 96,
      barY: slot.y + HERO_BAR_DY,
      groundY: slot.y + HERO_GROUND_DY,
      barFill: ROLE_COLOR[def.role],
      showAbilityBar: true,
      showThreat: true,
    });
    this.heroViews.set(def.id, view);
    this.dragCast.register(def.id, view);
    view.sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.inspector.press(this.engine.hero(def.id)?.def ?? def, slot.x, slot.y);
    });
  }

  /** Nobody swings until the first ability lands — tell the player so. */
  private buildStartHint(): void {
    this.startHint = this.add
      .text(GAME_WIDTH / 2, 640, 'DRAG A HERO TO CAST AND BEGIN', {
        fontFamily: 'Lato', fontSize: '24px', fontStyle: 'bold', color: '#ffd76b',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(120);
    this.tweens.add({
      targets: this.startHint,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawBackground(): void {
    for (const key of ['combat_bg', 'combat_mid']) {
      const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
      const scale = Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height);
      img.setScale(scale);
    }
    // Darken the lower half so the party and their bars read against the map.
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x05060f, 0x05060f, 0x05060f, 0x05060f, 0, 0, 0.6, 0.6);
    shade.fillRect(0, GAME_HEIGHT * 0.42, GAME_WIDTH, GAME_HEIGHT * 0.22);
    shade.fillStyle(0x05060f, 0.6).fillRect(0, GAME_HEIGHT * 0.64, GAME_WIDTH, GAME_HEIGHT * 0.36);
  }

  private onFightEvent(e: FightEvent): void {
    const heroView = e.heroId ? this.heroViews.get(e.heroId) : undefined;

    switch (e.type) {
      case 'fight_start':
        this.startHint.setVisible(false);
        // Once blades are out, hero pointer-down belongs to drag-cast alone.
        this.inspector.enabled = false;
        this.inspector.cancel();
        break;
      case 'hero_taunt':
        heroView?.popText('TAUNT!', '#ff5a4a');
        break;
      case 'hero_attack':
      case 'hero_cast':
        heroView?.play(e.type === 'hero_cast' ? 'cast' : 'attack', 'attack');
        heroView?.lungeToward(e.targetHeroId ? (this.heroViews.get(e.targetHeroId)?.y ?? 0) : BOSS_ANCHOR.y);
        if (e.type === 'hero_cast') heroView?.flash();
        break;
      case 'boss_attack':
        this.bossView.play('attack');
        break;
      case 'boss_damaged':
        // A crit reads in the crit hue with a bang, so the roll is visible without a tooltip.
        this.bossView.popText(e.crit ? `-${e.amount}!` : `-${e.amount}`, e.crit ? STAT_COLOR.crit : '#ffd76b');
        break;
      case 'boss_stunned':
        this.bossView.popText('STAGGERED!', '#7fd4ff');
        break;
      case 'hero_shielded':
        heroView?.popText(`+${e.amount}`, '#9fd8ff');
        break;
      case 'hero_buffed':
        heroView?.popText('BUFFED!', '#ffe9a8');
        break;
      case 'hero_damaged':
        heroView?.play('hit');
        heroView?.popText(`-${e.amount}`, '#ff8a80');
        break;
      case 'hero_healed':
        if (e.amount) heroView?.popText(e.crit ? `+${e.amount}!` : `+${e.amount}`, e.crit ? STAT_COLOR.crit : '#8ef2a5');
        break;
      case 'hero_death':
        heroView?.playDeath();
        break;
      case 'end':
        this.dragCast.cancel();
        this.ended = true;
        // A clear opens the interlude; a wipe ends the run. Either way, after the death.
        if (e.outcome === 'victory') this.bossView.playDeath();
        this.time.delayedCall(
          RESULT_DELAY_MS, () => this.showResultOverlay(e.outcome ?? 'defeat'),
        );
        break;
    }
  }

  private announceStage(): void {
    const banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `STAGE ${this.run.stage}`, {
        fontFamily: 'Lato', fontSize: '72px', fontStyle: 'bold', color: '#ffd76b',
        stroke: '#000000', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(150);
    this.tweens.add({
      targets: banner,
      y: banner.y - 70,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => banner.destroy(),
    });
  }

  update(_time: number, delta: number): void {
    if (!this.ended) this.engine.tick(delta);
    this.refreshViews();
    this.dragCast.refresh(delta, this.input.activePointer);
  }

  private refreshViews(): void {
    this.bossView.setValues(this.engine.boss.hp, this.engine.boss.def.maxHp);
    const topThreatId = this.engine.topThreatHero()?.def.id;
    const maxThreat = this.engine.maxThreat();
    for (const h of this.engine.heroes) {
      const view = this.heroViews.get(h.def.id);
      if (!view) continue;
      view.setValues(h.hp, h.def.maxHp, h.shield);
      view.setManaProgress(
        h.alive ? this.engine.abilityProgress(h.def.id) : 0,
        this.engine.isAbilityReady(h.def.id),
      );
      if (h.alive) view.setThreat(maxThreat > 0 ? h.threat / maxThreat : 0, h.def.id === topThreatId);
    }
  }

  /**
   * The stage's result screen. A clear banks the stage's gold and opens the interlude;
   * a wipe ends the run outright — there is no retry, the next run starts from scratch.
   */
  private showResultOverlay(outcome: FightOutcome): void {
    const won = outcome === 'victory';
    const depth = 200;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(depth);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 200, won ? 'VICTORY' : 'RUN OVER', {
        fontFamily: 'Lato', fontSize: '64px', fontStyle: 'bold', color: won ? '#ffd76b' : '#ff8a80',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, `STAGE ${this.run.stage}`, {
        fontFamily: 'Lato', fontSize: '28px', fontStyle: 'bold', color: '#f3e6c8',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    const bottom = won ? this.drawClearReport(depth) : this.drawWipeNote(depth);
    const buttonY = Math.max(bottom + 80, GAME_HEIGHT - 180);

    createButton(
      this, GAME_WIDTH / 2, buttonY, won ? 'CONTINUE' : 'MENU',
      () => (won
        ? this.scene.start('InterludeScene', { run: this.run, phase: 'offer' })
        : this.scene.start('MainMenuScene')),
      depth,
    );
  }

  /** Banks the stage's gold, then reports the purse the shop is about to see. */
  private drawClearReport(depth: number): number {
    const earned = goldForStage(this.run.stage);
    this.run.award(earned);

    const y = GAME_HEIGHT / 2 - 60;
    this.add
      .text(GAME_WIDTH / 2, y, `+${earned} GOLD`, {
        fontFamily: 'Lato', fontSize: '30px', fontStyle: 'bold', color: '#ffd76b',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.add
      .text(GAME_WIDTH / 2, y + 42, `PURSE  ${this.run.gold}G`, {
        fontFamily: 'Lato', fontSize: '22px', color: '#f3e6c8',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    return y + 42;
  }

  /** A wipe is the end of the run — nothing carries over to the next one. */
  private drawWipeNote(depth: number): number {
    const y = GAME_HEIGHT / 2 - 60;
    this.add
      .text(GAME_WIDTH / 2, y, `THE PARTY FELL ON STAGE ${this.run.stage}`, {
        fontFamily: 'Lato', fontSize: '22px', color: '#9aa3b8',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.add
      .text(GAME_WIDTH / 2, y + 40, 'The next run starts fresh.', {
        fontFamily: 'Lato', fontSize: '20px', color: '#9aa3b8',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    return y + 40;
  }
}
