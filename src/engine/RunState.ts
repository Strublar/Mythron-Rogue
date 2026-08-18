import { equipArtifact } from '../data/artifacts';
import { starterParty } from '../data/heroes';
import { PARTY_SEATS, SEAT_COUNT, seatedSlots } from '../game/layout';
import type { ArtifactDef, HeroDef, HeroRole } from '../types';

/**
 * A single roguelike run: the seven seats, the stage reached and the purse. A run opens
 * on the starter seven and never loses a body — the interlude *replaces* an occupant, it
 * never fills a gap. Everything here dies with the run; nothing is persisted.
 */
export class RunState {
  private readonly seats: HeroDef[] = starterParty();
  /**
   * One artifact per seat — the gear belongs to the seat, so swapping the occupant hands
   * it to whoever moves in. Buying a second one for a seat replaces the first.
   */
  private readonly gear: (ArtifactDef | null)[] = Array(SEAT_COUNT).fill(null);
  /** 1-based; `bossForStage` reads it. */
  stage = 1;
  gold = 0;

  /**
   * The heroes fielded, in seat order, artifacts folded in — what the engine and the
   * views read. Every caller sees the geared def, so stats and tooltips agree everywhere.
   */
  party(): HeroDef[] {
    return this.seats.map((def, seat) => {
      const artifact = this.gear[seat];
      return artifact ? equipArtifact(def, artifact) : def;
    });
  }

  seatArray(): readonly HeroDef[] {
    return this.party();
  }

  artifactAt(seat: number): ArtifactDef | null {
    return this.gear[seat] ?? null;
  }

  /** Artifact ids already worn — what the shop roll excludes. */
  ownedArtifactIds(): Set<string> {
    return new Set(this.gear.flatMap(a => (a ? [a.id] : [])));
  }

  /** Straps `artifact` onto `seat`, dropping whatever it wore. One per character. */
  equip(seat: number, artifact: ArtifactDef): boolean {
    if (seat < 0 || seat >= SEAT_COUNT) return false;
    this.gear[seat] = artifact;
    return true;
  }

  /** Every seat paired with its battlefield slot. */
  placed(): { def: HeroDef; seat: number; slot: { x: number; y: number } }[] {
    return seatedSlots(this.party());
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
