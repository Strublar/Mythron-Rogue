import Phaser from 'phaser';
import { addExp } from '../../data/progression';
import { savedParty, unlockedCount } from '../../engine/ProgressionStore';
import type { ExpGain } from '../../engine/ProgressionStore';
import { encounterAt } from '../../data/encounters';
import type { EncounterDef, HeroDef } from '../../types';
import { drawExpBar } from '../ExpBar';
import { GAME_HEIGHT, GAME_WIDTH, ROLE_COLOR } from '../layout';
import { UI_CREAM, UI_GOLD, UI_MUTED, createButton, drawSceneBackground, sceneLabel } from '../ui';

/** What the fight scene hands over once the encounter is settled. */
export interface ResultData {
  victory: boolean;
  encounter: EncounterDef;
  /** The roster that fought — rows are drawn in slot order, gains or not. */
  party: HeroDef[];
  gains: ExpGain[];
  gold: number;
  /** The clear opened the next encounter of the chain. */
  unlocked: boolean;
}

const ROWS_TOP = 320;
/** Seven rows have to sit between the gold line and the buttons — this is the fit. */
const ROW_H = 96;
const BAR_W = 330;
/** Rows fill one after another, so the eye follows the party down the list. */
const FILL_MS = 700;
const ROW_STAGGER_MS = 90;

export class ResultScene extends Phaser.Scene {
  private result!: ResultData;

  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data: ResultData): void {
    this.result = data;
  }

  create(): void {
    const { victory, encounter, party, gains, gold } = this.result;
    drawSceneBackground(this);

    sceneLabel(
      this, GAME_WIDTH / 2, 70, victory ? 'VICTORY' : 'DEFEAT', 62,
      victory ? UI_GOLD : '#ff8a80', 'bold',
    );
    sceneLabel(
      this, GAME_WIDTH / 2, 128,
      `ENCOUNTER ${encounter.index}  ·  ${encounter.name.toUpperCase()}`, 22, UI_CREAM,
    );
    sceneLabel(
      this, GAME_WIDTH / 2, 164,
      victory ? 'The party takes its spoils.' : 'The party falls. No rewards.', 18, UI_MUTED,
    );

    this.drawGold(gold);
    party.forEach((hero, i) => {
      const gain = gains.find(g => g.heroId === hero.id);
      this.drawHeroRow(hero, gain, ROWS_TOP + i * ROW_H, i);
    });

    this.drawButtons();
  }

  /** Account-wide payout, counted up so the number reads as earned rather than printed. */
  private drawGold(gold: number): void {
    const text = sceneLabel(this, GAME_WIDTH / 2, 222, '+0 GOLD', 30, UI_GOLD, 'bold');
    if (gold === 0) {
      text.setText('+0 GOLD').setColor(UI_MUTED);
      return;
    }
    const counter = { value: 0 };
    this.tweens.add({
      targets: counter,
      value: gold,
      duration: FILL_MS,
      ease: 'Quad.easeOut',
      onUpdate: () => text.setText(`+${Math.round(counter.value)} GOLD`),
    });
  }

  /**
   * One hero: name, its exp bar, and the exp it just earned. The bar animates from the
   * progress it had into the progress it has — `addExp` rolls the levels, so a bar that
   * fills mid-tween simply restarts at the next level.
   */
  private drawHeroRow(hero: HeroDef, gain: ExpGain | undefined, y: number, index: number): void {
    const left = (GAME_WIDTH - BAR_W) / 2;
    const before = gain?.before ?? { level: hero.level ?? 1, exp: 0 };
    const earned = gain?.exp ?? 0;

    this.add
      .text(left, y - 18, hero.name.toUpperCase(), {
        fontFamily: 'Lato', fontSize: '17px', color: UI_CREAM, fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    const levelText = this.add
      .text(left + BAR_W, y - 18, `LVL ${before.level}`, {
        fontFamily: 'Lato', fontSize: '17px', color: hexColor(ROLE_COLOR[hero.role]), fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);

    const bar = drawExpBar(this, GAME_WIDTH / 2, y + 8, BAR_W, before, 10, 10);
    if (earned === 0) return;

    this.add
      .text(GAME_WIDTH / 2 + BAR_W / 2 + 14, y + 8, `+${earned}`, {
        fontFamily: 'Lato', fontSize: '17px', color: '#7fd4ff', fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    const filling = { t: 0 };
    this.tweens.add({
      targets: filling,
      t: 1,
      duration: FILL_MS,
      delay: index * ROW_STAGGER_MS,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        const now = addExp(before, Math.round(earned * filling.t));
        bar.setProgress(now);
        levelText.setText(`LVL ${now.level}`);
      },
      onComplete: () => {
        if (!gain || gain.after.level === gain.before.level) return;
        this.popLevelUp(GAME_WIDTH / 2, y - 18, gain.unlockedPassive);
      },
    });
  }

  private popLevelUp(x: number, y: number, unlockedPassive: boolean): void {
    const text = this.add
      .text(x, y, unlockedPassive ? 'LEVEL UP · PASSIVE!' : 'LEVEL UP', {
        fontFamily: 'Lato', fontSize: '18px', color: UI_GOLD, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: text, y: y - 22, alpha: 0, duration: 1100, delay: 400, ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * A win rolls on to the encounter it unlocked (or replays the last one); a loss offers
   * the same fight again. Either way MENU goes back to the roster and the shop.
   */
  private drawButtons(): void {
    const { victory, encounter, unlocked } = this.result;
    // Only a clear that opened the next encounter rolls forward; anything else replays.
    const next = unlocked ? Math.min(encounter.index + 1, unlockedCount()) : encounter.index;
    const label = victory && unlocked ? 'NEXT' : 'RETRY';

    createButton(this, GAME_WIDTH / 2 - 150, GAME_HEIGHT - 90, 'MENU', () => {
      this.scene.start('MainMenuScene');
    });
    createButton(this, GAME_WIDTH / 2 + 150, GAME_HEIGHT - 90, label, () => {
      // Re-read the party: the levels just earned have to ride into the next fight.
      this.scene.start('BossFightScene', { party: savedParty(), encounter: encounterAt(next) });
    });
  }
}

const hexColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
