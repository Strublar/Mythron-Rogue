import Phaser from 'phaser';
import { ROSTER, heroesByRole } from '../../data/heroes';
import { MAX_HERO_LEVEL, PASSIVE_LEVEL } from '../../data/progression';
import {
  gold, heroProgress, isPrismatic, maxDifficulty, ownedRoster, setTeamSeat, team, teamDefs,
} from '../../engine/ProgressionStore';
import type { HeroDef } from '../../types';
import { createHeroCard } from '../HeroCard';
import { HeroInspector } from '../HeroInspector';
import { createUnitPortrait } from '../UnitAnimator';
import type { ButtonHandle } from '../ui';
import { createButton, drawSceneBackground, sceneLabel } from '../ui';
import { GAME_HEIGHT, GAME_WIDTH, PARTY_SEATS, ROLE_COLOR, SEAT_COUNT } from '../layout';

/** Difficulty stepper. */
const DIFF_Y = 168;
const DIFF_ARROW_DX = 150;

/** Seat strip: the 2/3/2 rows, tanks on top, mirroring the battlefield. */
const STRIP_TOP = 216;
const TILE = { w: 116, h: 104, gapX: 10, gapY: 8 };
const SEAT_PORTRAIT_SCALE = 0.5;
const SEAT_PORTRAIT_MAX_H = 62;

/** Owned-hero grid: three rows of three clears the tallest role set. */
const GRID = { top: 578, cols: 3, cardW: 216, cardH: 158, gapX: 12, gapY: 10 };

/** Both buttons share the bottom row — 174px art, so they sit well clear of each other. */
const BUTTON_Y = GAME_HEIGHT - 130;
const BUTTON_DX = 176;

const hexColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * The between-runs page: the team the player fields, the difficulty it will fight, and the
 * collection it is picked from. Seats are role-locked (2 tanks / 3 dps / 2 heals), so the
 * selected seat *is* the grid's filter — tap a seat, tap a hero, it sits there and persists.
 * Tapping the seat's current occupant empties it. Holding anything opens its stats card.
 */
export class TeamScene extends Phaser.Scene {
  private seats: (string | null)[] = [];
  private roster: HeroDef[] = [];
  private editing = 0;
  private difficulty = 1;
  private inspector!: HeroInspector;
  private fightButton!: ButtonHandle;
  private difficultyText!: Phaser.GameObjects.Text;
  private stripObjects: Phaser.GameObjects.GameObject[] = [];
  private gridObjects: Phaser.GameObjects.GameObject[] = [];
  private arrows: { left: Phaser.GameObjects.Text; right: Phaser.GameObjects.Text } | undefined;

  constructor() {
    super({ key: 'TeamScene' });
  }

  create(): void {
    this.seats = team();
    this.roster = ownedRoster();
    this.stripObjects = [];
    this.gridObjects = [];
    // Last run's rung stays selected across visits; a new clear opens the one above it.
    this.difficulty = maxDifficulty();

    drawSceneBackground(this);
    sceneLabel(this, GAME_WIDTH / 2, 44, 'TEAM', 38, '#ffd76b', 'bold');
    sceneLabel(
      this, GAME_WIDTH / 2, 84,
      `${this.roster.length} / ${ROSTER.length} HEROES  ·  ${gold()} GOLD`, 20, '#ffd76b', 'bold',
    );
    sceneLabel(
      this, GAME_WIDTH / 2, 112,
      `Tap a seat, then a hero · hold for stats · passive at level ${PASSIVE_LEVEL}, max ${MAX_HERO_LEVEL}`,
      15, '#9aa3b8',
    );

    this.inspector = new HeroInspector(this);
    this.drawDifficulty();
    this.drawStrip();
    this.drawGrid();

    createButton(
      this, GAME_WIDTH / 2 - BUTTON_DX, BUTTON_Y, 'MENU', () => this.scene.start('MainMenuScene'),
    );
    this.fightButton = createButton(
      this, GAME_WIDTH / 2 + BUTTON_DX, BUTTON_Y, 'FIGHT', () => this.startFight(),
    );
    this.refreshFightButton();
  }

  // ---- difficulty ----------------------------------------------------------

  private drawDifficulty(): void {
    const best = maxDifficulty();
    this.difficultyText = sceneLabel(
      this, GAME_WIDTH / 2, DIFF_Y, `DIFFICULTY ${this.difficulty}`, 30, '#ffd76b', 'bold',
    );
    sceneLabel(this, GAME_WIDTH / 2, DIFF_Y + 28, `best cleared ${best - 1}`, 15, '#9aa3b8');
    this.arrows = {
      left: this.arrow(GAME_WIDTH / 2 - DIFF_ARROW_DX, '◀', -1),
      right: this.arrow(GAME_WIDTH / 2 + DIFF_ARROW_DX, '▶', 1),
    };
    this.refreshDifficulty();
  }

  private arrow(x: number, glyph: string, step: number): Phaser.GameObjects.Text {
    return sceneLabel(this, x, DIFF_Y, glyph, 40, '#ffd76b', 'bold')
      // Finger-sized: the glyph is small, the hit area is not.
      .setInteractive(new Phaser.Geom.Rectangle(-30, -30, 92, 92), Phaser.Geom.Rectangle.Contains)
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.stepDifficulty(step));
  }

  private stepDifficulty(step: number): void {
    const next = Phaser.Math.Clamp(this.difficulty + step, 1, maxDifficulty());
    if (next === this.difficulty) return;
    this.difficulty = next;
    this.refreshDifficulty();
  }

  private refreshDifficulty(): void {
    this.difficultyText.setText(`DIFFICULTY ${this.difficulty}`);
    this.arrows?.left.setAlpha(this.difficulty > 1 ? 1 : 0.25);
    this.arrows?.right.setAlpha(this.difficulty < maxDifficulty() ? 1 : 0.25);
  }

  // ---- seat strip ----------------------------------------------------------

  private drawStrip(): void {
    for (const o of this.stripObjects) o.destroy();
    const before = new Set(this.children.list);
    const defs = teamDefs();

    // One row per role, laid out like the battlefield rows the seats map onto.
    let seat = 0;
    let row = 0;
    while (seat < SEAT_COUNT) {
      const role = PARTY_SEATS[seat].role;
      const inRow = PARTY_SEATS.filter(s => s.role === role).length;
      const rowW = inRow * TILE.w + (inRow - 1) * TILE.gapX;
      const left = (GAME_WIDTH - rowW) / 2 + TILE.w / 2;
      const y = STRIP_TOP + row * (TILE.h + TILE.gapY) + TILE.h / 2;
      for (let i = 0; i < inRow; i++, seat++) {
        this.drawSeat(seat, left + i * (TILE.w + TILE.gapX), y, defs[seat]);
      }
      row++;
    }

    this.stripObjects = this.children.list.filter(o => !before.has(o));
  }

  private drawSeat(seat: number, x: number, y: number, def: HeroDef | null): void {
    const accent = ROLE_COLOR[PARTY_SEATS[seat].role];
    const on = seat === this.editing;
    const bg = this.add
      .rectangle(x, y, TILE.w, TILE.h, on ? 0x1c2140 : 0x0b0d18, 0.95)
      .setStrokeStyle(on ? 3 : 2, accent, on || def ? 1 : 0.35)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        if (def) this.inspector.press(def, x, y);
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.inspector.cancel())
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.selectSeat(seat));

    if (def) {
      createUnitPortrait(this, def.unitKey, x, y - 18, SEAT_PORTRAIT_SCALE, SEAT_PORTRAIT_MAX_H);
      // Names run long — wrap inside the tile rather than spilling over its neighbours.
      this.add
        .text(x, y + TILE.h / 2 - 6, def.name.toUpperCase(), {
          fontFamily: 'Lato', fontSize: '11px', color: '#f3e6c8', fontStyle: 'bold',
          align: 'center', wordWrap: { width: TILE.w - 10 },
          stroke: '#000000', strokeThickness: 3,
        })
        .setOrigin(0.5, 1);
    } else {
      sceneLabel(this, x, y, 'EMPTY', 15, hexColor(accent), 'bold');
    }
    // The pulsing ring reads at a glance which seat the grid below is filling.
    if (on) {
      this.tweens.add({
        targets: bg, alpha: 0.55, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  private selectSeat(seat: number): void {
    this.inspector.cancel();
    if (seat === this.editing) return;
    this.editing = seat;
    this.drawStrip();
    this.drawGrid();
  }

  // ---- roster grid ---------------------------------------------------------

  private drawGrid(): void {
    for (const o of this.gridObjects) o.destroy();
    const before = new Set(this.children.list);

    const { role } = PARTY_SEATS[this.editing];
    const heroes = heroesByRole(role, this.roster);
    const rowW = GRID.cols * GRID.cardW + (GRID.cols - 1) * GRID.gapX;
    const left = (GAME_WIDTH - rowW) / 2 + GRID.cardW / 2;

    heroes.forEach((hero, i) => {
      const x = left + (i % GRID.cols) * (GRID.cardW + GRID.gapX);
      const y = GRID.top + Math.floor(i / GRID.cols) * (GRID.cardH + GRID.gapY) + GRID.cardH / 2;
      const current = this.seats[this.editing] === hero.id;
      createHeroCard(this, x, y, GRID.cardW, GRID.cardH, hero, {
        // Seated elsewhere: free that seat first, so a tap can never duplicate a hero.
        taken: !current && this.seats.includes(hero.id),
        current,
        progress: heroProgress(hero.id),
        prismatic: isPrismatic(hero.id),
        onPressStart: (h, hx, hy) => this.inspector.press(h, hx, hy),
        onPressCancel: () => this.inspector.cancel(),
        onTap: h => this.seatHero(current ? null : h.id),
      });
    });

    this.gridObjects = this.children.list.filter(o => !before.has(o));
  }

  /** Writes the pick through the store — the team is persistent, not run state. */
  private seatHero(heroId: string | null): void {
    this.inspector.cancel();
    setTeamSeat(this.editing, heroId);
    this.seats = team();
    this.drawStrip();
    this.drawGrid();
    this.refreshFightButton();
  }

  // ---- run start -----------------------------------------------------------

  private refreshFightButton(): void {
    this.fightButton.setEnabled(this.seats.every(id => !!id));
  }

  private startFight(): void {
    const defs = teamDefs();
    if (defs.some(def => !def)) return;
    this.scene.start('BossFightScene', {
      team: defs as HeroDef[],
      difficulty: this.difficulty,
    });
  }
}
