import Phaser from 'phaser';
import { BOSS_TARGET, type FightEngine } from '../engine/FightEngine';
import type { CombatantView } from './CombatantView';
import type { HeroState } from '../types';

const DROP_RADIUS = 90;      // finger-sized ally hit test
const BOSS_PADDING = 60;     // generous boss drop zone
const ARROW_COLOR = 0xffd76b;

/** Drag a ready hero onto a valid target to cast its ability. */
export class DragCastController {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private dragging?: HeroState;
  private pulse = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly engine: FightEngine,
    private readonly heroViews: Map<string, CombatantView>,
    private readonly bossView: CombatantView,
  ) {
    this.gfx = scene.add.graphics().setDepth(90);

    for (const [heroId, view] of heroViews) {
      view.sprite.setInteractive({ useHandCursor: true });
      view.sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.begin(heroId));
    }

    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.redraw(p));
    scene.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.finish(p));
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.cancel());
  }

  private begin(heroId: string): void {
    if (!this.engine.isAbilityReady(heroId)) return;
    this.dragging = this.engine.hero(heroId);
  }

  private cancel(): void {
    this.dragging = undefined;
    this.gfx.clear();
  }

  private finish(pointer: Phaser.Input.Pointer): void {
    const hero = this.dragging;
    if (!hero) return;
    const target = this.resolveTarget(hero, pointer);
    if (target) this.engine.castAbility(hero.def.id, target);
    this.cancel();
  }

  /** Returns the target id under the pointer, or undefined if the drop is invalid. */
  private resolveTarget(hero: HeroState, pointer: Phaser.Input.Pointer): string | undefined {
    if (hero.def.ability.targetKind === 'boss') {
      return this.overBoss(pointer) ? BOSS_TARGET : undefined;
    }
    let best: { id: string; dist: number } | undefined;
    for (const ally of this.engine.heroes) {
      if (!ally.alive) continue;
      const view = this.heroViews.get(ally.def.id);
      if (!view) continue;
      const dist = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, view.x, view.y);
      if (dist <= DROP_RADIUS && (!best || dist < best.dist)) best = { id: ally.def.id, dist };
    }
    return best?.id;
  }

  private overBoss(pointer: Phaser.Input.Pointer): boolean {
    const b = this.bossView.sprite.getBounds();
    return Phaser.Geom.Rectangle.Contains(
      new Phaser.Geom.Rectangle(
        b.x - BOSS_PADDING, b.y - BOSS_PADDING,
        b.width + BOSS_PADDING * 2, b.height + BOSS_PADDING * 2,
      ),
      pointer.worldX, pointer.worldY,
    );
  }

  /** Called from the scene's update loop so highlights keep pulsing. */
  refresh(delta: number, pointer: Phaser.Input.Pointer): void {
    this.pulse += delta;
    if (this.dragging) this.redraw(pointer);
  }

  private redraw(pointer: Phaser.Input.Pointer): void {
    const hero = this.dragging;
    this.gfx.clear();
    if (!hero) return;

    const from = this.heroViews.get(hero.def.id);
    if (!from) return;

    const alpha = 0.45 + 0.25 * Math.sin(this.pulse / 140);
    for (const t of this.validTargets(hero)) {
      this.gfx.lineStyle(4, ARROW_COLOR, alpha).strokeEllipse(t.x, t.groundY, t.w, t.w * 0.38);
    }

    const valid = !!this.resolveTarget(hero, pointer);
    this.gfx.lineStyle(6, ARROW_COLOR, valid ? 1 : 0.4);
    this.gfx.beginPath();
    this.gfx.moveTo(from.x, from.groundY);
    this.gfx.lineTo(pointer.worldX, pointer.worldY);
    this.gfx.strokePath();
    this.gfx.fillStyle(ARROW_COLOR, valid ? 1 : 0.4).fillCircle(pointer.worldX, pointer.worldY, 12);
  }

  private validTargets(hero: HeroState): { x: number; groundY: number; w: number }[] {
    if (hero.def.ability.targetKind === 'boss') {
      return this.engine.boss.alive
        ? [{ x: this.bossView.x, groundY: this.bossView.groundY, w: 200 }]
        : [];
    }
    return this.engine.heroes
      .filter(h => h.alive)
      .map(h => this.heroViews.get(h.def.id))
      .filter((v): v is CombatantView => !!v)
      .map(v => ({ x: v.x, groundY: v.groundY, w: 96 }));
  }
}
