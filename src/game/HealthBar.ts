import Phaser from 'phaser';

export interface HealthBarStyle {
  width: number;
  height: number;
  fill: number;
  showText?: boolean;
}

/** Reusable HP + shield bar. Used by both hero views and the boss view. */
export class HealthBar extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly label?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly style: HealthBarStyle) {
    super(scene, x, y);
    this.track = scene.add.graphics();
    this.fill = scene.add.graphics();
    this.add([this.track, this.fill]);

    if (style.showText) {
      this.label = scene.add
        .text(0, 0, '', { fontFamily: 'Lato', fontSize: '18px', color: '#ffffff' })
        .setOrigin(0.5);
      this.add(this.label);
    }

    this.drawTrack();
    scene.add.existing(this);
  }

  private drawTrack(): void {
    const { width: w, height: h } = this.style;
    this.track.clear();
    this.track.fillStyle(0x000000, 0.65).fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 4);
    this.track.lineStyle(1, 0xffffff, 0.25).strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 4);
  }

  setValues(hp: number, maxHp: number, shield = 0): void {
    const { width: w, height: h, fill } = this.style;
    const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    const shieldRatio = Phaser.Math.Clamp(shield / maxHp, 0, 1 - hpRatio);

    this.fill.clear();
    if (hpRatio > 0) {
      this.fill.fillStyle(fill, 1).fillRect(-w / 2, -h / 2, w * hpRatio, h);
    }
    if (shieldRatio > 0) {
      this.fill.fillStyle(0x9ad8ff, 0.9).fillRect(-w / 2 + w * hpRatio, -h / 2, w * shieldRatio, h);
    }
    this.label?.setText(`${Math.ceil(hp)} / ${maxHp}`);
  }
}
