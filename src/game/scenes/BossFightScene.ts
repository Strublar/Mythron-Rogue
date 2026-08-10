import Phaser from 'phaser';
import { FightEngine } from '../../engine/FightEngine';
import { grantEncounterRewards } from '../../engine/ProgressionStore';
import type { EncounterDef, FightEvent, HeroDef } from '../../types';
import { CombatantView } from '../CombatantView';
import { DragCastController } from '../DragCastController';
import { HeroInspector } from '../HeroInspector';
import type { ResultData } from './ResultScene';
import {
  BOSS_ANCHOR, BOSS_BAR_Y, BOSS_GROUND_Y, BOSS_SCALE, GAME_HEIGHT, GAME_WIDTH,
  HERO_BAR_DY, HERO_GROUND_DY, HERO_SCALE, ROLE_COLOR, withSlots,
} from '../layout';

/** Pause between the last blow landing and the result screen opening. */
const RESULT_DELAY_MS = 1400;

/** One encounter fought by the saved roster — everything the fight needs to start. */
export interface BossFightData {
  party: HeroDef[];
  encounter: EncounterDef;
}

export class BossFightScene extends Phaser.Scene {
  private engine!: FightEngine;
  private encounter!: EncounterDef;
  private party!: HeroDef[];
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
    this.party = data.party;
    this.encounter = data.encounter;
  }

  create(): void {
    this.ended = false;
    this.drawBackground();

    const boss = this.encounter.boss;
    this.engine = new FightEngine(this.party, boss, this.encounter.index);

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
    // Boss name and encounter number never change inside a fight — draw them once.
    this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y - 34, boss.name.toUpperCase(), {
        fontFamily: 'Lato', fontSize: '28px', color: '#f3e6c8', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y - 66, `ENCOUNTER ${this.encounter.index}`, {
        fontFamily: 'Lato', fontSize: '20px', color: '#ffd76b', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.heroViews = new Map();
    const placed = withSlots(this.party);
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
    this.announceEncounter(this.encounter.index);
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
        // Read the def the engine holds — it is the one the fight resolves against.
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
        this.endEncounter(e.outcome === 'victory');
        break;
    }
  }

  /**
   * Freezes the fight and hands over to the result screen. A win pays out first — the store
   * is the only writer, and the screen animates what it returns. A loss pays nothing.
   */
  private endEncounter(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.dragCast.cancel();
    this.inspector.cancel();
    this.input.enabled = false;
    if (victory) this.bossView.playDeath();

    const reward = victory
      ? grantEncounterRewards(this.party, this.encounter)
      : { gains: [], gold: 0, unlocked: false };

    this.time.delayedCall(RESULT_DELAY_MS, () => {
      const data: ResultData = {
        victory,
        encounter: this.encounter,
        party: this.party,
        gains: reward.gains,
        gold: reward.gold,
        unlocked: reward.unlocked,
      };
      this.scene.start('ResultScene', data);
    });
  }

  private announceEncounter(index: number): void {
    const banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `ENCOUNTER ${index}`, {
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
}
