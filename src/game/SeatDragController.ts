import Phaser from 'phaser';
import type { HeroDef } from '../types';
import { ROLE_COLOR, seatSlot } from './layout';

/** Finger-friendly catch radius around a seat. */
const SEAT_RADIUS = 90;
/** Past this much travel the gesture is a drag, not a tap. */
const DRAG_THRESHOLD = 10;

/**
 * Drag an offer card onto one of the party's seats. Separate from `DragCastController`,
 * which hit-tests live `CombatantView`s and casts abilities — this one only moves a card
 * and reports the seat it landed on. Only seats matching the hero's role light up; a drop
 * anywhere else springs the card home and changes nothing.
 */
export class SeatDragController {
  private readonly highlights: Phaser.GameObjects.Arc[] = [];
  private dragging?: { card: Phaser.GameObjects.Container; hero: HeroDef; home: { x: number; y: number } };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onDrop: (hero: HeroDef, seat: number) => void,
  ) {
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.move(p));
    scene.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.release(p));
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.cancel());
  }

  /** Makes a card draggable. `seats` is where this hero may legally land. */
  register(card: Phaser.GameObjects.Container, hero: HeroDef, seats: number[]): void {
    const home = { x: card.x, y: card.y };
    card
      .setInteractive(
        new Phaser.Geom.Rectangle(-card.width / 2, -card.height / 2, card.width, card.height),
        Phaser.Geom.Rectangle.Contains,
      )
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.dragging = { card, hero, home };
        card.setDepth(card.depth + 100);
        this.showTargets(seats, hero);
      });
  }

  /** Drops every highlight and any card mid-drag — call before the scene redraws. */
  cancel(): void {
    this.springBack();
    this.clearTargets();
  }

  private move(p: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    this.dragging.card.setPosition(p.x, p.y);
  }

  private release(p: Phaser.Input.Pointer): void {
    const drag = this.dragging;
    if (!drag) return;
    // A tap that never travelled is not a drop — it belongs to the long-press inspect.
    const travelled = Phaser.Math.Distance.Between(drag.home.x, drag.home.y, p.x, p.y);
    const seat = travelled > DRAG_THRESHOLD ? this.seatUnder(p) : -1;

    this.cancel();
    if (seat >= 0) this.onDrop(drag.hero, seat);
  }

  /** The nearest legal seat within the catch radius, or -1. */
  private seatUnder(p: Phaser.Input.Pointer): number {
    let best = -1;
    let bestDist = SEAT_RADIUS;
    for (const ring of this.highlights) {
      const seat = ring.getData('seat') as number;
      const dist = Phaser.Math.Distance.Between(ring.x, ring.y, p.x, p.y);
      if (dist < bestDist) {
        best = seat;
        bestDist = dist;
      }
    }
    return best;
  }

  private showTargets(seats: number[], hero: HeroDef): void {
    this.clearTargets();
    for (const seat of seats) {
      const { x, y } = seatSlot(seat);
      const ring = this.scene.add
        .circle(x, y, SEAT_RADIUS * 0.7)
        .setStrokeStyle(3, ROLE_COLOR[hero.role], 0.9)
        .setDepth(50)
        .setData('seat', seat);
      this.scene.tweens.add({
        targets: ring, alpha: { from: 0.35, to: 1 }, duration: 500, yoyo: true, repeat: -1,
      });
      this.highlights.push(ring);
    }
  }

  private clearTargets(): void {
    for (const ring of this.highlights) {
      this.scene.tweens.killTweensOf(ring);
      ring.destroy();
    }
    this.highlights.length = 0;
  }

  private springBack(): void {
    const drag = this.dragging;
    this.dragging = undefined;
    if (!drag) return;
    drag.card.setDepth(drag.card.depth - 100);
    this.scene.tweens.add({
      targets: drag.card, x: drag.home.x, y: drag.home.y, duration: 150, ease: 'Sine.easeOut',
    });
  }
}
