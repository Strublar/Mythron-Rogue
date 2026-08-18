import Phaser from 'phaser';
import { createUnitSprite, playUnitAnim } from '../UnitAnimator';
import { gold } from '../../engine/ProgressionStore';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background layers, cover-scaled so portrait doesn't stretch the landscape art.
    this.cover('menu_bg');
    this.cover('menu_midground');

    // Animated boss looming over the menu
    const sprite = createUnitSprite(this, 'boss_shadowlord', width / 2, height * 0.52);
    sprite.setScale((height * 0.3) / sprite.height).setFlipX(true);
    playUnitAnim(sprite, 'boss_shadowlord', 'breathing', true);

    this.cover('menu_vignette').setAlpha(0.55);

    // Title
    this.add.text(width / 2, height * 0.14, 'MYTHRON', {
      fontSize: '52px',
      fontFamily: 'Georgia, serif',
      color: '#f0d080',
      stroke: '#3a1a00',
      strokeThickness: 6,
      shadow: { offsetX: 2, offsetY: 4, color: '#000000', blur: 8, fill: true },
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.21, 'Seven heroes. One boss.', {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      color: '#c0a060',
      stroke: '#1a0a00',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.buildStartButton(width / 2, height * 0.8);
    // The team page owns the collection now, so the shop is the only other stop.
    this.buildMenuLink(width / 2, height * 0.89, `SHOP · ${gold()}G`, 'ShopScene');
  }

  /** A plain text link down to one of the between-run pages. */
  private buildMenuLink(x: number, y: number, text: string, sceneKey: string): void {
    const label = this.add.text(x, y, text, {
      fontSize: '22px',
      fontFamily: 'Georgia, serif',
      color: '#c0a060',
      stroke: '#1a0a00',
      strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    label.on('pointerover', () => label.setColor('#ffe080'));
    label.on('pointerout', () => label.setColor('#c0a060'));
    label.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.scene.start(sceneKey));
  }

  /** Scale an image to cover the portrait canvas without distorting it. */
  private cover(key: string): Phaser.GameObjects.Image {
    const { width, height } = this.scale;
    const img = this.add.image(width / 2, height / 2, key);
    img.setScale(Math.max(width / img.width, height / img.height));
    return img;
  }

  private buildStartButton(x: number, y: number): void {
    const btn = this.add.image(x, y, 'btn_confirm').setInteractive({ useHandCursor: true });
    const btnGlow = this.add.image(x, y, 'btn_confirm_glow').setAlpha(0);

    const label = this.add.text(x, y, 'FIGHT BOSS', {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1);

    btn.on('pointerover', () => {
      btnGlow.setAlpha(1);
      label.setColor('#ffe080');
      this.tweens.add({ targets: btn, scaleX: 1.06, scaleY: 1.06, duration: 120, ease: 'Sine.easeOut' });
    });

    btn.on('pointerout', () => {
      btnGlow.setAlpha(0);
      label.setColor('#ffffff');
      this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 120, ease: 'Sine.easeOut' });
    });

    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(400, 0, 0, 0, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) {
          this.scene.start('TeamScene');
        }
      });
    });
  }
}
