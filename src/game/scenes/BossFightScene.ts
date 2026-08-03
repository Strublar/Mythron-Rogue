import Phaser from 'phaser';
import { bossForLevel } from '../../data/bosses';
import { FightEngine } from '../../engine/FightEngine';
import { RunState } from '../../engine/RunState';
import type { FightEvent, HeroDef } from '../../types';
import { CombatantView } from '../CombatantView';
import { DragCastController } from '../DragCastController';
import { HeroInspector } from '../HeroInspector';
import { createButton } from '../ui';
import type { InterludeData } from './InterludeScene';
import {
  BOSS_ANCHOR, BOSS_BAR_Y, BOSS_GROUND_Y, BOSS_SCALE, GAME_HEIGHT, GAME_WIDTH,
  HERO_BAR_DY, HERO_GROUND_DY, HERO_SCALE, ROLE_COLOR, withSlots,
} from '../layout';

/** Pause between a boss dying and the between-fights screen opening. */
const NEXT_BOSS_DELAY_MS = 1400;

/** The party built on the selection screen — the only thing the fight needs to start. */
export interface BossFightData {
  party: HeroDef[];
}

export class BossFightScene extends Phaser.Scene {
  private engine!: FightEngine;
  private run!: RunState;
  private party!: HeroDef[];
  private bossView!: CombatantView;
  private heroViews!: Map<string, CombatantView>;
  private dragCast!: DragCastController;
  private inspector!: HeroInspector;
  private bossNameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private startHint!: Phaser.GameObjects.Text;
  private ended = false;
  /** True while the between-fights screen is up: the sim stops, the sprites keep idling. */
  private frozen = false;

  constructor() {
    super({ key: 'BossFightScene' });
  }

  init(data: BossFightData): void {
    this.party = data.party;
  }

  create(): void {
    this.ended = false;
    this.frozen = false;
    this.drawBackground();

    // Each entry into the scene is a brand new run: boons do not carry over.
    this.run = new RunState(this.party);
    const firstBoss = bossForLevel(1);
    this.engine = new FightEngine(this.run.heroDefs(), firstBoss);

    this.bossView = new CombatantView(this, {
      unitKey: firstBoss.unitKey,
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
    this.bossNameText = this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y - 34, firstBoss.name.toUpperCase(), {
        fontFamily: 'Lato', fontSize: '28px', color: '#f3e6c8', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.levelText = this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y - 66, 'LEVEL 1', {
        fontFamily: 'Lato', fontSize: '20px', color: '#ffd76b', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.heroViews = new Map();
    const placed = withSlots(this.run.heroDefs());
    for (const { def, slot } of placed) {
      this.heroViews.set(def.id, new CombatantView(this, {
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
      }));
    }

    this.buildStartHint();
    this.dragCast = new DragCastController(this, this.engine, this.heroViews, this.bossView);
    this.buildInspector(placed);
    this.engine.on('fight', (e: FightEvent) => this.onFightEvent(e));
    this.refreshViews();
  }

  /**
   * Until the opening cast nobody is swinging, so a hold on a hero reads its stats card
   * instead of arming a drag. The sprites are already interactive for drag-casting.
   */
  private buildInspector(placed: { def: HeroDef; slot: { x: number; y: number } }[]): void {
    this.inspector = new HeroInspector(this);
    // Opening the card kills the pending drag, so releasing over the boss never casts.
    this.inspector.onOpen = () => this.dragCast.cancel();

    for (const { def, slot } of placed) {
      const view = this.heroViews.get(def.id);
      if (!view) continue;
      view.sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        // Read the live def: boons swap it in on every new boss.
        const current = this.engine.hero(def.id)?.def ?? def;
        this.inspector.press(current, slot.x, slot.y);
      });
    }
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
      case 'boss_spawn':
        this.onBossSpawn();
        break;
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
        this.bossView.popText(`-${e.amount}`, '#ffd76b');
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
        if (e.amount) heroView?.popText(`+${e.amount}`, '#8ef2a5');
        break;
      case 'hero_death':
        heroView?.playDeath();
        break;
      case 'end':
        this.dragCast.cancel();
        // A cleared boss only ends the *fight*; the run continues one level deeper.
        if (e.outcome === 'victory') {
          this.bossView.playDeath();
          this.time.delayedCall(NEXT_BOSS_DELAY_MS, () => this.openInterlude());
        } else {
          this.showRunOverOverlay(e.level ?? this.engine.level);
        }
        break;
    }
  }

  /**
   * Stops the sim behind the between-fights screen without pausing the scene — a paused
   * scene freezes its UpdateList, and the party should keep idling under the boon window.
   * Input goes off instead, so drag-casts cannot fire and pointers reach the interlude only.
   */
  private openInterlude(): void {
    if (this.ended) return;
    this.frozen = true;
    this.input.enabled = false;
    // Input goes dead here, so anything still in flight would never see its pointer-up.
    this.dragCast.cancel();
    this.inspector.cancel();
    const data: InterludeData = {
      clearedLevel: this.engine.level,
      run: this.run,
      onDone: () => this.resumeRun(),
    };
    this.scene.launch('InterludeScene', data);
  }

  private resumeRun(): void {
    if (this.ended) return;
    this.frozen = false;
    this.input.enabled = true;
    // Stat boons ride in the defs; trigger boons need the engine to hold them.
    this.engine.setBoons(this.run.boons);
    this.engine.startNextBoss(bossForLevel(this.engine.level + 1), this.run.heroDefs());
  }

  /** Resets every bar and sprite for the freshly spawned boss and the restored party. */
  private onBossSpawn(): void {
    const { level, boss } = this.engine;
    this.bossNameText.setText(boss.def.name.toUpperCase());
    this.levelText.setText(`LEVEL ${level}`);
    this.bossView.revive();
    for (const view of this.heroViews.values()) view.revive();
    this.startHint.setVisible(true);
    // A fresh boss re-opens the idle window: stats are inspectable again.
    this.inspector.enabled = true;
    this.refreshViews();
    this.announceLevel(level);
  }

  private announceLevel(level: number): void {
    const banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `LEVEL ${level}`, {
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
    if (!this.ended && !this.frozen) this.engine.tick(delta);
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
      view.setAbilityProgress(
        h.alive ? this.engine.abilityProgress(h.def.id) : 0,
        this.engine.isAbilityReady(h.def.id),
      );
      if (h.alive) view.setThreat(maxThreat > 0 ? h.threat / maxThreat : 0, h.def.id === topThreatId);
    }
  }

  private showRunOverOverlay(highestLevel: number): void {
    this.ended = true;
    const depth = 200;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(depth);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, 'RUN OVER', {
        fontFamily: 'Lato', fontSize: '64px', fontStyle: 'bold', color: '#ff8a80',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'HIGHEST LEVEL', {
        fontFamily: 'Lato', fontSize: '24px', color: '#f3e6c8',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, `${highestLevel}`, {
        fontFamily: 'Lato', fontSize: '72px', fontStyle: 'bold', color: '#ffd76b',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    // A new run means a new party — back to the selection screen, not a blind restart.
    createButton(
      this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, 'RETRY',
      () => this.scene.start('CharacterSelectScene'), depth,
    );
  }
}
