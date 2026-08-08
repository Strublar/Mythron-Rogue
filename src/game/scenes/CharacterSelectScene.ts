import Phaser from 'phaser';
import { TAG_LABEL, defaultParty, heroesByRole, partyTags } from '../../data/heroes';
import { ownedRoster } from '../../engine/ProgressionStore';
import type { HeroDef, HeroRole } from '../../types';
import { createUnitSprite } from '../UnitAnimator';
import { createHeroCard } from '../HeroCard';
import { HeroInspector } from '../HeroInspector';
import { createButton } from '../ui';
import { GAME_HEIGHT, GAME_WIDTH, HERO_BAR_DY, HERO_SCALE, HERO_SLOTS, ROLE_COLOR } from '../layout';

/** Finger-friendly tap zone around each slot. */
const PROBE_W = 170;
const PROBE_H = 170;

const ROLE_LABEL: Record<HeroRole, string> = { tank: 'TANK', dps: 'DPS', heal: 'HEALER' };
const ROLE_ORDER: HeroRole[] = ['tank', 'dps', 'heal'];

/** Roster grid. Lives in the boss zone; 3 rows of cards is the tallest it ever gets. */
const GRID = {
  top: 128, cols: 3,
  cardW: 216, cardH: 150, gapX: 12, gapY: 12,
  headerH: 58,
};
const GRID_DEPTH = 40;
const START_BUTTON_Y = 1252;

const hexColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Pre-run party builder. The seven picks sit at their real battlefield slots, so the
 * screen reads as the fight it sets up. Tapping a slot opens that role's roster grid
 * in the boss zone; tapping a grid entry swaps it into the slot.
 */
export class CharacterSelectScene extends Phaser.Scene {
  private party!: Record<HeroRole, HeroDef[]>;
  /** The roster at its earned levels — what both the slots and the grid pick from. */
  private roster: HeroDef[] = [];
  private slotObjects = new Map<string, Phaser.GameObjects.GameObject[]>();
  private gridObjects: Phaser.GameObjects.GameObject[] = [];
  private inspector!: HeroInspector;
  /** Set when a press turned into an inspect — that release must not also count as a tap. */
  private inspected = false;
  /** Tag counts of the current picks — what the run's boon rolls will be weighted by. */
  private synergy!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    // Levels earned in past runs are baked in here, once — everything downstream
    // (boons, the engine, the stats card) reads these defs.
    // Owned heroes only: the seven starters are always owned, so the default party holds.
    this.roster = ownedRoster();
    const seed = defaultParty(this.roster);
    this.party = {
      tank: seed.filter(h => h.role === 'tank'),
      dps: seed.filter(h => h.role === 'dps'),
      heal: seed.filter(h => h.role === 'heal'),
    };
    this.slotObjects.clear();
    this.gridObjects = [];

    this.drawBackground();
    this.label(GAME_WIDTH / 2, 46, 'BUILD YOUR PARTY', 38, '#ffd76b', 'bold');
    this.label(GAME_WIDTH / 2, 84, 'Tap a hero to swap it · hold for stats', 18, '#9aa3b8');
    this.synergy = this.label(GAME_WIDTH / 2, 110, '', 16, '#ffd76b', 'bold');

    this.inspector = new HeroInspector(this);
    this.inspector.onOpen = () => { this.inspected = true; };
    for (const role of ROLE_ORDER) this.party[role].forEach((_, i) => this.buildSlot(role, i));
    this.drawSynergy();

    createButton(this, GAME_WIDTH / 2, START_BUTTON_Y, 'START RUN', () => this.startRun());
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
    this.closeGrid();
    this.cameras.main.fadeOut(300, 0, 0, 0, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) this.scene.start('BossFightScene', { party: this.orderedParty() });
    });
  }

  /** Flattened tanks → dps → heals, the order BossFightScene fills HERO_SLOTS in. */
  private orderedParty(): HeroDef[] {
    return ROLE_ORDER.flatMap(role => this.party[role]);
  }

  // ── Party slots ─────────────────────────────────────────────────────────────

  /** (Re)renders the hero sitting in (role, index) plus its tap/hold probe. */
  private buildSlot(role: HeroRole, index: number): void {
    const key = `${role}${index}`;
    for (const o of this.slotObjects.get(key) ?? []) o.destroy();

    const hero = this.party[role][index];
    const slot = HERO_SLOTS[role][index];
    const sprite = createUnitSprite(this, hero.unitKey, slot.x, slot.y).setScale(HERO_SCALE);
    // Name sits where the health bar will be in the fight, so the back row stays clear
    // of the START button.
    const name = this.label(slot.x, slot.y + HERO_BAR_DY, hero.name.toUpperCase(), 15, hexColor(ROLE_COLOR[role]));

    const probe = this.add
      .zone(slot.x, slot.y, PROBE_W, PROBE_H)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.beginPress(hero, slot.x, slot.y))
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.inspector.cancel())
      // A long press inspects; a tap opens the roster for this slot.
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (this.wasTap()) this.openGrid(role, index);
      });

    this.slotObjects.set(key, [sprite, name, probe]);
  }

  // ── Roster grid ─────────────────────────────────────────────────────────────

  /** Opens the roster for `role`, flagging heroes already fielded in another slot. */
  private openGrid(role: HeroRole, index: number): void {
    this.closeGrid();
    // Everything drawn from here on belongs to the grid — diff the display list to sweep it.
    const before = new Set(this.children.list);

    const heroes = heroesByRole(role, this.roster);
    // The panel hugs its rows, so a 6-hero roster doesn't leave half the boss zone blank.
    const rows = Math.ceil(heroes.length / GRID.cols);
    const height = GRID.headerH + rows * (GRID.cardH + GRID.gapY) + GRID.gapY;

    this.add
      .rectangle(GAME_WIDTH / 2, GRID.top + height / 2, GAME_WIDTH - 24, height, 0x05060f, 0.94)
      .setStrokeStyle(2, 0xffd76b, 0.5)
      .setDepth(GRID_DEPTH)
      .setInteractive()
      // Tapping the backdrop between cards cancels the swap.
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.closeGrid());

    this.label(GAME_WIDTH / 2, GRID.top + 30, `CHOOSE A ${ROLE_LABEL[role]}`, 26, '#ffd76b', 'bold')
      .setDepth(GRID_DEPTH + 1);
    createButton(this, GAME_WIDTH - 108, GRID.top + 30, 'CANCEL', () => this.closeGrid(), GRID_DEPTH + 1);

    const current = this.party[role][index];
    const fielded = new Set(this.party[role].map(h => h.id));
    const rowW = GRID.cols * GRID.cardW + (GRID.cols - 1) * GRID.gapX;
    const left = (GAME_WIDTH - rowW) / 2 + GRID.cardW / 2;

    heroes.forEach((hero, i) => {
      const x = left + (i % GRID.cols) * (GRID.cardW + GRID.gapX);
      const y = GRID.top + GRID.headerH + Math.floor(i / GRID.cols) * (GRID.cardH + GRID.gapY) + GRID.cardH / 2;
      createHeroCard(this, x, y, GRID.cardW, GRID.cardH, hero, {
        taken: fielded.has(hero.id) && hero.id !== current.id,
        current: hero.id === current.id,
        onPressStart: (h, hx, hy) => this.beginPress(h, hx, hy),
        onPressCancel: () => this.inspector.cancel(),
        onTap: picked => { if (this.wasTap()) this.assign(role, index, picked); },
      }, GRID_DEPTH + 1);
    });

    this.gridObjects = this.children.list.filter(o => !before.has(o));
  }

  private closeGrid(): void {
    this.inspector.cancel();
    for (const o of this.gridObjects) o.destroy();
    this.gridObjects = [];
  }

  private assign(role: HeroRole, index: number, hero: HeroDef): void {
    this.closeGrid();
    this.party[role][index] = hero;
    this.buildSlot(role, index);
    this.drawSynergy();
  }

  /** Only tags shared by 2+ heroes matter — those are the ones that pull boon offers. */
  private drawSynergy(): void {
    const shared = partyTags(this.orderedParty()).filter(t => t.count > 1);
    this.synergy.setText(
      shared.length === 0
        ? 'No shared tags — boons will roll wide'
        : shared.map(t => `${TAG_LABEL[t.tag].toUpperCase()} ×${t.count}`).join('  ·  '),
    );
  }

  // ── Chrome ──────────────────────────────────────────────────────────────────

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
