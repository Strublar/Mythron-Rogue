import Phaser from 'phaser';
import {
  ORB_PRICE, PRISMATIC_CHANCE, RARITY_COLOR, RARITY_LABEL, RARITY_ORDER, RARITY_WEIGHT,
} from '../../data/orbs';
import { buyOrb, gold, ownedCount } from '../../engine/ProgressionStore';
import { ROSTER } from '../../data/heroes';
import { MAX_HERO_LEVEL } from '../../data/progression';
import type { OrbPull } from '../../types';
import { createUnitPortrait } from '../UnitAnimator';
import { ButtonHandle, createButton, drawSceneBackground, sceneLabel } from '../ui';
import { PRISMATIC_WHITE, prismaticSwirl } from '../PrismaticFx';
import { prismaticBurst } from '../PrismaticBurst';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout';

const PANEL = { x: GAME_WIDTH / 2, y: 500, w: 560, h: 520 };
const BUY_BUTTON_Y = 900;
const BACK_BUTTON_Y = GAME_HEIGHT - 70;
const ORB_RADIUS = 92;
/**
 * Portrait sizing for the reveal — the hero is the whole point of the screen, so it runs
 * larger than the battlefield's HERO_SCALE. The cap is on the untrimmed atlas canvas, and
 * the art fills only part of it, which is why it sits well above the drawn height.
 */
const REVEAL_SCALE = 4;
const REVEAL_MAX_H = 300;

const hexColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Between-run shop: gold buys orbs, an orb rolls one hero weighted by rarity. A hero
 * already owned pays exp to itself instead, so a full collection keeps orbs worth buying.
 * The store owns the roll and the persistence — this scene only draws the result.
 */
export class ShopScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private ownedText!: Phaser.GameObjects.Text;
  private buyButton!: ButtonHandle;
  private panelObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(): void {
    this.panelObjects = [];
    drawSceneBackground(this);

    sceneLabel(this, GAME_WIDTH / 2, 46, 'ORB SHOP', 38, '#ffd76b', 'bold');
    this.goldText = sceneLabel(this, GAME_WIDTH / 2, 96, '', 28, '#ffd76b', 'bold');
    this.ownedText = sceneLabel(this, GAME_WIDTH / 2, 130, '', 18, '#9aa3b8');
    sceneLabel(this, GAME_WIDTH / 2, 160, this.oddsLine(), 16, '#9aa3b8');

    this.add
      .rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0x11142a, 0.92)
      .setStrokeStyle(2, 0xffd76b, 0.45);

    this.buyButton = createButton(this, GAME_WIDTH / 2, BUY_BUTTON_Y, 'BUY ORB', () => this.buy());
    createButton(this, GAME_WIDTH / 2, BACK_BUTTON_Y, 'BACK', () => this.scene.start('MainMenuScene'));

    this.drawIdlePanel();
    this.refreshHeader();
  }

  /** "S 5%  ·  A 25%  ·  B 70%" — best tier first, the way a player reads odds. */
  private oddsLine(): string {
    const tiers = [...RARITY_ORDER]
      .reverse()
      .map(r => `${r} ${RARITY_WEIGHT[r]}%`);
    // The prismatic coin is drawn on top of the tier, so it reads as its own line item.
    return [...tiers, `PRISMATIC ${PRISMATIC_CHANCE * 100}%`].join('  ·  ');
  }

  private refreshHeader(): void {
    this.goldText.setText(`${gold()} GOLD`);
    this.ownedText.setText(`${ownedCount()} / ${ROSTER.length} HEROES OWNED`);
    this.buyButton.setEnabled(gold() >= ORB_PRICE);
  }

  private clearPanel(): void {
    for (const o of this.panelObjects) o.destroy();
    this.panelObjects = [];
  }

  /** The unopened orb: what the player sees before the first buy and between pulls. */
  private drawIdlePanel(): void {
    this.clearPanel();
    const cy = PANEL.y - 40;

    const glow = this.add.circle(PANEL.x, cy, ORB_RADIUS + 16, 0x7fd4ff, 0.12);
    const orb = this.add
      .circle(PANEL.x, cy, ORB_RADIUS, 0x1c2140, 1)
      .setStrokeStyle(4, 0xffd76b, 0.9);
    const shine = this.add.circle(PANEL.x - 28, cy - 32, 22, 0xffffff, 0.16);

    // A slow pulse so the orb reads as the interactive thing on the screen.
    this.tweens.add({
      targets: [orb, glow],
      scaleX: 1.06, scaleY: 1.06,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const price = sceneLabel(this, PANEL.x, cy + ORB_RADIUS + 60, `${ORB_PRICE} GOLD`, 30, '#ffd76b', 'bold');
    const hint = sceneLabel(
      this, PANEL.x, cy + ORB_RADIUS + 104, 'One random hero. Duplicates become exp.', 17, '#9aa3b8',
    );
    this.panelObjects.push(glow, orb, shine, price, hint);
  }

  private buy(): void {
    const pull = buyOrb();
    // The button is gated on gold, so this only guards a double-tap in the same frame.
    if (!pull) return;
    this.drawReveal(pull);
    this.refreshHeader();
  }

  private drawReveal(pull: OrbPull): void {
    this.clearPanel();
    const accent = RARITY_COLOR[pull.rarity];
    const top = PANEL.y - PANEL.h / 2;

    // Both prismatic layers go down before the reveal itself, so the hero stays legible on
    // top of them rather than being flooded by the rays.
    if (pull.prismatic) {
      this.panelObjects.push(
        prismaticSwirl(this, PANEL.x, PANEL.y, PANEL.w - 4, PANEL.h - 4, 0),
        ...prismaticBurst(this, PANEL.x, top + 250, 0),
      );
    }

    const tier = sceneLabel(
      this, PANEL.x, top + 44, `${pull.rarity}  ·  ${RARITY_LABEL[pull.rarity]}`, 26, hexColor(accent), 'bold',
    );
    const halo = this.add.circle(PANEL.x, top + 190, 118, accent, 0.13);
    const portrait = createUnitPortrait(
      this, pull.hero.unitKey, PANEL.x, top + 190, REVEAL_SCALE, REVEAL_MAX_H,
    );
    const name = sceneLabel(this, PANEL.x, top + 320, pull.hero.name.toUpperCase(), 30, '#f3e6c8', 'bold');
    const verdict = sceneLabel(this, PANEL.x, top + 376, ...this.verdict(pull));
    const detail = sceneLabel(this, PANEL.x, top + 424, this.detailLine(pull), 17, '#9aa3b8');

    this.panelObjects.push(tier, halo, portrait, name, verdict, detail);

    // Pop the reveal in so consecutive pulls read as separate events. The portrait keeps
    // the fitted scale `createUnitPortrait` picked — only the approach to it is animated.
    const fitted = portrait.scale;
    portrait.setScale(fitted * 0.7);
    halo.setScale(0.7);
    this.tweens.add({ targets: portrait, scale: fitted, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: halo, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /** The headline: what the pull unlocked, or the exp it paid instead. */
  private verdict(pull: OrbPull): [string, number, string, string] {
    if (pull.duplicate) {
      return pull.prismatic
        ? [`PRISMATIC DUPE  ·  +${pull.exp} EXP`, 22, PRISMATIC_WHITE, 'bold']
        : [`DUPLICATE  ·  +${pull.exp} EXP`, 24, '#7fd4ff', 'bold'];
    }
    return pull.prismatic
      ? ['PRISMATIC!', 30, PRISMATIC_WHITE, 'bold']
      : ['NEW HERO!', 30, '#8ef2a0', 'bold'];
  }

  private detailLine(pull: OrbPull): string {
    if (!pull.duplicate) {
      return pull.prismatic
        ? `Foil ${pull.hero.name} unlocked — its card shimmers from now on`
        : 'Added to your collection — pick it on the next run';
    }
    const p = pull.progress;
    if (!p) return '';
    return p.level >= MAX_HERO_LEVEL
      ? `${pull.hero.name} is already at max level ${MAX_HERO_LEVEL}`
      : `${pull.hero.name} is now level ${p.level}`;
  }
}
