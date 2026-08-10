import Phaser from 'phaser';
import { TAG_LABEL } from '../../data/heroes';
import { GENERALS } from '../../data/generals';
import { isPrismatic } from '../../engine/ProgressionStore';
import type { HeroDef } from '../../types';
import { createHeroCard } from '../HeroCard';
import { HeroInspector } from '../HeroInspector';
import { createButton } from '../ui';
import { GAME_HEIGHT, GAME_WIDTH, HERO_SCALE, seatSlot, GENERAL_SEAT } from '../layout';
import { createUnitSprite } from '../UnitAnimator';

/** General grid. Two rows of three, parked in the boss zone. */
const GRID = {
  top: 150, cols: 3,
  cardW: 216, cardH: 150, gapX: 12, gapY: 12,
};
const GRID_DEPTH = 40;
const START_BUTTON_Y = 1252;

/**
 * Pre-run screen: one general, and the run starts with it alone. The pick stands at the
 * centre dps seat it will open the fight in, so the screen reads as the fight it sets up.
 */
export class GeneralSelectScene extends Phaser.Scene {
  private general!: HeroDef;
  private inspector!: HeroInspector;
  /** Set when a press turned into an inspect — that release must not also count as a tap. */
  private inspected = false;
  private previewObjects: Phaser.GameObjects.GameObject[] = [];
  private gridObjects: Phaser.GameObjects.GameObject[] = [];
  private tagline!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GeneralSelectScene' });
  }

  create(): void {
    this.general = GENERALS[0];
    this.previewObjects = [];
    this.gridObjects = [];

    this.drawBackground();
    this.label(GAME_WIDTH / 2, 46, 'CHOOSE YOUR GENERAL', 38, '#ffd76b', 'bold');
    this.label(GAME_WIDTH / 2, 84, 'It fights the first boss alone · hold a card for stats', 18, '#9aa3b8');
    this.tagline = this.label(GAME_WIDTH / 2, 112, '', 16, '#ffd76b', 'bold');

    this.inspector = new HeroInspector(this);
    this.inspector.onOpen = () => { this.inspected = true; };

    this.drawGrid();
    this.drawPreview();

    createButton(this, GAME_WIDTH / 2, START_BUTTON_Y, 'START RUN', () => this.startRun());
  }

  private drawGrid(): void {
    for (const o of this.gridObjects) o.destroy();
    // The cards make their own objects, so diff the display list to own them all.
    const before = new Set(this.children.list);

    const rowW = GRID.cols * GRID.cardW + (GRID.cols - 1) * GRID.gapX;
    const left = (GAME_WIDTH - rowW) / 2 + GRID.cardW / 2;

    GENERALS.forEach((hero, i) => {
      const x = left + (i % GRID.cols) * (GRID.cardW + GRID.gapX);
      const y = GRID.top + Math.floor(i / GRID.cols) * (GRID.cardH + GRID.gapY) + GRID.cardH / 2;
      createHeroCard(this, x, y, GRID.cardW, GRID.cardH, hero, {
        taken: false,
        current: hero.id === this.general.id,
        prismatic: isPrismatic(hero.id),
        onPressStart: (h, hx, hy) => this.beginPress(h, hx, hy),
        onPressCancel: () => this.inspector.cancel(),
        onTap: picked => { if (this.wasTap()) this.select(picked); },
      }, GRID_DEPTH);
    });

    this.gridObjects = this.children.list.filter(o => !before.has(o));
  }

  private select(hero: HeroDef): void {
    if (hero.id === this.general.id) return;
    this.general = hero;
    // The cards carry the "current" frame, so the whole grid redraws with the pick.
    this.drawGrid();
    this.drawPreview();
  }

  /** The chosen general, standing at the seat it opens the run in. */
  private drawPreview(): void {
    for (const o of this.previewObjects) o.destroy();
    const slot = seatSlot(GENERAL_SEAT);
    const sprite = createUnitSprite(this, this.general.unitKey, slot.x, slot.y).setScale(HERO_SCALE);
    const name = this.label(slot.x, slot.y - 84, this.general.name.toUpperCase(), 18, '#ffd76b', 'bold');
    this.previewObjects = [sprite, name];
    this.tagline.setText(this.general.tags.map(t => TAG_LABEL[t].toUpperCase()).join('  ·  '));
  }

  /** Arms the shared long-press. Pair with `wasTap` on the matching release. */
  private beginPress(hero: HeroDef, x: number, y: number): void {
    this.inspected = false;
    this.inspector.press(hero, x, y);
  }

  /** True when the gesture that just ended was a tap rather than an inspect. */
  private wasTap(): boolean {
    const tap = !this.inspected;
    this.inspector.cancel();
    return tap;
  }

  private startRun(): void {
    this.inspector.cancel();
    this.cameras.main.fadeOut(300, 0, 0, 0, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) this.scene.start('BossFightScene', { general: this.general });
    });
  }

  private drawBackground(): void {
    for (const key of ['combat_bg', 'combat_mid']) {
      const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
      img.setScale(Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height));
    }
    this.add.graphics().fillStyle(0x05060f, 0.7).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private label(
    x: number, y: number, text: string, size: number, color: string, style = '',
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        fontFamily: 'Lato', fontSize: `${size}px`, color, fontStyle: style,
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5);
  }
}
