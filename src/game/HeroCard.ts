import Phaser from 'phaser';
import type { HeroDef, HeroProgress } from '../types';
import { tagStrip } from '../data/heroes';
import { MAX_HERO_LEVEL, expToNext } from '../data/progression';
import { createUnitPortrait } from './UnitAnimator';
import { BOON_CREAM, BOON_GOLD, BOON_MUTED } from './BoonCard';
import { heroLevel } from './HeroTooltip';
import { ROLE_COLOR } from './layout';
import { PRISMATIC_WHITE, prismaticSwirl } from './PrismaticFx';

const PAD = 8;
const EXP_BAR_H = 6;
/** Bar plus its caption — how much the text block lifts when an exp bar is drawn. */
const EXP_ROW_H = 22;
/** Portrait scale — the grid is dense, so cards run smaller than the battlefield. */
const PORTRAIT_SCALE = 1.2;
/** Atlas canvases vary (80–110px); clamp so the tall ones don't spill out of the card. */
const PORTRAIT_MAX_H = 84;
const IDLE = 0x11142a;
const HOVER = 0x1c2140;

export interface HeroCardOpts {
  /** Already fielded elsewhere in the party — dimmed and labelled instead of pickable. */
  taken: boolean;
  /** Currently occupying the slot being edited. */
  current: boolean;
  /** Collection page: draws the exp bar under the stats and the passive marker. */
  progress?: HeroProgress;
  /** The account owns this hero's foil variant — the card takes the prismatic treatment. */
  prismatic?: boolean;
  /** Pointer down: arm the scene's long-press inspect. */
  onPressStart: (hero: HeroDef, x: number, y: number) => void;
  /** The gesture left the card without releasing on it. */
  onPressCancel: () => void;
  /** Released on the card. The scene decides whether that was a tap or an inspect. */
  onTap: (hero: HeroDef) => void;
}

/**
 * Grid entry for one hero: static idle portrait, name, tag strip, and a stat strip.
 * Press handling belongs to the scene's HeroInspector — the card only reports gestures.
 */
export function createHeroCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  hero: HeroDef,
  opts: HeroCardOpts,
  depth = 0,
): void {
  const accent = ROLE_COLOR[hero.role];
  // Prismatic reframes the card in white; the role accent still wins on the current pick.
  const frame = opts.current ? accent : (opts.prismatic ? 0xffffff : 0xffd76b);
  const frameAlpha = opts.current ? 1 : (opts.prismatic ? 0.85 : 0.45);
  const bg = scene.add
    .rectangle(x, y, w, h, IDLE, 0.95)
    .setStrokeStyle(2, frame, frameAlpha)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true });

  // Sits between the panel and the portrait, inset so the frame stays crisp over it.
  const swirl = opts.prismatic
    ? prismaticSwirl(scene, x, y, w - 4, h - 4, depth + 0.5)
    : undefined;

  const portrait = createUnitPortrait(
    scene, hero.unitKey, x, y - 32, PORTRAIT_SCALE, PORTRAIT_MAX_H,
  ).setDepth(depth + 1);

  // The exp bar takes the bottom row, so the text block lifts to make room for it.
  const lift = opts.progress ? EXP_ROW_H : 0;
  const label = scene.add
    .text(x, y + h / 2 - PAD - 52 - lift, hero.name.toUpperCase(), {
      fontFamily: 'Lato', fontSize: '14px', color: BOON_GOLD, fontStyle: 'bold',
      align: 'center', wordWrap: { width: w - PAD * 2 },
    })
    .setOrigin(0.5, 0)
    .setDepth(depth + 1);

  // Tags decide which boons the party draws, so they sit on the card, not just the popup.
  scene.add
    .text(x, y + h / 2 - PAD - 33 - lift, tagStrip(hero), {
      fontFamily: 'Lato', fontSize: '12px', color: BOON_MUTED, fontStyle: 'bold',
    })
    .setOrigin(0.5, 0)
    .setDepth(depth + 1);

  scene.add
    .text(x, y + h / 2 - PAD - 14 - lift, statStrip(hero), {
      fontFamily: 'Lato', fontSize: '13px', color: BOON_CREAM,
    })
    .setOrigin(0.5, 0)
    .setDepth(depth + 1);

  // Level rides every card — the picks on the party screen are leveled defs too.
  drawLevelBadge(scene, x - w / 2 + PAD, y - h / 2 + PAD, heroLevel(hero), depth + 2);
  if (opts.progress) {
    drawExpBar(scene, x, y + h / 2 - PAD - EXP_ROW_H + 6, w - PAD * 4, opts.progress, depth + 2);
  }
  // A star marks the passive as live; the hold-to-inspect card spells it out.
  if (hero.passive) {
    scene.add
      .text(x + w / 2 - PAD, y - h / 2 + PAD, '★', {
        fontFamily: 'Lato', fontSize: '18px', color: BOON_GOLD,
      })
      .setOrigin(1, 0)
      .setDepth(depth + 2);
  }
  // The foil marker shares the corner with the passive star, so it steps aside for it.
  if (opts.prismatic) {
    scene.add
      .text(x + w / 2 - PAD - (hero.passive ? 18 : 0), y - h / 2 + PAD, '◆', {
        fontFamily: 'Lato', fontSize: '18px', color: PRISMATIC_WHITE,
      })
      .setOrigin(1, 0)
      .setDepth(depth + 2);
  }

  if (opts.taken) {
    // Fielded elsewhere: still inspectable, but tapping it would duplicate the hero.
    for (const o of [portrait, label]) o.setAlpha(0.35);
    swirl?.setAlpha(0.35);
    bg.setFillStyle(0x0b0d18, 0.95);
    scene.add
      .text(x, y - h / 2 + PAD, 'IN PARTY', {
        fontFamily: 'Lato', fontSize: '12px', color: BOON_MUTED, fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(depth + 2);
  }

  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
    if (!opts.taken) bg.setFillStyle(HOVER, 0.95);
  });
  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
    if (!opts.taken) bg.setFillStyle(IDLE, 0.95);
    opts.onPressCancel();
  });
  // Every card is inspectable, including the ones already fielded.
  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => opts.onPressStart(hero, x, y));
  bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
    // A fielded hero cannot be picked twice, but its release still clears the press.
    if (opts.taken) opts.onPressCancel();
    else opts.onTap(hero);
  });
}

/** `LVL n`, top-left. Maxed heroes read `MAX` instead of a number. */
function drawLevelBadge(
  scene: Phaser.Scene, x: number, y: number, level: number, depth: number,
): void {
  scene.add
    .text(x, y, level >= MAX_HERO_LEVEL ? 'MAX' : `LVL ${level}`, {
      fontFamily: 'Lato', fontSize: '14px', color: BOON_GOLD, fontStyle: 'bold',
    })
    .setOrigin(0, 0)
    .setDepth(depth);
}

/** Progress toward the next level. A maxed hero gets a full bar and no numbers. */
function drawExpBar(
  scene: Phaser.Scene, x: number, y: number, w: number, p: HeroProgress, depth: number,
): void {
  const need = expToNext(p.level);
  const ratio = need === 0 ? 1 : Phaser.Math.Clamp(p.exp / need, 0, 1);
  scene.add.rectangle(x, y, w, EXP_BAR_H, 0x000000, 0.55).setDepth(depth);
  scene.add
    .rectangle(x - w / 2, y, w * ratio, EXP_BAR_H, need === 0 ? 0xffd76b : 0x7fd4ff, 0.9)
    .setOrigin(0, 0.5)
    .setDepth(depth + 1);
  scene.add
    .text(x, y + EXP_BAR_H, need === 0 ? 'MAX LEVEL' : `${p.exp} / ${need} EXP`, {
      fontFamily: 'Lato', fontSize: '11px', color: BOON_MUTED,
    })
    .setOrigin(0.5, 0)
    .setDepth(depth);
}

/** HP / attack-or-heal / swing interval, the three numbers that decide a pick. */
function statStrip(hero: HeroDef): string {
  const per = hero.role === 'heal' ? 'HEAL' : 'ATK';
  return `${hero.maxHp} HP  ·  ${hero.attack} ${per}  ·  ${(hero.attackIntervalMs / 1000).toFixed(1)}s`;
}
