import Phaser from 'phaser';
import { SHADOWLORD } from '../../data/bosses';
import { PARTY } from '../../data/heroes';
import { FightEngine } from '../../engine/FightEngine';
import type { FightEvent } from '../../types';
import { CombatantView } from '../CombatantView';
import { DragCastController } from '../DragCastController';
import {
  BOSS_ANCHOR, BOSS_BAR_Y, BOSS_GROUND_Y, BOSS_SCALE, GAME_HEIGHT, GAME_WIDTH,
  HERO_BAR_DY, HERO_GROUND_DY, HERO_SCALE, HERO_SLOTS,
} from '../layout';

const ROLE_BAR_COLOR = { tank: 0x6fd08c, dps: 0xffb347, heal: 0x7fd4ff } as const;

export class BossFightScene extends Phaser.Scene {
  private engine!: FightEngine;
  private bossView!: CombatantView;
  private heroViews!: Map<string, CombatantView>;
  private dragCast!: DragCastController;
  private ended = false;

  constructor() {
    super({ key: 'BossFightScene' });
  }

  create(): void {
    this.ended = false;
    this.drawBackground();

    this.engine = new FightEngine(PARTY, SHADOWLORD);

    this.bossView = new CombatantView(this, {
      unitKey: SHADOWLORD.unitKey,
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
    this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y - 34, SHADOWLORD.name.toUpperCase(), {
        fontFamily: 'Lato', fontSize: '28px', color: '#f3e6c8', fontStyle: 'bold',
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
      }));
    }

    this.dragCast = new DragCastController(this, this.engine, this.heroViews, this.bossView);
    this.engine.on('fight', (e: FightEvent) => this.onFightEvent(e));
    this.refreshViews();
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
        if (e.outcome === 'victory') this.bossView.playDeath();
        this.showEndOverlay(e.outcome === 'victory');
        break;
    }
  }

  update(_time: number, delta: number): void {
    if (!this.ended) this.engine.tick(delta);
    this.refreshViews();
    this.dragCast.refresh(delta, this.input.activePointer);
  }

  private refreshViews(): void {
    this.bossView.setValues(this.engine.boss.hp, this.engine.boss.def.maxHp);
    for (const h of this.engine.heroes) {
      const view = this.heroViews.get(h.def.id);
      if (!view) continue;
      view.setValues(h.hp, h.def.maxHp, h.shield);
      view.setAbilityProgress(
        h.alive ? this.engine.abilityProgress(h.def.id) : 0,
        this.engine.isAbilityReady(h.def.id),
      );
    }
  }

  private showEndOverlay(victory: boolean): void {
    this.ended = true;
    const depth = 200;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(depth);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, victory ? 'VICTORY' : 'DEFEAT', {
        fontFamily: 'Lato', fontSize: '64px', fontStyle: 'bold',
        color: victory ? '#ffd76b' : '#ff8a80',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    const btn = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'btn_confirm')
      .setInteractive({ useHandCursor: true })
      .setDepth(depth);
    this.add
      .text(btn.x, btn.y, 'RETRY', { fontFamily: 'Lato', fontSize: '26px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    btn.once(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.scene.restart());
  }
}
