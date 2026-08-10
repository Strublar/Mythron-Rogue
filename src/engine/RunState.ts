import { GENERAL_SEAT, PARTY_SEATS, SEAT_COUNT, seatedSlots } from '../game/layout';
import type { HeroDef, HeroRole } from '../types';

/**
 * Persistent state of a single roguelike run: the party as it grows. A run opens with the
 * chosen general alone in the centre dps seat; every cleared boss offers a unit that takes
 * the first free seat of its role. Full at 2 tanks / 3 dps / 2 heals — the general counts
 * as one of the dps.
 */
export class RunState {
  private readonly seats: (HeroDef | null)[] = new Array(SEAT_COUNT).fill(null);

  constructor(general: HeroDef) {
    this.seats[GENERAL_SEAT] = general;
  }

  /** The heroes fielded, in seat order — what the engine and the exp payout read. */
  party(): HeroDef[] {
    return this.seats.filter((def): def is HeroDef => !!def);
  }

  /** Sparse view: what the draft rolls against and what the views place. */
  seatArray(): readonly (HeroDef | null)[] {
    return this.seats;
  }

  /** Every filled seat paired with its battlefield slot. */
  placed(): { def: HeroDef; seat: number; slot: { x: number; y: number } }[] {
    return seatedSlots(this.seats);
  }

  /** Where a unit of this role would land — first free seat of its row, or -1 if the row is full. */
  nextSeat(role: HeroRole): number {
    return PARTY_SEATS.findIndex((s, i) => s.role === role && !this.seats[i]);
  }

  isFull(): boolean {
    return this.seats.every(def => !!def);
  }

  /** Seats the unit in the first free seat of its role. Returns that seat, or -1 if none. */
  addUnit(def: HeroDef): number {
    const seat = this.nextSeat(def.role);
    if (seat >= 0) this.seats[seat] = def;
    return seat;
  }
}
