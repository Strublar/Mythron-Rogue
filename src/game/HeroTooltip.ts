import Phaser from 'phaser';
import type { Ability, HeroDef, HeroRole } from '../types';
import { GAME_HEIGHT, GAME_WIDTH, ROLE_COLOR } from './layout';

const PANEL_W = 420;
const PAD = 20;
const GAP = 6;
const MARGIN = 14;
/** Vertical clearance between the panel and the inspected hero. */
const ANCHOR_GAP = 80;
const CARET_W = 24;
const CARET_H = 14;

const ROLE_LABEL: Record<HeroRole, string> = { tank: 'TANK', dps: 'DPS', heal: 'HEALER' };
const CREAM = '#f3e6c8';
const MUTED = '#9aa3b8';
const GOLD = '#ffd76b';

const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** Effect lines built straight from an ability's numeric fields — no hardcoded copy. */
export function abilityEffects(a: Ability): string[] {
  const lines: string[] = [];
  if (a.damage) lines.push(`Deals ${a.damage} damage to the boss.`);
  if (a.heal) lines.push(`Heals the target ally for ${a.heal}.`);
  if (a.selfShield) lines.push(`Shields the caster for ${a.selfShield}.`);
  if (a.taunt) lines.push('Taunt: wipes party threat and pulls the boss onto the caster.');
  return lines;
}

/** Long-press card: hero stats plus its ability text and values. One instance per scene. */
export class HeroTooltip {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, depth = 300) {
    this.bg = scene.add
      .rectangle(0, 0, PANEL_W, 10, 0x0b0d18, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffd76b, 0.75);
    this.root = scene.add.container(0, 0, [this.bg]).setDepth(depth).setVisible(false);
  }

  /** Renders the card for `hero` and parks it clear of the slot at (anchorX, anchorY). */
  show(hero: HeroDef, anchorX: number, anchorY: number): void {
    for (const child of this.root.list.slice(1)) child.destroy();

    const accent = hex(ROLE_COLOR[hero.role]);
    const isHealer = hero.role === 'heal';
    const perSec = hero.attack / (hero.attackIntervalMs / 1000);

    let y = PAD;
    y = this.line(hero.name.toUpperCase(), 26, accent, y, 'bold');
    y = this.line(ROLE_LABEL[hero.role], 16, MUTED, y) + GAP;
    y = this.rule(y);

    y = this.stat('HP', hero.maxHp.toLocaleString(), y);
    y = this.stat(isHealer ? 'HEAL' : 'ATTACK', `${hero.attack}`, y);
    y = this.stat('EVERY', secs(hero.attackIntervalMs), y);
    y = this.stat(isHealer ? 'HPS' : 'DPS', perSec.toFixed(1), y) + GAP;
    y = this.rule(y);

    const { ability } = hero;
    this.right(`${secs(ability.cooldownMs)} CD`, 16, MUTED, y + 6);
    y = this.line(ability.name.toUpperCase(), 22, GOLD, y, 'bold');
    y = this.line(
      ability.targetKind === 'boss' ? 'Drag onto the boss.' : 'Drag onto an ally.',
      15,
      MUTED,
      y,
    ) + GAP;
    for (const effect of abilityEffects(ability)) y = this.line(effect, 18, CREAM, y);

    const height = y + PAD - GAP;
    this.bg.setSize(PANEL_W, height);

    // Sits above the hero when there is room, otherwise below — the caret points back at it.
    const px = Phaser.Math.Clamp(anchorX - PANEL_W / 2, MARGIN, GAME_WIDTH - PANEL_W - MARGIN);
    const above = anchorY - ANCHOR_GAP - height;
    const pointsDown = above >= MARGIN;
    const py = Phaser.Math.Clamp(
      pointsDown ? above : anchorY + ANCHOR_GAP,
      MARGIN,
      GAME_HEIGHT - height - MARGIN,
    );
    this.caret(Phaser.Math.Clamp(anchorX - px, CARET_W, PANEL_W - CARET_W), height, pointsDown);
    this.root.setPosition(px, py).setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  /** Little arrow on the panel edge marking which hero the card belongs to. */
  private caret(localX: number, height: number, pointsDown: boolean): void {
    const tip = pointsDown ? CARET_H : -CARET_H;
    this.root.add(
      this.scene.add
        .triangle(localX, pointsDown ? height - 1 : 1, -CARET_W / 2, 0, CARET_W / 2, 0, 0, tip, 0x0b0d18, 1)
        .setOrigin(0, 0),
    );
  }

  private line(text: string, size: number, color: string, y: number, style = ''): number {
    const t = this.scene.add
      .text(PAD, y, text, {
        fontFamily: 'Lato',
        fontSize: `${size}px`,
        color,
        fontStyle: style,
        wordWrap: { width: PANEL_W - PAD * 2 },
      })
      .setOrigin(0, 0);
    this.root.add(t);
    return y + t.height + GAP;
  }

  private right(text: string, size: number, color: string, y: number): void {
    this.root.add(
      this.scene.add
        .text(PANEL_W - PAD, y, text, { fontFamily: 'Lato', fontSize: `${size}px`, color })
        .setOrigin(1, 0),
    );
  }

  private stat(label: string, value: string, y: number): number {
    this.right(value, 20, CREAM, y);
    return this.line(label, 20, MUTED, y);
  }

  private rule(y: number): number {
    this.root.add(
      this.scene.add.rectangle(PAD, y, PANEL_W - PAD * 2, 1, 0xffd76b, 0.3).setOrigin(0, 0),
    );
    return y + GAP * 2;
  }
}
