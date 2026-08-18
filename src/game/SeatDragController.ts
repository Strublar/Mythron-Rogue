import Phaser from 'phaser';
import { seatSlot } from './layout';

/** Finger-friendly catch radius around a seat. */
const SEAT_RADIUS = 90;
/** Past this much travel the gesture is a drag, not a tap. */
const DRAG_THRESHOLD = 10;

/**
 * Drag an offer card onto one of the party's seats. Separate from `DragCastController`,
 * which hit-tests live `CombatantView`s and casts abilities — this one only moves a card
 * and reports the seat it landed on. Only the seats the caller names light up; a drop
 * anywhere else springs the card home and changes nothing. The payload is whatever the
 * scene drags — a hero for a recruit, an artifact for a piece of gear.
 */
export class SeatDragController<T> {
  private readonly highlights: Phaser.GameObjects.Arc[] = [];
  private dragging?: {
    card: Phaser.GameObjects.Container;
    payload: T;
    home: { x: number; y: number };
    /** Card centre minus grab point, so the card never teleports under the finger. */
    grab: { x: number; y: number };
    /** Where the finger went down — the only honest baseline for tap-vs-drag. */
    from: { x: number; y: number };
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onDrop: (payload: T, seat: number) => void,
  ) {
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.move(p));
    scene.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.release(p));
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.cancel());
  }

  /**
   * Makes a card draggable. `seats` is where this payload may legally land, `accent` the
   * colour its target rings are drawn in.
   */
  register(card: Phaser.GameObjects.Container, payload: T, seats: number[], accent: number): void {
    const home = { x: card.x, y: card.y };
    card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.dragging = {
        card, payload, home,
        grab: { x: card.x - p.x, y: card.y - p.y },
        from: { x: p.x, y: p.y },
      };
      card.setDepth(card.depth + 100);
      this.showTargets(seats, accent);
    });
  }

  /** Drops every highlight and any card mid-drag — call before the scene redraws. */
  cancel(): void {
    this.springBack();
    this.clearTargets();
  }

  private move(p: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    const { card, grab } = this.dragging;
    card.setPosition(p.x + grab.x, p.y + grab.y);
  }

  private release(p: Phaser.Input.Pointer): void {
    const drag = this.dragging;
    if (!drag) return;
    // A tap that never travelled is not a drop — it belongs to the long-press inspect.
    const travelled = Phaser.Math.Distance.Between(drag.from.x, drag.from.y, p.x, p.y);
    // The finger is what the player aims — the card is 224 wide, so a card-centre test
    // makes an edge grab undroppable: the centre stays up to half a card off the seat.
    const seat = travelled > DRAG_THRESHOLD ? this.seatUnder(p.x, p.y) : -1;

    this.cancel();
    if (seat >= 0) this.onDrop(drag.payload, seat);
  }

  /** The nearest legal seat within the catch radius, or -1. */
  private seatUnder(x: number, y: number): number {
    let best = -1;
    let bestDist = SEAT_RADIUS;
    for (const ring of this.highlights) {
      const seat = ring.getData('seat') as number;
      const dist = Phaser.Math.Distance.Between(ring.x, ring.y, x, y);
      if (dist < bestDist) {
        best = seat;
        bestDist = dist;
      }
    }
    return best;
  }

  private showTargets(seats: number[], accent: number): void {
    this.clearTargets();
    for (const seat of seats) {
      const { x, y } = seatSlot(seat);
      const ring = this.scene.add
        .circle(x, y, SEAT_RADIUS * 0.7)
        .setStrokeStyle(3, accent, 0.9)
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
