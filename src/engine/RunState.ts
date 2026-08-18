import { starterParty } from '../data/heroes';
import { PARTY_SEATS, SEAT_COUNT, seatedSlots } from '../game/layout';
import type { HeroDef, HeroRole } from '../types';

/**
 * A single roguelike run: the seven seats, the stage reached and the purse. A run opens
 * on the starter seven and never loses a body — the interlude *replaces* an occupant, it
 * never fills a gap. Everything here dies with the run; nothing is persisted.
 */
export class RunState {
  private readonly seats: HeroDef[] = starterParty();
  /** 1-based; `bossForStage` reads it. */
  stage = 1;
  gold = 0;

  /** The heroes fielded, in seat order — what the engine and the views read. */
  party(): HeroDef[] {
    return [...this.seats];
  }

  seatArray(): readonly HeroDef[] {
    return this.seats;
  }

  /** Every seat paired with its battlefield slot. */
  placed(): { def: HeroDef; seat: number; slot: { x: number; y: number } }[] {
    return seatedSlots(this.seats);
  }

  /** Seat indices a hero of this role may take — the only legal drop targets. */
  seatsForRole(role: HeroRole): number[] {
    return PARTY_SEATS.flatMap((s, i) => (s.role === role ? [i] : []));
  }

  /** Swaps `def` into `seat`, dropping whoever sat there. Rejects a role mismatch. */
  replaceSeat(seat: number, def: HeroDef): boolean {
    if (seat < 0 || seat >= SEAT_COUNT) return false;
    if (PARTY_SEATS[seat].role !== def.role) return false;
    this.seats[seat] = def;
    return true;
  }

  /** Ids currently fielded — what the offer roll excludes. */
  fieldedIds(): Set<string> {
    return new Set(this.seats.map(d => d.id));
  }

  award(gold: number): void {
    this.gold += Math.max(0, gold);
  }

  canAfford(price: number): boolean {
    return this.gold >= price;
  }

  /** Spends `price` if the purse covers it. */
  spend(price: number): boolean {
    if (!this.canAfford(price)) return false;
    this.gold -= price;
    return true;
  }

  advance(): void {
    this.stage += 1;
  }
}
