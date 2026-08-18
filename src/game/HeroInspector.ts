import Phaser from 'phaser';
import type { HeroDef } from '../types';
import { HeroTooltip } from './HeroTooltip';
import { HERO_TOUCH, seatedSlots } from './layout';

/** Hold this long on a hero before its stats card opens. */
const LONG_PRESS_MS = 300;
/**
 * Past this much travel the gesture is a drag, not a press. Game units: the 720-wide
 * canvas fits into ~390 CSS px on a phone, so 20 here is ~11 px of finger — under that
 * a thumb resting on a hero wobbles enough to cancel its own long press.
 */
const MOVE_TOLERANCE = 20;
const PROBE_DEPTH = 5;

/**
 * Long-press-to-inspect, shared by the two scenes that need it. The interlude owns its
 * own probe zones (the fight scene below it takes no input); the fight scene arms the
 * press from the hero sprites it already made interactive for drag-casting.
 */
export class HeroInspector {
  /** The fight scene turns inspection off once the fight is live. */
  enabled = true;
  /** Fired when the card actually opens — lets the fight scene drop its pending drag. */
  onOpen?: () => void;

  private readonly tooltip: HeroTooltip;
  private timer?: number;

  constructor(private readonly scene: Phaser.Scene) {
    this.tooltip = new HeroTooltip(scene);
    scene.input.on(Phaser.Input.Events.POINTER_UP, () => this.cancel());
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.cancel());
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.onMove(p));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cancel());
  }

  /**
   * Invisible press zones over every filled seat — for scenes that draw no heroes of their
   * own. Returned so a scene that reseats heroes can destroy the stale probes first.
   */
  addProbes(seats: readonly (HeroDef | null)[]): Phaser.GameObjects.Zone[] {
    return seatedSlots(seats).map(({ def, slot }) =>
      this.scene.add
        .zone(slot.x, slot.y + HERO_TOUCH.dy, HERO_TOUCH.w, HERO_TOUCH.h)
        .setDepth(PROBE_DEPTH)
        .setInteractive()
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.press(def, slot.x, slot.y))
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.cancel()),
    );
  }

  /** Arms the press timer. Call from an existing pointer-down handler. */
  press(def: HeroDef, x: number, y: number): void {
    this.cancel();
    if (!this.enabled) return;
    // Wall clock rather than the scene clock: a still finger renders no frames on some
    // browsers, which would stall a delta-driven timer indefinitely.
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      this.tooltip.show(def, x, y);
      this.onOpen?.();
    }, LONG_PRESS_MS);
  }

  cancel(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.tooltip.hide();
  }

  /** Travel since pointer-down — past the tolerance the gesture is a drag, so drop the press. */
  private onMove(p: Phaser.Input.Pointer): void {
    if (this.timer !== undefined && p.getDistance() > MOVE_TOLERANCE) this.cancel();
  }
}
