import Phaser from 'phaser';
import { bossForLevel } from '../../data/bosses';
import { PARTY } from '../../data/heroes';
import { FightEngine } from '../../engine/FightEngine';
import type { FightEvent } from '../../types';
import { CombatantView } from '../CombatantView';
import { DragCastController } from '../DragCastController';
import { createButton } from '../ui';
import type { InterludeData } from './InterludeScene';
import {
  BOSS_ANCHOR, BOSS_BAR_Y, BOSS_GROUND_Y, BOSS_SCALE, GAME_HEIGHT, GAME_WIDTH,
  HERO_BAR_DY, HERO_GROUND_DY, HERO_SCALE, HERO_SLOTS,
} from '../layout';

const ROLE_BAR_COLOR = { tank: 0x6fd08c, dps: 0xffb347, heal: 0x7fd4ff } as const;
/** Pause between a boss dying and the between-fights screen opening. */
const NEXT_BOSS_DELAY_MS = 1400;

export class BossFightScene extends Phaser.Scene {
  private engine!: FightEngine;
  private bossView!: CombatantView;
  private heroViews!: Map<string, CombatantView>;
  private dragCast!: DragCastController;
  private bossNameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private startHint!: Phaser.GameObjects.Text;
  private ended = false;

  constructor() {
    super({ key: 'BossFightScene' });
  }

  create(): void {
    this.ended = false;
    this.drawBackground();

    const firstBoss = bossForLevel(1);
    this.engine = new FightEngine(PARTY, firstBoss);

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
    const slotIndex = { tank: 0, dps: 0, heal: 0 };
    for (const def of PARTY) {
      const slot = HERO_SLOTS[def.role][slotIndex[def.role]++];
      this.heroViews.set(def.id, new CombatantView(this, {
        unitKey: def.unitKey,
        x: slot.x,
        y: slot.y,
        scale: HERO_SCALE,
        barWidth: 96,
        barY: slot.y + HERO_BAR_DY,
        groundY: slot.y + HERO_GROUND_DY,
        barFill: ROLE_BAR_COLOR[def.role],
        showAbilityBar: true,
        showThreat: true,
      }));
    }

    this.buildStartHint();
    this.dragCast = new DragCastController(this, this.engine, this.heroViews, this.bossView);
    this.engine.on('fight', (e: FightEvent) => this.onFightEvent(e));
    this.refreshViews();
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

  /** Freezes the battlefield behind the between-fights screen until CONTINUE. */
  private openInterlude(): void {
    if (this.ended) return;
    const clearedLevel = this.engine.level;
    const data: InterludeData = { clearedLevel, nextBoss: bossForLevel(clearedLevel + 1) };
    this.events.once(Phaser.Scenes.Events.RESUME, () => this.advanceRun());
    this.scene.launch('InterludeScene', data);
    this.scene.pause();
  }

  private advanceRun(): void {
    if (this.ended) return;
    this.engine.startNextBoss(bossForLevel(this.engine.level + 1));
  }

  /** Resets every bar and sprite for the freshly spawned boss and the restored party. */
  private onBossSpawn(): void {
    const { level, boss } = this.engine;
    this.bossNameText.setText(boss.def.name.toUpperCase());
    this.levelText.setText(`LEVEL ${level}`);
    this.bossView.revive();
    for (const view of this.heroViews.values()) view.revive();
    this.startHint.setVisible(true);
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

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, 'RETRY', () => this.scene.restart(), depth);
  }
}
