import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { createUnitSprite, hasUnitAnim, playUnitAnim, type UnitAnimKey } from './UnitAnimator';

export interface CombatantViewOptions {
  unitKey: string;
  x: number;
  y: number;
  scale: number;
  flipX?: boolean;
  barWidth: number;
  barFill: number;
  barText?: boolean;
  /** Absolute y of the health bar. */
  barY: number;
  /** Absolute y of the ground ring — a shared row baseline, since frames are padded. */
  groundY: number;
  /** Heroes get a mana bar + a ready ring; the boss does not. */
  showAbilityBar?: boolean;
  /** Heroes get a threat bar + an aggro marker; the boss does not. */
  showThreat?: boolean;
}

const READY_RING_COLOR = 0xffd76b;
const THREAT_COLOR = 0xff5a4a;
/** Mana blue, the same hue the stats card prints MANA REGEN in. */
const MANA_COLOR = 0x4fb8ff;

/** Sprite + health bar + (heroes only) ability mana bar and ready ring. */
export class CombatantView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly bar: HealthBar;
  private readonly readyRing?: Phaser.GameObjects.Ellipse;
  private readonly manaBar?: Phaser.GameObjects.Graphics;
  private readonly manaY: number;
  private readonly threatBar?: Phaser.GameObjects.Graphics;
  private readonly threatY: number;
  private readonly aggroMark?: Phaser.GameObjects.Triangle;
  private ready = false;
  private hasAggro = false;

  constructor(private readonly scene: Phaser.Scene, private readonly opts: CombatantViewOptions) {
    if (opts.showAbilityBar) {
      this.readyRing = scene.add
        .ellipse(opts.x, opts.groundY, opts.barWidth, opts.barWidth * 0.38)
        .setStrokeStyle(3, READY_RING_COLOR, 0.9)
        .setVisible(false);
    }

    this.sprite = createUnitSprite(scene, opts.unitKey, opts.x, opts.y).setScale(opts.scale);
    if (opts.flipX) this.sprite.setFlipX(true);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (!anim.key.endsWith('_death')) playUnitAnim(this.sprite, opts.unitKey, 'idle', false);
    });

    const { barY } = opts;
    this.bar = new HealthBar(scene, opts.x, barY, {
      width: opts.barWidth,
      height: opts.barText ? 22 : 8,
      fill: opts.barFill,
      showText: opts.barText,
    });

    this.manaY = barY + 9;
    if (opts.showAbilityBar) {
      this.manaBar = scene.add.graphics();
      this.drawMana(1);
    }

    // Threat sits above the hp bar: a bar for the score, a marker for who holds aggro.
    this.threatY = barY - 16;
    if (opts.showThreat) {
      this.threatBar = scene.add.graphics();
      this.drawThreat(0);
      this.aggroMark = scene.add
        .triangle(opts.x, barY - 30, 0, 0, 16, 0, 8, 14, THREAT_COLOR)
        .setOrigin(0.5)
        .setVisible(false)
        .setDepth(96);
    }
  }

  get x(): number { return this.opts.x; }
  get y(): number { return this.opts.y; }
  get groundY(): number { return this.opts.groundY; }

  setValues(hp: number, maxHp: number, shield = 0): void {
    this.bar.setValues(hp, maxHp, shield);
  }

  /** progress: 0 = just cast, 1 = mana full and the ability castable. */
  setManaProgress(progress: number, ready: boolean): void {
    this.drawMana(progress);
    if (ready === this.ready) return;
    this.ready = ready;
    this.readyRing?.setVisible(ready);
    this.sprite.setTint(ready ? 0xffffff : 0x8c8c9c);
  }

  /** ratio: this hero's threat over the party's highest. `top` = boss is aiming here. */
  setThreat(ratio: number, top: boolean): void {
    const changed = top !== this.hasAggro;
    this.hasAggro = top;
    this.drawThreat(ratio);
    if (!changed || !this.aggroMark) return;
    this.aggroMark.setVisible(top);
    this.scene.tweens.killTweensOf(this.aggroMark);
    if (!top) return;
    this.aggroMark.setAlpha(1).setScale(1);
    this.scene.tweens.add({
      targets: this.aggroMark,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0.5,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawThreat(ratio: number): void {
    if (!this.threatBar) return;
    const w = this.opts.barWidth;
    this.threatBar.clear();
    this.threatBar.fillStyle(0x000000, 0.5).fillRect(this.opts.x - w / 2, this.threatY, w, 4);
    this.threatBar
      .fillStyle(THREAT_COLOR, this.hasAggro ? 1 : 0.65)
      .fillRect(this.opts.x - w / 2, this.threatY, w * Phaser.Math.Clamp(ratio, 0, 1), 4);
  }

  private drawMana(progress: number): void {
    if (!this.manaBar) return;
    const w = this.opts.barWidth;
    this.manaBar.clear();
    this.manaBar.fillStyle(0x000000, 0.6).fillRect(this.opts.x - w / 2, this.manaY, w, 5);
    this.manaBar
      .fillStyle(MANA_COLOR, 1)
      .fillRect(this.opts.x - w / 2, this.manaY, w * Phaser.Math.Clamp(progress, 0, 1), 5);
  }

  /** Plays `anim`, or `fallback` when the atlas lacks it (most units have no cast clip). */
  play(anim: UnitAnimKey, fallback?: UnitAnimKey): void {
    const key = !hasUnitAnim(this.scene, this.opts.unitKey, anim) && fallback ? fallback : anim;
    playUnitAnim(this.sprite, this.opts.unitKey, key, false);
  }

  /** Brief expanding ring — marks an ability cast apart from an auto-attack. */
  flash(): void {
    const ring = this.scene.add
      .ellipse(this.opts.x, this.opts.groundY, this.opts.barWidth * 0.5, this.opts.barWidth * 0.2)
      .setStrokeStyle(4, READY_RING_COLOR, 1)
      .setDepth(95);
    this.scene.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** Short lunge toward a point — reads as "striking" without leaving the slot. */
  lungeToward(targetY: number): void {
    const dir = Math.sign(targetY - this.opts.y) || -1;
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.opts.y + dir * 18,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  playDeath(): void {
    this.play('death');
    this.readyRing?.setVisible(false);
    this.manaBar?.clear();
    this.clearThreat();
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.35, duration: 600, delay: 300 });
  }

  /** Undoes playDeath — used when the next boss of the run spawns. */
  revive(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setAlpha(1).clearTint().setPosition(this.opts.x, this.opts.y);
    this.play('idle');
    this.ready = false;
    if (this.opts.showAbilityBar) this.sprite.setTint(0x8c8c9c);
    this.readyRing?.setVisible(false);
    this.drawMana(0);
    this.clearThreat();
  }

  private clearThreat(): void {
    this.hasAggro = false;
    this.threatBar?.clear();
    if (!this.aggroMark) return;
    this.scene.tweens.killTweensOf(this.aggroMark);
    this.aggroMark.setVisible(false);
  }

  /** Floating number above the combatant; jittered so bursts don't stack illegibly. */
  popText(text: string, color: string): void {
    const label = this.scene.add
      .text(this.opts.x + Phaser.Math.Between(-28, 28), this.opts.groundY - 60, text, {
        fontFamily: 'Lato',
        fontSize: '26px',
        color,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 55,
      alpha: 0,
      duration: 750,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}
