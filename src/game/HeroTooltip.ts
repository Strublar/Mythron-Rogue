import Phaser from 'phaser';
import type { Ability, AbilityBuff, HeroDef, HeroRole } from '../types';
import { tagStrip } from '../data/heroes';
import { RARITY_LABEL } from '../data/rarity';
import { BASE_POWER, scaleByPower } from '../data/statMath';
import { GAME_HEIGHT, GAME_WIDTH, ROLE_COLOR } from './layout';
import { STAT_COLOR, drawStatIcon, heroStatRows, type StatRow } from './statDisplay';

const PANEL_W = 420;
const PAD = 20;
const GAP = 6;
const MARGIN = 14;
/** Vertical clearance between the panel and the inspected hero. */
const ANCHOR_GAP = 80;
const CARET_W = 24;
const CARET_H = 14;
/** One stat cell: a glyph and its value on one line, plus breathing room. */
const STAT_CELL_H = 34;
/** Glyph size inside a stat cell. */
const STAT_ICON = 22;

const ROLE_LABEL: Record<HeroRole, string> = { tank: 'TANK', dps: 'DPS', heal: 'HEALER' };
const CREAM = '#f3e6c8';
const MUTED = '#9aa3b8';
const GOLD = '#ffd76b';

const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

const BUFF_TARGET_LABEL: Record<AbilityBuff['target'], string> = {
  self: 'the caster',
  ally: 'the target ally',
  party: 'the whole party',
};

/**
 * Effect lines built straight from an ability's numeric fields — no hardcoded copy.
 * Payloads are written at BASE_POWER, so the caster's `power` is folded in here: the card
 * prints what the cast will actually land for.
 */
export function abilityEffects(a: Ability, power = BASE_POWER): string[] {
  const p = (amount: number): number => scaleByPower(amount, power);
  const lines: string[] = [];
  if (a.damage) lines.push(`Deals ${p(a.damage)} damage to the boss.`);
  if (a.executeBonus && a.executeBelowPct !== undefined) {
    lines.push(`Execute: +${p(a.executeBonus)} damage while the boss is below ${a.executeBelowPct}% HP.`);
  }
  if (a.dot) {
    lines.push(
      `Burns the boss for ${p(a.dot.damage)} every ${secs(a.dot.tickMs)} over ${secs(a.dot.durationMs)}.`,
    );
  }
  if (a.lifestealPct) lines.push(`Heals the caster for ${a.lifestealPct}% of the damage dealt.`);
  if (a.bossStunMs) lines.push(`Staggers the boss, delaying its next swing by ${secs(a.bossStunMs)}.`);
  if (a.heal) lines.push(`Heals the target ally for ${p(a.heal)}.`);
  if (a.partyHeal) lines.push(`Heals every living hero for ${p(a.partyHeal)}.`);
  if (a.selfHeal) lines.push(`Heals the caster for ${p(a.selfHeal)}.`);
  if (a.selfShield) lines.push(`Shields the caster for ${p(a.selfShield)}.`);
  if (a.allyShield) lines.push(`Shields the target ally for ${p(a.allyShield)}.`);
  if (a.buff) {
    const parts: string[] = [];
    if (a.buff.attackPct) parts.push(`+${a.buff.attackPct}% attack`);
    if (a.buff.attackSpeedPct) parts.push(`+${a.buff.attackSpeedPct}% attack speed`);
    lines.push(`Grants ${BUFF_TARGET_LABEL[a.buff.target]} ${parts.join(' and ')} for ${secs(a.buff.durationMs)}.`);
  }
  if (a.taunt) lines.push('Taunt: wipes party threat and pulls the boss onto the caster.');
  if (a.threatFlat) {
    lines.push(
      a.threatFlat < 0
        ? `Sheds ${-a.threatFlat} threat from the caster.`
        : `Adds ${a.threatFlat} threat to the caster.`,
    );
  }
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

    let y = PAD;
    // Rarity sits on the name line: it is what the shop charges for this hero.
    this.right(RARITY_LABEL[hero.rarity], 18, GOLD, y + 6);
    y = this.line(hero.name.toUpperCase(), 26, accent, y, 'bold');
    y = this.line(ROLE_LABEL[hero.role], 16, MUTED, y);
    y = this.line(tagStrip(hero), 15, GOLD, y) + GAP;
    y = this.rule(y);

    y = this.statGrid(hero, y) + GAP;
    y = this.rule(y);

    y = this.passiveBlock(hero, y);

    const { ability } = hero;
    // Mana replaces the old cooldown badge: what the cast costs out of the bar under the hero.
    this.right(`${ability.manaCost} MANA`, 16, STAT_COLOR.mana, y + 6);
    y = this.line(ability.name.toUpperCase(), 22, GOLD, y, 'bold');
    y = this.line(
      ability.targetKind === 'boss' ? 'Drag onto the boss.' : 'Drag onto an ally.',
      15,
      MUTED,
      y,
    ) + GAP;
    for (const effect of abilityEffects(ability, hero.power)) y = this.line(effect, 18, CREAM, y);

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

  /** The hero's passive — always live, so there is no locked state to draw. */
  private passiveBlock(hero: HeroDef, y: number): number {
    const { passive } = hero;
    if (!passive) return y;

    this.right('PASSIVE', 16, MUTED, y + 6);
    let next = this.line(passive.name.toUpperCase(), 22, GOLD, y, 'bold');
    next = this.line(passive.text, 18, CREAM, next) + GAP;
    return this.rule(next);
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

  /**
   * The stat block, two cells per row: a glyph and a number, colour-coded by stat — the
   * whole point of the card is that it reads without reading, hp green, power violet.
   */
  private statGrid(hero: HeroDef, y: number): number {
    const rows = heroStatRows(hero);
    const colW = (PANEL_W - PAD * 2) / 2;
    let top = y;
    for (let i = 0; i < rows.length; i += 2) {
      this.statCell(rows[i], PAD, top);
      this.statCell(rows[i + 1], PAD + colW, top);
      top += STAT_CELL_H;
    }
    return top;
  }

  /** One cell: the stat's glyph, then its value, both in the stat's own colour. */
  private statCell(row: StatRow | undefined, x: number, y: number): void {
    if (!row) return;
    const mid = y + STAT_ICON / 2;
    this.root.add(drawStatIcon(this.scene, row.icon, x + STAT_ICON / 2, mid, STAT_ICON, row.color));
    this.root.add(
      this.scene.add
        .text(x + STAT_ICON + 10, mid, row.value, {
          fontFamily: 'Lato', fontSize: '20px', color: row.color, fontStyle: 'bold',
        })
        .setOrigin(0, 0.5),
    );
  }

  private rule(y: number): number {
    this.root.add(
      this.scene.add.rectangle(PAD, y, PANEL_W - PAD * 2, 1, 0xffd76b, 0.3).setOrigin(0, 0),
    );
    return y + GAP * 2;
  }
}
