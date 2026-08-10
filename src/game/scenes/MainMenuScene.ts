import Phaser from 'phaser';
import { ENCOUNTER_COUNT, clampEncounter, encounterAt } from '../../data/encounters';
import { gold, savedParty, unlockedCount } from '../../engine/ProgressionStore';
import { createUnitSprite, playUnitAnim } from '../UnitAnimator';

const QUEST_BUTTON_Y = 0.76;
const CHEVRON_DX = 190;

export class MainMenuScene extends Phaser.Scene {
  /** Encounter the QUEST button will start. Defaults to the furthest one unlocked. */
  private picked = 1;
  private questLabel!: Phaser.GameObjects.Text;
  private questSub!: Phaser.GameObjects.Text;
  private chevrons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.picked = unlockedCount();
    this.chevrons = [];

    // Background layers, cover-scaled so portrait doesn't stretch the landscape art.
    this.cover('menu_bg');
    this.cover('menu_midground');

    // Animated boss looming over the menu
    const sprite = createUnitSprite(this, 'boss_shadowlord', width / 2, height * 0.46);
    sprite.setScale((height * 0.28) / sprite.height).setFlipX(true);
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

    this.buildQuestButton(width / 2, height * QUEST_BUTTON_Y);
    // Team and collection both hang off the menu — neither needs a fight to exist.
    this.buildMenuLink(width * 0.3, height * 0.87, 'ROSTER', 'RosterScene');
    this.buildMenuLink(width * 0.7, height * 0.87, 'COLLECTION', 'CollectionScene');
    this.buildMenuLink(width / 2, height * 0.93, `SHOP · ${gold()}G`, 'ShopScene');
  }

  /** A plain text link down to one of the between-encounter pages. */
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

  /**
   * QUEST fights `picked` with the saved roster. The chevrons on either side step through
   * the encounters already unlocked, so a cleared one can be replayed for its payout.
   */
  private buildQuestButton(x: number, y: number): void {
    const btn = this.add.image(x, y, 'btn_confirm').setInteractive({ useHandCursor: true });
    const btnGlow = this.add.image(x, y, 'btn_confirm_glow').setAlpha(0);

    const label = this.add.text(x, y, 'QUEST', {
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

    btn.on('pointerdown', () => this.startQuest());

    this.questLabel = this.add.text(x, y - 52, '', {
      fontSize: '24px', fontFamily: 'Georgia, serif', color: '#ffd76b',
      stroke: '#1a0a00', strokeThickness: 4,
    }).setOrigin(0.5);
    this.questSub = this.add.text(x, y + 52, '', {
      fontSize: '17px', fontFamily: 'Georgia, serif', color: '#c0a060',
      stroke: '#1a0a00', strokeThickness: 3,
    }).setOrigin(0.5);

    this.chevrons = [
      this.buildChevron(x - CHEVRON_DX, y - 52, '◀', -1),
      this.buildChevron(x + CHEVRON_DX, y - 52, '▶', 1),
    ];
    this.refreshQuest();
  }

  private buildChevron(x: number, y: number, glyph: string, step: number): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, glyph, {
      fontSize: '34px', fontFamily: 'Georgia, serif', color: '#c0a060',
      stroke: '#1a0a00', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    label.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      const next = clampEncounter(this.picked + step);
      if (next === this.picked || next > unlockedCount()) return;
      this.picked = next;
      this.refreshQuest();
    });
    return label;
  }

  /** Repaints the encounter caption and dims a chevron that has nowhere left to go. */
  private refreshQuest(): void {
    const unlocked = unlockedCount();
    const enc = encounterAt(this.picked);
    this.questLabel.setText(`ENCOUNTER ${enc.index} / ${ENCOUNTER_COUNT}`);
    this.questSub.setText(`${enc.name.toUpperCase()}  ·  +${enc.exp} EXP  ·  +${enc.gold}G`);
    const [prev, next] = this.chevrons;
    prev.setAlpha(this.picked > 1 ? 1 : 0.25);
    next.setAlpha(this.picked < unlocked ? 1 : 0.25);
  }

  private startQuest(): void {
    const data = { party: savedParty(), encounter: encounterAt(this.picked) };
    this.cameras.main.fadeOut(400, 0, 0, 0, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) this.scene.start('BossFightScene', data);
    });
  }
}
