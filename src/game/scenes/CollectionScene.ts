import Phaser from 'phaser';
import { heroesByRole } from '../../data/heroes';
import { MAX_HERO_LEVEL, PASSIVE_LEVEL } from '../../data/progression';
import { heroProgress, leveledRoster } from '../../engine/ProgressionStore';
import type { HeroDef, HeroRole } from '../../types';
import { createHeroCard } from '../HeroCard';
import { HeroInspector } from '../HeroInspector';
import { createButton } from '../ui';
import { GAME_HEIGHT, GAME_WIDTH, ROLE_COLOR } from '../layout';

const ROLE_ORDER: HeroRole[] = ['tank', 'dps', 'heal'];
const TAB_LABEL: Record<HeroRole, string> = { tank: 'TANKS', dps: 'DPS', heal: 'HEALERS' };

const TABS_Y = 150;
const TAB_W = 200;
const TAB_H = 52;
/** Cards carry a level badge and an exp bar, so they run taller than the party grid's. */
const GRID = { top: 200, cols: 3, cardW: 216, cardH: 176, gapX: 12, gapY: 14 };
const BACK_BUTTON_Y = GAME_HEIGHT - 70;

const hexColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Between-runs collection: every hero in the roster with the level and exp it has earned.
 * One role at a time (a 9-hero row set is the tallest), holding a card opens its full
 * stats card — the same one the fight screens use, so passives read identically.
 */
export class CollectionScene extends Phaser.Scene {
  private roster: HeroDef[] = [];
  private inspector!: HeroInspector;
  private role: HeroRole = 'tank';
  private gridObjects: Phaser.GameObjects.GameObject[] = [];
  private tabObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'CollectionScene' });
  }

  create(): void {
    this.roster = leveledRoster();
    this.gridObjects = [];
    this.tabObjects = [];

    this.drawBackground();
    this.label(GAME_WIDTH / 2, 46, 'COLLECTION', 38, '#ffd76b', 'bold');
    this.label(
      GAME_WIDTH / 2, 88,
      `Hold a hero for its stats · passive unlocks at level ${PASSIVE_LEVEL} · max ${MAX_HERO_LEVEL}`,
      16, '#9aa3b8',
    );
    this.label(GAME_WIDTH / 2, 112, 'Heroes earn exp from every run they are fielded in', 16, '#9aa3b8');

    this.inspector = new HeroInspector(this);
    this.drawTabs();
    this.drawGrid();

    createButton(this, GAME_WIDTH / 2, BACK_BUTTON_Y, 'BACK', () => this.scene.start('MainMenuScene'));
  }

  private drawTabs(): void {
    for (const o of this.tabObjects) o.destroy();
    this.tabObjects = [];
    const left = GAME_WIDTH / 2 - TAB_W;

    ROLE_ORDER.forEach((role, i) => {
      const x = left + i * TAB_W;
      const on = role === this.role;
      const accent = ROLE_COLOR[role];
      const bg = this.add
        .rectangle(x, TABS_Y, TAB_W - 8, TAB_H, on ? 0x1c2140 : 0x0b0d18, 0.95)
        .setStrokeStyle(2, accent, on ? 1 : 0.4)
        .setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.selectRole(role));
      const text = this.label(
        x, TABS_Y, TAB_LABEL[role], 22, on ? hexColor(accent) : '#9aa3b8', 'bold',
      );
      this.tabObjects.push(bg, text);
    });
  }

  private selectRole(role: HeroRole): void {
    if (role === this.role) return;
    this.role = role;
    this.inspector.cancel();
    this.drawTabs();
    this.drawGrid();
  }

  private drawGrid(): void {
    for (const o of this.gridObjects) o.destroy();
    const before = new Set(this.children.list);

    const heroes = heroesByRole(this.role, this.roster);
    const rowW = GRID.cols * GRID.cardW + (GRID.cols - 1) * GRID.gapX;
    const left = (GAME_WIDTH - rowW) / 2 + GRID.cardW / 2;

    heroes.forEach((hero, i) => {
      const x = left + (i % GRID.cols) * (GRID.cardW + GRID.gapX);
      const y = GRID.top + Math.floor(i / GRID.cols) * (GRID.cardH + GRID.gapY) + GRID.cardH / 2;
      createHeroCard(this, x, y, GRID.cardW, GRID.cardH, hero, {
        taken: false,
        current: false,
        progress: heroProgress(hero.id),
        onPressStart: (h, hx, hy) => this.inspector.press(h, hx, hy),
        onPressCancel: () => this.inspector.cancel(),
        // Tapping a card only inspects here — nothing to pick outside a run.
        onTap: () => this.inspector.cancel(),
      });
    });

    this.gridObjects = this.children.list.filter(o => !before.has(o));
  }

  private drawBackground(): void {
    for (const key of ['combat_bg', 'combat_mid']) {
      const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
      img.setScale(Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height));
    }
    this.add.graphics().fillStyle(0x05060f, 0.82).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
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
